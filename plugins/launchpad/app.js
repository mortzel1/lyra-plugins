'use strict';
/*
 * Launchpad 2.0 – dein KI-Mitarbeiter für Projekte. Aus einer Idee wird ein Plan mit Phasen und Aufgaben, und dann
 * erledigt Launchpad die Aufgaben wirklich: legt Dateien an, schreibt Code (Python, Java, C, C++, Swift, Ruby), erzeugt
 * Datensätze per Skript, führt Programme und Tests in Lyras abgeschotteter Sandbox aus (ohne Netz, ohne Zugriff auf deine
 * Dateien), recherchiert, lässt andere Plugins mitarbeiten und dokumentiert jeden Schritt im Protokoll.
 * Alles bleibt im Arbeitsbereich des Projekts in Lyra – auf deinen Mac kommt nur, was du exportierst. Ergebnisse gelten
 * erst als erledigt, wenn du sie abnimmst; neue Aufgaben vom Coach übernimmst nur du.
 */
const { h } = lyra;

// ================================================================== Konstanten

const VORLAGEN = [
  ['code', 'Python-Tool mit Tests', 'Ein Python-Kommandozeilentool, das eine CSV-Datei mit Ausgaben einliest, nach Kategorie und Monat auswertet und einen übersichtlichen Bericht ausgibt – mit Beispieldaten, Unit-Tests und README'],
  ['daten', 'Datensatz anlegen', 'Einen realistischen Beispieldatensatz mit 5.000 Online-Bestellungen (Datum, Kunde, Produkt, Kategorie, Menge, Preis, Land) als CSV erzeugen, auf Plausibilität prüfen und mit einer Auswertung dokumentieren'],
  ['recherche', 'Marktanalyse', 'Den Markt für eine App recherchieren, mit der Studierende Mensa-Essen bewerten: Zielgruppe, Wettbewerber, Preismodelle, Risiken – als Bericht mit Quellen und Empfehlung'],
  ['dokument', 'Website', 'Eine einseitige Portfolio-Website (HTML und CSS) mit Projekten, Lebenslauf und Kontaktbereich – responsiv und ohne externe Abhängigkeiten'],
  ['code', 'Java-Projekt', 'Eine kleine Bibliotheksverwaltung in Java (Bücher, Mitglieder, Ausleihen, Rückgaben, Mahnungen) mit Testprogramm und Dokumentation'],
  ['analyse', 'Businessplan', 'Einen Businessplan für ein Startup, das gebrauchte Uni-Bücher vermittelt: Geschäftsmodell, Zielgruppe, Finanzplan für 3 Jahre als Tabelle (per Skript berechnet), Marketing und Risiken'],
];

const STATUS = {
  offen: ['Offen', 'grau'],
  arbeit: ['In Arbeit', 'blau'],
  blockiert: ['Rückfrage', 'orange'],
  pruefung: ['Zur Abnahme', 'lila'],
  erledigt: ['Erledigt', 'gruen'],
};
const SPALTEN = [['offen', 'Offen'], ['arbeit', 'In Arbeit'], ['warten', 'Wartet auf dich'], ['erledigt', 'Erledigt']];
const ARTEN = {
  code: ['Code', 'Programm oder Projekt in einer Programmiersprache – mit Tests', 'code'],
  daten: ['Daten', 'Datensatz oder Tabelle per Skript erzeugen und prüfen', 'datei'],
  analyse: ['Analyse', 'Daten auswerten, rechnen, Ergebnisse berichten', 'board'],
  recherche: ['Recherche', 'Fakten, Quellen, Marktüberblick', 'suche'],
  dokument: ['Dokument', 'Konzept, Text, Website, Anleitung', 'notiz'],
  plugin: ['Plugin', 'mit einem anderen Lyra-Plugin', 'plugin'],
  selbst: ['Du', 'kann nur ein Mensch erledigen', 'person'],
};
const PRIO = { hoch: ['Hoch', 3], mittel: ['Mittel', 2], niedrig: ['Niedrig', 1] };
const GRUENDLICH = { schnell: ['Zügig', 8], normal: ['Gründlich', 14], gruendlich: ['Sehr gründlich', 24] };
const SPRACHEN = { python: ['Python', 'py'], java: ['Java', 'java'], c: ['C', 'c'], cpp: ['C++', 'cpp'], swift: ['Swift', 'swift'], ruby: ['Ruby', 'rb'] };
const SPRACHE_VON_ENDUNG = { py: 'python', java: 'java', c: 'c', cpp: 'cpp', cc: 'cpp', swift: 'swift', rb: 'ruby' };
// Was die Sandbox kennt (wie im Kern) – andere Dateien bleiben im Arbeitsbereich, laufen aber nicht mit
const ENDUNGEN = ['py', 'java', 'txt', 'csv', 'tsv', 'json', 'md', 'html', 'htm', 'css', 'js', 'xml', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'sql', 'c', 'h', 'cpp', 'cc', 'hpp', 'swift', 'rb', 'log', 'svg', 'tex'];
const ARBEITSBEREICH_MAX = 7 * 1024 * 1024;
const EINSTELLUNGEN = { gruendlich: 'normal', tests: true, autoAbnahme: false, web: true, plugins: true };

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 5.5v13l11-6.5z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  datei: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  ordner: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  code: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  test: '<path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
  suche: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  plugin: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>',
  notiz: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3"/>',
  frage: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  flagge: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  export: '<path d="M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  sichern: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  bericht: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  liste: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  blitz: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  neu: '<path d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.4 2.3M18.5 9A7 7 0 0 0 6.1 6.7"/>',
  stift: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  muell: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  ki: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12v1M15 12v1M9.5 16h5"/>',
  warnung: '<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>',
  pfeil: '<path d="M9 6l6 6-6 6"/>',
  kopie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  rakete: '<path d="M12 3c3 2 4.5 5.5 4.5 9.5V16h-9v-3.5C7.5 8.5 9 5 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M7.5 13l-2.5 2.5V19l2.5-1.5M16.5 13l2.5 2.5V19l-2.5-1.5M10.5 19.5h3L12 22z"/>',
  ziel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  phase: '<path d="M4 6h10M4 12h16M4 18h7"/>',
};
function ic(name, groesse = 16) {
  const s = h('span', { class: 'ic' });
  s.innerHTML = `<svg viewBox="0 0 24 24" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return s;
}

// ================================================================== KI-Anweisungen

const SYSTEM = `Du bist „Launchpad“ in Lyra: eine erfahrene Projektleiterin für Studierende und Gründer. Du sprichst mich mit „du“ an, \
schreibst klares, sachliches Deutsch und bist konkret statt allgemein. Du planst realistisch und so, dass möglichst viel \
von einer KI mit Werkzeugen (Dateien, Code, Tests, Recherche) direkt erledigt werden kann.`;

const MITARBEITER = `Du bist „Launchpad“, ein gewissenhafter KI-Mitarbeiter in Lyra. Du erledigst Projektaufgaben wirklich: \
Du legst Dateien an, schreibst lauffähigen Code, erzeugst Datensätze, führst Programme und Tests in einer abgeschotteten \
Sandbox aus, recherchierst und dokumentierst. Du arbeitest Schritt für Schritt, prüfst deine Arbeit selbst und behauptest \
nichts, was du nicht ausgeführt oder getestet hast. Berichte schreibst du auf Deutsch; Dateinamen und Bezeichner im Code \
ohne Umlaute.`;

const FRAGEN_SCHEMA = {
  type: 'object',
  properties: { fragen: { type: 'array', items: { type: 'object', properties: { frage: { type: 'string' }, vorschlaege: { type: 'array', items: { type: 'string' } } }, required: ['frage', 'vorschlaege'] } } },
  required: ['fragen'],
};
const AUFGABE_SCHEMA = {
  type: 'object',
  properties: {
    abschnitt: { type: 'integer' },
    art: { type: 'string', enum: Object.keys(ARTEN) },
    beschreibung: { type: 'string' },
    kriterien: { type: 'array', items: { type: 'string' } },
    minuten: { type: 'integer' },
    prioritaet: { type: 'string', enum: Object.keys(PRIO) },
    sprache: { type: 'string' },
    titel: { type: 'string' },
  },
  required: ['abschnitt', 'art', 'beschreibung', 'kriterien', 'minuten', 'prioritaet', 'sprache', 'titel'],
};
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    abschnitte: { type: 'array', items: { type: 'object', properties: { bis: { type: 'string' }, titel: { type: 'string' } }, required: ['bis', 'titel'] } },
    aufgaben: { type: 'array', items: AUFGABE_SCHEMA },
    erfolg: { type: 'array', items: { type: 'string' } },
    name: { type: 'string' },
    risiken: { type: 'array', items: { type: 'object', properties: { gegenmittel: { type: 'string' }, risiko: { type: 'string' } }, required: ['gegenmittel', 'risiko'] } },
    vision: { type: 'string' },
    ziel: { type: 'string' },
  },
  required: ['abschnitte', 'aufgaben', 'erfolg', 'name', 'risiken', 'vision', 'ziel'],
};
const AKTIONEN = ['datei_schreiben', 'datei_lesen', 'code_ausfuehren', 'tests_ausfuehren', 'recherchieren', 'plugin_nutzen', 'frage_an_nutzer', 'fertig'];
const SCHRITT_SCHEMA = {
  type: 'object',
  properties: {
    abwaegung: { type: 'string' },
    aktion: { type: 'string', enum: AKTIONEN },
    anweisung: { type: 'string' },
    datei: { type: 'string' },
    eingabe: { type: 'string' },
    faehigkeit: { type: 'string' },
    frage: { type: 'string' },
    plugin: { type: 'string' },
    sprache: { type: 'string' },
    start: { type: 'string' },
    text: { type: 'string' },
  },
  required: ['abwaegung', 'aktion', 'anweisung', 'datei', 'eingabe', 'faehigkeit', 'frage', 'plugin', 'sprache', 'start', 'text'],
};
const COACH_SCHEMA = {
  type: 'object',
  properties: {
    antwort: { type: 'string' },
    vorschlaege: { type: 'array', items: { type: 'object', properties: { aufgabe: AUFGABE_SCHEMA, begruendung: { type: 'string' } }, required: ['aufgabe', 'begruendung'] } },
  },
  required: ['antwort', 'vorschlaege'],
};

// ================================================================== Zustand

const z = {
  info: null,
  lehrer: 'lyra',
  liste: [],
  faehigkeiten: [], // was andere Plugins für Launchpad tun können
  ansicht: 'start', // start | fragen | projekt
  reiter: 'uebersicht', // uebersicht | aufgaben | dateien | protokoll | berichte
  idee: '',
  fragen: [],
  p: null,
  dateien: {}, // Arbeitsbereich des offenen Projekts {pfad: inhalt}
  protokoll: [],
  laeuft: null, // {art: 'plan'|'agent'|'bericht'|'coach'|'code'|'anleitung', aufgabe}
  status: '',
  fehler: null,
  auswahl: null, // Aufgabe im Seitenpanel (id)
  datei: null, // geöffnete Datei
  editor: null, // Text im Editor (null = nicht bearbeiten)
  quelltext: false,
  ausgabe: null, // letzte Ausführung im Dateien-Reiter
  boardListe: false,
  phase: '',
  protokollFilter: 'alle',
  offenesProtokoll: new Set(),
  bericht: null, // geöffneter Bericht (id)
  coach: { text: '', antwort: '', vorschlaege: [] },
  live: '',
  stopp: false,
  autopilot: null, // {liste, i}
  nacharbeit: '',
  antwort: '',
  statusHook: null,
  sprachen: null,
};
const app = document.getElementById('app');
let fusionMaterial = '';

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(String((e && e.message) || e));
const meldung = (e) => String((e && e.message) || e);
const kurz = (t, n) => { const s = String(t || ''); return s.length > n ? s.slice(0, n) + ` … (${s.length - n} Zeichen mehr)` : s; };
const lehrerInfo = (k) => ((z.info && z.info.lehrer) || []).find((l) => l.kennung === k) || { kennung: k, name: k === 'lyra' ? 'Lyra (lokal)' : k };
const isoGueltig = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T12:00:00')) ? s : '');
const heuteIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const deDatum = (iso, kurzform) => (isoGueltig(iso) ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', kurzform ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'long' }) : '');
const tageBis = (iso) => (isoGueltig(iso) ? Math.round((new Date(iso + 'T12:00:00') - new Date(heuteIso() + 'T12:00:00')) / 86400000) : null);
const uhrzeit = (s) => new Date(s * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const groesse = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const zeilenZahl = (t) => (t ? String(t).split('\n').length : 0);
const endung = (p) => { const i = p.lastIndexOf('.'); return i > 0 ? p.slice(i + 1).toLowerCase() : ''; };
const neueId = () => lyra.neueId() + Math.random().toString(36).slice(2, 6);
const dateiname = (t) => String(t || 'Projekt').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Projekt';
const slug = (t) => String(t || 'notiz').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'notiz';

/** Pfad im Arbeitsbereich säubern: nur a–z, 0–9, _ - . und /, höchstens 6 Ebenen, bekannte Endung. '' = ungültig. */
function pfadSauber(p) {
  let s = String(p || '').trim().replace(/\\/g, '/').replace(/^\.?\/+/, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.\/-]/g, '');
  const teile = s.split('/').filter((t) => t && t !== '.' && t !== '..').map((t) => t.replace(/^\.+/, '')).filter(Boolean);
  s = teile.slice(0, 6).join('/');
  if (!s || s.length > 160 || !ENDUNGEN.includes(endung(s))) return '';
  return s;
}

const PFAD_RE = new RegExp(`[A-Za-z0-9_./-]+\\.(?:${ENDUNGEN.join('|')})(?![A-Za-z0-9])`);
/** Kleine Modelle schreiben den Pfad gern ins falsche Feld – nimm den ersten brauchbaren aus mehreren Feldern. */
function pfadAus(...werte) {
  for (const w of werte) {
    const t = text(w);
    if (!t) continue;
    if (!/\s/.test(t)) { const p = pfadSauber(t); if (p) return p; }
    const m = t.match(PFAD_RE);
    if (m) { const p = pfadSauber(m[0]); if (p) return p; }
  }
  return '';
}

/** Fast gleicher Dateiname (Tippfehler des Modells) → die vorhandene Datei. */
function aehnlicheDatei(pfad) {
  if (z.dateien[pfad] !== undefined) return pfad;
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9./]/g, '');
  const abstand = (a, b) => {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const n = norm(pfad);
  if (n.length < 8) return pfad;
  const ohneZiffern = (x) => x.replace(/[0-9]/g, '');
  // Nur Ziffern verschieden (teil1.md, teil2.md) = Absicht, kein Tippfehler
  const treffer = Object.keys(z.dateien).find((x) => endung(x) === endung(pfad) && ohneZiffern(norm(x)) !== ohneZiffern(n) && abstand(norm(x), n) <= 2);
  return treffer || pfad;
}

// ================================================================== Start

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  let e = {};
  try { e = (await lyra.speicher.lesen('einstellungen')) || {}; } catch (_) {}
  const lehrer = z.info.lehrer || [];
  z.lehrer = lehrer.some((l) => l.kennung === e.lehrer) ? e.lehrer : z.info.standardLehrer || 'lyra';
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((x) => x && x.id); } catch (_) {}
  try { z.faehigkeiten = ((await lyra.fusion.faehigkeiten()) || []).filter((f) => f && f.plugin && f.plugin !== 'launchpad'); } catch (_) { z.faehigkeiten = []; }
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('projekt/')) await oeffnen(route.slice(8).split('/')[0]);
  else if (z.liste.length && route !== 'fusion' && route !== 'neu') await oeffnen(z.liste[0].id);
  zeichnen();
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) return anhalten();
  if (z.editor !== null) { z.editor = null; return zeichnen(); }
  if (z.auswahl) { z.auswahl = null; return zeichnen(); }
  if (z.bericht) { z.bericht = null; return zeichnen(); }
  if (z.ansicht === 'fragen') { z.ansicht = z.p ? 'projekt' : 'start'; return zeichnen(); }
  if (z.ansicht === 'projekt' && z.reiter !== 'uebersicht') { z.reiter = 'uebersicht'; return zeichnen(); }
  lyra.zurueck();
}

async function lehrerWaehlen(l) {
  z.lehrer = l;
  try { await lyra.speicher.schreiben('einstellungen', { lehrer: l }); } catch (_) {}
  zeichnen();
}

// ================================================================== Speicher

const aufgabe = (id) => (z.p ? z.p.aufgaben.find((a) => a.id === id) : null);
const kiAufgabe = (a) => a.art !== 'selbst';
const fortschritt = (p) => (p.aufgaben.length ? p.aufgaben.filter((a) => a.status === 'erledigt').length / p.aufgaben.length : 0);
const wartend = (p) => p.aufgaben.filter((a) => a.status === 'blockiert' || a.status === 'pruefung');
function reihenfolge(p) {
  const pos = new Map(p.abschnitte.map((s, i) => [s.id, i]));
  return p.aufgaben.slice().sort((a, b) => (pos.get(a.abschnitt) ?? 99) - (pos.get(b.abschnitt) ?? 99) || (PRIO[b.prioritaet] || PRIO.mittel)[1] - (PRIO[a.prioritaet] || PRIO.mittel)[1]);
}
const naechste = (p) => reihenfolge(p).filter((a) => a.status === 'offen');

function migrieren(p) {
  if (p.v === 2) {
    p.einstellungen = { ...EINSTELLUNGEN, ...(p.einstellungen || {}) };
    p.berichte = p.berichte || [];
    return { p, dateien: null };
  }
  // Version 1: Meilensteine mit Aufgaben → Phasen und eine Aufgabenliste; Ergebnisse werden Dateien
  const dateien = {};
  const abschnitte = [];
  const aufgaben = [];
  const artNeu = { text: 'dokument', recherche: 'recherche', werkzeug: 'plugin', selbst: 'selbst' };
  (p.meilensteine || []).forEach((m) => {
    const s = { id: neueId(), titel: text(m.titel) || 'Phase', bis: isoGueltig(m.bis) };
    abschnitte.push(s);
    (m.aufgaben || []).forEach((a) => {
      const neu = {
        id: a.id || neueId(), titel: text(a.titel) || 'Aufgabe', beschreibung: text(a.beschreibung) || text(a.auftrag), kriterien: [],
        abschnitt: s.id, art: artNeu[a.art] || 'dokument', sprache: '', prioritaet: 'mittel', minuten: a.minuten || 30,
        status: a.erledigt ? 'erledigt' : 'offen', bericht: '', dateien: [], frage: '', antworten: [], tests: null, laeufe: 0, erledigtAm: a.erledigtAm || null,
      };
      if (text(a.ergebnis)) {
        const pfad = `ergebnisse/${slug(a.titel)}.md`;
        dateien[pfad] = `# ${a.titel}\n\n${a.ergebnis}\n`;
        neu.bericht = a.ergebnis;
        neu.dateien = [pfad];
        if (!a.erledigt) neu.status = 'pruefung';
      }
      aufgaben.push(neu);
    });
  });
  return {
    p: {
      v: 2, id: p.id, zeit: p.zeit || lyra.jetzt(), geaendert: p.geaendert || lyra.jetzt(), idee: p.idee || '', antworten: p.antworten || [],
      name: p.name || 'Projekt', vision: p.vision || '', ziel: p.ziel || '', erfolg: p.erfolg || [], risiken: p.risiken || [],
      ressourcen: p.ressourcen || [], abschnitte: abschnitte.length ? abschnitte : [{ id: neueId(), titel: 'Umsetzung', bis: '' }],
      aufgaben, einstellungen: { ...EINSTELLUNGEN }, erinnern: !!p.erinnern, verlauf: p.verlauf || [], berichte: [],
    },
    dateien,
  };
}

async function sichern(p = z.p) {
  if (!p) return;
  p.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('projekte/' + p.id, p); } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  const n = naechste(p)[0];
  const w = wartend(p).length;
  const meta = { id: p.id, name: p.name, zeit: p.zeit, geaendert: p.geaendert, fortschritt: fortschritt(p), naechste: n ? n.titel : '', wartet: w, fertig: p.aufgaben.length > 0 && p.aufgaben.every((a) => a.status === 'erledigt'), aufgaben: p.aufgaben.length };
  // Frisch lesen: Ein unsichtbares Launchpad (Fusion) kann inzwischen eigene Projekte eingetragen haben
  let alt = z.liste;
  try { const l = await lyra.speicher.lesen('index'); if (Array.isArray(l)) alt = [...l.filter((x) => x && x.id && !z.liste.some((y) => y.id === x.id)), ...z.liste]; } catch (_) {}
  z.liste = [meta, ...alt.filter((x) => x.id !== p.id)].sort((x, y) => (y.geaendert || y.zeit || 0) - (x.geaendert || x.zeit || 0));
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  startseite();
}

async function dateienSichern() {
  if (!z.p) return;
  try { await lyra.speicher.schreiben('dateien/' + z.p.id, z.dateien); } catch (e) { lyra.toast(meldung(e), 'fehler'); }
}

let protokollUhr = null;
function protokollSichern(sofort) {
  clearTimeout(protokollUhr);
  const p = z.p;
  const los = () => { if (p) lyra.speicher.schreiben('protokoll/' + p.id, z.protokoll.slice(-800)).catch(() => {}); };
  if (sofort) los(); else protokollUhr = setTimeout(los, 600);
}

function protokollieren(art, titel, inhalt = '', { aufgabe: aid = null, ok = null } = {}) {
  const e = { id: neueId(), zeit: lyra.jetzt(), art, titel: String(titel).slice(0, 200), text: String(inhalt || '').slice(0, 6000), aufgabe: aid, ok };
  z.protokoll.push(e);
  if (z.protokoll.length > 900) z.protokoll = z.protokoll.slice(-800);
  protokollSichern();
  const feed = document.getElementById('live-feed');
  if (feed) { feed.appendChild(protokollZeile(e, true)); feed.scrollTop = feed.scrollHeight; }
  return e;
}

async function oeffnen(id) {
  try {
    const roh = await lyra.speicher.lesen('projekte/' + id);
    if (!roh) return false;
    const { p, dateien } = migrieren(roh);
    let ws = null, prot = null;
    try { ws = await lyra.speicher.lesen('dateien/' + id); } catch (_) {}
    try { prot = await lyra.speicher.lesen('protokoll/' + id); } catch (_) {}
    z.p = p;
    z.dateien = { ...(ws || {}), ...(dateien || {}) };
    z.protokoll = Array.isArray(prot) ? prot : [];
    if (dateien) { await sichern(p); await dateienSichern(); }
    // Abgebrochene Läufe (z. B. Lyra wurde beendet) wieder freigeben
    p.aufgaben.forEach((a) => { if (a.status === 'arbeit' && kiAufgabe(a) && !z.laeuft) a.status = 'offen'; });
    z.ansicht = 'projekt';
    z.auswahl = null; z.datei = null; z.editor = null; z.ausgabe = null; z.bericht = null;
    z.coach = { text: '', antwort: '', vorschlaege: [] };
    return true;
  } catch (_) { return false; }
}

async function entfernen(id) {
  const ok = await lyra.bestaetigen({ titel: 'Projekt löschen?', text: 'Plan, Arbeitsbereich mit allen Dateien, Protokoll und Berichte dieses Projekts werden gelöscht. Exportierte Ordner auf deinem Mac bleiben.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  for (const k of ['projekte/', 'dateien/', 'protokoll/']) { try { await lyra.speicher.loeschen(k + id); } catch (_) {} }
  z.liste = z.liste.filter((x) => x.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  if (z.p && z.p.id === id) { z.p = null; z.dateien = {}; z.protokoll = []; z.ansicht = 'start'; }
  await erinnerungenSetzen();
  startseite();
  zeichnen();
}

function startseite() {
  const eintraege = z.liste.filter((x) => !x.fertig && (x.wartet || x.naechste)).slice(0, 2).map((x) => ({
    id: 'projekt-' + x.id,
    titel: x.wartet ? `${x.name}: ${x.wartet === 1 ? 'Ein Ergebnis wartet' : `${x.wartet} Ergebnisse warten`} auf dich` : `${x.name}: ${x.naechste}`,
    untertitel: `Launchpad · ${Math.round((x.fortschritt || 0) * 100)} % erledigt`,
    route: 'projekt/' + x.id,
    zeigen_bis: lyra.jetzt() + 21 * 86400,
    geaendert: x.geaendert || x.zeit,
  }));
  lyra.startseite(eintraege).catch(() => {});
}

/** Erinnerungen an Phasen-Termine (am Vortag, 9 Uhr) – nur für Projekte, bei denen du sie eingeschaltet hast. */
async function erinnerungenSetzen() {
  const liste = [];
  for (const meta of z.liste) {
    let p = z.p && z.p.id === meta.id ? z.p : null;
    if (!p) { try { p = migrieren(await lyra.speicher.lesen('projekte/' + meta.id)).p; } catch (_) {} }
    if (!p || !p.erinnern) continue;
    p.abschnitte.forEach((s) => {
      const offen = p.aufgaben.filter((a) => a.abschnitt === s.id && a.status !== 'erledigt').length;
      if (!isoGueltig(s.bis) || !offen) return;
      const d = new Date(s.bis + 'T09:00:00');
      d.setDate(d.getDate() - 1);
      if (d.getTime() < Date.now()) return;
      liste.push({ id: `${p.id}-${s.id}`, titel: `Morgen fällig: ${s.titel}`.slice(0, 120), text: `${p.name} · ${offen} Aufgaben offen`, zeit: Math.round(d.getTime() / 1000) });
    });
  }
  try { return await lyra.erinnern(liste.slice(0, 60)); } catch (_) { return false; }
}

// ================================================================== Arbeitsbereich

// Zählt jede Änderung im Arbeitsbereich – Wiederholungen gelten nur bei unverändertem Stand als sinnlos
let stand = 0;
const arbeitsbereichGroesse = () => Object.values(z.dateien).reduce((s, t) => s + String(t).length, 0);

function dateiSetzen(pfad, inhalt) {
  const alt = z.dateien[pfad];
  const neu = String(inhalt);
  if (arbeitsbereichGroesse() - (alt ? alt.length : 0) + neu.length > ARBEITSBEREICH_MAX) {
    throw new Error(`Der Arbeitsbereich ist voll (höchstens ${groesse(ARBEITSBEREICH_MAX)}). Lösch große Dateien oder exportiere das Projekt.`);
  }
  z.dateien[pfad] = neu;
  if (alt !== neu) stand++;
  return alt === undefined ? 'neu' : alt === neu ? 'gleich' : 'geaendert';
}

/** Dateien für die Sandbox: Code zuerst, dann Daten – höchstens 80 Dateien und 11 MB. */
function sandboxDateien(extra = {}) {
  const aus = {};
  let gesamt = 0, n = 0;
  const liste = Object.keys(z.dateien).sort((a, b) => (SPRACHE_VON_ENDUNG[endung(b)] ? 1 : 0) - (SPRACHE_VON_ENDUNG[endung(a)] ? 1 : 0));
  for (const pfad of [...Object.keys(extra), ...liste]) {
    const inhalt = extra[pfad] !== undefined ? extra[pfad] : z.dateien[pfad];
    if (aus[pfad] !== undefined || !pfadSauber(pfad) || pfadSauber(pfad) !== pfad) continue;
    if (n >= 80 || gesamt + inhalt.length > 11 * 1024 * 1024) continue;
    aus[pfad] = inhalt;
    gesamt += inhalt.length;
    n++;
  }
  return aus;
}

/** Programm in der Sandbox ausführen; was es anlegt, kommt in den Arbeitsbereich. */
async function codeLaufen({ sprache, start, eingabe = '', tests = false, sekunden = 40, extra = {} }) {
  const r = await lyra.code({ sprache, dateien: sandboxDateien(extra), start: tests && sprache === 'python' ? 'unittest' : start, eingabe, sekunden });
  const neu = [];
  for (const [pfad, inhalt] of Object.entries((r && r.dateien) || {})) {
    if (extra[pfad] !== undefined) continue;
    try { if (dateiSetzen(pfad, inhalt) !== 'gleich') neu.push(pfad); } catch (e) { r.fehler = (r.fehler || '') + '\n' + meldung(e); }
  }
  if (neu.length) await dateienSichern();
  const gesamt = `${r.ausgabe || ''}\n${r.fehler || ''}`;
  let testErgebnis = null;
  if (tests) {
    const ran = gesamt.match(/Ran (\d+) tests?/);
    const fehl = gesamt.match(/FAILED \(([^)]*)\)/);
    const zahl = (k) => { const m = fehl && fehl[1].match(new RegExp(k + '=(\\d+)')); return m ? +m[1] : 0; };
    const anzahl = ran ? +ran[1] : null;
    const kaputt = fehl ? zahl('failures') + zahl('errors') : r.ok ? 0 : null;
    testErgebnis = { ok: !!r.ok && (anzahl === null || anzahl > 0), gesamt: anzahl, fehlgeschlagen: kaputt, zeit: lyra.jetzt(), sprache };
    if (anzahl === 0) testErgebnis.ok = false;
  }
  return { r, neu, testErgebnis };
}

/** Python-Tracebacks ohne die Zeilen des Sandbox-Starters (runpy) – die eigentliche Stelle bleibt. */
function tracebackSaeubern(t) {
  const zeilen = String(t || '').split('\n');
  const aus = [];
  let weg = false;
  for (const z1 of zeilen) {
    if (/^\s*File "(<string>|<frozen runpy>)"/.test(z1)) { weg = true; continue; }
    if (weg && /^\s{4,}\S/.test(z1) && !/^\s*File "/.test(z1)) continue;
    weg = false;
    aus.push(z1);
  }
  return aus.join('\n');
}

function codeZusammenfassung(r, neu) {
  const teile = [];
  teile.push(r.zeitUm ? 'Zeitlimit überschritten – das Programm wurde beendet.' : r.ok ? `Beendet mit Code 0 (${r.dauerMs} ms).` : `Fehlgeschlagen${r.schritt === 'uebersetzen' ? ' beim Übersetzen' : ''} (Code ${r.code}).`);
  if (text(r.ausgabe)) teile.push('Ausgabe:\n' + kurz(r.ausgabe.trim(), 2500));
  if (text(r.fehler)) {
    const f = tracebackSaeubern(r.fehler).trim();
    // Bei langen Fehlerausgaben zählt das Ende (dort steht der eigentliche Fehler)
    teile.push('Fehlerausgabe:\n' + (f.length > 2500 ? '… ' + f.slice(-2500) : f));
  }
  if (neu.length) teile.push('Neue oder geänderte Dateien: ' + neu.map((x) => z.dateien[x] !== undefined ? `${x} (${zeilenZahl(z.dateien[x].trimEnd())} Zeilen${['csv', 'tsv'].includes(endung(x)) ? ' inkl. Kopfzeile' : ''})` : x).join(', '));
  return teile.join('\n');
}

/** Python-Datei gleich nach dem Schreiben auf Syntaxfehler prüfen (in der Sandbox). */
async function syntaxPruefen(pfad) {
  if (endung(pfad) !== 'py') return '';
  const pruefer = `import ast, sys\ntry:\n    ast.parse(open(${JSON.stringify(pfad)}, encoding='utf-8').read())\n    print('OK')\nexcept SyntaxError as e:\n    print(f'SyntaxError Zeile {e.lineno}: {e.msg}')\n    print((e.text or '').rstrip())\n`;
  try {
    const r = await lyra.code({ sprache: 'python', dateien: { [pfad]: z.dateien[pfad], 'syntax_pruefen_lp.py': pruefer }, start: 'syntax_pruefen_lp.py', sekunden: 10 });
    const aus = text(r && r.ausgabe);
    return aus === 'OK' ? 'Syntax geprüft: OK.' : aus ? 'Achtung – ' + aus : '';
  } catch (e) {
    if (abgebrochen(e)) throw e;
    return '';
  }
}

// ================================================================== Idee → Rückfragen → Plan

function status(t) {
  z.status = t;
  document.querySelectorAll('#status, [data-status]').forEach((el) => { el.textContent = t; });
  if (z.statusHook) z.statusHook(t);
}

function faehigkeitenListe() {
  return z.faehigkeiten.length ? z.faehigkeiten.slice(0, 30).map((f) => `- plugin "${f.plugin}", faehigkeit "${f.faehigkeit}": ${f.name} – ${f.titel}: ${f.beschreibung}`).join('\n') : '(keine)';
}

async function rueckfragen(idee) {
  const t = text(idee);
  if (!t || z.laeuft) return;
  z.idee = t;
  z.laeuft = { art: 'plan' };
  z.fehler = null;
  status('Launchpad denkt über dein Vorhaben nach …');
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: FRAGEN_SCHEMA,
      prompt: `Mein Vorhaben: „${t}“\n\nStelle 3 bis 4 kurze Rückfragen, deren Antworten den Plan deutlich besser machen \
(z. B. Umfang, Programmiersprache, Zielgruppe, Datenmenge, bis wann, was genau „fertig“ heißt). Nur, was sich nicht schon \
aus dem Vorhaben ergibt. Je Frage 3–4 typische, kurze Antwortvorschläge.\n\nAntwort als JSON: {"fragen": [{"frage": "", "vorschlaege": [""]}]}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    z.fragen = (((r && r.json) || {}).fragen || []).filter((f) => f && text(f.frage)).slice(0, 4)
      .map((f) => ({ frage: frageReparieren(text(f.frage)), vorschlaege: (f.vorschlaege || []).map(text).filter(Boolean).slice(0, 4), antwort: '' }));
    z.ansicht = 'fragen';
    if (!z.fragen.length) { z.laeuft = null; return planen(); }
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = null;
  zeichnen();
}

/** Kleine Modelle beenden JSON-Text gern am deutschen Anführungszeichen – dann fehlt das Ende der Frage. */
function frageReparieren(q) {
  let f = q;
  if ((f.match(/„/g) || []).length > (f.match(/[“”]/g) || []).length) f += '“';
  if (!/[?.!:]$/.test(f)) f += '?';
  return f;
}

function aufgabeAus(a, abschnitte) {
  if (!a || !text(a.titel)) return null;
  const art = ARTEN[a.art] ? a.art : 'dokument';
  let sprache = text(a.sprache).toLowerCase().replace('c++', 'cpp');
  if (!SPRACHEN[sprache]) sprache = art === 'code' || art === 'daten' || art === 'analyse' ? 'python' : '';
  const i = Math.max(1, Math.min(abschnitte.length, Math.round(Number(a.abschnitt) || 1))) - 1;
  return {
    id: neueId(),
    titel: text(a.titel).slice(0, 140),
    beschreibung: text(a.beschreibung).slice(0, 1200),
    kriterien: (a.kriterien || []).map(text).filter(Boolean).slice(0, 6).map((k) => k.slice(0, 240)),
    abschnitt: abschnitte[i] ? abschnitte[i].id : '',
    art,
    sprache,
    prioritaet: PRIO[a.prioritaet] ? a.prioritaet : 'mittel',
    minuten: Math.max(5, Math.min(2400, Math.round(Number(a.minuten) || 30))),
    status: 'offen',
    bericht: '', dateien: [], frage: '', antworten: [], tests: null, laeufe: 0, erledigtAm: null,
  };
}

async function planen() {
  if (z.laeuft) return;
  z.laeuft = { art: 'plan' };
  z.fehler = null;
  status('Launchpad baut deinen Projektplan …');
  zeichnen();
  let fristen = [];
  try { fristen = ((await lyra.fristen()) || []).slice(0, 12); } catch (_) {}
  const antworten = z.fragen.filter((f) => text(f.antwort)).map((f) => `- ${f.frage} → ${text(f.antwort)}`).join('\n');
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: PLAN_SCHEMA, zaehlen: { schluessel: 'titel', wort: 'Eintrag' },
      prompt: `Heute ist ${deDatum(heuteIso())} (${heuteIso()}).\nMein Vorhaben: „${z.idee}“\n${antworten ? `Meine Antworten:\n${antworten}\n` : ''}\
${fusionMaterial ? `Material aus anderen Plugins – plane konkret damit:\n${fusionMaterial}\n` : ''}\
${fristen.length ? `Meine nächsten Abgaben und Klausuren (plane drumherum):\n${fristen.map((f) => `- ${f.titel || f.fach || 'Termin'}: ${String(f.termin || f.wann || '').slice(0, 16)}`).join('\n')}\n` : ''}
Erstelle einen professionellen Projektplan, den ein KI-Mitarbeiter mit Werkzeugen größtenteils selbst umsetzen kann. Der \
Mitarbeiter kann: Dateien anlegen, Code in Python, Java, C, C++, Swift oder Ruby schreiben und in einer Sandbox ausführen \
und testen (ohne Internet), große Datensätze per Skript erzeugen, Daten auswerten, recherchieren und andere Plugins nutzen.
- "name": kurzer Projektname (2–4 Wörter). "vision": 1 Satz. "ziel": messbares Ziel mit Datum.
- "erfolg": 2–4 überprüfbare Erfolgskriterien.
- "abschnitte": 2 bis 4 Phasen in sinnvoller Reihenfolge, je "titel" und "bis" (Datum JJJJ-MM-TT, realistisch verteilt).
- "aufgaben": 5 bis 12 konkrete Arbeitspakete. Je "titel" (Verb zuerst), "beschreibung" (2–3 Sätze: was genau entstehen soll, \
Umfang, Format), "kriterien" (2–4 prüfbare Abnahmekriterien, z. B. „Alle Unit-Tests laufen grün“, „CSV mit mindestens 5000 Zeilen“), \
"abschnitt" (Nummer der Phase ab 1), "prioritaet" (hoch, mittel, niedrig), "minuten" (Aufwand für einen Menschen), "sprache" \
(python, java, c, cpp, swift, ruby – nur bei Code und Daten, sonst ""), "art":
  "code" = Programm/Projekt schreiben und testen; "daten" = Datensatz erzeugen und prüfen; "analyse" = Daten auswerten/rechnen; \
"recherche" = recherchieren mit Quellen; "dokument" = Konzept, Text, Website, Anleitung; "plugin" = ein Plugin aus der Liste unten \
erledigt es; "selbst" = nur ein Mensch kann es (Gespräche, Termine, Entscheidungen) – höchstens 2 solche Aufgaben.
- "risiken": 2–3 mit "gegenmittel".

Plugins, die mitarbeiten können:\n${faehigkeitenListe()}

Antwort als JSON: {"abschnitte": [{"bis": "", "titel": ""}], "aufgaben": [{"abschnitt": 1, "art": "code", "beschreibung": "", "kriterien": [""], "minuten": 60, "prioritaet": "hoch", "sprache": "python", "titel": ""}], "erfolg": [""], "name": "", "risiken": [{"gegenmittel": "", "risiko": ""}], "vision": "", "ziel": ""}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    let letztes = heuteIso();
    const abschnitte = (j.abschnitte || []).filter((s) => s && text(s.titel)).slice(0, 6).map((s) => {
      let bis = isoGueltig(text(s.bis));
      if (!bis || bis < letztes) bis = '';
      if (bis) letztes = bis;
      return { id: neueId(), titel: text(s.titel).slice(0, 100), bis };
    });
    if (!abschnitte.length) abschnitte.push({ id: neueId(), titel: 'Umsetzung', bis: '' });
    const aufgaben = (j.aufgaben || []).map((a) => aufgabeAus(a, abschnitte)).filter(Boolean).slice(0, 16);
    if (!aufgaben.length) throw new Error('Der Plan ist nicht gelungen – beschreib dein Vorhaben etwas genauer und versuch es noch einmal.');
    const p = {
      v: 2, id: lyra.neueId(), zeit: lyra.jetzt(), idee: z.idee,
      antworten: z.fragen.filter((f) => text(f.antwort)).map((f) => ({ frage: f.frage, antwort: text(f.antwort) })),
      name: text(j.name).slice(0, 60) || z.idee.slice(0, 60),
      vision: text(j.vision).slice(0, 300),
      ziel: text(j.ziel).slice(0, 400),
      erfolg: (j.erfolg || []).map(text).filter(Boolean).slice(0, 5),
      risiken: (j.risiken || []).filter((x) => x && text(x.risiko)).slice(0, 4).map((x) => ({ risiko: text(x.risiko).slice(0, 200), gegenmittel: text(x.gegenmittel).slice(0, 300) })),
      ressourcen: [],
      abschnitte, aufgaben,
      einstellungen: { ...EINSTELLUNGEN }, erinnern: false, verlauf: [], berichte: [],
    };
    z.p = p;
    z.dateien = {};
    z.protokoll = [];
    protokollieren('plan', 'Projekt angelegt', `${p.name}: ${aufgaben.length} Aufgaben in ${abschnitte.length} Phasen.\nVorhaben: ${p.idee}`);
    await sichern(p);
    await dateienSichern();
    protokollSichern(true);
    z.ansicht = 'projekt';
    z.reiter = 'uebersicht';
    z.auswahl = null; z.datei = null; z.bericht = null;
    z.idee = '';
    z.fragen = [];
    lyra.toast('Projekt angelegt – Launchpad kann loslegen', 'ok');
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = null;
  zeichnen();
}

// ================================================================== Der Mitarbeiter: Aufgaben wirklich erledigen

function projektKontext(p) {
  return `Projekt: ${p.name}\nZiel: ${p.ziel}\nVorhaben: ${p.idee}${p.antworten.length ? '\n' + p.antworten.map((x) => `${x.frage} → ${x.antwort}`).join('\n') : ''}`;
}

function aufgabeKontext(p, a) {
  const phase = p.abschnitte.find((s) => s.id === a.abschnitt);
  const fertig = p.aufgaben.filter((x) => x.status === 'erledigt' && x.id !== a.id).slice(-8).map((x) => `- ${x.titel}${x.dateien.length ? ` (Dateien: ${x.dateien.slice(0, 6).join(', ')})` : ''}`).join('\n');
  const andere = p.aufgaben.filter((x) => x.status !== 'erledigt' && x.id !== a.id).slice(0, 8).map((x) => `- ${x.titel}`).join('\n');
  return `${projektKontext(p)}
Phase: ${phase ? phase.titel : '–'}
AUFGABE: ${a.titel}
Art: ${ARTEN[a.art][0]}${a.sprache ? ` · Sprache: ${SPRACHEN[a.sprache] ? SPRACHEN[a.sprache][0] : a.sprache}` : ''}
Beschreibung: ${a.beschreibung || '–'}
${a.kriterien.length ? `Abnahmekriterien:\n${a.kriterien.map((k) => `- ${k}`).join('\n')}` : ''}
${fertig ? `Bereits erledigte Aufgaben:\n${fertig}` : ''}
${andere ? `Andere offene Aufgaben im Projekt – NICHT Teil dieser Aufgabe, fang sie nicht an:\n${andere}` : ''}
${a.antworten.length ? `Antworten des Nutzers auf deine Rückfragen:\n${a.antworten.map((x) => `- ${x.frage} → ${x.antwort}`).join('\n')}` : ''}`;
}

function arbeitsbereichListe(max = 50) {
  const liste = Object.keys(z.dateien).sort();
  if (!liste.length) return '(leer)';
  return liste.slice(0, max).map((p) => `- ${p} (${groesse(z.dateien[p].length)}, ${zeilenZahl(z.dateien[p])} Zeilen)`).join('\n') + (liste.length > max ? `\n… und ${liste.length - max} weitere` : '');
}

const WERKZEUG_TEXT = (ohneRueckfragen) => `Werkzeuge – wähle pro Schritt genau eine "aktion":
- "datei_schreiben": legt eine Datei im Arbeitsbereich an oder ersetzt sie vollständig. "datei" = Pfad (z. B. "rechner.py", \
"src/Main.java", "daten/umsatz.csv"; nur a–z, 0–9, _ - . /), "anweisung" = genau, was hinein soll (Funktionen, Klassen, \
Struktur). Den Inhalt schreibst du danach in einem eigenen Schritt vollständig.
- "datei_lesen": zeigt dir den Inhalt einer Datei ("datei").
- "code_ausfuehren": führt ein Programm aus. "sprache" (python, java, c, cpp, swift, ruby), "start" = Startdatei (Java: \
Datei der Klasse mit main), "eingabe" = optionale Standardeingabe. Alle Dateien des Arbeitsbereichs liegen im Arbeitsordner; \
Dateien, die das Programm schreibt (z. B. eine große CSV), landen automatisch im Arbeitsbereich. Kein Internet, höchstens 40 s.
- "tests_ausfuehren": führt die Tests aus. Python: alle Dateien test_*.py im Hauptordner mit unittest ("start" leer). Andere \
Sprachen: "start" = Testprogramm, das bei einem Fehler mit Exit-Code ungleich 0 endet.
- "recherchieren": "anweisung" = konkrete Recherchefrage. Das Ergebnis landet als Notiz mit Quellen im Arbeitsbereich.
- "plugin_nutzen": lässt ein anderes Lyra-Plugin arbeiten: "plugin", "faehigkeit" und "anweisung". Verfügbar:\n${z.p && z.p.einstellungen.plugins ? faehigkeitenListe() : '(abgeschaltet)'}
${ohneRueckfragen ? '- Rückfragen sind hier nicht möglich: Triff sinnvolle Annahmen und nenne sie im Abschlussbericht.' : '- "frage_an_nutzer": nur, wenn es ohne eine Angabe von mir wirklich nicht sinnvoll weitergeht ("frage" = kurze, klare Frage).'}
- "fertig": Die Aufgabe ist erledigt und geprüft. "text" = Abschlussbericht in Markdown: Was du gemacht hast, welche Dateien \
entstanden sind, wie du getestet hast (mit echtem Ergebnis), wie man es benutzt, offene Punkte und Annahmen.
Regeln:
- Große Datensätze (mehr als etwa 80 Zeilen) nie von Hand schreiben: schreib ein Skript, das sie erzeugt (z. B. mit random \
und festem Seed), und führe es aus.
- Code immer ausführen; zu Code gehören Unit-Tests (Python: test_<modul>.py mit unittest im Hauptordner). Schlägt etwas \
fehl, lies den Fehler, korrigiere die Datei und führe erneut aus. Melde "fertig" erst, wenn alles läuft.
- Zu einem Programm gehört eine README.md mit Zweck, Aufbau, Bedienung und Testergebnis.
- Wiederhole keinen Schritt, der schon geklappt hat. Halte dich an die Abnahmekriterien.
- Ändere vorhandene Dateien, statt neue mit ähnlichem Namen anzulegen (z. B. nur eine Testdatei je Modul).
- Erledige nur DIESE Aufgabe. Sobald ihre Abnahmekriterien erfüllt und geprüft sind, melde sofort "fertig".`;

function verlaufText(verlauf, budget) {
  if (!verlauf.length) return '(noch keine)';
  const teile = [];
  let rest = budget;
  for (let i = verlauf.length - 1; i >= 0 && rest > 0; i--) {
    const v = verlauf[i];
    const zeile = `${i + 1}. ${v.aktion}${v.ziel ? ' ' + v.ziel : ''} → ${v.ergebnis}`;
    const s = zeile.length > rest ? zeile.slice(0, Math.max(200, rest)) + ' …' : zeile;
    teile.unshift(s);
    rest -= s.length;
  }
  const weg = verlauf.length - teile.length;
  return (weg > 0 ? `(${weg} frühere Schritte ausgelassen)\n` : '') + teile.join('\n');
}

const gross = () => lehrerInfo(z.lehrer).online === true;

async function naechsterSchritt(p, a, verlauf, nr, max, opt) {
  const hinweis = opt.hinweis ? `\nWICHTIG: ${opt.hinweis}` : '';
  const prompt = `${aufgabeKontext(p, a)}
${opt.nacharbeit ? `NACHARBEIT gewünscht – das soll geändert werden: ${opt.nacharbeit}\nDein letzter Bericht:\n${kurz(a.bericht, 1500)}\n` : ''}
Arbeitsbereich:\n${arbeitsbereichListe()}

Bisherige Schritte dieser Aufgabe:\n${verlaufText(verlauf, gross() ? 9000 : 4500)}

${WERKZEUG_TEXT(opt.ohneRueckfragen)}

Das ist Schritt ${nr} von höchstens ${max}.${max - nr <= 2 ? ' Komm jetzt zum Abschluss: führe noch Fehlendes aus und melde dann "fertig".' : ''}${hinweis}
Überlege in "abwaegung" kurz (1–2 Sätze), was als Nächstes am meisten bringt. Felder, die du nicht brauchst, bleiben "".
Antwort als JSON: {"abwaegung": "", "aktion": "", "anweisung": "", "datei": "", "eingabe": "", "faehigkeit": "", "frage": "", "plugin": "", "sprache": "", "start": "", "text": ""}`;
  for (let versuch = 0; versuch < 2; versuch++) {
    const r = await lyra.ki({ lehrer: z.lehrer, system: MITARBEITER, schema: SCHRITT_SCHEMA, prompt }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = r && r.json;
    if (j && AKTIONEN.includes(j.aktion)) return j;
  }
  throw new Error('Der Mitarbeiter hat keinen gültigen nächsten Schritt geliefert.');
}

/** Inhalt einer Datei schreiben lassen – als reiner Text (zuverlässiger als Code in JSON). */
async function dateiInhalt(p, a, pfad, anweisung, letzterFehler = '') {
  const alt = z.dateien[pfad];
  const verwandt = Object.keys(z.dateien).filter((x) => x !== pfad && (SPRACHE_VON_ENDUNG[endung(x)] || ['md', 'json', 'html', 'css', 'js', 'sql'].includes(endung(x))))
    .sort((x, y) => z.dateien[x].length - z.dateien[y].length);
  let budget = gross() ? 24000 : 9000;
  const kontext = [];
  for (const x of verwandt) {
    const t = z.dateien[x];
    if (t.length > budget) continue;
    kontext.push(`--- ${x} ---\n${t}`);
    budget -= t.length;
  }
  const daten = Object.keys(z.dateien).filter((x) => ['csv', 'tsv', 'txt', 'log'].includes(endung(x)))
    .map((x) => `--- ${x} (erste Zeilen) ---\n${z.dateien[x].split('\n').slice(0, 6).join('\n')}`).slice(0, 4);
  const art = endung(pfad);
  z.live = '';
  const live = (x) => {
    if (x.art === 'hinweis') status(x.text);
    else if (x.art === 'text' || x.art === 'ersetzen') {
      z.live = x.art === 'text' ? z.live + x.text : x.text;
      const el = document.getElementById('live-inhalt');
      if (el) { el.textContent = z.live.slice(-4000); el.scrollTop = el.scrollHeight; }
    }
  };
  const r = await lyra.ki({
    lehrer: z.lehrer, system: MITARBEITER,
    prompt: `${aufgabeKontext(p, a)}

${kontext.length ? `Vorhandene Dateien im Arbeitsbereich:\n${kontext.join('\n\n')}\n` : ''}${daten.length ? `Daten im Arbeitsbereich:\n${daten.join('\n\n')}\n` : ''}
${alt !== undefined ? `Aktueller Inhalt von ${pfad}:\n${kurz(alt, gross() ? 30000 : 12000)}\n` : ''}${letzterFehler ? `Die letzte Ausführung ist fehlgeschlagen – behebe die Ursache:\n${kurz(letzterFehler, 2500)}\n` : ''}
Schreibe jetzt den VOLLSTÄNDIGEN Inhalt der Datei "${pfad}".
Was hinein soll: ${anweisung || `was die Aufgabe „${a.titel}“ für diese Datei braucht`}
Gib NUR den Dateiinhalt aus – ohne Erklärung davor oder danach und ohne Markdown-Codeblock.${SPRACHE_VON_ENDUNG[art] ? ' Variablen-, Funktions- und Klassennamen nur mit ASCII-Zeichen (statt ä, ö, ü, ß: ae, oe, ue, ss) – Umlaute nur in Texten und Kommentaren.' : ''}${art === 'py' ? ' Python 3, nur Standardbibliothek; Pfade relativ zum Arbeitsordner.' : ''}${art === 'java' ? ' Der Klassenname muss zum Dateinamen passen; kein package, wenn die Datei im Hauptordner liegt.' : ''}${['csv', 'tsv'].includes(art) ? ' Höchstens 80 Zeilen – größere Datensätze erzeugt ein Skript.' : ''}`,
  }, live);
  let t = String((r && r.text) || '');
  const block = t.match(/^\s*```[\w+.-]*\n([\s\S]*?)\n```\s*$/);
  if (block) t = block[1];
  else if (art !== 'md') {
    // Vorrede („Hier ist der Inhalt:“) um einen Codeblock herum weglassen
    const bloecke = [...t.matchAll(/```[\w+.-]*\n([\s\S]*?)\n```/g)].map((m) => m[1]).sort((x, y) => y.length - x.length);
    if (bloecke.length && bloecke[0].length > t.length * 0.6) t = bloecke[0];
    else t = t.replace(/^\s*```[\w+.-]*\n/, '').replace(/\n```\s*$/, '');
  }
  // Manche Modelle stellen den Dateinamen als erste Zeile voran („rechner.py“, „Datei: rechner.py“)
  const erste = (t.split('\n')[0] || '').trim().replace(/^(datei|file|inhalt von)\s*:?\s*/i, '').replace(/[`*:]/g, '').trim();
  if (erste === pfad || erste === pfad.split('/').pop()) t = t.split('\n').slice(1).join('\n').replace(/^\s*\n/, '');
  if (!t.trim()) throw new Error(`Für ${pfad} kam kein Inhalt zurück.`);
  return t.replace(/\s+$/, '') + '\n';
}

async function rechercheAusfuehren(p, a, frage) {
  const web = lehrerInfo(z.lehrer).web === true && p.einstellungen.web;
  let belege = '';
  let funde = [];
  if (!web) {
    try {
      status('Schlage in Wikipedia & Co. nach …');
      funde = (await lyra.nachschlagen(frage, 5)) || [];
      belege = funde.map((b, i) => `[${i + 1}] ${b.quelle} – ${b.titel} (${b.url})\n${b.text}`).join('\n\n');
    } catch (e) { if (abgebrochen(e)) throw e; }
  }
  status(web ? 'Recherchiert im Internet …' : 'Fasst die Recherche zusammen …');
  const r = await lyra.ki({
    lehrer: z.lehrer, system: MITARBEITER, web,
    prompt: `${projektKontext(p)}\nAufgabe: ${a.titel}\n\nRecherchiere: ${frage}\n\n${web ? 'Suche im Internet nach aktuellen, seriösen Quellen.' : belege ? `Stütze dich auf diese Auszüge:\n${belege}\n` : 'Du hast keinen Internetzugang – nutze dein Wissen und kennzeichne Unsicheres deutlich.'}
Schreib eine sachliche Recherche-Notiz in Markdown (200–500 Wörter): Kernaussagen als Stichpunkte, konkrete Zahlen und Beispiele, \
am Ende „## Quellen“${web || belege ? ' mit Markdown-Links' : ' (oder „keine – aus dem Modellwissen“)'}.`,
  }, (x) => { if (x.art === 'hinweis') status(x.text); });
  const notiz = text(r && r.text);
  if (!notiz) throw new Error('Die Recherche brachte kein Ergebnis.');
  let pfad = `recherche/${slug(frage)}.md`;
  for (let i = 2; z.dateien[pfad] !== undefined && i < 50; i++) pfad = `recherche/${slug(frage)}-${i}.md`;
  dateiSetzen(pfad, `# ${frage}\n\n_Recherche vom ${new Date().toLocaleDateString('de-DE')} · ${web ? 'Websuche' : funde.length ? 'Wikipedia & Co.' : 'Modellwissen'}_\n\n${notiz}\n`);
  await dateienSichern();
  return { pfad, notiz };
}

async function pluginAusfuehren(p, a, plugin, faehigkeit, anweisung) {
  const f = z.faehigkeiten.find((x) => x.plugin === plugin && (x.faehigkeit === faehigkeit || !faehigkeit)) || z.faehigkeiten.find((x) => x.plugin === plugin);
  if (!f) throw new Error(`Das Plugin „${plugin}“ steht nicht zur Verfügung (installiert? Fähigkeit „${faehigkeit}“?).`);
  status(`${f.name} arbeitet für Launchpad …`);
  const art = await lyra.fusion.nutzen(f.plugin, f.faehigkeit, { anweisung, aufgabe: `${p.name}: ${a.titel}`, lehrer: z.lehrer }, (x) => { if (x.art === 'hinweis' && x.text) status(`${f.name}: ${x.text}`); });
  if (!art || !text(art.markdown)) throw new Error(`${f.name} hat kein Ergebnis geliefert.`);
  let pfad = `ergebnisse/${slug(f.plugin + '-' + (art.titel || anweisung))}.md`;
  for (let i = 2; z.dateien[pfad] !== undefined && i < 50; i++) pfad = `ergebnisse/${slug(f.plugin + '-' + (art.titel || anweisung))}-${i}.md`;
  const quellen = (art.quellen || []).map((q) => `- [${q.titel}](${q.url})`).join('\n');
  dateiSetzen(pfad, `# ${art.titel || f.titel}\n\n_Von ${f.name} (${f.titel})_\n\n${art.markdown}\n${quellen ? `\n## Quellen\n${quellen}\n` : ''}`);
  await dateienSichern();
  return { pfad, art, f };
}

/** Eine Aufgabe von Launchpad erledigen lassen – Schritt für Schritt mit Werkzeugen, bis sie fertig und geprüft ist. */
async function erledigen(id, opt = {}) {
  const p = z.p;
  const a = aufgabe(id);
  if (!p || !a || z.laeuft) return false;
  if (!kiAufgabe(a)) return anleitung(id);
  const max = GRUENDLICH[p.einstellungen.gruendlich] ? GRUENDLICH[p.einstellungen.gruendlich][1] : 14;
  z.laeuft = { art: 'agent', aufgabe: a.id };
  z.stopp = false;
  z.fehler = null;
  z.live = '';
  if (!opt.fusion) { z.auswahl = a.id; }
  a.status = 'arbeit';
  a.laeufe = (a.laeufe || 0) + 1;
  a.frage = '';
  const nacharbeit = text(opt.nacharbeit);
  protokollieren('start', nacharbeit ? `Nacharbeit: ${a.titel}` : `Beginnt: ${a.titel}`, nacharbeit || a.beschreibung, { aufgabe: a.id });
  await sichern(p);
  zeichnen();
  const verlauf = [];
  const beruehrt = new Set(a.dateien || []);
  let lief = false, testsGruen = null, ablehnungen = 0, hinweis = '';
  const wiederholt = new Map();
  let ergebnis = null;
  try {
    for (let nr = 1; nr <= max; nr++) {
      if (z.stopp) break;
      status(`Schritt ${nr} von höchstens ${max}: überlegt, was als Nächstes kommt …`);
      const s = await naechsterSchritt(p, a, verlauf, nr, max, { nacharbeit, ohneRueckfragen: !!opt.ohneRueckfragen, hinweis });
      hinweis = '';
      if (z.stopp) break;
      const abw = text(s.abwaegung);
      const schluessel = `${s.aktion}|${pfadSauber(s.datei)}|${text(s.start)}|${text(s.anweisung).slice(0, 80)}|${stand}`;
      wiederholt.set(schluessel, (wiederholt.get(schluessel) || 0) + 1);
      if (wiederholt.get(schluessel) >= 3 && s.aktion !== 'datei_schreiben') {
        hinweis = 'Du wiederholst denselben Schritt. Mach etwas anderes oder melde "fertig" mit einem ehrlichen Bericht.';
        verlauf.push({ aktion: s.aktion, ziel: s.datei || s.start, ergebnis: 'Übersprungen – derselbe Schritt kam schon mehrfach.' });
        protokollieren('korrektur', `Wiederholung übersprungen: ${s.aktion}`, '', { aufgabe: a.id });
        continue;
      }
      const ziel = pfadAus(s.datei, s.start) || text(s.plugin) || '';
      if (abw) protokollieren('denken', abw.slice(0, 200), `${abw}\n\n→ ${s.aktion}${ziel ? ' ' + ziel : ''}`, { aufgabe: a.id });
      const korrigieren = (grund) => {
        verlauf.push({ aktion: s.aktion, ziel, ergebnis: grund });
        protokollieren('korrektur', grund.slice(0, 160), `Gewählt: ${JSON.stringify(s).slice(0, 1200)}`, { aufgabe: a.id });
      };
      if (s.aktion === 'datei_schreiben') {
        // Kleine Modelle schreiben dieselbe Datei gern immer wieder neu, ohne sie zu prüfen: dann erst ausführen
        const pf = pfadAus(s.datei, s.start, s.anweisung, s.text);
        const vorige = verlauf[verlauf.length - 1];
        if (pf && vorige && vorige.aktion === 'datei_schreiben' && vorige.ziel === pf && SPRACHE_VON_ENDUNG[endung(pf)] && z.dateien[pf] !== undefined) {
          const istTest = /^test[^/]*\.py$/.test(pf);
          s.aktion = istTest ? 'tests_ausfuehren' : 'code_ausfuehren';
          s.start = istTest ? '' : pf;
          s.datei = '';
          protokollieren('korrektur', `${pf} wurde gerade geschrieben – erst ${istTest ? 'die Tests' : 'das Programm'} ausführen, dann ändern`, '', { aufgabe: a.id });
        }
      }

      if (s.aktion === 'datei_schreiben') {
        const gewuenscht = pfadAus(s.datei, s.start, s.anweisung, s.text);
        const pfad = gewuenscht ? aehnlicheDatei(gewuenscht) : '';
        if (pfad && pfad !== gewuenscht) protokollieren('korrektur', `„${gewuenscht}“ ist fast gleich wie „${pfad}“ – die vorhandene Datei wird geändert`, '', { aufgabe: a.id });
        if (!pfad) {
          korrigieren(`Kein gültiger Dateiname in "datei" (z. B. "pruefe_daten.py"). Erlaubt: a–z, 0–9, _ - . / und eine Endung wie ${ENDUNGEN.slice(0, 8).join(', ')}.`);
          continue;
        }
        status(`Schreibt ${pfad} …`);
        zeichnenLive();
        const fehlerLauf = [...verlauf].reverse().find((v) => (v.aktion === 'code_ausfuehren' || v.aktion === 'tests_ausfuehren'));
        const letzterFehler = fehlerLauf && /Fehlerausgabe|Fehlgeschlagen|Zeitlimit|FAILED|Error/.test(fehlerLauf.ergebnis) ? fehlerLauf.ergebnis : '';
        const inhalt = await dateiInhalt(p, a, pfad, pfadSauber(s.anweisung) === pfad ? '' : text(s.anweisung), letzterFehler);
        const wie = dateiSetzen(pfad, inhalt);
        beruehrt.add(pfad);
        await dateienSichern();
        const syntax = await syntaxPruefen(pfad);
        protokollieren('datei', `${wie === 'neu' ? 'Angelegt' : wie === 'gleich' ? 'Unverändert' : 'Geändert'}: ${pfad}`, `${zeilenZahl(inhalt)} Zeilen, ${groesse(inhalt.length)}${syntax ? '\n' + syntax : ''}\n\n${kurz(inhalt, 1500)}`, { aufgabe: a.id, ok: !/^Achtung/.test(syntax) });
        verlauf.push({ aktion: 'datei_schreiben', ziel: pfad, ergebnis: `${wie === 'neu' ? 'angelegt' : wie === 'gleich' ? 'unverändert' : 'ersetzt'} (${zeilenZahl(inhalt)} Zeilen). ${syntax}` });
        if (SPRACHE_VON_ENDUNG[endung(pfad)]) {
          hinweis = /^test[^/]*\.py$/.test(pfad.split('/').pop())
            ? `Du hast ${pfad} geschrieben. Führe jetzt die Tests aus ("tests_ausfuehren").`
            : `Du hast ${pfad} geschrieben. Führe es jetzt aus ("code_ausfuehren", "start": "${pfad}"), bevor du es noch einmal änderst.`;
        }
      } else if (s.aktion === 'datei_lesen') {
        const pfad = pfadAus(s.datei, s.start, s.anweisung, s.text);
        const t = z.dateien[pfad];
        if (t === undefined) { korrigieren(`Datei „${pfad || '(kein Name)'}“ gibt es nicht. Vorhanden: ${Object.keys(z.dateien).slice(0, 12).join(', ') || 'keine'}.`); continue; }
        protokollieren('lesen', `Liest ${pfad}`, '', { aufgabe: a.id });
        verlauf.push({ aktion: 'datei_lesen', ziel: pfad, ergebnis: ['csv', 'tsv'].includes(endung(pfad)) && t.length > 4000
          ? `${zeilenZahl(t)} Zeilen. Anfang:\n${t.split('\n').slice(0, 15).join('\n')}\n… Ende:\n${t.trim().split('\n').slice(-5).join('\n')}`
          : `Inhalt:\n${kurz(t, gross() ? 8000 : 3500)}` });
      } else if (s.aktion === 'code_ausfuehren' || s.aktion === 'tests_ausfuehren') {
        const tests = s.aktion === 'tests_ausfuehren';
        let sprache = text(s.sprache).toLowerCase().replace('c++', 'cpp');
        let startDatei = pfadAus(s.start, s.datei, s.anweisung);
        if (startDatei && !SPRACHE_VON_ENDUNG[endung(startDatei)]) startDatei = '';
        if (!startDatei) {
          // Ohne Angabe: das zuletzt geschriebene Programm (keine Testdatei), sonst das einzige
          const zuletzt = [...verlauf].reverse().find((v) => v.aktion === 'datei_schreiben' && SPRACHE_VON_ENDUNG[endung(v.ziel || '')] && !/^test/.test(v.ziel.split('/').pop()));
          const programme = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)] && !/^test/.test(x.split('/').pop()));
          startDatei = zuletzt ? zuletzt.ziel : programme.length === 1 ? programme[0] : '';
        }
        if (!SPRACHEN[sprache]) sprache = SPRACHE_VON_ENDUNG[endung(startDatei)] || a.sprache || 'python';
        if (tests && sprache === 'python' && !Object.keys(z.dateien).some((x) => /^test[^/]*\.py$/.test(x))) {
          korrigieren('Es gibt noch keine Testdatei test_*.py im Hauptordner – schreib zuerst Tests.');
          continue;
        }
        if (!tests || sprache !== 'python') {
          if (!startDatei || z.dateien[startDatei] === undefined) {
            korrigieren(`Startdatei „${startDatei || '(leer)'}“ gibt es nicht. Programme: ${Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)]).join(', ') || 'keine'}.`);
            continue;
          }
        }
        status(tests ? 'Führt die Tests aus …' : `Führt ${startDatei} aus …`);
        const { r, neu, testErgebnis } = await codeLaufen({ sprache, start: startDatei, eingabe: s.eingabe || '', tests });
        neu.forEach((x) => beruehrt.add(x));
        lief = lief || !!r.ok;
        if (tests) { a.tests = testErgebnis; testsGruen = testErgebnis.ok; }
        const zus = codeZusammenfassung(r, neu);
        const titel = tests
          ? `Tests ${testErgebnis.ok ? 'bestanden' : 'fehlgeschlagen'}${testErgebnis.gesamt !== null ? ` (${testErgebnis.gesamt - (testErgebnis.fehlgeschlagen || 0)}/${testErgebnis.gesamt})` : ''}`
          : `${r.ok ? 'Ausgeführt' : 'Fehler'}: ${startDatei}${neu.length ? ` → ${neu.length} Datei${neu.length === 1 ? '' : 'en'}` : ''}`;
        protokollieren(tests ? 'test' : 'code', titel, zus, { aufgabe: a.id, ok: tests ? testErgebnis.ok : !!r.ok });
        verlauf.push({ aktion: s.aktion, ziel: tests && sprache === 'python' ? 'unittest' : startDatei, ergebnis: zus });
        if (r.ok && (!tests || testErgebnis.ok)) {
          hinweis = `${tests ? 'Die Tests sind grün' : `${startDatei} lief fehlerfrei`}. Vergleiche das Ergebnis mit den Abnahmekriterien. Ist alles erfüllt${a.art === 'code' && !tests && !Object.keys(z.dateien).some((x) => /^test[^/]*\.py$/.test(x)) ? ' und gibt es Tests' : ''}, melde "fertig" mit Bericht – sonst ändere gezielt, was fehlt.`;
        } else if (!r.ok) {
          hinweis = `Der Lauf ist fehlgeschlagen. Lies die Fehlerausgabe und korrigiere die betroffene Datei mit "datei_schreiben".`;
        }
      } else if (s.aktion === 'recherchieren') {
        const frage = text(s.anweisung) || text(s.text) || a.titel;
        const { pfad, notiz } = await rechercheAusfuehren(p, a, frage);
        beruehrt.add(pfad);
        protokollieren('recherche', `Recherchiert: ${frage}`, `→ ${pfad}\n\n${kurz(notiz, 2000)}`, { aufgabe: a.id, ok: true });
        verlauf.push({ aktion: 'recherchieren', ziel: frage, ergebnis: `Notiz gespeichert in ${pfad}:\n${kurz(notiz, gross() ? 3000 : 1500)}` });
      } else if (s.aktion === 'plugin_nutzen') {
        if (!p.einstellungen.plugins) { korrigieren('Andere Plugins sind in diesem Projekt abgeschaltet.'); continue; }
        try {
          const { pfad, art, f } = await pluginAusfuehren(p, a, text(s.plugin).toLowerCase(), text(s.faehigkeit), text(s.anweisung) || a.titel);
          beruehrt.add(pfad);
          protokollieren('plugin', `${f.name}: ${art.titel || f.titel}`, `→ ${pfad}\n\n${kurz(art.markdown, 1500)}`, { aufgabe: a.id, ok: true });
          verlauf.push({ aktion: 'plugin_nutzen', ziel: `${f.plugin}/${f.faehigkeit}`, ergebnis: `Ergebnis in ${pfad}:\n${kurz(art.markdown, 1500)}` });
        } catch (e) {
          if (abgebrochen(e)) throw e;
          protokollieren('fehler', `Plugin: ${meldung(e)}`, '', { aufgabe: a.id, ok: false });
          verlauf.push({ aktion: 'plugin_nutzen', ziel: s.plugin, ergebnis: 'Fehler: ' + meldung(e) });
        }
      } else if (s.aktion === 'frage_an_nutzer') {
        const frage = text(s.frage) || text(s.text);
        if (opt.ohneRueckfragen || !frage) {
          korrigieren('Rückfragen sind gerade nicht möglich – triff eine sinnvolle Annahme und dokumentiere sie.');
          continue;
        }
        a.frage = frage.slice(0, 600);
        a.status = 'blockiert';
        protokollieren('frage', 'Rückfrage an dich', frage, { aufgabe: a.id });
        ergebnis = 'frage';
        break;
      } else if (s.aktion === 'fertig') {
        const bericht = text(s.text);
        const brauchtLauf = ['code', 'daten', 'analyse'].includes(a.art);
        const nochNichts = !verlauf.some((v) => v.aktion === 'datei_schreiben' || v.aktion === 'recherchieren' || v.aktion === 'plugin_nutzen') && !nacharbeit;
        if (ablehnungen < 2 && (nochNichts || (brauchtLauf && !lief && testsGruen === null) || testsGruen === false || !bericht)) {
          ablehnungen++;
          hinweis = nochNichts ? 'Du hast noch nichts erstellt. Erledige die Aufgabe zuerst mit den Werkzeugen.'
            : testsGruen === false ? 'Die letzten Tests sind fehlgeschlagen. Korrigiere den Code und führe die Tests erneut aus.'
              : !bericht ? 'Schreib in "text" einen Abschlussbericht in Markdown.'
                : 'Du hast noch nichts ausgeführt. Führe den Code bzw. die Tests aus, bevor du "fertig" meldest.';
          korrigieren('Noch nicht fertig – ' + hinweis);
          continue;
        }
        a.bericht = bericht || 'Ohne Bericht abgeschlossen.';
        ergebnis = 'fertig';
        break;
      }
      zeichnen();
    }
    if (!ergebnis) ergebnis = z.stopp ? 'stopp' : 'limit';
    if (ergebnis === 'fertig' || ergebnis === 'limit') await abschliessen(p, a, ergebnis, verlauf, beruehrt, opt);
  } catch (e) {
    if (abgebrochen(e) || z.stopp) ergebnis = 'stopp';
    else {
      ergebnis = 'fehler';
      z.fehler = meldung(e);
      protokollieren('fehler', 'Abgebrochen wegen eines Fehlers', meldung(e), { aufgabe: a.id, ok: false });
    }
  }
  a.dateien = [...beruehrt].filter((x) => z.dateien[x] !== undefined);
  if (ergebnis === 'stopp') { a.status = 'offen'; protokollieren('stopp', 'Angehalten', 'Die bisherigen Dateien bleiben im Arbeitsbereich.', { aufgabe: a.id }); }
  if (ergebnis === 'fehler') a.status = 'offen';
  z.laeuft = null;
  z.live = '';
  protokollSichern(true);
  await sichern(p);
  if (!opt.fusion) {
    if (ergebnis === 'fertig' || ergebnis === 'limit') lyra.toast(a.status === 'erledigt' ? `Erledigt: ${a.titel}` : `Fertig zur Abnahme: ${a.titel}`, 'ok');
    else if (ergebnis === 'frage') lyra.toast('Launchpad hat eine Rückfrage an dich');
  }
  zeichnen();
  return ergebnis;
}

/** Abschluss: Tests noch einmal laufen lassen (Qualitätssicherung), Bericht ergänzen, zur Abnahme vorlegen. */
async function abschliessen(p, a, ergebnis, verlauf, beruehrt, opt) {
  const testdateien = Object.keys(z.dateien).filter((x) => /^test[^/]*\.py$/.test(x));
  let qs = '';
  if (p.einstellungen.tests && testdateien.length && (a.art === 'code' || a.sprache === 'python' || [...beruehrt].some((x) => endung(x) === 'py'))) {
    status('Qualitätssicherung: Alle Tests laufen noch einmal …');
    try {
      const { r, testErgebnis } = await codeLaufen({ sprache: 'python', start: '', tests: true, sekunden: 60 });
      a.tests = testErgebnis;
      qs = `**Qualitätssicherung (automatisch gemessen):** ${testErgebnis.ok ? '✓' : '✗'} ${testErgebnis.gesamt !== null ? `${testErgebnis.gesamt - (testErgebnis.fehlgeschlagen || 0)} von ${testErgebnis.gesamt} Tests bestanden` : testErgebnis.ok ? 'Tests bestanden' : 'Tests fehlgeschlagen'} (${testdateien.join(', ')})${testErgebnis.ok ? '' : ' – fordere Nacharbeit an oder sieh dir die Fehler im Protokoll an'}.`;
      protokollieren('test', `QS: Tests ${testErgebnis.ok ? 'bestanden' : 'fehlgeschlagen'}${testErgebnis.gesamt !== null ? ` (${testErgebnis.gesamt - (testErgebnis.fehlgeschlagen || 0)}/${testErgebnis.gesamt})` : ''}`, codeZusammenfassung(r, []), { aufgabe: a.id, ok: testErgebnis.ok });
    } catch (e) { if (abgebrochen(e)) throw e; }
  }
  if (ergebnis === 'limit') {
    status('Schreibt den Zwischenbericht …');
    try {
      const r = await lyra.ki({
        lehrer: z.lehrer, system: MITARBEITER,
        prompt: `${aufgabeKontext(p, a)}\n\nDeine Schritte:\n${verlaufText(verlauf, 6000)}\n\nGemessene Fakten (so übernehmen, nichts beschönigen):\n- Programmläufe: ${verlauf.filter((v) => v.aktion === 'code_ausfuehren').length}, Testläufe: ${verlauf.filter((v) => v.aktion === 'tests_ausfuehren').length}\n- ${a.tests ? `Letzter Testlauf: ${a.tests.gesamt !== null ? `${a.tests.gesamt - (a.tests.fehlgeschlagen || 0)} von ${a.tests.gesamt} bestanden` : a.tests.ok ? 'bestanden' : 'fehlgeschlagen'}` : 'Keine Tests gelaufen'}\n\nDie Schrittzahl ist aufgebraucht. Schreib einen ehrlichen, kurzen Zwischenbericht in Markdown: Was ist fertig (Dateien), was wurde getestet (mit den Fakten oben), was fehlt noch und was als Nächstes zu tun ist. Behaupte nichts, was nicht in den Schritten steht.`,
      }, (x) => { if (x.art === 'hinweis') status(x.text); });
      a.bericht = text(r && r.text) || 'Die Schrittzahl ist aufgebraucht.';
    } catch (e) { if (abgebrochen(e)) throw e; a.bericht = 'Die Schrittzahl ist aufgebraucht – sieh dir das Protokoll an.'; }
    a.bericht = '> Zwischenstand – die Schrittzahl war aufgebraucht. „Nacharbeiten lassen“ setzt die Arbeit fort.\n\n' + a.bericht;
  }
  // Gemessenes zuerst – unabhängig davon, was das Modell schreibt
  if (qs) a.bericht = `${qs}\n\n${a.bericht}`;
  const dateien = [...beruehrt].filter((x) => z.dateien[x] !== undefined);
  if (dateien.length) a.bericht += `\n\n**Dateien:** ${dateien.map((x) => '`' + x + '`').join(', ')}`;
  const auto = (opt.fusion || p.einstellungen.autoAbnahme) && ergebnis === 'fertig' && (!a.tests || a.tests.ok);
  a.status = auto ? 'erledigt' : 'pruefung';
  if (auto) a.erledigtAm = lyra.jetzt();
  protokollieren('fertig', auto ? `Erledigt: ${a.titel}` : `Zur Abnahme: ${a.titel}`, a.bericht, { aufgabe: a.id, ok: true });
}

function anhalten() {
  z.stopp = true;
  if (z.autopilot) z.autopilot = null;
  status('Hält nach diesem Schritt an …');
  lyra.abbrechen().catch(() => {});
}

async function abnehmen(id) {
  const a = aufgabe(id);
  if (!a) return;
  a.status = 'erledigt';
  a.erledigtAm = lyra.jetzt();
  protokollieren('abnahme', `Abgenommen: ${a.titel}`, '', { aufgabe: a.id, ok: true });
  await sichern();
  const p = z.p;
  if (p.aufgaben.every((x) => x.status === 'erledigt')) lyra.toast('Alle Aufgaben erledigt – Projekt abgeschlossen!', 'ok');
  else lyra.toast('Abgenommen', 'ok');
  if (p.erinnern) erinnerungenSetzen();
  zeichnen();
}

async function statusSetzen(id, s) {
  const a = aufgabe(id);
  if (!a || a.status === s || (z.laeuft && z.laeuft.aufgabe === id)) return;
  const alt = a.status;
  a.status = s;
  a.erledigtAm = s === 'erledigt' ? lyra.jetzt() : null;
  protokollieren('nutzer', `Status geändert: ${STATUS[alt][0]} → ${STATUS[s][0]}`, a.titel, { aufgabe: a.id });
  await sichern();
  zeichnen();
}

async function antworten(id) {
  const a = aufgabe(id);
  const t = text(z.antwort);
  if (!a || !t) return;
  a.antworten = [...(a.antworten || []), { frage: a.frage, antwort: t }].slice(-8);
  protokollieren('antwort', 'Deine Antwort', `${a.frage}\n→ ${t}`, { aufgabe: a.id });
  a.frage = '';
  a.status = 'offen';
  z.antwort = '';
  await sichern();
  await erledigen(id);
}

async function nacharbeiten(id) {
  const t = text(z.nacharbeit);
  if (!t) return;
  z.nacharbeit = '';
  await erledigen(id, { nacharbeit: t });
}

/** Für Aufgaben, die nur du erledigen kannst: eine Schritt-für-Schritt-Anleitung. */
async function anleitung(id) {
  const a = aufgabe(id);
  if (!a || z.laeuft) return;
  z.laeuft = { art: 'anleitung', aufgabe: id };
  z.fehler = null;
  z.auswahl = id;
  status('Schreibt eine Anleitung für dich …');
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM,
      prompt: `${aufgabeKontext(z.p, a)}\n\nDiese Aufgabe muss ich selbst erledigen. Gib mir eine konkrete Anleitung in Markdown: 3–7 nummerierte Schritte, \
typische Stolpersteine und – wenn passend – eine Vorlage (z. B. eine Nachricht zum Kopieren). Höchstens 350 Wörter.`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    a.bericht = text(r && r.text);
    protokollieren('notiz', `Anleitung: ${a.titel}`, a.bericht, { aufgabe: a.id });
    await sichern();
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

/** Autopilot: mehrere Aufgaben nacheinander – erst nach deiner Bestätigung. */
async function autopilot() {
  const p = z.p;
  if (!p || z.laeuft) return;
  const liste = naechste(p).filter(kiAufgabe).slice(0, 6);
  if (!liste.length) return lyra.toast('Keine offenen Aufgaben für Launchpad');
  const n = { v: Math.min(3, liste.length) };
  const zeilen = h('div', { class: 'lp-dialog-liste' });
  const malen = () => zeilen.replaceChildren(...liste.map((a, i) => h('div', { class: 'lp-dialog-zeile' + (i < n.v ? ' an' : '') }, h('span', { class: 'lp-nr' }, String(i + 1)), h('span', { class: 'wachsen' }, a.titel), artMarke(a.art))));
  malen();
  const anzahl = h('input', { type: 'range', min: 1, max: liste.length, value: n.v, class: 'lp-regler' });
  const anzeige = h('b', {}, String(n.v));
  anzahl.addEventListener('input', () => { n.v = +anzahl.value; anzeige.textContent = String(n.v); malen(); });
  const ok = await lyra.dialog('Autopilot starten', h('div', { style: { maxWidth: '480px' } },
    h('p', { class: 'leise', style: { lineHeight: 1.5, marginBottom: '12px' } }, 'Launchpad erledigt die nächsten Aufgaben nacheinander – mit Dateien, Code, Tests und Recherche im Arbeitsbereich dieses Projekts. Jedes Ergebnis legt es dir zur Abnahme vor. Bei einer Rückfrage hält es an. Du kannst jederzeit stoppen.'),
    h('div', { class: 'zeile', style: { marginBottom: '8px' } }, h('span', { class: 'wachsen' }, 'Aufgaben: ', anzeige), anzahl),
    zeilen), [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Autopilot starten', wert: true }]);
  if (!ok) return;
  z.autopilot = { liste: liste.slice(0, n.v).map((a) => a.id), i: 0 };
  protokollieren('nutzer', `Autopilot gestartet (${n.v} Aufgaben)`, liste.slice(0, n.v).map((a) => '- ' + a.titel).join('\n'));
  while (z.autopilot && z.autopilot.i < z.autopilot.liste.length) {
    const id = z.autopilot.liste[z.autopilot.i];
    z.autopilot.i++;
    const a = aufgabe(id);
    if (!a || a.status !== 'offen') continue;
    const r = await erledigen(id);
    if (r === 'frage' || r === 'stopp' || r === 'fehler') break;
  }
  const fertig = z.autopilot ? z.autopilot.i : 0;
  z.autopilot = null;
  if (fertig) lyra.toast('Autopilot beendet – sieh dir die Ergebnisse an', 'ok');
  zeichnen();
}

// ================================================================== Aufgaben bearbeiten, Coach

async function aufgabeDialog(id) {
  const p = z.p;
  const a = id ? aufgabe(id) : null;
  const feld = (wert, ph, zeilen) => {
    const f = zeilen ? h('textarea', { class: 'eingabe', rows: zeilen, placeholder: ph }) : h('input', { class: 'eingabe', placeholder: ph });
    f.value = wert || '';
    return f;
  };
  const titel = feld(a && a.titel, 'z. B. CSV-Import mit Tests schreiben');
  const beschreibung = feld(a && a.beschreibung, 'Was genau soll entstehen? Umfang, Format, Besonderheiten …', 3);
  const kriterien = feld(a ? a.kriterien.join('\n') : '', 'Ein Abnahmekriterium pro Zeile, z. B. „Alle Tests grün“', 3);
  const wahl = (werte, aktuell) => { const s = h('select', { class: 'eingabe' }, werte.map(([w, n]) => h('option', { value: w }, n))); s.value = aktuell; return s; };
  const art = wahl(Object.entries(ARTEN).map(([k, v]) => [k, `${v[0]} – ${v[1]}`]), a ? a.art : 'code');
  const sprache = wahl([['', '—'], ...Object.entries(SPRACHEN).map(([k, v]) => [k, v[0]])], a ? a.sprache : 'python');
  const prio = wahl(Object.entries(PRIO).map(([k, v]) => [k, v[0]]), a ? a.prioritaet : 'mittel');
  const phase = wahl(p.abschnitte.map((s) => [s.id, s.titel]), a ? a.abschnitt : (z.phase || p.abschnitte[0].id));
  const zeile = (name, el) => h('label', { class: 'lp-feld' }, h('span', {}, name), el);
  const w = await lyra.dialog(a ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', h('div', { class: 'lp-formular' },
    zeile('Titel', titel), zeile('Beschreibung', beschreibung), zeile('Abnahmekriterien', kriterien),
    h('div', { class: 'lp-formular-raster' }, zeile('Art', art), zeile('Sprache', sprache), zeile('Priorität', prio), zeile('Phase', phase))), [
    { text: 'Abbrechen', art: 'text', wert: null },
    { text: a ? 'Speichern' : 'Anlegen', wert: () => ({ titel: text(titel.value), beschreibung: text(beschreibung.value), kriterien: kriterien.value.split('\n').map(text).filter(Boolean), art: art.value, sprache: sprache.value, prioritaet: prio.value, abschnitt: phase.value }) },
  ]);
  if (!w || !w.titel) return;
  if (a) {
    Object.assign(a, w, { titel: w.titel.slice(0, 140), kriterien: w.kriterien.slice(0, 8) });
    protokollieren('nutzer', `Aufgabe bearbeitet: ${a.titel}`, '', { aufgabe: a.id });
  } else {
    const neu = aufgabeAus({ ...w, abschnitt: p.abschnitte.findIndex((s) => s.id === w.abschnitt) + 1, minuten: 30 }, p.abschnitte);
    p.aufgaben.push(neu);
    protokollieren('nutzer', `Aufgabe angelegt: ${neu.titel}`, '', { aufgabe: neu.id });
    z.auswahl = neu.id;
  }
  await sichern();
  zeichnen();
}

async function aufgabeLoeschen(id) {
  const a = aufgabe(id);
  if (!a) return;
  if (!(await lyra.bestaetigen({ titel: 'Aufgabe löschen?', text: `„${a.titel}“ wird aus dem Plan entfernt. Dateien im Arbeitsbereich bleiben.`, ja: 'Löschen', gefahr: true }))) return;
  z.p.aufgaben = z.p.aufgaben.filter((x) => x.id !== id);
  protokollieren('nutzer', `Aufgabe gelöscht: ${a.titel}`, '');
  z.auswahl = null;
  await sichern();
  zeichnen();
}

async function coachFragen() {
  const p = z.p;
  const t = text(z.coach.text);
  if (!t || z.laeuft) return;
  z.laeuft = { art: 'coach' };
  z.fehler = null;
  status('Launchpad schaut sich den Projektstand an …');
  zeichnen();
  const stand = p.abschnitte.map((s, i) => `${i + 1}. ${s.titel}${s.bis ? ` (bis ${s.bis})` : ''}: ${p.aufgaben.filter((a) => a.abschnitt === s.id).map((a) => `[${STATUS[a.status][0]}] ${a.titel}`).join('; ')}`).join('\n');
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: COACH_SCHEMA,
      prompt: `Heute ist ${heuteIso()}.\n${projektKontext(p)}\nStand:\n${stand}\nArbeitsbereich: ${Object.keys(z.dateien).length} Dateien\n\nMein Check-in: „${t}“\n\n"antwort": ehrliches, \
konstruktives Feedback in 2–4 Sätzen mit einem konkreten Rat. "vorschlaege": 0 bis 3 neue Aufgaben, die jetzt helfen – je "begruendung" (1 Satz) und \
"aufgabe" wie im Plan ("abschnitt" = Nummer der Phase oben). Plugins:\n${faehigkeitenListe()}\n\nAntwort als JSON: {"antwort": "", "vorschlaege": [{"aufgabe": \
{"abschnitt": 1, "art": "code", "beschreibung": "", "kriterien": [""], "minuten": 30, "prioritaet": "mittel", "sprache": "", "titel": ""}, "begruendung": ""}]}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const j = (r && r.json) || {};
    z.coach.antwort = text(j.antwort);
    z.coach.vorschlaege = (j.vorschlaege || []).map((v) => ({ aufgabe: aufgabeAus(v && v.aufgabe, p.abschnitte), begruendung: text(v && v.begruendung) })).filter((v) => v.aufgabe).slice(0, 3);
    p.verlauf = [...(p.verlauf || []), { zeit: lyra.jetzt(), checkin: t, antwort: z.coach.antwort }].slice(-30);
    protokollieren('notiz', 'Check-in mit dem Coach', `${t}\n\n${z.coach.antwort}`);
    await sichern(p);
    z.coach.text = '';
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = null;
  zeichnen();
}

async function vorschlagUebernehmen(i) {
  const v = z.coach.vorschlaege[i];
  if (!v) return;
  z.p.aufgaben.push(v.aufgabe);
  z.coach.vorschlaege.splice(i, 1);
  protokollieren('nutzer', `Vorschlag übernommen: ${v.aufgabe.titel}`, v.begruendung, { aufgabe: v.aufgabe.id });
  await sichern();
  lyra.toast('Aufgabe übernommen', 'ok');
  zeichnen();
}

// ================================================================== Dateien (vom Nutzer)

async function dateiNeu() {
  const f = h('input', { class: 'eingabe', placeholder: 'z. B. notizen.md oder src/app.py' });
  const w = await lyra.dialog('Neue Datei', h('div', { style: { minWidth: '340px' } }, f, h('div', { class: 'klein leise', style: { marginTop: '6px' } }, `Erlaubte Endungen: ${ENDUNGEN.slice(0, 14).join(', ')} …`)), [
    { text: 'Abbrechen', art: 'text', wert: null }, { text: 'Anlegen', wert: () => f.value }]);
  const pfad = pfadSauber(w);
  if (!w) return;
  if (!pfad) return lyra.toast('Ungültiger Dateiname', 'fehler');
  if (z.dateien[pfad] !== undefined) return lyra.toast('Die Datei gibt es schon', 'fehler');
  try { dateiSetzen(pfad, ''); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  protokollieren('nutzer', `Datei angelegt: ${pfad}`, '');
  await dateienSichern();
  z.datei = pfad; z.editor = ''; z.reiter = 'dateien';
  zeichnen();
}

async function dateiImport() {
  let d = null;
  try { d = await lyra.dateiOeffnen({ arten: ['csv', 'tsv', 'txt', 'md', 'json', 'xlsx'], titel: 'Daten' }); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  if (!d) return;
  const inhalt = d.art === 'tabelle'
    ? (d.zeilen || []).map((z1) => z1.map((c) => { const s = String(c ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n') + '\n'
    : String(d.text || '');
  const name = String(d.name || 'import').replace(/\.[^.]+$/, '');
  const pfad = pfadSauber(`daten/${slug(name)}.${d.art === 'tabelle' ? 'csv' : (ENDUNGEN.includes(d.endung) ? d.endung : 'txt')}`);
  try { dateiSetzen(pfad, inhalt); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  protokollieren('nutzer', `Importiert: ${pfad}`, `${groesse(z.dateien[pfad].length)}, ${zeilenZahl(z.dateien[pfad])} Zeilen`);
  await dateienSichern();
  z.datei = pfad; z.reiter = 'dateien';
  lyra.toast('Importiert – Launchpad kann jetzt damit arbeiten', 'ok');
  zeichnen();
}

async function dateiLoeschen(pfad) {
  if (!(await lyra.bestaetigen({ titel: 'Datei löschen?', text: `„${pfad}“ wird aus dem Arbeitsbereich gelöscht.`, ja: 'Löschen', gefahr: true }))) return;
  delete z.dateien[pfad];
  stand++;
  z.p.aufgaben.forEach((a) => { a.dateien = a.dateien.filter((x) => x !== pfad); });
  protokollieren('nutzer', `Datei gelöscht: ${pfad}`, '');
  await dateienSichern();
  await sichern();
  if (z.datei === pfad) { z.datei = null; z.editor = null; }
  zeichnen();
}

async function editorSichern() {
  if (z.editor === null || !z.datei) return;
  try { dateiSetzen(z.datei, z.editor); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  protokollieren('nutzer', `Du hast ${z.datei} bearbeitet`, `${zeilenZahl(z.editor)} Zeilen`);
  await dateienSichern();
  z.editor = null;
  lyra.toast('Gesichert', 'ok');
  zeichnen();
}

async function dateiAusfuehren(pfad, tests = false) {
  if (z.laeuft) return;
  const sprache = tests ? 'python' : SPRACHE_VON_ENDUNG[endung(pfad)];
  if (!sprache) return;
  z.laeuft = { art: 'code' };
  z.ausgabe = null;
  status(tests ? 'Führt alle Tests aus …' : `Führt ${pfad} aus …`);
  zeichnen();
  try {
    const { r, neu, testErgebnis } = await codeLaufen({ sprache, start: pfad, tests });
    z.ausgabe = { pfad: tests ? 'Tests' : pfad, r, neu, testErgebnis };
    protokollieren(tests ? 'test' : 'code', tests ? `Du hast die Tests ausgeführt: ${testErgebnis.ok ? 'bestanden' : 'fehlgeschlagen'}` : `Du hast ${pfad} ausgeführt`, codeZusammenfassung(r, neu), { ok: tests ? testErgebnis.ok : !!r.ok });
  } catch (e) {
    if (!abgebrochen(e)) z.ausgabe = { pfad, r: { ok: false, ausgabe: '', fehler: meldung(e), code: -1, dauerMs: 0 }, neu: [] };
  }
  z.laeuft = null;
  zeichnen();
}

async function exportieren() {
  const p = z.p;
  if (!p) return;
  const dateien = { ...z.dateien };
  dateien['LAUNCHPAD-PROJEKT.md'] = projektMarkdown(p);
  dateien['LAUNCHPAD-PROTOKOLL.md'] = protokollMarkdown(p);
  (p.berichte || []).forEach((b) => { dateien[`berichte/${slug(b.titel)}-${b.id.slice(-4)}.md`] = b.markdown; });
  try {
    const ort = await lyra.ordnerSichern(dateiname(p.name), dateien);
    if (ort) { protokollieren('nutzer', 'Projekt exportiert', `${Object.keys(dateien).length} Dateien → ${ort.split('/').slice(-2).join('/')}`); lyra.toast(`Exportiert: ${Object.keys(dateien).length} Dateien`, 'ok'); }
  } catch (e) { lyra.toast(meldung(e), 'fehler'); }
}

// ================================================================== Berichte

function projektMarkdown(p) {
  const zeilen = [`# ${p.name}`, '', p.vision ? `> ${p.vision}` : '', '', `**Ziel:** ${p.ziel}`, '', `**Stand:** ${Math.round(fortschritt(p) * 100)} % · ${p.aufgaben.filter((a) => a.status === 'erledigt').length} von ${p.aufgaben.length} Aufgaben erledigt`, ''];
  if (p.erfolg.length) zeilen.push('## Erfolgskriterien', ...p.erfolg.map((e) => `- ${e}`), '');
  p.abschnitte.forEach((s, i) => {
    zeilen.push(`## Phase ${i + 1}: ${s.titel}${s.bis ? ` (bis ${deDatum(s.bis)})` : ''}`, '');
    p.aufgaben.filter((a) => a.abschnitt === s.id).forEach((a) => {
      zeilen.push(`### ${a.status === 'erledigt' ? '✅' : '⬜️'} ${a.titel}`, '', `_${ARTEN[a.art][0]} · ${STATUS[a.status][0]} · Priorität ${PRIO[a.prioritaet][0]}${a.tests ? ` · Tests: ${a.tests.ok ? 'bestanden' : 'fehlgeschlagen'}` : ''}_`, '');
      if (a.beschreibung) zeilen.push(a.beschreibung, '');
      if (a.kriterien.length) zeilen.push('**Abnahmekriterien:**', ...a.kriterien.map((k) => `- ${k}`), '');
      if (a.bericht) zeilen.push('**Bericht:**', '', a.bericht, '');
    });
  });
  if (p.risiken.length) zeilen.push('## Risiken', ...p.risiken.map((r) => `- **${r.risiko}** → ${r.gegenmittel}`), '');
  zeilen.push('## Arbeitsbereich', ...Object.keys(z.dateien).sort().map((x) => `- \`${x}\` (${groesse(z.dateien[x].length)})`), '', '---', '_Erstellt mit Launchpad in Lyra._');
  return zeilen.join('\n');
}

function protokollMarkdown(p) {
  const name = (id) => { const a = p.aufgaben.find((x) => x.id === id); return a ? a.titel : ''; };
  return [`# Protokoll: ${p.name}`, '', ...z.protokoll.map((e) => `- **${uhrzeit(e.zeit)}** · ${e.titel}${e.aufgabe && name(e.aufgabe) ? ` _(${name(e.aufgabe)})_` : ''}${e.text ? '\n\n  ' + e.text.slice(0, 1500).split('\n').join('\n  ') + '\n' : ''}`)].join('\n');
}

async function berichtErstellen(art) {
  const p = z.p;
  if (!p || z.laeuft) return;
  z.laeuft = { art: 'bericht' };
  z.fehler = null;
  status(art === 'doku' ? 'Schreibt die Projektdokumentation …' : 'Schreibt den Statusbericht …');
  zeichnen();
  const stand = p.abschnitte.map((s) => `Phase „${s.titel}“${s.bis ? ` bis ${s.bis}` : ''}:\n${p.aufgaben.filter((a) => a.abschnitt === s.id).map((a) => `- [${STATUS[a.status][0]}] ${a.titel}${a.tests ? ` (Tests ${a.tests.ok ? 'grün' : 'rot'})` : ''}${a.bericht ? `\n  Bericht: ${kurz(a.bericht.replace(/\n+/g, ' '), 600)}` : ''}`).join('\n')}`).join('\n');
  const letzte = z.protokoll.slice(-25).map((e) => `- ${uhrzeit(e.zeit)} ${e.titel}`).join('\n');
  try {
    let prompt;
    if (art === 'doku') {
      const code = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)]).slice(0, 12).map((x) => `--- ${x} ---\n${kurz(z.dateien[x], gross() ? 5000 : 1800)}`).join('\n\n');
      prompt = `${projektKontext(p)}\n\nStand:\n${stand}\n\nDateien:\n${arbeitsbereichListe(80)}\n\n${code ? `Code (Auszüge):\n${code}\n\n` : ''}Schreib die README.md des Projekts in Markdown: \
Titel, Kurzbeschreibung, Funktionen, Projektstruktur (Dateibaum mit je einer Zeile Erklärung), Installation und Bedienung (konkrete Befehle, z. B. \
„python3 main.py“), Tests (wie ausführen, letztes Ergebnis), Daten (welche Dateien, Aufbau), Annahmen und Grenzen, nächste Schritte. Nur Fakten aus dem Stand oben.`;
    } else {
      prompt = `Heute ist ${deDatum(heuteIso())}.\n${projektKontext(p)}\nErfolgskriterien: ${p.erfolg.join('; ')}\n\nStand:\n${stand}\n\nLetzte Aktivitäten:\n${letzte}\n\nSchreib einen Statusbericht \
in Markdown wie für eine Projektleitung: „## Zusammenfassung“ (3 Sätze, Ampel 🟢/🟡/🔴 mit Begründung), „## Erledigt“, „## In Arbeit und offen“, \
„## Ergebnisse und Qualität“ (Tests, Dateien), „## Risiken und Blocker“, „## Nächste Schritte“ (3–5, konkret). Sachlich, keine Floskeln.`;
    }
    const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const md = text(r && r.text);
    if (!md) throw new Error('Es kam kein Bericht zurück.');
    const b = { id: neueId(), art, titel: art === 'doku' ? 'Projektdokumentation (README)' : `Statusbericht ${new Date().toLocaleDateString('de-DE')}`, zeit: lyra.jetzt(), markdown: md };
    p.berichte = [b, ...(p.berichte || [])].slice(0, 30);
    if (art === 'doku') {
      const vorhanden = z.dateien['README.md'] !== undefined;
      if (!vorhanden || await lyra.bestaetigen({ titel: 'README.md ersetzen?', text: 'Im Arbeitsbereich gibt es schon eine README.md. Soll die neue Dokumentation sie ersetzen? Der Bericht bleibt so oder so unter „Berichte“.', ja: 'Ersetzen' })) {
        dateiSetzen('README.md', md + '\n');
        await dateienSichern();
      }
    }
    protokollieren('bericht', b.titel, kurz(md, 1500));
    z.bericht = b.id;
    await sichern(p);
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = meldung(e);
  }
  z.laeuft = null;
  zeichnen();
}

// ================================================================== Ansicht

let letzterOrt = '', letzteAuswahl = null, letzteDatei = null;
function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const auswahl = feld && aktiv.selectionStart !== undefined ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const scroll = {};
  document.querySelectorAll('[data-scroll]').forEach((e) => { scroll[e.dataset.scroll] = e.scrollTop; });
  // Neue Ansicht (anderes Projekt, anderer Reiter, andere Datei): oben beginnen
  const ort = `${z.ansicht}|${z.p ? z.p.id : ''}|${z.reiter}`;
  if (ort !== letzterOrt) { delete scroll.haupt; delete scroll.viewer; letzterOrt = ort; }
  if (z.auswahl !== letzteAuswahl) { delete scroll.panel; letzteAuswahl = z.auswahl; }
  if (z.datei !== letzteDatei) { delete scroll.viewer; letzteDatei = z.datei; }
  app.replaceChildren(layout());
  document.querySelectorAll('[data-scroll]').forEach((e) => { if (scroll[e.dataset.scroll]) e.scrollTop = scroll[e.dataset.scroll]; });
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (auswahl && e.setSelectionRange) { try { e.setSelectionRange(auswahl[0], auswahl[1]); } catch (_) {} } }
  const feed = document.getElementById('live-feed');
  if (feed) feed.scrollTop = feed.scrollHeight;
  lyra.titel(z.ansicht === 'projekt' && z.p ? z.p.name : '');
}

/** Während eine Datei entsteht: nur den Live-Bereich neu zeichnen (nicht die ganze Seite). */
function zeichnenLive() {
  const el = document.getElementById('live-inhalt');
  if (el) el.textContent = '';
  else zeichnen();
}

function layout() {
  return h('div', { class: 'lp' },
    leiste(),
    h('main', { class: 'lp-haupt', 'data-scroll': 'haupt' },
      z.ansicht === 'fragen' ? fragenAnsicht() : z.ansicht === 'projekt' && z.p ? projektAnsicht(z.p) : startAnsicht()),
    z.ansicht === 'projekt' && z.p && z.auswahl && aufgabe(z.auswahl) ? aufgabePanel(z.p, aufgabe(z.auswahl)) : null);
}

function leiste() {
  return h('aside', { class: 'lp-leiste' },
    h('div', { class: 'lp-marke' }, h('div', { class: 'lp-logo' }, ic('rakete', 18)), h('div', {}, h('div', { class: 'fett' }, 'Launchpad'), h('div', { class: 'lp-mini' }, 'KI-Mitarbeiter für Projekte'))),
    h('button', { class: 'lp-neu', disabled: !!z.laeuft, onclick: () => { z.ansicht = 'start'; z.auswahl = null; zeichnen(); } }, ic('plus', 15), 'Neues Projekt'),
    h('div', { class: 'lp-label' }, `Projekte${z.liste.length ? ' · ' + z.liste.length : ''}`),
    h('nav', { class: 'lp-projekte', 'data-scroll': 'leiste' }, z.liste.length ? z.liste.map((x) =>
      h('div', {
        class: 'lp-projekt' + (z.p && z.p.id === x.id && z.ansicht === 'projekt' ? ' an' : ''), tabindex: 0,
        onclick: async () => { if (z.laeuft) return lyra.toast('Launchpad arbeitet gerade – halte erst an.'); await oeffnen(x.id); z.reiter = 'uebersicht'; zeichnen(); },
      },
      h('div', { class: 'wachsen' },
        h('div', { class: 'lp-projekt-name' }, x.name),
        h('div', { class: 'lp-projekt-balken' }, h('div', { style: { width: `${Math.round((x.fortschritt || 0) * 100)}%` } }))),
      x.wartet ? h('span', { class: 'lp-zaehler', title: 'Wartet auf dich' }, String(x.wartet)) : h('span', { class: 'lp-prozent' }, `${Math.round((x.fortschritt || 0) * 100)}%`))) : h('div', { class: 'lp-mini', style: { padding: '6px 10px' } }, 'Noch keine Projekte')),
    h('div', { class: 'lp-leiste-fuss' }, z.info ? lyra.lehrerWahl(z.info, z.lehrer, lehrerWaehlen, { web: true, wiki: true }) : null));
}

function artMarke(art) {
  return h('span', { class: 'lp-art lp-art-' + art }, ic(ARTEN[art][2], 12), ARTEN[art][0]);
}
function statusMarke(s) {
  return h('span', { class: 'lp-status lp-s-' + STATUS[s][1] }, STATUS[s][0]);
}

function startAnsicht() {
  const vorlagen = h('div', { class: 'lp-vorlagen' }, VORLAGEN.map(([art, titel, t]) =>
    h('button', { class: 'lp-vorlage', onclick: () => { z.idee = t; zeichnen(); const f = document.querySelector('[data-feld="idee"]'); if (f) f.focus(); } },
      h('div', { class: 'lp-vorlage-kopf' }, ic(ARTEN[art][2], 15), h('span', {}, titel)),
      h('div', { class: 'lp-vorlage-text' }, t))));
  return h('div', { class: 'lp-start' },
    h('div', { class: 'lp-start-kopf' },
      h('div', { class: 'lp-eyebrow' }, 'Neues Projekt'),
      h('h1', {}, 'Was soll umgesetzt werden?'),
      h('p', { class: 'leise' }, 'Beschreib dein Vorhaben. Launchpad plant es in Phasen und Arbeitspakete – und erledigt sie dann wie ein Mitarbeiter: Code mit Tests, Datensätze, Recherchen und Dokumente, jeder Schritt protokolliert. Du nimmst die Ergebnisse ab.')),
    lyra.verfasser({
      wert: z.idee,
      platzhalter: 'z. B. „Ein Python-Tool, das meine Kontoauszüge als CSV auswertet – mit Tests“',
      beiEingabe: (v) => { z.idee = v; },
      beiSenden: rueckfragen,
      knopf: 'Projekt planen',
      deaktiviert: !!z.laeuft,
      feld: 'idee',
      zeilen: 3,
    }),
    z.laeuft ? lyra.arbeit(z.status) : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; rueckfragen(z.idee); }) : null,
    z.liste.length ? h('div', { class: 'lp-nur-schmal' }, h('div', { class: 'lp-label', style: { margin: '22px 0 8px' } }, 'Deine Projekte'),
      z.liste.map((x) => h('div', { class: 'lp-zeile klickbar', onclick: async () => { if (await oeffnen(x.id)) zeichnen(); } }, h('span', { class: 'fett wachsen' }, x.name), h('span', { class: 'lp-prozent' }, `${Math.round((x.fortschritt || 0) * 100)}%`)))) : null,
    h('div', { class: 'lp-label', style: { margin: '26px 0 10px' } }, 'Vorlagen'),
    vorlagen,
    h('div', { class: 'lp-faehig' },
      [['code', 'Code & Tests', 'Python, Java, C, C++, Swift, Ruby – ausgeführt in einer Sandbox ohne Netz'], ['datei', 'Daten', 'Große Datensätze per Skript, geprüft und ausgewertet'],
        ['suche', 'Recherche', 'Mit Websuche (Claude/ChatGPT) oder Wikipedia & Co.'], ['plugin', 'Team', (() => { const n = new Set(z.faehigkeiten.map((f) => f.plugin)).size; return n === 1 ? '1 weiteres Plugin arbeitet mit' : n ? `${n} weitere Plugins arbeiten mit` : 'Andere Plugins arbeiten mit'; })()],
        ['bericht', 'Dokumentation', 'Protokoll, Statusbericht, README, Export als Ordner']].map(([i, t, u]) =>
        h('div', { class: 'lp-faehig-eintrag' }, ic(i, 18), h('div', {}, h('div', { class: 'fett' }, t), h('div', { class: 'lp-mini' }, u))))));
}

function fragenAnsicht() {
  return h('div', { class: 'lp-start' },
    h('div', { class: 'lp-start-kopf' },
      h('div', { class: 'lp-eyebrow' }, 'Briefing'),
      h('h1', {}, 'Kurz nachgefragt'),
      h('p', { class: 'leise' }, `„${z.idee}“ – je genauer, desto besser der Plan. Alles optional.`)),
    h('div', { class: 'lp-fragen' }, z.fragen.map((f, i) => {
      const feld = h('input', { class: 'eingabe', 'data-feld': 'f' + i, placeholder: 'Eigene Antwort …', value: f.antwort });
      feld.addEventListener('input', () => { f.antwort = feld.value; });
      return h('div', { class: 'lp-karte' },
        h('div', { class: 'fett' }, `${i + 1}. ${f.frage}`),
        h('div', { class: 'zeile umbruch', style: { gap: '6px', margin: '10px 0' } }, f.vorschlaege.map((v) =>
          h('button', { class: 'lp-chip' + (f.antwort === v ? ' an' : ''), onclick: () => { f.antwort = f.antwort === v ? '' : v; zeichnen(); } }, v))),
        feld);
    })),
    z.laeuft ? lyra.arbeit(z.status) : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; planen(); }) : null,
    !z.laeuft ? h('div', { class: 'zeile', style: { justifyContent: 'flex-end', gap: '8px', marginTop: '18px' } },
      h('button', { class: 'knopf text', onclick: () => { z.ansicht = z.p ? 'projekt' : 'start'; zeichnen(); } }, 'Abbrechen'),
      h('button', { class: 'knopf rand', onclick: () => { z.fragen.forEach((f) => { f.antwort = ''; }); planen(); } }, 'Ohne Antworten planen'),
      h('button', { class: 'knopf', onclick: planen }, 'Plan erstellen')) : null);
}

function projektAnsicht(p) {
  const anteil = fortschritt(p);
  const w = wartend(p).length;
  const reiter = [['uebersicht', 'Übersicht'], ['aufgaben', 'Aufgaben', p.aufgaben.filter((a) => a.status !== 'erledigt').length], ['dateien', 'Dateien', Object.keys(z.dateien).length], ['protokoll', 'Protokoll'], ['berichte', 'Berichte', (p.berichte || []).length]];
  const laeuftAgent = z.laeuft && z.laeuft.art === 'agent';
  return h('div', { class: 'lp-projekt-seite' },
    h('header', { class: 'lp-kopf' },
      h('div', { class: 'wachsen' },
        h('div', { class: 'lp-eyebrow' }, `Projekt · angelegt ${lyra.zeitText(p.zeit)}`),
        h('h1', {}, p.name),
        h('div', { class: 'lp-kopf-meta' },
          h('span', { class: 'lp-fortschritt' }, h('span', { class: 'lp-fortschritt-balken' }, h('span', { style: { width: `${Math.round(anteil * 100)}%` } })), `${Math.round(anteil * 100)} %`),
          h('span', {}, `${p.aufgaben.filter((a) => a.status === 'erledigt').length}/${p.aufgaben.length} Aufgaben`),
          w ? h('span', { class: 'lp-hinweis-marke' }, `${w} warte${w === 1 ? 't' : 'n'} auf dich`) : null,
          laeuftAgent ? h('span', { class: 'lp-live-marke' }, h('span', { class: 'lp-puls' }), z.autopilot ? `Autopilot ${z.autopilot.i}/${z.autopilot.liste.length}` : 'Arbeitet') : null)),
      h('div', { class: 'lp-kopf-aktionen' },
        laeuftAgent ? h('button', { class: 'knopf rand klein', onclick: anhalten }, ic('stop', 14), 'Anhalten')
          : h('button', { class: 'knopf klein', disabled: !!z.laeuft || !naechste(p).some(kiAufgabe), onclick: autopilot, title: 'Mehrere Aufgaben nacheinander erledigen lassen' }, ic('blitz', 14), 'Autopilot'),
        h('button', { class: 'knopf rand klein', onclick: exportieren, title: 'Arbeitsbereich, Plan, Protokoll und Berichte als Ordner auf deinen Mac' }, ic('export', 14), 'Exportieren'),
        h('button', { class: 'knopf rand klein lp-nur-schmal', disabled: !!z.laeuft, onclick: () => { z.ansicht = 'start'; zeichnen(); } }, 'Projekte'))),
    h('nav', { class: 'lp-reiter' }, reiter.map(([k, n, zahl]) =>
      h('button', { class: z.reiter === k ? 'an' : '', onclick: () => { z.reiter = k; zeichnen(); } }, n, zahl ? h('span', { class: 'lp-reiter-zahl' }, String(zahl)) : null))),
    z.fehler && !z.auswahl ? h('div', { style: { marginBottom: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
    z.laeuft && !laeuftAgent && z.laeuft.art !== 'code' && z.laeuft.art !== 'anleitung' ? h('div', { style: { marginBottom: '12px' } }, lyra.arbeit(z.status)) : null,
    z.reiter === 'aufgaben' ? aufgabenReiter(p)
      : z.reiter === 'dateien' ? dateienReiter(p)
        : z.reiter === 'protokoll' ? protokollReiter(p)
          : z.reiter === 'berichte' ? berichteReiter(p)
            : uebersichtReiter(p));
}

function kpi(wert, name, unter = '', klasse = '') {
  return h('div', { class: 'lp-kpi ' + klasse }, h('div', { class: 'lp-kpi-wert' }, wert), h('div', { class: 'lp-kpi-name' }, name), unter ? h('div', { class: 'lp-mini' }, unter) : null);
}

function uebersichtReiter(p) {
  const codeZeilen = Object.keys(z.dateien).filter((x) => SPRACHE_VON_ENDUNG[endung(x)]).reduce((s, x) => s + zeilenZahl(z.dateien[x]), 0);
  const mitTests = p.aufgaben.filter((a) => a.tests);
  const testsGruen = mitTests.filter((a) => a.tests.ok).length;
  const schritte = z.protokoll.filter((e) => ['datei', 'code', 'test', 'recherche', 'plugin'].includes(e.art)).length;
  const warten = wartend(p);
  const als = naechste(p).slice(0, 4);
  const laeuft = z.laeuft && z.laeuft.art === 'agent' ? aufgabe(z.laeuft.aufgabe) : null;
  return h('div', { class: 'lp-raster' },
    h('div', { class: 'lp-spalte' },
      h('div', { class: 'lp-kpis' },
        kpi(`${Math.round(fortschritt(p) * 100)} %`, 'Fortschritt', `${p.aufgaben.filter((a) => a.status === 'erledigt').length} von ${p.aufgaben.length} erledigt`),
        kpi(String(Object.keys(z.dateien).length), 'Dateien', codeZeilen ? `${codeZeilen.toLocaleString('de-DE')} Zeilen Code` : groesse(arbeitsbereichGroesse())),
        kpi(mitTests.length ? `${testsGruen}/${mitTests.length}` : '–', 'Tests grün', mitTests.length ? 'je Aufgabe, letzter Lauf' : 'noch keine', mitTests.length && testsGruen < mitTests.length ? 'rot' : ''),
        kpi(String(schritte), 'Arbeitsschritte', 'Dateien, Läufe, Recherchen')),
      laeuft ? h('div', { class: 'lp-karte lp-karte-live', onclick: () => { z.auswahl = laeuft.id; zeichnen(); } },
        h('div', { class: 'lp-karte-kopf' }, h('span', { class: 'lp-puls' }), h('span', { class: 'fett wachsen' }, `Arbeitet an: ${laeuft.titel}`), h('button', { class: 'knopf text klein' }, 'Live ansehen')),
        h('div', { class: 'lp-mini', 'data-status': '' }, z.status)) : null,
      warten.length ? h('section', { class: 'lp-karte' },
        h('div', { class: 'lp-karte-kopf' }, ic('flagge', 15), h('h3', { class: 'wachsen' }, 'Wartet auf dich'), h('span', { class: 'lp-zaehler' }, String(warten.length))),
        warten.map((a) => h('div', { class: 'lp-zeile klickbar', onclick: () => { z.auswahl = a.id; zeichnen(); } },
          statusMarke(a.status),
          h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, a.titel), h('div', { class: 'lp-mini' }, a.status === 'blockiert' ? `Frage: ${a.frage}` : a.tests ? `Tests ${a.tests.ok ? 'bestanden' : 'fehlgeschlagen'} · ${a.dateien.length} Dateien` : `${a.dateien.length} Dateien · Bericht liegt vor`)),
          a.status === 'pruefung' ? h('button', { class: 'knopf klein', onclick: (e) => { e.stopPropagation(); abnehmen(a.id); } }, ic('check', 14), 'Abnehmen') : h('button', { class: 'knopf rand klein' }, 'Antworten')))) : null,
      h('section', { class: 'lp-karte' },
        h('div', { class: 'lp-karte-kopf' }, ic('pfeil', 15), h('h3', { class: 'wachsen' }, 'Als Nächstes'), h('button', { class: 'knopf text klein', onclick: () => { z.reiter = 'aufgaben'; zeichnen(); } }, 'Alle Aufgaben')),
        als.length ? als.map((a) => h('div', { class: 'lp-zeile klickbar', onclick: () => { z.auswahl = a.id; zeichnen(); } },
          artMarke(a.art),
          h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, a.titel), h('div', { class: 'lp-mini eine-zeile' }, a.beschreibung)),
          prioPunkt(a.prioritaet),
          kiAufgabe(a) ? h('button', { class: 'knopf tonal klein', disabled: !!z.laeuft, onclick: (e) => { e.stopPropagation(); erledigen(a.id); } }, ic('play', 13), 'Erledigen')
            : h('button', { class: 'knopf rand klein', onclick: (e) => { e.stopPropagation(); statusSetzen(a.id, 'erledigt'); } }, ic('check', 13), 'Erledigt'))) : h('div', { class: 'lp-leer' }, p.aufgaben.length && p.aufgaben.every((a) => a.status === 'erledigt') ? 'Alles erledigt. Erstell einen Abschlussbericht unter „Berichte“.' : 'Keine offenen Aufgaben.')),
      h('section', { class: 'lp-karte' },
        h('div', { class: 'lp-karte-kopf' }, ic('phase', 15), h('h3', { class: 'wachsen' }, 'Phasen')),
        p.abschnitte.map((s, i) => {
          const l = p.aufgaben.filter((a) => a.abschnitt === s.id);
          const f = l.length ? l.filter((a) => a.status === 'erledigt').length / l.length : 0;
          const t = tageBis(s.bis);
          return h('div', { class: 'lp-phase' },
            h('div', { class: 'lp-phase-nr' + (f === 1 ? ' fertig' : '') }, f === 1 ? ic('check', 13) : String(i + 1)),
            h('div', { class: 'wachsen' },
              h('div', { class: 'zeile' }, h('span', { class: 'fett wachsen' }, s.titel), s.bis ? h('span', { class: 'lp-termin' + (f < 1 && t !== null && t < 0 ? ' spaet' : f < 1 && t !== null && t <= 3 ? ' bald' : '') }, `${deDatum(s.bis, true)}${f < 1 && t !== null ? (t < 0 ? ' · überfällig' : t === 0 ? ' · heute' : ` · in ${t} T.`) : ''}`) : null),
              h('div', { class: 'lp-phase-balken' }, h('div', { style: { width: `${Math.round(f * 100)}%` } })),
              h('div', { class: 'lp-mini' }, `${l.filter((a) => a.status === 'erledigt').length} von ${l.length} erledigt`)));
        })),
      coachKarte(p)),
    h('div', { class: 'lp-spalte lp-seite' },
      h('section', { class: 'lp-karte' },
        h('div', { class: 'lp-karte-kopf' }, ic('ziel', 15), h('h3', {}, 'Ziel')),
        h('div', { class: 'lp-ziel' }, p.ziel || '–'),
        p.vision ? h('div', { class: 'lp-mini', style: { marginTop: '6px' } }, p.vision) : null,
        p.erfolg.length ? h('div', { class: 'lp-label', style: { marginTop: '12px' } }, 'Erfolgskriterien') : null,
        p.erfolg.length ? h('ul', { class: 'lp-liste' }, p.erfolg.map((e) => h('li', {}, e))) : null),
      p.risiken.length ? h('section', { class: 'lp-karte' },
        h('div', { class: 'lp-karte-kopf' }, ic('warnung', 15), h('h3', {}, 'Risiken')),
        p.risiken.map((r) => h('div', { class: 'lp-risiko' }, h('div', { class: 'fett' }, r.risiko), h('div', { class: 'lp-mini' }, '→ ' + r.gegenmittel)))) : null,
      einstellungenKarte(p)));
}

function prioPunkt(prio) {
  return h('span', { class: 'lp-prio lp-prio-' + prio, title: 'Priorität: ' + PRIO[prio][0] });
}

function einstellungenKarte(p) {
  const e = p.einstellungen;
  const setzen = async (k, v) => { e[k] = v; await sichern(p); zeichnen(); };
  return h('section', { class: 'lp-karte' },
    h('div', { class: 'lp-karte-kopf' }, ic('ki', 15), h('h3', {}, 'Mitarbeiter')),
    h('div', { class: 'lp-einstellung' }, h('span', { class: 'wachsen' }, 'Gründlichkeit'),
      lyra.auswahl({ optionen: Object.entries(GRUENDLICH).map(([k, v]) => [k, v[0], `bis zu ${v[1]} Arbeitsschritte je Aufgabe`]), wert: e.gruendlich, beiWahl: (w) => setzen('gruendlich', w) })),
    lyra.schalter({ wert: e.tests, text: 'Tests zum Abschluss', unter: 'Führt alle Tests vor der Abnahme noch einmal aus', beiWahl: (w) => setzen('tests', w) }),
    lyra.schalter({ wert: e.web, text: 'Recherche im Internet', unter: 'Websuche (Claude/ChatGPT) bzw. Wikipedia & Co.', beiWahl: (w) => setzen('web', w) }),
    lyra.schalter({ wert: e.plugins, text: 'Andere Plugins einsetzen', unter: z.faehigkeiten.length ? `${new Set(z.faehigkeiten.map((f) => f.name)).size} verfügbar: ${[...new Set(z.faehigkeiten.map((f) => f.name))].slice(0, 5).join(', ')} …` : 'Keine weiteren Plugins installiert', beiWahl: (w) => setzen('plugins', w) }),
    lyra.schalter({ wert: e.autoAbnahme, text: 'Automatisch abnehmen', unter: 'Nur, wenn alle Tests grün sind – sonst prüfst du', beiWahl: (w) => setzen('autoAbnahme', w) }),
    lyra.schalter({ wert: p.erinnern, text: 'An Phasen-Termine erinnern', beiWahl: async (w) => { p.erinnern = w; await sichern(p); const ok = await erinnerungenSetzen(); if (w && !ok) lyra.toast('Erinnerungen kommen nur, wenn Lyra Mitteilungen senden darf.', 'fehler'); zeichnen(); } }),
    h('div', { class: 'zeile', style: { marginTop: '10px', gap: '6px' } },
      h('button', { class: 'knopf text klein', onclick: () => { z.idee = p.idee; z.fragen = []; z.ansicht = 'start'; zeichnen(); } }, 'Als neue Idee'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text klein lp-gefahr', onclick: () => entfernen(p.id) }, 'Projekt löschen')));
}

function coachKarte(p) {
  const t = h('textarea', { class: 'eingabe', rows: 2, 'data-feld': 'coach', placeholder: 'Wie läuft’s? Was hat sich geändert, was fehlt? – z. B. „Die Auswertung soll auch Diagramme als SVG erzeugen“' });
  t.value = z.coach.text;
  t.addEventListener('input', () => { z.coach.text = t.value; });
  return h('section', { class: 'lp-karte' },
    h('div', { class: 'lp-karte-kopf' }, ic('frage', 15), h('h3', { class: 'wachsen' }, 'Check-in')),
    t,
    h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: coachFragen }, 'Feedback holen')),
    z.coach.antwort ? h('div', { class: 'lp-coach-antwort' }, lyra.mdElement(z.coach.antwort)) : null,
    z.coach.vorschlaege.length ? h('div', { class: 'spalte', style: { gap: '8px', marginTop: '10px' } },
      h('div', { class: 'lp-mini' }, 'Vorschläge – übernommen wird nur, was du bestätigst:'),
      z.coach.vorschlaege.map((v, i) => h('div', { class: 'lp-zeile' },
        artMarke(v.aufgabe.art),
        h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, v.aufgabe.titel), h('div', { class: 'lp-mini' }, v.begruendung)),
        h('button', { class: 'knopf text klein', onclick: () => { z.coach.vorschlaege.splice(i, 1); zeichnen(); } }, 'Nein'),
        h('button', { class: 'knopf klein', onclick: () => vorschlagUebernehmen(i) }, 'Übernehmen')))) : null);
}

// ------------------------------------------------------------------ Aufgaben (Board und Liste)

function aufgabenReiter(p) {
  const filter = (a) => !z.phase || a.abschnitt === z.phase;
  const liste = reihenfolge(p).filter(filter);
  const werkzeuge = h('div', { class: 'lp-werkzeuge' },
    h('button', { class: 'knopf klein', onclick: () => aufgabeDialog(null) }, ic('plus', 14), 'Aufgabe'),
    lyra.auswahl({ titel: 'Phase', optionen: [['', 'Alle'], ...p.abschnitte.map((s) => [s.id, s.titel])], wert: z.phase, beiWahl: (w) => { z.phase = w; zeichnen(); } }),
    h('span', { class: 'wachsen' }),
    h('div', { class: 'lp-umschalter' },
      h('button', { class: !z.boardListe ? 'an' : '', title: 'Board', onclick: () => { z.boardListe = false; zeichnen(); } }, ic('board', 15)),
      h('button', { class: z.boardListe ? 'an' : '', title: 'Liste', onclick: () => { z.boardListe = true; zeichnen(); } }, ic('liste', 15))));
  if (z.boardListe) {
    return h('div', {}, werkzeuge, h('table', { class: 'lp-tabelle' },
      h('thead', {}, h('tr', {}, ['Status', 'Aufgabe', 'Art', 'Phase', 'Prio', 'Tests', 'Dateien'].map((t) => h('th', {}, t)))),
      h('tbody', {}, liste.map((a) => h('tr', { class: z.auswahl === a.id ? 'an' : '', onclick: () => { z.auswahl = a.id; zeichnen(); } },
        h('td', {}, statusMarke(a.status)),
        h('td', { class: 'fett' }, a.titel),
        h('td', {}, artMarke(a.art)),
        h('td', { class: 'lp-mini' }, (p.abschnitte.find((s) => s.id === a.abschnitt) || {}).titel || '–'),
        h('td', {}, prioPunkt(a.prioritaet), ' ', PRIO[a.prioritaet][0]),
        h('td', {}, a.tests ? h('span', { class: a.tests.ok ? 'lp-gut' : 'lp-schlecht' }, a.tests.ok ? '✓ grün' : '✗ rot') : '–'),
        h('td', {}, String(a.dateien.length)))))));
  }
  const spalte = (k) => liste.filter((a) => (k === 'warten' ? a.status === 'blockiert' || a.status === 'pruefung' : a.status === k));
  return h('div', {}, werkzeuge, h('div', { class: 'lp-board' }, SPALTEN.map(([k, name]) => {
    const karten = spalte(k);
    const s = h('div', { class: 'lp-board-spalte', 'data-spalte': k },
      h('div', { class: 'lp-board-kopf' }, h('span', { class: 'lp-punkt lp-p-' + k }), name, h('span', { class: 'lp-board-zahl' }, String(karten.length))),
      h('div', { class: 'lp-board-karten' }, karten.map((a) => boardKarte(p, a)),
        k === 'offen' ? h('button', { class: 'lp-board-neu', onclick: () => aufgabeDialog(null) }, ic('plus', 13), 'Aufgabe hinzufügen') : null));
    s.addEventListener('dragover', (e) => { e.preventDefault(); s.classList.add('ziel'); });
    s.addEventListener('dragleave', () => s.classList.remove('ziel'));
    s.addEventListener('drop', (e) => {
      e.preventDefault();
      s.classList.remove('ziel');
      const id = e.dataTransfer.getData('text/plain');
      const a = aufgabe(id);
      if (!a) return;
      if (k === 'arbeit' && kiAufgabe(a)) { if (!z.laeuft) erledigen(id); return; }
      statusSetzen(id, k === 'warten' ? 'pruefung' : k);
    });
    return s;
  })));
}

function boardKarte(p, a) {
  const phase = p.abschnitte.find((s) => s.id === a.abschnitt);
  const laeuft = z.laeuft && z.laeuft.aufgabe === a.id;
  const k = h('div', { class: 'lp-board-karte' + (z.auswahl === a.id ? ' an' : '') + (laeuft ? ' laeuft' : ''), draggable: 'true', onclick: () => { z.auswahl = a.id; zeichnen(); } },
    h('div', { class: 'zeile', style: { gap: '6px', marginBottom: '6px' } }, artMarke(a.art), h('span', { class: 'wachsen' }), prioPunkt(a.prioritaet)),
    h('div', { class: 'lp-board-titel' }, a.titel),
    h('div', { class: 'lp-board-fuss' },
      phase ? h('span', { class: 'eine-zeile' }, phase.titel) : null,
      h('span', { class: 'wachsen' }),
      a.status === 'blockiert' ? h('span', { class: 'lp-schlecht' }, ic('frage', 12)) : null,
      a.tests ? h('span', { class: a.tests.ok ? 'lp-gut' : 'lp-schlecht', title: 'Tests' }, ic('test', 12), a.tests.gesamt !== null ? `${a.tests.gesamt - (a.tests.fehlgeschlagen || 0)}/${a.tests.gesamt}` : '') : null,
      a.dateien.length ? h('span', { title: 'Dateien' }, ic('datei', 12), String(a.dateien.length)) : null,
      laeuft ? h('span', { class: 'lp-puls' }) : null));
  k.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; });
  return k;
}

// ------------------------------------------------------------------ Seitenpanel einer Aufgabe

function aufgabePanel(p, a) {
  const laeuft = z.laeuft && z.laeuft.aufgabe === a.id;
  const phase = p.abschnitte.find((s) => s.id === a.abschnitt);
  const eintraege = z.protokoll.filter((e) => e.aufgabe === a.id);
  const ki = kiAufgabe(a);
  let aktion = null;
  if (laeuft && z.laeuft.art === 'agent') {
    aktion = h('div', { class: 'lp-live' },
      h('div', { class: 'lp-live-kopf' }, h('span', { class: 'lp-puls' }), h('span', { class: 'wachsen fett', 'data-status': '' }, z.status || 'Arbeitet …'), h('button', { class: 'knopf rand klein', onclick: anhalten }, ic('stop', 13), 'Anhalten')),
      h('pre', { class: 'lp-live-inhalt', id: 'live-inhalt' }, z.live.slice(-4000)),
      h('div', { class: 'lp-label' }, 'Arbeitsschritte'),
      h('div', { class: 'lp-feed', id: 'live-feed' }, eintraege.slice(-40).map((e) => protokollZeile(e, true))));
  } else if (laeuft) {
    aktion = lyra.arbeit(z.status);
  } else if (a.status === 'blockiert') {
    const t = h('textarea', { class: 'eingabe', rows: 3, 'data-feld': 'antwort', placeholder: 'Deine Antwort …' });
    t.value = z.antwort;
    t.addEventListener('input', () => { z.antwort = t.value; });
    aktion = h('div', { class: 'lp-frage' },
      h('div', { class: 'lp-label' }, 'Rückfrage von Launchpad'),
      h('div', { class: 'lp-frage-text' }, a.frage),
      t,
      h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'knopf klein', disabled: !!z.laeuft, onclick: () => antworten(a.id) }, 'Antworten und weiterarbeiten')));
  } else if (a.status === 'pruefung') {
    const t = h('textarea', { class: 'eingabe', rows: 2, 'data-feld': 'nacharbeit', placeholder: 'Was soll anders werden? z. B. „Die CSV braucht noch eine Spalte Region“' });
    t.value = z.nacharbeit;
    t.addEventListener('input', () => { z.nacharbeit = t.value; });
    aktion = h('div', { class: 'lp-abnahme' },
      h('div', { class: 'lp-label' }, 'Abnahme'),
      h('div', { class: 'zeile', style: { gap: '8px' } },
        h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => abnehmen(a.id) }, ic('check', 14), 'Abnehmen'),
        h('span', { class: 'lp-mini wachsen' }, 'oder Nacharbeit anfordern:')),
      t,
      h('div', { class: 'zeile', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: () => nacharbeiten(a.id) }, ic('neu', 13), 'Nacharbeiten lassen')));
  } else if (a.status !== 'erledigt') {
    aktion = h('div', { class: 'zeile', style: { gap: '8px' } },
      ki ? h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: () => erledigen(a.id) }, ic('play', 14), a.bericht ? 'Erneut erledigen' : 'Von Launchpad erledigen lassen')
        : h('button', { class: 'knopf', onclick: () => statusSetzen(a.id, 'erledigt') }, ic('check', 14), 'Erledigt'),
      !ki ? h('button', { class: 'knopf rand', disabled: !!z.laeuft, onclick: () => anleitung(a.id) }, 'Anleitung') : null,
      ki ? h('span', { class: 'lp-mini' }, `${GRUENDLICH[p.einstellungen.gruendlich][0]} · bis ${GRUENDLICH[p.einstellungen.gruendlich][1]} Schritte`) : null);
  } else {
    aktion = h('div', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: 'lp-gut fett' }, ic('check', 14), `Erledigt${a.erledigtAm ? ' · ' + lyra.zeitText(a.erledigtAm) : ''}`), h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text klein', onclick: () => statusSetzen(a.id, 'offen') }, 'Wieder öffnen'));
  }
  return h('aside', { class: 'lp-panel' },
    h('div', { class: 'lp-panel-kopf' },
      h('div', { class: 'zeile', style: { gap: '6px' } }, statusMarke(a.status), artMarke(a.art), h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf symbol', title: 'Bearbeiten', disabled: laeuft, onclick: () => aufgabeDialog(a.id) }, ic('stift', 15)),
        h('button', { class: 'knopf symbol', title: 'Löschen', disabled: laeuft, onclick: () => aufgabeLoeschen(a.id) }, ic('muell', 15)),
        h('button', { class: 'knopf symbol', title: 'Schließen', onclick: () => { z.auswahl = null; zeichnen(); } }, ic('x', 15))),
      h('h2', {}, a.titel),
      h('div', { class: 'lp-mini' }, [phase ? phase.titel : '', `Priorität ${PRIO[a.prioritaet][0]}`, a.sprache && SPRACHEN[a.sprache] ? SPRACHEN[a.sprache][0] : '', `ca. ${a.minuten} min Handarbeit`, a.laeufe ? `${a.laeufe} Lauf${a.laeufe === 1 ? '' : 'e'}` : ''].filter(Boolean).join(' · '))),
    h('div', { class: 'lp-panel-inhalt', 'data-scroll': 'panel' },
      z.fehler && !laeuft ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, ki ? () => { z.fehler = null; erledigen(a.id); } : null) : null,
      aktion,
      a.beschreibung ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, 'Beschreibung'), h('div', { class: 'lp-text' }, a.beschreibung)) : null,
      a.kriterien.length ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, 'Abnahmekriterien'), h('ul', { class: 'lp-kriterien' }, a.kriterien.map((k) => h('li', {}, k)))) : null,
      a.tests ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, 'Tests'),
        h('div', { class: 'lp-testzeile ' + (a.tests.ok ? 'gut' : 'schlecht') }, ic(a.tests.ok ? 'check' : 'x', 14),
          a.tests.gesamt !== null ? `${a.tests.gesamt - (a.tests.fehlgeschlagen || 0)} von ${a.tests.gesamt} bestanden` : a.tests.ok ? 'Bestanden' : 'Fehlgeschlagen',
          h('span', { class: 'lp-mini' }, ' · ' + lyra.zeitText(a.tests.zeit)))) : null,
      a.dateien.length ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, `Dateien · ${a.dateien.length}`),
        h('div', { class: 'lp-dateichips' }, a.dateien.map((x) => h('button', { class: 'lp-dateichip', onclick: () => { z.reiter = 'dateien'; z.datei = x; z.editor = null; z.auswahl = null; zeichnen(); } }, ic(SPRACHE_VON_ENDUNG[endung(x)] ? 'code' : 'datei', 12), x)))) : null,
      a.bericht && !laeuft ? h('div', { class: 'lp-block' }, h('div', { class: 'zeile' }, h('div', { class: 'lp-label wachsen' }, ki ? 'Bericht' : 'Anleitung'), h('button', { class: 'knopf symbol', title: 'Kopieren', onclick: () => lyra.kopieren(a.bericht) }, ic('kopie', 14))), lyra.mdElement(a.bericht, 'lp-bericht')) : null,
      a.antworten && a.antworten.length ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, 'Deine Antworten'), a.antworten.map((x) => h('div', { class: 'lp-mini', style: { marginBottom: '4px' } }, h('b', {}, x.frage), ' → ', x.antwort))) : null,
      !laeuft && eintraege.length ? h('div', { class: 'lp-block' }, h('div', { class: 'lp-label' }, `Protokoll · ${eintraege.length}`), h('div', { class: 'lp-feed' }, eintraege.slice(-30).map((e) => protokollZeile(e, false)))) : null));
}

// ------------------------------------------------------------------ Dateien

function baum() {
  const pfade = Object.keys(z.dateien).sort((a, b) => {
    const ta = a.split('/'), tb = b.split('/');
    if (ta.length !== tb.length && (ta.length === 1 || tb.length === 1)) return ta.length === 1 ? 1 : -1;
    return a.localeCompare(b);
  });
  const zeilen = [];
  let ordner = '';
  for (const pf of pfade) {
    const i = pf.lastIndexOf('/');
    const o = i > 0 ? pf.slice(0, i) : '';
    if (o !== ordner) { if (o) zeilen.push(h('div', { class: 'lp-baum-ordner' }, ic('ordner', 13), o + '/')); ordner = o; }
    const name = i > 0 ? pf.slice(i + 1) : pf;
    zeilen.push(h('div', { class: 'lp-baum-datei' + (z.datei === pf ? ' an' : '') + (o ? ' tief' : ''), onclick: () => { if (z.editor !== null && z.datei !== pf) z.editor = null; z.datei = pf; z.quelltext = false; zeichnen(); } },
      ic(SPRACHE_VON_ENDUNG[endung(pf)] ? 'code' : 'datei', 13), h('span', { class: 'wachsen eine-zeile' }, name), h('span', { class: 'lp-mini' }, groesse(z.dateien[pf].length))));
  }
  return zeilen;
}

function csvTabelle(t) {
  const zeilen = t.split('\n').filter((x) => x.length);
  const trenner = (zeilen[0] || '').split(';').length > (zeilen[0] || '').split(',').length ? ';' : endung(z.datei) === 'tsv' ? '\t' : ',';
  const teilen = (s) => { const aus = []; let cur = '', q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '"') { if (q && s[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === trenner && !q) { aus.push(cur); cur = ''; } else cur += c; } aus.push(cur); return aus; };
  const kopf = teilen(zeilen[0] || '');
  const rest = zeilen.slice(1, 101).map(teilen);
  return h('div', {},
    h('div', { class: 'lp-mini', style: { margin: '0 0 8px' } }, `${(zeilen.length - 1).toLocaleString('de-DE')} Zeilen · ${kopf.length} Spalten${zeilen.length > 101 ? ' · Vorschau: die ersten 100' : ''}`),
    h('div', { class: 'lp-csv' }, h('table', { class: 'lp-tabelle klein' }, h('thead', {}, h('tr', {}, kopf.map((k) => h('th', {}, k)))), h('tbody', {}, rest.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))))));
}

function codeAnsicht(t) {
  const zeilen = t.split('\n');
  const gekuerzt = zeilen.length > 3000;
  const pre = h('pre', { class: 'lp-code' });
  pre.appendChild(h('code', {}, (gekuerzt ? zeilen.slice(0, 3000) : zeilen).map((z1) => h('span', { class: 'lp-codezeile' }, z1 + '\n'))));
  return h('div', {}, pre, gekuerzt ? h('div', { class: 'lp-mini' }, `… ${zeilen.length - 3000} weitere Zeilen (Datei sichern, um alles zu sehen)`) : null);
}

function ausgabeKarte(o) {
  if (!o) return null;
  const r = o.r;
  return h('div', { class: 'lp-ausgabe' },
    h('div', { class: 'zeile', style: { marginBottom: '6px' } },
      h('span', { class: 'fett wachsen' }, o.testErgebnis ? `Tests: ${o.testErgebnis.ok ? 'bestanden' : 'fehlgeschlagen'}${o.testErgebnis.gesamt !== null ? ` (${o.testErgebnis.gesamt - (o.testErgebnis.fehlgeschlagen || 0)}/${o.testErgebnis.gesamt})` : ''}` : `${o.pfad}: ${r.zeitUm ? 'Zeitlimit' : r.ok ? 'OK' : `Fehler (Code ${r.code})`}`),
      h('span', { class: 'lp-mini' }, `${r.dauerMs || 0} ms`),
      h('button', { class: 'knopf symbol', onclick: () => { z.ausgabe = null; zeichnen(); } }, ic('x', 14))),
    o.neu && o.neu.length ? h('div', { class: 'lp-mini', style: { marginBottom: '6px' } }, `Neue/geänderte Dateien: ${o.neu.join(', ')}`) : null,
    h('pre', { class: 'lp-terminal' + (r.ok ? '' : ' fehler') }, [r.ausgabe, r.fehler].filter((x) => text(x)).join('\n') || '(keine Ausgabe)'));
}

function dateienReiter(p) {
  const pfade = Object.keys(z.dateien);
  if (z.datei && z.dateien[z.datei] === undefined) z.datei = null;
  if (!z.datei && pfade.length) z.datei = pfade.includes('README.md') ? 'README.md' : pfade.sort()[0];
  const hatTests = pfade.some((x) => /^test[^/]*\.py$/.test(x));
  const werkzeuge = h('div', { class: 'lp-werkzeuge' },
    h('button', { class: 'knopf rand klein', onclick: dateiNeu }, ic('plus', 14), 'Neue Datei'),
    h('button', { class: 'knopf rand klein', onclick: dateiImport, title: 'CSV, Excel, Text oder JSON von deinem Mac in den Arbeitsbereich' }, ic('sichern', 14), 'Importieren'),
    hatTests ? h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: () => dateiAusfuehren('', true) }, ic('test', 14), 'Alle Tests') : null,
    h('span', { class: 'wachsen' }),
    h('span', { class: 'lp-mini' }, `${pfade.length} Dateien · ${groesse(arbeitsbereichGroesse())} von ${groesse(ARBEITSBEREICH_MAX)}`),
    h('button', { class: 'knopf klein', disabled: !pfade.length, onclick: exportieren }, ic('export', 14), 'Als Ordner exportieren'));
  if (!pfade.length) {
    return h('div', {}, werkzeuge, h('div', { class: 'lp-karte lp-leer-gross' }, ic('ordner', 28), h('div', { class: 'fett' }, 'Der Arbeitsbereich ist noch leer'),
      h('div', { class: 'lp-mini' }, 'Hier landen Code, Datensätze, Recherchen und Dokumente, sobald Launchpad Aufgaben erledigt. Du kannst auch eigene Daten importieren.')));
  }
  const t = z.dateien[z.datei] || '';
  const e = endung(z.datei || '');
  const ausfuehrbar = !!SPRACHE_VON_ENDUNG[e];
  let inhalt;
  if (z.editor !== null) {
    const f = h('textarea', { class: 'lp-editor', 'data-feld': 'editor', spellcheck: 'false' });
    f.value = z.editor;
    f.addEventListener('input', () => { z.editor = f.value; });
    f.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab') { ev.preventDefault(); const s = f.selectionStart; f.setRangeText('    ', s, f.selectionEnd, 'end'); z.editor = f.value; }
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 's') { ev.preventDefault(); editorSichern(); }
    });
    inhalt = f;
  } else if (e === 'md' && !z.quelltext) inhalt = h('div', { class: 'lp-md' }, lyra.mdElement(t));
  else if ((e === 'csv' || e === 'tsv') && !z.quelltext) inhalt = csvTabelle(t);
  else inhalt = codeAnsicht(t);
  const urheber = p.aufgaben.filter((a) => a.dateien.includes(z.datei));
  return h('div', {}, werkzeuge,
    h('div', { class: 'lp-dateien' },
      h('div', { class: 'lp-baum', 'data-scroll': 'baum' }, baum()),
      h('div', { class: 'lp-viewer' },
        h('div', { class: 'lp-viewer-kopf' },
          h('div', { class: 'wachsen' }, h('div', { class: 'lp-pfad' }, z.datei), h('div', { class: 'lp-mini' }, `${zeilenZahl(t).toLocaleString('de-DE')} Zeilen · ${groesse(t.length)}${urheber.length ? ' · aus „' + urheber[0].titel + '“' : ''}`)),
          z.editor !== null ? [
            h('button', { class: 'knopf text klein', onclick: () => { z.editor = null; zeichnen(); } }, 'Verwerfen'),
            h('button', { class: 'knopf klein', onclick: editorSichern }, 'Sichern'),
          ] : [
            ['md', 'csv', 'tsv'].includes(e) ? h('button', { class: 'knopf text klein', onclick: () => { z.quelltext = !z.quelltext; zeichnen(); } }, z.quelltext ? 'Ansicht' : 'Quelltext') : null,
            ausfuehrbar ? h('button', { class: 'knopf tonal klein', disabled: !!z.laeuft, onclick: () => dateiAusfuehren(z.datei) }, ic('play', 13), 'Ausführen') : null,
            h('button', { class: 'knopf symbol', title: 'Bearbeiten', onclick: () => { z.editor = t; zeichnen(); } }, ic('stift', 15)),
            h('button', { class: 'knopf symbol', title: 'Kopieren', onclick: () => lyra.kopieren(t) }, ic('kopie', 15)),
            h('button', { class: 'knopf symbol', title: 'Auf dem Mac sichern', onclick: async () => { try { if (await lyra.speichern(z.datei.split('/').pop(), t)) lyra.toast('Gesichert', 'ok'); } catch (err) { lyra.toast(meldung(err), 'fehler'); } } }, ic('sichern', 15)),
            h('button', { class: 'knopf symbol', title: 'Löschen', disabled: !!z.laeuft, onclick: () => dateiLoeschen(z.datei) }, ic('muell', 15)),
          ]),
        z.laeuft && z.laeuft.art === 'code' ? lyra.arbeit(z.status, { abbrechen: false }) : null,
        ausgabeKarte(z.ausgabe),
        h('div', { class: 'lp-viewer-inhalt', 'data-scroll': 'viewer' }, inhalt))));
}

// ------------------------------------------------------------------ Protokoll

const PROTOKOLL_ICON = { start: 'play', denken: 'ki', datei: 'datei', lesen: 'suche', code: 'code', test: 'test', recherche: 'suche', plugin: 'plugin', frage: 'frage', antwort: 'person', fertig: 'flagge', fehler: 'warnung', nutzer: 'person', abnahme: 'check', plan: 'rakete', bericht: 'bericht', notiz: 'notiz', stopp: 'stop', korrektur: 'warnung' };
const PROTOKOLL_FILTER = [['alle', 'Alle'], ['dateien', 'Dateien'], ['code', 'Code & Tests'], ['recherche', 'Recherche & Plugins'], ['du', 'Du'], ['fehler', 'Probleme']];
const passtFilter = (e, f) => f === 'alle' || (f === 'dateien' && (e.art === 'datei' || e.art === 'lesen')) || (f === 'code' && (e.art === 'code' || e.art === 'test'))
  || (f === 'recherche' && (e.art === 'recherche' || e.art === 'plugin')) || (f === 'du' && ['nutzer', 'antwort', 'abnahme', 'frage'].includes(e.art)) || (f === 'fehler' && (e.art === 'fehler' || e.art === 'korrektur' || e.ok === false));

function protokollZeile(e, kompakt) {
  const offen = z.offenesProtokoll.has(e.id);
  const zeile = h('div', { class: 'lp-log' + (e.ok === false ? ' schlecht' : e.ok === true ? ' gut' : '') + (kompakt ? ' kompakt' : '') },
    h('div', { class: 'lp-log-kopf', onclick: e.text ? () => { if (offen) z.offenesProtokoll.delete(e.id); else z.offenesProtokoll.add(e.id); zeichnen(); } : null },
      h('span', { class: 'lp-log-ic' }, ic(PROTOKOLL_ICON[e.art] || 'notiz', 13)),
      h('span', { class: 'wachsen lp-log-titel' }, e.titel),
      h('span', { class: 'lp-mini' }, new Date(e.zeit * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))),
    offen && e.text ? h('pre', { class: 'lp-log-text' }, e.text) : null);
  return zeile;
}

function protokollReiter(p) {
  const name = (id) => { const a = p.aufgaben.find((x) => x.id === id); return a ? a.titel : ''; };
  const liste = z.protokoll.filter((e) => passtFilter(e, z.protokollFilter)).slice().reverse();
  const tage = [];
  let tag = '';
  for (const e of liste.slice(0, 400)) {
    const t = new Date(e.zeit * 1000).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    if (t !== tag) { tage.push(h('div', { class: 'lp-tag' }, t)); tag = t; }
    const zeile = protokollZeile(e, false);
    if (e.aufgabe && name(e.aufgabe)) zeile.querySelector('.lp-log-titel').appendChild(h('span', { class: 'lp-log-aufgabe', onclick: (ev) => { ev.stopPropagation(); z.auswahl = e.aufgabe; zeichnen(); } }, name(e.aufgabe)));
    tage.push(zeile);
  }
  return h('div', {},
    h('div', { class: 'lp-werkzeuge' },
      h('div', { class: 'lp-filter' }, PROTOKOLL_FILTER.map(([k, n]) => h('button', { class: z.protokollFilter === k ? 'an' : '', onclick: () => { z.protokollFilter = k; zeichnen(); } }, n))),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf rand klein', disabled: !z.protokoll.length, onclick: () => lyra.kopieren(protokollMarkdown(p), 'Protokoll kopiert') }, ic('kopie', 14), 'Kopieren'),
      h('button', { class: 'knopf rand klein', disabled: !z.protokoll.length, onclick: async () => { try { if (await lyra.speichern(`${dateiname(p.name)}-Protokoll.md`, protokollMarkdown(p))) lyra.toast('Gesichert', 'ok'); } catch (err) { lyra.toast(meldung(err), 'fehler'); } } }, ic('sichern', 14), 'Sichern')),
    h('div', { class: 'lp-karte lp-protokoll' }, tage.length ? tage : h('div', { class: 'lp-leer' }, 'Noch keine Einträge.')));
}

// ------------------------------------------------------------------ Berichte

function berichteReiter(p) {
  const b = (p.berichte || []).find((x) => x.id === z.bericht);
  const karte = (art, titel, u, bei, ki = true) => h('button', { class: 'lp-berichtkarte', disabled: !!z.laeuft, onclick: bei },
    h('div', { class: 'zeile', style: { gap: '8px' } }, ic(art, 18), h('span', { class: 'fett' }, titel), ki ? h('span', { class: 'lp-ki-marke' }, 'KI') : null),
    h('div', { class: 'lp-mini' }, u));
  return h('div', {},
    h('div', { class: 'lp-berichtkarten' },
      karte('bericht', 'Statusbericht', 'Ampel, Erledigtes, Qualität, Risiken und nächste Schritte – wie für eine Projektleitung', () => berichtErstellen('status')),
      karte('notiz', 'Projektdokumentation', 'README.md mit Aufbau, Bedienung, Tests und Daten – landet auch im Arbeitsbereich', () => berichtErstellen('doku')),
      karte('liste', 'Projektübersicht', 'Plan, Aufgaben, Abnahmekriterien und Berichte als Markdown', async () => { try { if (await lyra.speichern(`${dateiname(p.name)}.md`, projektMarkdown(p))) lyra.toast('Gesichert', 'ok'); } catch (err) { lyra.toast(meldung(err), 'fehler'); } }, false),
      karte('export', 'Alles exportieren', 'Arbeitsbereich mit Plan, Protokoll und Berichten als Ordner auf deinen Mac', exportieren, false)),
    (p.berichte || []).length ? h('div', { class: 'lp-berichte' },
      h('div', { class: 'lp-berichtliste' }, p.berichte.map((x) => h('div', { class: 'lp-zeile klickbar' + (x.id === z.bericht ? ' an' : ''), onclick: () => { z.bericht = x.id; zeichnen(); } },
        ic(x.art === 'doku' ? 'notiz' : 'bericht', 15), h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, x.titel), h('div', { class: 'lp-mini' }, lyra.zeitText(x.zeit)))))),
      b ? h('div', { class: 'lp-karte lp-berichtansicht' },
        h('div', { class: 'zeile', style: { marginBottom: '10px' } }, h('h3', { class: 'wachsen' }, b.titel),
          h('button', { class: 'knopf symbol', title: 'Kopieren', onclick: () => lyra.kopieren(b.markdown) }, ic('kopie', 15)),
          h('button', { class: 'knopf symbol', title: 'Sichern', onclick: async () => { try { if (await lyra.speichern(`${slug(b.titel)}.md`, b.markdown)) lyra.toast('Gesichert', 'ok'); } catch (err) { lyra.toast(meldung(err), 'fehler'); } } }, ic('sichern', 15)),
          h('button', { class: 'knopf symbol', title: 'Löschen', onclick: async () => { p.berichte = p.berichte.filter((x) => x.id !== b.id); z.bericht = null; await sichern(p); zeichnen(); } }, ic('muell', 15))),
        lyra.mdElement(b.markdown, 'lp-bericht')) : h('div', { class: 'lp-karte lp-leer' }, 'Wähle einen Bericht.')) : null);
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  await lyra.dialog('Launchpad', h('div', { style: { maxWidth: '480px', lineHeight: 1.55 } },
    h('p', {}, 'Launchpad plant Projekte und erledigt die Aufgaben wie ein Mitarbeiter: Es schreibt Dateien und Code, führt Programme und Tests in einer abgeschotteten Sandbox aus (ohne Internet, ohne Zugriff auf deine Dateien), recherchiert und lässt andere Plugins mitarbeiten. Jeder Schritt steht im Protokoll.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Alles bleibt im Arbeitsbereich des Projekts in Lyra. Auf deinen Mac kommt nur, was du exportierst oder sicherst. Ergebnisse gelten erst als erledigt, wenn du sie abnimmst; neue Aufgaben vom Coach übernimmst nur du.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Mit Lyra (lokal) bleibt alles auf deinem Mac. Mit Claude, ChatGPT oder Gemini gehen Aufgabe, Dateien und Ergebnisse an den Anbieter (Lyra fragt vorher).')), [
    { text: 'Fertig', wert: true },
  ]);
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

/** Kurzer Projektname aus einer Anweisung: „Schreibe ein Python-Modul x.py mit …“ → „Python-Modul x.py“. */
function kurzName(t) {
  let n = String(t || '').replace(/\s+/g, ' ').trim()
    .replace(/^(bitte\s+)?(schreib|schreibe|erstell|erstelle|bau|baue|entwickle|programmier|programmiere|implementier|implementiere|mach|mache|leg|lege|setz|setze|recherchier|recherchiere)\s+(mir\s+|uns\s+)?((ein|eine|einen|das|die|den|der)\s+)?/i, '');
  // Am ersten Bindeglied kürzen – aber erst, wenn der Name schon etwas sagt („Markt für Mensa-Apps“, nicht „Markt“)
  const re = /\s[–-]\s|[:(;]|,\s|\s+(?:mit|für|und|das|die|der|welche[sr]?|um)\s+/g;
  let m, schnitt = n.length;
  while ((m = re.exec(n))) { if (m.index >= 14) { schnitt = m.index; break; } }
  n = n.slice(0, schnitt).trim();
  if (n.length > 48) n = n.slice(0, 46).replace(/\s+\S*$/, '') + ' …';
  return n ? n[0].toUpperCase() + n.slice(1) : 'Umsetzung';
}

function fusionArt(t) {
  if (/\b(csv|datensatz|datens[äa]tze|tabelle mit|daten erzeugen|testdaten)\b/i.test(t)) return 'daten';
  if (/\b(python|java|swift|ruby|c\+\+|programm|skript|script|code|tool|app|algorithm|funktion|klasse|website|html)/i.test(t)) return 'code';
  if (/\b(auswert|analys|berechn|statistik|finanzplan)/i.test(t)) return 'analyse';
  if (/\b(recherch|quellen|markt|wettbewerb)/i.test(t)) return 'recherche';
  return 'dokument';
}

function fusionAnbieten() {
  lyra.fusion.anbieten({
    planen: async (a, { status: melden }) => {
      z.lehrer = a.lehrer || z.lehrer;
      fusionMaterial = lyra.fusion.materialOhneAufgabe(a, 6000);
      z.idee = String(a.anweisung && a.aufgabe && a.anweisung !== a.aufgabe ? `${a.anweisung} (Gesamtaufgabe: ${a.aufgabe})` : a.anweisung || a.aufgabe || lyra.fusion.thema(a)).slice(0, 1200);
      z.fragen = [];
      const vorher = z.p;
      z.statusHook = melden;
      try { await planen(); } finally { fusionMaterial = ''; z.statusHook = null; }
      const p = z.p;
      if (!p || p === vorher) throw new Error(z.fehler || 'Launchpad konnte keinen Plan erstellen.');
      return {
        art: 'plan',
        titel: `Plan: ${p.name}`,
        markdown: projektMarkdown(p),
        daten: { name: p.name, ziel: p.ziel, vision: p.vision, erfolg: p.erfolg, risiken: p.risiken, meilensteine: p.abschnitte.map((s) => ({ titel: s.titel, bis: s.bis, aufgaben: p.aufgaben.filter((x) => x.abschnitt === s.id).map((x) => ({ titel: x.titel, minuten: x.minuten, art: x.art, kriterien: x.kriterien })) })) },
        oeffnen: 'projekt/' + p.id,
      };
    },
    umsetzen: async (a, { status: melden }) => {
      z.lehrer = a.lehrer || z.lehrer;
      const anweisung = text(a.anweisung) || text(a.aufgabe) || lyra.fusion.thema(a);
      if (!anweisung) throw new Error('Es fehlt, was umgesetzt werden soll.');
      const material = lyra.fusion.materialOhneAufgabe(a, 60000);
      const s = { id: neueId(), titel: 'Umsetzung', bis: '' };
      const art = fusionArt(anweisung);
      const p = {
        v: 2, id: lyra.neueId(), zeit: lyra.jetzt(), idee: anweisung, antworten: [],
        name: kurzName(anweisung), vision: '',
        ziel: text(a.aufgabe) && a.aufgabe !== anweisung ? `${anweisung} – als Teil von: ${a.aufgabe}`.slice(0, 400) : anweisung.slice(0, 400),
        erfolg: [], risiken: [], ressourcen: [], abschnitte: [s],
        aufgaben: [{
          id: neueId(), titel: anweisung.slice(0, 140), beschreibung: `${anweisung}${text(a.aufgabe) && a.aufgabe !== anweisung ? `\nGesamtaufgabe: ${a.aufgabe}` : ''}${material ? '\nDas Material der anderen Plugins liegt in material/eingaben.md.' : ''}`,
          kriterien: art === 'code' ? ['Der Code läuft ohne Fehler', 'Es gibt Unit-Tests, und sie sind grün', 'README.md erklärt Aufbau und Bedienung'] : art === 'daten' ? ['Der Datensatz wird per Skript erzeugt', 'Umfang und Spalten passen zur Anweisung', 'Eine kurze Auswertung prüft die Daten'] : ['Das Ergebnis ist vollständig und sofort verwendbar'],
          abschnitt: s.id, art, sprache: art === 'code' || art === 'daten' || art === 'analyse' ? 'python' : '', prioritaet: 'hoch', minuten: 120,
          status: 'offen', bericht: '', dateien: [], frage: '', antworten: [], tests: null, laeufe: 0, erledigtAm: null,
        }],
        einstellungen: { ...EINSTELLUNGEN, gruendlich: 'normal', plugins: false }, erinnern: false, verlauf: [], berichte: [],
      };
      z.p = p;
      z.dateien = material ? { 'material/eingaben.md': `# Material aus der Fusion\n\n${material}\n` } : {};
      z.protokoll = [];
      protokollieren('plan', 'Aus einer Fusion angelegt', anweisung);
      await sichern(p);
      await dateienSichern();
      z.statusHook = melden;
      let r;
      try { r = await erledigen(p.aufgaben[0].id, { fusion: true, ohneRueckfragen: true }); } finally { z.statusHook = null; }
      const auf = p.aufgaben[0];
      if (r !== 'fertig' && r !== 'limit') throw new Error(z.fehler || 'Launchpad konnte die Aufgabe nicht umsetzen.');
      const eigene = Object.keys(z.dateien).filter((x) => !x.startsWith('material/')).sort();
      const zeigen = eigene.filter((x) => SPRACHE_VON_ENDUNG[endung(x)] || ['md', 'html', 'css', 'js', 'json', 'sql'].includes(endung(x)));
      let budget = 40000;
      const bloecke = [];
      for (const x of zeigen) {
        const t = z.dateien[x];
        if (t.length > budget) continue;
        budget -= t.length;
        bloecke.push(`### \`${x}\`\n\n\`\`\`${endung(x) === 'py' ? 'python' : endung(x)}\n${t.replace(/```/g, '``\u200b`')}\n\`\`\``);
      }
      const datenDateien = eigene.filter((x) => ['csv', 'tsv', 'txt', 'log'].includes(endung(x))).map((x) => `- \`${x}\` – ${zeilenZahl(z.dateien[x]).toLocaleString('de-DE')} Zeilen, ${groesse(z.dateien[x].length)}`);
      const ausgabe = {};
      let gesamt = 0;
      for (const x of eigene) { if (gesamt + z.dateien[x].length > 4 * 1024 * 1024) continue; ausgabe[x] = z.dateien[x]; gesamt += z.dateien[x].length; }
      return {
        art: 'dokument',
        titel: `Umgesetzt: ${p.name}`,
        markdown: `# ${p.name}\n\n${auf.bericht}\n\n## Dateien im Arbeitsbereich\n${eigene.map((x) => `- \`${x}\` (${groesse(z.dateien[x].length)})`).join('\n')}\n${datenDateien.length ? `\n## Daten\n${datenDateien.join('\n')}\n` : ''}${bloecke.length ? `\n## Inhalte\n\n${bloecke.join('\n\n')}\n` : ''}`,
        daten: { dateien: ausgabe, tests: auf.tests, projekt: p.id },
        oeffnen: 'projekt/' + p.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
