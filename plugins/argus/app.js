'use strict';
/*
 * Argus – Vertrags-Check. Öffne einen Vertrag (PDF, Word, Text): Argus fasst ihn verständlich zusammen, findet Fristen,
 * Kosten und Klauseln, die dich benachteiligen können, und belegt jede Aussage mit einem wörtlichen Zitat. Jedes Zitat
 * wird im Vertragstext gesucht und markiert – was sich nicht findet, ist deutlich gekennzeichnet. Keine Rechtsberatung.
 */
const { h } = lyra;

const STANDARD = { ki: 'auto' };
const ROLLEN = [['verbraucher', 'Kunde/Kundin'], ['mieter', 'Mieter/in'], ['arbeitnehmer', 'Arbeitnehmer/in'], ['auftragnehmer', 'Selbstständig / Auftragnehmer'], ['vermieter', 'Vermieter/in'], ['andere', 'Andere']];
const SCHWERE = { hoch: ['Kritisch', '#E5484D'], mittel: ['Beachten', '#F59E0B'], niedrig: ['Hinweis', '#64748B'] };
const TEXT_MAX = 300000;

const SYSTEM = `Du bist „Argus“ in Lyra: Du liest Verträge sorgfältig und erklärst sie in verständlichem Deutsch und sprichst \
mich mit „du“ an. Du gibst \
keine Rechtsberatung und keine Garantie, sondern zeigst, worauf man achten sollte. Jede Aussage belegst du mit einem \
WÖRTLICHEN Zitat aus dem Vertrag (genau so geschrieben wie im Text, höchstens 30 Wörter). Du erfindest nichts – was \
nicht im Vertrag steht, lässt du weg. Typische Stolperfallen: automatische Verlängerung, lange Kündigungsfristen, \
einseitige Preis- oder Leistungsänderungen, Haftungsausschlüsse, Vertragsstrafen, Pauschalen, Schönheitsreparaturen, \
Kaution über drei Monatsmieten, pauschal abgegoltene Überstunden, Wettbewerbsverbote, Ausschlussfristen, Gerichtsstand.`;

// Schlüssel alphabetisch sinnvoll: Art, Fristen, Kosten, Kündigung, Laufzeit, Parteien, Risiken, Überblick, zu klären
const SCHEMA = {
  type: 'object',
  properties: {
    art: { type: 'string' },
    fristen: { type: 'array', items: { type: 'object', properties: { datum: { type: 'string' }, was: { type: 'string' }, zitat: { type: 'string' } }, required: ['datum', 'was', 'zitat'] } },
    kosten: { type: 'array', items: { type: 'object', properties: { betrag: { type: 'string' }, wofuer: { type: 'string' }, zitat: { type: 'string' } }, required: ['betrag', 'wofuer', 'zitat'] } },
    kuendigung: { type: 'string' },
    laufzeit: { type: 'string' },
    parteien: { type: 'array', items: { type: 'string' } },
    risiken: {
      type: 'array',
      items: {
        type: 'object',
        properties: { befund: { type: 'string' }, erklaerung: { type: 'string' }, schwere: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] }, zitat: { type: 'string' } },
        required: ['befund', 'erklaerung', 'schwere', 'zitat'],
      },
    },
    ueberblick: { type: 'string' },
    zuKlaeren: { type: 'array', items: { type: 'string' } },
  },
  required: ['art', 'fristen', 'kosten', 'kuendigung', 'laufzeit', 'parteien', 'risiken', 'ueberblick', 'zuKlaeren'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  liste: [], // [{id, name, zeit, risiken}]
  p: null, // offene Prüfung
  eingabe: { text: '', name: '', rolle: 'verbraucher' },
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
  markiert: null,
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const isoGueltig = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T12:00:00')) ? s : '');
const deDatum = (iso) => (isoGueltig(iso) ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.liste = ((await lyra.speicher.lesen('index')) || []).filter((e) => e && e.id); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.p) { z.p = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('pruefung/')) await oeffnen(route.slice(9));
  zeichnen();
  if (route === 'einstellungen') einstellungen();
}

// ================================================================== Speichern

async function sichern() {
  const p = z.p;
  if (!p) return;
  try { await lyra.speicher.schreiben('pruefungen/' + p.id, p); } catch (_) {}
  const meta = { id: p.id, name: p.name, zeit: p.zeit, art: p.ergebnis.art, kritisch: p.ergebnis.risiken.filter((r) => r.schwere === 'hoch').length };
  z.liste = [meta, ...z.liste.filter((e) => e.id !== p.id)];
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  erinnerungenSetzen();
}

async function oeffnen(id) {
  try { const p = await lyra.speicher.lesen('pruefungen/' + id); if (p && p.ergebnis) z.p = p; } catch (_) {}
}

async function entfernen(id) {
  const ok = await lyra.bestaetigen({ titel: 'Prüfung löschen?', text: 'Argus vergisst den Vertrag und die Auswertung. Die Originaldatei bleibt, wo sie ist.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('pruefungen/' + id); } catch (_) {}
  z.liste = z.liste.filter((e) => e.id !== id);
  try { await lyra.speicher.schreiben('index', z.liste); } catch (_) {}
  if (z.p && z.p.id === id) z.p = null;
  await erinnerungenSetzen();
  zeichnen();
}

/** Alle Fristen mit „Erinnern“ aus allen Prüfungen: 14 Tage und 1 Tag vorher, jeweils 9 Uhr. */
async function erinnerungenSetzen() {
  const liste = [];
  for (const meta of z.liste) {
    let p = z.p && z.p.id === meta.id ? z.p : null;
    if (!p) { try { p = await lyra.speicher.lesen('pruefungen/' + meta.id); } catch (_) {} }
    if (!p || !p.ergebnis) continue;
    for (const f of p.ergebnis.fristen) {
      if (!f.erinnern || !isoGueltig(f.datum)) continue;
      for (const [tage, wann] of [[14, 'in zwei Wochen'], [1, 'morgen']]) {
        const d = new Date(f.datum + 'T09:00:00');
        d.setDate(d.getDate() - tage);
        if (d.getTime() < Date.now()) continue;
        liste.push({ id: `${p.id}-${f.id}-${tage}`, titel: `Frist ${wann}: ${f.was}`.slice(0, 120), text: `${p.name} · ${deDatum(f.datum)}`, zeit: Math.round(d.getTime() / 1000) });
      }
    }
  }
  lyra.erinnern(liste.slice(0, 60)).then((ok) => { if (!ok && liste.length) { z.meldung = 'Erinnerungen kommen nur, wenn Lyra in den Systemeinstellungen „Mitteilungen“ senden darf.'; zeichnen(); } }).catch(() => {});
}

// ================================================================== Zitate prüfen

/** Silbentrennung am Zeilenende zusammenziehen, Leerraum aufräumen. */
function aufbereiten(t) {
  return t.replace(/\r\n?/g, '\n').replace(/([a-zäöüß])-\n\s*([a-zäöüß])/g, '$1$2').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, TEXT_MAX);
}

function musterFuer(zitat, woerter) {
  const tokens = String(zitat).replace(/^[„“"»«'‚‘\s.…]+|[„“"»«'‚‘\s.…]+$/g, '').split(/\s+/).filter(Boolean).slice(0, woerter);
  if (tokens.length < 3) return null;
  const teil = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/["„“”»«]/g, '["„“”»«]').replace(/['‚‘’`]/g, "['‚‘’`]").replace(/[-–—]/g, '[-–—]');
  return new RegExp(tokens.map(teil).join('[\\s\\u00ad]+'), 'i');
}

/** Findet das Zitat im Vertrag → [start, ende] oder null. Erst die ersten 14 Wörter, dann die ersten 6. */
function zitatFinden(quelle, zitat) {
  for (const n of [14, 6]) {
    const re = musterFuer(zitat, n);
    if (!re) return null;
    const m = re.exec(quelle);
    if (m) return [m.index, m.index + m[0].length];
  }
  return null;
}

function belegen(erg, quelle) {
  const alle = [...erg.risiken, ...erg.fristen, ...erg.kosten];
  for (const x of alle) {
    const f = x.zitat ? zitatFinden(quelle, x.zitat) : null;
    x.stelle = f;
    x.belegt = !!f;
  }
}

// ================================================================== Auswerten

function teilen(t, max) {
  if (t.length <= max) return [t];
  const teile = [];
  let rest = t;
  while (rest.length > max) {
    let s = rest.lastIndexOf('\n\n', max);
    if (s < max * 0.5) s = rest.lastIndexOf('\n', max);
    if (s < max * 0.5) s = max;
    teile.push(rest.slice(0, s));
    rest = rest.slice(s);
  }
  if (rest.trim()) teile.push(rest);
  return teile;
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

const neuId = (() => { let n = 0; return () => `${Date.now().toString(36)}${n++}`; })();

async function pruefen() {
  const e = z.eingabe;
  if (!text(e.text) || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  const quelle = aufbereiten(e.text);
  const teile = teilen(quelle, z.lehrer === 'lyra' ? 10000 : 70000);
  const rolle = ROLLEN.find((r) => r[0] === e.rolle)[1];
  const erg = { art: '', fristen: [], kosten: [], kuendigung: '', laufzeit: '', parteien: [], risiken: [], ueberblick: '', zuKlaeren: [] };
  const ueberblicke = [];
  const heute = new Date().toISOString().slice(0, 10);
  try {
    for (const [i, teil] of teile.entries()) {
      status(teile.length > 1 ? `Argus liest Teil ${i + 1} von ${teile.length} …` : 'Argus liest den Vertrag …');
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Ich bin in diesem Vertrag: ${rolle}. Heute ist der ${heute}.${teile.length > 1 ? ` Das ist Teil ${i + 1} von ${teile.length} des Vertrags.` : ''}\n\n\
=== VERTRAG ===\n${teil}\n=== ENDE ===\n\n\
Werte aus meiner Sicht aus. "art": Vertragsart (z. B. Mietvertrag, Handyvertrag). "fristen": jede Frist oder jeder Termin \
(datum als JJJJ-MM-TT, wenn ein festes Datum genannt ist, sonst ""; was: kurz, worum es geht). "kosten": jeder Betrag \
(betrag wie im Vertrag, wofuer). "kuendigung": Kündigungsregeln in 1–2 Sätzen oder "". "laufzeit": Laufzeit und \
Verlängerung in einem Satz oder "". "parteien": Vertragspartner. "risiken": Klauseln, die mich benachteiligen können \
(befund: kurzer Titel; erklaerung: 1–2 Sätze, warum; schwere: hoch, mittel oder niedrig). "ueberblick": 3 Sätze in \
einfacher Sprache. "zuKlaeren": Fragen, die ich vor dem Unterschreiben stellen sollte. Jedes "zitat" wörtlich aus dem Vertrag.\n\n\
Antwort als JSON mit genau diesen Feldern: {"art": "", "fristen": [], "kosten": [], "kuendigung": "", "laufzeit": "", "parteien": [], "risiken": [], "ueberblick": "", "zuKlaeren": []}`,
        schema: SCHEMA,
        zaehlen: { schluessel: 'befund', wort: 'Befund' },
      }, (x) => { if (x.art === 'hinweis') status(x.text); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = (r && r.json) || {};
      for (const k of ['art', 'kuendigung', 'laufzeit']) if (!erg[k] && text(j[k])) erg[k] = text(j[k]).slice(0, 600);
      if (text(j.ueberblick)) ueberblicke.push(text(j.ueberblick));
      for (const p of Array.isArray(j.parteien) ? j.parteien : []) { const s = text(p).slice(0, 160); if (s && !erg.parteien.includes(s)) erg.parteien.push(s); }
      for (const q of Array.isArray(j.zuKlaeren) ? j.zuKlaeren : []) { const s = text(q).slice(0, 300); if (s && !erg.zuKlaeren.includes(s)) erg.zuKlaeren.push(s); }
      for (const f of Array.isArray(j.fristen) ? j.fristen : []) if (f && text(f.was)) erg.fristen.push({ id: neuId(), datum: isoGueltig(text(f.datum)), was: text(f.was).slice(0, 200), zitat: text(f.zitat).slice(0, 400), erinnern: false });
      for (const k of Array.isArray(j.kosten) ? j.kosten : []) if (k && text(k.wofuer)) erg.kosten.push({ id: neuId(), betrag: text(k.betrag).slice(0, 60), wofuer: text(k.wofuer).slice(0, 200), zitat: text(k.zitat).slice(0, 400) });
      for (const x of Array.isArray(j.risiken) ? j.risiken : []) {
        if (!x || !text(x.befund)) continue;
        if (erg.risiken.some((y) => y.befund.toLowerCase() === text(x.befund).toLowerCase())) continue;
        erg.risiken.push({ id: neuId(), befund: text(x.befund).slice(0, 140), erklaerung: text(x.erklaerung).slice(0, 600), schwere: SCHWERE[x.schwere] ? x.schwere : 'mittel', zitat: text(x.zitat).slice(0, 400) });
      }
    }
    erg.ueberblick = ueberblicke.join(' ');
    if (ueberblicke.length > 1) {
      status('Fasse zusammen …');
      try {
        const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt: `Fasse diese Teil-Zusammenfassungen eines Vertrags in 3 einfachen Sätzen zusammen:\n\n${ueberblicke.join('\n\n')}` });
        if (text(r && r.text)) erg.ueberblick = text(r.text);
      } catch (_) {}
    }
    if (!erg.ueberblick && !erg.risiken.length && !erg.fristen.length) throw new Error('Argus konnte daraus nichts auswerten – ist das ein Vertrag?');
    const ordnung = { hoch: 0, mittel: 1, niedrig: 2 };
    erg.risiken.sort((a, b) => ordnung[a.schwere] - ordnung[b.schwere]);
    belegen(erg, quelle);
    z.p = { id: lyra.neueId(), name: text(e.name) || erg.art || 'Vertrag', rolle: e.rolle, text: quelle, ergebnis: erg, zeit: lyra.jetzt() };
    z.eingabe = { text: '', name: '', rolle: e.rolle };
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
    const d = await lyra.dateiOeffnen({ arten: ['pdf', 'docx', 'txt', 'md'], titel: 'Verträge' });
    if (!d) return;
    z.eingabe.text = d.text || '';
    z.eingabe.name = d.name.replace(/\.[^.]+$/, '');
    if (!text(z.eingabe.text)) z.fehler = 'In der Datei ließ sich kein Text finden – ist es ein eingescanntes Bild? Dann kopier den Text bitte hinein.';
  } catch (e) { z.fehler = String((e && e.message) || e); }
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.p ? pruefAnsicht(z.p) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) e.focus();
  lyra.titel(z.p ? z.p.name : '');
}

function startAnsicht() {
  const feld = h('textarea', { class: 'eingabe', 'data-feld': 'text', rows: 9, placeholder: 'Vertragstext hier einfügen – oder oben rechts eine Datei öffnen (PDF, Word, Text).' });
  feld.value = z.eingabe.text;
  feld.addEventListener('input', () => { z.eingabe.text = feld.value; const k = document.getElementById('los'); if (k) k.disabled = z.laeuft || !feld.value.trim(); });
  const name = h('input', { class: 'eingabe', 'data-feld': 'name', placeholder: 'z. B. Mietvertrag Lindenstraße', value: z.eingabe.name });
  name.addEventListener('input', () => { z.eingabe.name = name.value; });
  const woerter = z.eingabe.text.trim() ? z.eingabe.text.trim().split(/\s+/).length : 0;
  return h('div', { class: 'seite breit' },
    lyra.kopf({ titel: 'Vertrag prüfen', unter: 'Hundert Augen für das Kleingedruckte – bevor du unterschreibst. Jede Aussage mit Zitat aus dem Vertrag.' }),
    h('div', { class: 'flaeche spalte', style: { gap: '12px' } },
      h('div', { class: 'zeile' },
        h('div', { class: 'ueberschrift-klein wachsen' }, 'Vertrag prüfen'),
        h('button', { class: 'knopf tonal klein', onclick: dateiLaden }, 'Datei öffnen …')),
      feld,
      woerter ? h('div', { class: 'klein leise' }, `${woerter.toLocaleString('de-DE')} Wörter`) : null,
      h('div', { class: 'zwei-klein' },
        h('label', { class: 'feld' }, 'Name', name),
        h('div', { class: 'feld' }, 'Ich bin …', h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, ROLLEN.map(([k, n]) =>
          h('button', { class: 'chip' + (z.eingabe.rolle === k ? ' an' : ''), onclick: () => { z.eingabe.rolle = k; zeichnen(); } }, n))))),
      h('div', { class: 'zeile' },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || !z.eingabe.text.trim(), onclick: pruefen }, '👁 Prüfen')),
      z.laeuft ? lyra.arbeit(z.status || 'Argus liest den Vertrag …') : null,
      z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; pruefen(); } : null,
        () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; pruefen(); }) : null),
    h('div', { class: 'warnhinweis' }, '⚖️ Argus ist keine Rechtsberatung. Es zeigt dir, worauf du achten solltest – bei Zweifeln helfen Verbraucherzentrale, Mieterverein, Gewerkschaft oder eine Anwältin.'),
    z.liste.length ? h('div', { style: { marginTop: '20px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Geprüfte Verträge'),
      h('div', { class: 'ly-liste' }, z.liste.map((e) => lyra.eintrag({
        symbol: '📄',
        titel: e.name,
        unter: [e.art, lyra.zeitText(e.zeit)].filter(Boolean).join(' · '),
        rechts: e.kritisch ? h('span', { class: 'etikett-kritisch' }, `${e.kritisch} kritisch`) : h('span', { class: 'etikett', style: { '--farbe': 'var(--ok)' } }, 'unauffällig'),
        beiKlick: async () => { await oeffnen(e.id); zeichnen(); },
        aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => entfernen(e.id) }],
      })))) : null);
}

function beleg(x) {
  if (!x.zitat) return null;
  return h('div', { class: 'beleg' + (x.belegt ? ' ok' : ' fehlt'), onclick: x.belegt ? () => zuStelle(x.id) : null, title: x.belegt ? 'Im Vertrag zeigen' : '' },
    h('span', { class: 'beleg-zeichen' }, x.belegt ? '✓' : '⚠︎'),
    h('span', { class: 'beleg-text' }, `„${x.zitat}“`),
    !x.belegt ? h('div', { class: 'klein' }, 'Nicht wörtlich im Vertrag gefunden – prüf diese Stelle selbst.') : null);
}

function zuStelle(id) {
  z.markiert = id;
  document.querySelectorAll('mark.an').forEach((m) => m.classList.remove('an'));
  const m = document.querySelector(`mark[data-id="${id}"]`);
  if (m) { m.classList.add('an'); m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

function vertragstext(p) {
  const stellen = [...p.ergebnis.risiken, ...p.ergebnis.fristen, ...p.ergebnis.kosten].filter((x) => x.stelle).map((x) => ({ id: x.id, von: x.stelle[0], bis: x.stelle[1], art: x.schwere || (x.betrag !== undefined ? 'kosten' : 'frist') }))
    .sort((a, b) => a.von - b.von);
  const teile = [];
  let pos = 0;
  for (const s of stellen) {
    if (s.von < pos) continue;
    teile.push(p.text.slice(pos, s.von));
    teile.push(h('mark', { 'data-id': s.id, class: 'm-' + s.art }, p.text.slice(s.von, s.bis)));
    pos = s.bis;
  }
  teile.push(p.text.slice(pos));
  return h('div', { class: 'vertrag' }, teile);
}

function pruefAnsicht(p) {
  const e = p.ergebnis;
  const unbelegt = [...e.risiken, ...e.fristen, ...e.kosten].filter((x) => x.zitat && !x.belegt).length;
  const karte = (titel, kinder) => h('div', { class: 'flaeche abschnitt' }, h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, titel), kinder);
  const links = h('div', { class: 'auswertung' },
    h('div', { class: 'zeile', style: { marginBottom: '4px' } },
      h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.p = null; zeichnen(); } }, '← Alle Verträge'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.drucken() }, 'PDF / Drucken')),
    h('h2', {}, p.name),
    h('div', { class: 'leise klein', style: { marginBottom: '12px' } }, [e.art, `aus Sicht: ${(ROLLEN.find((r) => r[0] === p.rolle) || ROLLEN[0])[1]}`].filter(Boolean).join(' · ')),
    z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
    karte('In einfachen Worten', h('div', {},
      h('p', { style: { lineHeight: 1.6 } }, e.ueberblick),
      h('div', { class: 'eckdaten' },
        e.parteien.length ? h('div', {}, h('span', { class: 'leise' }, 'Parteien'), h('span', {}, e.parteien.join(' · '))) : null,
        e.laufzeit ? h('div', {}, h('span', { class: 'leise' }, 'Laufzeit'), h('span', {}, e.laufzeit)) : null,
        e.kuendigung ? h('div', {}, h('span', { class: 'leise' }, 'Kündigung'), h('span', {}, e.kuendigung)) : null))),
    karte(`⚠︎ Worauf du achten solltest · ${e.risiken.length}`, e.risiken.length ? h('div', { class: 'spalte', style: { gap: '10px' } }, e.risiken.map((r) => h('div', { class: 'risiko', style: { '--s': SCHWERE[r.schwere][1] } },
      h('div', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: 'schwere' }, SCHWERE[r.schwere][0]), h('span', { class: 'fett' }, r.befund)),
      h('div', { style: { margin: '4px 0 6px', fontSize: '14px' } }, r.erklaerung),
      beleg(r)))) : h('div', { class: 'leise klein' }, 'Keine auffälligen Klauseln gefunden.')),
    karte(`📅 Fristen & Termine · ${e.fristen.length}`, e.fristen.length ? h('div', { class: 'spalte', style: { gap: '10px' } }, e.fristen.map((f) => h('div', { class: 'frist' },
      h('div', { class: 'zeile', style: { gap: '10px' } },
        h('div', { class: 'wachsen fett' }, f.was),
        h('input', { type: 'date', class: 'datum', value: f.datum, title: 'Datum festlegen', onchange: (ev) => { f.datum = isoGueltig(ev.target.value); if (!f.datum) f.erinnern = false; sichern(); zeichnen(); } }),
        h('label', { class: 'zeile klein', style: { gap: '5px', cursor: f.datum ? 'pointer' : 'default', opacity: f.datum ? 1 : 0.5 }, title: f.datum ? '14 Tage und 1 Tag vorher' : 'Erst ein Datum festlegen' },
          h('input', { type: 'checkbox', checked: f.erinnern, disabled: !f.datum, onchange: (ev) => { f.erinnern = ev.target.checked; sichern(); } }), 'Erinnern')),
      beleg(f)))) : h('div', { class: 'leise klein' }, 'Keine Fristen gefunden.')),
    e.kosten.length ? karte(`💶 Kosten · ${e.kosten.length}`, h('div', { class: 'spalte', style: { gap: '10px' } }, e.kosten.map((k) => h('div', {},
      h('div', { class: 'zeile' }, h('span', { class: 'wachsen' }, k.wofuer), h('span', { class: 'fett' }, k.betrag)), beleg(k))))) : null,
    e.zuKlaeren.length ? karte('❓ Vor dem Unterschreiben fragen', h('ul', { class: 'fragen' }, e.zuKlaeren.map((q) => h('li', {}, q)))) : null,
    unbelegt ? h('div', { class: 'klein leise', style: { margin: '4px 0 10px' } }, `${unbelegt} Zitat${unbelegt > 1 ? 'e' : ''} ließ${unbelegt > 1 ? 'en' : ''} sich nicht wörtlich finden – solche Stellen sind mit ⚠︎ markiert.`) : null,
    h('div', { class: 'warnhinweis' }, '⚖️ Keine Rechtsberatung – Argus kann sich irren. Bei wichtigen Verträgen lass dich beraten.'));
  return h('div', { class: 'pruef' }, links, h('div', { class: 'rechts nur-bildschirm' },
    h('div', { class: 'ueberschrift-klein', style: { margin: '0 0 8px' } }, 'Vertragstext · Markierungen anklickbar in der Auswertung'),
    vertragstext(p)));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const m = () => box.replaceChildren(...[['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']].map(([w, n]) =>
    h('button', { class: 'chip' + (e.ki === w ? ' an' : ''), onclick: () => { e.ki = w; m(); } }, n)));
  m();
  const ok = await lyra.dialog('Argus – Einstellungen', h('div', { style: { minWidth: '440px' } },
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Wer prüft'), box,
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Mit Claude, ChatGPT oder Gemini geht der Vertragstext hinaus (Lyra fragt vorher). Mit Lyra (lokal) bleibt alles auf deinem Mac – lange Verträge werden dann in Teilen gelesen.')), [
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
