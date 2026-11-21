'use strict';
/*
 * Justitia – Gutachtenstil-Trainer für Jura. Justitia stellt dir einen Fall (oder du bringst deinen eigenen mit), du
 * löst ihn im Gutachtenstil – mit Bausteinen für Obersatz, Definition, Subsumtion und Ergebnis und einem Stil-Check,
 * der live mitliest. Danach korrigiert Justitia wie ein Korrektor: Punkte (0–18), was gut ist, was fehlt, Stilhinweise.
 * Die Musterlösung gibt es nur, wenn du ausdrücklich danach fragst. Training – keine Rechtsberatung.
 */
const { h } = lyra;

const GEBIETE = {
  bgbat: ['BGB AT', 'Vertragsschluss, Willenserklärung, Anfechtung, Stellvertretung, Geschäftsfähigkeit'],
  schuldrecht: ['Schuldrecht', 'Kaufrecht, Mängelrechte, Rücktritt, Schadensersatz nach §§ 280 ff. BGB'],
  delikt: ['Deliktsrecht', '§ 823 Abs. 1 und 2 BGB, § 831 BGB, Schmerzensgeld'],
  sachen: ['Sachenrecht', 'Eigentumserwerb (§§ 929 ff. BGB), gutgläubiger Erwerb, Herausgabe (§ 985 BGB)'],
  strafat: ['Strafrecht AT', 'Vorsatz, Rechtfertigung (Notwehr), Versuch und Rücktritt, Täterschaft und Teilnahme'],
  strafbt: ['Strafrecht BT', 'Diebstahl, Betrug, Körperverletzung, Sachbeschädigung, Urkundenfälschung'],
  grundrechte: ['Grundrechte', 'Verfassungsbeschwerde, Schutzbereich, Eingriff, Rechtfertigung, Verhältnismäßigkeit'],
  verwaltung: ['Verwaltungsrecht', 'Anfechtungsklage, Verwaltungsakt, formelle und materielle Rechtmäßigkeit'],
};
const STUFEN = [['einstieg', 'Einstieg'], ['klausur', 'Klausurniveau']];
const BAUSTEINE = [
  ['Obersatz', 'A könnte gegen B einen Anspruch auf … aus § … haben.'],
  ['Voraussetzung', 'Dazu müsste …'],
  ['Definition', ' ist/sind … (Definition).'],
  ['Subsumtion', 'Hier …'],
  ['Problem', 'Fraglich ist, ob …'],
  ['Zwischenergebnis', 'Mithin …'],
  ['Ergebnis', 'Also hat A gegen B einen Anspruch auf … aus § ….'],
];
const STANDARD = { ki: 'auto' };

const SYSTEM = `Du bist „Justitia“ in Lyra, eine erfahrene Repetitorin und Korrektorin für das deutsche Jurastudium. \
Du arbeitest streng nach deutschem Recht und im Gutachtenstil: Obersatz (Konjunktiv) → Definition → Subsumtion → \
Ergebnis. Du zitierst Normen genau (Paragraph, Absatz, Satz, Gesetz). Sachverhalte sind kurz, realistisch und \
eindeutig, mit typischen Klausurproblemen. Bei Streitständen nennst du die Ansichten knapp und entscheidest begründet. \
Du antwortest auf Deutsch.`;

// Schlüssel alphabetisch sinnvoll: erst Fall, dann Frage, dann Lösung, zuletzt Titel; im Aufbau: Abschnitt, Definition, Norm, Subsumtion
const SCHEMA_FALL = {
  type: 'object',
  properties: {
    fall: { type: 'string' },
    frage: { type: 'string' },
    loesung: {
      type: 'object',
      properties: {
        aufbau: { type: 'array', items: { type: 'object', properties: { abschnitt: { type: 'string' }, definition: { type: 'string' }, norm: { type: 'string' }, subsumtion: { type: 'string' } }, required: ['abschnitt', 'definition', 'norm', 'subsumtion'] } },
        schluss: { type: 'string' },
      },
      required: ['aufbau', 'schluss'],
    },
    titel: { type: 'string' },
  },
  required: ['fall', 'frage', 'loesung', 'titel'],
};
const SCHEMA_BEWERTUNG = {
  type: 'object',
  properties: {
    fehlt: { type: 'array', items: { type: 'string' } },
    gut: { type: 'array', items: { type: 'string' } },
    hinweise: { type: 'array', items: { type: 'object', properties: { art: { type: 'string', enum: ['stil', 'inhalt', 'aufbau'] }, hinweis: { type: 'string' }, stelle: { type: 'string' } }, required: ['art', 'hinweis', 'stelle'] } },
    punkte: { type: 'integer' },
    stil: { type: 'string' },
  },
  required: ['fehlt', 'gut', 'hinweise', 'punkte', 'stil'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  faelle: [],
  f: null,
  wahl: { gebiet: 'bgbat', stufe: 'einstieg', eigenerFall: '', eigeneFrage: '' },
  eigen: false,
  modus: null, // klassiker | ki | eigen – null: Klassiker mit Lyra lokal, sonst KI
  laeuft: false,
  status: '',
  fehler: null,
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const NOTEN = [[16, 'sehr gut'], [13, 'gut'], [10, 'vollbefriedigend'], [7, 'befriedigend'], [4, 'ausreichend'], [1, 'mangelhaft'], [0, 'ungenügend']];
const note = (p) => NOTEN.find(([g]) => p >= g)[1];

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.faelle = (await lyra.speicher.liste('faelle')).map((e) => e.wert).filter((f) => f && f.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.f) { z.f = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('fall/')) z.f = z.faelle.find((f) => f.id === route.slice(5)) || null;
  zeichnen();
  nachaussen();
  if (route === 'einstellungen') einstellungen();
}

async function sichern(f = z.f) {
  if (!f) return;
  f.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('faelle/' + f.id, f); } catch (_) {}
  z.faelle = [f, ...z.faelle.filter((x) => x.id !== f.id)];
  nachaussen();
}

function nachaussen() {
  const bewertet = z.faelle.filter((f) => f.bewertung);
  const offen = z.faelle.find((f) => !f.bewertung);
  const e = [];
  if (offen) e.push({ id: 'offen', titel: `Fall lösen: ${offen.titel}`, untertitel: `${GEBIETE[offen.gebiet] ? GEBIETE[offen.gebiet][0] : 'Eigener Fall'} · Gutachtenstil üben`, route: 'fall/' + offen.id, geaendert: offen.zeit });
  if (bewertet.length) {
    const schnitt = bewertet.reduce((s, f) => s + f.bewertung.punkte, 0) / bewertet.length;
    e.push({ id: 'stand', titel: `Justitia: ${bewertet.length} Fall${bewertet.length > 1 ? 'e' : ''} gelöst`, untertitel: `Ø ${schnitt.toFixed(1).replace('.', ',')} Punkte (${note(schnitt)})`, route: '', fortschritt: Math.min(1, schnitt / 18), geaendert: Date.now() / 1000 - 120 });
  }
  lyra.startseite(e).catch(() => {});
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

// ================================================================== Fälle

function modus() {
  if (z.modus) return z.modus;
  return z.lehrer === 'lyra' ? 'klassiker' : 'ki';
}

/** Einen geprüften Klassiker aus dem gewählten Rechtsgebiet stellen (ohne KI). */
async function klassikerStellen() {
  const k = KLASSIKER.find((x) => x.gebiet === z.wahl.gebiet) || KLASSIKER[0];
  z.f = {
    id: lyra.neueId(), gebiet: k.gebiet, stufe: 'einstieg', titel: k.titel, fall: k.fall, frage: k.frage,
    loesung: structuredClone(k.loesung), antwort: '', bewertung: null, loesungGezeigt: false, tipps: 0, zeit: lyra.jetzt(), klassiker: true,
  };
  await sichern();
  zeichnen();
}

async function fallErstellen() {
  if (z.laeuft) return;
  const w = z.wahl;
  const eigen = z.eigen && text(w.eigenerFall);
  z.laeuft = true;
  z.fehler = null;
  status(eigen ? 'Justitia liest deinen Fall und bereitet die Lösung vor …' : 'Justitia denkt sich einen Fall aus …');
  zeichnen();
  const g = GEBIETE[w.gebiet];
  const umfang = w.stufe === 'einstieg' ? 'Einstieg: 100–180 Wörter, eine Anspruchsgrundlage bzw. ein Delikt, ein klares Problem, 3–5 Prüfungspunkte' : 'Klausurniveau: 250–400 Wörter, zwei bis drei Probleme, 5–9 Prüfungspunkte';
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: eigen
        ? `Hier ist ein Sachverhalt aus meinem Studium:\n\n${w.eigenerFall}\n\n${text(w.eigeneFrage) ? `Fallfrage: ${w.eigeneFrage}\n\n` : ''}Erstelle dazu die Musterlösung im Gutachtenstil. \
"fall": der Sachverhalt unverändert. "frage": die Fallfrage (übernehmen oder passend formulieren). "loesung.aufbau": die Prüfungspunkte in \
Reihenfolge (abschnitt: Überschrift wie „1. Angebot“, norm: einschlägige Norm, definition: die Definition, subsumtion: \
kurze Subsumtion mit Sachverhaltsbezug). "loesung.schluss": Gesamtergebnis. "titel": kurzer Titel.\n\n\
Antwort als JSON: {"fall": "…", "frage": "…", "loesung": {"aufbau": [{"abschnitt": "…", "definition": "…", "norm": "…", "subsumtion": "…"}], "schluss": "…"}, "titel": "…"}`
        : `Erstelle einen Übungsfall im Bereich ${g[0]} (${g[1]}). ${umfang}. Personen mit Namen (z. B. A, B oder Vornamen). \
"fall": der Sachverhalt. "frage": die Fallfrage (z. B. „Hat K gegen V einen Anspruch auf Zahlung von 500 €?“ bzw. „Wie hat \
sich T strafbar gemacht?“). "loesung.aufbau": die Prüfungspunkte in Reihenfolge (abschnitt: Überschrift, norm: \
einschlägige Norm, definition: die Definition, subsumtion: kurze Subsumtion mit Sachverhaltsbezug). "loesung.schluss": \
Gesamtergebnis. "titel": kurzer, einprägsamer Titel (z. B. „Der verschwundene Laptop“).\n\n\
Antwort als JSON: {"fall": "…", "frage": "…", "loesung": {"aufbau": [{"abschnitt": "…", "definition": "…", "norm": "…", "subsumtion": "…"}], "schluss": "…"}, "titel": "…"}`,
      schema: SCHEMA_FALL,
      zaehlen: { schluessel: 'abschnitt', wort: 'Prüfungspunkt' },
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    const l = j.loesung || {};
    const aufbau = (Array.isArray(l.aufbau) ? l.aufbau : []).filter((a) => a && text(a.abschnitt)).slice(0, 14)
      .map((a) => ({ abschnitt: text(a.abschnitt), norm: text(a.norm), definition: text(a.definition), subsumtion: text(a.subsumtion) }));
    if (!text(j.fall) || !aufbau.length) throw new Error('Der Fall kam unvollständig zurück – versuch es noch einmal.');
    z.f = {
      id: lyra.neueId(), gebiet: eigen ? 'eigen' : w.gebiet, stufe: w.stufe, titel: text(j.titel) || 'Übungsfall',
      fall: eigen ? w.eigenerFall.trim() : text(j.fall), frage: text(j.frage) || text(w.eigeneFrage), loesung: { aufbau, schluss: text(l.schluss) },
      antwort: '', bewertung: null, loesungGezeigt: false, tipps: 0, zeit: lyra.jetzt(),
    };
    if (eigen) { w.eigenerFall = ''; w.eigeneFrage = ''; }
    await sichern();
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

async function bewerten() {
  const f = z.f;
  if (!f || !text(f.antwort) || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  status('Justitia korrigiert …');
  zeichnen();
  const muster = f.loesung.aufbau.map((a) => `${a.abschnitt} (${a.norm}): ${a.definition} – ${a.subsumtion}`).join('\n');
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: `Sachverhalt:\n${f.fall}\n\nFallfrage: ${f.frage}\n\nMusterlösung (nur für dich, nicht verraten, was der Student nicht selbst gefunden hat):\n${muster}\nErgebnis: ${f.loesung.schluss}\n\n\
Lösung des Studenten:\n"""\n${f.antwort}\n"""\n\n\
${(() => { const st = stilCheck(f.antwort); return `Automatisch gezählt (diese Fakten stimmen – widersprich ihnen nicht): ${st.obersaetze} Obersätze im Konjunktiv (könnte/müsste), ${st.definitionen} Definitionssätze, ${st.ergebnisse} Ergebnissätze (mithin/folglich/somit/also …), ${st.normen} Normzitate${st.urteilsstil.length ? `, ${st.urteilsstil.length} Sätze im Urteilsstil (beginnen mit denn/weil/da)` : ', kein Urteilsstil'}.`; })()}\n\n\
Korrigiere wie in einer Übungsklausur. Andere vertretbare Lösungswege sind in Ordnung. "punkte": 0–18 (Notenskala der \
Staatsprüfung; 4 = ausreichend, 9 = vollbefriedigend). "gut": was gelungen ist. "fehlt": wichtige Prüfungspunkte oder \
Probleme, die fehlen – nur als Stichwort, ohne Lösung. "hinweise": konkrete Anmerkungen (art: stil, inhalt oder aufbau; \
stelle: kurzes wörtliches Zitat aus der Lösung des Studenten; hinweis: was besser wäre). "stil": 2–3 Sätze zum \
Gutachtenstil (Obersatz im Konjunktiv, Definitionen, saubere Subsumtion, kein Urteilsstil, Ergebnis).\n\n\
Antwort als JSON: {"fehlt": [], "gut": [], "hinweise": [{"art": "stil", "hinweis": "…", "stelle": "…"}], "punkte": 8, "stil": "…"}`,
      schema: SCHEMA_BEWERTUNG,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    const liste = (v) => (Array.isArray(v) ? v.map((x) => text(x)).filter(Boolean).slice(0, 10) : []);
    f.bewertung = {
      punkte: Math.max(0, Math.min(18, Math.round(+j.punkte || 0))),
      gut: liste(j.gut), fehlt: liste(j.fehlt), stil: text(j.stil),
      hinweise: (Array.isArray(j.hinweise) ? j.hinweise : []).filter((x) => x && text(x.hinweis)).slice(0, 12).map((x) => ({ art: ['stil', 'inhalt', 'aufbau'].includes(x.art) ? x.art : 'inhalt', hinweis: text(x.hinweis), stelle: text(x.stelle).slice(0, 200) })),
    };
    await sichern();
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

/** Lösung nur auf ausdrücklichen Wunsch – vorher wird gefragt, ein Tipp ist die sanftere Wahl. */
async function hilfe() {
  const f = z.f;
  const naechster = f.loesung.aufbau[Math.min(f.tipps, f.loesung.aufbau.length - 1)];
  const w = await lyra.dialog('Hilfe gefällig?', h('div', { style: { maxWidth: '460px' } },
    h('p', {}, 'Am meisten lernst du, wenn du es erst selbst versuchst. Ein Tipp verrät dir nur den nächsten Prüfungspunkt (die Überschrift) – die Musterlösung zeigt alles.')), [
    { text: 'Abbrechen', art: 'text', wert: null },
    { text: 'Musterlösung zeigen', art: 'tonal', wert: 'loesung' },
    { text: f.tipps < f.loesung.aufbau.length ? 'Nur einen Tipp' : 'Alle Tipps gesehen', wert: f.tipps < f.loesung.aufbau.length ? 'tipp' : null },
  ]);
  if (w === 'tipp' && naechster) { f.tipps++; await sichern(); }
  if (w === 'loesung') { f.loesungGezeigt = true; await sichern(); }
  zeichnen();
}

async function fallLoeschen(f) {
  const ok = await lyra.bestaetigen({ titel: 'Fall löschen?', text: `„${f.titel}“ samt deiner Lösung und Bewertung.`, ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('faelle/' + f.id); } catch (_) {}
  z.faelle = z.faelle.filter((x) => x.id !== f.id);
  if (z.f === f) z.f = null;
  nachaussen();
  zeichnen();
}

// ================================================================== Stil-Check (lokal, live)

function stilCheck(t) {
  const saetze = t.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ§])/).map((s) => s.trim()).filter(Boolean);
  const zaehl = (re) => saetze.filter((s) => re.test(s)).length;
  return {
    obersaetze: zaehl(/\b(könnte|müsste|kommt .* in betracht|in betracht kommt)\b/i),
    probleme: zaehl(/^fraglich ist\b|\bfraglich ist,? ob\b/i),
    definitionen: zaehl(/\b(ist|sind|versteht man|liegt vor,? wenn|bedeutet)\b.*\b(jede|jeder|jedes|wenn|soweit|sofern)\b/i),
    ergebnisse: zaehl(/^(mithin|folglich|somit|daher|also|demnach|damit)\b/i),
    normen: (t.match(/(§§?|Art\.)\s*\d+/g) || []).length,
    urteilsstil: saetze.filter((s) => /^(denn|weil|da |nämlich)/i.test(s)),
    saetze: saetze.length,
  };
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && typeof aktiv.selectionStart === 'number' ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  app.replaceChildren(z.f ? fallAnsicht(z.f) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos) try { e.setSelectionRange(pos[0], pos[1]); } catch (_) {} }
  lyra.titel(z.f ? z.f.titel : '');
}

const laufZeile = () => (z.laeuft ? lyra.arbeit(z.status || 'Justitia arbeitet …') : null);
const fehlerZeile = (nochmal) => (z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; nochmal(); } : null,
  () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; nochmal(); }) : null);

function startAnsicht() {
  const w = z.wahl;
  const bewertet = z.faelle.filter((f) => f.bewertung);
  const schnitt = bewertet.length ? bewertet.reduce((s, f) => s + f.bewertung.punkte, 0) / bewertet.length : 0;
  const eigenFeld = h('textarea', { class: 'eingabe', 'data-feld': 'eigen', rows: 7, placeholder: 'Sachverhalt aus deiner Vorlesung, AG oder Klausur einfügen …' });
  eigenFeld.value = w.eigenerFall;
  eigenFeld.addEventListener('input', () => { w.eigenerFall = eigenFeld.value; const k = document.getElementById('los'); if (k) k.disabled = z.laeuft || !w.eigenerFall.trim(); });
  const frageFeld = h('input', { class: 'eingabe', 'data-feld': 'frage', placeholder: 'Fallfrage (optional), z. B. „Hat K gegen V einen Anspruch auf Lieferung?“', value: w.eigeneFrage });
  frageFeld.addEventListener('input', () => { w.eigeneFrage = frageFeld.value; });
  return h('div', { class: 'seite breit' },
    lyra.kopf({ titel: 'Gutachtenstil trainieren', unter: 'Fall lösen, korrigieren lassen, besser werden – mit Punkten wie in der Klausur.' }),
    bewertet.length ? h('div', { class: 'stand' },
      h('div', {}, h('div', { class: 'stand-zahl' }, String(bewertet.length)), h('div', { class: 'klein leise' }, 'Fälle korrigiert')),
      h('div', {}, h('div', { class: 'stand-zahl' }, schnitt.toFixed(1).replace('.', ',')), h('div', { class: 'klein leise' }, `Ø Punkte · ${note(schnitt)}`)),
      h('div', { class: 'wachsen' }, h('div', { class: 'verlauf' }, bewertet.slice(0, 12).reverse().map((f) => h('div', { class: 'verlauf-balken', title: `${f.titel}: ${f.bewertung.punkte} P.`, style: { height: `${Math.max(6, (f.bewertung.punkte / 18) * 100)}%` } }))))) : null,
    h('div', { class: 'flaeche spalte', style: { gap: '12px' } },
      lyra.reiter([['klassiker', '📚 Klassiker'], ['ki', '🎲 Neuer Fall von der KI'], ['eigen', '📋 Eigener Fall']], modus(), (m) => { z.modus = m; z.eigen = m === 'eigen'; zeichnen(); }),
      modus() === 'ki' && z.lehrer === 'lyra' ? h('div', { class: 'kasten warn klein' }, 'Mit Lyra (lokal) können neue KI-Fälle juristisch ungenau sein. Verlässlicher: die geprüften Klassiker – oder Claude, ChatGPT bzw. Gemini.') : null,
      modus() === 'klassiker' ? h('div', { class: 'leise klein' }, 'Geprüfte Fälle mit Lösungsskizze – je Rechtsgebiet einer, sofort da, auch ohne KI.') : null,
      z.eigen ? h('div', { class: 'spalte', style: { gap: '8px' } }, eigenFeld, frageFeld) : h('div', { class: 'spalte', style: { gap: '10px' } },
        h('div', { class: 'gebiete' }, Object.entries(GEBIETE).map(([k, [n, u]]) => h('button', { class: 'gebiet' + (w.gebiet === k ? ' an' : ''), onclick: () => { w.gebiet = k; zeichnen(); } },
          h('div', { class: 'fett' }, n), h('div', { class: 'klein leise' }, u)))),
        modus() === 'ki' ? h('div', { class: 'zeile', style: { gap: '6px' } }, STUFEN.map(([k, n]) => h('button', { class: 'chip' + (w.stufe === k ? ' an' : ''), onclick: () => { w.stufe = k; zeichnen(); } }, n))) : null),
      h('div', { class: 'zeile' },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || (z.eigen && !w.eigenerFall.trim()), onclick: () => (modus() === 'klassiker' ? klassikerStellen() : fallErstellen()) }, z.eigen ? 'Fall übernehmen' : '⚖️ Fall stellen')),
      laufZeile(), fehlerZeile(fallErstellen)),
    z.faelle.length ? h('div', { style: { marginTop: '20px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Deine Fälle'),
      h('div', { class: 'raster' }, z.faelle.map((f) => h('div', { class: 'karte klickbar', onclick: () => { z.f = f; zeichnen(); } },
        h('div', { class: 'zeile' },
          h('div', { class: 'fett wachsen eine-zeile' }, f.titel),
          f.bewertung ? h('span', { class: 'punkte-chip', style: { '--f': farbe(f.bewertung.punkte) } }, `${f.bewertung.punkte} P.`) : h('span', { class: 'klein leise' }, 'offen'),
          h('button', { class: 'knopf symbol', title: 'Löschen', onclick: (ev) => { ev.stopPropagation(); fallLoeschen(f); } }, '✕')),
        h('div', { class: 'klein leise' }, `${GEBIETE[f.gebiet] ? GEBIETE[f.gebiet][0] : 'Eigener Fall'} · ${new Date(f.zeit * 1000).toLocaleDateString('de-DE')}`))))) : null,
    h('div', { class: 'warnhinweis' }, '⚖️ Lerntraining, keine Rechtsberatung. Auch Justitia kann irren – prüf Normen und Definitionen im Gesetz und Lehrbuch.'));
}

const farbe = (p) => (p >= 10 ? '#22A06B' : p >= 7 ? '#0EA5E9' : p >= 4 ? '#F59E0B' : '#E5484D');

function fallAnsicht(f) {
  const feld = h('textarea', { class: 'eingabe gutachten', 'data-feld': 'antwort', placeholder: 'Deine Lösung im Gutachtenstil …\n\nA könnte gegen B einen Anspruch auf … aus § … haben.\nDazu müsste …' });
  feld.value = f.antwort;
  const check = h('div', { class: 'stilcheck' });
  const checkZeichnen = () => {
    const s = stilCheck(f.antwort);
    const chip = (ok, t) => h('span', { class: 'check ' + (ok ? 'ok' : 'offen') }, (ok ? '✓ ' : '○ ') + t);
    check.replaceChildren(...[
      chip(s.obersaetze > 0, `${s.obersaetze} Obersatz${s.obersaetze === 1 ? '' : 'sätze'}`),
      chip(s.definitionen > 0, `${s.definitionen} Definition${s.definitionen === 1 ? '' : 'en'}`),
      chip(s.ergebnisse > 0, `${s.ergebnisse} Ergebnis${s.ergebnisse === 1 ? '' : 'se'}`),
      chip(s.normen > 0, `${s.normen} Norm${s.normen === 1 ? '' : 'en'} zitiert`),
      s.probleme ? chip(true, `${s.probleme}× „Fraglich ist“`) : null,
      s.urteilsstil.length ? h('span', { class: 'check warn', title: s.urteilsstil.join('\n') }, `⚠︎ ${s.urteilsstil.length}× Urteilsstil („denn“, „weil“ am Satzanfang)`) : null,
      h('span', { class: 'wachsen' }),
      h('span', { class: 'klein leise' }, `${f.antwort.trim() ? f.antwort.trim().split(/\s+/).length : 0} Wörter`)].filter(Boolean));
  };
  checkZeichnen();
  feld.addEventListener('input', () => { f.antwort = feld.value; checkZeichnen(); const k = document.getElementById('bewerten'); if (k) k.disabled = z.laeuft || !f.antwort.trim(); });
  feld.addEventListener('change', () => sichern());
  const einfuegen = (t) => {
    const a = feld.selectionStart ?? feld.value.length, b = feld.selectionEnd ?? a;
    const vor = feld.value.slice(0, a);
    const trenner = vor && !/\s$/.test(vor) ? (/[.!?]$/.test(vor) ? ' ' : ' ') : '';
    feld.value = vor + trenner + t + feld.value.slice(b);
    f.antwort = feld.value;
    const p = (vor + trenner + t).length;
    feld.focus();
    feld.setSelectionRange(p, p);
    checkZeichnen();
    sichern();
  };
  const b = f.bewertung;
  const tipps = f.loesung.aufbau.slice(0, f.tipps);
  return h('div', { class: 'fall-seite' },
    h('div', { class: 'fall-links' },
      h('div', { class: 'zeile', style: { marginBottom: '6px' } },
        h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.f = null; zeichnen(); } }, '← Alle Fälle'),
        h('span', { class: 'wachsen' }),
        h('span', { class: 'etikett' }, GEBIETE[f.gebiet] ? GEBIETE[f.gebiet][0] : 'Eigener Fall')),
      h('h2', { style: { marginBottom: '10px' } }, f.titel),
      h('div', { class: 'sachverhalt' }, f.fall.split(/\n{2,}/).map((p) => h('p', {}, p))),
      h('div', { class: 'fallfrage' }, h('div', { class: 'ueberschrift-klein' }, 'Fallfrage'), h('div', { class: 'fett' }, f.frage)),
      tipps.length ? h('div', { class: 'tipps' }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '6px' } }, '💡 Deine Tipps'), tipps.map((t) => h('div', { class: 'tipp' }, t.abschnitt, t.norm ? h('span', { class: 'leise' }, ` · ${t.norm}`) : null))) : null,
      f.loesungGezeigt ? h('div', { class: 'loesung' },
        h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Musterlösung'),
        f.loesung.aufbau.map((a) => h('div', { class: 'loesung-punkt' },
          h('div', { class: 'fett' }, a.abschnitt, a.norm ? h('span', { class: 'leise', style: { fontWeight: 500 } }, ` (${a.norm})`) : null),
          a.definition ? h('div', { class: 'klein' }, h('span', { class: 'leise' }, 'Definition: '), a.definition) : null,
          a.subsumtion ? h('div', { class: 'klein' }, h('span', { class: 'leise' }, 'Subsumtion: '), a.subsumtion) : null)),
        f.loesung.schluss ? h('div', { class: 'fett', style: { marginTop: '8px' } }, 'Ergebnis: ', h('span', { style: { fontWeight: 500 } }, f.loesung.schluss)) : null) : null),
    h('div', { class: 'fall-rechts' },
      h('div', { class: 'bausteine' }, BAUSTEINE.map(([n, t]) => h('button', { class: 'baustein', title: t, onclick: () => einfuegen(t) }, n))),
      feld,
      check,
      h('div', { class: 'zeile', style: { gap: '8px' } },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'wachsen' }),
        !f.loesungGezeigt ? h('button', { class: 'knopf tonal', onclick: hilfe }, 'Hilfe …') : null,
        h('button', { class: 'knopf', id: 'bewerten', disabled: z.laeuft || !f.antwort.trim(), onclick: bewerten }, b ? 'Neu korrigieren' : 'Korrigieren lassen')),
      laufZeile(), fehlerZeile(bewerten),
      b ? h('div', { class: 'bewertung' },
        h('div', { class: 'zeile', style: { gap: '14px' } },
          h('div', { class: 'punkte-gross', style: { '--f': farbe(b.punkte) } }, String(b.punkte), h('span', {}, 'P.')),
          h('div', { class: 'wachsen' }, h('div', { class: 'fett', style: { fontSize: '16px' } }, note(b.punkte)), b.stil ? h('div', { class: 'klein', style: { marginTop: '2px' } }, b.stil) : null)),
        b.gut.length ? h('div', {}, h('div', { class: 'ueberschrift-klein' }, '👍 Gelungen'), h('ul', {}, b.gut.map((x) => h('li', {}, x)))) : null,
        b.fehlt.length ? h('div', {}, h('div', { class: 'ueberschrift-klein' }, '🔎 Fehlt'), h('ul', {}, b.fehlt.map((x) => h('li', {}, x)))) : null,
        b.hinweise.length ? h('div', {}, h('div', { class: 'ueberschrift-klein' }, '✏️ Anmerkungen'), b.hinweise.map((x) => h('div', { class: 'anmerkung' },
          h('span', { class: 'art art-' + x.art }, { stil: 'Stil', inhalt: 'Inhalt', aufbau: 'Aufbau' }[x.art]),
          x.stelle ? h('span', { class: 'stelle' }, `„${x.stelle}“`) : null,
          h('div', {}, x.hinweis)))) : null) : null));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const m = () => box.replaceChildren(...[['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']].map(([w, n]) =>
    h('button', { class: 'chip' + (e.ki === w ? ' an' : ''), onclick: () => { e.ki = w; m(); } }, n)));
  m();
  const ok = await lyra.dialog('Justitia – Einstellungen', h('div', { style: { minWidth: '440px' } },
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Wer stellt Fälle und korrigiert'), box,
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Für Klausurniveau sind Claude, ChatGPT oder Gemini deutlich besser – Lyra fragt vorher, ob Fall und Lösung hinausgehen dürfen.')), [
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
