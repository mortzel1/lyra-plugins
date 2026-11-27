'use strict';
/*
 * Clavis – Escape Rooms in Lyra. Fertige Räume oder von der KI gebaut (aus einem Thema, gern aus deinen Unterlagen) oder
 * selbst gebaut. Allein spielen oder als Team: per Link/QR im Browser (ohne Lyra, ohne Konto) oder in Lyra Campus.
 * Die KI liefert Geschichte und Inhalte, der Spielleiter (leiter.js) baut daraus lösbare Rätsel aus der Mechanik-Sammlung.
 * Lösungen bleiben verborgen – der Editor zeigt sie erst, wenn du es ausdrücklich willst.
 */
const { h } = lyra;
const TYP = 'clavis';
const meldung = LyraOnline.meldung;
const abgebrochen = LyraOnline.abgebrochen;
const app = document.getElementById('app');
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const M = Clavis.MECHANIKEN;
const SZENEN_JE_STUFE = { leicht: 1, mittel: 2, schwer: 2, experte: 3 };

const z = {
  info: null, lehrer: 'lyra', ansicht: 'start', raeume: [], ergebnisse: {}, kontext: null,
  einst: { welt: 'krimi', stufe: 'mittel', quelle: 'beides', alter: 'ab14', jumpscares: true, schreckErlaubt: true, stimmung: { spannung: 6, gefahr: 4, spuk: 3, grusel: 3 } }, thema: '', wahl: {},
  entwurf: null, editorOffen: false, spiel: null, hinweis: '', fehler: null,
};

// ================================================================== Start, Speicher

async function start() {
  try { z.info = await lyra.info(); } catch (_) { z.info = { lehrer: [{ kennung: 'lyra', name: 'Lyra (lokal)' }], standardLehrer: 'lyra', route: '' }; }
  z.lehrer = z.info.standardLehrer || 'lyra';
  try { z.einst = { ...z.einst, ...((await lyra.speicher.lesen('einstellungen')) || {}) }; } catch (_) {}
  if (!Clavis.ALTER[z.einst.alter]) z.einst.alter = 'ab14';
  z.einst.stimmung = Clavis.stimmungAus(z.einst.stimmung, z.einst.alter);
  await laden();
  lyra.bei('zurueck', zurueck);
  try { z.kontext = await lyra.campus.kontext(); } catch (_) { z.kontext = null; }
  const k = z.kontext;
  if (k && k.inhalt && k.inhalt.typ === TYP) {
    const ichLeite = k.ich && k.inhalt.von === k.ich.id;
    if (!ichLeite) return mitmachen(k);
    const d = k.inhalt.daten || {};
    const e = alleRaeume().find((x) => x.id === d.raum);
    if (e) return spielen(e, d.stufe || 'mittel', true, { campus: true });
  }
  zeichnen();
}

async function laden() {
  try { z.raeume = (await lyra.speicher.liste('raum')).map((e) => e.wert).filter(Boolean).sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0)); } catch (_) { z.raeume = []; }
  try { z.ergebnisse = (await lyra.speicher.lesen('ergebnisse')) || {}; } catch (_) { z.ergebnisse = {}; }
}

const alleRaeume = () => CLAVIS_VORLAGEN.concat(z.raeume);

async function raumSichern(e) {
  e.geaendert = lyra.jetzt();
  try { await lyra.speicher.schreiben('raum/' + e.id, e); } catch (err) { lyra.toast(meldung(err), 'fehler'); }
  const i = z.raeume.findIndex((x) => x.id === e.id);
  if (i >= 0) z.raeume[i] = e; else z.raeume.unshift(e);
}

async function zurueck() {
  if (document.querySelector('.dialog-grund')) return;
  if (z.ansicht === 'mitmachen') return lyra.zurueck();
  if (z.ansicht === 'spiel') return spielVerlassen();
  if (z.ansicht === 'bauen') { lyra.abbrechen(); return; }
  if (z.ansicht !== 'start') { z.ansicht = 'start'; z.entwurf = null; z.editorOffen = false; return zeichnen(); }
  lyra.zurueck();
}

// ================================================================== KI baut einen Raum

const INHALT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['antwort', 'frage', 'fragen', 'hinweis', 'optionen', 'paare', 'raetsel', 'reihe', 'richtig', 'satz', 'wort', 'zahl', 'zeit'],
  properties: {
    wort: { type: 'string' }, raetsel: { type: 'string' }, zahl: { type: 'string' }, frage: { type: 'string' }, antwort: { type: 'string' },
    optionen: { type: 'array', items: { type: 'string' } }, richtig: { type: 'integer' },
    paare: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['links', 'rechts'], properties: { links: { type: 'string' }, rechts: { type: 'string' } } } },
    reihe: { type: 'array', items: { type: 'string' } }, zeit: { type: 'string' }, satz: { type: 'string' }, hinweis: { type: 'string' },
    fragen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['frage', 'optionen', 'richtig'], properties: { frage: { type: 'string' }, optionen: { type: 'array', items: { type: 'string' } }, richtig: { type: 'integer' } } } },
  },
};
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['finale_text', 'intro', 'loesungswort', 'outro', 'szenen', 'teaser', 'titel'],
  properties: {
    titel: { type: 'string' }, teaser: { type: 'array', items: { type: 'string' } }, intro: { type: 'string' }, outro: { type: 'string' }, finale_text: { type: 'string' }, loesungswort: { type: 'string' },
    szenen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['art', 'stationen', 'text', 'titel'], properties: {
      titel: { type: 'string' }, text: { type: 'string' }, art: { type: 'string', enum: ['zimmer', 'keller', 'halle', 'gang', 'oben', 'technik'] },
      stationen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ereignis', 'ereignis_text', 'geschichte', 'hinweise', 'inhalt', 'mech', 'ort', 'symbol', 'text', 'titel', 'tuer'], properties: {
        ort: { type: 'string' }, symbol: { type: 'string', enum: Object.keys(Clavis.ICONS).filter((x) => x !== 'ausgang') }, titel: { type: 'string' }, text: { type: 'string' },
        mech: { type: 'string', enum: Object.keys(M) }, tuer: { type: 'boolean' },
        ereignis: { type: 'string', enum: ['keins'].concat(Object.keys(Clavis.EREIGNISSE)) }, ereignis_text: { type: 'string' }, geschichte: { type: 'string' },
        hinweise: { type: 'array', items: { type: 'string' } }, inhalt: INHALT_SCHEMA,
      } } },
    } } },
  },
};

/** Zu viele Wissensaufgaben? Die überzähligen werden zu Rätseln zum Anfassen (Ort und Gegenstand bleiben).
 *  neue: so viele der neuen Rätsel zum Anfassen sollen mindestens drin sein; versatz: damit jeder Raum andere bekommt. */
const WISSEN_ZUERST = ['wissen', 'verhoer', 'luecke', 'terminal', 'kabel', 'binaer', 'tresor', 'uhr', 'zahlenschloss', 'wortschloss', 'reihenfolge'];
const NEU_ZUM_ANFASSEN = ['raumcode', 'fehlteil', 'spiegel', 'timing', 'veraendert', 'klopfzeichen', 'waage', 'zahnraeder', 'schaltkreis', 'ventile', 'sternbild', 'bildpuzzle', 'fingerabdruck', 'schattenbild', 'umfuellen',
  'symbolsudoku', 'lichtfolge', 'funkfrequenz', 'fernrohr', 'schluessel', 'spiegelschrift', 'leitungsgewirr', 'farbmischen', 'drehringe', 'lecks', 'zahlenreihe', 'dominos', 'huetchenspiel', 'glocken', 'sonar', 'tastenfeld', 'zerrissen'];
function abwechslung(entwurf, anteil, { neue = 0, versatz = 0 } = {}) {
  const welt = entwurf.welt;
  const alle = (entwurf.szenen || []).flatMap((sz) => sz.stationen || []);
  const max = anteil >= 0.5 ? Math.ceil(alle.length * anteil) : Math.max(1, Math.floor(alle.length * anteil));
  const rang = (s) => (WISSEN_ZUERST.includes(s.mech) ? WISSEN_ZUERST.indexOf(s.mech) : 50);
  const wissen = alle.filter((s) => M[s.mech] && M[s.mech].art === 'wissen').sort((a, b) => rang(a) - rang(b));
  const benutzt = () => new Set(alle.map((s) => s.mech));
  // Ein neues Rätsel, das zur Welt und – wenn möglich – zum Gegenstand passt; sonst bekommt die Station den passenden Gegenstand
  const tauschen = (s, nurNeue) => {
    const b = benutzt();
    const reihe = (l) => l.slice(versatz % Math.max(1, l.length)).concat(l.slice(0, versatz % Math.max(1, l.length)));
    const fuerDing = Clavis.passendeMechaniken(welt, s.symbol, b).filter((x) => !b.has(x) && (!nurNeue || NEU_ZUM_ANFASSEN.includes(x)));
    const fuerWelt = reihe(Clavis.passendeMechaniken(welt, null, b)).filter((x) => !b.has(x) && (!nurNeue || NEU_ZUM_ANFASSEN.includes(x)));
    const h = [...String(s.ort || '') + String(s.titel || '')].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, versatz + 7);
    const neu = fuerDing.length ? fuerDing[h % Math.min(fuerDing.length, 5)] : fuerWelt[0];
    if (!neu) return false;
    const sk = Clavis.skin(neu, welt);
    if (fuerDing.length) Object.assign(s, { mech: neu, inhalt: {}, hinweise: [], titel: sk.titel, text: sk.text });
    else Object.assign(s, { mech: neu, inhalt: {}, hinweise: [], ort: sk.ort, symbol: sk.symbol, titel: sk.titel, text: sk.text });
    return true;
  };
  let n = 0;
  for (const s of wissen.slice(0, Math.max(0, wissen.length - max))) if (tauschen(s, false)) n++;
  // Mindestens ein paar der neuen Rätsel zum Anfassen: erst weitere Wissensfragen, dann doppelte Mechaniken, dann Buchstabensalat und Zahlenschlösser
  const zahlNeu = () => alle.filter((s) => NEU_ZUM_ANFASSEN.includes(s.mech)).length;
  const kandidaten = () => {
    const zaehler = {};
    alle.forEach((s) => { zaehler[s.mech] = (zaehler[s.mech] || 0) + 1; });
    return alle.filter((s) => !NEU_ZUM_ANFASSEN.includes(s.mech)).sort((a, b) => {
      const wert = (x) => (M[x.mech] && M[x.mech].art === 'wissen' ? 0 : zaehler[x.mech] > 1 ? 1 : ['anagramm', 'zahlenschloss', 'binaer'].includes(x.mech) ? 2 : 3);
      return wert(a) - wert(b);
    });
  };
  let schutz = 0;
  while (zahlNeu() < neue && schutz++ < 20) { const k = kandidaten()[0]; if (!k || !tauschen(k, true)) break; n++; }
  // Zum Schluss: jede Station stimmig (Rätsel passt zur Welt, Gegenstand passt zum Rätsel)
  const b = benutzt();
  for (const s of alle) if (Clavis.stationAnpassen(s, welt, b)) n++;
  return n;
}
// Auch die fertigen Räume: höchstens ein Drittel Wissen und je drei der neuen Rätsel zum Anfassen (jeder Raum andere)
CLAVIS_VORLAGEN.forEach((v, i) => abwechslung(v, 1 / 3, { neue: 3, versatz: i * 3 }));

function mechanikText(welt) {
  return Object.entries(M).filter(([k]) => !welt || Clavis.passtWelt(k, welt)).map(([k, m]) => {
    const p = Clavis.PASSUNG[k];
    const dinge = p && p.o !== '*' ? ` Passende Gegenstände ("symbol"): ${p.o.filter((x) => Clavis.ICONS[x]).slice(0, 8).join(', ')}.` : '';
    return `- "${k}" (${m.name}; Art: ${(Clavis.ARTEN || {})[m.art] || 'Sonstiges'}${m.stoff ? '; kann Lernstoff tragen' : ''}): ${m.kurz}${dinge} Inhalt: ${m.felder.length ? m.felder.map((f) => `"${f.k}" = ${f.titel}`).join('; ') : 'keiner – baut sich selbst'}${m.ohneInhalt ? ' (ohne Inhalt baut es sich selbst)' : ''}.`;
  }).join('\n');
}

async function bauenMitKi() {
  const thema = z.thema.trim();
  const stufe = z.einst.stufe;
  const st = Clavis.STUFEN[stufe];
  const welt = Clavis.WELTEN[z.einst.welt] ? z.einst.welt : 'krimi';
  const w = Clavis.WELTEN[welt];
  const alter = Clavis.ALTER[z.einst.alter] ? z.einst.alter : 'ab14';
  const stimmung = Clavis.stimmungAus(z.einst.stimmung, alter);
  try { await lyra.speicher.schreiben('einstellungen', z.einst); } catch (_) {}
  z.ansicht = 'bauen';
  z.fehler = null;
  z.hinweis = thema ? 'Suche passenden Stoff …' : 'Die Geschichte entsteht …';
  zeichnen();
  let block = '';
  if (thema && z.einst.quelle !== 'wissen') {
    try { block = (await lyra.suchen(thema, z.lehrer === 'lyra' ? 6 : 10)).block || ''; } catch (_) {}
    if (!block && z.einst.quelle === 'unterlagen') {
      z.fehler = 'Dazu habe ich in deinen Unterlagen nichts gefunden – wähle „Unterlagen + Wissen“ oder „Allgemeinwissen“.';
      z.ansicht = 'start';
      return zeichnen();
    }
  }
  const nSzenen = SZENEN_JE_STUFE[stufe];
  const n = st.stationen;
  const f = n - (nSzenen - 1);
  hinweisSetzen('Der Raum wird gebaut …');
  let r = null;
  try {
    r = await lyra.ki({
      lehrer: z.lehrer,
      system: 'Du bist ein preisgekrönter Escape-Room-Designer. Du baust spannende, stimmige Räume mit Überraschungen und Rätseln, die fair lösbar sind. ' +
        'Du schreibst Deutsch, lebendig und knapp, in der zweiten Person („du“). Alle Inhalte (Fakten, Fragen, Antworten) müssen korrekt und eindeutig sein. Antworte nur mit JSON nach dem Schema.',
      prompt: `Welt: ${alter === 'kinder' && w.kinderName ? `${w.kinderName} (kindgerechte Fassung von: ${w.kurz})` : `${w.name} – ${w.kurz}`}\nSchwierigkeit: ${st.name} (${st.beschreibung})\n` +
        `Altersstufe: ${Clavis.ALTER[alter].name} – ${Clavis.ALTER[alter].ki}\n` +
        (thema ? `Thema/Lernstoff: ${thema}\n` : 'Kein Lernstoff – ein freies Abenteuer in dieser Welt.\n') +
        (block ? `\nAuszüge aus meinen Unterlagen (Rätselinhalte daraus, korrekt übernehmen):\n${block}\n` : '') +
        `\nStimmung (Regler von 1 bis 10) – richte Geschichte, Orte, Texte, Rätselinhalte und Überraschungen danach aus:\n${stimmungKi(stimmung)}\n` +
        `Anzahl Überraschungen ("ereignis"): etwa ${Math.min(n, 1 + Math.round((stimmung.spannung + stimmung.gefahr + stimmung.spuk + stimmung.grusel) / 10))}; je höher Spuk und Grusel, desto unheimlicher die Ereignistexte; je höher Gefahr, desto bedrohlicher – immer passend zur Altersstufe.\n` +
        `\nBaue einen Escape Room mit genau ${nSzenen} Szene${nSzenen > 1 ? 'n' : ''} und insgesamt genau ${n} Stationen (gleichmäßig verteilt).\n` +
        `Mechaniken (Feld "mech") – nur diese passen in diese Welt:\n${mechanikText(welt)}\n\n` +
        'Regeln:\n' +
        (thema ? `- Etwa die Hälfte, höchstens ${Math.ceil(n * 0.5)} Stationen, sind Aufgaben der Art „Wissen“ mit echtem Lernstoff zum Thema (Fragen, Begriffe, Reihenfolgen, Zuordnungen). Der Rest sind Rätsel zum Anfassen.\n`
          : `- Höchstens ${Math.max(1, Math.floor(n * 0.25))} Station${Math.floor(n * 0.25) > 1 ? 'en' : ''} der Art „Wissen“ – ein Escape Room ist kein Quiz. Der Rest sind Rätsel zum Anfassen.\n`) +
        `- Rätsel zum Anfassen: Erkunden (raumcode, fehlteil – man durchsucht den Raum), Geschick (timing, rohre, labyrinth), Logik (spiegel, waage, schalter, farbcode, akte), Beobachten (veraendert, suchbild, karte), Hören (klopfzeichen, melodie), Entschlüsseln (morse, runen, caesar, taschenlampe, geheimtinte, anagramm). Mische mindestens ${Math.min(5, n)} verschiedene Arten${n > 3 ? '; mindestens eine Station der Art „Erkunden“' : ''}.\n` +
        '- Abwechslung: keine Mechanik öfter als einmal (bei mehr als 8 Stationen höchstens zweimal); passende Mechaniken zur Welt, und der Gegenstand („symbol“, „ort“) passt zur Mechanik (Waage, Spiegel, Tür zum Klopfen, Schloss …).\n' +
        '- "art" je Szene: was für ein Ort es ist – zimmer, keller, halle, gang, oben (Dach, Turm, Deck) oder technik (Maschinen, Labor).\n' +
        (nSzenen > 1 ? '- In jeder Szene außer der letzten hat genau eine Station "tuer": true – sie öffnet den Weg in die nächste Szene. Sonst "tuer": false.\n' : '- Alle Stationen "tuer": false.\n') +
        `- "loesungswort": ein Wort, das zur Geschichte passt, nur Buchstaben A–Z (Umlaute als AE, OE, UE), Länge ${f} bis ${f + 3}.\n` +
        `- "ereignis": bei einigen Stationen (siehe Anzahl oben) eine Überraschung nach dem Lösen (${w.ereignisse.join(', ')} passen gut) mit kurzem "ereignis_text"; sonst "keins".\n` +
        `- "symbol": ein Gegenstand, der zum Ort passt (z. B. ${w.objekte.join(', ')}).\n` +
        '- "ort": kurzer Name des Gegenstands im Raum (1–3 Wörter); "text": 1–2 Sätze, was man dort sieht; "titel": kurz und neugierig machend.\n' +
        '- "hinweise": 1–2 Hinweise, die helfen, ohne die Lösung zu verraten.\n' +
        '- Jede Station gehört zur Geschichte: "ort"/"symbol" ist ein Gegenstand, der in diese Szene gehört, "text" erzählt in 1–2 Sätzen, warum er für die Geschichte wichtig ist, und die Mechanik passt zum Gegenstand (siehe passende Gegenstände – keine Waage an einem Computer).\n' +
        '- "geschichte": 1 Satz – was man nach dem Lösen findet oder erfährt. Die Sätze bauen die Geschichte Schritt für Schritt auf: vom ersten Hinweis bis zur Auflösung beim letzten Rätsel.\n' +
        '- "inhalt": nur die Felder der gewählten Mechanik füllen, alle anderen leer lassen ("" , [], 0). Wörter ohne Leerzeichen. Bei "richtig" der Index der richtigen Option (ab 0). Bei "tresor" in "zahl" drei Zahlen 0–39 wie "12-7-31". Bei "uhr" eine Zeit wie "7:45". Bei "lueckentext"-Sätzen "___" für die Lücke.\n' +
        '- "intro": 3–5 Sätze, die in die Lage werfen (warum bist du hier, warum ist die Tür zu, was steht auf dem Spiel). "outro": 2–3 Sätze, wie du entkommst. "finale_text": ein Satz zur Ausgangstür.\n' +
        '- "teaser": 3–5 sehr kurze, packende Sätze (je höchstens 8 Wörter) für ein Kino-Intro, das neugierig macht – wie ein Filmtrailer, ohne etwas zu verraten. Der letzte Satz macht Lust aufs Losspielen.\n' +
        '- Ein guter Titel mit Atmosphäre.\n\n' +
        'Antwort als JSON genau in diesem Aufbau (Feldnamen exakt so, je Station alle Felder von "inhalt"):\n' +
        '{"titel": "…", "teaser": ["…"], "intro": "…", "outro": "…", "finale_text": "…", "loesungswort": "…", "szenen": [{"titel": "…", "text": "…", "art": "zimmer", "stationen": [' +
        '{"ort": "…", "symbol": "truhe", "titel": "…", "text": "…", "mech": "wortschloss", "tuer": false, "ereignis": "keins", "ereignis_text": "", "geschichte": "…", "hinweise": ["…"], ' +
        '"inhalt": {"wort": "…", "raetsel": "…", "zahl": "", "frage": "", "antwort": "", "optionen": [], "richtig": 0, "paare": [], "reihe": [], "zeit": "", "satz": "", "hinweis": "", "fragen": []}}]}]}',
      schema: SCHEMA,
      zaehlen: { schluessel: 'mech', wort: 'Station' },
    }, (e) => { if (e.art === 'hinweis') hinweisSetzen(e.text.replace(/Station (\d+)/, (_, x) => `Station ${x} von ${n}`)); });
    if (r && r.lehrer && r.lehrer !== z.lehrer) z.lehrer = r.lehrer;
  } catch (e) {
    if (abgebrochen(e)) { z.ansicht = 'start'; return zeichnen(); }
    z.fehler = meldung(e);
    z.ansicht = 'start';
    return zeichnen();
  }
  const j = (r && r.json) || {};
  const entwurf = {
    id: lyra.neueId(), welt, titel: text(j.titel) || (thema ? `Escape: ${thema}` : `Escape aus der ${w.name}`), stufe, thema,
    intro: text(j.intro), outro: text(j.outro), finaleText: text(j.finale_text), loesungswort: text(j.loesungswort), ki: true, erstellt: lyra.jetzt(), stimmung, alter,
    jumpscares: alter !== 'kinder' && !!z.einst.jumpscares, teaser: (j.teaser || []).map(text).filter(Boolean).slice(0, 5),
    szenen: (j.szenen || j.raeume || j.scenes || []).map((s) => ({ titel: text(s.titel || s.title), text: text(s.text), art: text(s.art || s.typ || ''), stationen: (s.stationen || s.raetsel || s.stations || []).map((x) => ({
      ort: text(x.ort), symbol: x.symbol, titel: text(x.titel), text: text(x.text), mech: x.mech, tuer: !!x.tuer, hinweise: (x.hinweise || []).map(text).filter(Boolean).slice(0, 2),
      ereignis: x.ereignis && x.ereignis !== 'keins' ? { art: x.ereignis, text: text(x.ereignis_text) } : null, inhalt: x.inhalt || {}, geschichte: text(x.geschichte || x.story || x.fund),
    })) })).filter((s) => s.stationen.length),
  };
  abwechslung(entwurf, thema ? 0.5 : 0.25, { neue: n >= 4 ? 1 : 0, versatz: Math.floor(Math.random() * 7) });
  let probe = null;
  try { probe = ClavisLeiter.bauen(entwurf, stufe, 1); } catch (e) { probe = null; }
  if (!probe || !entwurf.intro) {
    z.fehler = 'Der Raum ist nicht gelungen – bitte nochmal versuchen (oder einen anderen Lehrer wählen).';
    z.ansicht = 'start';
    return zeichnen();
  }
  entwurf.ersetzt = probe.ersetzt.length;
  await raumSichern(entwurf);
  z.thema = '';
  z.entwurf = entwurf;
  z.editorOffen = false;
  z.ansicht = 'raum';
  lyra.toast('✓ Dein Raum ist fertig – die Lösungen bleiben geheim, bis du spielst', 'ok');
  zeichnen();
}

/** Vier Regler 1–10: Spannung, Gefahr, Spuk, Gänsehaut */
function stimmungsRegler(ziel, beiAenderung, alter = 'ab14') {
  const grenzen = (Clavis.ALTER[alter] || Clavis.ALTER.ab14).max;
  return h('div', { class: 'stimmung' }, Object.entries(Clavis.STIMMUNG).map(([k, x]) => {
    const max = grenzen[k] || 10;
    if (ziel[k] > max) ziel[k] = max;
    const wert = h('span', { class: 'regler-wert' }, String(ziel[k]));
    const t = h('div', { class: 'regler-text' }, max < 10 ? `${Clavis.stimmungText(k, ziel[k])} · für „${Clavis.ALTER[alter].name}“ höchstens ${max}` : Clavis.stimmungText(k, ziel[k]));
    return h('label', { class: 'regler ' + k },
      h('div', { class: 'regler-kopf' }, h('b', {}, x.name), h('small', {}, x.en), wert),
      h('input', { type: 'range', min: 1, max, step: 1, value: ziel[k], 'aria-label': x.name, disabled: max === 1,
        oninput: (e) => { ziel[k] = Number(e.target.value); wert.textContent = String(ziel[k]); t.textContent = Clavis.stimmungText(k, ziel[k]); },
        onchange: () => beiAenderung && beiAenderung() }),
      t);
  }));
}

function stimmungKi(st) {
  return Object.entries(Clavis.STIMMUNG).map(([k, x]) => `- ${x.name} (${x.en}) ${st[k]}/10: ${x.ki[Clavis.stimmungStufe(st[k])]}`).join('\n');
}

const ALTER_REIHE = ['kinder', 'ab10', 'ab14', 'ab18'];
const alterErlaubt = (welt, alter) => !Clavis.WELTEN[welt].ab || ALTER_REIHE.indexOf(alter) >= ALTER_REIHE.indexOf(Clavis.WELTEN[welt].ab);

/** Altersstufe und Jumpscares (ziel: Einstellungen oder Entwurf) */
function alterWahl(ziel, beiAenderung) {
  const a = Clavis.ALTER[ziel.alter] || Clavis.ALTER.ab14;
  return h('div', { class: 'alter-wahl' },
    h('div', { class: 'alter-kopf' }, h('b', {}, 'Altersstufe'), h('span', { class: 'leise klein' }, a.kurz)),
    h('div', { class: 'stufen' }, ALTER_REIHE.map((k) => h('button', { class: 'stufe' + (ziel.alter === k ? ' an' : ''), type: 'button', title: Clavis.ALTER[k].kurz, onclick: () => { ziel.alter = k; beiAenderung(); } }, Clavis.ALTER[k].name))),
    h('label', { class: 'schreck-schalter' + (a.schreck ? '' : ' aus') },
      h('input', { type: 'checkbox', checked: a.schreck && ziel.jumpscares !== false, disabled: !a.schreck, onchange: (e) => { ziel.jumpscares = e.target.checked; beiAenderung(); } }),
      h('span', {}, '⚡ Jumpscares'),
      h('small', { class: 'leise' }, !a.schreck ? 'für Kinder immer aus' : a.schreck === 'mild' ? 'nur kleine Schreckmomente (Fledermäuse, Spinnen …)' : a.blut ? 'heftig – mit Blut' : 'heftig, besonders in gruseligen Räumen')));
}

function hinweisSetzen(t) {
  z.hinweis = t;
  const el = document.getElementById('hinweis');
  if (el) el.textContent = t;
}

// ================================================================== Spielen (allein oder als Team)

function spielen(entwurf, stufe, gruppe, { campus = false } = {}) {
  if (z.einst.schreckErlaubt === false) entwurf = { ...entwurf, jumpscares: false };
  let gebaut;
  try { gebaut = ClavisLeiter.bauen(entwurf, stufe, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
  const ich = { id: (z.kontext && z.kontext.ich && z.kontext.ich.id) || 'host', name: (z.kontext && z.kontext.ich && z.kontext.ich.name) || 'Du' };
  const S = { entwurf, stufe, gruppe, ich, gebaut, leiter: null, ansicht: null, online: null, einladenOffen: gruppe };
  z.spiel = S;
  z.ansicht = 'spiel';
  const wurzel = h('div', { class: 'spiel-wurzel' });
  const leiste = gruppe ? h('div', { class: 'host-leiste' }) : null;
  const einladen = gruppe ? h('div', { class: 'einladen' }) : null;
  app.replaceChildren(h('div', { class: 'spiel-huelle' + (gruppe ? ' gruppe' : '') }, leiste, wurzel, einladen));

  const senden = (d, an, gebuendelt) => {
    if (!an) {
      if (S.ansicht) S.ansicht.empfangen(d);
      if (S.online) { if (gebuendelt) S.online.stand(d); else S.online.anAlle(d); }
    } else if (an === ich.id) {
      if (S.ansicht) S.ansicht.empfangen(d);
    } else if (S.online) {
      const p = S.online.teilnehmer.get(an);
      if (p) S.online.anEinen(p, d);
    }
  };
  S.leiter = ClavisLeiter.erstellen(gebaut, { senden, beiEnde: (erg) => ergebnisSichern(entwurf, stufe, erg) });
  S.ansicht = Clavis.Spiel.erstellen(wurzel, {
    senden: (d) => S.leiter.eingang(ich, d),
    ich,
    host: { starten: () => { S.leiter.starten(); S.einladenOffen = false; leisteMalen(); }, beenden: spielVerlassen, fertig: spielFertig },
  });
  if (gruppe) {
    S.online = LyraOnline.runde({
      typ: TYP,
      seitenTitel: () => gebaut.oeffentlich.titel,
      teilen: () => ({ titel: `Clavis: ${gebaut.oeffentlich.titel}`, beschreibung: 'Escape Room – öffnen und mitspielen', daten: { raum: entwurf.id, stufe, titel: gebaut.oeffentlich.titel } }),
      neuZeichnen: leisteMalen,
      beiDazu: (p) => S.leiter.dazu(p),
      beiWeg: (p) => S.leiter.weg(p),
      beiNachricht: (p, d) => S.leiter.eingang(p, d),
      beiCampus: () => S.online.anAlle({ typ: 'hallo' }),
      max: 12,
    });
    if (campus && z.kontext) { S.online.campusUebernehmen(z.kontext); S.online.anAlle({ typ: 'hallo' }); }
    S.online.oeffnen({ titel: gebaut.oeffentlich.titel });
  }
  S.leiter.dazu(ich);

  function leisteMalen() {
    if (!gruppe || z.spiel !== S) return;
    const n = S.online.aktiv().length;
    leiste.replaceChildren(
      h('span', { class: 'host-punkt' }), h('b', {}, 'Team-Spiel'), h('span', { class: 'leise' }, `${n + 1} dabei`),
      h('span', { class: 'wachsen' }),
      h('button', { class: 'knopf tonal klein', onclick: () => { S.einladenOffen = !S.einladenOffen; leisteMalen(); } }, S.einladenOffen ? 'Einladen schließen' : 'Einladen'));
    einladen.classList.toggle('offen', S.einladenOffen);
    einladen.replaceChildren(
      h('div', { class: 'zeile' }, h('h3', { class: 'wachsen' }, 'Mitspielende einladen'), h('button', { class: 'knopf text klein', onclick: () => { S.einladenOffen = false; leisteMalen(); } }, '✕')),
      S.online.beitritt({ campusText: 'Teile den Raum in einen Campus-Raum – die Mitglieder spielen mit ihrer Lyra mit.' }),
      h('div', { class: 'einladen-team' }, h('div', { class: 'leise klein' }, 'Im Team'), S.online.chips('Noch niemand da – teile den Link oder QR-Code.')),
      h('p', { class: 'leise klein' }, 'Alle sehen denselben Raum. Zettel zu manchen Rätseln bekommt jeweils nur eine Person – redet miteinander!'));
  }
  leisteMalen();
}

async function spielVerlassen() {
  const S = z.spiel;
  if (!S) return;
  if (S.leiter.ende) return spielFertig();
  const wahl = await lyra.dialog('Spiel beenden?', h('p', { class: 'leise', style: { maxWidth: '420px', lineHeight: 1.5 } },
    S.leiter.phase === 'lobby' ? 'Das Spiel hat noch nicht begonnen.' : 'Beim Aufgeben zeigt Clavis allen das Lösungswort. Beim Verlassen endet das Spiel ohne Auflösung.'),
  [{ text: 'Weiterspielen', art: 'text', wert: null }, S.leiter.phase === 'lobby' ? null : { text: 'Aufgeben', art: 'tonal', wert: 'aufgeben' }, { text: 'Verlassen', wert: 'verlassen' }].filter(Boolean));
  if (!wahl || z.spiel !== S) return;
  if (wahl === 'aufgeben') { S.leiter.beenden(false); return; }
  spielFertig();
}

async function spielFertig() {
  const S = z.spiel;
  if (!S) return;
  S.leiter.stoppen();
  if (S.online) await S.online.beenden({ typ: 'vorbei' });
  Clavis.klang.atmoStoppen();
  z.spiel = null;
  z.ansicht = S.entwurf.ki || !S.entwurf.id.startsWith('v-') ? 'raum' : 'start';
  z.entwurf = z.ansicht === 'raum' ? S.entwurf : null;
  z.editorOffen = false;
  zeichnen();
}

async function ergebnisSichern(entwurf, stufe, erg) {
  if (!erg.geschafft) return;
  const alt = z.ergebnisse[entwurf.id];
  const neu = { zeit: erg.zeit, sterne: erg.sterne, stufe, datum: lyra.jetzt() };
  if (!alt || erg.sterne > alt.sterne || (erg.sterne === alt.sterne && erg.zeit < alt.zeit)) {
    z.ergebnisse[entwurf.id] = neu;
    try { await lyra.speicher.schreiben('ergebnisse', z.ergebnisse); } catch (_) {}
  }
}

// ================================================================== Mitspielen in Lyra (aus einem Campus-Raum)

async function mitmachen(k) {
  z.ansicht = 'mitmachen';
  app.replaceChildren();
  await LyraOnline.mitmachen(k, {
    wurzel: app,
    was: 'Deine Züge im Escape Room',
    erstellen: (w, { senden, ich }) => Clavis.Spiel.erstellen(w, { senden, ich }),
  });
}

// ================================================================== Ansichten

function zeichnen() {
  if (z.ansicht === 'spiel' || z.ansicht === 'mitmachen') return;
  const ansicht = { start: startAnsicht, bauen: bauenAnsicht, raum: raumAnsicht }[z.ansicht] || startAnsicht;
  const scroll = app.scrollTop;
  app.replaceChildren(h('div', { class: 'buehne' }, ansicht()));
  if (z.ansicht === 'raum') app.scrollTop = scroll;
}

const zeitText = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function cover(welt, gross = false) {
  return h('div', { class: 'cover' + (gross ? ' gross' : ''), 'data-welt': welt },
    h('div', { class: 'cover-licht' }), Clavis.icon((Clavis.WELTEN[welt] || {}).objekte ? Clavis.WELTEN[welt].objekte[0] : 'truhe', 'cover-icon'),
    h('span', { class: 'cover-welt' }, (Clavis.WELTEN[welt] || {}).name || ''));
}

function stufenWahl(id, standard) {
  const w = z.wahl[id] || standard || 'mittel';
  return h('div', { class: 'stufen' }, Object.entries(Clavis.STUFEN).map(([k, s]) => h('button', { class: 'stufe' + (w === k ? ' an' : ''), title: `${s.beschreibung} · ${s.minuten} Min.`, onclick: (e) => { e.stopPropagation(); z.wahl[id] = k; zeichnen(); } }, s.name)));
}

function stimmungChips(e) {
  const alter = Clavis.ALTER[e.alter] ? e.alter : 'ab14';
  const st = Clavis.stimmungAus(e.stimmung, alter);
  const schreck = Clavis.ALTER[alter].schreck && (e.jumpscares === true || (e.jumpscares !== false && st.grusel >= 7));
  return h('div', { class: 'stimmung-chips' }, h('span', { class: 'alter-chip ' + alter }, Clavis.ALTER[alter].name), schreck ? h('span', { class: 'schreck-chip' }, '⚡') : null,
    Object.entries(Clavis.STIMMUNG).map(([k, x]) => h('span', { class: 'stimmung-chip ' + k, title: Clavis.stimmungText(k, st[k]) }, x.name, h('i', { style: { '--w': `${st[k] * 10}%` } }))));
}

function raumKarte(e) {
  const stufe = z.wahl[e.id] || e.empfohlen || e.stufe || 'mittel';
  const best = z.ergebnisse[e.id];
  const n = e.szenen.reduce((a, s) => a + s.stationen.filter((x) => !x.ab || ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 }[x.ab] <= { leicht: 0, mittel: 1, schwer: 2, experte: 3 }[stufe])).length, 0);
  return h('div', { class: 'raum-karte' },
    cover(e.welt),
    h('div', { class: 'raum-inhalt' },
      h('div', { class: 'raum-titel' }, e.titel),
      h('p', { class: 'leise klein raum-teaser' }, e.anriss || e.intro.slice(0, 140) + (e.intro.length > 140 ? ' …' : '')),
      h('div', { class: 'raum-meta leise klein' }, `${n} Rätsel · ${Clavis.STUFEN[stufe].minuten} Min.${e.spieler ? ` · ${e.spieler} Personen` : ''}${best ? ` · Bestzeit ${zeitText(best.zeit)} ${'★'.repeat(best.sterne)}` : ''}`),
      stimmungChips(e),
      stufenWahl(e.id, e.empfohlen || e.stufe),
      h('div', { class: 'zeile', style: { gap: '8px', marginTop: '10px' } },
        h('button', { class: 'knopf', onclick: () => spielen(e, stufe, false) }, 'Allein spielen'),
        h('button', { class: 'knopf tonal', onclick: () => spielen(e, stufe, true) }, 'Im Team'))));
}

function startAnsicht() {
  const k = z.kontext;
  return [
    h('div', { class: 'held' },
      h('div', { class: 'held-schluessel' }, Clavis.icon('schluessel')),
      h('h1', { class: 'held-titel' }, 'Clavis'),
      h('p', { class: 'held-text' }, 'Escape Rooms zum Rätseln und Lernen – allein oder im Team. Fertige Räume, von der KI gebaute oder deine eigenen.')),
    k && k.inhalt && k.inhalt.typ === TYP ? h('div', { class: 'hinweis-band' }, `Aus „${k.raum.name}“ geöffnet: Wähle einen Raum und „Im Team“ – die Mitglieder spielen mit ihrer Lyra mit.`) : null,
    h('div', { class: 'zeile zwischen-zeile' }, h('h2', { class: 'wachsen', style: { margin: 0 } }, 'Fertige Räume'),
      h('label', { class: 'schreck-schalter klein' }, h('input', { type: 'checkbox', checked: z.einst.schreckErlaubt !== false, onchange: (e) => { z.einst.schreckErlaubt = e.target.checked; lyra.speicher.schreiben('einstellungen', z.einst).catch(() => {}); } }), h('span', {}, '⚡ Jumpscares erlauben'))),
    h('div', { class: 'raum-raster' }, CLAVIS_VORLAGEN.map(raumKarte)),
    h('h2', { class: 'zwischen' }, 'Einen Raum bauen lassen'),
    h('div', { class: 'panel' },
      h('div', { class: 'zeile', style: { gap: '10px' } },
        h('input', { class: 'eingabe wachsen', placeholder: 'Thema oder Lernstoff (optional), z. B. „Zellbiologie“ – leer: freies Abenteuer', value: z.thema,
          oninput: (e) => { z.thema = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') bauenMitKi(); } }),
        h('button', { class: 'knopf', onclick: bauenMitKi }, 'Raum bauen')),
      h('div', { class: 'welten' }, Object.entries(Clavis.WELTEN).filter(([k2]) => alterErlaubt(k2, z.einst.alter)).map(([k2, w]) => h('button', {
        class: 'welt-wahl' + (z.einst.welt === k2 ? ' an' : ''), 'data-welt': k2, title: w.kurz,
        onclick: () => { z.einst.welt = k2; zeichnen(); },
      }, Clavis.icon(w.objekte[0]), h('span', {}, z.einst.alter === 'kinder' && w.kinderName ? w.kinderName : w.name)))),
      h('p', { class: 'leise klein welt-kurz' }, Clavis.WELTEN[z.einst.welt].kurz),
      alterWahl(z.einst, () => { z.einst.stimmung = Clavis.stimmungAus(z.einst.stimmung, z.einst.alter); if (Clavis.WELTEN[z.einst.welt].ab && !alterErlaubt(z.einst.welt, z.einst.alter)) z.einst.welt = 'krimi'; zeichnen(); }),
      stimmungsRegler(z.einst.stimmung, () => lyra.speicher.schreiben('einstellungen', z.einst).catch(() => {}), z.einst.alter),
      h('div', { class: 'zeile umbruch', style: { gap: '8px', marginTop: '10px' } },
        lyra.auswahl({ titel: 'Schwierigkeit', optionen: Object.entries(Clavis.STUFEN).map(([k2, s]) => [k2, s.name, `${s.stationen} Rätsel, ${s.minuten} Min. – ${s.beschreibung}`]), wert: z.einst.stufe, beiWahl: (w) => { z.einst.stufe = w; zeichnen(); } }),
        lyra.auswahl({ titel: 'Woraus', optionen: [['beides', 'Unterlagen + Wissen'], ['unterlagen', 'Nur Unterlagen'], ['wissen', 'Allgemeinwissen']], wert: z.einst.quelle, beiWahl: (w) => { z.einst.quelle = w; zeichnen(); } }),
        z.info ? lyra.lehrerWahl(z.info, z.lehrer, (l) => { z.lehrer = l; zeichnen(); }) : null),
      z.fehler ? h('div', { style: { marginTop: '12px' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
      h('p', { class: 'leise klein', style: { marginTop: '10px' } }, 'Die KI schreibt Geschichte und Inhalte; Clavis baut daraus lösbare Rätsel aus über 20 Mechaniken. Die Lösungen siehst du nicht – du kannst gleich mitspielen.')),
    h('div', { class: 'zeile', style: { marginTop: '28px' } },
      h('h2', { class: 'wachsen', style: { margin: 0 } }, 'Deine Räume'),
      h('button', { class: 'knopf tonal', onclick: selbstBauen }, '+ Selbst bauen')),
    z.raeume.length ? h('div', { class: 'raum-raster', style: { marginTop: '10px' } }, z.raeume.map((e) => h('div', { class: 'raum-karte klickbar', onclick: () => { z.entwurf = e; z.editorOffen = false; z.ansicht = 'raum'; zeichnen(); } },
      cover(e.welt),
      h('div', { class: 'raum-inhalt' },
        h('div', { class: 'raum-titel' }, e.titel),
        h('p', { class: 'leise klein raum-teaser' }, e.thema ? `Thema: ${e.thema}` : (e.intro || '').slice(0, 120)),
        h('div', { class: 'raum-meta leise klein' }, `${e.szenen.reduce((a, s) => a + s.stationen.length, 0)} Rätsel · ${e.ki ? 'von der KI' : 'selbst gebaut'}${z.ergebnisse[e.id] ? ` · ${'★'.repeat(z.ergebnisse[e.id].sterne)}` : ''}`)))))
      : h('p', { class: 'leise', style: { marginTop: '8px' } }, 'Noch keine eigenen Räume – lass oben einen bauen oder bau selbst einen.'),
  ];
}

function bauenAnsicht() {
  const w = Clavis.WELTEN[z.einst.welt] || {};
  return h('div', { class: 'bauen', 'data-welt': z.einst.welt },
    h('div', { class: 'held-schluessel drehen' }, Clavis.icon('schluessel')),
    h('h2', {}, 'Der Raum wird gebaut …'),
    h('p', { class: 'leise' }, `${w.name}: ${w.kurz}`),
    h('p', { class: 'leise klein', id: 'hinweis' }, z.hinweis),
    h('button', { class: 'knopf text', onclick: () => lyra.abbrechen() }, 'Abbrechen'));
}

// ---------------------------------------------------------------- Ein eigener Raum (ohne Lösungen) und Editor

function raumAnsicht() {
  const e = z.entwurf;
  const stufe = z.wahl[e.id] || e.stufe || 'mittel';
  const kopf = [
    h('div', { class: 'zeile', style: { gap: '10px', marginBottom: '14px' } },
      h('button', { class: 'knopf tonal', onclick: () => { z.ansicht = 'start'; z.entwurf = null; z.editorOffen = false; zeichnen(); } }, '←'),
      h('div', { class: 'wachsen' }),
      !z.editorOffen ? h('button', { class: 'knopf text', onclick: editorOeffnen }, 'Bearbeiten (zeigt Lösungen)') : null,
      h('button', { class: 'knopf text', title: 'Löschen', onclick: raumLoeschen }, '✕')),
    h('div', { class: 'raum-held' },
      cover(e.welt, true),
      h('div', { class: 'raum-inhalt' },
        h('div', { class: 'leise klein' }, `${(Clavis.WELTEN[e.welt] || {}).name} · ${e.ki ? 'von der KI gebaut' : 'selbst gebaut'}${e.thema ? ` · Thema: ${e.thema}` : ''}`),
        h('h1', { class: 'raum-gross-titel' }, e.titel),
        h('p', { class: 'raum-intro' }, e.intro),
        stimmungChips(e),
        stufenWahl(e.id, e.stufe),
        h('div', { class: 'zeile', style: { gap: '8px', marginTop: '12px' } },
          h('button', { class: 'knopf', onclick: () => spielen(e, stufe, false) }, 'Allein spielen'),
          h('button', { class: 'knopf tonal', onclick: () => spielen(e, stufe, true) }, 'Im Team')),
        e.ersetzt ? h('p', { class: 'leise klein', style: { marginTop: '10px' } }, `${e.ersetzt} Rätsel ${e.ersetzt === 1 ? 'hatte' : 'hatten'} unbrauchbare Inhalte – Clavis setzt dort selbstgebaute Rätsel ein.`) : null)),
  ];
  if (!z.editorOffen) {
    return [...kopf,
      h('h2', { class: 'zwischen' }, 'Was dich erwartet'),
      h('div', { class: 'szenen-vorschau' }, e.szenen.map((s, i) => h('div', { class: 'panel' },
        h('div', { class: 'leise klein' }, `Szene ${i + 1}`), h('h3', {}, s.titel || `Szene ${i + 1}`), s.text ? h('p', { class: 'leise' }, s.text) : null,
        h('div', { class: 'orte' }, s.stationen.map((x) => h('span', { class: 'ort-chip' }, Clavis.icon(Clavis.ICONS[x.symbol] ? x.symbol : 'truhe', 'mini'), x.ort || '?')))))),
      h('p', { class: 'leise klein', style: { marginTop: '12px' } }, 'Die Rätsel und Lösungen bleiben verborgen, damit du selbst mitspielen kannst.')];
  }
  return [...kopf, editorAnsicht(e)];
}

async function editorOeffnen() {
  const ok = await lyra.bestaetigen({ titel: 'Lösungen anzeigen?', text: 'Im Editor siehst du alle Rätsel mit ihren Lösungen. Wenn du den Raum selbst noch spielen willst, spiel ihn lieber zuerst.', ja: 'Editor öffnen', nein: 'Abbrechen' });
  if (!ok) return;
  z.editorOffen = true;
  zeichnen();
}

async function raumLoeschen() {
  const e = z.entwurf;
  const ok = await lyra.bestaetigen({ titel: `„${e.titel}“ löschen?`, text: 'Der Raum verschwindet mit allen Rätseln.', ja: 'Löschen', gefahr: true });
  if (!ok) return;
  try { await lyra.speicher.loeschen('raum/' + e.id); } catch (_) {}
  z.raeume = z.raeume.filter((x) => x.id !== e.id);
  z.entwurf = null;
  z.ansicht = 'start';
  zeichnen();
}

function selbstBauen() {
  const w = z.einst.welt;
  const e = {
    id: lyra.neueId(), welt: w, titel: 'Mein Escape Room', stufe: 'mittel', ki: false, erstellt: lyra.jetzt(), alter: z.einst.alter, jumpscares: z.einst.jumpscares, stimmung: { ...z.einst.stimmung },
    intro: 'Die Tür fällt hinter dir ins Schloss. Du hast nicht viel Zeit.', outro: 'Die Tür springt auf – du bist frei!', finaleText: '', loesungswort: 'FREI',
    szenen: [{ titel: 'Der erste Raum', text: '', stationen: [
      { ort: 'Truhe', symbol: 'truhe', titel: 'Die verschlossene Truhe', text: 'Eine alte Truhe mit Zahlenschloss.', mech: 'zahlenschloss', inhalt: {}, hinweise: [] },
      { ort: 'Schalttafel', symbol: 'schaltkasten', titel: 'Licht an', text: 'Ein Feld aus Lampen.', mech: 'schalter', inhalt: {}, hinweise: [] },
    ] }],
  };
  raumSichern(e);
  z.entwurf = e;
  z.editorOffen = true;
  z.ansicht = 'raum';
  zeichnen();
}

function editorAnsicht(e) {
  const sichern = () => raumSichern(e);
  const feld = (wert, platz, aendern, extra = {}) => h('input', { class: 'eingabe', value: wert || '', placeholder: platz, oninput: (ev) => aendern(ev.target.value), onchange: sichern, ...extra });
  const flaeche = (wert, platz, aendern, zeilen = 3) => h('textarea', { class: 'eingabe', rows: zeilen, placeholder: platz, oninput: (ev) => aendern(ev.target.value), onchange: sichern }, wert || '');
  let probe = null;
  try { probe = ClavisLeiter.bauen(e, z.wahl[e.id] || e.stufe || 'mittel', 7); } catch (err) { probe = { fehler: meldung(err), ersetzt: [] }; }
  return h('div', { class: 'editor' },
    h('h2', { class: 'zwischen' }, 'Raum bearbeiten'),
    h('div', { class: 'panel spalte' },
      h('div', { class: 'zeile', style: { gap: '8px' } },
        feld(e.titel, 'Titel', (v) => { e.titel = v; }, { class: 'eingabe wachsen titel-eingabe' }),
        lyra.auswahl({ titel: 'Welt', optionen: Object.entries(Clavis.WELTEN).map(([k, w]) => [k, w.name, w.kurz]), wert: e.welt, beiWahl: (w) => { e.welt = w; sichern(); zeichnen(); } })),
      h('label', { class: 'leise klein' }, 'Stimmung – prägt Überraschungen, Fallen, Bilder und Klang'),
      alterWahl(e, () => { e.stimmung = Clavis.stimmungAus(e.stimmung, e.alter); sichern(); zeichnen(); }),
      stimmungsRegler((e.stimmung = Clavis.stimmungAus(e.stimmung, e.alter || 'ab14')), sichern, e.alter || 'ab14'),
      h('label', { class: 'leise klein' }, 'Kino-Intro: kurze Teaser-Sätze (einer je Zeile, optional)'), flaeche((e.teaser || []).join('\n'), 'Hamburg, 1952.\nEin Diamant verschwindet.\nDie Tür fällt ins Schloss.', (v) => { e.teaser = v.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5); }, 3),
      h('label', { class: 'leise klein' }, 'Einleitung (die Lage)'), flaeche(e.intro, 'Warum bist du hier, warum ist die Tür zu?', (v) => { e.intro = v; }),
      h('label', { class: 'leise klein' }, 'Ende (wie du entkommst)'), flaeche(e.outro, 'Die Tür springt auf …', (v) => { e.outro = v; }, 2),
      h('div', { class: 'zeile', style: { gap: '8px' } },
        h('div', { class: 'wachsen spalte', style: { gap: '4px' } }, h('label', { class: 'leise klein' }, 'Lösungswort für den Ausgang (die Rätsel verraten es Buchstabe für Buchstabe)'), feld(e.loesungswort, 'z. B. FREIHEIT', (v) => { e.loesungswort = v; })),
        h('div', { class: 'wachsen spalte', style: { gap: '4px' } }, h('label', { class: 'leise klein' }, 'Text an der Ausgangstür (optional)'), feld(e.finaleText, 'Die Tür hat ein Buchstabenschloss …', (v) => { e.finaleText = v; })))),
    probe && probe.fehler ? h('div', { class: 'hinweis-band fehler' }, probe.fehler) : null,
    probe && probe.ersetzt && probe.ersetzt.length ? h('div', { class: 'hinweis-band' }, `Noch unvollständig: ${probe.ersetzt.map((x) => `„${x.ort}“ (${M[x.von] ? M[x.von].name : x.von})`).join(', ')} – dort setzt Clavis beim Spielen ein selbstgebautes Rätsel ein.`) : null,
    e.szenen.map((s, si) => h('div', { class: 'panel szene-editor' },
      h('div', { class: 'zeile', style: { gap: '8px' } },
        h('span', { class: 'nr' }, String(si + 1)),
        feld(s.titel, 'Name der Szene', (v) => { s.titel = v; }, { class: 'eingabe wachsen fett' }),
        e.szenen.length > 1 ? h('button', { class: 'knopf text', title: 'Szene löschen', onclick: () => { e.szenen.splice(si, 1); sichern(); zeichnen(); } }, '✕') : null),
      feld(s.text, 'Was man beim Betreten sieht (optional)', (v) => { s.text = v; }),
      h('div', { class: 'liste' }, s.stationen.map((x, xi) => h('div', { class: 'station-zeile', onclick: () => stationBearbeiten(s, xi) },
        h('div', { class: 'station-symbol' }, Clavis.icon(Clavis.ICONS[x.symbol] ? x.symbol : 'truhe')),
        h('div', { class: 'wachsen', style: { minWidth: '0' } },
          h('div', { class: 'fett' }, x.ort || '?', x.tuer ? h('span', { class: 'marke' }, 'öffnet den Weg') : null, x.ereignis ? h('span', { class: 'marke' }, (Clavis.EREIGNISSE[x.ereignis.art] || {}).name || '') : null),
          h('div', { class: 'leise klein' }, `${M[x.mech] ? M[x.mech].name : '?'} · ${loesungKurz(x)}`)),
        h('button', { class: 'knopf text klein', onclick: (ev) => { ev.stopPropagation(); s.stationen.splice(xi, 1); sichern(); zeichnen(); } }, '✕')))),
      h('button', { class: 'knopf tonal klein', onclick: () => stationBearbeiten(s, null) }, '+ Rätsel'))),
    h('button', { class: 'knopf tonal', onclick: () => { e.szenen.push({ titel: `Raum ${e.szenen.length + 1}`, text: '', stationen: [] }); sichern(); zeichnen(); } }, '+ Szene'));
}

function loesungKurz(x) {
  const i = x.inhalt || {};
  const m = M[x.mech];
  if (!m) return '';
  if (!m.felder.length) return 'baut sich selbst';
  if (i.wort) return `Lösung: ${Clavis.norm(i.wort)}`;
  if (i.antwort) return `Passwort: ${Clavis.norm(i.antwort)}`;
  if (i.zahl !== undefined && i.zahl !== '') return `Lösung: ${i.zahl}`;
  if (i.zeit) return `Zeit: ${i.zeit}`;
  if (i.paare && i.paare.length) return `${i.paare.length} Paare`;
  if (i.reihe && i.reihe.length) return `${i.reihe.length} Elemente`;
  if (i.fragen && i.fragen.length) return `${i.fragen.length} Fragen`;
  if (i.frage && i.optionen) return `Antwort: ${i.optionen[i.richtig] || '?'}`;
  return m.ohneInhalt ? 'baut sich selbst' : 'Inhalt fehlt';
}

async function stationBearbeiten(szene, index) {
  const alt = index == null ? null : szene.stationen[index];
  const s = alt ? structuredClone(alt) : { ort: '', symbol: Clavis.WELTEN[z.entwurf.welt].objekte[0], titel: '', text: '', mech: 'wortschloss', inhalt: {}, hinweise: [], tuer: false, ereignis: null };
  s.inhalt = s.inhalt || {};
  const box = h('div', { class: 'spalte editor-dialog', style: { minWidth: '560px', gap: '10px' } });
  const malen = () => {
    const m = M[s.mech];
    const inhaltFelder = m.felder.map((f) => {
      const i = s.inhalt;
      let eing;
      if (f.art === 'paare') eing = h('textarea', { class: 'eingabe', rows: 5, placeholder: 'Ein Paar je Zeile: Begriff = Passendes', oninput: (ev) => { i.paare = ev.target.value.split('\n').map((z2) => z2.split('=')).filter((p) => p.length >= 2).map(([a, ...b]) => ({ links: a.trim(), rechts: b.join('=').trim() })); } }, (i.paare || []).map((p) => `${p.links} = ${p.rechts}`).join('\n'));
      else if (f.art === 'liste') eing = h('textarea', { class: 'eingabe', rows: 5, placeholder: f.k === 'reihe' ? 'Ein Element je Zeile, in der richtigen Reihenfolge' : 'Eine Antwort je Zeile', oninput: (ev) => { i[f.k] = ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }, (i[f.k] || []).join('\n'));
      else if (f.art === 'fragen') eing = h('textarea', { class: 'eingabe', rows: 6, placeholder: 'Eine Frage je Zeile: Frage? | richtige Antwort | falsch | falsch', oninput: (ev) => { i.fragen = ev.target.value.split('\n').map((z2) => z2.split('|').map((x) => x.trim())).filter((t) => t.length >= 3 && t[0]).map(([frage, ...opt]) => ({ frage, optionen: opt.filter(Boolean), richtig: 0 })); } }, (i.fragen || []).map((q) => [q.frage, q.optionen[q.richtig], ...q.optionen.filter((_, j) => j !== q.richtig)].join(' | ')).join('\n'));
      else if (f.art === 'text') eing = h('textarea', { class: 'eingabe', rows: 3, placeholder: f.titel, oninput: (ev) => { i[f.k] = ev.target.value; } }, i[f.k] || '');
      else if (f.k === 'richtig') eing = h('input', { class: 'eingabe', type: 'number', min: 0, max: 3, value: i.richtig ?? 0, oninput: (ev) => { i.richtig = Number(ev.target.value); } });
      else eing = h('input', { class: 'eingabe', value: i[f.k] ?? '', placeholder: f.titel, oninput: (ev) => { i[f.k] = ev.target.value; } });
      return h('label', { class: 'spalte', style: { gap: '4px' } }, h('span', { class: 'leise klein' }, f.titel), eing);
    });
    box.replaceChildren(
      lyra.auswahl({ titel: 'Rätsel', optionen: Object.entries(M).map(([k, x]) => [k, x.name, x.kurz]), wert: s.mech, beiWahl: (w) => { s.mech = w; malen(); }, breit: true }),
      h('p', { class: 'leise klein', style: { margin: 0 } }, m.kurz + (m.felder.length ? '' : ' Dieses Rätsel baut sich selbst – passend zur Schwierigkeit.')),
      h('div', { class: 'zeile', style: { gap: '8px' } },
        h('input', { class: 'eingabe wachsen', value: s.ort, placeholder: 'Ort im Raum, z. B. „Schreibtisch“', oninput: (ev) => { s.ort = ev.target.value; } }),
        lyra.auswahl({ titel: 'Symbol', optionen: Object.keys(Clavis.ICONS).map((k) => [k, k]), wert: s.symbol, beiWahl: (w) => { s.symbol = w; } })),
      h('input', { class: 'eingabe', value: s.titel, placeholder: 'Titel, z. B. „Die verschlossene Schublade“', oninput: (ev) => { s.titel = ev.target.value; } }),
      h('textarea', { class: 'eingabe', rows: 2, placeholder: 'Was man dort sieht (1–2 Sätze)', oninput: (ev) => { s.text = ev.target.value; } }, s.text || ''),
      ...inhaltFelder,
      h('textarea', { class: 'eingabe', rows: 2, placeholder: 'Eigene Hinweise (optional, einer je Zeile)', oninput: (ev) => { s.hinweise = ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 2); } }, (s.hinweise || []).join('\n')),
      h('div', { class: 'zeile', style: { gap: '8px' } },
        h('label', { class: 'zeile', style: { gap: '6px' } }, h('input', { type: 'checkbox', checked: !!s.tuer, onchange: (ev) => { s.tuer = ev.target.checked; } }), 'Öffnet den Weg zur nächsten Szene'),
        h('span', { class: 'wachsen' }),
        lyra.auswahl({ titel: 'Überraschung', optionen: [['keine', 'Keine']].concat(Object.entries(Clavis.EREIGNISSE).map(([k, x]) => [k, x.name, x.text])), wert: s.ereignis ? s.ereignis.art : 'keine', beiWahl: (w) => { s.ereignis = w === 'keine' ? null : { art: w, text: (s.ereignis && s.ereignis.text) || '' }; malen(); } })),
      s.ereignis ? h('input', { class: 'eingabe', value: s.ereignis.text || '', placeholder: `Text der Überraschung (sonst: „${Clavis.EREIGNISSE[s.ereignis.art].text}“)`, oninput: (ev) => { s.ereignis.text = ev.target.value; } }) : null);
  };
  malen();
  const ok = await lyra.dialog(alt ? 'Rätsel bearbeiten' : 'Neues Rätsel', box, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Übernehmen', wert: true }]);
  if (!ok) return;
  if (!s.ort.trim()) s.ort = M[s.mech].name;
  if (alt) szene.stationen[index] = s; else szene.stationen.push(s);
  await raumSichern(z.entwurf);
  zeichnen();
}

start();
