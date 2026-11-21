'use strict';
/*
 * Omega – Deltas großer Bruder: Kellerautomaten und Turingmaschinen zeichnen und simulieren, kontextfreie Grammatiken
 * in Chomsky-Normalform bringen und Wörter mit CYK prüfen. Rechenarbeit in maschinen.js.
 */
const { h } = lyra;
const { EPS, LEER } = Maschinen;
const SCHRIFT = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const schoen = (n) => String(n).replace(/([A-Za-z])(\d+)/g, (_, b, d) => b + [...d].map((c) => SUB[c]).join(''));
const MODI = { keller: ['Kellerautomat', '🥞'], turing: ['Turingmaschine', '📼'], grammatik: ['Grammatik & CYK', '🌳'] };

const z = {
  info: null,
  modus: 'keller',
  docs: { keller: null, turing: null, grammatik: null },
  auswahl: null,
  zug: null,
  werkzeug: 'zeiger',
  sim: null, // {art, wort, r, i}
  takt: null,
  verlauf: [],
  wortEntwurf: '',
  cykWort: '',
  cyk: null,
  liste: [],
};
const app = document.getElementById('app');
const doc = () => z.docs[z.modus];
const dialogZu = () => { const g = document.querySelector('.dialog-grund'); if (g) g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); };

// ================================================================== Beispiele

function beispiel(modus) {
  const id = lyra.neueId();
  if (modus === 'keller') {
    const R = Maschinen.kellerRegelLesen;
    return { id, typ: 'keller', name: 'aⁿbⁿ (Kellerautomat)', startsymbol: '#', annahme: 'ende',
      zustaende: [{ id: 'k0', name: 'q0', x: 170, y: 250, start: true, ende: false }, { id: 'k1', name: 'q1', x: 420, y: 250, start: false, ende: false }, { id: 'k2', name: 'q2', x: 660, y: 250, start: false, ende: true }],
      uebergaenge: [{ von: 'k0', nach: 'k0', regeln: [R('a, # → A#'), R('a, A → AA')] }, { von: 'k0', nach: 'k1', regeln: [R('b, A → ε')] },
        { von: 'k1', nach: 'k1', regeln: [R('b, A → ε')] }, { von: 'k1', nach: 'k2', regeln: [R('ε, # → #')] },
        { von: 'k0', nach: 'k2', regeln: [R('ε, # → #')] }], zeit: lyra.jetzt() };
  }
  if (modus === 'turing') {
    const T = Maschinen.tmRegelLesen;
    // Erkennt aⁿbⁿ: a durch X ersetzen, passendes b durch Y, zurück, wiederholen
    return { id, typ: 'turing', name: 'aⁿbⁿ (Turingmaschine)',
      zustaende: [{ id: 't0', name: 'q0', x: 150, y: 260, start: true, ende: false }, { id: 't1', name: 'q1', x: 380, y: 160, start: false, ende: false },
        { id: 't2', name: 'q2', x: 590, y: 260, start: false, ende: false }, { id: 't3', name: 'q3', x: 380, y: 400, start: false, ende: false },
        { id: 't4', name: 'qa', x: 590, y: 450, start: false, ende: true }],
      uebergaenge: [{ von: 't0', nach: 't1', regeln: [T('a → X, R')] }, { von: 't1', nach: 't1', regeln: [T('a → a, R'), T('Y → Y, R')] },
        { von: 't1', nach: 't2', regeln: [T('b → Y, L')] }, { von: 't2', nach: 't2', regeln: [T('a → a, L'), T('Y → Y, L')] },
        { von: 't2', nach: 't0', regeln: [T('X → X, R')] }, { von: 't0', nach: 't3', regeln: [T('Y → Y, R')] },
        { von: 't3', nach: 't3', regeln: [T('Y → Y, R')] }, { von: 't3', nach: 't4', regeln: [T('□ → □, N')] }, { von: 't0', nach: 't4', regeln: [T('□ → □, N')] }], zeit: lyra.jetzt() };
  }
  return { id, typ: 'grammatik', name: 'Arithmetische Ausdrücke', text: 'E → E+T | T\nT → T*F | F\nF → (E) | a', zeit: lyra.jetzt() };
}

// ================================================================== Speichern

let plan = null;
function sichern() {
  clearTimeout(plan);
  plan = setTimeout(async () => {
    const d = doc();
    if (!d) return;
    d.zeit = lyra.jetzt();
    try {
      await lyra.speicher.schreiben('docs/' + d.id, d);
      await lyra.speicher.schreiben('zuletzt-' + z.modus, d.id);
      await lyra.speicher.schreiben('modus', z.modus);
    } catch (_) {}
    const i = z.liste.findIndex((x) => x.id === d.id);
    const kurz = { id: d.id, typ: d.typ, name: d.name, zeit: d.zeit };
    if (i >= 0) z.liste[i] = kurz; else z.liste.unshift(kurz);
  }, 400);
}
function merken() { z.verlauf.push(JSON.stringify(doc())); if (z.verlauf.length > 80) z.verlauf.shift(); }
function rueckgaengig() { if (!z.verlauf.length) return; z.docs[z.modus] = JSON.parse(z.verlauf.pop()); z.auswahl = null; geaendert(); }
function geaendert(alles = true) { z.sim = null; z.cyk = null; stopTakt(); sichern(); if (alles) malen(); else leinwandMalen(); }

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { route: '' }; }
  try {
    z.liste = (await lyra.speicher.liste('docs')).map((e) => e.wert).filter((d) => d && d.id).map((d) => ({ id: d.id, typ: d.typ, name: d.name, zeit: d.zeit })).sort((a, b) => b.zeit - a.zeit);
    z.modus = (await lyra.speicher.lesen('modus')) || 'keller';
    for (const m of Object.keys(MODI)) {
      const id = await lyra.speicher.lesen('zuletzt-' + m);
      z.docs[m] = (id && (await lyra.speicher.lesen('docs/' + id))) || null;
    }
  } catch (_) {}
  for (const m of Object.keys(MODI)) if (!z.docs[m]) z.docs[m] = beispiel(m);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (MODI[route]) z.modus = route;
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.zug) { z.zug = null; return leinwandMalen(); }
    if (z.sim) { z.sim = null; stopTakt(); return malen(); }
    if (z.auswahl) { z.auswahl = null; return malen(); }
    lyra.zurueck();
  });
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.dialog-grund') || z.modus === 'grammatik') return;
    const imFeld = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !imFeld) { e.preventDefault(); return rueckgaengig(); }
    if (imFeld || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'v') { z.werkzeug = 'zeiger'; malen(); } else if (k === 'z') { z.werkzeug = 'zustand'; malen(); } else if (k === 't') { z.werkzeug = 'pfeil'; malen(); }
    else if ((k === 'backspace' || k === 'delete') && z.auswahl) { e.preventDefault(); loeschen(); }
    else if (k === 'arrowright' && z.sim) simGehe(z.sim.i + 1);
    else if (k === 'arrowleft' && z.sim) simGehe(z.sim.i - 1);
  });
  window.addEventListener('resize', () => leinwandMalen());
  malen();
}

// ================================================================== Bearbeiten (Automaten)

const zustand = (id) => doc().zustaende.find((q) => q.id === id);
function zustandAnlegen(x, y) {
  merken();
  const d = doc();
  const namen = new Set(d.zustaende.map((q) => q.name));
  let i = 0;
  while (namen.has('q' + i)) i++;
  const q = { id: 's' + lyra.neueId(), name: 'q' + i, x: Math.round(x), y: Math.round(y), start: !d.zustaende.length, ende: false };
  d.zustaende.push(q);
  z.auswahl = { typ: 'zustand', id: q.id };
  geaendert();
}
function kanteAnlegen(von, nach) {
  const d = doc();
  let i = d.uebergaenge.findIndex((u) => u.von === von && u.nach === nach);
  if (i < 0) { merken(); d.uebergaenge.push({ von, nach, regeln: [] }); i = d.uebergaenge.length - 1; }
  z.auswahl = { typ: 'kante', i };
  geaendert();
  const f = document.querySelector('[data-feld="regeln"]');
  if (f) f.focus();
}
function loeschen() {
  const a = z.auswahl;
  const d = doc();
  if (!a) return;
  merken();
  if (a.typ === 'zustand') {
    const war = zustand(a.id);
    d.zustaende = d.zustaende.filter((q) => q.id !== a.id);
    d.uebergaenge = d.uebergaenge.filter((u) => u.von !== a.id && u.nach !== a.id);
    if (war && war.start && d.zustaende.length) d.zustaende[0].start = true;
  } else d.uebergaenge.splice(a.i, 1);
  z.auswahl = null;
  geaendert();
}
const regelText = (r) => (z.modus === 'keller' ? Maschinen.kellerRegelText(r) : Maschinen.tmRegelText(r));

// ================================================================== Zeichnung

const messer = document.createElement('canvas').getContext('2d');
const textBreite = (t, g, w = 600) => { messer.font = `${w} ${g}px ${SCHRIFT}`; return messer.measureText(t).width; };
const radius = (q) => Math.max(27, textBreite(schoen(q.name), 17) / 2 + 13);

function farben(fuerExport) {
  if (fuerExport) return { grund: '#ffffff', zustand: '#ffffff', rand: '#1f2430', text: '#1f2430', kante: '#3a4050', akzent: '#1e40af', aktiv: '#dbeafe', gut: '#16a34a', schlecht: '#dc2626', wahl: '#2563eb', leise: '#8a90a0' };
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return { grund: v('--flaeche'), zustand: v('--zustand'), rand: v('--text'), text: v('--text'), kante: v('--kante'), akzent: v('--akzent'), aktiv: v('--aktiv'), gut: v('--ok'), schlecht: v('--falsch'), wahl: v('--wahl'), leise: v('--leise') };
}

function schleifenWinkel(A, id, pos) {
  const p = pos.get(id);
  const richt = [];
  for (const u of A.uebergaenge) {
    if (u.von === u.nach) continue;
    const andere = u.von === id ? u.nach : u.nach === id ? u.von : null;
    if (!andere || !pos.get(andere)) continue;
    const q = pos.get(andere);
    richt.push(Math.atan2(q.y - p.y, q.x - p.x));
  }
  if ((A.zustaende.find((x) => x.id === id) || {}).start) richt.push(Math.PI);
  let best = -Math.PI / 2;
  let bestWert = -1;
  for (const k of [-Math.PI / 2, Math.PI / 2, Math.PI, 0, -Math.PI / 4, (-3 * Math.PI) / 4, Math.PI / 4, (3 * Math.PI) / 4]) {
    const frei = richt.length ? Math.min(...richt.map((r) => Math.abs(((k - r + 3 * Math.PI) % (2 * Math.PI)) - Math.PI))) : Math.PI;
    const wert = frei + (k === -Math.PI / 2 ? 0.35 : 0);
    if (wert > bestWert + 1e-9) { bestWert = wert; best = k; }
  }
  return best;
}

/** Zeichenliste wie in Delta – Beschriftungen können mehrere Zeilen haben (eine Regel je Zeile). */
function zeichnung(A, { fuerExport = false } = {}) {
  const F = farben(fuerExport);
  const teile = [];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const dehnen = (x, y, r = 0) => { box[0] = Math.min(box[0], x - r); box[1] = Math.min(box[1], y - r); box[2] = Math.max(box[2], x + r); box[3] = Math.max(box[3], y + r); };
  const schritt = !fuerExport && z.sim ? simSchritt() : null;
  const aktiv = schritt ? schritt.q : null;
  const benutzt = schritt && schritt.regel ? schritt.regel.von + '>' + schritt.regel.nach : null;
  const ende = !fuerExport && z.sim && z.sim.i === z.sim.n - 1;
  const pos = new Map(A.zustaende.map((q) => [q.id, { x: q.x, y: q.y, r: radius(q) }]));
  const spitze = (x, y, wx, wy, farbe, ziel) => {
    const l = Math.hypot(wx, wy) || 1;
    const dx = wx / l;
    const dy = wy / l;
    teile.push({ art: 'pfad', d: `M${x} ${y} L${x - dx * 12 - dy * 6.5} ${y - dy * 12 + dx * 6.5} L${x - dx * 12 + dy * 6.5} ${y - dy * 12 - dx * 6.5} Z`, fuellung: farbe, ziel });
  };
  const beschrift = (x, y, zeilen, farbe, ziel, anker = 'middle') => {
    const zh = 18;
    const b = Math.max(...zeilen.map((t) => textBreite(t, 14.5, 650)));
    teile.push({ art: 'text', x, y, zeilen, groesse: 14.5, gewicht: 650, farbe, halo: F.grund || '#fff', ziel, anker, zh });
    dehnen(x - b / 2, y - (zeilen.length * zh) / 2);
    dehnen(x + b / 2, y + (zeilen.length * zh) / 2);
  };
  A.uebergaenge.forEach((u, i) => {
    const p = pos.get(u.von);
    const q = pos.get(u.nach);
    if (!p || !q) return;
    const gewaehlt = !fuerExport && z.auswahl && z.auswahl.typ === 'kante' && z.auswahl.i === i;
    const an = benutzt === u.von + '>' + u.nach;
    const farbe = gewaehlt ? F.wahl : an ? F.akzent : F.kante;
    const breite = an || gewaehlt ? 3 : 2;
    const zeilen = u.regeln.length ? u.regeln.map(regelText) : ['?'];
    const ziel = { typ: 'kante', i };
    const zh = zeilen.length * 18;
    if (u.von === u.nach) {
      const w = schleifenWinkel(A, u.von, pos);
      const ux = Math.cos(w);
      const uy = Math.sin(w);
      const vx = -uy;
      const vy = ux;
      const s = [p.x + p.r * Math.cos(w - Math.PI / 6), p.y + p.r * Math.sin(w - Math.PI / 6)];
      const e = [p.x + p.r * Math.cos(w + Math.PI / 6), p.y + p.r * Math.sin(w + Math.PI / 6)];
      const hoch = p.r + 48;
      const c1 = [p.x + hoch * ux - 38 * vx, p.y + hoch * uy - 38 * vy];
      const c2 = [p.x + hoch * ux + 38 * vx, p.y + hoch * uy + 38 * vy];
      const d = `M${s[0]} ${s[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`;
      if (!fuerExport) teile.push({ art: 'pfad', d, linie: 'transparent', breite: 16, ziel });
      teile.push({ art: 'pfad', d, linie: farbe, breite, ziel });
      spitze(e[0], e[1], e[0] - c2[0], e[1] - c2[1], farbe, ziel);
      dehnen(p.x + hoch * ux, p.y + hoch * uy, 40);
      const abst = p.r + 46 + (Math.abs(uy) > 0.5 ? zh / 2 : Math.max(...zeilen.map((t) => textBreite(t, 14.5, 650))) / 2);
      beschrift(p.x + abst * ux, p.y + abst * uy, zeilen, gewaehlt ? F.wahl : F.text, ziel);
      return;
    }
    const zurueck = A.uebergaenge.some((x) => x.von === u.nach && x.nach === u.von);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l;
    let ny = dx / l;
    let bogen = zurueck ? 34 : 0;
    let seite = 0;
    for (const o of A.zustaende) {
      if (o.id === u.von || o.id === u.nach) continue;
      const t = ((o.x - p.x) * dx + (o.y - p.y) * dy) / (l * l);
      if (t <= 0.05 || t >= 0.95) continue;
      const abst = (o.x - p.x) * nx + (o.y - p.y) * ny;
      const r = radius(o) + 30;
      if (Math.abs(abst) >= r) continue;
      seite += abst;
      bogen = Math.max(bogen, Math.min(260, (r + Math.abs(abst)) / (4 * t * (1 - t))));
    }
    if (bogen > 34 && !zurueck && seite > 0) { nx = -nx; ny = -ny; }
    if (bogen > 0) {
      const c = [(p.x + q.x) / 2 + nx * bogen * 2, (p.y + q.y) / 2 + ny * bogen * 2];
      const rs = Math.hypot(c[0] - p.x, c[1] - p.y) || 1;
      const re = Math.hypot(c[0] - q.x, c[1] - q.y) || 1;
      const s = [p.x + ((c[0] - p.x) / rs) * p.r, p.y + ((c[1] - p.y) / rs) * p.r];
      const e = [q.x + ((c[0] - q.x) / re) * q.r, q.y + ((c[1] - q.y) / re) * q.r];
      const d = `M${s[0]} ${s[1]} Q${c[0]} ${c[1]} ${e[0]} ${e[1]}`;
      if (!fuerExport) teile.push({ art: 'pfad', d, linie: 'transparent', breite: 16, ziel });
      teile.push({ art: 'pfad', d, linie: farbe, breite, ziel });
      spitze(e[0], e[1], e[0] - c[0], e[1] - c[1], farbe, ziel);
      const mx = 0.25 * s[0] + 0.5 * c[0] + 0.25 * e[0];
      const my = 0.25 * s[1] + 0.5 * c[1] + 0.25 * e[1];
      beschrift(mx + nx * (12 + zh / 2), my + ny * (12 + zh / 2), zeilen, gewaehlt ? F.wahl : F.text, ziel);
      dehnen(c[0], c[1]);
      return;
    }
    const s = [p.x + (dx / l) * p.r, p.y + (dy / l) * p.r];
    const e = [q.x - (dx / l) * q.r, q.y - (dy / l) * q.r];
    const d = `M${s[0]} ${s[1]} L${e[0]} ${e[1]}`;
    if (!fuerExport) teile.push({ art: 'pfad', d, linie: 'transparent', breite: 16, ziel });
    teile.push({ art: 'pfad', d, linie: farbe, breite, ziel });
    spitze(e[0], e[1], dx, dy, farbe, ziel);
    const sw = ny > 0 || (Math.abs(ny) < 0.01 && nx > 0) ? -1 : 1;
    const off = 12 + zh / 2;
    beschrift((s[0] + e[0]) / 2 + nx * off * sw, (s[1] + e[1]) / 2 + ny * off * sw, zeilen, gewaehlt ? F.wahl : F.text, ziel);
  });
  for (const q of A.zustaende) {
    const { x, y, r } = pos.get(q.id);
    const gewaehlt = !fuerExport && z.auswahl && z.auswahl.typ === 'zustand' && z.auswahl.id === q.id;
    const istAktiv = aktiv === q.id;
    let rand = gewaehlt ? F.wahl : F.rand;
    let fuellung = F.zustand;
    if (istAktiv) { fuellung = F.aktiv; rand = ende ? (z.sim.r.akzeptiert ? F.gut : F.schlecht) : F.akzent; }
    const ziel = { typ: 'zustand', id: q.id };
    if (q.start) {
      teile.push({ art: 'pfad', d: `M${x - r - 46} ${y} L${x - r} ${y}`, linie: F.kante, breite: 2 });
      spitze(x - r, y, 1, 0, F.kante);
      dehnen(x - r - 46, y, 8);
    }
    teile.push({ art: 'kreis', x, y, r, fuellung, linie: rand, breite: gewaehlt || istAktiv ? 3 : 2, ziel });
    if (q.ende) teile.push({ art: 'kreis', x, y, r: r - 5, fuellung: null, linie: rand, breite: 1.8, ziel });
    teile.push({ art: 'text', x, y, zeilen: [schoen(q.name)], groesse: 17, gewicht: 600, farbe: F.text, ziel, zh: 18 });
    dehnen(x, y, r + 6);
  }
  if (!fuerExport && z.zug && z.zug.pfeilVon && pos.get(z.zug.pfeilVon)) {
    const p = pos.get(z.zug.pfeilVon);
    teile.push({ art: 'pfad', d: `M${p.x} ${p.y} L${z.zug.x} ${z.zug.y}`, linie: F.wahl, breite: 2, gestrichelt: true });
    spitze(z.zug.x, z.zug.y, z.zug.x - p.x, z.zug.y - p.y, F.wahl);
  }
  return { teile, box };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function alsSvg(Z, rahmen, fuerExport) {
  const [x, y, w, hh] = rahmen;
  const teile = Z.teile.map((t) => {
    const daten = !fuerExport && t.ziel ? (t.ziel.typ === 'zustand' ? ` data-z="${esc(t.ziel.id)}"` : ` data-k="${t.ziel.i}"`) : '';
    if (t.art === 'kreis') return `<circle cx="${t.x}" cy="${t.y}" r="${t.r}" fill="${t.fuellung || 'none'}" stroke="${t.linie}" stroke-width="${t.breite}"${daten}/>`;
    if (t.art === 'pfad') return `<path d="${t.d}" fill="${t.fuellung || 'none'}"${t.linie ? ` stroke="${t.linie}" stroke-width="${t.breite}" stroke-linecap="round"` : ''}${t.gestrichelt ? ' stroke-dasharray="6 5"' : ''}${daten}/>`;
    const halo = t.halo ? ` paint-order="stroke" stroke="${t.halo}" stroke-width="5" stroke-linejoin="round"` : '';
    const n = t.zeilen.length;
    const spans = t.zeilen.map((s, i) => `<tspan x="${t.x}" y="${t.y + (i - (n - 1) / 2) * t.zh}">${esc(s)}</tspan>`).join('');
    return `<text font-size="${t.groesse}" font-weight="${t.gewicht}" fill="${t.farbe}" text-anchor="${t.anker || 'middle'}" dominant-baseline="central"${halo}${daten}>${spans}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${hh}" width="${w}" height="${hh}" font-family="${esc(SCHRIFT)}">${fuerExport ? `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#fff"/>` : ''}${teile.join('')}</svg>`;
}
const exportRahmen = (Z) => [Z.box[0] - 30, Z.box[1] - 30, Z.box[2] - Z.box[0] + 60, Z.box[3] - Z.box[1] + 60].map(Math.round);
function alsPng(Z) {
  const [x, y, w, hh] = exportRahmen(Z);
  const s = Math.max(1, Math.min(3, 2400 / Math.max(w, hh)));
  const lw = document.createElement('canvas');
  lw.width = Math.round(w * s);
  lw.height = Math.round(hh * s);
  const c = lw.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, lw.width, lw.height);
  c.setTransform(s, 0, 0, s, -x * s, -y * s);
  for (const t of Z.teile) {
    c.save();
    if (t.art === 'kreis') {
      c.beginPath(); c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      if (t.fuellung) { c.fillStyle = t.fuellung; c.fill(); }
      c.strokeStyle = t.linie; c.lineWidth = t.breite; c.stroke();
    } else if (t.art === 'pfad') {
      const p = new Path2D(t.d);
      if (t.fuellung) { c.fillStyle = t.fuellung; c.fill(p); }
      if (t.linie && t.linie !== 'transparent') { c.strokeStyle = t.linie; c.lineWidth = t.breite; c.lineCap = 'round'; c.stroke(p); }
    } else {
      c.font = `${t.gewicht} ${t.groesse}px ${SCHRIFT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const n = t.zeilen.length;
      t.zeilen.forEach((zeile, i) => {
        const yy = t.y + (i - (n - 1) / 2) * t.zh;
        if (t.halo) { c.strokeStyle = t.halo; c.lineWidth = 5; c.lineJoin = 'round'; c.strokeText(zeile, t.x, yy); }
        c.fillStyle = t.farbe;
        c.fillText(zeile, t.x, yy);
      });
    }
    c.restore();
  }
  return lw.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

// ================================================================== Zeichenfläche

let flaeche = null;
function leinwandMalen() {
  if (!flaeche || z.modus === 'grammatik') return;
  const Z = zeichnung(doc());
  const b = Math.max(flaeche.clientWidth, Number.isFinite(Z.box[2]) ? Z.box[2] + 80 : 0);
  const hh = Math.max(flaeche.clientHeight, Number.isFinite(Z.box[3]) ? Z.box[3] + 80 : 0);
  flaeche.querySelector('.zeichnung').innerHTML = alsSvg(Z, [0, 0, b, hh], false);
  flaeche.dataset.werkzeug = z.werkzeug;
}
function punktIn(e) {
  const svg = flaeche.querySelector('svg');
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return [q.x, q.y];
}
function flaecheEinrichten(el) {
  flaeche = el;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const [x, y] = punktIn(e);
    const zt = e.target.closest('[data-z]');
    const kt = e.target.closest('[data-k]');
    if (zt) {
      const id = zt.getAttribute('data-z');
      if (z.werkzeug === 'pfeil' || e.shiftKey) z.zug = { pfeilVon: id, x, y };
      else {
        const q = zustand(id);
        z.zug = { id, dx: x - q.x, dy: y - q.y, vorher: JSON.stringify(doc()), bewegt: false };
        if (!z.auswahl || z.auswahl.id !== id) { z.auswahl = { typ: 'zustand', id }; seiteMalen(); }
      }
      el.setPointerCapture(e.pointerId);
      return leinwandMalen();
    }
    if (kt) { z.auswahl = { typ: 'kante', i: Number(kt.getAttribute('data-k')) }; return malen(); }
    if (z.werkzeug === 'zustand') return zustandAnlegen(x, y);
    if (z.auswahl) { z.auswahl = null; malen(); }
  });
  el.addEventListener('pointermove', (e) => {
    if (!z.zug) return;
    const [x, y] = punktIn(e);
    if (z.zug.pfeilVon) { z.zug.x = x; z.zug.y = y; } else {
      const q = zustand(z.zug.id);
      q.x = Math.max(40, Math.round((x - z.zug.dx) / 5) * 5);
      q.y = Math.max(40, Math.round((y - z.zug.dy) / 5) * 5);
      z.zug.bewegt = true;
    }
    leinwandMalen();
  });
  el.addEventListener('pointerup', (e) => {
    const zug = z.zug;
    z.zug = null;
    if (!zug) return;
    if (zug.pfeilVon) {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const ziel = t && t.closest && t.closest('[data-z]');
      if (ziel) return kanteAnlegen(zug.pfeilVon, ziel.getAttribute('data-z'));
      return leinwandMalen();
    }
    if (zug.bewegt) { z.verlauf.push(zug.vorher); sichern(); }
    leinwandMalen();
  });
  el.addEventListener('dblclick', (e) => {
    if (z.werkzeug !== 'zeiger') return;
    const zt = e.target.closest('[data-z]');
    if (zt) { merken(); const q = zustand(zt.getAttribute('data-z')); q.ende = !q.ende; return geaendert(); }
    if (e.target.closest('[data-k]')) return;
    const [x, y] = punktIn(e);
    zustandAnlegen(x, y);
  });
}

// ================================================================== Simulation (Automaten)

function simSchritt() {
  const s = z.sim;
  if (s.art === 'keller') return s.r.weg[s.i] || null;
  return s.r.schritte[s.i] || null;
}
function simStarten(wort) {
  stopTakt();
  z.wortEntwurf = wort;
  const r = z.modus === 'keller' ? Maschinen.kellerLauf(doc(), wort) : Maschinen.tmLauf(doc(), wort);
  const n = z.modus === 'keller' ? r.weg.length : r.schritte.length;
  z.sim = { art: z.modus, wort, r, i: 0, n };
  malen();
  abspielen();
}
function simGehe(i) {
  if (!z.sim) return;
  z.sim.i = Math.max(0, Math.min(z.sim.n - 1, i));
  leinwandMalen();
  const alt = document.querySelector('.sim');
  if (alt) alt.replaceWith(simLeiste());
}
function abspielen() {
  stopTakt();
  if (!z.sim || !z.sim.n) return;
  if (z.sim.i >= z.sim.n - 1) z.sim.i = 0;
  z.takt = setInterval(() => {
    if (!z.sim || z.sim.i >= z.sim.n - 1) return stopTakt(true);
    simGehe(z.sim.i + 1);
  }, z.modus === 'turing' ? 350 : 700);
  simGehe(z.sim.i);
}
function stopTakt(neu) {
  if (z.takt) clearInterval(z.takt);
  z.takt = null;
  if (neu && z.sim) simGehe(z.sim.i);
}

function simLeiste() {
  const wort = h('input', { class: 'eingabe wort', 'data-feld': 'wort', placeholder: 'Wort, z. B. aabb (leer = ε)', value: z.sim ? z.sim.wort : z.wortEntwurf });
  wort.addEventListener('input', () => { z.wortEntwurf = wort.value; });
  wort.addEventListener('keydown', (e) => { if (e.key === 'Enter') simStarten(wort.value); });
  const s = z.sim;
  const fertig = s && s.i === s.n - 1;
  const k = s ? simSchritt() : null;
  let ansicht = null;
  if (s && k && s.art === 'keller') {
    const zeichen = Maschinen.zeichenVon(s.wort);
    ansicht = h('div', { class: 'zeile', style: { gap: '18px', alignItems: 'flex-end' } },
      h('div', {}, h('div', { class: 'leise klein' }, 'Eingabe'), h('div', { class: 'band' }, zeichen.length ? zeichen.map((c, i) => h('span', { class: 'feld' + (i < k.gelesen ? ' gelesen' : i === k.gelesen && !fertig ? ' jetzt' : '') }, c)) : h('span', { class: 'feld gelesen' }, 'ε'))),
      h('div', {}, h('div', { class: 'leise klein' }, 'Keller (oben links)'), h('div', { class: 'keller' }, k.keller.length ? k.keller.slice().reverse().map((c, i) => h('span', { class: 'kfeld' + (i === 0 ? ' oben' : '') }, c)) : h('span', { class: 'leise klein' }, 'leer'))),
      k.regel ? h('div', { class: 'klein' }, h('div', { class: 'leise' }, 'Zuletzt'), h('b', {}, Maschinen.kellerRegelText(k.regel))) : null);
  } else if (s && k && s.art === 'turing') {
    ansicht = h('div', { class: 'zeile', style: { gap: '18px', alignItems: 'flex-end' } },
      h('div', {}, h('div', { class: 'leise klein' }, `Band · Zustand ${schoen((zustand(k.q) || {}).name || '?')}`),
        h('div', { class: 'band tm' }, [...k.band].map((c, i) => h('span', { class: 'feld' + (i === k.kopf ? ' kopf' : '') + (c === LEER ? ' leer' : '') }, c)))),
      k.regel ? h('div', { class: 'klein' }, h('div', { class: 'leise' }, 'Zuletzt'), h('b', {}, Maschinen.tmRegelText(k.regel))) : null);
  }
  return h('div', { class: 'sim' },
    h('div', { class: 'zeile', style: { gap: '8px' } },
      h('span', { class: 'fett' }, '▶ Simulation'), wort,
      h('button', { class: 'knopf', onclick: () => simStarten(wort.value) }, s ? '↻ Neu' : '▶ Lauf starten'),
      s ? h('button', { class: 'knopf tonal', onclick: () => simGehe(0) }, '⏮') : null,
      s ? h('button', { class: 'knopf tonal', disabled: s.i === 0, onclick: () => { stopTakt(); simGehe(s.i - 1); } }, '◀') : null,
      s ? h('button', { class: 'knopf tonal', disabled: fertig, onclick: () => { stopTakt(); simGehe(s.i + 1); } }, '▶') : null,
      s ? h('button', { class: 'knopf tonal', onclick: () => (z.takt ? stopTakt(true) : abspielen()) }, z.takt ? '⏸' : '⏩') : null,
      s ? h('span', { class: 'klein leise' }, `Schritt ${s.i}/${Math.max(0, s.n - 1)}`) : null,
      s ? h('button', { class: 'knopf text', onclick: () => { z.sim = null; stopTakt(); malen(); } }, '✕') : null),
    s ? h('div', { class: 'zeile', style: { gap: '18px', marginTop: '8px', alignItems: 'flex-end', flexWrap: 'wrap' } }, ansicht,
      fertig ? h('div', { class: 'urteil ' + (s.r.akzeptiert ? 'gut' : 'schlecht') }, s.r.akzeptiert ? '✓ akzeptiert' : '✗ abgelehnt', h('span', { class: 'grund' }, s.r.grund)) : null) : null);
}

// ================================================================== Oberfläche

function malen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && 'selectionStart' in aktiv ? aktiv.selectionStart : null;
  const kopf = kopfleiste();
  if (z.modus === 'grammatik') {
    app.replaceChildren(h('div', { class: 'werk' }, kopf, grammatikAnsicht()));
    flaeche = null;
  } else {
    const f = h('div', { class: 'flaeche' }, h('div', { class: 'zeichnung' }));
    app.replaceChildren(h('div', { class: 'werk' }, kopf,
      h('div', { class: 'hauptteil' }, h('div', { class: 'buehne' }, werkzeugleiste(), f), h('div', { class: 'seite-leiste', id: 'seite' }, seite())),
      simLeiste()));
    flaecheEinrichten(f);
    leinwandMalen();
  }
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos !== null && e.setSelectionRange) try { e.setSelectionRange(pos, pos); } catch (_) {} }
  lyra.titel(doc() ? doc().name : '');
}
function seiteMalen() { const s = document.getElementById('seite'); if (s) s.replaceChildren(seite()); }

function kopfleiste() {
  const d = doc();
  const name = h('input', { class: 'name-feld', 'data-feld': 'name', value: d.name });
  name.addEventListener('input', () => { d.name = name.value; sichern(); lyra.titel(d.name); });
  return h('div', { class: 'kopf' },
    h('div', { class: 'marke' }, 'Ω'),
    h('div', { class: 'reiter' }, Object.entries(MODI).map(([m, [n, s]]) => h('button', { class: z.modus === m ? 'an' : '', onclick: async () => {
      z.modus = m; z.auswahl = null; z.sim = null; z.cyk = null; stopTakt(); z.verlauf = [];
      try { await lyra.speicher.schreiben('modus', m); } catch (_) {}
      malen();
    } }, `${s} ${n}`))),
    name,
    h('span', { class: 'wachsen' }),
    h('button', { class: 'knopf text', title: 'Beispiel laden', onclick: () => { z.docs[z.modus] = beispiel(z.modus); z.verlauf = []; geaendert(); } }, '💡 Beispiel'),
    z.modus !== 'grammatik' ? h('button', { class: 'knopf text', onclick: exportieren }, '⬇ Export') : null,
    h('button', { class: 'knopf text', title: 'Meine Arbeiten', onclick: listeDialog }, '📂'),
    h('button', { class: 'knopf text', title: 'Neu', onclick: () => {
      z.docs[z.modus] = z.modus === 'grammatik' ? { id: lyra.neueId(), typ: 'grammatik', name: 'Neue Grammatik', text: 'S → ', zeit: lyra.jetzt() }
        : { id: lyra.neueId(), typ: z.modus, name: z.modus === 'keller' ? 'Neuer Kellerautomat' : 'Neue Turingmaschine', zustaende: [], uebergaenge: [], startsymbol: '#', annahme: 'ende', zeit: lyra.jetzt() };
      z.verlauf = [];
      geaendert();
    } }, '＋'));
}

function werkzeugleiste() {
  const k = (w, zeichen, titel) => h('button', { class: 'wz' + (z.werkzeug === w ? ' an' : ''), title: titel, onclick: () => { z.werkzeug = w; malen(); } }, zeichen);
  return h('div', { class: 'werkzeuge' },
    k('zeiger', '↖', 'Auswählen und verschieben (V)'),
    k('zustand', '◯', 'Zustand anlegen (Z) – oder Doppelklick'),
    k('pfeil', '↗', 'Übergang ziehen (T) – oder mit ⇧ ziehen'),
    h('div', { class: 'trenner' }),
    h('button', { class: 'wz', title: 'Rückgängig (⌘Z)', disabled: !z.verlauf.length, onclick: rueckgaengig }, '↶'));
}

function seite() {
  const d = doc();
  const a = z.auswahl;
  const regelHilfe = z.modus === 'keller'
    ? 'Eine Regel je Zeile: „lesen, pop → push“, z. B. a, A → AA · ε für nichts lesen / nichts entfernen / nichts ablegen · push „YX“ legt Y oben auf.'
    : 'Eine Regel je Zeile: „lesen → schreiben, Richtung“, z. B. a → X, R · Richtung L, R oder N · Leerzeichen auf dem Band: □ oder _.';
  if (a && a.typ === 'zustand' && zustand(a.id)) {
    const q = zustand(a.id);
    const n = h('input', { class: 'eingabe', 'data-feld': 'zname', value: q.name });
    n.addEventListener('input', () => { q.name = n.value.trim() || q.name; sichern(); leinwandMalen(); });
    const schalter = (an, text, f) => h('button', { class: 'schalter' + (an ? ' an' : ''), onclick: f }, h('span', { class: 'knubbel' }), text);
    return h('div', { class: 'spalte', style: { gap: '12px' } },
      h('div', { class: 'ueberschrift-klein' }, 'Zustand'), n,
      schalter(q.start, 'Startzustand', () => { merken(); d.zustaende.forEach((x) => { x.start = x.id === q.id; }); geaendert(); }),
      schalter(q.ende, z.modus === 'turing' ? 'Akzeptierender Haltezustand' : 'Endzustand', () => { merken(); q.ende = !q.ende; geaendert(); }),
      h('button', { class: 'knopf text gefahr', onclick: loeschen }, '🗑 Zustand löschen'));
  }
  if (a && a.typ === 'kante' && d.uebergaenge[a.i]) {
    const u = d.uebergaenge[a.i];
    const ta = h('textarea', { class: 'eingabe mono', 'data-feld': 'regeln', rows: 5, placeholder: z.modus === 'keller' ? 'a, A → AA\nb, A → ε' : 'a → X, R\n□ → □, N' });
    ta.value = (u.text !== undefined ? u.text : u.regeln.map(regelText).join('\n'));
    const fehler = h('div', { class: 'klein', style: { color: 'var(--falsch)' } });
    let gemerkt = false;
    ta.addEventListener('input', () => {
      if (!gemerkt) { merken(); gemerkt = true; }
      const zeilen = ta.value.split('\n').map((x) => x.trim()).filter(Boolean);
      const lesen = z.modus === 'keller' ? Maschinen.kellerRegelLesen : Maschinen.tmRegelLesen;
      const regeln = zeilen.map(lesen);
      u.regeln = regeln.filter(Boolean);
      const schlecht = zeilen.filter((_, i) => !regeln[i]);
      fehler.textContent = schlecht.length ? `Nicht verstanden: ${schlecht.join(' · ')}` : '';
      z.sim = null;
      sichern();
      leinwandMalen();
    });
    return h('div', { class: 'spalte', style: { gap: '10px' } },
      h('div', { class: 'ueberschrift-klein' }, 'Übergang'),
      h('div', { class: 'fett', style: { fontSize: '17px' } }, `${schoen(zustand(u.von).name)} → ${schoen(zustand(u.nach).name)}`),
      ta, fehler,
      h('div', { class: 'zeile umbruch', style: { gap: '4px' } }, (z.modus === 'keller' ? ['ε', '→', '#'] : ['□', '→', 'L', 'R', 'N']).map((c) => h('button', { class: 'chip', onclick: () => {
        const p = ta.selectionStart;
        ta.setRangeText(c, p, ta.selectionEnd, 'end');
        ta.focus();
        ta.dispatchEvent(new Event('input'));
      } }, c))),
      h('div', { class: 'leise klein' }, regelHilfe),
      h('button', { class: 'knopf text gefahr', onclick: loeschen }, '🗑 Übergang löschen'));
  }
  const kopf = [h('div', { class: 'ueberschrift-klein' }, MODI[z.modus][0]),
    h('div', { class: 'leise klein' }, `${d.zustaende.length} Zustände · ${d.uebergaenge.reduce((s, u) => s + u.regeln.length, 0)} Regeln`)];
  if (z.modus === 'keller') {
    const sym = h('input', { class: 'eingabe mono', value: d.startsymbol || '', placeholder: '#', style: { width: '80px' } });
    sym.addEventListener('change', () => { merken(); d.startsymbol = [...sym.value.trim()][0] || ''; geaendert(); });
    const wahl = (w, n) => h('button', { class: 'chip' + (d.annahme === w ? ' an' : ''), onclick: () => { merken(); d.annahme = w; geaendert(); } }, n);
    kopf.push(h('div', { class: 'zeile' }, h('span', { class: 'klein' }, 'Kellerboden'), sym),
      h('div', {}, h('div', { class: 'klein', style: { marginBottom: '4px' } }, 'Akzeptiert per'), h('div', { class: 'zeile', style: { gap: '6px' } }, wahl('ende', 'Endzustand'), wahl('leer', 'leerem Keller'))));
  } else kopf.push(h('div', { class: 'leise klein' }, 'Die Maschine hält in einem akzeptierenden Zustand (Doppelkreis) – oder wenn keine Regel passt (verwirft).'));
  kopf.push(h('div', { class: 'hilfe leise klein' }, h('div', { class: 'fett' }, 'So geht’s'),
    'Doppelklick: Zustand · mit T bzw. ⇧ ziehen: Übergang · Doppelklick auf Zustand: Endzustand · ⌫ löschen · ⌘Z rückgängig', h('br'), regelHilfe));
  return h('div', { class: 'spalte', style: { gap: '12px' } }, ...kopf);
}

// ------------------------------------------------------------------ Grammatik & CYK

function grammatikAnsicht() {
  const d = doc();
  let G = null;
  let C = null;
  let fehler = null;
  try { G = Maschinen.grammatikLesen(d.text); C = Maschinen.chomsky(G); } catch (e) { fehler = String(e.message || e); }
  const ta = h('textarea', { class: 'eingabe mono grammatik', 'data-feld': 'grammatik', rows: 8, spellcheck: 'false' });
  ta.value = d.text;
  let p = null;
  ta.addEventListener('input', () => { d.text = ta.value; sichern(); clearTimeout(p); p = setTimeout(() => { z.cyk = null; malen(); }, 600); });
  const wort = h('input', { class: 'eingabe mono', 'data-feld': 'cyk', placeholder: 'Wort für CYK, z. B. a+a*a (leer = ε)', value: z.cykWort });
  wort.addEventListener('input', () => { z.cykWort = wort.value; });
  const pruefen = () => { if (C) { z.cyk = Maschinen.cyk(C.grammatik, z.cykWort); malen(); } };
  wort.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefen(); });
  const beispiele = G ? Maschinen.woerter(G, { maxLaenge: 6, maxAnzahl: 14 }) : [];
  return h('div', { class: 'grammatik-seite' },
    h('div', { class: 'spalte', style: { gap: '10px' } },
      h('div', { class: 'ueberschrift-klein' }, 'Grammatik'),
      ta,
      h('div', { class: 'zeile umbruch', style: { gap: '4px' } }, ['→', '|', 'ε'].map((c) => h('button', { class: 'chip', onclick: () => { const q = ta.selectionStart; ta.setRangeText(c === '|' ? ' | ' : c === '→' ? ' → ' : c, q, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input')); } }, c))),
      h('div', { class: 'leise klein' }, 'Je Zeile „A → … | …“. Nichtterminale: Großbuchstaben (S, A1, B\'), alles andere Terminale. ε = leeres Wort.'),
      fehler ? h('div', { class: 'kasten falsch' }, fehler) : null,
      beispiele.length ? h('div', {}, h('div', { class: 'ueberschrift-klein', style: { margin: '6px 0' } }, 'Kurze Wörter der Sprache'),
        h('div', { class: 'zeile umbruch', style: { gap: '5px' } }, beispiele.map((w) => h('button', { class: 'chip mono', onclick: () => { z.cykWort = w; pruefen(); } }, w || 'ε')))) : null,
      C ? h('div', { style: { marginTop: '6px' } }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, 'Chomsky-Normalform – Schritt für Schritt'),
        C.schritte.map((s, i) => h('details', { class: 'schritt', open: i === C.schritte.length - 1 },
          h('summary', {}, s.titel), h('div', { class: 'leise klein' }, s.text), h('pre', {}, s.grammatik)))) : null),
    h('div', { class: 'spalte', style: { gap: '10px' } },
      h('div', { class: 'ueberschrift-klein' }, 'CYK – gehört das Wort zur Sprache?'),
      h('div', { class: 'zeile' }, wort, h('button', { class: 'knopf', disabled: !C, onclick: pruefen }, 'Prüfen')),
      z.cyk ? cykAnsicht(z.cyk, C.grammatik) : h('div', { class: 'leise klein' }, 'Gib ein Wort ein – Omega füllt die CYK-Tabelle und zeigt den Ableitungsbaum.')));
}

function cykAnsicht(r, G) {
  const n = r.wort.length;
  const urteil = h('div', { class: 'urteil ' + (r.akzeptiert ? 'gut' : 'schlecht') }, r.akzeptiert ? '✓ gehört zur Sprache' : '✗ gehört nicht zur Sprache',
    h('span', { class: 'grund' }, r.akzeptiert ? `${G.start} steht oben in der Tabelle.` : n ? `${G.start} fehlt in der obersten Zelle.` : `${G.start} → ε gibt es nicht.`));
  if (!n) return h('div', {}, urteil);
  const zeilen = [];
  for (let l = n; l >= 1; l--) {
    zeilen.push(h('tr', {}, h('th', { class: 'leise klein' }, `l=${l}`), [...Array(n)].map((_, i) => {
      if (i + l > n) return h('td', { class: 'aus' });
      const menge = r.tabelle[l][i];
      const start = l === n && menge.includes(G.start);
      return h('td', { class: (menge.length ? 'voll' : '') + (start ? ' start' : ''), title: `${r.wort.slice(i, i + l).join('')}` }, menge.length ? menge.join(', ') : '∅');
    })));
  }
  zeilen.push(h('tr', {}, h('th', {}), r.wort.map((c) => h('th', { class: 'wortzeichen' }, c))));
  return h('div', { class: 'spalte', style: { gap: '10px' } }, urteil,
    h('div', { class: 'cyk-box' }, h('table', { class: 'cyk' }, zeilen)),
    r.baum ? h('div', {}, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, 'Ableitungsbaum'), baumSvg(r.baum)) : null);
}

/** Ableitungsbaum als SVG: Blätter nebeneinander, Eltern mittig darüber. */
function baumSvg(baum) {
  const knoten = [];
  let blatt = 0;
  const tiefeMax = { v: 0 };
  const lege = (k, tiefe) => {
    tiefeMax.v = Math.max(tiefeMax.v, tiefe);
    if (!k.kinder.length) { const x = blatt++; knoten.push({ k, x, tiefe }); return x; }
    const xs = k.kinder.map((c) => lege(c, tiefe + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    knoten.push({ k, x, tiefe, kinder: xs.map((cx, i) => ({ x: cx, tiefe: tiefe + 1, k: k.kinder[i] })) });
    return x;
  };
  lege(baum, 0);
  const sx = 46;
  const sy = 54;
  const w = Math.max(1, blatt) * sx + 20;
  const hh = (tiefeMax.v + 1) * sy + 10;
  const teile = [];
  for (const n of knoten) {
    if (n.kinder) for (const c of n.kinder) teile.push(`<line x1="${10 + n.x * sx + sx / 2}" y1="${18 + n.tiefe * sy + 10}" x2="${10 + c.x * sx + sx / 2}" y2="${18 + c.tiefe * sy - 12}" class="baum-linie"/>`);
  }
  for (const n of knoten) {
    const terminal = !n.k.kinder.length;
    teile.push(`<text x="${10 + n.x * sx + sx / 2}" y="${18 + n.tiefe * sy}" class="${terminal ? 'baum-t' : 'baum-nt'}" text-anchor="middle" dominant-baseline="central">${esc(n.k.s)}</text>`);
  }
  const box = h('div', { class: 'baum' });
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}">${teile.join('')}</svg>`;
  return box;
}

// ------------------------------------------------------------------ Export, Liste

async function exportieren() {
  const d = doc();
  if (!d.zustaende.length) return;
  const name = (d.name || 'Omega').replace(/[/\\:*?"<>|]/g, ' ').trim();
  const w = await lyra.dialog('Exportieren', h('p', { class: 'leise klein' }, 'Als Bild für Notizen und Folien.'), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'SVG', art: 'tonal', wert: 'svg' },
    { text: 'PNG', wert: 'png' },
  ]);
  if (!w) return;
  const Z = zeichnung(d, { fuerExport: true });
  try {
    if (w === 'png') await lyra.speichern(name + '.png', alsPng(Z), true);
    else await lyra.speichern(name + '.svg', alsSvg(Z, exportRahmen(Z), true));
  } catch (e) {
    await lyra.dialog('Hat nicht geklappt', h('p', {}, String((e && e.message) || e)), [{ text: 'OK', wert: true }]);
  }
}

async function listeDialog() {
  const eigene = z.liste.filter((x) => x.typ === z.modus);
  const box = h('div', { class: 'spalte', style: { gap: '6px', minWidth: '420px', maxHeight: '400px', overflow: 'auto' } },
    eigene.length ? eigene.map((x) => h('div', { class: 'zeile' },
      h('button', { class: 'wachsen listen-knopf', onclick: async () => {
        dialogZu();
        try { const d = await lyra.speicher.lesen('docs/' + x.id); if (d) { z.docs[z.modus] = d; z.verlauf = []; z.sim = null; z.cyk = null; malen(); } } catch (_) {}
      } }, h('div', { class: 'fett' }, x.name), h('div', { class: 'leise klein' }, new Date(x.zeit * 1000).toLocaleString('de-DE'))),
      h('button', { class: 'knopf text', onclick: async () => {
        if (!window.confirm(`„${x.name}“ löschen?`)) return;
        try { await lyra.speicher.loeschen('docs/' + x.id); } catch (_) {}
        z.liste = z.liste.filter((y) => y.id !== x.id);
        dialogZu();
        listeDialog();
      } }, '🗑'))) : [h('div', { class: 'leise' }, 'Noch nichts gespeichert.')]);
  await lyra.dialog({ keller: 'Meine Kellerautomaten', turing: 'Meine Turingmaschinen', grammatik: 'Meine Grammatiken' }[z.modus], box, [{ text: 'Schließen', wert: true }]);
}

start();
