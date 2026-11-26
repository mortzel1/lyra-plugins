'use strict';
/*
 * Flip – Karteikarten aus deinen Unterlagen. Du schreibst, was du lernen willst (5 bis 150 Karten); die KI erstellt sie
 * in Runden. Gelernt wird mit Wiederholung im passenden Abstand (vereinfachtes SM-2). Auf der Antwortseite kannst du
 * dir genau diese Karte erklären lassen. Daten nur in Lyras Speicher für dieses Plugin (stapel/…, einstellungen).
 */
const { h, mdElement, md, balken, fehlerBox, dialog, lehrerWahl } = lyra;

const KARTENMACHER = `Du bist Lyra im Plugin „Flip“ und erstellst Karteikarten für Studierende an einer deutschen \
Universität: fachlich korrekt, verständlich und so, dass sie beim Wiederholen wirklich etwas bringen. Schreib auf \
Deutsch; Formeln in LaTeX zwischen $…$.`;

const ERKLAERER = `Du bist Lyra, eine geduldige Tutorin für Studierende an einer deutschen Universität. Du erklärst eine \
Karteikarte genau und verständlich – Schritt für Schritt, mit Beispiel. Schreib auf Deutsch, sprich mit „du“, Formeln in \
LaTeX zwischen $…$. Stütze dich auf die Auszüge aus den Unterlagen, wenn welche dabei sind. Keine Begrüßung.`;

const SCHEMA_KARTEN = {
  type: 'object',
  properties: {
    karten: {
      type: 'array',
      items: {
        type: 'object',
        properties: { frage: { type: 'string' }, kurzantwort: { type: 'string' }, quelle: { type: 'integer' } },
        required: ['frage', 'kurzantwort', 'quelle'],
      },
    },
    stapeltitel: { type: 'string' },
  },
  required: ['karten', 'stapeltitel'],
};

const STANDARD = { ki: 'auto', anzahl: 15, neue: 20 };
const MAX = 150;

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  stapel: [],
  geladen: false,
  aktiv: null,
  modus: 'uebersicht', // uebersicht | stapel | lernen | fertig
  laeuft: null,
  hinweis: '',
  strom: '',
  fehler: null,
  fehlerBei: null,
  eingaben: {},
  themen: [],
  anzahl: 15,
  mitWissen: true,
  fortschrittErstellen: null,
  // Lernrunde
  runde: [],
  pos: 0,
  hinten: false,
  gewusst: 0,
  nochmal: 0,
  wiederholt: {},
  nachgefragt: {}, // Karten-ID → [[Frage, Antwort]]
  offeneFrage: '',
  nachOben: false,
};
const app = document.getElementById('app');
const online = () => z.lehrer !== 'lyra';
const lehrerName = () => (z.info?.lehrer || []).find((l) => l.kennung === z.lehrer)?.name || 'Lyra';
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const kuerzen = (t, n) => (t.length <= n ? t : t.slice(0, n).trimEnd() + ' …');
const jetzt = () => lyra.jetzt();

// ================================================================== Lehrer, Speicher

async function ki(art, auftrag, sichtbar = true) {
  if (sichtbar) {
    z.laeuft = art;
    z.hinweis = '';
    z.strom = '';
    z.fehler = null;
    z.fehlerBei = null;
    zeichnen();
  }
  try {
    const r = await lyra.ki({ lehrer: z.lehrer, ...auftrag }, sichtbar ? stueck : null);
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
    return r;
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) {
      z.fehler = m;
      z.fehlerBei = art;
    }
    return null;
  } finally {
    if (sichtbar) {
      z.laeuft = null;
      zeichnen();
    }
  }
}

let stromPlan = 0;
function stueck(e) {
  if (e.art === 'hinweis') {
    // „Lyra schreibt Karte 3 …“ → über alle Runden zählen
    const m = e.text.match(/Karte (\d+)/);
    const f = z.fortschrittErstellen;
    z.hinweis = m && f ? `${lehrerName()} schreibt Karte ${Math.min(f.gesamt, f.fertig + Number(m[1]))} von ${f.gesamt} …` : e.text;
  } else if (e.art === 'text') {
    z.strom += e.text;
  } else if (e.art === 'ersetzen') z.strom = e.text;
  if (!stromPlan) {
    stromPlan = requestAnimationFrame(() => {
      stromPlan = 0;
      const s = document.getElementById('strom');
      if (s) s.innerHTML = md(z.strom);
      const hw = document.getElementById('hinweis');
      if (hw) hw.textContent = z.hinweis || standardHinweis();
    });
  }
}

async function stellen(suche, anzahl) {
  try {
    return await lyra.suchen(suche, anzahl);
  } catch (_) {
    return { block: '', quellen: [] };
  }
}

// ================================================================== Lyra Campus: Stapel teilen

async function stapelTeilen(s) {
  await Campus.teilen({ titel: s.titel, typ: 'karten', daten: { stapel: { titel: s.titel, wunsch: s.wunsch || '', karten: s.karten.map((k) => ({ vorne: k.vorne, hinten: k.hinten })) } }, beschreibung: `${s.karten.length} Karteikarten` });
}

/** Aus einem Raum geöffnet: eigene Kopie des Stapels (mit frischem Lernstand) anlegen bzw. wieder öffnen. */
async function campusOeffnen() {
  const k = await Campus.kontext('karten');
  if (!k || !k.inhalt.daten || !k.inhalt.daten.stapel) return false;
  z.campusKontext = k;
  const id = 'campus-' + k.inhalt.id;
  let s = z.stapel.find((x) => x.id === id);
  if (!s) {
    const q = k.inhalt.daten.stapel;
    s = { id, titel: q.titel || k.inhalt.titel, wunsch: q.wunsch || '', erstellt: jetzt(), karten: [], naechsteId: 0,
      campus: { raum: k.raum.name, inhalt: k.inhalt.id, von: k.inhalt.name, aufgabe: k.inhalt.modus === 'aufgabe', pflicht: !!k.inhalt.pflicht } };
    for (const c of q.karten || []) {
      s.naechsteId++;
      s.karten.push({ id: s.naechsteId, vorne: c.vorne, hinten: c.hinten, quelle: null, gesehen: 0, falsch: 0, intervall: 0, leicht: 2.5, faellig: 0, zuletzt: 0, note: 0 });
    }
    await speichern(s);
    lyra.toast(`🗂 „${s.titel}“ von ${k.inhalt.name} ist jetzt in deinen Stapeln`, 'ok');
  }
  await oeffnen(id);
  if (k.host && k.inhalt.modus === 'aufgabe') {
    setTimeout(() => Campus.fortschrittDialog(`Fortschritt in „${k.raum.name}“`, ['Gelernt', 'Sitzen'], (d) => [`${Math.round((d.gelernt || 0) * 100)} %`, `${d.sitzen || 0}/${d.karten || 0}`]), 300);
  }
  return true;
}

async function speichern(s) {
  s.geaendert = jetzt();
  const ck = z.campusKontext;
  if (s.campus && s.campus.aufgabe && ck && !ck.host && ck.inhalt.id === s.campus.inhalt) {
    const sitzen = s.karten.filter((k) => k.intervall >= 7).length;
    Campus.melden({ gelernt: fortschritt(s), sitzen, karten: s.karten.length, fertig: sitzen === s.karten.length });
  }
  try {
    await lyra.speicher.schreiben('stapel/' + s.id, s);
  } catch (_) {}
  const i = z.stapel.findIndex((x) => x.id === s.id);
  if (i >= 0) z.stapel[i] = s;
  else z.stapel.unshift(s);
  startseite();
}

const zahlen = (s) => {
  const t = jetzt();
  return {
    neu: s.karten.filter((k) => !k.gesehen).length,
    faellig: s.karten.filter((k) => k.gesehen && k.faellig <= t).length,
    sitzen: s.karten.filter((k) => k.intervall >= 7).length,
  };
};
const fortschritt = (s) =>
  s.karten.length
    ? s.karten.reduce((x, k) => x + (k.intervall >= 7 ? 1 : !k.gesehen ? 0 : 0.25 + 0.5 * Math.min(1, k.intervall / 7)), 0) / s.karten.length
    : 0;

/** Stapel mit Fälligem auf Lyras Startseite – ein Klick startet die Lernrunde. */
function startseite() {
  const liste = z.stapel
    .map((s) => ({ s, ...zahlen(s) }))
    .filter((x) => x.s.karten.length)
    .sort((a, b) => b.faellig + b.neu - (a.faellig + a.neu) || b.s.geaendert - a.s.geaendert)
    .slice(0, 3)
    .map(({ s, neu, faellig }) => {
      const gesehen = s.karten.filter((k) => k.gesehen).map((k) => k.faellig);
      return {
        id: s.id,
        titel: s.titel,
        untertitel: [faellig ? `${faellig} fällig` : null, neu ? `${neu} neu` : null, `${s.karten.length} Karten`].filter(Boolean).join(' · '),
        fortschritt: fortschritt(s),
        route: 'lernen/' + s.id,
        faellig_ab: gesehen.length ? Math.min(...gesehen) : null,
        geaendert: s.geaendert,
      };
    });
  lyra.startseite(liste).catch(() => {});
}

/** Wiederholung im passenden Abstand (wie Anki): 1 Nochmal, 2 Schwer, 3 Gut, 4 Leicht. */
function abstand(k, note) {
  const l = k.leicht < 1.3 ? 2.5 : k.leicht;
  const iv = k.intervall || 0;
  if (note === 1) return 0;
  if (note === 2) return iv < 1 ? 0.5 : iv * 1.2;
  if (note === 3) return iv < 1 ? 1 : iv * l;
  return iv < 1 ? 3 : iv * (l + 0.15) * 1.3;
}

function bewertenKarte(k, note) {
  let l = k.leicht < 1.3 ? 2.5 : k.leicht;
  const tage = Math.min(365, abstand(k, note));
  if (note === 1) { l = Math.max(1.3, l - 0.2); k.falsch = (k.falsch || 0) + 1; }
  if (note === 2) l = Math.max(1.3, l - 0.15);
  if (note === 4) l += 0.15;
  k.leicht = l;
  k.intervall = tage;
  k.gesehen = (k.gesehen || 0) + 1;
  k.zuletzt = jetzt();
  k.note = note;
  k.faellig = note === 1 ? jetzt() + 60 : jetzt() + Math.round(tage * 86400);
}

function dauerText(tage) {
  if (tage <= 0) return '< 1 Min';
  if (tage < 1) return `${Math.round(tage * 24)} Std`;
  if (tage < 30) { const t = Math.round(tage); return `${t} ${t === 1 ? 'Tag' : 'Tage'}`; }
  if (tage < 365) return `${Math.round(tage / 30)} Mon.`;
  return '1 Jahr';
}

// ================================================================== Ablauf

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try {
    z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) };
  } catch (_) {}
  z.anzahl = z.einst.anzahl;
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try {
    z.stapel = (await lyra.speicher.liste('stapel')).map((e) => normalisieren(e.wert)).filter(Boolean);
    z.stapel.sort((a, b) => b.geaendert - a.geaendert);
  } catch (_) {}
  z.geladen = true;
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungenZeigen);
  document.addEventListener('keydown', taste);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route === 'campus' && await campusOeffnen()) {
    if (route === 'einstellungen') einstellungenZeigen();
    startseite();
    return;
  }
  if (route.startsWith('neu')) {
    const p = new URLSearchParams(route.split('?')[1] || '');
    z.eingaben.thema = p.get('thema') || '';
    z.eingaben.wunsch = p.get('wunsch') || '';
  }
  if (route.startsWith('lernen/')) {
    await oeffnen(route.slice(7));
    await lernen(false);
  } else if (route.startsWith('stapel/')) await oeffnen(route.slice(7));
  else zeichnen();
  if (route === 'einstellungen') einstellungenZeigen();
  lyra.themen().then((t) => { z.themen = t || []; if (z.modus === 'uebersicht') zeichnen(); }).catch(() => {});
  startseite();
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.laeuft) lyra.abbrechen();
  if (z.modus === 'lernen' || z.modus === 'fertig') {
    z.modus = 'stapel';
    zeichnen();
  } else if (z.modus === 'stapel') {
    z.modus = 'uebersicht';
    z.aktiv = null;
    lyra.titel('');
    zeichnen();
  } else lyra.zurueck();
}

/** Stapel aus der früher eingebauten Fassung: Kartennummern weiterzählen, fehlende Werte ergänzen. */
function normalisieren(s) {
  if (!s || !Array.isArray(s.karten)) return null;
  s.naechsteId = Math.max(s.naechsteId || 0, s.naechste_id || 0, ...s.karten.map((k) => k.id || 0));
  s.karten.forEach((k) => { if (!k.leicht) k.leicht = 2.5; });
  return s;
}

async function oeffnen(id) {
  let s = z.stapel.find((x) => x.id === id);
  if (!s) {
    try { s = normalisieren(await lyra.speicher.lesen('stapel/' + id)); } catch (_) {}
  }
  if (!s) return zeichnen();
  z.aktiv = s;
  z.modus = 'stapel';
  z.fehler = null;
  z.nachOben = true;
  lyra.titel(s.titel);
  zeichnen();
}

/** Karten erstellen – in Runden (bei vielen Karten), ohne Doppelte. Mit `stapel` kommen sie zu einem bestehenden dazu. */
async function erstellen(stapel, wunsch, thema, anzahl, material = '') {
  wunsch = wunsch.trim();
  thema = thema.trim();
  if ((!wunsch && !thema) || z.laeuft) return null;
  const gesamt = Math.max(5, Math.min(MAX, Math.round(anzahl) || 15));
  const art = stapel ? 'mehr' : 'neu';
  z.laeuft = art;
  z.hinweis = 'Suche passende Stellen in deinen Unterlagen …';
  z.fehler = null;
  zeichnen();
  // In einer Fusion kommt das Material von anderen Plugins statt aus den Unterlagen
  const { block, quellen } = material ? { block: material, quellen: [] } : await stellen(`${thema} ${wunsch}`, online() ? 16 : 8);
  if (!block && !z.mitWissen) {
    z.laeuft = null;
    z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – erlaube „Auch Wissen über meine Unterlagen hinaus“ oder gib ein anderes Thema an.';
    z.fehlerBei = art;
    return zeichnen();
  }
  const proRunde = online() ? 25 : 12;
  const vorhanden = (stapel ? stapel.karten : []).map((k) => k.vorne);
  const neu = [];
  let titel = '';
  let leer = 0;
  z.fortschrittErstellen = { fertig: 0, gesamt };
  while (neu.length < gesamt && leer < 2) {
    const n = Math.min(proRunde, gesamt - neu.length);
    z.fortschrittErstellen.fertig = neu.length;
    const schon = vorhanden.concat(neu.map((k) => k.vorne)).slice(-80);
    const r = await ki(art, {
      system: KARTENMACHER,
      prompt: `Was ich mit den Karten lernen möchte: ${wunsch || thema}\nThema: ${thema || wunsch}\n\n\
${schon.length ? `Diese Karten habe ich schon – keine davon wiederholen, auch nicht umformuliert:\n${schon.map((v) => '- ' + kuerzen(v, 110)).join('\n')}\n\n` : ''}\
${block ? `Auszüge aus meinen Unterlagen:\n\n${block}` : ''}\
${z.mitWissen ? 'Ergänze Wissen über die Auszüge hinaus, wo es für mein Ziel wichtig ist (dann "quelle": 0).\n\n' : 'Nutze nur, was in den Auszügen steht.\n\n'}\
Erstelle genau ${n} neue Karteikarten, die mir genau dabei helfen. Regeln für gute Karten:\n\
- Jede Karte fragt genau eine Sache ab (eine Definition, eine Aussage mit ihren Voraussetzungen, einen Rechenschritt, einen Zusammenhang).\n\
- Vorderseite: eine klare, eindeutige Frage oder Aufforderung – keine Ja/Nein-Fragen und nichts, was die Antwort schon verrät.\n\
- Rückseite: kurz und vollständig (1 bis 3 Sätze oder eine Formel), wenn es hilft mit einem Mini-Beispiel.\n\
- Gemischt: Begriffe, Sätze, „Warum?“-Fragen, kleine Anwendungs- oder Rechenaufgaben, typische Fehler.\n\
- Bezeichnungen und Schreibweisen wie in meinen Unterlagen.\n\
- "frage" ist die Vorderseite, "kurzantwort" die Rückseite, "quelle" die Nummer des Auszugs, aus dem die Karte stammt (0, wenn aus deinem Wissen).\n\n\
Antwort als JSON: {"karten": [{"frage": "…", "kurzantwort": "…", "quelle": 1}], "stapeltitel": "kurzer Name für den Stapel"}`,
      schema: SCHEMA_KARTEN,
      zaehlen: { schluessel: 'quelle', wort: 'Karte' },
    }, true);
    if (!r || !r.json) break; // Fehler oder abgebrochen – was schon da ist, bleibt
    titel = titel || text(r.json.stapeltitel || r.json.titel);
    const vorher = neu.length;
    for (const k of r.json.karten || []) {
      const vorne = text(k.frage || k.vorne);
      const hinten = text(k.kurzantwort || k.hinten);
      const doppelt = (v) => v.toLowerCase() === vorne.toLowerCase();
      if (!vorne || !hinten || vorhanden.some(doppelt) || neu.some((x) => doppelt(x.vorne))) continue;
      const qi = Number(k.quelle) - 1;
      neu.push({ vorne, hinten, quelle: qi >= 0 && quellen[qi] ? quellen[qi] : null });
      if (neu.length >= gesamt) break;
    }
    leer = neu.length === vorher ? leer + 1 : 0;
    z.laeuft = art; // weiter sichtbar, bis alle Runden durch sind
    zeichnen();
  }
  z.laeuft = null;
  z.fortschrittErstellen = null;
  if (neu.length < (stapel ? 1 : 3)) {
    if (!z.fehler) {
      z.fehler = 'Es kamen zu wenige brauchbare Karten – bitte noch einmal versuchen.';
      z.fehlerBei = art;
    }
    zeichnen();
    return null;
  }
  const s = stapel || {
    id: lyra.neueId(),
    titel: kuerzen(titel || thema || wunsch, 60),
    wunsch,
    thema,
    erstellt: jetzt(),
    geaendert: jetzt(),
    karten: [],
    naechsteId: 0,
  };
  for (const k of neu) {
    s.naechsteId = (s.naechsteId || 0) + 1;
    s.karten.push({ id: s.naechsteId, ...k, gesehen: 0, falsch: 0, intervall: 0, leicht: 2.5, faellig: 0, zuletzt: 0, note: 0 });
  }
  await speichern(s);
  if (neu.length < gesamt && !z.fehler) {
    z.fehler = `${neu.length} von ${gesamt} Karten erstellt – mit „Mehr Karten“ kannst du weitere dazu nehmen.`;
    z.fehlerBei = 'stapel';
  }
  return s;
}

async function neuErstellen() {
  const s = await erstellen(null, z.eingaben.wunsch || '', z.eingaben.thema || '', z.anzahl);
  if (s) {
    z.eingaben.wunsch = '';
    z.eingaben.thema = '';
    await oeffnen(s.id);
  }
}

async function mehrKarten() {
  const s = z.aktiv;
  let anzahl = 10;
  const wunsch = h('textarea', { class: 'eingabe', rows: 3 }, s.wunsch || '');
  wunsch.value = s.wunsch || '';
  const zahl = anzahlWahl(anzahl, (n) => (anzahl = n));
  const ok = await dialog('Mehr Karten erstellen', h('div', { class: 'spalte' },
    h('label', { class: 'feld' }, 'Was soll dazukommen?', wunsch), h('label', { class: 'feld' }, 'Wie viele?', zahl)), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Erstellen', wert: true },
  ]);
  if (!ok) return;
  z.modus = 'stapel';
  await erstellen(s, wunsch.value, s.thema, anzahl);
  zeichnen();
}

// ---------------------------------------------------------------- Anki (Konnektor)

/** Ist Anki bereit? Sonst erklären, wie es geht. */
async function ankiBereit() {
  let s = null;
  try { s = await lyra.anki.status(); } catch (_) {}
  if (s && s.verbunden) return true;
  await dialog('Anki ist nicht verbunden', h('div', { class: 'spalte' },
    h('p', {}, s && s.app
      ? 'Starte Anki. Einmalig brauchst du dort das Add-on AnkiConnect: Extras → Erweiterungen → Erweiterungen herunterladen → Code ' + (s.addonCode || '2055492159') + ', dann Anki neu starten.'
      : 'Verbinde Anki unter „Konnektoren“ (Stecker-Knopf neben der Büroklammer) – dort kannst du Anki auch installieren.'),
    h('p', { class: 'leise klein' }, 'Lyra spricht mit Anki nur auf deinem Mac – nichts geht ins Internet.')));
  return false;
}

/** Stapel nach Anki übertragen – Lyra fragt vorher noch einmal nach. */
async function nachAnki() {
  const s = z.aktiv;
  if (!s || !(await ankiBereit())) return;
  let vorhanden = [];
  try { vorhanden = await lyra.anki.stapel(); } catch (_) {}
  const name = h('input', { class: 'eingabe', list: 'anki-stapel' });
  name.value = s.titel;
  const liste = h('datalist', { id: 'anki-stapel' }, vorhanden.map((v) => h('option', { value: v })));
  const ok = await dialog('Nach Anki übertragen', h('div', { class: 'spalte' },
    h('label', { class: 'feld' }, 'Anki-Stapel', name, liste),
    h('p', { class: 'leise klein' }, `${s.karten.length} Karten. Gibt es den Stapel noch nicht, legt Lyra ihn an; Karten, die dort schon stehen, werden übersprungen.`)), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Weiter', wert: true },
  ]);
  if (!ok || !name.value.trim()) return;
  try {
    const [neu, doppelt] = await lyra.anki.uebertragen(name.value.trim(), s.karten.map((k) => ({ vorne: k.vorne, hinten: k.hinten })));
    await dialog('Fertig', h('p', {}, `${neu} Karten sind jetzt in Anki im Stapel „${name.value.trim()}“${doppelt ? ` – ${doppelt} waren schon da und wurden übersprungen` : ''}.`));
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN/.test(m)) await dialog('Hat nicht geklappt', h('p', {}, m));
  }
}

/** Einen Anki-Stapel als neuen Flip-Stapel holen (Anki bleibt unverändert). */
async function ausAnki() {
  if (!(await ankiBereit())) return;
  let vorhanden = [];
  try { vorhanden = await lyra.anki.stapel(); } catch (_) {}
  if (!vorhanden.length) return dialog('Keine Stapel', h('p', {}, 'In Anki gibt es noch keine Stapel.'));
  const wahl = h('select', { class: 'eingabe' }, vorhanden.map((v) => h('option', { value: v }, v)));
  const ok = await dialog('Aus Anki holen', h('div', { class: 'spalte' },
    h('label', { class: 'feld' }, 'Anki-Stapel', wahl),
    h('p', { class: 'leise klein' }, 'Lyra liest die Karten nur – in Anki ändert sich nichts. Gelernt wird dann hier mit Flip.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Holen', wert: true },
  ]);
  if (!ok) return;
  let karten = [];
  try { karten = await lyra.anki.holen(wahl.value); } catch (e) { return dialog('Hat nicht geklappt', h('p', {}, String((e && e.message) || e))); }
  if (!karten.length) return dialog('Leer', h('p', {}, 'In diesem Stapel gibt es keine Karten mit Vorder- und Rückseite.'));
  const s = { id: lyra.neueId(), titel: kuerzen(wahl.value.split('::').pop(), 60), wunsch: `Aus Anki: ${wahl.value}`, thema: '', erstellt: jetzt(), geaendert: jetzt(), karten: [], naechsteId: 0 };
  for (const k of karten.slice(0, 2000)) {
    s.naechsteId++;
    s.karten.push({ id: s.naechsteId, vorne: k.vorne, hinten: k.hinten, quelle: null, gesehen: 0, falsch: 0, intervall: 0, leicht: 2.5, faellig: 0, zuletzt: 0, note: 0 });
  }
  await speichern(s);
  await oeffnen(s.id);
}

async function karteBearbeiten(karte) {
  const s = z.aktiv;
  const vorne = h('textarea', { class: 'eingabe', rows: 3 });
  const hinten = h('textarea', { class: 'eingabe', rows: 4 });
  vorne.value = karte ? karte.vorne : '';
  hinten.value = karte ? karte.hinten : '';
  const ok = await dialog(karte ? 'Karte bearbeiten' : 'Karte hinzufügen', h('div', { class: 'spalte' },
    h('label', { class: 'feld' }, 'Vorderseite (Frage)', vorne), h('label', { class: 'feld' }, 'Rückseite (Antwort)', hinten),
    h('div', { class: 'leise klein' }, 'Formeln gern als $…$')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok || !vorne.value.trim() || !hinten.value.trim()) return;
  if (karte) {
    karte.vorne = vorne.value.trim();
    karte.hinten = hinten.value.trim();
  } else {
    s.naechsteId = (s.naechsteId || 0) + 1;
    s.karten.push({ id: s.naechsteId, vorne: vorne.value.trim(), hinten: hinten.value.trim(), quelle: null, gesehen: 0, falsch: 0, intervall: 0, leicht: 2.5, faellig: 0, zuletzt: 0, note: 0 });
  }
  await speichern(s);
  zeichnen();
}

async function karteLoeschen(karte) {
  const s = z.aktiv;
  s.karten = s.karten.filter((k) => k.id !== karte.id);
  await speichern(s);
  zeichnen();
}

async function umbenennen() {
  const s = z.aktiv;
  const e = h('input', { class: 'eingabe' });
  e.value = s.titel;
  const ok = await dialog('Stapel umbenennen', e, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Sichern', wert: true }]);
  if (!ok || !e.value.trim()) return;
  s.titel = kuerzen(e.value.trim(), 80);
  lyra.titel(s.titel);
  await speichern(s);
  zeichnen();
}

async function stapelLoeschen() {
  const s = z.aktiv;
  if (!(await lyra.bestaetigen({ titel: `„${s.titel}“ löschen?`, text: `Alle ${s.karten.length} Karten und dein Lernstand werden endgültig gelöscht.`, ja: 'Löschen', nein: 'Abbrechen', gefahr: true }))) return;
  try { await lyra.speicher.loeschen('stapel/' + s.id); } catch (_) {}
  z.stapel = z.stapel.filter((x) => x.id !== s.id);
  z.aktiv = null;
  z.modus = 'uebersicht';
  lyra.titel('');
  startseite();
  zeichnen();
}

// ---------------------------------------------------------------- Lernen

async function lernen(alle) {
  const s = z.aktiv;
  if (!s) return;
  const t = jetzt();
  const faellig = s.karten.filter((k) => k.gesehen && (alle || k.faellig <= t)).sort((a, b) => a.faellig - b.faellig);
  const neu = s.karten.filter((k) => !k.gesehen).slice(0, alle ? Infinity : z.einst.neue);
  const ids = faellig.concat(neu).map((k) => k.id);
  if (!ids.length) return zeichnen();
  Object.assign(z, { runde: ids, pos: 0, hinten: false, gewusst: 0, nochmal: 0, wiederholt: {}, modus: 'lernen' });
  zeichnen();
}

const aktuelleKarte = () => z.aktiv && z.aktiv.karten.find((k) => k.id === z.runde[z.pos]);

/** Umdrehen – hin und zurück (Klick, Leertaste). Nur die Klasse wechselt: die Drehung läuft flüssig per CSS. */
function umdrehen() {
  if (z.modus !== 'lernen') return;
  z.hinten = !z.hinten;
  const karte = document.querySelector('.karte3d');
  if (karte) karte.classList.toggle('hinten', z.hinten);
  document.querySelectorAll('.nur-hinten').forEach((e) => e.classList.toggle('ausblenden', !z.hinten));
  document.querySelectorAll('.nur-vorn').forEach((e) => e.classList.toggle('ausblenden', z.hinten));
  if (z.hinten) {
    const f = document.querySelector('[data-feld="nachfrage"]');
    if (f) f.disabled = false;
  }
}

async function bewerten(note) {
  const k = aktuelleKarte();
  if (!k || !z.hinten || z.laeuft) return;
  bewertenKarte(k, note);
  if (note === 1) {
    z.nochmal++;
    z.wiederholt[k.id] = (z.wiederholt[k.id] || 0) + 1;
    if (z.wiederholt[k.id] <= 3) z.runde.push(k.id); // kommt in dieser Runde noch einmal
  } else z.gewusst++;
  await speichern(z.aktiv);
  z.pos++;
  z.hinten = false;
  z.eingaben.nachfrage = '';
  if (z.pos >= z.runde.length) z.modus = 'fertig';
  zeichnen();
}

function taste(e) {
  if (z.modus !== 'lernen' || document.querySelector('.dialog-grund')) return;
  const imFeld = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
  if (imFeld) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    umdrehen();
  } else if (z.hinten && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault();
    bewerten(Number(e.key));
  }
}

/** Auf der Antwortseite: genau diese Karte erklären lassen. */
async function nachfragen() {
  const k = aktuelleKarte();
  const f = (z.eingaben.nachfrage || '').trim();
  if (!k || !f || z.laeuft) return;
  z.offeneFrage = f;
  z.eingaben.nachfrage = '';
  const { block } = await stellen(`${k.vorne} ${f}`, 4);
  const frueher = (z.nachgefragt[k.id] || []).slice(-2).map(([a, b]) => `Meine frühere Frage: ${a}\nDeine Antwort: ${kuerzen(b, 1000)}`).join('\n\n');
  const r = await ki('nachfragen', {
    system: ERKLAERER,
    prompt: `Karteikarte aus meinem Stapel „${z.aktiv.titel}“:\nFrage: ${k.vorne}\nAntwort: ${k.hinten}\n\n${frueher ? frueher + '\n\n' : ''}\
${block ? `Auszüge aus meinen Unterlagen:\n\n${block}` : ''}Meine Frage dazu: ${f}\n\n\
Erkläre mir genau diese Aufgabe und ihre Lösung so, dass ich sie wirklich verstehe – Schritt für Schritt, mit einem Beispiel, \
wenn es hilft. Bleib bei dieser Karte.`,
  });
  if (r && r.text.trim()) (z.nachgefragt[k.id] = z.nachgefragt[k.id] || []).push([f, r.text.trim()]);
  zeichnen();
}

// ---------------------------------------------------------------- Einstellungen

async function einstellungenZeigen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schluessel, optionen) => {
    const box = h('div', { class: 'wahl zeile umbruch', style: { gap: '6px' } });
    const malen = () => box.replaceChildren(...optionen.map(([wert, name]) =>
      h('button', { class: 'chip' + (e[schluessel] === wert ? ' an' : ''), onclick: () => { e[schluessel] = wert; malen(); } }, name)));
    malen();
    return box;
  };
  const zeile = (titel, erklaerung, inhalt) => h('div', { class: 'spalte', style: { gap: '6px', marginBottom: '16px' } },
    h('div', { class: 'fett' }, titel), h('div', { class: 'leise klein' }, erklaerung), inhalt);
  const ok = await dialog('Flip – Einstellungen', h('div', {},
    zeile('Karten beim Erstellen', 'So viele schlägt Flip vor – beim Erstellen frei wählbar bis 150.',
      anzahlWahl(e.anzahl, (n) => (e.anzahl = n))),
    zeile('Neue Karten je Runde', 'Höchstens so viele neue Karten kommen in eine Lernrunde (fällige kommen immer).',
      wahl('neue', [[10, '10'], [20, '20'], [30, '30'], [50, '50']])),
    zeile('Wer erstellt und erklärt', 'Automatisch: Claude bzw. ChatGPT, wenn verbunden (braucht Internet) – sonst Lyra lokal.',
      wahl('ki', [['auto', 'Automatisch'], ['lyra', 'Immer Lyra (lokal)']])),
    h('div', { class: 'leise klein' }, '🔒 Deine Stapel liegen nur auf deinem Mac.')), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.anzahl = e.anzahl;
  if (e.ki === 'lyra') z.lehrer = 'lyra';
  else if (z.lehrer === 'lyra' && z.info.standardLehrer) z.lehrer = z.info.standardLehrer;
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

/** Anzahl wählen: Regler, Zahlenfeld und schnelle Werte – 5 bis 150. */
function anzahlWahl(wert, beiWahl) {
  let n = Math.max(5, Math.min(MAX, wert || 15));
  const regler = h('input', { type: 'range', min: 5, max: MAX, step: 1, class: 'regler' });
  const zahl = h('input', { type: 'number', min: 5, max: MAX, class: 'eingabe' });
  const schnell = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const setzen = (x, quelle) => {
    n = Math.max(5, Math.min(MAX, Math.round(Number(x)) || 5));
    if (quelle !== regler) regler.value = n;
    if (quelle !== zahl) zahl.value = n;
    schnell.querySelectorAll('.chip').forEach((c) => c.classList.toggle('an', Number(c.dataset.n) === n));
    beiWahl(n);
  };
  regler.addEventListener('input', () => setzen(regler.value, regler));
  zahl.addEventListener('input', () => { if (zahl.value !== '') setzen(zahl.value, zahl); });
  zahl.addEventListener('blur', () => setzen(zahl.value, null));
  [10, 20, 50, 100, 150].forEach((x) => schnell.appendChild(h('button', { class: 'chip', 'data-n': x, onclick: () => setzen(x, null) }, String(x))));
  setzen(n, null);
  return h('div', { class: 'spalte', style: { gap: '8px' } }, h('div', { class: 'anzahl' }, regler, zahl, h('span', { class: 'leise' }, 'Karten')), schnell);
}

// ================================================================== Ansicht

function standardHinweis() {
  if (z.laeuft === 'nachfragen') return `${lehrerName()} erklärt die Karte …`;
  return 'Karten werden erstellt …';
}

function laufZeile() {
  return h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'hinweis' }, z.hinweis || standardHinweis()),
    h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, z.laeuft === 'neu' || z.laeuft === 'mehr' ? 'Stopp' : 'Abbrechen'));
}

function fehlerZeile(art) {
  if (z.fehlerBei !== art || !z.fehler) return null;
  const nochmal = art === 'neu' ? () => { z.fehler = null; neuErstellen(); } : art === 'nachfragen' ? () => { z.fehler = null; nachfragen(); } : null;
  return h('div', { style: { marginTop: '12px' } }, fehlerBox(z.fehler,
    online() && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null,
    () => { z.fehler = null; zeichnen(); }, nochmal));
}

function feld(name, e) {
  return h(e.zeilen ? 'textarea' : 'input', {
    class: 'eingabe',
    'data-feld': name,
    placeholder: e.platzhalter,
    rows: e.zeilen,
    disabled: (!!z.laeuft && !e.immer) || e.aus,
    value: z.eingaben[name] || '',
    oninput: (ev) => { z.eingaben[name] = ev.target.value; if (e.beiEingabe) e.beiEingabe(); },
    onkeydown: (ev) => {
      if (ev.key === 'Enter' && (!e.zeilen || ev.metaKey) && e.beiEnter) { ev.preventDefault(); e.beiEnter(); }
      ev.stopPropagation();
    },
  });
}

function zeichnen() {
  const aktiv = document.activeElement;
  const name = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const auswahl = name ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const alt = document.querySelector('.wrap');
  const pos = alt ? alt.scrollTop : 0;
  app.replaceChildren(
    z.modus === 'lernen' ? lernAnsicht() : z.modus === 'fertig' ? fertigAnsicht() : z.modus === 'stapel' && z.aktiv ? stapelAnsicht() : uebersicht());
  if (name) {
    const e = document.querySelector(`[data-feld="${name}"]`);
    if (e && !e.disabled) {
      e.focus();
      try { e.setSelectionRange(auswahl[0], auswahl[1]); } catch (_) {}
    }
  }
  const neu = document.querySelector('.wrap');
  if (neu) neu.scrollTop = z.nachOben ? 0 : pos;
  z.nachOben = false;
}

function stapelZeile(s) {
  const { neu, faellig, sitzen } = zahlen(s);
  const dran = faellig + Math.min(neu, z.einst.neue);
  return lyra.eintrag({
    symbol: '🃏',
    titel: s.titel,
    unter: [`${s.karten.length} Karten`, faellig ? `${faellig} fällig` : null, neu ? `${neu} neu` : null, sitzen ? `${sitzen} sitzen` : null].filter(Boolean).join(' · '),
    fortschritt: fortschritt(s),
    beiKlick: () => oeffnen(s.id),
    rechts: dran
      ? h('button', { class: 'knopf tonal klein', disabled: !!z.laeuft, onclick: async (e) => { e.stopPropagation(); await oeffnen(s.id); lernen(false); } }, `Lernen · ${dran}`)
      : h('span', { class: 'etikett', style: { '--farbe': 'var(--ok)' } }, '✓ erledigt'),
  });
}

function uebersicht() {
  const dran = z.stapel.map((s) => { const x = zahlen(s); return [s, x.faellig + Math.min(x.neu, z.einst.neue)]; }).filter(([, n]) => n > 0);
  const summe = dran.reduce((a, [, n]) => a + n, 0);
  const seite = h('div', { class: 'seite' },
    lyra.kopf({
      titel: 'Karteikarten, die sitzen',
      unter: `Sag, was du lernen willst – ${lehrerName()} macht daraus Karten aus deinen Unterlagen. Gelernt wird mit Wiederholung im richtigen Abstand.`,
      aktionen: [h('button', { class: 'knopf text klein', onclick: ausAnki, title: 'Einen Stapel aus deiner Anki-App holen' }, 'Aus Anki holen')],
    }),
    summe ? h('div', { class: 'heute' },
      h('div', { class: 'heute-zahl' }, String(summe)),
      h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, `${summe === 1 ? 'Karte ist' : 'Karten sind'} heute dran`),
        h('div', { class: 'leise klein' }, dran.map(([s, n]) => `${s.titel} (${n})`).slice(0, 3).join(' · '))),
      h('button', { class: 'knopf', disabled: !!z.laeuft, onclick: async () => { await oeffnen(dran[0][0].id); lernen(false); } }, dran.length > 1 ? `Mit „${kuerzen(dran[0][0].titel, 24)}“ anfangen` : 'Jetzt lernen')) : null,
    lyra.verfasser({
      wert: z.eingaben.wunsch || '',
      feld: 'wunsch',
      platzhalter: 'Was willst du lernen? z. B. „Definitionen und Sätze aus Kapitel 2 für die Klausur“ oder „Fachbegriffe zu Rekursion“',
      beiEingabe: (v) => { z.eingaben.wunsch = v; },
      beiSenden: (v) => { z.eingaben.wunsch = v; neuErstellen(); },
      knopf: `${z.anzahl} Karten erstellen`,
      deaktiviert: !!z.laeuft,
      unten: [
        z.info ? lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        lyra.auswahl({ titel: 'Karten', wert: z.anzahl, beiWahl: (n) => { z.anzahl = n; zeichnen(); }, optionen: [5, 10, 15, 20, 30, 50, 80, 100, 150].map((n) => [n, String(n)]) }),
        lyra.auswahl({ titel: 'Wissen', wert: z.mitWissen ? 'mehr' : 'unterlagen', beiWahl: (w) => { z.mitWissen = w === 'mehr'; zeichnen(); }, optionen: [
          ['unterlagen', 'Nur Unterlagen', 'Nur, was in deinen Unterlagen steht – mit Fundstelle'],
          ['mehr', 'Unterlagen + mehr', 'Ergänzt Wichtiges, das in deinen Unterlagen fehlt']] }),
      ],
    }),
    z.themen.length && !z.laeuft ? lyra.vorschlaege(z.themen, (t) => { z.eingaben.wunsch = t; zeichnen(); const f = document.querySelector('[data-feld="wunsch"]'); if (f) f.focus(); }, { titel: 'Aus deinen Unterlagen:' }) : null,
    z.laeuft === 'neu' ? h('div', { class: 'ly-arbeit', style: { marginTop: '14px' } }, laufZeile(),
      z.fortschrittErstellen ? balken(z.fortschrittErstellen.fertig / z.fortschrittErstellen.gesamt, 'var(--akzent)', true) : null) : null,
    fehlerZeile('neu'),
    z.stapel.length ? lyra.abschnitt('Deine Stapel', h('div', { class: 'ly-liste' }, z.stapel.map(stapelZeile))) : null,
    !z.stapel.length && !z.laeuft ? lyra.leer({ symbol: '🃏', titel: 'Noch keine Stapel', text: 'Schreib oben, was du lernen willst – oder hol einen Stapel aus Anki.' }) : null);
  return h('div', { class: 'wrap' }, seite);
}

function stapelAnsicht() {
  const s = z.aktiv;
  const { neu, faellig, sitzen } = zahlen(s);
  const dran = faellig + Math.min(neu, z.einst.neue);
  const t = jetzt();
  const suche = (z.eingaben.kartensuche || '').trim().toLowerCase();
  const karten = suche ? s.karten.filter((k) => `${k.vorne} ${k.hinten}`.toLowerCase().includes(suche)) : s.karten;
  const kachel = (zahl, name, farbe) => h('div', { class: 'stat', style: { '--f': farbe } }, h('div', { class: 'stat-zahl' }, String(zahl)), h('div', { class: 'leise klein' }, name));
  return h('div', { class: 'wrap' }, h('div', { class: 'seite' },
    lyra.kopf({
      titel: s.titel,
      unter: s.wunsch && s.wunsch !== s.titel ? s.wunsch : `${s.karten.length} Karten · erstellt ${lyra.zeitText(s.erstellt)}`,
      zurueck: { titel: 'Alle Stapel', bei: zurueck },
      aktionen: [
        h('button', { class: 'knopf symbol', title: 'In einen Raum teilen (Lyra Campus)', onclick: () => stapelTeilen(s) }, '👥'),
        h('button', { class: 'knopf symbol', title: 'Umbenennen', onclick: umbenennen }, '✎'),
        h('button', { class: 'knopf symbol', title: 'Stapel löschen', onclick: stapelLoeschen }, '🗑'),
      ],
    }),
    h('div', { class: 'stats' },
      h('div', { class: 'stat gross' }, h('div', { class: 'stat-zahl' }, `${Math.round(fortschritt(s) * 100)} %`), h('div', { style: { margin: '6px 0 2px' } }, balken(fortschritt(s), 'var(--akzent)', true)), h('div', { class: 'leise klein' }, 'gelernt')),
      kachel(faellig, 'fällig', 'var(--bernstein)'), kachel(neu, 'neu', 'var(--akzent)'), kachel(sitzen, 'sitzen', 'var(--ok)')),
    h('div', { class: 'zeile umbruch', style: { margin: '18px 0 6px' } },
      h('button', { class: 'knopf', disabled: !dran || !!z.laeuft, onclick: () => lernen(false) }, dran ? `▶ Lernen · ${dran} Karten` : 'Heute alles gelernt'),
      h('button', { class: 'knopf rand', disabled: !s.karten.length || !!z.laeuft, onclick: () => lernen(true) }, 'Alle Karten üben'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text', disabled: !!z.laeuft, onclick: mehrKarten }, '✦ Mehr Karten'),
      h('button', { class: 'knopf text', disabled: !!z.laeuft, onclick: () => karteBearbeiten(null) }, '+ Karte hinzufügen'),
      h('button', { class: 'knopf text', disabled: !!z.laeuft || !s.karten.length, onclick: nachAnki, title: 'Diesen Stapel in deine Anki-App übertragen' }, '→ Anki')),
    z.laeuft === 'mehr' ? h('div', {}, laufZeile(), z.fortschrittErstellen ? balken(z.fortschrittErstellen.fertig / z.fortschrittErstellen.gesamt, null, true) : null) : null,
    fehlerZeile('mehr'), fehlerZeile('stapel'),
    s.karten.length > 8 ? h('input', { class: 'eingabe', 'data-feld': 'kartensuche', placeholder: `In ${s.karten.length} Karten suchen …`, value: z.eingaben.kartensuche || '', style: { marginTop: '16px' },
      oninput: (e) => { z.eingaben.kartensuche = e.target.value; zeichnen(); } }) : null,
    suche && !karten.length ? h('div', { class: 'leise', style: { padding: '20px 4px' } }, 'Keine Karte passt.') : null,
    h('div', { style: { marginTop: '14px' } }, karten.map((k) => {
      const [stand, farbe] = !k.gesehen ? ['neu', 'var(--akzent)'] : k.intervall >= 7 ? ['sitzt', 'var(--ok)'] : k.faellig <= t ? ['fällig', 'var(--bernstein)'] : [`in ${dauerText((k.faellig - t) / 86400)}`, 'var(--leise)'];
      return h('div', { class: 'karte', style: { marginBottom: '10px' } }, h('div', { class: 'kartenzeile' },
        h('div', { class: 'wachsen' }, mdElement(k.vorne), h('div', { class: 'trenner' }), mdElement(k.hinten, 'hinten'),
          k.quelle ? h('button', { class: 'chip', style: { marginTop: '8px' }, onclick: () => lyra.oeffnen(k.quelle) }, '📄 ', k.quelle.seite ? `${k.quelle.titel} · S. ${k.quelle.seite}` : k.quelle.titel) : null),
        h('div', { class: 'spalte', style: { alignItems: 'flex-end', gap: '4px' } },
          h('span', { class: 'etikett', style: { '--farbe': farbe } }, stand),
          h('div', { class: 'zeile', style: { gap: '2px' } },
            h('button', { class: 'knopf symbol', title: 'Bearbeiten', onclick: () => karteBearbeiten(k) }, '✎'),
            h('button', { class: 'knopf symbol', title: 'Löschen', onclick: () => karteLoeschen(k) }, '🗑')))));
    }))));
}

function lernAnsicht() {
  const k = aktuelleKarte();
  if (!k) return h('div');
  const noten = [[1, 'Nochmal', 'var(--falsch)'], [2, 'Schwer', 'var(--bernstein)'], [3, 'Gut', 'var(--ok)'], [4, 'Leicht', 'var(--himmel)']];
  const fragen = z.nachgefragt[k.id] || [];
  const quelle = k.quelle;
  return h('div', { class: 'lernen' },
    h('div', { class: 'zeile' },
      h('span', { class: 'fett leise klein' }, `Karte ${Math.min(z.pos + 1, z.runde.length)} von ${z.runde.length}`),
      h('span', { class: 'wachsen' }),
      h('span', { class: 'leise klein' }, `${z.gewusst} gewusst · ${z.nochmal}× nochmal`)),
    h('div', { style: { margin: '8px 0 4px' } }, balken(z.runde.length ? z.pos / z.runde.length : 0, null, true)),
    h('div', { class: 'buehne' },
      h('div', { class: 'karte3d' + (z.hinten ? ' hinten' : ''), onclick: (e) => { if (!e.target.closest('button, a, input')) umdrehen(); } },
        h('div', { class: 'seite3d vorn' },
          h('div', { class: 'marke' }, 'FRAGE'),
          h('div', { class: 'inhalt vorn-text' }, mdElement(k.vorne)),
          h('div', { class: 'leise klein mitte' }, 'Erst selbst überlegen – dann umdrehen (Klick oder Leertaste).')),
        h('div', { class: 'seite3d rueck' },
          h('div', { class: 'marke' }, 'ANTWORT'),
          h('div', { class: 'inhalt rueck-text' },
            h('div', { class: 'frage-klein' }, mdElement(k.vorne)),
            h('div', { class: 'trenner', style: { margin: '12px 0' } }),
            mdElement(k.hinten),
            quelle ? h('div', { style: { marginTop: '12px' } }, h('button', { class: 'chip', onclick: () => lyra.oeffnen(quelle) }, '📄 ', quelle.seite ? `${quelle.titel} · S. ${quelle.seite}` : quelle.titel)) : null),
          h('div', { class: 'leise klein mitte' }, 'Klick oder Leertaste dreht zurück.')))),
    // Nur auf der Antwortseite: genauer erklären lassen und bewerten
    h('div', { class: 'nachfragen nur-hinten einblenden' + (z.hinten ? '' : ' ausblenden') },
      fragen.map(([f, a]) => h('div', { class: 'antwort' }, h('div', { class: 'fett klein', style: { marginBottom: '4px' } }, f), mdElement(a))),
      z.laeuft === 'nachfragen' ? h('div', { class: 'antwort' }, h('div', { class: 'fett klein', style: { marginBottom: '4px' } }, z.offeneFrage),
        h('div', { class: 'md', id: 'strom', html: md(z.strom) }), laufZeile()) : null,
      fehlerZeile('nachfragen'),
      h('div', { class: 'zeile' },
        feld('nachfrage', { platzhalter: 'Antwort unklar? Lass dir genau diese Karte erklären …', beiEnter: nachfragen, aus: !z.hinten }),
        h('button', { class: 'knopf tonal', disabled: !!z.laeuft, onclick: nachfragen }, 'Erklären'))),
    h('div', { class: 'unten' },
      h('div', { class: 'noten nur-hinten' + (z.hinten ? '' : ' ausblenden') }, noten.map(([n, name, farbe]) =>
        h('button', { class: 'note', style: { '--n': farbe }, onclick: () => bewerten(n) },
          h('div', { class: 'n' }, name), h('div', { class: 'd' }, `${dauerText(abstand(k, n))} · ${n}`)))),
      h('div', { class: 'nur-vorn' + (z.hinten ? ' ausblenden' : '') },
        h('button', { class: 'knopf gross', onclick: umdrehen }, 'Umdrehen  (Leertaste)'))));
}

function fertigAnsicht() {
  const s = z.aktiv;
  const { faellig, sitzen } = zahlen(s);
  return h('div', { class: 'wrap', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    h('div', { class: 'mitte spalte', style: { alignItems: 'center' } },
      h('div', { style: { fontSize: '60px' } }, '🏆'),
      h('h1', {}, 'Runde geschafft!'),
      h('p', { class: 'leise' }, `${z.gewusst} gewusst · ${z.nochmal}× nochmal`),
      h('p', { class: 'leise' }, `${sitzen} von ${s.karten.length} Karten sitzen schon.`),
      h('div', { class: 'zeile', style: { marginTop: '14px' } },
        h('button', { class: 'knopf', onclick: () => { z.modus = 'stapel'; zeichnen(); } }, 'Zum Stapel'),
        faellig ? h('button', { class: 'knopf rand', onclick: () => lernen(false) }, `Weiter lernen · ${faellig} fällig`) : null)));
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

const anzahlAus = (a, std, max) => { const m = /(\d+)\s*(Karte|Frage|Begriff|Wort|Wörter|Eintr)/i.exec(String(a.anweisung || '')); const n = Number((a.optionen && a.optionen.anzahl) || (m && m[1]) || std); return Math.max(3, Math.min(max, n || std)); };
function fusionAnbieten() {
  lyra.fusion.anbieten({
    karten: async (a, { status }) => {
      const material = lyra.fusion.materialOhneAufgabe(a, z.lehrer === 'lyra' ? 9000 : 16000);
      z.lehrer = a.lehrer || z.lehrer;
      z.mitWissen = true;
      const uhr = setInterval(() => { if (z.hinweis) status(z.hinweis); }, 1200);
      let s = null;
      try { s = await erstellen(null, String(a.anweisung || ''), lyra.fusion.kurzthema(a), anzahlAus(a, 20, 60), material); } finally { clearInterval(uhr); }
      if (!s) throw new Error(z.fehler || 'Flip konnte keine Karten erstellen.');
      return {
        art: 'karten',
        titel: s.titel,
        markdown: `# ${s.titel}\n\n` + s.karten.map((k, i) => `**${i + 1}. ${k.vorne}**  \n${k.hinten}`).join('\n\n'),
        daten: { karten: s.karten.map((k) => ({ vorne: k.vorne, hinten: k.hinten })) },
        oeffnen: 'stapel/' + s.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
