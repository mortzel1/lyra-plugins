'use strict';
/*
 * Clavis – die Sammlung der Rätsel-Mechaniken. Jede Mechanik:
 *   name, kurz          – für Editor und KI
 *   stoff               – kann Lernstoff tragen (Fragen, Begriffe, Reihenfolgen …)
 *   felder              – welche Inhalte sie braucht (leer: baut sich selbst)
 *   bauen(inhalt, stufe, r, kontext) → { p, loesung, zettel?, hilfen } | null   (nur beim Host; macht das Rätsel lösbar)
 *   ansicht(p, api) → Element      api: { loesen(antwort) → Promise<{richtig, info}>, ton(name), stufe, welt }
 *   pruefen(p, loesung, antwort) → true | false | { richtig, info }
 * `p` ist öffentlich (geht an alle Geräte), `loesung` bleibt beim Host.
 */
(() => {
  const { el, norm } = Clavis;
  const M = (Clavis.MECHANIKEN = {});
  const S = (stufe) => ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 }[stufe] ?? 1);
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const wortAus = (s, min = 3, max = 10) => { const w = norm(s).replace(/[0-9]/g, ''); return w.length >= min && w.length <= max ? w : null; };
  const txt = (s, max = 400) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /** Eingabefeld mit Knopf; ruft api.loesen(wert) */
  function eingabe(api, { platz = 'Lösung', knopf = 'Prüfen', zahl = false, gross = true } = {}) {
    const f = el('input', { class: 'cl-eingabe' + (gross ? ' gross' : ''), placeholder: platz, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', inputmode: zahl ? 'numeric' : 'text', enterkeyhint: 'go' });
    const k = el('button', { class: 'cl-knopf', type: 'button' }, knopf);
    const los = async () => {
      const v = f.value.trim();
      if (!v) return f.focus();
      k.disabled = true;
      const r = await api.loesen(v);
      k.disabled = false;
      if (!r.richtig) { f.select(); }
    };
    k.addEventListener('click', los);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); los(); } });
    return el('div', { class: 'cl-eingabe-zeile' }, f, k);
  }

  function aufgabe(text) { return text ? el('div', { class: 'cl-aufgabe' }, text) : null; }

  /** Drehrollen (Ziffern oder Buchstaben) */
  function rollen(laenge, zeichen, api, knopfText = 'Öffnen') {
    const werte = new Array(laenge).fill(0);
    const anzeigen = [];
    const drehen = (i, d) => {
      werte[i] = (werte[i] + d + zeichen.length) % zeichen.length;
      anzeigen[i].textContent = zeichen[werte[i]];
      anzeigen[i].animate([{ transform: `translateY(${d > 0 ? 40 : -40}%)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 140, easing: 'ease-out' });
      api.ton('rad');
    };
    const reihe = el('div', { class: 'cl-rollen' }, werte.map((_, i) => {
      const a = el('div', { class: 'cl-rolle-wert' }, zeichen[0]);
      anzeigen.push(a);
      const r = el('div', { class: 'cl-rolle' },
        el('button', { class: 'cl-rolle-knopf', type: 'button', 'aria-label': 'Hoch', onclick: () => drehen(i, -1) }, '▲'),
        el('div', { class: 'cl-rolle-fenster' }, a),
        el('button', { class: 'cl-rolle-knopf', type: 'button', 'aria-label': 'Runter', onclick: () => drehen(i, 1) }, '▼'));
      r.addEventListener('wheel', (e) => { e.preventDefault(); drehen(i, e.deltaY > 0 ? 1 : -1); }, { passive: false });
      let y0 = null;
      r.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
      r.addEventListener('touchmove', (e) => { if (y0 == null) return; const d = e.touches[0].clientY - y0; if (Math.abs(d) > 22) { drehen(i, d > 0 ? -1 : 1); y0 = e.touches[0].clientY; } }, { passive: true });
      return r;
    }));
    const k = el('button', { class: 'cl-knopf', type: 'button', onclick: async () => { k.disabled = true; await api.loesen(werte.map((w) => zeichen[w]).join('')); k.disabled = false; } }, knopfText);
    return el('div', { class: 'cl-schloss' }, reihe, k);
  }

  // ---------------------------------------------------------------- Zahlenschloss
  const ZAHLENFAKTEN = [['Ecken eines Würfels', 8], ['Beine einer Spinne', 8], ['Tage einer Woche', 7], ['Farben eines Regenbogens', 7], ['Seiten eines Sechsecks', 6], ['Saiten einer Gitarre', 6],
    ['Finger einer Hand', 5], ['Ringe der Olympischen Flagge', 5], ['Jahreszeiten', 4], ['Beine eines Stuhls', 4], ['Seiten eines Dreiecks', 3], ['Räder eines Dreirads', 3],
    ['Planeten zwischen Sonne und Erde', 2], ['Höcker eines Dromedars', 1], ['Monate mit genau 28 oder 29 Tagen', 1], ['Planeten vor der Erde plus dem Mond', 3], ['Herzkammern des Menschen', 2], ['Spieler einer Volleyballmannschaft auf dem Feld', 6], ['Zähne eines Erwachsenen geteilt durch vier', 8], ['Musen der griechischen Sage', 9]];
  M.zahlenschloss = {
    name: 'Zahlenschloss', kurz: 'Ein Schloss mit Zahlenrollen; ein Rätsel oder eine Frage führt zur Zahl.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Rätsel oder Frage, deren Antwort eine Zahl ist', art: 'text' }, { k: 'zahl', titel: 'Die Zahl (2–6 Ziffern)', art: 'zahl' }],
    ohneInhalt(r, stufe) {
      const n = [3, 3, 4, 4][S(stufe)];
      const fakten = r.mischen(ZAHLENFAKTEN).slice(0, n);
      return { raetsel: 'Die Kombination ergibt sich so:\n' + fakten.map(([f], i) => `${i + 1}. Ziffer: Anzahl der ${f}`).join('\n'), zahl: fakten.map((f) => f[1]).join('') };
    },
    bauen(inh, stufe) {
      const z = String(inh.zahl == null ? '' : inh.zahl).replace(/\D/g, '');
      const raetsel = txt(inh.raetsel, 500);
      if (!raetsel || z.length < 2 || z.length > 6) return null;
      return { p: { raetsel, laenge: z.length }, loesung: z, hilfen: [`Die Lösung hat ${z.length} Ziffern.`, `Die erste Ziffer ist ${z[0]}.`, `Fast: ${z.slice(0, -1)}_`] };
    },
    ansicht: (p, api) => el('div', { class: 'cl-mech zahlenschloss' }, aufgabe(p.raetsel), rollen(p.laenge, '0123456789', api)),
    pruefen: (p, l, a) => String(a).replace(/\D/g, '') === l,
  };

  // ---------------------------------------------------------------- Wortschloss
  M.wortschloss = {
    name: 'Wortschloss', kurz: 'Ein Schloss mit Buchstabenrollen; ein Rätsel führt zum Wort.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Rätsel oder Frage, deren Antwort ein Wort ist', art: 'text' }, { k: 'wort', titel: 'Das Wort (3–8 Buchstaben)', art: 'wort' }],
    bauen(inh) {
      const w = wortAus(inh.wort, 3, 8);
      const raetsel = txt(inh.raetsel, 500);
      if (!w || !raetsel) return null;
      return { p: { raetsel, laenge: w.length }, loesung: w, hilfen: [`Das Wort hat ${w.length} Buchstaben.`, `Es beginnt mit ${w[0]}.`, `Es beginnt mit ${w.slice(0, Math.ceil(w.length / 2))}…`] };
    },
    ansicht: (p, api) => el('div', { class: 'cl-mech wortschloss' }, aufgabe(p.raetsel), rollen(p.laenge, ALPHABET, api)),
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Chiffrierscheibe (Caesar)
  const verschieben = (w, k) => [...w].map((c) => (ALPHABET.includes(c) ? ALPHABET[(ALPHABET.indexOf(c) + k + 26) % 26] : c)).join('');
  M.caesar = {
    name: 'Chiffrierscheibe', kurz: 'Eine verschlüsselte Nachricht; mit einer drehbaren Scheibe wird sie lesbar (Caesar).', stoff: true,
    felder: [{ k: 'wort', titel: 'Geheimes Wort (4–12 Buchstaben)', art: 'wort' }],
    bauen(inh, stufe, r) {
      const w = wortAus(inh.wort, 4, 12);
      if (!w) return null;
      const s = S(stufe);
      const k = r.wahl([3, 4, 5, 6, 7, 9, 10, 11, 15, 17, 19, 21, 23]);
      const klar = s >= 2 ? (s === 2 ? `DAS WORT IST ${w}` : `IST ${w}`) : w;
      const zettel = s === 0 ? { titel: 'Zettel', text: `Drehe die innere Scheibe um ${k} Stellen.\nA wird zu ${ALPHABET[k]}.` } : s === 1 ? { titel: 'Zettel', text: `Auf dem Rand der Scheibe ist eingeritzt:\nA → ${ALPHABET[k]}` } : null;
      return { p: { geheim: verschieben(klar, k), krib: s >= 2 }, loesung: w, zettel, hilfen: [s >= 2 ? 'Die Nachricht beginnt mit einem Satz, den du erraten kannst.' : 'Jeder Buchstabe ist um gleich viele Stellen verschoben.', `A wird zu ${ALPHABET[k]} – rückwärts entschlüsseln!`, `Das Wort beginnt mit ${w.slice(0, 2)}.`] };
    },
    ansicht(p, api) {
      let dreh = 0;
      const svg = el('svg', { viewBox: '-110 -110 220 220', class: 'cl-scheibe' });
      const aussen = el('g', {});
      const innen = el('g', { class: 'cl-scheibe-innen' });
      for (let i = 0; i < 26; i++) {
        const w = (i / 26) * Math.PI * 2 - Math.PI / 2;
        aussen.append(el('text', { x: Math.cos(w) * 92, y: Math.sin(w) * 92 + 5, 'text-anchor': 'middle', class: 'cl-scheibe-a' }, ALPHABET[i]));
        innen.append(el('text', { x: Math.cos(w) * 66, y: Math.sin(w) * 66 + 5, 'text-anchor': 'middle', class: 'cl-scheibe-i' }, ALPHABET[i]));
      }
      svg.append(el('circle', { r: 106, class: 'cl-scheibe-ring' }), el('circle', { r: 79, class: 'cl-scheibe-ring2' }), aussen, innen, el('circle', { r: 46, class: 'cl-scheibe-mitte' }), el('path', { d: 'M0 -104 L-6 -116 L6 -116 Z', class: 'cl-scheibe-zeiger' }));
      const zahl = el('text', { y: 8, 'text-anchor': 'middle', class: 'cl-scheibe-zahl' }, '0');
      svg.append(zahl);
      const setzen = () => { innen.setAttribute('transform', `rotate(${(-dreh * 360) / 26})`); zahl.textContent = String((dreh + 26) % 26); api.ton('rad'); };
      return el('div', { class: 'cl-mech caesar' },
        el('div', { class: 'cl-geheimtext' }, p.geheim),
        el('div', { class: 'cl-scheibe-zeile' },
          el('button', { class: 'cl-rund', type: 'button', onclick: () => { dreh = (dreh + 25) % 26; setzen(); } }, '⟲'),
          svg,
          el('button', { class: 'cl-rund', type: 'button', onclick: () => { dreh = (dreh + 1) % 26; setzen(); } }, '⟳')),
        el('div', { class: 'cl-klein' }, 'Außen: Klartext · innen: verschlüsselt. Dreh die Scheibe, bis es passt.'),
        eingabe(api, { platz: 'Entschlüsseltes Wort' }));
    },
    pruefen: (p, l, a) => norm(a) === l || norm(a).endsWith(l),
  };

  // ---------------------------------------------------------------- Morsefunk
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  M.morse = {
    name: 'Morsefunk', kurz: 'Eine Lampe blinkt (und piept) ein Wort im Morsecode; eine Tabelle hilft.', stoff: true,
    felder: [{ k: 'wort', titel: 'Wort (3–8 Buchstaben)', art: 'wort' }],
    bauen(inh, stufe) {
      const w = wortAus(inh.wort, 3, 8);
      if (!w) return null;
      const s = S(stufe);
      return {
        p: { code: [...w].map((c) => MORSE[c]), takt: [300, 250, 200, 160][s], zeigen: s === 0 },
        loesung: w,
        zettel: { titel: 'Morsetabelle', zeilen: Object.entries(MORSE).map(([b, c]) => [b, c.replace(/\./g, '·').replace(/-/g, '–')]) },
        hilfen: [`Das Wort hat ${w.length} Buchstaben – achte auf die langen Pausen.`, `Der erste Buchstabe ist ${w[0]} (${MORSE[w[0]]}).`, `Es beginnt mit ${w.slice(0, Math.ceil(w.length / 2))}…`],
      };
    },
    ansicht(p, api) {
      const lampe = el('div', { class: 'cl-morselampe' });
      let laeuft = false;
      let timer = null;
      let mitTon = true;
      const folge = [];
      p.code.forEach((z, i) => { [...z].forEach((s, j) => { folge.push([1, s === '.' ? 1 : 3]); if (j < z.length - 1) folge.push([0, 1]); }); folge.push([0, i < p.code.length - 1 ? 3 : 8]); });
      const spielen = () => {
        let i = 0;
        const schritt = () => {
          if (!laeuft || !lampe.isConnected) { lampe.classList.remove('an'); laeuft = false; knopf.textContent = 'Abspielen'; return; }
          const [an, d] = folge[i % folge.length];
          lampe.classList.toggle('an', !!an);
          if (an && mitTon) Clavis.klang.piep(720, (d * p.takt) / 1000);
          i++;
          timer = setTimeout(schritt, d * p.takt);
        };
        schritt();
      };
      const knopf = el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => { laeuft = !laeuft; knopf.textContent = laeuft ? 'Stopp' : 'Abspielen'; clearTimeout(timer); if (laeuft) spielen(); else lampe.classList.remove('an'); } }, 'Abspielen');
      const ton = el('label', { class: 'cl-klein cl-haken' }, el('input', { type: 'checkbox', checked: true, onchange: (e) => { mitTon = e.target.checked; } }), 'mit Ton');
      return el('div', { class: 'cl-mech morse' }, el('div', { class: 'cl-morse-buehne' }, lampe),
        p.zeigen ? el('div', { class: 'cl-geheimtext klein' }, p.code.map((c) => c.replace(/\./g, '·').replace(/-/g, '–')).join('   ')) : null,
        el('div', { class: 'cl-zeile' }, knopf, ton), eingabe(api, { platz: 'Gefunktes Wort' }));
    },
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Runenschrift (Symbol-Geheimschrift)
  const PUNKTE = [[4, 4], [12, 4], [20, 4], [4, 12], [12, 12], [20, 12], [4, 20], [12, 20], [20, 20]];
  const STRICHE = [];
  for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) { const [x1, y1] = PUNKTE[a]; const [x2, y2] = PUNKTE[b]; if (Math.abs(x1 - x2) <= 8 && Math.abs(y1 - y2) <= 8) STRICHE.push([a, b]); }
  Clavis.rune = (code, klasse = '') => el('svg', { viewBox: '0 0 24 24', class: 'cl-rune ' + klasse, fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round' },
    String(code).split('.').map(Number).filter((i) => STRICHE[i]).map((i) => { const [a, b] = STRICHE[i]; return el('line', { x1: PUNKTE[a][0], y1: PUNKTE[a][1], x2: PUNKTE[b][0], y2: PUNKTE[b][1] }); }));
  function runen(r, n) {
    const gesehen = new Set();
    const l = [];
    while (l.length < n) {
      const k = r.zahl(3, 4);
      const s = r.mischen(STRICHE.map((_, i) => i)).slice(0, k).sort((a, b) => a - b).join('.');
      if (!gesehen.has(s)) { gesehen.add(s); l.push(s); }
    }
    return l;
  }
  M.runen = {
    name: 'Runenschrift', kurz: 'Ein Wort in fremden Zeichen; ein Schlüssel (Zettel) übersetzt sie.', stoff: true,
    felder: [{ k: 'wort', titel: 'Wort (4–10 Buchstaben)', art: 'wort' }],
    bauen(inh, stufe, r) {
      const w = wortAus(inh.wort, 4, 10);
      if (!w) return null;
      const s = S(stufe);
      const zeichen = runen(r, 26);
      const karte = Object.fromEntries([...ALPHABET].map((b, i) => [b, zeichen[i]]));
      const benutzt = [...new Set(w)];
      const fehlen = new Set(r.mischen(benutzt).slice(0, Math.min(benutzt.length - 2, [0, 0, 1, 2][s])));
      const andere = r.mischen([...ALPHABET].filter((b) => !benutzt.includes(b))).slice(0, [0, 5, 7, 9][s]);
      const zeilen = r.mischen(benutzt.filter((b) => !fehlen.has(b)).concat(andere)).sort().map((b) => [karte[b], b]);
      return {
        p: { runen: [...w].map((b) => karte[b]) }, loesung: w,
        zettel: { titel: 'Übersetzung', runen: true, zeilen, text: fehlen.size ? `Einige Zeichen fehlen – ${fehlen.size === 1 ? 'eines' : 'zwei'} musst du erschließen.` : '' },
        hilfen: ['Übersetze Zeichen für Zeichen mit dem Zettel.', fehlen.size ? `Gesucht ist ein Begriff, der zum Raum passt – fehlende Zeichen ergänzt du aus dem Sinn.` : `Das Wort beginnt mit ${w[0]}.`, `Es beginnt mit ${w.slice(0, Math.ceil(w.length / 2))}…`],
      };
    },
    ansicht: (p, api) => el('div', { class: 'cl-mech runen' }, el('div', { class: 'cl-runenreihe' }, p.runen.map((c) => Clavis.rune(c, 'gross'))), eingabe(api, { platz: 'Übersetzung' })),
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Lichtschalter (Lights Out)
  function druecken(g, n, i) {
    const x = i % n;
    const y = Math.floor(i / n);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx; const b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) g[b * n + a] ^= 1; }
  }
  M.schalter = {
    name: 'Lichtschalter', kurz: 'Ein Feld aus Lampen: Jeder Druck schaltet die Lampe und ihre Nachbarn um – alle müssen leuchten.', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 4, 5, 5][s];
      const g = new Array(n * n).fill(1);
      const zuege = r.mischen(g.map((_, i) => i)).slice(0, [3, 5, 7, 11][s]);
      zuege.forEach((i) => druecken(g, n, i));
      if (g.every((x) => x)) druecken(g, n, 0);
      return { p: { n, gitter: g }, loesung: null, hilfen: ['Jeder Druck schaltet auch die vier Nachbarn um.', 'Zweimal dieselbe Lampe drücken hebt sich auf – die Reihenfolge ist egal.', `Drück diese Felder (Zeile/Spalte): ${zuege.slice(0, 3).map((i) => `${Math.floor(i / n) + 1}/${(i % n) + 1}`).join(', ')} …`] };
    },
    ansicht(p, api) {
      const g = p.gitter.slice();
      const zuege = [];
      const felder = g.map((_, i) => el('button', { class: 'cl-lampe' + (g[i] ? ' an' : ''), type: 'button', onclick: async () => {
        druecken(g, p.n, i);
        zuege.push(i);
        api.ton('klick');
        felder.forEach((f, j) => f.classList.toggle('an', !!g[j]));
        if (g.every((x) => x)) await api.loesen(zuege);
      } }));
      return el('div', { class: 'cl-mech schalter' }, el('div', { class: 'cl-lampenfeld', style: { gridTemplateColumns: `repeat(${p.n}, 1fr)` } }, felder),
        el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => { g.splice(0, g.length, ...p.gitter); zuege.length = 0; felder.forEach((f, j) => f.classList.toggle('an', !!g[j])); } }, 'Zurücksetzen'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length > 3000) return false;
      const g = p.gitter.slice();
      for (const i of a) { if (!Number.isInteger(i) || i < 0 || i >= g.length) return false; druecken(g, p.n, i); }
      return g.every((x) => x === 1);
    },
  };

  // ---------------------------------------------------------------- Verkabelung (Zuordnen)
  M.kabel = {
    name: 'Verkabelung', kurz: 'Links und rechts Anschlüsse: Begriffe mit dem Passenden verbinden – dann fließt Strom.', stoff: true,
    felder: [{ k: 'paare', titel: 'Paare (3–6): Begriff ↔ Passendes', art: 'paare' }],
    bauen(inh, stufe, r) {
      const paare = (Array.isArray(inh.paare) ? inh.paare : []).map((x) => ({ links: txt(x && x.links, 80), rechts: txt(x && x.rechts, 80) })).filter((x) => x.links && x.rechts);
      const eindeutig = paare.filter((x, i) => paare.findIndex((y) => y.links === x.links || y.rechts === x.rechts) === i);
      const n = Math.min(eindeutig.length, [3, 4, 5, 6][S(stufe)]);
      if (n < 3) return null;
      const wahl = r.mischen(eindeutig).slice(0, n);
      let rechts = r.mischen(wahl.map((x) => x.rechts));
      if (rechts.every((x, i) => x === wahl[i].rechts)) rechts = rechts.slice(1).concat(rechts[0]);
      return { p: { links: wahl.map((x) => x.links), rechts }, loesung: wahl.map((x) => rechts.indexOf(x.rechts)), hilfen: ['Jeder Anschluss links gehört zu genau einem rechts.', `${wahl[0].links} gehört zu „${wahl[0].rechts}“.`, `${wahl[1].links} gehört zu „${wahl[1].rechts}“.`] };
    },
    ansicht(p, api) {
      const n = p.links.length;
      const verb = new Array(n).fill(-1);
      let wahl = null;
      const FARBEN = ['#e85d4a', '#3b9eff', '#f5b82e', '#3ecf8e', '#b57bff', '#ff7ac6'];
      const svg = el('svg', { class: 'cl-kabel-svg' });
      const links = p.links.map((t, i) => el('button', { class: 'cl-klemme links', type: 'button', onclick: () => { wahl = i; malen(); api.ton('klick'); } }, el('span', {}, t), el('i', { class: 'cl-buchse' })));
      const rechts = p.rechts.map((t, j) => el('button', { class: 'cl-klemme rechts', type: 'button', onclick: () => {
        if (wahl == null) return;
        for (let k = 0; k < n; k++) if (verb[k] === j) verb[k] = -1;
        verb[wahl] = j;
        wahl = null;
        api.ton('rad');
        malen();
      } }, el('i', { class: 'cl-buchse' }), el('span', {}, t)));
      const feld = el('div', { class: 'cl-kabelfeld' }, el('div', { class: 'cl-kabel-spalte' }, links), el('div', { class: 'cl-kabel-spalte' }, rechts), svg);
      function malen() {
        links.forEach((b, i) => { b.classList.toggle('gewaehlt', wahl === i); b.style.setProperty('--kabel', verb[i] >= 0 ? FARBEN[i % 6] : 'transparent'); });
        rechts.forEach((b, j) => { const i = verb.indexOf(j); b.style.setProperty('--kabel', i >= 0 ? FARBEN[i % 6] : 'transparent'); });
        requestAnimationFrame(() => {
          const r0 = feld.getBoundingClientRect();
          svg.setAttribute('viewBox', `0 0 ${r0.width} ${r0.height}`);
          svg.replaceChildren(...verb.map((j, i) => {
            if (j < 0) return null;
            const a = links[i].querySelector('.cl-buchse').getBoundingClientRect();
            const b = rechts[j].querySelector('.cl-buchse').getBoundingClientRect();
            const x1 = a.left + a.width / 2 - r0.left; const y1 = a.top + a.height / 2 - r0.top; const x2 = b.left + b.width / 2 - r0.left; const y2 = b.top + b.height / 2 - r0.top;
            const m = (x1 + x2) / 2;
            return el('path', { d: `M${x1} ${y1} C${m} ${y1 + 30}, ${m} ${y2 + 30}, ${x2} ${y2}`, stroke: FARBEN[i % 6], 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round', class: 'cl-kabel' });
          }).filter(Boolean));
        });
        knopf.disabled = verb.some((x) => x < 0);
      }
      const knopf = el('button', { class: 'cl-knopf', type: 'button', disabled: true, onclick: () => api.loesen(verb.slice()) }, 'Strom einschalten');
      setTimeout(malen, 30);
      window.addEventListener('resize', () => feld.isConnected && malen());
      return el('div', { class: 'cl-mech kabel' }, el('div', { class: 'cl-klein' }, 'Tippe links einen Anschluss an, dann rechts das Passende.'), feld, knopf);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} Kabeln sitzen richtig.` };
    },
  };

  // ---------------------------------------------------------------- Schiebepuzzle
  function nachbarn(n, i) { const x = i % n; const y = Math.floor(i / n); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => b * n + a); }
  M.schiebepuzzle = {
    name: 'Schiebepuzzle', kurz: 'Verschobene Kacheln wieder in die richtige Reihenfolge bringen.', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 3, 4, 4][s];
      const f = [...Array(n * n).keys()].map((i) => (i + 1) % (n * n));
      let leer = n * n - 1;
      let vorher = -1;
      for (let k = 0; k < [24, 50, 70, 110][s]; k++) {
        const opt = nachbarn(n, leer).filter((x) => x !== vorher);
        const z = r.wahl(opt);
        [f[leer], f[z]] = [f[z], f[leer]];
        vorher = leer;
        leer = z;
      }
      if (f.every((v, i) => v === (i + 1) % (n * n))) { const z = nachbarn(n, leer)[0]; [f[leer], f[z]] = [f[z], f[leer]]; }
      return { p: { n, feld: f }, loesung: null, hilfen: ['Löse zuerst die obere Reihe, dann die linke Spalte.', 'Die letzten Kacheln bringst du im Kreis an ihren Platz.', 'Ecken zuletzt: Schieb die Kachel daneben und dreh sie mit hinein.'] };
    },
    ansicht(p, api) {
      const f = p.feld.slice();
      const zuege = [];
      const raster = el('div', { class: 'cl-schiebefeld', style: { gridTemplateColumns: `repeat(${p.n}, 1fr)` } });
      const malen = () => raster.replaceChildren(...f.map((v, i) => (v ? el('button', { class: 'cl-kachel' + (v === i + 1 ? ' passt' : ''), type: 'button', onclick: () => schieben(i) }, String(v)) : el('div', { class: 'cl-kachel leer' }))));
      const schieben = async (i) => {
        const leer = f.indexOf(0);
        if (!nachbarn(p.n, leer).includes(i)) return;
        [f[leer], f[i]] = [f[i], f[leer]];
        zuege.push(i);
        api.ton('klick');
        malen();
        if (f.every((v, j) => v === (j + 1) % (p.n * p.n))) await api.loesen(zuege);
      };
      malen();
      return el('div', { class: 'cl-mech schiebe' }, aufgabe('Ordne die Kacheln von 1 bis ' + (p.n * p.n - 1) + ' – das freie Feld unten rechts.'), raster);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length > 5000) return false;
      const f = p.feld.slice();
      for (const i of a) { const leer = f.indexOf(0); if (!nachbarn(p.n, leer).includes(i)) return false; [f[leer], f[i]] = [f[i], f[leer]]; }
      return f.every((v, j) => v === (j + 1) % (p.n * p.n));
    },
  };

  // ---------------------------------------------------------------- Zeitleiste (Reihenfolge)
  M.reihenfolge = {
    name: 'Zeitleiste', kurz: 'Ereignisse, Schritte oder Größen in die richtige Reihenfolge bringen.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Aufgabe, z. B. „Bringe die Ereignisse in die richtige Reihenfolge“', art: 'text' }, { k: 'reihe', titel: 'Elemente in der richtigen Reihenfolge (4–7)', art: 'liste' }],
    bauen(inh, stufe, r) {
      const reihe = [...new Set((Array.isArray(inh.reihe) ? inh.reihe : []).map((x) => txt(x, 90)).filter(Boolean))];
      const n = Math.min(reihe.length, [4, 5, 6, 7][S(stufe)]);
      if (n < 3) return null;
      // Teilfolge mit gleicher Reihenfolge
      const idx = r.mischen(reihe.map((_, i) => i)).slice(0, n).sort((a, b) => a - b);
      const richtig = idx.map((i) => reihe[i]);
      let gemischt = r.mischen(richtig);
      if (gleich(gemischt, richtig)) gemischt = gemischt.slice(1).concat(gemischt[0]);
      return { p: { aufgabe: txt(inh.raetsel, 200) || 'Bringe alles in die richtige Reihenfolge.', elemente: gemischt }, loesung: richtig, hilfen: [`Ganz oben steht: „${richtig[0]}“.`, `Ganz unten steht: „${richtig[n - 1]}“.`, `An zweiter Stelle: „${richtig[1]}“.`] };
    },
    ansicht(p, api) {
      const l = p.elemente.slice();
      const liste = el('ol', { class: 'cl-ordnen' });
      const malen = () => liste.replaceChildren(...l.map((t, i) => el('li', { class: 'cl-ordnen-zeile' },
        el('span', { class: 'cl-nr' }, String(i + 1)), el('span', { class: 'cl-wachsen' }, t),
        el('span', { class: 'cl-pfeile' },
          el('button', { type: 'button', disabled: i === 0, onclick: () => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; api.ton('klick'); malen(); } }, '▲'),
          el('button', { type: 'button', disabled: i === l.length - 1, onclick: () => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; api.ton('klick'); malen(); } }, '▼')))));
      malen();
      return el('div', { class: 'cl-mech reihenfolge' }, aufgabe(p.aufgabe), liste, el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(l.slice()) }, 'So ist es richtig'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} stehen am richtigen Platz.` };
    },
  };

  // ---------------------------------------------------------------- Spurensuche (Suchbild)
  M.suchbild = {
    name: 'Spurensuche', kurz: 'In einem Durcheinander die versteckten Spuren finden.', stoff: false, felder: [],
    bauen(inh, stufe, r, k) {
      const s = S(stufe);
      const objekte = ((Clavis.WELTEN[k && k.welt] || {}).objekte || Object.keys(Clavis.ICONS)).filter((x) => Clavis.ICONS[x]);
      const ziel = r.wahl(['schluessel', 'kompass', 'kerze', 'flasche', 'reagenz', 'telefon'].filter((x) => !objekte.includes(x)));
      const andere = Object.keys(Clavis.ICONS).filter((x) => x !== ziel && x !== 'ausgang' && x !== 'tuer');
      const nZiel = [3, 4, 5, 6][s];
      const nAndere = [16, 24, 32, 42][s];
      const plaetze = [];
      const frei = (x, y) => plaetze.every((q) => Math.abs(q.x - x) > 7 || Math.abs(q.y - y) > 11);
      let versuche = 0;
      while (plaetze.length < nZiel + nAndere && versuche++ < 4000) {
        const x = r.zahl(3, 93);
        const y = r.zahl(5, 90);
        if (frei(x, y)) plaetze.push({ x, y });
      }
      const liste = plaetze.map((q, i) => ({ id: i, icon: i < nZiel ? ziel : r.wahl(andere), x: q.x, y: q.y, rot: r.zahl(-40, 40), g: r.zahl(85, 125) / 100 }));
      const gemischt = r.mischen(liste).map((o, i) => ({ ...o, id: i }));
      return { p: { ziel, anzahl: nZiel, objekte: gemischt }, loesung: gemischt.filter((o) => o.icon === ziel).map((o) => o.id).sort((a, b) => a - b), hilfen: [`Gesucht sind ${nZiel} Stück – manche sind gedreht.`, 'Such systematisch: Zeile für Zeile von oben nach unten.', 'Achte auch auf die Ränder des Bildes.'] };
    },
    ansicht(p, api) {
      const gefunden = new Set();
      const zaehler = el('b', {}, `0 / ${p.anzahl}`);
      const feld = el('div', { class: 'cl-suchfeld' }, p.objekte.map((o) => {
        const b = el('button', { class: 'cl-suchding', type: 'button', style: { left: o.x + '%', top: o.y + '%', transform: `translate(-50%, -50%) rotate(${o.rot}deg) scale(${o.g})` }, onclick: async () => {
          if (o.icon !== p.ziel) { b.classList.add('nein'); setTimeout(() => b.classList.remove('nein'), 350); api.ton('falsch'); return; }
          if (gefunden.has(o.id)) return;
          gefunden.add(o.id);
          b.classList.add('ja');
          api.ton('klick');
          zaehler.textContent = `${gefunden.size} / ${p.anzahl}`;
          if (gefunden.size === p.anzahl) await api.loesen([...gefunden].sort((a, c) => a - c));
        } }, Clavis.icon(o.icon));
        return b;
      }));
      return el('div', { class: 'cl-mech suchbild' }, el('div', { class: 'cl-zeile' }, el('span', {}, 'Finde alle: '), Clavis.icon(p.ziel, 'klein'), el('span', { class: 'cl-wachsen' }), zaehler), feld);
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a.slice().sort((x, y) => x - y), l),
  };

  // ---------------------------------------------------------------- Taschenlampe (dunkler Raum)
  M.taschenlampe = {
    name: 'Taschenlampe', kurz: 'Ein stockdunkler Fleck – nur mit der Lampe findest du das Wort, das jemand an die Wand geschrieben hat.', stoff: true,
    felder: [{ k: 'wort', titel: 'Wort an der Wand (3–9 Buchstaben)', art: 'wort' }],
    bauen(inh, stufe, r) {
      const w = wortAus(inh.wort, 3, 9);
      if (!w) return null;
      const s = S(stufe);
      const kritzel = [];
      for (let i = 0; i < [3, 6, 9, 12][s]; i++) kritzel.push({ t: r.mischen([...ALPHABET]).slice(0, r.zahl(3, 7)).join(''), x: r.zahl(5, 85), y: r.zahl(8, 88), rot: r.zahl(-25, 25), g: r.zahl(70, 120) / 100 });
      return { p: { wort: { t: w, x: r.zahl(10, 70), y: r.zahl(15, 80), rot: r.zahl(-15, 15) }, kritzel, radius: [120, 95, 75, 60][s] }, loesung: w, hilfen: ['Fahr langsam mit der Lampe über die ganze Wand.', 'Das gesuchte Wort ist größer als die Kritzeleien.', `Es beginnt mit ${w[0]}.`] };
    },
    ansicht(p, api) {
      const wand = el('div', { class: 'cl-dunkel', style: { '--r': p.radius + 'px' } },
        el('div', { class: 'cl-wandschrift gross', style: { left: p.wort.x + '%', top: p.wort.y + '%', transform: `rotate(${p.wort.rot}deg)` } }, p.wort.t),
        p.kritzel.map((k) => el('div', { class: 'cl-wandschrift', style: { left: k.x + '%', top: k.y + '%', transform: `rotate(${k.rot}deg) scale(${k.g})` } }, k.t)));
      const bewegen = (x, y) => { const r0 = wand.getBoundingClientRect(); wand.style.setProperty('--x', `${x - r0.left}px`); wand.style.setProperty('--y', `${y - r0.top}px`); };
      wand.addEventListener('pointermove', (e) => bewegen(e.clientX, e.clientY));
      wand.addEventListener('pointerdown', (e) => bewegen(e.clientX, e.clientY));
      wand.addEventListener('touchmove', (e) => { e.preventDefault(); bewegen(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      return el('div', { class: 'cl-mech taschenlampe' }, el('div', { class: 'cl-klein' }, 'Beweg die Lampe über die Wand.'), wand, eingabe(api, { platz: 'Was steht da?' }));
    },
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Geheimtinte (UV-Licht, Spiegelschrift)
  M.geheimtinte = {
    name: 'Geheimtinte', kurz: 'Ein Brief mit unsichtbarer Tinte – erst unter UV-Licht erscheint das Wort, manchmal gespiegelt.', stoff: true,
    felder: [{ k: 'wort', titel: 'Verborgenes Wort (3–10 Buchstaben)', art: 'wort' }, { k: 'raetsel', titel: 'Sichtbarer Brieftext (optional)', art: 'text' }],
    bauen(inh, stufe) {
      const w = wortAus(inh.wort, 3, 10);
      if (!w) return null;
      const s = S(stufe);
      const brief = txt(inh.raetsel, 400) || 'Liebe Freundin, lieber Freund,\nwenn du diese Zeilen liest, bin ich längst fort. Alles, was du brauchst, habe ich dir hinterlassen – du musst es nur sehen können.\nIn Eile';
      return { p: { brief, geheim: s >= 3 ? [...w].reverse().join('') : w, spiegel: s >= 2 }, loesung: w, hilfen: ['Manches sieht man nur im richtigen Licht.', s >= 2 ? 'Die Schrift ist gespiegelt – lies sie von rechts.' : 'Schalte das UV-Licht ein und sieh genau hin.', `Das Wort beginnt mit ${w[0]}.`] };
    },
    ansicht(p, api) {
      const blatt = el('div', { class: 'cl-blatt' }, el('div', { class: 'cl-blatt-text' }, p.brief), el('div', { class: 'cl-tinte' + (p.spiegel ? ' spiegel' : '') }, p.geheim));
      const knopf = el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => { blatt.classList.toggle('uv'); knopf.textContent = blatt.classList.contains('uv') ? 'UV-Licht aus' : 'UV-Licht an'; api.ton('klick'); } }, 'UV-Licht an');
      return el('div', { class: 'cl-mech geheimtinte' }, blatt, knopf, eingabe(api, { platz: 'Verborgenes Wort' }));
    },
    pruefen: (p, l, a) => norm(a) === l || [...norm(a)].reverse().join('') === l,
  };

  // ---------------------------------------------------------------- Terminal
  M.terminal = {
    name: 'Terminal', kurz: 'Ein alter Rechner: mit Befehlen Dateien lesen und das Passwort finden (Antwort auf eine Frage).', stoff: true,
    felder: [{ k: 'frage', titel: 'Frage, deren Antwort das Passwort ist', art: 'text' }, { k: 'antwort', titel: 'Passwort (ein Wort oder eine Zahl)', art: 'wort' }],
    bauen(inh, stufe, r, k) {
      const a = norm(inh.antwort);
      const frage = txt(inh.frage, 300);
      if (!frage || a.length < 2 || a.length > 16) return null;
      const s = S(stufe);
      const nutzer = ['admin', 'wache', 'labor', 'archiv', 'nacht'][r.zahl(0, 4)];
      const notiz = [
        'Passwort vergessen? Die Antwort auf die Frage in frage.txt ist das Passwort.\nAnmelden mit: login <passwort>',
        'Erinnerung an mich: Passwort = Antwort aus frage.txt (ohne Leerzeichen).',
        'Wer die Frage beantworten kann, kommt hinein. Mehr verrate ich nicht.',
        '…',
      ][s];
      return { p: { nutzer, dateien: { 'notiz.txt': notiz, 'frage.txt': frage, 'protokoll.txt': (k && k.geschichte) || 'Letzte Anmeldung: 23:47. Danach nichts mehr.' } }, loesung: a, hilfen: ['Tippe „ls“ für alle Dateien und „cat frage.txt“ zum Lesen.', 'Anmelden mit „login <antwort>“ – ohne Leerzeichen, Umlaute als ae/oe/ue.', `Das Passwort beginnt mit ${a.slice(0, 2)}.`] };
    },
    ansicht(p, api) {
      const ausgabe = el('div', { class: 'cl-term-ausgabe' });
      const zeile = (t, k = '') => { ausgabe.append(el('div', { class: 'cl-term-zeile ' + k }, t)); ausgabe.scrollTop = ausgabe.scrollHeight; };
      const f = el('input', { class: 'cl-term-eingabe', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'send', 'aria-label': 'Befehl' });
      zeile(`${p.nutzer}@clavis – Sitzung gesperrt. Tippe „hilfe“.`, 'leise');
      f.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const ein = f.value.trim();
        f.value = '';
        if (!ein) return;
        zeile('> ' + ein, 'ein');
        api.ton('klick');
        const [befehl, ...rest] = ein.split(/\s+/);
        const arg = rest.join(' ');
        const b = befehl.toLowerCase();
        if (b === 'hilfe' || b === 'help') zeile('ls – Dateien zeigen · cat <datei> – Datei lesen · login <passwort> – anmelden · clear – leeren');
        else if (b === 'ls' || b === 'dir') zeile(Object.keys(p.dateien).join('   '));
        else if (b === 'cat' || b === 'type' || b === 'more') { const d = p.dateien[arg] || p.dateien[arg + '.txt']; zeile(d || `cat: ${arg || '?'}: Datei nicht gefunden`, d ? '' : 'fehler'); }
        else if (b === 'clear' || b === 'cls') ausgabe.replaceChildren();
        else if (b === 'login') {
          if (!arg) return zeile('login: Passwort fehlt', 'fehler');
          zeile('Prüfe …', 'leise');
          const r = await api.loesen(arg);
          zeile(r.richtig ? 'ZUGANG GEWÄHRT' : 'ZUGANG VERWEIGERT', r.richtig ? 'ok' : 'fehler');
        } else zeile(`${b}: Befehl nicht gefunden (hilfe)`, 'fehler');
      });
      const t = el('div', { class: 'cl-terminal', onclick: () => f.focus() }, ausgabe, el('div', { class: 'cl-term-prompt' }, el('span', {}, '>'), f));
      setTimeout(() => f.focus(), 200);
      return el('div', { class: 'cl-mech terminal' }, t);
    },
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Ermittlungsakte (Logik)
  M.akte = {
    name: 'Ermittlungsakte', kurz: 'Verdächtige mit Merkmalen und Spuren – wer übrig bleibt, war es (Logikrätsel).', stoff: false,
    felder: [],
    bauen(inh, stufe, r, k) {
      const s = S(stufe);
      const w = Clavis.WELTEN[k && k.welt] || Clavis.WELTEN.krimi;
      const n = [3, 4, 5, 6][s];
      const kat = r.mischen(Object.keys(w.merkmale)).slice(0, 3);
      const namen = r.mischen(w.personen).slice(0, n);
      for (let versuch = 0; versuch < 200; versuch++) {
        const personen = namen.map((name) => ({ name, m: Object.fromEntries(kat.map((c) => [c, r.wahl(w.merkmale[c])])) }));
        const schl = (p) => kat.map((c) => p.m[c]).join('|');
        if (new Set(personen.map(schl)).size < n) continue;
        const t = r.zahl(0, n - 1);
        const spuren = [];
        const offen = new Set(personen.map((_, i) => i).filter((i) => i !== t));
        const kandidaten = r.mischen(kat.flatMap((c) => w.merkmale[c].map((v) => ({ c, v, positiv: v === personen[t].m[c] }))))
          .filter((x) => x.positiv || x.v !== personen[t].m[x.c]);
        const trifft = (x, i) => (x.positiv ? personen[i].m[x.c] !== x.v : personen[i].m[x.c] === x.v);
        // Je Schritt die Spur, die am wenigsten ausschließt („nicht …“ bevorzugt) – so muss man mehrere Spuren kombinieren
        while (offen.size) {
          let beste = null;
          let wert = Infinity;
          for (const x of kandidaten) {
            if (x.benutzt) continue;
            const n = [...offen].filter((i) => trifft(x, i)).length;
            if (!n) continue;
            const w2 = n + (x.positiv ? 1.5 : 0);
            if (w2 < wert) { beste = x; wert = w2; }
          }
          if (!beste) break;
          beste.benutzt = true;
          [...offen].filter((i) => trifft(beste, i)).forEach((i) => offen.delete(i));
          spuren.push(beste.positiv ? `${w.taeter}: ${beste.v}` : `${w.taeter}: nicht ${beste.v}`);
        }
        if (offen.size) continue;
        return { p: { frage: w.fall, personen: personen.map((p) => ({ name: p.name, merkmale: kat.map((c) => [c, p.m[c]]) })), spuren: r.mischen(spuren) }, loesung: t, hilfen: ['Streiche nach jeder Spur alle, auf die sie nicht passt.', `Eine Spur lautet: ${spuren[0]}.`, `${personen[(t + 1) % n].name} war es nicht.`] };
      }
      return null;
    },
    ansicht(p, api) {
      const raus = new Set();
      const karten = p.personen.map((pe, i) => {
        const k = el('div', { class: 'cl-person' },
          el('div', { class: 'cl-person-kopf' }, el('div', { class: 'cl-person-bild' }, pe.name.replace(/^(Dr\.|Prof\.|Lady|Lord|Miss|Butler|Gärtner|Köchin|Käpt’n|Maat|Smutje|Kommandantin|Ingenieur|Pilot|Technikerin|Biologe|Bibliothekar|Schwester|Magister|Gräfin|Student|Archivarin|Hausmeister|Tutorin|Dekanin)\s+/, '').slice(0, 1)), el('b', {}, pe.name)),
          el('ul', {}, pe.merkmale.map(([c, v]) => el('li', {}, el('span', { class: 'cl-leise' }, c + ': '), v))),
          el('div', { class: 'cl-person-knoepfe' },
            el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { if (raus.has(i)) raus.delete(i); else raus.add(i); k.classList.toggle('raus', raus.has(i)); api.ton('papier'); } }, 'Streichen'),
            el('button', { class: 'cl-knopf klein', type: 'button', onclick: () => api.loesen(i) }, 'Beschuldigen')));
        return k;
      });
      return el('div', { class: 'cl-mech akte' }, aufgabe(p.frage),
        el('div', { class: 'cl-spuren' }, el('b', {}, 'Spuren'), el('ol', {}, p.spuren.map((s) => el('li', {}, s)))),
        el('div', { class: 'cl-personen' }, karten));
    },
    pruefen: (p, l, a) => Number(a) === l,
  };

  // ---------------------------------------------------------------- Verhör (Fragen in Folge)
  M.verhoer = {
    name: 'Verhör', kurz: 'Eine Figur stellt Fragen – nur wer alle richtig beantwortet, bekommt, was sie bewacht.', stoff: true,
    felder: [{ k: 'fragen', titel: 'Fragen (2–5), je mit Optionen und richtiger Antwort', art: 'fragen' }],
    bauen(inh, stufe, r, k) {
      const l = (Array.isArray(inh.fragen) ? inh.fragen : []).map((f) => {
        const opt = (Array.isArray(f && f.optionen) ? f.optionen : []).map((o) => txt(String(o), 100)).filter(Boolean);
        const ri = Number(f && f.richtig);
        return txt(f && f.frage, 220) && opt.length >= 2 && Number.isInteger(ri) && opt[ri] ? { frage: txt(f.frage, 220), optionen: opt.slice(0, 4), richtig: opt[ri] } : null;
      }).filter((f) => f && f.optionen.includes(f.richtig));
      const n = Math.min(l.length, [2, 3, 4, 5][S(stufe)]);
      if (n < 2) return null;
      const wahl = r.mischen(l).slice(0, n).map((f) => ({ frage: f.frage, optionen: r.mischen(f.optionen), richtig: f.richtig }));
      const w = Clavis.WELTEN[k && k.welt] || Clavis.WELTEN.akademie;
      return { p: { person: r.wahl(w.personen), fragen: wahl.map((f) => ({ frage: f.frage, optionen: f.optionen })) }, loesung: wahl.map((f) => f.optionen.indexOf(f.richtig)), hilfen: [`Es sind ${n} Fragen – alle müssen stimmen.`, `Bei der ersten Frage stimmt: „${wahl[0].richtig}“.`, `Bei der zweiten Frage stimmt: „${wahl[1].richtig}“.`] };
    },
    ansicht(p, api) {
      const verlauf = el('div', { class: 'cl-verhoer' });
      const antworten = [];
      const blase = (t, wer) => { verlauf.append(el('div', { class: 'cl-blase ' + wer }, t)); verlauf.scrollTop = verlauf.scrollHeight; };
      const optionen = el('div', { class: 'cl-optionen' });
      const frage = () => {
        const i = antworten.length;
        if (i === p.fragen.length) {
          optionen.replaceChildren(el('div', { class: 'cl-leise' }, `${p.person} mustert dich …`));
          api.loesen(antworten.slice()).then((r) => {
            if (r.richtig) blase('Na gut. Du weißt Bescheid. Hier, nimm das.', 'figur');
            else { blase(`Falsch! ${r.info || ''} Noch einmal von vorn.`, 'figur'); antworten.length = 0; setTimeout(frage, 1200); }
          });
          return;
        }
        blase(p.fragen[i].frage, 'figur');
        optionen.replaceChildren(...p.fragen[i].optionen.map((o, j) => el('button', { class: 'cl-option', type: 'button', onclick: () => { antworten.push(j); blase(o, 'ich'); api.ton('klick'); frage(); } }, o)));
      };
      blase(`${p.person}: „Du willst weiter? Dann beantworte meine Fragen.“`, 'figur leise');
      frage();
      return el('div', { class: 'cl-mech verhoer' }, verlauf, optionen);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} Antworten stimmten.` };
    },
  };

  // ---------------------------------------------------------------- Tresor (Drehrad)
  M.tresor = {
    name: 'Tresor', kurz: 'Ein Tresor mit Drehrad: drei Zahlen nacheinander einstellen.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Hinweis auf drei Zahlen', art: 'text' }, { k: 'zahl', titel: 'Drei Zahlen von 0 bis 39, z. B. „12-7-31“', art: 'text' }],
    ohneInhalt(r, stufe) {
      const s = S(stufe);
      const z = [r.zahl(2, 39), r.zahl(2, 39), r.zahl(2, 39)];
      const term = (x) => { const a = r.zahl(2, 6); if (s === 0 || x % a) { const b = r.zahl(1, x - 1 || 1); return `${b} + ${x - b}`; } return `${a} × ${x / a}`; };
      return { raetsel: `Auf der Rückseite eines Fotos:\n${z.map((x, i) => `${['Rechts', 'Links', 'Rechts'][i]}: ${term(x)}`).join('\n')}`, zahl: z.join('-') };
    },
    bauen(inh) {
      const z = String(inh.zahl || '').match(/\d+/g);
      const raetsel = txt(inh.raetsel, 400);
      if (!raetsel || !z || z.length !== 3 || z.some((x) => Number(x) > 39)) return null;
      const l = z.map(Number);
      return { p: { raetsel }, loesung: l, hilfen: ['Dreh auf eine Zahl und drück „Einrasten“ – dreimal.', `Die erste Zahl ist ${l[0]}.`, `Die ersten beiden: ${l[0]} und ${l[1]}.`] };
    },
    ansicht(p, api) {
      let wert = 0;
      const folge = [];
      const svg = el('svg', { viewBox: '-110 -110 220 220', class: 'cl-drehrad' });
      const rad = el('g', {});
      for (let i = 0; i < 40; i++) {
        const w = (i / 40) * Math.PI * 2 - Math.PI / 2;
        const lang = i % 5 === 0;
        rad.append(el('line', { x1: Math.cos(w) * (lang ? 78 : 84), y1: Math.sin(w) * (lang ? 78 : 84), x2: Math.cos(w) * 92, y2: Math.sin(w) * 92, class: 'cl-drehrad-strich' }));
        if (lang) rad.append(el('text', { x: Math.cos(w) * 64, y: Math.sin(w) * 64 + 5, 'text-anchor': 'middle', class: 'cl-drehrad-zahl' }, String(i)));
      }
      svg.append(el('circle', { r: 100, class: 'cl-drehrad-rand' }), rad, el('circle', { r: 30, class: 'cl-drehrad-knauf' }), el('path', { d: 'M0 -96 L-7 -108 L7 -108 Z', class: 'cl-scheibe-zeiger' }));
      const anzeige = el('div', { class: 'cl-drehrad-anzeige' }, '0');
      const slots = el('div', { class: 'cl-slots' });
      const malen = () => { rad.setAttribute('transform', `rotate(${(-wert * 360) / 40})`); anzeige.textContent = String(wert); slots.replaceChildren(...[0, 1, 2].map((i) => el('span', { class: 'cl-slot' + (folge[i] != null ? ' voll' : '') }, folge[i] != null ? String(folge[i]) : '–'))); };
      const drehen = (d) => { wert = (wert + d + 40) % 40; api.ton('rad'); malen(); };
      let x0 = null;
      svg.addEventListener('pointerdown', (e) => { x0 = e.clientX; svg.setPointerCapture(e.pointerId); });
      svg.addEventListener('pointermove', (e) => { if (x0 == null) return; const d = e.clientX - x0; if (Math.abs(d) > 9) { drehen(d > 0 ? 1 : -1); x0 = e.clientX; } });
      svg.addEventListener('pointerup', () => { x0 = null; });
      svg.addEventListener('wheel', (e) => { e.preventDefault(); drehen(e.deltaY > 0 ? 1 : -1); }, { passive: false });
      malen();
      return el('div', { class: 'cl-mech tresor' }, aufgabe(p.raetsel),
        el('div', { class: 'cl-scheibe-zeile' }, el('button', { class: 'cl-rund', type: 'button', onclick: () => drehen(-1) }, '⟲'), el('div', { class: 'cl-drehrad-box' }, svg, anzeige), el('button', { class: 'cl-rund', type: 'button', onclick: () => drehen(1) }, '⟳')),
        slots,
        el('div', { class: 'cl-zeile mitte' },
          el('button', { class: 'cl-knopf zart', type: 'button', onclick: () => { folge.length = 0; malen(); } }, 'Neu'),
          el('button', { class: 'cl-knopf', type: 'button', onclick: async () => {
            if (folge.length >= 3) return;
            folge.push(wert);
            api.ton('klick');
            malen();
            if (folge.length === 3) { const r = await api.loesen(folge.slice()); if (!r.richtig) setTimeout(() => { folge.length = 0; malen(); }, 700); }
          } }, 'Einrasten')));
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a.map(Number), l),
  };

  // ---------------------------------------------------------------- Spieluhr (Melodie merken)
  const NOTEN = [262, 330, 392, 494, 587];
  M.melodie = {
    name: 'Spieluhr', kurz: 'Eine Melodie hören und auf fünf Tasten nachspielen.', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const n = [4, 5, 6, 8][S(stufe)];
      const folge = [];
      while (folge.length < n) { const t = r.zahl(0, 4); if (folge[folge.length - 1] !== t || r() < 0.2) folge.push(t); }
      return { p: { folge }, loesung: folge, hilfen: ['Hör dir die Melodie mehrmals an.', `Die ersten Töne: ${folge.slice(0, 2).map((t) => t + 1).join(' – ')} (Tasten von links).`, `Die Folge: ${folge.slice(0, Math.ceil(n / 2) + 1).map((t) => t + 1).join(' – ')} …`] };
    },
    ansicht(p, api) {
      const eingabeFolge = [];
      const punkte = el('div', { class: 'cl-melodie-punkte' });
      const malenPunkte = () => punkte.replaceChildren(...p.folge.map((_, i) => el('span', { class: 'cl-mp' + (i < eingabeFolge.length ? ' voll' : '') })));
      const tasten = NOTEN.map((f, i) => el('button', { class: 'cl-taste t' + i, type: 'button', onclick: async () => {
        Clavis.klang.piep(f, 0.4);
        leuchten(i);
        eingabeFolge.push(i);
        malenPunkte();
        if (eingabeFolge[eingabeFolge.length - 1] !== p.folge[eingabeFolge.length - 1]) { setTimeout(() => { api.ton('falsch'); eingabeFolge.length = 0; malenPunkte(); }, 300); return; }
        if (eingabeFolge.length === p.folge.length) { const r = await api.loesen(eingabeFolge.slice()); if (!r.richtig) { eingabeFolge.length = 0; malenPunkte(); } }
      } }));
      const leuchten = (i) => { tasten[i].classList.add('an'); setTimeout(() => tasten[i].classList.remove('an'), 280); };
      const vorspielen = () => { eingabeFolge.length = 0; malenPunkte(); p.folge.forEach((t, i) => setTimeout(() => { Clavis.klang.piep(NOTEN[t], 0.4); leuchten(t); }, 300 + i * 520)); };
      malenPunkte();
      return el('div', { class: 'cl-mech melodie' }, el('button', { class: 'cl-knopf zart', type: 'button', onclick: vorspielen }, '▶ Vorspielen'), el('div', { class: 'cl-tasten' }, tasten), punkte);
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a, l),
  };

  // ---------------------------------------------------------------- Standuhr (Zeit stellen)
  M.uhr = {
    name: 'Standuhr', kurz: 'Die Zeiger einer Uhr auf die richtige Zeit stellen – ein Rätsel verrät sie.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Rätsel, das auf eine Uhrzeit führt', art: 'text' }, { k: 'zeit', titel: 'Uhrzeit (z. B. 7:45; volle 5 Minuten)', art: 'text' }],
    ohneInhalt(r) {
      const h = r.zahl(1, 12);
      const m = r.zahl(0, 11) * 5;
      const d = r.zahl(1, 3);
      const dm = r.wahl([0, 15, 30, 45]);
      let hv = h - d;
      let mv = m - dm;
      if (mv < 0) { mv += 60; hv -= 1; }
      hv = ((hv - 1 + 24) % 12) + 1;
      return { raetsel: `Die Uhr blieb stehen, als es geschah. Der Zeuge sah um ${hv}:${String(mv).padStart(2, '0')} Uhr noch Licht – das war ${d} Stunde${d > 1 ? 'n' : ''}${dm ? ` und ${dm} Minuten` : ''} vorher.`, zeit: `${h}:${String(m).padStart(2, '0')}` };
    },
    bauen(inh) {
      const m = String(inh.zeit || '').match(/(\d{1,2})[:.h ](\d{2})/);
      const raetsel = txt(inh.raetsel, 400);
      if (!m || !raetsel) return null;
      let h = Number(m[1]) % 12 || 12;
      const min = Math.round(Number(m[2]) / 5) * 5 % 60;
      return { p: { raetsel }, loesung: `${h}:${String(min).padStart(2, '0')}`, hilfen: ['Der kurze Zeiger zeigt die Stunde, der lange die Minuten.', `Die Stunde ist ${h}.`, `Es ist ${h}:${String(min).padStart(2, '0')} – fast.`.replace('– fast.', '')] };
    },
    ansicht(p, api) {
      let h = 12;
      let m = 0;
      const svg = el('svg', { viewBox: '-100 -100 200 200', class: 'cl-uhr' });
      svg.append(el('circle', { r: 94, class: 'cl-uhr-rand' }));
      for (let i = 1; i <= 12; i++) { const w = (i / 12) * Math.PI * 2 - Math.PI / 2; svg.append(el('text', { x: Math.cos(w) * 74, y: Math.sin(w) * 74 + 6, 'text-anchor': 'middle', class: 'cl-uhr-zahl' }, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i - 1])); }
      const sz = el('line', { x1: 0, y1: 8, x2: 0, y2: -44, class: 'cl-uhr-stunde' });
      const mz = el('line', { x1: 0, y1: 12, x2: 0, y2: -66, class: 'cl-uhr-minute' });
      svg.append(sz, mz, el('circle', { r: 5, class: 'cl-uhr-mitte' }));
      const anzeige = el('div', { class: 'cl-klein' });
      const malen = () => { sz.setAttribute('transform', `rotate(${(h % 12) * 30 + m / 2})`); mz.setAttribute('transform', `rotate(${m * 6})`); anzeige.textContent = ''; };
      const stellen = (dh, dm) => { m += dm; if (m >= 60) { m -= 60; dh += 1; } if (m < 0) { m += 60; dh -= 1; } h = ((h - 1 + dh + 120) % 12) + 1; api.ton('rad'); malen(); };
      malen();
      return el('div', { class: 'cl-mech uhr' }, aufgabe(p.raetsel), svg, anzeige,
        el('div', { class: 'cl-uhr-knoepfe' },
          el('div', {}, el('span', { class: 'cl-leise' }, 'Stunde '), el('button', { class: 'cl-rund klein', type: 'button', onclick: () => stellen(-1, 0) }, '−'), el('button', { class: 'cl-rund klein', type: 'button', onclick: () => stellen(1, 0) }, '+')),
          el('div', {}, el('span', { class: 'cl-leise' }, 'Minute '), el('button', { class: 'cl-rund klein', type: 'button', onclick: () => stellen(0, -5) }, '−'), el('button', { class: 'cl-rund klein', type: 'button', onclick: () => stellen(0, 5) }, '+'))),
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(`${h}:${String(m).padStart(2, '0')}`) }, 'Zeit stellen'));
    },
    pruefen: (p, l, a) => String(a).trim() === l,
  };

  // ---------------------------------------------------------------- Buchstabensalat (Anagramm)
  M.anagramm = {
    name: 'Buchstabensalat', kurz: 'Durcheinandergewürfelte Buchstaben zu einem Begriff ordnen.', stoff: true,
    felder: [{ k: 'wort', titel: 'Begriff (4–10 Buchstaben)', art: 'wort' }, { k: 'hinweis', titel: 'Kleiner Hinweis zum Begriff (optional)', art: 'text' }],
    bauen(inh, stufe, r) {
      const w = wortAus(inh.wort, 4, 10);
      if (!w) return null;
      let b = r.mischen([...w]);
      for (let i = 0; i < 6 && b.join('') === w; i++) b = r.mischen([...w]);
      const s = S(stufe);
      return { p: { buchstaben: b, hinweis: s <= 1 ? txt(inh.hinweis, 160) : '' }, loesung: w, hilfen: [txt(inh.hinweis, 160) || `Es ist ein Begriff mit ${w.length} Buchstaben.`, `Er beginnt mit ${w[0]}.`, `Er beginnt mit ${w.slice(0, Math.ceil(w.length / 2))}…`] };
    },
    ansicht(p, api) {
      const frei = p.buchstaben.map((b, i) => ({ b, i, weg: false }));
      const gelegt = [];
      const oben = el('div', { class: 'cl-anagramm-ziel' });
      const unten = el('div', { class: 'cl-anagramm-pool' });
      const malen = () => {
        oben.replaceChildren(...p.buchstaben.map((_, j) => (gelegt[j] ? el('button', { class: 'cl-stein gelegt', type: 'button', onclick: () => { const x = gelegt.splice(j, 1)[0]; x.weg = false; api.ton('klick'); malen(); } }, gelegt[j].b) : el('span', { class: 'cl-stein platz' }))));
        unten.replaceChildren(...frei.map((x) => el('button', { class: 'cl-stein' + (x.weg ? ' weg' : ''), type: 'button', disabled: x.weg, onclick: async () => {
          x.weg = true;
          gelegt.push(x);
          api.ton('rad');
          malen();
          if (gelegt.length === p.buchstaben.length) { const r = await api.loesen(gelegt.map((y) => y.b).join('')); if (!r.richtig) { gelegt.forEach((y) => { y.weg = false; }); gelegt.length = 0; setTimeout(malen, 500); } }
        } }, x.b)));
      };
      malen();
      return el('div', { class: 'cl-mech anagramm' }, p.hinweis ? aufgabe(p.hinweis) : null, oben, unten);
    },
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Schatzkarte (Wegbeschreibung)
  const RICHTUNG = [['Norden', 0, -1], ['Osten', 1, 0], ['Süden', 0, 1], ['Westen', -1, 0]];
  M.karte = {
    name: 'Schatzkarte', kurz: 'Eine Karte mit Landmarken und einer Wegbeschreibung – grab an der richtigen Stelle.', stoff: false, felder: [],
    bauen(inh, stufe, r, k) {
      const s = S(stufe);
      const n = [5, 6, 7, 8][s];
      const marken = r.mischen(((Clavis.WELTEN[k && k.welt] || {}).objekte || ['anker', 'kompass', 'truhe', 'laterne', 'fass', 'statue']).filter((x) => Clavis.ICONS[x])).slice(0, [3, 4, 5, 6][s]);
      const NAMEN = { anker: 'Anker', kompass: 'Kompass', truhe: 'Truhe', laterne: 'Laterne', fass: 'Fass', statue: 'Statue', flasche: 'Flasche', steuerrad: 'Steuerrad', karte: 'Karte' };
      for (let versuch = 0; versuch < 300; versuch++) {
        const orte = [];
        const belegt = new Set();
        for (const m of marken) { let x; let y; do { x = r.zahl(0, n - 1); y = r.zahl(0, n - 1); } while (belegt.has(`${x},${y}`)); belegt.add(`${x},${y}`); orte.push({ icon: m, name: NAMEN[m] || (m[0].toUpperCase() + m.slice(1)), x, y }); }
        const start = orte[0];
        let x = start.x;
        let y = start.y;
        const schritte = [];
        let ok = true;
        for (let i = 0; i < [2, 3, 4, 5][s]; i++) {
          const moegl = RICHTUNG.flatMap(([name, dx, dy]) => [1, 2, 3].map((w) => [name, dx * w, dy * w, w])).filter(([, dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < n && y + dy < n && !(schritte.length && schritte[schritte.length - 1][0] === RICHTUNG.find((q) => q[1] === -Math.sign(dx) && q[2] === -Math.sign(dy))?.[0]));
          if (!moegl.length) { ok = false; break; }
          const [name, dx, dy, w] = r.wahl(moegl);
          x += dx; y += dy;
          schritte.push([name, w]);
        }
        if (!ok || belegt.has(`${x},${y}`)) continue;
        const text = `Beginne bei der Markierung „${start.name}“.\n` + schritte.map(([name, w]) => `${w} ${w === 1 ? 'Feld' : 'Felder'} nach ${name}.`).join('\n') + '\nDort grabe.';
        return { p: { n, orte }, loesung: `${x},${y}`, zettel: { titel: 'Wegbeschreibung', text }, hilfen: ['Norden ist oben. Zähle die Felder ab dem Startpunkt.', `Der Start ist „${start.name}“.`, `Das Ziel liegt in Spalte ${x + 1}.`] };
      }
      return null;
    },
    ansicht(p, api) {
      let wahl = null;
      const zellen = [];
      for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
        const o = p.orte.find((q) => q.x === x && q.y === y);
        const z = el('button', { class: 'cl-kartenzelle' + (o ? ' marke' : ''), type: 'button', title: o ? o.name : '', onclick: () => { wahl = `${x},${y}`; zellen.forEach((c) => c.classList.remove('gewaehlt')); z.classList.add('gewaehlt'); api.ton('klick'); } }, o ? Clavis.icon(o.icon) : null);
        zellen.push(z);
      }
      return el('div', { class: 'cl-mech karte' },
        el('div', { class: 'cl-karte-rahmen' }, el('div', { class: 'cl-windrose' }, 'N'), el('div', { class: 'cl-kartenfeld', style: { gridTemplateColumns: `repeat(${p.n}, 1fr)` } }, zellen)),
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => (wahl ? api.loesen(wahl) : null) }, 'Hier graben'));
    },
    pruefen: (p, l, a) => String(a) === l,
  };

  // ---------------------------------------------------------------- Bitschalter (Binärzahl)
  M.binaer = {
    name: 'Bitschalter', kurz: 'Schalter mit Lampen 1, 2, 4, 8 …: die richtige Zahl einstellen.', stoff: true,
    felder: [{ k: 'raetsel', titel: 'Rätsel, das auf eine Zahl (1–255) führt', art: 'text' }, { k: 'zahl', titel: 'Die Zahl (1–255)', art: 'zahl' }],
    ohneInhalt(r, stufe) {
      const s = S(stufe);
      const z = r.zahl(s ? 20 : 5, [15, 63, 127, 255][s]);
      const a = r.zahl(2, 9);
      const raetsel = s <= 1 ? `Stelle die Zahl ${z} ein.` : z % a === 0 ? `Stelle ${a} × ${z / a} ein.` : `Stelle ${z + a} − ${a} ein.`;
      return { raetsel, zahl: z };
    },
    bauen(inh, stufe) {
      const z = Number(String(inh.zahl == null ? '' : inh.zahl).replace(/\D/g, ''));
      const raetsel = txt(inh.raetsel, 400);
      if (!raetsel || !Number.isInteger(z) || z < 1 || z > 255) return null;
      const s = S(stufe);
      const bits = Math.max(z.toString(2).length, [4, 6, 7, 8][s]);
      return { p: { raetsel, bits, summe: s === 0, werte: s <= 1 }, loesung: z, hilfen: ['Jeder Schalter hat einen Wert: 1, 2, 4, 8, 16 … von rechts.', `Die Lösung ist ${z}.`, `${z} = ${[...z.toString(2)].reverse().map((b, i) => (b === '1' ? 2 ** i : 0)).filter(Boolean).reverse().join(' + ')}`] };
    },
    ansicht(p, api) {
      const an = new Array(p.bits).fill(false);
      const summe = el('div', { class: 'cl-bit-summe' });
      const wert = () => an.reduce((s, b, i) => s + (b ? 2 ** (p.bits - 1 - i) : 0), 0);
      const schalter = an.map((_, i) => el('button', { class: 'cl-bit', type: 'button', onclick: () => { an[i] = !an[i]; schalter[i].classList.toggle('an', an[i]); api.ton('klick'); if (p.summe) summe.textContent = String(wert()); } },
        el('span', { class: 'cl-bit-lampe' }), p.werte ? el('small', {}, String(2 ** (p.bits - 1 - i))) : null, el('span', { class: 'cl-bit-hebel' })));
      if (p.summe) summe.textContent = '0';
      return el('div', { class: 'cl-mech binaer' }, aufgabe(p.raetsel), el('div', { class: 'cl-bits' }, schalter), summe,
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(wert()) }, 'Bestätigen'));
    },
    pruefen: (p, l, a) => Number(a) === l,
  };

  // ---------------------------------------------------------------- Prüfungsfrage (Wissen)
  M.wissen = {
    name: 'Prüfungsfrage', kurz: 'Eine Frage mit Antwortmöglichkeiten – eingemeißelt, gefunkt oder auf dem Bildschirm.', stoff: true,
    felder: [{ k: 'frage', titel: 'Frage', art: 'text' }, { k: 'optionen', titel: 'Antworten (3–4)', art: 'liste' }, { k: 'richtig', titel: 'Nummer der richtigen Antwort (ab 0)', art: 'zahl' }],
    bauen(inh, stufe, r) {
      const opt = (Array.isArray(inh.optionen) ? inh.optionen : []).map((o) => txt(String(o), 120)).filter(Boolean).slice(0, 4);
      const ri = Number(inh.richtig);
      const frage = txt(inh.frage, 300);
      if (!frage || opt.length < 2 || !Number.isInteger(ri) || !opt[ri] || new Set(opt).size !== opt.length) return null;
      const g = r.mischen(opt);
      const falsch = g.filter((o) => o !== opt[ri]);
      return { p: { frage, optionen: g }, loesung: g.indexOf(opt[ri]), hilfen: [`„${falsch[0]}“ ist es nicht.`, falsch[1] ? `„${falsch[1]}“ ist es auch nicht.` : `Die Antwort ist „${opt[ri]}“.`, `Die Antwort ist „${opt[ri]}“.`] };
    },
    ansicht(p, api) {
      const knoepfe = p.optionen.map((o, i) => el('button', { class: 'cl-option', type: 'button', onclick: async () => { knoepfe.forEach((k) => { k.disabled = true; }); const r = await api.loesen(i); knoepfe.forEach((k) => { k.disabled = false; }); if (!r.richtig) knoepfe[i].classList.add('falsch'); } }, el('span', { class: 'cl-option-zeichen' }, 'ABCD'[i]), o));
      return el('div', { class: 'cl-mech wissen' }, el('div', { class: 'cl-inschrift' }, p.frage), el('div', { class: 'cl-optionen' }, knoepfe));
    },
    pruefen: (p, l, a) => Number(a) === l,
  };

  // ---------------------------------------------------------------- Lückentext
  M.luecke = {
    name: 'Lückentext', kurz: 'In einem Satz fehlt ein Wort – nur das richtige öffnet das Schloss.', stoff: true,
    felder: [{ k: 'satz', titel: 'Satz mit ___ für die Lücke', art: 'text' }, { k: 'wort', titel: 'Fehlendes Wort', art: 'wort' }],
    bauen(inh) {
      const satz = txt(inh.satz, 300);
      const w = norm(inh.wort);
      if (!satz.includes('___') || w.length < 2 || w.length > 20) return null;
      return { p: { satz }, loesung: w, hilfen: [`Das Wort hat ${w.length} Buchstaben.`, `Es beginnt mit ${w[0]}.`, `Es beginnt mit ${w.slice(0, Math.ceil(w.length / 2))}…`] };
    },
    ansicht: (p, api) => el('div', { class: 'cl-mech luecke' }, el('div', { class: 'cl-inschrift' }, p.satz.split('___').flatMap((t, i) => (i ? [el('span', { class: 'cl-luecke' }, '?'), t] : [t]))), eingabe(api, { platz: 'Fehlendes Wort' })),
    pruefen: (p, l, a) => norm(a) === l,
  };

  // ---------------------------------------------------------------- Labyrinth
  const RICHT = { N: [0, -1, 1, 4], O: [1, 0, 2, 8], S: [0, 1, 4, 1], W: [-1, 0, 8, 2] };
  M.labyrinth = {
    name: 'Labyrinth', kurz: 'Ein Irrgarten: Führe die Figur zum Ausgang – mit Pfeiltasten, Wischen oder Tippen.', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [5, 7, 9, 11][s];
      const offen = new Array(n * n).fill(0);
      const besucht = new Array(n * n).fill(false);
      const stapel = [0];
      besucht[0] = true;
      while (stapel.length) {
        const c = stapel[stapel.length - 1];
        const x = c % n;
        const y = Math.floor(c / n);
        const nb = Object.values(RICHT).filter(([dx, dy]) => { const a = x + dx; const b = y + dy; return a >= 0 && b >= 0 && a < n && b < n && !besucht[b * n + a]; });
        if (!nb.length) { stapel.pop(); continue; }
        const [dx, dy, m1, m2] = r.wahl(nb);
        const ziel = (y + dy) * n + x + dx;
        offen[c] |= m1;
        offen[ziel] |= m2;
        besucht[ziel] = true;
        stapel.push(ziel);
      }
      return { p: { n, offen, nebel: s >= 3 }, loesung: null, hilfen: ['Halte dich immer an eine Wand – so findest du sicher hinaus.', 'Der Ausgang liegt unten rechts.', 'Sackgassen erkennst du früh: Kehr um, sobald es nicht weitergeht.'] };
    },
    ansicht(p, api) {
      let pos = 0;
      const weg = [];
      const groesse = 300;
      const z = groesse / p.n;
      const svg = el('svg', { viewBox: `-2 -2 ${groesse + 4} ${groesse + 4}`, class: 'cl-labyrinth' });
      const waende = [];
      for (let i = 0; i < p.n * p.n; i++) {
        const x = (i % p.n) * z;
        const y = Math.floor(i / p.n) * z;
        if (!(p.offen[i] & 1)) waende.push(`M${x} ${y}h${z}`);
        if (!(p.offen[i] & 8)) waende.push(`M${x} ${y}v${z}`);
        if (i % p.n === p.n - 1 && !(p.offen[i] & 2)) waende.push(`M${x + z} ${y}v${z}`);
        if (Math.floor(i / p.n) === p.n - 1 && !(p.offen[i] & 4)) waende.push(`M${x} ${y + z}h${z}`);
      }
      const spur = el('path', { class: 'cl-lab-spur', d: '' });
      const figur = el('circle', { r: z * 0.3, class: 'cl-lab-figur' });
      const nebel = p.nebel ? el('div', { class: 'cl-lab-nebel' }) : null;
      svg.append(el('rect', { x: groesse - z + 3, y: groesse - z + 3, width: z - 6, height: z - 6, rx: 4, class: 'cl-lab-ziel' }), spur, el('path', { d: waende.join(''), class: 'cl-lab-wand' }), figur);
      const mitte = (i) => [(i % p.n) * z + z / 2, Math.floor(i / p.n) * z + z / 2];
      const spurPunkte = [mitte(0)];
      const malen = () => {
        const [x, y] = mitte(pos);
        figur.setAttribute('cx', x);
        figur.setAttribute('cy', y);
        spur.setAttribute('d', 'M' + spurPunkte.map((q) => q.join(' ')).join('L'));
        if (nebel) nebel.style.background = `radial-gradient(circle at ${((x + 2) / (groesse + 4)) * 100}% ${((y + 2) / (groesse + 4)) * 100}%, transparent 0, transparent ${(z * 1.6 / (groesse + 4)) * 100}%, rgba(0, 0, 0, 0.97) ${(z * 2.6 / (groesse + 4)) * 100}%)`;
      };
      let fertig = false;
      const gehen = async (rich) => {
        if (fertig) return;
        const [dx, dy, m1] = RICHT[rich];
        if (!(p.offen[pos] & m1)) { api.ton('klick'); return; }
        pos += dy * p.n + dx;
        weg.push(rich);
        spurPunkte.push(mitte(pos));
        api.ton('rad');
        malen();
        if (pos === p.n * p.n - 1) { fertig = true; const r = await api.loesen(weg.slice()); if (!r.richtig) fertig = false; }
      };
      const tasten = (e) => { const r = { ArrowUp: 'N', ArrowRight: 'O', ArrowDown: 'S', ArrowLeft: 'W' }[e.key]; if (r && svg.isConnected) { e.preventDefault(); gehen(r); } else if (!svg.isConnected) document.removeEventListener('keydown', tasten); };
      document.addEventListener('keydown', tasten);
      let x0 = null;
      let y0 = null;
      svg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      svg.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; const dy = e.changedTouches[0].clientY - y0; if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) gehen(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'O' : 'W') : (dy > 0 ? 'S' : 'N')); x0 = null; });
      malen();
      const k = (r, t) => el('button', { class: 'cl-rund klein', type: 'button', onclick: () => gehen(r) }, t);
      return el('div', { class: 'cl-mech labyrinth' }, el('div', { class: 'cl-lab-box' }, svg, nebel), el('div', { class: 'cl-steuerkreuz' }, el('span'), k('N', '▲'), el('span'), k('W', '◀'), k('S', '▼'), k('O', '▶')),
        el('div', { class: 'cl-klein cl-leise', style: { textAlign: 'center' } }, 'Pfeiltasten, Wischen oder die Knöpfe – raus unten rechts.'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length > 5000) return false;
      let pos = 0;
      for (const r of a) { const d = RICHT[r]; if (!d || !(p.offen[pos] & d[2])) return false; pos += d[1] * p.n + d[0]; }
      return pos === p.n * p.n - 1;
    },
  };

  // ---------------------------------------------------------------- Gedächtnis (Memory)
  const MEMO_ICONS = ['schluessel', 'kerze', 'kompass', 'anker', 'telefon', 'globus', 'laterne', 'flasche', 'stern', 'teddy', 'ballon', 'muschel', 'kaktus', 'zylinder', 'hufeisen'];
  M.memory = {
    name: 'Gedächtnis', kurz: 'Karten aufdecken und Paare finden – Symbole oder Begriff ↔ Erklärung.', stoff: true,
    felder: [{ k: 'paare', titel: 'Paare (optional, 3–6): Begriff ↔ Erklärung – sonst Bildpaare', art: 'paare' }],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const paare = (Array.isArray(inh.paare) ? inh.paare : []).map((x) => ({ a: txt(x && x.links, 60), b: txt(x && x.rechts, 60) })).filter((x) => x.a && x.b);
      let karten;
      if (paare.length >= 3) {
        karten = r.mischen(paare).slice(0, [3, 4, 5, 6][s]).flatMap((x, i) => [{ paar: i, t: x.a }, { paar: i, t: x.b }]);
      } else {
        karten = r.mischen(MEMO_ICONS).slice(0, [4, 6, 8, 10][s]).flatMap((icon, i) => [{ paar: i, icon }, { paar: i, icon }]);
      }
      return { p: { karten: r.mischen(karten) }, loesung: null, hilfen: ['Merk dir, wo welche Karte liegt – auch die falschen.', 'Deck zuerst Karten auf, die du noch nicht kennst.', 'Gehe reihenweise vor.'] };
    },
    ansicht(p, api) {
      const offen = new Set();
      const gefunden = [];
      let wahl = [];
      let sperre = false;
      const karten = p.karten.map((c, i) => el('button', { class: 'cl-memo' + (c.t ? ' text' : ''), type: 'button', onclick: async () => {
        if (sperre || offen.has(i) || wahl.includes(i)) return;
        wahl.push(i);
        karten[i].classList.add('auf');
        api.ton('papier');
        if (wahl.length < 2) return;
        const [a, b] = wahl;
        if (p.karten[a].paar === p.karten[b].paar) {
          offen.add(a); offen.add(b); gefunden.push([a, b]);
          karten[a].classList.add('paar'); karten[b].classList.add('paar');
          api.ton('klick');
          wahl = [];
          if (offen.size === p.karten.length) await api.loesen(gefunden.slice());
        } else {
          sperre = true;
          setTimeout(() => { karten[a].classList.remove('auf'); karten[b].classList.remove('auf'); wahl = []; sperre = false; }, 900);
        }
      } }, el('span', { class: 'cl-memo-rueck' }, '?'), el('span', { class: 'cl-memo-vorn' }, c.icon ? Clavis.icon(c.icon) : c.t)));
      const spalten = p.karten.length <= 8 ? 4 : p.karten.length <= 12 ? 4 : 5;
      return el('div', { class: 'cl-mech memory' }, el('div', { class: 'cl-memofeld', style: { gridTemplateColumns: `repeat(${spalten}, 1fr)` } }, karten));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length * 2 !== p.karten.length) return false;
      const gesehen = new Set();
      for (const [x, y] of a) { if (gesehen.has(x) || gesehen.has(y) || x === y || !p.karten[x] || !p.karten[y] || p.karten[x].paar !== p.karten[y].paar) return false; gesehen.add(x); gesehen.add(y); }
      return true;
    },
  };

  // ---------------------------------------------------------------- Rohrleitung (Rohre drehen)
  const drehen = (m, k) => { let x = m; for (let i = 0; i < ((k % 4) + 4) % 4; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
  const GEGEN = { 1: 4, 2: 8, 4: 1, 8: 2 };
  function fliesst(p, dreh) {
    const n = p.n;
    const masken = p.formen.map((f, i) => drehen(f, dreh[i]));
    const start = p.start * n;
    if (!(masken[start] & 8)) return { ok: false, nass: new Set() };
    const nass = new Set([start]);
    const schlange = [start];
    while (schlange.length) {
      const c = schlange.shift();
      const x = c % n;
      const y = Math.floor(c / n);
      for (const [dx, dy, bit] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) {
        if (!(masken[c] & bit)) continue;
        const a = x + dx;
        const b = y + dy;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const z = b * n + a;
        if (!(masken[z] & GEGEN[bit]) || nass.has(z)) continue;
        nass.add(z);
        schlange.push(z);
      }
    }
    const ende = p.ende * n + n - 1;
    return { ok: nass.has(ende) && !!(masken[ende] & 2), nass };
  }
  M.rohre = {
    name: 'Rohrleitung', kurz: 'Rohrstücke drehen, bis es von links nach rechts durchfließt – Wasser, Strom oder Magie.', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [4, 5, 6, 7][s];
      for (let versuch = 0; versuch < 200; versuch++) {
        const start = r.zahl(0, n - 1);
        const ende = r.zahl(0, n - 1);
        // Zufälliger Weg (ohne Kreuzungen) von links nach rechts
        const weg = [start * n];
        const drin = new Set(weg);
        let schritte = 0;
        const suchen = () => {
          if (++schritte > 3000) return false;
          const c = weg[weg.length - 1];
          if (c === ende * n + n - 1) return true;
          const x = c % n;
          const y = Math.floor(c / n);
          for (const [dx, dy] of r.mischen([[1, 0], [0, 1], [0, -1], [-1, 0], [1, 0]])) {
            const a = x + dx;
            const b = y + dy;
            const z = b * n + a;
            if (a < 0 || b < 0 || a >= n || b >= n || drin.has(z)) continue;
            weg.push(z); drin.add(z);
            if (weg.length < n * n * 0.7 && suchen()) return true;
            weg.pop(); drin.delete(z);
          }
          return false;
        };
        if (!suchen() || weg.length < n + 1) continue;
        const formen = new Array(n * n).fill(0);
        const bitZu = (c, z) => { const d = z - c; return d === 1 ? 2 : d === -1 ? 8 : d === n ? 4 : 1; };
        weg.forEach((c, i) => {
          if (i === 0) formen[c] |= 8;
          if (i === weg.length - 1) formen[c] |= 2;
          if (i > 0) formen[c] |= bitZu(c, weg[i - 1]);
          if (i < weg.length - 1) formen[c] |= bitZu(c, weg[i + 1]);
        });
        for (let i = 0; i < n * n; i++) if (!formen[i]) formen[i] = r.wahl([5, 3, 3, 7, 5, 6]);
        const dreh = formen.map(() => r.zahl(0, 3));
        const p = { n, formen, start, ende, dreh };
        if (fliesst(p, dreh).ok) continue;
        return { p, loesung: null, hilfen: ['Beginne am Zufluss links und arbeite dich Stück für Stück vor.', 'Ecken führen um die Kurve – gerade Stücke weiter geradeaus.', 'Nicht jedes Rohrstück wird gebraucht.'] };
      }
      return null;
    },
    ansicht(p, api) {
      const dreh = p.dreh.slice();
      const n = p.n;
      const felder = p.formen.map((f, i) => {
        const b = el('button', { class: 'cl-rohr', type: 'button', onclick: async () => {
          dreh[i] = (dreh[i] + 1) % 4;
          b.style.setProperty('--d', `${dreh[i] * 90}deg`);
          api.ton('rad');
          malen();
        } }, el('svg', { viewBox: '0 0 40 40' },
          (f & 1) ? el('line', { x1: 20, y1: 20, x2: 20, y2: 0 }) : null, (f & 2) ? el('line', { x1: 20, y1: 20, x2: 40, y2: 20 }) : null,
          (f & 4) ? el('line', { x1: 20, y1: 20, x2: 20, y2: 40 }) : null, (f & 8) ? el('line', { x1: 20, y1: 20, x2: 0, y2: 20 }) : null,
          el('circle', { cx: 20, cy: 20, r: 4 })));
        b.style.setProperty('--d', `${dreh[i] * 90}deg`);
        return b;
      });
      let fertig = false;
      async function malen() {
        const r = fliesst(p, dreh);
        felder.forEach((b, i) => b.classList.toggle('nass', r.nass.has(i)));
        if (r.ok && !fertig) { fertig = true; const a = await api.loesen(dreh.slice()); if (!a.richtig) fertig = false; }
      }
      const feld = el('div', { class: 'cl-rohrfeld', style: { gridTemplateColumns: `repeat(${n}, 1fr)` } }, felder);
      const rahmen = el('div', { class: 'cl-rohr-rahmen' },
        el('div', { class: 'cl-rohr-quelle', style: { top: `${((p.start + 0.5) / n) * 100}%` } }), feld, el('div', { class: 'cl-rohr-senke', style: { top: `${((p.ende + 0.5) / n) * 100}%` } }));
      setTimeout(malen, 30);
      return el('div', { class: 'cl-mech rohre' }, el('div', { class: 'cl-klein cl-leise' }, 'Tippe ein Stück an, um es zu drehen. Der Fluss kommt von links und muss rechts ankommen.'), rahmen);
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.formen.length && a.every((x) => Number.isInteger(x) && x >= 0 && x < 4) && fliesst(p, a).ok,
  };

  // ---------------------------------------------------------------- Farbcode (Logik: Reihenfolge der Farben)
  const FARBEN = [['Rot', '#e5484d'], ['Blau', '#3b82f6'], ['Grün', '#22a06b'], ['Gelb', '#eab308'], ['Lila', '#a855f7']];
  function permutationen(n) { if (n === 1) return [[0]]; return permutationen(n - 1).flatMap((p) => [...Array(n).keys()].map((i) => [...p.slice(0, i), n - 1, ...p.slice(i)])); }
  M.farbcode = {
    name: 'Farbcode', kurz: 'Farbige Kristalle in die richtige Reihenfolge bringen – Hinweise verraten sie (Logikrätsel).', stoff: false, felder: [],
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 4, 5, 5][s];
      const farben = r.mischen(FARBEN).slice(0, n);
      const loesung = r.mischen([...Array(n).keys()]);
      const stelle = (perm, f) => perm.indexOf(f);
      const name = (f) => farben[f][0];
      const alle = [];
      for (let a = 0; a < n; a++) {
        for (let p2 = 0; p2 < n; p2++) {
          alle.push({ t: `${name(a)} steht an Stelle ${p2 + 1}.`, f: (q) => stelle(q, a) === p2, w: 3 });
          alle.push({ t: `${name(a)} steht nicht an Stelle ${p2 + 1}.`, f: (q) => stelle(q, a) !== p2, w: 1 });
        }
        alle.push({ t: `${name(a)} steht am Rand.`, f: (q) => [0, n - 1].includes(stelle(q, a)), w: 2 });
        alle.push({ t: `${name(a)} steht nicht am Rand.`, f: (q) => ![0, n - 1].includes(stelle(q, a)), w: 2 });
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          alle.push({ t: `${name(a)} steht weiter links als ${name(b)}.`, f: (q) => stelle(q, a) < stelle(q, b), w: 0 });
          if (a < b) {
            alle.push({ t: `${name(a)} und ${name(b)} stehen direkt nebeneinander.`, f: (q) => Math.abs(stelle(q, a) - stelle(q, b)) === 1, w: 0 });
            alle.push({ t: `${name(a)} und ${name(b)} stehen nicht nebeneinander.`, f: (q) => Math.abs(stelle(q, a) - stelle(q, b)) !== 1, w: 0 });
          }
        }
      }
      const wahr = r.mischen(alle.filter((x) => x.f(loesung)).filter((x) => s < 2 || x.w < 3));
      let moeglich = permutationen(n);
      const hinweise = [];
      while (moeglich.length > 1) {
        let beste = null;
        let wert = Infinity;
        for (const x of wahr) {
          if (x.benutzt) continue;
          const rest = moeglich.filter((q) => x.f(q)).length;
          if (rest === moeglich.length) continue;
          // Starke Hinweise zuerst (wenige, aber zum Kombinieren); reine Stellen-Angaben nur, wenn nötig
          const w2 = rest / moeglich.length + x.w * 0.15;
          if (w2 < wert) { beste = x; wert = w2; }
        }
        if (!beste) return null;
        beste.benutzt = true;
        moeglich = moeglich.filter((q) => beste.f(q));
        hinweise.push(beste.t);
      }
      return { p: { farben, hinweise: r.mischen(hinweise) }, loesung: loesung.map((f) => farben[f][0]), hilfen: ['Schreib dir die Stellen 1 bis ' + n + ' auf und streiche, was nicht geht.', `${name(loesung[0])} steht ganz links.`, `Die ersten beiden: ${name(loesung[0])}, ${name(loesung[1])}.`] };
    },
    ansicht(p, api) {
      const reihe = p.farben.map((f) => f[0]);
      let wahl = null;
      const zeile = el('div', { class: 'cl-kristalle' });
      const malen = () => zeile.replaceChildren(...reihe.map((name, i) => {
        const f = p.farben.find((x) => x[0] === name);
        return el('button', { class: 'cl-kristall' + (wahl === i ? ' gewaehlt' : ''), type: 'button', style: { '--f': f[1] }, onclick: () => {
          if (wahl == null) { wahl = i; } else { [reihe[wahl], reihe[i]] = [reihe[i], reihe[wahl]]; wahl = null; api.ton('rad'); }
          malen();
        } }, el('span', { class: 'cl-kristall-stein' }), el('small', {}, `${i + 1}. ${name}`));
      }));
      malen();
      return el('div', { class: 'cl-mech farbcode' }, el('div', { class: 'cl-spuren' }, el('b', {}, 'Hinweise'), el('ul', {}, p.hinweise.map((h) => el('li', {}, h)))),
        el('div', { class: 'cl-klein cl-leise' }, 'Tippe zwei Kristalle an, um sie zu tauschen.'), zeile,
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(reihe.slice()) }, 'Einsetzen'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} Kristallen sitzen richtig.` };
    },
  };

  /** Mechaniken ohne eigene Inhalte (Ersatz, wenn ein Inhalt nicht taugt, und für Bonusrätsel) */
  Clavis.OHNE_INHALT = ['schalter', 'schiebepuzzle', 'suchbild', 'melodie', 'karte', 'akte', 'zahlenschloss', 'tresor', 'uhr', 'binaer', 'labyrinth', 'memory', 'rohre', 'farbcode'];
})();
