'use strict';
/*
 * Veritas – Faktencheck. Behauptung, Schlagzeile oder ganzen Artikel einfügen: Veritas zerlegt ihn in prüfbare Aussagen,
 * lässt Claude oder ChatGPT im Internet nach seriösen Quellen suchen, schätzt für jede Aussage in Prozent ein, wie
 * wahrscheinlich sie stimmt, korrigiert Falsches und erklärt Warnsignale für Fake News. Mit Lyra (lokal) bleibt der
 * Text auf dem Mac: Veritas schlägt dann in Wikipedia & Co. nach (hinaus geht nur eine kurze Suchanfrage, die das lokale
 * Modell formuliert) – oder prüft, wenn das aus ist, nur mit dem Wissen des Modells. Die Herkunft steht immer dabei.
 */
const { h } = lyra;

const TEXT_MAX = { lokal: 12000, web: 60000 };
const AUSSAGEN_MAX = 8;

// Urteil aus der Wahrscheinlichkeit: [ab Prozent, Name, Farbe]
const STUFEN = [
  [85, 'Stimmt', '#16a34a'],
  [65, 'Stimmt größtenteils', '#65a30d'],
  [36, 'Teils, teils', '#d97706'],
  [16, 'Größtenteils falsch', '#ea580c'],
  [0, 'Falsch', '#dc2626'],
];
const NICHT_PRUEFBAR = { meinung: 'Meinung', prognose: 'Prognose', unklar: 'Nicht prüfbar' };
// Wort-Urteil des Modells → erlaubter Prozentbereich (kleine Modelle treffen Worte zuverlässiger als Zahlen)
const BAENDER = {
  stimmt: [85, 100], stimmt_groesstenteils: [65, 84], teils: [36, 64], irrefuehrend: [20, 45], groesstenteils_falsch: [16, 35], falsch: [0, 15],
};
const GRAU = '#64748b';
// Woher die Belege stammen
const HERKUNFT = {
  web: { zeichen: '🌐', kurz: 'mit Websuche', lang: 'mit Websuche' },
  wiki: { zeichen: '📚', kurz: 'Wikipedia & Co.', lang: 'mit Auszügen aus Wikipedia & Co.' },
  wissen: { zeichen: '🔒', kurz: 'ohne Internet', lang: 'ohne Internet, nur aus Modellwissen' },
};
const BELEGE_MAX = 9000;

const BEISPIELE = [
  'Der Mensch nutzt nur 10 % seines Gehirns.',
  'Die Chinesische Mauer ist vom Mond aus mit bloßem Auge zu sehen.',
  'Blitze schlagen nie zweimal an derselben Stelle ein.',
  'Albert Einstein ist in Mathe durchgefallen.',
  'Goldfische haben ein Gedächtnis von drei Sekunden.',
  'Spinat enthält besonders viel Eisen.',
  'Im Mittelalter glaubten die Menschen, die Erde sei eine Scheibe.',
  'Zucker macht Kinder hyperaktiv.',
  'Napoleon war außergewöhnlich klein.',
  'Fledermäuse sind blind.',
  'Wikinger trugen Helme mit Hörnern.',
  'Kaugummi bleibt sieben Jahre im Magen.',
];

const SYSTEM = `Du bist „Veritas“ in Lyra: eine gründliche, unparteiische Faktencheckerin. Du sprichst mich mit „du“ an und \
schreibst klares, sachliches Deutsch. Du prüfst Aussagen, nicht Menschen; du bleibst politisch neutral, auch bei heiklen \
Themen. Unsicherheit benennst du ehrlich, statt zu raten. Du übertreibst nicht und erfindest nichts – keine Zahlen, keine \
Zitate, keine Quellen.`;

// Schlüssel alphabetisch sinnvoll (so schreibt das Modell sie): erst Begründung, dann Korrektur, Quellen, Prozent.
const SCHEMA = {
  type: 'object',
  properties: {
    aussagen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: ['fakt', 'meinung', 'prognose', 'unklar'] },
          aussage: { type: 'string' },
          begruendung: { type: 'string' },
          korrektur: { type: 'string' },
          quellen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, url: { type: 'string' } }, required: ['titel', 'url'] } },
          urteil: { type: 'string', enum: [...Object.keys(BAENDER), 'nicht_pruefbar'] },
          wahrscheinlichkeit: { type: 'integer' },
        },
        required: ['art', 'aussage', 'begruendung', 'korrektur', 'quellen', 'urteil', 'wahrscheinlichkeit'],
      },
    },
    fazit: { type: 'string' },
    glaubwuerdigkeit: { type: 'integer' },
    kontext: { type: 'string' },
    thema: { type: 'string' },
    warnsignale: { type: 'array', items: { type: 'object', properties: { erklaerung: { type: 'string' }, signal: { type: 'string' } }, required: ['erklaerung', 'signal'] } },
    weiterdenken: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, titel: { type: 'string' } }, required: ['text', 'titel'] } },
  },
  required: ['aussagen', 'fazit', 'glaubwuerdigkeit', 'kontext', 'thema', 'warnsignale', 'weiterdenken'],
};

const z = {
  info: null,
  lehrer: 'lyra',
  liste: [], // [{id, thema, zeit, wert, web}]
  p: null, // offene Prüfung
  eingabe: '',
  dateiName: '',
  laeuft: false,
  status: '',
  fehler: null,
  scout: false,
  textOffen: false,
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const zahl = (v, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : std; };
const lehrerInfo = (k) => ((z.info && z.info.lehrer) || []).find((l) => l.kennung === k) || { kennung: k, name: k === 'lyra' ? 'Lyra (lokal)' : k };
const mitWeb = () => lehrerInfo(z.lehrer).web === true;
const nurLink = (t) => /^https?:\/\/\S+$/i.test(t.trim());

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  const lehrer = z.info.lehrer || [];
  let gemerkt = null;
  try { gemerkt = ((await lyra.speicher.lesen('einstellungen')) || {}).lehrer; } catch (_) {}
  // Am liebsten einer, der im Internet suchen kann
  const web = lehrer.find((l) => l.web);
  z.lehrer = lehrer.some((l) => l.kennung === gemerkt) ? gemerkt : (web ? web.kennung : z.info.standardLehrer || 'lyra');
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((e) => e && e.id); } catch (_) {}
  try { z.scout = !!(await lyra.installiert('scout')); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.p) { z.p = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('pruefung/')) await oeffnen(route.slice(9));
  else if (route.startsWith('text/')) z.eingabe = route.slice(5);
  zeichnen();
}

// ================================================================== Speichern

async function sichern() {
  const p = z.p;
  if (!p) return;
  try { await lyra.speicher.schreiben('pruefungen/' + p.id, p); } catch (_) {}
  const meta = { id: p.id, thema: p.thema, zeit: p.zeit, wert: p.wert, herkunft: p.herkunft };
  z.liste = [meta, ...z.liste.filter((e) => e.id !== p.id)].slice(0, 200);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
}

async function oeffnen(id) {
  try { const p = await lyra.speicher.lesen('pruefungen/' + id); if (p && Array.isArray(p.aussagen)) { z.p = p; z.textOffen = false; } } catch (_) {}
}

async function entfernen(id) {
  const ok = await lyra.bestaetigen({ titel: 'Prüfung löschen?', text: 'Veritas vergisst diese Prüfung samt Ergebnis.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('pruefungen/' + id); } catch (_) {}
  z.liste = z.liste.filter((e) => e.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  if (z.p && z.p.id === id) z.p = null;
  zeichnen();
}

// ================================================================== Stil-Signale (ohne KI, gezählt)

const REIZWOERTER = [
  'schock', 'skandal', 'unglaublich', 'sofort teilen', 'teilt das', 'teile das', 'bevor es gelöscht', 'wird gelöscht',
  'verschweigen', 'verschwiegen', 'mainstream', 'lügenpresse', 'systemmedien', 'wacht auf', 'wach auf', 'die wahrheit über',
  'geheim', 'was sie nicht wissen sollen', 'man darf es nicht sagen', 'zensiert', 'ärzte hassen', 'wundermittel',
  '100 % bewiesen', '100% bewiesen', 'eindeutig bewiesen', 'endlich enthüllt', 'die elite', 'unfassbar', 'krass',
];

/** Merkmale, die man ohne Wissen sieht – zählt nur, urteilt nicht. → [{zeichen, text}] */
function stilSignale(t) {
  const s = t.trim();
  if (s.length < 60 || nurLink(s)) return [];
  const klein = s.toLowerCase();
  const raus = [];
  const ausrufe = (s.match(/!{2,}|!\s*\?|\?\s*!/g) || []).length;
  if (ausrufe) raus.push({ zeichen: '❗', text: `${ausrufe}× mehrfache Ausrufe- oder Fragezeichen` });
  const gross = (s.match(/\b[A-ZÄÖÜ]{5,}\b/g) || []).filter((w) => !/^(COVID|NASA|UNESCO|UNICEF|OECD|NATO|DSGVO|BAFÖG)$/.test(w));
  if (gross.length >= 2) raus.push({ zeichen: '🔠', text: `${gross.length} Wörter in GROSSBUCHSTABEN (z. B. „${gross[0]}“)` });
  const reiz = REIZWOERTER.filter((w) => klein.includes(w));
  if (reiz.length) raus.push({ zeichen: '🔥', text: `Reizwörter: ${reiz.slice(0, 4).map((w) => `„${w}“`).join(', ')}` });
  const quelle = /(laut|zufolge|quelle|studie|bericht|statistik|https?:\/\/|www\.|\bdoi\b|veröffentlicht|according to|source)/i.test(s);
  if (!quelle && s.length > 220) raus.push({ zeichen: '🔗', text: 'Keine Quelle oder Studie genannt' });
  const datum = /(\b(19|20)\d{2}\b|\b\d{1,2}\.\s?\d{1,2}\.|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|gestern|heute)/i.test(s);
  if (!datum && s.length > 400) raus.push({ zeichen: '📅', text: 'Kein Datum – unklar, wie aktuell das ist' });
  const absolut = (klein.match(/\b(alle|immer|nie|niemals|jeder|keiner|garantiert|beweist)\b/g) || []).length;
  if (absolut >= 4) raus.push({ zeichen: '♾', text: `${absolut}× absolute Wörter („alle“, „nie“, „immer“ …)` });
  return raus;
}

// ================================================================== Prüfen

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

/** Ohne Websuche: Belege aus Wikipedia & Co. (lyra.nachschlagen). Lange Texte erst in Kernaussagen zerlegen. */
async function belegeSammeln(t) {
  let fragen = [t];
  if (t.length > 400) {
    status('Veritas sucht die Kernaussagen …');
    try {
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Nenne die bis zu 4 wichtigsten prüfbaren Tatsachenbehauptungen in diesem Text – jede als kurzen, \
eigenständigen Satz.\n\n=== TEXT ===\n${t.slice(0, 8000)}\n=== ENDE ===\n\nAntwort als JSON: {"aussagen": [""]}`,
        schema: { type: 'object', properties: { aussagen: { type: 'array', items: { type: 'string' } } }, required: ['aussagen'] },
      });
      const l = ((r && r.json && r.json.aussagen) || []).map(text).filter(Boolean).slice(0, 4);
      if (l.length) fragen = l;
      else fragen = [t.slice(0, 600)];
    } catch (e) {
      if (/ABGEBROCHEN|Abgebrochen/.test(String((e && e.message) || e))) throw e;
      fragen = [t.slice(0, 600)];
    }
  }
  const belege = [];
  let laenge = 0;
  for (const [i, f] of fragen.entries()) {
    status(fragen.length > 1 ? `Schlage in Wikipedia & Co. nach (${i + 1}/${fragen.length}) …` : 'Schlage in Wikipedia & Co. nach …');
    const funde = await lyra.nachschlagen(f, 4);
    for (const b of Array.isArray(funde) ? funde : []) {
      if (!b || !text(b.url) || !text(b.text) || laenge > BELEGE_MAX) continue;
      const da = belege.find((x) => x.url === b.url);
      if (da) { if (!da.text.includes(b.text.slice(0, 80))) da.text += '\n…\n' + b.text; continue; }
      belege.push({ nr: belege.length + 1, quelle: text(b.quelle), titel: text(b.titel), url: text(b.url), text: text(b.text) });
      laenge += b.text.length;
    }
  }
  return belege;
}

function auftrag(eingabe, web, belege = []) {
  const heute = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const link = nurLink(eingabe);
  const was = link
    ? `Ich habe nur diesen Link: ${eingabe}\nSuche den Artikel über die Websuche (Titel, Inhalt, Medium) und prüfe seine Kernaussagen. \
Findest du ihn nicht, gib "aussagen": [] zurück und schreib im "fazit", dass ich den Text des Artikels einfügen soll.`
    : `=== ZU PRÜFEN ===\n${eingabe}\n=== ENDE ===`;
  const recherche = web
    ? `2. Suche für jede Aussage im Internet nach seriösen, möglichst aktuellen Belegen: Faktencheck-Redaktionen (z. B. dpa-Faktencheck, \
Correctiv, AFP Faktencheck, Mimikama, BR24 #Faktenfuchs), Behörden und Statistikämter, wissenschaftliche Fachgesellschaften, \
Übersichtsarbeiten, Nachrichtenagenturen. Meide Foren, anonyme Blogs und Seiten ohne Impressum.
5. "quellen": 1–3 Quellen je Aussage, die du in der Suche tatsächlich gefunden hast – Titel und vollständige URL (https://…). \
Erfinde keine URLs; ohne Fund: [].`
    : belege.length
      ? `2. Du hast keinen freien Internetzugang, aber unten stehen BELEGE – Auszüge aus Wikipedia & Co., nummeriert [1] bis \
[${belege.length}]. Stütze dich vorrangig darauf. Was sie nicht abdecken, prüfst du mit deinem Wissen – dann vorsichtig, \
Wahrscheinlichkeit eher zur Mitte, und sag es in der Begründung. Bei Ereignissen der letzten Monate bist du unsicher.
5. "quellen": die Belege, auf die du dich bei dieser Aussage stützt – "titel" und "url" genau wie bei den Belegen angegeben; \
keine anderen URLs. Passt keiner: [].`
      : `2. Du hast KEINEN Internetzugang. Prüfe mit deinem Wissen. Bei Ereignissen der letzten Monate, bei Zahlen, die sich ändern, \
oder wenn du dir nicht sicher bist: Wahrscheinlichkeit nahe 50 und sag in der Begründung ehrlich, dass du es nicht prüfen kannst.
5. "quellen": immer [] (ohne Internet keine Links). Nenne stattdessen in der Begründung, wo man es nachprüfen kann \
(z. B. Statistisches Bundesamt, Robert Koch-Institut, eine Fachgesellschaft).`;
  const belegText = belege.length
    ? '\n\n=== BELEGE ===\n' + belege.map((b) => `[${b.nr}] ${b.quelle} – ${b.titel} (${b.url})\n${b.text}`).join('\n\n') + '\n=== ENDE DER BELEGE ==='
    : '';
  return `Heute ist der ${heute}. Prüfe auf Richtigkeit:\n\n${was}${belegText}\n\n\
So gehst du vor:
1. Zerlege das in die wichtigsten prüfbaren Kernaussagen (höchstens ${AUSSAGEN_MAX}; eine einzelne Behauptung ist eine Aussage). \
Formuliere jede neutral und knapp ("aussage"). "art": "fakt" (prüfbar), "meinung", "prognose" oder "unklar" (zu vage zum Prüfen).
${recherche}
3. "urteil": stimmt, stimmt_groesstenteils, teils, irrefuehrend (Kern wahr, aber übertrieben oder verzerrt), \
groesstenteils_falsch, falsch oder nicht_pruefbar (Meinung, Prognose, zu vage). "wahrscheinlichkeit": 0–100 – wie \
wahrscheinlich die Aussage nach der Beleglage stimmt, passend zum Urteil (stimmt 85–100, stimmt_groesstenteils 65–84, \
teils 36–64, irrefuehrend 20–45, groesstenteils_falsch 16–35, falsch 0–15, nicht_pruefbar 50). Viele populäre Behauptungen \
sind verbreitete Irrtümer – „das weiß doch jeder“ ist kein Beleg; was die Belege sagen, wiegt schwerer als dein Bauchgefühl. \
Musst du etwas korrigieren, stimmt die Aussage nicht ganz.
4. "begruendung": 1–3 Sätze, was die Belege sagen. "korrektur": Ist die Aussage falsch, irreführend oder ungenau, der korrekte \
Sachverhalt in 1–2 Sätzen ("Richtig ist …" weglassen, gleich den Inhalt); sonst "".
6. "warnsignale": Merkmale von Falschmeldungen, die im ZU PRÜFENDEN Text selbst auffallen – nicht in den Belegen (z. B. \
reißerische Sprache, fehlende oder unseriöse Quelle, aus dem Zusammenhang gerissenes Zitat, alte Meldung als neu, \
Pseudo-Experten, Bild in falschem Kontext, bekannte Verschwörungserzählung) – je "signal" (2–5 Wörter) und "erklaerung" \
(1 Satz). Bei einer einzelnen kurzen Behauptung nur, wenn sie einem bekannten Muster von Falschmeldungen folgt. Sonst: [].
7. "kontext": Was fehlt oder verzerrt ist (1–3 Sätze) – sonst "".
8. "glaubwuerdigkeit": 0–100 für das Ganze. "fazit": 2–3 Sätze Gesamturteil. "thema": 2–5 Wörter.
9. "weiterdenken": 2–4 Anknüpfungspunkte, die mir echtes neues Wissen geben ("titel" kurz, "text" 1–2 Sätze) – z. B. woher \
ein Mythos stammt, was die Forschung wirklich zeigt, eine überraschende verwandte Tatsache, wie man so etwas selbst prüft.

Antwort als JSON mit genau diesen Feldern: {"aussagen": [{"art": "", "aussage": "", "begruendung": "", "korrektur": "", \
"quellen": [{"titel": "", "url": ""}], "urteil": "", "wahrscheinlichkeit": 50}], "fazit": "", "glaubwuerdigkeit": 50, "kontext": "", \
"thema": "", "warnsignale": [{"erklaerung": "", "signal": ""}], "weiterdenken": [{"text": "", "titel": ""}]}`;
}

function quelleOk(q) {
  const url = text(q && q.url);
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
  try {
    const u = new URL(url);
    return { titel: text(q.titel).slice(0, 160) || u.hostname, url: u.toString(), domain: u.hostname.replace(/^www\./, '') };
  } catch (_) { return null; }
}

/** `erlaubt`: null = jede gültige URL (Websuche), sonst nur diese Belege (Wikipedia & Co.), [] = keine. */
function aufbereiten(j, erlaubt) {
  const aussagen = [];
  const quelleErlaubt = (q) => {
    const ok = quelleOk(q);
    if (!ok || erlaubt === null) return ok;
    const b = erlaubt.find((x) => x.url === ok.url || x.url === text(q.url) || decodeURI(x.url) === decodeURI(ok.url));
    return b ? { titel: `${b.quelle} – ${b.titel}`, url: b.url, domain: ok.domain } : null;
  };
  for (const a of Array.isArray(j.aussagen) ? j.aussagen : []) {
    if (!a || !text(a.aussage)) continue;
    if (aussagen.some((b) => b.aussage.toLowerCase() === text(a.aussage).toLowerCase())) continue;
    const art = NICHT_PRUEFBAR[a.art] ? a.art : a.urteil === 'nicht_pruefbar' ? 'unklar' : 'fakt';
    let wert = zahl(a.wahrscheinlichkeit, 50);
    const band = BAENDER[a.urteil];
    if (band) wert = Math.max(band[0], Math.min(band[1], wert));
    if (text(a.korrektur) && wert > 80) wert = 80; // mit Korrektur stimmt es nicht ganz
    const quellen = (Array.isArray(a.quellen) ? a.quellen : []).map(quelleErlaubt).filter(Boolean)
      .filter((q, i, l) => l.findIndex((x) => x.url === q.url) === i).slice(0, 4);
    aussagen.push({
      art,
      aussage: text(a.aussage).slice(0, 400),
      begruendung: text(a.begruendung).slice(0, 900),
      korrektur: text(a.korrektur).slice(0, 700),
      quellen,
      wert: art === 'fakt' ? wert : null,
      irrefuehrend: art === 'fakt' && a.urteil === 'irrefuehrend',
    });
    if (aussagen.length >= AUSSAGEN_MAX) break;
  }
  const fakten = aussagen.filter((a) => a.wert !== null);
  const schnitt = fakten.length ? Math.round(fakten.reduce((s, a) => s + a.wert, 0) / fakten.length) : null;
  const liste = (l, f) => (Array.isArray(l) ? l : []).map(f).filter(Boolean);
  return {
    aussagen,
    fazit: text(j.fazit).slice(0, 1200),
    kontext: text(j.kontext).slice(0, 900),
    thema: text(j.thema).slice(0, 80),
    // Gesamtwert des Modells, aber nicht weit weg vom Mittel der Aussagen
    wert: fakten.length === 1 ? fakten[0].wert : fakten.length ? Math.max(schnitt - 15, Math.min(schnitt + 15, zahl(j.glaubwuerdigkeit, schnitt))) : null,
    warnsignale: liste(j.warnsignale, (w) => (w && text(w.signal) ? { signal: text(w.signal).slice(0, 80), erklaerung: text(w.erklaerung).slice(0, 400) } : null)).slice(0, 8),
    weiterdenken: liste(j.weiterdenken, (w) => (w && text(w.titel) ? { titel: text(w.titel).slice(0, 100), text: text(w.text).slice(0, 500) } : null)).slice(0, 5),
  };
}

async function pruefen(eingabe) {
  const t = text(eingabe);
  if (!t || z.laeuft) return;
  const web = mitWeb();
  if (nurLink(t) && !web) {
    z.eingabe = t;
    z.fehler = 'Einen Link kann Veritas nur mit Internet-Recherche öffnen (Claude oder ChatGPT). Füge sonst den Text des Artikels ein.';
    return zeichnen();
  }
  const max = z.lehrer === 'lyra' ? TEXT_MAX.lokal : TEXT_MAX.web;
  z.eingabe = t;
  z.laeuft = true;
  z.fehler = null;
  z.hinweis = '';
  z.status = web ? `${lehrerInfo(z.lehrer).name} sucht im Internet nach Belegen …` : 'Veritas prüft …';
  zeichnen();
  try {
    let belege = [];
    if (!web) {
      try { belege = await belegeSammeln(t.slice(0, max)); } catch (e) {
        const m = String((e && e.message) || e);
        if (/ABGEBROCHEN|Abgebrochen/.test(m)) throw e;
        z.hinweis = m;
      }
      status(belege.length ? `${belege.length} Beleg${belege.length === 1 ? '' : 'e'} gefunden – Veritas prüft …` : 'Veritas prüft …');
    }
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: auftrag(t.slice(0, max), web, belege),
      schema: SCHEMA,
      zaehlen: { schluessel: 'aussage', wort: 'Aussage' },
      web,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const lehrer = (r && r.lehrer) || z.lehrer;
    const webWirklich = web && lehrer === z.lehrer;
    const herkunft = webWirklich ? 'web' : belege.length ? 'wiki' : 'wissen';
    const erg = aufbereiten((r && r.json) || {}, herkunft === 'web' ? null : belege);
    if (!erg.aussagen.length && !erg.fazit) throw new Error('Veritas konnte darin keine prüfbare Aussage finden. Formuliere die Behauptung als ganzen Satz.');
    z.p = {
      id: lyra.neueId(),
      zeit: lyra.jetzt(),
      text: t.slice(0, max),
      gekuerzt: t.length > max,
      name: z.dateiName,
      lehrer,
      lehrerName: lehrerInfo(lehrer).name,
      herkunft,
      belege: belege.map((b) => ({ nr: b.nr, quelle: b.quelle, titel: b.titel, url: b.url })),
      hinweis: z.hinweis,
      stil: stilSignale(t),
      ...erg,
      thema: erg.thema || t.slice(0, 60),
    };
    z.textOffen = false;
    z.eingabe = '';
    z.dateiName = '';
    await sichern();
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

async function dateiLaden() {
  try {
    const d = await lyra.dateiOeffnen({ arten: ['pdf', 'docx', 'txt', 'md'], titel: 'Texte' });
    if (!d) return;
    if (!text(d.text)) { z.fehler = 'In der Datei ließ sich kein Text finden – ist es ein eingescanntes Bild? Dann kopier den Text bitte hinein.'; return zeichnen(); }
    z.eingabe = d.text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
    z.dateiName = d.name.replace(/\.[^.]+$/, '');
    z.fehler = null;
  } catch (e) { z.fehler = String((e && e.message) || e); }
  zeichnen();
}

async function lehrerWaehlen(l) {
  z.lehrer = l;
  try { await lyra.speicher.schreiben('einstellungen', { lehrer: l }); } catch (_) {}
  zeichnen();
}

// ================================================================== Export

const stufe = (wert) => (wert === null || wert === undefined ? ['Nicht prüfbar', GRAU] : STUFEN.find(([ab]) => wert >= ab).slice(1));
const urteilVon = (a) => (a.wert === null ? [NICHT_PRUEFBAR[a.art] || 'Nicht prüfbar', GRAU] : a.irrefuehrend ? ['Irreführend', '#ea580c'] : stufe(a.wert));
const urteilText = (a) => (a.wert === null ? urteilVon(a)[0] : `${urteilVon(a)[0]} (${a.wert} %)`);
const datumText = (s) => new Date(s * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function markdown(p) {
  const z1 = [`# Faktencheck: ${p.thema}`, '',
    `Geprüft am ${datumText(p.zeit)} mit ${p.lehrerName} – ${HERKUNFT[p.herkunft].lang}.`, ''];
  if (p.wert !== null) z1.push(`**Glaubwürdigkeit: ${p.wert} % – ${stufe(p.wert)[0]}**`, '');
  if (p.fazit) z1.push(p.fazit, '');
  if (p.kontext) z1.push(`**Kontext:** ${p.kontext}`, '');
  z1.push('## Aussagen', '');
  p.aussagen.forEach((a, i) => {
    z1.push(`### ${i + 1}. ${a.aussage}`, '', `**${urteilText(a)}**`, '');
    if (a.begruendung) z1.push(a.begruendung, '');
    if (a.korrektur) z1.push(`**Richtig ist:** ${a.korrektur}`, '');
    if (a.quellen.length) z1.push('Quellen:', ...a.quellen.map((q) => `- [${q.titel}](${q.url})`), '');
  });
  if (p.warnsignale.length || p.stil.length) {
    z1.push('## Warnsignale', '');
    p.warnsignale.forEach((w) => z1.push(`- **${w.signal}:** ${w.erklaerung}`));
    p.stil.forEach((s) => z1.push(`- ${s.text} (automatisch gezählt)`));
    z1.push('');
  }
  if (p.weiterdenken.length) {
    z1.push('## Weiterdenken', '');
    p.weiterdenken.forEach((w) => z1.push(`- **${w.titel}:** ${w.text}`));
    z1.push('');
  }
  z1.push('## Geprüfter Text', '', ...p.text.split('\n').map((l) => '> ' + l), '', '---', '_Erstellt mit Veritas in Lyra. KI kann sich irren – prüf wichtige Dinge selbst nach._');
  return z1.join('\n');
}

function dateiname(p) {
  return (p.thema || 'Faktencheck').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Faktencheck';
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.p ? ergebnisAnsicht(z.p) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  lyra.titel(z.p ? z.p.thema : '');
}

function ring(wert, groesse = 132) {
  const [name, farbe] = stufe(wert);
  const r = 52, u = 2 * Math.PI * r;
  const anteil = wert === null ? 0 : wert / 100;
  const svg = `<svg viewBox="0 0 120 120" width="${groesse}" height="${groesse}" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="11"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${farbe}" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${(u * anteil).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>`;
  const box = h('div', { class: 'ring', style: { '--s': farbe, width: groesse + 'px', height: groesse + 'px' }, title: name });
  box.innerHTML = svg;
  box.appendChild(h('div', { class: 'ring-mitte' }, h('div', { class: 'ring-zahl' }, wert === null ? '–' : `${wert}`, wert === null ? null : h('small', {}, '%')),
    h('div', { class: 'ring-text' }, 'glaubwürdig')));
  return box;
}

function startAnsicht() {
  const l = lehrerInfo(z.lehrer);
  const ohneWeb = !l.web;
  const unten = h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
    z.info ? lyra.lehrerWahl(z.info, z.lehrer, lehrerWaehlen, { web: true, wiki: true }) : null,
    h('button', { class: 'ly-pille', onclick: dateiLaden, title: 'PDF, Word oder Text öffnen' }, '📄 Datei öffnen …'),
    z.dateiName ? h('span', { class: 'klein leise' }, `aus „${z.dateiName}“`) : null);
  const zeichen = z.eingabe.trim().length;
  return h('div', { class: 'seite' },
    h('div', { class: 'held' },
      h('div', { class: 'held-zeichen' }, '✓'),
      h('h1', {}, 'Stimmt das?'),
      h('div', { class: 'leise' }, 'Behauptung, Schlagzeile oder ganzen Artikel einfügen – Veritas prüft jede Aussage, schätzt in Prozent ein, wie wahrscheinlich sie stimmt, und korrigiert, was falsch ist.')),
    lyra.verfasser({
      wert: z.eingabe,
      platzhalter: 'z. B. „Der Mensch nutzt nur 10 % seines Gehirns.“ – oder einen Artikel bzw. Link einfügen …',
      beiEingabe: (v) => { z.eingabe = v; },
      beiSenden: pruefen,
      knopf: 'Prüfen',
      symbol: '✓',
      deaktiviert: z.laeuft,
      zeilen: zeichen > 300 ? 8 : 3,
      feld: 'eingabe',
      unten,
    }),
    ohneWeb && !z.laeuft ? h('div', { class: 'hinweis-offline' },
      h('b', {}, '📚 Ohne Websuche'),
      ` – ${l.name} prüft mit Auszügen aus Wikipedia & Co.${l.online ? '' : ' Dein Text bleibt auf dem Mac; hinaus geht nur eine kurze Suchanfrage.'} Für aktuelle Nachrichten und mehr Quellen `,
      ((z.info && z.info.lehrer) || []).some((x) => x.web) ? 'wähl Claude oder ChatGPT.' : 'verbinde Claude oder ChatGPT in Lyra unter „Konnektoren“.') : null,
    z.laeuft ? lyra.arbeit(z.status || 'Veritas prüft …') : null,
    z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; pruefen(z.eingabe); } : null,
      () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; pruefen(z.eingabe); }) : null,
    !z.laeuft && !z.eingabe.trim() ? h('div', { style: { marginTop: '14px' } },
      lyra.vorschlaege(lyra.mischen(BEISPIELE), (b) => { z.eingabe = b; pruefen(b); }, { max: 5, titel: 'Mythen zum Ausprobieren' })) : null,
    z.liste.length ? lyra.abschnitt(`Zuletzt geprüft · ${z.liste.length}`, h('div', { class: 'ly-liste' }, z.liste.slice(0, 40).map((e) => {
      const [name, farbe] = stufe(e.wert);
      return lyra.eintrag({
        symbol: (HERKUNFT[e.herkunft] || HERKUNFT.wissen).zeichen,
        titel: e.thema,
        unter: [lyra.zeitText(e.zeit), (HERKUNFT[e.herkunft] || HERKUNFT.wissen).kurz].join(' · '),
        rechts: h('span', { class: 'wert-etikett', style: { '--s': farbe }, title: name }, e.wert === null ? '–' : `${e.wert} %`),
        beiKlick: async () => { await oeffnen(e.id); zeichnen(); },
        aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => entfernen(e.id) }],
      });
    }))) : null,
    h('div', { class: 'fusszeile' }, 'Veritas ist eine KI-Einschätzung, kein Urteil – bei wichtigen Dingen lohnt der Blick in die Quellen.'));
}

function quellenListe(quellen) {
  if (!quellen.length) return null;
  return h('div', { class: 'quellen' }, quellen.map((q) =>
    h('button', { class: 'quelle', title: q.url, onclick: () => lyra.link(q.url).catch((e) => lyra.toast(String((e && e.message) || e), 'fehler')) },
      h('span', { class: 'quelle-domain' }, q.domain), h('span', { class: 'quelle-titel' }, q.titel), h('span', { class: 'quelle-pfeil' }, '↗'))));
}

function aussageKarte(a, i) {
  const [name, farbe] = urteilVon(a);
  return h('div', { class: 'aussage', style: { '--s': farbe } },
    h('div', { class: 'aussage-kopf' },
      h('span', { class: 'aussage-nr' }, String(i + 1)),
      h('div', { class: 'wachsen fett aussage-text' }, a.aussage),
      h('div', { class: 'urteil' }, h('span', { class: 'urteil-name' }, name), a.wert === null ? null : h('span', { class: 'urteil-wert' }, `${a.wert} %`))),
    a.wert === null ? null : h('div', { class: 'skala', title: `${a.wert} % wahrscheinlich wahr` }, h('div', { style: { width: Math.max(3, a.wert) + '%' } })),
    a.begruendung ? h('p', { class: 'begruendung' }, a.begruendung) : null,
    a.korrektur ? h('div', { class: 'korrektur' }, h('span', { class: 'korrektur-titel' }, '✎ Richtig ist'), h('div', {}, a.korrektur)) : null,
    quellenListe(a.quellen));
}

function ergebnisAnsicht(p) {
  const einzeln = p.aussagen.filter((a) => a.wert !== null);
  const [name, farbe] = einzeln.length === 1 ? urteilVon(einzeln[0]) : stufe(p.wert);
  const wahr = p.aussagen.filter((a) => a.wert !== null && a.wert >= 65).length;
  const falsch = p.aussagen.filter((a) => a.wert !== null && a.wert < 36 && !a.irrefuehrend).length;
  const offen = p.aussagen.length - wahr - falsch;
  const quellen = p.aussagen.reduce((s, a) => s + a.quellen.length, 0);
  return h('div', { class: 'seite breit' },
    h('div', { class: 'zeile', style: { marginBottom: '10px' } },
      h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.p = null; zeichnen(); } }, '← Neue Prüfung'),
      h('span', { class: 'wachsen' }),
      h('div', { class: 'zeile nur-bildschirm', style: { gap: '6px' } },
        h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(markdown(p), 'Faktencheck kopiert') }, 'Kopieren'),
        h('button', { class: 'knopf tonal klein', onclick: async () => { try { if (await lyra.speichern(dateiname(p) + '.md', markdown(p))) lyra.toast('✓ Gesichert', 'ok'); } catch (e) { lyra.toast(String((e && e.message) || e), 'fehler'); } } }, 'Als Markdown sichern'),
        h('button', { class: 'knopf tonal klein', onclick: () => lyra.drucken() }, 'PDF / Drucken'))),
    h('div', { class: 'gesamt flaeche', style: { '--s': farbe } },
      ring(p.wert),
      h('div', { class: 'wachsen', style: { minWidth: 0 } },
        h('div', { class: 'gesamt-urteil' }, p.wert === null ? 'Nicht prüfbar' : name),
        h('h2', { class: 'gesamt-thema' }, p.thema),
        p.fazit ? h('p', { class: 'gesamt-fazit' }, p.fazit) : null,
        h('div', { class: 'zeile umbruch', style: { gap: '6px', marginTop: '10px' } },
          wahr ? h('span', { class: 'mini', style: { '--s': '#16a34a' } }, `${wahr} stimmt`) : null,
          offen ? h('span', { class: 'mini', style: { '--s': '#d97706' } }, `${offen} teils/offen`) : null,
          falsch ? h('span', { class: 'mini', style: { '--s': '#dc2626' } }, `${falsch} falsch`) : null,
          h('span', { class: 'mini herkunft' + (p.herkunft === 'wissen' ? ' ohne' : '') },
            `${HERKUNFT[p.herkunft].zeichen} ${p.lehrerName} · ${p.herkunft === 'wissen' ? 'ohne Internet' : `${quellen} Quelle${quellen === 1 ? '' : 'n'}${p.herkunft === 'wiki' ? ' aus Wikipedia & Co.' : ''}`}`),
          h('span', { class: 'klein leise' }, datumText(p.zeit))))),
    p.herkunft === 'wissen' ? h('div', { class: 'hinweis-offline' }, h('b', {}, 'Einschätzung ohne Internet'),
      ' – aus dem Wissen des Modells, ohne Quellen-Links und ohne aktuelle Ereignisse.', p.hinweis ? ` (${p.hinweis})` : '', ' Für einen belegten Check wähl Claude oder ChatGPT.') : null,
    p.herkunft === 'wiki' ? h('div', { class: 'hinweis-offline wiki' }, h('b', {}, '📚 Geprüft mit Wikipedia & Co.'),
      ' – gut für Wissen und Mythen, aber nicht für aktuelle Nachrichten. Für Neues wähl Claude oder ChatGPT mit Websuche.') : null,
    p.kontext ? h('div', { class: 'kontext' }, h('span', { class: 'kontext-titel' }, '🧩 Was fehlt'), h('div', {}, p.kontext)) : null,
    lyra.abschnitt(`Aussagen · ${p.aussagen.length}`, p.aussagen.length
      ? h('div', { class: 'spalte', style: { gap: '10px' } }, p.aussagen.map(aussageKarte))
      : h('div', { class: 'leise' }, 'Keine prüfbaren Aussagen gefunden.')),
    p.warnsignale.length || p.stil.length ? lyra.abschnitt('🚩 Warnsignale für Fake News', h('div', { class: 'spalte', style: { gap: '8px' } },
      p.warnsignale.map((w) => h('div', { class: 'signal' }, h('span', { class: 'signal-name' }, w.signal), h('span', {}, w.erklaerung))),
      p.stil.length ? h('div', { class: 'stil' },
        h('div', { class: 'klein leise', style: { marginBottom: '6px' } }, 'Automatisch gezählt (ohne KI) – ein Hinweis, kein Beweis:'),
        h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, p.stil.map((s) => h('span', { class: 'stil-chip' }, `${s.zeichen} ${s.text}`)))) : null)) : null,
    p.weiterdenken.length ? lyra.abschnitt('💡 Weiterdenken', h('div', { class: 'weiter' }, p.weiterdenken.map((w) =>
      h('div', { class: 'weiter-karte' }, h('div', { class: 'fett' }, w.titel), h('div', { class: 'klein', style: { marginTop: '4px', lineHeight: 1.5 } }, w.text)))),
    z.scout ? h('button', { class: 'knopf tonal klein nur-bildschirm', onclick: () => lyra.plugin('scout', 'thema/' + encodeURIComponent(p.thema)) }, '🔭 Mit Scout tiefer recherchieren') : null) : null,
    lyra.abschnitt('Geprüfter Text', h('div', {},
      h('div', { class: 'gepruefter-text' + (z.textOffen || p.text.length < 400 ? ' offen' : '') }, p.text),
      p.text.length >= 400 ? h('button', { class: 'knopf text klein nur-bildschirm', onclick: () => { z.textOffen = !z.textOffen; zeichnen(); } }, z.textOffen ? 'Weniger zeigen' : 'Ganzen Text zeigen') : null,
      p.gekuerzt ? h('div', { class: 'klein leise' }, 'Der Text war sehr lang – geprüft wurde der Anfang.') : null)),
    h('div', { class: 'fusszeile' }, 'KI kann sich irren – auch mit Quellen. Klick die Belege an und urteile selbst.'));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const w = await lyra.dialog('Veritas', h('div', { style: { maxWidth: '460px', lineHeight: 1.55 } },
    h('p', {}, 'Mit Claude oder ChatGPT sucht Veritas im Internet nach Belegen – dabei geht der zu prüfende Text an den Anbieter (Lyra fragt beim ersten Mal). Nur die Websuche ist erlaubt; Befehle oder Dateien auf deinem Mac nicht.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Mit Lyra (lokal) bleibt alles auf deinem Mac – dann ohne Internet und ohne Quellen-Links.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, `${z.liste.length} Prüfung${z.liste.length === 1 ? '' : 'en'} gespeichert.`)), [
    { text: 'Verlauf löschen', art: 'gefahr', wert: 'loeschen' },
    { text: 'Fertig', wert: true },
  ]);
  if (w !== 'loeschen') return;
  if (!(await lyra.bestaetigen({ titel: 'Ganzen Verlauf löschen?', text: 'Alle gespeicherten Prüfungen werden gelöscht.', ja: 'Alles löschen', gefahr: true }))) return;
  for (const e of z.liste) { try { await lyra.speicher.loeschen('pruefungen/' + e.id); } catch (_) {} }
  z.liste = [];
  z.p = null;
  try { await lyra.speicher.schreiben('index', []); } catch (_) {}
  zeichnen();
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

function fusionAnbieten() {
  lyra.fusion.anbieten({
    pruefen: async (a, { status }) => {
      const material = lyra.fusion.materialOhneAufgabe(a, 12000) || lyra.fusion.thema(a);
      z.lehrer = a.lehrer || z.lehrer;
      const vorher = z.p;
      const uhr = setInterval(() => { if (z.status) status(z.status); }, 1200);
      try { await pruefen(material); } finally { clearInterval(uhr); }
      const p = z.p;
      if (!p || p === vorher) throw new Error(z.fehler || 'Veritas konnte nichts prüfen.');
      return {
        art: 'faktencheck',
        titel: `Faktencheck: ${p.thema}`,
        markdown: markdown(p),
        quellen: p.aussagen.flatMap((x) => x.quellen).map((q) => ({ titel: q.titel, url: q.url })),
        daten: { glaubwuerdigkeit: p.wert, herkunft: p.herkunft, fazit: p.fazit, kontext: p.kontext, aussagen: p.aussagen, warnsignale: p.warnsignale, weiterdenken: p.weiterdenken },
        oeffnen: 'pruefung/' + p.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
