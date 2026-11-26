'use strict';
/*
 * Quizzard online – mit Lyra Campus (Recht „campus“). Quizzard selbst hat kein Netz: Lyra leitet alles weiter,
 * Ende-zu-Ende-verschlüsselt, und fragt vor dem Teilen selbst nach.
 *  - Aufgabe: Der Host teilt ein Quiz in einen Raum, jedes Mitglied spielt allein, das Ergebnis geht nur an den Host.
 *  - Live: Der Host steuert die Fragen, alle antworten gleichzeitig, nach jeder Frage gibt es die Rangliste.
 * Läuft im selben Kontext wie app.js (gemeinsame Variablen z, h, zeichnen …).
 */

const online2 = {
  kontext: null, // von lyra.campus.kontext(): {raum, rolle, host, ich, inhalt}
  quiz: null, // das geteilte Quiz
  status: '', // Senden des Ergebnisses: '' | 'senden' | 'gesendet' | Fehlertext
  eingaenge: [],
  mitglieder: [],
  // Live
  teilnehmer: {}, // von → name
  antworten: {}, // Frage → {von: {teil, punkte, ms, name}}
  punkte: {}, // von → Summe
  frage: -1,
  phase: 'lobby', // lobby | frage | aufloesung | ende
  zeitRest: 0,
  takt: null,
  letzteAufloesung: null,
  rangliste: [],
};

const istCampusAnsicht = (a) => ['campusAufgabe', 'campusHost', 'liveHost', 'liveWarten', 'liveAbgegeben', 'liveAufloesung', 'liveEnde'].includes(a);

// ================================================================== Teilen

/** Ein gespeichertes Quiz in einen Raum von Lyra Campus teilen – als Aufgabe oder Live-Runde. */
async function raumTeilen(q) {
  let raeume = [];
  try {
    raeume = await lyra.campus.raeume();
  } catch (e) {
    return lyra.toast(String((e && e.message) || e), 'fehler');
  }
  if (!raeume.length) {
    return lyra.dialog('Noch kein Raum',
      h('p', { class: 'leise', style: { lineHeight: 1.5, maxWidth: '420px' } },
        'Öffne in Lyra „Campus“ (das Personen-Symbol neben dem Eingabefeld), melde dich an und erstelle einen Raum für deine Klasse, Lerngruppe oder dein Team. Dann kannst du Quizze dort teilen.'),
      [{ text: 'OK', wert: true }]);
  }
  const wahl = { raum: (raeume.find((r) => r.host) || raeume[0]).id, modus: 'aufgabe', frist: '', pflicht: false };
  const inhalt = h('div', { class: 'spalte', style: { minWidth: '420px', gap: '14px' } });
  const malen = () => {
    const r = raeume.find((x) => x.id === wahl.raum);
    inhalt.replaceChildren(...[
      h('div', { class: 'zeile umbruch' },
        lyra.auswahl({ titel: 'Raum', symbol: '👥', optionen: raeume.map((x) => [x.id, x.name, `${x.mitglieder} Mitglieder${x.host ? ' · du bist Host' : ''}`]), wert: wahl.raum, beiWahl: (w) => { wahl.raum = w; malen(); }, breit: true }),
        lyra.auswahl({ titel: 'Als', optionen: [['aufgabe', '📝 Aufgabe', 'Jeder spielt allein, wann er will – Ergebnisse gehen an dich'], ['live', '⚡ Live-Runde', 'Alle gleichzeitig, du steuerst – mit Rangliste nach jeder Frage']], wert: wahl.modus, beiWahl: (w) => { wahl.modus = w; malen(); }, breit: true })),
      wahl.modus === 'aufgabe'
        ? h('label', { class: 'zeile', style: { gap: '8px' } }, h('span', { class: 'leise' }, 'Abgabe bis (optional)'),
          h('input', { type: 'date', class: 'eingabe', value: wahl.frist, oninput: (e) => { wahl.frist = e.target.value; } }))
        : null,
      wahl.modus === 'aufgabe'
        ? lyra.schalter({ wert: wahl.pflicht, beiWahl: (v) => { wahl.pflicht = v; }, text: 'Pflicht (Hausaufgabe)', unter: 'Steht bei allen unter „Abgaben“ – mit Frist auch auf Lyras Startseite.' })
        : null,
      h('div', { class: 'leise klein', style: { lineHeight: 1.5 } },
        `${q.fragen.length} Fragen gehen Ende-zu-Ende-verschlüsselt an ${r ? r.mitglieder : 'alle'} Mitglieder von „${r ? r.name : ''}“. `,
        q.fragen.some((f) => f.art === 'bild') ? 'Fotos der Bilderfragen lädt Quizzard bei den anderen selbst aus Wikipedia. ' : '',
        r && !r.host ? 'Du bist dort nicht Host – Ergebnisse bekommen Host und Co-Hosts.' : 'Ergebnisse siehst nur du (und Co-Hosts).'),
    ].filter(Boolean));
  };
  malen();
  const ok = await lyra.dialog(`„${q.thema}“ teilen`, inhalt, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Weiter', wert: true }]);
  if (!ok) return;
  const fragen = q.fragen.map((f) => ({ ...f }));
  try {
    await lyra.campus.teilen({
      raum: wahl.raum,
      typ: 'quiz',
      titel: q.thema,
      modus: wahl.modus,
      frist: wahl.frist ? new Date(wahl.frist + 'T23:59:00').getTime() : null,
      pflicht: wahl.modus === 'aufgabe' && wahl.pflicht,
      daten: { quiz: { thema: q.thema, fragen }, zeit: z.einst.zeit || 20 },
    });
    lyra.toast(wahl.modus === 'live' ? '✓ Geteilt – öffne die Live-Runde im Raum, um zu starten' : '✓ Geteilt – die Mitglieder finden das Quiz unter „Aufgaben“', 'ok');
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!/ABGEBROCHEN/.test(m)) lyra.toast(m, 'fehler');
  }
}

// ================================================================== Aus einem Raum geöffnet

/** Route „campus“: Was ist geteilt worden, und bin ich Host oder Mitglied? */
async function campusStarten() {
  let k = null;
  try { k = await lyra.campus.kontext(); } catch (_) {}
  if (!k || !k.inhalt || k.inhalt.typ !== 'quiz' || !k.inhalt.daten || !k.inhalt.daten.quiz) return false;
  online2.kontext = k;
  const q = k.inhalt.daten.quiz;
  online2.quiz = { id: 'campus-' + k.inhalt.id, thema: q.thema || k.inhalt.titel, fragen: q.fragen || [], zeit: lyra.jetzt(), gespielt: 0 };
  lyra.bei('campus', campusEreignis);
  await campusBilder(online2.quiz.fragen);
  const live = k.inhalt.modus === 'live';
  if (k.host) {
    z.ansicht = live ? 'liveHost' : 'campusHost';
    if (live) {
      online2.phase = 'lobby';
      try { await lyra.campus.live({ typ: 'lobby' }); } catch (e) { liveFehler(e); }
    }
    ergebnisseLaden();
  } else if (live) {
    z.ansicht = 'liveWarten';
    try { await lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde'); } catch (e) { liveFehler(e); }
  } else {
    z.ansicht = 'campusAufgabe';
    try { online2.meins = await lyra.speicher.lesen('campus/' + k.inhalt.id); } catch (_) {}
  }
  zeichnen();
  return true;
}

function liveFehler(e) {
  const m = String((e && e.message) || e);
  if (/ABGEBROCHEN/.test(m)) { z.ansicht = 'liveAbgelehnt'; online2.status = 'Ohne deine Zustimmung kann Quizzard nicht an der Live-Runde teilnehmen.'; }
  else lyra.toast(m, 'fehler');
}

/** Fotos der Bilderfragen: aus dem Speicher oder (bei geteilten Quizzen) frisch aus Wikipedia. */
async function campusBilder(fragen) {
  const fehlend = fragen.filter((f) => f.art === 'bild' && f.bild && f.bild.artikel && !z.bilder[f.bild.id]);
  for (const f of fehlend) {
    try { const d = await lyra.speicher.lesen('bilder/' + f.bild.id); if (d) z.bilder[f.bild.id] = d; } catch (_) {}
  }
  const noch = fehlend.filter((f) => !z.bilder[f.bild.id]);
  if (!noch.length) return;
  try {
    const l = await lyra.bilder(noch.map((f) => f.bild.artikel));
    for (const b of l || []) {
      const f = noch.find((x) => x.bild.artikel === b.begriff);
      if (f && b.gefunden && b.bild) z.bilder[f.bild.id] = b.bild;
    }
  } catch (_) {}
}

async function ergebnisseLaden() {
  try { online2.eingaenge = (await lyra.campus.eingaenge()) || []; } catch (_) {}
  try { online2.mitglieder = (await lyra.campus.mitglieder()) || []; } catch (_) {}
  if (istCampusAnsicht(z.ansicht)) zeichnen();
}

function campusEreignis(e) {
  if (!e) return;
  const k = online2.kontext;
  if (e.art === 'ergebnis') {
    const d = e.daten || {};
    if (k && k.inhalt.modus === 'live') return liveEingang(e.von, e.name, d);
    ergebnisseLaden();
    lyra.toast(`📥 Ergebnis von ${e.name}`, 'ok');
    return;
  }
  if (e.art === 'live' && k && !k.host) liveVomHost(e.daten || {});
}

// ================================================================== Aufgabe: Mitglied

async function aufgabeStarten() {
  online2.status = '';
  await spielStarten(online2.quiz);
  if (z.spiel) z.spiel.campus = true;
}

/** Nach dem letzten Spiel: Ergebnis an den Host (Lyra fragt einmal nach). */
async function campusAbgeben(s) {
  const richtig = s.antworten.filter((a) => a.teil >= 0.999).length;
  const daten = {
    punkte: s.punkte, richtig, anzahl: s.fragen.length,
    dauer: Math.round((Date.now() - s.start) / 1000),
    // Je Frage im geteilten Quiz (Reihenfolge des Hosts): Anteil richtig und Punkte
    antworten: online2.quiz.fragen.map((f) => { const i = s.fragen.findIndex((x) => x.frage === f.frage); const a = i >= 0 ? s.antworten[i] : null; return a ? { teil: a.teil, punkte: a.punkte } : null; }),
  };
  online2.status = 'senden';
  zeichnen();
  try {
    await lyra.campus.anHost(daten, 'Dein Ergebnis');
    online2.status = 'gesendet';
    online2.meins = { ...daten, zeit: lyra.jetzt() };
    try { await lyra.speicher.schreiben('campus/' + online2.kontext.inhalt.id, online2.meins); } catch (_) {}
  } catch (e) {
    const m = String((e && e.message) || e);
    online2.status = /ABGEBROCHEN/.test(m) ? 'Nicht gesendet – du hast abgelehnt.' : m;
  }
  zeichnen();
}

function campusStatusBox() {
  const s = online2.status;
  const host = online2.kontext ? online2.kontext.inhalt.name : 'den Host';
  if (s === 'senden') return h('div', { class: 'meldung' }, `📤 Ergebnis geht verschlüsselt an ${host} …`);
  if (s === 'gesendet') return h('div', { class: 'meldung ok' }, `✓ Dein Ergebnis ist bei ${host} angekommen – nur dort sichtbar.`);
  if (s) return h('div', { class: 'meldung' }, '⚠︎ ' + s, ' ', h('button', { class: 'knopf tonal klein', onclick: () => campusAbgeben(z.spiel) }, 'Nochmal senden'));
  return null;
}

function aufgabeAnsicht() {
  const k = online2.kontext, q = online2.quiz, m = online2.meins;
  const frist = k.inhalt.frist ? new Date(k.inhalt.frist) : null;
  const vorbei = frist && frist.getTime() < Date.now();
  return h('div', { class: 'bereit' },
    h('div', { style: { fontSize: '58px' } }, '📝'),
    h('div', { class: 'logo', style: { fontSize: '38px', marginTop: '6px' } }, q.thema),
    h('div', { class: 'slogan' }, `Aufgabe von ${k.inhalt.name} in „${k.raum.name}“ · ${q.fragen.length} Fragen`),
    frist ? h('div', { class: 'pill', style: { display: 'inline-block', margin: '4px 0 12px' } }, `${vorbei ? '⏰ Abgabe war bis' : '📅 Abgabe bis'} ${frist.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}`) : null,
    m ? h('div', { class: 'meldung', style: { maxWidth: '520px', margin: '10px auto' } }, `✓ Du hast schon abgegeben: ${m.richtig}/${m.anzahl} richtig, ${zahlFormat(m.punkte)} Punkte. Spielst du nochmal, zählt beim Host dein neuestes Ergebnis.`) : null,
    h('div', { class: 'zeile', style: { justifyContent: 'center', margin: '8px 0 18px' } }, zeitlimitZeile()),
    h('button', { class: 'knopf riesig', onclick: aufgabeStarten }, m ? 'Nochmal spielen ▶' : 'Los geht’s ▶'),
    h('div', { class: 'leise klein', style: { marginTop: '16px', lineHeight: 1.5 } }, 'Am Ende fragt Lyra, ob dein Ergebnis an den Host gehen darf – verschlüsselt und nur an Host und Co-Hosts.'));
}

// ================================================================== Aufgabe: Host (Ergebnisse)

function hostAnsicht() {
  const k = online2.kontext, q = online2.quiz;
  const ein = online2.eingaenge.filter((e) => e.daten && typeof e.daten.punkte === 'number');
  const andere = online2.mitglieder.filter((m) => !m.ich && m.rolle === 'mitglied');
  const offen = andere.filter((m) => !ein.some((e) => e.von === m.id));
  const schnitt = ein.length ? ein.reduce((s, e) => s + e.daten.richtig / Math.max(1, e.daten.anzahl), 0) / ein.length : 0;
  const jeFrage = q.fragen.map((f, i) => {
    const l = ein.map((e) => e.daten.antworten && e.daten.antworten[i]).filter(Boolean);
    return { f, anteil: l.length ? l.filter((a) => a.teil >= 0.999).length / l.length : null };
  });
  const dauer = (sek) => `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
  return h('div', {},
    h('div', { class: 'zeile', style: { alignItems: 'flex-end', marginBottom: '14px' } },
      h('div', { class: 'wachsen' },
        h('div', { class: 'leise klein' }, `📝 Aufgabe in „${k.raum.name}“`),
        h('div', { class: 'logo', style: { fontSize: '34px', textAlign: 'left' } }, q.thema)),
      h('button', { class: 'knopf tonal', onclick: () => spielStarten(online2.quiz) }, 'Selbst ausprobieren ▶'),
      ein.length ? h('button', { class: 'knopf tonal', onclick: ergebnisseSichern }, '⬇ CSV') : null),
    h('div', { class: 'werte', style: { justifyContent: 'flex-start' } },
      h('div', { class: 'wert' }, h('b', {}, `${ein.length}${andere.length ? '/' + andere.length : ''}`), 'abgegeben'),
      h('div', { class: 'wert' }, h('b', {}, ein.length ? `${Math.round(schnitt * 100)} %` : '–'), 'richtig im Schnitt'),
      h('div', { class: 'wert' }, h('b', {}, String(q.fragen.length)), 'Fragen')),
    lyra.abschnitt('Ergebnisse', ein.length
      ? h('table', { class: 'tabelle' },
        h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Richtig'), h('th', {}, 'Punkte'), h('th', {}, 'Zeit'), h('th', {}, 'Abgegeben')),
        ein.slice().sort((a, b) => b.daten.punkte - a.daten.punkte).map((e) => h('tr', {},
          h('td', { class: 'fett' }, e.name),
          h('td', {}, `${e.daten.richtig}/${e.daten.anzahl}`),
          h('td', {}, zahlFormat(e.daten.punkte)),
          h('td', {}, dauer(e.daten.dauer || 0)),
          h('td', { class: 'leise' }, lyra.zeitText(Math.floor((e.zeit || 0) / 1000))))))
      : h('p', { class: 'leise' }, 'Noch keine Abgaben. Sobald jemand fertig ist, erscheint das Ergebnis hier – verschlüsselt, nur für dich.')),
    offen.length ? h('div', { class: 'leise klein', style: { marginTop: '8px' } }, `Noch offen: ${offen.map((m) => m.name).join(', ')}`) : null,
    ein.length ? lyra.abschnitt('Welche Fragen waren schwer?', h('div', { class: 'spalte' }, jeFrage.map(({ f, anteil }, i) =>
      h('div', { class: 'frage-statistik' },
        h('div', { class: 'zeile' }, h('span', { class: 'fett' }, `${i + 1}.`), h('div', { class: 'wachsen' }, mdElement(f.frage)), h('span', { class: 'fett' }, anteil === null ? '–' : `${Math.round(anteil * 100)} %`)),
        lyra.balken(anteil || 0, anteil === null ? null : anteil >= 0.7 ? 'var(--ok)' : anteil >= 0.4 ? 'var(--warnung)' : 'var(--falsch)', true))))) : null);
}

async function ergebnisseSichern() {
  const q = online2.quiz;
  const zeilen = [['Name', 'Richtig', 'Fragen', 'Punkte', 'Zeit (s)', ...q.fragen.map((_, i) => `Frage ${i + 1}`)]];
  for (const e of online2.eingaenge) {
    const d = e.daten || {};
    zeilen.push([e.name, d.richtig, d.anzahl, d.punkte, d.dauer, ...q.fragen.map((_, i) => { const a = d.antworten && d.antworten[i]; return a ? (a.teil >= 0.999 ? 'richtig' : a.teil > 0 ? 'teils' : 'falsch') : ''; })]);
  }
  const csv = zeilen.map((z2) => z2.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  try { if (await lyra.speichern(`Ergebnisse ${q.thema}.csv`, '﻿' + csv)) lyra.toast('✓ Gesichert', 'ok'); } catch (e) { lyra.toast(String(e.message || e), 'fehler'); }
}

// ================================================================== Live: Host

function liveEingang(von, name, d) {
  if (d.typ === 'da') {
    online2.teilnehmer[von] = name;
  } else if (d.typ === 'antwort' && d.i === online2.frage && online2.phase === 'frage') {
    online2.teilnehmer[von] = name;
    const l = (online2.antworten[d.i] = online2.antworten[d.i] || {});
    if (!l[von]) l[von] = { teil: Number(d.teil) || 0, punkte: Math.max(0, Math.min(3000, Number(d.punkte) || 0)), ms: d.ms, name };
    if (Object.keys(l).length >= Object.keys(online2.teilnehmer).length) setTimeout(aufloesen, 600);
  }
  if (z.ansicht === 'liveHost') zeichnen();
}

async function liveSenden(daten) {
  try { await lyra.campus.live(daten); return true; } catch (e) { liveFehler(e); return false; }
}

async function liveFrage(i) {
  const f = online2.quiz.fragen[i];
  if (!f) return liveEnde();
  online2.frage = i;
  online2.phase = 'frage';
  online2.antworten[i] = {};
  const zeit = (online2.kontext.inhalt.daten.zeit || 20) * (['reihenfolge', 'zuordnen', 'luecke'].includes(f.art) ? 1.5 : 1);
  online2.zeitRest = zeit;
  zeichnen();
  if (!(await liveSenden({ typ: 'frage', i, zeit }))) return;
  clearInterval(online2.takt);
  online2.takt = setInterval(() => {
    online2.zeitRest = Math.max(0, online2.zeitRest - 1);
    if (online2.zeitRest <= 0) { clearInterval(online2.takt); setTimeout(aufloesen, 1500); }
    if (z.ansicht === 'liveHost') zeichnen();
  }, 1000);
}

function rangliste() {
  const summe = {};
  for (const [von, name] of Object.entries(online2.teilnehmer)) summe[von] = { name, punkte: 0 };
  for (const l of Object.values(online2.antworten)) for (const [von, a] of Object.entries(l)) { summe[von] = summe[von] || { name: a.name, punkte: 0 }; summe[von].punkte += a.punkte; }
  return Object.values(summe).sort((a, b) => b.punkte - a.punkte);
}

async function aufloesen() {
  if (online2.phase !== 'frage') return;
  clearInterval(online2.takt);
  const i = online2.frage;
  const f = online2.quiz.fragen[i];
  const l = Object.values(online2.antworten[i] || {});
  online2.phase = 'aufloesung';
  online2.rangliste = rangliste();
  zeichnen();
  await liveSenden({ typ: 'aufloesung', i, loesung: loesungTextRoh(f), richtig: l.filter((a) => a.teil >= 0.999).length, gesamt: l.length, rangliste: online2.rangliste.slice(0, 10) });
}

async function liveEnde() {
  online2.phase = 'ende';
  online2.rangliste = rangliste();
  zeichnen();
  await liveSenden({ typ: 'ende', rangliste: online2.rangliste });
  konfetti(120);
  ton('ende');
}

/** Lösungstext ohne vorbereitete (gemischte) Felder – aus dem geteilten Quiz. */
function loesungTextRoh(f) {
  if (f.art === 'reihenfolge') return 'Reihenfolge: ' + (f.optionen || []).join(' → ');
  return loesungText(f);
}

function liveHostAnsicht() {
  const k = online2.kontext, q = online2.quiz;
  const n = Object.keys(online2.teilnehmer).length;
  const i = online2.frage;
  const f = q.fragen[i];
  const kopf = h('div', { class: 'zeile', style: { marginBottom: '14px' } },
    h('div', { class: 'wachsen' }, h('div', { class: 'leise klein' }, `⚡ Live-Runde in „${k.raum.name}“`), h('div', { class: 'logo', style: { fontSize: '30px', textAlign: 'left' } }, q.thema)),
    h('span', { class: 'pill' }, `👥 ${n} dabei`));
  if (online2.phase === 'lobby') {
    return h('div', {}, kopf,
      h('div', { class: 'panel', style: { textAlign: 'center', padding: '28px' } },
        h('div', { style: { fontSize: '46px' } }, '🎮'),
        h('h2', {}, n ? `${n} ${n === 1 ? 'Person ist' : 'Personen sind'} bereit` : 'Warte auf Mitspieler …'),
        h('p', { class: 'leise', style: { margin: '8px 0 16px' } }, 'Die Mitglieder öffnen die Live-Runde im Raum (Reiter „Aufgaben“ → „Mitmachen“).'),
        h('div', { class: 'zeile umbruch', style: { justifyContent: 'center', gap: '6px', marginBottom: '18px' } }, Object.values(online2.teilnehmer).map((name) => h('span', { class: 'pill' }, name))),
        h('button', { class: 'knopf riesig', onclick: () => liveFrage(0) }, `Runde starten ▶ (${q.fragen.length} Fragen)`)));
  }
  if (online2.phase === 'ende') return liveRanglisteAnsicht('🏆 Endstand', online2.rangliste, kopf);
  const antworten = Object.keys(online2.antworten[i] || {}).length;
  return h('div', {}, kopf,
    h('div', { class: 'zeile', style: { marginBottom: '10px' } }, h('span', { class: 'pill' }, `Frage ${i + 1} / ${q.fragen.length}`),
      online2.phase === 'frage' ? h('span', { class: 'pill' }, `⏱ ${online2.zeitRest} s`) : null, h('span', { class: 'wachsen' }),
      h('span', { class: 'pill' }, `✍️ ${antworten}/${n} geantwortet`)),
    h('div', { class: 'frage-box' + (f.art === 'bild' ? ' mit-foto' : '') }, h('div', { class: 'typ' }, TYPEN[f.art][0]),
      f.art === 'bild' && f.bild && z.bilder[f.bild.id] ? foto(f, online2.phase !== 'frage') : null, mdElement(f.frage)),
    online2.phase === 'aufloesung' ? h('div', { class: 'meldung ok' }, mdElement(loesungTextRoh(f))) : null,
    online2.phase === 'frage'
      ? h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '16px' } }, h('button', { class: 'knopf tonal', onclick: aufloesen }, 'Jetzt auflösen'))
      : h('div', {},
        liveRanglisteAnsicht('Zwischenstand', online2.rangliste.slice(0, 10)),
        h('div', { class: 'zeile', style: { justifyContent: 'center', marginTop: '16px' } },
          h('button', { class: 'knopf riesig', onclick: () => liveFrage(i + 1) }, i + 1 < q.fragen.length ? 'Nächste Frage →' : 'Zum Endstand 🏁'))));
}

function liveRanglisteAnsicht(titel, l, kopf, ich) {
  return h('div', {}, kopf || null,
    h('div', { class: 'panel rangliste' }, h('h3', { style: { marginBottom: '8px' } }, titel),
      l.length ? l.map((r, i) => h('div', { class: 'zeile rang' + (ich && r.name === ich ? ' ich' : '') },
        h('span', { class: 'platz' }, i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`),
        h('span', { class: 'wachsen fett' }, r.name), h('span', { class: 'fett' }, zahlFormat(r.punkte))))
        : h('p', { class: 'leise' }, 'Noch keine Punkte.')));
}

// ================================================================== Live: Mitglied

function liveVomHost(d) {
  const q = online2.quiz;
  if (d.typ === 'frage' && q.fragen[d.i]) {
    if (!z.spiel || !z.spiel.live) {
      z.spiel = { quiz: online2.quiz, fragen: q.fragen.map((f) => vorbereiten(f)), antworten: [], punkte: 0, serie: 0, besteSerie: 0, start: Date.now(), joker: { fuenfzig: 0, zeit: 0, ueberspringen: 0 }, live: true };
    }
    z.pos = d.i;
    online2.frage = d.i;
    online2.liveZeit = d.zeit;
    liveFrageZeigen(d.zeit);
  } else if (d.typ === 'aufloesung') {
    online2.letzteAufloesung = d;
    online2.rangliste = d.rangliste || [];
    if (z.ansicht === 'frage') { stoppeTimer(); abgeben(true); }
    z.ansicht = 'liveAufloesung';
    zeichnen();
  } else if (d.typ === 'ende') {
    online2.rangliste = d.rangliste || [];
    z.ansicht = 'liveEnde';
    konfetti(100);
    ton('ende');
    zeichnen();
  } else if (d.typ === 'lobby' && z.ansicht === 'liveWarten') {
    lyra.campus.anHost({ typ: 'da' }, 'Deine Teilnahme an der Live-Runde').catch(() => {});
  }
}

/** Eine Frage der Live-Runde zeigen – mit der Zeit, die der Host vorgibt. */
function liveFrageZeigen(zeit) {
  const sicher = z.einst.zeit;
  z.einst.zeit = zeit / (['reihenfolge', 'zuordnen', 'luecke'].includes(z.spiel.fragen[z.pos].art) ? 1.5 : 1);
  online2.fragStart = Date.now();
  frageZeigen();
  z.einst.zeit = sicher;
}

/** Aus abgeben(): Antwort an den Host statt der eigenen Auflösung. */
async function liveAbgegeben(teil, punkte) {
  z.ansicht = 'liveAbgegeben';
  online2.meineAntwort = { i: z.pos, teil, punkte };
  zeichnen();
  try {
    await lyra.campus.anHost({ typ: 'antwort', i: z.pos, teil, punkte, ms: Date.now() - (online2.fragStart || Date.now()) }, 'Deine Antworten in dieser Live-Runde');
  } catch (e) { liveFehler(e); }
}

function liveMitgliedAnsicht() {
  const k = online2.kontext, q = online2.quiz;
  const ich = k.ich && k.ich.name;
  const kopf = h('div', { class: 'leise klein', style: { marginBottom: '10px' } }, `⚡ Live-Runde „${q.thema}“ in „${k.raum.name}“ · Host: ${k.inhalt.name}`);
  switch (z.ansicht) {
    case 'liveWarten':
      return h('div', { class: 'bereit' }, kopf, h('div', { style: { fontSize: '60px' } }, '⏳'), h('div', { class: 'logo', style: { fontSize: '34px' } }, 'Gleich geht’s los!'),
        h('div', { class: 'slogan' }, `${q.fragen.length} Fragen · ${k.inhalt.name} startet die Runde`));
    case 'liveAbgegeben':
      return h('div', { class: 'bereit' }, kopf, h('div', { style: { fontSize: '56px' } }, '📨'), h('div', { class: 'logo', style: { fontSize: '32px' } }, 'Antwort abgegeben'),
        h('div', { class: 'slogan' }, 'Warte auf die Auflösung …'));
    case 'liveAufloesung': {
      const a = online2.letzteAufloesung || {};
      const m = online2.meineAntwort && online2.meineAntwort.i === a.i ? online2.meineAntwort : null;
      const gut = m && m.teil >= 0.999;
      const platz = online2.rangliste.findIndex((r) => r.name === ich);
      return h('div', {}, kopf,
        h('div', { class: 'ergebnis-box ' + (gut ? 'gut' : 'schlecht') },
          h('div', { class: 'gross' }, m ? (gut ? 'Richtig! 🎉' : m.teil > 0 ? 'Fast! 👌' : 'Leider nicht 🙈') : '⏰ Keine Antwort'),
          m && m.punkte ? h('div', { class: 'punkte-plus' }, `+${zahlFormat(m.punkte)}`) : null,
          h('div', { style: { marginTop: '8px' } }, mdElement(a.loesung || '')),
          h('div', { class: 'leise klein', style: { marginTop: '6px' } }, `${a.richtig || 0} von ${a.gesamt || 0} richtig`)),
        platz >= 0 ? h('div', { class: 'slogan' }, `Du bist auf Platz ${platz + 1}`) : null,
        liveRanglisteAnsicht('Zwischenstand', online2.rangliste.slice(0, 10), null, ich));
    }
    case 'liveEnde': {
      const platz = online2.rangliste.findIndex((r) => r.name === ich);
      return h('div', { class: 'podest' }, kopf, h('div', { style: { fontSize: '70px' } }, platz === 0 ? '🏆' : platz >= 0 && platz < 3 ? '🥈' : '🎉'),
        h('div', { class: 'logo', style: { fontSize: '34px' } }, platz >= 0 ? `Platz ${platz + 1}` : 'Runde vorbei'),
        liveRanglisteAnsicht('🏆 Endstand', online2.rangliste, null, ich));
    }
    case 'liveAbgelehnt':
      return h('div', { class: 'bereit' }, h('div', { style: { fontSize: '56px' } }, '🔒'), h('p', { class: 'leise' }, online2.status));
  }
  return null;
}

/** Ansicht für die Campus-Zustände (von ansicht() in app.js aufgerufen). */
function campusAnsicht() {
  switch (z.ansicht) {
    case 'campusAufgabe': return aufgabeAnsicht();
    case 'campusHost': return hostAnsicht();
    case 'liveHost': return liveHostAnsicht();
    default: return liveMitgliedAnsicht();
  }
}
