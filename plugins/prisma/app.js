'use strict';
/*
 * Prisma – Datenanalyse für CSV und Excel: Tabelle ansehen, Kennzahlen je Spalte, Diagramme und Fragen an die Daten in
 * Alltagssprache. Für eine Frage schreibt die KI ein kleines Python-Programm, das abgeschottet auf deinem Mac rechnet –
 * die Tabelle selbst verlässt den Mac nie (an Claude & Co. gehen höchstens Spaltennamen und fünf Beispielzeilen).
 */
const { h } = lyra;

const STANDARD = { ki: 'auto' };
const ZEILEN_MAX = 50000;
const ANZEIGE_MAX = 300;
const CODE_MAX = 10 * 1024 * 1024;
const PALETTE = ['#2563EB', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#94A3B8'];
const ARTEN = [['saeulen', 'Säulen'], ['linie', 'Verlauf'], ['anteile', 'Anteile'], ['streuung', 'Streuung'], ['histogramm', 'Verteilung']];
const AGG = [['summe', 'Summe'], ['mittel', 'Mittelwert'], ['anzahl', 'Anzahl'], ['max', 'Maximum'], ['min', 'Minimum']];

const SYSTEM = `Du bist „Prisma“ in Lyra, ein sorgfältiger Datenanalyst. Du schreibst kurze, korrekte Python-3-Programme \
NUR mit der Standardbibliothek (csv, statistics, collections, datetime, math, itertools). Die Daten liegen in \
„daten.csv“: Komma als Trenner, Kopfzeile, Zahlen mit Dezimalpunkt, Datum als JJJJ-MM-TT, fehlende Werte sind leer. \
Lies sie mit csv.DictReader(open('daten.csv', encoding='utf-8')). Wandle Zahlen mit float() um und überspringe leere \
Werte. Das Programm gibt am Ende mit print() eine kurze Antwort auf Deutsch aus: zuerst ein Satz mit dem Ergebnis, \
dann bei Bedarf eine kleine Liste (eine Zeile je Eintrag, höchstens 20 Zeilen). Nenne im Antwortsatz immer die \
entscheidenden Zahlen (z. B. „… mit einem Mittelwert von 3,08“). Zahlen deutsch formatiert: Dezimalkomma, höchstens 2 \
Nachkommastellen – z. B. f"{x:.2f}".replace(".", ","). Keine Dateien schreiben, kein Netzwerk, keine Eingaben, kein pandas.`;

const SYSTEM_OHNE = `Du bist „Prisma“ in Lyra, ein sorgfältiger Datenanalyst. Du bekommst Kennzahlen einer Tabelle \
(nicht die ganze Tabelle) und beantwortest die Frage so genau, wie es die Kennzahlen erlauben. Sag ehrlich, wenn die \
Frage nur mit allen Zeilen genau zu beantworten ist. Kurz, auf Deutsch, Zahlen deutsch formatiert.`;

// Schlüssel alphabetisch sinnvoll: erst der Code, dann die Erklärung
const CODE_SCHEMA = {
  type: 'object',
  properties: { code: { type: 'string' }, erklaerung: { type: 'string' } },
  required: ['code', 'erklaerung'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  index: [], // [{id, name, zeilen, spalten, zeit}]
  t: null, // {id, name, spalten: [{name, typ, stil, excel}], zeilen: [[…]], fragen: [], zeit}
  reiter: 'tabelle',
  dia: { art: 'saeulen', x: -1, y: -1, agg: 'summe' },
  sort: { spalte: -1, ab: false },
  filter: '',
  frage: '',
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
  python: null,
  offeneCodes: new Set(),
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const zahlFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const fz = (n) => (Number.isFinite(n) ? zahlFormat.format(n) : '–');
const dunkel = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.index = ((await lyra.speicher.lesen('index')) || []).filter((e) => e && e.id); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.t) { z.t = null; z.fehler = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('tabelle/')) await oeffnen(route.slice(8));
  zeichnen();
  if (route === 'einstellungen') einstellungen();
}

// ================================================================== Einlesen

function zaehlenAusserhalb(zeile, zeichen) {
  let n = 0, q = false;
  for (const c of zeile) {
    if (c === '"') q = !q;
    else if (c === zeichen && !q) n++;
  }
  return n;
}

function modus(liste) {
  const m = new Map();
  for (const x of liste) m.set(x, (m.get(x) || 0) + 1);
  let best = { wert: 0, anzahl: 0 };
  for (const [wert, anzahl] of m) if (anzahl > best.anzahl || (anzahl === best.anzahl && wert > best.wert)) best = { wert, anzahl };
  return best;
}

/** CSV/TSV mit erkanntem Trennzeichen (; , Tab |) und Anführungszeichen → Zeilen von Zellen. */
function csvLesen(roh) {
  const t = roh.replace(/\r\n?/g, '\n');
  const probe = t.split('\n').slice(0, 40).filter((l) => l.trim());
  let trenner = ',', best = -1;
  for (const k of [';', ',', '\t', '|']) {
    const anz = probe.map((l) => zaehlenAusserhalb(l, k)).filter((n) => n > 0);
    if (!anz.length) continue;
    const m = modus(anz);
    const wert = m.anzahl * 10 + Math.min(m.wert, 30);
    if (wert > best) { best = wert; trenner = k; }
  }
  const zeilen = [];
  let feld = '', zeile = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { feld += '"'; i++; } else q = false; } else feld += c;
    } else if (c === '"' && feld.trim() === '') { q = true; feld = ''; }
    else if (c === trenner) { zeile.push(feld); feld = ''; }
    else if (c === '\n') {
      zeile.push(feld); zeilen.push(zeile); zeile = []; feld = '';
      if (zeilen.length > ZEILEN_MAX + 60) break;
    } else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function zahlStil(werte) {
  let de = 0, en = 0;
  for (const w of werte) {
    const s = String(w).replace(/[\s €$£%]/g, '');
    if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?-?$/.test(s) || /^[-+]?\d+,\d+-?$/.test(s)) de++;
    else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || /^[-+]?\d+\.\d+$/.test(s)) en++;
  }
  return de > en ? 'de' : 'en';
}

function zahl(w, stil) {
  if (typeof w === 'number') return w;
  let s = String(w ?? '').trim().replace(/[\s €$£%]/g, '');
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^[^-].*-$/.test(s)) { neg = true; s = s.slice(0, -1); }
  s = stil === 'de' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  const n = parseFloat(s);
  return neg ? -n : n;
}

/** Datum → Millisekunden (UTC) oder NaN. Excel-Seriennummern nur, wenn die Spalte nach Datum heißt. */
function datum(w, excel) {
  const s = String(w ?? '').trim();
  if (excel && /^\d{5}(\.\d+)?$/.test(s)) return Math.round((parseFloat(s) - 25569) * 86400000);
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s|$)/);
  if (m) { let j = +m[3]; if (j < 100) j += 2000; return Date.UTC(j, m[2] - 1, +m[1]); }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);
  if (m) return Date.UTC(+m[1], m[2] - 1, +m[3]);
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return Date.UTC(+m[1], m[2] - 1, +m[3]);
  return NaN;
}

const isoTag = (ms) => new Date(ms).toISOString().slice(0, 10);
const deTag = (ms) => new Date(ms).toLocaleDateString('de-DE', { timeZone: 'UTC' });

function spalteErkennen(name, werte) {
  const proben = werte.filter((w) => String(w ?? '').trim() !== '').slice(0, 600);
  const s = { name, typ: 'text', stil: 'en', excel: false };
  if (!proben.length) return s;
  s.excel = /datum|date|tag|day|zeit/i.test(name) && proben.every((w) => /^\d{5}(\.\d+)?$/.test(String(w).trim()));
  const daten = proben.filter((w) => Number.isFinite(datum(w, s.excel))).length;
  if (daten >= proben.length * 0.9) return { ...s, typ: 'datum' };
  s.stil = zahlStil(proben);
  const zahlen = proben.filter((w) => Number.isFinite(zahl(w, s.stil))).length;
  if (zahlen >= proben.length * 0.9) return { ...s, typ: 'zahl' };
  return s;
}

function tabelleBauen(roh, name) {
  const zeilen = roh.map((r) => r.map((c) => (c == null ? '' : String(c))));
  if (!zeilen.length) throw new Error('Die Datei enthält keine Tabelle.');
  const breiten = zeilen.slice(0, 60).map((r) => r.length).filter((n) => n > 1);
  const breite = breiten.length ? modus(breiten).wert : Math.max(...zeilen.map((r) => r.length));
  let kopf = zeilen.findIndex((r) => r.length >= breite && r.filter((c) => c.trim()).length >= Math.min(2, breite));
  if (kopf < 0) kopf = 0;
  let namen = zeilen[kopf].slice(0, breite).map((c) => c.trim());
  let daten = zeilen.slice(kopf + 1);
  // Kopfzeile, die nur aus Zahlen besteht, ist keine
  if (namen.length && namen.every((c) => c && Number.isFinite(zahl(c, 'en')))) {
    daten = zeilen.slice(kopf);
    namen = namen.map(() => '');
  }
  const gesehen = new Map();
  namen = Array.from({ length: breite }, (_, i) => {
    let n = namen[i] || `Spalte ${i + 1}`;
    const k = n.toLowerCase();
    if (gesehen.has(k)) { gesehen.set(k, gesehen.get(k) + 1); n = `${n} (${gesehen.get(k)})`; } else gesehen.set(k, 1);
    return n;
  });
  daten = daten.slice(0, ZEILEN_MAX).map((r) => {
    const x = r.slice(0, breite);
    while (x.length < breite) x.push('');
    return x;
  }).filter((r) => r.some((c) => c.trim()));
  if (!daten.length) throw new Error('Unter der Kopfzeile stehen keine Daten.');
  const spalten = namen.map((n, i) => spalteErkennen(n, daten.map((r) => r[i])));
  return { id: lyra.neueId(), name, spalten, zeilen: daten, fragen: [], zeit: lyra.jetzt(), gekuerzt: zeilen.length - kopf - 1 > ZEILEN_MAX };
}

function wert(r, i) {
  const s = z.t.spalten[i];
  if (s.typ === 'zahl') return zahl(r[i], s.stil);
  if (s.typ === 'datum') return datum(r[i], s.excel);
  return String(r[i] ?? '').trim();
}

function anzeige(r, i) {
  const s = z.t.spalten[i];
  const v = wert(r, i);
  if (s.typ === 'zahl') return Number.isFinite(v) ? fz(v) : '';
  if (s.typ === 'datum') return Number.isFinite(v) ? deTag(v) : '';
  return v;
}

async function dateiOeffnen() {
  z.fehler = null;
  try {
    const d = await lyra.dateiOeffnen({ arten: ['csv', 'tsv', 'xlsx', 'txt'], titel: 'Tabellen' });
    if (!d) return;
    const roh = d.art === 'tabelle' ? d.zeilen || [] : csvLesen(d.text || '');
    z.t = tabelleBauen(roh, d.name.replace(/\.[^.]+$/, ''));
    standardDiagramm();
    z.reiter = 'tabelle';
    await sichern();
  } catch (e) {
    z.fehler = String((e && e.message) || e);
  }
  zeichnen();
}

function beispielLaden() {
  const filialen = ['Berlin', 'Hamburg', 'München', 'Köln'];
  const produkte = ['Kaffee', 'Tee', 'Kakao', 'Gebäck'];
  const preis = { Kaffee: 3.4, Tee: 2.6, Kakao: 3.1, Gebäck: 2.2 };
  let s = 7;
  const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const roh = [['Datum', 'Filiale', 'Produkt', 'Menge', 'Umsatz (€)']];
  for (let tag = 0; tag < 180; tag += 3) {
    const d = new Date(Date.UTC(2025, 0, 1) + tag * 86400000);
    for (const f of filialen) {
      const p = produkte[Math.floor(zufall() * produkte.length)];
      const saison = 1 + 0.35 * Math.cos(((tag - 20) / 365) * 2 * Math.PI) * (p === 'Kakao' ? 1.6 : p === 'Tee' ? 0.8 : 0.2);
      const menge = Math.round((20 + zufall() * 60) * saison * (f === 'Berlin' ? 1.3 : 1));
      roh.push([d.toLocaleDateString('de-DE', { timeZone: 'UTC' }), f, p, String(menge), (menge * preis[p]).toFixed(2).replace('.', ',')]);
    }
  }
  z.t = tabelleBauen(roh, 'Beispiel: Café-Verkäufe');
  standardDiagramm();
  z.reiter = 'tabelle';
  sichern();
  zeichnen();
}

function standardDiagramm() {
  const sp = z.t.spalten;
  const zahlI = sp.map((s, i) => (s.typ === 'zahl' ? i : -1)).filter((i) => i >= 0);
  const datumI = sp.findIndex((s) => s.typ === 'datum');
  const textI = sp.findIndex((s, i) => s.typ === 'text' && verschiedene(i) <= 30);
  const y = zahlI.length ? zahlI[zahlI.length - 1] : -1;
  if (datumI >= 0 && y >= 0) z.dia = { art: 'linie', x: datumI, y, agg: 'summe' };
  else if (textI >= 0) z.dia = { art: 'saeulen', x: textI, y, agg: y >= 0 ? 'summe' : 'anzahl' };
  else if (zahlI.length >= 2) z.dia = { art: 'streuung', x: zahlI[0], y, agg: 'summe' };
  else z.dia = { art: 'histogramm', x: -1, y, agg: 'summe' };
}

function verschiedene(i) {
  const m = new Set();
  for (const r of z.t.zeilen) { m.add(String(r[i]).trim()); if (m.size > 500) break; }
  return m.size;
}

// ================================================================== Speichern

async function sichern() {
  if (!z.t) return;
  z.t.zeit = lyra.jetzt();
  try {
    await lyra.speicher.schreiben('tabellen/' + z.t.id, z.t);
  } catch (e) {
    z.meldung = 'Zu groß zum Speichern – die Tabelle bleibt nur geöffnet, solange Prisma läuft.';
  }
  const meta = { id: z.t.id, name: z.t.name, zeilen: z.t.zeilen.length, spalten: z.t.spalten.length, zeit: z.t.zeit };
  z.index = [meta, ...z.index.filter((e) => e.id !== z.t.id)].slice(0, 40);
  try { await lyra.speicher.schreiben('index', z.index); } catch (_) {}
}

async function oeffnen(id) {
  try {
    const t = await lyra.speicher.lesen('tabellen/' + id);
    if (t && t.zeilen) { z.t = t; z.t.fragen = z.t.fragen || []; standardDiagramm(); z.reiter = 'tabelle'; }
  } catch (_) {}
}

async function entfernen(id) {
  const ok = await lyra.dialog('Tabelle entfernen?', h('p', {}, 'Prisma vergisst die Tabelle samt deiner Fragen. Die Originaldatei bleibt, wo sie ist.'),
    [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Entfernen', wert: true }]);
  if (!ok) return;
  try { await lyra.speicher.loeschen('tabellen/' + id); } catch (_) {}
  z.index = z.index.filter((e) => e.id !== id);
  try { await lyra.speicher.schreiben('index', z.index); } catch (_) {}
  if (z.t && z.t.id === id) z.t = null;
  zeichnen();
}

// ================================================================== Kennzahlen

function kennzahlen(i) {
  const s = z.t.spalten[i];
  const roh = z.t.zeilen.map((r) => r[i]);
  const leer = roh.filter((w) => !String(w ?? '').trim()).length;
  if (s.typ === 'zahl' || s.typ === 'datum') {
    const v = z.t.zeilen.map((r) => wert(r, i)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return { leer, n: 0 };
    const n = v.length;
    const summe = v.reduce((a, b) => a + b, 0);
    const mittel = summe / n;
    const q = (p) => { const k = (n - 1) * p; const u = Math.floor(k); return v[u] + (v[Math.min(n - 1, u + 1)] - v[u]) * (k - u); };
    const std = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - mittel) ** 2, 0) / (n - 1)) : 0;
    const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
    const ausreisser = v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr).length;
    return { leer, n, summe, mittel, median: q(0.5), min: v[0], max: v[n - 1], std, q1, q3, ausreisser };
  }
  const m = new Map();
  for (const w of roh) { const k = String(w ?? '').trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return { leer, n: roh.length - leer, verschieden: m.size, haeufig: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
}

// ================================================================== Diagramme (SVG)

function schritte(min, max, anzahl = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const roh = (max - min) / anzahl;
  const p = Math.pow(10, Math.floor(Math.log10(roh)));
  const f = roh / p;
  const schritt = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const a = Math.floor(min / schritt) * schritt, b = Math.ceil(max / schritt) * schritt;
  const t = [];
  for (let v = a; v <= b + schritt / 2 && t.length < 30; v += schritt) t.push(+v.toPrecision(12));
  return t;
}

const kurz = (s, n = 14) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const kompakt = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return fz(n / 1e9) + ' Mrd.';
  if (a >= 1e6) return fz(n / 1e6) + ' Mio.';
  if (a >= 1e4) return fz(n / 1e3) + ' Tsd.';
  return fz(n);
};

function aggregieren(werte, agg) {
  const v = werte.filter(Number.isFinite);
  if (agg === 'anzahl') return werte.length;
  if (!v.length) return NaN;
  if (agg === 'summe') return v.reduce((a, b) => a + b, 0);
  if (agg === 'mittel') return v.reduce((a, b) => a + b, 0) / v.length;
  if (agg === 'max') return Math.max(...v);
  if (agg === 'min') return Math.min(...v);
  return NaN;
}

/** Gruppen für Säulen, Anteile und Verlauf: [{name, wert, x?}] */
function gruppen(d) {
  const sx = z.t.spalten[d.x];
  const m = new Map();
  let monat = false;
  if (sx.typ === 'datum') {
    const tage = z.t.zeilen.map((r) => wert(r, d.x)).filter(Number.isFinite);
    monat = tage.length && Math.max(...tage) - Math.min(...tage) > 92 * 86400000;
  }
  for (const r of z.t.zeilen) {
    let k = wert(r, d.x), x = k;
    if (sx.typ === 'datum') {
      if (!Number.isFinite(k)) continue;
      if (monat) { const t = new Date(k); x = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1); k = x; }
    } else if (sx.typ === 'zahl') {
      if (!Number.isFinite(k)) continue;
    } else if (!k) k = '(leer)';
    if (!m.has(k)) m.set(k, { x, werte: [] });
    m.get(k).werte.push(d.y >= 0 ? wert(r, d.y) : 1);
  }
  const l = [...m.entries()].map(([k, g]) => ({
    name: sx.typ === 'datum' ? (monat ? new Date(g.x).toLocaleDateString('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : deTag(g.x)) : sx.typ === 'zahl' ? fz(k) : k,
    x: g.x,
    wert: aggregieren(g.werte, d.y >= 0 ? d.agg : 'anzahl'),
  })).filter((g) => Number.isFinite(g.wert));
  return { liste: l, sortiert: sx.typ !== 'text' };
}

function diagramm(d, farben) {
  const W = 760, H = 400, L = 70, R = 24, O = 22, U = 78;
  const iw = W - L - R, ih = H - O - U;
  const sp = z.t.spalten;
  const teile = [];
  const tx = (x, y, t, a = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${a.farbe || farben.text}" font-size="${a.groesse || 11.5}" text-anchor="${a.anker || 'middle'}"${a.dreh ? ` transform="rotate(${a.dreh} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''} font-family="-apple-system, Helvetica, Arial, sans-serif">${lyra.esc(String(t))}</text>`;
  const yAchse = (t, titel) => {
    const [a, b] = [t[0], t[t.length - 1]];
    const py = (v) => O + ih - ((v - a) / (b - a || 1)) * ih;
    for (const v of t) {
      teile.push(`<line x1="${L}" x2="${W - R}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}" stroke="${farben.gitter}" stroke-width="1"/>`);
      teile.push(tx(L - 8, py(v) + 4, kompakt(v), { anker: 'end' }));
    }
    if (titel) teile.push(tx(16, O + ih / 2, titel, { dreh: -90, groesse: 12 }));
    return py;
  };
  const yTitel = d.y >= 0 ? `${AGG.find((a) => a[0] === d.agg)[1]} von ${sp[d.y].name}` : 'Anzahl';

  if (d.art === 'histogramm') {
    if (d.y < 0) return { fehler: 'Wähle eine Zahlenspalte.' };
    const v = z.t.zeilen.map((r) => wert(r, d.y)).filter(Number.isFinite);
    if (v.length < 2) return { fehler: 'Zu wenige Zahlen für eine Verteilung.' };
    const min = Math.min(...v), max = Math.max(...v);
    const k = Math.max(5, Math.min(20, Math.ceil(Math.log2(v.length) + 1)));
    const breite = (max - min) / k || 1;
    const faecher = Array.from({ length: k }, (_, i) => ({ von: min + i * breite, n: 0 }));
    for (const x of v) faecher[Math.min(k - 1, Math.floor((x - min) / breite))].n++;
    const py = yAchse(schritte(0, Math.max(...faecher.map((f) => f.n))), 'Anzahl');
    const bw = iw / k;
    faecher.forEach((f, i) => {
      const x = L + i * bw;
      teile.push(`<rect x="${(x + 1).toFixed(1)}" y="${py(f.n).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(O + ih - py(f.n)).toFixed(1)}" rx="3" fill="${farben.akzent}"><title>${lyra.esc(`${fz(f.von)} – ${fz(f.von + breite)}: ${f.n}`)}</title></rect>`);
      if (i % Math.ceil(k / 8) === 0) teile.push(tx(x, O + ih + 18, kompakt(f.von)));
    });
    teile.push(tx(L + iw / 2, H - 14, sp[d.y].name, { groesse: 12 }));
  } else if (d.art === 'streuung') {
    if (d.x < 0 || d.y < 0 || sp[d.x].typ === 'text') return { fehler: 'Für Streuung brauchst du zwei Zahlen- oder Datumsspalten.' };
    const p = [];
    for (const r of z.t.zeilen) { const a = wert(r, d.x), b = wert(r, d.y); if (Number.isFinite(a) && Number.isFinite(b)) p.push([a, b]); }
    if (p.length < 2) return { fehler: 'Zu wenige Wertepaare.' };
    const punkte = p.length > 4000 ? lyra.mischen(p).slice(0, 4000) : p;
    const ty = schritte(Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1])));
    const tX = schritte(Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0])));
    const py = yAchse(ty, sp[d.y].name);
    const px = (v) => L + ((v - tX[0]) / (tX[tX.length - 1] - tX[0] || 1)) * iw;
    for (const v of tX) teile.push(tx(px(v), O + ih + 18, sp[d.x].typ === 'datum' ? deTag(v) : kompakt(v)));
    const r = punkte.length > 800 ? 2.2 : 3.4;
    for (const [a, b] of punkte) teile.push(`<circle cx="${px(a).toFixed(1)}" cy="${py(b).toFixed(1)}" r="${r}" fill="${farben.akzent}" fill-opacity="0.55"/>`);
    // Trendlinie (kleinste Quadrate) und Korrelation
    const n = p.length, mx = p.reduce((s, q) => s + q[0], 0) / n, my = p.reduce((s, q) => s + q[1], 0) / n;
    const sxy = p.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0), sxx = p.reduce((s, q) => s + (q[0] - mx) ** 2, 0), syy = p.reduce((s, q) => s + (q[1] - my) ** 2, 0);
    if (sxx > 0 && syy > 0) {
      const m = sxy / sxx, b = my - m * mx, korr = sxy / Math.sqrt(sxx * syy);
      const x1 = tX[0], x2 = tX[tX.length - 1];
      teile.push(`<line x1="${px(x1).toFixed(1)}" y1="${py(m * x1 + b).toFixed(1)}" x2="${px(x2).toFixed(1)}" y2="${py(m * x2 + b).toFixed(1)}" stroke="${farben.zweit}" stroke-width="2" stroke-dasharray="6 5"/>`);
      teile.push(tx(W - R, O + 12, `Korrelation r = ${fz(korr)}`, { anker: 'end', farbe: farben.zweit, groesse: 12 }));
    }
    teile.push(tx(L + iw / 2, H - 14, sp[d.x].name, { groesse: 12 }));
  } else {
    if (d.x < 0) return { fehler: 'Wähle, wonach gruppiert wird.' };
    const { liste, sortiert } = gruppen(d);
    if (!liste.length) return { fehler: 'Keine Werte für diese Auswahl.' };
    let l = liste;
    if (sortiert || d.art === 'linie') l = [...l].sort((a, b) => a.x - b.x);
    else l = [...l].sort((a, b) => b.wert - a.wert);
    if (d.art === 'anteile') {
      const pos = l.filter((g) => g.wert > 0).sort((a, b) => b.wert - a.wert);
      if (!pos.length) return { fehler: 'Anteile gehen nur mit positiven Werten.' };
      const top = pos.slice(0, 7);
      const rest = pos.slice(7).reduce((a, g) => a + g.wert, 0);
      if (rest > 0) top.push({ name: 'Rest', wert: rest });
      const summe = top.reduce((a, g) => a + g.wert, 0);
      const cx = 220, cy = H / 2, ra = 150, ri = 86;
      let w = -Math.PI / 2;
      top.forEach((g, i) => {
        const anteil = g.wert / summe;
        const w2 = w + anteil * Math.PI * 2;
        const gross = w2 - w > Math.PI ? 1 : 0;
        const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
        const f = i === top.length - 1 && g.name === 'Rest' ? farben.rest : PALETTE[i % (PALETTE.length - 1)];
        const pfad = anteil >= 0.9999
          ? `<circle cx="${cx}" cy="${cy}" r="${(ra + ri) / 2}" fill="none" stroke="${f}" stroke-width="${ra - ri}"/>`
          : `<path d="M${p(ra, w)} A${ra} ${ra} 0 ${gross} 1 ${p(ra, w2)} L${p(ri, w2)} A${ri} ${ri} 0 ${gross} 0 ${p(ri, w)} Z" fill="${f}" stroke="${farben.grund}" stroke-width="2"><title>${lyra.esc(`${g.name}: ${fz(g.wert)}`)}</title></path>`;
        teile.push(pfad);
        const ly = 60 + i * 34;
        teile.push(`<rect x="430" y="${ly - 11}" width="14" height="14" rx="4" fill="${f}"/>`);
        teile.push(tx(452, ly, kurz(g.name, 26), { anker: 'start', groesse: 13 }));
        teile.push(tx(W - R, ly, `${fz(anteil * 100)} %`, { anker: 'end', groesse: 13 }));
        w = w2;
      });
      teile.push(tx(cx, cy - 2, kompakt(summe), { groesse: 20, farbe: farben.stark }));
      teile.push(tx(cx, cy + 18, 'gesamt', { groesse: 11.5 }));
    } else {
      const zuViele = d.art === 'saeulen' && l.length > 24;
      if (zuViele) l = l.slice(0, 24);
      const werte = l.map((g) => g.wert);
      const py = yAchse(schritte(Math.min(0, ...werte), Math.max(0, ...werte)), yTitel);
      const bw = iw / l.length;
      const dreh = l.length > 8;
      const jede = Math.ceil(l.length / (d.art === 'linie' ? 10 : 24));
      if (d.art === 'saeulen') {
        l.forEach((g, i) => {
          const x = L + i * bw, y0 = py(0), y1 = py(g.wert);
          teile.push(`<rect x="${(x + bw * 0.14).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${Math.abs(y0 - y1).toFixed(1)}" rx="${Math.min(6, bw * 0.15).toFixed(1)}" fill="${g.wert < 0 ? farben.negativ : farben.akzent}"><title>${lyra.esc(`${g.name}: ${fz(g.wert)}`)}</title></rect>`);
          if (l.length <= 12) teile.push(tx(x + bw / 2, y1 - 6, kompakt(g.wert), { groesse: 10.5, farbe: farben.stark }));
        });
      } else {
        const pkt = l.map((g, i) => [L + bw * (i + 0.5), py(g.wert)]);
        const linie = pkt.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('');
        teile.push(`<path d="${linie} L${pkt[pkt.length - 1][0].toFixed(1)} ${py(Math.max(0, Math.min(...werte))).toFixed(1)} L${pkt[0][0].toFixed(1)} ${py(Math.max(0, Math.min(...werte))).toFixed(1)} Z" fill="${farben.akzent}" fill-opacity="0.12"/>`);
        teile.push(`<path d="${linie}" fill="none" stroke="${farben.akzent}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`);
        if (pkt.length <= 40) pkt.forEach((q, i) => teile.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.4" fill="${farben.grund}" stroke="${farben.akzent}" stroke-width="2"><title>${lyra.esc(`${l[i].name}: ${fz(l[i].wert)}`)}</title></circle>`));
      }
      l.forEach((g, i) => {
        if (i % jede) return;
        const x = L + bw * (i + 0.5);
        teile.push(dreh ? tx(x, O + ih + 14, kurz(g.name), { anker: 'end', dreh: -38 }) : tx(x, O + ih + 18, kurz(g.name)));
      });
      if (zuViele) teile.push(tx(W - R, O + 10, `nur die 24 größten von ${liste.length}`, { anker: 'end', groesse: 11 }));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${farben.grund}"/>${teile.join('')}</svg>`;
  return { svg, W, H };
}

const FARBEN_HELL = { akzent: '#2563EB', zweit: '#EA580C', text: '#6B6F80', stark: '#1A1B25', gitter: '#E8EAF0', grund: '#FFFFFF', negativ: '#E5484D', rest: '#CBD5E1' };
const FARBEN_DUNKEL = { akzent: '#60A5FA', zweit: '#FB923C', text: '#9A9FB0', stark: '#ECECF1', gitter: '#2A2D35', grund: '#1D1F24', negativ: '#F07F83', rest: '#475569' };

function alsPng(svg, W, H) {
  return new Promise((fertig, fehler) => {
    const bild = new Image();
    bild.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d');
      g.scale(2, 2);
      g.drawImage(bild, 0, 0, W, H);
      fertig(c.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
    };
    bild.onerror = () => fehler(new Error('Bild ließ sich nicht erzeugen.'));
    bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function diagrammSichern(art) {
  const d = diagramm(z.dia, FARBEN_HELL);
  if (!d.svg) return;
  const name = `${z.t.name} – ${ARTEN.find((a) => a[0] === z.dia.art)[1]}`.replace(/[/:\\]/g, '-');
  try {
    const ok = art === 'svg' ? await lyra.speichern(name + '.svg', d.svg) : await lyra.speichern(name + '.png', await alsPng(d.svg, d.W, d.H), true);
    z.meldung = ok ? `✓ Diagramm als ${art.toUpperCase()} gesichert` : '';
  } catch (e) { z.meldung = String((e && e.message) || e); }
  zeichnen();
}

// ================================================================== Fragen an die Daten

async function pythonPruefen() {
  try {
    const l = await lyra.codeSprachen();
    const p = (l || []).find((s) => /python/i.test(s.name));
    z.python = !!(p && p.vorhanden);
  } catch (_) { z.python = false; }
}

const csvFeld = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function csvFuerCode(grenze = Infinity) {
  const sp = z.t.spalten;
  const zeilen = [sp.map((s) => csvFeld(s.name)).join(',')];
  let laenge = zeilen[0].length;
  for (const r of z.t.zeilen.slice(0, grenze)) {
    const z2 = sp.map((s, i) => {
      const v = wert(r, i);
      if (s.typ === 'zahl') return Number.isFinite(v) ? String(v) : '';
      if (s.typ === 'datum') return Number.isFinite(v) ? isoTag(v) : '';
      return csvFeld(String(v));
    }).join(',');
    laenge += z2.length + 1;
    if (laenge > CODE_MAX) throw new Error('Die Tabelle ist für Fragen zu groß (höchstens 10 MB).');
    zeilen.push(z2);
  }
  return zeilen.join('\n') + '\n';
}

function beschreibung() {
  const sp = z.t.spalten;
  const typ = { zahl: 'Zahl', datum: 'Datum', text: 'Text' };
  const zeilen = sp.map((s, i) => {
    const bsp = [];
    for (const r of z.t.zeilen) { const a = anzeige(r, i); if (a && !bsp.includes(a)) bsp.push(kurz(a, 30)); if (bsp.length >= 3) break; }
    return `- ${s.name} – ${typ[s.typ]} – z. B. ${bsp.join(' | ') || '(leer)'}`;
  });
  return `Tabelle „${z.t.name}“ mit ${z.t.zeilen.length} Zeilen.\nSpalten (Name – Typ – Beispiele):\n${zeilen.join('\n')}\n\nDie ersten Zeilen von daten.csv:\n${csvFuerCode(5)}`;
}

function kennzahlenText() {
  return z.t.spalten.map((s, i) => {
    const k = kennzahlen(i);
    if (s.typ === 'text') return `${s.name} (Text): ${k.verschieden} verschiedene, häufig: ${(k.haeufig || []).map(([w, n]) => `${w} (${n}×)`).join(', ')}`;
    if (s.typ === 'datum') return `${s.name} (Datum): von ${k.n ? deTag(k.min) : '–'} bis ${k.n ? deTag(k.max) : '–'}`;
    return `${s.name} (Zahl): n=${k.n}, Summe ${fz(k.summe)}, Mittel ${fz(k.mittel)}, Median ${fz(k.median)}, Min ${fz(k.min)}, Max ${fz(k.max)}, Std ${fz(k.std)}`;
  }).join('\n');
}

function codeBereinigen(c) {
  let s = String(c || '').trim();
  const m = s.match(/```(?:python|py)?\s*\n([\s\S]*?)```/);
  if (m) s = m[1];
  return s.trim();
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

async function fragen(vorgabe) {
  const frage = text(vorgabe || z.frage);
  if (!frage || z.laeuft || !z.t) return;
  z.frage = frage;
  z.laeuft = true;
  z.fehler = null;
  status('Prisma überlegt, wie es rechnen soll …');
  zeichnen();
  const eintrag = { id: lyra.neueId(), frage, zeit: lyra.jetzt() };
  const hinweis = (e) => { if (e.art === 'hinweis') status(e.text); };
  try {
    if (z.python === null) await pythonPruefen();
    if (!z.python) {
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM_OHNE,
        prompt: `Tabelle „${z.t.name}“, ${z.t.zeilen.length} Zeilen. Kennzahlen je Spalte:\n${kennzahlenText()}\n\nFrage: ${frage}`,
      }, hinweis);
      if (r && r.lehrer) z.lehrer = r.lehrer;
      eintrag.antwort = text(r && r.text);
      eintrag.geschaetzt = true;
    } else {
      const besch = beschreibung();
      const daten = csvFuerCode();
      let code = '', fehler = '';
      for (let versuch = 1; versuch <= 3 && !eintrag.antwort; versuch++) {
        if (versuch > 1) status(`Das Programm hatte einen Fehler – Prisma bessert nach (Versuch ${versuch}/3) …`);
        const r = await lyra.ki({
          lehrer: z.lehrer,
          system: SYSTEM,
          prompt: `${besch}\nFrage: ${frage}\n\nSchreibe ein Python-3-Programm (nur Standardbibliothek), das daten.csv liest und \
die Frage genau beantwortet. Nutze die Spaltennamen exakt so, wie sie oben stehen.${fehler ? `\n\nDein letzter Versuch:\n${code}\n\nFehlermeldung:\n${fehler}\n\nBessere ihn aus.` : ''}\n\n\
Antwort als JSON: {"code": "…", "erklaerung": "ein Satz, wie du rechnest"}`,
          schema: CODE_SCHEMA,
        }, hinweis);
        if (r && r.lehrer) z.lehrer = r.lehrer;
        code = codeBereinigen(r && r.json && r.json.code);
        eintrag.erklaerung = text(r && r.json && r.json.erklaerung);
        if (!code) { fehler = 'Es kam kein Programm zurück.'; continue; }
        status('Rechnet abgeschottet auf deinem Mac …');
        const e = await lyra.code({ sprache: 'python', dateien: { 'daten.csv': daten, 'analyse.py': code }, start: 'analyse.py', sekunden: 25 });
        if (e && e.ok && text(e.ausgabe)) eintrag.antwort = e.ausgabe.trim().slice(0, 8000);
        else fehler = ((e && e.zeitUm) ? 'Zeitlimit (25 s) überschritten.\n' : '') + String((e && (e.fehler || e.ausgabe)) || 'Keine Ausgabe.').slice(-1500);
      }
      eintrag.code = code;
      if (!eintrag.antwort) throw new Error('Prisma hat es nicht geschafft, die Frage fehlerfrei auszurechnen. Formulier sie genauer oder nenn die Spalte.');
    }
    z.t.fragen = [eintrag, ...(z.t.fragen || [])].slice(0, 40);
    z.frage = '';
    await sichern();
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

function vorschlaege() {
  const sp = z.t.spalten;
  const zahlS = sp.filter((s) => s.typ === 'zahl');
  const textS = sp.filter((s, i) => s.typ === 'text' && verschiedene(i) <= 40);
  const datS = sp.find((s) => s.typ === 'datum');
  const v = [];
  if (zahlS.length && textS.length) v.push(`Welche ${textS[0].name} hat die höchste Summe bei ${zahlS[zahlS.length - 1].name}?`);
  if (zahlS.length && datS) v.push(`Wie hat sich ${zahlS[zahlS.length - 1].name} pro Monat entwickelt?`);
  if (zahlS.length) v.push(`Gibt es Ausreißer bei ${zahlS[0].name}?`);
  if (zahlS.length >= 2) v.push(`Hängen ${zahlS[0].name} und ${zahlS[1].name} zusammen?`);
  if (textS.length >= 2) v.push(`Wie oft kommt jede Kombination aus ${textS[0].name} und ${textS[1].name} vor?`);
  return v.slice(0, 4);
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.t ? tabellenAnsicht() : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.t ? z.t.name : '');
}

function startAnsicht() {
  return h('div', { class: 'seite' },
    lyra.kopf({ titel: 'Deine Daten verstehen', unter: 'Öffne eine Tabelle – Prisma zeigt Kennzahlen und Diagramme und beantwortet Fragen in Alltagssprache.' }),
    h('button', { class: 'oeffnen-flaeche', onclick: dateiOeffnen },
      h('div', { class: 'oeffnen-symbol' }, '▦'),
      h('div', { class: 'fett', style: { fontSize: '17px' } }, 'CSV- oder Excel-Datei öffnen'),
      h('div', { class: 'leise klein' }, 'Kontoauszug, Umfrage, Messreihe, Verkaufsliste … – du wählst die Datei in Lyras Dialog. Sie bleibt auf deinem Mac.')),
    h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '10px' } },
      h('button', { class: 'knopf text', onclick: beispielLaden }, 'Mit Beispieldaten ausprobieren')),
    z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
    z.index.length ? h('div', { style: { marginTop: '22px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Zuletzt geöffnet'),
      h('div', { class: 'raster' }, z.index.map((e) => h('div', { class: 'karte klickbar', onclick: async () => { await oeffnen(e.id); zeichnen(); } },
        h('div', { class: 'zeile' },
          h('div', { class: 'wachsen fett' }, e.name),
          h('button', { class: 'knopf symbol', title: 'Entfernen', onclick: (ev) => { ev.stopPropagation(); entfernen(e.id); } }, '✕')),
        h('div', { class: 'klein leise' }, `${fz(e.zeilen)} Zeilen · ${e.spalten} Spalten · ${new Date(e.zeit * 1000).toLocaleDateString('de-DE')}`))))) : null,
    h('div', { class: 'klein leise mitte', style: { marginTop: '26px' } },
      'Fragen beantwortet Prisma mit einem kleinen Python-Programm, das abgeschottet auf deinem Mac rechnet. An Claude, ChatGPT oder Gemini gehen höchstens Spaltennamen und fünf Beispielzeilen – nie die ganze Tabelle.'));
}

function tabellenAnsicht() {
  const t = z.t;
  const reiter = [['tabelle', 'Tabelle'], ['kennzahlen', 'Kennzahlen'], ['diagramm', 'Diagramm'], ['fragen', 'Fragen']];
  const inhalt = { tabelle: tabelleTeil, kennzahlen: kennzahlenTeil, diagramm: diagrammTeil, fragen: fragenTeil }[z.reiter]();
  return h('div', { class: 'seite breit' },
    lyra.kopf({
      titel: t.name,
      unter: `${fz(t.zeilen.length)} Zeilen · ${t.spalten.length} Spalten${t.gekuerzt ? ` · gekürzt auf ${fz(ZEILEN_MAX)} Zeilen` : ''}`,
      zurueck: { titel: 'Alle Tabellen', bei: () => { z.t = null; z.fehler = null; zeichnen(); } },
      aktionen: [h('button', { class: 'knopf tonal klein', onclick: dateiOeffnen }, 'Andere Datei …')],
    }),
    lyra.reiter(reiter.map(([k, n]) => [k, n, k === 'fragen' && (t.fragen || []).length ? t.fragen.length : null]), z.reiter, (k) => { z.reiter = k; z.meldung = ''; zeichnen(); }),
    z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
    inhalt);
}

function typEtikett(s) {
  const n = { zahl: ['123', 'Zahl'], datum: ['📅', 'Datum'], text: ['Aa', 'Text'] }[s.typ];
  return h('span', { class: 'typ typ-' + s.typ, title: n[1] }, n[0]);
}

function tabelleTeil() {
  const t = z.t;
  const filter = h('input', { class: 'eingabe', 'data-feld': 'filter', placeholder: 'In der Tabelle suchen …', value: z.filter });
  filter.addEventListener('input', () => { z.filter = filter.value; zeichnen(); });
  let zeilen = t.zeilen;
  const f = z.filter.trim().toLowerCase();
  if (f) zeilen = zeilen.filter((r) => r.some((c) => String(c).toLowerCase().includes(f)));
  if (z.sort.spalte >= 0) {
    const i = z.sort.spalte, typ = t.spalten[i].typ;
    zeilen = [...zeilen].sort((a, b) => {
      const x = wert(a, i), y = wert(b, i);
      const r = typ === 'text' ? String(x).localeCompare(String(y), 'de') : (Number.isFinite(x) ? x : Infinity) - (Number.isFinite(y) ? y : Infinity);
      return z.sort.ab ? -r : r;
    });
  }
  const sichtbar = zeilen.slice(0, ANZEIGE_MAX);
  return h('div', {},
    h('div', { class: 'zeile', style: { marginBottom: '10px' } }, filter,
      h('span', { class: 'leise klein', style: { whiteSpace: 'nowrap' } }, f ? `${fz(zeilen.length)} Treffer` : '')),
    h('div', { class: 'tabelle-rahmen' },
      h('table', { class: 'daten' },
        h('thead', {}, h('tr', {}, h('th', { class: 'nr' }, '#'), t.spalten.map((s, i) => h('th', {
          class: s.typ === 'zahl' ? 'rechts' : '',
          onclick: () => { z.sort = { spalte: i, ab: z.sort.spalte === i ? !z.sort.ab : false }; zeichnen(); },
        }, h('span', { class: 'zeile', style: { gap: '6px', justifyContent: s.typ === 'zahl' ? 'flex-end' : 'flex-start' } },
          typEtikett(s), s.name, z.sort.spalte === i ? (z.sort.ab ? ' ↓' : ' ↑') : ''))))),
        h('tbody', {}, sichtbar.map((r, n) => h('tr', {}, h('td', { class: 'nr' }, String(n + 1)),
          t.spalten.map((s, i) => h('td', { class: s.typ === 'zahl' ? 'rechts' : '' }, anzeige(r, i)))))))),
    zeilen.length > ANZEIGE_MAX ? h('div', { class: 'leise klein', style: { marginTop: '8px' } },
      `Angezeigt: die ersten ${ANZEIGE_MAX} von ${fz(zeilen.length)} Zeilen – Kennzahlen, Diagramme und Fragen nutzen alle.`) : null,
    h('div', { class: 'leise klein', style: { marginTop: '8px' } }, 'Spaltentyp falsch erkannt? Klick in „Kennzahlen“ auf den Typ, um ihn zu ändern.'));
}

function kennzahlenTeil() {
  const t = z.t;
  return h('div', { class: 'raster breiter' }, t.spalten.map((s, i) => {
    const k = kennzahlen(i);
    const typWahl = h('select', { class: 'typ-wahl', onchange: (e) => { s.typ = e.target.value; if (s.typ === 'zahl') s.stil = zahlStil(t.zeilen.map((r) => r[i]).slice(0, 600)); sichern(); zeichnen(); } },
      [['zahl', 'Zahl'], ['datum', 'Datum'], ['text', 'Text']].map(([w, n]) => h('option', { value: w, selected: s.typ === w }, n)));
    const zeile = (a, b) => h('div', { class: 'kz' }, h('span', { class: 'leise' }, a), h('span', { class: 'fett' }, b));
    let teil;
    if (s.typ === 'zahl') {
      teil = !k.n ? h('div', { class: 'leise' }, 'Keine Zahlen erkannt.') : h('div', {},
        zeile('Summe', fz(k.summe)), zeile('Mittelwert', fz(k.mittel)), zeile('Median', fz(k.median)),
        zeile('Minimum', fz(k.min)), zeile('Maximum', fz(k.max)), zeile('Standardabweichung', fz(k.std)),
        zeile('Quartile', `${fz(k.q1)} – ${fz(k.q3)}`),
        k.ausreisser ? zeile('Auffällige Werte', `${k.ausreisser}`) : null,
        miniVerteilung(i, k));
    } else if (s.typ === 'datum') {
      teil = !k.n ? h('div', { class: 'leise' }, 'Kein Datum erkannt.') : h('div', {},
        zeile('Von', deTag(k.min)), zeile('Bis', deTag(k.max)), zeile('Zeitraum', `${fz(Math.round((k.max - k.min) / 86400000))} Tage`));
    } else {
      teil = h('div', {}, zeile('Verschiedene Werte', fz(k.verschieden)),
        h('div', { class: 'haeufig' }, (k.haeufig || []).map(([w, n]) => h('div', { class: 'zeile', style: { gap: '8px' } },
          h('span', { class: 'wachsen', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, w),
          h('span', { class: 'leise klein' }, `${n}×`),
          h('div', { style: { width: '70px' } }, lyra.balken(n / (k.n || 1), 'var(--akzent)', true))))));
    }
    return h('div', { class: 'karte kz-karte' },
      h('div', { class: 'zeile', style: { marginBottom: '8px' } }, typEtikett(s), h('div', { class: 'wachsen fett' }, s.name), typWahl),
      teil,
      h('div', { class: 'klein leise', style: { marginTop: '6px' } }, `${fz(k.n)} Werte${k.leer ? ` · ${fz(k.leer)} leer` : ''}`));
  }));
}

function miniVerteilung(i, k) {
  if (!(k.max > k.min)) return null;
  const v = z.t.zeilen.map((r) => wert(r, i)).filter(Number.isFinite);
  const n = 16, b = (k.max - k.min) / n;
  const f = new Array(n).fill(0);
  for (const x of v) f[Math.min(n - 1, Math.floor((x - k.min) / b))]++;
  const m = Math.max(...f);
  return h('div', { class: 'mini', title: 'Verteilung' }, f.map((c) => h('div', { style: { height: `${Math.max(2, (c / m) * 100)}%` } })));
}

function diagrammTeil() {
  const sp = z.t.spalten;
  const d = z.dia;
  const auswahl = (wert, liste, bei) => h('select', { class: 'eingabe kompakt', onchange: (e) => { bei(e.target.value); zeichnen(); } },
    liste.map(([w, n]) => h('option', { value: w, selected: String(wert) === String(w) }, n)));
  const alle = sp.map((s, i) => [i, s.name]);
  const zahlen = sp.map((s, i) => [i, s.name]).filter(([i]) => sp[i].typ === 'zahl');
  const braucht = { saeulen: ['x', 'y'], linie: ['x', 'y'], anteile: ['x', 'y'], streuung: ['x', 'y'], histogramm: ['y'] }[d.art];
  const ergebnis = diagramm(d, dunkel() ? FARBEN_DUNKEL : FARBEN_HELL);
  const flaeche = h('div', { class: 'diagramm' });
  if (ergebnis.svg) flaeche.innerHTML = ergebnis.svg;
  else flaeche.appendChild(h('div', { class: 'leise mitte', style: { padding: '60px 0' } }, ergebnis.fehler));
  return h('div', {},
    h('div', { class: 'zeile umbruch', style: { gap: '6px', marginBottom: '10px' } },
      ARTEN.map(([k, n]) => h('button', { class: 'chip' + (d.art === k ? ' an' : ''), onclick: () => { d.art = k; zeichnen(); } }, n))),
    h('div', { class: 'zeile umbruch', style: { gap: '10px', marginBottom: '12px' } },
      braucht.includes('x') ? h('label', { class: 'feld' }, d.art === 'streuung' ? 'Waagrecht' : 'Gruppiert nach',
        auswahl(d.x, [[-1, '–'], ...(d.art === 'streuung' ? alle.filter(([i]) => sp[i].typ !== 'text') : alle)], (v) => { d.x = +v; })) : null,
      d.art !== 'streuung' && d.art !== 'histogramm' ? h('label', { class: 'feld' }, 'Berechnung',
        auswahl(d.y >= 0 ? d.agg : 'anzahl', d.y >= 0 ? AGG : [['anzahl', 'Anzahl']], (v) => { d.agg = v; })) : null,
      h('label', { class: 'feld' }, d.art === 'streuung' ? 'Senkrecht' : 'Wert',
        auswahl(d.y, [[-1, d.art === 'histogramm' || d.art === 'streuung' ? '–' : '(Anzahl der Zeilen)'], ...zahlen], (v) => { d.y = +v; })),
      h('span', { class: 'wachsen' }),
      ergebnis.svg ? h('button', { class: 'knopf tonal klein', onclick: () => diagrammSichern('png') }, 'Als PNG sichern') : null,
      ergebnis.svg ? h('button', { class: 'knopf tonal klein', onclick: () => diagrammSichern('svg') }, 'SVG') : null),
    flaeche);
}

function fragenTeil() {
  const feld = h('textarea', { class: 'eingabe', 'data-feld': 'frage', rows: 2, placeholder: 'Frag deine Daten – z. B. „In welchem Monat war der Umsatz am höchsten?“' });
  feld.value = z.frage;
  feld.addEventListener('input', () => { z.frage = feld.value; const k = document.getElementById('los'); if (k) k.disabled = !feld.value.trim() || z.laeuft; });
  feld.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fragen(); } });
  return h('div', {},
    h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
      feld,
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, vorschlaege().map((v) => h('button', { class: 'chip', onclick: () => fragen(v), disabled: z.laeuft }, v))),
      h('div', { class: 'zeile' },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf', id: 'los', disabled: z.laeuft || !z.frage.trim(), onclick: () => fragen() }, 'Fragen')),
      z.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'status' }, z.status),
        h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : null,
      z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; fragen(); } : null, () => { z.fehler = null; zeichnen(); }) : null,
      z.python === false ? h('div', { class: 'klein leise' }, 'Python fehlt auf diesem Mac – Prisma antwortet deshalb nur aus den Kennzahlen (ungefährer). Mit Python (Xcode-Befehlszeilenwerkzeuge) rechnet es exakt.') : null),
    h('div', { class: 'spalte', style: { marginTop: '14px', gap: '12px' } }, (z.t.fragen || []).map((f) => h('div', { class: 'karte antwort' },
      h('div', { class: 'zeile oben' },
        h('div', { class: 'wachsen fett' }, f.frage),
        h('button', { class: 'knopf symbol', title: 'Entfernen', onclick: () => { z.t.fragen = z.t.fragen.filter((x) => x.id !== f.id); sichern(); zeichnen(); } }, '✕')),
      h('pre', { class: 'ausgabe' }, f.antwort),
      f.geschaetzt ? h('div', { class: 'klein leise' }, 'Aus Kennzahlen geschätzt (ohne Python).') : null,
      f.code ? h('div', {},
        h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { if (z.offeneCodes.has(f.id)) z.offeneCodes.delete(f.id); else z.offeneCodes.add(f.id); zeichnen(); } },
          z.offeneCodes.has(f.id) ? '▾ So wurde gerechnet' : '▸ So wurde gerechnet'),
        z.offeneCodes.has(f.id) ? h('div', {},
          f.erklaerung ? h('div', { class: 'klein leise', style: { margin: '2px 0 6px' } }, f.erklaerung) : null,
          h('pre', { class: 'code' }, f.code)) : null) : null))));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const m = () => box.replaceChildren(...[['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']].map(([w, n]) =>
    h('button', { class: 'chip' + (e.ki === w ? ' an' : ''), onclick: () => { e.ki = w; m(); } }, n)));
  m();
  const ok = await lyra.dialog('Prisma – Einstellungen', h('div', { style: { minWidth: '420px' } },
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Wer schreibt die Rechenprogramme'), box,
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Gerechnet wird immer auf deinem Mac. Claude & Co. sehen nur Spaltennamen, fünf Beispielzeilen und deine Frage.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

start();
