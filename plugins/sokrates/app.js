'use strict';
/*
 * Sokrates – Nachhilfe, die dich selbst draufkommen lässt. Du gibst deine Aufgabe ein; Sokrates verrät nicht die
 * Lösung, sondern führt dich mit Fragen Schritt für Schritt hin. Tipps in zwei Stärken, die Lösung nur, wenn du sie
 * ausdrücklich willst. Danach gibt es auf Wunsch eine ähnliche Übungsaufgabe. Für alle Fächer, Klasse 5 bis 13.
 */
const { h } = lyra;

const FAECHER = {
  mathe: ['Mathe', '📐'], deutsch: ['Deutsch', '📖'], englisch: ['Englisch', '🇬🇧'], franzoesisch: ['Französisch', '🇫🇷'],
  spanisch: ['Spanisch', '🇪🇸'], latein: ['Latein', '🏛️'], physik: ['Physik', '⚛️'], chemie: ['Chemie', '🧪'],
  biologie: ['Biologie', '🌿'], geschichte: ['Geschichte', '📜'], politik: ['Politik', '🗳️'], erdkunde: ['Erdkunde', '🌍'],
  informatik: ['Informatik', '💻'], wirtschaft: ['Wirtschaft', '📈'], anderes: ['Anderes', '✨'],
};
const STANDARD = { ki: 'auto', klasse: 9, fach: 'mathe' };

const SCHEMA = {
  type: 'object',
  properties: { antwort: { type: 'string' }, fortschritt: { type: 'integer' }, geloest: { type: 'boolean' } },
  required: ['antwort', 'fortschritt', 'geloest'],
};

function system(s) {
  return `Du bist „Sokrates“ in Lyra, ein geduldiger, warmherziger Nachhilfelehrer. Dein Schüler ist in Klasse ${s.klasse}, \
Fach ${FAECHER[s.fach][0]}. Du arbeitest sokratisch: Du verrätst NIE die Lösung, das Endergebnis oder den entscheidenden \
Rechenschritt, solange der Schüler nicht ausdrücklich „Lösung zeigen“ gewählt hat – auch nicht, wenn er darum bittet; \
dann erklärst du freundlich, dass er die Lösung über den Knopf „Lösung zeigen“ bekommt. Stattdessen: eine kurze \
Rückmeldung zum letzten Beitrag (was stimmt; wo ein Denkfehler steckt – ohne ihn selbst zu korrigieren), dann GENAU \
EINE Leitfrage, die den nächsten kleinen Schritt anstößt. Altersgerecht, freundlich, ermutigend, kurz (höchstens 4 \
Sätze). Formeln in LaTeX zwischen $…$. "fortschritt": 0–100, wie weit der Schüler schon ist. "geloest": true nur, wenn \
der Schüler die Aufgabe vollständig und richtig SELBST gelöst hat – dann lobst du konkret und fasst den Lösungsweg in \
2–3 Sätzen zusammen.`;
}

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  sitzungen: [],
  s: null,
  aufgabe: '',
  eingabe: '',
  laeuft: false,
  status: '',
  fehler: null,
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { z.einst = { ...STANDARD, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.sitzungen = (await lyra.speicher.liste('sitzungen')).map((e) => e.wert).filter((s) => s && s.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.s) { z.s = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('sitzung/')) z.s = z.sitzungen.find((s) => s.id === route.slice(8)) || null;
  zeichnen();
  nachaussen();
  if (route === 'einstellungen') einstellungen();
}

async function sichern(s = z.s) {
  if (!s) return;
  s.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('sitzungen/' + s.id, s); } catch (_) {}
  z.sitzungen = [s, ...z.sitzungen.filter((x) => x.id !== s.id)].slice(0, 80);
  nachaussen();
}

function nachaussen() {
  const offen = z.sitzungen.find((s) => !s.geloest && !s.loesungGezeigt && s.verlauf.length > 1);
  const geschafft = z.sitzungen.filter((s) => s.geloest).length;
  const e = [];
  if (offen) e.push({ id: 'weiter', titel: `Weiter mit Sokrates: ${kurz(offen.aufgabe, 46)}`, untertitel: `${FAECHER[offen.fach][1]} ${FAECHER[offen.fach][0]} · ${offen.fortschritt || 0} % geschafft`, route: 'sitzung/' + offen.id, fortschritt: (offen.fortschritt || 0) / 100, geaendert: offen.zeit });
  else if (geschafft) e.push({ id: 'stand', titel: `${geschafft} Aufgabe${geschafft > 1 ? 'n' : ''} selbst gelöst 🎉`, untertitel: 'Mit Sokrates – ohne vorgesagte Lösung', route: '', geaendert: Date.now() / 1000 - 300 });
  lyra.startseite(e).catch(() => {});
}

const kurz = (t, n) => (t.length > n ? t.slice(0, n - 1).trim() + '…' : t);

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

// ================================================================== Gespräch

function verlaufText(s) {
  const l = s.verlauf.slice(-18);
  return l.map((m) => `${m.rolle === 'ich' ? 'Schüler' : 'Sokrates'}: ${m.text}`).join('\n\n');
}

async function zug(auftrag, eigenerText) {
  const s = z.s;
  if (!s || z.laeuft) return;
  if (eigenerText) s.verlauf.push({ rolle: 'ich', text: eigenerText });
  z.laeuft = true;
  z.fehler = null;
  status('Sokrates denkt nach …');
  zeichnen();
  scrollen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: system(s),
      prompt: `Aufgabe des Schülers:\n${s.aufgabe}\n\nBisheriges Gespräch:\n${verlaufText(s) || '(noch nichts)'}\n\n${auftrag}\n\n\
Antwort als JSON: {"antwort": "…", "fortschritt": 0, "geloest": false}`,
      schema: SCHEMA,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    const antwort = text(j.antwort) || text(r && r.text);
    if (!antwort) throw new Error('Sokrates hat gerade keine Antwort – versuch es noch einmal.');
    s.verlauf.push({ rolle: 'sokrates', text: antwort });
    s.fortschritt = Math.max(s.fortschritt || 0, Math.min(100, Math.round(+j.fortschritt || 0)));
    if (j.geloest === true && !s.loesungGezeigt) { s.geloest = true; s.fortschritt = 100; }
    await sichern();
  } catch (x) {
    const m = String((x && x.message) || x);
    if (eigenerText && s.verlauf[s.verlauf.length - 1] && s.verlauf[s.verlauf.length - 1].text === eigenerText) { s.verlauf.pop(); z.eingabe = eigenerText; }
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
  scrollen();
}

function scrollen() {
  setTimeout(() => { const v = document.querySelector('.verlauf'); if (v) v.scrollTop = v.scrollHeight; });
}

async function beginnen(aufgabe) {
  const a = text(aufgabe || z.aufgabe);
  if (!a || z.laeuft) return;
  z.s = { id: lyra.neueId(), fach: z.einst.fach, klasse: z.einst.klasse, aufgabe: a, verlauf: [], fortschritt: 0, tipps: 0, geloest: false, loesungGezeigt: false, zeit: lyra.jetzt() };
  z.aufgabe = '';
  await zug('Beginne das Gespräch: Begrüß den Schüler kurz und frag ihn, was er schon weiß oder wie er anfangen würde – eine einzige, einladende Frage. Verrate nichts.');
}

function senden() {
  const t = text(z.eingabe);
  if (!t || z.laeuft) return;
  z.eingabe = '';
  zug('Reagiere auf den letzten Beitrag des Schülers.', t);
}

function tipp(stark) {
  const s = z.s;
  s.tipps = (s.tipps || 0) + 1;
  zug(stark
    ? 'Der Schüler kommt nicht weiter. Gib einen deutlicheren Tipp: Zeig den nächsten Schritt teilweise vor oder an einem einfacheren Beispiel – aber NICHT das Ergebnis der Aufgabe. Dann eine Leitfrage.'
    : 'Der Schüler bittet um einen kleinen Tipp. Gib einen kurzen Hinweis, in welche Richtung er denken sollte (keine Lösung, kein Rechenschritt), dann eine Leitfrage.',
  stark ? '🆘 Ich komme nicht weiter.' : '💡 Kannst du mir einen Tipp geben?');
}

async function loesungZeigen() {
  const s = z.s;
  const versuche = s.verlauf.filter((m) => m.rolle === 'ich').length;
  const ok = await lyra.dialog('Lösung zeigen?', h('div', { style: { maxWidth: '440px' } },
    h('p', {}, versuche < 2
      ? 'Du hast erst wenig ausprobiert – mit einem Tipp schaffst du es vielleicht selbst, und das bleibt viel besser hängen.'
      : 'Klar, manchmal hilft es, die Lösung zu sehen. Danach kannst du dir eine ähnliche Übungsaufgabe geben lassen und es selbst probieren.')), [
    { text: 'Doch lieber ein Tipp', art: 'text', wert: 'tipp' },
    { text: 'Lösung zeigen', wert: 'loesung' },
  ]);
  if (ok === 'tipp') return tipp(false);
  if (ok !== 'loesung') return;
  s.loesungGezeigt = true;
  await zug('Der Schüler hat ausdrücklich „Lösung zeigen“ gewählt. Zeig jetzt die vollständige Lösung Schritt für Schritt und erklär jeden Schritt kurz und verständlich. Setz "geloest" auf false.', '👀 Zeig mir bitte die Lösung.');
}

async function uebung() {
  const s = z.s;
  if (z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  status('Sokrates überlegt sich eine ähnliche Aufgabe …');
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: system(s),
      prompt: `Ursprüngliche Aufgabe:\n${s.aufgabe}\n\nErstelle EINE ähnliche Übungsaufgabe zum selben Thema und mit gleichem Schwierigkeitsgrad, aber mit anderen Zahlen bzw. einem anderen Beispiel. Gib nur die Aufgabenstellung zurück – ohne Lösung, ohne Einleitung.`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const a = text(r && r.text).replace(/^(aufgabe|übungsaufgabe)\s*:\s*/i, '');
    z.laeuft = false;
    if (a) {
      z.einst.fach = s.fach;
      z.einst.klasse = s.klasse;
      return beginnen(a);
    }
    z.fehler = 'Es kam keine Aufgabe zurück – versuch es noch einmal.';
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

async function sitzungLoeschen(s) {
  const ok = await lyra.dialog('Gespräch löschen?', h('p', {}, kurz(s.aufgabe, 120)), [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Löschen', wert: true }]);
  if (!ok) return;
  try { await lyra.speicher.loeschen('sitzungen/' + s.id); } catch (_) {}
  z.sitzungen = z.sitzungen.filter((x) => x.id !== s.id);
  if (z.s === s) z.s = null;
  nachaussen();
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  app.replaceChildren(z.s ? gespraech(z.s) : startAnsicht());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (_) {} }
  lyra.titel(z.s ? `${FAECHER[z.s.fach][0]} · Klasse ${z.s.klasse}` : '');
}

const laufZeile = () => (z.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'status' }, z.status),
  h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : null);
const fehlerZeile = (nochmal) => (z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) && nochmal ? () => { z.lehrer = 'lyra'; z.fehler = null; nochmal(); } : null,
  () => { z.fehler = null; zeichnen(); }, nochmal ? () => { z.fehler = null; nochmal(); } : null) : null);

function startAnsicht() {
  const e = z.einst;
  const einstSichern = () => lyra.speicher.schreiben('einstellungen', z.einst).catch(() => {});
  const geschafft = z.sitzungen.filter((s) => s.geloest).length;
  const offen = z.sitzungen.filter((s) => !s.geloest && !s.loesungGezeigt);
  const rest = z.sitzungen.filter((s) => s.geloest || s.loesungGezeigt);
  const eintrag = (s) => lyra.eintrag({
    symbol: FAECHER[s.fach][1],
    titel: s.aufgabe,
    unter: `${FAECHER[s.fach][0]} · Klasse ${s.klasse} · ${s.geloest ? '✓ selbst gelöst' : s.loesungGezeigt ? 'Lösung angesehen' : `${s.fortschritt || 0} % geschafft`} · ${lyra.zeitText(s.zeit)}`,
    fortschritt: s.geloest || s.loesungGezeigt ? null : (s.fortschritt || 0) / 100,
    beiKlick: () => { z.s = s; zeichnen(); scrollen(); },
    aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => sitzungLoeschen(s) }],
  });
  return h('div', { class: 'seite' },
    h('div', { class: 'kopf-eule' }, h('div', { class: 'eule' }, '🦉'),
      lyra.kopf({ titel: 'Woran arbeitest du?', unter: 'Ich sage dir nicht die Lösung – ich helfe dir mit Fragen, selbst draufzukommen.' })),
    h('div', { class: 'faecher' }, Object.entries(FAECHER).map(([k, [n, sy]]) => h('button', { class: 'fach' + (e.fach === k ? ' an' : ''), onclick: () => { e.fach = k; einstSichern(); zeichnen(); } }, h('span', { class: 'fach-symbol' }, sy), n))),
    lyra.verfasser({
      wert: z.aufgabe,
      feld: 'aufgabe',
      zeilen: 3,
      platzhalter: e.fach === 'mathe' ? 'z. B. „Löse 3x + 7 = 2x − 5“ oder „Wie finde ich den Scheitelpunkt einer Parabel?“' : 'Schreib deine Aufgabe oder Frage hinein – so, wie sie im Heft oder Buch steht.',
      beiEingabe: (v) => { z.aufgabe = v; },
      beiSenden: (v) => { z.aufgabe = v; beginnen(); },
      knopf: 'Los geht’s',
      deaktiviert: !!z.laeuft,
      unten: [
        lyra.auswahl({ titel: 'Klasse', optionen: [5, 6, 7, 8, 9, 10, 11, 12, 13].map((k) => [k, String(k)]), wert: e.klasse, beiWahl: (k) => { e.klasse = k; einstSichern(); zeichnen(); } }),
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
      ],
    }),
    z.laeuft ? h('div', { style: { marginTop: '12px' } }, lyra.arbeit(z.status || 'Sokrates denkt nach …')) : null,
    fehlerZeile(() => beginnen()),
    offen.length ? lyra.abschnitt('Weitermachen', h('div', { class: 'ly-liste' }, offen.slice(0, 12).map(eintrag))) : null,
    rest.length ? lyra.abschnitt(geschafft ? `Erledigt · 🏆 ${geschafft} selbst gelöst` : 'Erledigt', h('div', { class: 'ly-liste' }, rest.slice(0, 20).map(eintrag))) : null);
}

function gespraech(s) {
  const feld = h('textarea', { class: 'eingabe antwort-feld', 'data-feld': 'antwort', rows: 2, placeholder: s.geloest ? 'Noch eine Frage dazu?' : 'Deine Antwort oder Idee … (Enter zum Senden, ⇧ Enter für neue Zeile)' });
  feld.value = z.eingabe;
  feld.addEventListener('input', () => { z.eingabe = feld.value; const k = document.getElementById('senden'); if (k) k.disabled = z.laeuft || !feld.value.trim(); });
  feld.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); senden(); } });
  const fertig = s.geloest || s.loesungGezeigt;
  return h('div', { class: 'gespraech' },
    h('div', { class: 'kopf' },
      h('button', { class: 'knopf text klein', style: { paddingLeft: 0 }, onclick: () => { z.s = null; zeichnen(); } }, '← Aufgaben'),
      h('div', { class: 'wachsen' }, lyra.balken((s.fortschritt || 0) / 100, s.geloest ? 'var(--ok)' : 'var(--akzent)')),
      h('span', { class: 'klein leise', style: { minWidth: '44px', textAlign: 'right' } }, `${s.fortschritt || 0} %`)),
    h('div', { class: 'verlauf' },
      h('div', { class: 'aufgabe-karte' }, h('div', { class: 'ueberschrift-klein' }, `${FAECHER[s.fach][1]} Deine Aufgabe`), lyra.mdElement(s.aufgabe)),
      s.verlauf.map((m) => h('div', { class: 'nachricht ' + m.rolle },
        m.rolle === 'sokrates' ? h('div', { class: 'avatar' }, '🦉') : null,
        h('div', { class: 'blase' }, m.rolle === 'sokrates' ? lyra.mdElement(m.text) : m.text))),
      z.laeuft ? h('div', { class: 'nachricht sokrates' }, h('div', { class: 'avatar' }, '🦉'), h('div', { class: 'blase tippt' }, h('span'), h('span'), h('span'))) : null,
      s.geloest ? h('div', { class: 'geschafft' },
        h('div', { style: { fontSize: '34px' } }, '🎉'),
        h('div', { class: 'fett', style: { fontSize: '17px' } }, 'Selbst gelöst – richtig stark!'),
        h('div', { class: 'leise klein' }, 'Willst du das gleich festigen? Eine ähnliche Aufgabe hilft am meisten.'),
        h('button', { class: 'knopf', disabled: z.laeuft, onclick: uebung }, 'Ähnliche Aufgabe üben')) : null,
      s.loesungGezeigt && !s.geloest ? h('div', { class: 'geschafft leise-rahmen' },
        h('div', { class: 'fett' }, 'Jetzt du!'),
        h('div', { class: 'leise klein' }, 'Probier eine ähnliche Aufgabe – diesmal ganz ohne Lösung.'),
        h('button', { class: 'knopf', disabled: z.laeuft, onclick: uebung }, 'Ähnliche Aufgabe üben')) : null),
    h('div', { class: 'fuss' },
      z.laeuft ? laufZeile() : null,
      fehlerZeile(),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } },
        !fertig ? h('button', { class: 'chip', disabled: z.laeuft, onclick: () => tipp(false) }, '💡 Tipp') : null,
        !fertig ? h('button', { class: 'chip', disabled: z.laeuft, onclick: () => tipp(true) }, '🆘 Ich komme nicht weiter') : null,
        h('span', { class: 'wachsen' }),
        !fertig ? h('button', { class: 'knopf text klein', disabled: z.laeuft, onclick: loesungZeigen }, 'Lösung zeigen …') : null,
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null),
      h('div', { class: 'zeile', style: { gap: '8px', alignItems: 'flex-end' } },
        feld,
        h('button', { class: 'knopf senden', id: 'senden', disabled: z.laeuft || !z.eingabe.trim(), onclick: senden }, 'Senden'))));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = { ...z.einst };
  const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
  const m = () => box.replaceChildren(...[['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']].map(([w, n]) =>
    h('button', { class: 'chip' + (e.ki === w ? ' an' : ''), onclick: () => { e.ki = w; m(); } }, n)));
  m();
  const ok = await lyra.dialog('Sokrates – Einstellungen', h('div', { style: { minWidth: '420px' } },
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Wer unterrichtet'), box,
    h('div', { class: 'klein leise', style: { marginTop: '8px' } }, 'Mit Claude, ChatGPT oder Gemini gehen deine Aufgabe und das Gespräch hinaus (Lyra fragt vorher). Mit Lyra (lokal) bleibt alles auf deinem Mac.')), [
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
