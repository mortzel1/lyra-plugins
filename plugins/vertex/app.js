'use strict';
/*
 * Vertex – Grafikrechner. Hier: Blätter, Ausdrucksliste, Zeichenfläche (Ziehen, Zoomen, Spur, Punkte ziehen),
 * Rückgängig und Start. Rechnen: mathe.js · Zeichnen: grafik.js · Analyse, Werkzeuge, KI, Export, Chat, Fusion: werkzeuge.js
 */
const { h } = lyra;
const STANDARD = { raster: true, achsen: true, pi: false, gleich: true, beschriftung: true, ki: 'auto' };
const NAMEN = ['f', 'g', 'h', 'p', 'q', 'k', 'u', 'v', 'w', 's', 'm', 'n'];
const ZWEI_PI = 2 * Math.PI;
const app = document.getElementById('app');

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  blatt: null,
  liste: [],
  deutung: { deutungen: new Map(), werte: {}, defs: new Map() },
  regression: new Map(), // id der Tabelle → Ergebnis
  auswahl: null, // Zeile, die rechts untersucht wird
  fokus: null, // Zeile mit Eingabefokus
  zeilen: new Map(), // id → {el, feld, anzeige, status}
  reiter: 'diskussion',
  spur: null,
  hover: null, // Markierung unter dem Zeiger
  festMarker: new Set(),
  zug: null,
  verlauf: [],
  zukunft: [],
  fokusVorher: null,
  laufend: null, // Parameter-Animation {id, richtung}
  leinwand: null,
  ctx: null,
};

const dialogZu = () => { const g = document.querySelector('.dialog-grund'); if (g) g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); };
const formel = (tex) => {
  try { if (window.temml) return window.temml.renderToString(tex, { throwOnError: false, displayMode: false }); } catch (_) {}
  return lyra.esc(tex);
};
const deutsch = (v, stellen = 4) => Mathe.zahlKurz(v, stellen);
/** Zahl für Eingabezeilen (Komma, ohne überflüssige Stellen) */
const eingabeZahl = (v, stellen = 4) => {
  const r = Number(v.toFixed(stellen));
  return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
};

// ================================================================== Blätter: neu, sichern, Rückgängig

function neueZeile(text = '', extra = {}) {
  return { id: lyra.neueId() + Math.floor(Math.random() * 1000), text, farbe: freieFarbe(), sichtbar: true, strich: 'voll', ...extra };
}
function freieFarbe() {
  const benutzt = z.blatt ? z.blatt.eintraege.map((e) => e.farbe) : [];
  return Grafik.FARBEN.find((f) => !benutzt.includes(f)) || Grafik.FARBEN[(benutzt.length) % Grafik.FARBEN.length];
}
function neuesBlatt(name = 'Neues Blatt', texte = ['']) {
  const b = { id: lyra.neueId(), name, zeit: lyra.jetzt(), eintraege: [], ansicht: null };
  const vorher = z.blatt;
  z.blatt = b;
  texte.forEach((t) => b.eintraege.push(neueZeile(t)));
  z.blatt = vorher;
  return b;
}
function freierName() {
  const belegt = new Set();
  for (const e of z.blatt.eintraege) {
    const m = /^\s*([A-Za-z](?:_\w+)?)\s*\(/.exec(e.text || '');
    if (m) belegt.add(m[1]);
  }
  return NAMEN.find((n) => !belegt.has(n)) || 'f_' + (z.blatt.eintraege.length + 1);
}

let sichernPlan = null;
function sichern() {
  clearTimeout(sichernPlan);
  sichernPlan = setTimeout(async () => {
    const b = z.blatt;
    b.zeit = lyra.jetzt();
    try {
      await lyra.speicher.schreiben('blaetter/' + b.id, b);
      await lyra.speicher.schreiben('zuletzt', b.id);
    } catch (_) {}
    const kurz = { id: b.id, name: b.name, zeit: b.zeit, n: b.eintraege.filter((e) => e.text || e.art).length };
    const i = z.liste.findIndex((x) => x.id === b.id);
    if (i >= 0) z.liste[i] = kurz; else z.liste.unshift(kurz);
    z.liste.sort((a, c) => c.zeit - a.zeit);
  }, 400);
}

const schnappschuss = () => JSON.stringify(z.blatt.eintraege);
/** Vor jeder Änderung aufrufen (für ⌘Z). */
function merken(stand = schnappschuss()) {
  if (z.verlauf[z.verlauf.length - 1] === stand) return;
  z.verlauf.push(stand);
  if (z.verlauf.length > 150) z.verlauf.shift();
  z.zukunft = [];
}
function rueckgaengig() {
  if (!z.verlauf.length) return;
  z.zukunft.push(schnappschuss());
  z.blatt.eintraege = JSON.parse(z.verlauf.pop());
  nachStruktur();
}
function wiederholen() {
  if (!z.zukunft.length) return;
  z.verlauf.push(schnappschuss());
  z.blatt.eintraege = JSON.parse(z.zukunft.pop());
  nachStruktur();
}
function nachStruktur() {
  if (z.auswahl && !z.blatt.eintraege.some((e) => e.id === z.auswahl)) z.auswahl = null;
  deuten();
  sichern();
  malen();
}

// ================================================================== Deuten (rechnen lassen)

function deuten() {
  try {
    z.deutung = Mathe.blattDeuten(z.blatt.eintraege);
  } catch (e) {
    z.deutung = { deutungen: new Map(), werte: {}, defs: new Map() };
  }
  // Parameter: Schieberegler-Bereich passend anlegen
  for (const e of z.blatt.eintraege) {
    const d = z.deutung.deutungen.get(e.id);
    if (d && d.art === 'parameter' && !e.schieber) {
      const v = d.wert, m = Math.max(10, Math.ceil(Math.abs(v) * 2));
      e.schieber = { min: -m, max: m, schritt: m > 50 ? 1 : 0.1 };
    }
  }
  // Tabellen: Regression rechnen
  z.regression = new Map();
  for (const e of z.blatt.eintraege) {
    if (e.art !== 'tabelle' || !e.tabelle || !e.tabelle.modell || e.tabelle.modell === 'keine') continue;
    const p = (e.tabelle.punkte || []).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
    try { z.regression.set(e.id, Mathe.regression(p, e.tabelle.modell)); } catch (err) { z.regression.set(e.id, { ok: false, fehler: err.message }); }
  }
  if (typeof analyseVeraltet === 'function') analyseVeraltet();
}

// ================================================================== Start

async function start() {
  try {
    z.info = await lyra.info();
  } catch (_) {
    z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' };
  }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route === 'chat') return chatAuftrag();
  if (route === 'fusion' || lyra.fusion.aktiv()) return;
  try {
    z.liste = (await lyra.speicher.liste('blaetter')).map((e) => e.wert).filter((b) => b && b.id && Array.isArray(b.eintraege))
      .map((b) => ({ id: b.id, name: b.name, zeit: b.zeit, n: b.eintraege.filter((e) => e.text || e.art).length })).sort((a, b) => b.zeit - a.zeit);
  } catch (_) {}
  let b = null;
  try {
    const id = route.startsWith('bild/') ? route.slice(5) : await lyra.speicher.lesen('zuletzt');
    if (id) b = await lyra.speicher.lesen('blaetter/' + id);
  } catch (_) {}
  z.blatt = b && Array.isArray(b.eintraege) ? b : erstesBlatt();
  leereZeileAmEnde();
  lyra.bei('zurueck', zurueck);
  lyra.bei('einstellungen', einstellungen);
  document.addEventListener('keydown', taste);
  window.addEventListener('resize', () => { leinwandGroesse(); zeichnen(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => zeichnen());
  deuten();
  malen();
  if (route === 'einstellungen') einstellungen();
}

/** Unten steht immer eine leere Zeile zum Weiterschreiben. */
function leereZeileAmEnde() {
  const l = z.blatt.eintraege;
  const letzte = l[l.length - 1];
  if (!letzte || (letzte.text || '').trim() || letzte.art) l.push(neueZeile());
}

function erstesBlatt() {
  const b = neuesBlatt('Mein erstes Blatt', []);
  z.blatt = b;
  b.eintraege.push(neueZeile('f(x) = x^2 - 2x - 3'), neueZeile(''));
  return b;
}

function zurueck() {
  if (document.querySelector('.dialog-grund')) return dialogZu();
  if (document.querySelector('.vx-pop')) return popZu();
  if (z.laufend) return animationStopp();
  if (z.fokus) { document.activeElement && document.activeElement.blur(); return; }
  if (z.auswahl) { z.auswahl = null; return malen(); }
  lyra.zurueck();
}

function taste(e) {
  const imFeld = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !imFeld) {
    e.preventDefault();
    if (e.shiftKey) wiederholen(); else rueckgaengig();
  }
  if (e.key === 'Escape' && !document.querySelector('.dialog-grund')) { zurueck(); }
}

// ================================================================== Oberfläche

function malen() {
  const aktiv = document.activeElement;
  const fokusId = aktiv && aktiv.dataset ? aktiv.dataset.zeile : null;
  const pos = aktiv && aktiv.selectionStart !== undefined ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const scroll = document.querySelector('.vx-liste-inhalt') ? document.querySelector('.vx-liste-inhalt').scrollTop : 0;
  lyra.titel(z.blatt.name || '');
  const leiste = typeof analyseLeiste === 'function' ? analyseLeiste() : null;
  app.replaceChildren(h('div', { class: 'vx' + (leiste ? ' mit-leiste' : '') },
    kopfleiste(),
    h('div', { class: 'vx-haupt' }, listeBauen(), flaecheBauen(), leiste)));
  const inhalt = document.querySelector('.vx-liste-inhalt');
  if (inhalt) inhalt.scrollTop = scroll;
  if (fokusId) {
    const r = z.zeilen.get(fokusId);
    if (r && r.feld) { r.feld.focus(); if (pos) r.feld.setSelectionRange(pos[0], pos[1]); }
  }
  leinwandGroesse();
  if (!z.blatt.ansicht && z.W > 200) ersteAnsicht();
  zeichnen();
  // Die Größe steht manchmal erst nach dem ersten Layout fest
  requestAnimationFrame(() => {
    const vorher = [z.W, z.H];
    leinwandGroesse();
    if (!z.blatt.ansicht) ersteAnsicht();
    if (vorher[0] !== z.W || vorher[1] !== z.H) zeichnen();
  });
}

/** Ausschnitt für ein Blatt ohne gespeicherte Ansicht: passend zum Inhalt, sonst Standard. */
function ersteAnsicht() {
  const voll = z.blatt.eintraege.some((e) => (e.text || '').trim() || e.art);
  if (voll) z.blatt.ansicht = passendeAnsicht(z.W, z.H).ansicht;
  else standardAnsicht();
}

function kopfleiste() {
  const blattMenue = h('button', { class: 'vx-blatt-knopf', title: 'Blätter', onclick: (e) => { e.stopPropagation(); blaetterMenue(e.currentTarget); } },
    h('span', { class: 'vx-blatt-symbol' }, symbol('blatt')), h('span', { class: 'vx-blatt-name' }, z.blatt.name || 'Ohne Namen'), h('span', { class: 'ly-pfeil' }));
  return h('header', { class: 'vx-kopf' },
    blattMenue,
    h('div', { class: 'vx-kopf-werkzeuge' },
      h('button', { class: 'vx-werkzeug', title: 'Steckbriefaufgabe lösen', onclick: () => steckbriefOeffnen() }, symbol('steckbrief'), 'Steckbrief'),
      h('button', { class: 'vx-werkzeug', title: 'Messwerte eintragen und Ausgleichsfunktion finden', onclick: () => tabelleNeu() }, symbol('tabelle'), 'Messwerte'),
      h('button', { class: 'vx-werkzeug ki', title: 'In Worten beschreiben – die KI schlägt Funktionen vor', onclick: () => beschreibenOeffnen() }, symbol('ki'), 'Beschreiben')),
    h('div', { class: 'wachsen' }),
    h('button', { class: 'knopf symbol', title: 'Rückgängig (⌘Z)', disabled: !z.verlauf.length, onclick: rueckgaengig }, symbol('zurueck')),
    h('button', { class: 'knopf symbol', title: 'Wiederholen (⌘⇧Z)', disabled: !z.zukunft.length, onclick: wiederholen }, symbol('vor')),
    h('button', { class: 'knopf tonal klein', title: 'Exportieren', onclick: (e) => { e.stopPropagation(); exportMenue(e.currentTarget); } }, symbol('export'), 'Export'),
    h('button', { class: 'knopf symbol', title: 'Einstellungen', onclick: einstellungen }, symbol('zahnrad')));
}

// ------------------------------------------------------------------ Ausdrucksliste

function listeBauen() {
  z.zeilen = new Map();
  const zeilen = z.blatt.eintraege.map((e, i) => (e.art === 'tabelle' ? tabellenZeile(e, i) : zeileBauen(e, i)));
  return h('aside', { class: 'vx-liste' },
    h('div', { class: 'vx-liste-inhalt' }, zeilen,
      h('button', { class: 'vx-neu', onclick: () => zeileEinfuegen(z.blatt.eintraege.length, '', true) }, '+ Neue Zeile')),
    symbolleiste());
}

function symbolleiste() {
  const knoepfe = [
    ['x²', '^2'], ['xⁿ', '^'], ['√', 'sqrt('], ['∛', 'cbrt('], ['|x|', '|'], ['π', 'π'], ['e', 'e^('], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('],
    ['ln', 'ln('], ['log₂', 'log_2('], ['≤', '<='], ['≥', '>='], ['θ', 'θ'], ['(x|y)', '(|)'], ["f′", "'"],
  ];
  return h('div', { class: 'vx-symbole' + (z.fokus ? ' an' : '') }, knoepfe.map(([t, ein]) =>
    h('button', { class: 'vx-sym', title: ein, onmousedown: (e) => { e.preventDefault(); einsetzen(ein); } }, t)));
}
function einsetzen(text) {
  const r = z.fokus && z.zeilen.get(z.fokus);
  if (!r || !r.feld) return;
  const f = r.feld;
  const a = f.selectionStart, b = f.selectionEnd;
  f.value = f.value.slice(0, a) + text + f.value.slice(b);
  const pos = text === '(|)' ? a + 1 : a + text.length;
  f.setSelectionRange(pos, pos);
  f.dispatchEvent(new Event('input'));
}

function zeileBauen(e, i) {
  const d = z.deutung.deutungen.get(e.id) || { art: 'leer' };
  const feld = h('input', { class: 'vx-feld', value: e.text, spellcheck: 'false', autocomplete: 'off', placeholder: i === 0 && !e.text ? 'f(x) = x² − 4' : 'Funktion, Punkt, Gleichung …', 'data-zeile': e.id });
  const anzeige = h('div', { class: 'vx-anzeige', onclick: () => { feld.focus(); feld.setSelectionRange(feld.value.length, feld.value.length); } });
  const status = h('div', { class: 'vx-status' });
  const farbe = h('button', {
    class: 'vx-farbe' + (e.sichtbar === false ? ' aus' : ''), style: { '--f': e.farbe }, title: e.sichtbar === false ? 'Einblenden' : 'Ausblenden',
    onclick: () => { merken(); e.sichtbar = e.sichtbar === false; nachStruktur(); },
  }, h('span'));
  const untersuchbar = d.art === 'funktion';
  const el = h('div', { class: 'vx-zeile', 'data-id': e.id, style: { '--f': e.farbe } },
    h('div', { class: 'vx-nummer' }, String(i + 1)),
    farbe,
    h('div', { class: 'vx-inhalt' }, anzeige, feld, status),
    h('div', { class: 'vx-zeile-aktionen' },
      untersuchbar ? h('button', { class: 'knopf symbol' + (z.auswahl === e.id ? ' an' : ''), title: 'Untersuchen (Kurvendiskussion, Werkzeuge)', onclick: () => auswaehlen(z.auswahl === e.id ? null : e.id) }, symbol('lupe')) : null,
      h('button', { class: 'knopf symbol', title: 'Mehr', onclick: (ev) => { ev.stopPropagation(); zeilenMenue(e, ev.currentTarget); } }, symbol('mehr')),
      h('button', { class: 'knopf symbol', title: 'Zeile löschen', onclick: () => zeileLoeschen(e.id) }, symbol('x'))));
  feld.addEventListener('focus', () => {
    z.fokus = e.id;
    z.fokusVorher = schnappschuss();
    el.classList.add('bearbeiten');
    document.querySelector('.vx-symbole')?.classList.add('an');
  });
  feld.addEventListener('blur', () => {
    setTimeout(() => {
      if (z.fokus === e.id) z.fokus = null;
      el.classList.remove('bearbeiten');
      if (!z.fokus) document.querySelector('.vx-symbole')?.classList.remove('an');
      if (z.fokusVorher && z.fokusVorher !== schnappschuss()) { merken(z.fokusVorher); kopfAktualisieren(); }
      z.fokusVorher = null;
      zeilenAktualisieren();
    }, 0);
  });
  feld.addEventListener('input', () => {
    e.text = feld.value;
    if (e.schieber && !/=/.test(e.text)) delete e.schieber;
    deuten();
    zeilenAktualisieren();
    sichern();
    zeichnen();
  });
  feld.addEventListener('keydown', (ev) => {
    const idx = z.blatt.eintraege.findIndex((x) => x.id === e.id);
    if (ev.key === 'Enter') { ev.preventDefault(); zeileEinfuegen(idx + 1, '', true); }
    else if (ev.key === 'Backspace' && !feld.value && z.blatt.eintraege.length > 1) {
      ev.preventDefault();
      const vor = z.blatt.eintraege[idx - 1] || z.blatt.eintraege[idx + 1];
      zeileLoeschen(e.id, vor && vor.id);
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      const n = z.blatt.eintraege[idx + (ev.key === 'ArrowUp' ? -1 : 1)];
      const r = n && z.zeilen.get(n.id);
      if (r && r.feld) { ev.preventDefault(); r.feld.focus(); }
    }
  });
  z.zeilen.set(e.id, { el, feld, anzeige, status, e });
  zeileFuellen(e.id);
  return el;
}

/** Anzeige (Formel) und Status einer Zeile neu füllen – ohne die Zeile neu zu bauen (Fokus bleibt). */
function zeileFuellen(id, { schieberLassen = false } = {}) {
  const r = z.zeilen.get(id);
  if (!r || !r.feld) return;
  const e = r.e;
  const d = z.deutung.deutungen.get(id) || { art: 'leer' };
  r.el.classList.toggle('fehler', d.art === 'fehler');
  r.el.classList.toggle('gewaehlt', z.auswahl === id);
  r.el.classList.toggle('leer', d.art === 'leer');
  const tex = zeilenTex(d, e);
  r.anzeige.innerHTML = tex ? formel(tex) : '';
  r.el.classList.toggle('mit-formel', !!tex);
  if (schieberLassen && r.status.querySelector('.vx-schieber')) {
    const w = r.status.querySelector('.vx-wert');
    if (w && d.art === 'parameter') w.textContent = deutsch(d.wert);
    return;
  }
  r.status.replaceChildren(...statusTeile(e, d));
}
function zeilenAktualisieren(ausser = null) {
  for (const id of z.zeilen.keys()) zeileFuellen(id, { schieberLassen: id === ausser });
  const titel = document.querySelector('.vx-leiste') ? true : false;
  if (titel && typeof leisteAktualisieren === 'function') leisteAktualisieren();
}
function kopfAktualisieren() {
  const k = document.querySelector('.vx-kopf');
  if (k) k.replaceWith(kopfleiste());
}

function zeilenTex(d, e) {
  const t = (a) => Mathe.tex(a);
  const bereich = d.bereich ? `\\quad\\left\\{${Number.isFinite(d.bereich.min) ? Mathe.erkennen(d.bereich.min).tex + '<' : ''}x${Number.isFinite(d.bereich.max) ? '<' + Mathe.erkennen(d.bereich.max).tex : ''}\\right\\}` : '';
  const op = { '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '=': '=' };
  switch (d.art) {
    case 'funktion': {
      const m = /^\s*([A-Za-z](?:_\w+)?)\s*\(\s*([A-Za-zθ]+)\s*\)\s*=/.exec(e.text);
      if (d.name) return `${texName(d.name)}(${m ? texName(m[2]) : 'x'})=${t(d.anzeige)}${bereich}`;
      if (/=/.test(e.text)) return `y=${t(d.anzeige)}${bereich}`;
      return `${t(d.anzeige)}${bereich}`;
    }
    case 'parameter': return `${texName(d.name)}=${t(d.anzeige)}`;
    case 'punkt': return `${d.name ? texName(d.name) : ''}\\left(${t(d.anzeigeX)}\\,\\middle|\\,${t(d.anzeigeY)}\\right)`;
    case 'kurve': return `\\left(${t(d.anzeigeX)}\\,\\middle|\\,${t(d.anzeigeY)}\\right)`;
    case 'polar': return `r=${t(d.anzeige)}`;
    case 'senkrecht': return `x=${t(d.anzeige)}`;
    case 'gleichung': return `${t(d.anzeigeL)}=${t(d.anzeigeR)}`;
    case 'ungleichung':
      if (d.richtung === 'y') return `y${op[d.op]}${t(d.anzeige)}${bereich}`;
      if (d.richtung === 'x') return `x${op[d.op]}${t(d.anzeige)}`;
      return `${t(d.anzeigeL)}${op[d.op]}${t(d.anzeigeR)}`;
    case 'wert': return `${t(d.anzeige)}`;
    default: return '';
  }
}
const texName = (n) => { const [a, i] = String(n).split('_'); return (a === 'theta' ? '\\theta' : a) + (i ? `_{${i}}` : ''); };

function statusTeile(e, d) {
  if (d.art === 'fehler') {
    return [h('span', { class: 'vx-fehler' }, d.fehler),
      ...(d.fehlend || []).filter((n) => /^[a-zA-Z](_\w+)?$/.test(n)).map((n) =>
        h('button', { class: 'vx-chip', onclick: () => parameterAnlegen(n, e.id) }, `+ Schieberegler ${n}`))];
  }
  if (d.art === 'wert') {
    const w = d.wert;
    return [h('span', { class: 'vx-ergebnis' }, Number.isFinite(w) ? Mathe.wertText(w, 6) : 'nicht definiert')];
  }
  if (d.art === 'aussage') return [h('span', { class: d.wahr ? 'vx-ergebnis' : 'vx-fehler' }, d.wahr ? 'wahr' : 'falsch')];
  if (d.art === 'parameter') return [schieber(e, d)];
  if (d.art === 'kurve' || d.art === 'polar') {
    const t = tBereich(e, d);
    return [h('span', { class: 'vx-klein' }, `${d.art === 'polar' ? 'θ' : 't'} von ${deutsch(t.von, 3)} bis ${deutsch(t.bis, 3)}`)];
  }
  if (d.art === 'punkt' && !punktZiehbar(e)) return [];
  return [];
}

function tBereich(e, d) {
  if (e.t && Number.isFinite(e.t.von) && Number.isFinite(e.t.bis)) return e.t;
  if (d.art === 'polar') return { von: 0, bis: ZWEI_PI };
  return /sin|cos|tan/.test(e.text) ? { von: 0, bis: ZWEI_PI } : { von: -10, bis: 10 };
}

function schieber(e, d) {
  const s = e.schieber || { min: -10, max: 10, schritt: 0.1 };
  const regler = h('input', { type: 'range', min: s.min, max: s.max, step: s.schritt, value: d.wert, class: 'vx-regler' });
  const stellen = Math.max(0, Math.ceil(-Math.log10(s.schritt) - 1e-9));
  regler.addEventListener('pointerdown', () => merken());
  regler.addEventListener('input', () => {
    e.text = `${d.name} = ${eingabeZahl(Number(regler.value), stellen)}`;
    const r = z.zeilen.get(e.id);
    if (r && document.activeElement !== r.feld) r.feld.value = e.text;
    deuten();
    zeilenAktualisieren(e.id);
    sichern();
    zeichnen();
  });
  const grenze = (wo) => h('input', {
    class: 'vx-grenze', value: eingabeZahl(s[wo], 4), title: wo === 'min' ? 'Minimum' : 'Maximum',
    onchange: (ev) => {
      const v = Number(String(ev.target.value).replace(',', '.'));
      if (!Number.isFinite(v)) return zeileFuellen(e.id);
      merken();
      e.schieber = { ...s, [wo]: v };
      if (e.schieber.min >= e.schieber.max) e.schieber = s;
      sichern();
      zeileFuellen(e.id);
    },
  });
  const spielt = z.laufend && z.laufend.id === e.id;
  return h('div', { class: 'vx-schieber' },
    h('button', { class: 'vx-spielen' + (spielt ? ' an' : ''), title: spielt ? 'Anhalten' : 'Abspielen', onclick: () => (spielt ? animationStopp() : animationStart(e.id)) }, symbol(spielt ? 'pause' : 'spielen')),
    grenze('min'), regler, grenze('max'),
    h('span', { class: 'vx-wert' }, deutsch(d.wert)));
}

function animationStart(id) {
  animationStopp();
  merken();
  z.laufend = { id, richtung: 1, zuletzt: performance.now() };
  zeileFuellen(id);
  const schritt = (t) => {
    const l = z.laufend;
    if (!l || l.id !== id) return;
    const e = z.blatt.eintraege.find((x) => x.id === id);
    const d = e && z.deutung.deutungen.get(id);
    if (!e || !d || d.art !== 'parameter') return animationStopp();
    const s = e.schieber;
    const dt = Math.min(0.1, (t - l.zuletzt) / 1000);
    l.zuletzt = t;
    let v = d.wert + l.richtung * (s.max - s.min) * dt / 4;
    if (v >= s.max) { v = s.max; l.richtung = -1; }
    if (v <= s.min) { v = s.min; l.richtung = 1; }
    const stellen = Math.max(0, Math.ceil(-Math.log10(s.schritt) - 1e-9));
    e.text = `${d.name} = ${eingabeZahl(Math.round(v / s.schritt) * s.schritt, stellen)}`;
    // feinere Zwischenwerte für flüssige Bewegung, Text gerundet
    deuten();
    z.deutung.werte[d.name] = v;
    const r = z.zeilen.get(id);
    if (r) {
      if (document.activeElement !== r.feld) r.feld.value = e.text;
      const regler = r.status.querySelector('.vx-regler');
      if (regler) regler.value = v;
      const w = r.status.querySelector('.vx-wert');
      if (w) w.textContent = deutsch(v, 2);
      r.anzeige.innerHTML = formel(zeilenTex(z.deutung.deutungen.get(id), e));
    }
    zeichnenSofort(false);
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
function animationStopp() {
  const l = z.laufend;
  z.laufend = null;
  if (l) { deuten(); sichern(); zeileFuellen(l.id); zeichnen(); }
}

function parameterAnlegen(name, nachId) {
  merken();
  const i = z.blatt.eintraege.findIndex((x) => x.id === nachId);
  z.blatt.eintraege.splice(i + 1, 0, neueZeile(`${name} = 1`, { schieber: { min: -10, max: 10, schritt: 0.1 } }));
  nachStruktur();
}

function zeileEinfuegen(index, text = '', fokus = false, extra = {}) {
  merken();
  const e = neueZeile(text, extra);
  z.blatt.eintraege.splice(index, 0, e);
  deuten();
  sichern();
  malen();
  if (fokus) { const r = z.zeilen.get(e.id); if (r && r.feld) r.feld.focus(); }
  return e;
}
function zeileLoeschen(id, fokusId = null) {
  merken();
  z.blatt.eintraege = z.blatt.eintraege.filter((e) => e.id !== id);
  if (!z.blatt.eintraege.length) z.blatt.eintraege.push(neueZeile());
  if (z.auswahl === id) z.auswahl = null;
  if (z.laufend && z.laufend.id === id) z.laufend = null;
  nachStruktur();
  if (fokusId) { const r = z.zeilen.get(fokusId); if (r && r.feld) { r.feld.focus(); r.feld.setSelectionRange(r.feld.value.length, r.feld.value.length); } }
}
/** Zeilen ans Blatt anhängen (leere letzte Zeile wird ersetzt). → die neuen Zeilen */
function zeilenAnhaengen(texte) {
  merken();
  const l = z.blatt.eintraege;
  if (l.length && !l[l.length - 1].text && !l[l.length - 1].art) l.pop();
  const neu = texte.map((t) => { const e = neueZeile(t); l.push(e); return e; });
  l.push(neueZeile());
  nachStruktur();
  return neu;
}

function auswaehlen(id) {
  z.auswahl = id;
  z.festMarker = new Set();
  if (typeof werkzeugZuruecksetzen === 'function') werkzeugZuruecksetzen();
  malen();
}

// ------------------------------------------------------------------ Menüs (kleine Aufklapper)

function popZu() { document.querySelectorAll('.vx-pop').forEach((p) => p.remove()); }
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.vx-pop')) popZu(); });
function pop(anker, inhalt, { rechts = false } = {}) {
  popZu();
  const r = anker.getBoundingClientRect();
  const p = h('div', { class: 'vx-pop' }, inhalt);
  document.body.appendChild(p);
  const w = p.offsetWidth, hh = p.offsetHeight;
  let x = rechts ? r.right - w : r.left;
  x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  let y = r.bottom + 6;
  if (y + hh > window.innerHeight - 8) y = Math.max(8, r.top - hh - 6);
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  return p;
}
const popKnopf = (text, bei, { gefahr = false, an = false, symbolName = '' } = {}) =>
  h('button', { class: 'vx-pop-knopf' + (gefahr ? ' gefahr' : '') + (an ? ' an' : ''), onclick: () => { popZu(); bei(); } }, symbolName ? symbol(symbolName) : null, h('span', {}, text));

function zeilenMenue(e, anker) {
  const d = z.deutung.deutungen.get(e.id) || {};
  const i = z.blatt.eintraege.indexOf(e);
  const farben = h('div', { class: 'vx-farbwahl' }, Grafik.FARBEN.map((f) =>
    h('button', { class: 'vx-farbtupfer' + (f === e.farbe ? ' an' : ''), style: { background: f }, title: 'Farbe', onclick: () => { popZu(); merken(); e.farbe = f; nachStruktur(); } })));
  const striche = h('div', { class: 'vx-strichwahl' }, [['voll', 'durchgezogen'], ['gestrichelt', 'gestrichelt'], ['gepunktet', 'gepunktet']].map(([w, n]) =>
    h('button', { class: 'vx-strich' + ((e.strich || 'voll') === w ? ' an' : ''), title: n, onclick: () => { popZu(); merken(); e.strich = w; nachStruktur(); } }, h('span', { class: 'vx-strich-' + w }))));
  const teile = [h('div', { class: 'vx-pop-titel' }, 'Farbe und Linie'), farben, striche, h('div', { class: 'vx-pop-trenner' })];
  if (d.art === 'kurve' || d.art === 'polar') {
    const t = tBereich(e, d);
    const feld = (wo) => h('input', { class: 'vx-grenze', value: eingabeZahl(t[wo], 4), onchange: (ev) => {
      let v;
      try { v = Mathe.kompilieren(Mathe.lesen(ev.target.value))({}); } catch (_) { v = NaN; }
      if (!Number.isFinite(v)) return;
      merken();
      e.t = { ...tBereich(e, d), [wo]: v };
      nachStruktur();
    } });
    teile.push(h('div', { class: 'vx-pop-titel' }, d.art === 'polar' ? 'Bereich für θ' : 'Bereich für t'),
      h('div', { class: 'vx-pop-zeile' }, feld('von'), h('span', { class: 'leise' }, 'bis'), feld('bis'), h('span', { class: 'leise klein' }, '(2π geht auch)')),
      h('div', { class: 'vx-pop-trenner' }));
  }
  if (d.art === 'funktion') teile.push(popKnopf('Untersuchen', () => auswaehlen(e.id), { symbolName: 'lupe' }));
  teile.push(
    popKnopf('Duplizieren', () => { merken(); z.blatt.eintraege.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(e)), id: lyra.neueId() + 7, farbe: freieFarbe(), text: duplikatText(e.text) }); nachStruktur(); }, { symbolName: 'kopie' }),
    i > 0 ? popKnopf('Nach oben', () => { merken(); const l = z.blatt.eintraege; [l[i - 1], l[i]] = [l[i], l[i - 1]]; nachStruktur(); }, { symbolName: 'hoch' }) : null,
    i < z.blatt.eintraege.length - 1 ? popKnopf('Nach unten', () => { merken(); const l = z.blatt.eintraege; [l[i + 1], l[i]] = [l[i], l[i + 1]]; nachStruktur(); }, { symbolName: 'runter' }) : null,
    popKnopf('Löschen', () => zeileLoeschen(e.id), { gefahr: true, symbolName: 'x' }));
  pop(anker, teile, { rechts: true });
}
function duplikatText(t) {
  const m = /^\s*([A-Za-z](?:_\w+)?)\s*\(\s*([A-Za-zθ]+)\s*\)\s*=(.*)$/.exec(t || '');
  if (m) return `${freierName()}(${m[2]}) =${m[3]}`;
  return t;
}

function blaetterMenue(anker) {
  const teile = [h('div', { class: 'vx-pop-titel' }, 'Blätter')];
  for (const b of z.liste.slice(0, 30)) {
    teile.push(h('button', { class: 'vx-pop-knopf' + (b.id === z.blatt.id ? ' an' : ''), onclick: () => { popZu(); blattOeffnen(b.id); } },
      h('span', { class: 'wachsen' }, b.name || 'Ohne Namen'), h('span', { class: 'leise klein' }, lyra.zeitText(b.zeit))));
  }
  if (!z.liste.some((b) => b.id === z.blatt.id)) teile.splice(1, 0, h('button', { class: 'vx-pop-knopf an' }, h('span', { class: 'wachsen' }, z.blatt.name), h('span', { class: 'leise klein' }, 'offen')));
  teile.push(h('div', { class: 'vx-pop-trenner' }),
    popKnopf('Neues Blatt', () => { const b = neuesBlatt('Neues Blatt', ['']); wechseln(b); }, { symbolName: 'plus' }),
    popKnopf('Umbenennen …', umbenennen, { symbolName: 'stift' }),
    popKnopf('Blatt löschen …', blattLoeschen, { gefahr: true, symbolName: 'x' }));
  pop(anker, teile);
}
async function blattOeffnen(id) {
  if (id === z.blatt.id) return;
  let b = null;
  try { b = await lyra.speicher.lesen('blaetter/' + id); } catch (_) {}
  if (!b || !Array.isArray(b.eintraege)) return lyra.toast('Dieses Blatt lässt sich nicht öffnen.', 'fehler');
  wechseln(b);
}
function wechseln(b) {
  animationStopp();
  z.blatt = b;
  leereZeileAmEnde();
  z.auswahl = null;
  z.verlauf = [];
  z.zukunft = [];
  z.festMarker = new Set();
  deuten();
  sichern();
  malen();
}
async function umbenennen() {
  const f = h('input', { class: 'eingabe', value: z.blatt.name || '' });
  const name = await lyra.dialog('Blatt umbenennen', f, [{ text: 'Abbrechen', art: 'text', wert: null }, { text: 'Umbenennen', wert: () => f.value.trim() }]);
  if (!name) return;
  z.blatt.name = name.slice(0, 80);
  sichern();
  malen();
}
async function blattLoeschen() {
  if (!(await lyra.bestaetigen({ titel: `„${z.blatt.name}“ löschen?`, text: 'Das Blatt mit allen Zeilen ist danach weg.', ja: 'Löschen', gefahr: true }))) return;
  const id = z.blatt.id;
  try { await lyra.speicher.loeschen('blaetter/' + id); } catch (_) {}
  z.liste = z.liste.filter((b) => b.id !== id);
  clearTimeout(sichernPlan);
  let naechstes = null;
  if (z.liste[0]) { try { naechstes = await lyra.speicher.lesen('blaetter/' + z.liste[0].id); } catch (_) {} }
  wechseln(naechstes && Array.isArray(naechstes.eintraege) ? naechstes : neuesBlatt('Neues Blatt', ['']));
  lyra.toast('Blatt gelöscht');
}

async function einstellungen() {
  const e = { ...z.einst };
  const inhalt = h('div', { class: 'spalte', style: { gap: '2px' } },
    lyra.schalter({ wert: e.raster, text: 'Raster', beiWahl: (v) => { e.raster = v; } }),
    lyra.schalter({ wert: e.achsen, text: 'Achsen mit Beschriftung', beiWahl: (v) => { e.achsen = v; } }),
    lyra.schalter({ wert: e.pi, text: 'x-Achse in Vielfachen von π', unter: 'Praktisch für sin, cos und tan', beiWahl: (v) => { e.pi = v; } }),
    lyra.schalter({ wert: e.gleich, text: 'Beide Achsen gleich skaliert (1 : 1)', unter: 'Aus: Kreise wirken oval, dafür passen steile Graphen besser', beiWahl: (v) => { e.gleich = v; } }),
    lyra.schalter({ wert: e.beschriftung, text: 'Namen an Graphen und Punkten', beiWahl: (v) => { e.beschriftung = v; } }),
    h('div', { class: 'ueberschrift-klein', style: { marginTop: '14px' } }, 'KI (nur, wenn du sie nutzt)'),
    lyra.schalter({ wert: e.ki === 'lyra', text: 'Immer Lyra lokal verwenden', unter: 'Sonst der Lehrer, den du in Lyra gewählt hast', beiWahl: (v) => { e.ki = v ? 'lyra' : 'auto'; } }));
  const ok = await lyra.dialog('Einstellungen', inhalt, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Fertig', wert: true }]);
  if (!ok) return;
  const vorherGleich = z.einst.gleich;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  if (e.gleich && !vorherGleich && z.blatt.ansicht) z.blatt.ansicht.sy = z.blatt.ansicht.sx;
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

// ================================================================== Zeichenfläche

function flaecheBauen() {
  if (!z.leinwand) {
    z.leinwand = h('canvas', { class: 'vx-leinwand' });
    z.ctx = z.leinwand.getContext('2d');
    leinwandEreignisse(z.leinwand);
  }
  const leer = !z.blatt.eintraege.some((e) => e.text.trim() || e.art);
  return h('main', { class: 'vx-flaeche' },
    z.leinwand,
    h('div', { class: 'vx-zoom' },
      h('button', { title: 'Vergrößern', onclick: () => zoomen(1.5) }, symbol('plus')),
      h('button', { title: 'Verkleinern', onclick: () => zoomen(1 / 1.5) }, symbol('minus')),
      h('button', { title: 'Standardansicht', onclick: () => { standardAnsicht(); zeichnen(); } }, symbol('haus')),
      h('button', { title: 'Alles zeigen', onclick: () => { allesZeigen(); zeichnen(); } }, symbol('einpassen'))),
    leer ? h('div', { class: 'vx-leer-hinweis' },
      h('div', { class: 'vx-leer-titel' }, 'Tipp eine Funktion ein'),
      h('div', { class: 'leise' }, 'z. B. f(x) = x² − 4, y = sin x, x² + y² = 9 oder P(2|1)'),
      lyra.vorschlaege(['f(x) = x^2 - 4', 'f(x) = a x^2 + b', 'y = sin(x)', 'x^2 + y^2 = 9', 'f(x) = e^(-x^2)', 'y < 2x + 1'], (t) => {
        const l = z.blatt.eintraege;
        const e = l.find((x) => !x.text && !x.art);
        if (e) { merken(); e.text = t; nachStruktur(); } else zeilenAnhaengen([t]);
        if (/a x/.test(t)) { zeilenAnhaengen(['a = 1', 'b = 0']); }
        allesZeigen();
        zeichnen();
      }, { max: 6 })) : null);
}

function leinwandGroesse() {
  const c = z.leinwand;
  if (!c || !c.parentElement) return;
  const r = c.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(50, Math.round(r.width)), H = Math.max(50, Math.round(r.height));
  if (c.width !== W * dpr || c.height !== H * dpr) {
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = W + 'px';
    c.style.height = H + 'px';
  }
  z.W = W;
  z.H = H;
}

function standardAnsicht() {
  const W = z.W || 800;
  const s = W / 22;
  z.blatt.ansicht = { cx: 0, cy: 0, sx: s, sy: s };
}

let zeichnenPlan = null, feinPlan = null;
/** Neu zeichnen (gebündelt pro Bild); grob beim Ziehen, kurz danach fein. */
function zeichnen(fein = true) {
  if (zeichnenPlan) return;
  zeichnenPlan = requestAnimationFrame(() => {
    zeichnenPlan = null;
    zeichnenSofort(fein && !z.zug);
    if (!fein || z.zug) { clearTimeout(feinPlan); feinPlan = setTimeout(() => zeichnenSofort(true), 140); }
  });
}
function zeichnenSofort(fein = true) {
  if (!z.leinwand || !z.blatt || !z.leinwand.isConnected) return;
  if (!z.W) leinwandGroesse();
  if (!z.blatt.ansicht) standardAnsicht();
  const dpr = window.devicePixelRatio || 1;
  const ctx = z.ctx;
  const th = Grafik.thema();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = th.grund;
  ctx.fillRect(0, 0, z.W, z.H);
  try {
    z.A = Grafik.zeichnen(Grafik.canvasStift(ctx), szeneBauen(z.W, z.H, fein, th));
  } catch (e) {
    console.error(e);
  }
}

/** Alles, was gezeichnet wird, für eine Fläche W × H. */
function szeneBauen(W, H, fein, th, { fuerExport = false, ansicht = null } = {}) {
  const graphen = [], punkteSammlungen = [];
  for (const e of z.blatt.eintraege) {
    if (e.sichtbar === false) continue;
    if (e.art === 'tabelle') {
      const p = ((e.tabelle && e.tabelle.punkte) || []).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
      punkteSammlungen.push({ punkte: p, farbe: e.farbe });
      const r = z.regression.get(e.id);
      if (r && r.ok) graphen.push({ d: { art: 'funktion', name: '', f: Mathe.alsFunktion(r.ast) }, farbe: e.farbe, strich: 'voll', breite: 2 });
      continue;
    }
    const d = z.deutung.deutungen.get(e.id);
    if (!d || !['funktion', 'senkrecht', 'kurve', 'polar', 'gleichung', 'ungleichung', 'punkt'].includes(d.art)) continue;
    const t = tBereich(e, d);
    graphen.push({ d, farbe: e.farbe, strich: e.strich, breite: !fuerExport && z.auswahl === e.id ? 3.3 : 2.4, von: t.von, bis: t.bis, gezogen: !fuerExport && z.zug && z.zug.punkt === e.id, id: e.id });
  }
  const extra = typeof ueberlagerung === 'function' ? ueberlagerung(fuerExport) : {};
  return {
    W, H, th, fein, ansicht: ansicht || z.blatt.ansicht, einst: z.einst,
    graphen, punkteSammlungen,
    flaechen: extra.flaechen || [], ableitungen: extra.ableitungen || [], geraden: extra.geraden || [],
    marker: (extra.marker || []).map((m) => ({ ...m, hervor: !fuerExport && z.hover && z.hover.x === m.x && z.hover.y === m.y, fest: m.fest || z.festMarker.has(markerSchluessel(m)) })),
    spur: fuerExport ? null : z.spur,
  };
}
const markerSchluessel = (m) => `${m.x.toPrecision(9)}|${m.y.toPrecision(9)}`;

// ------------------------------------------------------------------ Ansicht: zoomen, einpassen

function zoomen(faktor, px = z.W / 2, py = z.H / 2, nurX = false, nurY = false) {
  const a = z.blatt.ansicht;
  const A = Grafik.abbildung(a, z.W, z.H);
  const wx = A.x(px), wy = A.y(py);
  const grenze = (v) => Math.min(1e7, Math.max(1e-5, v));
  if (!nurY) a.sx = grenze(a.sx * faktor);
  if (!nurX) a.sy = grenze(a.sy * faktor);
  // Punkt unter dem Zeiger bleibt stehen
  a.cx = wx - (px - z.W / 2) / a.sx;
  a.cy = wy + (py - z.H / 2) / a.sy;
  sichern();
  zeichnen(false);
}

/** Ausschnitt, der alles Wichtige zeigt (Nullstellen, Extrema, Punkte, Messwerte …). */
function passendeAnsicht(W, H, gleich = z.einst.gleich) {
  const xs = [], ys = [];
  const funktionen = [];
  for (const e of z.blatt.eintraege) {
    if (e.sichtbar === false) continue;
    if (e.art === 'tabelle') {
      for (const [x, y] of (e.tabelle && e.tabelle.punkte) || []) if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); }
      continue;
    }
    const d = z.deutung.deutungen.get(e.id);
    if (!d) continue;
    if (d.art === 'punkt') { xs.push(d.x); ys.push(d.y); }
    if (d.art === 'funktion') {
      funktionen.push(d);
      try {
        const u = Mathe.untersuchen(Mathe.werteEinsetzen(d.ast, z.deutung.werte), { von: -10, bis: 10 });
        const nah = (p) => Math.abs(p.x) <= 1e4;
        for (const p of [...u.nullstellen, ...u.extrema, ...u.wendepunkte].filter(nah)) { xs.push(p.x); if (p.y !== undefined) ys.push(p.y); else ys.push(0); }
        for (const l of u.luecken) xs.push(l.x);
        if (u.yAchse !== null) { xs.push(0); ys.push(u.yAchse); }
      } catch (_) {}
    }
    if (d.art === 'kurve' || d.art === 'polar') {
      const t = tBereich(e, d);
      for (let i = 0; i <= 200; i++) {
        const tt = t.von + ((t.bis - t.von) * i) / 200;
        const x = d.art === 'polar' ? d.f(tt) * Math.cos(tt) : d.fx(tt), y = d.art === 'polar' ? d.f(tt) * Math.sin(tt) : d.fy(tt);
        if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); }
      }
    }
    if (d.art === 'gleichung' && d.nurY === false) {
      // grob abtasten
      for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) {
        const x = i / 2, y = j / 2;
        const v = d.f(x, y), r = d.f(x + 0.5, y), o = d.f(x, y + 0.5);
        if ((v < 0) !== (r < 0) || (v < 0) !== (o < 0)) { xs.push(x); ys.push(y); }
      }
    }
    if (d.art === 'senkrecht') { const x = d.f(0); if (Number.isFinite(x)) xs.push(x); }
  }
  if (!xs.length) { xs.push(-10, 10); }
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 1e-9) { x0 -= 5; x1 += 5; }
  const breit = x1 - x0;
  // den Ursprung mitnehmen, wenn er nicht zu weit weg ist
  if (x0 > 0 && x0 < breit * 1.5) x0 = 0;
  if (x1 < 0 && -x1 < breit * 1.5) x1 = 0;
  const rand = Math.max(0.6, (x1 - x0) * 0.18);
  x0 -= rand; x1 += rand;
  // y: Funktionswerte im Bereich dazunehmen (robust, ohne Ausreißer an Polen) – aber nicht weit über die wichtigen Punkte hinaus
  const kern = ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
  const werte = [...ys];
  for (const d of funktionen) {
    const l = [];
    for (let i = 0; i <= 300; i++) { const v = d.f(x0 + ((x1 - x0) * i) / 300); if (Number.isFinite(v)) l.push(v); }
    l.sort((a, b) => a - b);
    if (l.length) werte.push(l[Math.floor(l.length * 0.06)], l[Math.floor(l.length * 0.94)]);
  }
  if (!werte.length) werte.push(-5, 5);
  let y0 = Math.min(...werte), y1 = Math.max(...werte);
  if (kern) {
    const mitte = (kern[0] + kern[1]) / 2, halb = Math.max((kern[1] - kern[0]) / 2, 0.45 * (x1 - x0));
    y0 = Math.max(y0, mitte - halb);
    y1 = Math.min(y1, mitte + halb);
  }
  if (y1 - y0 < 1e-9) { y0 -= 5; y1 += 5; }
  const hoch = y1 - y0;
  if (y0 > 0 && y0 < hoch * 1.5) y0 = 0;
  if (y1 < 0 && -y1 < hoch * 1.5) y1 = 0;
  const randY = Math.max(0.6, (y1 - y0) * 0.15);
  y0 -= randY; y1 += randY;
  let sx = W / (x1 - x0), sy = H / (y1 - y0);
  let unterschiedlich = false;
  if (gleich) {
    const verh = sx / sy;
    if (verh > 4 || verh < 0.25) unterschiedlich = true;
    else { const s = Math.min(sx, sy); sx = s; sy = s; }
  }
  return { ansicht: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sx, sy }, unterschiedlich };
}
function allesZeigen() {
  const r = passendeAnsicht(z.W || 800, z.H || 600);
  z.blatt.ansicht = r.ansicht;
  if (r.unterschiedlich && z.einst.gleich) lyra.toast('Achsen unterschiedlich skaliert, damit alles hineinpasst');
  sichern();
}

// ------------------------------------------------------------------ Maus: ziehen, zoomen, Spur, auswählen

const LITERAL_PUNKT = /^\s*([A-Z][A-Za-z0-9_]*'*)?\s*(=\s*)?\(\s*(-?\d+(?:[.,]\d+)?)\s*[|;]\s*(-?\d+(?:[.,]\d+)?)\s*\)\s*$/;
const punktZiehbar = (e) => LITERAL_PUNKT.test(e.text || '');

function treffer(px, py) {
  const A = z.A;
  if (!A) return null;
  // Punkte zum Ziehen
  for (const e of [...z.blatt.eintraege].reverse()) {
    if (e.sichtbar === false || !punktZiehbar(e)) continue;
    const d = z.deutung.deutungen.get(e.id);
    if (d && d.art === 'punkt' && Math.hypot(A.X(d.x) - px, A.Y(d.y) - py) < 11) return { art: 'punkt', e, d };
  }
  // Markierungen
  const extra = typeof ueberlagerung === 'function' ? ueberlagerung(false) : {};
  for (const m of extra.marker || []) if (Math.hypot(A.X(m.x) - px, A.Y(m.y) - py) < 9) return { art: 'marker', m };
  // Graphen
  let best = null;
  const x = A.x(px);
  for (const e of z.blatt.eintraege) {
    if (e.sichtbar === false) continue;
    const d = z.deutung.deutungen.get(e.id);
    if (!d || d.art !== 'funktion') continue;
    if (d.bereich && (x < d.bereich.min || x > d.bereich.max)) continue;
    const y = d.f(x);
    if (!Number.isFinite(y)) continue;
    const ab = Math.abs(A.Y(y) - py);
    if (ab < 12 && (!best || ab < best.ab)) best = { art: 'graph', e, d, x, y, ab };
  }
  return best;
}

function spurText(name, x, y) {
  const stellen = Math.max(0, Math.min(6, Math.ceil(Math.log10(z.A.sx) + 0.3)));
  return `${name ? name + ': ' : ''}(${deutsch(x, stellen)} | ${deutsch(y, Math.max(2, stellen))})`;
}

function leinwandEreignisse(c) {
  c.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    c.setPointerCapture(ev.pointerId);
    const r = c.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const t = treffer(px, py);
    if (t && t.art === 'punkt') {
      merken();
      z.zug = { punkt: t.e.id, e: t.e, start: [px, py], bewegt: false };
    } else {
      z.zug = { start: [px, py], ansicht: { ...z.blatt.ansicht }, treffer: t, bewegt: false };
    }
  });
  c.addEventListener('pointermove', (ev) => {
    const r = c.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const zg = z.zug;
    if (zg) {
      if (!zg.bewegt && Math.hypot(px - zg.start[0], py - zg.start[1]) < 3) return;
      zg.bewegt = true;
      z.spur = null;
      if (zg.punkt) {
        const A = z.A;
        const sch = Grafik.schritt(A.sx).fein / 2;
        const x = Math.round(A.x(px) / sch) * sch, y = Math.round(A.y(py) / sch) * sch;
        const m = LITERAL_PUNKT.exec(zg.e.text);
        const stellen = Math.max(0, Math.ceil(-Math.log10(sch) - 1e-9));
        zg.e.text = `${m[1] || ''}${m[2] ? ' = ' : ''}(${eingabeZahl(x, stellen)} | ${eingabeZahl(y, stellen)})`;
        deuten();
        zeilenAktualisieren();
        const zr = z.zeilen.get(zg.e.id);
        if (zr && zr.feld) zr.feld.value = zg.e.text;
        c.style.cursor = 'grabbing';
        zeichnen(false);
        return;
      }
      const a = z.blatt.ansicht;
      a.cx = zg.ansicht.cx - (px - zg.start[0]) / a.sx;
      a.cy = zg.ansicht.cy + (py - zg.start[1]) / a.sy;
      c.style.cursor = 'grabbing';
      zeichnen(false);
      return;
    }
    // Spur und Hervorheben
    const t = treffer(px, py);
    const vorher = JSON.stringify([z.spur, z.hover]);
    z.spur = null;
    z.hover = null;
    if (t && t.art === 'graph') z.spur = { x: t.x, y: t.y, farbe: t.e.farbe, text: spurText(t.d.name ? t.d.name : '', t.x, t.y) };
    if (t && t.art === 'marker') z.hover = t.m;
    c.style.cursor = t ? (t.art === 'punkt' ? 'grab' : 'pointer') : 'default';
    if (JSON.stringify([z.spur, z.hover]) !== vorher) zeichnen();
  });
  const ende = (ev) => {
    const zg = z.zug;
    z.zug = null;
    c.style.cursor = 'default';
    if (!zg) return;
    if (zg.punkt) {
      if (zg.bewegt) { sichern(); zeichnen(); } else z.verlauf.pop();
      return;
    }
    if (!zg.bewegt) {
      // Klick: Markierung festhalten oder Graph untersuchen
      const t = zg.treffer;
      if (t && t.art === 'marker') {
        const k = markerSchluessel(t.m);
        if (z.festMarker.has(k)) z.festMarker.delete(k); else z.festMarker.add(k);
        zeichnen();
      } else if (t && t.art === 'graph') {
        if (z.auswahl !== t.e.id) auswaehlen(t.e.id);
      }
      return;
    }
    sichern();
    if (typeof analyseVeraltet === 'function') analyseVeraltet();
    zeichnen();
    void ev;
  };
  c.addEventListener('pointerup', ende);
  c.addEventListener('pointercancel', ende);
  c.addEventListener('pointerleave', () => { if (!z.zug && (z.spur || z.hover)) { z.spur = null; z.hover = null; zeichnen(); } });
  c.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = c.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const staerke = ev.ctrlKey ? 0.012 : ev.deltaMode === 1 ? 0.05 : 0.0018;
    const f = Math.exp(-ev.deltaY * staerke);
    zoomen(f, px, py, ev.altKey && !z.einst.gleich, ev.shiftKey && !z.einst.gleich);
    if (typeof analyseVeraltet === 'function') analyseVeraltet();
  }, { passive: false });
  c.addEventListener('dblclick', (ev) => {
    const r = c.getBoundingClientRect();
    zoomen(2, ev.clientX - r.left, ev.clientY - r.top);
  });
}

// ================================================================== Symbole (klein, einfarbig)

const PFADE = {
  blatt: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  steckbrief: '<path d="M5 4h14v16H5z" opacity=".0"/><path d="M4 19c3-9 5-13 8-13s5 4 8 13"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/><path d="M4 21h16"/>',
  tabelle: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 10h16M10 4v16"/><circle cx="14.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>',
  ki: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  zurueck: '<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 010 10h-2"/>',
  vor: '<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5h-9a5 5 0 000 10h2"/>',
  export: '<path d="M12 4v11M7.5 8.5L12 4l4.5 4.5"/><path d="M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14"/>',
  zahnrad: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  lupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  mehr: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  haus: '<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V20h11V9.5"/>',
  einpassen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  spielen: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor"/>',
  kopie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  hoch: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  runter: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  stift: '<path d="M4 20l4-1L19 8a2.1 2.1 0 00-3-3L5 16z"/>',
  datei: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  einfuegen: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 10h6M9 14h6"/>',
};
function symbol(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'vx-sy');
  s.innerHTML = PFADE[name] || '';
  return s;
}
