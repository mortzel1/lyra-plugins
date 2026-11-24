'use strict';
/*
 * Graphit – zeichnet anschauliche, beschriftete Schaubilder aus deiner Beschreibung.
 *
 * Die KI beschreibt das Bild als einfache Formen (JSON: Flächen, Linien, Pfeile, Logikgatter, Schaltzeichen …) und
 * sagt, welche Stellen wie heißen. Graphit baut daraus eine Zeichenliste, setzt die Beschriftungen ordentlich an den
 * Rand und gibt sie zweimal aus: als SVG (verlustfrei) und über eine Leinwand als PNG – ganz ohne Netz.
 *
 * Läuft auf zwei Arten: unsichtbar aus Lyras Eingabezeile (Route „chat“, Ergebnis geht in den Chat) oder als
 * Galerie im Fenster (alle Bilder, Herunterladen, Weiterbearbeiten).
 */
const { h, mdElement } = lyra;

const SCHRIFT = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const TINTE = '#1f2430';

/** Farbe → [Füllung, Kontur] */
const FARBEN = {
  rot: ['#ef5350', '#b71c1c'],
  dunkelrot: ['#b3262e', '#6d0f15'],
  rosa: ['#f6a5b8', '#c2577a'],
  orange: ['#ffa94d', '#c25e00'],
  gelb: ['#ffd84d', '#a67c00'],
  gruen: ['#66c37a', '#2e7d32'],
  tuerkis: ['#3cc8c0', '#00796b'],
  blau: ['#5b8def', '#1f4fb3'],
  hellblau: ['#9fd3ff', '#2f7ec4'],
  dunkelblau: ['#3949ab', '#1a237e'],
  lila: ['#a77bea', '#5e35b1'],
  braun: ['#b07d55', '#6d4426'],
  haut: ['#f6c9a8', '#b97b52'],
  grau: ['#b7bcc6', '#5f6673'],
  schwarz: ['#3a3f4b', '#14161b'],
  weiss: ['#ffffff', '#6b7280'],
};
const ARTEN = ['flaeche', 'linie', 'pfeil', 'kreis', 'ellipse', 'rechteck', 'text', 'punkt', 'gatter', 'bauteil'];

const STANDARD = { ki: 'auto', gatter: 'din', stil: 'farbig', unterlagen: true };

const SYSTEM = `Du bist „Graphit“ in Lyra: Du zeichnest anschauliche, fachlich korrekte Schaubilder im Stil guter \
Lehrbücher. Du beschreibst ein Bild als JSON aus einfachen Formen auf einer Zeichenfläche von 1000 × 700 Punkten \
(x nach rechts, y nach unten, 0,0 ist oben links). Lyra zeichnet daraus eine saubere Grafik und setzt deine \
Beschriftungen ordentlich an den Rand. Achte auf richtige Proportionen und Lage der Teile zueinander.`;

// Schlüssel so gewählt, dass die alphabetische Reihenfolge Sinn ergibt (das lokale Modell schreibt sie so):
// erst planen (anordnung), Titel, Formen, dann Beschriftungen und zuletzt die Erklärung.
const SCHEMA = {
  type: 'object',
  properties: {
    anordnung: { type: 'string' },
    bildtitel: { type: 'string' },
    formen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: ARTEN },
          farbe: { type: 'string', enum: Object.keys(FARBEN) },
          glatt: { type: 'boolean' },
          groesse: { type: 'number' },
          punkte: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
          text: { type: 'string' },
        },
        required: ['art', 'farbe', 'glatt', 'groesse', 'punkte', 'text'],
      },
    },
    markierungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: { beschriftung: { type: 'string' }, ziel: { type: 'array', items: { type: 'number' } } },
        required: ['beschriftung', 'ziel'],
      },
    },
    zusammenfassung: { type: 'string' },
  },
  required: ['anordnung', 'bildtitel', 'formen', 'markierungen', 'zusammenfassung'],
};

const ANLEITUNG = `So beschreibst du das Bild:

"formen" – in Zeichenreihenfolge (Großes und Hintergrund zuerst, Details danach). Jede Form hat ALLE Felder; was sie \
nicht braucht, bleibt leer ("glatt": false, "groesse": 0, "text": ""):
- "flaeche": geschlossene Fläche durch "punkte" (mindestens 3, im Umlauf). Mit "glatt": true wird daraus eine weiche, \
organische Form (Organe, Zellen, Blätter, Körper) – 6 bis 14 Punkte reichen. Ohne glatt: Vieleck.
- "linie": Linie durch "punkte"; "groesse" = Strichbreite (Gefäße, Nerven, Darm: 8 bis 30 – wird als Schlauch \
gezeichnet; Drähte in Schaltungen: 3). "glatt": true für geschwungene Linien.
- "pfeil": wie linie, mit Pfeilspitze am letzten Punkt (Abläufe, Fluss, Kräfte, Kreisläufe).
- "kreis": "punkte": [[x, y]] ist der Mittelpunkt, "groesse" der Radius.
- "ellipse" und "rechteck": "punkte": [[links, oben], [rechts, unten]]. Ein "text" steht mittig darin (Kästen in \
Abläufen, Schichten).
- "text": kurzer Text, "punkte": [[x, y]] ist seine Mitte, "groesse" die Schriftgröße (sonst 22) – z. B. Eingänge \
A, B, Ausgang Y, Formeln.
- "punkt": Knotenpunkt an [[x, y]] (Verzweigungen in Schaltungen).
- "gatter": Logikgatter, "punkte": [[x, y]] ist die Mitte, "text": UND, ODER, NICHT, NAND, NOR, XOR oder XNOR. \
Anschlüsse: Eingänge bei (x−50, y−20) und (x−50, y+20), bei NICHT nur (x−50, y); Ausgang bei (x+50, y). Verbinde \
sie mit "linie" (farbe schwarz, groesse 3), am besten waagerecht und senkrecht.
- "bauteil": Schaltzeichen zwischen zwei Anschlusspunkten "punkte": [[x1, y1], [x2, y2]] (waagerecht oder \
senkrecht), "text": Art und gern ein Name, z. B. "widerstand: R1 = 220 Ω". Arten: widerstand, lampe, batterie, \
schalter, schalter_zu, diode, led, kondensator, spule, amperemeter, voltmeter, motor. Leitungen dazwischen als "linie".
"farbe" ist eine von: ${Object.keys(FARBEN).join(', ')} – wähle typische Farben (Arterien rot, Venen blau, Haut haut …).

"markierungen" – die Beschriftungen mit Hinweislinie: "beschriftung" ist der Fachbegriff (kurz), "ziel": [x, y] liegt \
genau AUF dem gemeinten Teil. Lyra setzt die Texte selbst an den Rand – schreib sie also NICHT zusätzlich als "text". \
Jeder wichtige Teil bekommt genau eine Markierung.

Nutze die Fläche: Das Bild soll etwa 750 breit und 550 hoch sein, mittig. Lieber klar und übersichtlich als \
überladen (meist 8 bis 45 Formen).

"anordnung": plane zuerst in 1 bis 3 Sätzen, wo was hinkommt. "bildtitel": kurz. "zusammenfassung": 2 bis 5 Sätze \
Erklärung in Markdown (Aufbau, Funktion, Ablauf) – bei Logikgattern gern mit Wahrheitstabelle.

Beispiel (UND-Gatter, gekürzt):
{"anordnung": "Gatter mittig, Eingänge A und B links, Ausgang Y rechts.", "bildtitel": "UND-Gatter", "formen": [\
{"art": "linie", "farbe": "schwarz", "glatt": false, "groesse": 3, "punkte": [[330, 330], [450, 330]], "text": ""}, \
{"art": "linie", "farbe": "schwarz", "glatt": false, "groesse": 3, "punkte": [[330, 370], [450, 370]], "text": ""}, \
{"art": "linie", "farbe": "schwarz", "glatt": false, "groesse": 3, "punkte": [[550, 350], [680, 350]], "text": ""}, \
{"art": "gatter", "farbe": "blau", "glatt": false, "groesse": 0, "punkte": [[500, 350]], "text": "UND"}, \
{"art": "text", "farbe": "schwarz", "glatt": false, "groesse": 26, "punkte": [[305, 330]], "text": "A"}, \
{"art": "text", "farbe": "schwarz", "glatt": false, "groesse": 26, "punkte": [[305, 370]], "text": "B"}, \
{"art": "text", "farbe": "schwarz", "glatt": false, "groesse": 26, "punkte": [[705, 350]], "text": "Y"}], \
"markierungen": [{"beschriftung": "Eingänge", "ziel": [390, 330]}, {"beschriftung": "Ausgang Y = A ∧ B", "ziel": [620, 350]}], \
"zusammenfassung": "Ein **UND-Gatter** gibt nur dann 1 aus, wenn **beide** Eingänge 1 sind. …"}`;

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  ansicht: 'galerie', // galerie | bild
  bilder: [],
  aktuell: null,
  eingabe: '',
  aenderung: '',
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const lehrerName = (k) => ((z.info && z.info.lehrer) || []).find((l) => l.kennung === k)?.name || (k === 'lyra' ? 'Lyra (lokal)' : k);

// ================================================================== Farben und Formen

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mischen(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/** Füllung (oben hell, unten satt) und Kontur einer Farbe – im schlichten Stil schwarz-weiß. */
function farbwerte(name, schlicht) {
  const [f, k] = FARBEN[name] || FARBEN.grau;
  if (schlicht) return { oben: '#ffffff', unten: '#ffffff', voll: '#ffffff', kontur: '#222222', hell: '#ffffff' };
  return { oben: mischen(f, '#ffffff', 0.38), unten: f, voll: f, kontur: k, hell: mischen(f, '#ffffff', 0.55) };
}

const r1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

function gerade(p, zu) {
  return p.map((q, i) => `${i ? 'L' : 'M'}${pt(q)}`).join(' ') + (zu ? ' Z' : '');
}
/** Weiche Kurve durch alle Punkte (Catmull-Rom als kubische Bézier-Kurven). */
function glatt(p, zu) {
  const n = p.length;
  if (n < 3) return gerade(p, zu);
  const hol = (i) => (zu ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(p[0])}`;
  for (let i = 0; i < (zu ? n : n - 1); i++) {
    const p0 = hol(i - 1);
    const p1 = hol(i);
    const p2 = hol(i + 1);
    const p3 = hol(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (zu ? ' Z' : '');
}
const kreisD = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)} a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0 Z`;
const ellipseD = (cx, cy, rx, ry) => `M${r1(cx - rx)} ${r1(cy)} a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0 a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0 Z`;
function rechteckD(x1, y1, x2, y2, r) {
  r = Math.max(0, Math.min(r, (x2 - x1) / 2, (y2 - y1) / 2));
  return `M${r1(x1 + r)} ${r1(y1)} H${r1(x2 - r)} A${r1(r)} ${r1(r)} 0 0 1 ${r1(x2)} ${r1(y1 + r)} V${r1(y2 - r)} ` +
    `A${r1(r)} ${r1(r)} 0 0 1 ${r1(x2 - r)} ${r1(y2)} H${r1(x1 + r)} A${r1(r)} ${r1(r)} 0 0 1 ${r1(x1)} ${r1(y2 - r)} ` +
    `V${r1(y1 + r)} A${r1(r)} ${r1(r)} 0 0 1 ${r1(x1 + r)} ${r1(y1)} Z`;
}

// ================================================================== Zeichenliste

/**
 * Eine Zeichenliste: Pfade und Texte in Zeichenreihenfolge, dazu der Umriss. Daraus entstehen SVG und PNG.
 * Pfad: {typ:'pfad', d, box, fuellung (Farbe oder {oben, unten}), linie, breite, schatten}
 * Text: {typ:'text', x, y, zeilen, groesse, gewicht, farbe, anker, halo}
 */
function neueListe() {
  return { teile: [], box: [Infinity, Infinity, -Infinity, -Infinity] };
}
function dehnen(box, x, y, r = 0) {
  box[0] = Math.min(box[0], x - r);
  box[1] = Math.min(box[1], y - r);
  box[2] = Math.max(box[2], x + r);
  box[3] = Math.max(box[3], y + r);
}
function pfad(L, d, punkte, stil) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const r = (stil.breite || 0) / 2 + (stil.extra || 0);
  for (const p of punkte) dehnen(box, p[0], p[1], r);
  for (const p of punkte) dehnen(L.box, p[0], p[1], r);
  L.teile.push({ typ: 'pfad', d, box, ...stil });
}
const messer = document.createElement('canvas').getContext('2d');
function textBreite(t, groesse, gewicht) {
  messer.font = `${gewicht} ${groesse}px ${SCHRIFT}`;
  return messer.measureText(t).width;
}
/** Bricht Text so um, dass keine Zeile breiter als `max` ist. */
function umbrechen(t, max, groesse, gewicht) {
  const zeilen = [];
  let z0 = '';
  for (const w of String(t).split(/\s+/).filter(Boolean)) {
    const probe = z0 ? z0 + ' ' + w : w;
    if (z0 && textBreite(probe, groesse, gewicht) > max) {
      zeilen.push(z0);
      z0 = w;
    } else z0 = probe;
  }
  if (z0) zeilen.push(z0);
  return zeilen.length ? zeilen : [''];
}
function schrift(L, x, y, t, o = {}) {
  const groesse = o.groesse || 20;
  const gewicht = o.gewicht || 600;
  const zeilen = o.max ? umbrechen(t, o.max, groesse, gewicht) : [String(t)];
  const anker = o.anker || 'middle';
  const zh = groesse * 1.22;
  const b = Math.max(...zeilen.map((s) => textBreite(s, groesse, gewicht)));
  const x0 = anker === 'start' ? x : anker === 'end' ? x - b : x - b / 2;
  dehnen(L.box, x0, y - (zeilen.length * zh) / 2 - 2);
  dehnen(L.box, x0 + b, y + (zeilen.length * zh) / 2 + 2);
  L.teile.push({ typ: 'text', x, y, zeilen, groesse, gewicht, farbe: o.farbe || TINTE, anker, halo: o.halo !== false, zh });
  return { breite: b, hoehe: zeilen.length * zh };
}

// ------------------------------------------------------------------ Formen

function formZeichnen(L, f, e) {
  const schlicht = e.stil === 'schlicht';
  const c = farbwerte(f.farbe, schlicht);
  const p = f.punkte;
  const verlauf = { oben: c.oben, unten: c.unten };
  switch (f.art) {
    case 'flaeche': {
      if (p.length < 3) return;
      pfad(L, f.glatt ? glatt(p, true) : gerade(p, true), p, { fuellung: verlauf, linie: c.kontur, breite: 2.5, schatten: !schlicht });
      if (f.text) {
        const m = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
        schrift(L, m[0], m[1], f.text, { groesse: 16, max: 160 });
      }
      return;
    }
    case 'linie':
    case 'pfeil': {
      if (p.length < 2) return;
      const breite = Math.max(1.5, Math.min(40, f.groesse || 3));
      let q = p.map((x) => x.slice());
      let spitze = null;
      if (f.art === 'pfeil') {
        const e2 = q[q.length - 1];
        const e1 = q[q.length - 2];
        const lang = Math.hypot(e2[0] - e1[0], e2[1] - e1[1]) || 1;
        const dir = [(e2[0] - e1[0]) / lang, (e2[1] - e1[1]) / lang];
        const kopf = Math.max(16, breite * 3.2);
        const basis = [e2[0] - dir[0] * kopf, e2[1] - dir[1] * kopf];
        const nrm = [-dir[1], dir[0]];
        const w = kopf * 0.36;
        spitze = [e2, [basis[0] + nrm[0] * w, basis[1] + nrm[1] * w], [basis[0] - nrm[0] * w, basis[1] - nrm[1] * w]];
        // Linie kurz vor der Spitze enden lassen, damit sie nicht durchsticht
        q[q.length - 1] = [e2[0] - dir[0] * kopf * 0.8, e2[1] - dir[1] * kopf * 0.8];
      }
      const d = f.glatt ? glatt(q, false) : gerade(q, false);
      const dunkel = f.farbe === 'schwarz' || schlicht ? (schlicht ? '#222222' : '#2b2f38') : c.kontur;
      if (breite >= 8 && f.art === 'linie') {
        // Schlauch: dunkler Rand, helles Inneres
        pfad(L, d, q, { linie: dunkel, breite, kappe: 'round', schatten: !schlicht });
        pfad(L, d, q, { linie: schlicht ? '#ffffff' : c.voll, breite: breite - 4.5, kappe: 'round' });
      } else {
        pfad(L, d, q, { linie: f.farbe === 'schwarz' || f.art === 'linie' && breite <= 4 ? dunkel : c.voll, breite, kappe: 'round' });
      }
      if (spitze) pfad(L, gerade(spitze, true), spitze, { fuellung: f.farbe === 'schwarz' || schlicht ? dunkel : c.voll, linie: null });
      return;
    }
    case 'kreis': {
      if (!p.length) return;
      const r = Math.max(4, Math.min(400, f.groesse || 40));
      const [x, y] = p[0];
      pfad(L, kreisD(x, y, r), [[x - r, y - r], [x + r, y + r]], { fuellung: verlauf, linie: c.kontur, breite: 2.5, schatten: !schlicht });
      if (f.text) schrift(L, x, y, f.text, { groesse: 17, max: r * 1.7 });
      return;
    }
    case 'ellipse':
    case 'rechteck': {
      if (p.length < 2) return;
      const x1 = Math.min(p[0][0], p[1][0]);
      const x2 = Math.max(p[0][0], p[1][0]);
      const y1 = Math.min(p[0][1], p[1][1]);
      const y2 = Math.max(p[0][1], p[1][1]);
      if (x2 - x1 < 4 || y2 - y1 < 4) return;
      const d = f.art === 'ellipse' ? ellipseD((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2, (y2 - y1) / 2) : rechteckD(x1, y1, x2, y2, 12);
      pfad(L, d, [[x1, y1], [x2, y2]], { fuellung: verlauf, linie: c.kontur, breite: 2.5, schatten: !schlicht });
      if (f.text) schrift(L, (x1 + x2) / 2, (y1 + y2) / 2, f.text, { groesse: 18, max: Math.max(60, (x2 - x1) * (f.art === 'ellipse' ? 0.7 : 1) - 18) });
      return;
    }
    case 'text': {
      if (!p.length || !f.text) return;
      const farbe = schlicht || f.farbe === 'schwarz' || f.farbe === 'weiss' ? TINTE : (FARBEN[f.farbe] || FARBEN.schwarz)[1];
      schrift(L, p[0][0], p[0][1], f.text, { groesse: Math.max(12, Math.min(60, f.groesse || 22)), gewicht: 700, farbe, max: 360 });
      return;
    }
    case 'punkt': {
      if (!p.length) return;
      const r = Math.max(3.5, Math.min(14, f.groesse || 5));
      pfad(L, kreisD(p[0][0], p[0][1], r), [[p[0][0] - r, p[0][1] - r], [p[0][0] + r, p[0][1] + r]], { fuellung: '#2b2f38', linie: null });
      return;
    }
    case 'gatter':
      if (p.length) gatter(L, p[0][0], p[0][1], f.text, f.farbe, e);
      return;
    case 'bauteil':
      if (p.length >= 2) bauteil(L, p[0], p[1], f.text, f.farbe, e);
  }
}

const DRAHT = '#2b2f38';
function draht(L, a, b, breite = 3) {
  pfad(L, gerade([a, b]), [a, b], { linie: DRAHT, breite, kappe: 'round' });
}

/** Logikgatter nach DIN/IEC (Kasten mit &, ≥1, =1, 1) oder in US-Form. Mitte (x, y), Eingänge links, Ausgang rechts. */
function gatter(L, x, y, art, farbe, e) {
  const namen = { AND: 'UND', OR: 'ODER', NOT: 'NICHT', NICHT: 'NICHT', UND: 'UND', ODER: 'ODER', NAND: 'NAND', NOR: 'NOR', XOR: 'XOR', XNOR: 'XNOR' };
  const a = namen[String(art || '').toUpperCase().replace(/[^A-Z]/g, '')] || 'UND';
  const negiert = ['NICHT', 'NAND', 'NOR', 'XNOR'].includes(a);
  const eingaenge = a === 'NICHT' ? [y] : [y - 20, y + 20];
  const c = farbwerte(farbe || 'blau', e.stil === 'schlicht');
  const koerper = { fuellung: e.stil === 'schlicht' ? '#ffffff' : c.hell, linie: e.stil === 'schlicht' ? '#222222' : c.kontur, breite: 3, schatten: e.stil !== 'schlicht' };
  if (e.gatter === 'ansi') {
    const oder = ['ODER', 'NOR', 'XOR', 'XNOR'].includes(a);
    for (const yy of eingaenge) draht(L, [x - 50, yy], [a === 'NICHT' ? x - 30 : oder ? x - 22 : x - 30, yy]);
    let d;
    if (a === 'NICHT') d = `M${x - 30} ${y - 28} L${x + 22} ${y} L${x - 30} ${y + 28} Z`;
    else if (oder) d = `M${x - 32} ${y - 35} Q${x + 2} ${y - 35} ${x + 30} ${y} Q${x + 2} ${y + 35} ${x - 32} ${y + 35} Q${x - 16} ${y} ${x - 32} ${y - 35} Z`;
    else d = `M${x - 30} ${y - 35} H${x - 5} A35 35 0 0 1 ${x - 5} ${y + 35} H${x - 30} Z`;
    pfad(L, d, [[x - 32, y - 35], [x + 30, y + 35]], koerper);
    if (a === 'XOR' || a === 'XNOR') pfad(L, `M${x - 41} ${y - 35} Q${x - 25} ${y} ${x - 41} ${y + 35}`, [[x - 41, y - 35], [x - 25, y + 35]], { linie: koerper.linie, breite: 3 });
    const ende = a === 'NICHT' ? x + 22 : x + 30;
    if (negiert) {
      pfad(L, kreisD(ende + 5, y, 5), [[ende, y - 5], [ende + 10, y + 5]], { fuellung: '#ffffff', linie: koerper.linie, breite: 2.5 });
      draht(L, [ende + 10, y], [x + 50, y]);
    } else draht(L, [ende, y], [x + 50, y]);
    return;
  }
  for (const yy of eingaenge) draht(L, [x - 50, yy], [x - 30, yy]);
  pfad(L, rechteckD(x - 30, y - 40, x + 30, y + 40, 4), [[x - 30, y - 40], [x + 30, y + 40]], koerper);
  const zeichen = { UND: '&', NAND: '&', ODER: '≥1', NOR: '≥1', XOR: '=1', XNOR: '=', NICHT: '1' }[a];
  schrift(L, x, y, zeichen, { groesse: 26, gewicht: 700, halo: false });
  if (negiert) {
    pfad(L, kreisD(x + 35, y, 5), [[x + 30, y - 5], [x + 40, y + 5]], { fuellung: '#ffffff', linie: koerper.linie, breite: 2.5 });
    draht(L, [x + 40, y], [x + 50, y]);
  } else draht(L, [x + 30, y], [x + 50, y]);
}

/** Schaltzeichen zwischen zwei Anschlüssen (z. B. „widerstand: R1 = 220 Ω“). */
function bauteil(L, p1, p2, beschreibung, farbe, e) {
  const [roh, ...rest] = String(beschreibung || '').split(':');
  const name = rest.join(':').trim();
  const w = roh.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z_]/g, '');
  const art = /lamp|birne|leucht(?!diode)/.test(w) ? 'lampe' : /batter|quelle|zelle/.test(w) ? 'batterie'
    : /zu|geschlossen/.test(w) && /schalt|tast/.test(w) ? 'schalter_zu' : /schalt|tast/.test(w) ? 'schalter'
    : /led|leuchtdiode/.test(w) ? 'led' : /diode/.test(w) ? 'diode' : /konden|capac/.test(w) ? 'kondensator'
    : /spule|indukt/.test(w) ? 'spule' : /ampere|strommess/.test(w) ? 'amperemeter' : /volt|spannungsmess/.test(w) ? 'voltmeter'
    : /motor/.test(w) ? 'motor' : /generat/.test(w) ? 'generator' : 'widerstand';
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const lang = Math.hypot(dx, dy) || 1;
  const dir = [dx / lang, dy / lang];
  const nrm = [-dir[1], dir[0]];
  const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const T = (u, v) => [m[0] + u * dir[0] + v * nrm[0], m[1] + u * dir[1] + v * nrm[1]];
  const halb = { widerstand: 30, spule: 30, kondensator: 6, batterie: 6, lampe: 18, amperemeter: 18, voltmeter: 18, motor: 18, generator: 18, diode: 14, led: 14, schalter: 22, schalter_zu: 22 }[art];
  const a = Math.min(halb, lang / 2);
  draht(L, p1, T(-a, 0));
  draht(L, T(a, 0), p2);
  const c = farbwerte(farbe || 'grau', e.stil === 'schlicht');
  const kontur = '#22252c';
  const linie = (pa, pb, b = 3) => pfad(L, gerade([pa, pb]), [pa, pb], { linie: kontur, breite: b, kappe: 'butt' });
  switch (art) {
    case 'widerstand':
    case 'spule': {
      const ecken = [T(-30, -11), T(30, -11), T(30, 11), T(-30, 11)];
      pfad(L, gerade(ecken, true), ecken, { fuellung: art === 'spule' ? kontur : e.stil === 'schlicht' ? '#ffffff' : c.hell, linie: kontur, breite: 3 });
      break;
    }
    case 'kondensator':
      linie(T(-6, -18), T(-6, 18), 4);
      linie(T(6, -18), T(6, 18), 4);
      break;
    case 'batterie': {
      linie(T(-6, -20), T(-6, 20), 3);
      linie(T(6, -10), T(6, 10), 7);
      const plus = T(-18, 24);
      schrift(L, plus[0], plus[1], '+', { groesse: 18, gewicht: 700 });
      break;
    }
    case 'lampe': {
      pfad(L, kreisD(m[0], m[1], 18), [[m[0] - 18, m[1] - 18], [m[0] + 18, m[1] + 18]], { fuellung: e.stil === 'schlicht' ? '#ffffff' : '#fff3b0', linie: kontur, breite: 3 });
      linie(T(-12.7, -12.7), T(12.7, 12.7), 2.5);
      linie(T(-12.7, 12.7), T(12.7, -12.7), 2.5);
      break;
    }
    case 'amperemeter':
    case 'voltmeter':
    case 'motor':
    case 'generator': {
      pfad(L, kreisD(m[0], m[1], 18), [[m[0] - 18, m[1] - 18], [m[0] + 18, m[1] + 18]], { fuellung: '#ffffff', linie: kontur, breite: 3 });
      schrift(L, m[0], m[1], { amperemeter: 'A', voltmeter: 'V', motor: 'M', generator: 'G' }[art], { groesse: 20, gewicht: 700, halo: false });
      break;
    }
    case 'diode':
    case 'led': {
      const dreieck = [T(-14, -14), T(-14, 14), T(14, 0)];
      pfad(L, gerade(dreieck, true), dreieck, { fuellung: art === 'led' && e.stil !== 'schlicht' ? c.voll : kontur, linie: kontur, breite: 2 });
      linie(T(14, -14), T(14, 14), 3);
      if (art === 'led') {
        for (const s of [-4, 8]) {
          const von = T(s, -20);
          const bis = T(s + 10, -34);
          linie(von, bis, 2);
          const sp = [bis, T(s + 4, -31), T(s + 11, -27)];
          pfad(L, gerade(sp, true), sp, { fuellung: kontur, linie: null });
        }
      }
      break;
    }
    default: {
      const offen = art === 'schalter';
      const a1 = T(-22, 0);
      const a2 = T(22, 0);
      pfad(L, kreisD(a1[0], a1[1], 3.5), [a1], { fuellung: kontur, linie: null, extra: 3.5 });
      pfad(L, kreisD(a2[0], a2[1], 3.5), [a2], { fuellung: kontur, linie: null, extra: 3.5 });
      linie(a1, offen ? T(20, -18) : a2, 3);
    }
  }
  if (name) {
    // Name neben das Zeichen: bei senkrechten Bauteilen seitlich (linksbündig weg vom Zeichen), sonst darüber
    const n = T(0, art === 'led' ? -48 : -32);
    if (Math.abs(nrm[0]) > 0.5) {
      const rechts = n[0] > m[0];
      schrift(L, n[0] + (rechts ? -8 : 8), n[1], name, { groesse: 17, gewicht: 600, max: 200, anker: rechts ? 'start' : 'end' });
    } else schrift(L, n[0], n[1], name, { groesse: 17, gewicht: 600, max: 200 });
  }
}

// ------------------------------------------------------------------ Beschriftungen am Rand

/** Setzt die Beschriftungen links und rechts neben das Bild – nach Höhe sortiert, ohne Überlappen, mit Hinweislinien. */
function beschriften(L, markierungen) {
  const vorne = { punkte: [], texte: [] };
  if (!markierungen.length) return vorne;
  const kb = Number.isFinite(L.box[0]) ? L.box.slice() : [200, 100, 800, 600];
  const mitte = (kb[0] + kb[2]) / 2;
  let links = [];
  let rechts = [];
  for (const m of markierungen) (m.ziel[0] < mitte ? links : rechts).push(m);
  // ausgleichen, wenn eine Seite viel voller ist
  while (links.length > rechts.length + 2) {
    links.sort((a, b) => a.ziel[0] - b.ziel[0]);
    rechts.push(links.pop());
  }
  while (rechts.length > links.length + 2) {
    rechts.sort((a, b) => b.ziel[0] - a.ziel[0]);
    links.push(rechts.pop());
  }
  const gr = 19;
  const zh = gr * 1.22;
  const linienFarbe = '#4b5263';
  const marken = [];
  for (const [seite, liste] of [['links', links], ['rechts', rechts]]) {
    if (!liste.length) continue;
    liste.sort((a, b) => a.ziel[1] - b.ziel[1]);
    const eintraege = liste.map((m) => {
      const zeilen = umbrechen(m.beschriftung, 230, gr, 600);
      return { m, zeilen, hoehe: zeilen.length * zh, y: m.ziel[1] };
    });
    const abstand = 10;
    // von oben nach unten: nichts überlappt
    for (let i = 1; i < eintraege.length; i++) {
      const a = eintraege[i - 1];
      const b = eintraege[i];
      b.y = Math.max(b.y, a.y + (a.hoehe + b.hoehe) / 2 + abstand);
    }
    // ragt es unten weit hinaus: von unten nach oben zurückschieben (aber nicht über den oberen Rand)
    const unten = kb[3] + 30;
    const letzte = eintraege[eintraege.length - 1];
    if (letzte.y > unten) {
      letzte.y = unten;
      for (let i = eintraege.length - 2; i >= 0; i--) {
        const a = eintraege[i];
        const b = eintraege[i + 1];
        a.y = Math.min(a.y, b.y - (a.hoehe + b.hoehe) / 2 - abstand);
      }
      const oben = kb[1] - 30;
      if (eintraege[0].y < oben) {
        eintraege[0].y = oben;
        for (let i = 1; i < eintraege.length; i++) {
          const a = eintraege[i - 1];
          const b = eintraege[i];
          b.y = Math.max(b.y, a.y + (a.hoehe + b.hoehe) / 2 + abstand);
        }
      }
    }
    const textX = seite === 'links' ? kb[0] - 46 : kb[2] + 46;
    const knickX = seite === 'links' ? kb[0] - 22 : kb[2] + 22;
    for (const e of eintraege) {
      const start = [seite === 'links' ? textX + 8 : textX - 8, e.y];
      const knick = [knickX, e.y];
      pfad(L, gerade([start, knick, e.m.ziel]), [start, knick, e.m.ziel], { linie: linienFarbe, breite: 1.6, kappe: 'round' });
      marken.push(e.m.ziel);
      vorne.texte.push({ typ: 'text', x: textX, y: e.y, zeilen: e.zeilen, groesse: gr, gewicht: 600, farbe: TINTE, anker: seite === 'links' ? 'end' : 'start', halo: true, zh });
      const b = Math.max(...e.zeilen.map((s) => textBreite(s, gr, 600)));
      dehnen(L.box, seite === 'links' ? textX - b : textX + b, e.y - e.hoehe / 2);
      dehnen(L.box, textX, e.y + e.hoehe / 2);
    }
  }
  // Punkte auf den Zielen (kommen über die Linien)
  const n = L.teile.length;
  for (const p of marken) pfad(L, kreisD(p[0], p[1], 4.5), [p], { fuellung: TINTE, linie: '#ffffff', breite: 1.8, extra: 4.5 });
  vorne.punkte = L.teile.splice(n);
  return vorne;
}

/**
 * Drähte anschließen: Kleine Modelle treffen die Anschlüsse von Gattern und Bauteilen oft nicht genau. Freie Enden
 * dünner Linien rasten am nächsten freien Anschluss ein (bis 180 Punkte entfernt) – mit Knick, damit es rechtwinklig bleibt.
 */
function anschliessen(formen) {
  const anschluesse = [];
  for (const f of formen) {
    if (f.art === 'gatter' && f.punkte.length) {
      const [x, y] = f.punkte[0];
      const nicht = /NICHT|NOT/i.test(f.text) && !/NAND|NOR/i.test(f.text);
      for (const yy of nicht ? [y] : [y - 20, y + 20]) anschluesse.push({ p: [x - 50, yy], seite: -1 });
      anschluesse.push({ p: [x + 50, y], seite: 1 });
    } else if (f.art === 'bauteil' && f.punkte.length >= 2) {
      anschluesse.push({ p: f.punkte[0], seite: 0 }, { p: f.punkte[1], seite: 0 });
    }
  }
  if (!anschluesse.length) return formen;
  const draehte = formen.filter((f) => (f.art === 'linie' || f.art === 'pfeil') && f.punkte.length >= 2 && (f.groesse || 3) <= 6);
  const nah = (a, b, r = 8) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;
  // Knotenpunkte („punkt“) zählen nicht als Verbindung – kleine Modelle setzen sie gern an lose Enden
  const ecken = draehte.flatMap((d) => d.punkte);
  const enden = [];
  for (const d of draehte) {
    for (const i of [0, d.punkte.length - 1]) {
      const q = d.punkte[i];
      const verbunden = ecken.filter((e) => e !== q && nah(e, q)).length > 0 || anschluesse.some((a) => nah(a.p, q));
      if (!verbunden) enden.push({ d, i });
    }
  }
  const belegt = new Set(anschluesse.filter((a) => ecken.some((e) => nah(e, a.p))));
  const paare = [];
  for (const en of enden) {
    const q = en.d.punkte[en.i];
    for (const a of anschluesse) {
      const abst = Math.hypot(a.p[0] - q[0], a.p[1] - q[1]);
      if (abst <= 180) paare.push({ en, a, abst });
    }
  }
  paare.sort((x, y) => x.abst - y.abst);
  const fertig = new Set();
  const alt = [];
  for (const { en, a } of paare) {
    if (fertig.has(en) || belegt.has(a)) continue;
    fertig.add(en);
    belegt.add(a);
    const pk = en.d.punkte;
    const nachbar = pk[en.i === 0 ? 1 : pk.length - 2];
    const ziel = a.p.slice();
    alt.push(pk[en.i]);
    pk[en.i] = ziel;
    // rechtwinklig bleiben: Knick einfügen, wenn der letzte Abschnitt schräg würde
    if (Math.abs(nachbar[0] - ziel[0]) > 2 && Math.abs(nachbar[1] - ziel[1]) > 2) {
      const mx = a.seite ? ziel[0] + a.seite * 18 : (nachbar[0] + ziel[0]) / 2;
      const knick = [[mx, nachbar[1]], [mx, ziel[1]]];
      if (en.i === 0) pk.splice(1, 0, ...knick.reverse());
      else pk.splice(pk.length - 1, 0, ...knick);
    }
  }
  // Knotenpunkte, die nach dem Einrasten verwaist im Leeren stehen, weg
  const jetzt = draehte.flatMap((d) => d.punkte);
  return formen.filter((f) => !(f.art === 'punkt' && alt.some((q) => nah(q, f.punkte[0])) && !jetzt.some((q) => nah(q, f.punkte[0]))));
}

/** Texte im Bild, die sich gegenseitig überdecken, auseinanderschieben: der spätere weicht nach unten bzw. oben aus,
 *  in Schritten seiner Höhe, bis er frei steht (höchstens ein paar Versuche – dann bleibt er, wo er ist). */
function texteEntzerren(L, texte) {
  const rahmen = (t, dy = 0) => {
    const b = Math.max(...t.zeilen.map((x) => textBreite(x, t.groesse, t.gewicht)));
    const x0 = t.anker === 'start' ? t.x : t.anker === 'end' ? t.x - b : t.x - b / 2;
    const hh = t.zeilen.length * t.zh;
    return [x0 - 4, t.y + dy - hh / 2 - 3, x0 + b + 4, t.y + dy + hh / 2 + 3];
  };
  const schneidet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const frei = [];
  for (const t of texte) {
    let r = rahmen(t);
    if (frei.some((f) => schneidet(f, r))) {
      const schritt = r[3] - r[1];
      for (const dy of [1, -1, 2, -2, 3, -3].map((k) => k * schritt)) {
        const probe = rahmen(t, dy);
        if (!frei.some((f) => schneidet(f, probe))) { t.y += dy; r = probe; dehnen(L.box, r[0], r[1]); dehnen(L.box, r[2], r[3]); break; }
      }
    }
    frei.push(r);
  }
}

/** Ganze Zeichnung aus der geprüften Beschreibung. */
function aufbauen(spec, e = z.einst) {
  const L = neueListe();
  const formen = anschliessen(structuredClone(spec.formen));
  for (const f of formen) formZeichnen(L, f, e);
  if (!Number.isFinite(L.box[0])) throw new Error('Im Bild war nichts zu zeichnen – bitte nochmal versuchen.');
  // Reihenfolge: Formen → Hinweislinien → Texte im Bild → Zielpunkte → Beschriftungen
  const bildTexte = L.teile.filter((t) => t.typ === 'text');
  L.teile = L.teile.filter((t) => t.typ !== 'text');
  texteEntzerren(L, bildTexte);
  const vorne = beschriften(L, spec.markierungen);
  L.teile.push(...bildTexte, ...vorne.punkte, ...vorne.texte);
  if (spec.bildtitel) {
    const breite = L.box[2] - L.box[0];
    const t = { groesse: 30, gewicht: 800 };
    const zeilen = umbrechen(spec.bildtitel, Math.max(500, breite), t.groesse, t.gewicht);
    const hoehe = zeilen.length * t.groesse * 1.2;
    const y = L.box[1] - 34 - hoehe / 2;
    schrift(L, (L.box[0] + L.box[2]) / 2, y, spec.bildtitel, { ...t, max: Math.max(500, breite), halo: false });
  }
  const rand = 36;
  L.rahmen = [L.box[0] - rand, L.box[1] - rand, L.box[2] - L.box[0] + 2 * rand, L.box[3] - L.box[1] + 2 * rand].map((v) => Math.round(v));
  return L;
}

// ------------------------------------------------------------------ Ausgabe als SVG und PNG

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function alsSvg(L, titel = '') {
  const [x, y, w, hh] = L.rahmen;
  const verlaeufe = new Map();
  const teile = [];
  let schatten = false;
  for (const t of L.teile) {
    if (t.typ === 'pfad') {
      let fill = 'none';
      if (t.fuellung && typeof t.fuellung === 'object') {
        const k = t.fuellung.oben + t.fuellung.unten;
        if (!verlaeufe.has(k)) verlaeufe.set(k, { id: 'v' + verlaeufe.size, ...t.fuellung });
        fill = `url(#${verlaeufe.get(k).id})`;
      } else if (t.fuellung) fill = t.fuellung;
      if (t.schatten) schatten = true;
      const attr = [`d="${t.d}"`, `fill="${fill}"`];
      if (t.linie) attr.push(`stroke="${t.linie}"`, `stroke-width="${r1(t.breite || 1)}"`, `stroke-linejoin="round"`, `stroke-linecap="${t.kappe || 'round'}"`);
      if (t.schatten) attr.push('filter="url(#schatten)"');
      if (t.versatz) attr.push(`transform="translate(0 ${r1(t.versatz)})"`);
      teile.push(`<path ${attr.join(' ')}/>`);
    } else {
      const n = t.zeilen.length;
      const halo = t.halo ? ' paint-order="stroke" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"' : '';
      const spans = t.zeilen.map((s, i) => `<tspan x="${r1(t.x)}" y="${r1(t.y + (i - (n - 1) / 2) * t.zh)}">${esc(s)}</tspan>`).join('');
      teile.push(`<text font-size="${t.groesse}" font-weight="${t.gewicht}" fill="${t.farbe}" text-anchor="${t.anker}" dominant-baseline="central"${halo}>${spans}</text>`);
    }
  }
  const defs = [...verlaeufe.values()].map((v) =>
    `<linearGradient id="${v.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.oben}"/><stop offset="1" stop-color="${v.unten}"/></linearGradient>`);
  if (schatten) defs.push('<filter id="schatten" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.16"/></filter>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${hh}" width="${w}" height="${hh}" font-family="${esc(SCHRIFT)}">` +
    (titel ? `<title>${esc(titel)}</title>` : '') +
    `<defs>${defs.join('')}</defs><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#ffffff"/>${teile.join('')}</svg>`;
}

/** Dieselbe Zeichenliste auf eine Leinwand – ergibt das PNG (base64, ohne „data:“-Vorspann). */
function alsPng(L) {
  const [x, y, w, hh] = L.rahmen;
  const s = Math.max(1, Math.min(2, 2400 / Math.max(w, hh)));
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.round(w * s);
  leinwand.height = Math.round(hh * s);
  const c = leinwand.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, leinwand.width, leinwand.height);
  c.setTransform(s, 0, 0, s, -x * s, -y * s);
  for (const t of L.teile) {
    if (t.typ === 'pfad') {
      const p = new Path2D(t.d);
      c.save();
      if (t.versatz) c.translate(0, t.versatz);
      if (t.fuellung) {
        if (typeof t.fuellung === 'object') {
          const g = c.createLinearGradient(0, t.box[1], 0, t.box[3]);
          g.addColorStop(0, t.fuellung.oben);
          g.addColorStop(1, t.fuellung.unten);
          c.fillStyle = g;
        } else c.fillStyle = t.fuellung;
        if (t.schatten) {
          c.shadowColor = 'rgba(0,0,0,0.16)';
          c.shadowBlur = 8 * s;
          c.shadowOffsetY = 3 * s;
        }
        c.fill(p);
        c.shadowColor = 'transparent';
      }
      if (t.linie) {
        c.strokeStyle = t.linie;
        c.lineWidth = t.breite || 1;
        c.lineJoin = 'round';
        c.lineCap = t.kappe || 'round';
        if (t.schatten && !t.fuellung) {
          c.shadowColor = 'rgba(0,0,0,0.16)';
          c.shadowBlur = 8 * s;
          c.shadowOffsetY = 3 * s;
        }
        c.stroke(p);
      }
      c.restore();
    } else {
      c.save();
      c.font = `${t.gewicht} ${t.groesse}px ${SCHRIFT}`;
      c.textAlign = t.anker === 'start' ? 'left' : t.anker === 'end' ? 'right' : 'center';
      c.textBaseline = 'middle';
      const n = t.zeilen.length;
      t.zeilen.forEach((zeile, i) => {
        const yy = t.y + (i - (n - 1) / 2) * t.zh;
        if (t.halo) {
          c.strokeStyle = '#ffffff';
          c.lineWidth = 5;
          c.lineJoin = 'round';
          c.strokeText(zeile, t.x, yy);
        }
        c.fillStyle = t.farbe;
        c.fillText(zeile, t.x, yy);
      });
      c.restore();
    }
  }
  return leinwand.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

// ================================================================== Die KI beschreibt das Bild

/** Prüft und bereinigt die Beschreibung der KI (falsche Felder, Zahlen außerhalb, 0–1-Koordinaten …). */
function pruefen(roh) {
  const zahl = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);
  let formen = (Array.isArray(roh.formen) ? roh.formen : []).slice(0, 160).map((f) => ({
    art: ARTEN.includes(f.art) ? f.art : null,
    farbe: FARBEN[f.farbe] ? f.farbe : 'grau',
    glatt: f.glatt === true,
    groesse: Math.max(0, zahl(f.groesse) || 0),
    punkte: (Array.isArray(f.punkte) ? f.punkte : []).filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [zahl(p[0]), zahl(p[1])]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])),
    text: text(f.text).slice(0, 120),
  })).filter((f) => f.art && f.punkte.length);
  let markierungen = (Array.isArray(roh.markierungen) ? roh.markierungen : []).slice(0, 36).map((m) => ({
    beschriftung: text(m.beschriftung).slice(0, 80),
    ziel: Array.isArray(m.ziel) && m.ziel.length >= 2 ? [zahl(m.ziel[0]), zahl(m.ziel[1])] : null,
  })).filter((m) => m.beschriftung && m.ziel && Number.isFinite(m.ziel[0]) && Number.isFinite(m.ziel[1]));
  // Manche Modelle zeichnen in 0…1 – dann auf die Fläche hochrechnen
  const alle = [...formen.flatMap((f) => f.punkte), ...markierungen.map((m) => m.ziel)];
  if (alle.length && alle.every((p) => Math.abs(p[0]) <= 1.5 && Math.abs(p[1]) <= 1.5)) {
    const hoch = (p) => [p[0] * 1000, p[1] * 700];
    formen = formen.map((f) => ({ ...f, punkte: f.punkte.map(hoch), groesse: f.art === 'kreis' && f.groesse <= 1.5 ? f.groesse * 700 : f.groesse }));
    markierungen = markierungen.map((m) => ({ ...m, ziel: hoch(m.ziel) }));
  }
  // Außerhalb jeder Vernunft: abschneiden
  const eng = (p) => [Math.max(-400, Math.min(1400, p[0])), Math.max(-400, Math.min(1100, p[1]))];
  formen = formen.map((f) => ({ ...f, punkte: f.punkte.slice(0, 80).map(eng) }));
  markierungen = markierungen.map((m) => ({ ...m, ziel: eng(m.ziel) }));
  // Beschriftungen, die auch als Text im Bild stehen, nicht doppelt
  const marken = new Set(markierungen.map((m) => m.beschriftung.toLowerCase()));
  formen = formen.filter((f) => !(f.art === 'text' && f.text.length > 3 && marken.has(f.text.toLowerCase())));
  return {
    bildtitel: text(roh.bildtitel).slice(0, 100),
    formen,
    markierungen,
    zusammenfassung: text(roh.zusammenfassung),
  };
}

async function entwerfen({ wunsch, vorher, lehrer }, melden) {
  let block = '';
  if (z.einst.unterlagen && !vorher) {
    melden('Graphit sucht Fachbegriffe in deinen Unterlagen …');
    try {
      block = ((await lyra.suchen(wunsch, 4)).block || '').slice(0, 3500);
    } catch (_) {}
  }
  melden(`${lehrerName(lehrer)} plant das Bild …`);
  const prompt = vorher
    ? `Hier ist ein Schaubild, das du schon gezeichnet hast (als JSON):\n${JSON.stringify({ bildtitel: vorher.bildtitel, formen: vorher.formen, markierungen: vorher.markierungen, zusammenfassung: vorher.zusammenfassung })}\n\n\
Mein Wunsch dazu: ${wunsch}\n\nÄndere das Bild entsprechend und gib es VOLLSTÄNDIG zurück (alle Formen und Markierungen, auch die unveränderten).\n\n${ANLEITUNG}`
    : `Zeichne: ${wunsch}\n\n${block ? `Auszüge aus meinen Unterlagen – übernimm passende Fachbegriffe für die Beschriftungen:\n\n${block}\n\n` : ''}${ANLEITUNG}`;
  const r = await lyra.ki({ lehrer, system: SYSTEM, prompt, schema: SCHEMA, zaehlen: { schluessel: 'art', wort: 'Form' } }, (e) => {
    if (e.art !== 'hinweis') return;
    const m = e.text.match(/Form (\d+)/);
    melden(m ? `${lehrerName(lehrer)} zeichnet … Form ${m[1]}` : e.text);
  });
  if (!r || !r.json) throw new Error('Graphit hat keine Bildbeschreibung bekommen – bitte nochmal versuchen.');
  const spec = pruefen(r.json);
  if (!spec.formen.length) throw new Error('Die Beschreibung enthielt nichts Zeichenbares – formuliere den Wunsch etwas genauer und versuch es nochmal.');
  return { spec, lehrer: r.lehrer || lehrer };
}

async function bildSichern(bild) {
  try {
    await lyra.speicher.schreiben('bilder/' + bild.id, bild);
  } catch (_) {}
}

// ================================================================== Aus der Eingabezeile (unsichtbar)

async function chatAuftrag() {
  let a = null;
  try {
    a = await lyra.auftrag();
  } catch (_) {}
  if (!a || !text(a.text)) return;
  try {
    const lehrer = a.lehrer || (z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra');
    const vorher = a.vorher && Array.isArray(a.vorher.formen) ? pruefen(a.vorher) : null;
    const { spec, lehrer: wer } = await entwerfen({ wunsch: a.text, vorher, lehrer }, (t) => lyra.status(t).catch(() => {}));
    lyra.status('Graphit setzt die Beschriftungen …').catch(() => {});
    const L = aufbauen(spec);
    const bild = { id: lyra.neueId(), zeit: lyra.jetzt(), anfrage: a.text, vorher: a.vorherId || null, spec, lehrer: wer };
    await bildSichern(bild);
    await lyra.ergebnis({
      titel: spec.bildtitel,
      text: spec.zusammenfassung,
      png: alsPng(L),
      svg: alsSvg(L, spec.bildtitel),
      id: bild.id,
      daten: spec,
      fuss: lehrerName(wer),
    });
  } catch (e) {
    const m = String((e && e.message) || e);
    await lyra.ergebnis({ fehler: /ABGEBROCHEN/.test(m) ? 'Abgebrochen.' : m }).catch(() => {});
  }
}

// ================================================================== Galerie im Fenster

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try {
    z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) };
  } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route === 'chat') return chatAuftrag();
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  await bilderLaden();
  if (route.startsWith('bild/')) zeigen(route.slice(5));
  else zeichnen();
  if (route === 'einstellungen') einstellungen();
}

async function bilderLaden() {
  try {
    z.bilder = (await lyra.speicher.liste('bilder')).map((e) => e.wert).filter((b) => b && b.spec).sort((a, b) => b.zeit - a.zeit);
  } catch (_) {
    z.bilder = [];
  }
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) {
    lyra.abbrechen();
    return;
  }
  if (z.ansicht === 'bild') {
    z.ansicht = 'galerie';
    z.meldung = '';
    return zeichnen();
  }
  lyra.zurueck();
}

function zeigen(id) {
  const b = z.bilder.find((x) => x.id === id);
  if (!b) return zeichnen();
  z.aktuell = id;
  z.ansicht = 'bild';
  z.meldung = '';
  z.aenderung = '';
  zeichnen();
}

/** Im Fenster zeichnen: neu (aus der Eingabe) oder als Änderung des offenen Bildes. */
async function fensterZeichnen(aenderung) {
  const wunsch = (aenderung ? z.aenderung : z.eingabe).trim();
  if (!wunsch || z.laeuft) return;
  const basis = aenderung ? z.bilder.find((x) => x.id === z.aktuell) : null;
  z.laeuft = true;
  z.fehler = null;
  z.status = 'Graphit legt los …';
  zeichnen();
  try {
    const { spec, lehrer } = await entwerfen({ wunsch, vorher: basis ? basis.spec : null, lehrer: z.lehrer }, (t) => {
      z.status = t;
      const el = document.getElementById('status');
      if (el) el.textContent = t;
    });
    const bild = { id: lyra.neueId(), zeit: lyra.jetzt(), anfrage: basis ? `${basis.anfrage} → ${wunsch}` : wunsch, vorher: basis ? basis.id : null, spec, lehrer };
    aufbauen(spec); // prüft, ob sich das Bild zeichnen lässt
    await bildSichern(bild);
    z.bilder.unshift(bild);
    z.eingabe = '';
    z.aenderung = '';
    z.laeuft = false;
    zeigen(bild.id);
    return;
  } catch (e) {
    const m = String((e && e.message) || e);
    z.fehler = /ABGEBROCHEN|Abgebrochen/.test(m) ? null : m;
  }
  z.laeuft = false;
  zeichnen();
}

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(h('div', { class: 'tisch' }, z.ansicht === 'bild' ? bildAnsicht() : galerie()));
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) {
    e.focus();
    const n = e.value.length;
    e.setSelectionRange(n, n);
  }
  const b = z.ansicht === 'bild' && z.bilder.find((x) => x.id === z.aktuell);
  lyra.titel(b ? b.spec.bildtitel || '' : '');
}

function svgElement(spec, klasse) {
  const box = h('div', { class: klasse });
  try {
    box.innerHTML = alsSvg(aufbauen(spec)); // selbst erzeugt, alle Texte maskiert
  } catch (e) {
    box.append(h('div', { class: 'leise klein' }, String((e && e.message) || e)));
  }
  return box;
}

function eingabeZeile(aenderung) {
  const wert = aenderung ? z.aenderung : z.eingabe;
  const t = h('input', {
    class: 'eingabe',
    'data-feld': aenderung ? 'aenderung' : 'eingabe',
    placeholder: aenderung ? 'Ändern: z. B. „beschrifte auch die Aorta“, „färbe die Venen blau“ …' : 'Was soll ich zeichnen? z. B. Aufbau des Herzens, Schaltung eines UND-Gatters …',
    disabled: z.laeuft,
  });
  t.value = wert;
  t.addEventListener('input', () => {
    if (aenderung) z.aenderung = t.value;
    else z.eingabe = t.value;
    const k = document.getElementById(aenderung ? 'los-aendern' : 'los');
    if (k) k.disabled = !t.value.trim();
  });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') fensterZeichnen(aenderung); });
  return h('div', { class: 'zeile' }, t,
    h('button', { class: 'knopf', id: aenderung ? 'los-aendern' : 'los', disabled: z.laeuft || !wert.trim(), onclick: () => fensterZeichnen(aenderung) }, aenderung ? 'Ändern' : '✏️ Zeichnen'));
}

function laufAnzeige() {
  if (!z.laeuft) return null;
  return h('div', { class: 'zeile lauf-zeile' }, h('div', { class: 'stift-lauf' }, '✏️'), h('span', { id: 'status', class: 'wachsen' }, z.status),
    h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

function galerie() {
  return h('div', { class: 'galerie' },
    h('div', { class: 'kopf' },
      h('div', { class: 'marke' }, 'Graphit'),
      h('div', { class: 'leise' }, 'Schaubilder aus deiner Beschreibung – beschriftet, sauber, zum Herunterladen.')),
    h('div', { class: 'blatt spalte', style: { gap: '12px' } },
      eingabeZeile(false),
      h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'leise klein wachsen' }, 'Tipp: Graphit geht auch direkt aus Lyras Eingabezeile – das Stift-Symbol neben dem Eingabefeld.'),
        h('button', { class: 'knopf text', onclick: einstellungen }, '⚙ Einstellungen')),
      laufAnzeige(),
      z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; fensterZeichnen(false); } : null, () => { z.fehler = null; zeichnen(); }) : null),
    z.bilder.length
      ? h('div', { class: 'raster' }, z.bilder.map((b) => h('button', { class: 'kachel-bild', onclick: () => zeigen(b.id) },
        svgElement(b.spec, 'vorschau'),
        h('div', { class: 'fett', style: { marginTop: '8px' } }, b.spec.bildtitel || b.anfrage),
        h('div', { class: 'leise klein' }, new Date(b.zeit * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })))))
      : h('div', { class: 'leer' }, h('div', { style: { fontSize: '44px' } }, '✏️'),
        h('div', { class: 'fett', style: { marginTop: '8px' } }, 'Noch keine Schaubilder'),
        h('div', { class: 'leise' }, 'Probier zum Beispiel: „Aufbau einer Pflanzenzelle“, „Stromkreis mit Batterie, Schalter und zwei Lampen in Reihe“, „Blutkreislauf des Menschen“.')));
}

function bildAnsicht() {
  const b = z.bilder.find((x) => x.id === z.aktuell);
  if (!b) return galerie();
  const sichern = async (art) => {
    try {
      const L = aufbauen(b.spec);
      const name = `${(b.spec.bildtitel || 'Schaubild').replace(/[/\\:*?"<>|]/g, ' ')}.${art}`;
      const ok = art === 'png' ? await lyra.speichern(name, alsPng(L), true) : await lyra.speichern(name, alsSvg(L, b.spec.bildtitel));
      z.meldung = ok ? `✓ ${art.toUpperCase()} gesichert` : '';
    } catch (e) {
      z.meldung = String((e && e.message) || e);
    }
    zeichnen();
  };
  const loeschen = async () => {
    if (!(await lyra.bestaetigen({ titel: `„${b.spec.bildtitel || 'Schaubild'}“ löschen?`, text: `Das Bild verschwindet aus der Galerie.`, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
    try { await lyra.speicher.loeschen('bilder/' + b.id); } catch (_) {}
    z.bilder = z.bilder.filter((x) => x.id !== b.id);
    z.ansicht = 'galerie';
    zeichnen();
  };
  return h('div', { class: 'bild-seite' },
    h('div', { class: 'zeile', style: { marginBottom: '12px' } },
      h('button', { class: 'knopf text', onclick: zurueck }, '← Alle Schaubilder'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf tonal', onclick: () => sichern('png') }, '⬇ PNG'),
      h('button', { class: 'knopf tonal', onclick: () => sichern('svg') }, '⬇ SVG'),
      h('button', { class: 'knopf text', onclick: loeschen }, 'Löschen')),
    z.meldung ? h('div', { class: 'leise klein', style: { textAlign: 'right', marginBottom: '8px' } }, z.meldung) : null,
    svgElement(b.spec, 'gross'),
    h('div', { class: 'blatt', style: { marginTop: '14px' } },
      h('div', { class: 'leise klein', style: { marginBottom: '8px' } }, `„${b.anfrage}“ · ${lehrerName(b.lehrer)}`),
      b.spec.zusammenfassung ? mdElement(b.spec.zusammenfassung) : null,
      h('div', { style: { marginTop: '14px' } }, eingabeZeile(true)),
      laufAnzeige(),
      z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }) : null));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schluessel, optionen) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const malen = () => box.replaceChildren(...optionen.map(([w, name]) =>
      h('button', { class: 'chip' + (e[schluessel] === w ? ' an' : ''), onclick: () => { e[schluessel] = w; malen(); } }, name)));
    malen();
    return box;
  };
  const gruppe = (titel, inhalt, erkl) => h('div', { style: { marginBottom: '16px' } }, h('div', { class: 'fett', style: { marginBottom: '6px' } }, titel), inhalt,
    erkl ? h('div', { class: 'leise klein', style: { marginTop: '6px' } }, erkl) : null);
  const ok = await lyra.dialog('Graphit – Einstellungen', h('div', {},
    gruppe('Wer zeichnet', wahl('ki', [['auto', 'Automatisch (Claude, ChatGPT, Gemini – wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
      'Mit Claude, ChatGPT oder Gemini geht deine Bildbeschreibung an den Anbieter – sie zeichnen meist genauer. Mit Lyra bleibt alles auf deinem Mac.'),
    gruppe('Stil', wahl('stil', [['farbig', '🎨 Farbig'], ['schlicht', '✏️ Schlicht (schwarz-weiß)']]), 'Schlicht eignet sich zum Ausdrucken und für Prüfungsvorbereitung.'),
    gruppe('Logikgatter', wahl('gatter', [['din', 'DIN/IEC (Kasten mit &, ≥1)'], ['ansi', 'US-Form (ANSI)']])),
    gruppe('Fachbegriffe aus deinen Unterlagen', wahl('unterlagen', [[true, 'Ja'], [false, 'Nein']]),
      'Graphit sucht passende Stellen in deinen Unterlagen, damit die Beschriftungen zu deiner Vorlesung passen.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

function fusionAnbieten() {
  lyra.fusion.anbieten({
    schaubild: async (a, { status }) => {
      const material = lyra.fusion.materialOhneAufgabe(a, 2500);
      const wunsch = `${a.anweisung || lyra.fusion.thema(a)}${material ? `\n\nInhalt, der im Bild stecken soll (Auszug – nimm die wichtigsten Begriffe):\n${material}` : ''}`;
      const lehrer = a.lehrer || z.lehrer;
      const { spec, lehrer: wer } = await entwerfen({ wunsch, vorher: null, lehrer }, status);
      status('Graphit setzt die Beschriftungen …');
      const L = aufbauen(spec);
      const bild = { id: lyra.neueId(), zeit: lyra.jetzt(), anfrage: String(a.anweisung || '').slice(0, 300), vorher: null, spec, lehrer: wer };
      await bildSichern(bild);
      return {
        art: 'schaubild',
        titel: spec.bildtitel,
        markdown: `**${spec.bildtitel}**\n\n${spec.zusammenfassung || ''}`,
        bild: 'data:image/png;base64,' + alsPng(L),
        daten: { svg: alsSvg(L, spec.bildtitel), spec },
        oeffnen: 'bild/' + bild.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
