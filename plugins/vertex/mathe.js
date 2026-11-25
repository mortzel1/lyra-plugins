'use strict';
/*
 * Vertex – Rechenkern (ohne KI, ohne Netz).
 * Ausdrücke lesen (wie man sie schreibt: 2x², √x, |x|, sin x, f'(x), P(1|2)), symbolisch ableiten und vereinfachen,
 * schön ausgeben (Text und LaTeX), numerisch untersuchen (Nullstellen, Extrema, Wendepunkte, Integrale, Asymptoten),
 * Steckbriefaufgaben exakt lösen (Brüche statt Kommazahlen) und Regressionen rechnen.
 */
const Mathe = (() => {
  // ================================================================ Brüche (exakt, sonst Kommazahl)

  const SICHER = 2 ** 52;
  const ggt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  function q(z, n = 1) {
    if (!Number.isFinite(z) || !Number.isFinite(n) || n === 0) return { f: z / n };
    if (!Number.isInteger(z) || !Number.isInteger(n) || Math.abs(z) > SICHER || Math.abs(n) > SICHER) return { f: z / n };
    if (n < 0) { z = -z; n = -n; }
    const g = ggt(z, n) || 1;
    return { z: z / g + 0, n: n / g };
  }
  const qf = (a) => ('f' in a ? a.f : a.z / a.n);
  const qExakt = (a) => !('f' in a);
  const qPlus = (a, b) => (qExakt(a) && qExakt(b) ? q(a.z * b.n + b.z * a.n, a.n * b.n) : { f: qf(a) + qf(b) });
  const qMal = (a, b) => (qExakt(a) && qExakt(b) ? q(a.z * b.z, a.n * b.n) : { f: qf(a) * qf(b) });
  const qDurch = (a, b) => (qExakt(a) && qExakt(b) ? (b.z === 0 ? { f: NaN } : q(a.z * b.n, a.n * b.z)) : { f: qf(a) / qf(b) });
  const qNeg = (a) => (qExakt(a) ? { z: -a.z + 0, n: a.n } : { f: -a.f });
  const qNull = (a) => qf(a) === 0;
  const qEins = (a) => qf(a) === 1;
  const qGanz = (a) => (qExakt(a) ? a.n === 1 : Number.isInteger(a.f));
  function qHoch(a, k) {
    if (!Number.isInteger(k) || Math.abs(k) > 400) return { f: Math.pow(qf(a), k) };
    if (k < 0) return qDurch(q(1), qHoch(a, -k));
    let r = q(1);
    for (let i = 0; i < k; i++) { r = qMal(r, a); if (!qExakt(r) && qExakt(a)) return { f: Math.pow(qf(a), k) }; }
    return r;
  }
  /** „0.25“ → 1/4 */
  function qAusText(s) {
    const t = String(s).replace(',', '.');
    const [g, d = ''] = t.split('.');
    if (d.length > 14) return { f: Number(t) };
    return q(Number((g || '0') + d), 10 ** d.length);
  }
  /** Zahl → Bruch, wenn sie (fast) einer mit kleinem Nenner entspricht. */
  function qAusZahl(v, maxN = 10000) {
    if (Number.isInteger(v)) return q(v);
    const b = bruchNahe(v, maxN, 1e-12 * Math.max(1, Math.abs(v)));
    return b ? q(b[0], b[1]) : { f: v };
  }
  /** Exakte n-te Wurzel eines Bruchs (oder null). */
  function wurzelExakt(a, n) {
    if (!qExakt(a) || a.z < 0) return null;
    const w = (x) => { const r = Math.round(Math.pow(x, 1 / n)); return Math.pow(r, n) === x ? r : null; };
    const z = w(a.z), m = w(a.n);
    return z !== null && m !== null ? q(z, m) : null;
  }

  /** Kettenbruch: bester Bruch z/n (n ≤ maxN) innerhalb tol – oder null. */
  function bruchNahe(v, maxN, tol) {
    if (!Number.isFinite(v)) return null;
    let h0 = 1, h1 = 0, k0 = 0, k1 = 1, x = v;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(x);
      const h2 = a * h0 + h1, k2 = a * k0 + k1;
      if (k2 > maxN) break;
      h1 = h0; h0 = h2; k1 = k0; k0 = k2;
      if (Math.abs(v - h0 / k0) <= tol) return [h0, k0];
      const r = x - a;
      if (r < 1e-15) break;
      x = 1 / r;
    }
    return null;
  }

  // ================================================================ Bausteine des Syntaxbaums

  const Z = (v) => ({ t: 'zahl', q: typeof v === 'number' ? (Number.isInteger(v) ? q(v) : { f: v }) : v });
  const V = (n) => ({ t: 'var', n });
  const K = (n) => ({ t: 'konst', n });
  const B = (t, a, b) => ({ t, a, b });
  const F = (n, ...a) => ({ t: 'fn', n, a });

  // Funktionen mit Stelligkeit; Synonyme werden beim Lesen ersetzt
  const FUNKTIONEN = {
    sin: 1, cos: 1, tan: 1, cot: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1,
    exp: 1, ln: 1, log: 1, lg: 1, ld: 1, sqrt: 1, cbrt: 1, abs: 1, sgn: 1, floor: 1, ceil: 1, round: 1,
    min: 2, max: 2, nroot: 2, root: 2, logb: 2,
    asin: 1, acos: 1, atan: 1, sign: 1, wurzel: 1, betrag: 1,
  };
  const SYNONYM = { asin: 'arcsin', acos: 'arccos', atan: 'arctan', sign: 'sgn', wurzel: 'sqrt', betrag: 'abs', root: 'nroot' };
  const BEKANNT = [...Object.keys(FUNKTIONEN), 'pi', 'theta'];

  const fehler = (text) => { const e = new Error(text); e.mathe = true; return e; };

  // ================================================================ Lesen

  const HOCH = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  function normalisieren(s) {
    return String(s || '')
      .replace(/[−–—]/g, '-').replace(/[·×⋅∙•]/g, '*').replace(/÷/g, '/').replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/π/g, 'pi').replace(/[θϑ]/g, 'theta').replace(/ℯ/g, 'e').replace(/∛/g, 'cbrt').replace(/√/g, 'sqrt')
      .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^' + (m.length > 1 ? '(' + [...m].map((c) => HOCH[c]).join('') + ')' : HOCH[m]))
      .replace(/\*\*/g, '^').replace(/\\cdot/g, '*').replace(/\\pi/g, 'pi').replace(/\\left|\\right/g, '')
      .trim();
  }

  /** Zeichen → Wörter. Buchstabenfolgen werden in bekannte Namen zerlegt („sinx“ → sin, x; „2ab“ → 2, a, b). */
  function zerlegen(s, eigene) {
    const namen = [...BEKANNT, ...(eigene || [])].sort((a, b) => b.length - a.length);
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const rest = s.slice(i);
      let m;
      if ((m = /^(\d+(?:[.,]\d+)?|[.]\d+)/.exec(rest))) {
        t.push({ t: 'zahl', q: qAusText(m[1]), s: m[1] });
        i += m[1].length;
        continue;
      }
      if ((m = /^[A-Za-z]+/.exec(rest))) {
        const lauf = m[0];
        i += lauf.length;
        const teile = [];
        let j = 0;
        while (j < lauf.length) {
          const n = namen.find((x) => lauf.startsWith(x, j)) || lauf[j];
          teile.push(n);
          j += n.length;
        }
        // Index: a_1, x_{0}, log_2
        let index = '';
        if (s[i] === '_') {
          const im = /^_(\{([A-Za-z0-9]+)\}|[A-Za-z0-9]+)/.exec(s.slice(i));
          if (im) { index = im[2] || im[1]; i += im[0].length; }
        }
        let striche = 0;
        while (s[i] === "'" || s[i] === '′' || s[i] === '’') { striche++; i++; }
        teile.forEach((n, k) => {
          const letzt = k === teile.length - 1;
          t.push({ t: 'name', v: letzt && index && n !== 'log' ? n + '_' + index : n, basis: letzt && index && n === 'log' ? index : null, striche: letzt ? striche : 0 });
        });
        continue;
      }
      if ((m = /^(<=|>=|!=|<|>|=)/.exec(rest))) { t.push({ t: 'op', v: m[1] }); i += m[1].length; continue; }
      if ('+-*/^(),;|!'.includes(c)) { t.push({ t: 'op', v: c }); i++; continue; }
      if ('[{'.includes(c)) { t.push({ t: 'op', v: '(' }); i++; continue; }
      if (']}'.includes(c)) { t.push({ t: 'op', v: ')' }); i++; continue; }
      throw fehler(`Das Zeichen „${c}“ kenne ich nicht.`);
    }
    return t;
  }

  /** Wörter → Syntaxbaum. ctx.funktionen: Namen eigener Funktionen (f, g …), die mit f(…) aufgerufen werden. */
  function baumAus(tok, ctx = {}) {
    const eigene = ctx.funktionen || new Set();
    let p = 0;
    let betragTiefe = 0;
    const sieh = () => tok[p];
    const istOp = (v) => tok[p] && tok[p].t === 'op' && tok[p].v === v;
    const erwarte = (v, was) => {
      if (!istOp(v)) throw fehler(was || (tok[p] ? `Hier fehlt „${v}“.` : `Am Ende fehlt „${v}“.`));
      p++;
    };
    const istFunktionsName = (k) => k && k.t === 'name' && (FUNKTIONEN[k.v] || k.basis || eigene.has(k.v));

    function summe() {
      let a = produkt();
      while (istOp('+') || istOp('-')) {
        const o = tok[p++].v;
        if (!tok[p]) throw fehler(`Nach „${o}“ fehlt etwas.`);
        a = B(o, a, produkt());
      }
      return a;
    }
    function beginntFaktor() {
      const k = sieh();
      if (!k) return false;
      if (k.t === 'zahl' || k.t === 'name') return true;
      if (k.t === 'op' && k.v === '(') return true;
      if (k.t === 'op' && k.v === '|') return betragTiefe === 0;
      return false;
    }
    function produkt() {
      let a = unaer();
      for (;;) {
        if (istOp('*') || istOp('/')) {
          const o = tok[p++].v;
          if (!tok[p]) throw fehler(`Nach „${o}“ fehlt etwas.`);
          a = B(o, a, unaer());
          continue;
        }
        if (beginntFaktor()) { a = B('*', a, potenz()); continue; }
        return a;
      }
    }
    function unaer() {
      if (istOp('-')) { p++; return { t: 'neg', a: unaer() }; }
      if (istOp('+')) { p++; return unaer(); }
      return potenz();
    }
    function potenz() {
      const basis = primaer();
      if (istOp('^')) {
        p++;
        if (!tok[p]) throw fehler('Nach „^“ fehlt der Exponent.');
        return B('^', basis, unaer());
      }
      if (istOp('!')) throw fehler('Fakultät (!) kann Vertex noch nicht.');
      return basis;
    }
    function argumentOhneKlammer() {
      let a = unaer();
      while (beginntFaktor() && !istFunktionsName(sieh())) a = B('*', a, potenz());
      return a;
    }
    function argumente() {
      p++; // (
      const l = [summe()];
      while (istOp(',') || istOp(';')) { p++; l.push(summe()); }
      erwarte(')', 'Eine Klammer „)“ fehlt.');
      return l;
    }
    function funktion(k) {
      let n = SYNONYM[k.v] || k.v;
      let hoch = null;
      if (istOp('^')) { p++; hoch = primaer(); } // sin^2(x)
      const args = istOp('(') ? argumente() : [argumentOhneKlammer()];
      let knoten;
      if (k.basis) {
        if (args.length !== 1) throw fehler('log_b braucht genau ein Argument: log_2(x).');
        knoten = F('logb', args[0], baumAus(zerlegen(k.basis), ctx));
      } else if (n === 'log' && args.length === 2) {
        knoten = F('logb', args[1], args[0]); // log(b, x) wie in GeoGebra
      } else if (n === 'lg') {
        knoten = F('log', ...args);
      } else if (n === 'ld') {
        knoten = F('logb', args[0], Z(2));
      } else if (n === 'exp') {
        knoten = B('^', K('e'), args[0]);
      } else {
        knoten = F(n, ...args);
      }
      if (knoten.t === 'fn') {
        const soll = FUNKTIONEN[knoten.n] || 1;
        if (knoten.a.length !== soll) throw fehler(soll === 1 ? `${n} braucht ein Argument, z. B. ${n}(x).` : `${n} braucht ${soll} Argumente, getrennt mit „;“ – z. B. ${n}(x; 2).`);
      }
      return hoch ? B('^', knoten, hoch) : knoten;
    }
    function primaer() {
      const k = tok[p++];
      if (!k) throw fehler('Hier fehlt noch etwas.');
      if (k.t === 'zahl') return { t: 'zahl', q: k.q };
      if (k.t === 'op') {
        if (k.v === '(') {
          if (istOp(')')) throw fehler('Leere Klammern.');
          const a = summe();
          if (istOp(',') || istOp(';')) throw fehler('Ein Punkt hat die Form (1|2) – als eigene Zeile.');
          erwarte(')', 'Eine Klammer „)“ fehlt.');
          return a;
        }
        if (k.v === '|') {
          betragTiefe++;
          const a = summe();
          betragTiefe--;
          erwarte('|', 'Der Betrag braucht ein schließendes „|“.');
          return F('abs', a);
        }
        if (k.v === ')') throw fehler('Eine Klammer „(“ fehlt.');
        throw fehler(`„${k.v}“ steht hier falsch.`);
      }
      const n = k.v;
      if (eigene.has(n)) {
        if (!istOp('(')) throw fehler(`${n} ist eine Funktion – schreib ${n}${"'".repeat(k.striche)}(x).`);
        const args = argumente();
        if (args.length !== 1) throw fehler(`${n} hat ein Argument.`);
        return { t: 'ruf', n, abl: k.striche, a: args };
      }
      if (k.striche) throw fehler(`„${n}'“: Ableiten geht nur bei Funktionen wie f'(x).`);
      if (n === 'pi') return K('pi');
      if (n === 'e') return K('e');
      if (FUNKTIONEN[n] || k.basis) return funktion(k);
      return V(n);
    }

    if (!tok.length) throw fehler('Leer.');
    const a = summe();
    if (p < tok.length) {
      const k = tok[p];
      if (k.t === 'op' && k.v === ')') throw fehler('Eine Klammer „(“ fehlt.');
      if (k.t === 'op' && (k.v === ',' || k.v === ';')) throw fehler('Ein Punkt hat die Form (1|2).');
      throw fehler(`„${k.v === undefined ? '' : k.v}“ steht hier falsch.`);
    }
    return a;
  }

  /** Text → Syntaxbaum (ein Ausdruck ohne =). */
  function lesen(text, ctx = {}) {
    return baumAus(zerlegen(normalisieren(text), ctx.namen), ctx);
  }

  // ================================================================ Hilfen am Baum

  function enthaelt(n, v) {
    switch (n.t) {
      case 'var': return n.n === v;
      case 'zahl': case 'konst': return false;
      case 'fn': case 'ruf': case 'S': case 'P': return (n.a || n.l).some((x) => enthaelt(x, v));
      default: return (n.a && enthaelt(n.a, v)) || (n.b && enthaelt(n.b, v));
    }
  }
  function variablen(n, menge = new Set()) {
    switch (n.t) {
      case 'var': menge.add(n.n); break;
      case 'zahl': case 'konst': break;
      case 'fn': case 'ruf': n.a.forEach((x) => variablen(x, menge)); break;
      default: if (n.a) variablen(n.a, menge); if (n.b) variablen(n.b, menge);
    }
    return menge;
  }
  function ersetzen(n, v, durch) {
    switch (n.t) {
      case 'var': return n.n === v ? durch : n;
      case 'zahl': case 'konst': return n;
      case 'fn': case 'ruf': return { ...n, a: n.a.map((x) => ersetzen(x, v, durch)) };
      case 'neg': return { t: 'neg', a: ersetzen(n.a, v, durch) };
      default: return B(n.t, ersetzen(n.a, v, durch), ersetzen(n.b, v, durch));
    }
  }
  /** Eigene Funktionen einsetzen: f(2x) mit f(x) = x² → (2x)². defs: Map name → {param, ast} */
  function einsetzen(n, defs, stapel = []) {
    switch (n.t) {
      case 'var': case 'zahl': case 'konst': return n;
      case 'ruf': {
        const d = defs.get(n.n);
        if (!d) throw fehler(`${n.n} ist nicht festgelegt.`);
        if (stapel.includes(n.n)) throw fehler(`${n.n} ruft sich selbst auf.`);
        let rumpf = einsetzen(d.ast, defs, [...stapel, n.n]);
        for (let i = 0; i < n.abl; i++) rumpf = vereinfachen(ableiten(rumpf, d.param), d.param);
        return ersetzen(rumpf, d.param, einsetzen(n.a[0], defs, stapel));
      }
      case 'fn': return { ...n, a: n.a.map((x) => einsetzen(x, defs, stapel)) };
      case 'neg': return { t: 'neg', a: einsetzen(n.a, defs, stapel) };
      default: return B(n.t, einsetzen(n.a, defs, stapel), einsetzen(n.b, defs, stapel));
    }
  }

  // ================================================================ Rechnen (Bäume → schnelle Funktionen, ohne eval)

  const nteWurzel = (x, k) => (x < 0 && k % 2 === 1 ? -Math.pow(-x, 1 / k) : Math.pow(x, 1 / k));
  const RECHNE = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x), arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, cbrt: Math.cbrt,
    abs: Math.abs, sgn: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round, min: Math.min, max: Math.max,
    logb: (x, b) => Math.log(x) / Math.log(b), nroot: (x, k) => nteWurzel(x, Math.round(k)),
  };

  /** Baum → (umgebung) => Zahl. Variablen und Parameter stehen in der Umgebung ({x: 2, a: 1.5}). */
  function kompilieren(n) {
    switch (n.t) {
      case 'zahl': { const v = qf(n.q); return () => v; }
      case 'konst': { const v = n.n === 'pi' ? Math.PI : Math.E; return () => v; }
      case 'var': { const name = n.n; return (s) => { const v = s[name]; return v === undefined ? NaN : v; }; }
      case 'neg': { const a = kompilieren(n.a); return (s) => -a(s); }
      case '+': { const a = kompilieren(n.a), b = kompilieren(n.b); return (s) => a(s) + b(s); }
      case '-': { const a = kompilieren(n.a), b = kompilieren(n.b); return (s) => a(s) - b(s); }
      case '*': { const a = kompilieren(n.a), b = kompilieren(n.b); return (s) => a(s) * b(s); }
      case '/': { const a = kompilieren(n.a), b = kompilieren(n.b); return (s) => a(s) / b(s); }
      case '^': {
        const a = kompilieren(n.a);
        const eb = n.b.t === 'zahl' ? n.b.q : konstanterBruch(n.b);
        if (eb && qExakt(eb)) {
          const { z, n: m } = eb;
          if (m === 1 && z === 2) return (s) => { const v = a(s); return v * v; };
          if (m === 1) return (s) => Math.pow(a(s), z);
          if (m % 2 === 1) { // ungerader Nenner: auch für negative Basis (∛ wie in der Schule bei x^(1/3))
            const e = z / m;
            return (s) => { const v = a(s); return v >= 0 ? Math.pow(v, e) : (z % 2 === 0 ? 1 : -1) * Math.pow(-v, e); };
          }
        }
        const b = kompilieren(n.b);
        return (s) => Math.pow(a(s), b(s));
      }
      case 'fn': {
        const f = RECHNE[n.n];
        if (!f) throw fehler(`Unbekannte Funktion ${n.n}`);
        if (n.a.length === 1) { const a = kompilieren(n.a[0]); return (s) => f(a(s)); }
        const a = kompilieren(n.a[0]), b = kompilieren(n.a[1]);
        return (s) => f(a(s), b(s));
      }
      default: throw fehler('Nicht berechenbar: ' + n.t);
    }
  }
  /** Ein Baum aus reinen Zahlen (1/3, 2 + 1/2, −3) als exakter Bruch – sonst null. */
  function konstanterBruch(n) {
    switch (n.t) {
      case 'zahl': return n.q;
      case 'neg': { const a = konstanterBruch(n.a); return a && qNeg(a); }
      case '+': case '-': case '*': case '/': {
        const a = konstanterBruch(n.a), b = konstanterBruch(n.b);
        if (!a || !b) return null;
        return n.t === '+' ? qPlus(a, b) : n.t === '-' ? qPlus(a, qNeg(b)) : n.t === '*' ? qMal(a, b) : qDurch(a, b);
      }
      default: return null;
    }
  }
  /** Bequem: f(x) als Funktion einer Zahl. */
  function alsFunktion(n, v = 'x', umgebung = {}) {
    const c = kompilieren(n);
    const s = { ...umgebung };
    return (x) => { s[v] = x; return c(s); };
  }

  // ================================================================ Ableiten

  function ableiten(n, v = 'x') {
    if (!enthaelt(n, v)) return Z(0);
    const d = (x) => ableiten(x, v);
    switch (n.t) {
      case 'var': return Z(1);
      case 'neg': return { t: 'neg', a: d(n.a) };
      case '+': case '-': return B(n.t, d(n.a), d(n.b));
      case '*': return B('+', B('*', d(n.a), n.b), B('*', n.a, d(n.b)));
      case '/': return B('/', B('-', B('*', d(n.a), n.b), B('*', n.a, d(n.b))), B('^', n.b, Z(2)));
      case '^': {
        const aHat = enthaelt(n.a, v), bHat = enthaelt(n.b, v);
        if (!bHat) return B('*', B('*', n.b, B('^', n.a, B('-', n.b, Z(1)))), d(n.a));
        if (!aHat) return B('*', B('*', n, F('ln', n.a)), d(n.b));
        return B('*', n, B('+', B('*', d(n.b), F('ln', n.a)), B('/', B('*', n.b, d(n.a)), n.a)));
      }
      case 'fn': {
        const u = n.a[0], du = d(u);
        const k = (x) => B('*', x, du);
        switch (n.n) {
          case 'sin': return k(F('cos', u));
          case 'cos': return k({ t: 'neg', a: F('sin', u) });
          case 'tan': return B('/', du, B('^', F('cos', u), Z(2)));
          case 'cot': return { t: 'neg', a: B('/', du, B('^', F('sin', u), Z(2))) };
          case 'arcsin': return B('/', du, F('sqrt', B('-', Z(1), B('^', u, Z(2)))));
          case 'arccos': return { t: 'neg', a: B('/', du, F('sqrt', B('-', Z(1), B('^', u, Z(2))))) };
          case 'arctan': return B('/', du, B('+', Z(1), B('^', u, Z(2))));
          case 'sinh': return k(F('cosh', u));
          case 'cosh': return k(F('sinh', u));
          case 'tanh': return B('/', du, B('^', F('cosh', u), Z(2)));
          case 'ln': return B('/', du, u);
          case 'log': return B('/', du, B('*', u, F('ln', Z(10))));
          case 'logb':
            if (enthaelt(n.a[1], v)) return ableiten(B('/', F('ln', u), F('ln', n.a[1])), v);
            return B('/', du, B('*', u, F('ln', n.a[1])));
          case 'sqrt': return B('/', du, B('*', Z(2), F('sqrt', u)));
          case 'cbrt': return B('/', du, B('*', Z(3), B('^', F('cbrt', u), Z(2))));
          case 'nroot': return ableiten(B('^', u, B('/', Z(1), n.a[1])), v);
          case 'abs': return k(B('/', u, F('abs', u)));
          case 'sgn': case 'floor': case 'ceil': case 'round': return Z(0);
          default: throw fehler(`${n.n} kann ich nicht symbolisch ableiten.`);
        }
      }
      default: throw fehler('Nicht ableitbar.');
    }
  }

  // ================================================================ Vereinfachen
  // Intern: Summen {t:'S', l} und Produkte {t:'P', l} mit sortierten Gliedern; am Ende zurück in einen Binärbaum.

  function schluessel(n) {
    switch (n.t) {
      case 'zahl': return 'z' + (qExakt(n.q) ? n.q.z + '/' + n.q.n : n.q.f);
      case 'konst': return 'k' + n.n;
      case 'var': return 'v' + n.n;
      case 'fn': return 'f' + n.n + '(' + n.a.map(schluessel).join(',') + ')';
      case '^': return 'p(' + schluessel(n.a) + ')(' + schluessel(n.b) + ')';
      case 'S': return 'S(' + n.l.map(schluessel).join('+') + ')';
      case 'P': return 'P(' + n.l.map(schluessel).join('*') + ')';
      case 'neg': return 'n(' + schluessel(n.a) + ')';
      default: return n.t + '(' + schluessel(n.a) + ',' + schluessel(n.b) + ')';
    }
  }

  function grad(n, v = 'x') {
    switch (n.t) {
      case 'var': return n.n === v ? 1 : 0;
      case '^': return n.b.t === 'zahl' ? grad(n.a, v) * qf(n.b.q) : (enthaelt(n, v) ? 0.5 : 0);
      case 'P': return n.l.reduce((s, f) => s + grad(f, v), 0);
      case 'S': return Math.max(...n.l.map((f) => grad(f, v)));
      case 'fn': return enthaelt(n, v) ? 0.5 : 0;
      default: return 0;
    }
  }
  function rang(f) {
    switch (f.t) {
      case 'zahl': return 0;
      case 'konst': return 1;
      case 'var': return f.n === 'x' ? 3 : 2;
      case '^': return f.a.t === 'var' ? (f.a.n === 'x' ? 3 : 2) : f.a.t === 'konst' ? 5 : f.a.t === 'zahl' ? 1 : 6;
      case 'fn': return 4;
      case 'S': return 7;
      default: return 8;
    }
  }
  const produktOrdnung = (a, b) => rang(a) - rang(b) || (schluessel(a) < schluessel(b) ? -1 : 1);
  const summenOrdnung = (a, b) => {
    const za = a.t === 'zahl', zb = b.t === 'zahl';
    if (za !== zb) return za ? 1 : -1;
    return grad(b) - grad(a) || (schluessel(a) < schluessel(b) ? -1 : 1);
  };

  function koeffizient(x) {
    if (x.t === 'P' && x.l[0].t === 'zahl') {
      const rest = x.l.slice(1);
      return [x.l[0].q, rest.length === 1 ? rest[0] : { t: 'P', l: rest }];
    }
    return [q(1), x];
  }

  function summeListe(liste) {
    const flach = [];
    const rein = (x) => { if (x.t === 'S') x.l.forEach(rein); else flach.push(x); };
    liste.forEach(rein);
    let konst = q(0);
    const terme = new Map();
    for (const x of flach) {
      if (x.t === 'zahl') { konst = qPlus(konst, x.q); continue; }
      const [k, r] = koeffizient(x);
      const s = schluessel(r);
      const alt = terme.get(s);
      if (alt) alt.k = qPlus(alt.k, k); else terme.set(s, { k, r });
    }
    const aus = [];
    for (const { k, r } of terme.values()) if (!qNull(k)) aus.push(mulListe([{ t: 'zahl', q: k }, r]));
    if (!qNull(konst)) aus.push({ t: 'zahl', q: konst });
    if (!aus.length) return Z(0);
    if (aus.length === 1) return aus[0];
    aus.sort(summenOrdnung);
    return { t: 'S', l: aus };
  }

  function mulListe(liste) {
    const flach = [];
    const rein = (x) => { if (x.t === 'P') x.l.forEach(rein); else flach.push(x); };
    liste.forEach(rein);
    let k = q(1);
    const fak = new Map();
    for (const x of flach) {
      if (x.t === 'zahl') { k = qMal(k, x.q); continue; }
      let b = x, e = Z(1);
      if (x.t === '^') { b = x.a; e = x.b; }
      const s = schluessel(b);
      const alt = fak.get(s);
      if (alt) alt.e = summeListe([alt.e, e]); else fak.set(s, { b, e });
    }
    if (qNull(k)) return Z(0);
    const aus = [], weitere = [];
    for (const { b, e } of fak.values()) {
      const p = potenz(b, e);
      if (p.t === 'zahl') k = qMal(k, p.q);
      else if (p.t === 'P') weitere.push(p);
      else aus.push(p);
    }
    if (weitere.length) return mulListe([{ t: 'zahl', q: k }, ...aus, ...weitere]);
    if (qNull(k)) return Z(0);
    if (!aus.length) return { t: 'zahl', q: k };
    // Eine Zahl vor einer einzelnen Summe ausmultiplizieren: 2(x + 1) → 2x + 2
    if (aus.length === 1 && aus[0].t === 'S' && !qEins(k)) return summeListe(aus[0].l.map((s) => mulListe([{ t: 'zahl', q: k }, s])));
    aus.sort(produktOrdnung);
    if (qEins(k) && aus.length === 1) return aus[0];
    return { t: 'P', l: qEins(k) ? aus : [{ t: 'zahl', q: k }, ...aus] };
  }

  function potenz(b, e) {
    if (e.t === 'zahl') {
      if (qNull(e.q)) return Z(1);
      if (qEins(e.q)) return b;
      if (b.t === 'zahl') {
        if (qExakt(e.q) && e.q.n === 1 && Math.abs(e.q.z) <= 64 && !(qNull(b.q) && e.q.z < 0)) return { t: 'zahl', q: qHoch(b.q, e.q.z) };
        if (qExakt(e.q) && qExakt(b.q) && b.q.z > 0 && e.q.n <= 4) {
          const w = wurzelExakt(b.q, e.q.n);
          if (w) return potenz({ t: 'zahl', q: w }, Z(e.q.z));
        }
        if (!qExakt(b.q) && qf(b.q) > 0) return { t: 'zahl', q: { f: Math.pow(qf(b.q), qf(e.q)) } };
      }
      if (b.t === '^' && qGanz(e.q)) return potenz(b.a, mulListe([b.b, e]));
      if (b.t === 'P' && qGanz(e.q)) return mulListe(b.l.map((f) => potenz(f, e)));
      if (b.t === 'fn' && b.n === 'sqrt' && qExakt(e.q) && e.q.n === 1 && e.q.z % 2 === 0) return potenz(b.a[0], Z(e.q.z / 2));
    }
    if (b.t === 'zahl' && qEins(b.q)) return Z(1);
    if (b.t === 'zahl' && qNull(b.q) && e.t === 'zahl' && qf(e.q) > 0) return Z(0);
    if (b.t === 'konst' && b.n === 'e' && e.t === 'fn' && e.n === 'ln') return e.a[0];
    return { t: '^', a: b, b: e };
  }

  function funktion(n, a) {
    const u = a[0];
    if (u.t === 'zahl' && qExakt(u.q) && a.length === 1) {
      const v = qf(u.q);
      if (v === 0 && ['sin', 'tan', 'arcsin', 'arctan', 'sinh', 'tanh', 'abs', 'sgn', 'sqrt', 'cbrt'].includes(n)) return Z(0);
      if (v === 0 && ['cos', 'cosh'].includes(n)) return Z(1);
      if (v === 1 && ['ln', 'log', 'arccos'].includes(n)) return Z(0);
      if (n === 'abs') return { t: 'zahl', q: v < 0 ? qNeg(u.q) : u.q };
      if (n === 'sgn') return Z(Math.sign(v));
      if (['floor', 'ceil', 'round'].includes(n)) return Z(Math[n](v));
      if (n === 'sqrt' || n === 'cbrt') { const w = wurzelExakt(v < 0 && n === 'cbrt' ? qNeg(u.q) : u.q, n === 'sqrt' ? 2 : 3); if (w) return { t: 'zahl', q: v < 0 ? qNeg(w) : w }; }
      if (n === 'log' && v > 0 && Number.isInteger(Math.log10(v)) && Math.pow(10, Math.log10(v)) === v) return Z(Math.log10(v));
    }
    if (n === 'ln' && u.t === 'konst' && u.n === 'e') return Z(1);
    if (n === 'ln' && u.t === '^' && u.a.t === 'konst' && u.a.n === 'e') return u.b;
    if (n === 'sqrt' && u.t === '^' && u.b.t === 'zahl' && qf(u.b.q) === 2) return funktion('abs', [u.a]);
    return { t: 'fn', n, a };
  }

  function simp(n) {
    switch (n.t) {
      case 'zahl': case 'konst': case 'var': return n;
      case 'neg': return mulListe([Z(-1), simp(n.a)]);
      case '+': return summeListe([simp(n.a), simp(n.b)]);
      case '-': return summeListe([simp(n.a), mulListe([Z(-1), simp(n.b)])]);
      case '*': return mulListe([simp(n.a), simp(n.b)]);
      case '/': {
        const z = simp(n.a), m = simp(n.b);
        if (m.t === 'zahl' && qNull(m.q)) return { t: '/', a: z, b: m };
        return mulListe([z, potenz(m, Z(-1))]);
      }
      case '^': return potenz(simp(n.a), simp(n.b));
      case 'fn': return funktion(n.n, n.a.map(simp));
      case 'ruf': return { ...n, a: n.a.map(simp) };
      default: return n;
    }
  }

  function negativTeilen(x) {
    if (x.t === 'zahl' && qf(x.q) < 0) return [true, { t: 'zahl', q: qNeg(x.q) }];
    if (x.t === 'P' && x.l[0].t === 'zahl' && qf(x.l[0].q) < 0) {
      const k = qNeg(x.l[0].q);
      const rest = x.l.slice(1);
      if (qEins(k)) return [true, rest.length === 1 ? rest[0] : { t: 'P', l: rest }];
      return [true, { t: 'P', l: [{ t: 'zahl', q: k }, ...rest] }];
    }
    return [false, x];
  }

  /** Kanonische Form → Binärbaum zum Anzeigen und Rechnen (Minus statt +(−1)·…, Brüche als Zähler/Nenner). */
  function aufbauen(n) {
    switch (n.t) {
      case 'S': {
        let acc = null;
        for (const s of n.l) {
          const [neg, betrag] = negativTeilen(s);
          const b = aufbauen(betrag);
          acc = acc === null ? (neg ? { t: 'neg', a: b } : b) : B(neg ? '-' : '+', acc, b);
        }
        return polynomGlatt(acc);
      }
      case 'P': {
        const [neg, betrag] = negativTeilen(n);
        if (neg) return { t: 'neg', a: aufbauen(betrag) };
        const l = betrag.t === 'P' ? betrag.l : [betrag];
        let k = q(1);
        const oben = [], unten = [];
        for (const f of l) {
          if (f.t === 'zahl') { k = f.q; continue; }
          if (f.t === '^' && f.b.t === 'zahl' && qf(f.b.q) < 0) unten.push(potenz(f.a, { t: 'zahl', q: qNeg(f.b.q) }));
          else oben.push(f);
        }
        const bruchVorne = qExakt(k) && k.n !== 1 && !unten.length && oben.length;
        if (bruchVorne) oben.unshift({ t: 'zahl', q: k });
        else if (qExakt(k)) {
          if (k.z !== 1 || !oben.length) oben.unshift(Z(k.z));
          if (k.n !== 1) unten.unshift(Z(k.n));
        } else oben.unshift({ t: 'zahl', q: k });
        let zaehler = oben.map(aufbauen).reduce((a, b) => B('*', a, b));
        if (!unten.length) return zaehler;
        zaehler = polynomGlatt(zaehler); // (2x(x − 1) − (x² − 4)) → x² − 2x + 4
        return B('/', zaehler, unten.map(aufbauen).reduce((a, b) => B('*', a, b)));
      }
      case '^': {
        if (n.b.t === 'zahl' && qExakt(n.b.q)) {
          if (n.b.q.z === 1 && n.b.q.n === 2) return F('sqrt', aufbauen(n.a));
          if (n.b.q.z < 0) return B('/', Z(1), aufbauen(potenz(n.a, { t: 'zahl', q: qNeg(n.b.q) })));
        }
        return B('^', aufbauen(n.a), aufbauen(n.b));
      }
      case 'fn': return { t: 'fn', n: n.n, a: n.a.map(aufbauen) };
      case 'ruf': return { ...n, a: n.a.map(aufbauen) };
      case 'neg': return { t: 'neg', a: aufbauen(n.a) };
      case '+': case '-': case '*': case '/': return B(n.t, aufbauen(n.a), aufbauen(n.b));
      default: return n;
    }
  }

  /** Polynom in v mit Bruch-Koeffizienten (Index = Grad) – oder null. */
  function alsPolynom(n, v = 'x') {
    const trim = (c) => { while (c.length > 1 && qNull(c[c.length - 1])) c.pop(); return c; };
    const plus = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => qPlus(a[i] || q(0), b[i] || q(0))));
    const mal = (a, b) => {
      if (a.length + b.length > 62) return null;
      const r = Array.from({ length: a.length + b.length - 1 }, () => q(0));
      a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = qPlus(r[i + j], qMal(x, y)); }));
      return trim(r);
    };
    switch (n.t) {
      case 'zahl': return [n.q];
      case 'var': return n.n === v ? [q(0), q(1)] : null;
      case 'neg': { const a = alsPolynom(n.a, v); return a && a.map(qNeg); }
      case '+': case '-': {
        const a = alsPolynom(n.a, v), b = alsPolynom(n.b, v);
        if (!a || !b) return null;
        return plus(a, n.t === '+' ? b : b.map(qNeg));
      }
      case '*': {
        const a = alsPolynom(n.a, v), b = alsPolynom(n.b, v);
        return a && b ? mal(a, b) : null;
      }
      case '/': {
        const a = alsPolynom(n.a, v), b = alsPolynom(n.b, v);
        if (!a || !b || b.length !== 1 || qNull(b[0])) return null;
        return a.map((x) => qDurch(x, b[0]));
      }
      case '^': {
        if (n.b.t !== 'zahl' || !qExakt(n.b.q) || n.b.q.n !== 1 || n.b.q.z < 0 || n.b.q.z > 40) return null;
        const a = alsPolynom(n.a, v);
        if (!a) return null;
        let r = [q(1)];
        for (let i = 0; i < n.b.q.z; i++) { r = mal(r, a); if (!r) return null; }
        return r;
      }
      default: return null;
    }
  }
  let inPolynom = false;
  function polynomAst(c, v = 'x') {
    const terme = [];
    c.forEach((k, i) => { if (!qNull(k)) terme.push(mulListe([{ t: 'zahl', q: k }, potenz(V(v), Z(i))])); });
    const vorher = inPolynom;
    inPolynom = true;
    try { return aufbauen(summeListe(terme.length ? terme : [Z(0)])); } finally { inPolynom = vorher; }
  }
  /** Teilbaum, der ein Polynom in x ist (mit exakten Koeffizienten), ausmultipliziert und geordnet – sonst unverändert. */
  function polynomGlatt(n) {
    if (inPolynom || !n || !enthaelt(n, 'x')) return n;
    const p = alsPolynom(n, 'x');
    if (!p || p.length > 13 || !p.every(qExakt)) return n;
    // Nur, wenn es kürzer bzw. ordentlicher wird: Produkte wie (x − 1)² im Nenner bleiben stehen
    return polynomAst(p, 'x');
  }

  /** Vereinfachen: Polynome in Normalform (3x² − 4x + 1), sonst Terme zusammenfassen. */
  function vereinfachen(n, v = 'x') {
    const p = alsPolynom(n, v);
    if (p) return polynomAst(p, v);
    return aufbauen(simp(n));
  }

  // ================================================================ Ausgeben (Text zum Weiterrechnen, LaTeX zum Anzeigen)

  const RANG = { '+': 1, '-': 1, neg: 2, '*': 3, '/': 3, '^': 5 };
  const rangVon = (n) => (n.t === 'zahl' ? (qf(n.q) < 0 ? 2 : (qExakt(n.q) && n.q.n !== 1 ? 3 : 9)) : RANG[n.t] || 9);

  function zahlText(qq) {
    if (qExakt(qq)) return qq.n === 1 ? String(qq.z) : `${qq.z}/${qq.n}`;
    const v = qq.f;
    if (!Number.isFinite(v)) return String(v);
    return String(Number(v.toPrecision(10)));
  }
  /** Lesbarer Text, den Vertex auch wieder lesen kann („3x^2 - 4x + 1“, „sin(2x)“, „|x|“). */
  function text(n) {
    const k = (x, min) => (rangVon(x) < min ? '(' + text(x) + ')' : text(x));
    switch (n.t) {
      case 'zahl': return zahlText(n.q);
      case 'konst': return n.n === 'pi' ? 'π' : 'e';
      case 'var': return n.n === 'theta' ? 'θ' : n.n;
      case 'neg': return '-' + k(n.a, 3);
      case '+': return text(n.a) + ' + ' + k(n.b, 2);
      case '-': return text(n.a) + ' - ' + k(n.b, 2);
      case '*': {
        const a = n.a, b = n.b;
        const links = a.t === 'zahl' && qExakt(a.q) && a.q.n !== 1 ? text(a) + ' ' : k(a, 3);
        const rechtsAtom = b.t === 'var' || b.t === 'konst' || b.t === 'fn' || b.t === 'ruf' || (b.t === '^' && (b.a.t === 'var' || b.a.t === 'konst'));
        if (a.t === 'zahl' && (rechtsAtom || b.t === '^')) return links + text(b);
        const eHoch = (x) => x.t === '^' && x.a.t === 'konst';
        if ((a.t === 'var' || a.t === '*' || (a.t === '^' && a.a.t === 'var')) && (eHoch(b) || b.t === 'fn')) return k(a, 3) + ' ' + text(b);
        if ((a.t === 'var' || a.t === 'konst' || a.t === '^') && (b.t === 'var' || (b.t === '^' && b.a.t === 'var'))) return k(a, 3) + text(b);
        if (rangVon(b) < 3) return links.trimEnd() + '(' + text(b) + ')';
        return k(a, 3) + '*' + k(b, 4);
      }
      case '/': return k(n.a, 3) + '/' + k(n.b, 4);
      case '^': {
        const basis = n.a.t === 'fn' || n.a.t === 'ruf' ? '(' + text(n.a) + ')' : k(n.a, 9);
        const e = n.b.t === 'zahl' && qExakt(n.b.q) && n.b.q.n === 1 && n.b.q.z >= 0 ? text(n.b) : n.b.t === 'var' || n.b.t === 'konst' ? text(n.b) : '(' + text(n.b) + ')';
        return basis + '^' + e;
      }
      case 'fn':
        if (n.n === 'abs') return '|' + text(n.a[0]) + '|';
        if (n.n === 'logb') return `log_${text(n.a[1])}(${text(n.a[0])})`;
        if (n.n === 'nroot') return `nroot(${text(n.a[0])}; ${text(n.a[1])})`;
        return n.n + '(' + n.a.map(text).join('; ') + ')';
      case 'ruf': return n.n + "'".repeat(n.abl) + '(' + text(n.a[0]) + ')';
      default: return '?';
    }
  }

  const TEXFN = { sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln', log: '\\lg', sgn: '\\operatorname{sgn}', min: '\\min', max: '\\max' };
  const texName = (s) => {
    const [n, i] = String(s).split('_');
    const g = n === 'theta' ? '\\theta' : n;
    return i ? `${g}_{${i}}` : g;
  };
  function texZahl(qq) {
    if (qExakt(qq)) {
      if (qq.n === 1) return String(qq.z);
      return (qq.z < 0 ? '-' : '') + `\\frac{${Math.abs(qq.z)}}{${qq.n}}`;
    }
    return zahlKurz(qq.f, 6).replace('−', '-').replace(',', '{,}');
  }
  const zahlTerm = (x) => x.t === 'zahl' || (x.t === 'neg' && zahlTerm(x.a)) || (x.t === '/' && zahlTerm(x.a) && zahlTerm(x.b));
  /** LaTeX (für Temml). */
  function tex(n) {
    const k = (x, min) => (rangVon(x) < min ? '\\left(' + tex(x) + '\\right)' : tex(x));
    switch (n.t) {
      case 'zahl': return texZahl(n.q);
      case 'konst': return n.n === 'pi' ? '\\pi' : '\\mathrm{e}';
      case 'var': return texName(n.n);
      case 'neg': return '-' + k(n.a, 3);
      case '+': return tex(n.a) + '+' + k(n.b, 2);
      case '-': return tex(n.a) + '-' + k(n.b, 2);
      case '*': {
        const a = n.a, b = n.b;
        const glatt = (x) => x.t === 'var' || x.t === 'konst' || x.t === 'fn' || x.t === 'ruf' || (x.t === '^' && (x.a.t === 'var' || x.a.t === 'konst'));
        if (a.t === 'zahl' && qf(a.q) >= 0 && (glatt(b) || rangVon(b) < 3 || b.t === '^')) return tex(a) + k(b, 3);
        if ((a.t === 'var' || a.t === '*' || (a.t === '^' && a.a.t === 'var')) && ((b.t === '^' && b.a.t === 'konst') || b.t === 'fn')) return tex(a) + '\\,' + tex(b);
        if (a.t === '/' && zahlTerm(a) && (glatt(b) || rangVon(b) < 3)) return tex(a) + k(b, 3);
        if ((a.t === 'var' || a.t === 'konst' || (a.t === '^' && a.a.t !== 'fn')) && (b.t === 'var' || (b.t === '^' && b.a.t === 'var'))) return k(a, 3) + '\\,' + tex(b);
        if ((a.t === 'var' || a.t === 'konst') && (b.t === 'fn' || b.t === 'ruf')) return tex(a) + '\\,' + tex(b);
        if (rangVon(b) < 3 && rangVon(a) >= 3) return k(a, 3) + '\\left(' + tex(b) + '\\right)';
        return k(a, 3) + '\\cdot ' + k(b, 4);
      }
      case '/':
        // −1/4 als −¼ (Vorzeichen vor den Bruch)
        if (zahlTerm(n.a) && zahlTerm(n.b) && (n.a.t === 'neg' || (n.a.t === 'zahl' && qf(n.a.q) < 0))) {
          return '-' + tex(B('/', n.a.t === 'neg' ? n.a.a : { t: 'zahl', q: qNeg(n.a.q) }, n.b));
        }
        return `\\frac{${tex(n.a)}}{${tex(n.b)}}`;
      case '^': {
        const basis = n.a.t === 'fn' || n.a.t === 'ruf' || rangVon(n.a) < 9 || (n.a.t === 'zahl' && qf(n.a.q) < 0) ? '\\left(' + tex(n.a) + '\\right)' : tex(n.a);
        return `${basis}^{${tex(n.b)}}`;
      }
      case 'fn': {
        const a = n.a.map(tex);
        switch (n.n) {
          case 'sqrt': return `\\sqrt{${a[0]}}`;
          case 'cbrt': return `\\sqrt[3]{${a[0]}}`;
          case 'nroot': return `\\sqrt[${a[1]}]{${a[0]}}`;
          case 'abs': return `\\left|${a[0]}\\right|`;
          case 'floor': return `\\left\\lfloor ${a[0]}\\right\\rfloor`;
          case 'ceil': return `\\left\\lceil ${a[0]}\\right\\rceil`;
          case 'round': return `\\operatorname{round}\\left(${a[0]}\\right)`;
          case 'logb': return `\\log_{${a[1]}}\\left(${a[0]}\\right)`;
          default: return `${TEXFN[n.n] || '\\operatorname{' + n.n + '}'}\\left(${a.join(';\\,')}\\right)`;
        }
      }
      case 'ruf': return `${texName(n.n)}${"'".repeat(n.abl)}\\left(${tex(n.a[0])}\\right)`;
      default: return '?';
    }
  }

  // ================================================================ Zahlen schön (deutsch) und exakt erkennen

  /** 1234.5678 → „1234,568“ (deutsch, ohne überflüssige Nullen; sehr groß/klein mit Zehnerpotenz). */
  function zahlKurz(v, stellen = 4) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '−∞';
    if (!Number.isFinite(v)) return '–';
    if (Math.abs(v) < 1e-12) return '0';
    const a = Math.abs(v);
    let s;
    if (a >= 1e7 || a < 1e-4) {
      const [m, e] = v.toExponential(Math.max(1, stellen - 1)).split('e');
      s = m.replace(/\.?0+$/, '') + '·10^' + Number(e);
      return s.replace('-', '−').replace('.', ',');
    }
    s = v.toFixed(stellen).replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s.replace('-', '−').replace('.', ',');
  }

  const QUADRATFREI = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 46, 47];
  /** Exakte Gestalt einer Zahl erkennen: 3/4, −2, √2, (1 + √5)/2, π/3, ln(2) … → {text, tex, exakt} (exakt: true, wenn
   *  die Gestalt passt – sonst gerundet). */
  function erkennen(v) {
    if (!Number.isFinite(v)) return { text: zahlKurz(v), tex: zahlKurz(v), exakt: false, wert: v };
    const tol = 1e-9 * Math.max(1, Math.abs(v));
    const gib = (t, x) => ({ text: t, tex: x, exakt: true, wert: v });
    if (Math.abs(v) < 1e-11) return gib('0', '0');
    const vz = v < 0 ? '−' : '', vzT = v < 0 ? '-' : '';
    const a = Math.abs(v);
    let b = bruchNahe(a, 1000, tol);
    if (b) return b[1] === 1 ? gib(vz + b[0], vzT + b[0]) : gib(`${vz}${b[0]}/${b[1]}`, `${vzT}\\frac{${b[0]}}{${b[1]}}`);
    b = bruchNahe(a / Math.PI, 12, tol / Math.PI);
    if (b) {
      const z = b[0] === 1 ? 'π' : b[0] + 'π', zt = b[0] === 1 ? '\\pi' : b[0] + '\\pi';
      return b[1] === 1 ? gib(vz + z, vzT + zt) : gib(`${vz}${z}/${b[1]}`, `${vzT}\\frac{${zt}}{${b[1]}}`);
    }
    // ±√(z/n) = (k√r)/m
    b = bruchNahe(a * a, 400, 4 * tol * a);
    if (b) {
      const w = wurzelSchoen(b[0] * b[1], b[1]);
      if (w) return { ...gib(vz + w.text, vzT + w.tex) };
    }
    // (p ± k√r)/m – z. B. Lösungen quadratischer Gleichungen
    for (const r of QUADRATFREI) {
      const s = Math.sqrt(r);
      for (let m = 1; m <= 12; m++) {
        const t = v * m;
        for (let k = 1; k <= 40; k++) {
          for (const sg of [1, -1]) {
            const p = t - sg * k * s;
            const pr = Math.round(p);
            if (Math.abs(p - pr) < tol * m && pr !== 0) {
              const g = ggt(ggt(Math.abs(pr), k), m);
              const P = pr / g, Kk = k / g, M = m / g;
              const wurzel = (Kk === 1 ? '' : Kk) + '√' + r, wurzelT = (Kk === 1 ? '' : Kk) + '\\sqrt{' + r + '}';
              const zt = `${P} ${sg > 0 ? '+' : '−'} ${wurzel}`, ztT = `${P}${sg > 0 ? '+' : '-'}${wurzelT}`;
              return M === 1 ? gib(zt.replace('-', '−'), ztT) : gib(`(${zt.replace('-', '−')})/${M}`, `\\frac{${ztT}}{${M}}`);
            }
          }
        }
      }
    }
    if (Math.abs(v) < 30) {
      const ex = Math.exp(v);
      b = bruchNahe(ex, 50, 1e-9 * ex);
      if (b && !(b[0] === 1 && b[1] === 1)) {
        const arg = b[1] === 1 ? String(b[0]) : `${b[0]}/${b[1]}`, argT = b[1] === 1 ? String(b[0]) : `\\frac{${b[0]}}{${b[1]}}`;
        return gib(`ln(${arg})`, `\\ln\\left(${argT}\\right)`);
      }
    }
    return { text: zahlKurz(v), tex: zahlKurz(v).replace('−', '-').replace(',', '{,}'), exakt: false, wert: v };
  }
  /** √(z)/n mit Quadraten herausgezogen: √(8)/3 → 2√2/3. */
  function wurzelSchoen(z, n) {
    if (z <= 0 || z > 1e9) return null;
    let aussen = 1, innen = z;
    for (let i = 2; i * i <= innen; i++) while (innen % (i * i) === 0) { innen /= i * i; aussen *= i; }
    if (innen === 1) return null; // wäre ein Bruch – schon vorher erkannt
    const g = ggt(aussen, n);
    const A = aussen / g, N = n / g;
    const t = (A === 1 ? '' : A) + '√' + innen, tt = (A === 1 ? '' : A) + '\\sqrt{' + innen + '}';
    return N === 1 ? { text: t, tex: tt } : { text: `${t}/${N}`, tex: `\\frac{${tt}}{${N}}` };
  }
  /** „x = √2 ≈ 1,414“ bzw. „x ≈ 1,2346“ */
  function wertText(v, stellen = 4) {
    const e = erkennen(v);
    if (!e.exakt) return '≈ ' + zahlKurz(v, stellen);
    const d = zahlKurz(v, stellen);
    return e.text.replace(/^−/, '−') === d || /^−?\d+$/.test(e.text) ? '= ' + e.text : `= ${e.text} ≈ ${d}`;
  }
  function wertTex(v) {
    const e = erkennen(v);
    if (!e.exakt) return '\\approx ' + e.tex;
    return /^-?\d+$/.test(e.tex) ? '=' + e.tex : `=${e.tex}\\approx ${zahlKurz(v, 4).replace('−', '-').replace(',', '{,}')}`;
  }

  // ================================================================ Numerik

  function bisektion(f, a, b, fa) {
    for (let i = 0; i < 200; i++) {
      const m = (a + b) / 2;
      if (m === a || m === b) return m;
      const fm = f(m);
      if (fm === 0) return m;
      if (!Number.isFinite(fm)) return m;
      if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }
  function goldenerSchnitt(g, a, b) {
    const r = (Math.sqrt(5) - 1) / 2;
    let c = b - r * (b - a), d = a + r * (b - a), gc = g(c), gd = g(d);
    for (let i = 0; i < 90; i++) {
      if (gc < gd) { b = d; d = c; gd = gc; c = b - r * (b - a); gc = g(c); } else { a = c; c = d; gc = gd; d = a + r * (b - a); gd = g(d); }
    }
    return (a + b) / 2;
  }
  function median(l) {
    const s = l.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 1;
  }
  const numAbleitung = (f) => (x) => { const h = 1e-5 * Math.max(1, Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); };

  /** Nullstellen von f in [a, b]: Vorzeichenwechsel (Bisektion, Pole ausgeschlossen) und Berührstellen (über f').
   *  → [{x, vzw: true|false}] */
  function nullstellen(f, a, b, { n = 2400, df = null } = {}) {
    const xs = [], ys = [];
    for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; xs.push(x); ys.push(f(x)); }
    const skala = Math.max(1e-300, median(ys));
    const aus = [];
    const dazu = (x, vzw) => {
      if (aus.some((r) => Math.abs(r.x - x) < 1e-7 * Math.max(1, Math.abs(x)) + (b - a) * 1e-10)) return;
      aus.push({ x, vzw });
    };
    for (let i = 0; i < n; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      if (y0 === 0) {
        const l = ys[i - 1], r = y1;
        dazu(xs[i], Number.isFinite(l) && Number.isFinite(r) ? (l < 0) !== (r < 0) : true);
        continue;
      }
      if (!Number.isFinite(y0) || !Number.isFinite(y1) || (y0 < 0) === (y1 < 0) || y1 === 0) continue;
      const x = bisektion(f, xs[i], xs[i + 1], y0);
      const fx = Math.abs(f(x));
      if (fx < 1e-6 * Math.max(Math.abs(y0), Math.abs(y1)) || fx < 1e-12 * Math.max(1, skala)) dazu(x, true);
    }
    if (ys[n] === 0) dazu(xs[n], false);
    // Berührstellen: |f| hat ein kleines Minimum ohne Vorzeichenwechsel
    const g = df || numAbleitung(f);
    for (let i = 1; i < n; i++) {
      const l = ys[i - 1], m = ys[i], r = ys[i + 1];
      if (![l, m, r].every(Number.isFinite) || m === 0) continue;
      if (Math.abs(m) > Math.abs(l) || Math.abs(m) > Math.abs(r) || (l < 0) !== (r < 0)) continue;
      let x;
      const gl = g(xs[i - 1]), gr = g(xs[i + 1]);
      if (Number.isFinite(gl) && Number.isFinite(gr) && (gl < 0) !== (gr < 0)) x = bisektion(g, xs[i - 1], xs[i + 1], gl);
      else x = goldenerSchnitt((t) => Math.abs(f(t)), xs[i - 1], xs[i + 1]);
      const fx = f(x);
      if (Number.isFinite(fx) && Math.abs(fx) < 1e-9 * Math.max(1, skala)) dazu(x, false);
    }
    return aus.sort((p, q2) => p.x - q2.x);
  }

  /** Stellen, an denen g das Vorzeichen wechselt (f stetig und endlich dort) – für Extrema (g = f′) und Wendepunkte (g = f″). */
  function vorzeichenwechsel(g, f, a, b, n = 2400) {
    const aus = [];
    let x0 = a, g0 = g(a);
    const skalaF = Math.max(1, median(Array.from({ length: 41 }, (_, i) => f(a + ((b - a) * i) / 40))));
    for (let i = 1; i <= n; i++) {
      const x1 = a + ((b - a) * i) / n, g1 = g(x1);
      if (Number.isFinite(g0) && Number.isFinite(g1) && g0 !== 0 && g1 !== 0 && (g0 < 0) !== (g1 < 0)) {
        const x = bisektion(g, x0, x1, g0);
        const h = 1e-7 * Math.max(1, Math.abs(x));
        const fx = f(x), fl = f(x - h), fr = f(x + h);
        const stetig = [fx, fl, fr].every(Number.isFinite) && Math.abs(fl - fr) < 1e-4 * (1 + Math.abs(fx)) && Math.abs(fx) < 1e7 * skalaF;
        if (stetig) aus.push({ x, links: g0, rechts: g1, glatt: Math.abs(g(x)) < 1e-6 * Math.max(1, Math.abs(g0), Math.abs(g1)) });
      } else if (g1 === 0 && Number.isFinite(g0)) {
        // genau getroffen: Vorzeichen eins weiter prüfen
        const x2 = a + ((b - a) * (i + 1)) / n, g2 = g(x2);
        if (Number.isFinite(g2) && g0 !== 0 && (g0 < 0) !== (g2 < 0) && Number.isFinite(f(x1))) aus.push({ x: x1, links: g0, rechts: g2, glatt: true });
      }
      // Einzelne Stellen ohne Wert (f′ = x/|x| bei 0) überbrücken: mit dem letzten endlichen Wert vergleichen
      if (Number.isFinite(g1) || !Number.isFinite(g0)) { x0 = x1; g0 = g1; }
    }
    return aus;
  }

  /** ∫ f von a bis b (adaptive Simpsonregel). → {wert, ok} – ok false bei Polen oder Lücken. */
  function integral(f, a, b) {
    if (a === b) return { wert: 0, ok: true };
    if (a > b) { const r = integral(f, b, a); return { wert: -r.wert, ok: r.ok }; }
    let auswertungen = 0, ok = true;
    const g = (x) => { auswertungen++; const y = f(x); if (!Number.isFinite(y)) ok = false; return y; };
    function simpson(l, r, eps, tiefe, fl, fm, fr, ganz) {
      const m = (l + r) / 2, lm = (l + m) / 2, rm = (m + r) / 2;
      const flm = g(lm), frm = g(rm);
      const links = ((m - l) / 6) * (fl + 4 * flm + fm), rechts = ((r - m) / 6) * (fm + 4 * frm + fr);
      const d = links + rechts - ganz;
      if (!ok || tiefe <= 0 || auswertungen > 400000 || Math.abs(d) <= 15 * eps) return links + rechts + d / 15;
      return simpson(l, m, eps / 2, tiefe - 1, fl, flm, fm, links) + simpson(m, r, eps / 2, tiefe - 1, fm, frm, fr, rechts);
    }
    const teile = 64;
    let summe = 0;
    for (let i = 0; i < teile; i++) {
      const l = a + ((b - a) * i) / teile, r = a + ((b - a) * (i + 1)) / teile;
      const fl = g(l), fr = g(r), fm = g((l + r) / 2);
      summe += simpson(l, r, 1e-11, 24, fl, fm, fr, ((r - l) / 6) * (fl + 4 * fm + fr));
    }
    return { wert: summe, ok: ok && Number.isFinite(summe) };
  }
  /** Fläche zwischen Graph und x-Achse (bzw. zwischen zwei Graphen: f − g), in Teilstücke zwischen den Nullstellen zerlegt. */
  function flaeche(f, a, b) {
    if (a > b) [a, b] = [b, a];
    const grenzen = [a, ...nullstellen(f, a, b, { n: 1200 }).map((r) => r.x).filter((x) => x > a && x < b), b];
    let summe = 0, ok = true;
    const stuecke = [];
    for (let i = 0; i < grenzen.length - 1; i++) {
      const r = integral(f, grenzen[i], grenzen[i + 1]);
      ok = ok && r.ok;
      summe += Math.abs(r.wert);
      stuecke.push({ von: grenzen[i], bis: grenzen[i + 1], wert: r.wert });
    }
    return { wert: summe, ok, stuecke };
  }

  // ================================================================ Kurvendiskussion

  function ableitungBauen(ast, v) {
    try {
      const d = vereinfachen(ableiten(ast, v), v);
      return { ast: d, symbolisch: true };
    } catch (_) {
      return { ast: null, symbolisch: false };
    }
  }

  /** Woran der Definitionsbereich hängen kann (Nenner, ln, Wurzeln …) – ohne solche Stellen ist D = ℝ. */
  function heikel(n, v = 'x') {
    switch (n.t) {
      case 'zahl': case 'konst': case 'var': return false;
      case '/': return enthaelt(n.b, v) || heikel(n.a, v) || heikel(n.b, v);
      case '^': {
        if (!enthaelt(n, v)) return false;
        if (n.b.t === 'zahl' && qGanz(n.b.q) && qf(n.b.q) >= 0) return heikel(n.a, v);
        if (n.b.t === 'zahl' && qExakt(n.b.q) && n.b.q.n % 2 === 1 && qf(n.b.q) > 0) return heikel(n.a, v);
        if (!enthaelt(n.a, v) && n.a.t === 'konst') return heikel(n.b, v);
        if (!enthaelt(n.a, v) && n.a.t === 'zahl' && qf(n.a.q) > 0) return heikel(n.b, v);
        return true;
      }
      case 'fn':
        if (['ln', 'log', 'logb', 'sqrt', 'tan', 'cot', 'arcsin', 'arccos', 'nroot'].includes(n.n) && enthaelt(n.a[0], v)) return true;
        return n.a.some((x) => heikel(x, v));
      default: return (n.a && heikel(n.a, v)) || (n.b && heikel(n.b, v));
    }
  }

  /** Reelle Nullstellen eines Polynoms (Kommazahl-Koeffizienten, c[i] vor x^i): zwischen den kritischen Stellen ist p
   *  monoton – dort höchstens eine Nullstelle (Bisektion); doppelte Nullstellen liegen auf kritischen Stellen. */
  function polyWert(c, x) { let y = 0; for (let i = c.length - 1; i >= 0; i--) y = y * x + c[i]; return y; }
  function polyBetrag(c, x) { let y = 0; const a = Math.abs(x); for (let i = c.length - 1; i >= 0; i--) y = y * a + Math.abs(c[i]); return y; }
  function polyNullstellen(c) {
    c = c.slice();
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    const n = c.length - 1;
    if (n < 1) return [];
    if (n === 1) return [-c[0] / c[1]];
    const krit = polyNullstellen(c.slice(1).map((x, i) => x * (i + 1)));
    const lc = Math.abs(c[n]);
    const B = 1 + Math.max(...c.slice(0, n).map((x) => Math.abs(x) / lc));
    const pts = [-B, ...krit.filter((x) => x > -B && x < B), B];
    const aus = [];
    for (const k of krit) if (Math.abs(polyWert(c, k)) <= 1e-11 * polyBetrag(c, k)) aus.push(k);
    for (let i = 0; i < pts.length - 1; i++) {
      const l = pts[i], r = pts[i + 1];
      const pl = polyWert(c, l), pr = polyWert(c, r);
      if (pl === 0 || pr === 0 || (pl < 0) === (pr < 0)) continue;
      aus.push(bisektion((x) => polyWert(c, x), l, r, pl));
    }
    aus.sort((a, b) => a - b);
    return aus.filter((x, i) => i === 0 || Math.abs(x - aus[i - 1]) > 1e-9 * Math.max(1, Math.abs(x)));
  }
  /** Wechselt p bei x das Vorzeichen? (an der nächsten Stelle links und rechts, an der p ≠ 0) */
  function wechselt(g, x) {
    for (const d of [1e-6, 1e-5, 1e-4, 1e-3]) {
      const h = d * Math.max(1, Math.abs(x));
      const l = g(x - h), r = g(x + h);
      if (l !== 0 && r !== 0 && Number.isFinite(l) && Number.isFinite(r)) return { wechsel: (l < 0) !== (r < 0), links: l, rechts: r };
    }
    return { wechsel: false, links: 0, rechts: 0 };
  }

  /** Vollständige Kurvendiskussion (numerisch genau, Werte exakt erkannt, wo möglich).
   *  opt: {von, bis} – Untersuchungsbereich für Funktionen, die keine Polynome sind (Polynome immer ganz). */
  function untersuchen(ast, { von = -10, bis = 10, v = 'x' } = {}) {
    const f = alsFunktion(ast, v);
    const poly = alsPolynom(ast, v);
    const d1 = ableitungBauen(ast, v), d2 = d1.ast ? ableitungBauen(d1.ast, v) : { ast: null, symbolisch: false };
    const df = d1.ast ? alsFunktion(d1.ast, v) : numAbleitung(f);
    const ddf = d2.ast ? alsFunktion(d2.ast, v) : numAbleitung(df);
    const ergebnis = { v, ast, poly: !!poly, grad: poly ? poly.length - 1 : null, ableitungen: [d1.ast, d2.ast], symbolisch: d1.symbolisch };
    let a = von, b = bis;

    if (poly) {
      const c = poly.map(qf);
      const c1 = c.slice(1).map((x, i) => x * (i + 1)), c2 = c1.slice(1).map((x, i) => x * (i + 1));
      const n0 = polyNullstellen(c), n1 = polyNullstellen(c1), n2 = polyNullstellen(c2);
      const alle = [...n0, ...n1, ...n2];
      const weite = alle.length ? Math.max(...alle.map(Math.abs)) : 1;
      a = Math.min(von, -weite - 1); b = Math.max(bis, weite + 1);
      ergebnis.vollstaendig = true;
      ergebnis.luecken = [];
      ergebnis.definition = { text: 'ℝ', tex: '\\mathbb{R}', sicher: true };
      ergebnis.symmetrie = c.every((k, i) => i % 2 === 0 || k === 0) ? 'achse' : c.every((k, i) => i % 2 === 1 || k === 0) ? 'punkt' : null;
      ergebnis.nullstellen = c.length === 1 ? [] : n0.map((x) => ({ x, vzw: wechselt(f, x).wechsel }));
      ergebnis.extrema = n1.map((x) => ({ x, w: wechselt(df, x) })).filter((e) => e.w.wechsel).map((e) => ({ x: e.x, y: f(e.x), art: e.w.links > 0 ? 'hoch' : 'tief', knick: false }));
      ergebnis.wendepunkte = n2.map((x) => ({ x, w: wechselt(ddf, x) })).filter((e) => e.w.wechsel)
        .map((e) => ({ x: e.x, y: f(e.x), sattel: Math.abs(df(e.x)) <= 1e-9 * Math.max(1, polyBetrag(c1, e.x)), steigung: df(e.x), art: e.w.links > 0 ? 'lr' : 'rl' }));
    } else {
      ergebnis.vollstaendig = false;
      const heik = heikel(ast, v);
      // Definitionsbereich: abtasten, wo f definiert ist; Ränder fein bestimmen
      let intervalle = null;
      if (heik) {
        const n = 4000, stuecke = [];
        let start = null, vorher = a;
        for (let i = 0; i <= n; i++) {
          const x = a + ((b - a) * i) / n, d = Number.isFinite(f(x));
          if (d && start === null) start = i === 0 ? a : randSuchen(f, x, vorher);
          if (!d && start !== null) { stuecke.push([start, randSuchen(f, vorher, x)]); start = null; }
          vorher = x;
        }
        if (start !== null) stuecke.push([start, b]);
        intervalle = stuecke.map(([l, r]) => ({ l, r, lOffen: l <= a + 1e-9, rOffen: r >= b - 1e-9, lZu: Number.isFinite(f(l)), rZu: Number.isFinite(f(r)) }));
      }
      // Lücken: Nullstellen von Nennern (Polstellen und hebbare Lücken)
      const luecken = [];
      if (heik) {
        const nenner = [];
        (function sammeln(x) {
          if (!x || typeof x !== 'object') return;
          if (x.t === '/' && enthaelt(x.b, v)) nenner.push(x.b);
          if (x.t === '^' && x.b.t === 'zahl' && qf(x.b.q) < 0 && enthaelt(x.a, v)) nenner.push(x.a);
          if (x.t === 'fn' && x.n === 'tan') nenner.push(F('cos', x.a[0]));
          if (x.t === 'fn' && x.n === 'cot') nenner.push(F('sin', x.a[0]));
          if (x.t === 'fn') x.a.forEach(sammeln);
          else { if (x.a) sammeln(x.a); if (x.b) sammeln(x.b); }
        })(ast);
        for (const nn of nenner) {
          const g = alsFunktion(nn, v);
          for (const r of nullstellen(g, a, b, { n: 3000 })) {
            let x = r.x;
            const s = bruchNahe(x, 1000, 1e-9 * Math.max(1, Math.abs(x)));
            if (s && Math.abs(g(s[0] / s[1])) <= Math.abs(g(x)) + 1e-15) x = s[0] / s[1];
            if (luecken.some((l) => Math.abs(l.x - x) < 1e-7 * Math.max(1, Math.abs(x)))) continue;
            if (Number.isFinite(f(x)) && Math.abs(g(x)) > 1e-12) continue;
            const h = 1e-6 * Math.max(1, Math.abs(x));
            const l = f(x - h), rr = f(x + h);
            const lD = Number.isFinite(l), rD = Number.isFinite(rr);
            if (!lD && !rD) continue;
            const umgebung = Math.max(1, ...[f(x - 0.05), f(x + 0.05), f(x - 0.1), f(x + 0.1)].filter(Number.isFinite).map(Math.abs));
            const pol = Math.max(lD ? Math.abs(l) : 0, rD ? Math.abs(rr) : 0) > 1e3 * umgebung;
            luecken.push({ x, art: pol ? 'pol' : 'hebbar', innen: lD && rD, grenzwert: pol ? null : (lD && rD ? (l + rr) / 2 : lD ? l : rr), vzw: pol && lD && rD ? (l < 0) !== (rr < 0) : null });
          }
        }
        luecken.sort((p, q2) => p.x - q2.x);
      }
      ergebnis.luecken = luecken;
      if (intervalle) {
        const zusammen = [];
        for (const i of intervalle) {
          const l = zusammen[zusammen.length - 1];
          const stoss = l && Math.abs(i.l - l.r) < 1e-7 * Math.max(1, Math.abs(i.l));
          if (stoss && luecken.some((g) => g.innen && Math.abs(g.x - i.l) < 1e-6 * Math.max(1, Math.abs(g.x)))) Object.assign(l, { r: i.r, rOffen: i.rOffen, rZu: i.rZu });
          else zusammen.push({ ...i });
        }
        intervalle = zusammen;
      }
      ergebnis.definition = definitionsText(intervalle, luecken.filter((l) => l.innen), !heik);
      // Symmetrie
      let achse = true, punkt = true, getestet = 0;
      for (let i = 1; i <= 40; i++) {
        const x = 0.137 + i * 0.611;
        const p = f(x), m = f(-x);
        if (!Number.isFinite(p) || !Number.isFinite(m)) { if (Number.isFinite(p) !== Number.isFinite(m)) { achse = false; punkt = false; } continue; }
        getestet++;
        const t = 1e-9 * (1 + Math.abs(p));
        if (Math.abs(p - m) > t) achse = false;
        if (Math.abs(p + m) > t) punkt = false;
      }
      ergebnis.symmetrie = getestet >= 5 ? (achse ? 'achse' : punkt ? 'punkt' : null) : null;
      ergebnis.nullstellen = nullstellen(f, a, b, { df }).filter((r) => Number.isFinite(f(r.x)));
      ergebnis.extrema = vorzeichenwechsel(df, f, a, b).map((s) => ({ x: s.x, y: f(s.x), art: s.links > 0 ? 'hoch' : 'tief', knick: !s.glatt }));
      ergebnis.wendepunkte = vorzeichenwechsel(ddf, f, a, b)
        .map((s) => ({ x: s.x, y: f(s.x), sattel: Math.abs(df(s.x)) < 1e-8 * Math.max(1, Math.abs(f(s.x))), steigung: df(s.x), art: s.links > 0 ? 'lr' : 'rl' }));
    }
    ergebnis.von = a; ergebnis.bis = b;
    const y0 = f(0);
    ergebnis.yAchse = Number.isFinite(y0) ? y0 : null;

    // Monotonie und Krümmung zwischen den besonderen Stellen
    const teilung = (stellen) => {
      const xs = [a, ...stellen.filter((x) => x > a && x < b), b].sort((p, q2) => p - q2);
      const aus = [];
      for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] - xs[i] > 1e-9) aus.push({ l: xs[i], r: xs[i + 1] });
      return aus;
    };
    const pole = ergebnis.luecken.map((l) => l.x);
    ergebnis.monotonie = zusammenfassen(teilung([...ergebnis.extrema.map((e) => e.x), ...pole]).map((t) => {
      const s = mittelVorzeichen(df, t.l, t.r);
      return s === null ? null : { ...t, art: s > 0 ? 'steigend' : s < 0 ? 'fallend' : 'konstant' };
    }).filter(Boolean), pole);
    ergebnis.kruemmung = zusammenfassen(teilung([...ergebnis.wendepunkte.map((w) => w.x), ...pole]).map((t) => {
      const s = mittelVorzeichen(ddf, t.l, t.r);
      return s === null ? null : { ...t, art: s > 0 ? 'links' : s < 0 ? 'rechts' : 'gerade' };
    }).filter(Boolean), pole);

    // Verhalten im Unendlichen und Asymptoten
    ergebnis.unendlich = { plus: grenzverhalten(f, 1, poly), minus: grenzverhalten(f, -1, poly) };
    const waag = [];
    for (const u of [ergebnis.unendlich.minus, ergebnis.unendlich.plus]) {
      if (u.art === 'wert' && !waag.some((w) => w.art === 'waagerecht' && Math.abs(w.y - u.y) < 1e-9)) waag.push({ art: 'waagerecht', y: u.y });
      if (u.art === 'schief' && !waag.some((w) => w.art === 'schief' && Math.abs(w.m - u.m) < 1e-9 && Math.abs(w.b - u.b) < 1e-9)) waag.push({ art: 'schief', m: u.m, b: u.b });
    }
    ergebnis.asymptoten = [...ergebnis.luecken.filter((l) => l.art === 'pol').map((l) => ({ art: 'senkrecht', x: l.x })), ...(poly ? [] : waag)];
    return ergebnis;
  }

  /** Grenze zwischen definiert (drin) und nicht definiert (draussen) – auf einen schönen Wert gerundet, wenn er passt. */
  function randSuchen(f, drin, draussen) {
    for (let i = 0; i < 80; i++) {
      const m = (drin + draussen) / 2;
      if (m === drin || m === draussen) break;
      if (Number.isFinite(f(m))) drin = m; else draussen = m;
    }
    const s = bruchNahe(drin, 1000, 1e-9 * Math.max(1, Math.abs(drin)));
    return s ? s[0] / s[1] : drin;
  }

  function mittelVorzeichen(g, l, r) {
    let plus = 0, minus = 0, null0 = 0;
    for (let i = 1; i <= 7; i++) {
      const y = g(l + ((r - l) * i) / 8);
      if (!Number.isFinite(y)) continue;
      if (Math.abs(y) < 1e-12) null0++; else if (y > 0) plus++; else minus++;
    }
    if (!plus && !minus && !null0) return null;
    if (null0 >= 6) return 0;
    return plus >= minus ? 1 : -1;
  }
  /** Benachbarte Intervalle gleicher Art verbinden – aber nie über eine Polstelle oder Lücke hinweg. */
  function zusammenfassen(l, trenner = []) {
    const aus = [];
    for (const t of l) {
      const letzt = aus[aus.length - 1];
      const getrennt = trenner.some((x) => Math.abs(x - t.l) < 1e-9 * Math.max(1, Math.abs(x)));
      if (letzt && !getrennt && letzt.art === t.art && Math.abs(letzt.r - t.l) < 1e-9) letzt.r = t.r; else aus.push({ ...t });
    }
    return aus;
  }

  function grenzverhalten(f, richtung, poly) {
    if (poly) {
      const n = poly.length - 1, lc = qf(poly[n]);
      if (n === 0) return { art: 'wert', y: lc };
      const s = Math.sign(lc) * (richtung < 0 && n % 2 === 1 ? -1 : 1);
      return { art: s > 0 ? 'plus' : 'minus' };
    }
    const X = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((x) => x * richtung);
    const Y = X.map(f);
    const n = Y.length;
    if (Y.slice(-2).every((y) => y === Infinity)) return { art: 'plus' };
    if (Y.slice(-2).every((y) => y === -Infinity)) return { art: 'minus' };
    if (Y.slice(-3).some((y) => !Number.isFinite(y))) return { art: 'undefiniert' };
    const [ya, yb, yc] = Y.slice(-3);
    if (Math.abs(yc - yb) < 1e-6 * Math.max(1, Math.abs(yc)) && Math.abs(yb - ya) < 1e-4 * Math.max(1, Math.abs(yb))) return { art: 'wert', y: rundeSchoen(yc) };
    // schiefe Asymptote y = mx + b: Steigung aus dem Differenzenquotienten weit draußen
    const m = (yc - yb) / (X[n - 1] - X[n - 2]), m0 = (yb - ya) / (X[n - 2] - X[n - 3]);
    if (Math.abs(m) > 1e-6 && Math.abs(m - m0) < 1e-6 * Math.max(1, Math.abs(m))) {
      const mm = rundeSchoen(m);
      const b1 = yb - mm * X[n - 2], b2 = yc - mm * X[n - 1];
      if (Math.abs(b1 - b2) < 1e-4 * Math.max(1, Math.abs(b2))) return { art: 'schief', m: mm, b: rundeSchoen(b2), richtung: yc > 0 ? 'plus' : 'minus' };
    }
    const d = Y.slice(1).map((y, i) => y - Y[i]);
    const mono = d.every((x) => x > 0) || d.every((x) => x < 0);
    const weg = Y.slice(1).every((y, i) => Math.abs(y) > Math.abs(Y[i]));
    if (mono && weg && Math.abs(d[d.length - 1]) > 0.25 * Math.abs(d[0])) return { art: yc > 0 ? 'plus' : 'minus' };
    const wechsel = d.slice(1).filter((x, i) => (x > 0) !== (d[i] > 0)).length;
    return { art: wechsel >= 2 ? 'schwankt' : 'unklar' };
  }
  function rundeSchoen(v) {
    const e = erkennen(v);
    if (e.exakt) { const b = bruchNahe(v, 1000, 1e-6 * Math.max(1, Math.abs(v))); if (b) return b[0] / b[1]; }
    const r = Math.round(v * 1e6) / 1e6;
    return Math.abs(r) < 1e-9 ? 0 : r;
  }

  function definitionsText(intervalle, luecken, ganz) {
    const ausser = luecken.length ? ' \\ {' + luecken.map((l) => erkennen(l.x).text).join('; ') + '}' : '';
    const ausserT = luecken.length ? '\\setminus\\{' + luecken.map((l) => erkennen(l.x).tex).join(';\\,') + '\\}' : '';
    if (ganz || !intervalle) return { text: 'ℝ' + ausser, tex: '\\mathbb{R}' + ausserT, sicher: ganz };
    if (!intervalle.length) return { text: 'leer (im untersuchten Bereich nirgends definiert)', tex: '\\emptyset', sicher: false };
    if (intervalle.length === 1 && intervalle[0].lOffen && intervalle[0].rOffen) return { text: 'ℝ' + ausser, tex: '\\mathbb{R}' + ausserT, sicher: false };
    const teile = intervalle.map((i) => {
      const l = erkennen(i.l), r = erkennen(i.r);
      if (i.lOffen && !i.rOffen) return { text: `x ${i.rZu ? '≤' : '<'} ${r.text}`, tex: `x${i.rZu ? '\\le' : '<'}${r.tex}` };
      if (!i.lOffen && i.rOffen) return { text: `x ${i.lZu ? '≥' : '>'} ${l.text}`, tex: `x${i.lZu ? '\\ge' : '>'}${l.tex}` };
      return { text: `${l.text} ${i.lZu ? '≤' : '<'} x ${i.rZu ? '≤' : '<'} ${r.text}`, tex: `${l.tex}${i.lZu ? '\\le' : '<'}x${i.rZu ? '\\le' : '<'}${r.tex}` };
    });
    return {
      text: teile.map((t) => t.text).join(' oder ') + (luecken.length ? ', ohne x = ' + luecken.map((l) => erkennen(l.x).text).join('; ') : ''),
      tex: teile.map((t) => t.tex).join('\\ \\text{oder}\\ ') + (luecken.length ? ',\\ x\\ne ' + luecken.map((l) => erkennen(l.x).tex).join(';\\,') : ''),
      sicher: false,
    };
  }

  // ================================================================ Steckbriefaufgaben (exakt mit großen Brüchen)

  const R = {
    von(t) {
      const s = String(t).trim().replace(',', '.').replace('−', '-');
      let m;
      if ((m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s))) return R.neu(BigInt(m[1]), BigInt(m[2]));
      if ((m = /^(-?)(\d*)(?:\.(\d+))?$/.exec(s)) && (m[2] || m[3])) {
        const d = m[3] || '';
        return R.neu(BigInt((m[1] || '') + (m[2] || '0') + d), 10n ** BigInt(d.length));
      }
      const v = Number(s);
      if (!Number.isFinite(v)) throw fehler(`„${t}“ ist keine Zahl.`);
      const b = bruchNahe(v, 1e6, 1e-12);
      if (b) return R.neu(BigInt(b[0]), BigInt(b[1]));
      throw fehler(`„${t}“ ist keine Zahl.`);
    },
    neu(z, n = 1n) {
      if (n === 0n) throw fehler('Division durch 0.');
      if (n < 0n) { z = -z; n = -n; }
      const g = R.ggt(z < 0n ? -z : z, n) || 1n;
      return { z: z / g, n: n / g };
    },
    ggt(a, b) { while (b) [a, b] = [b, a % b]; return a; },
    plus: (a, b) => R.neu(a.z * b.n + b.z * a.n, a.n * b.n),
    minus: (a, b) => R.neu(a.z * b.n - b.z * a.n, a.n * b.n),
    mal: (a, b) => R.neu(a.z * b.z, a.n * b.n),
    durch: (a, b) => R.neu(a.z * b.n, a.n * b.z),
    null: (a) => a.z === 0n,
    hoch(a, k) { let r = R.neu(1n); for (let i = 0; i < k; i++) r = R.mal(r, a); return r; },
    zahl: (a) => Number(a.z) / Number(a.n),
    q: (a) => (a.z <= BigInt(SICHER) && a.z >= -BigInt(SICHER) && a.n <= BigInt(SICHER) ? q(Number(a.z), Number(a.n)) : { f: R.zahl(a) }),
  };
  const BUCHSTABEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
  const fakt = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };

  /** Steckbrief: {grad, symmetrie: null|'achse'|'punkt', bedingungen: [{art, x, y, m, wert, von, bis, abl}]}
   *  Arten: punkt (x,y) · steigung (x,m) · extremum (x[,y]) · wendepunkt (x[,y]) · sattel (x[,y]) · tangente (x,m,b) ·
   *  integral (von,bis,wert) · ableitung (abl,x,wert). → {ok, ast, text, tex, ansatz, gleichungen, hinweise, fehler} */
  function steckbrief({ grad: n, symmetrie = null, bedingungen = [] }) {
    n = Math.round(Number(n));
    if (!(n >= 1 && n <= 8)) throw fehler('Der Grad muss zwischen 1 und 8 liegen.');
    // Unbekannte: Koeffizienten a_n … a_0 (bei Symmetrie fallen manche weg)
    const exps = [];
    for (let i = n; i >= 0; i--) if (!(symmetrie === 'achse' && i % 2 === 1) && !(symmetrie === 'punkt' && i % 2 === 0)) exps.push(i);
    const namen = exps.map((_, k) => BUCHSTABEN[k]);
    const ansatzTex = exps.map((i, k) => namen[k] + (i === 0 ? '' : i === 1 ? 'x' : `x^{${i}}`)).join('+');
    // Gleichungen
    const gl = [];
    const zeile = (abl, xr) => exps.map((i) => (i < abl ? R.neu(0n) : R.mal(R.neu(fakt(i) / fakt(i - abl)), R.hoch(xr, i - abl))));
    const dazu = (koeff, rechts, was) => gl.push({ koeff, rechts, was });
    const strichName = (k) => 'f' + "'".repeat(k);
    for (const c of bedingungen) {
      const X = (w) => R.von(w);
      const xs = c.x !== undefined && c.x !== '' ? X(c.x) : null;
      const xt = () => texR(xs);
      switch (c.art) {
        case 'punkt': dazu(zeile(0, xs), X(c.y), `f(${xt()})=${texR(X(c.y))}`); break;
        case 'steigung': dazu(zeile(1, xs), X(c.m), `f'(${xt()})=${texR(X(c.m))}`); break;
        case 'extremum':
          dazu(zeile(1, xs), R.neu(0n), `f'(${xt()})=0`);
          if (c.y !== undefined && c.y !== '' && c.y !== null) dazu(zeile(0, xs), X(c.y), `f(${xt()})=${texR(X(c.y))}`);
          break;
        case 'wendepunkt':
          dazu(zeile(2, xs), R.neu(0n), `f''(${xt()})=0`);
          if (c.y !== undefined && c.y !== '' && c.y !== null) dazu(zeile(0, xs), X(c.y), `f(${xt()})=${texR(X(c.y))}`);
          break;
        case 'sattel':
          dazu(zeile(1, xs), R.neu(0n), `f'(${xt()})=0`);
          dazu(zeile(2, xs), R.neu(0n), `f''(${xt()})=0`);
          if (c.y !== undefined && c.y !== '' && c.y !== null) dazu(zeile(0, xs), X(c.y), `f(${xt()})=${texR(X(c.y))}`);
          break;
        case 'tangente': {
          const m = X(c.m), b = X(c.b ?? 0);
          dazu(zeile(1, xs), m, `f'(${xt()})=${texR(m)}`);
          dazu(zeile(0, xs), R.plus(R.mal(m, xs), b), `f(${xt()})=${texR(R.plus(R.mal(m, xs), b))}`);
          break;
        }
        case 'integral': {
          const u = X(c.von), o = X(c.bis);
          const koeff = exps.map((i) => R.durch(R.minus(R.hoch(o, i + 1), R.hoch(u, i + 1)), R.neu(BigInt(i + 1))));
          dazu(koeff, X(c.wert), `\\int_{${texR(u)}}^{${texR(o)}}f(x)\\,dx=${texR(X(c.wert))}`);
          break;
        }
        case 'ableitung': {
          const k = Math.max(0, Math.min(n, Math.round(Number(c.abl) || 0)));
          dazu(zeile(k, xs), X(c.wert), `${strichName(k)}(${xt()})=${texR(X(c.wert))}`);
          break;
        }
        default: throw fehler(`Unbekannte Bedingung „${c.art}“.`);
      }
    }
    const gleichungen = gl.map((g) => ({ bedingung: g.was, tex: gleichungTex(g.koeff, namen, g.rechts) }));
    const ergebnisBasis = { ansatz: `f(x)=${ansatzTex}`, namen, exps, gleichungen, unbekannte: namen.length };
    if (!gl.length) return { ...ergebnisBasis, ok: false, fehler: `Es fehlen noch ${namen.length} Bedingungen.` };
    // Gauß-Jordan
    const m = gl.map((g) => [...g.koeff, g.rechts]);
    const spalten = namen.length;
    let zeileNr = 0;
    const pivot = [];
    for (let s = 0; s < spalten && zeileNr < m.length; s++) {
      let p = m.findIndex((z, i) => i >= zeileNr && !R.null(z[s]));
      if (p < 0) continue;
      [m[zeileNr], m[p]] = [m[p], m[zeileNr]];
      const pv = m[zeileNr][s];
      m[zeileNr] = m[zeileNr].map((x) => R.durch(x, pv));
      for (let i = 0; i < m.length; i++) {
        if (i === zeileNr || R.null(m[i][s])) continue;
        const k = m[i][s];
        m[i] = m[i].map((x, j) => R.minus(x, R.mal(k, m[zeileNr][j])));
      }
      pivot.push(s);
      zeileNr++;
    }
    const widerspruch = m.some((z) => z.slice(0, spalten).every(R.null) && !R.null(z[spalten]));
    if (widerspruch) return { ...ergebnisBasis, ok: false, fehler: 'Die Bedingungen widersprechen sich – es gibt keine solche Funktion. Prüfe die Angaben oder wähle einen höheren Grad.' };
    if (pivot.length < spalten) {
      const fehlt = spalten - pivot.length;
      return { ...ergebnisBasis, ok: false, fehler: fehlt === 1 ? 'Es fehlt noch eine Bedingung – die Funktion ist noch nicht eindeutig.' : `Es fehlen noch ${fehlt} Bedingungen – die Funktion ist noch nicht eindeutig.`, rang: pivot.length };
    }
    const loesung = Array(spalten).fill(null);
    pivot.forEach((s, i) => { loesung[s] = m[i][spalten]; });
    const koeff = Array.from({ length: n + 1 }, () => q(0));
    exps.forEach((e, k) => { koeff[e] = R.q(loesung[k]); });
    const ast = polynomAst(koeff);
    const hinweise = [];
    if (R.null(loesung[0]) && exps[0] === n) hinweise.push(`Der Koeffizient vor x^${n} ist 0 – die Funktion hat einen kleineren Grad als ${n}.`);
    if (gl.length > spalten) hinweise.push(`${gl.length - spalten} Bedingung${gl.length - spalten === 1 ? ' war' : 'en waren'} schon in den anderen enthalten.`);
    // Probe: Extremstellen und Wendestellen wirklich?
    const f = alsFunktion(ast), d2 = alsFunktion(vereinfachen(ableiten(ableiten(ast)))), d1 = alsFunktion(vereinfachen(ableiten(ast)));
    for (const c of bedingungen) {
      if (c.art === 'extremum') {
        const x = R.zahl(R.von(c.x));
        const l = d1(x - 1e-4), r = d1(x + 1e-4);
        if ((l < 0) === (r < 0)) hinweise.push(`Probe: Bei x = ${zahlKurz(x)} ist f′ = 0, aber ohne Vorzeichenwechsel – das ist kein Extremum, sondern ein Sattelpunkt. Die Aufgabe ist so nicht erfüllbar.`);
        else hinweise.push(`Probe: Bei x = ${zahlKurz(x)} liegt ein ${l > 0 ? 'Hochpunkt' : 'Tiefpunkt'} (f′ wechselt das Vorzeichen${Math.abs(d2(x)) > 1e-12 ? `, f″(${zahlKurz(x)}) = ${zahlKurz(d2(x))}` : ''}).`);
      }
      if (c.art === 'wendepunkt') {
        const x = R.zahl(R.von(c.x));
        const l = d2(x - 1e-4), r = d2(x + 1e-4);
        if ((l < 0) === (r < 0)) hinweise.push(`Probe: Bei x = ${zahlKurz(x)} ist f″ = 0, aber ohne Vorzeichenwechsel – dort ist kein Wendepunkt.`);
      }
    }
    void f;
    return {
      ...ergebnisBasis, ok: true, ast, text: text(ast), tex: tex(ast), hinweise,
      loesung: namen.map((nm, k) => ({ name: nm, tex: texR(loesung[k]), wert: R.zahl(loesung[k]) })),
    };
  }
  function texR(r) {
    if (r.n === 1n) return String(r.z);
    return (r.z < 0n ? '-' : '') + `\\frac{${r.z < 0n ? -r.z : r.z}}{${r.n}}`;
  }
  function gleichungTex(koeff, namen, rechts) {
    let s = '';
    koeff.forEach((k, i) => {
      if (R.null(k)) return;
      const neg = k.z < 0n;
      const betrag = neg ? R.neu(-k.z, k.n) : k;
      const kt = betrag.z === 1n && betrag.n === 1n ? '' : texR(betrag);
      s += (s ? (neg ? '-' : '+') : neg ? '-' : '') + kt + namen[i];
    });
    return (s || '0') + '=' + texR(rechts);
  }

  // ================================================================ Regression

  /** Ausgleichsfunktion durch Messpunkte. art: linear | quadratisch | kubisch | exponentiell | potenz | logarithmisch
   *  → {ok, ast, text, tex, r2, fehler} */
  function regression(punkte, art) {
    const P = punkte.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    const gradVon = { linear: 1, quadratisch: 2, kubisch: 3 };
    const sig = (v) => Number(v.toPrecision(12));
    let ast, f;
    if (gradVon[art]) {
      const g = gradVon[art];
      if (P.length < g + 1) return { ok: false, fehler: `Dafür brauchst du mindestens ${g + 1} Punkte.` };
      const c = polyFit(P.map((p) => p[0]), P.map((p) => p[1]), g);
      if (!c) return { ok: false, fehler: 'Die Punkte reichen dafür nicht (z. B. alle mit demselben x).' };
      ast = polynomAst(c.map((k) => qAusZahl(sig(k), 1000)));
    } else if (art === 'exponentiell') {
      if (P.some(([, y]) => y <= 0)) return { ok: false, fehler: 'Exponentiell geht nur mit y > 0.' };
      const c = polyFit(P.map((p) => p[0]), P.map((p) => Math.log(p[1])), 1);
      if (!c) return { ok: false, fehler: 'Zu wenige verschiedene Punkte.' };
      ast = B('*', Z(sig(Math.exp(c[0]))), B('^', K('e'), B('*', Z(sig(c[1])), V('x'))));
    } else if (art === 'potenz') {
      if (P.some(([x, y]) => x <= 0 || y <= 0)) return { ok: false, fehler: 'Potenzfunktionen gehen nur mit x > 0 und y > 0.' };
      const c = polyFit(P.map((p) => Math.log(p[0])), P.map((p) => Math.log(p[1])), 1);
      if (!c) return { ok: false, fehler: 'Zu wenige verschiedene Punkte.' };
      ast = B('*', Z(sig(Math.exp(c[0]))), B('^', V('x'), Z(sig(c[1]))));
    } else if (art === 'logarithmisch') {
      if (P.some(([x]) => x <= 0)) return { ok: false, fehler: 'Logarithmisch geht nur mit x > 0.' };
      const c = polyFit(P.map((p) => Math.log(p[0])), P.map((p) => p[1]), 1);
      if (!c) return { ok: false, fehler: 'Zu wenige verschiedene Punkte.' };
      ast = B('+', Z(sig(c[0])), B('*', Z(sig(c[1])), F('ln', V('x'))));
    } else return { ok: false, fehler: 'Unbekannte Art.' };
    ast = vereinfachen(ast);
    f = alsFunktion(ast);
    const my = P.reduce((s, p) => s + p[1], 0) / P.length;
    const sst = P.reduce((s, p) => s + (p[1] - my) ** 2, 0), sse = P.reduce((s, p) => s + (p[1] - f(p[0])) ** 2, 0);
    return { ok: true, ast, text: text(ast), tex: tex(ast), r2: sst > 0 ? 1 - sse / sst : 1 };
  }
  /** Kleinste Quadrate (x zentriert für die Genauigkeit) → Koeffizienten c[0] + c[1]x + … */
  function polyFit(xs, ys, g) {
    const n = xs.length;
    const mx = xs.reduce((s, x) => s + x, 0) / n;
    const sx = Math.max(1e-12, Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) / n));
    const ts = xs.map((x) => (x - mx) / sx);
    const A = Array.from({ length: g + 1 }, () => Array(g + 2).fill(0));
    for (let k = 0; k < n; k++) {
      const pot = [1];
      for (let i = 1; i <= 2 * g; i++) pot.push(pot[i - 1] * ts[k]);
      for (let i = 0; i <= g; i++) {
        for (let j = 0; j <= g; j++) A[i][j] += pot[i + j];
        A[i][g + 1] += pot[i] * ys[k];
      }
    }
    for (let s = 0; s <= g; s++) {
      let p = s;
      for (let i = s + 1; i <= g; i++) if (Math.abs(A[i][s]) > Math.abs(A[p][s])) p = i;
      if (Math.abs(A[p][s]) < 1e-12) return null;
      [A[s], A[p]] = [A[p], A[s]];
      for (let i = 0; i <= g; i++) {
        if (i === s) continue;
        const k = A[i][s] / A[s][s];
        for (let j = s; j <= g + 1; j++) A[i][j] -= k * A[s][j];
      }
    }
    const ct = A.map((z, i) => z[g + 1] / z[i]);
    // p(t) mit t = (x − mx)/sx zurück nach x ausmultiplizieren
    const c = Array(g + 1).fill(0);
    const bin = (n2, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n2 - k + i)) / i; return r; };
    for (let i = 0; i <= g; i++) {
      for (let j = 0; j <= i; j++) c[j] += ct[i] * bin(i, j) * Math.pow(-mx, i - j) / Math.pow(sx, i);
    }
    return c;
  }

  // ================================================================ Ein ganzes Blatt deuten

  const RESERVIERT = new Set(['x', 'y', 'r', 't', 'e', 'theta', 'pi']);
  /** Einen Bereich wie „-2 < x < 3“, „x >= 0“ lesen → {min, max} oder null */
  function bereichLesen(s) {
    const t = normalisieren(s).replace(/^für\s+/i, '');
    let m;
    if ((m = /^(.+?)(<=|<)\s*x\s*(<=|<)(.+)$/.exec(t))) return { min: lesenWert(m[1]), max: lesenWert(m[4]) };
    if ((m = /^(.+?)(>=|>)\s*x\s*(>=|>)(.+)$/.exec(t))) return { min: lesenWert(m[4]), max: lesenWert(m[1]) };
    if ((m = /^x\s*(<=|<)(.+)$/.exec(t))) return { min: -Infinity, max: lesenWert(m[2]) };
    if ((m = /^x\s*(>=|>)(.+)$/.exec(t))) return { min: lesenWert(m[2]), max: Infinity };
    if ((m = /^(.+?)(<=|<)\s*x$/.exec(t))) return { min: lesenWert(m[1]), max: Infinity };
    if ((m = /^(.+?)(>=|>)\s*x$/.exec(t))) return { min: -Infinity, max: lesenWert(m[1]) };
    return null;
  }
  function lesenWert(s) {
    const v = kompilieren(lesen(s))({});
    if (!Number.isFinite(v)) throw fehler(`„${s.trim()}“ ist keine Zahl.`);
    return v;
  }

  /** Tupel „1|2“, „1; 2“, „1, 2“ → [a, b] oder null */
  function tupelTeilen(innen) {
    let tiefe = 0;
    const pos = { '|': [], ';': [], ',': [] };
    for (let i = 0; i < innen.length; i++) {
      const c = innen[i];
      if (c === '(' || c === '[' || c === '{') tiefe++;
      else if (c === ')' || c === ']' || c === '}') { tiefe--; if (tiefe < 0) return null; }
      else if (tiefe === 0 && pos[c]) pos[c].push(i);
    }
    if (tiefe !== 0) return null;
    const teilen = (i) => [innen.slice(0, i).trim(), innen.slice(i + 1).trim()];
    if (pos[';'].length === 1) return teilen(pos[';'][0]);
    if (pos['|'].length === 1) return teilen(pos['|'][0]);
    if (pos[','].length === 1) return teilen(pos[','][0]);
    if (pos[','].length > 1) {
      const mitLeer = pos[','].filter((i) => innen[i + 1] === ' ');
      if (mitLeer.length === 1) return teilen(mitLeer[0]);
    }
    return null;
  }

  /** Alle Zeilen eines Blatts deuten. eintraege: [{id, text, …}] → Map id → Deutung:
   *  {art: leer|funktion|gleichung|ungleichung|punkt|kurve|polar|parameter|wert|senkrecht|fehler, …} */
  function blattDeuten(eintraege) {
    const ergebnis = new Map();
    // 1) Namen eigener Funktionen und Parameter einsammeln
    const funktionsNamen = new Set();
    const vor = new Map();
    for (const e of eintraege) {
      if (e.art === 'tabelle') continue;
      let s = String(e.text || '').trim();
      let bereich = null;
      const b = /\s*(?:\{([^{}]*[<>≤≥][^{}]*)\}|,?\s+für\s+(.+))\s*$/i.exec(s);
      if (b) {
        try { bereich = bereichLesen(b[1] || b[2]); } catch (_) { bereich = null; }
        if (bereich) s = s.slice(0, b.index).trim();
      }
      vor.set(e.id, { s, bereich });
      const m = /^\s*([A-Za-z](?:_\w+)?)\s*\(\s*([A-Za-zθ]+)\s*\)\s*=/.exec(s);
      if (m && !FUNKTIONEN[m[1]] && !['x', 'y', 'r', 'e'].includes(m[1])) funktionsNamen.add(m[1]);
      const p = /^\s*([a-z])\s*=\s*(.+)$/.exec(s);
      if (p && !RESERVIERT.has(p[1]) && /x/.test(normalisieren(p[2]).replace(/exp|max/g, '')) && !/y/.test(normalisieren(p[2]))) funktionsNamen.add(p[1]);
    }
    const ctx = { funktionen: funktionsNamen, namen: [...funktionsNamen] };
    const defs = new Map();
    const parameterAst = new Map();
    const geparst = new Map();

    // 2) Jede Zeile lesen und grob einordnen
    for (const e of eintraege) {
      if (e.art === 'tabelle') { ergebnis.set(e.id, { art: 'tabelle' }); continue; }
      const { s, bereich } = vor.get(e.id);
      if (!s) { ergebnis.set(e.id, { art: 'leer' }); continue; }
      try {
        geparst.set(e.id, { ...einordnen(s, ctx), bereich });
      } catch (err) {
        ergebnis.set(e.id, { art: 'fehler', fehler: err.mathe ? err.message : 'Das kann ich nicht lesen.' });
        continue;
      }
      const g = geparst.get(e.id);
      if (g.art === 'definition') {
        if (defs.has(g.name)) { ergebnis.set(e.id, { art: 'fehler', fehler: `${g.name} ist schon festgelegt.` }); geparst.delete(e.id); continue; }
        defs.set(g.name, { param: g.param, ast: g.ast, id: e.id });
      }
      if (g.art === 'parameter') {
        if (parameterAst.has(g.name)) { ergebnis.set(e.id, { art: 'fehler', fehler: `${g.name} ist schon festgelegt.` }); geparst.delete(e.id); continue; }
        parameterAst.set(g.name, { ast: g.ast, id: e.id });
      }
    }

    // 3) Parameter ausrechnen (dürfen sich aufeinander beziehen)
    const werte = {};
    const offen = new Map(parameterAst);
    for (let runde = 0; runde < 12 && offen.size; runde++) {
      for (const [name, p] of [...offen]) {
        try {
          const a = einsetzen(p.ast, defs);
          const frei = [...variablen(a)].filter((v) => !(v in werte));
          if (frei.length) continue;
          const w = kompilieren(a)(werte);
          if (Number.isFinite(w)) { werte[name] = w; offen.delete(name); }
        } catch (_) { /* später */ }
      }
    }
    for (const [name, p] of offen) {
      ergebnis.set(p.id, { art: 'fehler', fehler: `${name} lässt sich nicht ausrechnen.`, fehlend: [...variablen(p.ast)].filter((v) => !(v in werte) && !parameterAst.has(v)) });
    }

    // 4) Einsetzen, freie Namen prüfen, rechenfertige Funktionen bauen
    const pruefen = (ast, erlaubt) => {
      const frei = [...variablen(ast)].filter((v) => !erlaubt.includes(v) && !(v in werte));
      return frei;
    };
    for (const e of eintraege) {
      const g = geparst.get(e.id);
      if (!g || ergebnis.has(e.id)) continue;
      try {
        const d = deutungBauen(g, defs, werte, pruefen);
        ergebnis.set(e.id, { ...d, bereich: g.bereich || null });
      } catch (err) {
        ergebnis.set(e.id, { art: 'fehler', fehler: err.mathe ? err.message : 'Das kann ich nicht rechnen.' });
      }
    }
    return { deutungen: ergebnis, werte, defs };
  }

  const REL = new Set(['=', '<', '>', '<=', '>=']);
  /** Eine Zeile grob einordnen (noch ohne Einsetzen). */
  function einordnen(s, ctx) {
    // Punkte: P(1|2), P = (1|2), (1|2) – und Kurven (cos t | sin t)
    const pm = /^([A-Z][A-Za-z0-9_]*'*)?\s*(=\s*)?\((.*)\)\s*$/.exec(s);
    if (pm && (pm[1] || pm[2] === undefined)) {
      const teile = tupelTeilen(pm[3]);
      if (teile && teile[0] && teile[1]) {
        const x = lesen(teile[0], ctx), y = lesen(teile[1], ctx);
        return { art: 'punkt', name: pm[1] || '', x, y };
      }
    }
    const tok = zerlegen(normalisieren(s), ctx.namen);
    // an der ersten Relation auf oberster Ebene trennen
    let tiefe = 0, rel = -1;
    const rels = [];
    tok.forEach((t, i) => {
      if (t.t === 'op' && t.v === '(') tiefe++;
      else if (t.t === 'op' && t.v === ')') tiefe--;
      else if (t.t === 'op' && REL.has(t.v) && tiefe === 0) rels.push(i);
    });
    if (rels.length > 1) {
      // a < x < b als Bereich ist nur hinter einer Funktion erlaubt
      throw fehler('Nur ein Vergleich pro Zeile – für Bereiche schreib z. B. „f(x) = x² {0 < x < 2}“.');
    }
    rel = rels.length ? rels[0] : -1;
    if (rel < 0) {
      const ast = baumAus(tok, ctx);
      return { art: 'ausdruck', ast };
    }
    const op = tok[rel].v;
    const linksTok = tok.slice(0, rel), rechtsTok = tok.slice(rel + 1);
    if (!linksTok.length || !rechtsTok.length) throw fehler(`Auf einer Seite von „${op}“ fehlt etwas.`);
    // Definition f(x) = …
    if (op === '=' && linksTok.length === 4 && linksTok[0].t === 'name' && ctx.funktionen.has(linksTok[0].v) && !linksTok[0].striche &&
        linksTok[1].v === '(' && linksTok[2].t === 'name' && linksTok[3].v === ')') {
      const ast = baumAus(rechtsTok, ctx);
      return { art: 'definition', name: linksTok[0].v, param: linksTok[2].v, ast, links: linksTok[0].v };
    }
    // f = x² (Kurzform)
    if (op === '=' && linksTok.length === 1 && linksTok[0].t === 'name' && ctx.funktionen.has(linksTok[0].v)) {
      return { art: 'definition', name: linksTok[0].v, param: 'x', ast: baumAus(rechtsTok, ctx), links: linksTok[0].v };
    }
    const links = baumAus(linksTok, ctx), rechts = baumAus(rechtsTok, ctx);
    // Parameter a = 2
    if (op === '=' && links.t === 'var' && !RESERVIERT.has(links.n)) {
      const vr = variablen(rechts);
      if (!vr.has('x') && !vr.has('y') && !vr.has(links.n)) return { art: 'parameter', name: links.n, ast: rechts };
    }
    return { art: 'relation', op, links, rechts };
  }

  function deutungBauen(g, defs, werte, pruefen) {
    const ein = (a) => einsetzen(a, defs);
    const fehlt = (frei) => { if (frei.length) { const e = fehler(frei.length === 1 ? `${frei[0]} ist noch nicht festgelegt.` : `${frei.join(', ')} sind noch nicht festgelegt.`); e.fehlend = frei; throw e; } };
    const mitFehlend = (fn) => { try { return fn(); } catch (e) { if (e.fehlend) return { art: 'fehler', fehler: e.message, fehlend: e.fehlend }; throw e; } };
    return mitFehlend(() => {
      switch (g.art) {
        case 'definition': {
          const ast = ein(g.ast);
          const frei = pruefen(ast, [g.param]);
          fehlt(frei);
          const plot = g.param === 'x' ? ast : ersetzen(ast, g.param, V('x'));
          return { art: 'funktion', name: g.name, param: g.param, ast: plot, anzeige: g.ast, f: alsFunktion(plot, 'x', werte) };
        }
        case 'parameter':
          return { art: 'parameter', name: g.name, wert: werte[g.name], anzeige: g.ast };
        case 'punkt': {
          const x = ein(g.x), y = ein(g.y);
          const frei = pruefen(x, ['t']).concat(pruefen(y, ['t']));
          fehlt([...new Set(frei)]);
          if (enthaelt(x, 't') || enthaelt(y, 't')) {
            return { art: 'kurve', x, y, fx: alsFunktion(x, 't', werte), fy: alsFunktion(y, 't', werte), anzeigeX: g.x, anzeigeY: g.y };
          }
          return { art: 'punkt', name: g.name, x: kompilieren(x)(werte), y: kompilieren(y)(werte), anzeigeX: g.x, anzeigeY: g.y };
        }
        case 'ausdruck': {
          const ast = ein(g.ast);
          const vs = variablen(ast);
          if (vs.has('y')) throw fehler('Hier fehlt ein „=“ – z. B. x² + y² = 4.');
          fehlt(pruefen(ast, ['x']));
          if (!vs.has('x')) {
            const w = kompilieren(ast)(werte);
            return { art: 'wert', wert: w, anzeige: g.ast };
          }
          return { art: 'funktion', name: '', ast, anzeige: g.ast, f: alsFunktion(ast, 'x', werte) };
        }
        case 'relation': {
          let { op, links, rechts } = g;
          links = ein(links); rechts = ein(rechts);
          const vl = variablen(links), vr = variablen(rechts);
          const spiegel = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=' };
          // Polarkurve r = f(θ)
          if (op === '=' && links.t === 'var' && links.n === 'r' && !vr.has('x') && !vr.has('y')) {
            fehlt(pruefen(rechts, ['theta']));
            return { art: 'polar', ast: rechts, anzeige: g.rechts, f: alsFunktion(rechts, 'theta', werte) };
          }
          // y = f(x) bzw. f(x) = y
          if (links.t === 'var' && links.n === 'y' && !vr.has('y')) {
            fehlt(pruefen(rechts, ['x']));
            return op === '=' ? { art: 'funktion', name: '', ast: rechts, anzeige: g.rechts, f: alsFunktion(rechts, 'x', werte) }
              : { art: 'ungleichung', richtung: 'y', op, ast: rechts, anzeige: g.rechts, f: alsFunktion(rechts, 'x', werte) };
          }
          if (rechts.t === 'var' && rechts.n === 'y' && !vl.has('y')) {
            fehlt(pruefen(links, ['x']));
            return op === '=' ? { art: 'funktion', name: '', ast: links, anzeige: g.links, f: alsFunktion(links, 'x', werte) }
              : { art: 'ungleichung', richtung: 'y', op: spiegel[op], ast: links, anzeige: g.links, f: alsFunktion(links, 'x', werte) };
          }
          // x = g(y) (z. B. senkrechte Gerade x = 3)
          if (links.t === 'var' && links.n === 'x' && !vr.has('x')) {
            fehlt(pruefen(rechts, ['y']));
            return op === '=' ? { art: 'senkrecht', ast: rechts, anzeige: g.rechts, f: alsFunktion(rechts, 'y', werte) }
              : { art: 'ungleichung', richtung: 'x', op, ast: rechts, anzeige: g.rechts, f: alsFunktion(rechts, 'y', werte) };
          }
          if (rechts.t === 'var' && rechts.n === 'x' && !vl.has('x')) {
            fehlt(pruefen(links, ['y']));
            return op === '=' ? { art: 'senkrecht', ast: links, anzeige: g.links, f: alsFunktion(links, 'y', werte) }
              : { art: 'ungleichung', richtung: 'x', op: spiegel[op], ast: links, anzeige: g.links, f: alsFunktion(links, 'y', werte) };
          }
          const diff = B('-', links, rechts);
          const vs = variablen(diff);
          fehlt(pruefen(diff, ['x', 'y']));
          if (!vs.has('x') && !vs.has('y')) {
            // Gleichung ohne Variable: wahr oder falsch
            const l = kompilieren(links)(werte), r = kompilieren(rechts)(werte);
            const wahr = { '=': Math.abs(l - r) < 1e-9 * Math.max(1, Math.abs(l)), '<': l < r, '>': l > r, '<=': l <= r, '>=': l >= r }[op];
            return { art: 'aussage', wahr, links: l, rechts: r };
          }
          const c = kompilieren(diff);
          const s = { ...werte };
          const fxy = (x, y) => { s.x = x; s.y = y; return c(s); };
          if (op === '=') {
            // Gleichung nur in x (z. B. x² = 4): als Lösungsmenge – senkrechte Linien
            return { art: 'gleichung', ast: diff, f: fxy, nurX: !vs.has('y'), nurY: !vs.has('x'), anzeigeL: g.links, anzeigeR: g.rechts };
          }
          return { art: 'ungleichung', richtung: 'allg', op, ast: diff, f: fxy, anzeigeL: g.links, anzeigeR: g.rechts };
        }
        default: throw fehler('Unbekannt.');
      }
    });
  }

  /** Parameterwerte als Zahlen in einen Baum einsetzen (für die exakte Untersuchung). */
  function werteEinsetzen(ast, werte) {
    let a = ast;
    for (const [n, w] of Object.entries(werte)) if (enthaelt(a, n)) a = ersetzen(a, n, { t: 'zahl', q: qAusZahl(w, 1000) });
    return a;
  }

  // ================================================================ Kurvendiskussion als Markdown (für Chat, Fusion, Kopieren)

  function diskussionMarkdown(u, name = 'f') {
    const v = u.v || 'x';
    const z = [];
    const fx = `${name}(${v})`;
    const T = (x) => '$' + x + '$';
    const punkt = (x, y) => `(${erkennen(x).text} | ${erkennen(y).text})`;
    const ptex = (x, y) => `\\left(${erkennen(x).tex}\\,\\middle|\\,${erkennen(y).tex}\\right)`;
    z.push(`**Funktion:** ${T(`${name}(${v})=${tex(u.ast)}`)}`);
    if (u.ableitungen[0]) z.push(`**Ableitungen:** ${T(`${name}'(${v})=${tex(u.ableitungen[0])}`)}` + (u.ableitungen[1] ? `, ${T(`${name}''(${v})=${tex(u.ableitungen[1])}`)}` : ''));
    z.push(`**Definitionsbereich:** ${T('D=' + u.definition.tex)}`);
    z.push(`**Symmetrie:** ${u.symmetrie === 'achse' ? 'achsensymmetrisch zur y-Achse' : u.symmetrie === 'punkt' ? 'punktsymmetrisch zum Ursprung' : 'keine einfache Symmetrie'}`);
    if (u.yAchse !== null) z.push(`**Schnittpunkt mit der y-Achse:** ${T(`S_y${ptex(0, u.yAchse)}`)}`);
    z.push(`**Nullstellen:** ${u.nullstellen.length ? u.nullstellen.map((r) => T(`${v}${wertTex(r.x)}`) + (r.vzw ? '' : ' (berührt die x-Achse)')).join(', ') : 'keine'}`);
    z.push(`**Extrempunkte:** ${u.extrema.length ? u.extrema.map((e) => `${e.art === 'hoch' ? 'Hochpunkt' : 'Tiefpunkt'} ${T(ptex(e.x, e.y))}${e.knick ? ' (Knick)' : ''}`).join(', ') : 'keine'}`);
    z.push(`**Wendepunkte:** ${u.wendepunkte.length ? u.wendepunkte.map((w) => `${w.sattel ? 'Sattelpunkt' : 'Wendepunkt'} ${T(ptex(w.x, w.y))}`).join(', ') : 'keine'}`);
    if (u.monotonie.length) z.push(`**Monotonie:** ${u.monotonie.map((m) => `${m.art === 'steigend' ? 'steigt' : m.art === 'fallend' ? 'fällt' : 'konstant'} für ${intervallText(m, u)}`).join('; ')}`);
    if (u.kruemmung.length) z.push(`**Krümmung:** ${u.kruemmung.map((m) => `${m.art === 'links' ? 'linksgekrümmt' : m.art === 'rechts' ? 'rechtsgekrümmt' : 'ohne Krümmung'} für ${intervallText(m, u)}`).join('; ')}`);
    z.push(`**Verhalten im Unendlichen:** ${grenzText(u.unendlich.minus, '-\\infty', fx)}, ${grenzText(u.unendlich.plus, '+\\infty', fx)}`);
    if (u.asymptoten.length) z.push(`**Asymptoten:** ${u.asymptoten.map((a) => a.art === 'senkrecht' ? `senkrecht ${T(`x=${erkennen(a.x).tex}`)} (Polstelle)` : a.art === 'waagerecht' ? `waagerecht ${T(`y=${erkennen(a.y).tex}`)}` : `schief ${T(`y=${tex(vereinfachen(B('+', B('*', Z(a.m), V('x')), Z(a.b))))}`)}`).join(', ')}`);
    if (u.luecken.some((l) => l.art === 'hebbar')) z.push(`**Hebbare Lücken:** ${u.luecken.filter((l) => l.art === 'hebbar').map((l) => T(`x=${erkennen(l.x).tex}`)).join(', ')}`);
    if (!u.vollstaendig) z.push(`*Untersucht für ${zahlKurz(u.von)} ≤ ${v} ≤ ${zahlKurz(u.bis)}.*`);
    void punkt;
    return z.join('\n\n');
  }
  function intervallText(m, u) {
    const l = m.l <= u.von + 1e-9 ? (u.vollstaendig ? '−∞' : '…') : erkennen(m.l).text;
    const r = m.r >= u.bis - 1e-9 ? (u.vollstaendig ? '∞' : '…') : erkennen(m.r).text;
    if (l === '…' && r === '…') return 'den ganzen untersuchten Bereich';
    if (l === '…') return `… < x < ${r}`;
    if (r === '…') return `${l} < x < …`;
    if (l === '−∞' && r === '∞') return 'alle x';
    if (l === '−∞') return `x < ${r}`;
    if (r === '∞') return `x > ${l}`;
    return `${l} < x < ${r}`;
  }
  function grenzText(g, richtung, fx) {
    const pfeil = `\\text{für } x\\to ${richtung}`;
    switch (g.art) {
      case 'plus': return `$${fx}\\to+\\infty$ ${'$' + pfeil + '$'}`;
      case 'minus': return `$${fx}\\to-\\infty$ ${'$' + pfeil + '$'}`;
      case 'wert': return `$${fx}\\to ${erkennen(g.y).tex}$ $${pfeil}$`;
      case 'schief': return `$${fx}\\to ${g.richtung === 'plus' ? '+' : '-'}\\infty$ $${pfeil}$ (schiefe Asymptote)`;
      case 'schwankt': return `schwankt $${pfeil}$ (kein Grenzwert)`;
      case 'unklar': return `kein eindeutiges Verhalten erkennbar $${pfeil}$`;
      default: return `nicht definiert $${pfeil}$`;
    }
  }

  return {
    // Lesen und Bäume
    lesen, normalisieren, einordnen, blattDeuten, bereichLesen, tupelTeilen, einsetzen, ersetzen, enthaelt, variablen,
    // Rechnen
    kompilieren, alsFunktion, ableiten, vereinfachen, alsPolynom, polynomAst, werteEinsetzen,
    // Ausgeben
    text, tex, zahlKurz, erkennen, wertText, wertTex,
    // Numerik und Untersuchung
    nullstellen, vorzeichenwechsel, integral, flaeche, untersuchen, diskussionMarkdown,
    // Aufgaben
    steckbrief, regression,
    // Bausteine (für Tests und die Oberfläche)
    Z, V, K, B, F, q, qf, qAusZahl,
  };
})();
