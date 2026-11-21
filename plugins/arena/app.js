'use strict';
/*
 * Arena – Probeklausur unter echten Bedingungen: Aufgaben im Stil deiner Altklausuren (sofern Lyra welche findet), mit
 * Punkten und Zeitlimit. Die Uhr läuft weiter, auch wenn du das Fenster schließt; macOS erinnert dich kurz vor Schluss.
 * Danach bewertet die KI jede Aufgabe mit Punkten und Rückmeldung – und schätzt die Note.
 */
const { h, mdElement } = lyra;

const STANDARD = { dauer: 60, anzahl: 5, niveau: 'klausur', ki: 'auto', stil: true };
const NOTEN = [[95, '1,0'], [90, '1,3'], [85, '1,7'], [80, '2,0'], [75, '2,3'], [70, '2,7'], [65, '3,0'], [60, '3,3'], [55, '3,7'], [50, '4,0'], [0, '5,0']];
const note = (prozent) => NOTEN.find(([g]) => prozent >= g)[1];

const SYSTEM = `Du bist „Arena“ in Lyra: Du stellst realistische Hochschul-Klausuren zusammen und korrigierst sie fair, \
streng und nachvollziehbar wie eine erfahrene Korrektorin. Aufgaben sind eindeutig, lösbar in der Zeit und fachlich korrekt. \
Formeln in LaTeX zwischen $…$ bzw. $$…$$.`;

const KLAUSUR_SCHEMA = {
  type: 'object',
  properties: {
    aufgaben: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          aufgabe: { type: 'string' },
          erwartung: { type: 'string' },
          punkte: { type: 'integer' },
          titel: { type: 'string' },
        },
        required: ['aufgabe', 'erwartung', 'punkte', 'titel'],
      },
    },
  },
  required: ['aufgaben'],
};
const BEWERTUNG_SCHEMA = {
  type: 'object',
  properties: {
    begruendung: { type: 'string' },
    punkte: { type: 'number' },
    tipp: { type: 'string' },
  },
  required: ['begruendung', 'punkte', 'tipp'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  themen: [],
  thema: '',
  klausuren: [],
  k: null, // {id, thema, aufgaben: [{titel, aufgabe, erwartung, punkte, antwort, bewertung}], start, ende, abgegeben, ergebnis, zeit}
  aktuell: 0,
  laeuft: false,
  status: '',
  fehler: null,
  takt: null,
};
const app = document.getElementById('app');
const jetzt = () => Date.now() / 1000;
const mmss = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return `${m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`; };
const punkteText = (p) => String(Math.round(p * 2) / 2).replace('.', ',');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.klausuren = (await lyra.speicher.liste('klausuren')).map((e) => e.wert).filter((k) => k && k.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.k && !(z.k.start && !z.k.abgegeben)) { z.k = null; return zeichnen(); }
    lyra.zurueck(); // während einer laufenden Klausur: Fenster zu, Uhr läuft weiter
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  const laufend = z.klausuren.find((k) => k.start && !k.abgegeben);
  if (laufend) z.k = laufend;
  else if (route.startsWith('klausur/')) z.k = z.klausuren.find((k) => k.id === route.slice(8)) || null;
  zeichnen();
  z.takt = setInterval(ticken, 500);
  lyra.themen().then((t) => { z.themen = t || []; if (!z.k) zeichnen(); }).catch(() => {});
  if (route === 'einstellungen') einstellungen();
}

async function sichern() {
  if (!z.k) return;
  z.k.zeit = jetzt();
  try { await lyra.speicher.schreiben('klausuren/' + z.k.id, z.k); } catch (_) {}
  z.klausuren = [z.k, ...z.klausuren.filter((x) => x.id !== z.k.id)];
  startseite();
}

function startseite() {
  const e = [];
  const lauf = z.klausuren.find((k) => k.start && !k.abgegeben);
  if (lauf) e.push({ id: 'lauf', titel: `Probeklausur läuft: ${lauf.thema}`, untertitel: `Abgabe um ${new Date(lauf.ende * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, route: '', zeigen_bis: lauf.ende, geaendert: lauf.start });
  const letzte = z.klausuren.find((k) => k.ergebnis);
  if (letzte) e.push({ id: 'letzte', titel: `Probeklausur ${letzte.thema}: ${letzte.ergebnis.note}`, untertitel: `${punkteText(letzte.ergebnis.punkte)} von ${letzte.ergebnis.max} Punkten – nochmal antreten?`, route: '', zeigen_bis: letzte.zeit + 10 * 86400, geaendert: letzte.zeit });
  lyra.startseite(e).catch(() => {});
}

function status(t) { z.status = t; const el = document.getElementById('status'); if (el) el.textContent = t; }

// ------------------------------------------------------------------ Klausur erstellen

async function erstellen() {
  const thema = z.thema.trim();
  if (!thema || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  try {
    status('Arena sucht Stoff und Altklausuren in deinen Unterlagen …');
    let stoff = '';
    let stil = '';
    try { stoff = ((await lyra.suchen(thema, z.lehrer === 'lyra' ? 6 : 10)).block || '').slice(0, z.lehrer === 'lyra' ? 6000 : 14000); } catch (_) {}
    if (z.einst.stil) {
      try { stil = ((await lyra.suchen(`Klausur Altklausur Prüfung Aufgabe Punkte ${thema}`, 4)).block || '').slice(0, 5000); } catch (_) {}
    }
    const niveau = { uebung: 'wie eine Übungsaufgabe (Grundlagen sicher anwenden)', klausur: 'wie eine echte Klausur (Mischung aus Rechnen, Verstehen, Begründen)', schwer: 'anspruchsvoll (Transfer, Beweise, knifflige Fälle)' }[z.einst.niveau];
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: SYSTEM,
      prompt: `Thema der Probeklausur: ${thema}\nBearbeitungszeit: ${z.einst.dauer} Minuten\nAnzahl Aufgaben: ${z.einst.anzahl}\nNiveau: ${niveau}\n\n\
${stoff ? `Stoff aus meinen Unterlagen:\n\n${stoff}\n\n` : ''}${stil ? `Ausschnitte, die nach (Alt-)Klausuren aussehen – übernimm deren Stil, Aufgabentypen und Punkteverteilung:\n\n${stil}\n\n` : ''}\
Erstelle die Klausur. Die Punkte summieren sich zu etwa ${z.einst.dauer} (ca. 1 Punkt pro Minute). Je Aufgabe: \
"titel" (kurz), "aufgabe" (vollständige Aufgabenstellung in Markdown, Teilaufgaben a), b) … erlaubt), "punkte", \
"erwartung" (Musterlösung und Bewertungsschema: wofür es wie viele Punkte gibt – wird erst nach der Abgabe gezeigt).\n\n\
Antwort als JSON: {"aufgaben": [{"aufgabe": "…", "erwartung": "…", "punkte": 10, "titel": "…"}]}`,
      schema: KLAUSUR_SCHEMA,
      zaehlen: { schluessel: 'titel', wort: 'Aufgabe' },
    }, (e) => { if (e.art === 'hinweis') status(e.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const aufgaben = ((r && r.json && r.json.aufgaben) || []).map((a) => ({
      titel: String(a.titel || '').trim(), aufgabe: String(a.aufgabe || '').trim(), erwartung: String(a.erwartung || '').trim(),
      punkte: Math.max(1, Math.min(60, Math.round(Number(a.punkte) || 10))), antwort: '', bewertung: null,
    })).filter((a) => a.aufgabe);
    if (!aufgaben.length) throw new Error('Die Klausur kam nicht zustande – bitte nochmal versuchen.');
    z.k = { id: lyra.neueId(), thema, dauer: z.einst.dauer, aufgaben, start: 0, ende: 0, abgegeben: false, ergebnis: null, zeit: jetzt() };
    z.aktuell = 0;
    await sichern();
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

// ------------------------------------------------------------------ Schreiben, Uhr, Abgabe

async function losgehen() {
  const k = z.k;
  k.start = jetzt();
  k.ende = k.start + k.dauer * 60;
  await sichern();
  lyra.erinnern([
    { id: 'fuenf', titel: 'Noch 5 Minuten ⏳', text: `Probeklausur ${k.thema} – Zeit zum Abrunden.`, zeit: Math.round(k.ende - 300) },
    { id: 'ende', titel: 'Zeit um – Stifte weg ✋', text: `Probeklausur ${k.thema}: Arena gibt jetzt ab.`, zeit: Math.round(k.ende) },
  ]).catch(() => {});
  zeichnen();
}

function ticken() {
  const k = z.k;
  if (!k || !k.start || k.abgegeben) return;
  const rest = k.ende - jetzt();
  const el = document.getElementById('uhr');
  if (el) {
    el.textContent = mmss(rest);
    el.classList.toggle('knapp', rest < 300);
  }
  if (rest <= 0 && !z.laeuft) abgeben(true);
}

async function abgeben(zeitUm) {
  const k = z.k;
  if (!zeitUm && !window.confirm('Klausur abgeben?\n\nDanach kannst du nichts mehr ändern; Arena bewertet deine Antworten.')) return;
  k.abgegeben = true;
  k.abgegebenUm = Math.min(jetzt(), k.ende || jetzt());
  await sichern();
  lyra.erinnern([]).catch(() => {});
  bewerten();
}

async function bewerten() {
  const k = z.k;
  z.laeuft = true;
  z.fehler = null;
  zeichnen();
  try {
    for (const [i, a] of k.aufgaben.entries()) {
      if (a.bewertung) continue;
      status(`Arena korrigiert Aufgabe ${i + 1} von ${k.aufgaben.length} …`);
      if (!a.antwort.trim()) {
        a.bewertung = { punkte: 0, begruendung: 'Nicht bearbeitet.', tipp: '' };
        await sichern();
        continue;
      }
      const r = await lyra.ki({
        lehrer: z.lehrer,
        system: SYSTEM,
        prompt: `Aufgabe (${a.punkte} Punkte):\n${a.aufgabe}\n\nMusterlösung und Bewertungsschema:\n${a.erwartung}\n\nAntwort der/des Studierenden:\n${a.antwort}\n\n\
Korrigiere fair und streng nach dem Schema. "punkte": erreichte Punkte (0 bis ${a.punkte}, halbe Punkte erlaubt). \
"begruendung": 1 bis 4 Sätze, wofür es Punkte gab und was fehlt. "tipp": ein Satz, worauf sie/er beim Lernen achten sollte.\n\n\
Antwort als JSON: {"begruendung": "…", "punkte": 0, "tipp": "…"}`,
        schema: BEWERTUNG_SCHEMA,
      }, (e) => { if (e.art === 'hinweis') status(`Aufgabe ${i + 1}: ${e.text}`); });
      if (r && r.lehrer) z.lehrer = r.lehrer;
      const j = (r && r.json) || {};
      a.bewertung = { punkte: Math.max(0, Math.min(a.punkte, Math.round((Number(j.punkte) || 0) * 2) / 2)), begruendung: String(j.begruendung || ''), tipp: String(j.tipp || '') };
      await sichern();
    }
    const max = k.aufgaben.reduce((s, a) => s + a.punkte, 0);
    const punkte = k.aufgaben.reduce((s, a) => s + (a.bewertung ? a.bewertung.punkte : 0), 0);
    const prozent = max ? (punkte / max) * 100 : 0;
    k.ergebnis = { punkte, max, prozent: Math.round(prozent), note: note(prozent), minuten: Math.round(((k.abgegebenUm || jetzt()) - k.start) / 60) };
    await sichern();
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m + ' – „Weiter bewerten“ setzt fort.';
  }
  z.laeuft = false;
  zeichnen();
}

// ------------------------------------------------------------------ Ansichten

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && 'selectionStart' in aktiv ? aktiv.selectionStart : null;
  const k = z.k;
  app.replaceChildren(h('div', { class: 'arena' }, !k ? lobby() : !k.start ? vorStart() : !k.abgegeben ? schreiben() : auswertung()));
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos !== null) try { e.setSelectionRange(pos, pos); } catch (_) {} }
  lyra.titel(k ? k.thema : '');
  ticken();
}

function laufZeile() {
  return z.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'status' }, z.status),
    h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : null;
}
function fehlerZeile() {
  return z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; zeichnen(); } : null, () => { z.fehler = null; zeichnen(); }) : null;
}

function lobby() {
  const t = h('input', { class: 'eingabe gross-eingabe', 'data-feld': 'thema', placeholder: 'Fach oder Thema der Probeklausur, z. B. Lineare Algebra I', value: z.thema });
  t.addEventListener('input', () => { z.thema = t.value; const b = document.getElementById('los'); if (b) b.disabled = !t.value.trim(); });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') erstellen(); });
  const chip = (schl, w, n) => h('button', { class: 'chip' + (z.einst[schl] === w ? ' an' : ''), onclick: async () => { z.einst[schl] = w; try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {} zeichnen(); } }, n);
  return h('div', { class: 'seite' },
    h('div', { class: 'held' }, h('div', { class: 'logo' }, 'ARENA'), h('div', { class: 'leise' }, 'Probeklausur unter echten Bedingungen.')),
    h('div', { class: 'flaeche spalte', style: { gap: '12px' } },
      t,
      z.themen.length ? h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, z.themen.slice(0, 12).map((x) => h('button', { class: 'chip', onclick: () => { z.thema = x; zeichnen(); } }, x))) : null,
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, h('span', { class: 'leise klein' }, 'Zeit'), ...[30, 60, 90, 120].map((m) => chip('dauer', m, `${m} min`))),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, h('span', { class: 'leise klein' }, 'Aufgaben'), ...[3, 4, 5, 6, 8].map((n) => chip('anzahl', n, String(n)))),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, h('span', { class: 'leise klein' }, 'Niveau'), chip('niveau', 'uebung', 'Übung'), chip('niveau', 'klausur', 'Klausur'), chip('niveau', 'schwer', 'Knackig')),
      h('div', { class: 'zeile' },
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
        h('span', { class: 'wachsen' }),
        h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || !z.thema.trim(), onclick: erstellen }, 'Klausur zusammenstellen')),
      laufZeile(), fehlerZeile()),
    z.klausuren.length ? h('div', { style: { marginTop: '18px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Deine Probeklausuren'),
      z.klausuren.map((k) => h('div', { class: 'karte klickbar zeile', style: { marginBottom: '8px' }, onclick: () => { z.k = k; z.aktuell = 0; zeichnen(); } },
        h('div', { class: 'note-kachel' + (k.ergebnis ? '' : ' offen') }, k.ergebnis ? k.ergebnis.note : '–'),
        h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, k.thema),
          h('div', { class: 'klein leise' }, `${k.aufgaben.length} Aufgaben · ${k.dauer} min · ${k.ergebnis ? `${punkteText(k.ergebnis.punkte)}/${k.ergebnis.max} Punkte` : k.start ? 'abgegeben' : 'noch nicht geschrieben'} · ${new Date(k.zeit * 1000).toLocaleDateString('de-DE')}`))))) : null);
}

function vorStart() {
  const k = z.k;
  const max = k.aufgaben.reduce((s, a) => s + a.punkte, 0);
  return h('div', { class: 'seite' },
    h('div', { class: 'deckblatt' },
      h('div', { class: 'ueberschrift-klein' }, 'Probeklausur'),
      h('h1', {}, k.thema),
      h('div', { class: 'werte' },
        h('div', {}, h('b', {}, `${k.dauer} min`), h('span', { class: 'leise klein' }, 'Bearbeitungszeit')),
        h('div', {}, h('b', {}, String(k.aufgaben.length)), h('span', { class: 'leise klein' }, 'Aufgaben')),
        h('div', {}, h('b', {}, String(max)), h('span', { class: 'leise klein' }, 'Punkte'))),
      h('ul', { class: 'regeln' },
        h('li', {}, 'Die Uhr startet mit „Los“ und läuft weiter, auch wenn du das Fenster schließt.'),
        h('li', {}, 'Hilfsmittel wie in deiner echten Klausur – sei ehrlich zu dir.'),
        h('li', {}, 'Bei Zeitablauf gibt Arena automatisch ab; macOS erinnert dich 5 Minuten vorher.')),
      h('div', { class: 'zeile', style: { justifyContent: 'center', gap: '10px' } },
        h('button', { class: 'knopf text', onclick: () => { z.k = null; zeichnen(); } }, 'Später'),
        h('button', { class: 'knopf gross', onclick: losgehen }, '⏱ Los geht’s'))));
}

function schreiben() {
  const k = z.k;
  const a = k.aufgaben[z.aktuell];
  const feld = h('textarea', { class: 'eingabe antwort', 'data-feld': 'antwort-' + z.aktuell, placeholder: 'Deine Lösung – Formeln in LaTeX: $x^2$', rows: 12 });
  feld.value = a.antwort;
  let plan = null;
  const vorschau = h('div', { class: 'vorschau' });
  const malen = () => vorschau.replaceChildren(a.antwort.trim() ? mdElement(a.antwort) : h('span', { class: 'leise klein' }, 'Vorschau'));
  feld.addEventListener('input', () => {
    a.antwort = feld.value;
    malen();
    clearTimeout(plan);
    plan = setTimeout(sichern, 800);
    const n = document.querySelector(`.nav-aufgabe[data-i="${z.aktuell}"]`);
    if (n) n.classList.toggle('bearbeitet', !!a.antwort.trim());
  });
  malen();
  return h('div', { class: 'schreib' },
    h('div', { class: 'leiste' },
      h('div', { class: 'fett' }, k.thema),
      h('span', { class: 'wachsen' }),
      h('div', { class: 'uhr', id: 'uhr' }, mmss(k.ende - jetzt())),
      h('button', { class: 'knopf', onclick: () => abgeben(false) }, 'Abgeben')),
    h('div', { class: 'schreib-mitte' },
      h('div', { class: 'nav' }, k.aufgaben.map((x, i) => h('button', {
        class: 'nav-aufgabe' + (i === z.aktuell ? ' an' : '') + (x.antwort.trim() ? ' bearbeitet' : ''), 'data-i': String(i),
        onclick: () => { z.aktuell = i; zeichnen(); },
      }, h('b', {}, `A${i + 1}`), h('span', { class: 'klein' }, `${x.punkte} P.`)))),
      h('div', { class: 'aufgabe-spalte' },
        h('div', { class: 'aufgabe-karte' },
          h('div', { class: 'zeile' }, h('div', { class: 'fett wachsen' }, `Aufgabe ${z.aktuell + 1}: ${a.titel}`), h('span', { class: 'etikett' }, `${a.punkte} Punkte`)),
          mdElement(a.aufgabe)),
        feld, vorschau,
        h('div', { class: 'zeile' },
          h('button', { class: 'knopf tonal', disabled: z.aktuell === 0, onclick: () => { z.aktuell--; zeichnen(); } }, '← Vorige'),
          h('span', { class: 'wachsen' }),
          h('span', { class: 'klein leise' }, 'Wird laufend gesichert'),
          h('button', { class: 'knopf tonal', disabled: z.aktuell === k.aufgaben.length - 1, onclick: () => { z.aktuell++; zeichnen(); } }, 'Nächste →')))));
}

function auswertung() {
  const k = z.k;
  const e = k.ergebnis;
  const offen = k.aufgaben.some((a) => !a.bewertung);
  return h('div', { class: 'seite' },
    h('div', { class: 'zeile', style: { marginBottom: '10px' } },
      h('button', { class: 'knopf text', onclick: () => { z.k = null; zeichnen(); } }, '← Alle Probeklausuren'),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf tonal', onclick: () => lyra.drucken() }, '🖨 Drucken / PDF')),
    e ? h('div', { class: 'ergebnis' },
      h('div', { class: 'note-gross' }, e.note),
      h('div', {},
        h('div', { class: 'fett', style: { fontSize: '18px' } }, `${punkteText(e.punkte)} von ${e.max} Punkten (${e.prozent} %)`),
        h('div', { class: 'leise klein' }, `${k.thema} · ${e.minuten} von ${k.dauer} Minuten genutzt · Notenschlüssel: ab 50 % bestanden`),
        lyra.balken(e.prozent / 100, e.prozent >= 50 ? '#16a34a' : '#dc2626'))) : null,
    offen || z.laeuft ? h('div', { class: 'flaeche spalte', style: { gap: '8px', margin: '12px 0' } },
      laufZeile(), fehlerZeile(),
      !z.laeuft ? h('button', { class: 'knopf', onclick: bewerten }, 'Weiter bewerten') : null) : null,
    k.aufgaben.map((a, i) => h('div', { class: 'aufgabe-karte bewertet' },
      h('div', { class: 'zeile' }, h('div', { class: 'fett wachsen' }, `Aufgabe ${i + 1}: ${a.titel}`),
        h('span', { class: 'etikett' + (a.bewertung ? (a.bewertung.punkte >= a.punkte * 0.8 ? ' gut' : a.bewertung.punkte >= a.punkte * 0.5 ? ' mittel' : ' schlecht') : '') },
          a.bewertung ? `${punkteText(a.bewertung.punkte)} / ${a.punkte}` : `– / ${a.punkte}`)),
      mdElement(a.aufgabe),
      h('div', { class: 'ueberschrift-klein', style: { marginTop: '10px' } }, 'Deine Antwort'),
      a.antwort.trim() ? h('div', { class: 'antwort-box' }, mdElement(a.antwort)) : h('div', { class: 'leise klein' }, '(leer)'),
      a.bewertung ? h('div', { class: 'kasten', style: { marginTop: '8px' } }, h('div', { class: 'titel' }, 'Korrektur'), mdElement(a.bewertung.begruendung),
        a.bewertung.tipp ? h('div', { class: 'klein', style: { marginTop: '4px' } }, `💡 ${a.bewertung.tipp}`) : null) : null,
      h('details', { class: 'muster' }, h('summary', {}, 'Musterlösung und Bewertungsschema'), mdElement(a.erwartung)))));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const wahl = (schl, opt) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...opt.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const ok = await lyra.dialog('Arena – Einstellungen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
    h('div', { class: 'fett' }, 'Im Stil meiner Altklausuren'), wahl('stil', [[true, 'Ja, danach suchen'], [false, 'Nein']]),
    h('div', { class: 'fett' }, 'Wer stellt und korrigiert'), wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']]),
    h('div', { class: 'leise klein' }, 'Zum Korrigieren gehen Aufgaben, Musterlösung und deine Antworten an den gewählten Anbieter. Mit Lyra (lokal) bleibt alles auf deinem Mac – die Bewertung ist dann aber weniger genau.')), [
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
