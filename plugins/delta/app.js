'use strict';
/*
 * Delta – DEAs und NEAs entwerfen, simulieren und aus einer Sprache erzeugen.
 * Die Rechenarbeit steckt in automat.js; hier: Zeichenfläche, Werkzeuge, Simulation, Dialoge, Speichern.
 */
const { h, mdElement } = lyra;
const EPS = Automat.EPS;

const STANDARD = { plusIstOder: true, falle: true, ziel: 'min', ki: 'auto' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
/** „q12“ → „q₁₂“, „{q0,q1}“ → „{q₀,q₁}“ */
const schoen = (n) => String(n).replace(/([A-Za-z])(\d+)/g, (_, b, d) => b + [...d].map((c) => SUB[c]).join(''));
const SCHRIFT = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  A: null,
  liste: [],
  werkzeug: 'zeiger', // zeiger | zustand | pfeil
  auswahl: null, // {typ:'zustand', id} | {typ:'kante', i}
  zug: null, // Ziehen: {id, dx, dy, vorher, bewegt} | {pfeilVon, x, y}
  sim: null, // {wort, l, i}
  takt: null,
  verlauf: [],
  zukunft: [],
  testText: '',
  testErgebnis: null,
  laeuft: false,
  status: '',
  fehler: null,
};
const app = document.getElementById('app');
/** Offenen Dialog von lyra.dialog schließen (wie ein Klick daneben). */
const dialogZu = () => { const g = document.querySelector('.dialog-grund'); if (g) g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); };

// ================================================================== Speichern, Rückgängig

function neuerAutomat(name = 'Neuer Automat') {
  return { id: lyra.neueId(), name, art: 'dea', zustaende: [], uebergaenge: [], alphabet: [], zeit: lyra.jetzt() };
}

let sichernPlan = null;
function sichern() {
  clearTimeout(sichernPlan);
  sichernPlan = setTimeout(async () => {
    const A = z.A;
    A.zeit = lyra.jetzt();
    try {
      await lyra.speicher.schreiben('automaten/' + A.id, A);
      await lyra.speicher.schreiben('zuletzt', A.id);
    } catch (_) {}
    const i = z.liste.findIndex((x) => x.id === A.id);
    const kurz = { id: A.id, name: A.name, art: A.art, n: A.zustaende.length, zeit: A.zeit };
    if (i >= 0) z.liste[i] = kurz; else z.liste.unshift(kurz);
  }, 500);
}

/** Vor jeder Änderung aufrufen (für ⌘Z). */
function merken() {
  z.verlauf.push(JSON.stringify(z.A));
  if (z.verlauf.length > 100) z.verlauf.shift();
  z.zukunft = [];
}
function geaendert({ alles = true } = {}) {
  z.sim = null;
  z.testErgebnis = null;
  stopTakt();
  sichern();
  if (alles) malen(); else leinwandMalen();
}
function rueckgaengig() {
  if (!z.verlauf.length) return;
  z.zukunft.push(JSON.stringify(z.A));
  z.A = JSON.parse(z.verlauf.pop());
  z.auswahl = null;
  geaendert();
}
function wiederholen() {
  if (!z.zukunft.length) return;
  z.verlauf.push(JSON.stringify(z.A));
  z.A = JSON.parse(z.zukunft.pop());
  z.auswahl = null;
  geaendert();
}

function oeffnen(A) {
  z.A = A;
  z.auswahl = null;
  z.sim = null;
  z.verlauf = [];
  z.zukunft = [];
  z.testErgebnis = null;
  stopTakt();
  sichern();
  malen();
}

// ================================================================== Start

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try {
    z.liste = (await lyra.speicher.liste('automaten')).map((e) => e.wert).filter((a) => a && a.id)
      .map((A) => ({ id: A.id, name: A.name, art: A.art, n: A.zustaende.length, zeit: A.zeit })).sort((a, b) => b.zeit - a.zeit);
  } catch (_) {}
  let A = null;
  try {
    const id = await lyra.speicher.lesen('zuletzt');
    if (id) A = await lyra.speicher.lesen('automaten/' + id);
  } catch (_) {}
  z.A = A && A.zustaende ? A : neuerAutomat();
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  document.addEventListener('keydown', taste);
  window.addEventListener('resize', () => leinwandMalen());
  malen();
  if ((z.info.route || location.hash.slice(1)) === 'einstellungen') einstellungen();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) return lyra.abbrechen();
  if (z.zug && z.zug.pfeilVon) { z.zug = null; return leinwandMalen(); }
  if (z.sim) { z.sim = null; stopTakt(); return malen(); }
  if (z.auswahl) { z.auswahl = null; return malen(); }
  lyra.zurueck();
}

function taste(e) {
  if (document.querySelector('.dialog-grund')) return;
  const imFeld = /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && e.key.toLowerCase() === 'z') {
    if (imFeld) return;
    e.preventDefault();
    return e.shiftKey ? wiederholen() : rueckgaengig();
  }
  if (imFeld || cmd) return;
  const k = e.key.toLowerCase();
  if (k === 'v') werkzeug('zeiger');
  else if (k === 'z') werkzeug('zustand');
  else if (k === 't' || k === 'p') werkzeug('pfeil');
  else if ((k === 'backspace' || k === 'delete') && z.auswahl) { e.preventDefault(); loeschen(); }
  else if (k === 's' && z.auswahl && z.auswahl.typ === 'zustand') startSetzen(z.auswahl.id);
  else if (k === 'e' && z.auswahl && z.auswahl.typ === 'zustand') endeUmschalten(z.auswahl.id);
  else if (k === 'arrowright' && z.sim) simSchritt(1);
  else if (k === 'arrowleft' && z.sim) simSchritt(-1);
}

function werkzeug(w) {
  z.werkzeug = w;
  z.zug = null;
  malen();
}

// ================================================================== Bearbeiten

const zustand = (id) => z.A.zustaende.find((q) => q.id === id);
function naechsterName() {
  const n = new Set(z.A.zustaende.map((q) => q.name));
  let i = 0;
  while (n.has('q' + i)) i++;
  return 'q' + i;
}
function zustandAnlegen(x, y) {
  merken();
  const q = { id: 's' + lyra.neueId(), name: naechsterName(), x: Math.round(x), y: Math.round(y), start: !z.A.zustaende.length, ende: false };
  z.A.zustaende.push(q);
  z.auswahl = { typ: 'zustand', id: q.id };
  geaendert();
}
function kanteAnlegen(von, nach) {
  let i = z.A.uebergaenge.findIndex((u) => u.von === von && u.nach === nach);
  if (i < 0) {
    merken();
    z.A.uebergaenge.push({ von, nach, zeichen: [] });
    i = z.A.uebergaenge.length - 1;
    geaendert({ alles: false });
  }
  z.auswahl = { typ: 'kante', i };
  malen();
  const f = document.querySelector('[data-feld="zeichen"]');
  if (f) { f.focus(); f.select(); }
}
function startSetzen(id) {
  merken();
  for (const q of z.A.zustaende) q.start = q.id === id;
  geaendert();
}
function endeUmschalten(id) {
  merken();
  const q = zustand(id);
  q.ende = !q.ende;
  geaendert();
}
function loeschen() {
  const a = z.auswahl;
  if (!a) return;
  merken();
  if (a.typ === 'zustand') {
    const war = zustand(a.id);
    z.A.zustaende = z.A.zustaende.filter((q) => q.id !== a.id);
    z.A.uebergaenge = z.A.uebergaenge.filter((u) => u.von !== a.id && u.nach !== a.id);
    if (war && war.start && z.A.zustaende.length) z.A.zustaende[0].start = true;
  } else {
    z.A.uebergaenge.splice(a.i, 1);
  }
  z.auswahl = null;
  geaendert();
}
/** „a, b“, „ab“, „eps“ → ['a', 'b'] bzw. ['ε'] */
function zeichenLesen(t) {
  const aus = [];
  for (const teil of String(t).split(/[,;\s]+/).filter(Boolean)) {
    if (/^(ε|eps|epsilon|λ)$/i.test(teil)) aus.push(EPS);
    else aus.push(...[...teil]);
  }
  return [...new Set(aus)];
}

// ================================================================== Zeichnung (für Bildschirm, SVG und PNG)

const messer = document.createElement('canvas').getContext('2d');
function textBreite(t, groesse, gewicht = 600) {
  messer.font = `${gewicht} ${groesse}px ${SCHRIFT}`;
  return messer.measureText(t).width;
}
const radius = (q) => Math.max(27, textBreite(schoen(q.name), 17, 600) / 2 + 13);

/** Farben: am Bildschirm aus dem Stil (hell/dunkel), beim Export immer hell. */
function farben(fuerExport) {
  if (fuerExport) {
    return { grund: '#ffffff', zustand: '#ffffff', rand: '#1f2430', text: '#1f2430', kante: '#3a4050', akzent: '#16a34a', aktiv: '#dcfce7', gut: '#16a34a', schlecht: '#dc2626', wahl: '#2563eb', leise: '#8a90a0' };
  }
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return { grund: v('--flaeche'), zustand: v('--zustand'), rand: v('--text'), text: v('--text'), kante: v('--kante'), akzent: v('--akzent'), aktiv: v('--aktiv'), gut: v('--ok'), schlecht: v('--falsch'), wahl: v('--wahl'), leise: v('--leise') };
}

/**
 * Baut die Zeichenliste: Kreise, Pfade (mit Pfeilspitzen als eigene Dreiecke), Texte. `ziel` markiert, was man
 * anklicken kann (nur am Bildschirm). `sim`: aktuelle Zustände und benutzte Übergänge hervorheben.
 */
function zeichnung(A, { fuerExport = false } = {}) {
  const F = farben(fuerExport);
  const teile = [];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const dehnen = (x, y, r = 0) => { box[0] = Math.min(box[0], x - r); box[1] = Math.min(box[1], y - r); box[2] = Math.max(box[2], x + r); box[3] = Math.max(box[3], y + r); };
  const sim = !fuerExport && z.sim ? z.sim.l.schritte[z.sim.i] : null;
  const simEnde = !fuerExport && z.sim && z.sim.i === z.sim.l.schritte.length - 1;
  const aktiv = new Set(sim ? sim.menge : []);
  const benutzt = new Set(sim ? sim.kanten.map(([a, b]) => a + '>' + b) : []);
  const pos = new Map(A.zustaende.map((q) => [q.id, { x: q.x, y: q.y, r: radius(q) }]));
  const spitze = (x, y, wx, wy, farbe, ziel) => {
    const l = Math.hypot(wx, wy) || 1;
    const dx = wx / l;
    const dy = wy / l;
    const L = 12;
    const B = 6.5;
    const d = `M${x} ${y} L${x - dx * L - dy * B} ${y - dy * L + dx * B} L${x - dx * L + dy * B} ${y - dy * L - dx * B} Z`;
    teile.push({ art: 'pfad', d, fuellung: farbe, ziel });
  };
  const beschrift = (x, y, text, farbe, ziel) => {
    teile.push({ art: 'text', x, y, text, groesse: 16, gewicht: 650, farbe, halo: F.grund || '#ffffff', ziel });
    const b = textBreite(text, 16, 650);
    dehnen(x - b / 2, y - 10);
    dehnen(x + b / 2, y + 10);
  };

  // Übergänge
  A.uebergaenge.forEach((u, i) => {
    const p = pos.get(u.von);
    const q = pos.get(u.nach);
    if (!p || !q) return;
    const gewaehlt = !fuerExport && z.auswahl && z.auswahl.typ === 'kante' && z.auswahl.i === i;
    const an = benutzt.has(u.von + '>' + u.nach);
    const farbe = gewaehlt ? F.wahl : an ? F.akzent : F.kante;
    const breite = an || gewaehlt ? 3 : 2;
    const text = u.zeichen.length ? u.zeichen.join(', ') : '?';
    const ziel = { typ: 'kante', i };
    if (u.von === u.nach) {
      // Schleife – auf der Seite, wo am wenigsten andere Pfeile sind (oben bevorzugt)
      const w = schleifenWinkel(A, u.von, pos);
      const ux = Math.cos(w);
      const uy = Math.sin(w);
      const vx = -uy;
      const vy = ux;
      const dreh = (g) => [Math.cos(w + g), Math.sin(w + g)];
      const [s1, s2] = dreh(-Math.PI / 6);
      const [e1, e2] = dreh(Math.PI / 6);
      const s = [p.x + p.r * s1, p.y + p.r * s2];
      const e = [p.x + p.r * e1, p.y + p.r * e2];
      const hoch = p.r + 48;
      const c1 = [p.x + hoch * ux - 38 * vx, p.y + hoch * uy - 38 * vy];
      const c2 = [p.x + hoch * ux + 38 * vx, p.y + hoch * uy + 38 * vy];
      const d = `M${s[0]} ${s[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`;
      if (!fuerExport) teile.push({ art: 'pfad', d, linie: 'transparent', breite: 16, ziel });
      teile.push({ art: 'pfad', d, linie: farbe, breite, ziel });
      spitze(e[0], e[1], e[0] - c2[0], e[1] - c2[1], farbe, ziel);
      dehnen(p.x + hoch * ux, p.y + hoch * uy, 40);
      const abst = p.r + (Math.abs(ux) > 0.5 ? 58 : 50);
      beschrift(p.x + abst * ux, p.y + abst * uy, text, gewaehlt ? F.wahl : F.text, ziel);
      return;
    }
    const zurueck = A.uebergaenge.some((x) => x.von === u.nach && x.nach === u.von);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l;
    let ny = dx / l;
    // Liegt ein anderer Zustand im Weg? Dann im Bogen drumherum (weit genug, dass er frei bleibt).
    let bogen = zurueck ? 34 : 0;
    let seiteWahl = 0;
    let schleifenOben = false;
    for (const o of A.zustaende) {
      if (o.id === u.von || o.id === u.nach) continue;
      const t = ((o.x - p.x) * dx + (o.y - p.y) * dy) / (l * l);
      if (t <= 0.05 || t >= 0.95) continue;
      const abst = (o.x - p.x) * nx + (o.y - p.y) * ny; // vorzeichenbehaftet
      const schleife = A.uebergaenge.some((x) => x.von === o.id && x.nach === o.id);
      const r = radius(o) + (schleife ? 80 : 26);
      if (Math.abs(abst) >= r) continue;
      if (schleife) schleifenOben = true;
      seiteWahl += abst;
      const noetig = (r + Math.abs(abst)) / (4 * t * (1 - t));
      bogen = Math.max(bogen, Math.min(260, noetig));
    }
    if (bogen > 34 && !zurueck) {
      // weg von den Zuständen im Weg – und unten herum, wenn dort Schleifen oben sitzen
      if (schleifenOben ? ny < 0 : seiteWahl > 0) { nx = -nx; ny = -ny; }
    }
    if (bogen > 0) {
      // Bogen: Hin- und Rückweg liegen nicht übereinander, und nichts verschwindet hinter einem Zustand
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
      beschrift(mx + nx * 14, my + ny * 14, text, gewaehlt ? F.wahl : F.text, ziel);
      dehnen(c[0], c[1]);
      return;
    }
    const s = [p.x + (dx / l) * p.r, p.y + (dy / l) * p.r];
    const e = [q.x - (dx / l) * q.r, q.y - (dy / l) * q.r];
    const d = `M${s[0]} ${s[1]} L${e[0]} ${e[1]}`;
    if (!fuerExport) teile.push({ art: 'pfad', d, linie: 'transparent', breite: 16, ziel });
    teile.push({ art: 'pfad', d, linie: farbe, breite, ziel });
    spitze(e[0], e[1], dx, dy, farbe, ziel);
    // Beschriftung auf die „obere“ Seite
    const seite = ny > 0 || (Math.abs(ny) < 0.01 && nx > 0) ? -1 : 1;
    beschrift((s[0] + e[0]) / 2 + nx * 15 * seite, (s[1] + e[1]) / 2 + ny * 15 * seite, text, gewaehlt ? F.wahl : F.text, ziel);
  });

  // Zustände
  for (const q of A.zustaende) {
    const { x, y, r } = pos.get(q.id);
    const gewaehlt = !fuerExport && z.auswahl && z.auswahl.typ === 'zustand' && z.auswahl.id === q.id;
    const istAktiv = aktiv.has(q.id);
    let rand = gewaehlt ? F.wahl : F.rand;
    let fuellung = F.zustand;
    if (istAktiv) {
      fuellung = F.aktiv;
      rand = simEnde ? (z.sim.l.akzeptiert && q.ende ? F.gut : F.schlecht) : F.akzent;
    }
    const ziel = { typ: 'zustand', id: q.id };
    if (q.start) {
      const a = [x - r - 46, y];
      const b = [x - r, y];
      teile.push({ art: 'pfad', d: `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`, linie: F.kante, breite: 2 });
      spitze(b[0], b[1], 1, 0, F.kante);
      dehnen(a[0], y, 8);
      teile.push({ art: 'text', x: a[0] - 4, y: y - 14, text: 'Start', groesse: 11, gewicht: 600, farbe: F.leise, anker: 'start' });
    }
    teile.push({ art: 'kreis', x, y, r, fuellung, linie: rand, breite: gewaehlt || istAktiv ? 3 : 2, ziel, schatten: istAktiv });
    if (q.ende) teile.push({ art: 'kreis', x, y, r: r - 5, fuellung: null, linie: rand, breite: 1.8, ziel });
    teile.push({ art: 'text', x, y, text: schoen(q.name), groesse: 17, gewicht: 600, farbe: F.text, ziel });
    dehnen(x, y, r + 6);
  }
  // Pfeil, der gerade gezogen wird
  if (!fuerExport && z.zug && z.zug.pfeilVon && pos.get(z.zug.pfeilVon)) {
    const p = pos.get(z.zug.pfeilVon);
    teile.push({ art: 'pfad', d: `M${p.x} ${p.y} L${z.zug.x} ${z.zug.y}`, linie: F.wahl, breite: 2, gestrichelt: true });
    spitze(z.zug.x, z.zug.y, z.zug.x - p.x, z.zug.y - p.y, F.wahl);
  }
  return { teile, box, F };
}

/** Winkel für die Schleife eines Zustands: weg von seinen anderen Pfeilen (und vom Startpfeil). */
function schleifenWinkel(A, id, pos) {
  const p = pos.get(id);
  const richtungen = [];
  for (const u of A.uebergaenge) {
    if (u.von === u.nach) continue;
    const andere = u.von === id ? u.nach : u.nach === id ? u.von : null;
    if (!andere || !pos.get(andere)) continue;
    const q = pos.get(andere);
    richtungen.push(Math.atan2(q.y - p.y, q.x - p.x));
  }
  const q = A.zustaende.find((x) => x.id === id);
  if (q && q.start) richtungen.push(Math.PI);
  const kandidaten = [-Math.PI / 2, Math.PI / 2, Math.PI, 0, -Math.PI / 4, (-3 * Math.PI) / 4, Math.PI / 4, (3 * Math.PI) / 4];
  let best = kandidaten[0];
  let bestWert = -1;
  for (const k of kandidaten) {
    const frei = richtungen.length ? Math.min(...richtungen.map((r) => { const d = Math.abs(((k - r + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); return d; })) : Math.PI;
    const wert = frei + (k === -Math.PI / 2 ? 0.35 : 0); // oben bevorzugt, wenn es frei genug ist
    if (wert > bestWert + 1e-9) { bestWert = wert; best = k; }
  }
  return best;
}

/** Erzeugte Automaten so anordnen, dass sie in die Zeichenfläche passen. */
function einpassen(A) {
  const breite = flaeche ? flaeche.clientWidth : 900;
  const hoehe = flaeche ? flaeche.clientHeight : 520;
  Automat.anordnen(A); // erst mit Standardabständen, um Spalten und Zeilen zu kennen
  const xs = [...new Set(A.zustaende.map((q) => q.x))];
  const spalten = xs.length;
  const proSpalte = Math.max(1, ...xs.map((x) => A.zustaende.filter((q) => q.x === x).length));
  const abstandX = spalten > 1 ? Math.max(115, Math.min(190, (breite - 290) / (spalten - 1))) : 190;
  const abstandY = proSpalte > 1 ? Math.max(105, Math.min(150, (hoehe - 220) / (proSpalte - 1))) : 140;
  Automat.anordnen(A, { abstandX, abstandY, links: 175, mitte: Math.max(200, hoehe / 2) });
  return A;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function alsSvg(Z, { rahmen, fuerExport = false } = {}) {
  const [x, y, w, hh] = rahmen;
  const teile = Z.teile.map((t) => {
    const daten = !fuerExport && t.ziel ? (t.ziel.typ === 'zustand' ? ` data-z="${esc(t.ziel.id)}"` : ` data-k="${t.ziel.i}"`) : '';
    if (t.art === 'kreis') {
      return `<circle cx="${t.x}" cy="${t.y}" r="${t.r}" fill="${t.fuellung || 'none'}" stroke="${t.linie}" stroke-width="${t.breite}"${t.schatten ? ' class="glimmen"' : ''}${daten}/>`;
    }
    if (t.art === 'pfad') {
      return `<path d="${t.d}" fill="${t.fuellung || 'none'}"${t.linie ? ` stroke="${t.linie}" stroke-width="${t.breite}" stroke-linecap="round"` : ''}${t.gestrichelt ? ' stroke-dasharray="6 5"' : ''}${daten}/>`;
    }
    const halo = t.halo ? ` paint-order="stroke" stroke="${t.halo}" stroke-width="5" stroke-linejoin="round"` : '';
    return `<text x="${t.x}" y="${t.y}" font-size="${t.groesse}" font-weight="${t.gewicht}" fill="${t.farbe}" text-anchor="${t.anker || 'middle'}" dominant-baseline="central"${halo}${daten}>${esc(t.text)}</text>`;
  });
  const grund = fuerExport ? `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#ffffff"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${hh}" width="${w}" height="${hh}" font-family="${esc(SCHRIFT)}">${grund}${teile.join('')}</svg>`;
}

function exportRahmen(Z) {
  const rand = 30;
  return [Z.box[0] - rand, Z.box[1] - rand, Z.box[2] - Z.box[0] + 2 * rand, Z.box[3] - Z.box[1] + 2 * rand].map(Math.round);
}

/** Dieselbe Zeichnung auf eine Leinwand → PNG (base64). */
function alsPng(Z) {
  const [x, y, w, hh] = exportRahmen(Z);
  const s = Math.max(1, Math.min(3, 2400 / Math.max(w, hh)));
  const lw = document.createElement('canvas');
  lw.width = Math.round(w * s);
  lw.height = Math.round(hh * s);
  const c = lw.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, lw.width, lw.height);
  c.setTransform(s, 0, 0, s, -x * s, -y * s);
  for (const t of Z.teile) {
    c.save();
    if (t.art === 'kreis') {
      c.beginPath();
      c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      if (t.fuellung) { c.fillStyle = t.fuellung; c.fill(); }
      c.strokeStyle = t.linie;
      c.lineWidth = t.breite;
      c.stroke();
    } else if (t.art === 'pfad') {
      const p = new Path2D(t.d);
      if (t.fuellung) { c.fillStyle = t.fuellung; c.fill(p); }
      if (t.linie && t.linie !== 'transparent') {
        c.strokeStyle = t.linie;
        c.lineWidth = t.breite;
        c.lineCap = 'round';
        if (t.gestrichelt) c.setLineDash([6, 5]);
        c.stroke(p);
      }
    } else {
      c.font = `${t.gewicht} ${t.groesse}px ${SCHRIFT}`;
      c.textAlign = t.anker === 'start' ? 'left' : t.anker === 'end' ? 'right' : 'center';
      c.textBaseline = 'middle';
      if (t.halo) { c.strokeStyle = t.halo; c.lineWidth = 5; c.lineJoin = 'round'; c.strokeText(t.text, t.x, t.y); }
      c.fillStyle = t.farbe;
      c.fillText(t.text, t.x, t.y);
    }
    c.restore();
  }
  return lw.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

// ================================================================== Zeichenfläche

let flaeche = null; // <div class="flaeche">

function leinwandMalen() {
  if (!flaeche) return;
  const Z = zeichnung(z.A);
  const breite = Math.max(flaeche.clientWidth, Number.isFinite(Z.box[2]) ? Z.box[2] + 80 : 0);
  const hoehe = Math.max(flaeche.clientHeight, Number.isFinite(Z.box[3]) ? Z.box[3] + 80 : 0);
  flaeche.querySelector('.zeichnung').innerHTML = alsSvg(Z, { rahmen: [0, 0, breite, hoehe] });
  const leer = flaeche.querySelector('.leer-hinweis');
  if (leer) leer.style.display = z.A.zustaende.length ? 'none' : '';
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
function trefferZustand(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const t = el && el.closest && el.closest('[data-z]');
  return t ? t.getAttribute('data-z') : null;
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
      if (z.werkzeug === 'pfeil' || e.shiftKey) {
        z.zug = { pfeilVon: id, x, y };
      } else {
        const q = zustand(id);
        z.zug = { id, dx: x - q.x, dy: y - q.y, vorher: JSON.stringify(z.A), bewegt: false };
        if (!z.auswahl || z.auswahl.typ !== 'zustand' || z.auswahl.id !== id) {
          z.auswahl = { typ: 'zustand', id };
          seiteMalen();
        }
      }
      el.setPointerCapture(e.pointerId);
      leinwandMalen();
      return;
    }
    if (kt) {
      z.auswahl = { typ: 'kante', i: Number(kt.getAttribute('data-k')) };
      malen();
      return;
    }
    if (z.werkzeug === 'zustand') {
      zustandAnlegen(x, y);
      return;
    }
    if (z.auswahl) {
      z.auswahl = null;
      malen();
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!z.zug) return;
    const [x, y] = punktIn(e);
    if (z.zug.pfeilVon) {
      z.zug.x = x;
      z.zug.y = y;
    } else {
      const q = zustand(z.zug.id);
      const nx = Math.round((x - z.zug.dx) / 5) * 5;
      const ny = Math.round((y - z.zug.dy) / 5) * 5;
      if (nx !== q.x || ny !== q.y) {
        q.x = Math.max(40, nx);
        q.y = Math.max(40, ny);
        z.zug.bewegt = true;
      }
    }
    leinwandMalen();
  });
  el.addEventListener('pointerup', (e) => {
    const zug = z.zug;
    z.zug = null;
    if (!zug) return;
    if (zug.pfeilVon) {
      const nach = trefferZustand(e);
      if (nach) kanteAnlegen(zug.pfeilVon, nach);
      else leinwandMalen();
      return;
    }
    if (zug.bewegt) {
      z.verlauf.push(zug.vorher);
      z.zukunft = [];
      sichern();
    }
    leinwandMalen();
  });
  el.addEventListener('dblclick', (e) => {
    if (z.werkzeug !== 'zeiger') return; // mit Kreis/Pfeil hat der Klick schon gewirkt
    const zt = e.target.closest('[data-z]');
    if (zt) return endeUmschalten(zt.getAttribute('data-z'));
    if (e.target.closest('[data-k]')) return;
    const [x, y] = punktIn(e);
    zustandAnlegen(x, y);
  });
}

// ================================================================== Oberfläche

function malen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && 'selectionStart' in aktiv ? aktiv.selectionStart : null;
  const scroll = flaeche ? [flaeche.scrollLeft, flaeche.scrollTop] : null;
  const f = h('div', { class: 'flaeche' }, h('div', { class: 'zeichnung' }),
    h('div', { class: 'leer-hinweis' },
      h('div', { class: 'gross' }, 'δ'),
      h('div', { class: 'fett' }, 'Leg los: Doppelklick legt einen Zustand an'),
      h('div', { class: 'leise klein' }, 'Mit dem Pfeil-Werkzeug (T) von Zustand zu Zustand ziehen = Übergang · Doppelklick auf einen Zustand = Endzustand'),
      h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '12px' } },
        h('button', { class: 'knopf tonal', onclick: sprachDialog }, '✨ Aus einer Sprache erzeugen'),
        h('button', { class: 'knopf text', onclick: beispielLaden }, 'Beispiel laden'))));
  app.replaceChildren(h('div', { class: 'werk' }, kopfleiste(),
    h('div', { class: 'hauptteil' }, h('div', { class: 'buehne' }, werkzeugleiste(), f), h('div', { class: 'seite', id: 'seite' }, seite())),
    simLeiste()));
  flaecheEinrichten(f);
  leinwandMalen();
  if (scroll) { f.scrollLeft = scroll[0]; f.scrollTop = scroll[1]; }
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) {
    e.focus();
    if (pos !== null && e.setSelectionRange) try { e.setSelectionRange(pos, pos); } catch (_) {}
  }
  lyra.titel(z.A.name || '');
}

function seiteMalen() {
  const s = document.getElementById('seite');
  if (s) s.replaceChildren(seite());
}

function kopfleiste() {
  const p = Automat.pruefen(z.A);
  const name = h('input', { class: 'name-feld', 'data-feld': 'name', value: z.A.name, title: 'Name des Automaten' });
  name.addEventListener('input', () => { z.A.name = name.value; sichern(); lyra.titel(z.A.name); });
  const art = z.A.art === 'dea'
    ? (p.dea ? h('span', { class: 'abzeichen gut', title: p.vollstaendig ? 'Deterministisch und vollständig' : 'Deterministisch, aber nicht vollständig' }, p.vollstaendig ? 'DEA ✓' : 'DEA (partiell)')
      : h('span', { class: 'abzeichen schlecht', title: p.hinweise.join('\n') }, 'kein DEA ⚠'))
    : h('span', { class: 'abzeichen' }, 'NEA');
  return h('div', { class: 'kopf' },
    h('div', { class: 'marke' }, 'δ'),
    name,
    art,
    h('span', { class: 'wachsen' }),
    h('button', { class: 'knopf tonal', onclick: sprachDialog, title: 'Aus einem regulären Ausdruck oder einer Beschreibung einen NEA/DEA bauen' }, '✨ Aus Sprache'),
    h('button', { class: 'knopf text', onclick: umwandelnDialog }, '⇄ Umwandeln'),
    h('button', { class: 'knopf text', onclick: vergleichDialog, title: 'Erkennt dein Automat genau eine bestimmte Sprache?' }, '✓ Prüfen'),
    h('button', { class: 'knopf text', onclick: exportDialog }, '⬇ Export'),
    h('button', { class: 'knopf text', onclick: listeDialog, title: 'Meine Automaten' }, '📂'),
    h('button', { class: 'knopf text', onclick: () => oeffnen(neuerAutomat()), title: 'Neuer Automat' }, '＋'));
}

function werkzeugleiste() {
  const k = (w, zeichen, titel) => h('button', { class: 'wz' + (z.werkzeug === w ? ' an' : ''), title: titel, onclick: () => werkzeug(w) }, zeichen);
  return h('div', { class: 'werkzeuge' },
    k('zeiger', '↖', 'Auswählen und verschieben (V)'),
    k('zustand', '◯', 'Zustand anlegen (Z) – oder Doppelklick'),
    k('pfeil', '↗', 'Übergang ziehen (T) – oder mit ⇧ von einem Zustand ziehen'),
    h('div', { class: 'trenner' }),
    h('button', { class: 'wz', title: 'Automatisch anordnen', onclick: () => { merken(); einpassen(z.A); geaendert(); } }, '⤢'),
    h('button', { class: 'wz', title: 'Rückgängig (⌘Z)', disabled: !z.verlauf.length, onclick: rueckgaengig }, '↶'),
    h('button', { class: 'wz', title: 'Wiederholen (⇧⌘Z)', disabled: !z.zukunft.length, onclick: wiederholen }, '↷'));
}

// ------------------------------------------------------------------ Seitenleiste (Eigenschaften)

function seite() {
  const a = z.auswahl;
  if (a && a.typ === 'zustand' && zustand(a.id)) return zustandSeite(zustand(a.id));
  if (a && a.typ === 'kante' && z.A.uebergaenge[a.i]) return kanteSeite(z.A.uebergaenge[a.i], a.i);
  return automatSeite();
}

function schalter(an, text, beiKlick) {
  return h('button', { class: 'schalter' + (an ? ' an' : ''), onclick: beiKlick }, h('span', { class: 'knubbel' }), text);
}

function zustandSeite(q) {
  const name = h('input', { class: 'eingabe', 'data-feld': 'zname', value: q.name });
  let gemerkt = false;
  name.addEventListener('input', () => {
    if (!gemerkt) { merken(); gemerkt = true; }
    q.name = name.value.trim() || q.name;
    sichern();
    leinwandMalen();
  });
  const raus = z.A.uebergaenge.map((u, i) => ({ u, i })).filter(({ u }) => u.von === q.id);
  return h('div', { class: 'spalte', style: { gap: '12px' } },
    h('div', { class: 'leise klein' }, 'ZUSTAND'),
    name,
    schalter(q.start, 'Startzustand (S)', () => startSetzen(q.id)),
    schalter(q.ende, 'Endzustand (E)', () => endeUmschalten(q.id)),
    h('div', { class: 'leise klein', style: { marginTop: '6px' } }, 'ÜBERGÄNGE VON HIER'),
    raus.length ? raus.map(({ u, i }) => h('button', { class: 'zeile-k', onclick: () => { z.auswahl = { typ: 'kante', i }; malen(); } },
      `${schoen(q.name)} → ${schoen((zustand(u.nach) || {}).name || '?')}`, h('span', { class: 'leise' }, u.zeichen.join(', ') || '?')))
      : h('div', { class: 'leise klein' }, 'Noch keine – mit dem Pfeil-Werkzeug (T) zu einem Zustand ziehen.'),
    h('button', { class: 'knopf text gefahr', onclick: loeschen }, '🗑 Zustand löschen'));
}

function kanteSeite(u, i) {
  const f = h('input', { class: 'eingabe', 'data-feld': 'zeichen', value: u.zeichen.join(', '), placeholder: 'Zeichen, z. B. a, b' });
  let gemerkt = false;
  f.addEventListener('input', () => {
    if (!gemerkt) { merken(); gemerkt = true; }
    u.zeichen = zeichenLesen(f.value);
    z.sim = null;
    sichern();
    leinwandMalen();
  });
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { z.auswahl = null; malen(); } });
  f.addEventListener('blur', () => { kopfAktualisieren(); });
  const von = zustand(u.von);
  const nach = zustand(u.nach);
  return h('div', { class: 'spalte', style: { gap: '12px' } },
    h('div', { class: 'leise klein' }, 'ÜBERGANG'),
    h('div', { class: 'fett', style: { fontSize: '17px' } }, `${schoen(von.name)} → ${schoen(nach.name)}`),
    h('div', { class: 'zeile' }, f,
      h('button', { class: 'knopf tonal', title: 'ε-Übergang (nur NEA)', onclick: () => {
        merken();
        if (!u.zeichen.includes(EPS)) u.zeichen.push(EPS);
        geaendert();
      } }, 'ε')),
    h('div', { class: 'leise klein' }, 'Mehrere Zeichen mit Komma trennen. ε (leeres Wort) geht nur im NEA. Enter: fertig.'),
    h('button', { class: 'knopf text gefahr', onclick: loeschen }, '🗑 Übergang löschen'));
}

function kopfAktualisieren() {
  const k = document.querySelector('.kopf');
  if (k) k.replaceWith(kopfleiste());
}

function automatSeite() {
  const p = Automat.pruefen(z.A);
  const S = Automat.alphabet(z.A);
  const alpha = h('input', { class: 'eingabe', 'data-feld': 'alphabet', value: S.join(', '), placeholder: 'z. B. a, b' });
  alpha.addEventListener('change', () => {
    merken();
    const neu = zeichenLesen(alpha.value).filter((c) => c !== EPS);
    z.A.alphabet = neu;
    geaendert();
  });
  const artWahl = (w, text) => h('button', { class: 'chip' + (z.A.art === w ? ' an' : ''), onclick: () => { merken(); z.A.art = w; geaendert(); } }, text);
  const rw = z.A.rechenweg;
  return h('div', { class: 'spalte', style: { gap: '12px' } },
    h('div', { class: 'leise klein' }, 'AUTOMAT'),
    h('div', { class: 'zeile', style: { gap: '6px' } }, artWahl('dea', 'DEA'), artWahl('nea', 'NEA')),
    h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, 'Alphabet Σ'), alpha),
    h('div', { class: 'leise klein' }, `${z.A.zustaende.length} Zustände · ${z.A.uebergaenge.length} Übergänge`),
    z.A.quelle ? h('div', { class: 'quelle' },
      h('div', { class: 'leise klein' }, 'ERZEUGT AUS'),
      h('div', { class: 'fett' }, z.A.quelle.text),
      z.A.quelle.regex && z.A.quelle.regex !== z.A.quelle.text ? h('div', { class: 'mono' }, z.A.quelle.regex) : null,
      z.A.quelle.idee ? h('div', { class: 'klein', style: { marginTop: '4px' } }, z.A.quelle.idee) : null,
      z.A.quelle.pruefung ? h('div', { class: 'klein ' + (z.A.quelle.pruefung.falsch.length ? 'warn' : 'ok'), style: { marginTop: '6px' } },
        z.A.quelle.pruefung.falsch.length
          ? `⚠ ${z.A.quelle.pruefung.falsch.length} von ${z.A.quelle.pruefung.gesamt} Beispielwörtern passen nicht: ${z.A.quelle.pruefung.falsch.slice(0, 4).map((w) => w || 'ε').join(', ')} – bitte prüfen (z. B. mit der Testliste). Claude, ChatGPT oder Gemini treffen Sprachen in Worten meist genauer als Lyra (lokal).`
          : `✓ Alle ${z.A.quelle.pruefung.gesamt} Beispielwörter passen`) : null) : null,
    p.hinweise.length ? h('div', { class: 'hinweise' }, p.hinweise.slice(0, 6).map((t) => h('div', { class: 'klein' }, '• ' + t))) : null,
    rw ? rechenwegAnsicht(rw) : null,
    h('div', { class: 'hilfe leise klein' },
      h('div', { class: 'fett' }, 'So geht’s'),
      h('div', {}, 'Doppelklick: Zustand · Ziehen mit T bzw. ⇧: Übergang · Doppelklick auf Zustand: Endzustand · S: Start · ⌫: löschen · ⌘Z: rückgängig')));
}

function rechenwegAnsicht(rw) {
  if (rw.art === 'teilmengen') {
    const S = Object.keys((rw.tabelle[0] || {}).ziele || {}).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
    return h('details', { class: 'rechenweg', open: true },
      h('summary', {}, 'Rechenweg: Potenzmengenkonstruktion'),
      h('div', { class: 'tabelle-box' }, h('table', {},
        h('tr', {}, h('th', {}, 'Zustand'), h('th', {}, 'Menge'), S.map((c) => h('th', {}, c))),
        rw.tabelle.map((r) => h('tr', {}, h('td', {}, schoen(r.name || '')), h('td', {}, (r.ende ? '* ' : '') + schoen(r.menge)), S.map((c) => h('td', {}, schoen(r.ziele[c])))))),
      h('div', { class: 'leise klein' }, '* = enthält einen Endzustand des NEA → Endzustand des DEA'),
      rw.notiz ? h('div', { class: 'leise klein', style: { marginTop: '4px' } }, rw.notiz) : null));
  }
  if (rw.art === 'klassen') {
    return h('details', { class: 'rechenweg', open: true },
      h('summary', {}, 'Rechenweg: zusammengefasste Zustände'),
      rw.klassen.map((k) => h('div', { class: 'klein' }, h('b', {}, schoen(k.name)), ' = ', k.alt.length ? k.alt.map(schoen).join(' ≡ ') : '–')));
  }
  return null;
}

// ------------------------------------------------------------------ Simulation

function simLeiste() {
  const wort = h('input', { class: 'eingabe wort', 'data-feld': 'wort', placeholder: 'Wort eingeben, z. B. abba (leer = ε)', value: z.sim ? z.sim.wort : (z.wortEntwurf || '') });
  wort.addEventListener('input', () => { z.wortEntwurf = wort.value; });
  wort.addEventListener('keydown', (e) => { if (e.key === 'Enter') simStarten(wort.value, true); });
  const s = z.sim;
  const l = s && s.l;
  const schritt = s && l.schritte[s.i];
  const fertig = s && s.i === l.schritte.length - 1;
  const band = s ? h('div', { class: 'band' },
    l.zeichen.length ? l.zeichen.map((c, i) => h('span', { class: 'feld' + (i < schritt.gelesen ? ' gelesen' : '') + (i === schritt.gelesen && !fertig ? ' jetzt' : '') }, c))
      : h('span', { class: 'feld gelesen' }, 'ε')) : null;
  const menge = schritt ? h('div', { class: 'menge' }, h('span', { class: 'leise klein' }, `Schritt ${s.i}/${l.schritte.length - 1}`),
    schritt.menge.length ? schritt.menge.map((id) => h('span', { class: 'chip-z' + (zustand(id) && zustand(id).ende ? ' ende' : '') }, schoen((zustand(id) || {}).name || '?')))
      : h('span', { class: 'chip-z leer' }, '∅')) : null;
  const urteil = fertig ? h('div', { class: 'urteil ' + (l.akzeptiert ? 'gut' : 'schlecht') }, l.akzeptiert ? '✓ akzeptiert' : '✗ abgelehnt', h('span', { class: 'grund' }, l.grund)) : null;
  return h('div', { class: 'sim' },
    h('div', { class: 'zeile', style: { gap: '8px' } },
      h('span', { class: 'fett' }, '▶ Simulation'),
      wort,
      h('button', { class: 'knopf', onclick: () => simStarten(wort.value, true), disabled: !z.A.zustaende.length }, s ? '↻ Neu' : '▶ Lauf starten'),
      s ? h('button', { class: 'knopf tonal', title: 'Zum Anfang', onclick: () => simGehe(0) }, '⏮') : null,
      s ? h('button', { class: 'knopf tonal', title: 'Schritt zurück (←)', onclick: () => simSchritt(-1), disabled: s.i === 0 }, '◀') : null,
      s ? h('button', { class: 'knopf tonal', title: 'Nächster Schritt (→)', onclick: () => simSchritt(1), disabled: fertig }, '▶') : null,
      s ? h('button', { class: 'knopf tonal', title: z.takt ? 'Anhalten' : 'Abspielen', onclick: () => (z.takt ? stopTakt(true) : abspielen()) }, z.takt ? '⏸' : '⏩') : null,
      s ? h('button', { class: 'knopf text', title: 'Simulation beenden', onclick: () => { z.sim = null; stopTakt(); malen(); } }, '✕') : null,
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text', onclick: testDialog, title: 'Viele Wörter auf einmal prüfen' }, '☰ Testliste')),
    s ? h('div', { class: 'zeile', style: { gap: '14px', marginTop: '8px', alignItems: 'center' } }, band, menge, urteil) : null);
}

function simStarten(wort, abspielenSofort) {
  stopTakt();
  z.wortEntwurf = wort;
  const l = Automat.lauf(z.A, wort);
  if (!l.schritte.length) {
    z.sim = null;
    malen();
    return lyra.dialog('Simulation', h('p', {}, l.grund), [{ text: 'OK', wert: true }]);
  }
  z.sim = { wort, l, i: 0 };
  malen();
  if (abspielenSofort) abspielen();
}
function simGehe(i) {
  if (!z.sim) return;
  z.sim.i = Math.max(0, Math.min(z.sim.l.schritte.length - 1, i));
  simMalen();
}
function simSchritt(d) {
  stopTakt();
  simGehe(z.sim.i + d);
}
function simMalen() {
  leinwandMalen();
  const alt = document.querySelector('.sim');
  if (alt) alt.replaceWith(simLeiste());
}
function abspielen() {
  stopTakt();
  if (!z.sim) return;
  if (z.sim.i === z.sim.l.schritte.length - 1) z.sim.i = 0;
  z.takt = setInterval(() => {
    if (!z.sim || z.sim.i >= z.sim.l.schritte.length - 1) return stopTakt(true);
    z.sim.i++;
    simMalen();
  }, 750);
  simMalen();
}
function stopTakt(neuMalen) {
  if (z.takt) clearInterval(z.takt);
  z.takt = null;
  if (neuMalen) simMalen();
}

async function testDialog() {
  const t = h('textarea', { class: 'eingabe', rows: 8, placeholder: 'Ein Wort pro Zeile – leere Zeile oder ε = leeres Wort\nab\naabb\nba' });
  t.value = z.testText;
  const aus = h('div', { class: 'test-aus' });
  const pruefen = () => {
    z.testText = t.value;
    const woerter = t.value.split('\n').map((w) => w.trim()).filter((w, i, l) => w || i < l.length - 1);
    aus.replaceChildren(...woerter.map((w) => {
      const r = Automat.lauf(z.A, w);
      return h('button', { class: 'test-zeile ' + (r.akzeptiert ? 'gut' : 'schlecht'), title: r.grund + ' – klicken zeigt den Lauf', onclick: () => {
        dialogZu();
        simStarten(w, true);
      } }, r.akzeptiert ? '✓' : '✗', h('span', { class: 'mono' }, w || 'ε'));
    }));
  };
  t.addEventListener('input', pruefen);
  pruefen();
  await lyra.dialog('Testliste', h('div', { class: 'spalte', style: { gap: '10px', minWidth: '420px' } }, t, aus,
    h('div', { class: 'leise klein' }, 'Ergebnis aktualisiert sich beim Tippen. Ein Klick auf ein Wort zeigt seinen Lauf.')), [{ text: 'Fertig', wert: true }]);
}

// ================================================================== Aus einer Sprache erzeugen

const SPRACH_SYSTEM = `Du bist „Delta“, ein Assistent für Theoretische Informatik (formale Sprachen, endliche Automaten). \
Du übersetzt Beschreibungen formaler Sprachen exakt in reguläre Ausdrücke. Du arbeitest sorgfältig und prüfst deine \
Lösung an Beispielwörtern, bevor du antwortest.`;

const SPRACH_SCHEMA = {
  type: 'object',
  properties: {
    alphabet: { type: 'array', items: { type: 'string' } },
    idee: { type: 'string' },
    regex: { type: 'string' },
    regulaer: { type: 'boolean' },
    woerter_ja: { type: 'array', items: { type: 'string' } },
    woerter_nein: { type: 'array', items: { type: 'string' } },
  },
  required: ['alphabet', 'idee', 'regex', 'regulaer', 'woerter_ja', 'woerter_nein'],
};

function sprachDialog() {
  const e = { text: z.letzteSprache || '', art: 'auto', ziel: z.einst.ziel, plusIstOder: z.einst.plusIstOder, falle: z.einst.falle, alphabet: '' };
  const feld = h('textarea', { class: 'eingabe', rows: 3, placeholder: 'Regulärer Ausdruck, z. B. (a|b)*abb\n– oder in Worten: „alle Wörter über {a, b} mit gerader Anzahl a“' });
  feld.value = e.text;
  const wahl = (schl, optionen, beiWechsel) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...optionen.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); if (beiWechsel) beiWechsel(); } }, n)));
    m();
    return box;
  };
  const alpha = h('input', { class: 'eingabe', placeholder: 'optional, z. B. a, b (sonst aus dem Ausdruck)' });
  const lehrer = h('div', {});
  const lehrerMalen = () => lehrer.replaceChildren(z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; lehrerMalen(); }) : '');
  lehrerMalen();
  const plusBox = h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, '„+“ im Ausdruck bedeutet'),
    wahl('plusIstOder', [[true, 'oder (a+b)'], [false, 'mindestens einmal (a+)']]));
  const sicht = () => {
    const worte = e.art === 'worte' || (e.art === 'auto' && istBeschreibung(feld.value));
    plusBox.style.display = worte ? 'none' : '';
    lehrer.style.display = worte ? '' : 'none';
  };
  feld.addEventListener('input', sicht);
  const inhalt = h('div', { class: 'spalte', style: { gap: '14px', minWidth: '480px' } },
    feld,
    h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, 'Eingabe ist'),
      wahl('art', [['auto', 'Automatisch erkennen'], ['regex', 'Regulärer Ausdruck'], ['worte', 'Beschreibung in Worten (KI)']], sicht)),
    plusBox,
    h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, 'Erzeugen als'),
      wahl('ziel', [['nea', 'NEA'], ['dea', 'DEA (Potenzmengen)'], ['min', 'Minimaler DEA']])),
    h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, 'Fallenzustand (DEA)'),
      wahl('falle', [[true, 'Zeigen – vollständiger DEA'], [false, 'Weglassen']])),
    h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '4px' } }, 'Alphabet Σ'), alpha),
    lehrer,
    h('div', { class: 'leise klein' }, 'Syntax: | oder +, *, ⁺ bzw. ^+, ?, ε, ∅, Klammern. Verkettung einfach hintereinander.'));
  sicht();
  lyra.dialog('Automat aus einer Sprache', inhalt, [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Erzeugen', wert: true },
  ]).then(async (ok) => {
    if (!ok) return;
    e.text = feld.value.trim();
    e.alphabet = alpha.value;
    if (!e.text) return;
    z.letzteSprache = e.text;
    z.einst = { ...z.einst, ziel: e.ziel, plusIstOder: e.plusIstOder, falle: e.falle };
    try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
    const worte = e.art === 'worte' || (e.art === 'auto' && istBeschreibung(e.text));
    if (worte) return ausBeschreibung(e);
    try {
      const S = zeichenLesen(e.alphabet).filter((c) => c !== EPS);
      const r = Automat.ausRegex(e.text, { ziel: e.ziel, plusIstOder: e.plusIstOder, falle: e.falle, zeichen: S.length ? S : null });
      neuAus(r, { text: e.text, regex: r.regex }, e);
    } catch (err) {
      await lyra.dialog('Der Ausdruck passt noch nicht', h('div', {}, h('p', {}, String(err.message || err)),
        h('p', { class: 'leise klein', style: { marginTop: '8px' } }, 'Erlaubt: Zeichen, ( ), | oder +, *, ⁺ bzw. ^+, ?, ε, ∅. Für Beschreibungen in Worten oben „Beschreibung in Worten“ wählen.')),
      [{ text: 'OK', wert: true }]);
      sprachDialog();
    }
  });
}

/** Sieht die Eingabe nach Worten aus (statt nach einem Ausdruck)? */
function istBeschreibung(t) {
  const woerter = String(t).match(/[A-Za-zÄÖÜäöüß]{3,}/g) || [];
  return woerter.filter((w) => !/^(eps|epsilon)$/i.test(w)).length >= 2;
}

function neuAus(r, quelle, e) {
  const A = r.automat;
  einpassen(A);
  A.id = lyra.neueId();
  A.name = (quelle.text.length > 40 ? quelle.text.slice(0, 38) + '…' : quelle.text) + ` (${{ nea: 'NEA', dea: 'DEA', min: 'min. DEA' }[e.ziel]})`;
  A.quelle = quelle;
  A.zeit = lyra.jetzt();
  if (r.rechenweg) {
    A.rechenweg = r.rechenweg;
    if (r.rechenweg.art === 'teilmengen') {
      // Namen der neuen Zustände in die Tabelle übernehmen (Reihenfolge = Reihenfolge der Tabelle)
      r.rechenweg.tabelle.forEach((zeile, i) => { zeile.name = A.zustaende[i] ? A.zustaende[i].name : ''; });
    }
  }
  oeffnen(A);
}

async function ausBeschreibung(e) {
  z.laeuft = true;
  laufHinweis('Delta überlegt, welche Sprache gemeint ist …');
  const vorgabe = zeichenLesen(e.alphabet).filter((c) => c !== EPS);
  let rueck = '';
  let letztes = null;
  const vorschlaege = [];
  try {
    for (let versuch = 0; versuch < 2; versuch++) {
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SPRACH_SYSTEM,
        prompt: `Sprache: ${e.text}\n${vorgabe.length ? `Alphabet: {${vorgabe.join(', ')}}\n` : ''}\n\
Gib einen regulären Ausdruck an, der GENAU diese Sprache beschreibt. Erlaubte Schreibweise:
- einzelne Zeichen des Alphabets hintereinander = Verkettung
- | = oder, * = beliebig oft (auch 0-mal), ⁺ = mindestens einmal, ? = optional, ε = leeres Wort, Klammern
- KEIN „+“ als oder, keine Zeichenklassen wie [ab], keine Abkürzungen wie Σ, keine Hochzahlen wie a^n
Beispiel: „alle Wörter über {a, b}, die auf ab enden“ → "(a|b)*ab"; „gerade Anzahl a über {a, b}“ → "(b*ab*a)*b*"
"alphabet": die Zeichen der Sprache. "idee": 1–2 Sätze, wie man die Wörter erkennt. "regulaer": false, wenn die Sprache \
nicht regulär ist (z. B. aⁿbⁿ) – dann "regex": "". "woerter_ja": 6 kurze Wörter der Sprache (auch Grenzfälle, "" für ε, \
falls enthalten), "woerter_nein": 6 kurze Wörter über dem Alphabet, die NICHT dazugehören.${rueck}`,
        schema: SPRACH_SCHEMA,
      }, (ev) => { if (ev.art === 'hinweis') laufHinweis(ev.text); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = r && r.json;
      if (!j) throw new Error('Keine Antwort bekommen – bitte nochmal versuchen.');
      if (j.regulaer === false || !String(j.regex || '').trim()) {
        z.laeuft = false;
        laufHinweis('');
        malen();
        return lyra.dialog('Diese Sprache ist nicht regulär', h('div', { class: 'spalte', style: { gap: '8px' } },
          h('p', {}, j.idee || 'Kein endlicher Automat kann sie erkennen.'),
          h('p', { class: 'leise klein' }, 'Endliche Automaten können nicht beliebig weit zählen (Pumping-Lemma). Dafür bräuchte man z. B. einen Kellerautomaten.')),
        [{ text: 'OK', wert: true }]);
      }
      let erg;
      const S = vorgabe.length ? vorgabe : (j.alphabet || []).map(String).filter((c) => c.length === 1);
      const ausdruck = regexBereinigen(j.regex, S);
      vorschlaege.push(String(j.regex));
      let lesefehler = null;
      for (const plusIstOder of [false, true]) {
        try {
          erg = Automat.ausRegex(ausdruck, { ziel: e.ziel, plusIstOder, falle: e.falle, zeichen: S.length ? S : null });
          break;
        } catch (err) {
          lesefehler = lesefehler || err.message;
        }
      }
      if (!erg) {
        rueck = `\n\nAchtung: Dein letzter Ausdruck „${j.regex}“ ließ sich nicht lesen (${lesefehler}). Halte dich genau an die Schreibweise.`;
        continue;
      }
      const ja = (j.woerter_ja || []).map((w) => String(w).replace(/^ε$/, ''));
      const nein = (j.woerter_nein || []).map((w) => String(w).replace(/^ε$/, ''));
      const falsch = [...ja.filter((w) => !Automat.akzeptiert(erg.automat, w)), ...nein.filter((w) => Automat.akzeptiert(erg.automat, w))];
      letztes = { erg, quelle: { text: e.text, regex: erg.regex, idee: j.idee, pruefung: { gesamt: ja.length + nein.length, falsch } } };
      if (!falsch.length) break;
      rueck = `\n\nAchtung: Dein letzter Ausdruck „${j.regex}“ passt nicht zu deinen eigenen Beispielen: ${falsch.map((w) => `„${w || 'ε'}“`).join(', ')}. \
Prüfe den Ausdruck Zeichen für Zeichen und gib einen korrigierten an.`;
    }
    z.laeuft = false;
    laufHinweis('');
    if (!letztes) {
      throw new Error(`Der vorgeschlagene Ausdruck ließ sich nicht lesen (${vorschlaege.map((v) => `„${v}“`).join(', ') || 'keiner'}). \
Fass die Beschreibung etwas genauer – oder gib direkt einen regulären Ausdruck ein. Mit Claude, ChatGPT oder Gemini klappt das meist zuverlässiger.`);
    }
    neuAus(letztes.erg, letztes.quelle, e);
  } catch (err) {
    z.laeuft = false;
    laufHinweis('');
    const m = String((err && err.message) || err);
    malen();
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) {
      await lyra.dialog('Hat nicht geklappt', h('div', {}, h('p', {}, m)), [{ text: 'OK', wert: true }]);
    }
  }
}

/** Übliche Schreibweisen von KI-Antworten in Delta-Schreibweise bringen ([ab], Σ*, \\epsilon, /…/, ^*, Anführungszeichen …). */
function regexBereinigen(t, S) {
  let r = String(t || '').trim();
  r = r.replace(/^\/(.*)\/[a-z]*$/s, '$1').replace(/^["'`„“”]+|["'`„“”]+$/g, '').replace(/^\^(?=[^+*])/, '').replace(/\$$/, '');
  r = r.replace(/\\(var)?epsilon|ϵ|λ/g, 'ε').replace(/\\cdot|·/g, '').replace(/\\mid|∪/g, '|').replace(/\\ast|\\star/g, '*');
  r = r.replace(/\[([^\]]+)\]/g, (_, inhalt) => '(' + [...inhalt.replace(/[,\s]/g, '')].join('|') + ')');
  if (S.length) r = r.replace(/Σ|\\Sigma/g, '(' + S.join('|') + ')');
  r = r.replace(/\^\{?\*\}?/g, '*').replace(/\^\{?\+\}?/g, '⁺');
  return r;
}

function laufHinweis(text) {
  let el = document.querySelector('.lauf-schild');
  if (!z.laeuft) { if (el) el.remove(); return; }
  if (!el) {
    el = h('div', { class: 'lauf-schild' }, h('div', { class: 'kreisel' }), h('span', { class: 'txt' }), h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
    document.body.append(el);
  }
  el.querySelector('.txt').textContent = text;
}

// ================================================================== Umwandeln, Prüfen, Export, Liste

async function umwandelnDialog() {
  const p = Automat.pruefen(z.A);
  if (!z.A.zustaende.length || !Automat.startId(z.A)) {
    return lyra.dialog('Umwandeln', h('p', {}, 'Dafür braucht der Automat Zustände und einen Startzustand.'), [{ text: 'OK', wert: true }]);
  }
  const wahl = await lyra.dialog('Umwandeln', h('div', { class: 'spalte', style: { gap: '8px', minWidth: '420px' } },
    h('p', { class: 'leise klein' }, 'Das Ergebnis öffnet sich als neuer Automat – deiner bleibt, wie er ist.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Aufräumen', art: 'text', wert: 'aufraeumen' },
    { text: 'Vollständig (Falle)', art: 'tonal', wert: 'falle' },
    { text: p.dea ? 'Minimieren' : 'NEA → minimaler DEA', art: 'tonal', wert: 'min' },
    { text: 'NEA → DEA', wert: 'dea' },
  ]);
  if (!wahl) return;
  const S = Automat.alphabet(z.A);
  let B;
  let rw = null;
  let zusatz;
  if (wahl === 'dea') {
    const t = Automat.teilmengen(z.A, { falle: z.einst.falle, mengenNamen: true, zeichen: S });
    B = t.automat;
    rw = { art: 'teilmengen', tabelle: t.tabelle.map((r, i) => ({ ...r, name: B.zustaende[i] ? B.zustaende[i].name : '' })) };
    zusatz = 'DEA';
  } else if (wahl === 'min') {
    const m = Automat.minimieren(z.A, { falle: z.einst.falle, zeichen: S });
    B = m.automat;
    rw = { art: 'klassen', klassen: m.klassen };
    zusatz = 'minimal';
  } else if (wahl === 'falle') {
    B = Automat.vervollstaendigen(z.A, S);
    zusatz = 'vollständig';
  } else {
    B = Automat.bereinigen(z.A, { tote: true });
    zusatz = 'aufgeräumt';
  }
  if (wahl === 'dea' || wahl === 'min') einpassen(B);
  else if (wahl === 'falle') {
    const f = B.zustaende.find((q) => !z.A.zustaende.some((x) => x.id === q.id));
    if (f) { const maxX = Math.max(...z.A.zustaende.map((q) => q.x)); f.x = maxX + 170; f.y = Math.max(...z.A.zustaende.map((q) => q.y)) + 90; }
  }
  B.id = lyra.neueId();
  B.name = `${z.A.name} (${zusatz})`;
  B.art = wahl === 'dea' || wahl === 'min' ? 'dea' : z.A.art;
  B.rechenweg = rw;
  B.quelle = null;
  oeffnen(B);
}

async function vergleichDialog() {
  const feld = h('input', { class: 'eingabe', placeholder: 'Regulärer Ausdruck der gesuchten Sprache, z. B. (a|b)*ab', value: z.letzterVergleich || '' });
  const plus = { w: z.einst.plusIstOder };
  const ok = await lyra.dialog('Erkennt dein Automat die richtige Sprache?', h('div', { class: 'spalte', style: { gap: '10px', minWidth: '440px' } },
    feld,
    h('div', { class: 'leise klein' }, 'Delta vergleicht deinen Automaten exakt mit der Sprache und zeigt dir das kürzeste Wort, bei dem sie sich unterscheiden.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Prüfen', wert: true },
  ]);
  if (!ok || !feld.value.trim()) return;
  z.letzterVergleich = feld.value.trim();
  let Ziel;
  try {
    Ziel = Automat.ausRegex(z.letzterVergleich, { ziel: 'min', plusIstOder: plus.w }).automat;
  } catch (err) {
    return lyra.dialog('Der Ausdruck passt noch nicht', h('p', {}, String(err.message || err)), [{ text: 'OK', wert: true }]);
  }
  const g = Automat.vergleichen(z.A, Ziel);
  if (!g) {
    return lyra.dialog('✓ Stimmt genau', h('p', {}, `Dein Automat erkennt genau die Sprache ${z.letzterVergleich}.`), [{ text: 'Super', wert: true }]);
  }
  const w = g.wort || 'ε';
  const was = g.inA ? `Dein Automat akzeptiert „${w}“ – das Wort gehört aber nicht zur Sprache.` : `„${w}“ gehört zur Sprache – dein Automat lehnt es aber ab.`;
  const zeigen = await lyra.dialog('✗ Noch nicht ganz', h('div', {}, h('p', {}, was), h('p', { class: 'leise klein', style: { marginTop: '8px' } }, 'Das ist das kürzeste Wort, bei dem sie sich unterscheiden.')), [
    { text: 'Schließen', art: 'text', wert: false },
    { text: 'Lauf zeigen', wert: true },
  ]);
  if (zeigen) simStarten(g.wort, true);
}

async function exportDialog() {
  if (!z.A.zustaende.length) return;
  const name = (z.A.name || 'Automat').replace(/[/\\:*?"<>|]/g, ' ').trim() || 'Automat';
  const wahl = await lyra.dialog('Exportieren', h('div', { class: 'spalte', style: { gap: '6px', minWidth: '380px' } },
    h('p', { class: 'leise klein' }, 'PNG für Folien und Notizen, SVG verlustfrei, TikZ für LaTeX (Hausaufgaben, Abschlussarbeit).')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'TikZ (LaTeX)', art: 'tonal', wert: 'tikz' },
    { text: 'SVG', art: 'tonal', wert: 'svg' },
    { text: 'PNG', wert: 'png' },
  ]);
  if (!wahl) return;
  const Z = zeichnung(z.A, { fuerExport: true });
  try {
    if (wahl === 'png') await lyra.speichern(name + '.png', alsPng(Z), true);
    else if (wahl === 'svg') await lyra.speichern(name + '.svg', alsSvg(Z, { rahmen: exportRahmen(Z), fuerExport: true }));
    else {
      const code = Automat.tikz(z.A);
      const t = h('textarea', { class: 'eingabe mono', rows: 14, readonly: true });
      t.value = code;
      const w = await lyra.dialog('TikZ-Code', h('div', { class: 'spalte', style: { gap: '8px', minWidth: '560px' } }, t,
        h('div', { class: 'leise klein' }, 'Markieren mit ⌘A und kopieren mit ⌘C – oder als .tex-Datei sichern. Braucht \\usetikzlibrary{automata, arrows.meta}.')), [
        { text: 'Schließen', art: 'text', wert: false },
        { text: 'Als .tex sichern', wert: true },
      ]);
      if (w) await lyra.speichern(name + '.tex', code);
    }
  } catch (err) {
    await lyra.dialog('Hat nicht geklappt', h('p', {}, String((err && err.message) || err)), [{ text: 'OK', wert: true }]);
  }
}

async function listeDialog() {
  const box = h('div', { class: 'spalte', style: { gap: '6px', minWidth: '440px', maxHeight: '420px', overflow: 'auto' } });
  const malenListe = () => box.replaceChildren(...(z.liste.length ? z.liste.map((a) => h('div', { class: 'zeile listen-zeile' + (a.id === z.A.id ? ' an' : '') },
    h('button', { class: 'wachsen listen-knopf', onclick: async () => {
      dialogZu();
      try { const A = await lyra.speicher.lesen('automaten/' + a.id); if (A) oeffnen(A); } catch (_) {}
    } }, h('div', { class: 'fett' }, a.name || 'Ohne Namen'),
      h('div', { class: 'leise klein' }, `${(a.art || 'dea').toUpperCase()} · ${a.n} Zustände · ${new Date(a.zeit * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)),
    h('button', { class: 'knopf text gefahr', title: 'Löschen', onclick: async () => {
      if (!window.confirm(`„${a.name}“ löschen?`)) return;
      try { await lyra.speicher.loeschen('automaten/' + a.id); } catch (_) {}
      z.liste = z.liste.filter((x) => x.id !== a.id);
      if (a.id === z.A.id) oeffnen(neuerAutomat());
      malenListe();
    } }, '🗑'))) : [h('div', { class: 'leise' }, 'Noch keine gespeicherten Automaten.')]));
  malenListe();
  const w = await lyra.dialog('Meine Automaten', box, [
    { text: 'Schließen', art: 'text', wert: false },
    { text: '＋ Neuer Automat', wert: true },
  ]);
  if (w) oeffnen(neuerAutomat());
}

function beispielLaden() {
  // DEA für „Wörter über {a, b}, die auf ab enden“
  const A = neuerAutomat('Endet auf ab');
  A.zustaende = [
    { id: 'b0', name: 'q0', x: 160, y: 240, start: true, ende: false },
    { id: 'b1', name: 'q1', x: 380, y: 240, start: false, ende: false },
    { id: 'b2', name: 'q2', x: 600, y: 240, start: false, ende: true },
  ];
  A.uebergaenge = [
    { von: 'b0', nach: 'b0', zeichen: ['b'] },
    { von: 'b0', nach: 'b1', zeichen: ['a'] },
    { von: 'b1', nach: 'b1', zeichen: ['a'] },
    { von: 'b1', nach: 'b2', zeichen: ['b'] },
    { von: 'b2', nach: 'b1', zeichen: ['a'] },
    { von: 'b2', nach: 'b0', zeichen: ['b'] },
  ];
  oeffnen(A);
  z.wortEntwurf = 'aabab';
  malen();
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schl, optionen) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...optionen.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const gruppe = (t, inhalt, erkl) => h('div', { style: { marginBottom: '14px' } }, h('div', { class: 'fett', style: { marginBottom: '6px' } }, t), inhalt,
    erkl ? h('div', { class: 'leise klein', style: { marginTop: '6px' } }, erkl) : null);
  const ok = await lyra.dialog('Delta – Einstellungen', h('div', { style: { minWidth: '440px' } },
    gruppe('„+“ in regulären Ausdrücken', wahl('plusIstOder', [[true, 'oder (a+b)'], [false, 'mindestens einmal (a+)']]), 'Wie in deiner Vorlesung. „⁺“ bzw. „^+“ heißt immer „mindestens einmal“.'),
    gruppe('Fallenzustand', wahl('falle', [[true, 'Zeigen (vollständiger DEA)'], [false, 'Weglassen']])),
    gruppe('Erzeugen als', wahl('ziel', [['nea', 'NEA'], ['dea', 'DEA'], ['min', 'Minimaler DEA']])),
    gruppe('Beschreibungen in Worten übersetzt', wahl('ki', [['auto', 'Automatisch (Claude, ChatGPT, Gemini – wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
      'Nur deine Beschreibung der Sprache geht dabei an den Anbieter. Reguläre Ausdrücke rechnet Delta selbst – ohne KI.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
}

start();
