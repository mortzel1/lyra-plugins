'use strict';
/*
 * Tinte – Briefe und E-Mails, die sitzen. Du sagst in Stichpunkten, worum es geht; Tinte schreibt den Text im passenden
 * Ton (Kündigung, Widerspruch, Beschwerde, Krankmeldung …). Briefe setzt Tinte nach DIN 5008 (Form B) – fertig zum
 * Drucken oder als PDF. Vorhandene Texte überarbeitet Tinte auf Knopfdruck: kürzer, freundlicher, bestimmter, fehlerfrei.
 */
const { h } = lyra;

const ANLAESSE = {
  frei: ['Freies Anliegen', '✍️', ''],
  kuendigung: ['Kündigung', '✂️', 'Kündigung eines Vertrags oder Abos: Vertrags-/Kundennummer nennen, „fristgerecht zum nächstmöglichen Zeitpunkt“, um schriftliche Bestätigung mit dem Datum des Vertragsendes bitten, ggf. Widerruf einer Einzugsermächtigung.'],
  widerspruch: ['Widerspruch', '🛑', 'Widerspruch gegen einen Bescheid oder eine Rechnung: Bezug (Datum, Aktenzeichen/Rechnungsnummer), ausdrücklich „lege ich hiermit Widerspruch ein“, sachliche Begründung, um Eingangsbestätigung bitten.'],
  anfrage: ['Anfrage', '❔', 'Höfliche Anfrage mit klarer Frage und gewünschter Antwortfrist.'],
  beschwerde: ['Beschwerde', '😤', 'Sachliche Beschwerde: was passiert ist (wann, wo), was du erwartest (Erstattung, Nachbesserung …), angemessene Frist setzen, bestimmt aber höflich.'],
  krank: ['Krankmeldung', '🤒', 'Krankmeldung oder Entschuldigung (Schule, Uni, Arbeit): Zeitraum, ggf. Attest folgt, ggf. was verpasst wird und wie es nachgeholt wird. Keine Diagnose nennen.'],
  dank: ['Dank', '🙏', 'Herzlicher, konkreter Dank – was genau geholfen hat.'],
  mahnung: ['Zahlungserinnerung', '⏰', 'Freundliche Zahlungserinnerung: Rechnungsnummer und -datum, offener Betrag, neue Frist, Bankverbindung als Platzhalter.'],
  antrag: ['Antrag', '📄', 'Antrag an eine Behörde oder Hochschule: worum genau, Begründung, beigefügte Unterlagen (Anlagen) nennen.'],
  absage: ['Absage', '🙅', 'Freundliche Absage (Termin, Angebot, Einladung) – kurz, mit Dank, ohne lange Ausreden.'],
};
const TOENE = [['foermlich', 'Förmlich'], ['freundlich', 'Freundlich'], ['bestimmt', 'Bestimmt'], ['locker', 'Locker']];
const LAENGEN = [['kurz', 'Kurz'], ['mittel', 'Mittel'], ['lang', 'Ausführlich']];
const UMSCHREIBEN = [
  ['kuerzer', 'Kürzer', 'Kürze den Text deutlich, ohne Wichtiges zu verlieren.'],
  ['laenger', 'Ausführlicher', 'Formuliere etwas ausführlicher und begründe besser.'],
  ['freundlicher', 'Freundlicher', 'Mach den Ton wärmer und freundlicher.'],
  ['bestimmter', 'Bestimmter', 'Formuliere bestimmter und klarer, mit eindeutiger Forderung und Frist – aber höflich.'],
  ['foermlicher', 'Förmlicher', 'Formuliere förmlicher und sachlicher.'],
  ['lockerer', 'Lockerer', 'Formuliere lockerer und persönlicher.'],
  ['korrigieren', 'Fehler korrigieren', 'Korrigiere nur Rechtschreibung, Grammatik und Zeichensetzung – sonst nichts ändern.'],
  ['englisch', 'Auf Englisch', 'Übersetze den Text in natürliches, höfliches Englisch (Betreff, Anrede und Gruß ebenfalls).'],
];

const STANDARD = { ki: 'auto', absender: { name: '', strasse: '', ort: '', email: '', telefon: '' }, stadt: '', ton: 'foermlich' };

const SYSTEM = `Du bist „Tinte“ in Lyra und schreibst Briefe und E-Mails auf Deutsch – klar, höflich, korrekt und nach \
DIN 5008. Keine leeren Floskeln („hiermit möchte ich Ihnen mitteilen, dass“), kurze Absätze, aktive Sätze. Du erfindest \
keine Fakten: Fehlen Kundennummern, Daten, Beträge oder Namen, setzt du Platzhalter in eckigen Klammern, z. B. \
[Kundennummer]. Der Text enthält weder Anrede noch Grußformel noch Unterschrift – die stehen in eigenen Feldern.`;

// Schlüssel alphabetisch sinnvoll: Anrede, Betreff, Gruß, Text
const SCHEMA = {
  type: 'object',
  properties: { anrede: { type: 'string' }, betreff: { type: 'string' }, gruss: { type: 'string' }, text: { type: 'string' } },
  required: ['anrede', 'betreff', 'gruss', 'text'],
};

const z = {
  info: null,
  einst: { ...STANDARD },
  lehrer: 'lyra',
  entwuerfe: [],
  offen: null,
  ansicht: 'start', // start | entwurf | brief | ueberarbeiten
  ueber: { text: '', auftrag: 'korrigieren', frei: '', ergebnis: '' },
  laeuft: false,
  status: '',
  fehler: null,
  meldung: '',
};
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  try { const e = (await lyra.speicher.lesen('einstellungen')) || {}; z.einst = { ...STANDARD, ...e, absender: { ...STANDARD.absender, ...(e.absender || {}) } }; } catch (_) {}
  z.lehrer = z.einst.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { z.entwuerfe = (await lyra.speicher.liste('entwuerfe')).map((e) => e.wert).filter((x) => x && x.id).sort((a, b) => b.zeit - a.zeit); } catch (_) {}
  lyra.bei('zurueck', () => {
    if (document.querySelector('.dialog-grund')) return;
    if (z.laeuft) return lyra.abbrechen();
    if (z.ansicht === 'brief') { z.ansicht = 'entwurf'; return zeichnen(); }
    if (z.ansicht !== 'start') { z.ansicht = 'start'; z.offen = null; return zeichnen(); }
    lyra.zurueck();
  });
  lyra.bei('einstellungen', einstellungen);
  const route = z.info.route || decodeURIComponent(location.hash.slice(1));
  if (route.startsWith('entwurf/')) { z.offen = z.entwuerfe.find((e) => e.id === route.slice(8)) || null; if (z.offen) z.ansicht = 'entwurf'; }
  zeichnen();
  if (route === 'einstellungen') einstellungen();
}

function neu(art) {
  z.offen = { id: lyra.neueId(), art, anlass: 'frei', anliegen: '', empfaenger: '', ton: z.einst.ton, sie: true, laenge: 'mittel', betreff: '', anrede: '', text: '', gruss: '', zeit: lyra.jetzt(), datum: '' };
  z.ansicht = 'entwurf';
  z.fehler = null;
  zeichnen();
  setTimeout(() => { const f = document.querySelector('[data-feld="anliegen"]'); if (f) f.focus(); });
}

async function sichern() {
  const e = z.offen;
  if (!e) return;
  e.zeit = lyra.jetzt();
  try { await lyra.speicher.schreiben('entwuerfe/' + e.id, e); } catch (_) {}
  z.entwuerfe = [e, ...z.entwuerfe.filter((x) => x.id !== e.id)];
}

function status(t) {
  z.status = t;
  const el = document.getElementById('status');
  if (el) el.textContent = t;
}

// ================================================================== Schreiben

async function schreiben(umschreiben) {
  const e = z.offen;
  if (!e || z.laeuft) return;
  if (!umschreiben && !text(e.anliegen)) return;
  z.laeuft = true;
  z.fehler = null;
  status(umschreiben ? 'Tinte formuliert um …' : 'Tinte schreibt …');
  zeichnen();
  const a = ANLAESSE[e.anlass] || ANLAESSE.frei;
  const ton = TOENE.find((t) => t[0] === e.ton)[1];
  const laenge = { kurz: 'kurz (3–5 Sätze)', mittel: 'mittellang (2–3 Absätze)', lang: 'ausführlich (3–5 Absätze)' }[e.laenge];
  const prompt = umschreiben
    ? `Hier ist ein ${e.art === 'brief' ? 'Brief' : 'E-Mail'}-Entwurf:\n\nBetreff: ${e.betreff}\nAnrede: ${e.anrede}\nText:\n${e.text}\nGruß: ${e.gruss}\n\n\
Auftrag: ${umschreiben[2]}\n\nGib den ganzen Entwurf überarbeitet zurück. Antwort als JSON: {"anrede": "…", "betreff": "…", "gruss": "…", "text": "…"}`
    : `Schreib ${e.art === 'brief' ? 'einen Brief' : 'eine E-Mail'}.${a[2] ? `\nArt: ${a[0]} – ${a[2]}` : ''}\n\
Worum es geht (Stichpunkte des Absenders):\n${e.anliegen}\n\n${e.empfaenger ? `Empfänger:\n${e.empfaenger}\n\n` : ''}\
Absender: ${z.einst.absender.name || '[Name]'}\nTon: ${ton}. Länge: ${laenge}. ${e.sie ? 'Siezen.' : 'Duzen.'}\n\
"anrede": passende Anrede mit Komma (z. B. „Sehr geehrte Damen und Herren,“ – mit Namen, wenn der Empfänger einen nennt). \
"betreff": prägnant, ohne das Wort „Betreff“. "gruss": passende Grußformel ohne Komma (z. B. „Mit freundlichen Grüßen“). \
"text": nur der Brieftext, Absätze durch eine Leerzeile getrennt, Satzanfang nach der Anrede klein.\n\n\
Antwort als JSON: {"anrede": "…", "betreff": "…", "gruss": "…", "text": "…"}`;
  try {
    const r = await lyra.ki({ lehrer: z.lehrer, system: SYSTEM, prompt, schema: SCHEMA }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    const j = (r && r.json) || {};
    if (!text(j.text)) throw new Error('Es kam kein Text zurück – versuch es noch einmal.');
    e.vorher = { betreff: e.betreff, anrede: e.anrede, text: e.text, gruss: e.gruss };
    e.betreff = text(j.betreff).replace(/^betreff:?\s*/i, '');
    e.anrede = text(j.anrede) || (e.sie ? 'Sehr geehrte Damen und Herren,' : 'Hallo,');
    e.text = text(j.text).replace(/\n{3,}/g, '\n\n');
    e.gruss = text(j.gruss).replace(/,$/, '') || 'Mit freundlichen Grüßen';
    await sichern();
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

async function ueberarbeiten() {
  const u = z.ueber;
  if (!text(u.text) || z.laeuft) return;
  z.laeuft = true;
  z.fehler = null;
  status('Tinte überarbeitet …');
  zeichnen();
  const auftrag = u.auftrag === 'frei' ? u.frei : (UMSCHREIBEN.find((x) => x[0] === u.auftrag) || UMSCHREIBEN[6])[2];
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer,
      system: 'Du bist „Tinte“ in Lyra und überarbeitest Texte auf Deutsch (oder in der Sprache, um die gebeten wird). Gib NUR den überarbeiteten Text zurück – ohne Einleitung, ohne Erklärung, ohne Anführungszeichen drumherum. Platzhalter in eckigen Klammern bleiben stehen.',
      prompt: `Auftrag: ${auftrag || 'Verbessere den Text.'}\n\nText:\n${u.text}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    if (r && r.lehrer) z.lehrer = r.lehrer;
    u.ergebnis = text(r && r.text).replace(/^["„“]|["“”]$/g, '');
  } catch (x) {
    const m = String((x && x.message) || x);
    if (!/ABGEBROCHEN|Abgebrochen/.test(m)) z.fehler = m;
  }
  z.laeuft = false;
  zeichnen();
}

function ganzerText(e) {
  return [e.anrede, '', e.text, '', e.gruss, z.einst.absender.name].filter((x, i, a) => x !== undefined && !(x === '' && a[i - 1] === '')).join('\n').trim();
}

function kopieren(s) {
  const f = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  f.value = s;
  document.body.appendChild(f);
  f.select();
  try { document.execCommand('copy'); } catch (_) {}
  f.remove();
  z.meldung = '✓ In die Zwischenablage kopiert';
  zeichnen();
}

// ================================================================== Ansicht

function zeichnen() {
  const aktiv = document.activeElement;
  const feld = aktiv && aktiv.dataset ? aktiv.dataset.feld : null;
  const pos = aktiv && typeof aktiv.selectionStart === 'number' ? [aktiv.selectionStart, aktiv.selectionEnd] : null;
  app.replaceChildren({ start: startAnsicht, entwurf: entwurfAnsicht, brief: briefAnsicht, ueberarbeiten: ueberAnsicht }[z.ansicht]());
  const e = feld && document.querySelector(`[data-feld="${feld}"]`);
  if (e) { e.focus(); if (pos) try { e.setSelectionRange(pos[0], pos[1]); } catch (_) {} }
  lyra.titel(z.ansicht === 'start' ? '' : z.ansicht === 'ueberarbeiten' ? 'Text überarbeiten' : z.offen && (z.offen.betreff || (z.offen.art === 'brief' ? 'Neuer Brief' : 'Neue E-Mail')));
}

function startAnsicht() {
  const kachel = (sym, titel, unter, bei) => h('button', { class: 'start-kachel', onclick: bei },
    h('div', { class: 'start-symbol' }, sym), h('div', { class: 'fett', style: { fontSize: '16px' } }, titel), h('div', { class: 'leise klein' }, unter));
  return h('div', { class: 'seite breit' },
    lyra.kopf({ titel: 'Was willst du schreiben?', unter: 'Briefe und E-Mails, die sitzen – sag in Stichpunkten, worum es geht, Tinte formuliert.' }),
    h('div', { class: 'drei' },
      kachel('✉️', 'Brief', 'DIN 5008, fertig zum Drucken oder als PDF', () => neu('brief')),
      kachel('📧', 'E-Mail', 'Betreff und Text zum Kopieren', () => neu('mail')),
      kachel('✨', 'Text überarbeiten', 'Kürzer, freundlicher, fehlerfrei …', () => { z.ansicht = 'ueberarbeiten'; zeichnen(); })),
    !z.einst.absender.name ? h('div', { class: 'hinweis' }, 'Tipp: Hinterleg unter Einstellungen (Zahnrad) deinen Absender – dann steht er automatisch auf jedem Brief.',
      h('button', { class: 'knopf text klein', onclick: einstellungen }, 'Jetzt eintragen')) : null,
    z.entwuerfe.length ? h('div', { style: { marginTop: '22px' } },
      h('div', { class: 'ueberschrift-klein', style: { marginBottom: '8px' } }, 'Deine Entwürfe'),
      h('div', { class: 'ly-liste' }, z.entwuerfe.map((e) => lyra.eintrag({
        symbol: e.art === 'brief' ? '✉️' : '📧',
        titel: e.betreff || (ANLAESSE[e.anlass] || ANLAESSE.frei)[0],
        unter: `${(e.text || e.anliegen || '').replace(/\s+/g, ' ').slice(0, 90)} · ${lyra.zeitText(e.zeit)}`,
        beiKlick: () => { z.offen = e; z.ansicht = 'entwurf'; zeichnen(); },
        aktionen: [{ symbol: '🗑', titel: 'Löschen', bei: () => entwurfLoeschen(e) }],
      })))) : null);
}

async function entwurfLoeschen(e) {
  const ok = await lyra.bestaetigen({ titel: 'Entwurf löschen?', text: e.betreff || 'Ohne Betreff', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('entwuerfe/' + e.id); } catch (_) {}
  z.entwuerfe = z.entwuerfe.filter((x) => x.id !== e.id);
  zeichnen();
}

function feldFuer(e, schl, attr, nachher) {
  const f = h(attr.rows ? 'textarea' : 'input', { class: attr.klasse || 'eingabe', 'data-feld': schl, ...attr, klasse: undefined });
  f.value = e[schl] || '';
  f.addEventListener('input', () => { e[schl] = f.value; if (nachher) nachher(); });
  f.addEventListener('change', () => sichern());
  return f;
}

function chips(liste, wert, bei) {
  return h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, liste.map(([k, n]) => h('button', { class: 'chip' + (wert === k ? ' an' : ''), onclick: () => { bei(k); sichern(); zeichnen(); } }, n)));
}

function entwurfAnsicht() {
  const e = z.offen;
  const brief = e.art === 'brief';
  const knopf = () => { const k = document.getElementById('los'); if (k) k.disabled = z.laeuft || !text(e.anliegen); };
  const links = h('div', { class: 'flaeche spalte', style: { gap: '12px' } },
    h('div', { class: 'ueberschrift-klein' }, brief ? '✉️ Brief' : '📧 E-Mail'),
    h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, Object.entries(ANLAESSE).map(([k, [n, s]]) =>
      h('button', { class: 'chip' + (e.anlass === k ? ' an' : ''), onclick: () => { e.anlass = k; zeichnen(); } }, `${s} ${n}`))),
    h('label', { class: 'feld' }, 'Worum geht’s? (Stichpunkte reichen)', feldFuer(e, 'anliegen', { rows: 5, placeholder: e.anlass === 'kuendigung' ? 'z. B. Fitnessstudio FitX, Mitgliedsnummer 12345, möchte zum nächstmöglichen Termin kündigen' : 'z. B. Paket kam beschädigt an, Bestellung 4711 vom 3. März, möchte Ersatz oder Geld zurück' }, knopf)),
    h('label', { class: 'feld' }, brief ? 'Empfänger (Anschrift)' : 'An wen (optional)', feldFuer(e, 'empfaenger', brief ? { rows: 4, placeholder: 'Firma GmbH\nKundenservice\nMusterstraße 1\n12345 Stadt' } : { placeholder: 'z. B. Frau Schulz, Prüfungsamt' })),
    h('div', { class: 'feld' }, 'Ton', chips(TOENE, e.ton, (k) => { e.ton = k; })),
    h('div', { class: 'zeile', style: { gap: '18px' } },
      h('div', { class: 'feld' }, 'Länge', chips(LAENGEN, e.laenge, (k) => { e.laenge = k; })),
      h('div', { class: 'feld' }, 'Anrede', chips([[true, 'Sie'], [false, 'Du']], e.sie, (k) => { e.sie = k; }))),
    h('div', { class: 'zeile' },
      z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || !text(e.anliegen), onclick: () => schreiben() }, e.text ? '✨ Neu schreiben' : '✨ Schreiben')),
    z.laeuft ? lyra.arbeit(z.status || 'Tinte schreibt …') : null,
    z.fehler ? lyra.fehlerBox(z.fehler, z.lehrer !== 'lyra' && lyra.istOffline(z.fehler) ? () => { z.lehrer = 'lyra'; z.fehler = null; schreiben(); } : null,
      () => { z.fehler = null; zeichnen(); }, () => { z.fehler = null; schreiben(); }) : null);

  const hoeheAnpassen = (f) => { f.style.height = 'auto'; f.style.height = Math.max(220, f.scrollHeight) + 'px'; };
  const textFeld = feldFuer(e, 'text', { rows: 12, klasse: 'eingabe brieftext', placeholder: 'Hier erscheint dein Text – du kannst alles direkt bearbeiten.' }, () => hoeheAnpassen(textFeld));
  setTimeout(() => hoeheAnpassen(textFeld));
  const rechts = h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
    h('div', { class: 'zeile' },
      h('div', { class: 'ueberschrift-klein wachsen' }, 'Dein Text'),
      e.vorher ? h('button', { class: 'knopf text klein', title: 'Letzte Änderung zurücknehmen', onclick: () => { Object.assign(e, e.vorher); e.vorher = null; sichern(); zeichnen(); } }, '↶ Rückgängig') : null),
    h('label', { class: 'feld' }, 'Betreff', feldFuer(e, 'betreff', { placeholder: 'Betreff' })),
    feldFuer(e, 'anrede', { placeholder: 'Sehr geehrte Damen und Herren,' }),
    textFeld,
    feldFuer(e, 'gruss', { placeholder: 'Mit freundlichen Grüßen' }),
    e.text ? h('div', {},
      h('div', { class: 'leise klein', style: { marginBottom: '6px' } }, 'Umformulieren:'),
      h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, UMSCHREIBEN.map((u) => h('button', { class: 'chip', disabled: z.laeuft, onclick: () => schreiben(u) }, u[1])))) : null,
    z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
    e.text ? h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '4px' } },
      brief ? h('button', { class: 'knopf', onclick: () => { z.ansicht = 'brief'; z.meldung = ''; zeichnen(); } }, '📄 Briefansicht & Drucken') : null,
      !brief ? h('button', { class: 'knopf', onclick: () => kopieren(ganzerText(e)) }, 'Text kopieren') : null,
      !brief ? h('button', { class: 'knopf tonal', onclick: () => kopieren(e.betreff) }, 'Betreff kopieren') : null,
      h('button', { class: 'knopf tonal', onclick: async () => { const ok = await lyra.speichern(`${e.betreff || 'Entwurf'}.txt`, (e.betreff ? `Betreff: ${e.betreff}\n\n` : '') + ganzerText(e) + '\n'); z.meldung = ok ? '✓ Gesichert' : ''; zeichnen(); } }, 'Als Text sichern …')) : null);

  return h('div', { class: 'seite breit' },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0, marginBottom: '8px' }, onclick: () => { z.ansicht = 'start'; z.offen = null; zeichnen(); } }, '← Übersicht'),
    h('div', { class: 'zwei' }, links, rechts));
}

/** DIN 5008 Form B: Anschriftfeld 45 mm von oben, Betreff darunter, Falz- und Lochmarken. */
function briefAnsicht() {
  const e = z.offen;
  const a = z.einst.absender;
  const datum = `${z.einst.stadt ? z.einst.stadt + ', ' : ''}${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const absenderZeile = [a.name, a.strasse, a.ort].filter(Boolean).join(' · ');
  const absaetze = (t) => t.split(/\n{2,}/).map((p) => h('p', {}, p.split('\n').flatMap((z2, i) => (i ? [h('br'), z2] : [z2]))));
  return h('div', { class: 'brief-buehne' },
    h('div', { class: 'zeile nur-bildschirm brief-leiste' },
      h('button', { class: 'knopf text klein', onclick: () => { z.ansicht = 'entwurf'; zeichnen(); } }, '← Bearbeiten'),
      h('span', { class: 'wachsen' }),
      !a.name ? h('span', { class: 'klein leise' }, 'Absender fehlt – unter Einstellungen eintragen.') : null,
      h('button', { class: 'knopf', onclick: () => lyra.drucken() }, 'Drucken / Als PDF sichern')),
    h('div', { class: 'brief' },
      h('div', { class: 'falz f1' }), h('div', { class: 'falz loch' }), h('div', { class: 'falz f2' }),
      h('div', { class: 'kopf-absender' },
        a.name ? h('div', { class: 'kopf-name' }, a.name) : null,
        h('div', {}, [a.strasse, a.ort].filter(Boolean).join(' · ')),
        h('div', {}, [a.telefon, a.email].filter(Boolean).join(' · '))),
      h('div', { class: 'anschrift' },
        absenderZeile ? h('div', { class: 'ruecksende' }, absenderZeile) : null,
        h('div', { class: 'empfaenger' }, (e.empfaenger || '[Empfänger]').split('\n').slice(0, 6).map((z2) => h('div', {}, z2)))),
      h('div', { class: 'infoblock' }, datum),
      h('div', { class: 'brief-inhalt' },
        h('div', { class: 'betreff' }, e.betreff),
        h('p', { class: 'anrede' }, e.anrede),
        absaetze(e.text),
        h('p', { class: 'gruss' }, e.gruss),
        h('div', { class: 'unterschrift' }, a.name || ''))));
}

function ueberAnsicht() {
  const u = z.ueber;
  const feld = h('textarea', { class: 'eingabe', 'data-feld': 'ueber', rows: 12, placeholder: 'Füg hier deinen Text ein – E-Mail, Bewerbung, Hausarbeit-Absatz …' });
  feld.value = u.text;
  feld.addEventListener('input', () => { u.text = feld.value; const k = document.getElementById('los'); if (k) k.disabled = z.laeuft || !u.text.trim(); });
  const frei = h('input', { class: 'eingabe', 'data-feld': 'frei', placeholder: 'Eigener Auftrag, z. B. „klinge weniger unterwürfig“', value: u.frei });
  frei.addEventListener('input', () => { u.frei = frei.value; u.auftrag = frei.value.trim() ? 'frei' : u.auftrag === 'frei' ? 'korrigieren' : u.auftrag; });
  return h('div', { class: 'seite breit' },
    h('button', { class: 'knopf text klein', style: { paddingLeft: 0, marginBottom: '8px' }, onclick: () => { z.ansicht = 'start'; zeichnen(); } }, '← Übersicht'),
    h('div', { class: 'zwei' },
      h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
        h('div', { class: 'ueberschrift-klein' }, '✨ Dein Text'),
        feld,
        h('div', { class: 'zeile umbruch', style: { gap: '6px' } }, UMSCHREIBEN.map(([k, n]) => h('button', { class: 'chip' + (u.auftrag === k ? ' an' : ''), onclick: () => { u.auftrag = k; u.frei = ''; zeichnen(); } }, n))),
        frei,
        h('div', { class: 'zeile' },
          z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null,
          h('span', { class: 'wachsen' }),
          h('button', { class: 'knopf gross', id: 'los', disabled: z.laeuft || !u.text.trim(), onclick: ueberarbeiten }, 'Überarbeiten')),
        z.laeuft ? h('div', { class: 'lauf' }, h('div', { class: 'lade' }), h('span', { class: 'wachsen', id: 'status' }, z.status),
          h('button', { class: 'knopf text klein', onclick: () => lyra.abbrechen() }, 'Abbrechen')) : null,
        z.fehler ? lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); }) : null),
      h('div', { class: 'flaeche spalte', style: { gap: '10px' } },
        h('div', { class: 'ueberschrift-klein' }, 'Ergebnis'),
        u.ergebnis ? h('div', { class: 'ergebnis' }, u.ergebnis) : h('div', { class: 'leise klein' }, 'Hier erscheint der überarbeitete Text.'),
        z.meldung ? h('div', { class: 'meldung' }, z.meldung) : null,
        u.ergebnis ? h('div', { class: 'zeile', style: { gap: '8px' } },
          h('button', { class: 'knopf', onclick: () => kopieren(u.ergebnis) }, 'Kopieren'),
          h('button', { class: 'knopf tonal', onclick: () => { u.text = u.ergebnis; u.ergebnis = ''; zeichnen(); } }, 'Weiter daran arbeiten')) : null)));
}

async function einstellungen() {
  if (document.querySelector('.dialog-grund')) return;
  const e = JSON.parse(JSON.stringify(z.einst));
  const f = (k, p) => { const i = h('input', { class: 'eingabe', placeholder: p, value: e.absender[k] }); i.addEventListener('input', () => { e.absender[k] = i.value.trim(); }); return i; };
  const stadt = h('input', { class: 'eingabe', placeholder: 'z. B. Berlin', value: e.stadt });
  stadt.addEventListener('input', () => { e.stadt = stadt.value.trim(); });
  const wahl = (schl, opt) => {
    const box = h('div', { class: 'zeile umbruch', style: { gap: '6px' } });
    const m = () => box.replaceChildren(...opt.map(([w, n]) => h('button', { class: 'chip' + (e[schl] === w ? ' an' : ''), onclick: () => { e[schl] = w; m(); } }, n)));
    m();
    return box;
  };
  const ok = await lyra.dialog('Tinte – Einstellungen', h('div', { style: { minWidth: '480px' } },
    h('div', { class: 'fett', style: { marginBottom: '6px' } }, 'Absender (steht auf deinen Briefen)'),
    h('div', { class: 'raster-2' }, f('name', 'Vor- und Nachname'), f('strasse', 'Straße und Hausnummer'), f('ort', 'PLZ und Ort'), f('telefon', 'Telefon (optional)'), f('email', 'E-Mail (optional)'), stadt),
    h('div', { class: 'klein leise', style: { margin: '4px 0 12px' } }, 'Der Ort im letzten Feld steht vor dem Datum („Berlin, 21.11.2026“).'),
    h('div', { class: 'fett', style: { marginBottom: '4px' } }, 'Standard-Ton'), wahl('ton', TOENE),
    h('div', { class: 'fett', style: { margin: '12px 0 4px' } }, 'Wer schreibt'), wahl('ki', [['auto', 'Automatisch (Claude & Co., wenn verbunden)'], ['lyra', 'Immer Lyra (lokal)']])), [
    { text: 'Abbrechen', art: 'text', wert: false },
    { text: 'Sichern', wert: true },
  ]);
  if (!ok) return;
  z.einst = e;
  z.lehrer = e.ki === 'lyra' ? 'lyra' : z.info.standardLehrer || 'lyra';
  try { await lyra.speicher.schreiben('einstellungen', e); } catch (_) {}
  zeichnen();
}

// ================================================================== Fusion (mehrere Plugins, eine Aufgabe)

function fusionAnbieten() {
  lyra.fusion.anbieten({
    schreiben: async (a, { status }) => {
      const material = lyra.fusion.materialOhneAufgabe(a, 5000);
      const auftrag = String(a.anweisung || lyra.fusion.thema(a));
      z.lehrer = a.lehrer || z.lehrer;
      z.offen = {
        id: lyra.neueId(), art: /\bbrief\b/i.test(auftrag) ? 'brief' : 'mail', anlass: 'frei',
        anliegen: `${auftrag}${material ? `\n\nHintergrund (aus anderen Plugins – nutze nur, was für den Text wichtig ist):\n${material}` : ''}`,
        empfaenger: '', ton: /locker|du\b|duz/i.test(auftrag) ? 'locker' : z.einst.ton, sie: !/\bdu\b|duz|locker/i.test(auftrag), laenge: 'mittel',
        betreff: '', anrede: '', text: '', gruss: '', zeit: lyra.jetzt(), datum: '',
      };
      const e = z.offen;
      const uhr = setInterval(() => { if (z.status) status(z.status); }, 1200);
      try { await schreiben(); } finally { clearInterval(uhr); }
      if (!text(e.text)) throw new Error(z.fehler || 'Tinte konnte keinen Text schreiben.');
      return {
        art: 'dokument',
        titel: `${e.art === 'brief' ? 'Brief' : 'E-Mail'}: ${e.betreff || 'Entwurf'}`,
        markdown: `**Betreff:** ${e.betreff}\n\n${ganzerText(e)}`,
        daten: { art: e.art, betreff: e.betreff, anrede: e.anrede, text: e.text, gruss: e.gruss },
        oeffnen: 'entwurf/' + e.id,
      };
    },
  });
}

start().catch(() => {}).then(fusionAnbieten);
