'use strict';
/*
 * Scout – Recherche mit Zeitbudget. Thema, Recherchezeit, Umfang und (optional) Zeitraum der Quellen wählen: Scout plant
 * eine Gliederung, recherchiert in mehreren Runden (Claude/ChatGPT mit Websuche; Lyra lokal über Wikipedia & Co.) und
 * schreibt ein Skript, in dem jede Aussage mit einer anklickbaren Quelle belegt ist. Das Recherche-Tagebuch zeigt live,
 * was passiert; „Jetzt schreiben“ beendet die Suche jederzeit.
 */
const { h } = lyra;

const UMFANG = {
  kurz: { name: 'Kurz', unter: '~1–2 Seiten', abschnitte: 3, woerter: 700 },
  mittel: { name: 'Mittel', unter: '~3–4 Seiten', abschnitte: 5, woerter: 1600 },
  lang: { name: 'Ausführlich', unter: '~6–8 Seiten', abschnitte: 7, woerter: 3200 },
};
const DAUER = [['2', 'Schnell', '~2 Minuten Recherche'], ['5', 'Gründlich', '~5 Minuten Recherche'], ['10', 'Tiefgehend', '~10 Minuten Recherche'], ['20', 'Sehr tief', '~20 Minuten Recherche']];
const ZEITRAUM = [
  ['alles', 'Beliebig', 'Grundlagen und Aktuelles – egal, wann veröffentlicht'],
  ['woche', 'Letzte 7 Tage', 'Nur ganz aktuelle Meldungen'],
  ['monat', 'Letzter Monat', ''],
  ['quartal', 'Letzte 3 Monate', ''],
  ['jahr', 'Letztes Jahr', ''],
  ['5jahre', 'Letzte 5 Jahre', ''],
  ['eigen', 'Eigener Zeitraum …', 'Von–bis selbst festlegen'],
];
const RUNDE_MS = 75000; // so lange dauert eine Recherche-Runde mit Websuche etwa
const HERKUNFT = {
  web: { zeichen: '🌐', name: 'Websuche' },
  wiki: { zeichen: '📚', name: 'Wikipedia & Co.' },
  wissen: { zeichen: '🔒', name: 'ohne Internet' },
};
const IDEEN = [
  'Kernfusion – Stand der Forschung', 'Künstliche Intelligenz in der Medizin', 'Mikroplastik im Meer', 'Die Geschichte des Internets',
  'Wasserstoff als Energieträger', 'Schlaf und Gedächtnis', 'Die Weimarer Republik', 'Quantencomputer einfach erklärt',
  'Gentherapie mit CRISPR', 'Vier-Tage-Woche', 'Fast Fashion und Umwelt', 'Bienensterben – Ursachen',
];

const SYSTEM = `Du bist „Scout“ in Lyra: eine sorgfältige Rechercheurin. Du sprichst mich mit „du“ an und schreibst klares, \
sachliches Deutsch. Du arbeitest wie eine gute Wissenschaftsjournalistin: seriöse Quellen, konkrete Fakten, Zahlen mit \
Datum, verschiedene Positionen fair dargestellt. Du erfindest nichts – keine Zahlen, keine Zitate, keine Quellen.`;

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    gliederung: { type: 'array', items: { type: 'object', properties: { fragen: { type: 'array', items: { type: 'string' } }, titel: { type: 'string' } }, required: ['fragen', 'titel'] } },
    titel: { type: 'string' },
  },
  required: ['gliederung', 'titel'],
};
const FUND_SCHEMA = {
  type: 'object',
  properties: {
    fakten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          abschnitt: { type: 'integer' },
          aussage: { type: 'string' },
          quellen: { type: 'array', items: { type: 'object', properties: { datum: { type: 'string' }, titel: { type: 'string' }, url: { type: 'string' } }, required: ['datum', 'titel', 'url'] } },
        },
        required: ['abschnitt', 'aussage', 'quellen'],
      },
    },
    luecken: { type: 'string' },
  },
  required: ['fakten', 'luecken'],
};
// Sonder-Abschnitte für die Vertiefungsrunden
const AKTUELL = 101, KONTROVERS = 102;

const z = {
  info: null,
  lehrer: 'lyra',
  liste: [],
  s: null, // offenes Skript
  form: { thema: '', fokus: '', zeitraum: 'alles', von: '', bis: '', dauer: '5', umfang: 'mittel' },
  lauf: null,
  fehler: null,
  reiter: 'skript',
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const lehrerInfo = (k) => ((z.info && z.info.lehrer) || []).find((l) => l.kennung === k) || { kennung: k, name: k === 'lyra' ? 'Lyra (lokal)' : k };
const mitWeb = () => lehrerInfo(z.lehrer).web === true;
const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(String((e && e.message) || e));
const deDatum = (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const isoTag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  const lehrer = z.info.lehrer || [];
  let e = {};
  try { e = (await lyra.speicher.lesen('einstellungen')) || {}; } catch (_) {}
  const web = lehrer.find((l) => l.web);
  z.lehrer = lehrer.some((l) => l.kennung === e.lehrer) ? e.lehrer : (web ? web.kennung : z.info.standardLehrer || 'lyra');
  for (const k of ['dauer', 'umfang', 'zeitraum']) if (e[k]) z.form[k] = e[k];
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((x) => x && x.id); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.lauf) return abbrechen();
    if (z.s) { z.s = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('skript/')) await oeffnen(route.slice(7));
  else if (route.startsWith('thema/')) z.form.thema = route.slice(6);
  zeichnen();
}

async function merken() {
  try { await lyra.speicher.schreiben('einstellungen', { lehrer: z.lehrer, dauer: z.form.dauer, umfang: z.form.umfang, zeitraum: z.form.zeitraum }); } catch (_) {}
}

// ================================================================== Speichern

async function sichern(s) {
  try { await lyra.speicher.schreiben('skripte/' + s.id, s); } catch (_) {}
  const meta = { id: s.id, titel: s.titel, zeit: s.zeit, quellen: s.quellen.length, woerter: s.woerter, herkunft: s.herkunft };
  z.liste = [meta, ...z.liste.filter((e) => e.id !== s.id)].slice(0, 300);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
}

async function oeffnen(id) {
  try { const s = await lyra.speicher.lesen('skripte/' + id); if (s && s.markdown) { z.s = s; z.reiter = 'skript'; } } catch (_) {}
}

async function entfernen(id) {
  const ok = await lyra.bestaetigen({ titel: 'Recherche löschen?', text: 'Das Skript und das gesammelte Material werden gelöscht.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('skripte/' + id); } catch (_) {}
  z.liste = z.liste.filter((e) => e.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  if (z.s && z.s.id === id) z.s = null;
  zeichnen();
}

// ================================================================== Zeitraum

function zeitraum(f) {
  const heute = new Date();
  const zurueck = (tage, monate = 0, jahre = 0) => { const d = new Date(heute); d.setDate(d.getDate() - tage); d.setMonth(d.getMonth() - monate); d.setFullYear(d.getFullYear() - jahre); return d; };
  let von = null, bis = heute;
  switch (f.zeitraum) {
    case 'woche': von = zurueck(7); break;
    case 'monat': von = zurueck(0, 1); break;
    case 'quartal': von = zurueck(0, 3); break;
    case 'jahr': von = zurueck(0, 0, 1); break;
    case '5jahre': von = zurueck(0, 0, 5); break;
    case 'eigen':
      von = f.von ? new Date(f.von + 'T00:00:00') : null;
      bis = f.bis ? new Date(f.bis + 'T23:59:59') : heute;
      if (von && isNaN(von)) von = null;
      if (isNaN(bis)) bis = heute;
      if (!von && !f.bis) return null;
      break;
    default: return null;
  }
  return { von, bis, text: von ? `${deDatum(von)} bis ${deDatum(bis)}` : `bis ${deDatum(bis)}` };
}

/** Liegt ein Quellendatum (JJJJ, JJJJ-MM, JJJJ-MM-TT) außerhalb des Zeitraums? */
function ausserhalb(datum, zr) {
  if (!zr || !datum) return false;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(datum);
  if (!m) return false;
  const anfang = new Date(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1);
  const ende = new Date(+m[1], m[2] ? (m[3] ? +m[2] - 1 : +m[2]) : 12, m[3] ? +m[3] + 1 : 1);
  return (zr.von && ende <= zr.von) || anfang > zr.bis;
}

// ================================================================== Recherche

function schritt(text, info = '') {
  const s = { text, info, status: 'laeuft', seit: Date.now() };
  z.lauf.schritte.push(s);
  tagebuchMalen();
  return s;
}
function fertig(s, info, status = 'ok') { s.status = status; if (info !== undefined) s.info = info; tagebuchMalen(); }
function hinweis(t) { z.lauf.hinweis = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

function quelleAufnehmen(q, herkunft) {
  const url = text(q && q.url);
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return null;
  let u;
  try { u = new URL(url); } catch (_) { return null; }
  const l = z.lauf.quellen;
  const da = l.find((x) => x.url === u.toString());
  if (da) return da.nr;
  const datum = text(q.datum).slice(0, 10);
  const nr = l.length + 1;
  l.push({ nr, titel: text(q.titel).slice(0, 200) || u.hostname, url: u.toString(), domain: u.hostname.replace(/^www\./, ''), datum: /^\d{4}(-\d{2}){0,2}$/.test(datum) ? datum : '', herkunft, ausserhalb: ausserhalb(datum, z.lauf.zr) });
  return nr;
}

function rundenPlanen(abschnitte, budget) {
  const runden = Math.max(1, Math.floor(budget / RUNDE_MS));
  const n = abschnitte.length;
  const gruppen = [];
  const basis = Math.min(runden, n);
  for (let g = 0; g < basis; g++) gruppen.push({ art: 'grund', abschnitte: abschnitte.map((_, i) => i).filter((i) => i % basis === g) });
  const extra = [{ art: 'aktuell' }, { art: 'kontrovers' }, ...abschnitte.map((_, i) => ({ art: 'vertiefung', abschnitte: [i] }))];
  return [...gruppen, ...extra];
}

function rundenAuftrag(r, plan, f, zr, bekannt) {
  const heute = deDatum(new Date());
  const liste = (r.abschnitte || []).map((i) => `${i + 1}. ${plan.gliederung[i].titel}${plan.gliederung[i].fragen.length ? ` – Leitfragen: ${plan.gliederung[i].fragen.join(' ')}` : ''}`).join('\n');
  let aufgabe;
  if (r.art === 'grund') aufgabe = `Recherchiere zu diesen Abschnitten (die Nummer gehört in "abschnitt"):\n${liste}\n\nSammle je Abschnitt 5–8 wichtige, konkrete Fakten.`;
  else if (r.art === 'vertiefung') aufgabe = `Geh beim Abschnitt\n${liste}\nin die Tiefe: Details, Beispiele, Fallstudien, genaue Zahlen – möglichst aus anderen Quellen als bisher. "abschnitt": ${r.abschnitte[0] + 1}. Sammle 4–7 Fakten.`;
  else if (r.art === 'aktuell') aufgabe = `Was sind die neuesten Entwicklungen, Meldungen und Zahlen zum Thema${zr ? ' im Zeitraum' : ''}? "abschnitt": ${AKTUELL}. Sammle 4–7 Fakten, jeweils mit Datum.`;
  else aufgabe = `Welche Kontroversen, Kritikpunkte, Gegenpositionen und offenen Fragen gibt es? Wer vertritt welche Position? "abschnitt": ${KONTROVERS}. Sammle 4–7 Fakten.`;
  return `Heute ist der ${heute}. Thema der Recherche: „${f.thema}“${f.fokus ? ` – Fokus: ${f.fokus}` : ''}.\n\n${aufgabe}\n\n\
${zr ? `Zeitraum: Bevorzuge Quellen, die ${zr.von ? `zwischen dem ${deDatum(zr.von)} und dem ${deDatum(zr.bis)}` : `bis zum ${deDatum(zr.bis)}`} veröffentlicht wurden. Ältere \
Grundlagen nur, wenn sie zum Verständnis nötig sind.\n` : ''}\
Suche gründlich im Internet (mehrere Suchanfragen, auch auf Englisch) in seriösen Quellen: Fachzeitschriften und Studien, \
Universitäten, Behörden und Statistikämter, Fachportale, große Medien und Nachrichtenagenturen. Meide Foren, anonyme Blogs \
und Seiten ohne Impressum.${bekannt.length ? `\nDiese Quellen kenne ich schon – such ergänzend andere: ${bekannt.slice(-25).join(', ')}` : ''}

"fakten": je "abschnitt", "aussage" (1–3 Sätze auf Deutsch, konkret: Zahlen mit Jahr, Namen, Orte, Positionen) und \
"quellen" (1–2, die du wirklich gefunden hast: "titel", "url" vollständig mit https://, "datum" der Veröffentlichung als \
JJJJ-MM-TT, JJJJ-MM oder JJJJ – unbekannt: ""). Erfinde keine URLs. "luecken": was sich nicht gut belegen ließ (1 Satz) oder "".

Antwort als JSON: {"fakten": [{"abschnitt": 1, "aussage": "", "quellen": [{"datum": "", "titel": "", "url": ""}]}], "luecken": ""}`;
}

async function webRunden(plan, f) {
  const runden = rundenPlanen(plan.gliederung, z.lauf.ende - Date.now());
  for (const [i, r] of runden.entries()) {
    if (z.lauf.jetztSchreiben) break;
    const rest = z.lauf.ende - Date.now();
    if (i > 0 && rest < 40000) break;
    const name = r.art === 'grund' ? `Recherche: ${r.abschnitte.map((a) => plan.gliederung[a].titel).join(' · ')}`
      : r.art === 'aktuell' ? 'Neueste Entwicklungen' : r.art === 'kontrovers' ? 'Kontroversen & Kritik' : `Vertiefung: ${plan.gliederung[r.abschnitte[0]].titel}`;
    const s = schritt(name);
    try {
      const antwort = await lyra.ki({
        lehrer: z.lehrer, system: SYSTEM, web: true, schema: FUND_SCHEMA,
        prompt: rundenAuftrag(r, plan, f, z.lauf.zr, z.lauf.quellen.map((q) => q.domain).filter((d, k, l) => l.indexOf(d) === k)),
        zaehlen: { schluessel: 'aussage', wort: 'Fakt' },
      }, (x) => { if (x.art === 'hinweis') hinweis(x.text); });
      const j = (antwort && antwort.json) || {};
      let neu = 0;
      const vorher = z.lauf.quellen.length;
      for (const fa of Array.isArray(j.fakten) ? j.fakten : []) {
        if (!fa || !text(fa.aussage)) continue;
        let ab = Math.round(Number(fa.abschnitt));
        ab = ab === AKTUELL || ab === KONTROVERS ? ab : ab >= 1 && ab <= plan.gliederung.length ? ab - 1 : (r.abschnitte ? r.abschnitte[0] : AKTUELL);
        const nrn = (Array.isArray(fa.quellen) ? fa.quellen : []).map((q) => quelleAufnehmen(q, 'web')).filter(Boolean);
        if (!nrn.length) continue; // ohne Beleg kein Material
        if (z.lauf.fakten.some((x) => x.aussage === text(fa.aussage))) continue;
        z.lauf.fakten.push({ abschnitt: ab, aussage: text(fa.aussage).slice(0, 700), quellen: [...new Set(nrn)] });
        neu++;
      }
      fertig(s, `${neu} Fakten · ${z.lauf.quellen.length - vorher} neue Quellen`);
    } catch (e) {
      if (abgebrochen(e) && z.lauf.jetztSchreiben) { fertig(s, 'beendet – jetzt wird geschrieben', 'stopp'); break; }
      if (abgebrochen(e)) throw e;
      fertig(s, String((e && e.message) || e), 'fehler');
      if (!z.lauf.fakten.length && lyra.istOffline(String((e && e.message) || e))) throw e;
    }
  }
}

async function wikiRunden(plan, f) {
  const fragen = [];
  plan.gliederung.forEach((a, i) => { fragen.push({ i, frage: `${f.thema}: ${a.titel}` }); a.fragen.slice(0, 2).forEach((q) => fragen.push({ i, frage: q })); });
  const s = schritt('Nachschlagen in Wikipedia & Co.', 'nur kurze Suchanfragen gehen hinaus');
  let fehler = '';
  for (const [k, q] of fragen.entries()) {
    if (z.lauf.jetztSchreiben || Date.now() > z.lauf.ende) break;
    hinweis(`Schlage nach (${k + 1}/${fragen.length}): ${plan.gliederung[q.i].titel} …`);
    try {
      const funde = await lyra.nachschlagen(q.frage, 4);
      for (const b of Array.isArray(funde) ? funde : []) {
        const nr = quelleAufnehmen({ titel: `${b.quelle} – ${b.titel}`, url: b.url, datum: '' }, 'wiki');
        if (!nr || !text(b.text)) continue;
        if (z.lauf.fakten.some((x) => x.abschnitt === q.i && x.aussage === text(b.text))) continue;
        z.lauf.fakten.push({ abschnitt: q.i, aussage: text(b.text).slice(0, 2400), quellen: [nr], auszug: true });
      }
      fertig(s, `${z.lauf.fakten.length} Auszüge aus ${z.lauf.quellen.length} Artikeln`, 'laeuft');
    } catch (e) {
      if (abgebrochen(e)) throw e;
      fehler = String((e && e.message) || e);
      break;
    }
  }
  if (fehler && !z.lauf.fakten.length) { fertig(s, fehler, 'fehler'); return fehler; }
  fertig(s, `${z.lauf.fakten.length} Auszüge aus ${z.lauf.quellen.length} Artikeln`);
  return '';
}

function material(plan, nurAbschnitt = null) {
  const gruppen = [...plan.gliederung.map((a, i) => [i, a.titel]), [AKTUELL, 'Neueste Entwicklungen'], [KONTROVERS, 'Kontroversen & Kritik']];
  const teile = [];
  for (const [i, titel] of gruppen) {
    if (nurAbschnitt !== null && i !== nurAbschnitt) continue;
    const f = z.lauf.fakten.filter((x) => x.abschnitt === i);
    if (!f.length) continue;
    teile.push(`## ${titel}\n` + f.map((x) => `- ${x.aussage.replace(/\n+/g, ' ')} [${x.quellen.join(', ')}]`).join('\n'));
  }
  const nrn = new Set(z.lauf.fakten.filter((x) => nurAbschnitt === null || x.abschnitt === nurAbschnitt).flatMap((x) => x.quellen));
  const quellen = z.lauf.quellen.filter((q) => nrn.has(q.nr)).map((q) => `[${q.nr}] ${q.titel} – ${q.domain}${q.datum ? ` (${q.datum})` : ''}`).join('\n');
  return `${teile.join('\n\n')}\n\nQUELLEN:\n${quellen}`;
}

function schreibAuftrag(plan, f, u) {
  const kapitel = plan.gliederung.map((a) => `## ${a.titel}`).join('\n');
  return `Schreibe ein Recherche-Skript zum Thema „${f.thema}“${f.fokus ? ` (Fokus: ${f.fokus})` : ''} – auf Deutsch, etwa ${u.woerter} Wörter, in Markdown.

Aufbau:
# ${plan.titel}
> 2–3 Sätze: worum es geht und warum es wichtig ist
## Auf einen Blick
(5–7 Stichpunkte mit den wichtigsten Erkenntnissen)
${kapitel}
(je Kapitel Fließtext mit konkreten Fakten, Zahlen und Beispielen; ### Zwischenüberschriften, Aufzählungen und Tabellen, wo sie helfen)
## Neueste Entwicklungen   (nur, wenn das Material dazu etwas hergibt)
## Kontroversen & offene Fragen
## Wichtige Begriffe
(**Begriff** – Erklärung in einem Satz)

Regeln: Nutze NUR das MATERIAL unten. Belege jede Tatsache mit der Nummer ihrer Quelle in eckigen Klammern, z. B. [3] oder \
[2, 5]. Nenne bei Zahlen das Jahr. Erfinde nichts – was das Material nicht hergibt, lässt du weg. Schreib kein \
Quellenverzeichnis (das hängt Lyra an). Antworte nur mit dem Skript.

MATERIAL:
${material(plan)}`;
}

async function schreiben(plan, f, u) {
  const s = schritt('Skript schreiben', `${lehrerInfo(z.lehrer).name} schreibt ~${u.woerter} Wörter`);
  z.lauf.live = '';
  liveMalen();
  const lokal = z.lehrer === 'lyra';
  if (!lokal) {
    const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt: schreibAuftrag(plan, f, u) }, (x) => {
      if (x.art === 'text') { z.lauf.live += x.text; liveMalen(); } else if (x.art === 'ersetzen') { z.lauf.live = x.text; liveMalen(); } else if (x.art === 'hinweis') hinweis(x.text);
    });
    fertig(s, '');
    return text(r && r.text);
  }
  // Lyra (lokal): Kapitel für Kapitel – das schafft ein kleines Modell zuverlässiger
  const woerter = Math.round(u.woerter / (plan.gliederung.length + 1));
  const kapitel = [];
  const gruppen = [...plan.gliederung.map((a, i) => [i, a.titel]), [KONTROVERS, 'Kontroversen & offene Fragen']];
  for (const [k, [i, titel]] of gruppen.entries()) {
    if (!z.lauf.fakten.some((x) => x.abschnitt === i)) continue;
    hinweis(`Schreibe Kapitel ${k + 1} von ${gruppen.length}: ${titel} …`);
    const r = await lyra.ki({
      lehrer: 'lyra', system: SYSTEM,
      prompt: `Schreibe für ein Recherche-Skript zum Thema „${f.thema}“ das Kapitel „${titel}“ – etwa ${woerter} Wörter, sachlich, \
in Markdown (Fließtext, gern Aufzählungen; beginne direkt mit dem Text, ohne Überschrift). Nutze NUR die Auszüge unten und \
belege jede Tatsache mit der Nummer ihrer Quelle in eckigen Klammern, z. B. [2]. Erfinde nichts.\n\nAUSZÜGE:\n${material(plan, i)}`,
    }, (x) => { if (x.art === 'text') { z.lauf.live += x.text; liveMalen(); } });
    const t = text(r && r.text).replace(/^#+\s.*\n/, '');
    if (t) { kapitel.push(`## ${titel}\n\n${t}`); z.lauf.live += '\n\n'; }
  }
  if (!kapitel.length) throw new Error('Zu diesem Thema ließ sich in Wikipedia & Co. nichts Passendes finden. Versuch einen allgemeineren Begriff – oder Claude/ChatGPT mit Websuche.');
  hinweis('Schreibe den Überblick …');
  let ueberblick = '';
  try {
    const r = await lyra.ki({
      lehrer: 'lyra', system: SYSTEM,
      prompt: `Hier ist ein Recherche-Skript zum Thema „${f.thema}“:\n\n${kapitel.join('\n\n').slice(0, 9000)}\n\nSchreibe dazu: erst 2 Sätze \
Einleitung als Markdown-Zitat (beginnend mit „> “), dann „## Auf einen Blick“ mit 5 Stichpunkten der wichtigsten Erkenntnisse \
(mit den Quellennummern aus dem Text), dann „## Wichtige Begriffe“ mit 4–6 Begriffen (**Begriff** – Erklärung). Nur das.`,
    });
    ueberblick = text(r && r.text);
  } catch (e) { if (abgebrochen(e)) throw e; }
  const [vorn, ...rest] = ueberblick.split(/\n(?=##\s+Wichtige Begriffe)/);
  fertig(s, '');
  return `# ${plan.titel}\n\n${vorn || ''}\n\n${kapitel.join('\n\n')}\n\n${rest.join('\n')}`.replace(/\n{3,}/g, '\n\n');
}

async function recherchieren() {
  const f = { ...z.form, thema: text(z.form.thema), fokus: text(z.form.fokus) };
  if (!f.thema || z.lauf) return;
  const u = UMFANG[f.umfang] || UMFANG.mittel;
  const web = mitWeb();
  const zr = web ? zeitraum(f) : null;
  const budget = Number(f.dauer) * 60000;
  z.fehler = null;
  z.lauf = { schritte: [], start: Date.now(), ende: Date.now() + budget, budget, quellen: [], fakten: [], zr, jetztSchreiben: false, hinweis: '', live: '', phase: 'recherche' };
  merken();
  zeichnen();
  const uhr = setInterval(uhrMalen, 1000);
  try {
    // 1. Gliederung
    const s1 = schritt('Gliederung planen');
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: PLAN_SCHEMA,
      prompt: `Plane eine Recherche zum Thema „${f.thema}“${f.fokus ? ` mit dem Fokus: ${f.fokus}` : ''}. Gliedere sie in genau ${u.abschnitte} \
Kapitel, die zusammen das Thema gut abdecken (z. B. Grundlagen, Hintergründe, aktueller Stand, Anwendungen, Folgen – passend zum \
Thema). Je Kapitel "titel" (kurz) und "fragen" (2–3 konkrete Leitfragen für die Recherche). "titel" oben: ein guter Titel für \
das Skript.\n\nAntwort als JSON: {"gliederung": [{"fragen": [""], "titel": ""}], "titel": ""}`,
    }, (x) => { if (x.art === 'hinweis') hinweis(x.text); });
    const j = (r && r.json) || {};
    const plan = {
      titel: text(j.titel).slice(0, 140) || f.thema,
      gliederung: (Array.isArray(j.gliederung) ? j.gliederung : []).filter((a) => a && text(a.titel)).slice(0, u.abschnitte + 1)
        .map((a) => ({ titel: text(a.titel).slice(0, 100), fragen: (Array.isArray(a.fragen) ? a.fragen : []).map(text).filter(Boolean).slice(0, 3) })),
    };
    if (!plan.gliederung.length) plan.gliederung = [{ titel: 'Überblick', fragen: [] }];
    z.lauf.plan = plan;
    fertig(s1, plan.gliederung.map((a) => a.titel).join(' · '));

    // 2. Material sammeln
    let herkunft = web ? 'web' : 'wiki';
    if (web) await webRunden(plan, f);
    else {
      const fehler = await wikiRunden(plan, f);
      if (fehler) herkunft = 'wissen';
    }
    if (!z.lauf.fakten.length && herkunft === 'web') throw new Error('Bei der Recherche kam kein belegtes Material zusammen. Versuch es noch einmal oder formuliere das Thema anders.');

    // 3. Schreiben
    z.lauf.phase = 'schreiben';
    zeichnen();
    let markdown;
    if (herkunft === 'wissen') {
      const s = schritt('Skript schreiben', 'ohne Quellen – nur aus dem Wissen des Modells');
      const r2 = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt: `Schreibe ein Lern-Skript zum Thema „${f.thema}“ (etwa ${u.woerter} Wörter, Markdown, mit „## Auf einen Blick“ am Anfang und „## Wichtige Begriffe“ am Ende), gegliedert in: ${plan.gliederung.map((a) => a.titel).join(', ')}. Ohne Quellenangaben; markiere Unsicheres.` },
        (x) => { if (x.art === 'text') { z.lauf.live += x.text; liveMalen(); } });
      markdown = text(r2 && r2.text);
      fertig(s, '');
    } else {
      markdown = await schreiben(plan, f, u);
    }
    if (!markdown) throw new Error('Das Skript kam leer zurück – bitte noch einmal versuchen.');
    if (!/^#\s/.test(markdown)) markdown = `# ${plan.titel}\n\n${markdown}`;
    const benutzt = new Set([...markdown.matchAll(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g)].flatMap((m) => m[1].split(/[,;]/).map((n) => +n.trim())));
    const s = {
      id: lyra.neueId(),
      zeit: lyra.jetzt(),
      titel: plan.titel,
      thema: f.thema,
      fokus: f.fokus,
      form: { ...z.form },
      zeitraumText: zr ? zr.text : '',
      umfang: f.umfang,
      dauerMin: Math.max(1, Math.round((Date.now() - z.lauf.start) / 60000)),
      lehrer: z.lehrer,
      lehrerName: lehrerInfo(z.lehrer).name,
      herkunft,
      gliederung: plan.gliederung,
      markdown,
      quellen: z.lauf.quellen.map((q) => ({ ...q, zitiert: benutzt.has(q.nr) })),
      fakten: z.lauf.fakten.map((x) => ({ abschnitt: x.abschnitt, aussage: x.auszug ? x.aussage.slice(0, 600) : x.aussage, quellen: x.quellen })),
      woerter: markdown.split(/\s+/).filter(Boolean).length,
    };
    await sichern(s);
    z.s = s;
    z.reiter = 'skript';
    z.form.thema = '';
    z.form.fokus = '';
  } catch (e) {
    if (!abgebrochen(e)) z.fehler = String((e && e.message) || e);
  }
  clearInterval(uhr);
  z.lauf = null;
  zeichnen();
}

function jetztSchreiben() {
  if (!z.lauf || z.lauf.phase !== 'recherche') return;
  if (!z.lauf.plan) return lyra.toast('Einen Moment – erst muss die Gliederung stehen.');
  z.lauf.jetztSchreiben = true;
  lyra.abbrechen().catch(() => {});
  tagebuchMalen();
}

function abbrechen() {
  if (!z.lauf) return;
  z.lauf.jetztSchreiben = false;
  lyra.abbrechen().catch(() => {});
}

// ================================================================== Export

function exportMarkdown(s) {
  const zitiert = s.quellen.filter((q) => q.zitiert);
  const liste = (zitiert.length ? zitiert : s.quellen).map((q) => `${q.nr}. [${q.titel}](${q.url}) – ${q.domain}${q.datum ? `, ${q.datum}` : ''}`);
  return `${s.markdown}\n\n## Quellen\n\n${liste.join('\n')}\n\n---\n_Recherchiert mit Scout in Lyra am ${deDatum(new Date(s.zeit * 1000))} · \
${s.lehrerName} (${HERKUNFT[s.herkunft].name})${s.zeitraumText ? ` · Zeitraum: ${s.zeitraumText}` : ''}. KI kann sich irren – prüf wichtige Angaben in den Quellen._\n`;
}

function dateiname(s) {
  return (s.titel || 'Recherche').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Recherche';
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.lauf ? laufAnsicht() : z.s ? skriptAnsicht(z.s) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  lyra.titel(z.s && !z.lauf ? z.s.titel : '');
}

function startAnsicht() {
  const f = z.form;
  const l = lehrerInfo(z.lehrer);
  const setzen = (k) => (w) => { f[k] = w; merken(); zeichnen(); };
  const optionen = h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
    z.info ? lyra.lehrerWahl(z.info, z.lehrer, (w) => { z.lehrer = w; merken(); zeichnen(); }, { web: true, wiki: true }) : null,
    lyra.auswahl({ titel: 'Zeit', optionen: DAUER, wert: f.dauer, beiWahl: setzen('dauer') }),
    lyra.auswahl({ titel: 'Umfang', optionen: Object.entries(UMFANG).map(([k, u]) => [k, u.name, u.unter]), wert: f.umfang, beiWahl: setzen('umfang') }),
    lyra.auswahl({ titel: 'Quellen', optionen: ZEITRAUM, wert: f.zeitraum, beiWahl: setzen('zeitraum'), breit: true }));
  const fokus = h('input', { class: 'eingabe', 'data-feld': 'fokus', placeholder: 'Fokus oder Fragen (optional) – z. B. „für ein Referat im Fach Physik“ oder „Kosten und Zeitplan“', value: f.fokus });
  fokus.addEventListener('input', () => { f.fokus = fokus.value; });
  fokus.addEventListener('keydown', (e) => { if (e.key === 'Enter') recherchieren(); });
  let eigen = null;
  if (f.zeitraum === 'eigen') {
    const datum = (k) => { const i = h('input', { type: 'date', class: 'datum', value: f[k], max: isoTag(new Date()) }); i.addEventListener('change', () => { f[k] = i.value; }); return i; };
    eigen = h('div', { class: 'zeile klein', style: { gap: '8px' } }, 'Quellen von', datum('von'), 'bis', datum('bis'), h('span', { class: 'leise' }, '(leer = offen)'));
  }
  const zr = zeitraum(f);
  return h('div', { class: 'seite' },
    h('div', { class: 'held' },
      h('div', { class: 'held-zeichen' }, '🔭'),
      h('h1', {}, 'Was soll ich recherchieren?'),
      h('div', { class: 'leise' }, 'Scout sucht in mehreren Runden nach Material und schreibt dir ein Skript – jede Aussage mit Quelle.')),
    lyra.verfasser({
      wert: f.thema,
      platzhalter: 'Thema, z. B. „Kernfusion – Stand der Forschung“',
      beiEingabe: (v) => { f.thema = v; },
      beiSenden: recherchieren,
      knopf: 'Recherchieren',
      symbol: '🔭',
      zeilen: 2,
      feld: 'thema',
      unten: optionen,
    }),
    h('div', { class: 'spalte', style: { gap: '8px', marginTop: '10px' } }, fokus, eigen),
    h('div', { class: 'plan-zeile' },
      `≈ ${f.dauer} Min. Recherche + ${z.lehrer === 'lyra' ? '2–4' : '1–2'} Min. Schreiben · ${UMFANG[f.umfang].unter}`,
      mitWeb() && zr ? ` · Quellen ${zr.von ? 'ab ' + deDatum(zr.von) : 'bis ' + deDatum(zr.bis)}` : ''),
    !mitWeb() ? h('div', { class: 'hinweis-offline' }, h('b', {}, '📚 Ohne Websuche'),
      ` – ${l.name} recherchiert in Wikipedia, Wikibooks und Stack Exchange${l.online ? '' : '; dein Thema bleibt auf dem Mac, hinaus geht nur eine kurze Suchanfrage'}. `,
      f.zeitraum !== 'alles' ? 'Der Zeitraum gilt nur mit Websuche. ' : '',
      ((z.info && z.info.lehrer) || []).some((x) => x.web) ? 'Für aktuelle Quellen wähl Claude oder ChatGPT.' : 'Für aktuelle Quellen verbinde Claude oder ChatGPT in Lyra unter „Konnektoren“.') : null,
    z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; recherchieren(); }) : null,
    !f.thema.trim() ? h('div', { style: { marginTop: '14px' } }, lyra.vorschlaege(lyra.mischen(IDEEN), (t) => { f.thema = t; zeichnen(); }, { max: 5, titel: 'Ideen' })) : null,
    z.liste.length ? lyra.abschnitt(`Deine Recherchen · ${z.liste.length}`, h('div', { class: 'ly-liste' }, z.liste.slice(0, 60).map((e) => lyra.eintrag({
      symbol: (HERKUNFT[e.herkunft] || HERKUNFT.web).zeichen,
      titel: e.titel,
      unter: [lyra.zeitText(e.zeit), `${e.woerter.toLocaleString('de-DE')} Wörter`, `${e.quellen} Quellen`].join(' · '),
      beiKlick: async () => { await oeffnen(e.id); zeichnen(); },
      aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => entfernen(e.id) }],
    })))) : null);
}

// --- Laufende Recherche

function laufAnsicht() {
  const L = z.lauf;
  return h('div', { class: 'seite' },
    h('div', { class: 'lauf-kopf' },
      h('div', { class: 'held-zeichen klein' }, '🔭'),
      h('div', { class: 'wachsen' },
        h('h2', {}, z.form.thema),
        h('div', { class: 'leise klein' }, [lehrerInfo(z.lehrer).name, mitWeb() ? 'mit Websuche' : 'Wikipedia & Co.', L.zr ? `Quellen: ${L.zr.text}` : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'zahlen' },
        h('div', {}, h('b', { id: 'z-quellen' }, String(L.quellen.length)), h('span', {}, 'Quellen')),
        h('div', {}, h('b', { id: 'z-fakten' }, String(L.fakten.length)), h('span', {}, mitWeb() ? 'Fakten' : 'Auszüge')))),
    h('div', { class: 'uhr' },
      h('div', { class: 'uhr-balken' }, h('div', { id: 'uhr-fuellung' })),
      h('div', { class: 'zeile klein' }, h('span', { id: 'uhr-text', class: 'wachsen leise' }, ''),
        L.phase === 'recherche' ? h('button', { class: 'knopf tonal klein', id: 'jetzt', disabled: L.jetztSchreiben, onclick: jetztSchreiben }, L.jetztSchreiben ? 'Gleich wird geschrieben …' : '✍️ Jetzt schreiben') : null,
        h('button', { class: 'knopf text klein', onclick: abbrechen }, 'Abbrechen'))),
    h('div', { class: 'ly-arbeit', style: { marginTop: '12px' } },
      h('div', { class: 'zeile' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'status' }, L.hinweis || 'Scout arbeitet …'))),
    h('div', { class: 'tagebuch', id: 'tagebuch' }),
    h('pre', { class: 'live', id: 'live', style: { display: L.live ? '' : 'none' } }));
}

function tagebuchMalen() {
  const el = document.getElementById('tagebuch');
  if (!el || !z.lauf) return;
  const zeichen = { laeuft: '◌', ok: '✓', fehler: '⚠︎', stopp: '■' };
  el.replaceChildren(...z.lauf.schritte.map((s) => h('div', { class: 'schritt ' + s.status },
    h('span', { class: 'schritt-zeichen' }, zeichen[s.status] || '•'),
    h('div', { class: 'wachsen', style: { minWidth: 0 } }, h('div', { class: 'schritt-text' }, s.text), s.info ? h('div', { class: 'klein leise' }, s.info) : null))));
  const q = document.getElementById('z-quellen'), f = document.getElementById('z-fakten');
  if (q) q.textContent = String(z.lauf.quellen.length);
  if (f) f.textContent = String(z.lauf.fakten.length);
  const k = document.getElementById('jetzt');
  if (k && z.lauf.jetztSchreiben) { k.disabled = true; k.textContent = 'Gleich wird geschrieben …'; }
}

function uhrMalen() {
  const L = z.lauf;
  if (!L) return;
  const fuell = document.getElementById('uhr-fuellung'), t = document.getElementById('uhr-text');
  const vergangen = Date.now() - L.start;
  if (fuell) fuell.style.width = Math.min(100, (vergangen / L.budget) * 100) + '%';
  const rest = Math.max(0, Math.round((L.ende - Date.now()) / 1000));
  if (t) t.textContent = L.phase === 'schreiben' ? `Recherche fertig nach ${Math.max(1, Math.round(vergangen / 60000))} Min. – das Skript entsteht …`
    : rest > 0 ? `Recherchezeit: noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')} Min.` : 'Zeit um – die laufende Runde wird noch fertig …';
}

function liveMalen() {
  const el = document.getElementById('live');
  if (!el || !z.lauf) return;
  el.style.display = z.lauf.live ? '' : 'none';
  el.textContent = z.lauf.live.slice(-6000);
  el.scrollTop = el.scrollHeight;
}

// --- Fertiges Skript

/** „[3]“ und „[2, 5]“ im gerenderten Skript → anklickbare Verweise auf die Quelle. */
function zitateVerlinken(el, quellen) {
  const nachNr = new Map(quellen.map((q) => [q.nr, q]));
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const knoten = [];
  while (w.nextNode()) if (/\[\d+(?:\s*[,;]\s*\d+)*\]/.test(w.currentNode.nodeValue) && !w.currentNode.parentElement.closest('code, pre')) knoten.push(w.currentNode);
  for (const n of knoten) {
    const frag = document.createDocumentFragment();
    let pos = 0;
    const t = n.nodeValue;
    for (const m of t.matchAll(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g)) {
      frag.append(t.slice(pos, m.index));
      const nrn = m[1].split(/[,;]/).map((x) => +x.trim()).filter((x) => nachNr.has(x));
      if (!nrn.length) frag.append(m[0]);
      else frag.append(h('sup', { class: 'zitate' }, nrn.map((nr) => {
        const q = nachNr.get(nr);
        return h('button', { class: 'zitat' + (q.ausserhalb ? ' alt' : ''), title: `${q.titel} – ${q.domain}${q.datum ? ` (${q.datum})` : ''}`, onclick: () => lyra.link(q.url).catch(() => {}) }, String(nr));
      })));
      pos = m.index + m[0].length;
    }
    frag.append(t.slice(pos));
    n.replaceWith(frag);
  }
}

function skriptAnsicht(s) {
  const zitiert = s.quellen.filter((q) => q.zitiert).length;
  const ausser = s.quellen.filter((q) => q.ausserhalb).length;
  const kopf = h('div', { class: 'zeile', style: { marginBottom: '12px' } },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.s = null; zeichnen(); } }, '← Alle Recherchen'),
    h('span', { class: 'wachsen' }),
    h('div', { class: 'zeile nur-bildschirm', style: { gap: '6px' } },
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(exportMarkdown(s), 'Skript kopiert') }, 'Kopieren'),
      h('button', { class: 'knopf tonal klein', onclick: async () => { try { if (await lyra.speichern(dateiname(s) + '.md', exportMarkdown(s))) lyra.toast('✓ Gesichert', 'ok'); } catch (e) { lyra.toast(String((e && e.message) || e), 'fehler'); } } }, 'Als Markdown sichern'),
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.drucken() }, 'PDF / Drucken')));
  const meta = h('div', { class: 'meta' },
    h('span', { class: 'mini' }, `${HERKUNFT[s.herkunft].zeichen} ${s.lehrerName} · ${HERKUNFT[s.herkunft].name}`),
    h('span', { class: 'mini' }, `${s.quellen.length} Quellen`),
    h('span', { class: 'mini' }, `${s.woerter.toLocaleString('de-DE')} Wörter · ~${Math.max(1, Math.round(s.woerter / 220))} Min. Lesezeit`),
    s.zeitraumText ? h('span', { class: 'mini' }, `📅 ${s.zeitraumText}`) : null,
    h('span', { class: 'klein leise' }, `${lyra.zeitText(s.zeit)} · ${s.dauerMin} Min. Recherche`));
  const reiter = h('div', { class: 'nur-bildschirm', style: { margin: '14px 0 12px' } },
    lyra.reiter([['skript', 'Skript'], ['quellen', 'Quellen', s.quellen.length], ['material', 'Material', s.fakten.length]], z.reiter, (r) => { z.reiter = r; zeichnen(); }));
  let inhalt;
  if (z.reiter === 'quellen') {
    inhalt = h('div', { class: 'spalte', style: { gap: '6px' } },
      ausser ? h('div', { class: 'klein leise' }, `${ausser} Quelle${ausser === 1 ? '' : 'n'} liegt laut Datum außerhalb des gewählten Zeitraums (orange markiert).`) : null,
      s.quellen.map((q) => h('button', { class: 'quelle' + (q.ausserhalb ? ' alt' : ''), onclick: () => lyra.link(q.url).catch((e) => lyra.toast(String((e && e.message) || e), 'fehler')) },
        h('span', { class: 'quelle-nr' }, String(q.nr)),
        h('span', { class: 'wachsen', style: { minWidth: 0 } }, h('div', { class: 'quelle-titel' }, q.titel), h('div', { class: 'klein leise' }, [q.domain, q.datum, q.zitiert ? 'im Skript zitiert' : 'nicht zitiert'].filter(Boolean).join(' · '))),
        h('span', { class: 'quelle-pfeil' }, '↗'))));
  } else if (z.reiter === 'material') {
    const namen = new Map([...s.gliederung.map((a, i) => [i, a.titel]), [AKTUELL, 'Neueste Entwicklungen'], [KONTROVERS, 'Kontroversen & Kritik']]);
    inhalt = h('div', {}, [...namen].filter(([i]) => s.fakten.some((x) => x.abschnitt === i)).map(([i, titel]) =>
      lyra.abschnitt(titel, h('ul', { class: 'material' }, s.fakten.filter((x) => x.abschnitt === i).map((x) => {
        const li = h('li', {}, x.aussage + ' ' + `[${x.quellen.join(', ')}]`);
        zitateVerlinken(li, s.quellen);
        return li;
      })))));
  } else {
    const md = lyra.mdElement(s.markdown, 'skript');
    zitateVerlinken(md, s.quellen);
    const ueber = [...md.querySelectorAll('h3')]; // „##“ – die Kapitel
    ueber.forEach((u, i) => { u.id = 'k' + i; });
    const inhaltsverzeichnis = ueber.length > 3 ? h('nav', { class: 'toc nur-bildschirm' }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, 'Inhalt'),
      ueber.map((u, i) => h('button', { class: 'toc-punkt', onclick: () => document.getElementById('k' + i).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, u.textContent))) : null;
    const zitatHinweis = s.herkunft !== 'wissen' ? h('div', { class: 'klein leise nur-bildschirm', style: { marginTop: '18px' } },
      `Hochgestellte Zahlen sind Quellen – anklicken öffnet sie im Browser. ${zitiert} von ${s.quellen.length} Quellen sind im Skript zitiert.`) : h('div', { class: 'hinweis-offline' }, h('b', {}, 'Ohne Quellen'), ' – dieses Skript stammt nur aus dem Wissen des Modells. Prüf die Angaben, bevor du sie verwendest.');
    // Für den Druck: Quellenverzeichnis anhängen
    const druckQuellen = h('div', { class: 'nur-druck' }, h('h2', {}, 'Quellen'), h('ol', {}, s.quellen.filter((q) => q.zitiert).map((q) => h('li', { value: q.nr }, `${q.titel} – ${q.url}${q.datum ? ` (${q.datum})` : ''}`))));
    inhalt = h('div', { class: 'skript-raster' + (inhaltsverzeichnis ? ' mit-toc' : '') }, inhaltsverzeichnis, h('article', { class: 'skript-blatt' }, md, zitatHinweis, druckQuellen));
  }
  return h('div', { class: 'seite breit' }, kopf, meta, reiter, inhalt,
    h('div', { class: 'zeile nur-bildschirm', style: { marginTop: '22px', gap: '8px', justifyContent: 'center' } },
      h('button', { class: 'knopf tonal klein', onclick: () => { z.form = { ...z.form, ...(s.form || {}), thema: s.thema, fokus: s.fokus || '' }; z.s = null; zeichnen(); } }, '🔁 Neu recherchieren (Einstellungen anpassen)')),
    h('div', { class: 'fusszeile' }, 'KI kann sich irren – auch mit Quellen. Für Hausarbeiten: Zitiere die Originalquellen, nicht dieses Skript.'));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const w = await lyra.dialog('Scout', h('div', { style: { maxWidth: '470px', lineHeight: 1.55 } },
    h('p', {}, 'Mit Claude oder ChatGPT sucht Scout im Internet – dafür gehen dein Thema und deine Fragen an den Anbieter (Lyra fragt beim ersten Mal). Erlaubt ist nur die Websuche; Befehle oder Dateien auf deinem Mac nicht.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Mit Lyra (lokal) schlägt Scout in Wikipedia, Wikibooks und Stack Exchange nach. Hinaus geht nur eine kurze, allgemeine Suchanfrage; geschrieben wird auf deinem Mac.'),
    h('p', { class: 'leise', style: { marginTop: '8px' } }, `${z.liste.length} Recherche${z.liste.length === 1 ? '' : 'n'} gespeichert.`)), [
    { text: 'Alle löschen', art: 'gefahr', wert: 'loeschen' },
    { text: 'Fertig', wert: true },
  ]);
  if (w !== 'loeschen') return;
  if (!(await lyra.bestaetigen({ titel: 'Alle Recherchen löschen?', text: 'Alle Skripte und das gesammelte Material werden gelöscht.', ja: 'Alles löschen', gefahr: true }))) return;
  for (const e of z.liste) { try { await lyra.speicher.loeschen('skripte/' + e.id); } catch (_) {} }
  z.liste = [];
  z.s = null;
  try { await lyra.speicher.schreiben('index', []); } catch (_) {}
  zeichnen();
}

start();
