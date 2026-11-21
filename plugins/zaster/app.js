'use strict';
/*
 * Zaster – Haushaltsbuch mit Abo-Radar. Kontoauszüge (CSV/Excel deiner Bank) einlesen, Buchungen automatisch
 * einordnen, Monatsübersicht mit Budgets – und der Abo-Radar findet wiederkehrende Abbuchungen (Streaming, Handy,
 * Fitness …), zeigt, was sie im Jahr kosten, und erinnert vor der nächsten Abbuchung. Ohne KI, alles bleibt auf deinem Mac.
 */
const { h } = lyra;

const KATEGORIEN = {
  lebensmittel: ['Lebensmittel & Drogerie', '🛒', '#16A34A'],
  wohnen: ['Wohnen & Energie', '🏠', '#2563EB'],
  mobilitaet: ['Mobilität', '🚆', '#0EA5E9'],
  abos: ['Abos & Medien', '📺', '#8B5CF6'],
  versicherung: ['Versicherungen', '🛡️', '#64748B'],
  gesundheit: ['Gesundheit', '💊', '#EC4899'],
  shopping: ['Shopping', '🛍️', '#F59E0B'],
  essen: ['Essen gehen & Lieferung', '🍕', '#EF4444'],
  freizeit: ['Freizeit & Reisen', '🎟️', '#14B8A6'],
  bildung: ['Bildung', '📚', '#6366F1'],
  bargeld: ['Bargeld', '🏧', '#78716C'],
  sparen: ['Sparen & Anlegen', '💰', '#059669'],
  sonstiges: ['Sonstiges', '•', '#94A3B8'],
  einkommen: ['Einkommen', '💶', '#22A06B'],
  umbuchung: ['Umbuchung (zählt nicht)', '🔁', '#A1A1AA'],
};
const OHNE_STATISTIK = new Set(['umbuchung']);
const KEIN_ABO = new Set(['umbuchung', 'bargeld', 'sparen', 'einkommen']);
/** Wiederkehrend, aber kein kündbares Abo im engeren Sinn: Miete, Energie, Telefon/Internet, Versicherungen. */
const FIXKOSTEN = new Set(['wohnen', 'versicherung']);

const REGELN = [
  ['einkommen', /\b(gehalt|lohn|bezüge|bafög|bafoeg|kindergeld|stipendium|rente\b|honorar)/],
  ['umbuchung', /(umbuchung|übertrag|uebertrag|eigenes konto|kontoübertrag)/],
  ['sparen', /(sparplan|wertpapier|depot|trade republic|scalable|tagesgeld|festgeld|etf\b)/],
  ['bargeld', /(geldautomat|bargeldauszahlung|bargeld|\batm\b|auszahlung gaa|cash group)/],
  ['abos', /(netflix|spotify|disney|amazon prime|prime video|apple\.com|itunes|youtube|dazn|\bsky\b|audible|openai|chatgpt|adobe|microsoft|icloud|google (one|storage)|patreon|twitch|playstation|xbox|nintendo|zeit online|spiegel|\bfaz\b|deezer|crunchyroll|paramount|wow\b|joyn|rtl\+)/],
  ['wohnen', /(miete|stadtwerke|\bstrom|\bgas\b|vattenfall|\be\.?on\b|enbw|eprimo|telekom|vodafone|\bo2\b|telefonica|1&1|congstar|rundfunk|ard zdf|nebenkosten|hausverwaltung|wohnungs|immobilien|internet)/],
  ['versicherung', /(versicherung|allianz|\bhuk\b|\baxa\b|\bergo\b|debeka|techniker|\baok\b|barmer|\bdak\b|haftpflicht|signal iduna|generali|r\+v)/],
  ['mobilitaet', /(deutsche bahn|db vertrieb|db fernverkehr|\bbahn\b|\bbvg\b|\bmvg\b|\bhvv\b|\bkvb\b|\brmv\b|\bvrr\b|\bvvs\b|deutschlandticket|flixbus|\bshell\b|\baral\b|\besso\b|\bjet\b|totalenergies|tankstelle|\buber\b|\bbolt\b|\btier\b|\blime\b|sixt|share now|miles mobility|parken|parkhaus)/],
  ['essen', /(lieferando|\bwolt\b|mcdonald|burger king|restaurant|\bcaf[eé]\b|bäckerei|baeckerei|backhaus|starbucks|subway|domino|pizza|mensa|kfc|vapiano|döner|doener|sushi|imbiss)/],
  ['lebensmittel', /(\brewe\b|edeka|\baldi\b|\blidl\b|\bpenny\b|\bnetto\b|kaufland|\breal\b|\bnorma\b|tegut|globus|denns|alnatura|bio company|rossmann|\bdm\b|dm-drogerie|müller|mueller|budni|getränke|getraenke|supermarkt|markt\b)/],
  ['gesundheit', /(apotheke|arzt|ärzt|zahnarzt|physio|praxis|klinik|optiker|fielmann|krankenhaus)/],
  ['bildung', /(semesterbeitrag|universität|universitaet|hochschule|studierendenwerk|studentenwerk|thalia|hugendubel|udemy|coursera|duolingo|volkshochschule|\bvhs\b)/],
  ['freizeit', /(kino|cinemaxx|cineplex|eventim|ticket|urban sports|fitness|mcfit|fitx|clever fit|john reed|steam|booking\.com|airbnb|hotel|lufthansa|ryanair|eurowings|easyjet|condor|museum|theater|konzert)/],
  ['shopping', /(amazon|zalando|\botto\b|ebay|ikea|mediamarkt|media markt|saturn|h&m|primark|decathlon|about you|shein|temu|galeria|douglas|tk maxx|c&a|apple store|kleinanzeigen)/],
];

const STANDARD = { abosErinnern: true, importErinnern: false };

const z = {
  einst: { ...STANDARD },
  buchungen: [], // {id, datum (ms UTC), betrag, name, zweck, kategorie, hand}
  regeln: {}, // nameNormal → kategorie
  budgets: {}, // kategorie → € pro Monat
  abos: {}, // schluessel → {status, erinnern}
  ansicht: 'uebersicht',
  monat: '',
  suche: '',
  filterKat: '',
  meldung: '',
  fehler: null,
};
const app = document.getElementById('app');
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fe = (n) => euro.format(Number.isFinite(n) ? n : 0);
const feRund = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const TAG = 86400000;
const deTag = (ms) => new Date(ms).toLocaleDateString('de-DE', { timeZone: 'UTC' });
const monatVon = (ms) => new Date(ms).toISOString().slice(0, 7);
const monatName = (m) => new Date(m + '-01T00:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const heuteUtc = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };

async function start() {
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  try { z.buchungen = (await lyra.speicher.lesen('buchungen')) || []; } catch (_) {}
  try { z.regeln = (await lyra.speicher.lesen('regeln')) || {}; } catch (_) {}
  try { z.budgets = (await lyra.speicher.lesen('budgets')) || {}; } catch (_) {}
  try { z.abos = (await lyra.speicher.lesen('abos')) || {}; } catch (_) {}
  z.monat = letzterMonat();
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.ansicht !== 'uebersicht') { z.ansicht = 'uebersicht'; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  let info = {};
  try { info = await lyra.info(); } catch (_) {}
  const route = info.route || decodeURIComponent(location.hash.slice(1));
  if (['abos', 'buchungen', 'budget'].includes(route)) z.ansicht = route;
  zeichnen();
  nachaussen();
  if (route === 'einstellungen') einstellungen();
}

function letzterMonat() {
  if (!z.buchungen.length) return monatVon(heuteUtc());
  const max = Math.max(...z.buchungen.map((b) => b.datum));
  const jetzt = monatVon(heuteUtc());
  return z.buchungen.some((b) => monatVon(b.datum) === jetzt) ? jetzt : monatVon(max);
}

async function sichern(was = ['buchungen']) {
  try {
    for (const w of was) await lyra.speicher.schreiben(w, z[w]);
  } catch (e) {
    z.fehler = 'Speichern ging schief: ' + String((e && e.message) || e);
  }
  nachaussen();
}

// ================================================================== Einordnen

function nameNormal(n) {
  return String(n || '').toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|e\.?v\.?|s\.a\.r\.l\.|sarl|ltd|inc|co|europe|deutschland|germany|online|services|payments?)\b/g, ' ')
    .replace(/[0-9]+/g, ' ').replace(/[^a-zäöüß&+ ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter((w) => w.length > 1).slice(0, 3).join(' ') || String(n || '').toLowerCase().trim();
}

function einordnen(b) {
  const n = nameNormal(b.name);
  if (z.regeln[n]) return z.regeln[n];
  const t = `${b.name} ${b.zweck}`.toLowerCase();
  for (const [k, re] of REGELN) {
    if (k === 'einkommen' && b.betrag < 0) continue;
    if (re.test(t)) return k;
  }
  return b.betrag > 0 ? 'einkommen' : 'sonstiges';
}

function kategorieSetzen(b, k) {
  b.kategorie = k;
  const n = nameNormal(b.name);
  if (!n) return sichern(['buchungen']);
  z.regeln[n] = k;
  let weitere = 0;
  for (const x of z.buchungen) if (x !== b && nameNormal(x.name) === n && x.kategorie !== k) { x.kategorie = k; weitere++; }
  z.meldung = weitere ? `„${KATEGORIEN[k][0]}“ gilt jetzt auch für ${weitere} weitere Buchung${weitere > 1 ? 'en' : ''} von ${b.name} – und künftige.` : '';
  sichern(['buchungen', 'regeln']);
  zeichnen();
}

// ================================================================== Kontoauszug einlesen

function csvLesen(roh) {
  const t = roh.replace(/\r\n?/g, '\n');
  const probe = t.split('\n').slice(0, 40).filter((l) => l.trim());
  let trenner = ';', best = -1;
  for (const k of [';', ',', '\t']) {
    const anz = probe.map((l) => { let n = 0, q = false; for (const c of l) { if (c === '"') q = !q; else if (c === k && !q) n++; } return n; }).filter((n) => n > 0);
    if (!anz.length) continue;
    const m = new Map(); anz.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
    const [wert, anzahl] = [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (anzahl * 10 + Math.min(wert, 30) > best) { best = anzahl * 10 + Math.min(wert, 30); trenner = k; }
  }
  const zeilen = [];
  let feld = '', zeile = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { feld += '"'; i++; } else q = false; } else feld += c; }
    else if (c === '"' && feld.trim() === '') { q = true; feld = ''; }
    else if (c === trenner) { zeile.push(feld); feld = ''; }
    else if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; }
    else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter((r) => r.some((c) => String(c).trim()));
}

function betragLesen(w) {
  let s = String(w ?? '').trim().replace(/[\s €]|EUR/g, '');
  if (!s) return NaN;
  let neg = false;
  if (/-$/.test(s) && !/^-/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/^\+/.test(s)) s = s.slice(1);
  if (/,\d{1,2}$/.test(s) || (/,/.test(s) && !/\.\d{1,2}$/.test(s))) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

function datumLesen(w) {
  const s = String(w ?? '').trim();
  if (/^\d{5}$/.test(s)) return Math.round((+s - 25569) * TAG);
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { let j = +m[3]; if (j < 100) j += 2000; return Date.UTC(j, m[2] - 1, +m[1]); }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return Date.UTC(+m[1], m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], m[1] - 1, +m[2]);
  return NaN;
}

/** Spalten raten: welche ist Datum, Betrag (oder Soll/Haben), Name, Verwendungszweck? */
function zuordnungRaten(kopf) {
  const finde = (...re) => { for (const r of re) { const i = kopf.findIndex((k) => r.test(k)); if (i >= 0) return i; } return -1; };
  return {
    datum: finde(/^buchungs(tag|datum)/i, /^datum/i, /buchung/i, /date/i, /valuta|wertstellung/i),
    betrag: finde(/^betrag/i, /betrag(?!.*saldo)/i, /^umsatz/i, /amount/i),
    soll: finde(/^soll\b/i, /belastung|ausgang|debit/i),
    haben: finde(/^haben\b/i, /gutschrift|eingang|credit/i),
    name: finde(/beg[uü]nstigter|zahlungspflichtiger|empf[aä]nger|auftraggeber|gegenkonto.*name|^name/i, /payee|counterparty|partner/i),
    zweck: finde(/verwendungszweck/i, /buchungstext|beschreibung|description|purpose|referenz|reference|vorgang/i),
  };
}

async function importieren() {
  z.fehler = null;
  let d;
  try {
    d = await lyra.dateiOeffnen({ arten: ['csv', 'txt', 'xlsx'], titel: 'Kontoauszüge' });
  } catch (e) { z.fehler = String((e && e.message) || e); return zeichnen(); }
  if (!d) return;
  const zeilen = d.art === 'tabelle' ? (d.zeilen || []).map((r) => r.map(String)) : csvLesen(d.text || '');
  // Kopfzeile: die erste mit Datum und Betrag (Banken schreiben oft Kontoinfos davor)
  let kopfI = zeilen.findIndex((r) => r.some((c) => /datum|buchungstag|date|valuta/i.test(c)) && r.some((c) => /betrag|umsatz|amount|soll|haben/i.test(c)));
  if (kopfI < 0) kopfI = 0;
  const kopf = zeilen[kopfI].map((c) => String(c).trim());
  const daten = zeilen.slice(kopfI + 1).filter((r) => r.length >= Math.min(3, kopf.length));
  if (!daten.length) { z.fehler = 'In der Datei stehen keine Buchungen.'; return zeichnen(); }
  const zu = await zuordnungFragen(d.name, kopf, daten, zuordnungRaten(kopf));
  if (!zu) return;
  const vorhanden = new Set(z.buchungen.map(schluessel));
  let neu = 0, doppelt = 0, kaputt = 0;
  for (const r of daten) {
    const datum = datumLesen(r[zu.datum]);
    let betrag = zu.betrag >= 0 ? betragLesen(r[zu.betrag]) : NaN;
    if (!Number.isFinite(betrag) && (zu.soll >= 0 || zu.haben >= 0)) {
      const soll = zu.soll >= 0 ? betragLesen(r[zu.soll]) : 0;
      const haben = zu.haben >= 0 ? betragLesen(r[zu.haben]) : 0;
      betrag = (Number.isFinite(haben) ? Math.abs(haben) : 0) - (Number.isFinite(soll) ? Math.abs(soll) : 0);
    }
    if (!Number.isFinite(datum) || !Number.isFinite(betrag) || betrag === 0) { kaputt++; continue; }
    const b = {
      id: lyra.neueId() + neu,
      datum,
      betrag: Math.round(betrag * 100) / 100,
      name: String(zu.name >= 0 ? r[zu.name] : '').trim().replace(/\s+/g, ' ').slice(0, 120),
      zweck: String(zu.zweck >= 0 ? r[zu.zweck] : '').trim().replace(/\s+/g, ' ').slice(0, 240),
    };
    if (!b.name) b.name = b.zweck.split(/\s{2,}|\/\//)[0].slice(0, 60) || 'Unbekannt';
    const s = schluessel(b);
    if (vorhanden.has(s)) { doppelt++; continue; }
    vorhanden.add(s);
    b.kategorie = einordnen(b);
    z.buchungen.push(b);
    neu++;
  }
  z.buchungen.sort((a, b) => b.datum - a.datum);
  z.monat = letzterMonat();
  z.meldung = `✓ ${neu} neue Buchung${neu === 1 ? '' : 'en'} eingelesen${doppelt ? ` · ${doppelt} waren schon da` : ''}${kaputt ? ` · ${kaputt} Zeilen übersprungen` : ''}.`;
  await sichern(['buchungen']);
  zeichnen();
}

const schluessel = (b) => `${b.datum}|${b.betrag.toFixed(2)}|${nameNormal(b.name)}|${String(b.zweck || '').slice(0, 40).toLowerCase()}`;

async function zuordnungFragen(datei, kopf, daten, zu) {
  const wahl = (k, titel, pflicht) => {
    const s = h('select', { class: 'eingabe kompakt' },
      h('option', { value: -1 }, pflicht ? '– bitte wählen –' : '– keine –'),
      kopf.map((n, i) => h('option', { value: i, selected: zu[k] === i }, n || `Spalte ${i + 1}`)));
    s.addEventListener('change', () => { zu[k] = +s.value; vorschau(); });
    return h('label', { class: 'feld' }, titel, s);
  };
  const box = h('div', { class: 'vorschau' });
  const vorschau = () => {
    box.replaceChildren(...daten.slice(0, 4).map((r) => {
      let betrag = zu.betrag >= 0 ? betragLesen(r[zu.betrag]) : NaN;
      if (!Number.isFinite(betrag) && (zu.soll >= 0 || zu.haben >= 0)) betrag = (Math.abs(betragLesen(r[zu.haben])) || 0) - (Math.abs(betragLesen(r[zu.soll])) || 0);
      const datum = datumLesen(r[zu.datum]);
      return h('div', { class: 'zeile', style: { gap: '10px' } },
        h('span', { class: 'leise', style: { width: '86px' } }, Number.isFinite(datum) ? deTag(datum) : '?'),
        h('span', { class: 'wachsen', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, zu.name >= 0 ? r[zu.name] : ''),
        h('span', { class: 'fett', style: { color: betrag < 0 ? 'var(--falsch)' : 'var(--ok)' } }, Number.isFinite(betrag) ? fe(betrag) : '?'));
    }));
  };
  vorschau();
  const ok = await lyra.dialog(`„${datei}“ einlesen`, h('div', { style: { minWidth: '520px' } },
    h('p', { class: 'leise klein', style: { marginBottom: '12px' } }, 'Zaster hat die Spalten erkannt – prüf kurz, ob es passt. Doppelte Buchungen werden übersprungen.'),
    h('div', { class: 'raster-2' },
      wahl('datum', 'Datum', true), wahl('betrag', 'Betrag', false), wahl('name', 'Empfänger / Auftraggeber', false), wahl('zweck', 'Verwendungszweck', false),
      kopf.some((k) => /soll|haben/i.test(k)) ? wahl('soll', 'Soll (Ausgaben)', false) : null,
      kopf.some((k) => /soll|haben/i.test(k)) ? wahl('haben', 'Haben (Eingänge)', false) : null),
    h('div', { class: 'ueberschrift-klein', style: { margin: '14px 0 6px' } }, 'Vorschau'), box), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Einlesen', wert: true },
  ]);
  if (!ok) return null;
  if (zu.datum < 0 || (zu.betrag < 0 && zu.soll < 0 && zu.haben < 0)) {
    z.fehler = 'Ohne Datum- und Betragsspalte kann Zaster nichts einlesen.';
    zeichnen();
    return null;
  }
  return zu;
}

async function handEintrag(alt) {
  const b = alt || { datum: heuteUtc(), betrag: -0, name: '', zweck: '', kategorie: 'sonstiges' };
  const datum = h('input', { class: 'eingabe', type: 'date', value: new Date(b.datum).toISOString().slice(0, 10) });
  const betrag = h('input', { class: 'eingabe', placeholder: '-12,50', value: alt ? String(b.betrag).replace('.', ',') : '' });
  const name = h('input', { class: 'eingabe', placeholder: 'z. B. Wochenmarkt', value: b.name });
  const zweck = h('input', { class: 'eingabe', placeholder: 'optional', value: b.zweck });
  const kat = h('select', { class: 'eingabe' }, Object.entries(KATEGORIEN).map(([k, [n, s]]) => h('option', { value: k, selected: k === b.kategorie }, `${s} ${n}`)));
  const ok = await lyra.dialog(alt ? 'Buchung bearbeiten' : 'Buchung von Hand', h('div', { class: 'raster-2', style: { minWidth: '480px' } },
    h('label', { class: 'feld' }, 'Datum', datum), h('label', { class: 'feld' }, 'Betrag (Ausgaben mit Minus)', betrag),
    h('label', { class: 'feld' }, 'Wofür / an wen', name), h('label', { class: 'feld' }, 'Kategorie', kat),
    h('label', { class: 'feld', style: { gridColumn: '1 / -1' } }, 'Notiz', zweck)), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  const n = betragLesen(betrag.value);
  const d = datumLesen(datum.value);
  if (!Number.isFinite(n) || !n || !Number.isFinite(d)) { z.fehler = 'Bitte Datum und einen Betrag angeben (Ausgaben mit Minus, z. B. -12,50).'; return zeichnen(); }
  Object.assign(b, { datum: d, betrag: Math.round(n * 100) / 100, name: name.value.trim() || 'Ohne Namen', zweck: zweck.value.trim(), kategorie: kat.value, hand: true });
  if (!alt) { b.id = lyra.neueId(); z.buchungen.push(b); }
  z.buchungen.sort((a, x) => x.datum - a.datum);
  z.monat = monatVon(b.datum);
  await sichern(['buchungen']);
  zeichnen();
}

async function loeschen(b) {
  const ok = await lyra.dialog('Buchung löschen?', h('p', {}, `${b.name} · ${fe(b.betrag)} am ${deTag(b.datum)}`), [
    { text: 'Abbrechen', art: 'text', wert: false }, { text: 'Löschen', wert: true }]);
  if (!ok) return;
  z.buchungen = z.buchungen.filter((x) => x !== b);
  await sichern(['buchungen']);
  zeichnen();
}

// ================================================================== Auswerten

function imMonat(m) { return z.buchungen.filter((b) => monatVon(b.datum) === m && !OHNE_STATISTIK.has(b.kategorie)); }

function monatsZahlen(m) {
  const l = imMonat(m);
  const ein = l.filter((b) => b.betrag > 0).reduce((a, b) => a + b.betrag, 0);
  const aus = -l.filter((b) => b.betrag < 0).reduce((a, b) => a + b.betrag, 0);
  const jeKat = {};
  for (const b of l) if (b.betrag < 0) jeKat[b.kategorie] = (jeKat[b.kategorie] || 0) - b.betrag;
  return { ein, aus, saldo: ein - aus, jeKat, anzahl: l.length };
}

function monate() {
  const s = new Set(z.buchungen.map((b) => monatVon(b.datum)));
  s.add(monatVon(heuteUtc()));
  return [...s].sort();
}

/** Abo-Radar: wiederkehrende Abbuchungen mit gleichem Empfänger, ähnlichem Betrag und festem Rhythmus. */
function abosFinden() {
  const gruppen = new Map();
  for (const b of z.buchungen) {
    if (b.betrag >= 0 || KEIN_ABO.has(b.kategorie)) continue;
    const k = nameNormal(b.name);
    if (!k) continue;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(b);
  }
  const RHYTHMEN = [['wöchentlich', 6, 8, 7], ['monatlich', 26, 35, 30.44], ['vierteljährlich', 84, 96, 91.3], ['halbjährlich', 172, 192, 182.6], ['jährlich', 350, 380, 365.25]];
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const liste = [];
  // „Vermutlich beendet“ misst sich am Ende des eingelesenen Kontoauszugs, nicht an heute – sonst wirkt jedes Abo
  // beendet, sobald der letzte Auszug ein paar Wochen alt ist.
  const bis = z.buchungen.length ? Math.max(...z.buchungen.map((b) => b.datum)) : heuteUtc();
  for (const [k, alle] of gruppen) {
    if (alle.length < 2) continue;
    // Beträge clustern: die häufigste Betragsgruppe (±12 %) nehmen
    const betraege = alle.map((b) => -b.betrag);
    let beste = [];
    for (const ref of betraege) {
      const g = alle.filter((b) => Math.abs(-b.betrag - ref) <= Math.max(0.5, ref * 0.12));
      if (g.length > beste.length) beste = g;
    }
    if (beste.length < 2) continue;
    const s = [...beste].sort((a, b) => a.datum - b.datum);
    const abstaende = s.slice(1).map((b, i) => (b.datum - s[i].datum) / TAG).filter((d) => d > 3);
    if (!abstaende.length) continue;
    const ma = median(abstaende);
    const r = RHYTHMEN.find(([, von, bis]) => ma >= von && ma <= bis);
    if (!r) continue;
    const passend = abstaende.filter((d) => d >= r[1] * 0.8 && d <= r[2] * 1.2).length;
    if (passend < Math.max(1, abstaende.length * 0.6)) continue;
    if (r[0] === 'wöchentlich' && s.length < 4) continue;
    const letzte = s[s.length - 1];
    const betrag = -letzte.betrag;
    const proMonat = betrag * (30.44 / r[3]);
    const takt = Math.round(r[3]) * TAG;
    const ersteErwartet = letzte.datum + takt;
    let naechste = ersteErwartet;
    while (naechste < heuteUtc()) naechste += takt; // nächste Abbuchung ab heute
    const zustand = z.abos[k] || {};
    liste.push({
      schluessel: k,
      name: letzte.name,
      kategorie: letzte.kategorie,
      betrag,
      rhythmus: r[0],
      proMonat,
      proJahr: proMonat * 12,
      letzte: letzte.datum,
      naechste,
      anzahl: s.length,
      erhoehung: (() => {
        // Preiserhöhung über die ganze Geschichte dieses Empfängers: letzter Betrag gegen den Betrag davor, der anders war
        const verlauf = [...alle].sort((a, b) => a.datum - b.datum).map((b) => -b.betrag);
        const jetzt = verlauf[verlauf.length - 1];
        const frueher = [...verlauf].reverse().find((x) => Math.abs(x - jetzt) > 0.009);
        return frueher !== undefined && jetzt > frueher * 1.02 && jetzt < frueher * 1.6 ? jetzt - frueher : 0;
      })(),
      vermutlichBeendet: bis - ersteErwartet > Math.max(12, r[3] * 0.5) * TAG,
      fix: FIXKOSTEN.has(letzte.kategorie),
      status: zustand.status || 'neu',
      erinnern: zustand.erinnern !== false,
    });
  }
  return liste.sort((a, b) => b.proMonat - a.proMonat);
}

function aboSetzen(a, felder) {
  z.abos[a.schluessel] = { ...(z.abos[a.schluessel] || {}), ...felder };
  sichern(['abos']);
  zeichnen();
}

function nachaussen() {
  const m = letzterMonat();
  const zahlen = monatsZahlen(m);
  const laufend = abosFinden().filter((a) => !a.vermutlichBeendet && !['ignoriert', 'gekuendigt'].includes(a.status));
  const abos = laufend.filter((a) => !a.fix);
  const summeAbos = abos.reduce((s, a) => s + a.proMonat, 0);
  const budget = Object.values(z.budgets).reduce((s, x) => s + (+x || 0), 0);
  const e = [];
  if (z.buchungen.length) {
    e.push({
      id: 'monat',
      titel: `${monatName(m).split(' ')[0]}: ${feRund(zahlen.aus)} ausgegeben`,
      untertitel: [budget ? `${Math.round((zahlen.aus / budget) * 100)} % vom Budget` : `Saldo ${feRund(zahlen.saldo)}`, abos.length ? `${abos.length} Abos · ${feRund(summeAbos)}/Monat` : ''].filter(Boolean).join(' · '),
      route: 'uebersicht',
      fortschritt: budget ? Math.min(1, zahlen.aus / budget) : undefined,
      geaendert: Date.now() / 1000,
    });
  }
  const kuendigen = abos.filter((a) => a.status === 'kuendigen');
  if (kuendigen.length) {
    e.push({ id: 'kuendigen', titel: `${kuendigen.length} Abo${kuendigen.length > 1 ? 's' : ''} kündigen`, untertitel: kuendigen.map((a) => a.name).slice(0, 3).join(' · '), route: 'abos', geaendert: Date.now() / 1000 - 30 });
  }
  lyra.startseite(e).catch(() => {});
  // Erinnerungen: zwei Tage vor der nächsten Abbuchung (für Abos, bei denen du es willst) und optional am Monatsanfang
  const liste = [];
  if (z.einst.abosErinnern) {
    for (const a of laufend) {
      if (!a.erinnern || a.status === 'behalten') continue;
      const zeit = new Date(a.naechste - 2 * TAG);
      const t = new Date(zeit.getUTCFullYear(), zeit.getUTCMonth(), zeit.getUTCDate(), 10, 0).getTime() / 1000;
      if (t * 1000 < Date.now()) continue;
      liste.push({ id: 'abo-' + a.schluessel.replace(/\W+/g, '-'), titel: `Abo-Radar: ${a.name}`, text: `Bucht voraussichtlich am ${deTag(a.naechste)} etwa ${fe(a.betrag)} ab.${a.status === 'kuendigen' ? ' Du wolltest kündigen!' : ' Noch gebraucht?'}`, zeit: Math.round(t) });
    }
  }
  if (z.einst.importErinnern) {
    const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth() + 1, 2, 18, 0).getTime() / 1000;
    liste.push({ id: 'import', titel: 'Zaster: neuer Monat', text: 'Lies deinen Kontoauszug ein, dann siehst du, wo dein Geld hin ist.', zeit: Math.round(t) });
  }
  lyra.erinnern(liste.slice(0, 40)).catch(() => {});
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const reiter = [['uebersicht', 'Übersicht'], ['buchungen', 'Buchungen'], ['abos', 'Abo-Radar'], ['budget', 'Budgets']];
  const teil = !z.buchungen.length && z.ansicht !== 'budget' ? leer() : { uebersicht, buchungen: buchungenTeil, abos: abosTeil, budget: budgetTeil }[z.ansicht]();
  const aboZahl = z.buchungen.length ? abosFinden().filter((a) => !a.fix && !a.vermutlichBeendet && !['ignoriert', 'gekuendigt'].includes(a.status)).length : 0;
  app.replaceChildren(h('div', { class: 'seite breit' },
    lyra.kopf({
      titel: 'Dein Geld im Blick',
      unter: z.buchungen.length ? `${z.buchungen.length} Buchungen · alles bleibt auf deinem Mac` : 'Haushaltsbuch mit Abo-Radar – ohne KI, ohne Internet.',
      aktionen: [
        h('button', { class: 'knopf tonal klein', onclick: () => handEintrag() }, '+ Von Hand'),
        h('button', { class: 'knopf klein', onclick: importieren }, 'Kontoauszug einlesen …'),
      ],
    }),
    z.buchungen.length ? lyra.reiter(reiter.map(([k, n]) => [k, n, k === 'abos' && aboZahl ? aboZahl : null]), z.ansicht, (k) => { z.ansicht = k; z.meldung = ''; zeichnen(); }) : null,
    z.meldung ? h('div', { class: 'meldung' }, z.meldung, h('button', { class: 'knopf symbol', onclick: () => { z.meldung = ''; zeichnen(); } }, '✕')) : null,
    z.fehler ? h('div', { style: { marginBottom: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
    teil));
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel({ uebersicht: '', buchungen: 'Buchungen', abos: 'Abo-Radar', budget: 'Budgets' }[z.ansicht]);
}

function leer() {
  return h('div', { class: 'leer-start' },
    h('div', { class: 'leer-symbol' }, '💶'),
    h('h2', {}, 'Wo ist dein Geld hin?'),
    h('p', { class: 'leise', style: { maxWidth: '520px', margin: '8px auto 18px' } },
      'Exportier in deinem Online-Banking die Umsätze als CSV (bei fast jeder Bank unter „Umsätze“ → „Export“) und lies die Datei hier ein. Zaster ordnet alles ein und findet deine Abos. Nichts verlässt deinen Mac.'),
    h('button', { class: 'knopf gross', onclick: importieren }, 'Kontoauszug einlesen …'),
    h('div', { style: { marginTop: '10px' } }, h('button', { class: 'knopf text', onclick: () => handEintrag() }, 'Oder erste Buchung von Hand eintragen')));
}

function monatsWahl() {
  const l = monate();
  const i = l.indexOf(z.monat);
  return h('div', { class: 'zeile monatswahl' },
    h('button', { class: 'knopf symbol', disabled: i <= 0, onclick: () => { z.monat = l[i - 1]; zeichnen(); } }, '◀'),
    h('div', { class: 'fett', style: { minWidth: '150px', textAlign: 'center' } }, monatName(z.monat)),
    h('button', { class: 'knopf symbol', disabled: i >= l.length - 1, onclick: () => { z.monat = l[i + 1]; zeichnen(); } }, '▶'));
}

function ring(teile, summe) {
  const R = 70, r = 46, c = 90;
  let w = -Math.PI / 2;
  const p = (rad, a) => `${(c + rad * Math.cos(a)).toFixed(2)} ${(c + rad * Math.sin(a)).toFixed(2)}`;
  const pfade = teile.map(([k, v]) => {
    const a = (v / summe) * Math.PI * 2;
    const w2 = w + a;
    const d = a >= Math.PI * 2 - 1e-6
      ? `M${p(R, 0)} A${R} ${R} 0 1 1 ${p(R, Math.PI)} A${R} ${R} 0 1 1 ${p(R, 0)} M${p(r, 0)} A${r} ${r} 0 1 0 ${p(r, Math.PI)} A${r} ${r} 0 1 0 ${p(r, 0)} Z`
      : `M${p(R, w)} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${p(R, w2)} L${p(r, w2)} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 0 ${p(r, w)} Z`;
    w = w2;
    return `<path d="${d}" fill="${KATEGORIEN[k][2]}" fill-rule="evenodd"><title>${lyra.esc(KATEGORIEN[k][0])}: ${lyra.esc(fe(v))}</title></path>`;
  });
  const el = h('div', { class: 'ring' });
  el.innerHTML = `<svg viewBox="0 0 180 180" width="180" height="180">${pfade.join('')}</svg>`;
  el.appendChild(h('div', { class: 'ring-mitte' }, h('div', { class: 'fett', style: { fontSize: '18px' } }, feRund(summe)), h('div', { class: 'klein leise' }, 'ausgegeben')));
  return el;
}

function uebersicht() {
  const m = z.monat;
  const zahlen = monatsZahlen(m);
  const teile = Object.entries(zahlen.jeKat).sort((a, b) => b[1] - a[1]);
  const quote = zahlen.ein > 0 ? (zahlen.saldo / zahlen.ein) * 100 : NaN;
  const kachel = (titel, wert, farbe, klein) => h('div', { class: 'kpi' }, h('div', { class: 'klein leise' }, titel), h('div', { class: 'kpi-wert', style: { color: farbe } }, wert), klein ? h('div', { class: 'klein leise' }, klein) : null);
  const l = monate();
  const verlauf = l.slice(Math.max(0, l.indexOf(m) - 5), l.indexOf(m) + 1).map((x) => [x, monatsZahlen(x)]);
  const maxV = Math.max(1, ...verlauf.map(([, v]) => Math.max(v.ein, v.aus)));
  const top = imMonat(m).filter((b) => b.betrag < 0).sort((a, b) => a.betrag - b.betrag).slice(0, 5);
  const abos = abosFinden().filter((a) => !a.fix && !a.vermutlichBeendet && !['ignoriert', 'gekuendigt'].includes(a.status));
  return h('div', {},
    monatsWahl(),
    h('div', { class: 'kpis' },
      kachel('Einnahmen', fe(zahlen.ein), 'var(--ok)'),
      kachel('Ausgaben', fe(zahlen.aus), 'var(--falsch)'),
      kachel('Bleibt übrig', fe(zahlen.saldo), zahlen.saldo >= 0 ? 'var(--ok)' : 'var(--falsch)', Number.isFinite(quote) ? `Sparquote ${Math.round(quote)} %` : ''),
      kachel('Abos pro Monat', fe(abos.reduce((s, a) => s + a.proMonat, 0)), 'var(--akzent)', `${abos.length} gefunden`)),
    h('div', { class: 'zwei' },
      h('div', { class: 'flaeche' },
        h('div', { class: 'ueberschrift-klein', style: { marginBottom: '10px' } }, 'Wofür'),
        teile.length ? h('div', { class: 'zeile oben', style: { gap: '18px' } },
          ring(teile, zahlen.aus),
          h('div', { class: 'wachsen spalte', style: { gap: '7px' } }, teile.map(([k, v]) => {
            const budget = +z.budgets[k] || 0;
            return h('div', { class: 'kat-zeile', onclick: () => { z.ansicht = 'buchungen'; z.filterKat = k; zeichnen(); } },
              h('div', { class: 'zeile', style: { gap: '8px' } },
                h('span', {}, KATEGORIEN[k][1]), h('span', { class: 'wachsen' }, KATEGORIEN[k][0]),
                h('span', { class: 'fett' }, fe(v)), budget ? h('span', { class: 'klein leise' }, `/ ${feRund(budget)}`) : null),
              budget ? lyra.balken(v / budget, v > budget ? 'var(--falsch)' : KATEGORIEN[k][2], true) : null);
          }))) : h('div', { class: 'leise' }, 'In diesem Monat keine Ausgaben.')),
      h('div', { class: 'spalte', style: { gap: '12px' } },
        h('div', { class: 'flaeche' },
          h('div', { class: 'ueberschrift-klein', style: { marginBottom: '10px' } }, 'Letzte Monate'),
          h('div', { class: 'saeulen' }, verlauf.map(([x, v]) => h('div', { class: 'saeule-paar' + (x === m ? ' an' : ''), onclick: () => { z.monat = x; zeichnen(); }, title: `${monatName(x)}: +${fe(v.ein)} / −${fe(v.aus)}` },
            h('div', { class: 'saeulen-paar' },
              h('div', { class: 'saeule ein', style: { height: `${(v.ein / maxV) * 100}%` } }),
              h('div', { class: 'saeule aus', style: { height: `${(v.aus / maxV) * 100}%` } })),
            h('div', { class: 'klein leise' }, new Date(x + '-01T00:00:00Z').toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' })))))),
        h('div', { class: 'flaeche' },
          h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Größte Ausgaben'),
          top.length ? top.map((b) => buchungZeile(b, true)) : h('div', { class: 'leise klein' }, '–')))));
}

function buchungZeile(b, kompakt) {
  const kat = h('select', { class: 'kat-wahl', title: 'Kategorie ändern', onchange: (e) => kategorieSetzen(b, e.target.value), onclick: (e) => e.stopPropagation() },
    Object.entries(KATEGORIEN).map(([k, [n, s]]) => h('option', { value: k, selected: k === b.kategorie }, `${s} ${n}`)));
  return h('div', { class: 'buchung' + (kompakt ? ' kompakt' : '') },
    h('div', { class: 'kat-punkt', style: { background: KATEGORIEN[b.kategorie] ? KATEGORIEN[b.kategorie][2] : '#999' } }, KATEGORIEN[b.kategorie] ? KATEGORIEN[b.kategorie][1] : '•'),
    h('div', { class: 'wachsen', style: { minWidth: 0 } },
      h('div', { class: 'fett eine-zeile' }, b.name),
      h('div', { class: 'klein leise eine-zeile' }, deTag(b.datum), b.zweck ? ` · ${b.zweck}` : '')),
    kompakt ? null : kat,
    h('div', { class: 'betrag' + (b.betrag < 0 ? ' minus' : ' plus') }, fe(b.betrag)),
    kompakt ? null : h('div', { class: 'zeile', style: { gap: '0' } },
      h('button', { class: 'knopf symbol', title: 'Bearbeiten', onclick: () => handEintrag(b) }, '✎'),
      h('button', { class: 'knopf symbol', title: 'Löschen', onclick: () => loeschen(b) }, '✕')));
}

function buchungenTeil() {
  const suche = h('input', { class: 'eingabe', 'data-feld': 'suche', placeholder: 'Suchen – Name, Zweck, Betrag …', value: z.suche });
  suche.addEventListener('input', () => { z.suche = suche.value; zeichnen(); });
  const s = z.suche.trim().toLowerCase();
  let l = z.buchungen.filter((b) => monatVon(b.datum) === z.monat || s);
  if (z.filterKat) l = l.filter((b) => b.kategorie === z.filterKat);
  if (s) l = l.filter((b) => `${b.name} ${b.zweck} ${fe(b.betrag)}`.toLowerCase().includes(s));
  const summe = l.reduce((a, b) => a + b.betrag, 0);
  return h('div', {},
    h('div', { class: 'zeile umbruch', style: { marginBottom: '12px', gap: '10px' } },
      s ? h('div', { class: 'fett' }, 'Alle Monate') : monatsWahl(),
      h('div', { class: 'wachsen' }, suche),
      h('select', { class: 'eingabe kompakt', onchange: (e) => { z.filterKat = e.target.value; zeichnen(); } },
        h('option', { value: '' }, 'Alle Kategorien'),
        Object.entries(KATEGORIEN).map(([k, [n, sy]]) => h('option', { value: k, selected: z.filterKat === k }, `${sy} ${n}`)))),
    h('div', { class: 'klein leise', style: { marginBottom: '8px' } }, `${l.length} Buchungen · Summe ${fe(summe)}`),
    h('div', { class: 'flaeche liste' }, l.length ? l.slice(0, 500).map((b) => buchungZeile(b)) : h('div', { class: 'leise' }, 'Keine Buchungen.')),
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Kategorie geändert? Zaster merkt es sich für diesen Empfänger – auch für künftige Kontoauszüge.'));
}

function abosTeil() {
  const alle = abosFinden();
  const laufend = alle.filter((a) => !a.vermutlichBeendet && a.status !== 'ignoriert' && a.status !== 'gekuendigt');
  const aktiv = laufend.filter((a) => !a.fix);
  const fix = laufend.filter((a) => a.fix);
  const rest = alle.filter((a) => !laufend.includes(a));
  const summe = aktiv.reduce((s, a) => s + a.proMonat, 0);
  const summeFix = fix.reduce((s, a) => s + a.proMonat, 0);
  const karte = (a) => h('div', { class: 'abo karte' + (a.status === 'gekuendigt' || a.vermutlichBeendet ? ' vorbei' : '') },
    h('div', { class: 'zeile oben' },
      h('div', { class: 'kat-punkt gross', style: { background: KATEGORIEN[a.kategorie] ? KATEGORIEN[a.kategorie][2] : '#999' } }, KATEGORIEN[a.kategorie] ? KATEGORIEN[a.kategorie][1] : '•'),
      h('div', { class: 'wachsen', style: { minWidth: 0 } },
        h('div', { class: 'fett eine-zeile', style: { fontSize: '15.5px' } }, a.name),
        h('div', { class: 'klein leise' }, `${fe(a.betrag)} ${a.rhythmus} · ${a.anzahl}× gesehen · zuletzt ${deTag(a.letzte)}`),
        !a.vermutlichBeendet && a.status !== 'gekuendigt' ? h('div', { class: 'klein', style: { marginTop: '2px' } }, `Nächste Abbuchung etwa am ${deTag(a.naechste)}`) : h('div', { class: 'klein leise' }, a.status === 'gekuendigt' ? 'Gekündigt' : 'Seit einer Weile nicht mehr abgebucht – vermutlich beendet'),
        a.erhoehung > 0.009 ? h('div', { class: 'etikett-warn' }, `Preis gestiegen: +${fe(a.erhoehung)}`) : null),
      h('div', { style: { textAlign: 'right' } },
        h('div', { class: 'fett', style: { fontSize: '16px' } }, fe(a.proJahr)), h('div', { class: 'klein leise' }, 'im Jahr'))),
    h('div', { class: 'zeile umbruch', style: { gap: '6px', marginTop: '10px' } },
      [['behalten', 'Behalten'], ['kuendigen', 'Kündigen'], ['gekuendigt', 'Gekündigt'], ['ignoriert', 'Kein Abo']].map(([k, n]) =>
        h('button', { class: 'chip' + (a.status === k ? ' an' : ''), onclick: () => aboSetzen(a, { status: a.status === k ? 'neu' : k }) }, n)),
      h('span', { class: 'wachsen' }),
      !a.vermutlichBeendet && a.status !== 'gekuendigt' && a.status !== 'ignoriert' && a.status !== 'behalten'
        ? h('label', { class: 'zeile klein leise', style: { gap: '5px', cursor: 'pointer' } },
          h('input', { type: 'checkbox', checked: a.erinnern && z.einst.abosErinnern, disabled: !z.einst.abosErinnern, onchange: (e) => aboSetzen(a, { erinnern: e.target.checked }) }), 'Vorher erinnern') : null),
    a.status === 'kuendigen' ? h('div', { class: 'kasten warn', style: { marginTop: '10px' } },
      h('div', { class: 'titel' }, 'So kündigst du'),
      h('div', { class: 'klein' }, 'Online-Abos haben seit 2022 einen „Verträge hier kündigen“-Knopf auf der Website des Anbieters. Sonst reicht eine kurze E-Mail oder ein Brief mit Kundennummer und „zum nächstmöglichen Zeitpunkt“ – Kündigungsbestätigung aufheben.')) : null);
  return h('div', {},
    h('div', { class: 'abo-kopf' },
      h('div', {}, h('div', { class: 'klein leise' }, 'Deine laufenden Abos kosten'),
        h('div', { class: 'abo-summe' }, fe(summe), h('span', { class: 'leise', style: { fontSize: '15px', fontWeight: 500 } }, ' im Monat')),
        h('div', { class: 'leise' }, `= ${fe(summe * 12)} im Jahr`)),
      h('div', { class: 'radar' }, h('div', { class: 'radar-strahl' }))),
    aktiv.length ? h('div', { class: 'raster' }, aktiv.map(karte)) : h('div', { class: 'leise', style: { padding: '20px 0' } }, 'Noch keine Abos gefunden – je mehr Monate du einliest, desto besser findet der Radar sie.'),
    fix.length ? lyra.abschnitt(`Feste Kosten · ${fe(summeFix)} im Monat`, h('div', {},
      h('div', { class: 'leise klein', style: { marginBottom: '8px' } }, 'Miete, Energie, Telefon und Versicherungen kommen regelmäßig, zählen aber nicht als Abo. Auch hier erinnert Zaster vor der Abbuchung, wenn du willst.'),
      h('div', { class: 'raster' }, fix.map(karte)))) : null,
    rest.length ? h('div', { style: { marginTop: '20px' } }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Beendet oder kein Abo'), h('div', { class: 'raster' }, rest.map(karte))) : null,
    h('div', { class: 'klein leise', style: { marginTop: '14px' } }, 'Der Radar sucht Abbuchungen an denselben Empfänger mit ähnlichem Betrag in festem Rhythmus (wöchentlich bis jährlich). Erinnerungen kommen zwei Tage vor der nächsten erwarteten Abbuchung.'));
}

function budgetTeil() {
  const zahlen = monatsZahlen(z.monat);
  const kats = Object.keys(KATEGORIEN).filter((k) => !['einkommen', 'umbuchung'].includes(k));
  const summe = Object.values(z.budgets).reduce((s, x) => s + (+x || 0), 0);
  return h('div', {},
    monatsWahl(),
    h('p', { class: 'leise', style: { margin: '4px 0 14px' } }, 'Leg fest, wie viel du pro Monat ausgeben willst. Zaster zeigt dir, wie viel davon schon weg ist.'),
    h('div', { class: 'flaeche spalte', style: { gap: '12px' } }, kats.map((k) => {
      const feld = h('input', { class: 'eingabe budget-feld', 'data-feld': 'b-' + k, inputmode: 'decimal', placeholder: '–', value: z.budgets[k] ? String(z.budgets[k]).replace('.', ',') : '' });
      feld.addEventListener('change', () => {
        const n = betragLesen(feld.value);
        if (Number.isFinite(n) && n > 0) z.budgets[k] = Math.round(n * 100) / 100; else delete z.budgets[k];
        sichern(['budgets']);
        zeichnen();
      });
      const v = zahlen.jeKat[k] || 0, b = +z.budgets[k] || 0;
      return h('div', { class: 'budget-zeile' },
        h('div', { class: 'zeile', style: { gap: '10px' } },
          h('span', { style: { width: '24px' } }, KATEGORIEN[k][1]), h('span', { class: 'wachsen' }, KATEGORIEN[k][0]),
          h('span', { class: 'klein leise' }, fe(v)), feld, h('span', { class: 'klein leise' }, '€')),
        b ? h('div', { style: { marginLeft: '34px' } }, lyra.balken(v / b, v > b ? 'var(--falsch)' : KATEGORIEN[k][2], true)) : null);
    }),
    summe ? h('div', { class: 'zeile fett', style: { borderTop: '1px solid var(--linie)', paddingTop: '10px' } },
      h('span', { class: 'wachsen' }, 'Zusammen'), h('span', {}, `${fe(zahlen.aus)} von ${fe(summe)}`)) : null));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const schalter = (k, t, u) => {
    const c = h('input', { type: 'checkbox', checked: e[k], onchange: (x) => { e[k] = x.target.checked; } });
    return h('label', { class: 'zeile oben', style: { gap: '10px', cursor: 'pointer', marginBottom: '12px' } }, c, h('div', {}, h('div', { class: 'fett' }, t), h('div', { class: 'klein leise' }, u)));
  };
  const ok = await lyra.dialog('Zaster – Einstellungen', h('div', { style: { minWidth: '440px' } },
    schalter('abosErinnern', 'Vor Abo-Abbuchungen erinnern', 'Mitteilung zwei Tage vorher – je Abo abschaltbar.'),
    schalter('importErinnern', 'Monatlich ans Einlesen erinnern', 'Am 2. jedes Monats um 18 Uhr.')), [
    { text: 'Alle Buchungen löschen …', art: 'leise', wert: 'loeschen' },
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (ok === 'loeschen') return allesLoeschen();
  if (!ok) return;
  z.einst = e;
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  nachaussen();
  zeichnen();
}

async function allesLoeschen() {
  const ok = await lyra.dialog('Alle Buchungen löschen?', h('p', {}, `Zaster vergisst alle ${z.buchungen.length} Buchungen und deine Abo-Einstellungen. Budgets und gelernte Kategorien bleiben. Das lässt sich nicht rückgängig machen.`), [
    { text: 'Abbrechen', art: 'text', wert: false }, { text: 'Alles löschen', wert: true }]);
  if (!ok) return;
  z.buchungen = [];
  z.abos = {};
  await sichern(['buchungen', 'abos']);
  zeichnen();
}

start();
