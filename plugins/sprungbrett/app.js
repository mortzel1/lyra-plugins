'use strict';
/*
 * Sprungbrett – dein Bewerbungscoach. Lebenslauf einmal hinterlegen, dann je Stelle: Passung zur Anzeige (Stärken,
 * Lücken, fehlende Schlüsselbegriffe), ein maßgeschneidertes Anschreiben nach DIN 5008 und ein Interview-Training mit
 * Feedback zu jeder Antwort. Dazu ein kleiner Überblick, wo du dich wann beworben hast.
 */
const { h } = lyra;

const STATUS = {
  gemerkt: ['Gemerkt', '#94A3B8'],
  beworben: ['Beworben', '#0EA5E9'],
  gespraech: ['Gespräch', '#8B5CF6'],
  zusage: ['Zusage', '#22A06B'],
  absage: ['Absage', '#E5484D'],
};
const ARTEN = { fachlich: ['Fachlich', '🧠'], verhalten: ['Situation', '🧩'], motivation: ['Motivation', '🔥'], knifflig: ['Knifflig', '🌶️'] };
const STANDARD = { ki: 'auto' };

const SYSTEM = `Du bist „Sprungbrett“ in Lyra, ein erfahrener, ehrlicher Bewerbungscoach für den deutschsprachigen \
Arbeitsmarkt (Praktikum, Werkstudium, Ausbildung, Berufseinstieg, Jobwechsel). Du bist konkret, ermutigend und \
ehrlich. Du erfindest NIE Erfahrungen, Abschlüsse oder Zahlen, die nicht im Lebenslauf stehen – fehlt etwas, nutzt du \
Platzhalter in eckigen Klammern. Keine Floskeln wie „hiermit bewerbe ich mich“ oder „teamfähig, belastbar, motiviert“ \
ohne Beleg.`;

const SCHEMA_PASSUNG = {
  type: 'object',
  properties: {
    fehlendeBegriffe: { type: 'array', items: { type: 'string' } },
    luecken: { type: 'array', items: { type: 'string' } },
    passung: { type: 'integer' },
    staerken: { type: 'array', items: { type: 'string' } },
    tipps: { type: 'array', items: { type: 'string' } },
  },
  required: ['fehlendeBegriffe', 'luecken', 'passung', 'staerken', 'tipps'],
};
const SCHEMA_BRIEF = {
  type: 'object',
  properties: { anrede: { type: 'string' }, betreff: { type: 'string' }, gruss: { type: 'string' }, text: { type: 'string' } },
  required: ['anrede', 'betreff', 'gruss', 'text'],
};
const SCHEMA_FRAGEN = {
  type: 'object',
  properties: { fragen: { type: 'array', items: { type: 'object', properties: { art: { type: 'string', enum: Object.keys(ARTEN) }, frage: { type: 'string' }, tipp: { type: 'string' } }, required: ['art', 'frage', 'tipp'] } } },
  required: ['fragen'],
};
const SCHEMA_FEEDBACK = {
  type: 'object',
  properties: { lob: { type: 'string' }, note: { type: 'integer' }, tipp: { type: 'string' }, vorschlag: { type: 'string' } },
  required: ['lob', 'note', 'tipp', 'vorschlag'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  profil: { lebenslauf: '', datei: '', name: '', strasse: '', ort: '', email: '', telefon: '', stadt: '' },
  bewerbungen: [],
  b: null,
  ansicht: 'start', // start | profil | bewerbung | brief
  reiter: 'passung',
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const liste = (v, n = 8) => (Array.isArray(v) ? v.map((x) => text(x)).filter(Boolean).slice(0, n) : []);
const heuteIso = () => new Date().toISOString().slice(0, 10);

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.profil = { ...z.profil, ...((await lyra.speicher.lesen('profil')) || {}) }; } catch (_) {}
  try { z.bewerbungen = (await lyra.speicher.liste('bewerbungen')).map((e) => e.wert).filter((b) => b && b.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.ansicht === 'brief') { z.ansicht = 'bewerbung'; return zeichnen(); }
    if (z.ansicht !== 'start') { z.ansicht = 'start'; z.b = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('bewerbung/')) { z.b = z.bewerbungen.find((b) => b.id === route.slice(10)) || null; if (z.b) z.ansicht = 'bewerbung'; }
  if (route === 'profil') z.ansicht = 'profil';
  zeichnen();
  if (route === 'einstellungen') einstellungen();
}

async function sichern(b = z.b) {
  if (!b) return;
  b.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('bewerbungen/' + b.id, b); } catch (_) {}
  z.bewerbungen = [b, ...z.bewerbungen.filter((x) => x.id !== b.id)];
}

async function profilSichern() {
  try { await lyra.speicher.schreiben('profil', z.profil); } catch (_) {}
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

async function ki(auftrag, schema, beschreibung) {
  z.laeuft = true;
  z.fehler = null;
  status(beschreibung);
  zeichnen();
  try {
    const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt: auftrag, schema }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    return (r && r.json) || {};
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
    return null;
  } finally {
    z.laeuft = false;
  }
}

const kontext = (b) => `=== MEIN LEBENSLAUF ===\n${z.profil.lebenslauf.slice(0, z.lehrer === 'lyra' ? 7000 : 30000)}\n\n=== STELLENANZEIGE: ${b.stelle} bei ${b.firma} ===\n${b.anzeige.slice(0, z.lehrer === 'lyra' ? 6000 : 30000)}`;

// ================================================================== Coach

async function passungPruefen() {
  const b = z.b;
  const j = await ki(`${kontext(b)}\n\nVergleiche meinen Lebenslauf mit der Anzeige. "passung": 0–100, wie gut ich (ehrlich) passe. \
"staerken": 3–6 konkrete Belege aus meinem Lebenslauf, die zur Anzeige passen. "luecken": was gefordert ist, mir aber \
fehlt oder nicht sichtbar ist. "fehlendeBegriffe": wichtige Schlüsselwörter der Anzeige, die in meinem Lebenslauf nicht \
vorkommen (für Bewerbermanagementsysteme). "tipps": 3–5 konkrete Tipps für diese Bewerbung.\n\n\
Antwort als JSON: {"fehlendeBegriffe": [], "luecken": [], "passung": 70, "staerken": [], "tipps": []}`, SCHEMA_PASSUNG, 'Sprungbrett vergleicht Lebenslauf und Anzeige …');
  if (j) {
    b.analyse = { passung: Math.max(0, Math.min(100, Math.round(+j.passung || 0))), staerken: liste(j.staerken), luecken: liste(j.luecken), fehlendeBegriffe: liste(j.fehlendeBegriffe, 14), tipps: liste(j.tipps, 6) };
    await sichern();
  }
  zeichnen();
}

async function anschreibenSchreiben(auftrag) {
  const b = z.b;
  const a = b.anschreiben;
  const j = await ki(auftrag
    ? `Hier ist mein Anschreiben:\nBetreff: ${a.betreff}\n${a.anrede}\n${a.text}\n${a.gruss}\n\nAuftrag: ${auftrag}\nGib das ganze Anschreiben zurück.\n\nAntwort als JSON: {"anrede": "…", "betreff": "…", "gruss": "…", "text": "…"}`
    : `${kontext(b)}\n\n${b.analyse ? `Meine Stärken für diese Stelle: ${b.analyse.staerken.join('; ')}\n\n` : ''}Schreib mein Anschreiben (DIN 5008, höchstens eine \
Seite, 250–350 Wörter). Einstieg mit einem konkreten Bezug zur Firma oder Aufgabe – nicht „hiermit bewerbe ich mich“. \
Dann 2–3 Belege aus meinem Lebenslauf, die zu den Anforderungen passen, mit Wirkung („dadurch …“). Schluss mit \
Verfügbarkeit/Eintrittstermin als Platzhalter und Wunsch nach einem Gespräch. "anrede": mit Ansprechperson aus der \
Anzeige, sonst „Sehr geehrte Damen und Herren,“. "betreff": „Bewerbung als …“ (ggf. mit Kennziffer). "text": ohne \
Anrede und Gruß, Absätze mit Leerzeile. "gruss": „Mit freundlichen Grüßen“.\n\n\
Antwort als JSON: {"anrede": "…", "betreff": "…", "gruss": "…", "text": "…"}`, SCHEMA_BRIEF, auftrag ? 'Sprungbrett überarbeitet …' : 'Sprungbrett schreibt dein Anschreiben …');
  if (j && text(j.text)) {
    b.anschreiben = { ...a, betreff: text(j.betreff).replace(/^betreff:?\s*/i, ''), anrede: text(j.anrede) || 'Sehr geehrte Damen und Herren,', text: text(j.text).replace(/\n{3,}/g, '\n\n'), gruss: text(j.gruss).replace(/,$/, '') || 'Mit freundlichen Grüßen', vorher: { ...a, vorher: undefined } };
    await sichern();
  } else if (j) z.fehler = 'Es kam kein Text zurück – versuch es noch einmal.';
  zeichnen();
}

async function fragenErzeugen() {
  const b = z.b;
  const j = await ki(`${kontext(b)}\n\nStell mir 8 Fragen, die mir in einem Vorstellungsgespräch für diese Stelle wahrscheinlich gestellt \
werden: 3 fachliche, 2 Situationsfragen (Verhalten, „Erzählen Sie von einer Situation …“), 2 zur Motivation und 1 \
knifflige (z. B. zu einer Lücke im Lebenslauf). Je Frage ein kurzer "tipp", worauf es bei der Antwort ankommt.\n\n\
Antwort als JSON: {"fragen": [{"art": "fachlich", "frage": "…", "tipp": "…"}]}`, SCHEMA_FRAGEN, 'Sprungbrett überlegt, was man dich fragen wird …');
  if (j) {
    const fragen = (Array.isArray(j.fragen) ? j.fragen : []).filter((f) => f && text(f.frage)).slice(0, 10)
      .map((f, i) => ({ id: `${Date.now()}${i}`, art: ARTEN[f.art] ? f.art : 'fachlich', frage: text(f.frage), tipp: text(f.tipp), antwort: '', feedback: null }));
    if (fragen.length) { b.interview = { fragen }; await sichern(); } else z.fehler = 'Es kamen keine Fragen zurück – versuch es noch einmal.';
  }
  zeichnen();
}

async function feedbackHolen(f) {
  if (!text(f.antwort)) return;
  const b = z.b;
  const j = await ki(`Stelle: ${b.stelle} bei ${b.firma}.\nInterviewfrage: ${f.frage}\nMeine Antwort: ${f.antwort}\n\n\
Gib mir ehrliches Feedback wie ein guter Coach. "lob": was gut ist (1–2 Sätze). "note": 1 (schwach) bis 5 (überzeugend). \
"tipp": das Wichtigste, das ich verbessern sollte (bei Situationsfragen an der STAR-Methode orientiert: Situation, \
Aufgabe, Handlung, Ergebnis). "vorschlag": eine bessere Version meiner Antwort in Ich-Form, nur mit Fakten aus meiner \
Antwort (fehlende als [Platzhalter]), höchstens 120 Wörter.\n\nAntwort als JSON: {"lob": "…", "note": 3, "tipp": "…", "vorschlag": "…"}`,
  SCHEMA_FEEDBACK, 'Sprungbrett hört zu …');
  if (j) {
    f.feedback = { lob: text(j.lob), note: Math.max(1, Math.min(5, Math.round(+j.note || 3))), tipp: text(j.tipp), vorschlag: text(j.vorschlag) };
    await sichern();
  }
  zeichnen();
}

// ================================================================== Aktionen

async function neueBewerbung() {
  const firma = h('input', { class: 'eingabe', placeholder: 'z. B. Musterfirma GmbH' });
  const stelle = h('input', { class: 'eingabe', placeholder: 'z. B. Werkstudent Data Analytics' });
  const anzeige = h('textarea', { class: 'eingabe', rows: 9, placeholder: 'Stellenanzeige hier einfügen (Aufgaben, Anforderungen, Ansprechperson …)' });
  const ok = await lyra.dialog('Neue Bewerbung', h('div', { class: 'spalte', style: { minWidth: '560px', gap: '10px' } },
    h('div', { class: 'raster-2' }, h('label', { class: 'feld' }, 'Firma', firma), h('label', { class: 'feld' }, 'Stelle', stelle)),
    h('label', { class: 'feld' }, 'Stellenanzeige', anzeige)), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Anlegen', wert: true },
  ]);
  if (!ok) return;
  if (!firma.value.trim() && !stelle.value.trim()) return;
  const b = {
    id: lyra.neueId(), firma: firma.value.trim() || 'Firma', stelle: stelle.value.trim() || 'Stelle', anzeige: anzeige.value.trim(), status: 'gemerkt', datum: heuteIso(),
    analyse: null, anschreiben: { anrede: '', betreff: '', text: '', gruss: '', empfaenger: firma.value.trim() }, interview: { fragen: [] }, notiz: '', zeit: lyra.jetzt(),
  };
  z.b = b;
  z.ansicht = 'bewerbung';
  z.reiter = 'passung';
  await sichern(b);
  zeichnen();
}

async function lebenslaufLaden() {
  try {
    const d = await lyra.dateiOeffnen({ arten: ['pdf', 'docx', 'txt', 'md'], titel: 'Lebenslauf' });
    if (!d) return;
    if (!text(d.text)) { z.fehler = 'In der Datei ließ sich kein Text finden – kopier den Lebenslauf bitte hinein.'; return zeichnen(); }
    z.profil.lebenslauf = d.text.trim();
    z.profil.datei = d.name;
    await profilSichern();
    z.meldung = `✓ Lebenslauf aus „${d.name}“ übernommen`;
  } catch (e) { z.fehler = String((e && e.message) || e); }
  zeichnen();
}

async function bewerbungLoeschen(b) {
  const ok = await lyra.bestaetigen({ titel: 'Bewerbung löschen?', text: `${b.stelle} bei ${b.firma} – samt Anschreiben und Interview-Training.`, ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('bewerbungen/' + b.id); } catch (_) {}
  z.bewerbungen = z.bewerbungen.filter((x) => x.id !== b.id);
  z.b = null;
  z.ansicht = 'start';
  zeichnen();
}

function kopieren(s) {
  const f = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  f.value = s;
  document.body.appendChild(f);
  f.select();
  try { document.execCommand('copy'); } catch (_) {}
  f.remove();
  z.meldung = '✓ In die Zwischenablage kopiert';
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && typeof aktiv.selectionStart === 'number' ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  app.replaceChildren({ start: startAnsicht, profil: profilAnsicht, bewerbung: bewerbungAnsicht, brief: briefAnsicht }[z.ansicht]());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos) try { e.setSelectionRange(pos[0], pos[1]); } catch (_) {} }
  lyra.titel(z.ansicht === 'profil' ? 'Profil' : z.b && z.ansicht !== 'start' ? `${z.b.stelle} · ${z.b.firma}` : '');
}

const laufZeile = () => (z.laeuft ? lyra.arbeit(z.status || 'Sprungbrett arbeitet …') : null);
const fehlerZeile = (nochmal) => (z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) && nochmal ? () => { z.lehrer = 'lyra'; z.fehler = null; nochmal(); } : null,
  () => { z.fehler = null; zeichnen(); }, nochmal ? () => { z.fehler = null; nochmal(); } : null) : null);

function startAnsicht() {
  const woerter = z.profil.lebenslauf ? z.profil.lebenslauf.split(/\s+/).length : 0;
  const zaehl = (k) => z.bewerbungen.filter((b) => b.status === k).length;
  return h('div', { class: 'seite breit' },
    lyra.kopf({ titel: 'Deine Bewerbungen', unter: 'Vom Lebenslauf zur Zusage – Passung zur Anzeige, maßgeschneidertes Anschreiben und Interview-Training.' }),
    h('div', { class: 'kopf-raster' },
      h('div', { class: 'karte klickbar profil-karte', onclick: () => { z.ansicht = 'profil'; zeichnen(); } },
        h('div', { class: 'zeile' }, h('div', { class: 'profil-symbol' }, '👤'),
          h('div', { class: 'wachsen' },
            h('div', { class: 'fett' }, z.profil.name || 'Dein Profil'),
            h('div', { class: 'klein ' + (woerter ? 'leise' : 'warn') }, woerter ? `Lebenslauf hinterlegt · ${woerter} Wörter` : 'Noch kein Lebenslauf – hier hinterlegen')),
          h('span', { class: 'leise' }, '›'))),
      h('button', { class: 'knopf gross', onclick: neueBewerbung }, '+ Neue Bewerbung')),
    z.bewerbungen.length ? h('div', { class: 'statusleiste' }, Object.entries(STATUS).map(([k, [n, f]]) =>
      h('div', { class: 'status-zahl', style: { '--f': f } }, h('div', { class: 'zahl' }, String(zaehl(k))), h('div', { class: 'klein' }, n)))) : null,
    z.bewerbungen.length ? h('div', { class: 'spalte', style: { gap: '8px', marginTop: '14px' } }, z.bewerbungen.map((b) => h('div', { class: 'karte klickbar bewerbung-zeile', onclick: () => { z.b = b; z.ansicht = 'bewerbung'; z.reiter = b.analyse ? 'anschreiben' : 'passung'; zeichnen(); } },
      h('div', { class: 'firma-kreis' }, (b.firma[0] || '?').toUpperCase()),
      h('div', { class: 'wachsen', style: { minWidth: 0 } },
        h('div', { class: 'fett eine-zeile' }, b.stelle),
        h('div', { class: 'klein leise eine-zeile' }, `${b.firma} · seit ${new Date(b.datum + 'T12:00:00').toLocaleDateString('de-DE')}`)),
      b.analyse ? h('div', { class: 'passung-mini', title: 'Passung' }, `${b.analyse.passung} %`) : null,
      h('span', { class: 'status-chip', style: { '--f': STATUS[b.status][1] } }, STATUS[b.status][0])))) :
      h('div', { class: 'leer' }, h('div', { style: { fontSize: '42px' } }, '🚀'), h('div', { class: 'fett' }, 'Noch keine Bewerbung'),
        h('div', { class: 'leise klein' }, 'Hinterleg zuerst deinen Lebenslauf, dann leg für jede Stelle eine Bewerbung an.')));
}

function profilAnsicht() {
  const p = z.profil;
  const f = (k, ph) => { const i = h('input', { class: 'eingabe', 'data-feld': 'p-' + k, placeholder: ph, value: p[k] || '' }); i.addEventListener('input', () => { p[k] = i.value; }); i.addEventListener('change', profilSichern); return i; };
  const cv = h('textarea', { class: 'eingabe', 'data-feld': 'cv', rows: 18, placeholder: 'Lebenslauf hier einfügen – oder oben als PDF/Word öffnen.' });
  cv.value = p.lebenslauf;
  cv.addEventListener('input', () => { p.lebenslauf = cv.value; });
  cv.addEventListener('change', profilSichern);
  return h('div', { class: 'seite breit' },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0, marginBottom: '8px' }, onclick: () => { z.ansicht = 'start'; zeichnen(); } }, '← Übersicht'),
    z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
    fehlerZeile(),
    h('div', { class: 'zwei' },
      h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
        h('div', { class: 'zeile' }, h('div', { class: 'ueberschrift-klein wachsen' }, 'Lebenslauf'), h('button', { class: 'knopf tonal klein', onclick: lebenslaufLaden }, 'Datei öffnen …')),
        cv,
        p.datei ? h('div', { class: 'klein leise' }, `Aus „${p.datei}“`) : null),
      h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
        h('div', { class: 'ueberschrift-klein' }, 'Absender für Anschreiben'),
        f('name', 'Vor- und Nachname'), f('strasse', 'Straße und Hausnummer'), f('ort', 'PLZ und Ort'), f('telefon', 'Telefon'), f('email', 'E-Mail'), f('stadt', 'Ort vor dem Datum, z. B. Köln'),
        h('div', { class: 'klein leise' }, 'Alles bleibt auf deinem Mac. Nur wenn du Claude, ChatGPT oder Gemini nutzt, geht der Lebenslauf für die jeweilige Anfrage hinaus – Lyra fragt vorher.'))));
}

function bewerbungAnsicht() {
  const b = z.b;
  const reiter = [['passung', '🎯 Passung'], ['anschreiben', '✉️ Anschreiben'], ['interview', '🎤 Interview-Training'], ['anzeige', '📄 Anzeige & Notizen']];
  const teil = { passung: passungTeil, anschreiben: anschreibenTeil, interview: interviewTeil, anzeige: anzeigeTeil }[z.reiter](b);
  return h('div', { class: 'seite breit' },
    h('div', { class: 'zeile', style: { marginBottom: '6px' } },
      h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.ansicht = 'start'; z.b = null; zeichnen(); } }, '← Übersicht'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf symbol', title: 'Löschen', onclick: () => bewerbungLoeschen(b) }, '🗑')),
    h('div', { class: 'zeile oben', style: { marginBottom: '12px' } },
      h('div', { class: 'firma-kreis gross' }, (b.firma[0] || '?').toUpperCase()),
      h('div', { class: 'wachsen' }, h('h2', {}, b.stelle), h('div', { class: 'leise' }, b.firma)),
      h('div', { class: 'zeile umbruch', style: { gap: '5px', justifyContent: 'flex-end' } }, Object.entries(STATUS).map(([k, [n, f]]) =>
        h('button', { class: 'status-chip' + (b.status === k ? ' an' : ' aus'), style: { '--f': f }, onclick: () => { b.status = k; sichern(); zeichnen(); } }, n)))),
    !z.profil.lebenslauf && z.reiter !== 'anzeige' ? h('div', { class: 'hinweis' }, 'Für Passung, Anschreiben und Interview braucht Sprungbrett deinen Lebenslauf.',
      h('button', { class: 'knopf klein', onclick: () => { z.ansicht = 'profil'; zeichnen(); } }, 'Lebenslauf hinterlegen')) : null,
    !b.anzeige && z.reiter !== 'anzeige' ? h('div', { class: 'hinweis' }, 'Füg noch die Stellenanzeige ein – dann wird alles viel genauer.',
      h('button', { class: 'knopf klein', onclick: () => { z.reiter = 'anzeige'; zeichnen(); } }, 'Anzeige einfügen')) : null,
    lyra.reiter(reiter, z.reiter, (k) => { z.reiter = k; z.meldung = ''; zeichnen(); }),
    teil);
}

const bereit = (b) => !!(z.profil.lebenslauf && b.anzeige);

function passungTeil(b) {
  const a = b.analyse;
  const knopf = h('div', { class: 'zeile' },
    z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
    h('span', { class: 'wachsen' }),
    h('button', { class: 'knopf' + (a ? ' tonal' : ''), disabled: z.laeuft || !bereit(b), onclick: passungPruefen }, a ? 'Neu prüfen' : '🎯 Passung prüfen'));
  if (!a) return h('div', { class: 'flaeche spalte', style: { gap: '10px' } }, h('div', { class: 'leise' }, 'Sprungbrett vergleicht deinen Lebenslauf mit der Anzeige: Wie gut passt du, was spricht für dich, was fehlt – und welche Schlüsselwörter solltest du aufgreifen?'), knopf, laufZeile(), fehlerZeile(passungPruefen));
  const farbe = a.passung >= 70 ? '#22A06B' : a.passung >= 45 ? '#F59E0B' : '#E5484D';
  const ring = h('div', { class: 'ring', style: { '--p': a.passung, '--f': farbe } }, h('div', { class: 'ring-innen' }, h('div', { class: 'ring-zahl' }, `${a.passung} %`), h('div', { class: 'klein leise' }, 'Passung')));
  const block = (t, l, kl) => h('div', { class: 'flaeche' }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, t), l.length ? h('ul', { class: 'punkte ' + kl }, l.map((x) => h('li', {}, x))) : h('div', { class: 'leise klein' }, '–'));
  return h('div', { class: 'spalte', style: { gap: '12px' } },
    h('div', { class: 'flaeche zeile', style: { gap: '22px' } }, ring,
      h('div', { class: 'wachsen spalte', style: { gap: '8px' } },
        h('div', { class: 'fett' }, a.passung >= 70 ? 'Starke Passung – bewirb dich!' : a.passung >= 45 ? 'Gute Chancen, wenn du die Lücken geschickt adressierst.' : 'Eher sportlich – aber mit gutem Anschreiben nicht chancenlos.'),
        a.fehlendeBegriffe.length ? h('div', {}, h('div', { class: 'klein leise', style: { marginBottom: '4px' } }, 'Diese Begriffe aus der Anzeige fehlen in deinem Lebenslauf:'),
          h('div', { class: 'zeile umbruch', style: { gap: '5px' } }, a.fehlendeBegriffe.map((w) => h('span', { class: 'begriff' }, w)))) : null)),
    h('div', { class: 'drei' }, block('💪 Das spricht für dich', a.staerken, 'gut'), block('🧗 Daran solltest du arbeiten', a.luecken, 'luecke'), block('💡 Tipps', a.tipps, 'tipp')),
    knopf, laufZeile(), fehlerZeile(passungPruefen));
}

function anschreibenTeil(b) {
  const a = b.anschreiben;
  const feld = (k, attr) => {
    const f = h(attr.rows ? 'textarea' : 'input', { class: 'eingabe' + (attr.rows ? ' brieftext' : ''), 'data-feld': 'a-' + k, ...attr });
    f.value = a[k] || '';
    f.addEventListener('input', () => { a[k] = f.value; if (attr.rows) { f.style.height = 'auto'; f.style.height = Math.max(240, f.scrollHeight) + 'px'; } });
    f.addEventListener('change', () => sichern());
    if (attr.rows) setTimeout(() => { f.style.height = Math.max(240, f.scrollHeight) + 'px'; });
    return f;
  };
  const woerter = a.text ? a.text.split(/\s+/).length : 0;
  return h('div', { class: 'zwei breit-rechts' },
    h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
      h('div', { class: 'ueberschrift-klein' }, 'Maßgeschneidert'),
      h('div', { class: 'leise klein' }, 'Sprungbrett schreibt aus Lebenslauf und Anzeige ein Anschreiben mit konkreten Belegen – ohne Floskeln, ohne Erfundenes. Fehlendes steht in [eckigen Klammern].'),
      h('label', { class: 'feld' }, 'Empfänger (Anschrift)', feld('empfaenger', { rows: 4, placeholder: `${b.firma}\nPersonalabteilung\nStraße\nPLZ Ort` })),
      z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
      h('button', { class: 'knopf gross', disabled: z.laeuft || !bereit(b), onclick: () => anschreibenSchreiben() }, a.text ? '✨ Neu schreiben' : '✨ Anschreiben schreiben'),
      laufZeile(), fehlerZeile(() => anschreibenSchreiben()),
      a.text ? h('div', {}, h('div', { class: 'leise klein', style: { marginBottom: '6px' } }, 'Überarbeiten:'),
        h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, [
          ['Kürzer', 'Kürze auf höchstens 250 Wörter.'], ['Persönlicher', 'Mach es persönlicher und lebendiger, mit mehr eigener Stimme.'],
          ['Selbstbewusster', 'Formuliere selbstbewusster, ohne Konjunktiv-Häufungen („würde“, „könnte“).'], ['Fehler korrigieren', 'Korrigiere nur Rechtschreibung, Grammatik und Zeichensetzung.'],
          ['Auf Englisch', 'Übersetze in ein natürliches englisches Cover Letter (Anrede und Gruß ebenfalls).'],
        ].map(([n, t]) => h('button', { class: 'chip', disabled: z.laeuft, onclick: () => anschreibenSchreiben(t) }, n)))) : null),
    h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
      h('div', { class: 'zeile' },
        h('div', { class: 'ueberschrift-klein wachsen' }, `Dein Anschreiben${woerter ? ` · ${woerter} Wörter` : ''}`),
        a.vorher ? h('button', { class: 'knopf text klein', onclick: () => { b.anschreiben = { ...a.vorher, vorher: null }; sichern(); zeichnen(); } }, '↶ Rückgängig') : null),
      feld('betreff', { placeholder: 'Bewerbung als …' }),
      feld('anrede', { placeholder: 'Sehr geehrte Damen und Herren,' }),
      feld('text', { rows: 14, placeholder: 'Hier erscheint dein Anschreiben – du kannst alles direkt bearbeiten.' }),
      feld('gruss', { placeholder: 'Mit freundlichen Grüßen' }),
      z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
      a.text ? h('div', { class: 'zeile umbruch', style: { gap: '8px' } },
        h('button', { class: 'knopf', onclick: () => { z.ansicht = 'brief'; zeichnen(); } }, '📄 Briefansicht & PDF'),
        h('button', { class: 'knopf tonal', onclick: () => kopieren(`${a.anrede}\n\n${a.text}\n\n${a.gruss}\n${z.profil.name}`) }, 'Text kopieren')) : null));
}

function interviewTeil(b) {
  const fr = b.interview.fragen;
  if (!fr.length) return h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
    h('div', { class: 'leise' }, 'Sprungbrett stellt dir die Fragen, die für genau diese Stelle wahrscheinlich kommen. Du antwortest schriftlich (oder sprichst laut und notierst Stichpunkte) – und bekommst zu jeder Antwort ehrliches Feedback und eine bessere Version.'),
    h('div', { class: 'zeile' }, z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null, h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf', disabled: z.laeuft || !bereit(b), onclick: fragenErzeugen }, '🎤 Training starten')),
    laufZeile(), fehlerZeile(fragenErzeugen));
  const beantwortet = fr.filter((f) => f.feedback);
  const schnitt = beantwortet.length ? beantwortet.reduce((s, f) => s + f.feedback.note, 0) / beantwortet.length : 0;
  return h('div', { class: 'spalte', style: { gap: '12px' } },
    h('div', { class: 'zeile' },
      h('div', { class: 'wachsen leise' }, `${beantwortet.length} von ${fr.length} beantwortet${beantwortet.length ? ` · Schnitt ${schnitt.toFixed(1).replace('.', ',')} von 5` : ''}`),
      h('button', { class: 'knopf tonal klein', disabled: z.laeuft, onclick: fragenErzeugen }, 'Neue Fragen')),
    laufZeile(), fehlerZeile(),
    fr.map((f, i) => {
      const feld = h('textarea', { class: 'eingabe', 'data-feld': 'f-' + f.id, rows: 4, placeholder: 'Deine Antwort – so, wie du sie im Gespräch sagen würdest.' });
      feld.value = f.antwort;
      feld.addEventListener('input', () => { f.antwort = feld.value; });
      feld.addEventListener('change', () => sichern());
      return h('div', { class: 'flaeche frage' },
        h('div', { class: 'zeile oben', style: { gap: '10px' } },
          h('div', { class: 'frage-nr' }, String(i + 1)),
          h('div', { class: 'wachsen' },
            h('div', { class: 'klein leise' }, `${ARTEN[f.art][1]} ${ARTEN[f.art][0]}`),
            h('div', { class: 'fett', style: { fontSize: '15.5px' } }, f.frage),
            f.tipp ? h('details', { class: 'tipp-auf' }, h('summary', { class: 'klein' }, 'Worauf es ankommt'), h('div', { class: 'klein leise' }, f.tipp)) : null)),
        feld,
        h('div', { class: 'zeile' }, h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf klein' + (f.feedback ? ' tonal' : ''), disabled: z.laeuft, onclick: () => { f.antwort = feld.value; feedbackHolen(f); } }, f.feedback ? 'Nochmal bewerten' : 'Feedback holen')),
        f.feedback ? h('div', { class: 'feedback' },
          h('div', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: 'sterne' }, '★'.repeat(f.feedback.note) + '☆'.repeat(5 - f.feedback.note)), h('span', { class: 'klein leise' }, `${f.feedback.note} von 5`)),
          f.feedback.lob ? h('div', {}, h('span', { class: 'fett' }, '👍 '), f.feedback.lob) : null,
          f.feedback.tipp ? h('div', {}, h('span', { class: 'fett' }, '🎯 '), f.feedback.tipp) : null,
          f.feedback.vorschlag ? h('details', {}, h('summary', { class: 'klein' }, 'So könnte es klingen'), h('div', { class: 'vorschlag' }, f.feedback.vorschlag)) : null) : null);
    }));
}

function anzeigeTeil(b) {
  const anzeige = h('textarea', { class: 'eingabe', 'data-feld': 'anzeige', rows: 16, placeholder: 'Stellenanzeige einfügen …' });
  anzeige.value = b.anzeige;
  anzeige.addEventListener('input', () => { b.anzeige = anzeige.value; });
  anzeige.addEventListener('change', () => sichern());
  const notiz = h('textarea', { class: 'eingabe', 'data-feld': 'notiz', rows: 6, placeholder: 'Notizen: Ansprechperson, Gehaltswunsch, Termine, Eindrücke aus dem Gespräch …' });
  notiz.value = b.notiz;
  notiz.addEventListener('input', () => { b.notiz = notiz.value; });
  notiz.addEventListener('change', () => sichern());
  const datum = h('input', { class: 'eingabe', type: 'date', value: b.datum, style: { width: '170px' } });
  datum.addEventListener('change', () => { if (datum.value) { b.datum = datum.value; sichern(); } });
  return h('div', { class: 'zwei' },
    h('div', { class: 'flaeche spalte', style: { gap: '8px' } }, h('div', { class: 'ueberschrift-klein' }, 'Stellenanzeige'), anzeige),
    h('div', { class: 'flaeche spalte', style: { gap: '8px' } }, h('div', { class: 'ueberschrift-klein' }, 'Notizen'), notiz,
      h('label', { class: 'feld' }, 'Datum (Bewerbung bzw. gemerkt am)', datum)));
}

function briefAnsicht() {
  const b = z.b, a = b.anschreiben, p = z.profil;
  const datum = `${p.stadt ? p.stadt + ', ' : ''}${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const absenderZeile = [p.name, p.strasse, p.ort].filter(Boolean).join(' · ');
  const absaetze = (t) => t.split(/\n{2,}/).map((x) => h('p', {}, x.split('\n').flatMap((y, i) => (i ? [h('br'), y] : [y]))));
  return h('div', { class: 'brief-buehne' },
    h('div', { class: 'zeile nur-bildschirm brief-leiste' },
      h('button', { class: 'knopf text klein', onclick: () => { z.ansicht = 'bewerbung'; zeichnen(); } }, '← Bearbeiten'),
      h('span', { class: 'wachsen' }),
      !p.name ? h('span', { class: 'klein leise' }, 'Absender fehlt – im Profil eintragen.') : null,
      h('button', { class: 'knopf', onclick: () => lyra.drucken() }, 'Drucken / Als PDF sichern')),
    h('div', { class: 'brief' },
      h('div', { class: 'falz f1' }), h('div', { class: 'falz loch' }), h('div', { class: 'falz f2' }),
      h('div', { class: 'kopf-absender' },
        p.name ? h('div', { class: 'kopf-name' }, p.name) : null,
        h('div', {}, [p.strasse, p.ort].filter(Boolean).join(' · ')),
        h('div', {}, [p.telefon, p.email].filter(Boolean).join(' · '))),
      h('div', { class: 'anschrift' },
        absenderZeile ? h('div', { class: 'ruecksende' }, absenderZeile) : null,
        h('div', { class: 'empfaenger' }, (a.empfaenger || b.firma).split('\n').slice(0, 6).map((y) => h('div', {}, y)))),
      h('div', { class: 'infoblock' }, datum),
      h('div', { class: 'brief-inhalt' },
        h('div', { class: 'betreff' }, a.betreff),
        h('p', {}, a.anrede),
        absaetze(a.text),
        h('p', { class: 'gruss' }, a.gruss),
        h('div', {}, p.name || ''))));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const m = () => box.replaceChildren(...[['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']].map(([w, n]) =>
    h('button', { class: 'chip' + (e.ki === w ? ' an' : ''), onclick: () => { e.ki = w; m(); } }, n)));
  m();
  const ok = await lyra.dialog('Sprungbrett – Einstellungen', h('div', { style: { minWidth: '440px' } },
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Wer coacht'), box,
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Mit Claude, ChatGPT oder Gemini gehen Lebenslauf, Anzeige und deine Antworten hinaus (Lyra fragt vorher). Mit Lyra (lokal) bleibt alles auf deinem Mac.')), [
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
