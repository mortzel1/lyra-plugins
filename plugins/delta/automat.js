'use strict';
/*
 * Delta – die Rechenarbeit mit endlichen Automaten (ohne Oberfläche, darum auch einzeln testbar):
 * Simulation (DEA und NEA mit ε), Prüfen, regulärer Ausdruck → NEA (Glushkov, ohne ε), Potenzmengenkonstruktion,
 * Minimieren, Äquivalenz mit Gegenbeispiel, Anordnen, Export als TikZ.
 *
 * Ein Automat: { art: 'dea'|'nea', zustaende: [{id, name, x, y, start, ende}], uebergaenge: [{von, nach, zeichen: [..]}],
 *               alphabet: [..] (zusätzliche Zeichen, optional) }
 */
const Automat = (() => {
  const EPS = 'ε';

  // ------------------------------------------------------------ Grundlagen

  /** id → (Zeichen → Menge von ids) */
  function delta(A) {
    const d = new Map(A.zustaende.map((q) => [q.id, new Map()]));
    for (const u of A.uebergaenge) {
      const m = d.get(u.von);
      if (!m || !d.has(u.nach)) continue;
      for (const z of u.zeichen) {
        if (!m.has(z)) m.set(z, new Set());
        m.get(z).add(u.nach);
      }
    }
    return d;
  }
  const startId = (A) => (A.zustaende.find((q) => q.start) || {}).id;
  const name = (A, id) => (A.zustaende.find((q) => q.id === id) || { name: '?' }).name;
  const istEnde = (A, id) => !!(A.zustaende.find((q) => q.id === id) || {}).ende;

  /** Alle Zeichen (ohne ε), sortiert. */
  function alphabet(A) {
    const s = new Set(A.alphabet || []);
    for (const u of A.uebergaenge) for (const z of u.zeichen) if (z !== EPS) s.add(z);
    return [...s].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }

  /** ε-Hülle einer Menge von Zuständen. */
  function huelle(d, menge) {
    const h = new Set(menge);
    const stapel = [...menge];
    while (stapel.length) {
      const q = stapel.pop();
      for (const r of (d.get(q) && d.get(q).get(EPS)) || []) {
        if (!h.has(r)) {
          h.add(r);
          stapel.push(r);
        }
      }
    }
    return h;
  }
  function schritt(d, menge, z) {
    const n = new Set();
    for (const q of menge) for (const r of (d.get(q) && d.get(q).get(z)) || []) n.add(r);
    return huelle(d, n);
  }

  /** Zeichen eines Wortes: jedes Zeichen einzeln; „ε“ oder leer = leeres Wort; Leerzeichen zählen nicht. */
  function zeichenVon(wort) {
    const w = String(wort || '').replace(/\s+/g, '');
    return w === EPS || w.toLowerCase() === 'eps' ? [] : [...w];
  }

  /** Lauf über ein Wort – jeder Schritt mit den aktuellen Zuständen und den benutzten Übergängen. */
  function lauf(A, wort) {
    const d = delta(A);
    const s = startId(A);
    const zeichen = zeichenVon(wort);
    if (s === undefined) return { schritte: [], akzeptiert: false, grund: 'Es gibt keinen Startzustand.', zeichen };
    let menge = huelle(d, [s]);
    const schritte = [{ menge: [...menge], gelesen: 0, zeichen: null, kanten: [] }];
    let fest = null;
    for (let i = 0; i < zeichen.length; i++) {
      const z = zeichen[i];
      const kanten = [];
      const n = new Set();
      for (const q of menge) {
        for (const r of (d.get(q) && d.get(q).get(z)) || []) {
          n.add(r);
          kanten.push([q, r]);
        }
      }
      const vorher = menge;
      menge = huelle(d, n);
      schritte.push({ menge: [...menge], gelesen: i + 1, zeichen: z, kanten });
      if (!menge.size) {
        fest = { z, vorher: [...vorher] };
        break;
      }
    }
    const enden = [...menge].filter((q) => istEnde(A, q));
    const namen = (l) => l.map((q) => name(A, q)).join(', ');
    let grund;
    const S = alphabet(A);
    if (fest && !S.includes(fest.z)) {
      const klein = S.includes(fest.z.toLowerCase()) || S.includes(fest.z.toUpperCase());
      grund = `„${fest.z}“ gehört nicht zum Alphabet Σ = {${S.join(', ')}}${klein ? ' – Groß- und Kleinschreibung zählt' : ''}. Der Automat bleibt stecken.`;
    } else if (fest) grund = `In ${namen(fest.vorher)} gibt es keinen Übergang mit „${fest.z}“ – der Automat bleibt stecken.`;
    else if (enden.length) grund = `Endet in ${namen(enden)} – ${enden.length > 1 ? 'Endzustände' : 'einem Endzustand'}.`;
    else grund = `Endet in ${namen([...menge]) || 'keinem Zustand'} – kein Endzustand.`;
    return { schritte, akzeptiert: !fest && enden.length > 0, grund, zeichen };
  }

  const akzeptiert = (A, wort) => lauf(A, wort).akzeptiert;

  /** Ist es ein (vollständiger) DEA? Mit verständlichen Hinweisen. */
  function pruefen(A) {
    const h = [];
    if (!A.zustaende.length) return { dea: false, vollstaendig: false, hinweise: ['Noch keine Zustände – leg mit dem Kreis-Werkzeug welche an.'] };
    const starts = A.zustaende.filter((q) => q.start);
    if (!starts.length) h.push('Es fehlt ein Startzustand.');
    if (!A.zustaende.some((q) => q.ende)) h.push('Kein Endzustand – so akzeptiert der Automat kein einziges Wort.');
    const d = delta(A);
    const S = alphabet(A);
    let dea = true;
    let vollstaendig = true;
    const fehlend = [];
    for (const q of A.zustaende) {
      const m = d.get(q.id);
      if (m.has(EPS)) {
        dea = false;
        h.push(`${q.name} hat einen ε-Übergang – das darf nur ein NEA.`);
      }
      for (const z of S) {
        const n = m.has(z) ? m.get(z).size : 0;
        if (n > 1) {
          dea = false;
          h.push(`${q.name} hat mit „${z}“ ${n} Übergänge – das darf nur ein NEA.`);
        }
        if (n === 0) {
          vollstaendig = false;
          fehlend.push(`${q.name} mit „${z}“`);
        }
      }
    }
    if (fehlend.length) {
      h.push(`Es fehlen Übergänge (${fehlend.slice(0, 4).join(', ')}${fehlend.length > 4 ? ' …' : ''}) – dort bleibt ein Lauf stecken und das Wort wird abgelehnt.`);
    }
    return { dea, vollstaendig, hinweise: h };
  }

  // ------------------------------------------------------------ Aufräumen, Umbenennen, Anordnen

  function kopie(A) {
    return JSON.parse(JSON.stringify(A));
  }

  /** Nur Zustände behalten, die vom Start aus erreichbar sind (und – mit `tote` – von denen aus ein Endzustand erreichbar ist). */
  function bereinigen(A, { tote = false } = {}) {
    const d = delta(A);
    const s = startId(A);
    if (s === undefined) return kopie(A);
    const erreicht = new Set([s]);
    const stapel = [s];
    while (stapel.length) {
      const q = stapel.pop();
      for (const ziele of d.get(q).values()) for (const r of ziele) if (!erreicht.has(r)) { erreicht.add(r); stapel.push(r); }
    }
    let behalten = erreicht;
    if (tote) {
      // rückwärts von den Endzuständen
      const rueck = new Map(A.zustaende.map((q) => [q.id, []]));
      for (const u of A.uebergaenge) if (rueck.has(u.nach)) rueck.get(u.nach).push(u.von);
      const lebendig = new Set(A.zustaende.filter((q) => q.ende).map((q) => q.id));
      const st = [...lebendig];
      while (st.length) {
        const q = st.pop();
        for (const r of rueck.get(q) || []) if (!lebendig.has(r)) { lebendig.add(r); st.push(r); }
      }
      behalten = new Set([...erreicht].filter((q) => lebendig.has(q) || q === s));
    }
    const B = kopie(A);
    B.zustaende = B.zustaende.filter((q) => behalten.has(q.id));
    B.uebergaenge = B.uebergaenge.filter((u) => behalten.has(u.von) && behalten.has(u.nach));
    return B;
  }

  /** Reihenfolge der Breitensuche ab dem Start (unerreichbare hinten). */
  function reihenfolge(A) {
    const d = delta(A);
    const s = startId(A);
    const S = alphabet(A);
    const seen = new Set();
    const ordnung = [];
    const tiefe = new Map();
    if (s !== undefined) {
      const q = [s];
      seen.add(s);
      tiefe.set(s, 0);
      while (q.length) {
        const x = q.shift();
        ordnung.push(x);
        for (const z of [...S, EPS]) {
          for (const r of [...((d.get(x) && d.get(x).get(z)) || [])].sort()) {
            if (!seen.has(r)) {
              seen.add(r);
              tiefe.set(r, tiefe.get(x) + 1);
              q.push(r);
            }
          }
        }
      }
    }
    const maxT = Math.max(0, ...tiefe.values());
    for (const z of A.zustaende) {
      if (!seen.has(z.id)) {
        ordnung.push(z.id);
        tiefe.set(z.id, maxT + 1);
      }
    }
    return { ordnung, tiefe };
  }

  /** Namen q0, q1, … in Reihenfolge der Breitensuche. Liefert die Zuordnung alt → neu. */
  function umbenennen(A, praefix = 'q') {
    const { ordnung } = reihenfolge(A);
    const zuordnung = {};
    ordnung.forEach((id, i) => {
      const q = A.zustaende.find((x) => x.id === id);
      zuordnung[q.name] = praefix + i;
      q.name = praefix + i;
    });
    return zuordnung;
  }

  /** Schichten nach Abstand vom Start: links der Start, rechts die späten Zustände. */
  function anordnen(A, { abstandX = 190, abstandY = 140, links = 120, mitte = 280 } = {}) {
    const { ordnung, tiefe } = reihenfolge(A);
    const spalten = new Map();
    for (const id of ordnung) {
      const t = tiefe.get(id);
      if (!spalten.has(t)) spalten.set(t, []);
      spalten.get(t).push(id);
    }
    const hoechste = Math.max(1, ...[...spalten.values()].map((l) => l.length));
    const m = Math.max(mitte, 80 + ((hoechste - 1) * abstandY) / 2);
    for (const [t, ids] of spalten) {
      ids.forEach((id, i) => {
        const q = A.zustaende.find((x) => x.id === id);
        q.x = links + t * abstandX;
        q.y = Math.round(m + (i - (ids.length - 1) / 2) * abstandY + (t % 2 && ids.length === 1 ? 0 : 0));
      });
    }
    return A;
  }

  // ------------------------------------------------------------ Regulärer Ausdruck → Syntaxbaum

  /**
   * Erlaubt: Zeichen (Buchstaben, Ziffern …), Klammern, „|“ oder „+“ (Vereinigung), „*“, „⁺“ bzw. „^+“ (mindestens
   * einmal), „?“ (optional), „ε“/„eps“/„λ“, „∅“, „·“ oder „.“ (Verkettung, darf fehlen). `plusIstOder`: „+“ zwischen
   * zwei Ausdrücken heißt „oder“ (wie in vielen Vorlesungen); sonst immer „mindestens einmal“.
   */
  function regexParsen(text, { plusIstOder = true } = {}) {
    const t = [];
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/\s/.test(c)) continue;
      if (c === '(' || c === ')') t.push({ t: c, i });
      else if (c === '|') t.push({ t: 'oder', i });
      else if (c === '*') t.push({ t: 'stern', i });
      else if (c === '⁺') t.push({ t: 'plus', i });
      else if (c === '?') t.push({ t: 'opt', i });
      else if (c === '+') t.push({ t: 'plus?', i });
      else if (c === '·' || c === '.') t.push({ t: 'punkt', i });
      else if (c === '^' && (s[i + 1] === '+' || s[i + 1] === '*')) { t.push({ t: s[i + 1] === '+' ? 'plus' : 'stern', i }); i++; }
      else if (c === 'ε' || c === 'λ') t.push({ t: 'eps', i });
      else if (s.slice(i, i + 7).toLowerCase() === 'epsilon') { t.push({ t: 'eps', i }); i += 6; }
      else if (s.slice(i, i + 3).toLowerCase() === 'eps') { t.push({ t: 'eps', i }); i += 2; }
      else if (c === '∅') t.push({ t: 'leer', i });
      else if (c === '{' && s[i + 1] === '}') { t.push({ t: 'leer', i }); i++; }
      else if (c === '^') throw new Error(`Zeichen ${i + 1}: Nach „^“ erwarte ich + oder *.`);
      else t.push({ t: 'sym', v: c, i });
    }
    const atomStart = (x) => x && (x.t === 'sym' || x.t === 'eps' || x.t === 'leer' || x.t === '(');
    for (let k = 0; k < t.length; k++) {
      if (t[k].t === 'plus?') t[k].t = plusIstOder && k > 0 && atomStart(t[k + 1]) ? 'oder' : 'plus';
    }
    let p = 0;
    const blick = () => t[p];
    const fehler = (was) => new Error(`${blick() ? `Zeichen ${blick().i + 1}` : 'Am Ende'}: ${was}`);
    function oder() {
      let a = folge();
      while (blick() && blick().t === 'oder') {
        p++;
        a = { typ: 'oder', a, b: folge() };
      }
      return a;
    }
    function folge() {
      const teile = [];
      while (blick() && (atomStart(blick()) || blick().t === 'punkt')) {
        if (blick().t === 'punkt') { p++; continue; }
        teile.push(wiederholung());
      }
      if (!teile.length) {
        if (blick() && blick().t === ')' && t[p - 1] && t[p - 1].t === '(') return { typ: 'eps' }; // „()“
        throw fehler('Hier fehlt ein Ausdruck.');
      }
      return teile.reduce((a, b) => ({ typ: 'folge', a, b }));
    }
    function wiederholung() {
      let a = atom();
      while (blick() && ['stern', 'plus', 'opt'].includes(blick().t)) {
        a = { typ: blick().t, a };
        p++;
      }
      return a;
    }
    function atom() {
      const x = blick();
      if (!x) throw fehler('Hier fehlt ein Ausdruck.');
      p++;
      if (x.t === 'sym') return { typ: 'zeichen', z: x.v };
      if (x.t === 'eps') return { typ: 'eps' };
      if (x.t === 'leer') return { typ: 'leer' };
      if (x.t === '(') {
        const a = oder();
        if (!blick() || blick().t !== ')') throw fehler('Es fehlt eine schließende Klammer „)“.');
        p++;
        return a;
      }
      p--;
      throw fehler(`„${s[x.i]}“ steht hier falsch.`);
    }
    if (!t.length) return { typ: 'eps' };
    const baum = oder();
    if (p < t.length) throw fehler(blick().t === ')' ? 'Zu viele schließende Klammern.' : `„${s[blick().i]}“ steht hier falsch.`);
    return baum;
  }

  /** Syntaxbaum wieder als Text (für Anzeigen). */
  function regexText(n, oben = 0) {
    const r = (x, o) => regexText(x, o);
    switch (n.typ) {
      case 'zeichen': return n.z;
      case 'eps': return EPS;
      case 'leer': return '∅';
      case 'oder': { const s = `${r(n.a, 1)} | ${r(n.b, 1)}`; return oben > 1 ? `(${s})` : s; }
      case 'folge': { const s = `${r(n.a, 2)}${r(n.b, 2)}`; return oben > 2 ? `(${s})` : s; }
      default: return `${r(n.a, 3)}${{ stern: '*', plus: '⁺', opt: '?' }[n.typ]}`;
    }
  }

  // ------------------------------------------------------------ Glushkov: regulärer Ausdruck → NEA ohne ε

  function glushkov(baum) {
    const pos = [];
    (function lin(n) {
      if (n.typ === 'zeichen') { n.p = pos.length; pos.push(n.z); } else if (n.a) { lin(n.a); if (n.b) lin(n.b); }
    })(baum);
    const folgt = pos.map(() => new Set());
    const vereint = (a, b) => new Set([...a, ...b]);
    function info(n) {
      switch (n.typ) {
        case 'zeichen': return { leer: false, erste: new Set([n.p]), letzte: new Set([n.p]) };
        case 'eps': return { leer: true, erste: new Set(), letzte: new Set() };
        case 'leer': return { leer: false, erste: new Set(), letzte: new Set(), nichts: true };
        case 'oder': {
          const a = info(n.a);
          const b = info(n.b);
          return { leer: a.leer || b.leer, erste: vereint(a.erste, b.erste), letzte: vereint(a.letzte, b.letzte) };
        }
        case 'folge': {
          const a = info(n.a);
          const b = info(n.b);
          if (!a.nichts && !b.nichts) for (const x of a.letzte) for (const y of b.erste) folgt[x].add(y);
          if (a.nichts || b.nichts) return { leer: false, erste: new Set(), letzte: new Set(), nichts: true };
          return {
            leer: a.leer && b.leer,
            erste: a.leer ? vereint(a.erste, b.erste) : a.erste,
            letzte: b.leer ? vereint(a.letzte, b.letzte) : b.letzte,
          };
        }
        case 'stern':
        case 'plus':
        case 'opt': {
          const a = info(n.a);
          if (n.typ !== 'opt') for (const x of a.letzte) for (const y of a.erste) folgt[x].add(y);
          if (a.nichts) return n.typ === 'plus' ? a : { leer: true, erste: new Set(), letzte: new Set() };
          return { leer: n.typ === 'plus' ? a.leer : true, erste: a.erste, letzte: a.letzte };
        }
      }
      throw new Error('Unbekannter Ausdruck');
    }
    const i = info(baum);
    const A = { art: 'nea', zustaende: [], uebergaenge: [] };
    A.zustaende.push({ id: 'g0', name: 'p0', x: 0, y: 0, start: true, ende: i.leer });
    pos.forEach((z, p) => A.zustaende.push({ id: 'g' + (p + 1), name: 'p' + (p + 1), x: 0, y: 0, start: false, ende: i.letzte.has(p) }));
    const kante = (von, nach, z) => {
      const u = A.uebergaenge.find((x) => x.von === von && x.nach === nach);
      if (u) { if (!u.zeichen.includes(z)) u.zeichen.push(z); } else A.uebergaenge.push({ von, nach, zeichen: [z] });
    };
    for (const p of i.erste) kante('g0', 'g' + (p + 1), pos[p]);
    folgt.forEach((nach, p) => { for (const q of nach) kante('g' + (p + 1), 'g' + (q + 1), pos[q]); });
    A.alphabet = [...new Set(pos)];
    return A;
  }

  // ------------------------------------------------------------ Potenzmengenkonstruktion (NEA → DEA)

  /**
   * `falle`: fehlende Übergänge führen in den Fallenzustand ∅ (vollständiger DEA). `mengenNamen`: Zustände heißen
   * wie die Mengen („{q0,q1}“), sonst q0, q1, … `zeichen`: Alphabet (sonst das des Automaten).
   * Liefert {automat, tabelle: [{menge, ende, ziele: {z: menge}}]}.
   */
  function teilmengen(A, { falle = true, mengenNamen = true, zeichen = null } = {}) {
    const d = delta(A);
    const S = zeichen || alphabet(A);
    const s = startId(A);
    const B = { art: 'dea', zustaende: [], uebergaenge: [], alphabet: S.slice() };
    if (s === undefined) return { automat: B, tabelle: [] };
    const ordnung = A.zustaende.map((q) => q.id);
    const schl = (m) => [...m].sort((a, b) => ordnung.indexOf(a) - ordnung.indexOf(b)).join('|');
    const mengenText = (m) => (m.size ? `{${[...m].sort((a, b) => ordnung.indexOf(a) - ordnung.indexOf(b)).map((q) => name(A, q)).join(',')}}` : '∅');
    const neu = new Map();
    const liste = [];
    const tabelle = [];
    const anlegen = (m) => {
      const k = schl(m);
      if (!neu.has(k)) {
        const id = 'm' + neu.size;
        neu.set(k, id);
        liste.push(m);
        B.zustaende.push({ id, name: mengenNamen ? mengenText(m) : id, x: 0, y: 0, start: neu.size === 1, ende: [...m].some((q) => istEnde(A, q)) });
      }
      return neu.get(k);
    };
    anlegen(huelle(d, [s]));
    for (let i = 0; i < liste.length; i++) {
      const m = liste[i];
      const zeile = { menge: mengenText(m), ende: [...m].some((q) => istEnde(A, q)), ziele: {} };
      for (const z of S) {
        const t = schritt(d, m, z);
        zeile.ziele[z] = mengenText(t);
        if (!t.size && !falle) continue;
        const von = neu.get(schl(m));
        const nach = anlegen(t);
        const u = B.uebergaenge.find((x) => x.von === von && x.nach === nach);
        if (u) u.zeichen.push(z); else B.uebergaenge.push({ von, nach, zeichen: [z] });
      }
      tabelle.push(zeile);
    }
    if (!mengenNamen) umbenennen(B);
    return { automat: B, tabelle };
  }

  /** Fehlende Übergänge zu einem Fallenzustand führen lassen (macht einen DEA vollständig). */
  function vervollstaendigen(A, zeichen = null) {
    const B = kopie(A);
    const S = zeichen || alphabet(B);
    const d = delta(B);
    let falle = null;
    for (const q of B.zustaende.slice()) {
      for (const z of S) {
        if (d.get(q.id).has(z)) continue;
        if (!falle) {
          falle = { id: 'falle' + Date.now().toString(36), name: B.zustaende.some((x) => x.name === '∅') ? 'qF' : '∅', x: 0, y: 0, start: false, ende: false };
          B.zustaende.push(falle);
          B.uebergaenge.push({ von: falle.id, nach: falle.id, zeichen: S.slice() });
        }
        const u = B.uebergaenge.find((x) => x.von === q.id && x.nach === falle.id);
        if (u) u.zeichen.push(z); else B.uebergaenge.push({ von: q.id, nach: falle.id, zeichen: [z] });
      }
    }
    return B;
  }

  // ------------------------------------------------------------ Minimieren

  /**
   * Minimaler DEA (Verfeinerung der Zerlegung, Moore). Ein NEA wird vorher umgewandelt. `falle`: den Fallenzustand
   * zeigen (vollständig) oder weglassen. Liefert {automat, klassen: [[alte Namen …]]}.
   */
  function minimieren(A, { falle = true, zeichen = null } = {}) {
    const S = zeichen || alphabet(A);
    const D = teilmengen(A, { falle: true, mengenNamen: true, zeichen: S }).automat; // vollständig, nur Erreichbares
    const d = delta(D);
    const ziel = (q, z) => [...d.get(q).get(z)][0];
    let klasse = new Map(D.zustaende.map((q) => [q.id, q.ende ? 1 : 0]));
    let anzahl = new Set(klasse.values()).size;
    for (;;) {
      const sig = new Map();
      const neu = new Map();
      for (const q of D.zustaende) {
        const k = [klasse.get(q.id), ...S.map((z) => klasse.get(ziel(q.id, z)))].join(',');
        if (!sig.has(k)) sig.set(k, sig.size);
        neu.set(q.id, sig.get(k));
      }
      klasse = neu;
      if (sig.size === anzahl) break;
      anzahl = sig.size;
    }
    const M = { art: 'dea', zustaende: [], uebergaenge: [], alphabet: S.slice() };
    const gruppen = new Map();
    for (const q of D.zustaende) {
      const k = klasse.get(q.id);
      if (!gruppen.has(k)) gruppen.set(k, []);
      gruppen.get(k).push(q);
    }
    for (const [k, qs] of gruppen) {
      M.zustaende.push({ id: 'k' + k, name: 'k' + k, x: 0, y: 0, start: qs.some((q) => q.start), ende: qs[0].ende, _alt: qs.map((q) => q.name) });
    }
    for (const [k, qs] of gruppen) {
      for (const z of S) {
        const nach = 'k' + klasse.get(ziel(qs[0].id, z));
        const u = M.uebergaenge.find((x) => x.von === 'k' + k && x.nach === nach);
        if (u) u.zeichen.push(z); else M.uebergaenge.push({ von: 'k' + k, nach, zeichen: [z] });
      }
    }
    let E = falle ? bereinigen(M) : bereinigen(M, { tote: true });
    umbenennen(E);
    const klassen = E.zustaende.map((q) => ({ name: q.name, alt: q._alt || [] }));
    E.zustaende.forEach((q) => delete q._alt);
    E = anordnen(E);
    return { automat: E, klassen };
  }

  // ------------------------------------------------------------ Äquivalenz

  /** Erkennen beide dieselbe Sprache? null – sonst das kürzeste Gegenbeispiel {wort, inA, inB}. */
  function vergleichen(A, B) {
    const S = [...new Set([...alphabet(A), ...alphabet(B)])].sort();
    const a = teilmengen(A, { falle: true, mengenNamen: false, zeichen: S }).automat;
    const b = teilmengen(B, { falle: true, mengenNamen: false, zeichen: S }).automat;
    const da = delta(a);
    const db = delta(b);
    const sa = startId(a);
    const sb = startId(b);
    if (sa === undefined || sb === undefined) return null;
    const ende = (X, q) => X.zustaende.find((x) => x.id === q).ende;
    const gesehen = new Set([sa + '|' + sb]);
    const schlange = [[sa, sb, '']];
    while (schlange.length) {
      const [p, q, w] = schlange.shift();
      if (ende(a, p) !== ende(b, q)) return { wort: w, inA: ende(a, p), inB: ende(b, q) };
      for (const z of S) {
        const p2 = [...da.get(p).get(z)][0];
        const q2 = [...db.get(q).get(z)][0];
        const k = p2 + '|' + q2;
        if (!gesehen.has(k)) {
          gesehen.add(k);
          schlange.push([p2, q2, w + z]);
        }
      }
    }
    return null;
  }

  /** Automat aus einem regulären Ausdruck: 'nea' (Glushkov, ohne ε), 'dea' (vollständig) oder 'min' (minimal). */
  function ausRegex(text, { ziel = 'min', plusIstOder = true, falle = true, zeichen = null } = {}) {
    const baum = regexParsen(text, { plusIstOder });
    const N = bereinigen(glushkov(baum), { tote: true });
    let S = zeichen && zeichen.length ? zeichen : alphabet(N);
    if (!S.length) S = alphabet(glushkov(baum));
    let A;
    let rechenweg = null;
    if (ziel === 'nea') {
      A = N;
      A.alphabet = S;
      umbenennen(A);
    } else if (ziel === 'dea') {
      const t = teilmengen(N, { falle, mengenNamen: false, zeichen: S });
      A = t.automat;
      rechenweg = { art: 'teilmengen', tabelle: t.tabelle,
        notiz: 'Die Mengen bestehen aus Zuständen des NEA ohne ε (Glushkov): p₀ ist der Start, pᵢ steht für das i-te Zeichen im Ausdruck.' };
    } else {
      A = minimieren(N, { falle, zeichen: S }).automat;
    }
    A.art = ziel === 'nea' ? 'nea' : 'dea';
    anordnen(A);
    return { automat: A, regex: regexText(baum), rechenweg };
  }

  // ------------------------------------------------------------ Export als TikZ

  function tikz(A) {
    const n = (q) => q.name.replace(/[{}]/g, (c) => '\\' + c).replace(/([A-Za-z]+)(\d+)/g, '$1_{$2}').replace(/∅/g, '\\emptyset');
    const z = (s) => (s === EPS ? '\\varepsilon' : s.replace(/([#$%&_{}])/g, '\\$1'));
    const ids = new Map(A.zustaende.map((q, i) => [q.id, 'z' + i]));
    const zeilen = [
      '% \\usepackage{tikz}  \\usetikzlibrary{automata, arrows.meta, positioning}',
      '\\begin{tikzpicture}[shorten >=1pt, >={Stealth[round]}, auto, every state/.style={minimum size=9mm}]',
    ];
    for (const q of A.zustaende) {
      const art = ['state', q.start ? 'initial' : '', q.ende ? 'accepting' : ''].filter(Boolean).join(', ');
      zeilen.push(`  \\node[${art}] (${ids.get(q.id)}) at (${(q.x / 70).toFixed(2)}, ${(-q.y / 70).toFixed(2)}) {$${n(q)}$};`);
    }
    zeilen.push('  \\path[->]');
    for (const u of A.uebergaenge) {
      if (!ids.has(u.von) || !ids.has(u.nach)) continue;
      const beschr = u.zeichen.map(z).join(', ');
      const zurueck = A.uebergaenge.some((x) => x.von === u.nach && x.nach === u.von && x !== u);
      const art = u.von === u.nach ? 'loop above' : zurueck ? 'bend left' : '';
      zeilen.push(`    (${ids.get(u.von)}) edge${art ? ` [${art}]` : ''} node {$${beschr}$} (${u.von === u.nach ? '' : ids.get(u.nach)})`);
    }
    zeilen.push('  ;', '\\end{tikzpicture}');
    return zeilen.join('\n');
  }

  return {
    EPS, delta, alphabet, huelle, lauf, akzeptiert, pruefen, bereinigen, umbenennen, anordnen, regexParsen, regexText,
    glushkov, teilmengen, vervollstaendigen, minimieren, vergleichen, ausRegex, tikz, zeichenVon, kopie, startId,
  };
})();
