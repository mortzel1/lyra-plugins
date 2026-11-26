'use strict';
/*
 * Puls – Live-Umfragen und Fragenwand für Vorlesung, Seminar und Gruppe. Du zeigst die Leinwand, alle anderen machen
 * auf ihrem Handy mit: per Link/QR im Browser (ohne Lyra, ohne Konto) oder in Lyra Campus. Ende-zu-Ende-verschlüsselt.
 * Arten: Umfrage, Skala, Wortwolke, offene Frage (KI fasst zu Themen zusammen), Schätzfrage, Rangfolge, Verständnis-Ampel.
 * Dazu eine Fragenwand mit Abstimmen. Standard: anonym. Gespeichert wird nur das Zusammengefasste – keine Namen.
 */
const { h } = lyra;
const { ARTEN, AMPEL, fmt, zahl } = PulsAnsicht;
const TYP = 'puls';
const meldung = LyraOnline.meldung;
const abgebrochen = LyraOnline.abgebrochen;
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const app = document.getElementById('app');

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    titel: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          art: { type: 'string', enum: Object.keys(ARTEN) },
          frage: { type: 'string' },
          optionen: { type: 'array', items: { type: 'string' } },
          mehrfach: { type: 'boolean' },
          richtig: { type: 'array', items: { type: 'integer' } },
          min: { type: 'integer' }, max: { type: 'integer' },
          links: { type: 'string' }, rechts: { type: 'string' },
          einheit: { type: 'string' },
          wahr_bekannt: { type: 'boolean' }, wahr: { type: 'number' },
        },
        required: ['art', 'einheit', 'frage', 'links', 'max', 'mehrfach', 'min', 'optionen', 'rechts', 'richtig', 'wahr', 'wahr_bekannt'],
      },
    },
  },
  required: ['titel', 'items'],
};

const ZWECKE = {
  vorlesung: ['Vorlesung / Verständnis', 'Prüft, ob der Stoff angekommen ist – mit Verständnisfragen, Ampel und „Was ist unklar?“'],
  diskussion: ['Diskussion', 'Meinungen sammeln, Positionen sichtbar machen, Gespräch anstoßen'],
  feedback: ['Feedback', 'Rückmeldung zu einer Sitzung, einem Kurs oder Projekt'],
  einstieg: ['Einstieg / Vorwissen', 'Vorwissen und Erwartungen zum Thema abfragen'],
};

const VORLAGEN = [
  { titel: 'Verständnis-Check', anonym: true, wand: true, teilen: true, items: [
    { art: 'ampel', frage: 'Wie gut konntest du bisher folgen?' },
    { art: 'skala', frage: 'Wie sicher fühlst du dich beim heutigen Thema?', min: 1, max: 5, links: 'gar nicht', rechts: 'sehr sicher' },
    { art: 'freitext', frage: 'Was ist dir noch unklar?' },
    { art: 'wortwolke', frage: 'Welcher Begriff von heute bleibt hängen?', woerter: 2 },
  ] },
  { titel: 'Feedback zur Sitzung', anonym: true, wand: false, teilen: true, items: [
    { art: 'skala', frage: 'Wie hat dir die Sitzung insgesamt gefallen?', min: 1, max: 5, links: 'gar nicht', rechts: 'sehr gut' },
    { art: 'umfrage', frage: 'Das Tempo war …', optionen: ['zu langsam', 'genau richtig', 'zu schnell'] },
    { art: 'wortwolke', frage: 'Beschreibe die Sitzung in einem Wort', woerter: 1 },
    { art: 'freitext', frage: 'Was sollten wir beim nächsten Mal anders machen?' },
  ] },
  { titel: 'Kennenlernen', anonym: false, wand: true, teilen: true, items: [
    { art: 'wortwolke', frage: 'Was studierst du – oder was machst du sonst?', woerter: 1 },
    { art: 'rangfolge', frage: 'Was ist dir in diesem Kurs am wichtigsten?', optionen: ['Gute Note', 'Wirklich verstehen', 'Leute kennenlernen', 'Wenig Aufwand', 'Praxisbezug'] },
    { art: 'schaetzen', frage: 'Wie viele Minuten brauchst du für deinen Weg hierher?', einheit: 'min' },
    { art: 'freitext', frage: 'Was erhoffst du dir vom Kurs?' },
  ] },
];

const z = {
  info: null,
  lehrer: 'lyra',
  ansicht: 'start', // start | erstellen | bearbeiten | live | auswertung | mitmachen
  runden: [],
  auswertungen: [],
  runde: null, // in Bearbeitung
  live: null,
  auswertung: null,
  kontext: null,
  thema: '',
  einst: { anzahl: 5, quelle: 'beides', zweck: 'vorlesung' },
  hinweis: '',
  fehler: null,
};

// ================================================================== Start, Speicher

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  z.lehrer = z.info.standardLehrer || 'lyra';
  try { z.einst = { ...z.einst, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  await laden();
  lyra.bei('zurueck', zurueck);
  try { z.kontext = await lyra.campus.kontext(); } catch (_) { z.kontext = null; }
  const k = z.kontext;
  if (k && k.inhalt && k.inhalt.typ === TYP) {
    const ichLeite = k.ich && k.inhalt.von === k.ich.id;
    if (!ichLeite) return mitmachen(k);
    const r = z.runden.find((x) => x.id === (k.inhalt.daten && k.inhalt.daten.runde));
    if (r) return liveStarten(r, { campus: true });
  }
  zeichnen();
}

async function laden() {
  try { z.runden = (await lyra.speicher.liste('runde')).map((e) => e.wert).filter(Boolean).sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0)); } catch (_) { z.runden = []; }
  try { z.auswertungen = (await lyra.speicher.liste('auswertung')).map((e) => e.wert).filter(Boolean).sort((a, b) => b.zeit - a.zeit); } catch (_) { z.auswertungen = []; }
}

async function rundeSichern(r) {
  r.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('runde/' + r.id, r); } catch (e) { lyra.toast(meldung(e), 'fehler'); }
  const i = z.runden.findIndex((x) => x.id === r.id);
  if (i >= 0) z.runden[i] = r; else z.runden.unshift(r);
}

async function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'mitmachen') return lyra.zurueck();
  if (z.live) {
    const ok = await lyra.bestaetigen({ titel: 'Runde beenden?', text: 'Alle werden abgemeldet. Die Ergebnisse werden zusammengefasst gespeichert.', ja: 'Beenden', nein: 'Weiter', gefahr: true });
    if (ok) await liveBeenden();
    return;
  }
  if (z.ansicht === 'erstellen') { lyra.abbrechen(); return; }
  if (z.ansicht !== 'start') { z.ansicht = 'start'; z.runde = null; z.auswertung = null; return zeichnen(); }
  lyra.zurueck();
}

// ================================================================== Items prüfen (KI und Editor)

/** Bezeichnungen, die eine KI statt der Kennung schreiben könnte */
const ART_NAMEN = {
  umfrage: 'umfrage', abstimmung: 'umfrage', auswahl: 'umfrage', poll: 'umfrage', multiplechoice: 'umfrage', choice: 'umfrage', quiz: 'umfrage', wissensfrage: 'umfrage', mehrfachauswahl: 'umfrage',
  skala: 'skala', scale: 'skala', bewertung: 'skala', rating: 'skala', likert: 'skala',
  wortwolke: 'wortwolke', wordcloud: 'wortwolke', woerter: 'wortwolke',
  freitext: 'freitext', offen: 'freitext', offenefrage: 'freitext', open: 'freitext', openended: 'freitext', text: 'freitext',
  schaetzen: 'schaetzen', schaetzfrage: 'schaetzen', schaetzung: 'schaetzen', estimate: 'schaetzen', zahl: 'schaetzen', number: 'schaetzen',
  rangfolge: 'rangfolge', ranking: 'rangfolge', reihenfolge: 'rangfolge', rang: 'rangfolge',
  ampel: 'ampel', verstaendnis: 'ampel', verstaendnisampel: 'ampel', trafficlight: 'ampel',
};
const artAus = (x) => {
  const k = String(x || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');
  return ARTEN[k] ? k : ART_NAMEN[k] || null;
};

function item(roh) {
  const a = { ...(roh || {}) };
  // Andere Feldnamen (z. B. von Claude oder ChatGPT) übernehmen
  if (!a.frage) a.frage = a.text || a.question || a.titel || a.title || '';
  if (!Array.isArray(a.optionen)) a.optionen = a.antworten || a.options || a.answers || a.auswahl || [];
  if (a.optionen.length && typeof a.optionen[0] === 'object') a.optionen = a.optionen.map((o) => (o && (o.text || o.option || o.antwort || o.label)) || '');
  if (!Array.isArray(a.richtig) && Number.isInteger(a.richtig)) a.richtig = [a.richtig];
  const art = artAus(a.art || a.typ || a.type || a.kind) || (a.optionen.length >= 2 ? 'umfrage' : 'freitext');
  const f = { id: a.id || lyra.neueId(), art, frage: text(a.frage).slice(0, 300) };
  if (!f.frage) return null;
  const optionen = (Array.isArray(a.optionen) ? a.optionen : []).map((o) => text(String(o == null ? '' : o)).slice(0, 120)).filter(Boolean);
  if (art === 'umfrage') {
    f.optionen = [...new Set(optionen)].slice(0, 8);
    if (f.optionen.length < 2) return null;
    f.mehrfach = !!a.mehrfach;
    f.richtig = (Array.isArray(a.richtig) ? a.richtig : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < f.optionen.length);
    if (!f.mehrfach && f.richtig.length > 1) f.richtig = f.richtig.slice(0, 1);
  } else if (art === 'rangfolge') {
    f.optionen = [...new Set(optionen)].slice(0, 7);
    if (f.optionen.length < 3) return null;
  } else if (art === 'skala') {
    let min = Number.isInteger(a.min) ? a.min : 1;
    let max = Number.isInteger(a.max) ? a.max : 5;
    min = Math.max(0, Math.min(1, min));
    max = Math.max(min + 2, Math.min(10, max));
    Object.assign(f, { min, max, links: text(a.links).slice(0, 40), rechts: text(a.rechts).slice(0, 40) });
  } else if (art === 'wortwolke') {
    f.woerter = Math.max(1, Math.min(3, Number(a.woerter) || 3));
  } else if (art === 'schaetzen') {
    f.einheit = text(a.einheit).slice(0, 16);
    if ((a.wahr_bekannt || a.wahr_bekannt === undefined) && typeof a.wahr === 'number' && isFinite(a.wahr) && (a.wahr_bekannt || a.wahr !== 0)) f.wahr = a.wahr;
  }
  return f;
}

function rundeAus(roh) {
  return {
    id: lyra.neueId(), titel: text(roh.titel) || 'Neue Runde', anonym: roh.anonym !== false, wand: roh.wand !== false, teilen: roh.teilen !== false,
    items: (roh.items || []).map(item).filter(Boolean), erstellt: lyra.jetzt(),
  };
}

// ================================================================== Mit KI erstellen

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema) return;
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  z.ansicht = 'erstellen';
  z.fehler = null;
  z.hinweis = 'Suche passende Stellen …';
  zeichnen();
  let block = '';
  if (z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, z.lehrer === 'lyra' ? 6 : 10)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Unterlagen + Wissen“ oder „Allgemeinwissen“.';
      z.ansicht = 'start';
      return zeichnen();
    }
  }
  setHinweis('Fragen werden entworfen …');
  const zweck = ZWECKE[z.einst.zweck] || ZWECKE.vorlesung;
  let r = null;
  try {
    r = await lyra.ki({
      lehrer: z.lehrer,
      system: 'Du entwirfst kurze Live-Umfragen („Puls“) für eine Gruppe, die auf dem Handy mitmacht. Fragen sind kurz, klar und laden zum Mitmachen ein. ' +
        'Du mischst passende Arten und schreibst auf Deutsch. Antworte nur mit JSON nach dem Schema.',
      prompt: `Thema: ${thema}\nZweck: ${zweck[0]} – ${zweck[1]}\nAnzahl: genau ${Math.max(3, Math.min(12, z.einst.anzahl))} Einträge\n\n` +
        (block ? `Auszüge aus meinen Unterlagen (stütze dich darauf${z.einst.quelle === 'beides' ? ', ergänze mit Allgemeinwissen' : ''}):\n\n${block}\n\n` : '') +
        'Arten:\n' + Object.entries(ARTEN).map(([k, [n, u]]) => `- "${k}": ${n} – ${u}`).join('\n') + '\n\n' +
        'Regeln:\n- umfrage: 2–6 kurze "optionen"; "mehrfach" true, wenn mehrere passen; bei Wissensfragen in "richtig" die Indizes der richtigen Optionen (sonst []).\n' +
        '- skala: "min" 1 und "max" 5 (oder 0 und 10), "links"/"rechts" beschriften die Enden.\n- rangfolge: 3–6 "optionen" zum Ordnen.\n' +
        '- schaetzen: "einheit" (z. B. "km", "%", "Jahre"); ist der richtige Wert bekannt, "wahr_bekannt" true und "wahr" der Wert.\n' +
        '- wortwolke, freitext, ampel: nur die Frage.\n- Höchstens eine "ampel"; nie zweimal hintereinander dieselbe Art.\n' +
        'Alle Felder sind Pflicht – was eine Art nicht braucht, bleibt leer ("optionen": [], "richtig": [], "min": 0, "max": 0, "links": "", "rechts": "", "einheit": "", "mehrfach": false, "wahr_bekannt": false, "wahr": 0).\n\n' +
        'Antwort als JSON genau in diesem Aufbau (Feldnamen exakt so):\n' +
        '{"titel": "…", "items": [{"art": "umfrage", "frage": "…", "optionen": ["…", "…"], "mehrfach": false, "richtig": [], "min": 0, "max": 0, "links": "", "rechts": "", "einheit": "", "wahr_bekannt": false, "wahr": 0}]}',
      schema: SCHEMA,
      zaehlen: { schluessel: 'frage', wort: 'Frage' },
    }, (e) => { if (e.art === 'hinweis') setHinweis(e.text); });
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
  } catch (e) {
    if (abgebrochen(e)) { z.ansicht = 'start'; return zeichnen(); }
    z.fehler = meldung(e);
    z.ansicht = 'start';
    return zeichnen();
  }
  const j = (r && r.json) || {};
  // Liste der Fragen auch unter anderen Namen finden
  const roh = Array.isArray(j) ? j : j.items || j.fragen || j.umfragen || j.eintraege || j.questions || j.runde && (j.runde.items || j.runde.fragen) || Object.values(j).find((v) => Array.isArray(v) && v.length && typeof v[0] === 'object') || [];
  const runde = rundeAus({ titel: j.titel || j.title || thema, items: roh, anonym: true, wand: true, teilen: true });
  if (runde.items.length < 2) {
    z.fehler = 'Die Runde ist nicht gelungen – bitte nochmal versuchen.';
    z.ansicht = 'start';
    return zeichnen();
  }
  await rundeSichern(runde);
  z.thema = '';
  z.runde = runde;
  z.ansicht = 'bearbeiten';
  lyra.toast(`✓ ${runde.items.length} Fragen – sieh sie dir an, bevor es losgeht`, 'ok');
  zeichnen();
}

function setHinweis(t) {
  z.hinweis = t;
  const el = document.getElementById('hinweis');
  if (el) el.textContent = t;
}

// ================================================================== Live

function liveStarten(runde, { campus = false } = {}) {
  const L = {
    runde: structuredClone(runde),
    i: -1,
    offen: false,
    zeigen: true,
    aufgeloest: new Set(),
    antworten: new Map(), // item-id → Map(person → wert)
    themen: {}, // item-id → [{titel, anzahl, beispiel}]
    themenLaeuft: false,
    wand: [], // {id, text, von, name, stimmen: Set, beantwortet, zeit}
    wandZeigen: false,
    beitrittZeigen: false,
    beginn: lyra.jetzt(),
  };
  L.online = LyraOnline.runde({
    typ: TYP,
    anonym: () => L.runde.anonym,
    seitenTitel: () => L.runde.titel,
    teilen: () => ({ titel: `Puls: ${L.runde.titel}`, beschreibung: 'Live-Umfrage – öffnen und mitmachen', daten: { runde: L.runde.id, titel: L.runde.titel } }),
    neuZeichnen: () => bald(),
    beiDazu: (p) => {
      if (p.quelle === 'campus') L.online.stand(zustand(), zustand(true));
      else { L.online.anEinen(p, zustand(true)); if (L.runde.wand) L.online.anEinen(p, wandNachricht()); }
      L.online.anEinen(p, meins(p));
    },
    beiCampus: () => { L.online.anAlle({ typ: 'hallo' }); L.online.stand(zustand(), zustand(true)); },
    beiNachricht: eingang,
  });
  z.live = L;
  z.ansicht = 'live';
  if (campus && z.kontext) { L.online.campusUebernehmen(z.kontext); L.online.anAlle({ typ: 'hallo' }); }
  zeichnen();
  L.online.oeffnen({ titel: L.runde.titel });
}

const aktuelles = () => (z.live && z.live.i >= 0 ? z.live.runde.items[z.live.i] : null);

/** Was ein Gerät sehen darf (ohne Lösung, solange nicht aufgelöst) */
function oeffentlich(it) {
  if (!it) return null;
  const o = { id: it.id, art: it.art, frage: it.frage };
  if (it.optionen) o.optionen = it.optionen;
  if (it.art === 'umfrage') o.mehrfach = !!it.mehrfach;
  if (it.art === 'skala') Object.assign(o, { min: it.min, max: it.max, links: it.links, rechts: it.rechts });
  if (it.art === 'wortwolke') o.woerter = it.woerter;
  if (it.art === 'schaetzen') o.einheit = it.einheit;
  return o;
}

function zustand(fuerGaeste = false) {
  const L = z.live;
  const it = aktuelles();
  const d = { typ: 'zustand', titel: L.runde.titel, anonym: L.runde.anonym, wand: L.runde.wand, item: oeffentlich(it), offen: L.offen, nr: L.i + 1, von: L.runde.items.length };
  if (it && L.runde.teilen && L.zeigen) {
    const e = auswerten(it);
    // In den Campus-Raum nur Zusammengefasstes (keine Liste aller Texte)
    if (!fuerGaeste && e && e.texte) e.texte = e.texte.slice(0, 8);
    d.ergebnis = e;
  }
  return d;
}

function wandNachricht() {
  const L = z.live;
  return { typ: 'wand', fragen: L.wand.slice(-80).map((f) => ({ id: f.id, text: f.text, stimmen: f.stimmen.size, beantwortet: f.beantwortet, zeit: f.zeit, name: L.runde.anonym ? '' : f.name })) };
}

function meins(p) {
  const L = z.live;
  const antworten = {};
  for (const [id, m] of L.antworten) if (m.has(p.id)) antworten[id] = m.get(p.id);
  return { typ: 'meins', antworten, stimmen: L.wand.filter((f) => f.stimmen.has(p.id)).map((f) => f.id) };
}

function melden() {
  const L = z.live;
  if (!L) return;
  L.online.stand(zustand(), zustand(true));
}

function sofortMelden() {
  const L = z.live;
  if (!L) return;
  L.online.anAlle(zustand(), zustand(true));
}

function gueltig(it, w) {
  switch (it.art) {
    case 'umfrage':
      return Array.isArray(w) && w.length >= 1 && (it.mehrfach || w.length === 1) && new Set(w).size === w.length && w.every((i) => Number.isInteger(i) && i >= 0 && i < it.optionen.length);
    case 'skala': return Number.isInteger(w) && w >= it.min && w <= it.max;
    case 'wortwolke': return Array.isArray(w) && w.length >= 1 && w.length <= 3 && w.every((x) => typeof x === 'string' && x.trim().length >= 1 && x.length <= 30);
    case 'freitext': return typeof w === 'string' && w.trim().length >= 1 && w.length <= 280;
    case 'schaetzen': return typeof w === 'number' && isFinite(w) && Math.abs(w) < 1e15;
    case 'rangfolge': return Array.isArray(w) && w.length === it.optionen.length && new Set(w).size === w.length && w.every((i) => Number.isInteger(i) && i >= 0 && i < it.optionen.length);
    case 'ampel': return ['gruen', 'gelb', 'rot'].includes(w);
    default: return false;
  }
}

function eingang(p, d) {
  const L = z.live;
  if (!L) return;
  if (d.typ === 'antwort') {
    const it = L.runde.items.find((x) => x.id === d.item);
    if (!it || it !== aktuelles() || !L.offen || !gueltig(it, d.wert)) return;
    let m = L.antworten.get(it.id);
    if (!m) { m = new Map(); L.antworten.set(it.id, m); }
    if (it.art === 'freitext') {
      const l = m.get(p.id) || [];
      if (l.length >= 5) return;
      m.set(p.id, l.concat([d.wert.trim()]));
    } else if (it.art === 'wortwolke') {
      m.set(p.id, d.wert.map((x) => x.trim().replace(/\s+/g, ' ')));
    } else m.set(p.id, d.wert);
    melden();
    bald();
  } else if (d.typ === 'frage' && L.runde.wand) {
    const t = typeof d.text === 'string' ? d.text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 240) : '';
    if (!t || L.wand.filter((f) => f.von === p.id).length >= 10 || L.wand.length >= 300) return;
    L.wand.push({ id: lyra.neueId(), text: t, von: p.id, name: p.name === 'Gast' ? '' : p.name, stimmen: new Set(), beantwortet: false, zeit: Date.now() });
    L.online.stand(wandNachricht());
    bald();
  } else if (d.typ === 'stimme') {
    const f = L.wand.find((x) => x.id === d.frage);
    if (!f || f.beantwortet) return;
    if (d.an) f.stimmen.add(p.id); else f.stimmen.delete(p.id);
    L.online.stand(wandNachricht());
    bald();
  } else if (d.typ === 'name' && !L.runde.anonym) {
    for (const f of L.wand) if (f.von === p.id) f.name = p.name;
  }
}

function auswerten(it) {
  const L = z.live;
  const m = L.antworten.get(it.id) || new Map();
  return berechnen(it, [...m.values()], { richtig: L.aufgeloest.has(it.id), themen: L.themen[it.id] });
}

/** Ergebnis aus allen Antworten (auch für gespeicherte Auswertungen) */
function berechnen(it, werte, { richtig = false, themen = null } = {}) {
  const n = werte.length;
  if (it.art === 'umfrage') {
    const zaehler = it.optionen.map(() => 0);
    for (const w of werte) for (const i of w) zaehler[i]++;
    return { n, zaehler, richtig: richtig && it.richtig && it.richtig.length ? it.richtig : null };
  }
  if (it.art === 'skala') {
    const zaehler = {};
    let summe = 0;
    for (const w of werte) { zaehler[w] = (zaehler[w] || 0) + 1; summe += w; }
    return { n, zaehler, schnitt: n ? summe / n : null };
  }
  if (it.art === 'wortwolke') {
    const haeufig = new Map();
    for (const w of werte) {
      for (const x of new Set(w.map((s) => s.toLowerCase()))) {
        const e = haeufig.get(x) || { n: 0, formen: new Map() };
        e.n++;
        const form = w.find((s) => s.toLowerCase() === x);
        e.formen.set(form, (e.formen.get(form) || 0) + 1);
        haeufig.set(x, e);
      }
    }
    const woerter = [...haeufig.values()].map((e) => [[...e.formen.entries()].sort((a, b) => b[1] - a[1])[0][0], e.n]).sort((a, b) => b[1] - a[1]).slice(0, 40);
    return { n, woerter };
  }
  if (it.art === 'freitext') {
    const alle = werte.flat();
    return { n: alle.length, texte: alle.slice(-60).reverse(), themen: themen || null };
  }
  if (it.art === 'schaetzen') {
    const s = werte.slice().sort((a, b) => a - b);
    if (!n) return { n };
    const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const schnitt = s.reduce((a, b) => a + b, 0) / n;
    // Ausreißer nicht die Grafik bestimmen lassen: 5 %- bis 95 %-Bereich (plus richtiger Wert)
    let von = s[Math.floor((n - 1) * 0.05)];
    let bis = s[Math.ceil((n - 1) * 0.95)];
    if (richtig && it.wahr != null) { von = Math.min(von, it.wahr); bis = Math.max(bis, it.wahr); }
    if (von === bis) { von -= 1; bis += 1; }
    const k = 12;
    const eimer = new Array(k).fill(0);
    for (const v of s) eimer[Math.max(0, Math.min(k - 1, Math.floor(((v - von) / (bis - von)) * k)))]++;
    return { n, median, schnitt, von, bis, eimer, wahr: richtig && it.wahr != null ? it.wahr : null };
  }
  if (it.art === 'rangfolge') {
    const k = it.optionen.length;
    const summe = new Array(k).fill(0);
    for (const w of werte) w.forEach((opt, pos) => { summe[opt] += pos + 1; });
    const platz = summe.map((x) => (n ? x / n : (k + 1) / 2));
    return { n, platz, reihenfolge: platz.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) };
  }
  if (it.art === 'ampel') {
    const e = { n, gruen: 0, gelb: 0, rot: 0 };
    for (const w of werte) e[w]++;
    return e;
  }
  return { n };
}

function gehe(i) {
  const L = z.live;
  if (!L) return;
  i = Math.max(-1, Math.min(L.runde.items.length - 1, i));
  L.i = i;
  L.offen = i >= 0;
  L.zeigen = !L.runde.verdeckt;
  sofortMelden();
  zeichnen();
}

function umschalten(was) {
  const L = z.live;
  const it = aktuelles();
  if (!it) return;
  if (was === 'offen') L.offen = !L.offen;
  if (was === 'zeigen') L.zeigen = !L.zeigen;
  if (was === 'aufloesen') { if (L.aufgeloest.has(it.id)) L.aufgeloest.delete(it.id); else { L.aufgeloest.add(it.id); L.zeigen = true; } }
  sofortMelden();
  zeichnen();
}

async function themenFinden() {
  const L = z.live;
  const it = aktuelles();
  if (!it || it.art !== 'freitext' || L.themenLaeuft) return;
  const texte = [...(L.antworten.get(it.id) || new Map()).values()].flat();
  if (texte.length < 3) return lyra.toast('Erst ab drei Antworten.', '');
  L.themenLaeuft = true;
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: 'Du fasst anonyme Antworten einer Gruppe zu wenigen Themen zusammen. Kurz, neutral, ohne Bewertung. Deutsch. Nur JSON.',
      prompt: `Frage: ${it.frage}\n\nAntworten (eine je Zeile):\n${texte.slice(-200).map((t) => '- ' + t.replace(/\n/g, ' ')).join('\n')}\n\n` +
        'Fasse sie zu 2 bis 6 Themen zusammen. Je Thema: kurzer "titel" (2–5 Wörter), "anzahl" (wie viele Antworten dazu passen), "beispiel" (eine typische Antwort, wörtlich und kurz). Größte Themen zuerst.\n\n' +
        'Antwort als JSON genau in diesem Aufbau: {"themen": [{"titel": "…", "anzahl": 3, "beispiel": "…"}]}',
      schema: { type: 'object', additionalProperties: false, required: ['themen'], properties: { themen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titel', 'anzahl', 'beispiel'], properties: { titel: { type: 'string' }, anzahl: { type: 'integer' }, beispiel: { type: 'string' } } } } } },
    });
    const t = ((r && r.json && (r.json.themen || r.json.topics || r.json.gruppen)) || []).map((x) => ({ titel: text(x.titel).slice(0, 60), anzahl: Math.max(0, Math.min(texte.length, Number(x.anzahl) || 0)), beispiel: text(x.beispiel).slice(0, 140) })).filter((x) => x.titel).slice(0, 6);
    if (t.length) { L.themen[it.id] = t; sofortMelden(); }
  } catch (e) {
    if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
  }
  L.themenLaeuft = false;
  zeichnen();
}

async function liveBeenden() {
  const L = z.live;
  if (!L) return;
  const a = {
    id: lyra.neueId(), runde: L.runde.id, titel: L.runde.titel, zeit: lyra.jetzt(), beginn: L.beginn,
    teilnehmer: L.online.teilnehmer.size,
    items: L.runde.items.map((it) => ({ item: it, ergebnis: berechnen(it, [...(L.antworten.get(it.id) || new Map()).values()], { richtig: true, themen: L.themen[it.id] }) })).filter((x) => x.ergebnis.n > 0),
    // Nur der Text und die Stimmen – keine Namen
    wand: L.wand.map((f) => ({ text: f.text, stimmen: f.stimmen.size, beantwortet: f.beantwortet })).sort((x, y) => y.stimmen - x.stimmen),
  };
  // Für die Auswertung reichen 60 Texte je offener Frage
  for (const x of a.items) if (x.ergebnis.texte) x.ergebnis.alleTexte = [...(L.antworten.get(x.item.id) || new Map()).values()].flat();
  await L.online.beenden({ typ: 'ende' });
  z.live = null;
  if (a.items.length || a.wand.length) {
    try { await lyra.speicher.schreiben('auswertung/' + a.id, a); } catch (_) {}
    z.auswertungen.unshift(a);
    z.auswertung = a;
    z.ansicht = 'auswertung';
  } else {
    z.ansicht = 'start';
  }
  zeichnen();
}

// ================================================================== Mitmachen in Lyra (aus einem Campus-Raum)

async function mitmachen(k) {
  z.ansicht = 'mitmachen';
  app.replaceChildren();
  await LyraOnline.mitmachen(k, {
    wurzel: app,
    was: 'Deine Antworten in der Live-Umfrage',
    erstellen: (w, { senden, ich, inLyra }) => PulsAnsicht.erstellen(w, { senden, ich, inLyra }),
  });
}

// ================================================================== Export

function markdown(a) {
  const z2 = [`# ${a.titel}`, '', `${new Date(a.zeit).toLocaleString('de-DE')} · ${a.teilnehmer} Teilnehmende`, ''];
  a.items.forEach(({ item: it, ergebnis: e }, n) => {
    z2.push(`## ${n + 1}. ${it.frage}`, `*${ARTEN[it.art][0]} · ${e.n} Antworten*`, '');
    if (it.art === 'umfrage') it.optionen.forEach((o, i) => z2.push(`- ${it.richtig && it.richtig.includes(i) ? '✓ ' : ''}${o}: ${e.zaehler[i]} (${e.n ? Math.round((e.zaehler[i] / e.n) * 100) : 0} %)`));
    if (it.art === 'skala') { z2.push(`Durchschnitt: **${fmt(e.schnitt)}** (${it.min} = ${it.links || '–'}, ${it.max} = ${it.rechts || '–'})`, ''); for (let v = it.min; v <= it.max; v++) z2.push(`- ${v}: ${e.zaehler[v] || 0}`); }
    if (it.art === 'wortwolke') z2.push(e.woerter.map(([w, c]) => `${w} (${c})`).join(' · '));
    if (it.art === 'freitext') {
      if (e.themen && e.themen.length) { z2.push('**Themen**', ''); e.themen.forEach((t) => z2.push(`- ${t.titel} (${t.anzahl}) – „${t.beispiel}“`)); z2.push(''); }
      z2.push('**Antworten**', ''); (e.alleTexte || e.texte).forEach((t) => z2.push(`- ${t.replace(/\n/g, ' ')}`));
    }
    if (it.art === 'schaetzen') z2.push(`Median **${fmt(e.median)}**, Durchschnitt ${fmt(e.schnitt)}${it.einheit ? ' ' + it.einheit : ''}${it.wahr != null ? ` – richtig: ${fmt(it.wahr)}` : ''}`);
    if (it.art === 'rangfolge') e.reihenfolge.forEach((i, p) => z2.push(`${p + 1}. ${it.optionen[i]} (Ø Platz ${fmt(e.platz[i])})`));
    if (it.art === 'ampel') z2.push(`- Grün (alles klar): ${e.gruen}`, `- Gelb (geht so): ${e.gelb}`, `- Rot (raus): ${e.rot}`);
    z2.push('');
  });
  if (a.wand.length) { z2.push('## Fragenwand', ''); a.wand.forEach((f) => z2.push(`- ${f.beantwortet ? '✓ ' : ''}${f.text} (${f.stimmen} Stimmen)`)); }
  return z2.join('\n');
}

function csv(a) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const zeilen = [['Nr', 'Frage', 'Art', 'Antwort', 'Anzahl'].join(';')];
  a.items.forEach(({ item: it, ergebnis: e }, n) => {
    const zeile = (antwort, anzahl) => zeilen.push([n + 1, q(it.frage), q(ARTEN[it.art][0]), q(antwort), anzahl].join(';'));
    if (it.art === 'umfrage') it.optionen.forEach((o, i) => zeile(o, e.zaehler[i]));
    else if (it.art === 'skala') for (let v = it.min; v <= it.max; v++) zeile(v, e.zaehler[v] || 0);
    else if (it.art === 'wortwolke') e.woerter.forEach(([w, c]) => zeile(w, c));
    else if (it.art === 'freitext') (e.alleTexte || e.texte).forEach((t) => zeile(t, 1));
    else if (it.art === 'schaetzen') { zeile('Median', fmt(e.median)); zeile('Durchschnitt', fmt(e.schnitt)); }
    else if (it.art === 'rangfolge') e.reihenfolge.forEach((i) => zeile(it.optionen[i], fmt(e.platz[i])));
    else if (it.art === 'ampel') AMPEL.forEach(([k, name]) => zeile(name, e[k]));
  });
  return '﻿' + zeilen.join('\n');
}

// ================================================================== Ansichten

let baldTakt = null;
/** Neu zeichnen, höchstens alle 250 ms (viele Antworten auf einmal) */
function bald() {
  if (baldTakt) return;
  baldTakt = setTimeout(() => { baldTakt = null; if (z.ansicht === 'live') zeichnen(); }, 250);
}

function zeichnen() {
  if (z.ansicht === 'mitmachen') return;
  const ansicht = { start: startAnsicht, erstellen: erstellenAnsicht, bearbeiten: bearbeitenAnsicht, live: liveAnsicht, auswertung: auswertungsAnsicht }[z.ansicht] || startAnsicht;
  const scroll = app.scrollTop;
  app.replaceChildren(h('div', { class: 'buehne' + (z.ansicht === 'live' ? ' leinwand' : '') }, ansicht()));
  if (z.ansicht === 'live' || z.ansicht === 'bearbeiten') app.scrollTop = scroll;
}

function pille(titel, optionen, schluessel) {
  return lyra.auswahl({ titel, optionen, wert: z.einst[schluessel], beiWahl: (w) => { z.einst[schluessel] = isNaN(Number(w)) ? w : Number(w); zeichnen(); } });
}

function artenText(r) {
  return [...new Set(r.items.map((i) => ARTEN[i.art][0]))].join(', ');
}

function startAnsicht() {
  const k = z.kontext;
  const leite = k && k.inhalt && k.inhalt.typ === TYP;
  return [
    h('div', { class: 'kopfbereich' },
      h('div', { class: 'logo' }, h('span', { class: 'logo-puls' }), 'Puls'),
      h('p', { class: 'slogan' }, 'Live-Umfragen und Fragenwand – alle machen auf dem Handy mit, du siehst sofort, wo die Gruppe steht.')),
    leite ? h('div', { class: 'hinweis-band' }, `Live in „${k.raum.name}“: Wähle unten eine Runde – die Mitglieder machen mit ihrer Lyra mit.`) : null,
    h('div', { class: 'panel' },
      h('h2', {}, 'Neue Runde mit KI'),
      h('div', { class: 'zeile', style: { gap: '10px' } },
        h('input', { class: 'eingabe wachsen', placeholder: 'Thema, z. B. „Thermodynamik, Kapitel 3“ oder „Projektstart“', value: z.thema,
          oninput: (e) => { z.thema = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') erstellen(); } }),
        h('button', { class: 'knopf', onclick: erstellen }, 'Erstellen')),
      h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '12px' } },
        pille('Wofür', Object.entries(ZWECKE).map(([k2, [n, u]]) => [k2, n, u]), 'zweck'),
        pille('Fragen', [[3, '3'], [5, '5'], [7, '7'], [10, '10']], 'anzahl'),
        pille('Woraus', [['beides', 'Unterlagen + Wissen'], ['unterlagen', 'Nur Unterlagen'], ['wissen', 'Allgemeinwissen']], 'quelle'),
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null),
      z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
      h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '14px' } },
        h('span', { class: 'leise klein' }, 'Oder schnell starten:'),
        VORLAGEN.map((v) => h('button', { class: 'chip-knopf', onclick: async () => { const r = rundeAus(structuredClone(v)); await rundeSichern(r); z.runde = r; z.ansicht = 'bearbeiten'; zeichnen(); } }, v.titel)),
        h('button', { class: 'chip-knopf', onclick: neueLeereRunde }, '+ Leer'))),
    h('h2', { class: 'zwischen' }, 'Deine Runden'),
    z.runden.length
      ? h('div', { class: 'liste' }, z.runden.map((r) => h('div', { class: 'runden-zeile' },
        h('div', { class: 'wachsen klickbar', onclick: () => { z.runde = r; z.ansicht = 'bearbeiten'; zeichnen(); } },
          h('div', { class: 'runden-titel' }, r.titel),
          h('div', { class: 'leise klein' }, `${r.items.length} Fragen · ${artenText(r)}${r.anonym ? ' · anonym' : ''}${r.wand ? ' · Fragenwand' : ''}`)),
        h('button', { class: 'knopf tonal', title: 'Bearbeiten', onclick: () => { z.runde = r; z.ansicht = 'bearbeiten'; zeichnen(); } }, '✎'),
        h('button', { class: 'knopf tonal', title: 'Löschen', onclick: () => rundeLoeschen(r) }, '✕'),
        h('button', { class: 'knopf', disabled: !r.items.length, onclick: () => liveStarten(r, { campus: leite }) }, 'Live starten'))))
      : h('p', { class: 'leise' }, 'Noch keine Runden – erstelle oben die erste.'),
    z.auswertungen.length ? h('h2', { class: 'zwischen' }, 'Auswertungen') : null,
    z.auswertungen.length ? h('div', { class: 'liste' }, z.auswertungen.slice(0, 12).map((a) => h('div', { class: 'runden-zeile klickbar', onclick: () => { z.auswertung = a; z.ansicht = 'auswertung'; zeichnen(); } },
      h('div', { class: 'wachsen' },
        h('div', { class: 'runden-titel' }, a.titel),
        h('div', { class: 'leise klein' }, `${lyra.zeitText(a.zeit)} · ${a.teilnehmer} Teilnehmende · ${a.items.length} Fragen${a.wand.length ? ` · ${a.wand.length} Fragen an der Wand` : ''}`)),
      h('span', { class: 'leise' }, '›')))) : null,
  ];
}

async function rundeLoeschen(r) {
  const ok = await lyra.bestaetigen({ titel: `„${r.titel}“ löschen?`, text: 'Die Runde verschwindet (Auswertungen bleiben).', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('runde/' + r.id); } catch (_) {}
  z.runden = z.runden.filter((x) => x.id !== r.id);
  zeichnen();
}

async function neueLeereRunde() {
  const r = rundeAus({ titel: z.thema.trim() || 'Neue Runde', items: [] });
  z.thema = '';
  await rundeSichern(r);
  z.runde = r;
  z.ansicht = 'bearbeiten';
  zeichnen();
}

function erstellenAnsicht() {
  return h('div', { class: 'mitte', style: { marginTop: '60px' } },
    h('div', { class: 'lade gross' }),
    h('h2', {}, 'Die Runde wird entworfen …'),
    h('p', { class: 'leise', id: 'hinweis' }, z.hinweis),
    h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

// ---------------------------------------------------------------- Editor

function kurz(it) {
  if (it.art === 'umfrage') return it.optionen.map((o, i) => (it.richtig && it.richtig.includes(i) ? '✓ ' : '') + o).join(' · ') + (it.mehrfach ? ' (mehrere)' : '');
  if (it.art === 'rangfolge') return it.optionen.join(' · ');
  if (it.art === 'skala') return `${it.min} ${it.links ? `(${it.links})` : ''} bis ${it.max} ${it.rechts ? `(${it.rechts})` : ''}`;
  if (it.art === 'wortwolke') return `bis zu ${it.woerter} ${it.woerter === 1 ? 'Wort' : 'Wörter'}`;
  if (it.art === 'schaetzen') return (it.einheit ? `in ${it.einheit}` : 'eine Zahl') + (it.wahr != null ? ` · richtig: ${fmt(it.wahr)}` : '');
  if (it.art === 'freitext') return 'freie Antworten · KI fasst zu Themen zusammen';
  if (it.art === 'ampel') return 'Grün · Gelb · Rot';
  return '';
}

function bearbeitenAnsicht() {
  const r = z.runde;
  const sichern = () => rundeSichern(r);
  const schalter = (titel, unter, schluessel) => h('label', { class: 'schalter-zeile' },
    h('input', { type: 'checkbox', checked: !!r[schluessel], onchange: (e) => { r[schluessel] = e.target.checked; sichern(); zeichnen(); } }),
    h('div', {}, h('div', { class: 'fett' }, titel), h('div', { class: 'leise klein' }, unter)));
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '14px' } },
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'start'; z.runde = null; zeichnen(); } }, '←'),
      h('input', { class: 'eingabe wachsen titel-eingabe', value: r.titel, oninput: (e) => { r.titel = e.target.value; }, onchange: sichern }),
      h('button', { class: 'knopf', disabled: !r.items.length, onclick: () => liveStarten(r, { campus: !!(z.kontext && z.kontext.inhalt && z.kontext.inhalt.typ === TYP) }) }, 'Live starten')),
    h('div', { class: 'panel einstellungen' },
      schalter('Anonym', 'Niemand wird nach dem Namen gefragt; die Leinwand zeigt keine Namen.', 'anonym'),
      schalter('Fragenwand', 'Alle können Fragen stellen und für Fragen anderer stimmen.', 'wand'),
      schalter('Ergebnisse auf den Handys', 'Wenn du ein Ergebnis zeigst, sehen es alle auch auf ihrem Gerät.', 'teilen'),
      schalter('Ergebnis erst verdeckt', 'Neue Fragen starten mit verdecktem Ergebnis – so beeinflusst niemand die anderen.', 'verdeckt')),
    h('h2', { class: 'zwischen' }, `Fragen (${r.items.length})`),
    h('div', { class: 'liste' }, r.items.map((it, i) => h('div', { class: 'item-karte', onclick: () => itemBearbeiten(i) },
      h('span', { class: 'nr' }, String(i + 1)),
      h('div', { class: 'wachsen', style: { minWidth: '0' } },
        h('div', { class: 'art-marke' }, ARTEN[it.art][0]),
        h('div', { class: 'fett' }, it.frage),
        h('div', { class: 'leise klein item-kurz' }, kurz(it))),
      h('div', { class: 'spalte', style: { gap: '4px' } },
        h('button', { class: 'knopf text klein', title: 'Nach oben', disabled: i === 0, onclick: (e) => { e.stopPropagation(); [r.items[i - 1], r.items[i]] = [r.items[i], r.items[i - 1]]; sichern(); zeichnen(); } }, '▲'),
        h('button', { class: 'knopf text klein', title: 'Nach unten', disabled: i === r.items.length - 1, onclick: (e) => { e.stopPropagation(); [r.items[i + 1], r.items[i]] = [r.items[i], r.items[i + 1]]; sichern(); zeichnen(); } }, '▼')),
      h('button', { class: 'knopf text', title: 'Löschen', onclick: (e) => { e.stopPropagation(); r.items.splice(i, 1); sichern(); zeichnen(); } }, '✕')))),
    h('div', { class: 'neu-leiste' }, Object.entries(ARTEN).map(([a, [n, u]]) => h('button', { class: 'chip-knopf', title: u, onclick: () => itemBearbeiten(null, a) }, '+ ' + n))),
  ];
}

async function itemBearbeiten(i, neueArt) {
  const r = z.runde;
  const alt = i == null ? null : r.items[i];
  const f = {
    art: alt ? alt.art : neueArt || 'umfrage',
    frage: alt ? alt.frage : '',
    optionen: alt && alt.optionen ? alt.optionen.slice() : ['', '', ''],
    mehrfach: alt ? !!alt.mehrfach : false,
    richtig: alt && alt.richtig ? alt.richtig.slice() : [],
    min: alt && alt.min != null ? alt.min : 1, max: alt && alt.max != null ? alt.max : 5,
    links: alt ? alt.links || '' : '', rechts: alt ? alt.rechts || '' : '',
    woerter: alt && alt.woerter ? alt.woerter : 3,
    einheit: alt ? alt.einheit || '' : '',
    wahr: alt && alt.wahr != null ? String(alt.wahr) : '',
  };
  const box = h('div', { class: 'spalte editor', style: { minWidth: '540px', gap: '10px' } });
  const feld = (wert, platz, aendern, extra = {}) => h('input', { class: 'eingabe', value: wert, placeholder: platz, oninput: (e) => aendern(e.target.value), ...extra });
  const malen = () => {
    const a = f.art;
    const teile = [
      lyra.auswahl({ titel: 'Art', optionen: Object.entries(ARTEN).map(([k2, [n, u]]) => [k2, n, u]), wert: a, beiWahl: (w) => { f.art = w; if (w === 'rangfolge' && f.optionen.length < 3) f.optionen.push(''); malen(); }, breit: true }),
      h('textarea', { class: 'eingabe', rows: 2, placeholder: 'Die Frage', value: f.frage, oninput: (e) => { f.frage = e.target.value; } }),
    ];
    if (a === 'umfrage' || a === 'rangfolge') {
      teile.push(h('div', { class: 'leise klein' }, a === 'umfrage' ? 'Optionen – ✓ markiert richtige Antworten (optional, für Wissensfragen)' : 'Optionen zum Ordnen'));
      f.optionen.forEach((o, j) => teile.push(h('div', { class: 'zeile', style: { gap: '8px' } },
        a === 'umfrage' ? h('button', { class: 'richtig-wahl' + (f.richtig.includes(j) ? ' an' : ''), title: 'Richtig', onclick: () => {
          if (f.richtig.includes(j)) f.richtig = f.richtig.filter((x) => x !== j);
          else f.richtig = f.mehrfach ? f.richtig.concat([j]) : [j];
          malen();
        } }, f.richtig.includes(j) ? '✓' : String.fromCharCode(65 + j)) : h('span', { class: 'nr' }, String(j + 1)),
        feld(o, `Option ${j + 1}`, (v) => { f.optionen[j] = v; }, { class: 'eingabe wachsen' }),
        h('button', { class: 'knopf text', disabled: f.optionen.length <= (a === 'umfrage' ? 2 : 3), onclick: () => { f.optionen.splice(j, 1); f.richtig = f.richtig.filter((x) => x !== j).map((x) => (x > j ? x - 1 : x)); malen(); } }, '✕'))));
      if (f.optionen.length < (a === 'umfrage' ? 8 : 7)) teile.push(h('button', { class: 'knopf text', onclick: () => { f.optionen.push(''); malen(); } }, '+ Option'));
      if (a === 'umfrage') teile.push(h('label', { class: 'zeile', style: { gap: '8px' } }, h('input', { type: 'checkbox', checked: f.mehrfach, onchange: (e) => { f.mehrfach = e.target.checked; if (!f.mehrfach) f.richtig = f.richtig.slice(0, 1); malen(); } }), 'Mehrere Antworten erlaubt'));
    }
    if (a === 'skala') {
      teile.push(h('div', { class: 'zeile', style: { gap: '8px' } },
        lyra.auswahl({ titel: 'Von', optionen: [[0, '0'], [1, '1']], wert: f.min, beiWahl: (w) => { f.min = Number(w); } }),
        lyra.auswahl({ titel: 'Bis', optionen: [[3, '3'], [4, '4'], [5, '5'], [7, '7'], [10, '10']], wert: f.max, beiWahl: (w) => { f.max = Number(w); } })),
      h('div', { class: 'zeile', style: { gap: '8px' } }, feld(f.links, 'Beschriftung links, z. B. „gar nicht“', (v) => { f.links = v; }, { class: 'eingabe wachsen' }), feld(f.rechts, 'rechts, z. B. „sehr“', (v) => { f.rechts = v; }, { class: 'eingabe wachsen' })));
    }
    if (a === 'wortwolke') teile.push(lyra.auswahl({ titel: 'Wörter je Person', optionen: [[1, '1'], [2, '2'], [3, '3']], wert: f.woerter, beiWahl: (w) => { f.woerter = Number(w); } }));
    if (a === 'schaetzen') {
      teile.push(h('div', { class: 'zeile', style: { gap: '8px' } },
        feld(f.einheit, 'Einheit (optional), z. B. „km“', (v) => { f.einheit = v; }, { class: 'eingabe wachsen' }),
        feld(f.wahr, 'Richtiger Wert (optional)', (v) => { f.wahr = v; }, { class: 'eingabe wachsen', inputmode: 'decimal' })));
    }
    if (a === 'freitext') teile.push(h('p', { class: 'leise klein' }, 'Jede Person kann bis zu fünf Antworten schicken. Auf der Leinwand fasst die KI sie auf Wunsch zu Themen zusammen.'));
    if (a === 'ampel') teile.push(h('p', { class: 'leise klein' }, 'Alle wählen Grün, Gelb oder Rot – und können jederzeit wechseln, solange die Frage offen ist.'));
    box.replaceChildren(...teile);
  };
  malen();
  const ok = await lyra.dialog(alt ? 'Frage bearbeiten' : 'Neue Frage', box, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Übernehmen', wert: true }]);
  if (!ok) return;
  const w = f.wahr.trim() ? Number(f.wahr.replace(',', '.')) : null;
  const neu = item({ ...f, id: alt ? alt.id : undefined, wahr_bekannt: w != null && isFinite(w), wahr: w != null && isFinite(w) ? w : 0, optionen: f.optionen });
  if (!neu) return lyra.toast(f.art === 'umfrage' ? 'Bitte eine Frage und mindestens zwei Optionen.' : f.art === 'rangfolge' ? 'Bitte eine Frage und mindestens drei Optionen.' : 'Bitte gib eine Frage ein.', 'fehler');
  if (alt) r.items[i] = neu; else r.items.push(neu);
  await rundeSichern(r);
  zeichnen();
}

// ---------------------------------------------------------------- Leinwand

function liveAnsicht() {
  const L = z.live;
  const it = aktuelles();
  const n = L.online.aktiv().length;
  const offeneWand = L.wand.filter((f) => !f.beantwortet).length;
  const oben = h('div', { class: 'leiste-oben' },
    h('span', { class: 'live-punkt' }), h('b', { class: 'leinwand-titel' }, L.runde.titel),
    h('span', { class: 'wachsen' }),
    h('span', { class: 'pill' }, `${n} dabei`),
    h('button', { class: 'knopf tonal klein', onclick: () => { L.beitrittZeigen = !L.beitrittZeigen; zeichnen(); } }, L.beitrittZeigen ? 'QR ausblenden' : 'Beitreten'),
    L.runde.wand ? h('button', { class: 'knopf tonal klein' + (L.wandZeigen ? ' an' : ''), onclick: () => { L.wandZeigen = !L.wandZeigen; zeichnen(); } }, 'Fragenwand', offeneWand ? h('span', { class: 'zaehler' }, String(offeneWand)) : null) : null,
    h('button', { class: 'knopf text klein', onclick: () => zurueck() }, 'Beenden'));

  let haupt;
  if (!it) {
    haupt = h('div', { class: 'lobby' },
      h('h1', { class: 'lobby-titel' }, L.runde.titel),
      h('p', { class: 'leise lobby-unter' }, 'Scanne den QR-Code oder öffne den Link – mitmachen geht ohne App und ohne Konto.'),
      L.online.beitritt(),
      h('div', { class: 'lobby-fuss' },
        L.online.chips('Warte auf die Ersten …'),
        h('button', { class: 'knopf gross', disabled: !L.runde.items.length, onclick: () => gehe(0) }, 'Erste Frage zeigen →')));
  } else {
    const e = auswerten(it);
    const anzahl = e.n || 0;
    haupt = h('div', { class: 'item-buehne' },
      h('div', { class: 'item-kopf' },
        h('span', { class: 'pill' }, ARTEN[it.art][0]),
        h('span', { class: 'pill leise' }, `${L.i + 1} / ${L.runde.items.length}`),
        h('span', { class: 'wachsen' }),
        h('span', { class: 'antwort-zahl' + (L.offen ? ' offen' : '') }, h('b', {}, zahl(anzahl)), it.art === 'freitext' ? ' Antworten' : anzahl === 1 ? ' Stimme' : ' Stimmen', L.offen ? '' : ' · geschlossen')),
      h('h1', { class: 'frage-gross' }, it.frage),
      L.zeigen ? h('div', { class: 'ergebnis-flaeche' }, PulsAnsicht.ergebnis(it, e, { gross: true }))
        : h('div', { class: 'verdeckt' }, h('div', { class: 'verdeckt-zahl' }, zahl(anzahl)), h('div', { class: 'leise' }, 'Ergebnis verdeckt – zeig es, wenn alle abgestimmt haben')),
      h('div', { class: 'steuerung' },
        h('button', { class: 'knopf tonal', onclick: () => gehe(L.i - 1) }, '←'),
        h('button', { class: 'knopf tonal', onclick: () => umschalten('offen') }, L.offen ? 'Abstimmung schließen' : 'Wieder öffnen'),
        h('button', { class: 'knopf tonal', onclick: () => umschalten('zeigen') }, L.zeigen ? 'Ergebnis verdecken' : 'Ergebnis zeigen'),
        it.art === 'umfrage' && it.richtig && it.richtig.length ? h('button', { class: 'knopf tonal', onclick: () => umschalten('aufloesen') }, L.aufgeloest.has(it.id) ? 'Auflösung verbergen' : 'Auflösen') : null,
        it.art === 'schaetzen' && it.wahr != null ? h('button', { class: 'knopf tonal', onclick: () => umschalten('aufloesen') }, L.aufgeloest.has(it.id) ? 'Wert verbergen' : 'Richtigen Wert zeigen') : null,
        it.art === 'freitext' ? h('button', { class: 'knopf tonal', disabled: L.themenLaeuft, onclick: themenFinden }, L.themenLaeuft ? 'Fasse zusammen …' : L.themen[it.id] ? 'Themen neu finden' : 'Themen finden (KI)') : null,
        h('span', { class: 'wachsen' }),
        L.i < L.runde.items.length - 1 ? h('button', { class: 'knopf', onclick: () => gehe(L.i + 1) }, 'Weiter →') : h('button', { class: 'knopf', onclick: () => zurueck() }, 'Runde beenden')),
      h('div', { class: 'punkte' }, L.runde.items.map((x, j) => h('button', { class: 'punkt' + (j === L.i ? ' an' : '') + ((L.antworten.get(x.id) || new Map()).size ? ' fertig' : ''), title: x.frage, onclick: () => gehe(j) }))));
  }
  return [
    oben,
    h('div', { class: 'leinwand-raster' + (L.wandZeigen && L.runde.wand ? ' mit-wand' : '') },
      h('div', { class: 'leinwand-haupt' }, haupt),
      L.wandZeigen && L.runde.wand ? wandPanel() : null),
    L.beitrittZeigen ? h('div', { class: 'qr-ueberlagerung', onclick: (e) => { if (e.target === e.currentTarget) { L.beitrittZeigen = false; zeichnen(); } } },
      h('div', { class: 'qr-karte' }, h('h2', {}, 'Mitmachen'), L.online.beitritt(), h('button', { class: 'knopf text', onclick: () => { L.beitrittZeigen = false; zeichnen(); } }, 'Schließen'))) : null,
    L.grossFrage ? h('div', { class: 'qr-ueberlagerung', onclick: () => { L.grossFrage = null; zeichnen(); } },
      h('div', { class: 'wand-gross' }, h('div', { class: 'leise' }, `Frage aus dem Publikum · ${L.grossFrage.stimmen.size} Stimmen`), h('div', { class: 'wand-gross-text' }, L.grossFrage.text),
        !L.runde.anonym && L.grossFrage.name ? h('div', { class: 'leise' }, L.grossFrage.name) : null)) : null,
  ];
}

function wandPanel() {
  const L = z.live;
  const liste = L.wand.slice().sort((a, b) => (a.beantwortet - b.beantwortet) || (b.stimmen.size - a.stimmen.size) || (a.zeit - b.zeit));
  return h('div', { class: 'wand-panel' },
    h('div', { class: 'zeile' }, h('h2', { class: 'wachsen' }, 'Fragenwand'), h('span', { class: 'leise klein' }, `${L.wand.length} Fragen`)),
    liste.length ? liste.map((f) => h('div', { class: 'wand-zeile' + (f.beantwortet ? ' erledigt' : '') },
      h('div', { class: 'wand-stimmen' }, h('span', {}, '▲'), h('b', {}, String(f.stimmen.size))),
      h('div', { class: 'wachsen', style: { minWidth: '0' } }, h('div', { class: 'wand-text' }, f.text), !L.runde.anonym && f.name ? h('div', { class: 'leise klein' }, f.name) : null),
      h('div', { class: 'spalte', style: { gap: '4px' } },
        h('button', { class: 'knopf text klein', title: 'Groß zeigen', onclick: () => { L.grossFrage = f; zeichnen(); } }, '⤢'),
        h('button', { class: 'knopf text klein', title: f.beantwortet ? 'Wieder offen' : 'Beantwortet', onclick: () => { f.beantwortet = !f.beantwortet; L.online.stand(wandNachricht()); zeichnen(); } }, f.beantwortet ? '↺' : '✓'))))
      : h('p', { class: 'leise' }, 'Noch keine Fragen. Alle können über „Fragen“ unten auf ihrem Handy etwas fragen.'));
}

// ---------------------------------------------------------------- Auswertung

function auswertungsAnsicht() {
  const a = z.auswertung;
  return [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '6px' } },
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'start'; z.auswertung = null; zeichnen(); } }, '←'),
      h('div', { class: 'wachsen' }, h('h1', { class: 'auswertung-titel' }, a.titel), h('div', { class: 'leise klein' }, `${new Date(a.zeit).toLocaleString('de-DE')} · ${a.teilnehmer} Teilnehmende`)),
      h('button', { class: 'knopf tonal', onclick: () => lyra.speichern(`Puls – ${a.titel}.md`, markdown(a)).catch(() => {}) }, 'Als Markdown'),
      h('button', { class: 'knopf tonal', onclick: () => lyra.speichern(`Puls – ${a.titel}.csv`, csv(a)).catch(() => {}) }, 'Als CSV'),
      h('button', { class: 'knopf text', title: 'Auswertung löschen', onclick: async () => {
        if (!(await lyra.bestaetigen({ titel: 'Auswertung löschen?', text: 'Die zusammengefassten Ergebnisse verschwinden.', ja: 'Löschen', gefahr: true }))) return;
        try { await lyra.speicher.loeschen('auswertung/' + a.id); } catch (_) {}
        z.auswertungen = z.auswertungen.filter((x) => x.id !== a.id);
        z.ansicht = 'start';
        zeichnen();
      } }, '✕')),
    a.items.map(({ item: it, ergebnis: e }, n) => h('div', { class: 'panel auswertung-item' },
      h('div', { class: 'art-marke' }, `${n + 1} · ${ARTEN[it.art][0]} · ${e.n} ${it.art === 'freitext' ? 'Antworten' : 'Stimmen'}`),
      h('h2', {}, it.frage),
      PulsAnsicht.ergebnis(it, e))),
    a.wand.length ? h('div', { class: 'panel auswertung-item' }, h('h2', {}, 'Fragenwand'),
      a.wand.map((f) => h('div', { class: 'wand-zeile' + (f.beantwortet ? ' erledigt' : '') }, h('div', { class: 'wand-stimmen' }, h('span', {}, '▲'), h('b', {}, String(f.stimmen))), h('div', { class: 'wand-text wachsen' }, f.text)))) : null,
    !a.items.length && !a.wand.length ? h('p', { class: 'leise' }, 'In dieser Runde wurde nichts abgegeben.') : null,
  ];
}

// Tastatur auf der Leinwand: → / Leertaste weiter, ← zurück
document.addEventListener('keydown', (e) => {
  if (z.ansicht !== 'live' || !z.live || document.querySelector('.dialog-grund')) return;
  if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && z.live.i >= -1)) { e.preventDefault(); if (z.live.i < z.live.runde.items.length - 1) gehe(z.live.i + 1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); gehe(z.live.i - 1); }
  if (e.key === 'Escape' && (z.live.beitrittZeigen || z.live.grossFrage)) { z.live.beitrittZeigen = false; z.live.grossFrage = null; zeichnen(); }
});

start();
