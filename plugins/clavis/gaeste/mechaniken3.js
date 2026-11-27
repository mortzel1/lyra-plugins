'use strict';
/*
 * Clavis – noch mehr Rätsel zum Anfassen (25 Stück): Zahnräder, Stromkreis, Druckventile, Sternbild, Bildpuzzle, Fingerabdruck,
 * Schattenbild, Umfüllen, Symbol-Sudoku, Lichtfolge, Funkfrequenz, Fernrohr, Schlüsselbund, Spiegelschrift, Leitungsgewirr,
 * Farben mischen, Drehringe, Lecks stopfen, Zahlenreihe, Dominosteine, Hütchenspiel, Glocken, Sonar, Tastenfeld, Zerrissener Brief.
 * Alle bauen sich selbst (kein Lernstoff nötig). Welche Welt und welcher Gegenstand passen: passung.js.
 */
(() => {
  const { el, norm } = Clavis;
  const M = Clavis.MECHANIKEN;
  const S = (stufe) => ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 }[stufe] ?? 1);
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const svg = (inner, vb, attr = {}) => { const s = el('svg', { viewBox: vb, ...attr }); s.innerHTML = inner; return s; };
  const BUCHST = 'ABCDEFGH';

  // ================================================================ Zahnräder
  function zahnradPfad(rad, zaehne) {
    const pkt = [];
    for (let i = 0; i < zaehne * 4; i++) {
      const a = (i / (zaehne * 4)) * Math.PI * 2;
      const r = i % 4 < 2 ? rad : rad * 0.8;
      pkt.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    return `M${pkt.join('L')}Z`;
  }
  M.zahnraeder = {
    name: 'Zahnräder', kurz: 'Ein stillstehendes Getriebe: Zahnräder in der richtigen Größe auf die Achsen setzen, bis alles ineinandergreift.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const n = [3, 4, 5, 6][S(stufe)];
      const radien = [r.zahl(1, 4)];
      for (let i = 0; i < n; i++) radien.push(r.zahl(1, 4));
      const abstaende = radien.slice(1).map((x, i) => x + radien[i]);
      return { p: { antrieb: radien[0], abstaende }, loesung: radien.slice(1), hilfen: ['Zwei Räder greifen ineinander, wenn der Achsabstand genau beide Größen zusammen ist.', 'Fang beim Antrieb links an und arbeite dich Achse für Achse nach rechts.', `Das erste Rad hat Größe ${radien[1]}.`] };
    },
    ansicht(p, api) {
      const n = p.abstaende.length;
      const wahl = new Array(n).fill(0);
      const U = 16;
      const xs = [p.antrieb * U + 10];
      p.abstaende.forEach((d) => xs.push(xs[xs.length - 1] + d * U));
      const breite = xs[xs.length - 1] + 4 * U + 10;
      const flaeche = el('div', { class: 'cl-zahnrad-flaeche' });
      let fertig = false;
      const malen = () => {
        let ok = true;
        let inner = '';
        const rad = [p.antrieb, ...wahl];
        rad.forEach((g, i) => {
          const x = xs[i];
          const passt = i === 0 || (g && g + rad[i - 1] === p.abstaende[i - 1] && (i === 1 || rad[i - 1]));
          if (i > 0 && !passt) ok = false;
          inner += `<circle cx="${x}" cy="60" r="3" fill="#888"/>`;
          if (g) {
            const kette = rad.slice(0, i + 1).every((q, j) => j === 0 || (q && q + rad[j - 1] === p.abstaende[j - 1]));
            const dreh = kette ? `cl-dreht ${i % 2 ? 'links' : 'rechts'}` : '';
            inner += `<g transform="translate(${x} 60)"><g class="${dreh}" style="--d:${(g * 1.2).toFixed(1)}s"><path d="${zahnradPfad(g * U - 1, 5 + g * 3)}" class="zahnrad ${i === 0 ? 'antrieb' : passt ? 'passt' : 'falsch'}"/><circle r="${g * U * 0.35}" class="nabe"/></g></g>`;
          }
          if (i > 0) inner += `<text x="${(xs[i - 1] + x) / 2}" y="128" text-anchor="middle" class="abstand">${p.abstaende[i - 1]}</text><line x1="${xs[i - 1]}" y1="118" x2="${x}" y2="118" class="mass"/>`;
        });
        flaeche.replaceChildren(svg(inner, `0 -10 ${breite} 145`, { class: 'cl-zahnrad-svg' }));
        knoepfe.forEach((k, i) => { k.textContent = wahl[i] ? `Achse ${i + 1}: Größe ${wahl[i]}` : `Achse ${i + 1}: leer`; });
        if (ok && !fertig) { fertig = true; api.ton('einrasten'); setTimeout(async () => { const r = await api.loesen(wahl.slice()); if (!r.richtig) fertig = false; }, 900); }
      };
      const knoepfe = wahl.map((_, i) => el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { wahl[i] = (wahl[i] + 1) % 5; api.ton('rad'); malen(); } }));
      malen();
      return el('div', { class: 'cl-mech zahnraeder' }, el('div', { class: 'cl-leise klein' }, `Links der Antrieb (Größe ${p.antrieb}). Die Zahlen unten sind die Achsabstände. Tippe eine Achse an, um ein Rad aufzusetzen (Größe 1–4).`), flaeche, el('div', { class: 'cl-zeile mitte' }, knoepfe));
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a, l),
  };

  // ================================================================ Stromkreis
  const LOGIK = {
    und: { t: (a, b) => `${a} UND ${b}`, f: (x, y) => x && y },
    oder: { t: (a, b) => `${a} ODER ${b}`, f: (x, y) => x || y },
    nicht: { t: (a) => `NICHT ${a}`, f: (x) => !x },
    undnicht: { t: (a, b) => `${a} UND NICHT ${b}`, f: (x, y) => x && !y },
    xor: { t: (a, b) => `entweder ${a} ODER ${b}`, f: (x, y) => x !== y },
  };
  const lampeAn = (l, s) => LOGIK[l.typ].f(!!s[l.a], !!s[l.b]);
  M.schaltkreis = {
    name: 'Stromkreis', kurz: 'Ein Sicherungskasten mit Kippschaltern: Jede Lampe braucht ihre eigene Schaltung – alle Lampen müssen leuchten.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 4, 5, 6][s];
      const nl = [2, 3, 3, 4][s];
      const typen = [['und', 'oder', 'nicht'], ['und', 'oder', 'nicht', 'undnicht'], ['und', 'undnicht', 'xor', 'nicht'], ['undnicht', 'xor', 'und', 'nicht']][s];
      for (let v = 0; v < 200; v++) {
        const t = Array.from({ length: n }, () => (r() < 0.5 ? 1 : 0));
        const lampen = [];
        let schutz = 0;
        while (lampen.length < nl && schutz++ < 100) {
          const typ = r.wahl(typen); const a = r.zahl(0, n - 1); let b = r.zahl(0, n - 1); if (b === a) b = (a + 1) % n;
          const l = { typ, a, b };
          if (lampeAn(l, t) && !lampen.some((x) => gleich(x, l))) lampen.push(l);
        }
        if (lampen.length < nl) continue;
        const alleAus = new Array(n).fill(0); const alleAn = new Array(n).fill(1);
        if (lampen.every((l) => lampeAn(l, alleAus)) || lampen.every((l) => lampeAn(l, alleAn))) continue;
        return { p: { n, lampen }, loesung: null, hilfen: ['Lies jede Lampe einzeln: Welche Schalter müssen an, welche aus sein?', 'Fang mit einer Lampe an, die NICHT enthält – da ist klar, was aus sein muss.', `Schalter ${BUCHST[0]} muss ${t[0] ? 'an' : 'aus'} sein.`] };
      }
      return null;
    },
    ansicht(p, api) {
      const s = new Array(p.n).fill(0);
      let fertig = false;
      const lampen = p.lampen.map((l, i) => el('div', { class: 'cl-sk-lampe' }, el('i', { class: 'birne' }), el('span', {}, `Lampe ${i + 1}: `, el('b', {}, LOGIK[l.typ].t(BUCHST[l.a], BUCHST[l.b])))));
      const schalter = s.map((_, i) => el('button', { class: 'cl-kipp', type: 'button', onclick: () => { s[i] = 1 - s[i]; api.ton('einrasten'); malen(); } }, el('i'), el('b', {}, BUCHST[i])));
      const malen = () => {
        schalter.forEach((k, i) => k.classList.toggle('an', !!s[i]));
        let alle = true;
        lampen.forEach((d, i) => { const an = lampeAn(p.lampen[i], s); d.classList.toggle('an', an); if (!an) alle = false; });
        if (alle && !fertig) { fertig = true; setTimeout(async () => { const r = await api.loesen(s.slice()); if (!r.richtig) fertig = false; }, 700); }
      };
      malen();
      return el('div', { class: 'cl-mech schaltkreis' }, el('div', { class: 'cl-sk-lampen' }, lampen), el('div', { class: 'cl-sk-schalter' }, schalter), el('div', { class: 'cl-leise klein' }, 'Kipp die Schalter, bis alle Lampen gleichzeitig leuchten.'));
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.n && p.lampen.every((x) => lampeAn(x, a)),
  };

  // ================================================================ Druckventile
  M.ventile = {
    name: 'Druckventile', kurz: 'Mehrere Ventile, mehrere Anzeigen: Jedes Ventil drückt auf einige Anzeigen – alle Nadeln müssen genau auf ihre Marke.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const k = [2, 3, 3, 4][s];
      const g = [2, 2, 3, 3][s];
      const v = Array.from({ length: k }, () => r.zahl(0, 4));
      if (v.every((x) => x === 0)) v[0] = 2;
      const w = Array.from({ length: g }, () => { const z = Array.from({ length: k }, () => r.wahl([0, 1, 1, 2])); if (z.every((x) => !x)) z[r.zahl(0, k - 1)] = 1; return z; });
      const ziel = w.map((z) => z.reduce((a, x, i) => a + x * v[i], 0));
      if (ziel.some((x) => x === 0)) return M.ventile.bauen(inh, stufe, r);
      return { p: { w, ziel }, loesung: null, hilfen: ['Dreh ein Ventil nach dem anderen und schau, welche Anzeigen sich bewegen.', 'Manche Ventile wirken doppelt so stark auf eine Anzeige.', `Ventil ${BUCHST[0]} steht richtig auf ${v[0]}.`] };
    },
    ansicht(p, api) {
      const k = p.w[0].length;
      const v = new Array(k).fill(0);
      let fertig = false;
      const max = (j) => p.w[j].reduce((a, x) => a + x * 4, 0) || 1;
      const anzeigen = p.ziel.map((z, j) => el('div', { class: 'cl-manometer' }, svg('', '0 0 100 64'), el('small', {}, `Anzeige ${j + 1} · Ziel ${z}`)));
      const ventile = v.map((_, i) => el('div', { class: 'cl-ventil' }, el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => { v[i] = Math.max(0, v[i] - 1); api.ton('rad'); malen(); } }, '−'),
        el('div', { class: 'cl-ventil-rad' }, el('b', {}, '0')), el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => { v[i] = Math.min(4, v[i] + 1); api.ton('rad'); malen(); } }, '+'), el('small', {}, `Ventil ${BUCHST[i]}`)));
      const malen = () => {
        let alle = true;
        p.ziel.forEach((z, j) => {
          const wert = p.w[j].reduce((a, x, i) => a + x * v[i], 0);
          if (wert !== z) alle = false;
          const winkel = (w2) => -150 + (Math.min(w2, max(j)) / max(j)) * 120;
          const nadel = winkel(wert); const marke = winkel(z);
          anzeigen[j].querySelector('svg').innerHTML = `<path d="M10 58 A42 42 0 0 1 90 58" fill="none" stroke="#555" stroke-width="6"/><line x1="50" y1="58" x2="${50 + Math.cos((marke * Math.PI) / 180) * 44}" y2="${58 + Math.sin((marke * Math.PI) / 180) * 44}" stroke="#5fd39a" stroke-width="4"/>` +
            `<line x1="50" y1="58" x2="${50 + Math.cos((nadel * Math.PI) / 180) * 38}" y2="${58 + Math.sin((nadel * Math.PI) / 180) * 38}" stroke="${wert === z ? '#5fd39a' : '#ff6b6b'}" stroke-width="3" class="nadel"/><circle cx="50" cy="58" r="4" fill="#ddd"/><text x="50" y="44" text-anchor="middle" font-size="13" fill="#eee">${wert}</text>`;
          anzeigen[j].classList.toggle('ok', wert === z);
        });
        ventile.forEach((d, i) => { d.querySelector('b').textContent = v[i]; d.querySelector('.cl-ventil-rad').style.setProperty('--dreh', `${v[i] * 72}deg`); });
        if (alle && !fertig) { fertig = true; api.ton('zischen'); setTimeout(async () => { const r = await api.loesen(v.slice()); if (!r.richtig) fertig = false; }, 700); }
      };
      malen();
      return el('div', { class: 'cl-mech ventile' }, el('div', { class: 'cl-ventil-anzeigen' }, anzeigen), el('div', { class: 'cl-ventil-reihe' }, ventile), el('div', { class: 'cl-leise klein' }, 'Grün ist das Ziel. Probier aus, welches Ventil auf welche Anzeige wirkt.'));
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.w[0].length && p.ziel.every((z, j) => p.w[j].reduce((s, x, i) => s + x * a[i], 0) === z),
  };

  // ================================================================ Sternbild
  const STERNBILDER = ['Der Schlüssel', 'Die Krone', 'Der Wächter', 'Die Schlange', 'Der Anker', 'Das Auge', 'Die Waage', 'Der Pfeil'];
  M.sternbild = {
    name: 'Sternbild', kurz: 'Eine Sternkarte zeigt ein Sternbild – finde es am Himmel und verbinde die Sterne in der richtigen Reihenfolge.', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const k = [4, 5, 6, 7][s];
      const ablenker = [7, 9, 12, 15][s];
      const abstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const form = [];
      let v = 0;
      while (form.length < k && v++ < 500) { const q = [r.zahl(0, 36), r.zahl(0, 26)]; if (form.every((x) => abstand(x, q) >= 8)) form.push(q); }
      if (form.length < k) return null;
      const dx = r.zahl(4, 100 - 40); const dy = r.zahl(4, 70 - 30);
      const sterne = form.map(([x, y]) => [x + dx, y + dy]);
      v = 0;
      while (sterne.length < k + ablenker && v++ < 2000) { const q = [r.zahl(3, 97), r.zahl(3, 67)]; if (sterne.every((x) => abstand(x, q) >= 6)) sterne.push(q); }
      const ordnung = r.mischen(sterne.map((_, i) => i));
      const gemischt = ordnung.map((i) => sterne[i]);
      const loesung = form.map((_, i) => ordnung.indexOf(i));
      return { p: { sterne: gemischt, form, name: r.wahl(STERNBILDER) }, loesung, hilfen: ['Such zuerst die Form als Ganzes – Größe und Richtung sind wie auf der Karte.', 'Der Stern Nummer 1 ist auf der Karte am hellsten markiert.', 'Das Sternbild liegt eher ' + (form.reduce((a, q) => a + q[0] + dx, 0) / k < 50 ? 'links' : 'rechts') + ' am Himmel.'] };
    },
    ansicht(p, api) {
      const gewaehlt = [];
      const karte = svg(p.form.map(([x, y], i) => (i ? `<line x1="${p.form[i - 1][0] + 4}" y1="${p.form[i - 1][1] + 4}" x2="${x + 4}" y2="${y + 4}" class="linie"/>` : '')).join('') + p.form.map(([x, y], i) => `<circle cx="${x + 4}" cy="${y + 4}" r="${i ? 1.6 : 2.4}" class="stern${i ? '' : ' erster'}"/><text x="${x + 6.5}" y="${y + 3}" class="nr">${i + 1}</text>`).join(''), '0 0 46 36', { class: 'cl-sternkarte' });
      const himmel = el('div', { class: 'cl-himmel' });
      const malen = () => {
        const linien = gewaehlt.map((i, j) => (j ? `<line x1="${p.sterne[gewaehlt[j - 1]][0]}" y1="${p.sterne[gewaehlt[j - 1]][1]}" x2="${p.sterne[i][0]}" y2="${p.sterne[i][1]}" class="linie"/>` : '')).join('');
        himmel.replaceChildren(svg(linien + p.sterne.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${gewaehlt.includes(i) ? 1.8 : 1.3}" class="stern${gewaehlt.includes(i) ? ' an' : ''}" data-i="${i}"/><circle cx="${x}" cy="${y}" r="4" class="treffer" data-i="${i}"/>`).join(''), '0 0 100 70', { class: 'cl-himmel-svg' }));
      };
      himmel.addEventListener('click', async (e) => {
        const i = Number(e.target.dataset && e.target.dataset.i);
        if (Number.isNaN(i) || gewaehlt.includes(i)) return;
        gewaehlt.push(i);
        api.ton('klick');
        malen();
        if (gewaehlt.length === p.form.length) { const r = await api.loesen(gewaehlt.slice()); if (!r.richtig) { gewaehlt.length = 0; setTimeout(malen, 500); } }
      });
      malen();
      return el('div', { class: 'cl-mech sternbild' }, el('div', { class: 'cl-stern-zeile' }, el('div', { class: 'cl-stern-karte-rahmen' }, el('small', {}, `Sternkarte: ${p.name}`), karte),
        el('div', { class: 'cl-leise klein' }, 'Tippe die Sterne am Himmel in der Reihenfolge 1, 2, 3 … an.')), himmel,
      el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { gewaehlt.length = 0; malen(); } }, 'Neu anfangen'));
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a, l),
  };

  // ================================================================ Bildpuzzle (Kacheln drehen)
  let bildNr = 0;
  M.bildpuzzle = {
    name: 'Bildpuzzle', kurz: 'Ein Bild in verdrehten Kacheln (Gemälde, Mosaik, zerrissenes Foto): Kacheln drehen, bis das Bild wieder stimmt.', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const n = [3, 3, 4, 4][S(stufe)];
      const drehung = Array.from({ length: n * n }, () => r.zahl(0, 3));
      if (drehung.every((x) => !x)) drehung[0] = 1;
      return { p: { n, drehung }, loesung: null, hilfen: ['Fang mit den Ecken an – da hilft der Rand.', 'Achte auf Linien, die über mehrere Kacheln laufen (Horizont, Dächer, Kanten).', 'Der Himmel ist oben.'] };
    },
    ansicht(p, api) {
      const id = `cl-bild-${++bildNr}`;
      let inner = '';
      try { inner = (Clavis.Kino.AUSSEN[api.welt] || Clavis.Kino.AUSSEN.akademie)(false).svg; } catch (_) { inner = '<rect width="1600" height="900" fill="#345"/>'; }
      const d = p.drehung.slice();
      const kante = 900 / p.n;
      const quelle = svg(`<defs><g id="${id}">${inner}</g></defs>`, '0 0 1 1', { class: 'cl-bild-quelle' });
      let fertig = false;
      const kacheln = d.map((_, i) => {
        const x = 350 + (i % p.n) * kante; const y = Math.floor(i / p.n) * kante;
        const b = el('button', { class: 'cl-kachel', type: 'button', onclick: () => {
          if (fertig) return;
          d[i] = (d[i] + 1) % 4; api.ton('rad');
          b.style.setProperty('--dreh', `${d[i] * 90}deg`);
          if (d.every((q) => q === 0)) { fertig = true; raster.classList.add('fertig'); setTimeout(async () => { const r = await api.loesen(d.slice()); if (!r.richtig) { fertig = false; raster.classList.remove('fertig'); } }, 800); }
        } });
        b.append(svg(`<use href="#${id}"/>`, `${x} ${y} ${kante} ${kante}`, { preserveAspectRatio: 'xMidYMid slice' }));
        b.style.setProperty('--dreh', `${d[i] * 90}deg`);
        return b;
      });
      const raster = el('div', { class: 'cl-kacheln', style: { gridTemplateColumns: `repeat(${p.n}, 1fr)` } }, kacheln);
      return el('div', { class: 'cl-mech bildpuzzle' }, quelle, el('div', { class: 'cl-leise klein' }, 'Tippe eine Kachel an, um sie zu drehen.'), raster);
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.n * p.n && a.every((x) => x % 4 === 0),
  };

  // ================================================================ Fingerabdruck
  function abdruck(q) {
    let s = '';
    for (let i = 0; i < q.n; i++) {
      const luecke = q.brueche.find((b) => b[0] === i);
      const dash = luecke ? `stroke-dasharray="${luecke[1]} 5 400"` : '';
      if (q.typ === 0) s += `<path d="M${40 - 4 - i * 3} 92 L${40 - 4 - i * 3} ${50 - i * 1.5} Q${40 - 4 - i * 3} ${30 - i * 3.2 + q.kern} 40 ${30 - i * 3.2 + q.kern} Q${40 + 4 + i * 3} ${30 - i * 3.2 + q.kern} ${40 + 4 + i * 3} ${50 - i * 1.5} L${40 + 4 + i * 3} 92" ${dash}/>`;
      else if (q.typ === 1) s += `<ellipse cx="40" cy="${50 + q.kern}" rx="${3 + i * 3.4}" ry="${4.5 + i * 4.1}" ${dash}/>`;
      else s += `<path d="M4 ${76 - i * 6.5} Q40 ${50 - i * 7 + q.kern} 76 ${76 - i * 6.5}" ${dash}/>`;
    }
    return `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${s}</g>`;
  }
  M.fingerabdruck = {
    name: 'Fingerabdruck', kurz: 'Ein Fingerabdruck vom Tatort – welcher der Abdrücke auf den Karteikarten ist genau derselbe?', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const anzahl = [4, 5, 6, 6][s];
      const neu = () => ({ typ: r.zahl(0, 2), n: r.zahl(6, 9), kern: r.zahl(-4, 4), brueche: [[r.zahl(1, 5), r.zahl(10, 60)], [r.zahl(2, 7), r.zahl(10, 60)]] });
      const spur = neu();
      const kandidaten = [spur];
      while (kandidaten.length < anzahl) {
        const k = JSON.parse(JSON.stringify(spur));
        const art = r.zahl(0, s >= 2 ? 3 : 2);
        if (art === 0) k.typ = (k.typ + r.zahl(1, 2)) % 3;
        else if (art === 1) k.n += r.wahl([-1, 1]);
        else if (art === 2) k.brueche[r.zahl(0, 1)] = [r.zahl(1, 7), r.zahl(10, 60)];
        else k.kern += r.wahl([-3, 3]);
        if (!kandidaten.some((x) => gleich(x, k))) kandidaten.push(k);
      }
      const gemischt = r.mischen(kandidaten);
      return { p: { spur, kandidaten: gemischt }, loesung: gemischt.indexOf(spur), hilfen: ['Vergleich zuerst die Grundform: Schlaufe, Wirbel oder Bogen?', 'Zähl die Linien.', 'Achte auf die kleinen Unterbrechungen in den Linien.'] };
    },
    ansicht(p, api) {
      return el('div', { class: 'cl-mech fingerabdruck' },
        el('div', { class: 'cl-fa-spur' }, el('small', {}, 'Spur vom Tatort'), svg(abdruck(p.spur), '0 0 80 100', { class: 'cl-fa-svg spur' })),
        el('div', { class: 'cl-fa-karten' }, p.kandidaten.map((k, i) => el('button', { class: 'cl-fa-karte', type: 'button', onclick: async (e) => { const r = await api.loesen(i); if (!r.richtig) e.currentTarget && e.currentTarget.classList.add('nein'); } },
          svg(abdruck(k), '0 0 80 100', { class: 'cl-fa-svg' }), el('small', {}, `Karte ${i + 1}`)))));
    },
    pruefen: (p, l, a) => a === l,
  };

  // ================================================================ Schattenbild
  M.schattenbild = {
    name: 'Schattenbild', kurz: 'Eine Lampe wirft Schatten an die Wand – welcher Gegenstand wirft welchen Schatten?', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r, kontext) {
      const s = S(stufe);
      const runden = [2, 3, 3, 4][s];
      const opt = [3, 4, 4, 5][s];
      const welt = Clavis.WELTEN[(kontext && kontext.welt) || 'spuk'] || Clavis.WELTEN.spuk;
      const vorrat = r.mischen([...new Set(welt.objekte.concat(Object.keys(Clavis.ICONS)))].filter((x) => Clavis.ICONS[x] && x !== 'ausgang'));
      const R = [];
      for (let i = 0; i < runden; i++) {
        const optionen = r.mischen(vorrat).slice(0, opt);
        R.push({ optionen, ziel: r.zahl(0, opt - 1), dreh: s >= 2 ? r.wahl([-25, 20, 35, -40]) : 0, kipp: s >= 3 && r() < 0.5 });
      }
      return { p: { runden: R.map((x) => ({ optionen: x.optionen, schatten: x.optionen[x.ziel], dreh: x.dreh, kipp: x.kipp })) }, loesung: R.map((x) => x.ziel), hilfen: ['Achte auf die Umrisse, nicht auf Einzelheiten.', 'Manche Schatten sind gedreht oder gespiegelt.', `Der erste Schatten gehört zu: ${R[0].optionen[R[0].ziel]}.`] };
    },
    ansicht(p, api) {
      const antworten = [];
      const flaeche = el('div', { class: 'cl-schatten-flaeche' });
      const malen = () => {
        const i = antworten.length;
        const r = p.runden[i];
        if (!r) return;
        const d = Clavis.ICONS[r.schatten];
        flaeche.replaceChildren(
          el('div', { class: 'cl-schatten-wand' }, el('i', { class: 'lampe' }), svg(`<g transform="translate(12 12) rotate(${r.dreh}) scale(${r.kipp ? -1 : 1} 1) translate(-12 -12)"><path d="${d}" fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g>`, '0 0 24 24', { class: 'cl-schatten-svg' })),
          el('div', { class: 'cl-leise klein' }, `Schatten ${i + 1} von ${p.runden.length}: Welcher Gegenstand wirft ihn?`),
          el('div', { class: 'cl-schatten-optionen' }, r.optionen.map((o, j) => el('button', { class: 'cl-schatten-opt', type: 'button', onclick: async () => {
            antworten.push(j); api.ton('klick');
            if (antworten.length === p.runden.length) { const res = await api.loesen(antworten.slice()); if (!res.richtig) { antworten.length = 0; malen(); } } else malen();
          } }, Clavis.icon(o)))));
      };
      malen();
      return el('div', { class: 'cl-mech schattenbild' }, flaeche);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} Schatten richtig.` };
    },
  };

  // ================================================================ Umfüllen
  function umfuellSuche(kap, start) {
    const schluessel = (z) => z.join(',');
    const weite = new Map([[schluessel(start), 0]]);
    const schlange = [start];
    while (schlange.length) {
      const z = schlange.shift();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (i === j || !z[i] || z[j] === kap[j]) continue;
        const m = Math.min(z[i], kap[j] - z[j]);
        const n = z.slice(); n[i] -= m; n[j] += m;
        const k = schluessel(n);
        if (!weite.has(k)) { weite.set(k, weite.get(schluessel(z)) + 1); schlange.push(n); }
      }
    }
    const ziele = new Map();
    for (const [k, w] of weite) for (const v of k.split(',').map(Number)) if (v && !ziele.has(v)) ziele.set(v, w); else if (v && ziele.get(v) > w) ziele.set(v, w);
    return ziele;
  }
  M.umfuellen = {
    name: 'Umfüllen', kurz: 'Drei Gefäße ohne Messstriche (Fässer, Krüge, Kolben): durch Umgießen genau die verlangte Menge abmessen.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const [min, max] = [[2, 4], [3, 6], [5, 8], [6, 12]][s];
      for (let v = 0; v < 300; v++) {
        const B = r.zahl(7, 13); const m = r.zahl(3, B - 2); const k = r.zahl(2, m - 1);
        const ziele = umfuellSuche([B, m, k], [B, 0, 0]);
        const passend = [...ziele].filter(([t, w]) => w >= min && w <= max && t !== B && t !== m && t !== k && t !== B - m && t !== B - k);
        if (!passend.length) continue;
        const [ziel, schritte] = r.wahl(passend);
        return { p: { kap: [B, m, k], ziel }, loesung: null, hilfen: ['Umgießen geht nur, bis das eine Gefäß leer oder das andere voll ist.', 'Manchmal hilft es, ein Gefäß wieder zurückzugießen.', `Es geht in ${schritte} Schritten.`] };
      }
      return null;
    },
    ansicht(p, api) {
      let z = [p.kap[0], 0, 0];
      const zuege = [];
      let quelle = null;
      let fertig = false;
      const gefaesse = p.kap.map((kap, i) => el('button', { class: 'cl-gefaess', type: 'button', style: { '--h': `${40 + kap * 9}px` }, onclick: async () => {
        if (fertig) return;
        if (quelle == null) { if (!z[i]) return; quelle = i; malen(); return; }
        if (quelle === i) { quelle = null; malen(); return; }
        const m = Math.min(z[quelle], p.kap[i] - z[i]);
        if (m > 0) { z[quelle] -= m; z[i] += m; zuege.push([quelle, i]); api.ton('tropfen'); }
        quelle = null;
        malen();
        if (z.includes(p.ziel)) { fertig = true; setTimeout(async () => { const r = await api.loesen(zuege.slice()); if (!r.richtig) fertig = false; }, 700); }
      } }, el('div', { class: 'cl-gefaess-koerper' }, el('i', { class: 'fuellung' })), el('b', {}, ''), el('small', {}, `fasst ${kap}`)));
      const zaehler = el('div', { class: 'cl-leise klein' });
      const malen = () => {
        gefaesse.forEach((g, i) => { g.querySelector('.fuellung').style.height = `${(z[i] / p.kap[i]) * 100}%`; g.querySelector('b').textContent = `${z[i]}`; g.classList.toggle('quelle', quelle === i); g.classList.toggle('ziel', z[i] === p.ziel); });
        zaehler.textContent = `${zuege.length} Mal umgegossen · ${quelle == null ? 'Tippe ein Gefäß an, aus dem du gießen willst.' : 'Und jetzt das Gefäß, in das du gießt.'}`;
      };
      malen();
      return el('div', { class: 'cl-mech umfuellen' }, el('div', { class: 'cl-aufgabe' }, `Miss genau ${p.ziel} ab – in einem der Gefäße. Am Anfang ist das größte voll.`), el('div', { class: 'cl-gefaesse' }, gefaesse), zaehler,
        el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { z = [p.kap[0], 0, 0]; zuege.length = 0; quelle = null; fertig = false; malen(); } }, 'Alles zurückgießen'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length > 500 || !a.every((x) => Array.isArray(x) && x.length === 2)) return false;
      const z = [p.kap[0], 0, 0];
      for (const [i, j] of a) { if (![0, 1, 2].includes(i) || ![0, 1, 2].includes(j) || i === j) return false; const m = Math.min(z[i], p.kap[j] - z[j]); z[i] -= m; z[j] += m; }
      return z.includes(p.ziel);
    },
  };

  // ================================================================ Symbol-Sudoku (4×4)
  const sudokuOk = (g) => {
    for (let i = 0; i < 4; i++) {
      const zeile = [0, 1, 2, 3].map((j) => g[i * 4 + j]); const spalte = [0, 1, 2, 3].map((j) => g[j * 4 + i]);
      const bx = (i % 2) * 2; const by = Math.floor(i / 2) * 2; const block = [g[by * 4 + bx], g[by * 4 + bx + 1], g[(by + 1) * 4 + bx], g[(by + 1) * 4 + bx + 1]];
      for (const l of [zeile, spalte, block]) if (new Set(l).size !== 4 || l.some((x) => !x)) return false;
    }
    return true;
  };
  function sudokuZaehlen(g, max = 2) {
    const i = g.indexOf(0);
    if (i < 0) return sudokuOk(g) ? 1 : 0;
    let n = 0;
    for (let v = 1; v <= 4 && n < max; v++) {
      const r = Math.floor(i / 4); const c = i % 4;
      const bx = c - (c % 2); const by = r - (r % 2);
      let frei = true;
      for (let k = 0; k < 4; k++) if (g[r * 4 + k] === v || g[k * 4 + c] === v) frei = false;
      for (const [y, x] of [[by, bx], [by, bx + 1], [by + 1, bx], [by + 1, bx + 1]]) if (g[y * 4 + x] === v) frei = false;
      if (!frei) continue;
      g[i] = v; n += sudokuZaehlen(g, max - n); g[i] = 0;
    }
    return n;
  }
  const SUDOKU_ZEICHEN = { alt: ['☀', '☾', '𓂀', '🐍'], technik: ['◆', '●', '▲', '■'], bunt: ['🍎', '🍋', '🍇', '🍓'], see: ['⚓', '☠', '⚔', '🧭'], west: ['★', '🐎', '🌵', '🔔'], haus: ['♠', '♥', '♦', '♣'] };
  M.symbolsudoku = {
    name: 'Symbol-Sudoku', kurz: 'Ein Feld aus 4×4 Kacheln: In jeder Reihe, jeder Spalte und jedem Viererblock darf jedes Zeichen genau einmal vorkommen.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r, kontext) {
      const leer = [6, 8, 10, 11][S(stufe)];
      const basis = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
      const zahlen = r.mischen([1, 2, 3, 4]);
      let g = basis.map((v) => zahlen[v - 1]);
      if (r() < 0.5) g = [0, 1, 2, 3].flatMap((c) => [0, 1, 2, 3].map((rr) => g[rr * 4 + c]));
      const loesung = g.slice();
      const raetsel = g.slice();
      for (const i of r.mischen([...Array(16).keys()])) {
        if (raetsel.filter((x) => !x).length >= leer) break;
        const alt = raetsel[i]; raetsel[i] = 0;
        if (sudokuZaehlen(raetsel.slice()) !== 1) raetsel[i] = alt;
      }
      const gruppe = (Clavis.GRUPPE && Clavis.GRUPPE[kontext && kontext.welt]) || 'haus';
      return { p: { gitter: raetsel, zeichen: SUDOKU_ZEICHEN[gruppe] || SUDOKU_ZEICHEN.haus }, loesung, hilfen: ['Such eine Reihe, in der nur noch ein Zeichen fehlt.', 'Die Viererblöcke sind die vier Ecken des Feldes.', `Oben links gehört: ${(SUDOKU_ZEICHEN[gruppe] || SUDOKU_ZEICHEN.haus)[loesung[0] - 1]}.`] };
    },
    ansicht(p, api) {
      const g = p.gitter.slice();
      const felder = g.map((v, i) => el('button', { class: 'cl-sudoku-feld' + (p.gitter[i] ? ' fest' : ''), type: 'button', disabled: !!p.gitter[i], onclick: () => { g[i] = (g[i] + 1) % 5; api.ton('klick'); malen(); } }));
      const malen = () => felder.forEach((f, i) => { f.textContent = g[i] ? p.zeichen[g[i] - 1] : ''; });
      malen();
      return el('div', { class: 'cl-mech symbolsudoku' }, el('div', { class: 'cl-leise klein' }, 'Tippe ein leeres Feld an, um ein Zeichen einzusetzen (nochmal tippen: nächstes Zeichen).'),
        el('div', { class: 'cl-sudoku' }, felder), el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(g.slice()) }, 'Einsetzen'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== 16) return false;
      if (p.gitter.some((v, i) => v && v !== a[i])) return false;
      return sudokuOk(a) ? true : { richtig: false, info: a.some((x) => !x) ? 'Es sind noch Felder leer.' : 'Irgendwo kommt ein Zeichen doppelt vor.' };
    },
  };

  // ================================================================ Lichtfolge (Simon)
  const LICHTFARBEN = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
  M.lichtfolge = {
    name: 'Lichtfolge', kurz: 'Lampen leuchten in einer Folge auf, die jede Runde länger wird – merk sie dir und tipp sie nach.', stoff: false, felder: [], art: 'gedaechtnis',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const k = [4, 4, 6, 6][s];
      const folge = Array.from({ length: [4, 5, 6, 7][s] }, () => r.zahl(0, k - 1));
      return { p: { k, folge }, loesung: folge, hilfen: ['Sprich die Farben leise mit.', `Die Folge beginnt mit Lampe ${folge[0] + 1}.`, `Die ersten drei: ${folge.slice(0, 3).map((x) => x + 1).join(' – ')}.`] };
    },
    ansicht(p, api) {
      let runde = Math.min(3, p.folge.length);
      let eingabe = [];
      let zeigt = false;
      const tonVon = (i) => 330 * Math.pow(2, i / 5);
      const lampen = Array.from({ length: p.k }, (_, i) => el('button', { class: 'cl-lf-lampe', type: 'button', style: { '--f': LICHTFARBEN[i] }, onclick: async () => {
        if (zeigt) return;
        leuchten(i);
        eingabe.push(i);
        if (eingabe[eingabe.length - 1] !== p.folge[eingabe.length - 1]) { api.ton('falsch'); eingabe = []; status.textContent = 'Falsch – schau nochmal hin.'; setTimeout(vorspielen, 900); return; }
        if (eingabe.length === runde) {
          if (runde === p.folge.length) { const r = await api.loesen(eingabe.slice()); if (!r.richtig) { eingabe = []; } return; }
          runde++; eingabe = []; status.textContent = 'Richtig! Die Folge wird länger …'; setTimeout(vorspielen, 900);
        }
      } }));
      const status = el('div', { class: 'cl-leise klein' }, `Merk dir die Folge – es geht bis ${p.folge.length} Lichter.`);
      const leuchten = (i) => { lampen[i].classList.add('an'); Clavis.klang.tonHoehe && Clavis.klang.tonHoehe(tonVon(i), 0.3); setTimeout(() => lampen[i].classList.remove('an'), 380); };
      const vorspielen = () => { zeigt = true; eingabe = []; p.folge.slice(0, runde).forEach((x, j) => setTimeout(() => leuchten(x), 400 + j * 620)); setTimeout(() => { zeigt = false; status.textContent = `Runde ${runde - Math.min(3, p.folge.length) + 1}: Tipp die ${runde} Lichter nach.`; }, 400 + runde * 620); };
      return el('div', { class: 'cl-mech lichtfolge' }, el('div', { class: 'cl-lf-feld', style: { gridTemplateColumns: `repeat(${p.k > 4 ? 3 : 2}, 1fr)` } }, lampen), status,
        el('button', { class: 'cl-knopf zart', type: 'button', onclick: vorspielen }, '▶ Folge zeigen'));
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a, l),
  };

  // ================================================================ Funkfrequenz
  const BOTSCHAFTEN = ['HIER SPRICHT DIE ZENTRALE. DER WEG IST FREI.', 'WIR HOEREN EUCH. HALTET DURCH.', 'NOTRUF ERHALTEN. TUER WIRD ENTRIEGELT.', 'ACHTUNG. NUR NOCH WENIG ZEIT.', 'DAS SIGNAL IST KLAR. ENDE.'];
  M.funkfrequenz = {
    name: 'Funkfrequenz', kurz: 'Ein Funkgerät rauscht: am Drehknopf die Frequenz suchen, bis die Botschaft klar zu lesen ist – dann senden.', stoff: false, felder: [], art: 'hoeren',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const ziel = r.zahl(880, 1070);
      return { p: { ziel, toleranz: [8, 5, 3, 2][s], botschaft: r.wahl(BOTSCHAFTEN) }, loesung: null, hilfen: ['Je näher du an der Frequenz bist, desto mehr Buchstaben werden lesbar.', 'Dreh erst grob, dann mit den Pfeilen fein.', `Die Frequenz liegt zwischen ${Math.floor((ziel - 30) / 10)} und ${Math.ceil((ziel + 30) / 10)} MHz.`] };
    },
    ansicht(p, api) {
      let f = 980;
      const text = el('div', { class: 'cl-funk-text' });
      const anzeige = el('div', { class: 'cl-funk-frequenz' });
      const balken = el('div', { class: 'cl-funk-signal' }, el('i'));
      const welle = svg('', '0 0 200 40', { class: 'cl-funk-welle' });
      const rauschZeichen = '#%&@*~/\\|+=';
      const regler = el('input', { type: 'range', min: '870', max: '1080', value: String(f), class: 'cl-funk-regler', oninput: (e) => { f = Number(e.target.value); malen(); } });
      const senden = el('button', { class: 'cl-knopf', type: 'button', disabled: true, onclick: () => api.loesen(f) }, 'Senden');
      const malen = () => {
        const abw = Math.abs(f - p.ziel);
        const klar = Math.max(0, 1 - abw / 70);
        anzeige.textContent = `${(f / 10).toFixed(1).replace('.', ',')} MHz`;
        balken.firstChild.style.width = `${klar * 100}%`;
        text.textContent = [...p.botschaft].map((c) => (c === ' ' || Math.random() < klar * klar ? c : rauschZeichen[Math.floor(Math.random() * rauschZeichen.length)])).join('');
        const amp = 2 + (1 - klar) * 14;
        let d = 'M0 20';
        for (let x = 2; x <= 200; x += 2) d += ` L${x} ${(20 + Math.sin(x / 6) * 9 * klar + (Math.random() - 0.5) * amp).toFixed(1)}`;
        welle.innerHTML = `<path d="${d}" fill="none" stroke="${abw <= p.toleranz ? '#5fd39a' : '#9ad1ff'}" stroke-width="1.5"/>`;
        senden.disabled = abw > p.toleranz;
        text.classList.toggle('klar', abw <= p.toleranz);
      };
      const fein = (d) => { f = Math.max(870, Math.min(1080, f + d)); regler.value = String(f); api.ton('klick'); malen(); };
      malen();
      return el('div', { class: 'cl-mech funkfrequenz' }, el('div', { class: 'cl-funk-geraet' }, anzeige, welle, balken, text),
        el('div', { class: 'cl-zeile mitte' }, el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => fein(-1) }, '◀'), regler, el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => fein(1) }, '▶')), senden);
    },
    pruefen: (p, l, a) => typeof a === 'number' && Math.abs(a - p.ziel) <= p.toleranz,
  };

  // ================================================================ Fernrohr
  M.fernrohr = {
    name: 'Fernrohr', kurz: 'Durch ein Fernrohr (oder Teleskop, Periskop) die Gegend absuchen – irgendwo ist winzig ein Code zu sehen.', stoff: false, felder: [], art: 'erkunden',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const zeichen = '23456789ABCDEFHKMNPRTXZ';
      const code = Array.from({ length: [3, 3, 4, 4][s] }, () => zeichen[r.zahl(0, zeichen.length - 1)]).join('');
      const x = r.zahl(160, 1440); const y = r.zahl(140, 760);
      return { p: { code, x, y, groesse: [30, 24, 19, 16][s] }, loesung: code, hilfen: ['Zieh das Fernrohr langsam von links nach rechts, Reihe für Reihe – der Code ist hell geschrieben.', `Der Code liegt in der ${y < 450 ? 'oberen' : 'unteren'} Hälfte.`, `Der Code liegt ${x < 800 ? 'links' : 'rechts'} ${y < 450 ? 'oben' : 'unten'}.`] };
    },
    ansicht(p, api) {
      let inner = '';
      try { inner = (Clavis.Kino.AUSSEN[api.welt] || Clavis.Kino.AUSSEN.akademie)(false).svg; } catch (_) { inner = '<rect width="1600" height="900" fill="#345"/>'; }
      inner += `<text x="${p.x}" y="${p.y}" font-size="${p.groesse}" font-family="Menlo,monospace" font-weight="700" fill="#fff6c8" stroke="#000" stroke-width="0.6" paint-order="stroke" letter-spacing="2">${p.code}</text>`;
      const zoom = 3.2;
      let px = 800; let py = 450;
      const bild = svg(inner, '0 0 1600 900', { class: 'cl-fr-bild', preserveAspectRatio: 'xMidYMid slice' });
      const linse = el('div', { class: 'cl-fr-linse' }, bild, el('i', { class: 'cl-fr-fadenkreuz' }));
      const karte = svg(inner + '<rect class="cl-fr-ausschnitt" width="10" height="10"/>', '0 0 1600 900', { class: 'cl-fr-karte' });
      const setzen = () => {
        const w = linse.clientWidth || 260;
        const sicht = (1600 / zoom) * (w / w);
        px = Math.max(sicht / 2, Math.min(1600 - sicht / 2, px)); py = Math.max(sicht / 2 * 0.9, Math.min(900 - sicht / 2 * 0.9, py));
        bild.setAttribute('viewBox', `${px - sicht / 2} ${py - sicht / 2} ${sicht} ${sicht}`);
        const a = karte.querySelector('.cl-fr-ausschnitt'); a.setAttribute('x', px - sicht / 2); a.setAttribute('y', py - sicht / 2); a.setAttribute('width', sicht); a.setAttribute('height', sicht);
      };
      let ziehen = null;
      linse.addEventListener('pointerdown', (e) => { ziehen = [e.clientX, e.clientY]; linse.setPointerCapture(e.pointerId); });
      linse.addEventListener('pointermove', (e) => { if (!ziehen) return; const k = (1600 / zoom) / (linse.clientWidth || 260); px -= (e.clientX - ziehen[0]) * k; py -= (e.clientY - ziehen[1]) * k; ziehen = [e.clientX, e.clientY]; setzen(); });
      linse.addEventListener('pointerup', () => { ziehen = null; });
      karte.addEventListener('click', (e) => { const q = karte.getBoundingClientRect(); px = ((e.clientX - q.left) / q.width) * 1600; py = ((e.clientY - q.top) / q.height) * 900; setzen(); });
      setTimeout(setzen, 0);
      const feld = el('input', { class: 'cl-eingabe gross', placeholder: 'Code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
      return el('div', { class: 'cl-mech fernrohr' }, el('div', { class: 'cl-leise klein' }, 'Zieh im Fernrohr, um dich umzusehen – oder tippe auf die kleine Karte.'), el('div', { class: 'cl-fr-zeile' }, linse, karte),
        el('div', { class: 'cl-eingabe-zeile' }, feld, el('button', { class: 'cl-knopf', type: 'button', onclick: () => feld.value.trim() && api.loesen(feld.value) }, 'Prüfen')));
    },
    pruefen: (p, l, a) => norm(a) === norm(l),
  };

  // ================================================================ Schlüsselbund
  function schluesselSvg(zaehne) {
    let d = 'M30 26';
    zaehne.forEach((z, i) => { const x = 30 + i * 12; d += ` L${x} ${26 + z * 4} L${x + 8} ${26 + z * 4} L${x + 10} 26`; });
    d += ` L${30 + zaehne.length * 12 + 6} 26 L${30 + zaehne.length * 12 + 6} 18 L30 18 Z`;
    return `<circle cx="16" cy="22" r="13" fill="none" stroke="currentColor" stroke-width="5"/><path d="${d}" fill="currentColor"/>`;
  }
  M.schluessel = {
    name: 'Schlüsselbund', kurz: 'Ein Schloss und ein Bund ähnlicher Schlüssel – nur einer hat genau die richtigen Zähne.', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [4, 5, 5, 6][s];
      const schloss = Array.from({ length: n }, () => r.zahl(1, 4));
      const bund = [schloss];
      while (bund.length < [3, 4, 5, 6][s]) {
        const k = schloss.slice(); const m = s >= 2 ? 1 : r.zahl(1, 2);
        for (let j = 0; j < m; j++) { const i = r.zahl(0, n - 1); k[i] = ((k[i] + r.zahl(0, 2)) % 4) + 1; }
        if (!bund.some((x) => gleich(x, k))) bund.push(k);
      }
      const gemischt = r.mischen(bund);
      return { p: { schloss, bund: gemischt }, loesung: gemischt.indexOf(schloss), hilfen: ['Vergleich jeden Zahn einzeln mit den Stiften im Schloss.', 'Die Stifte im Schloss zeigen, wie tief jeder Zahn sein muss.', `Der richtige Schlüssel hat vorne einen Zahn der Tiefe ${schloss[0]}.`] };
    },
    ansicht(p, api) {
      const stifte = p.schloss.map((z, i) => `<rect x="${30 + i * 12}" y="4" width="8" height="${z * 4 + 6}" rx="2" class="stift"/>`).join('');
      return el('div', { class: 'cl-mech schluessel' },
        el('div', { class: 'cl-schloss-profil' }, el('small', {}, 'Die Stifte im Schloss'), svg(`<rect x="24" y="0" width="${p.schloss.length * 12 + 14}" height="30" rx="4" class="gehaeuse"/>${stifte}`, `0 0 ${p.schloss.length * 12 + 50} 32`, { class: 'cl-stifte-svg' })),
        el('div', { class: 'cl-bund' }, p.bund.map((k, i) => el('button', { class: 'cl-bund-schluessel', type: 'button', onclick: async (e) => {
          const b = e.currentTarget; b.classList.add('probieren'); api.ton('rad');
          const r = await api.loesen(i); b.classList.remove('probieren'); if (!r.richtig) b.classList.add('nein');
        } }, svg(schluesselSvg(k), `0 0 ${k.length * 12 + 44} 46`)))));
    },
    pruefen: (p, l, a) => a === l,
  };

  // ================================================================ Spiegelschrift
  const SPIEGELWOERTER = ['SCHATTEN', 'LATERNE', 'KOMPASS', 'SPIEGEL', 'NEBEL', 'KRISTALL', 'FLUESTERN', 'GEHEIMNIS', 'MITTERNACHT', 'TREPPE', 'ECHO', 'RABE', 'ZIRKEL', 'ANKER', 'FEDER'];
  M.spiegelschrift = {
    name: 'Spiegelschrift', kurz: 'Eine Botschaft in Spiegelschrift (am Spiegel, auf Papier, auf dem Kopf) – lesen und das Wort eingeben.', stoff: false, felder: [], art: 'entschluesseln',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const wort = r.wahl(SPIEGELWOERTER);
      return { p: { satz: `Wer das hier lesen kann, sucht das Wort ${wort}.`, kopf: s >= 2, wort: s >= 3 ? null : undefined }, loesung: wort, hilfen: ['Halt dir ein Spiegelbild im Kopf vor – oder lies von rechts nach links.', 'Das Wort steht am Ende des Satzes.', `Es beginnt mit ${wort[0]}.`] };
    },
    ansicht(p, api) {
      const f = el('input', { class: 'cl-eingabe gross', placeholder: 'Wort', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
      return el('div', { class: 'cl-mech spiegelschrift' }, el('div', { class: 'cl-spiegel-papier' }, el('p', { class: p.kopf ? 'kopf' : '', 'aria-hidden': 'true' }, p.satz)),
        el('div', { class: 'cl-eingabe-zeile' }, f, el('button', { class: 'cl-knopf', type: 'button', onclick: () => f.value.trim() && api.loesen(f.value) }, 'Prüfen')));
    },
    pruefen: (p, l, a) => norm(a) === norm(l),
  };

  // ================================================================ Leitungsgewirr
  M.leitungsgewirr = {
    name: 'Leitungsgewirr', kurz: 'Ein Knäuel aus Kabeln, Seilen oder Schläuchen: Welches Ende links gehört zu welchem Anschluss rechts?', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [4, 5, 6, 7][s];
      const perm = r.mischen([...Array(n).keys()]);
      const kurven = perm.map(() => [r.zahl(15, 85), r.zahl(5, 95), r.zahl(15, 85), r.zahl(5, 95)]);
      const fragen = r.mischen([...Array(n).keys()]).slice(0, [1, 2, 2, 3][s]);
      return { p: { n, perm, kurven, fragen, bunt: s === 0 }, loesung: fragen.map((j) => perm.indexOf(j)), hilfen: ['Folge einer Leitung mit dem Finger – langsam, an jeder Kreuzung geradeaus.', 'Fang am Ende rechts an und geh rückwärts.', `Lampe ${fragen[0] + 1} hängt an Anschluss ${BUCHST[perm.indexOf(fragen[0])]}.`] };
    },
    ansicht(p, api) {
      const antworten = [];
      const y = (i) => 10 + (i * 80) / (p.n - 1);
      const farben = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c', '#e0e0e0'];
      const bild = () => p.perm.map((j, i) => { const [x1, y1, x2, y2] = p.kurven[i]; return `<path d="M8 ${y(i)} C${x1} ${y1} ${x2} ${y2} 92 ${y(j)}" stroke="${p.bunt ? farben[i % farben.length] : '#9aa4ae'}" />`; }).join('') +
        [...Array(p.n).keys()].map((i) => `<circle cx="6" cy="${y(i)}" r="2.4" fill="#ddd"/><text x="1" y="${y(i) + 1.4}" font-size="4" fill="#fff" text-anchor="middle">${BUCHST[i]}</text><circle cx="94" cy="${y(i)}" r="2.6" class="${antworten.length < p.fragen.length && p.fragen[antworten.length] === i ? 'gefragt' : 'lampe'}"/><text x="99" y="${y(i) + 1.4}" font-size="4" fill="#fff" text-anchor="middle">${i + 1}</text>`).join('');
      const flaeche = el('div', { class: 'cl-gewirr' });
      const frage = el('div', { class: 'cl-aufgabe' });
      const knoepfe = el('div', { class: 'cl-zeile mitte' }, [...Array(p.n).keys()].map((i) => el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: async () => {
        antworten.push(i); api.ton('klick');
        if (antworten.length === p.fragen.length) { const r = await api.loesen(antworten.slice()); if (!r.richtig) antworten.length = 0; }
        malen();
      } }, `Anschluss ${BUCHST[i]}`)));
      const malen = () => {
        flaeche.replaceChildren(svg(`<g fill="none" stroke-width="1.4" stroke-linecap="round">${bild()}</g>`, '-2 0 104 100', { class: 'cl-gewirr-svg', preserveAspectRatio: 'none' }));
        const j = p.fragen[Math.min(antworten.length, p.fragen.length - 1)];
        frage.textContent = `Frage ${Math.min(antworten.length + 1, p.fragen.length)} von ${p.fragen.length}: Welcher Anschluss links führt zu ${j + 1} (rechts, leuchtet)?`;
      };
      malen();
      return el('div', { class: 'cl-mech leitungsgewirr' }, frage, flaeche, knoepfe);
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} richtig verfolgt.` };
    },
  };

  // ================================================================ Farben mischen
  function ryb(r, y, b) {
    const ecken = [[1, 1, 1], [1, 0, 0], [1, 1, 0], [1, 0.5, 0], [0.163, 0.373, 0.6], [0.5, 0, 0.5], [0, 0.66, 0.2], [0.2, 0.094, 0]];
    const f = (i) => { const [w, R, Y, O, B, V, G, K] = ecken.map((e) => e[i]); return w * (1 - r) * (1 - y) * (1 - b) + R * r * (1 - y) * (1 - b) + Y * (1 - r) * y * (1 - b) + O * r * y * (1 - b) + B * (1 - r) * (1 - y) * b + V * r * (1 - y) * b + G * (1 - r) * y * b + K * r * y * b; };
    return [f(0), f(1), f(2)].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255));
  }
  const mischfarbe = (n) => {
    const [r, y, b, w = 0] = n;
    const m = Math.max(r, y, b, 1);
    let c = ryb(r / m, y / m, b / m);
    const summe = r + y + b + w;
    if (w && summe) c = c.map((x) => Math.round(x + (255 - x) * (w / summe)));
    if (!summe) c = [235, 235, 240];
    return `rgb(${c.join(',')})`;
  };
  const ggt = (a, b) => (b ? ggt(b, a % b) : a);
  const kuerzen = (n) => { const g = n.reduce((a, x) => ggt(a, x), 0) || 1; return n.map((x) => x / g); };
  M.farbmischen = {
    name: 'Farben mischen', kurz: 'Ein Trank, eine Tinte oder eine Farbe muss genau so aussehen wie die Probe: Tropfen der Grundfarben richtig mischen.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const k = s >= 2 ? 4 : 3;
      for (let v = 0; v < 100; v++) {
        const n = Array.from({ length: k }, () => r.zahl(0, s === 0 ? 2 : 3));
        if (n.filter(Boolean).length < 2) continue;
        if (ggt(ggt(n[0], n[1]), ggt(n[2], n[3] || 0)) > 1) continue;
        return { p: { ziel: n, k }, loesung: n, hilfen: ['Fang mit einem Tropfen jeder Farbe an, die du in der Probe vermutest.', 'Grün braucht Gelb und Blau, Orange Rot und Gelb, Lila Rot und Blau.', `In der Probe ist ${['Rot', 'Gelb', 'Blau', 'Weiß'][n.indexOf(Math.max(...n))]} am meisten.`] };
      }
      return null;
    },
    ansicht(p, api) {
      const namen = ['Rot', 'Gelb', 'Blau', 'Weiß'];
      const farben = ['#d7263d', '#ffd23f', '#1d6fe0', '#ffffff'];
      const n = new Array(p.k).fill(0);
      const glas = el('div', { class: 'cl-mix-glas' }, el('i', { class: 'fluessig' }));
      const tropfen = el('div', { class: 'cl-mix-zahlen' });
      const malen = () => { glas.firstChild.style.background = mischfarbe(n); glas.firstChild.style.height = `${Math.min(100, 20 + n.reduce((a, x) => a + x, 0) * 8)}%`; tropfen.textContent = n.map((x, i) => `${namen[i]} ${x}`).join(' · '); };
      malen();
      return el('div', { class: 'cl-mech farbmischen' },
        el('div', { class: 'cl-mix-zeile' }, el('div', { class: 'cl-mix-probe' }, el('small', {}, 'Probe'), el('i', { style: { background: mischfarbe(p.ziel) } })), glas),
        tropfen,
        el('div', { class: 'cl-zeile mitte' }, n.map((_, i) => el('button', { class: 'cl-mix-tropfen', type: 'button', style: { '--f': farben[i] }, onclick: () => { if (n[i] < 9) n[i]++; api.ton('tropfen'); malen(); } }, `+ ${namen[i]}`))),
        el('div', { class: 'cl-zeile mitte' }, el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { n.fill(0); api.ton('zischen'); malen(); } }, 'Ausgießen'), el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(n.slice()) }, 'Prüfen')));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length || !a.some(Boolean)) return false;
      return gleich(kuerzen(a), kuerzen(l)) ? true : { richtig: false, info: 'Die Farbe ist noch nicht ganz dieselbe.' };
    },
  };

  // ================================================================ Drehringe
  const RINGZEICHEN = ['☀', '☾', '★', '◆', '▲', '●', '✿', '✚', '♣', '♥', '☥', '⚓'];
  M.drehringe = {
    name: 'Drehringe', kurz: 'Steinerne Ringe (Kalender, Astrolabium, Tresorscheibe) drehen, bis die Zeichen oben die Inschrift ergeben – auf höheren Stufen drehen sich Ringe gegenseitig mit.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 3, 4, 4][s];
      const ringe = Array.from({ length: n }, () => r.mischen(RINGZEICHEN).slice(0, 8));
      const ziel = ringe.map((z) => r.wahl(z));
      const start = ringe.map(() => r.zahl(0, 7));
      if (ringe.every((z, i) => z[start[i]] === ziel[i])) start[0] = (start[0] + 1) % 8;
      return { p: { ringe, ziel, start, gekoppelt: s >= 2 }, loesung: null, hilfen: [s >= 2 ? 'Achtung: Dreht sich ein Ring, nimmt er den nächsten inneren einen Schritt mit. Fang außen an.' : 'Jeder Ring dreht sich für sich. Fang außen an.', 'Die Inschrift liest sich von außen nach innen.', `Der äußere Ring braucht oben: ${ziel[0]}.`] };
    },
    ansicht(p, api) {
      const pos = p.start.slice();
      let fertig = false;
      const flaeche = el('div', { class: 'cl-ringe' });
      const malen = () => {
        let inner = '<circle cx="100" cy="100" r="96" class="sockel"/>';
        p.ringe.forEach((z, i) => {
          const rad = 88 - i * 20;
          inner += `<g class="ring" style="transform:rotate(${-pos[i] * 45}deg)"><circle cx="100" cy="100" r="${rad}" class="ringflaeche"/>${z.map((c, j) => { const a = ((j * 45 - 90) * Math.PI) / 180; return `<text x="${100 + Math.cos(a) * (rad - 9)}" y="${100 + Math.sin(a) * (rad - 9) + 4}" text-anchor="middle" font-size="12" transform="rotate(${j * 45} ${100 + Math.cos(a) * (rad - 9)} ${100 + Math.sin(a) * (rad - 9)})">${c}</text>`; }).join('')}</g>`;
        });
        inner += '<path d="M100 0 L108 14 L92 14 Z" class="marke"/><circle cx="100" cy="100" r="14" class="mitte"/>';
        flaeche.replaceChildren(svg(inner, '0 0 200 200', { class: 'cl-ringe-svg' }));
        const ok = p.ringe.every((z, i) => z[pos[i]] === p.ziel[i]);
        if (ok && !fertig) { fertig = true; api.ton('einrasten'); setTimeout(async () => { const r = await api.loesen(pos.slice()); if (!r.richtig) fertig = false; }, 800); }
      };
      const drehen = (i, d) => { pos[i] = (pos[i] + d + 8) % 8; if (p.gekoppelt && i + 1 < pos.length) pos[i + 1] = (pos[i + 1] + d + 8) % 8; api.ton('rad'); malen(); };
      malen();
      return el('div', { class: 'cl-mech drehringe' }, el('div', { class: 'cl-inschrift' }, el('small', {}, 'Inschrift (außen → innen)'), el('b', {}, p.ziel.join('  '))), flaeche,
        el('div', { class: 'cl-ring-knoepfe' }, p.ringe.map((_, i) => el('div', { class: 'cl-ring-steuer' }, el('button', { class: 'cl-rolle-knopf', type: 'button', 'aria-label': 'links drehen', onclick: () => drehen(i, -1) }, '◀'), el('small', {}, i === 0 ? 'außen' : i === p.ringe.length - 1 ? 'innen' : `Ring ${i + 1}`), el('button', { class: 'cl-rolle-knopf', type: 'button', 'aria-label': 'rechts drehen', onclick: () => drehen(i, 1) }, '▶')))));
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.ringe.length && p.ringe.every((z, i) => z[((a[i] % 8) + 8) % 8] === p.ziel[i]),
  };

  // ================================================================ Lecks stopfen
  M.lecks = {
    name: 'Lecks stopfen', kurz: 'Überall zischt und spritzt es (Wasser, Dampf, Funken): schnell jedes Leck antippen, bevor zu viel entweicht.', stoff: false, felder: [], art: 'geschick',
    bauen(inh, stufe) {
      const s = S(stufe);
      return { p: { ziel: [10, 14, 18, 22][s], dauer: [1600, 1300, 1080, 920][s], erlaubt: [6, 5, 4, 4][s] }, loesung: 'DICHT', hilfen: ['Behalte das ganze Feld im Blick, nicht nur eine Stelle.', 'Nach einem Fehlschlag fängst du neu an – das Tempo bleibt gleich.', 'Tipp mit zwei Fingern, wenn es schnell wird.'] };
    },
    ansicht(p, api) {
      let gestopft = 0; let entwischt = 0; let laeuft = false; let takt = null;
      const felder = Array.from({ length: 12 }, () => el('button', { class: 'cl-leck', type: 'button', onclick: (e) => {
        const f = e.currentTarget; if (!f.classList.contains('spritzt')) return;
        f.classList.remove('spritzt'); f.classList.add('dicht'); setTimeout(() => f.classList.remove('dicht'), 400); clearTimeout(f._t);
        gestopft++; api.ton('klick'); stand();
        if (gestopft >= p.ziel) { laeuft = false; clearInterval(takt); api.loesen('DICHT'); }
      } }));
      const anzeige = el('div', { class: 'cl-leck-stand' });
      const stand = () => { anzeige.textContent = laeuft || gestopft ? `Gestopft ${gestopft} von ${p.ziel} · entwichen ${entwischt} von ${p.erlaubt}` : `Stopf ${p.ziel} Lecks – lass höchstens ${p.erlaubt - 1} entweichen.`; };
      const neu = () => {
        if (!laeuft || !felder[0].isConnected) { clearInterval(takt); return; }
        const frei = felder.filter((f) => !f.classList.contains('spritzt'));
        const f = frei[Math.floor(Math.random() * frei.length)];
        if (!f) return;
        f.classList.add('spritzt'); api.ton('zischen');
        f._t = setTimeout(() => { if (!f.classList.contains('spritzt')) return; f.classList.remove('spritzt'); entwischt++; stand(); if (entwischt >= p.erlaubt) { laeuft = false; clearInterval(takt); felder.forEach((x) => x.classList.remove('spritzt')); api.ton('falsch'); start.disabled = false; start.textContent = 'Nochmal'; } }, p.dauer);
      };
      const start = el('button', { class: 'cl-knopf', type: 'button', onclick: () => { gestopft = 0; entwischt = 0; laeuft = true; start.disabled = true; stand(); clearInterval(takt); takt = setInterval(neu, Math.max(380, p.dauer * 0.55)); } }, 'Los!');
      stand();
      return el('div', { class: 'cl-mech lecks' }, anzeige, el('div', { class: 'cl-leck-feld' }, felder), start);
    },
    pruefen: (p, l, a) => a === l,
  };

  // ================================================================ Zahlenreihe
  const REIHEN = [
    [(r) => { const a = r.zahl(1, 9); const d = r.zahl(2, 9); return { f: (i) => a + d * i, t: `jedes Mal plus ${d}` }; }, (r) => { const a = r.zahl(1, 4); return { f: (i) => a * 2 ** i, t: 'jedes Mal verdoppelt' }; }],
    [(r) => { const a = r.zahl(1, 9); const x = r.zahl(2, 6); const y = r.zahl(1, 5); return { f: (i) => a + Math.ceil(i / 2) * x + Math.floor(i / 2) * y, t: `abwechselnd plus ${x} und plus ${y}` }; }, (r) => { const a = r.zahl(1, 3); return { f: (i) => (i + a) ** 2, t: 'Quadratzahlen' }; }, (r) => { const a = r.zahl(1, 9); return { f: (i) => a + (i * (i + 1)) / 2, t: 'plus 1, plus 2, plus 3 …' }; }],
    [(r) => { const a = r.zahl(1, 4); const b = r.zahl(2, 5); const l = [a, b]; for (let i = 2; i < 9; i++) l.push(l[i - 1] + l[i - 2]); return { f: (i) => l[i], t: 'die Summe der zwei Zahlen davor' }; }, (r) => { const a = r.zahl(2, 5); return { f: (i) => { let x = a; for (let j = 0; j < i; j++) x = x * 2 + 1; return x; }, t: 'mal 2 plus 1' }; }, (r) => { const a = r.zahl(1, 4); return { f: (i) => (i + a) ** 2 + 1, t: 'Quadratzahl plus 1' }; }],
    [() => { const pz = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]; const o = 0; return { f: (i) => pz[i + o], t: 'Primzahlen' }; }, (r) => { const a = r.zahl(1, 5); const b = r.zahl(20, 40); return { f: (i) => (i % 2 ? b - 3 * Math.floor(i / 2) : a + 4 * (i / 2)), t: 'zwei Reihen ineinander: eine steigt um 4, eine fällt um 3' }; }, (r) => { const a = r.zahl(2, 4); return { f: (i) => { let x = a; for (let j = 0; j < i; j++) x = j % 2 ? x + 3 : x * 2; return x; }, t: 'abwechselnd mal 2 und plus 3' }; }],
  ];
  M.zahlenreihe = {
    name: 'Zahlenreihe', kurz: 'Eine Folge von Zahlen (auf einem Display, einer Tafel, in Stein) – welche Zahl kommt als Nächstes?', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const regel = r.wahl(REIHEN[s])(r);
      const n = s >= 2 ? 6 : 5;
      const folge = Array.from({ length: n }, (_, i) => regel.f(i));
      const weiter = s >= 3 ? [regel.f(n), regel.f(n + 1)] : [regel.f(n)];
      return { p: { folge, fehlen: weiter.length }, loesung: weiter, hilfen: ['Schau dir die Abstände zwischen den Zahlen an.', 'Manchmal stecken zwei Regeln abwechselnd drin.', `Die Regel: ${regel.t}.`] };
    },
    ansicht(p, api) {
      const felder = Array.from({ length: p.fehlen }, () => el('input', { class: 'cl-eingabe gross cl-zr-feld', inputmode: 'numeric', autocomplete: 'off', placeholder: '?' }));
      return el('div', { class: 'cl-mech zahlenreihe' }, el('div', { class: 'cl-zr-reihe' }, p.folge.map((z) => el('span', { class: 'cl-zr-zahl' }, String(z))), felder),
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => { const w = felder.map((f) => Number(f.value.trim())); if (felder.some((f) => !f.value.trim())) return felder.find((f) => !f.value.trim()).focus(); api.loesen(w); } }, 'Prüfen'));
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a.map(Number), l),
  };

  // ================================================================ Dominosteine
  const augen = (n, x) => { const P = { 0: [], 1: [[5, 5]], 2: [[2.5, 2.5], [7.5, 7.5]], 3: [[2.5, 2.5], [5, 5], [7.5, 7.5]], 4: [[2.5, 2.5], [7.5, 2.5], [2.5, 7.5], [7.5, 7.5]], 5: [[2.5, 2.5], [7.5, 2.5], [5, 5], [2.5, 7.5], [7.5, 7.5]], 6: [[2.5, 2.5], [7.5, 2.5], [2.5, 5], [7.5, 5], [2.5, 7.5], [7.5, 7.5]] }; return P[n].map(([a, b]) => `<circle cx="${x + a}" cy="${b}" r="1.1"/>`).join(''); };
  const dominoSvg = (a, b) => svg(`<rect x="0.3" y="0.3" width="20.4" height="9.4" rx="1.6" class="stein"/><line x1="10.5" y1="1" x2="10.5" y2="9" class="strich"/>${augen(a, 0)}${augen(b, 11)}`, '0 0 21 10', { class: 'cl-domino-svg' });
  M.dominos = {
    name: 'Dominosteine', kurz: 'Eine Reihe Dominosteine: alle Steine so anlegen, dass immer gleiche Augenzahlen aneinanderstoßen.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const n = [4, 5, 6, 7][S(stufe)];
      const werte = [r.zahl(0, 6)];
      for (let i = 0; i < n; i++) { let v = r.zahl(0, 6); let t = 0; while ((v === werte[werte.length - 1] || werte.includes(v)) && t++ < 20) v = r.zahl(0, 6); werte.push(v); }
      const steine = werte.slice(1, -1).map((v, i) => [v, werte[i + 2]]);
      const start = [werte[0], werte[1]];
      const gemischt = r.mischen(steine).map((s) => (r() < 0.5 ? s : [s[1], s[0]]));
      return { p: { start, steine: gemischt }, loesung: null, hilfen: ['Der Stein ganz links liegt schon – such den, der an seine rechte Zahl passt.', 'Steine darfst du umdrehen – das passiert beim Anlegen von selbst.', `Als Nächstes passt ein Stein mit ${start[1]} Augen.`] };
    },
    ansicht(p, api) {
      const kette = [];
      let fertig = false;
      const reihe = el('div', { class: 'cl-domino-kette' });
      const vorrat = el('div', { class: 'cl-domino-vorrat' });
      const ende = () => (kette.length ? kette[kette.length - 1].stein[1] : p.start[1]);
      const malen = () => {
        reihe.replaceChildren(el('div', { class: 'cl-domino fest' }, dominoSvg(...p.start)), ...kette.map((k) => el('div', { class: 'cl-domino' }, dominoSvg(...k.stein))));
        vorrat.replaceChildren(...p.steine.map((s, i) => (kette.some((k) => k.i === i) ? null : el('button', { class: 'cl-domino frei', type: 'button', onclick: (e) => {
          if (s[0] === ende()) kette.push({ i, stein: s, dreh: 0 });
          else if (s[1] === ende()) kette.push({ i, stein: [s[1], s[0]], dreh: 1 });
          else { e.currentTarget.classList.remove('nein'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('nein'); api.ton('falsch'); return; }
          api.ton('klick'); malen();
          if (kette.length === p.steine.length && !fertig) { fertig = true; setTimeout(async () => { const r = await api.loesen(kette.map((k) => [k.i, k.dreh])); if (!r.richtig) fertig = false; }, 500); }
        } }, dominoSvg(...s)))).filter(Boolean));
      };
      malen();
      return el('div', { class: 'cl-mech dominos' }, el('div', { class: 'cl-leise klein' }, 'Tippe einen Stein an, um ihn rechts anzulegen.'), reihe, vorrat,
        el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: () => { kette.pop(); fertig = false; malen(); } }, 'Letzten Stein zurück'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== p.steine.length || !a.every((x) => Array.isArray(x) && x.length === 2) || new Set(a.map((x) => x[0])).size !== a.length) return false;
      let ende = p.start[1];
      for (const [i, d] of a) { const s = p.steine[i]; if (!s) return false; const st = d ? [s[1], s[0]] : s; if (st[0] !== ende) return false; ende = st[1]; }
      return true;
    },
  };

  // ================================================================ Hütchenspiel
  M.huetchenspiel = {
    name: 'Hütchenspiel', kurz: 'Eine Kugel (Münze, Bohne, Perle) unter einem von mehreren Bechern – die Becher werden vertauscht. Wo ist sie?', stoff: false, felder: [], art: 'beobachten',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [3, 3, 4, 4][s];
      const runden = Array.from({ length: [1, 2, 2, 3][s] }, () => {
        const tausch = Array.from({ length: [5, 7, 9, 12][s] }, () => { const a = r.zahl(0, n - 1); let b = r.zahl(0, n - 1); if (a === b) b = (a + 1) % n; return [a, b]; });
        return { start: r.zahl(0, n - 1), tausch };
      });
      const ende = runden.map((x) => x.tausch.reduce((pos, [a, b]) => (pos === a ? b : pos === b ? a : pos), x.start));
      return { p: { n, runden, tempo: [720, 560, 430, 340][s] }, loesung: ende, hilfen: ['Schau nur auf den einen Becher – nicht auf die anderen.', 'Bei schnellen Runden hilft es, die Augen nicht zu bewegen und nur aus dem Augenwinkel zu folgen.', 'Ruhig mehrmals ansehen – „Nochmal“ zeigt es erneut.'] };
    },
    ansicht(p, api) {
      const picks = [];
      let runde = 0; let spielt = false;
      const tisch = el('div', { class: 'cl-becher-tisch', style: { '--n': p.n } });
      const becher = Array.from({ length: p.n }, (_, i) => el('button', { class: 'cl-becher', type: 'button', style: { '--x': i } }, el('i', { class: 'kugel' })));
      tisch.append(...becher);
      let platz = [...Array(p.n).keys()];
      const setzen = () => becher.forEach((b, i) => b.style.setProperty('--x', platz.indexOf(i)));
      const status = el('div', { class: 'cl-leise klein' });
      const knopf = el('button', { class: 'cl-knopf', type: 'button' }, 'Los!');
      const spielen = () => {
        const R = p.runden[runde];
        spielt = true; knopf.disabled = true;
        platz = [...Array(p.n).keys()]; setzen();
        becher.forEach((b, i) => { b.classList.toggle('mit', i === R.start); b.classList.remove('auf', 'richtig', 'falsch'); });
        becher[R.start].classList.add('auf');
        status.textContent = `Runde ${runde + 1} von ${p.runden.length}: Merk dir die Kugel!`;
        setTimeout(() => becher[R.start].classList.remove('auf'), 1100);
        R.tausch.forEach(([a, b], j) => setTimeout(() => { const ia = platz[a]; const ib = platz[b]; platz[a] = ib; platz[b] = ia; setzen(); api.ton('whoosh'); }, 1500 + j * p.tempo));
        setTimeout(() => { spielt = false; status.textContent = 'Unter welchem Becher ist die Kugel?'; }, 1500 + R.tausch.length * p.tempo + 200);
      };
      becher.forEach((b, i) => b.addEventListener('click', async () => {
        if (spielt || knopf.disabled === false) return;
        const R = p.runden[runde];
        const posVonKugel = platz.indexOf(R.start);
        const gewaehlt = platz.indexOf(i);
        becher[R.start].classList.add('auf');
        if (i !== R.start) b.classList.add('auf', 'falsch');
        if (gewaehlt === posVonKugel) {
          picks.push(gewaehlt); runde++;
          if (runde === p.runden.length) { const r = await api.loesen(picks.slice()); if (!r.richtig) { picks.length = 0; runde = 0; knopf.disabled = false; knopf.textContent = 'Nochmal'; } return; }
          status.textContent = 'Richtig! Nächste Runde …'; knopf.disabled = false; knopf.textContent = 'Weiter';
        } else { api.ton('falsch'); status.textContent = 'Daneben – nochmal!'; knopf.disabled = false; knopf.textContent = 'Nochmal'; }
      }));
      knopf.addEventListener('click', spielen);
      status.textContent = `${p.runden.length > 1 ? `${p.runden.length} Runden. ` : ''}Drück „Los!“ und folge der Kugel.`;
      return el('div', { class: 'cl-mech huetchenspiel' }, status, tisch, knopf);
    },
    pruefen: (p, l, a) => Array.isArray(a) && gleich(a, l),
  };

  // ================================================================ Glocken nach Tonhöhe
  const TONLEITER = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
  M.glocken = {
    name: 'Glocken', kurz: 'Glocken, Gläser oder Klangschalen in verschiedener Tonhöhe: anhören und vom tiefsten zum höchsten Ton ordnen.', stoff: false, felder: [], art: 'hoeren',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const n = [4, 4, 5, 6][s];
      const abstand = s >= 2 ? 1 : 2;
      const start = r.zahl(0, TONLEITER.length - 1 - (n - 1) * abstand);
      const toene = Array.from({ length: n }, (_, i) => TONLEITER[start + i * abstand]);
      const gemischt = r.mischen(toene.map((t, i) => ({ t, i })));
      const groessen = r.mischen([...Array(n).keys()]);
      return { p: { toene: gemischt.map((x) => x.t), groessen }, loesung: toene.map((t) => gemischt.findIndex((x) => x.t === t)), hilfen: ['Die Größe der Glocken täuscht – hör genau hin.', 'Vergleich immer zwei Glocken direkt nacheinander.', 'Summ den tiefsten Ton mit und such ihn zuerst.'] };
    },
    ansicht(p, api) {
      const reihe = p.toene.map((_, i) => i);
      let wahl = null;
      const zeile = el('div', { class: 'cl-glocken' });
      const malen = () => zeile.replaceChildren(...reihe.map((g, pos) => el('button', { class: 'cl-glocke' + (wahl === pos ? ' gewaehlt' : ''), type: 'button', style: { '--g': 0.75 + p.groessen[g] * 0.1 }, onclick: (e) => {
        const b = e.currentTarget;
        Clavis.klang.klingen ? Clavis.klang.klingen(p.toene[g]) : Clavis.klang.piep(p.toene[g], 0.6);
        b.classList.remove('schwingt'); void b.offsetWidth; b.classList.add('schwingt');
        if (wahl == null) wahl = pos; else if (wahl === pos) wahl = null; else { [reihe[wahl], reihe[pos]] = [reihe[pos], reihe[wahl]]; wahl = null; }
        malen();
      } }, el('i'), el('small', {}, `${pos + 1}`))));
      malen();
      return el('div', { class: 'cl-mech glocken' }, el('div', { class: 'cl-leise klein' }, 'Tippe eine Glocke an, um sie zu hören. Tippe zwei nacheinander, um sie zu tauschen. Links tief, rechts hoch.'), zeile,
        el('button', { class: 'cl-knopf', type: 'button', onclick: () => api.loesen(reihe.slice()) }, 'So ist es richtig'));
    },
    pruefen(p, l, a) {
      if (!Array.isArray(a) || a.length !== l.length) return false;
      const n = a.filter((x, i) => x === l[i]).length;
      return n === l.length ? true : { richtig: false, info: `${n} von ${l.length} Glocken hängen richtig.` };
    },
  };

  // ================================================================ Sonar
  M.sonar = {
    name: 'Sonar', kurz: 'Etwas ist verborgen (Wrack, Signal, Kapsel): mit Pings den Abstand messen und die Stelle finden.', stoff: false, felder: [], art: 'erkunden',
    bauen(inh, stufe, r) {
      const s = S(stufe);
      const g = [5, 6, 6, 7][s];
      const ziel = [r.zahl(0, g - 1), r.zahl(0, g - 1)];
      return { p: { g, pings: [7, 6, 5, 5][s], ziel }, loesung: null, hilfen: ['Die Zahl ist der Abstand in Feldern – auch schräg zählt ein Schritt.', 'Ping zuerst in eine Ecke, dann in die gegenüberliegende.', `Das Ziel liegt in Spalte ${ziel[0] + 1} von links.`] };
    },
    ansicht(p, api) {
      let rest = p.pings;
      const marken = new Map();
      const feld = el('div', { class: 'cl-sonar-feld', style: { gridTemplateColumns: `repeat(${p.g}, 1fr)` } });
      const status = el('div', { class: 'cl-leise klein' });
      const malen = () => {
        feld.replaceChildren(...Array.from({ length: p.g * p.g }, (_, i) => {
          const x = i % p.g; const y = Math.floor(i / p.g);
          const m = marken.get(i);
          return el('button', { class: 'cl-sonar-zelle' + (m != null ? ' gepingt' : ''), type: 'button', onclick: async (e) => {
            if (marken.has(i)) return;
            const d = Math.max(Math.abs(x - p.ziel[0]), Math.abs(y - p.ziel[1]));
            marken.set(i, d); rest--; api.ton('funk');
            const ring = el('i', { class: 'cl-sonar-ring' }); e.currentTarget.append(ring);
            if (d === 0) { status.textContent = 'Treffer!'; malen(); await api.loesen(`${x},${y}`); return; }
            if (rest <= 0) { status.textContent = 'Keine Pings mehr – die Batterie lädt neu …'; setTimeout(() => { marken.clear(); rest = p.pings; malen(); }, 1600); }
            malen();
          } }, m != null ? String(m) : '');
        }));
        if (rest > 0) status.textContent = `Noch ${rest} Pings. Tippe ein Feld an: Die Zahl zeigt, wie weit das Ziel weg ist (auch schräg = 1).`;
      };
      malen();
      return el('div', { class: 'cl-mech sonar' }, el('div', { class: 'cl-sonar-schirm' }, feld, el('i', { class: 'cl-sonar-strahl' })), status);
    },
    pruefen: (p, l, a) => a === `${p.ziel[0]},${p.ziel[1]}`,
  };

  // ================================================================ Tastenfeld (abgenutzte Tasten)
  function codeHinweise(ziffern, r) {
    const perms = (l) => (l.length <= 1 ? [l] : l.flatMap((x, i) => perms(l.filter((_, j) => j !== i)).map((q) => [x, ...q])));
    let moeglich = perms(ziffern);
    const loesung = r.mischen(ziffern);
    const n = ziffern.length;
    const vorlagen = [
      () => { const i = r.zahl(0, n - 2); return { t: `Die ${loesung[i]} kommt direkt vor der ${loesung[i + 1]}.`, f: (q) => q.indexOf(loesung[i]) + 1 === q.indexOf(loesung[i + 1]) }; },
      () => { const g = loesung[0] % 2 === 0; return { t: `Die erste Ziffer ist ${g ? 'gerade' : 'ungerade'}.`, f: (q) => (q[0] % 2 === 0) === g }; },
      () => { const k = Math.min(...ziffern); const pos = loesung.indexOf(k); return { t: pos === n - 1 ? 'Die kleinste Ziffer steht am Ende.' : `Die kleinste Ziffer steht an Stelle ${pos + 1}.`, f: (q) => q.indexOf(k) === pos }; },
      () => { const i = r.zahl(0, n - 1); const j = (i + r.zahl(1, n - 1)) % n; return { t: `Die ${loesung[i]} steht weiter vorne als die ${loesung[j]}.`.replace('weiter vorne', i < j ? 'weiter vorne' : 'weiter hinten'), f: (q) => (q.indexOf(loesung[i]) < q.indexOf(loesung[j])) === (i < j) }; },
      () => { const i = r.zahl(0, n - 1); const x = r.wahl(ziffern.filter((z) => z !== loesung[i])); return { t: `An Stelle ${i + 1} steht nicht die ${x}.`, f: (q) => q[i] !== x }; },
      () => { const s = loesung[0] + loesung[n - 1]; return { t: `Erste und letzte Ziffer ergeben zusammen ${s}.`, f: (q) => q[0] + q[n - 1] === s }; },
    ];
    const hinweise = [];
    let v = 0;
    while (moeglich.length > 1 && v++ < 60) {
      const h = r.wahl(vorlagen)();
      const neu = moeglich.filter(h.f);
      if (neu.length < moeglich.length && neu.some((q) => gleich(q, loesung)) && !hinweise.includes(h.t)) { moeglich = neu; hinweise.push(h.t); }
    }
    return moeglich.length === 1 ? { loesung, hinweise } : null;
  }
  M.tastenfeld = {
    name: 'Tastenfeld', kurz: 'Ein Tastenfeld mit abgenutzten Tasten: Die Ziffern sind klar, aber in welcher Reihenfolge? Ein Zettel gibt Hinweise.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const n = [3, 4, 4, 5][S(stufe)];
      for (let v = 0; v < 30; v++) {
        const ziffern = r.mischen([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]).slice(0, n);
        const h = codeHinweise(ziffern, r);
        if (h) return { p: { tasten: ziffern.slice().sort(), hinweise: h.hinweise }, loesung: h.loesung.join(''), hilfen: ['Die abgegriffenen Tasten sind die Ziffern des Codes.', 'Schreib alle Reihenfolgen auf und streich mit jedem Hinweis.', `Der Code beginnt mit ${h.loesung[0]}.`] };
      }
      return null;
    },
    ansicht(p, api) {
      let eingabe = '';
      const anzeige = el('div', { class: 'cl-tf-anzeige' });
      const malen = () => { anzeige.textContent = eingabe.padEnd(p.tasten.length, '_').split('').join(' '); };
      const taste = (z) => el('button', { class: 'cl-tf-taste' + (p.tasten.includes(z) ? ' abgenutzt' : ''), type: 'button', onclick: async () => {
        eingabe += z; api.ton('klick'); malen();
        if (eingabe.length === p.tasten.length) { const r = await api.loesen(eingabe); eingabe = ''; setTimeout(malen, r.richtig ? 0 : 500); }
      } }, String(z));
      malen();
      return el('div', { class: 'cl-mech tastenfeld' }, el('div', { class: 'cl-tf-zeile' },
        el('div', { class: 'cl-tf-geraet' }, anzeige, el('div', { class: 'cl-tf-tasten' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(taste), el('span'), taste(0), el('button', { class: 'cl-tf-taste loeschen', type: 'button', onclick: () => { eingabe = ''; malen(); } }, '⌫'))),
        el('div', { class: 'cl-zettel cl-tf-zettel' }, el('b', {}, 'Notiz'), el('ul', {}, p.hinweise.map((h) => el('li', {}, h))))));
    },
    pruefen: (p, l, a) => String(a) === l,
  };

  // ================================================================ Zerrissener Brief
  const BRIEFE = ['Der Schlüssel liegt dort, wo die Zeit stehen geblieben ist.', 'Wer im Dunkeln sucht, findet das Licht hinter dem dritten Bild.', 'Vertrau nicht dem Spiegel. Vertrau der Uhr.', 'Das Wort für die Tür ist das Ende dieser Nachricht: FREIHEIT.', 'Zähl die Schritte bis zum Fenster. Dort beginnt der Weg.', 'Nichts ist, wie es scheint. Am wenigsten das Offensichtliche.'];
  M.zerrissen = {
    name: 'Zerrissener Brief', kurz: 'Ein Brief, in Streifen zerrissen und durcheinander: die Streifen so ordnen, dass man ihn wieder lesen kann.', stoff: false, felder: [], art: 'logik',
    bauen(inh, stufe, r) {
      const n = [4, 5, 6, 7][S(stufe)];
      let ordnung = r.mischen([...Array(n).keys()]);
      if (ordnung.every((x, i) => x === i)) ordnung = ordnung.reverse();
      return { p: { text: r.wahl(BRIEFE), ordnung }, loesung: null, hilfen: ['Achte auf Buchstaben, die an den Rissen weiterlaufen.', 'Der Brief fängt links mit einem Großbuchstaben an.', 'Die Zeilen müssen auf derselben Höhe weiterlaufen.'] };
    },
    ansicht(p, api) {
      const n = p.ordnung.length;
      const reihe = p.ordnung.slice();
      let wahl = null; let fertig = false;
      const flaeche = el('div', { class: 'cl-streifen-flaeche' });
      const malen = () => {
        flaeche.replaceChildren(...reihe.map((s, pos) => el('button', { class: 'cl-streifen' + (wahl === pos ? ' gewaehlt' : ''), type: 'button', style: { '--n': n, '--i': s }, onclick: () => {
          if (fertig) return;
          if (wahl == null) wahl = pos; else { [reihe[wahl], reihe[pos]] = [reihe[pos], reihe[wahl]]; wahl = null; api.ton('papier'); }
          malen();
          if (reihe.every((x, i) => x === i)) { fertig = true; flaeche.classList.add('fertig'); setTimeout(async () => { const r = await api.loesen(reihe.slice()); if (!r.richtig) { fertig = false; flaeche.classList.remove('fertig'); } }, 800); }
        } }, el('div', { class: 'cl-streifen-text' }, p.text))));
      };
      malen();
      return el('div', { class: 'cl-mech zerrissen' }, el('div', { class: 'cl-leise klein' }, 'Tippe zwei Streifen nacheinander an, um sie zu tauschen.'), flaeche);
    },
    pruefen: (p, l, a) => Array.isArray(a) && a.length === p.ordnung.length && a.every((x, i) => x === i),
  };

  // ================================================================ Arten, Ersatzliste, Erfolgssätze
  const NEU = ['zahnraeder', 'schaltkreis', 'ventile', 'sternbild', 'bildpuzzle', 'fingerabdruck', 'schattenbild', 'umfuellen', 'symbolsudoku', 'lichtfolge', 'funkfrequenz', 'fernrohr', 'schluessel',
    'spiegelschrift', 'leitungsgewirr', 'farbmischen', 'drehringe', 'lecks', 'zahlenreihe', 'dominos', 'huetchenspiel', 'glocken', 'sonar', 'tastenfeld', 'zerrissen'];
  Clavis.OHNE_INHALT.push(...NEU);
  Clavis.ZUM_ANFASSEN.push(...NEU);
  Object.assign(Clavis.ERFOLG, {
    zahnraeder: 'Die Zahnräder greifen ineinander – das ganze Getriebe setzt sich knarrend in Bewegung.',
    schaltkreis: 'Alle Lampen leuchten! Irgendwo summt ein Relais und ein Riegel springt zurück.',
    ventile: 'Zischend gleicht sich der Druck aus. Alle Nadeln stehen still im Grünen.',
    sternbild: 'Die Sterne verbinden sich zu einem leuchtenden Bild – und es zeigt auf etwas.',
    bildpuzzle: 'Das Bild ist wieder ganz – und in der Mitte erkennst du etwas, das vorher keiner sah.',
    fingerabdruck: 'Treffer! Der Abdruck passt bis in die letzte Linie.',
    schattenbild: 'Alle Schatten erkannt – die Lampe flackert zufrieden.',
    umfuellen: 'Genau abgemessen! Das Gewicht senkt sich und ein Mechanismus klickt.',
    symbolsudoku: 'Jedes Zeichen an seinem Platz – die Kacheln sinken mit einem Ruck ein.',
    lichtfolge: 'Alle Lichter leuchten gleichzeitig auf – Folge bestätigt.',
    funkfrequenz: 'Kristallklar! Die Botschaft ist angekommen – und jemand antwortet.',
    fernrohr: 'Da! Gut gesucht – der Code war kaum größer als ein Sandkorn.',
    schluessel: 'Der Schlüssel gleitet hinein und dreht sich wie von selbst.',
    spiegelschrift: 'Gelesen! Die Buchstaben im Spiegel scheinen kurz zu leuchten.',
    leitungsgewirr: 'Richtig verfolgt – Strom (oder Zug) läuft durch die richtige Leitung.',
    farbmischen: 'Die Farbe stimmt aufs Haar. Die Mischung beginnt sanft zu leuchten.',
    drehringe: 'Die Ringe rasten ein – Stein auf Stein, und dahinter öffnet sich etwas.',
    lecks: 'Alles dicht! Das Zischen verstummt.',
    zahlenreihe: 'Die richtige Zahl! Das Display springt auf Grün.',
    dominos: 'Die Kette ist geschlossen – der letzte Stein klackt an seinen Platz.',
    huetchenspiel: 'Gefunden! Da war sie – genau unter diesem Becher.',
    glocken: 'Vom tiefsten zum höchsten Ton – die Glocken spielen eine kleine Melodie.',
    sonar: 'Ping … Ping … Treffer! Da ist es.',
    tastenfeld: 'Piep-piep-piep – grünes Licht. Die Tür entriegelt.',
    zerrissen: 'Der Brief ist wieder ganz – und jetzt ergibt er einen Sinn.',
  });
})();
