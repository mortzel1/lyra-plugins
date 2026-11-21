'use strict';
/*
 * Kompass – plant deine Lernzeit rückwärts von deinen Abgaben und Klausuren: wie viel Arbeit jede Frist braucht, wie viel
 * Zeit du an welchem Wochentag hast – daraus ein Wochenplan mit Blöcken zum Abhaken. Erinnert dich täglich (Mitteilung
 * von macOS) und zeigt auf Lyras Startseite, was heute dran ist. Alles lokal, ganz ohne KI.
 */
const { h } = lyra;

const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const STANDARD = {
  budget: { 0: 60, 1: 120, 2: 120, 3: 120, 4: 120, 5: 90, 6: 120 }, // Minuten je Wochentag (0 = Sonntag)
  uhrzeit: '17:00',
  abgabeStunden: 4,
  klausurStunden: 15,
  blockMin: 30,
  erinnern: true,
};
const FARBEN = ['#ea580c', '#2563eb', '#16a34a', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#475569'];

const z = {
  info: null,
  einst: structuredClone(STANDARD),
  fristen: [],
  daten: {}, // id → {stunden, geschafft (min), erledigt, ignoriert}
  ansicht: 'woche',
  wocheVersatz: 0,
  plan: null,
  fehler: null,
};
const app = document.getElementById('app');
const tagNr = (t) => { const d = new Date(t * 1000); d.setHours(12, 0, 0, 0); return Math.round(d.getTime() / 86400000); };
const tagDatum = (n) => new Date(n * 86400000);
const heute = () => tagNr(Date.now() / 1000);
const fristId = (f) => `${f.fach}|${f.titel}|${f.zeitpunkt}`.replace(/[^A-Za-z0-9ÄÖÜäöüß|]/g, '').slice(0, 80) + '-' + (f.zeitpunkt % 100000);
const minText = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const datumText = (n) => tagDatum(n).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });

function farbeFuer(fach) {
  let x = 0;
  for (const c of fach || '?') x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return FARBEN[x % FARBEN.length];
}
const datenVon = (f) => {
  const id = fristId(f);
  if (!z.daten[id]) z.daten[id] = { stunden: f.art === 'klausur' ? z.einst.klausurStunden : z.einst.abgabeStunden, geschafft: 0, erledigt: false, ignoriert: false };
  return z.daten[id];
};

// ================================================================== Planen (rückwärts von den Fristen)

/**
 * Verteilt die offene Arbeit jeder Frist auf die Tage davor. Früheste Frist zuerst; innerhalb einer Frist von hinten
 * nach vorn (rückwärts von der Frist) in gleich großen Portionen, damit nichts auf den letzten Tag fällt. Vor Klausuren
 * bleibt der Tag davor frei für Wiederholung; vor Abgaben am Vormittag zählt der Abgabetag nicht.
 */
function planen() {
  const h0 = heute();
  const frei = {}; // tag → Minuten frei
  const kap = (n) => (frei[n] ??= z.einst.budget[tagDatum(n).getDay()] || 0);
  const bloecke = {}; // tag → [{id, titel, fach, minuten, art}]
  const warnungen = [];
  const offen = z.fristen
    .map((f) => ({ f, d: datenVon(f) }))
    .filter(({ d }) => !d.erledigt && !d.ignoriert)
    .sort((a, b) => a.f.zeitpunkt - b.f.zeitpunkt);
  for (const { f, d } of offen) {
    let rest = Math.max(0, Math.round(d.stunden * 60 - d.geschafft));
    if (!rest) continue;
    const fristTag = tagNr(f.zeitpunkt);
    const stunde = new Date(f.zeitpunkt * 1000).getHours();
    const letzter = f.art === 'klausur' ? fristTag - 1 : stunde < 12 && !f.ganztags ? fristTag - 1 : fristTag;
    const tage = [];
    for (let n = h0; n <= letzter; n++) tage.push(n);
    if (!tage.length) {
      warnungen.push(`„${f.titel}“: keine Zeit mehr bis zur Frist.`);
      continue;
    }
    const portion = Math.max(z.einst.blockMin, Math.ceil(rest / tage.length / 15) * 15);
    const hinzu = (n, m) => {
      if (m <= 0) return 0;
      const nimm = Math.min(m, kap(n));
      if (nimm < 15) return 0;
      frei[n] -= nimm;
      (bloecke[n] ||= []).push({ id: fristId(f), titel: f.titel, fach: f.fach, minuten: nimm, art: f.art });
      return nimm;
    };
    // rückwärts: von der Frist zum heutigen Tag
    for (let i = tage.length - 1; i >= 0 && rest > 0; i--) rest -= hinzu(tage[i], Math.min(portion, rest));
    // was noch fehlt, wo noch Platz ist (wieder von hinten)
    for (let i = tage.length - 1; i >= 0 && rest > 0; i--) rest -= hinzu(tage[i], rest);
    if (rest > 0) warnungen.push(`„${f.titel}“: es fehlen ${minText(rest)} – mehr Zeit einplanen oder den Aufwand anpassen.`);
  }
  // gleiche Frist am gleichen Tag zusammenfassen
  for (const n of Object.keys(bloecke)) {
    const m = new Map();
    for (const b of bloecke[n]) {
      if (m.has(b.id)) m.get(b.id).minuten += b.minuten; else m.set(b.id, { ...b });
    }
    bloecke[n] = [...m.values()];
  }
  z.plan = { bloecke, warnungen };
}

// ================================================================== Speichern, Erinnern, Startseite

async function sichern() {
  try {
    await lyra.speicher.schreiben('daten', z.daten);
    await lyra.speicher.schreiben('einstellungen', z.einst);
  } catch (_) {}
  planen();
  nachaussen();
}

function heuteBloecke() {
  return (z.plan.bloecke[heute()] || []).filter((b) => !(z.erledigtHeute || {})[b.id]);
}

function nachaussen() {
  // Startseite: was heute dran ist
  const b = heuteBloecke();
  const ende = new Date(); ende.setHours(23, 59, 0, 0);
  const e = [];
  if (b.length) {
    const summe = b.reduce((a, x) => a + x.minuten, 0);
    e.push({ id: 'heute', titel: `Heute dran: ${minText(summe)}`, untertitel: b.map((x) => x.titel).slice(0, 3).join(' · '),
      route: 'heute', zeigen_bis: ende.getTime() / 1000, geaendert: Date.now() / 1000 });
  }
  const naechste = z.fristen.find((f) => !datenVon(f).erledigt && !datenVon(f).ignoriert);
  if (naechste) {
    const d = datenVon(naechste);
    e.push({ id: 'naechste', titel: `${naechste.art === 'klausur' ? 'Klausur' : 'Abgabe'}: ${naechste.titel}`,
      untertitel: `${naechste.wann} · ${Math.round((d.geschafft / (d.stunden * 60)) * 100) || 0} % geschafft`, route: 'fristen',
      fortschritt: Math.min(1, d.geschafft / (d.stunden * 60)), geaendert: Date.now() / 1000 - 60 });
  }
  lyra.startseite(e).catch(() => {});
  // Erinnerungen: jeden Plantag zur Wunschzeit, dazu der Abend vor jeder Frist
  if (!z.einst.erinnern) return lyra.erinnern([]).catch(() => {});
  const [hh, mm] = z.einst.uhrzeit.split(':').map(Number);
  const liste = [];
  for (let n = heute(); n < heute() + 14; n++) {
    const bl = z.plan.bloecke[n] || [];
    if (!bl.length) continue;
    const t = tagDatum(n); t.setHours(hh || 17, mm || 0, 0, 0);
    liste.push({ id: 'tag-' + n, titel: `Heute dran: ${minText(bl.reduce((a, x) => a + x.minuten, 0))}`,
      text: bl.map((x) => `${minText(x.minuten)} ${x.titel}`).join(' · '), zeit: Math.round(t.getTime() / 1000) });
  }
  for (const f of z.fristen.slice(0, 15)) {
    const d = datenVon(f);
    if (d.erledigt || d.ignoriert) continue;
    const t = tagDatum(tagNr(f.zeitpunkt) - 1); t.setHours(19, 0, 0, 0);
    liste.push({ id: 'vorher-' + fristId(f).slice(-12), titel: `Morgen: ${f.art === 'klausur' ? 'Klausur' : 'Abgabe'} ${f.titel}`,
      text: `${f.fach ? f.fach + ' · ' : ''}${f.termin}`, zeit: Math.round(t.getTime() / 1000) });
  }
  lyra.erinnern(liste).then((ok) => {
    if (!ok && !z.hinweisMitteilung) {
      z.hinweisMitteilung = 'Erinnerungen kommen nur, wenn Lyra in den Systemeinstellungen „Mitteilungen“ senden darf.';
      zeichnen();
    }
  }).catch(() => {});
}

// ================================================================== Start

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { route: '' }; }
  try {
    const e = (await lyra.speicher.lesen('einstellungen')) || {};
    z.einst = { ...structuredClone(STANDARD), ...e, budget: { ...STANDARD.budget, ...(e.budget || {}) } };
    z.daten = (await lyra.speicher.lesen('daten')) || {};
    const eh = (await lyra.speicher.lesen('heute')) || {};
    z.erledigtHeute = eh.tag === heute() ? eh.ids : {};
  } catch (_) {}
  try {
    z.fristen = (await lyra.fristen()).filter((f) => f.zeitpunkt > Date.now() / 1000);
  } catch (e) {
    z.fehler = String((e && e.message) || e);
  }
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route === 'fristen') z.ansicht = 'fristen';
  lyra.bei('zurueck', () => { if (!document.querySelector('.dialog-grund')) lyra.zurueck(); });
  lyra.bei('einstellungen', einstellungen);
  planen();
  zeichnen();
  nachaussen();
  if (route === 'einstellungen') einstellungen();
}

// ================================================================== Ansichten

function zeichnen() {
  app.replaceChildren(h('div', { class: 'seite kompass' }, kopf(), z.ansicht === 'fristen' ? fristenAnsicht() : wochenAnsicht()));
  lyra.titel(z.ansicht === 'fristen' ? 'Fristen & Aufwand' : 'Wochenplan');
}

function kopf() {
  const b = heuteBloecke();
  const summe = b.reduce((a, x) => a + x.minuten, 0);
  return h('div', {},
    h('div', { class: 'zeile' },
      h('div', { class: 'reiter' },
        h('button', { class: z.ansicht === 'woche' ? 'an' : '', onclick: () => { z.ansicht = 'woche'; zeichnen(); } }, '🗓 Wochenplan'),
        h('button', { class: z.ansicht === 'fristen' ? 'an' : '', onclick: () => { z.ansicht = 'fristen'; zeichnen(); } }, `🎯 Fristen (${z.fristen.length})`)),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf text', onclick: einstellungen }, '⚙ Zeit & Erinnerungen')),
    z.fehler ? h('div', { class: 'kasten falsch', style: { marginTop: '12px' } }, z.fehler) : null,
    z.hinweisMitteilung ? h('div', { class: 'kasten warn', style: { marginTop: '12px' } }, z.hinweisMitteilung) : null,
    h('div', { class: 'heute-karte' },
      h('div', { class: 'wachsen' },
        h('div', { class: 'ueberschrift-klein' }, 'Heute'),
        h('div', { class: 'gross' }, b.length ? `${minText(summe)} eingeplant` : z.fristen.length ? 'Heute ist nichts eingeplant 🌤' : 'Keine Fristen in Sicht 🎉'),
        b.length ? h('div', { class: 'heute-liste' }, b.map((x) => blockKnopf(heute(), x, true))) : null),
      h('div', { class: 'kompass-rose' }, '🧭')),
    z.plan.warnungen.length ? h('div', { class: 'kasten warn', style: { marginTop: '12px' } },
      h('div', { class: 'titel' }, '⚠ Die Zeit wird knapp'), z.plan.warnungen.map((w) => h('div', { class: 'klein' }, w))) : null);
}

function blockKnopf(n, b, gross) {
  const fertig = n === heute() && (z.erledigtHeute || {})[b.id];
  return h('button', {
    class: 'block' + (gross ? ' gross' : '') + (fertig ? ' fertig' : ''),
    style: { '--f': farbeFuer(b.fach) },
    title: n === heute() ? (fertig ? 'Erledigt – nochmal klicken zum Zurücknehmen' : 'Abhaken, wenn du es gemacht hast') : `${b.fach} · ${minText(b.minuten)}`,
    onclick: n === heute() ? () => abhaken(b) : null,
  }, h('span', { class: 'block-zeit' }, minText(b.minuten)), h('span', { class: 'block-titel' }, `${b.art === 'klausur' ? '📝 ' : ''}${b.titel}`),
  n === heute() ? h('span', { class: 'haken' }, fertig ? '✓' : '') : null);
}

async function abhaken(b) {
  const d = z.daten[b.id];
  z.erledigtHeute = z.erledigtHeute || {};
  const war = z.erledigtHeute[b.id];
  if (d) d.geschafft = Math.max(0, d.geschafft + (war ? -war : b.minuten));
  if (war) delete z.erledigtHeute[b.id]; else z.erledigtHeute[b.id] = b.minuten;
  try { await lyra.speicher.schreiben('heute', { tag: heute(), ids: z.erledigtHeute }); } catch (_) {}
  // Plan neu, aber die heute erledigten Blöcke bleiben sichtbar
  const heuteVorher = (z.plan.bloecke[heute()] || []).slice();
  await sichern();
  const jetztHeute = z.plan.bloecke[heute()] || [];
  for (const x of heuteVorher) if (z.erledigtHeute[x.id] && !jetztHeute.some((y) => y.id === x.id)) jetztHeute.push({ ...x, minuten: z.erledigtHeute[x.id] });
  z.plan.bloecke[heute()] = jetztHeute;
  zeichnen();
}

function wochenAnsicht() {
  const montag = (() => { const d = tagDatum(heute()); const wt = (d.getDay() + 6) % 7; return heute() - wt + z.wocheVersatz * 7; })();
  const tage = [...Array(7)].map((_, i) => montag + i);
  const fristenAm = (n) => z.fristen.filter((f) => tagNr(f.zeitpunkt) === n);
  return h('div', {},
    h('div', { class: 'zeile', style: { margin: '18px 0 10px' } },
      h('button', { class: 'knopf symbol', onclick: () => { z.wocheVersatz--; zeichnen(); }, disabled: z.wocheVersatz <= 0 }, '‹'),
      h('div', { class: 'fett' }, `${datumText(tage[0])} – ${datumText(tage[6])}`),
      h('button', { class: 'knopf symbol', onclick: () => { z.wocheVersatz++; zeichnen(); }, disabled: z.wocheVersatz >= 8 }, '›'),
      h('span', { class: 'wachsen' }),
      z.wocheVersatz ? h('button', { class: 'knopf text klein', onclick: () => { z.wocheVersatz = 0; zeichnen(); } }, 'Diese Woche') : null),
    h('div', { class: 'woche' }, tage.map((n) => {
      const bl = z.plan.bloecke[n] || [];
      const summe = bl.reduce((a, x) => a + x.minuten, 0);
      const budget = z.einst.budget[tagDatum(n).getDay()] || 0;
      return h('div', { class: 'tag' + (n === heute() ? ' heute' : '') + (n < heute() ? ' vorbei' : '') },
        h('div', { class: 'tag-kopf' }, h('b', {}, TAGE[tagDatum(n).getDay()]), h('span', { class: 'leise klein' }, tagDatum(n).getDate() + '.')),
        fristenAm(n).map((f) => h('div', { class: 'frist-marke', style: { '--f': farbeFuer(f.fach) }, title: f.termin }, `${f.art === 'klausur' ? '📝' : '📌'} ${f.titel}`)),
        bl.map((b) => blockKnopf(n, b, false)),
        h('div', { class: 'tag-fuss klein leise' }, budget ? `${minText(summe)} / ${minText(budget)}` : 'frei'));
    })),
    !z.fristen.length ? h('div', { class: 'leise', style: { marginTop: '16px' } },
      'Kompass findet deine Fristen in den Unterlagen, die Lyra liest (Übungsblätter, Notion, Moodle-Exporte). Sobald dort Abgaben oder Klausuren stehen, plant er sie hier ein.') : null);
}

function fristenAnsicht() {
  return h('div', { class: 'spalte', style: { marginTop: '16px', gap: '10px' } },
    h('div', { class: 'leise klein' }, 'Schätze, wie viele Stunden du für jede Frist brauchst – Kompass verteilt sie auf die Tage davor. Was du abhakst, zählt als geschafft.'),
    z.fristen.map((f) => {
      const d = datenVon(f);
      const anteil = d.stunden ? Math.min(1, d.geschafft / (d.stunden * 60)) : 0;
      const stellen = (delta) => { d.stunden = Math.max(0.5, Math.min(80, Math.round((d.stunden + delta) * 2) / 2)); sichern().then(zeichnen); };
      return h('div', { class: 'karte frist' + (d.erledigt || d.ignoriert ? ' blass' : ''), style: { '--f': farbeFuer(f.fach) } },
        h('div', { class: 'zeile oben' },
          h('div', { class: 'frist-streifen' }),
          h('div', { class: 'wachsen' },
            h('div', { class: 'fett' }, `${f.art === 'klausur' ? '📝 Klausur: ' : ''}${f.titel}`),
            h('div', { class: 'klein leise' }, `${f.fach ? f.fach + ' · ' : ''}${f.termin} · ${f.wann}${f.freiwillig ? ' · freiwillig' : ''}`),
            h('div', { class: 'zeile', style: { marginTop: '8px' } }, h('div', { class: 'wachsen' }, lyra.balken(anteil, farbeFuer(f.fach), true)),
              h('span', { class: 'klein leise' }, `${minText(Math.round(d.geschafft))} von ${minText(Math.round(d.stunden * 60))}`))),
          h('div', { class: 'aufwand' },
            h('button', { class: 'knopf symbol', onclick: () => stellen(-0.5), title: 'Weniger Aufwand' }, '−'),
            h('div', { class: 'mitte' }, h('b', {}, `${String(d.stunden).replace('.', ',')} h`), h('div', { class: 'klein leise' }, 'Aufwand')),
            h('button', { class: 'knopf symbol', onclick: () => stellen(0.5), title: 'Mehr Aufwand' }, '+'))),
        h('div', { class: 'zeile', style: { gap: '6px', marginTop: '6px' } },
          h('button', { class: 'chip' + (d.erledigt ? ' an' : ''), onclick: () => { d.erledigt = !d.erledigt; sichern().then(zeichnen); } }, d.erledigt ? '✓ Erledigt' : 'Erledigt'),
          h('button', { class: 'chip' + (d.ignoriert ? ' an' : ''), onclick: () => { d.ignoriert = !d.ignoriert; sichern().then(zeichnen); } }, d.ignoriert ? 'Nicht eingeplant' : 'Nicht einplanen')));
    }),
    !z.fristen.length ? h('div', { class: 'leise' }, 'Keine kommenden Fristen gefunden.') : null);
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = structuredClone(z.einst);
  const zeilen = [1, 2, 3, 4, 5, 6, 0].map((wt) => {
    const w = h('b', { class: 'budget-wert' }, minText(e.budget[wt]));
    const r = h('input', { type: 'range', min: 0, max: 480, step: 15, value: e.budget[wt] });
    r.addEventListener('input', () => { e.budget[wt] = Number(r.value); w.textContent = e.budget[wt] ? minText(e.budget[wt]) : 'frei'; });
    return h('div', { class: 'zeile' }, h('span', { style: { width: '28px' } }, TAGE[wt]), h('div', { class: 'wachsen' }, r), w);
  });
  const uhr = h('input', { class: 'eingabe', type: 'time', value: e.uhrzeit, style: { width: '130px' } });
  const wahl = (schl, opt) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...opt.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const ok = await lyra.dialog('Kompass – deine Zeit', h('div', { class: 'spalte', style: { minWidth: '440px', gap: '12px' } },
    h('div', { class: 'leise klein' }, 'Wie viel Lernzeit hast du an welchem Wochentag? Daran richtet Kompass den Plan aus.'),
    ...zeilen,
    h('div', { class: 'fett', style: { marginTop: '6px' } }, 'Tägliche Erinnerung'),
    wahl('erinnern', [[true, 'An'], [false, 'Aus']]),
    h('div', { class: 'zeile' }, h('span', {}, 'um'), uhr, h('span', { class: 'leise klein' }, 'Uhr – dazu am Abend vor jeder Frist')),
    h('div', { class: 'fett', style: { marginTop: '6px' } }, 'Aufwand für neue Fristen'),
    wahl('abgabeStunden', [[2, 'Abgabe 2 h'], [4, '4 h'], [6, '6 h'], [8, '8 h']]),
    wahl('klausurStunden', [[8, 'Klausur 8 h'], [15, '15 h'], [25, '25 h'], [40, '40 h']])), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  e.uhrzeit = uhr.value || '17:00';
  z.einst = e;
  await sichern();
  zeichnen();
}

start();
