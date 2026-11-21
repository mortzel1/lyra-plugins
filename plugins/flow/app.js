'use strict';
/*
 * Flow – Fokus-Timer (Pomodoro) mit Statistik. Die Uhr läuft weiter, auch wenn du das Fenster schließt (Start und Ende
 * stehen im Speicher); am Ende meldet sich macOS (Recht „erinnerungen“). Auf Lyras Startseite steht, was gerade läuft
 * und wie weit du heute bist. In der Pause: Durchatmen mit Oase (falls installiert).
 */
const { h } = lyra;

const STANDARD = { fokus: 25, kurz: 5, lang: 15, rundenBisLang: 4, ziel: 120, ton: true, autoWeiter: false, mitteilung: true };
const ARTEN = { fokus: ['Fokus', '🎯'], kurz: ['Kurze Pause', '☕'], lang: ['Lange Pause', '🌿'] };
const TIPPS = ['Steh kurz auf und streck dich.', 'Trink ein Glas Wasser.', 'Schau 20 Sekunden in die Ferne – gut für die Augen.',
  'Lüfte kurz das Zimmer.', 'Leg das Handy weg – auch in der Pause.', 'Ein paar tiefe Atemzüge: 4 ein, 6 aus.'];

const z = {
  info: null,
  einst: { ...STANDARD },
  lauf: null, // {art, start, ende, rest (s, wenn pausiert), thema}
  runde: 0,
  sitzungen: [], // [{start, minuten, thema}]
  ansicht: 'timer',
  thema: '',
  meldung: '',
  oase: false,
  takt: null,
};
const app = document.getElementById('app');
const jetzt = () => Date.now() / 1000;
const uhr = (t) => new Date(t * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const tagSchluessel = (t) => { const d = new Date(t * 1000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ Ton (weich, ohne Knacken)
let audio = null;
document.addEventListener('pointerdown', () => {
  if (!z.einst.ton) return;
  try { audio = audio || new AudioContext(); if (audio.state !== 'running') audio.resume(); } catch (_) {}
}, true);
function gong() {
  if (!z.einst.ton || !audio || audio.state !== 'running') return;
  const summe = audio.createGain();
  summe.gain.value = 0.3;
  summe.connect(audio.destination);
  [523.25, 783.99, 1046.5].forEach((f, i) => {
    const t = audio.currentTime + 0.02 + i * 0.18;
    const g = audio.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.015);
    g.gain.setTargetAtTime(0, t + 0.015, 0.35);
    g.connect(summe);
    const o = audio.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 2);
  });
}

// ------------------------------------------------------------------ Speichern

async function sichern() {
  try {
    await lyra.speicher.schreiben('lauf', z.lauf);
    await lyra.speicher.schreiben('runde', z.runde);
    await lyra.speicher.schreiben('sitzungen', z.sitzungen.slice(-3000));
  } catch (_) {}
  startseite();
}

function heuteMinuten() {
  const k = tagSchluessel(jetzt());
  return z.sitzungen.filter((s) => tagSchluessel(s.start) === k).reduce((a, s) => a + s.minuten, 0);
}

function startseite() {
  const e = [];
  const l = z.lauf;
  if (l && !l.rest) {
    e.push({ id: 'lauf', titel: l.art === 'fokus' ? `Fokus läuft${l.thema ? ': ' + l.thema : ''}` : `${ARTEN[l.art][0]} läuft`,
      untertitel: `bis ${uhr(l.ende)} Uhr`, route: '', zeigen_bis: l.ende, geaendert: l.start,
      fortschritt: Math.min(1, (jetzt() - l.start) / (l.ende - l.start)) });
  }
  const m = heuteMinuten();
  if (m > 0) {
    const ende = new Date(); ende.setHours(23, 59, 0, 0);
    e.push({ id: 'heute', titel: `Heute ${m} min fokussiert`, untertitel: m >= z.einst.ziel ? 'Tagesziel geschafft 🎉' : `Ziel: ${z.einst.ziel} min`,
      route: 'statistik', zeigen_bis: ende.getTime() / 1000, geaendert: jetzt(), fortschritt: Math.min(1, m / z.einst.ziel) });
  }
  lyra.startseite(e).catch(() => {});
}

async function erinnerungSetzen() {
  const l = z.lauf;
  if (!z.einst.mitteilung || !l || l.rest) return lyra.erinnern([]).catch(() => {});
  const naechste = l.art === 'fokus' ? naechsteArt(z.runde + 1) : 'fokus';
  const text = l.art === 'fokus'
    ? `Stark! Jetzt ${ARTEN[naechste][0].toLowerCase()} (${z.einst[naechste]} min).`
    : `Die Pause ist um – bereit für die nächste Fokus-Runde?`;
  try {
    const ok = await lyra.erinnern([{ id: 'ende', titel: l.art === 'fokus' ? 'Fokus-Runde geschafft 🎯' : 'Pause vorbei ☕', text, zeit: Math.round(l.ende) }]);
    if (!ok) z.meldung = 'Tipp: Erlaube Lyra in den Systemeinstellungen „Mitteilungen“, dann meldet sich Flow auch, wenn das Fenster zu ist.';
  } catch (_) {}
}

// ------------------------------------------------------------------ Ablauf

const naechsteArt = (runde) => (runde > 0 && runde % z.einst.rundenBisLang === 0 ? 'lang' : 'kurz');

async function starten(art) {
  const dauer = z.einst[art] * 60;
  z.lauf = { art, start: jetzt(), ende: jetzt() + dauer, rest: 0, thema: art === 'fokus' ? z.thema.trim() : '' };
  z.meldung = '';
  await sichern();
  erinnerungSetzen();
  zeichnen();
}

async function pausieren() {
  const l = z.lauf;
  if (!l) return;
  if (l.rest) {
    l.start = jetzt() - ((l.ende - l.start) - l.rest);
    l.ende = jetzt() + l.rest;
    l.rest = 0;
  } else {
    l.rest = l.ende - jetzt();
  }
  await sichern();
  erinnerungSetzen();
  zeichnen();
}

async function abbrechen() {
  const l = z.lauf;
  if (l && l.art === 'fokus' && !(await lyra.bestaetigen({ titel: 'Fokus-Runde abbrechen?', text: 'Die angefangene Zeit zählt nicht.', ja: 'Runde abbrechen', nein: 'Weitermachen', gefahr: true }))) return;
  z.lauf = null;
  await sichern();
  erinnerungSetzen();
  zeichnen();
}

/** Läuft die Uhr ab (auch während das Fenster zu war): festhalten, nächste Runde vorschlagen. */
async function pruefeEnde(stumm) {
  const l = z.lauf;
  if (!l || l.rest || jetzt() < l.ende) return false;
  if (l.art === 'fokus') {
    z.runde++;
    z.sitzungen.push({ start: l.start, minuten: Math.round((l.ende - l.start) / 60), thema: l.thema });
  }
  const war = l.art;
  const naechste = war === 'fokus' ? naechsteArt(z.runde) : 'fokus';
  z.lauf = null;
  z.meldung = war === 'fokus'
    ? (stumm ? `Während du weg warst, ist deine Fokus-Runde zu Ende gegangen ✓ – Runde ${z.runde} geschafft.` : `Runde ${z.runde} geschafft! 🎯`)
    : 'Pause vorbei – weiter geht’s.';
  z.vorschlag = naechste;
  await sichern();
  if (!stumm) gong();
  if (z.einst.autoWeiter && !stumm) return starten(naechste).then(() => true);
  zeichnen();
  return true;
}

// ------------------------------------------------------------------ Start

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  try {
    z.lauf = (await lyra.speicher.lesen('lauf')) || null;
    z.runde = (await lyra.speicher.lesen('runde')) || 0;
    z.sitzungen = (await lyra.speicher.lesen('sitzungen')) || [];
  } catch (_) {}
  try { z.oase = await lyra.installiert('oase'); } catch (_) {}
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route === 'statistik') z.ansicht = 'statistik';
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.ansicht !== 'timer') { z.ansicht = 'timer'; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  await pruefeEnde(true);
  zeichnen();
  startseite();
  z.takt = setInterval(ticken, 250);
  if (route === 'einstellungen') einstellungen();
}

function ticken() {
  const l = z.lauf;
  if (!l) return;
  if (!l.rest && jetzt() >= l.ende) { pruefeEnde(false); return; }
  const gesamt = l.ende - l.start;
  const rest = l.rest || l.ende - jetzt();
  const anteil = 1 - rest / gesamt;
  const t = document.getElementById('zeit');
  if (t) t.textContent = mmss(rest);
  const r = document.getElementById('ring');
  if (r) r.style.strokeDashoffset = String(UMFANG * (1 - anteil));
  document.title = `${mmss(rest)} · Flow`;
}

// ------------------------------------------------------------------ Ansichten

const UMFANG = 2 * Math.PI * 130;

function zeichnen() {
  app.replaceChildren(h('div', { class: 'flow ' + (z.lauf ? z.lauf.art : 'ruhe') }, z.ansicht === 'statistik' ? statistik() : timer()));
  lyra.titel(z.ansicht === 'statistik' ? 'Statistik' : z.lauf ? ARTEN[z.lauf.art][0] : '');
  ticken();
}

function ring(anteilStart) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('class', 'ring');
  const k = (r, cls) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', 150); c.setAttribute('cy', 150); c.setAttribute('r', r); c.setAttribute('class', cls); return c; };
  svg.append(k(130, 'spur'));
  const f = k(130, 'fortschritt');
  f.id = 'ring';
  f.style.strokeDasharray = String(UMFANG);
  f.style.strokeDashoffset = String(UMFANG * (1 - anteilStart));
  svg.append(f);
  return svg;
}

function timer() {
  const l = z.lauf;
  const m = heuteMinuten();
  const kopf = h('div', { class: 'kopfzeile' },
    h('div', { class: 'reiter' },
      h('button', { class: 'an' }, '⏱ Timer'),
      h('button', { onclick: () => { z.ansicht = 'statistik'; zeichnen(); } }, '📊 Statistik')),
    h('div', { class: 'heute' }, lyra.balken(m / z.einst.ziel, null, true), h('span', { class: 'klein leise' }, `Heute ${m} / ${z.einst.ziel} min`)));
  if (!l) {
    const vor = z.vorschlag || 'fokus';
    const themaFeld = h('input', { class: 'eingabe thema', placeholder: 'Woran arbeitest du? (optional, z. B. Analysis Blatt 5)', value: z.thema });
    themaFeld.addEventListener('input', () => { z.thema = themaFeld.value; });
    themaFeld.addEventListener('keydown', (e) => { if (e.key === 'Enter') starten('fokus'); });
    const zuletzt = [...new Set(z.sitzungen.slice().reverse().map((s) => s.thema).filter(Boolean))].slice(0, 6);
    return h('div', { class: 'mitte-spalte' }, kopf,
      z.meldung ? h('div', { class: 'kasten ok meldung' }, z.meldung) : null,
      h('div', { class: 'ring-box' }, ring(0), h('div', { class: 'ring-text' },
        h('div', { class: 'gross-zeit' }, `${z.einst[vor]}:00`),
        h('div', { class: 'leise' }, `${ARTEN[vor][1]} ${ARTEN[vor][0]}`))),
      vor === 'fokus' ? h('div', { class: 'spalte', style: { width: '100%', maxWidth: '460px', gap: '8px' } }, themaFeld,
        zuletzt.length ? h('div', { class: 'zeile umbruch', style: { gap: '6px', justifyContent: 'center' } },
          zuletzt.map((t) => h('button', { class: 'chip', onclick: () => { z.thema = t; zeichnen(); } }, t))) : null) : null,
      h('div', { class: 'zeile', style: { gap: '10px', justifyContent: 'center', marginTop: '6px' } },
        h('button', { class: 'knopf gross', onclick: () => starten(vor) }, vor === 'fokus' ? '▶ Fokus starten' : `▶ ${ARTEN[vor][0]} starten`),
        vor !== 'fokus' ? h('button', { class: 'knopf tonal gross', onclick: () => { z.vorschlag = 'fokus'; starten('fokus'); } }, 'Pause überspringen') : null),
      h('div', { class: 'klein leise', style: { marginTop: '4px' } }, `Runde ${z.runde % z.einst.rundenBisLang + 1} von ${z.einst.rundenBisLang} bis zur langen Pause`),
      vor !== 'fokus' ? pausenTipps() : null);
  }
  const pause = l.art !== 'fokus';
  return h('div', { class: 'mitte-spalte' }, kopf,
    h('div', { class: 'ring-box' }, ring(0), h('div', { class: 'ring-text' },
      h('div', { class: 'gross-zeit', id: 'zeit' }, mmss(l.rest || l.ende - jetzt())),
      h('div', { class: 'leise' }, `${ARTEN[l.art][1]} ${ARTEN[l.art][0]}${l.thema ? ' · ' + l.thema : ''}`),
      h('div', { class: 'klein leise' }, l.rest ? 'pausiert' : `bis ${uhr(l.ende)} Uhr`))),
    h('div', { class: 'zeile', style: { gap: '10px', justifyContent: 'center' } },
      h('button', { class: 'knopf gross', onclick: pausieren }, l.rest ? '▶ Weiter' : '⏸ Anhalten'),
      h('button', { class: 'knopf tonal gross', onclick: abbrechen }, pause ? 'Pause beenden' : '✕ Abbrechen')),
    pause ? pausenTipps() : h('div', { class: 'klein leise', style: { marginTop: '4px' } }, 'Du kannst das Fenster schließen – Flow läuft weiter und meldet sich am Ende.'));
}

function pausenTipps() {
  return h('div', { class: 'karte pause-karte' },
    h('div', { class: 'fett' }, '☕ Pause richtig nutzen'),
    h('div', { class: 'leise' }, TIPPS[Math.floor(jetzt() / 300) % TIPPS.length]),
    z.oase ? h('button', { class: 'knopf tonal', style: { marginTop: '8px' }, onclick: () => lyra.plugin('oase', 'atmen') }, '🌿 Durchatmen mit Oase') : null);
}

function statistik() {
  const tage = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const k = tagSchluessel(d.getTime() / 1000);
    tage.push({ name: d.toLocaleDateString('de-DE', { weekday: 'short' }), min: z.sitzungen.filter((s) => tagSchluessel(s.start) === k).reduce((a, s) => a + s.minuten, 0), heute: i === 0 });
  }
  const max = Math.max(z.einst.ziel, ...tage.map((t) => t.min));
  // Serie: Tage in Folge mit mindestens einer Runde
  let serie = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const k = tagSchluessel(d.getTime() / 1000);
    if (z.sitzungen.some((s) => tagSchluessel(s.start) === k)) serie++;
    else if (i > 0) break;
  }
  const woche = z.sitzungen.filter((s) => s.start > jetzt() - 7 * 86400);
  const proThema = {};
  for (const s of woche) proThema[s.thema || 'Ohne Thema'] = (proThema[s.thema || 'Ohne Thema'] || 0) + s.minuten;
  const themen = Object.entries(proThema).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const gesamt = z.sitzungen.reduce((a, s) => a + s.minuten, 0);
  const wert = (zahl, text) => h('div', { class: 'wert' }, h('b', {}, zahl), h('span', { class: 'leise klein' }, text));
  return h('div', { class: 'seite' },
    h('div', { class: 'kopfzeile' },
      h('div', { class: 'reiter' },
        h('button', { onclick: () => { z.ansicht = 'timer'; zeichnen(); } }, '⏱ Timer'),
        h('button', { class: 'an' }, '📊 Statistik'))),
    h('div', { class: 'werte' },
      wert(`${heuteMinuten()} min`, 'heute'),
      wert(`${woche.reduce((a, s) => a + s.minuten, 0)} min`, 'letzte 7 Tage'),
      wert(`🔥 ${serie}`, serie === 1 ? 'Tag in Folge' : 'Tage in Folge'),
      wert(`${(gesamt / 60).toFixed(1).replace('.', ',')} h`, 'insgesamt')),
    h('div', { class: 'flaeche', style: { marginTop: '14px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '10px' } }, 'Letzte 7 Tage'),
      h('div', { class: 'balken-tage' }, tage.map((t) => h('div', { class: 'tag' + (t.heute ? ' heute' : '') },
        h('div', { class: 'saeule-box' },
          h('div', { class: 'ziel-linie', style: { bottom: `${(z.einst.ziel / max) * 100}%` } }),
          h('div', { class: 'saeule' + (t.min >= z.einst.ziel ? ' voll' : ''), style: { height: `${(t.min / max) * 100}%` }, title: `${t.min} min` })),
        h('div', { class: 'klein' }, t.min ? `${t.min}` : '–'),
        h('div', { class: 'klein leise' }, t.name)))),
      h('div', { class: 'klein leise', style: { marginTop: '6px' } }, `Gestrichelt: dein Tagesziel (${z.einst.ziel} min)`)),
    h('div', { class: 'flaeche', style: { marginTop: '14px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '10px' } }, 'Woran du diese Woche gearbeitet hast'),
      themen.length ? themen.map(([t, m]) => h('div', { class: 'thema-zeile' },
        h('span', { class: 'wachsen' }, t), h('span', { class: 'klein leise' }, `${m} min`),
        h('div', { class: 'thema-balken' }, lyra.balken(m / themen[0][1], null, true))))
        : h('div', { class: 'leise' }, 'Noch keine Fokus-Runden diese Woche – starte deine erste!')));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const zahl = (schl, min, max, schritt, einheit) => {
    const w = h('b', {}, `${e[schl]} ${einheit}`);
    const r = h('input', { type: 'range', min, max, step: schritt, value: e[schl] });
    r.addEventListener('input', () => { e[schl] = Number(r.value); w.textContent = `${e[schl]} ${einheit}`; });
    return h('div', { class: 'zeile' }, h('div', { class: 'wachsen' }, r), w);
  };
  const wahl = (schl, opt) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...opt.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const gruppe = (t, inhalt) => h('div', { style: { marginBottom: '14px' } }, h('div', { class: 'fett', style: { marginBottom: '4px' } }, t), inhalt);
  const ok = await lyra.dialog('Flow – Einstellungen', h('div', { style: { minWidth: '420px' } },
    gruppe('Fokus-Runde', zahl('fokus', 10, 90, 5, 'min')),
    gruppe('Kurze Pause', zahl('kurz', 2, 20, 1, 'min')),
    gruppe('Lange Pause', zahl('lang', 10, 45, 5, 'min')),
    gruppe('Lange Pause nach', zahl('rundenBisLang', 2, 8, 1, 'Runden')),
    gruppe('Tagesziel', zahl('ziel', 25, 480, 25, 'min')),
    gruppe('Mitteilung am Ende (auch bei geschlossenem Fenster)', wahl('mitteilung', [[true, 'An'], [false, 'Aus']])),
    gruppe('Gong am Ende', wahl('ton', [[true, 'An'], [false, 'Aus']])),
    gruppe('Nächste Runde automatisch starten', wahl('autoWeiter', [[false, 'Nein'], [true, 'Ja']]))), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  erinnerungSetzen();
  startseite();
  zeichnen();
}

start();
