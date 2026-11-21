'use strict';
/*
 * Omega – die Rechenarbeit (ohne Oberfläche, darum einzeln testbar):
 *  - Kellerautomat (nichtdeterministisch, ε-Übergänge, Annahme per Endzustand oder leerem Keller) – Breitensuche über
 *    Konfigurationen, mit Weg zur Annahme bzw. dem weitesten Versuch
 *  - Turingmaschine (ein Band, L/R/N), Schritt für Schritt
 *  - kontextfreie Grammatik: lesen, Chomsky-Normalform mit allen Zwischenschritten, CYK mit Tabelle und Ableitungsbaum,
 *    kurze Wörter aufzählen
 */
const Maschinen = (() => {
  const EPS = 'ε';
  const LEER = '□';
  const zeichenVon = (w) => {
    const s = String(w || '').replace(/\s+/g, '');
    return s === EPS || s.toLowerCase() === 'eps' ? [] : [...s];
  };
  const name = (A, id) => (A.zustaende.find((q) => q.id === id) || { name: '?' }).name;

  // ================================================================== Kellerautomat

  /** „a, X → YX“ bzw. „ε, ε → #“ lesen: {lesen, pop, push} */
  function kellerRegelLesen(t) {
    const m = String(t).replace(/->/g, '→').match(/^\s*([^,→]*)\s*,\s*([^,→]*)\s*→\s*(.*)$/);
    if (!m) return null;
    const norm = (x) => { x = x.trim(); return !x || /^(ε|eps|λ)$/i.test(x) ? EPS : x; };
    const lesen = norm(m[1]);
    const pop = norm(m[2]);
    const push = norm(m[3]).replace(/\s+/g, '');
    if (lesen !== EPS && [...lesen].length !== 1) return null;
    if (pop !== EPS && [...pop].length !== 1) return null;
    return { lesen, pop, push: push === EPS ? EPS : push };
  }
  const kellerRegelText = (r) => `${r.lesen}, ${r.pop} → ${r.push}`;

  /**
   * Lauf eines Kellerautomaten. A: {zustaende, uebergaenge: [{von, nach, regeln: [{lesen, pop, push}]}], startsymbol,
   * annahme: 'ende'|'leer'}. Der Keller ist ein Array, oben = letztes Element; push „YX“ legt X und dann Y oben drauf.
   * Liefert {akzeptiert, weg: [{q, gelesen, keller, regel}], grund, durchsucht}.
   */
  function kellerLauf(A, wort, { maxKonfig = 20000, maxKeller = 80 } = {}) {
    const zeichen = zeichenVon(wort);
    const start = A.zustaende.find((q) => q.start);
    if (!start) return { akzeptiert: false, weg: [], grund: 'Es gibt keinen Startzustand.', durchsucht: 0 };
    const ende = new Set(A.zustaende.filter((q) => q.ende).map((q) => q.id));
    const anfang = { q: start.id, i: 0, keller: A.startsymbol ? [A.startsymbol] : [], vor: null, regel: null };
    const schlange = [anfang];
    const gesehen = new Set();
    let weitester = anfang;
    let n = 0;
    const weg = (c) => {
      const l = [];
      for (let x = c; x; x = x.vor) l.push({ q: x.q, gelesen: x.i, keller: x.keller.slice(), regel: x.regel });
      return l.reverse();
    };
    while (schlange.length) {
      const c = schlange.shift();
      const schl = `${c.q}|${c.i}|${c.keller.join('\u0001')}`;
      if (gesehen.has(schl)) continue;
      gesehen.add(schl);
      if (++n > maxKonfig) {
        return { akzeptiert: false, weg: weg(weitester), grund: 'Zu viele Möglichkeiten – die Suche wurde abgebrochen (läuft der Automat vielleicht endlos mit ε-Übergängen?).', durchsucht: n, abgebrochen: true };
      }
      if (c.i > weitester.i || (c.i === weitester.i && c.keller.length < weitester.keller.length)) weitester = c;
      if (c.i === zeichen.length && (A.annahme === 'leer' ? c.keller.length === 0 : ende.has(c.q))) {
        const w = weg(c);
        return { akzeptiert: true, weg: w, grund: A.annahme === 'leer' ? 'Wort ganz gelesen und Keller leer.' : `Wort ganz gelesen, Endzustand ${name(A, c.q)} erreicht.`, durchsucht: n };
      }
      for (const u of A.uebergaenge) {
        if (u.von !== c.q) continue;
        for (const r of u.regeln) {
          let i = c.i;
          if (r.lesen !== EPS) {
            if (zeichen[i] !== r.lesen) continue;
            i++;
          }
          let keller = c.keller;
          if (r.pop !== EPS) {
            if (keller[keller.length - 1] !== r.pop) continue;
            keller = keller.slice(0, -1);
          } else keller = keller.slice();
          if (r.push !== EPS) keller.push(...[...r.push].reverse());
          if (keller.length > maxKeller) continue;
          schlange.push({ q: u.nach, i, keller, vor: c, regel: { ...r, von: u.von, nach: u.nach } });
        }
      }
    }
    const w = weg(weitester);
    const gelesen = weitester.i;
    let grund;
    if (gelesen < zeichen.length) grund = `Kein Weg liest das ganze Wort – spätestens bei „${zeichen[gelesen]}“ (Zeichen ${gelesen + 1}) geht es nicht weiter.`;
    else grund = A.annahme === 'leer' ? 'Das Wort lässt sich lesen, aber nie mit leerem Keller.' : 'Das Wort lässt sich lesen, aber kein Weg endet in einem Endzustand.';
    return { akzeptiert: false, weg: w, grund, durchsucht: n };
  }

  // ================================================================== Turingmaschine

  /** „a → b, R“ bzw. „□ → □, L“ lesen: {lesen, schreiben, richtung} */
  function tmRegelLesen(t) {
    const m = String(t).replace(/->/g, '→').match(/^\s*(\S)\s*→\s*(\S)\s*,?\s*([LRNlrn<>-])\s*$/);
    if (!m) return null;
    const leer = (x) => (x === '_' || x === '□' ? LEER : x);
    const r = { L: 'L', l: 'L', '<': 'L', R: 'R', r: 'R', '>': 'R', N: 'N', n: 'N', '-': 'N' }[m[3]];
    return { lesen: leer(m[1]), schreiben: leer(m[2]), richtung: r };
  }
  const tmRegelText = (r) => `${r.lesen} → ${r.schreiben}, ${r.richtung}`;

  /** Lauf einer Turingmaschine (deterministisch; bei mehreren passenden Regeln gilt die erste). */
  function tmLauf(T, wort, { maxSchritte = 3000 } = {}) {
    const start = T.zustaende.find((q) => q.start);
    if (!start) return { akzeptiert: false, schritte: [], grund: 'Es gibt keinen Startzustand.' };
    const ende = new Set(T.zustaende.filter((q) => q.ende).map((q) => q.id));
    const band = new Map();
    zeichenVon(wort).forEach((c, i) => band.set(i, c));
    let kopf = 0;
    let q = start.id;
    const bild = () => {
      const pos = [...band.keys(), kopf];
      const lo = Math.min(...pos);
      const hi = Math.max(...pos);
      let s = '';
      for (let i = lo; i <= hi; i++) s += band.get(i) || LEER;
      return { q, kopf: kopf - lo, band: s };
    };
    const schritte = [{ ...bild(), regel: null }];
    const warn = new Set();
    for (let n = 0; n < maxSchritte; n++) {
      if (ende.has(q)) return { akzeptiert: true, schritte, grund: `Endzustand ${name(T, q)} erreicht – die Maschine hält und akzeptiert.`, warnungen: [...warn] };
      const zeichen = band.get(kopf) || LEER;
      const passend = [];
      for (const u of T.uebergaenge) if (u.von === q) for (const r of u.regeln) if (r.lesen === zeichen) passend.push({ ...r, von: u.von, nach: u.nach });
      if (passend.length > 1) warn.add(`${name(T, q)} hat für „${zeichen}“ mehrere Regeln – die erste gilt.`);
      if (!passend.length) {
        return { akzeptiert: false, schritte, grund: `In ${name(T, q)} gibt es keine Regel für „${zeichen}“ – die Maschine hält und verwirft.`, warnungen: [...warn] };
      }
      const r = passend[0];
      if (r.schreiben === LEER) band.delete(kopf); else band.set(kopf, r.schreiben);
      kopf += r.richtung === 'L' ? -1 : r.richtung === 'R' ? 1 : 0;
      q = r.nach;
      schritte.push({ ...bild(), regel: r });
    }
    return { akzeptiert: false, schritte, grund: `Nach ${maxSchritte} Schritten noch nicht angehalten – läuft die Maschine vielleicht endlos?`, endlos: true, warnungen: [...warn] };
  }

  // ================================================================== Grammatiken

  /**
   * Grammatik lesen: je Zeile „S → aSb | ab | ε“ (auch „->“, „::=“). Nichtterminale: Großbuchstabe mit Ziffern,
   * Strichen oder _Index (S, A1, B', T_a) oder <Name>. Alles andere sind Terminale (je Zeichen eines). ε = leer.
   * → {start, regeln: [{links, rechts: [..]}], nt: Set, t: Set}
   */
  function grammatikLesen(text) {
    const regeln = [];
    const nt = new Set();
    let start = null;
    const zeilen = String(text).split('\n').map((z) => z.replace(/#.*$/, '').trim()).filter(Boolean);
    if (!zeilen.length) throw new Error('Noch keine Regeln – z. B. „S → aSb | ε“.');
    for (const [nr, z] of zeilen.entries()) {
      const m = z.match(/^(<[^>]+>|[A-Z][A-Za-z]*?[0-9']*(?:_[A-Za-z0-9]+)?)\s*(?:→|->|::=)\s*(.*)$/);
      if (!m) throw new Error(`Zeile ${nr + 1}: Erwarte „A → …“ (links ein Nichtterminal wie S oder A1).`);
      const links = m[1];
      nt.add(links);
      if (!start) start = links;
      for (const alt of m[2].split('|')) regeln.push({ links, rechts: zerlegen(alt.trim()) });
    }
    // Nichtterminale rechts, die nie links stehen, sind trotzdem Nichtterminale (nur ohne Regeln)
    const t = new Set();
    for (const r of regeln) for (const s of r.rechts) if (istNt(s)) nt.add(s); else t.add(s);
    return { start, regeln: eindeutig(regeln), nt, t };
  }
  function istNt(s) {
    return /^(<[^>]+>|[A-Z][A-Za-z]*?[0-9']*(?:_[A-Za-z0-9]+)?)$/.test(s);
  }
  function zerlegen(s) {
    if (!s || /^(ε|eps|epsilon|λ)$/i.test(s)) return [];
    const aus = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '<') {
        const e = s.indexOf('>', i);
        if (e > i) { aus.push(s.slice(i, e + 1)); i = e + 1; continue; }
      }
      if (/[A-Z]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[0-9']/.test(s[j])) j++;
        if (s[j] === '_' && /[A-Za-z0-9]/.test(s[j + 1] || '')) { j++; while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++; }
        aus.push(s.slice(i, j));
        i = j;
        continue;
      }
      if (c === 'ε') { i++; continue; }
      aus.push(c);
      i++;
    }
    return aus;
  }
  function eindeutig(regeln) {
    const s = new Set();
    return regeln.filter((r) => { const k = r.links + '→' + r.rechts.join(' '); if (s.has(k)) return false; s.add(k); return true; });
  }
  function grammatikText(G) {
    const nach = new Map();
    for (const r of G.regeln) {
      if (!nach.has(r.links)) nach.set(r.links, []);
      nach.get(r.links).push(r.rechts.length ? r.rechts.join(r.rechts.some((x) => x.length > 1) ? ' ' : '') : EPS);
    }
    const reihe = [G.start, ...[...nach.keys()].filter((k) => k !== G.start)];
    return reihe.filter((k) => nach.has(k)).map((k) => `${k} → ${nach.get(k).join(' | ')}`).join('\n');
  }
  const kopie = (G) => ({ start: G.start, regeln: G.regeln.map((r) => ({ links: r.links, rechts: r.rechts.slice() })), nt: new Set(G.nt), t: new Set(G.t) });
  function frei(G, basis) {
    let i = 0;
    let n = basis;
    while (G.nt.has(n)) n = `${basis}${++i}`;
    G.nt.add(n);
    return n;
  }

  /** Nur Nichtterminale behalten, die etwas erzeugen und vom Start aus erreichbar sind. */
  function nutzlosWeg(G) {
    const erzeugend = new Set();
    let mehr = true;
    while (mehr) {
      mehr = false;
      for (const r of G.regeln) {
        if (!erzeugend.has(r.links) && r.rechts.every((s) => !G.nt.has(s) || erzeugend.has(s))) { erzeugend.add(r.links); mehr = true; }
      }
    }
    let regeln = G.regeln.filter((r) => erzeugend.has(r.links) && r.rechts.every((s) => !G.nt.has(s) || erzeugend.has(s)));
    const erreicht = new Set([G.start]);
    mehr = true;
    while (mehr) {
      mehr = false;
      for (const r of regeln) if (erreicht.has(r.links)) for (const s of r.rechts) if (G.nt.has(s) && !erreicht.has(s)) { erreicht.add(s); mehr = true; }
    }
    regeln = regeln.filter((r) => erreicht.has(r.links));
    return { ...G, regeln };
  }

  /** Chomsky-Normalform mit Zwischenschritten (START, TERM, BIN, DEL, UNIT, aufräumen). */
  function chomsky(G0) {
    const schritte = [];
    let G = kopie(G0);
    const notiere = (titel, text) => schritte.push({ titel, text, grammatik: grammatikText(G) });
    notiere('Ausgangsgrammatik', 'So, wie du sie eingegeben hast.');
    // START
    if (G.regeln.some((r) => r.rechts.includes(G.start))) {
      const s0 = frei(G, G.start + '0');
      G.regeln.unshift({ links: s0, rechts: [G.start] });
      G.start = s0;
      notiere('1. Neues Startsymbol', `${s0} → ${G0.start}, weil ${G0.start} auch rechts vorkommt.`);
    } else notiere('1. Neues Startsymbol', 'Nicht nötig – das Startsymbol steht nie rechts.');
    // TERM
    const fuer = new Map();
    let ersetzt = 0;
    for (const r of G.regeln) {
      if (r.rechts.length < 2) continue;
      r.rechts = r.rechts.map((s) => {
        if (G.nt.has(s)) return s;
        if (!fuer.has(s)) {
          const namen = { '+': 'plus', '-': 'minus', '*': 'mal', '/': 'durch', '(': 'auf', ')': 'zu', '[': 'eauf', ']': 'ezu', '{': 'gauf', '}': 'gzu', ',': 'komma', '.': 'punkt', '=': 'gleich', '<': 'kleiner', '>': 'groesser', '#': 'raute' };
          const n = frei(G, 'T_' + (/^[A-Za-z0-9]$/.test(s) ? s : namen[s] || 'x'));
          fuer.set(s, n);
        }
        ersetzt++;
        return fuer.get(s);
      });
    }
    for (const [t, n] of fuer) G.regeln.push({ links: n, rechts: [t] });
    notiere('2. Terminale auslagern', ersetzt ? `In langen Regeln steht jedes Terminal a jetzt für ein eigenes Nichtterminal (${[...fuer].map(([t, n]) => `${n} → ${t}`).join(', ')}).` : 'Nicht nötig.');
    // BIN
    const neu = [];
    let gebrochen = 0;
    for (const r of G.regeln) {
      if (r.rechts.length <= 2) { neu.push(r); continue; }
      gebrochen++;
      let links = r.links;
      const rest = r.rechts.slice();
      while (rest.length > 2) {
        const h = frei(G, 'X');
        neu.push({ links, rechts: [rest.shift(), h] });
        links = h;
      }
      neu.push({ links, rechts: rest });
    }
    G.regeln = neu;
    notiere('3. Lange Regeln aufteilen', gebrochen ? `${gebrochen} Regel(n) mit mehr als zwei Symbolen in Ketten aus je zwei zerlegt.` : 'Nicht nötig.');
    // DEL
    const nullbar = new Set();
    let mehr = true;
    while (mehr) {
      mehr = false;
      for (const r of G.regeln) if (!nullbar.has(r.links) && r.rechts.every((s) => nullbar.has(s))) { nullbar.add(r.links); mehr = true; }
    }
    const mitDel = [];
    for (const r of G.regeln) {
      const pos = r.rechts.map((s, i) => (nullbar.has(s) ? i : -1)).filter((i) => i >= 0);
      for (let m = 0; m < 1 << pos.length; m++) {
        const weg = new Set(pos.filter((_, k) => m & (1 << k)));
        const rechts = r.rechts.filter((_, i) => !weg.has(i));
        if (!rechts.length && r.links !== G.start) continue;
        mitDel.push({ links: r.links, rechts });
      }
    }
    G.regeln = eindeutig(mitDel.filter((r) => r.rechts.length || r.links === G.start));
    notiere('4. ε-Regeln entfernen', nullbar.size ? `Auf ε ableitbar: ${[...nullbar].join(', ')}. Jede Regel gibt es jetzt auch ohne diese Symbole; ε bleibt höchstens beim Startsymbol.` : 'Nicht nötig – nichts ist auf ε ableitbar.');
    // UNIT
    const paare = new Map([...G.nt].map((a) => [a, new Set([a])]));
    mehr = true;
    while (mehr) {
      mehr = false;
      for (const r of G.regeln) {
        if (r.rechts.length === 1 && G.nt.has(r.rechts[0])) {
          for (const [, ziele] of paare) {
            if (ziele.has(r.links) && !ziele.has(r.rechts[0])) { ziele.add(r.rechts[0]); mehr = true; }
          }
        }
      }
    }
    const ohneUnit = [];
    let einheiten = 0;
    for (const a of G.nt) {
      for (const b of paare.get(a)) {
        for (const r of G.regeln) {
          if (r.links !== b) continue;
          if (r.rechts.length === 1 && G.nt.has(r.rechts[0])) { einheiten++; continue; }
          ohneUnit.push({ links: a, rechts: r.rechts.slice() });
        }
      }
    }
    G.regeln = eindeutig(ohneUnit);
    notiere('5. Kettenregeln entfernen', einheiten ? 'Regeln der Form A → B durch die Regeln von B ersetzt.' : 'Nicht nötig.');
    G = nutzlosWeg(G);
    notiere('6. Aufräumen – Chomsky-Normalform', 'Nutzlose Nichtterminale entfernt. Jede Regel hat jetzt die Form A → BC, A → a (oder S → ε).');
    return { grammatik: G, schritte };
  }

  /** CYK: Tabelle tab[l][i] = Nichtterminale, die w[i … i+l-1] erzeugen; Ableitungsbaum bei Annahme. */
  function cyk(G, wort) {
    const w = zeichenVon(wort);
    const n = w.length;
    if (!n) {
      const eps = G.regeln.some((r) => r.links === G.start && !r.rechts.length);
      return { akzeptiert: eps, tabelle: [], wort: w, baum: eps ? { s: G.start, kinder: [{ s: EPS, kinder: [] }] } : null };
    }
    const tab = Array.from({ length: n + 1 }, () => Array.from({ length: n }, () => new Map()));
    for (let i = 0; i < n; i++) {
      for (const r of G.regeln) if (r.rechts.length === 1 && r.rechts[0] === w[i]) tab[1][i].set(r.links, null);
    }
    for (let l = 2; l <= n; l++) {
      for (let i = 0; i + l <= n; i++) {
        for (let k = 1; k < l; k++) {
          const links = tab[k][i];
          const rechts = tab[l - k][i + k];
          if (!links.size || !rechts.size) continue;
          for (const r of G.regeln) {
            if (r.rechts.length !== 2 || tab[l][i].has(r.links)) continue;
            if (links.has(r.rechts[0]) && rechts.has(r.rechts[1])) tab[l][i].set(r.links, [k, r.rechts[0], r.rechts[1]]);
          }
        }
      }
    }
    const baum = (a, l, i) => {
      const zurueck = tab[l][i].get(a);
      if (!zurueck) return { s: a, kinder: [{ s: w[i], kinder: [] }] };
      const [k, b, c] = zurueck;
      return { s: a, kinder: [baum(b, k, i), baum(c, l - k, i + k)] };
    };
    const ok = tab[n][0].has(G.start);
    return {
      akzeptiert: ok,
      wort: w,
      tabelle: tab.map((zeile) => zeile.map((m) => [...m.keys()])),
      baum: ok ? baum(G.start, n, 0) : null,
    };
  }

  /** Kurze Wörter der Grammatik (Breitensuche über Linksableitungen). */
  function woerter(G, { maxLaenge = 6, maxAnzahl = 20, maxSchritte = 20000 } = {}) {
    const aus = new Set();
    const schlange = [[G.start]];
    const gesehen = new Set();
    let n = 0;
    while (schlange.length && aus.size < maxAnzahl && n++ < maxSchritte) {
      const f = schlange.shift();
      const i = f.findIndex((s) => G.nt.has(s));
      if (i < 0) { aus.add(f.join('')); continue; }
      if (f.filter((s) => !G.nt.has(s)).length > maxLaenge) continue;
      for (const r of G.regeln) {
        if (r.links !== f[i]) continue;
        const neu = [...f.slice(0, i), ...r.rechts, ...f.slice(i + 1)];
        if (neu.length > maxLaenge * 3 + 4) continue;
        const k = neu.join('\u0001');
        if (gesehen.has(k)) continue;
        gesehen.add(k);
        schlange.push(neu);
      }
    }
    return [...aus].sort((a, b) => a.length - b.length || a.localeCompare(b));
  }

  return { EPS, LEER, zeichenVon, kellerRegelLesen, kellerRegelText, kellerLauf, tmRegelLesen, tmRegelText, tmLauf,
    grammatikLesen, grammatikText, chomsky, cyk, woerter };
})();
