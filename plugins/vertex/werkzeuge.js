'use strict';
/*
 * Vertex – Analyse-Leiste (Kurvendiskussion, Werkzeuge, Wertetabelle), Steckbrief, Messwerte/Regression, KI-Dialoge,
 * Export (PNG, SVG, pgfplots), Lyras Eingabezeile (Route „chat“) und Fusion. Die KI ändert nie etwas am Blatt, ohne
 * dass du es übernimmst.
 */

const wz = {
  ergebnis: null, // {u, ast, f, df, ddf, name, farbe, id}
  schluessel: '',
  plan: null,
  ableitungen: { 1: false, 2: false },
  integral: null, // {a, b, mit}
  tangente: null, // {x0}
  schnitt: null, // id der anderen Funktion
  loesen: null, // {c}
  wert: null, // {x}
  tabelle: { von: '-5', bis: '5', schritt: '1', ableitung: false },
  erklaerung: null, // {text, laeuft, fehler, lehrer}
};

function werkzeugZuruecksetzen() {
  wz.ergebnis = null;
  wz.schluessel = '';
  wz.ableitungen = { 1: false, 2: false };
  wz.integral = null;
  wz.tangente = null;
  wz.schnitt = null;
  wz.loesen = null;
  wz.wert = null;
  wz.erklaerung = null;
  analyseRechnen();
}

const gewaehlt = () => (z.auswahl ? z.blatt.eintraege.find((e) => e.id === z.auswahl) : null);
const deutungVon = (id) => z.deutung.deutungen.get(id);
const funktionsZeilen = (ausser) => z.blatt.eintraege.filter((e) => e.id !== ausser && e.sichtbar !== false && (deutungVon(e.id) || {}).art === 'funktion');
const nameVon = (e) => { const d = deutungVon(e.id); return d && d.name ? d.name : 'y' + (z.blatt.eintraege.indexOf(e) + 1); };
const werteText = (v) => Mathe.wertText(v);
/** Eine Eingabe wie „π/2“ oder „-1,5“ als Zahl */
function zahlAus(t) {
  const s = String(t || '').trim();
  if (!s) return NaN;
  try { return Mathe.kompilieren(Mathe.lesen(s))(z.deutung.werte || {}); } catch (_) { return NaN; }
}

// ================================================================== Analyse rechnen

function analyseVeraltet() {
  clearTimeout(wz.plan);
  wz.plan = setTimeout(() => {
    const vorher = wz.schluessel;
    analyseRechnen();
    if (wz.schluessel !== vorher) { leisteAktualisieren(); zeichnen(); }
  }, 140);
}

function analyseRechnen() {
  const e = gewaehlt();
  const d = e && deutungVon(e.id);
  if (!e || !d || d.art !== 'funktion') { wz.ergebnis = null; wz.schluessel = ''; return; }
  const ast = Mathe.werteEinsetzen(d.ast, z.deutung.werte);
  const poly = !!Mathe.alsPolynom(ast);
  const A = z.A;
  let von = A ? A.xmin : -10, bis = A ? A.xmax : 10;
  if (d.bereich) { von = Math.max(von, d.bereich.min); bis = Math.min(bis, d.bereich.max); }
  const schluessel = JSON.stringify([e.text, z.deutung.werte, poly && !d.bereich ? 0 : [von.toPrecision(3), bis.toPrecision(3)]]);
  if (schluessel === wz.schluessel && wz.ergebnis) return;
  wz.schluessel = schluessel;
  try {
    const u = Mathe.untersuchen(ast, { von, bis });
    if (d.bereich) {
      const drin = (p) => p.x >= d.bereich.min - 1e-12 && p.x <= d.bereich.max + 1e-12;
      u.nullstellen = u.nullstellen.filter(drin);
      u.extrema = u.extrema.filter(drin);
      u.wendepunkte = u.wendepunkte.filter(drin);
      u.vollstaendig = false;
      u.von = von; u.bis = bis;
    }
    const f = Mathe.alsFunktion(ast);
    const df = u.ableitungen[0] ? Mathe.alsFunktion(u.ableitungen[0]) : (x) => (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
    const ddf = u.ableitungen[1] ? Mathe.alsFunktion(u.ableitungen[1]) : (x) => (df(x + 1e-5) - df(x - 1e-5)) / 2e-5;
    wz.ergebnis = { u, ast, f, df, ddf, name: d.name || 'f', farbe: e.farbe, id: e.id, bereich: d.bereich };
  } catch (err) {
    wz.ergebnis = { fehler: err.message || 'Die Untersuchung hat nicht geklappt.' };
  }
}

// ================================================================== Überlagerung auf der Zeichenfläche

function ueberlagerung(fuerExport) {
  const r = wz.ergebnis;
  if (!r || !r.u || !z.auswahl) return {};
  const marker = [];
  const p = (x, y) => `(${Mathe.erkennen(x).text} | ${Mathe.erkennen(y).text})`;
  const farbe = r.farbe;
  for (const n of r.u.nullstellen) marker.push({ x: n.x, y: 0, farbe, leer: true, text: `Nullstelle ${p(n.x, 0)}` });
  for (const e of r.u.extrema) marker.push({ x: e.x, y: e.y, farbe, text: `${e.art === 'hoch' ? 'Hochpunkt' : 'Tiefpunkt'} ${p(e.x, e.y)}` });
  for (const w of r.u.wendepunkte) marker.push({ x: w.x, y: w.y, farbe, leer: true, text: `${w.sattel ? 'Sattelpunkt' : 'Wendepunkt'} ${p(w.x, w.y)}` });
  if (r.u.yAchse !== null && !marker.some((m) => Math.abs(m.x) < 1e-12 && Math.abs(m.y - r.u.yAchse) < 1e-12)) {
    if (!r.bereich || (r.bereich.min <= 0 && r.bereich.max >= 0)) marker.push({ x: 0, y: r.u.yAchse, farbe, leer: true, text: `y-Achse ${p(0, r.u.yAchse)}` });
  }
  const aus = { marker, ableitungen: [], geraden: [], flaechen: [] };
  if (wz.ableitungen[1]) aus.ableitungen.push({ f: r.df, farbe, strich: 'gestrichelt' });
  if (wz.ableitungen[2]) aus.ableitungen.push({ f: r.ddf, farbe, strich: 'gepunktet' });
  if (z.reiter === 'werkzeuge' || fuerExport) {
    if (wz.integral) {
      const a = zahlAus(wz.integral.a), b = zahlAus(wz.integral.b);
      const g = wz.integral.mit ? (deutungVon(wz.integral.mit) || {}).f : null;
      if (Number.isFinite(a) && Number.isFinite(b)) aus.flaechen.push({ f: r.f, g, a, b, farbe });
    }
    if (wz.tangente) {
      const x0 = zahlAus(wz.tangente.x0);
      const y0 = r.f(x0), m = r.df(x0);
      if (Number.isFinite(y0) && Number.isFinite(m)) {
        aus.geraden.push({ m, b: y0 - m * x0, farbe: '#64748B' });
        if (wz.tangente.normale && Math.abs(m) > 1e-12) aus.geraden.push({ m: -1 / m, b: y0 + x0 / m, farbe: '#64748B', strich: 'gestrichelt' });
        marker.push({ x: x0, y: y0, farbe, text: `Berührpunkt ${p(x0, y0)}`, fest: true });
      }
    }
    for (const s of schnittpunkte()) marker.push({ x: s.x, y: s.y, farbe: '#64748B', text: `Schnittpunkt ${p(s.x, s.y)}` });
    if (wz.loesen) for (const x of loesungen()) marker.push({ x, y: zahlAus(wz.loesen.c), farbe, text: `f(x) = ${Mathe.zahlKurz(zahlAus(wz.loesen.c))} bei x ${werteText(x)}` });
  }
  return aus;
}

function schnittpunkte() {
  const r = wz.ergebnis;
  if (!r || !r.f || !wz.schnitt) return [];
  const d = deutungVon(wz.schnitt);
  if (!d || d.art !== 'funktion') return [];
  const A = z.A;
  const von = A ? A.xmin : -10, bis = A ? A.xmax : 10;
  // Differenz exakt, wenn beides Polynome sind
  let g = (x) => r.f(x) - d.f(x);
  let polyVoll = false;
  try {
    const diff = Mathe.vereinfachen(Mathe.B('-', r.ast, Mathe.werteEinsetzen(d.ast, z.deutung.werte)));
    if (Mathe.alsPolynom(diff)) {
      const u = Mathe.untersuchen(diff);
      polyVoll = true;
      return u.nullstellen.map((n) => ({ x: n.x, y: r.f(n.x), voll: true }));
    }
    g = Mathe.alsFunktion(diff);
  } catch (_) {}
  void polyVoll;
  return Mathe.nullstellen(g, von, bis).map((n) => ({ x: n.x, y: r.f(n.x) })).filter((p) => Number.isFinite(p.y));
}

function loesungen() {
  const r = wz.ergebnis;
  if (!r || !wz.loesen) return [];
  const c = zahlAus(wz.loesen.c);
  if (!Number.isFinite(c)) return [];
  try {
    const diff = Mathe.vereinfachen(Mathe.B('-', r.ast, Mathe.Z(c)));
    if (Mathe.alsPolynom(diff)) return Mathe.untersuchen(diff).nullstellen.map((n) => n.x);
  } catch (_) {}
  const A = z.A;
  return Mathe.nullstellen((x) => r.f(x) - c, A ? A.xmin : -10, A ? A.xmax : 10).map((n) => n.x);
}

// ================================================================== Analyse-Leiste

function analyseLeiste() {
  const e = gewaehlt();
  if (!e) return null;
  const d = deutungVon(e.id);
  if (!d || d.art !== 'funktion') return null;
  if (!wz.ergebnis || wz.ergebnis.id !== e.id) analyseRechnen();
  const kopfFormel = h('div', { class: 'vx-leiste-formel', html: formel(zeilenTex(d, e)) });
  return h('aside', { class: 'vx-leiste', style: { '--f': e.farbe } },
    h('div', { class: 'vx-leiste-kopf' },
      h('span', { class: 'vx-punkt-farbe' }), kopfFormel,
      h('button', { class: 'knopf symbol', title: 'Schließen', onclick: () => auswaehlen(null) }, symbol('x'))),
    h('div', { class: 'vx-leiste-reiter' }, leistenReiter()),
    h('div', { class: 'vx-leiste-inhalt' }, leistenInhalt()));
}

function leistenReiter() {
  return lyra.reiter([['diskussion', 'Kurvendiskussion'], ['werkzeuge', 'Werkzeuge'], ['tabelle', 'Wertetabelle']], z.reiter, (w) => {
    z.reiter = w;
    const r = document.querySelector('.vx-leiste-reiter');
    if (r) r.replaceChildren(leistenReiter());
    const inhalt = document.querySelector('.vx-leiste-inhalt');
    if (inhalt) { inhalt.replaceChildren(...[].concat(leistenInhalt())); inhalt.scrollTop = 0; }
    zeichnen();
  });
}

function leisteAktualisieren() {
  const l = document.querySelector('.vx-leiste');
  const e = gewaehlt();
  const d = e && deutungVon(e.id);
  if (!e || !d || d.art !== 'funktion') { if (l) malen(); return; }
  if (!l) return malen();
  analyseRechnen();
  const f = l.querySelector('.vx-leiste-formel');
  if (f) f.innerHTML = formel(zeilenTex(d, e));
  l.style.setProperty('--f', e.farbe);
  const inhalt = l.querySelector('.vx-leiste-inhalt');
  const aktiv = document.activeElement;
  const feldName = aktiv && inhalt.contains(aktiv) ? aktiv.dataset.feld : null;
  const pos = feldName && aktiv.selectionStart !== undefined ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  const scroll = inhalt.scrollTop;
  inhalt.replaceChildren(...[].concat(leistenInhalt()));
  inhalt.scrollTop = scroll;
  if (feldName) {
    const neu = inhalt.querySelector(`[data-feld="${feldName}"]`);
    if (neu) { neu.focus(); if (pos) try { neu.setSelectionRange(pos[0], pos[1]); } catch (_) {} }
  }
}

function leistenInhalt() {
  const r = wz.ergebnis;
  if (!r) return [h('div', { class: 'lauf' }, h('div', { class: 'lade' }), 'Vertex rechnet …')];
  if (r.fehler) return [h('div', { class: 'kasten falsch' }, r.fehler)];
  if (z.reiter === 'werkzeuge') return werkzeugReiter(r);
  if (z.reiter === 'tabelle') return tabellenReiter(r);
  return diskussionReiter(r);
}

const karte = (titel, ...inhalt) => h('section', { class: 'vx-karte' }, titel ? h('div', { class: 'vx-karte-titel' }, titel) : null, ...inhalt);
const zeile = (links, rechts, bei) => h('div', { class: 'vx-wertzeile' + (bei ? ' klickbar' : ''), onclick: bei || null }, h('span', { class: 'vx-wertzeile-links' }, links), h('span', { class: 'vx-wertzeile-rechts', html: rechts }));
const punktTex = (x, y) => `\\left(${Mathe.erkennen(x).tex}\\,\\middle|\\,${Mathe.erkennen(y).tex}\\right)`;
const ganzzahlig = (v) => /^−?\d+$/.test(Mathe.erkennen(v).text);
const ungefaehr = (x, y) => (ganzzahlig(x) && ganzzahlig(y) ? '' : `≈ (${Mathe.zahlKurz(x, 3)} | ${Mathe.zahlKurz(y, 3)})`);

function markerUmschalten(x, y) {
  const k = markerSchluessel({ x, y });
  if (z.festMarker.has(k)) z.festMarker.delete(k); else z.festMarker.add(k);
  zeichnen();
}

function diskussionReiter(r) {
  const u = r.u, n = r.name;
  const fx = `${texName(n)}`;
  const teile = [];
  // Ableitungen
  const ab = (k, a) => {
    if (!a) return null;
    const strich = "'".repeat(k);
    return h('div', { class: 'vx-ableitung' },
      h('div', { class: 'vx-ableitung-formel', html: formel(`${fx}${strich}(x)=${Mathe.tex(a)}`) }),
      h('div', { class: 'vx-ableitung-knoepfe' },
        h('button', { class: 'vx-chip' + (wz.ableitungen[k] ? ' an' : ''), title: 'Im Graphen zeigen', onclick: () => { wz.ableitungen[k] = !wz.ableitungen[k]; leisteAktualisieren(); zeichnen(); } }, wz.ableitungen[k] ? 'sichtbar' : 'zeigen'),
        h('button', { class: 'vx-chip', title: 'Als eigene Zeile ins Blatt', onclick: () => ableitungAlsZeile(k, a) }, '+ Zeile')));
  };
  teile.push(karte('Ableitungen', u.symbolisch ? null : h('div', { class: 'leise klein' }, 'Diese Funktion lässt sich nicht symbolisch ableiten – Vertex rechnet numerisch.'), ab(1, u.ableitungen[0]), ab(2, u.ableitungen[1])));
  // Grundlagen
  teile.push(karte('Definitionsbereich und Symmetrie',
    zeile('Definitionsbereich', formel('D=' + u.definition.tex)),
    zeile('Symmetrie', u.symmetrie === 'achse' ? 'achsensymmetrisch zur y-Achse' : u.symmetrie === 'punkt' ? 'punktsymmetrisch zum Ursprung' : 'keine einfache Symmetrie'),
    u.yAchse !== null ? zeile('y-Achsenabschnitt', formel(`${fx}(0)${Mathe.wertTex(u.yAchse)}`), () => markerUmschalten(0, u.yAchse)) : null));
  // Nullstellen
  teile.push(karte(`Nullstellen${u.nullstellen.length ? ' (' + u.nullstellen.length + ')' : ''}`,
    u.nullstellen.length ? u.nullstellen.map((p, i) => zeile(`x${tiefgestellt(i + 1)}`, formel(`x${Mathe.wertTex(p.x)}`) + (p.vzw ? '' : ' <span class="vx-hinweis">berührt</span>'), () => markerUmschalten(p.x, 0)))
      : h('div', { class: 'leise' }, 'keine')));
  // Extrema
  teile.push(karte('Extrempunkte',
    u.extrema.length ? u.extrema.map((p) => zeile(p.art === 'hoch' ? 'Hochpunkt' : 'Tiefpunkt', formel(punktTex(p.x, p.y)) + `<span class="vx-ungefaehr">${ungefaehr(p.x, p.y)}</span>` + (p.knick ? ' <span class="vx-hinweis">Knick</span>' : ''), () => markerUmschalten(p.x, p.y)))
      : h('div', { class: 'leise' }, 'keine')));
  // Wendepunkte
  teile.push(karte('Wendepunkte',
    u.wendepunkte.length ? u.wendepunkte.map((p) => zeile(p.sattel ? 'Sattelpunkt' : 'Wendepunkt', formel(punktTex(p.x, p.y)) + `<span class="vx-ungefaehr">${ungefaehr(p.x, p.y)}</span>`, () => markerUmschalten(p.x, p.y)))
      : h('div', { class: 'leise' }, 'keine')));
  // Monotonie und Krümmung
  const iv = (m) => intervallTex(m, u);
  teile.push(karte('Monotonie und Krümmung',
    ...u.monotonie.map((m) => zeile(m.art === 'steigend' ? 'steigt' : m.art === 'fallend' ? 'fällt' : 'konstant', iv(m))),
    ...u.kruemmung.map((m) => zeile(m.art === 'links' ? 'linksgekrümmt' : m.art === 'rechts' ? 'rechtsgekrümmt' : 'ohne Krümmung', iv(m)))));
  // Grenzverhalten, Asymptoten
  const grenze = (g, wohin) => {
    const pfeil = `x\\to${wohin}`;
    switch (g.art) {
      case 'plus': return formel(`${pfeil}:\\ ${fx}(x)\\to+\\infty`);
      case 'minus': return formel(`${pfeil}:\\ ${fx}(x)\\to-\\infty`);
      case 'wert': return formel(`${pfeil}:\\ ${fx}(x)\\to ${Mathe.erkennen(g.y).tex}`);
      case 'schief': return formel(`${pfeil}:\\ ${fx}(x)\\to${g.richtung === 'plus' ? '+' : '-'}\\infty`);
      case 'schwankt': return formel(pfeil) + ' schwankt, kein Grenzwert';
      case 'unklar': return formel(pfeil) + ' nicht eindeutig';
      default: return formel(pfeil) + ' nicht definiert';
    }
  };
  teile.push(karte('Verhalten im Unendlichen',
    zeile('links', grenze(u.unendlich.minus, '-\\infty')), zeile('rechts', grenze(u.unendlich.plus, '+\\infty')),
    ...u.asymptoten.map((a) => zeile(a.art === 'senkrecht' ? 'senkrechte Asymptote' : a.art === 'waagerecht' ? 'waagerechte Asymptote' : 'schiefe Asymptote',
      formel(a.art === 'senkrecht' ? `x=${Mathe.erkennen(a.x).tex}` : a.art === 'waagerecht' ? `y=${Mathe.erkennen(a.y).tex}` : `y=${Mathe.tex(Mathe.vereinfachen(Mathe.B('+', Mathe.B('*', Mathe.Z(a.m), Mathe.V('x')), Mathe.Z(a.b))))}`))),
    ...u.luecken.filter((l) => l.art === 'hebbar').map((l) => zeile('hebbare Lücke', formel(`x=${Mathe.erkennen(l.x).tex}`)))));
  if (!u.vollstaendig) teile.push(h('div', { class: 'vx-fussnote' }, `Untersucht im sichtbaren Bereich ${Mathe.zahlKurz(u.von, 3)} ≤ x ≤ ${Mathe.zahlKurz(u.bis, 3)}. Verschieb oder zoome den Graphen, um weiter zu suchen.`));
  else teile.push(h('div', { class: 'vx-fussnote' }, 'Polynom: alle Stellen auf ganz ℝ gefunden. Exakte Werte (√2, 3/4 …) erkennt Vertex an der Zahl und prüft sie.'));
  // Aktionen
  teile.push(h('div', { class: 'vx-leiste-aktionen' },
    h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(Mathe.diskussionMarkdown(u, r.name), 'Kurvendiskussion kopiert (Markdown mit LaTeX)') }, symbol('kopie'), 'Kopieren'),
    h('button', { class: 'knopf tonal klein', onclick: erklaeren, disabled: wz.erklaerung && wz.erklaerung.laeuft }, symbol('ki'), 'Erklär mir das')));
  if (wz.erklaerung) teile.push(erklaerungsKarte());
  return teile;
}
const tiefgestellt = (n) => String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');
function intervallTex(m, u) {
  // Ränder des untersuchten Bereichs: bei Polynomen ±∞, sonst „…“ (weiter draußen nicht untersucht)
  const rand = (v, w) => (u.vollstaendig ? null : w);
  const l = m.l <= u.von + 1e-9 ? rand(m.l, '\\ldots') : Mathe.erkennen(m.l).tex;
  const r = m.r >= u.bis - 1e-9 ? rand(m.r, '\\ldots') : Mathe.erkennen(m.r).tex;
  if (l === '\\ldots' && r === '\\ldots') return 'im ganzen Bereich';
  if (l === '\\ldots') return formel(`\\ldots<x<${r}`);
  if (r === '\\ldots') return formel(`${l}<x<\\ldots`);
  if (l === null && r === null) return formel('x\\in\\mathbb{R}');
  if (l === null) return formel(`x<${r}`);
  if (r === null) return formel(`x>${l}`);
  return formel(`${l}<x<${r}`);
}

function ableitungAlsZeile(k, a) {
  const r = wz.ergebnis;
  const e = gewaehlt();
  const d = e && deutungVon(e.id);
  if (d && d.name) zeilenAnhaengen([`${d.name}${"'".repeat(k)}(x)`]);
  else zeilenAnhaengen([`y = ${Mathe.text(a)}`]);
  lyra.toast(`${k === 1 ? 'Erste' : 'Zweite'} Ableitung steht jetzt im Blatt`, 'ok');
  void r;
}

// ------------------------------------------------------------------ Werkzeuge

function feld(name, wert, bei, { breit = false, platzhalter = '' } = {}) {
  const f = h('input', { class: 'vx-mini' + (breit ? ' breit' : ''), value: wert ?? '', placeholder: platzhalter, 'data-feld': name, spellcheck: 'false' });
  f.addEventListener('input', () => { bei(f.value); zeichnen(); clearTimeout(f._plan); f._plan = setTimeout(leisteAktualisieren, 350); });
  f.addEventListener('change', () => leisteAktualisieren());
  return f;
}
function funktionsWahl(wert, bei, leerText) {
  const andere = funktionsZeilen(z.auswahl);
  const optionen = [['', leerText], ...andere.map((e) => [e.id, (deutungVon(e.id).name ? deutungVon(e.id).name + '(x)' : e.text.slice(0, 28))])];
  return lyra.auswahl({ optionen, wert: wert ?? '', beiWahl: (w) => { bei(w === '' ? null : w); leisteAktualisieren(); zeichnen(); } });
}

function werkzeugReiter(r) {
  const u = r.u, n = r.name;
  const teile = [];
  // Integral und Fläche
  if (!wz.integral) {
    const xs = u.nullstellen.map((p) => p.x);
    wz.integral = { a: xs.length >= 2 ? eingabeZahl(xs[0], 6) : '0', b: xs.length >= 2 ? eingabeZahl(xs[xs.length - 1], 6) : '2', mit: null, an: false };
  }
  const I = wz.integral;
  const a = zahlAus(I.a), b = zahlAus(I.b);
  const g = I.mit ? (deutungVon(I.mit) || {}).f : null;
  let ergebnisI = null;
  if (Number.isFinite(a) && Number.isFinite(b)) {
    const fd = g ? (x) => r.f(x) - g(x) : r.f;
    const i = Mathe.integral(fd, a, b), fl = Mathe.flaeche(fd, a, b);
    ergebnisI = i.ok ? [
      zeile('Integral', formel(`\\int_{${Mathe.erkennen(a).tex}}^{${Mathe.erkennen(b).tex}}${g ? `\\left(${texName(n)}(x)-${I.mit && deutungVon(I.mit).name ? texName(deutungVon(I.mit).name) + '(x)' : 'y_2'}\\right)` : texName(n) + '(x)'}\\,dx${Mathe.wertTex(i.wert)}`)),
      zeile(g ? 'Fläche dazwischen' : 'Fläche mit x-Achse', formel(`A${Mathe.wertTex(fl.wert)}`)),
      fl.stuecke.length > 1 ? h('div', { class: 'vx-fussnote' }, `Fläche in ${fl.stuecke.length} Teilen (an den ${g ? 'Schnittstellen' : 'Nullstellen'} getrennt), jeweils als Betrag addiert.`) : null,
    ] : [h('div', { class: 'kasten warn' }, 'Zwischen diesen Grenzen ist die Funktion nicht überall definiert (Polstelle oder Lücke) – das Integral existiert so nicht.')];
  }
  teile.push(karte('Integral und Fläche',
    h('div', { class: 'vx-formzeile' }, h('span', {}, 'von'), feld('ia', I.a, (v) => { I.a = v; }), h('span', {}, 'bis'), feld('ib', I.b, (v) => { I.b = v; })),
    h('div', { class: 'vx-formzeile' }, h('span', {}, 'zwischen dem Graphen und'), funktionsWahl(I.mit, (w) => { I.mit = w; }, 'der x-Achse')),
    h('div', { class: 'vx-formzeile' },
      h('button', { class: 'vx-chip', onclick: () => grenzenSetzen() }, g ? 'Grenzen = Schnittstellen' : 'Grenzen = äußere Nullstellen')),
    ergebnisI));
  // Tangente
  if (!wz.tangente) wz.tangente = { x0: '1', normale: false };
  const T = wz.tangente;
  const x0 = zahlAus(T.x0);
  let tangInhalt = [];
  if (Number.isFinite(x0) && Number.isFinite(r.f(x0)) && Number.isFinite(r.df(x0))) {
    const y0 = r.f(x0), m = r.df(x0);
    const t = geradeAst(m, y0 - m * x0);
    tangInhalt = [
      zeile('Berührpunkt', formel(punktTex(x0, y0))),
      zeile('Steigung', formel(`${texName(n)}'(${Mathe.erkennen(x0).tex})${Mathe.wertTex(m)}`)),
      zeile('Tangente', formel(`t(x)=${Mathe.tex(t)}`)),
      Math.abs(m) > 1e-12 ? zeile('Normale', formel(`n(x)=${Mathe.tex(geradeAst(-1 / m, y0 + x0 / m))}`)) : zeile('Normale', formel(`x=${Mathe.erkennen(x0).tex}`)),
      h('div', { class: 'vx-formzeile' },
        h('button', { class: 'vx-chip' + (T.normale ? ' an' : ''), onclick: () => { T.normale = !T.normale; leisteAktualisieren(); zeichnen(); } }, T.normale ? 'Normale sichtbar' : 'Normale zeigen'),
        h('button', { class: 'vx-chip', onclick: () => { zeilenAnhaengen([`t(x) = ${Mathe.text(t)}`.replace(/^t\(/, freierName() + '(')]); } }, '+ Tangente als Zeile'),
        Math.abs(m) > 1e-12 ? h('button', { class: 'vx-chip', onclick: () => { zeilenAnhaengen([`${freierName()}(x) = ${Mathe.text(geradeAst(-1 / m, y0 + x0 / m))}`]); } }, '+ Normale') : null),
    ];
  } else tangInhalt = [h('div', { class: 'leise' }, 'An dieser Stelle ist die Funktion nicht definiert oder nicht ableitbar.')];
  const A = z.A;
  const regler = h('input', { type: 'range', class: 'vx-regler', min: A ? A.xmin : -10, max: A ? A.xmax : 10, step: A ? (A.xmax - A.xmin) / 400 : 0.05, value: Number.isFinite(x0) ? x0 : 0 });
  regler.addEventListener('input', () => {
    const sch = Grafik.schritt(z.A.sx).fein / 4;
    T.x0 = eingabeZahl(Math.round(Number(regler.value) / sch) * sch, 4);
    const f = document.querySelector('[data-feld="tx"]');
    if (f) f.value = T.x0;
    zeichnen();
    clearTimeout(regler._plan);
    regler._plan = setTimeout(leisteAktualisieren, 120);
  });
  teile.push(karte('Tangente und Normale', h('div', { class: 'vx-formzeile' }, h('span', {}, 'an der Stelle x₀ ='), feld('tx', T.x0, (v) => { T.x0 = v; })), regler, ...tangInhalt));
  // Schnittpunkte
  const andere = funktionsZeilen(z.auswahl);
  if (andere.length) {
    if (wz.schnitt && !andere.some((e) => e.id === wz.schnitt)) wz.schnitt = null;
    const sp = schnittpunkte();
    teile.push(karte('Schnittpunkte',
      h('div', { class: 'vx-formzeile' }, h('span', {}, 'mit'), funktionsWahl(wz.schnitt, (w) => { wz.schnitt = w; }, 'Funktion wählen …')),
      wz.schnitt ? (sp.length ? sp.map((p, i) => zeile(`S${tiefgestellt(i + 1)}`, formel(punktTex(p.x, p.y)), () => markerUmschalten(p.x, p.y))) : h('div', { class: 'leise' }, 'keine Schnittpunkte im sichtbaren Bereich')) : null));
  }
  // Gleichung lösen
  if (!wz.loesen) wz.loesen = { c: '0' };
  const L = loesungen();
  teile.push(karte('Gleichung lösen',
    h('div', { class: 'vx-formzeile' }, h('span', { html: formel(`${texName(n)}(x)=`) }), feld('lc', wz.loesen.c, (v) => { wz.loesen.c = v; })),
    L.length ? L.map((x, i) => zeile(`x${tiefgestellt(i + 1)}`, formel(`x${Mathe.wertTex(x)}`))) : h('div', { class: 'leise' }, Number.isFinite(zahlAus(wz.loesen.c)) ? 'keine Lösung im sichtbaren Bereich' : 'Gib eine Zahl ein.')));
  // Funktionswert
  if (!wz.wert) wz.wert = { x: '2' };
  const xw = zahlAus(wz.wert.x);
  teile.push(karte('Funktionswert',
    h('div', { class: 'vx-formzeile' }, h('span', {}, 'x ='), feld('wx', wz.wert.x, (v) => { wz.wert.x = v; })),
    Number.isFinite(xw) ? [zeile(`${n}(x)`, formel(`${texName(n)}(${Mathe.erkennen(xw).tex})${Number.isFinite(r.f(xw)) ? Mathe.wertTex(r.f(xw)) : '\\text{ nicht definiert}'}`)),
      Number.isFinite(r.df(xw)) ? zeile(`${n}′(x)`, formel(`${texName(n)}'(${Mathe.erkennen(xw).tex})${Mathe.wertTex(r.df(xw))}`)) : null] : null));
  return teile;
}
function geradeAst(m, b) {
  const q = (v) => Mathe.Z(Mathe.qAusZahl(v, 1000));
  return Mathe.vereinfachen(Mathe.B('+', Mathe.B('*', q(m), Mathe.V('x')), q(b)));
}
function grenzenSetzen() {
  const r = wz.ergebnis;
  const I = wz.integral;
  let xs;
  if (I.mit) {
    const alt = wz.schnitt;
    wz.schnitt = I.mit;
    xs = schnittpunkte().map((p) => p.x);
    wz.schnitt = alt;
  } else xs = r.u.nullstellen.map((p) => p.x);
  if (xs.length < 2) return lyra.toast(I.mit ? 'Es gibt keine zwei Schnittstellen im sichtbaren Bereich.' : 'Es gibt keine zwei Nullstellen im sichtbaren Bereich.');
  I.a = eingabeZahl(xs[0], 8);
  I.b = eingabeZahl(xs[xs.length - 1], 8);
  leisteAktualisieren();
  zeichnen();
}

// ------------------------------------------------------------------ Wertetabelle

function tabellenReiter(r) {
  const T = wz.tabelle;
  const von = zahlAus(T.von), bis = zahlAus(T.bis), sch = zahlAus(T.schritt);
  const zeilen = [];
  if ([von, bis, sch].every(Number.isFinite) && sch > 0 && bis >= von) {
    const n = Math.min(400, Math.floor((bis - von) / sch + 1e-9));
    for (let i = 0; i <= n; i++) {
      const x = von + i * sch;
      zeilen.push([x, r.f(x), r.df(x)]);
    }
  }
  const zahl = (v) => (Number.isFinite(v) ? Mathe.zahlKurz(v, 4) : '–');
  const name = r.name;
  const csv = () => [`x;${name}(x)${T.ableitung ? `;${name}'(x)` : ''}`, ...zeilen.map(([x, y, d]) => [x, y, ...(T.ableitung ? [d] : [])].map((v) => (Number.isFinite(v) ? String(Number(v.toPrecision(10))).replace('.', ',') : '')).join(';'))].join('\n');
  const md = () => [`| x | ${name}(x) |${T.ableitung ? ` ${name}'(x) |` : ''}`, `|---|---|${T.ableitung ? '---|' : ''}`, ...zeilen.map(([x, y, d]) => `| ${zahl(x)} | ${zahl(y)} |${T.ableitung ? ` ${zahl(d)} |` : ''}`)].join('\n');
  return [
    karte(null,
      h('div', { class: 'vx-formzeile' }, h('span', {}, 'von'), feld('tv', T.von, (v) => { T.von = v; }), h('span', {}, 'bis'), feld('tb', T.bis, (v) => { T.bis = v; }), h('span', {}, 'Schritt'), feld('ts', T.schritt, (v) => { T.schritt = v; })),
      lyra.schalter({ wert: T.ableitung, text: 'Spalte für die Ableitung', beiWahl: (v) => { T.ableitung = v; leisteAktualisieren(); } })),
    zeilen.length ? h('div', { class: 'vx-tabelle-rahmen' }, h('table', { class: 'vx-wertetabelle' },
      h('tr', {}, h('th', {}, 'x'), h('th', {}, name + '(x)'), T.ableitung ? h('th', {}, name + '′(x)') : null),
      zeilen.map(([x, y, d]) => h('tr', {}, h('td', {}, zahl(x)), h('td', {}, zahl(y)), T.ableitung ? h('td', {}, zahl(d)) : null))))
      : h('div', { class: 'kasten warn' }, 'Gib Anfang, Ende und einen positiven Schritt ein.'),
    zeilen.length ? h('div', { class: 'vx-leiste-aktionen' },
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(csv(), 'Tabelle kopiert (für Excel/Numbers)') }, 'Als Tabelle kopieren'),
      h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(md(), 'Tabelle kopiert (Markdown)') }, 'Als Markdown')) : null,
  ];
}

// ------------------------------------------------------------------ KI: Kurvendiskussion erklären

function lehrerName(k) {
  const l = ((z.info && z.info.lehrer) || []).find((x) => x.kennung === k);
  return l ? l.name : k === 'lyra' ? 'Lyra (lokal)' : k;
}

async function erklaeren() {
  const r = wz.ergebnis;
  if (!r || !r.u) return;
  const lehrer = z.lehrer;
  wz.erklaerung = { laeuft: true, text: '', lehrer };
  leisteAktualisieren();
  const fakten = Mathe.diskussionMarkdown(r.u, r.name);
  const system = 'Du bist eine geduldige Mathelehrkraft (Oberstufe). Du erklärst eine Kurvendiskussion Schritt für Schritt auf Deutsch. ' +
    'Alle Zahlen und Ergebnisse stehen schon fest – sie wurden exakt berechnet. Verwende NUR diese Werte, rechne nichts neu, erfinde keine Punkte. ' +
    'Erkläre zu jedem Schritt kurz das Vorgehen (z. B. notwendige Bedingung f′(x) = 0, hinreichende Bedingung mit f″ oder Vorzeichenwechsel), ' +
    'damit man es selbst nachrechnen kann. Formeln in LaTeX mit $…$. Höchstens 350 Wörter.';
  const prompt = `Funktion und berechnete Ergebnisse:\n\n${fakten}\n\nErkläre, wie man auf diese Ergebnisse kommt.`;
  try {
    const a = await lyra.ki({ lehrer, system, prompt }, (s) => {
      if (s && s.art === 'text' && wz.erklaerung) { wz.erklaerung.text += s.text; const t = document.querySelector('.vx-erklaerung-text'); if (t) t.replaceChildren(lyra.mdElement(wz.erklaerung.text)); }
    });
    wz.erklaerung = { laeuft: false, text: (a && a.text) || wz.erklaerung.text, lehrer: (a && a.lehrer) || lehrer };
  } catch (e) {
    const m = String((e && e.message) || e);
    wz.erklaerung = /ABGEBROCHEN/.test(m) ? null : { laeuft: false, fehler: m, lehrer };
  }
  leisteAktualisieren();
}
function erklaerungsKarte() {
  const x = wz.erklaerung;
  const lokal = x.lehrer === 'lyra';
  return karte('Erklärung',
    lokal ? h('div', { class: 'kasten warn', style: { marginBottom: '8px' } }, 'Lyra lokal ist ein kleines Modell und kann sich beim Erklären vertun. Die Werte oben hat Vertex exakt berechnet – die gelten.') : null,
    x.fehler ? lyra.fehlerBox(x.fehler, lyra.istOffline(x.fehler) ? () => { z.lehrer = 'lyra'; erklaeren(); } : null, () => { wz.erklaerung = null; leisteAktualisieren(); }) : null,
    x.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen' }, `${lehrerName(x.lehrer)} schreibt …`), h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : null,
    h('div', { class: 'vx-erklaerung-text' }, x.text ? lyra.mdElement(x.text) : null),
    !x.laeuft ? h('div', { class: 'vx-leiste-aktionen' }, h('span', { class: 'leise klein wachsen' }, lehrerName(x.lehrer)), h('button', { class: 'knopf text klein', onclick: () => { wz.erklaerung = null; leisteAktualisieren(); } }, 'Schließen')) : null);
}

// ================================================================== Großer Dialog (für Steckbrief und Beschreiben)

function grosserDialog(titel, bauen, { breit = 760 } = {}) {
  const inhalt = h('div', { class: 'vx-dialog-inhalt' });
  const grund = h('div', { class: 'dialog-grund' });
  const zu = () => { grund.remove(); };
  grund.addEventListener('mousedown', (e) => { if (e.target === grund) zu(); });
  grund.appendChild(h('div', { class: 'dialog vx-dialog', style: { width: `min(${breit}px, calc(100vw - 40px))` } },
    h('div', { class: 'vx-dialog-kopf' }, h('h3', {}, titel), h('button', { class: 'knopf symbol', title: 'Schließen', onclick: zu }, symbol('x'))),
    inhalt));
  document.body.appendChild(grund);
  const neu = () => {
    const aktiv = document.activeElement;
    const name = aktiv && inhalt.contains(aktiv) ? aktiv.dataset.feld : null;
    const pos = name && aktiv.selectionStart !== undefined ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
    inhalt.replaceChildren(...[].concat(bauen(neu, zu)).filter(Boolean));
    if (name) { const f = inhalt.querySelector(`[data-feld="${name}"]`); if (f) { f.focus(); if (pos) try { f.setSelectionRange(pos[0], pos[1]); } catch (_) {} } }
  };
  neu();
  return { neu, zu };
}

// ================================================================== Steckbrief

const BEDINGUNGEN = [
  ['punkt', 'Punkt auf dem Graphen'], ['extremum', 'Extrempunkt (Hoch-/Tiefpunkt)'], ['wendepunkt', 'Wendepunkt'], ['sattel', 'Sattelpunkt'],
  ['steigung', 'Steigung an einer Stelle'], ['tangente', 'Tangente an einer Stelle'], ['integral', 'Integral (Fläche)'], ['ableitung', 'Wert einer Ableitung'],
];
const sb = { grad: 3, symmetrie: 'keine', bedingungen: [], text: '', laeuft: false, hinweis: '', ergebnis: null, fehler: '' };

function steckbriefOeffnen() {
  if (!sb.bedingungen.length) sb.bedingungen = [{ art: 'punkt', x: '', y: '' }];
  grosserDialog('Steckbriefaufgabe', steckbriefBauen);
}
function steckbriefBauen(neu, zu) {
  const bed = (c, i) => {
    const f = (k, platz, breite = '') => {
      const el = h('input', { class: 'vx-mini' + breite, value: c[k] ?? '', placeholder: platz, 'data-feld': `b${i}${k}`, spellcheck: 'false' });
      el.addEventListener('input', () => { c[k] = el.value; sb.ergebnis = null; });
      return el;
    };
    const t = (s) => h('span', { class: 'vx-bed-text' }, s);
    let felder;
    switch (c.art) {
      case 'punkt': felder = [t('f('), f('x', 'x'), t(') ='), f('y', 'y')]; break;
      case 'extremum': case 'wendepunkt': case 'sattel': felder = [t('bei x ='), f('x', 'x'), t('mit y ='), f('y', 'optional')]; break;
      case 'steigung': felder = [t("f′("), f('x', 'x'), t(') ='), f('m', 'm')]; break;
      case 'tangente': felder = [t('bei x ='), f('x', 'x'), t(': y ='), f('m', 'm'), t('· x +'), f('b', 'b')]; break;
      case 'integral': felder = [t('∫ von'), f('von', 'a'), t('bis'), f('bis', 'b'), t('='), f('wert', 'Wert')]; break;
      case 'ableitung': felder = [t('f'), lyra.auswahl({ optionen: [[1, '′  (1. Ableitung)'], [2, '″  (2. Ableitung)'], [3, '‴  (3. Ableitung)']], wert: c.abl ?? 1, beiWahl: (w) => { c.abl = Number(w); neu(); } }), t('('), f('x', 'x'), t(') ='), f('wert', 'Wert')]; break;
      default: felder = [];
    }
    return h('div', { class: 'vx-bedingung' },
      lyra.auswahl({ optionen: BEDINGUNGEN.map(([w, n]) => [w, n]), wert: c.art, beiWahl: (w) => { c.art = w; sb.ergebnis = null; neu(); } }),
      h('div', { class: 'vx-bed-felder' }, felder),
      h('button', { class: 'knopf symbol', title: 'Bedingung entfernen', onclick: () => { sb.bedingungen.splice(i, 1); sb.ergebnis = null; neu(); } }, symbol('x')));
  };
  const loesen = () => {
    try {
      const bedingungen = sb.bedingungen.map((c) => ({ ...c }));
      for (const c of bedingungen) {
        const pflicht = { punkt: ['x', 'y'], extremum: ['x'], wendepunkt: ['x'], sattel: ['x'], steigung: ['x', 'm'], tangente: ['x', 'm', 'b'], integral: ['von', 'bis', 'wert'], ableitung: ['x', 'wert'] }[c.art] || [];
        for (const k of pflicht) if (!String(c[k] ?? '').trim()) throw new Error('Bei einer Bedingung fehlt noch eine Zahl.');
      }
      sb.ergebnis = Mathe.steckbrief({ grad: sb.grad, symmetrie: sb.symmetrie === 'keine' ? null : sb.symmetrie, bedingungen });
      sb.fehler = '';
    } catch (e) { sb.ergebnis = null; sb.fehler = e.message; }
    neu();
  };
  const kiTeil = h('div', { class: 'vx-ki-teil' },
    h('div', { class: 'vx-karte-titel' }, 'Aus dem Aufgabentext (KI, optional)'),
    (() => {
      const t = h('textarea', { class: 'eingabe', rows: 3, placeholder: 'z. B. „Der Graph einer ganzrationalen Funktion 3. Grades hat im Ursprung einen Wendepunkt und bei H(1|2) einen Hochpunkt.“', 'data-feld': 'sbtext' });
      t.value = sb.text;
      t.addEventListener('input', () => { sb.text = t.value; });
      return t;
    })(),
    h('div', { class: 'vx-formzeile' },
      lyra.lehrerWahl(z.info, z.lehrer, (w) => { z.lehrer = w; neu(); }),
      h('div', { class: 'wachsen' }),
      sb.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), 'liest die Aufgabe …', h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen'))
        : h('button', { class: 'knopf tonal klein', disabled: !sb.text.trim(), onclick: () => steckbriefKi(neu) }, symbol('ki'), 'Bedingungen erkennen')),
    sb.hinweis ? h('div', { class: 'kasten warn' }, sb.hinweis) : null);
  const r = sb.ergebnis;
  return [
    kiTeil,
    h('div', { class: 'vx-formzeile', style: { marginTop: '14px' } },
      h('span', { class: 'fett' }, 'Ganzrationale Funktion vom Grad'),
      lyra.auswahl({ optionen: [1, 2, 3, 4, 5, 6].map((g) => [g, String(g)]), wert: sb.grad, beiWahl: (w) => { sb.grad = Number(w); sb.ergebnis = null; neu(); } }),
      lyra.auswahl({ optionen: [['keine', 'ohne Symmetrie'], ['achse', 'achsensymmetrisch zur y-Achse'], ['punkt', 'punktsymmetrisch zum Ursprung']], wert: sb.symmetrie, beiWahl: (w) => { sb.symmetrie = w; sb.ergebnis = null; neu(); } })),
    h('div', { class: 'vx-bedingungen' }, sb.bedingungen.map(bed)),
    h('div', { class: 'vx-formzeile' },
      h('button', { class: 'knopf text klein', onclick: () => { sb.bedingungen.push({ art: 'punkt', x: '', y: '' }); neu(); } }, '+ Bedingung'),
      h('div', { class: 'wachsen' }),
      h('span', { class: 'leise klein' }, `${unbekannteZahl()} Unbekannte · ${gleichungsZahl()} Gleichung${gleichungsZahl() === 1 ? '' : 'en'}`),
      h('button', { class: 'knopf', onclick: loesen }, 'Exakt lösen')),
    sb.fehler ? h('div', { class: 'kasten falsch' }, sb.fehler) : null,
    r ? steckbriefErgebnis(r, zu) : null,
  ];
}
function unbekannteZahl() {
  let n = 0;
  for (let i = sb.grad; i >= 0; i--) if (!(sb.symmetrie === 'achse' && i % 2) && !(sb.symmetrie === 'punkt' && i % 2 === 0)) n++;
  return n;
}
function gleichungsZahl() {
  return sb.bedingungen.reduce((s, c) => s + ({ punkt: 1, steigung: 1, integral: 1, ableitung: 1, tangente: 2, sattel: 2 }[c.art] || 1) + (['extremum', 'wendepunkt', 'sattel'].includes(c.art) && String(c.y ?? '').trim() ? 1 : 0), 0);
}
function steckbriefErgebnis(r, zu) {
  const teile = [
    h('div', { class: 'vx-karte-titel' }, 'Ansatz'), h('div', { class: 'vx-formel-block', html: formel(r.ansatz) }),
    h('div', { class: 'vx-karte-titel' }, 'Gleichungssystem'),
    h('div', { class: 'vx-gleichungen' }, r.gleichungen.map((g) => h('div', { class: 'vx-gleichung' }, h('span', { class: 'vx-gleichung-was', html: formel(g.bedingung) }), h('span', { class: 'vx-pfeil-rechts' }, '⇒'), h('span', { html: formel(g.tex) })))),
  ];
  if (!r.ok) {
    teile.push(h('div', { class: 'kasten warn' }, r.fehler));
    return h('div', { class: 'vx-steckbrief-ergebnis' }, teile);
  }
  teile.push(h('div', { class: 'vx-karte-titel' }, 'Lösung'),
    h('div', { class: 'vx-loesung' }, r.loesung.map((l) => h('span', { html: formel(`${l.name}=${l.tex}`) }))),
    h('div', { class: 'vx-ergebnis-funktion', html: formel(`f(x)=${r.tex}`) }),
    ...r.hinweise.map((t) => h('div', { class: 'kasten ' + (/nicht|kein/.test(t) && /Probe/.test(t) ? 'warn' : 'ok') }, t)),
    h('div', { class: 'vx-formzeile' }, h('div', { class: 'wachsen' }),
      h('button', { class: 'knopf text', onclick: () => lyra.kopieren(steckbriefMarkdown(r), 'Rechenweg kopiert') }, 'Rechenweg kopieren'),
      h('button', { class: 'knopf', onclick: () => { const n = freierName(); zeilenAnhaengen([`${n}(x) = ${r.text}`]); zu(); allesZeigen(); zeichnen(); lyra.toast(`${n}(x) steht jetzt im Blatt`, 'ok'); } }, 'Ins Blatt übernehmen')));
  return h('div', { class: 'vx-steckbrief-ergebnis' }, teile);
}
function steckbriefMarkdown(r) {
  return [`**Ansatz:** $${r.ansatz}$`, '', '**Gleichungssystem:**', ...r.gleichungen.map((g) => `- $${g.bedingung}$ ⇒ $${g.tex}$`), '',
    `**Lösung:** ${r.loesung.map((l) => `$${l.name}=${l.tex}$`).join(', ')}`, '', `**Funktion:** $f(x)=${r.tex}$`, ...(r.hinweise.length ? ['', ...r.hinweise.map((t) => `- ${t}`)] : [])].join('\n');
}

const STECKBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    grad: { type: 'integer' },
    symmetrie: { type: 'string', enum: ['keine', 'achse', 'punkt'] },
    bedingungen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: BEDINGUNGEN.map((b) => b[0]) },
          x: { type: 'string' }, y: { type: 'string' }, m: { type: 'string' }, b: { type: 'string' },
          von: { type: 'string' }, bis: { type: 'string' }, wert: { type: 'string' }, abl: { type: 'integer' },
        },
        required: ['art'],
      },
    },
  },
  required: ['grad', 'bedingungen'],
};
const STECKBRIEF_SYSTEM = 'Du übersetzt deutsche Steckbriefaufgaben (ganzrationale Funktionen) in Bedingungen. Antworte nur mit JSON nach dem Schema. Regeln:\n' +
    '- „Punkt P(a|b)“, „geht durch (a|b)“, „schneidet die y-Achse bei b“ (→ x=0) → art "punkt" mit x, y.\n' +
    '- „Ursprung“ ist (0|0).\n' +
    '- „Hochpunkt/Tiefpunkt/Extrempunkt H(a|b)“ → "extremum" mit x=a, y=b. „Extremstelle bei a“ → "extremum" nur mit x.\n' +
    '- „berührt die x-Achse bei a“ → "extremum" mit x=a, y=0.\n' +
    '- „Wendepunkt W(a|b)“ → "wendepunkt" mit x, y; „Wendestelle bei a“ → nur x.\n' +
    '- „Sattelpunkt / Terrassenpunkt (a|b)“ → "sattel".\n' +
    '- „Steigung m bei x=a“, „Tangente mit Steigung m“ → "steigung" mit x, m. „parallel zur x-Achse“ heißt Steigung 0.\n' +
    '- „Tangente y = m·x + c im Punkt mit x=a“, „Wendetangente“ → "tangente" mit x, m, b (b = c); bei Wendetangente zusätzlich "wendepunkt" mit x.\n' +
    '- „schließt mit der x-Achse zwischen a und b die Fläche A ein“ → "integral" mit von, bis, wert.\n' +
    '- grad: „dritten Grades“ = 3, „quadratisch“/Parabel = 2, „vierten Grades“ = 4.\n' +
    '- symmetrie: „achsensymmetrisch zur y-Achse“ → "achse", „punktsymmetrisch zum Ursprung“ → "punkt", sonst "keine".\n' +
    '- Zahlen als Text, Brüche wie "1/2". Erfinde nichts, was nicht im Text steht.';

/** KI-Antwort (Schema STECKBRIEF_SCHEMA) → Bedingungen fürs Formular */
function bedingungenAusKi(j) {
  const erlaubt = new Set(BEDINGUNGEN.map((b) => b[0]));
  return j.bedingungen.filter((c) => c && erlaubt.has(c.art)).map((c) => {
    const s = (v) => (v === undefined || v === null ? '' : String(v).replace('.', ',').trim());
    return { art: c.art, x: s(c.x), y: s(c.y), m: s(c.m), b: s(c.b), von: s(c.von), bis: s(c.bis), wert: s(c.wert), abl: c.abl || 1 };
  });
}

async function steckbriefKi(neu) {
  sb.laeuft = true;
  sb.hinweis = '';
  neu();
  try {
    const a = await lyra.ki({ lehrer: z.lehrer, system: STECKBRIEF_SYSTEM, prompt: sb.text, schema: STECKBRIEF_SCHEMA });
    const j = a && a.json;
    if (!j || !Array.isArray(j.bedingungen)) throw new Error('Die KI hat keine Bedingungen geliefert. Trag sie lieber selbst ein.');
    sb.bedingungen = bedingungenAusKi(j);
    if (!sb.bedingungen.length) sb.bedingungen = [{ art: 'punkt', x: '', y: '' }];
    if (Number.isInteger(j.grad) && j.grad >= 1 && j.grad <= 6) sb.grad = j.grad;
    if (['keine', 'achse', 'punkt'].includes(j.symmetrie)) sb.symmetrie = j.symmetrie;
    sb.hinweis = `${lehrerName(a.lehrer || z.lehrer)} hat ${sb.bedingungen.length} Bedingung${sb.bedingungen.length === 1 ? '' : 'en'} erkannt – bitte mit dem Aufgabentext vergleichen, bevor du löst. Die KI kann sich irren.`;
    sb.ergebnis = null;
  } catch (e) {
    const m = String((e && e.message) || e);
    sb.hinweis = /ABGEBROCHEN/.test(m) ? '' : m;
  }
  sb.laeuft = false;
  neu();
}

// ================================================================== Messwerte (Tabelle) und Regression

const MODELLE = [['keine', 'keine Ausgleichsfunktion'], ['linear', 'linear  y = mx + b'], ['quadratisch', 'quadratisch'], ['kubisch', 'kubisch (Grad 3)'],
  ['exponentiell', 'exponentiell  y = a·e^(bx)'], ['potenz', 'Potenz  y = a·x^b'], ['logarithmisch', 'logarithmisch  y = a + b·ln x']];

function tabelleNeu() {
  const e = zeileEinfuegen(z.blatt.eintraege.length, '', false, { art: 'tabelle', text: '', tabelle: { punkte: [[1, NaN], [2, NaN], [3, NaN]], modell: 'linear', spalten: ['x', 'y'] } });
  e.text = '';
  setTimeout(() => { const f = document.querySelector(`[data-zelle="${e.id}-0-1"]`); if (f) f.focus(); }, 30);
}

function tabellenZeile(e, i) {
  const T = e.tabelle || (e.tabelle = { punkte: [], modell: 'linear' });
  const r = z.regression.get(e.id);
  const zelle = (zi, s) => {
    const v = T.punkte[zi][s];
    const f = h('input', { class: 'vx-zelle', value: Number.isFinite(v) ? String(v).replace('.', ',') : '', 'data-zelle': `${e.id}-${zi}-${s}`, inputmode: 'decimal' });
    f.addEventListener('focus', () => { z.fokusVorher = schnappschuss(); });
    f.addEventListener('input', () => {
      const w = Number(f.value.replace(',', '.').replace('−', '-'));
      T.punkte[zi][s] = f.value.trim() === '' || !Number.isFinite(w) ? NaN : w;
      deuten();
      sichern();
      zeichnen();
      const st = document.querySelector(`[data-reg="${e.id}"]`);
      if (st) st.replaceWith(regressionsAnzeige(e));
    });
    f.addEventListener('blur', () => { if (z.fokusVorher && z.fokusVorher !== schnappschuss()) merken(z.fokusVorher); z.fokusVorher = null; });
    f.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || (ev.key === 'Tab' && !ev.shiftKey && s === 1 && zi === T.punkte.length - 1)) {
        ev.preventDefault();
        if (zi === T.punkte.length - 1) { merken(); T.punkte.push([NaN, NaN]); malen(); }
        setTimeout(() => { const n = document.querySelector(`[data-zelle="${e.id}-${zi + 1}-${ev.key === 'Enter' ? s : 0}"]`); if (n) n.focus(); }, 10);
      }
    });
    return f;
  };
  return h('div', { class: 'vx-zeile vx-tabellenzeile', 'data-id': e.id, style: { '--f': e.farbe } },
    h('div', { class: 'vx-nummer' }, String(i + 1)),
    h('button', { class: 'vx-farbe' + (e.sichtbar === false ? ' aus' : ''), style: { '--f': e.farbe }, title: 'Ein-/Ausblenden', onclick: () => { merken(); e.sichtbar = e.sichtbar === false; nachStruktur(); } }, h('span')),
    h('div', { class: 'vx-inhalt' },
      h('div', { class: 'vx-tabelle-titel' }, 'Messwerte', h('span', { class: 'leise klein' }, ` · ${T.punkte.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).length} Punkte`)),
      h('div', { class: 'vx-messwerte' },
        h('table', {}, h('tr', {}, h('th', {}, 'x'), h('th', {}, 'y'), h('th')),
          T.punkte.map((p, zi) => h('tr', {}, h('td', {}, zelle(zi, 0)), h('td', {}, zelle(zi, 1)),
            h('td', {}, h('button', { class: 'vx-zelle-weg', title: 'Zeile entfernen', onclick: () => { merken(); T.punkte.splice(zi, 1); if (!T.punkte.length) T.punkte.push([NaN, NaN]); nachStruktur(); } }, '×')))))),
      h('div', { class: 'vx-formzeile' },
        h('button', { class: 'vx-chip', onclick: () => { merken(); T.punkte.push([NaN, NaN]); malen(); } }, '+ Zeile'),
        h('button', { class: 'vx-chip', onclick: () => werteEinfuegen(e) }, symbol('einfuegen'), 'Einfügen'),
        h('button', { class: 'vx-chip', onclick: () => werteAusDatei(e) }, symbol('datei'), 'Aus Datei')),
      h('div', { class: 'vx-formzeile' }, h('span', { class: 'leise klein' }, 'Ausgleich:'),
        lyra.auswahl({ optionen: MODELLE, wert: T.modell || 'keine', beiWahl: (w) => { merken(); T.modell = w; nachStruktur(); } })),
      regressionsAnzeige(e)),
    h('div', { class: 'vx-zeile-aktionen' },
      h('button', { class: 'knopf symbol', title: 'Tabelle löschen', onclick: () => zeileLoeschen(e.id) }, symbol('x'))));
}
function regressionsAnzeige(e) {
  const r = z.regression.get(e.id);
  if (!r) return h('div', { 'data-reg': e.id });
  if (!r.ok) return h('div', { class: 'vx-fehler', 'data-reg': e.id }, r.fehler);
  return h('div', { class: 'vx-regression', 'data-reg': e.id },
    h('div', { html: formel(`y=${Mathe.tex(r.ast)}`) }),
    h('div', { class: 'vx-formzeile' },
      h('span', { class: 'leise klein', html: formel(`R^2=${Mathe.zahlKurz(r.r2, 4).replace(',', '{,}')}`) }),
      h('span', { class: 'leise klein' }, r.r2 > 0.98 ? 'passt sehr gut' : r.r2 > 0.9 ? 'passt gut' : r.r2 > 0.7 ? 'passt mäßig' : 'passt schlecht'),
      h('div', { class: 'wachsen' }),
      h('button', { class: 'vx-chip', onclick: () => { zeilenAnhaengen([`${freierName()}(x) = ${Mathe.text(r.ast)}`]); lyra.toast('Ausgleichsfunktion steht jetzt im Blatt', 'ok'); } }, '+ als Funktion')));
}
function zahlenpaare(text) {
  const p = [];
  for (const zl of String(text).split(/\r?\n/)) {
    const t = zl.trim();
    if (!t) continue;
    // Trenner: Tab, Semikolon, mehrere Leerzeichen – oder ein Komma, wenn Punkte als Dezimalzeichen dienen
    let teile = t.split(/\t|;|\s{1,}/).filter(Boolean);
    if (teile.length < 2 && /,/.test(t)) teile = t.split(',');
    const zahlen = teile.map((s) => Number(s.replace(',', '.').replace('−', '-'))).filter(Number.isFinite);
    if (zahlen.length >= 2) p.push([zahlen[0], zahlen[1]]);
  }
  return p;
}
async function werteEinfuegen(e) {
  const t = h('textarea', { class: 'eingabe', rows: 8, placeholder: 'Je Zeile ein Paar x und y, z. B.\n1  2,5\n2  4,1\n3  6,2\n\n(aus Excel oder Numbers einfach hineinkopieren)' });
  const text = await lyra.dialog('Messwerte einfügen', t, [{ text: 'Abbrechen', art: 'text', wert: null }, { text: 'Übernehmen', wert: () => t.value }]);
  if (!text) return;
  const p = zahlenpaare(text);
  if (!p.length) return lyra.toast('Darin habe ich keine Zahlenpaare gefunden.', 'fehler');
  merken();
  e.tabelle.punkte = p;
  nachStruktur();
  allesZeigen();
  zeichnen();
  lyra.toast(`${p.length} Punkte übernommen`, 'ok');
}
async function werteAusDatei(e) {
  let d = null;
  try { d = await lyra.dateiOeffnen({ arten: ['csv', 'xlsx', 'txt'], titel: 'Messwerte' }); } catch (err) { return lyra.toast(String(err.message || err), 'fehler'); }
  if (!d) return;
  let zeilen = [];
  if (d.art === 'tabelle' && Array.isArray(d.zeilen)) zeilen = d.zeilen;
  else zeilen = String(d.text || '').split(/\r?\n/).map((l) => l.split(/;|\t|,(?=\s*-?\d)/));
  const zahl = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(',', '.').replace('−', '-')));
  const breite = Math.max(0, ...zeilen.map((r) => r.length));
  if (breite < 2) return lyra.toast('Die Datei braucht mindestens zwei Spalten mit Zahlen.', 'fehler');
  const kopf = zeilen.find((r) => r.some((v) => String(v ?? '').trim())) || [];
  let sx = 0, sy = 1;
  if (breite > 2) {
    const namen = Array.from({ length: breite }, (_, i) => [i, String(kopf[i] ?? '').trim() && !Number.isFinite(zahl(kopf[i])) ? String(kopf[i]).trim() : `Spalte ${i + 1}`]);
    const wahl = { x: 0, y: 1 };
    const inhalt = h('div', { class: 'spalte' },
      h('div', { class: 'vx-formzeile' }, h('span', {}, 'x aus'), lyra.auswahl({ optionen: namen, wert: 0, beiWahl: (w) => { wahl.x = Number(w); } })),
      h('div', { class: 'vx-formzeile' }, h('span', {}, 'y aus'), lyra.auswahl({ optionen: namen, wert: 1, beiWahl: (w) => { wahl.y = Number(w); } })));
    const ok = await lyra.dialog('Welche Spalten?', inhalt, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Übernehmen', wert: true }]);
    if (!ok) return;
    sx = wahl.x; sy = wahl.y;
  }
  const p = zeilen.map((r) => [zahl(r[sx]), zahl(r[sy])]).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).slice(0, 2000);
  if (!p.length) return lyra.toast('In diesen Spalten stehen keine Zahlen.', 'fehler');
  merken();
  e.tabelle.punkte = p;
  nachStruktur();
  allesZeigen();
  zeichnen();
  lyra.toast(`${p.length} Punkte aus ${d.name || 'der Datei'}`, 'ok');
}

// ================================================================== KI: Beschreiben → Funktionen (nur Vorschläge)

const AUSDRUCK_SCHEMA = {
  type: 'object',
  properties: {
    eintraege: { type: 'array', items: { type: 'object', properties: { ausdruck: { type: 'string' }, erklaerung: { type: 'string' } }, required: ['ausdruck'] } },
  },
  required: ['eintraege'],
};
const AUSDRUCK_SYSTEM = 'Du übersetzt Wünsche für einen Grafikrechner in Eingabezeilen. Antworte nur mit JSON nach dem Schema, höchstens 8 Einträge. ' +
  'Schreibweise (keine LaTeX-Befehle, keine $-Zeichen): Funktion „f(x) = 2x^2 - 3x + 1“, Wurzel sqrt(x), Betrag |x|, e^(x), ln(x), sin(x), pi. ' +
  'Punkte „P(1|2)“. Parameter „a = 2“. Kreis „x^2 + y^2 = 9“. Ungleichung „y < x + 1“. Senkrechte Gerade „x = 3“. ' +
  'Bereich hinten anhängen: „f(x) = x^2 {0 < x < 2}“. Parameterkurve „(cos(t), sin(t))“. Polar „r = 1 + cos(θ)“. ' +
  'Rechne Bedingungen sorgfältig nach (z. B. Scheitelpunktform f(x) = a(x - d)^2 + e). Jede Zeile genau ein Ausdruck, ohne Erklärtext darin. ' +
  '„erklaerung“: ein kurzer deutscher Satz, was die Zeile ist.';

const STECKBRIEF_WORTE = /parabel|scheitel|hochpunkt|tiefpunkt|wendepunkt|sattelpunkt|terrassenpunkt|ganzrational|grades|polynom|extrem|berührt|doppelte nullstelle/i;

/** Wünsche in Worten → geprüfte Zeilen. Beschreibungen wie „Parabel mit Scheitel (2|1) durch den Ursprung“ übersetzt die
 *  KI nur in Bedingungen – rechnen tut Vertex exakt (kleine Modelle verrechnen sich sonst). Jeder Vorschlag wird an den
 *  Punkten aus dem Wunsch nachgeprüft. vorher: bestehende Zeilen (Texte), damit Namen und Bezug passen. */
async function kiAusdruecke(wunsch, vorher, lehrer, status) {
  if (STECKBRIEF_WORTE.test(wunsch) && !/\b(kreis|ellipse|sinus|cosinus|kosinus|exponential|e-funktion|wurzel|logarithm)/i.test(wunsch)) {
    try {
      const a = await lyra.ki({ lehrer, system: STECKBRIEF_SYSTEM, prompt: wunsch, schema: STECKBRIEF_SCHEMA }, status ? (s) => { if (s && s.art === 'hinweis') status(s.text); } : undefined);
      const j = a && a.json;
      if (j && Array.isArray(j.bedingungen) && j.bedingungen.length) {
        const bedingungen = bedingungenAusKi(j);
        const grad = Number.isInteger(j.grad) && j.grad >= 1 && j.grad <= 6 ? j.grad : (/parabel|quadratisch/i.test(wunsch) ? 2 : 3);
        const r = Mathe.steckbrief({ grad, symmetrie: ['achse', 'punkt'].includes(j.symmetrie) ? j.symmetrie : null, bedingungen });
        if (r.ok) {
          const name = freierNameAus(vorher);
          const was = bedingungen.map(bedingungKurz).join(', ');
          const v = vorschlaegePruefen([{ ausdruck: `${name}(x) = ${r.text}`, erklaerung: `Exakt berechnet aus: ${was}` }], vorher, wunsch);
          if (v[0] && v[0].ok) return { vorschlaege: v, lehrer: (a && a.lehrer) || lehrer, steckbrief: true };
        }
      }
    } catch (e) {
      if (/ABGEBROCHEN/.test(String(e && e.message))) throw e;
    }
  }
  const kontext = vorher.length ? `\n\nSchon im Blatt:\n${vorher.map((t) => '- ' + t).join('\n')}\nNeue Funktionen bekommen andere Namen.` : '';
  let fehlerHinweis = '';
  let wer = lehrer;
  for (let versuch = 0; versuch < 2; versuch++) {
    const a = await lyra.ki({ lehrer, system: AUSDRUCK_SYSTEM, prompt: `Wunsch: ${wunsch}${kontext}${fehlerHinweis}`, schema: AUSDRUCK_SCHEMA }, status ? (s) => { if (s && s.art === 'hinweis') status(s.text); } : undefined);
    wer = (a && a.lehrer) || lehrer;
    const liste = ((a && a.json && a.json.eintraege) || []).filter((x) => x && typeof x.ausdruck === 'string').slice(0, 8);
    const geprueft = vorschlaegePruefen(liste, vorher, wunsch);
    if (geprueft.some((v) => v.ok)) return { vorschlaege: geprueft, lehrer: wer };
    fehlerHinweis = `\n\nDein letzter Vorschlag ließ sich nicht lesen: ${geprueft.map((v) => `„${v.ausdruck}“ (${v.fehler})`).join('; ')}. Halte dich genau an die Schreibweise.`;
  }
  return { vorschlaege: [], lehrer: wer };
}
function freierNameAus(vorher) {
  const belegt = new Set(vorher.map((t) => (/^\s*([A-Za-z](?:_\w+)?)\s*\(/.exec(t) || [])[1]).filter(Boolean));
  return NAMEN.find((n) => !belegt.has(n)) || 'f_' + (belegt.size + 1);
}
function bedingungKurz(c) {
  const p = (x, y) => `(${x}|${y})`;
  switch (c.art) {
    case 'punkt': return `durch ${p(c.x, c.y)}`;
    case 'extremum': return c.y ? `Extrempunkt ${p(c.x, c.y)}` : `Extremstelle x = ${c.x}`;
    case 'wendepunkt': return c.y ? `Wendepunkt ${p(c.x, c.y)}` : `Wendestelle x = ${c.x}`;
    case 'sattel': return c.y ? `Sattelpunkt ${p(c.x, c.y)}` : `Sattelstelle x = ${c.x}`;
    case 'steigung': return `Steigung ${c.m} bei x = ${c.x}`;
    case 'tangente': return `Tangente y = ${c.m}x + ${c.b} bei x = ${c.x}`;
    case 'integral': return `Integral von ${c.von} bis ${c.bis} = ${c.wert}`;
    default: return `Ableitung ${c.abl} bei x = ${c.x} ist ${c.wert}`;
  }
}
/** Punkte, die im Wunsch stehen: (2|1), (−3; 0), „Ursprung“ */
function punkteImText(t) {
  const p = [];
  const re = /\(\s*([−-]?\d+(?:[.,]\d+)?)\s*[|;]\s*([−-]?\d+(?:[.,]\d+)?)\s*\)/g;
  let m;
  const zahl = (s) => Number(s.replace('−', '-').replace(',', '.'));
  while ((m = re.exec(String(t || '')))) p.push([zahl(m[1]), zahl(m[2])]);
  if (/ursprung/i.test(t || '')) p.push([0, 0]);
  return p.filter((q, i) => p.findIndex((r) => r[0] === q[0] && r[1] === q[1]) === i);
}

function vorschlaegePruefen(liste, vorher, wunsch = '') {
  const punkte = punkteImText(wunsch);
  const belegt = new Set(vorher.map((t) => (/^\s*([A-Za-z](?:_\w+)?)\s*\(/.exec(t) || [])[1]).filter(Boolean));
  const aus = [];
  const basis = vorher.map((t, i) => ({ id: 'v' + i, text: t }));
  for (const v of liste) {
    let t = String(v.ausdruck).replace(/\$/g, '').replace(/\\cdot/g, '*').replace(/\\left|\\right/g, '').replace(/^\s*(?:y\s*=\s*)?(?=[A-Za-z]\(x\)\s*=)/, '').trim();
    const m = /^\s*([A-Za-z](?:_\w+)?)\s*\(\s*([A-Za-zθ]+)\s*\)\s*=/.exec(t);
    if (m && belegt.has(m[1])) {
      const neu = NAMEN.find((n) => !belegt.has(n)) || 'f_' + (belegt.size + 1);
      t = t.replace(m[1], neu);
    }
    if (m) belegt.add((/^\s*([A-Za-z](?:_\w+)?)/.exec(t) || [])[1]);
    const testblatt = [...basis, ...aus.filter((a) => a.ok).map((a, i) => ({ id: 'n' + i, text: a.ausdruck })), { id: 'x', text: t }];
    let d;
    try { d = Mathe.blattDeuten(testblatt).deutungen.get('x'); } catch (err) { d = { art: 'fehler', fehler: err.message }; }
    const ok = d && !['fehler', 'leer', 'wert', 'aussage'].includes(d.art);
    // Probe an den Punkten aus dem Wunsch (nur bei Funktionen – ein Kreismittelpunkt liegt ja nicht auf dem Kreis)
    const probe = ok && d.art === 'funktion' ? punkte.map(([x, y]) => { const w = d.f(x); return { x, y, wert: w, ok: Number.isFinite(w) && Math.abs(w - y) < 1e-9 * Math.max(1, Math.abs(y)) }; }) : [];
    aus.push({ ausdruck: t, erklaerung: String(v.erklaerung || '').slice(0, 200), ok, fehler: ok ? '' : (d && d.fehler) || 'nicht zeichenbar', d, an: ok && !probe.some((q) => !q.ok), probe });
  }
  return aus;
}

const bs = { text: '', laeuft: false, vorschlaege: [], fehler: '', lehrer: null };
function beschreibenOeffnen() {
  grosserDialog('Beschreiben – die KI schlägt Funktionen vor', (neu, zu) => {
    const t = h('textarea', { class: 'eingabe', rows: 3, 'data-feld': 'bstext', placeholder: 'z. B. „Parabel mit Scheitel (2|1), die durch den Ursprung geht“ oder „Kreis um (1|1) mit Radius 3 und die Gerade durch beide Punkte …“' });
    t.value = bs.text;
    t.addEventListener('input', () => { bs.text = t.value; knopf.disabled = !bs.text.trim() || bs.laeuft; });
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); los(); } });
    const los = async () => {
      if (!bs.text.trim() || bs.laeuft) return;
      bs.laeuft = true; bs.fehler = ''; bs.vorschlaege = [];
      neu();
      try {
        const vorher = z.blatt.eintraege.filter((e) => e.text && !e.art).map((e) => e.text);
        const r = await kiAusdruecke(bs.text, vorher, z.lehrer);
        bs.vorschlaege = r.vorschlaege;
        bs.lehrer = r.lehrer;
        bs.steckbrief = !!r.steckbrief;
        if (!r.vorschlaege.length) bs.fehler = 'Daraus konnte die KI keine lesbaren Zeilen machen. Formuliere es anders oder tipp die Funktion selbst ein.';
      } catch (e) {
        const m = String((e && e.message) || e);
        bs.fehler = /ABGEBROCHEN/.test(m) ? '' : m;
      }
      bs.laeuft = false;
      neu();
    };
    const knopf = h('button', { class: 'knopf', disabled: !bs.text.trim() || bs.laeuft, onclick: los }, symbol('ki'), 'Vorschläge holen');
    const gewaehlt = bs.vorschlaege.filter((v) => v.ok && v.an);
    return [
      t,
      h('div', { class: 'vx-formzeile', style: { marginTop: '10px' } }, lyra.lehrerWahl(z.info, z.lehrer, (w) => { z.lehrer = w; neu(); }), h('div', { class: 'wachsen' }),
        bs.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), 'denkt nach …', h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : knopf),
      bs.fehler ? h('div', { class: 'kasten falsch', style: { marginTop: '10px' } }, bs.fehler) : null,
      bs.vorschlaege.length ? h('div', { class: 'vx-vorschlaege' },
        h('div', { class: 'vx-karte-titel' }, bs.steckbrief ? `${lehrerName(bs.lehrer)} hat die Bedingungen erkannt, Vertex exakt gerechnet` : `Vorschläge von ${lehrerName(bs.lehrer)}`),
        bs.vorschlaege.map((v) => h('label', { class: 'vx-vorschlag' + (v.ok ? '' : ' kaputt') },
          h('input', { type: 'checkbox', checked: v.ok && v.an, disabled: !v.ok, onchange: (ev) => { v.an = ev.target.checked; neu(); } }),
          h('div', { class: 'wachsen' },
            v.ok ? h('div', { html: formel(zeilenTex(v.d, { text: v.ausdruck })) }) : h('code', {}, v.ausdruck),
            h('div', { class: 'leise klein' }, v.ok ? v.erklaerung : 'lässt sich nicht zeichnen: ' + v.fehler),
            (v.probe || []).length ? h('div', { class: 'vx-probe' }, v.probe.map((q) => h('span', { class: 'vx-probe-punkt' + (q.ok ? ' ok' : ' falsch') },
              q.ok ? `✓ geht durch (${Mathe.zahlKurz(q.x)}|${Mathe.zahlKurz(q.y)})` : `✗ bei x = ${Mathe.zahlKurz(q.x)} ist y = ${Number.isFinite(q.wert) ? Mathe.zahlKurz(q.wert) : '–'}, nicht ${Mathe.zahlKurz(q.y)}`))) : null))),
        h('div', { class: 'kasten warn', style: { marginTop: '8px' } }, 'Die KI kann sich verrechnen. Prüf am Graphen, ob es passt – du kannst jede Zeile danach noch ändern.'),
        h('div', { class: 'vx-formzeile', style: { marginTop: '10px' } }, h('div', { class: 'wachsen' }),
          h('button', { class: 'knopf', disabled: !gewaehlt.length, onclick: () => { zeilenAnhaengen(gewaehlt.map((v) => v.ausdruck)); zu(); allesZeigen(); zeichnen(); bs.vorschlaege = []; lyra.toast(`${gewaehlt.length} Zeile${gewaehlt.length === 1 ? '' : 'n'} übernommen`, 'ok'); } },
            `${gewaehlt.length} übernehmen`))) : null,
    ];
  });
}

// ================================================================== Export

const dateiName = () => (z.blatt.name || 'Vertex').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Vertex';

/** Szene als PNG (base64 ohne Präfix), immer hell. */
function bildRendern(W, H, faktor = 2, ansicht = null) {
  const c = document.createElement('canvas');
  c.width = W * faktor;
  c.height = H * faktor;
  const ctx = c.getContext('2d');
  ctx.setTransform(faktor, 0, 0, faktor, 0, 0);
  const th = Grafik.thema(true);
  ctx.fillStyle = th.grund;
  ctx.fillRect(0, 0, W, H);
  Grafik.zeichnen(Grafik.canvasStift(ctx), szeneBauen(W, H, true, th, { fuerExport: true, ansicht }));
  return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
function svgRendern(W, H, ansicht = null) {
  const th = Grafik.thema(true);
  const s = Grafik.svgStift(W, H);
  Grafik.zeichnen(s, szeneBauen(W, H, true, th, { fuerExport: true, ansicht }));
  return s.ende(th.grund);
}

function exportMenue(anker) {
  pop(anker, [
    h('div', { class: 'vx-pop-titel' }, 'Exportieren'),
    popKnopf('Bild (PNG)', async () => { const ok = await lyra.speichern(dateiName() + '.png', bildRendern(z.W, z.H, 2), true); if (ok) lyra.toast('Bild gesichert', 'ok'); }),
    popKnopf('Vektorgrafik (SVG)', async () => { const ok = await lyra.speichern(dateiName() + '.svg', svgRendern(z.W, z.H)); if (ok) lyra.toast('SVG gesichert', 'ok'); }),
    popKnopf('LaTeX (pgfplots) …', pgfDialog),
    h('div', { class: 'vx-pop-trenner' }),
    popKnopf('Zeilen als Text kopieren', () => lyra.kopieren(z.blatt.eintraege.filter((e) => e.text).map((e) => e.text).join('\n'), 'Zeilen kopiert')),
  ], { rechts: true });
}

/** Baum → pgfplots (Winkel in Grad: sin(deg(x))). */
function pgf(n) {
  const k = (x, min) => (rang(x) < min ? '(' + pgf(x) + ')' : pgf(x));
  function rang(x) { return { '+': 1, '-': 1, neg: 2, '*': 3, '/': 3, '^': 5 }[x.t] || (x.t === 'zahl' && Mathe.qf(x.q) < 0 ? 2 : 9); }
  switch (n.t) {
    case 'zahl': return String(Number(Mathe.qf(n.q).toPrecision(10)));
    case 'konst': return n.n === 'pi' ? 'pi' : 'e';
    case 'var': return n.n === 'theta' ? 't' : n.n;
    case 'neg': return '-' + k(n.a, 3);
    case '+': return pgf(n.a) + '+' + k(n.b, 2);
    case '-': return pgf(n.a) + '-' + k(n.b, 2);
    case '*': return k(n.a, 3) + '*' + k(n.b, 4);
    case '/': return k(n.a, 3) + '/' + k(n.b, 4);
    case '^':
      if (n.a.t === 'konst' && n.a.n === 'e') return `exp(${pgf(n.b)})`;
      return k(n.a, 9) + '^(' + pgf(n.b) + ')';
    case 'fn': {
      const a = n.a.map(pgf);
      if (['sin', 'cos', 'tan'].includes(n.n)) return `${n.n}(deg(${a[0]}))`;
      if (n.n === 'cot') return `cot(deg(${a[0]}))`;
      if (['arcsin', 'arccos', 'arctan'].includes(n.n)) return `rad(${({ arcsin: 'asin', arccos: 'acos', arctan: 'atan' })[n.n]}(${a[0]}))`;
      if (n.n === 'log') return `log10(${a[0]})`;
      if (n.n === 'logb') return `ln(${a[0]})/ln(${a[1]})`;
      if (n.n === 'cbrt') return `sign(${a[0]})*abs(${a[0]})^(1/3)`;
      if (n.n === 'nroot') return `(${a[0]})^(1/(${a[1]}))`;
      if (n.n === 'sgn') return `sign(${a[0]})`;
      return `${n.n}(${a.join(',')})`;
    }
    default: return '0';
  }
}
function pgfCode() {
  const A = z.A || Grafik.abbildung(z.blatt.ansicht, z.W || 800, z.H || 600);
  const r = (v) => Number(v.toPrecision(4));
  const farben = [], zeilen = [];
  z.blatt.eintraege.forEach((e, i) => {
    if (e.sichtbar === false) return;
    const d = deutungVon(e.id);
    if (!d || ['leer', 'fehler', 'parameter', 'wert', 'aussage'].includes(d.art)) return;
    const name = `vx${i + 1}`;
    farben.push(`\\definecolor{${name}}{HTML}{${e.farbe.replace('#', '')}}`);
    const st = `${name}, thick${e.strich === 'gestrichelt' ? ', dashed' : e.strich === 'gepunktet' ? ', dotted' : ''}`;
    if (d.art === 'tabelle') {
      const p = ((e.tabelle && e.tabelle.punkte) || []).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
      if (p.length) zeilen.push(`\\addplot[${name}, only marks, mark=*, mark size=1.8pt] coordinates {${p.map((q) => `(${r(q[0])},${r(q[1])})`).join(' ')}};`);
      const reg = z.regression.get(e.id);
      if (reg && reg.ok) zeilen.push(`\\addplot[${st}, domain=${r(A.xmin)}:${r(A.xmax)}, samples=200] {${pgf(reg.ast)}}; % Ausgleichsfunktion`);
      return;
    }
    const ast = d.ast ? Mathe.werteEinsetzen(d.ast, z.deutung.werte) : null;
    if (d.art === 'funktion') {
      const lo = d.bereich ? Math.max(A.xmin, d.bereich.min) : A.xmin, hi = d.bereich ? Math.min(A.xmax, d.bereich.max) : A.xmax;
      zeilen.push(`\\addplot[${st}, domain=${r(lo)}:${r(hi)}, samples=300] {${pgf(ast)}};${d.name ? ` % ${d.name}(x)` : ''}`);
    } else if (d.art === 'punkt') {
      zeilen.push(`\\addplot[${name}, only marks, mark=*] coordinates {(${r(d.x)},${r(d.y)})}${d.name ? ` node[above right] {$${d.name}$}` : ''};`);
    } else if (d.art === 'senkrecht' && !Mathe.enthaelt(ast, 'y')) {
      const x = d.f(0);
      zeilen.push(`\\draw[${st}] (axis cs:${r(x)},${r(A.ymin)}) -- (axis cs:${r(x)},${r(A.ymax)});`);
    } else if (d.art === 'kurve') {
      const t = tBereich(e, d);
      zeilen.push(`\\addplot[${st}, domain=${r(t.von)}:${r(t.bis)}, samples=400, variable=\\t] ({${pgf(Mathe.ersetzen(Mathe.werteEinsetzen(d.x, z.deutung.werte), 't', Mathe.V('\\t')))}}, {${pgf(Mathe.ersetzen(Mathe.werteEinsetzen(d.y, z.deutung.werte), 't', Mathe.V('\\t')))}});`);
    } else if (d.art === 'polar') {
      const t = tBereich(e, d);
      zeilen.push(`\\addplot[${st}, domain=${r(t.von)}:${r(t.bis)}, samples=400, variable=\\t] ({(${pgf(Mathe.ersetzen(ast, 'theta', Mathe.V('\\t')))})*cos(deg(\\t))}, {(${pgf(Mathe.ersetzen(ast, 'theta', Mathe.V('\\t')))})*sin(deg(\\t))});`);
    } else {
      zeilen.push(`% Zeile ${i + 1} („${e.text}“) kann pgfplots nicht direkt zeichnen`);
    }
  });
  return [
    '% Erstellt mit Vertex · braucht \\usepackage{pgfplots} und \\pgfplotsset{compat=1.18}',
    ...farben,
    '\\begin{tikzpicture}',
    `\\begin{axis}[axis lines=middle, grid=major, grid style={gray!25}, xlabel=$x$, ylabel=$y$, xmin=${r(A.xmin)}, xmax=${r(A.xmax)}, ymin=${r(A.ymin)}, ymax=${r(A.ymax)}, width=12cm, height=${r(12 * (z.H || 600) / (z.W || 800))}cm, unbounded coords=jump]`,
    ...zeilen,
    '\\end{axis}',
    '\\end{tikzpicture}',
  ].join('\n');
}
async function pgfDialog() {
  const code = pgfCode();
  const pre = h('pre', { class: 'vx-code' }, code);
  const w = await lyra.dialog('LaTeX (pgfplots)', h('div', {}, h('p', { class: 'leise klein', style: { marginBottom: '8px' } }, 'Winkelfunktionen rechnet pgfplots in Grad – Vertex setzt deshalb deg(x) ein.'), pre),
    [{ text: 'Schließen', art: 'text', wert: null }, { text: 'Als .tex sichern', art: 'tonal', wert: 'sichern' }, { text: 'Kopieren', wert: 'kopieren' }]);
  if (w === 'kopieren') lyra.kopieren(code, 'pgfplots-Code kopiert');
  if (w === 'sichern' && (await lyra.speichern(dateiName() + '.tex', code))) lyra.toast('Gesichert', 'ok');
}

// ================================================================== Lyras Eingabezeile (Route „chat“) und Fusion

/** Text direkt als Zeilen lesen („zeichne f(x) = x² und g(x) = 2x“) – oder null, wenn das nicht geht. */
function direktLesen(text, vorher = []) {
  const sauber = String(text || '').replace(/\$/g, '').replace(/^\s*(bitte\s+)?(zeichne|plotte|skizziere|zeig(e)?( mir)?|graph(en)? (von|zu)|der graph von|stelle?)\s*(den graphen\s*(von)?)?\s*:?\s*/i, '').replace(/[.!?]\s*$/, '').trim();
  if (!sauber) return null;
  const versuche = [[sauber], sauber.split(/\n+/), sauber.split(/\s+(?:und|sowie|&)\s+|;\s+(?![^()]*\))/)];
  for (const teile of versuche) {
    const t = teile.map((s) => s.trim()).filter(Boolean);
    if (!t.length) continue;
    const probe = [...vorher.map((v, i) => ({ id: 'v' + i, text: v })), ...t.map((s, i) => ({ id: 'n' + i, text: s }))];
    let ds;
    try { ds = Mathe.blattDeuten(probe).deutungen; } catch (_) { continue; }
    const neu = t.map((_, i) => ds.get('n' + i));
    if (neu.every((d) => d && !['fehler', 'leer'].includes(d.art)) && neu.some((d) => !['wert', 'aussage', 'parameter'].includes(d.art))) return t;
  }
  return null;
}

/** Zeilen zeichnen und untersuchen (unsichtbar) → {titel, md, png, svg, id, texte, analysen} */
async function zeichnenUndUntersuchen(texte, titelVorschlag) {
  const blatt = neuesBlatt(titelVorschlag || 'Graph', []);
  const vorherBlatt = z.blatt;
  z.blatt = blatt;
  texte.forEach((t) => blatt.eintraege.push(neueZeile(t)));
  deuten();
  const W = 900, H = 600;
  blatt.ansicht = passendeAnsicht(W, H, true).ansicht;
  // besondere Punkte aller Funktionen als Markierung
  const analysen = [];
  const teile = [];
  const marker = [];
  for (const e of blatt.eintraege) {
    const d = deutungVon(e.id);
    if (!d || d.art !== 'funktion' || analysen.length >= 4) continue;
    try {
      const ast = Mathe.werteEinsetzen(d.ast, z.deutung.werte);
      const A = Grafik.abbildung(blatt.ansicht, W, H);
      const u = Mathe.untersuchen(ast, { von: A.xmin, bis: A.xmax });
      const name = d.name || (analysen.length ? 'f_' + (analysen.length + 1) : 'f');
      analysen.push({ text: e.text, name, nullstellen: u.nullstellen.map((p) => p.x), extrema: u.extrema.map((p) => ({ x: p.x, y: p.y, art: p.art })), wendepunkte: u.wendepunkte.map((p) => ({ x: p.x, y: p.y })) });
      teile.push(`### ${d.name ? '' : 'Graph: '}$${zeilenTex(d, e)}$\n\n${Mathe.diskussionMarkdown(u, name)}`);
      for (const p of u.nullstellen) marker.push({ x: p.x, y: 0, farbe: e.farbe, leer: true });
      for (const p of u.extrema) marker.push({ x: p.x, y: p.y, farbe: e.farbe });
      for (const p of u.wendepunkte) marker.push({ x: p.x, y: p.y, farbe: e.farbe, leer: true });
    } catch (_) {}
  }
  const alt = window.ueberlagerung;
  window.ueberlagerung = () => ({ marker });
  let png, svg;
  try {
    png = bildRendern(W, H, 2);
    svg = svgRendern(W, H);
  } finally {
    window.ueberlagerung = alt;
  }
  blatt.ausChat = true;
  try { await lyra.speicher.schreiben('blaetter/' + blatt.id, blatt); } catch (_) {}
  const funktionen = blatt.eintraege.filter((e) => (deutungVon(e.id) || {}).art === 'funktion');
  const titel = titelVorschlag || (funktionen.length === 1 ? 'Graph von ' + funktionen[0].text
    : funktionen.length > 1 ? 'Graphen von ' + funktionen.map((e) => (deutungVon(e.id).name ? deutungVon(e.id).name : e.text)).join(', ') : 'Graph');
  blatt.name = titel.slice(0, 80);
  try { await lyra.speicher.schreiben('blaetter/' + blatt.id, blatt); } catch (_) {}
  z.blatt = vorherBlatt;
  if (vorherBlatt) deuten();
  const md = teile.length ? teile.join('\n\n') : texte.map((t) => `- \`${t}\``).join('\n');
  return { titel: blatt.name, md, png, svg, id: blatt.id, texte, analysen };
}

async function chatAuftrag() {
  let a = null;
  try { a = await lyra.auftrag(); } catch (_) {}
  if (!a || !String(a.text || '').trim()) return;
  const status = (t) => lyra.status(t).catch(() => {});
  try {
    const vorher = a.vorher && Array.isArray(a.vorher.eintraege) ? a.vorher.eintraege : [];
    let neu = direktLesen(a.text, vorher);
    let wer = null, probeFehlt = false;
    if (!neu) {
      const lehrer = a.lehrer || z.lehrer;
      status(`${lehrerName(lehrer)} übersetzt deine Beschreibung in Funktionen …`);
      const r = await kiAusdruecke(a.text, vorher, lehrer, status);
      const gut = r.vorschlaege.filter((v) => v.ok && !(v.probe || []).some((q) => !q.ok));
      neu = (gut.length ? gut : r.vorschlaege.filter((v) => v.ok)).map((v) => v.ausdruck);
      probeFehlt = !gut.length && r.vorschlaege.some((v) => v.ok);
      wer = r.lehrer;
      if (!neu.length) throw new Error('Daraus konnte ich keine Funktion machen. Schreib sie z. B. so: f(x) = x² − 4');
    }
    status('Vertex zeichnet und rechnet …');
    const texte = [...vorher, ...neu];
    const r = await zeichnenUndUntersuchen(texte, null);
    await lyra.ergebnis({
      titel: r.titel,
      text: r.md + (probeFehlt ? `\n\n**Achtung:** Der Graph geht nicht durch alle Punkte aus deiner Beschreibung – die KI hat sich wohl verrechnet.` : '') +
        (wer ? `\n\n*Die Zeilen hat ${lehrerName(wer)} aus deiner Beschreibung gemacht – prüf am Graphen, ob es passt. Alle Werte hat Vertex exakt berechnet.*` : ''),
      png: r.png,
      svg: r.svg,
      id: r.id,
      daten: { eintraege: texte, analysen: r.analysen },
      fuss: wer ? `Vertex · übersetzt von ${lehrerName(wer)}` : 'Vertex · exakt berechnet, ohne KI',
    });
  } catch (e) {
    const m = String((e && e.message) || e);
    await lyra.ergebnis({ fehler: /ABGEBROCHEN/.test(m) ? 'Abgebrochen.' : m }).catch(() => {});
  }
}

/** Funktionen aus Material herausziehen: „f(x) = …“-Zeilen, sonst KI. */
async function fusionZeilen(a, status) {
  const anweisung = String(a.anweisung || a.aufgabe || '').trim();
  const direkt = direktLesen(anweisung);
  if (direkt) return { texte: direkt, wer: null };
  const material = lyra.fusion.material(a, 12000);
  const kandidaten = [];
  const re = /([A-Za-z](?:_\w+)?)\s*\(\s*x\s*\)\s*=\s*([^\n$;]+?)(?=$|\n|\$|;|,\s|\.\s)/g;
  for (const quelle of [anweisung, material]) {
    let m;
    while ((m = re.exec(quelle)) && kandidaten.length < 6) {
      const t = `${m[1]}(x) = ${m[2].trim()}`;
      if (!kandidaten.some((k) => k.startsWith(m[1] + '(')) && direktLesen(t)) kandidaten.push(t);
    }
  }
  if (kandidaten.length) return { texte: kandidaten, wer: null };
  const lehrer = a.lehrer || z.lehrer;
  status(`${lehrerName(lehrer)} sucht die Funktionen heraus …`);
  const wunsch = `${anweisung || lyra.fusion.thema(a)}${material ? `\n\nMaterial (Auszug):\n${material.slice(0, 5000)}` : ''}`;
  const r = await kiAusdruecke(wunsch, [], lehrer, status);
  const texte = r.vorschlaege.filter((v) => v.ok).map((v) => v.ausdruck);
  if (!texte.length) throw new Error('In der Aufgabe habe ich keine Funktion gefunden, die sich zeichnen lässt.');
  return { texte, wer: r.lehrer };
}

function fusionAnbieten() {
  lyra.fusion.anbieten({
    graph: async (a, { status }) => {
      const { texte, wer } = await fusionZeilen(a, status);
      status('Vertex zeichnet …');
      const r = await zeichnenUndUntersuchen(texte, null);
      return {
        art: 'schaubild',
        titel: r.titel,
        markdown: `**${r.titel}**\n\n${r.md}${wer ? `\n\n*Funktionen herausgesucht von ${lehrerName(wer)}, Werte exakt von Vertex.*` : ''}`,
        bild: 'data:image/png;base64,' + r.png,
        daten: { eintraege: texte, analysen: r.analysen, svg: r.svg },
        oeffnen: 'bild/' + r.id,
      };
    },
    kurvendiskussion: async (a, { status }) => {
      const { texte, wer } = await fusionZeilen(a, status);
      status('Vertex untersucht die Funktionen …');
      const r = await zeichnenUndUntersuchen(texte, null);
      return {
        art: 'dokument',
        titel: 'Kurvendiskussion: ' + r.titel.replace(/^Graph von /, ''),
        markdown: `## Kurvendiskussion\n\n${r.md}${wer ? `\n\n*Funktionen herausgesucht von ${lehrerName(wer)}, Werte exakt von Vertex.*` : '\n\n*Alle Werte exakt berechnet von Vertex.*'}`,
        bild: 'data:image/png;base64,' + r.png,
        daten: { eintraege: texte, analysen: r.analysen },
        oeffnen: 'bild/' + r.id,
      };
    },
  });
}

start().catch((e) => console.error(e)).then(fusionAnbieten);
