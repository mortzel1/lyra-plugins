'use strict';
/*
 * Lyra Campus für Plugins (Recht „campus“) – derselbe kleine Baustein in Deep Dive, Flip und Vertex.
 * Das Plugin selbst hat kein Netz: Lyra leitet weiter, Ende-zu-Ende-verschlüsselt, und fragt vor dem Teilen nach.
 *  - Campus.teilen(…): Material oder Aufgabe (mit Frist, auf Wunsch Pflicht) in einen Raum teilen
 *  - Campus.kontext(): Ist das Plugin aus einem Raum geöffnet? Dann {raum, rolle, host, ich, inhalt}
 *  - Campus.melden(daten): Fortschritt an Host und Co-Hosts (nur bei Aufgaben; höchstens alle 20 s)
 *  - Campus.fortschrittDialog(titel, spalten, zeile): Übersicht für Hosts, wer wie weit ist
 */
const Campus = (() => {
  const hh = (...a) => lyra.h(...a);
  let letzte = 0, wartend = null, plan = null;

  async function teilen({ titel, typ, daten, beschreibung = '', arten = ['material', 'aufgabe'] }) {
    let raeume = [];
    try {
      raeume = await lyra.campus.raeume();
    } catch (e) {
      lyra.toast(String((e && e.message) || e), 'fehler');
      return null;
    }
    if (!raeume.length) {
      await lyra.dialog('Noch kein Raum',
        hh('p', { class: 'leise', style: { lineHeight: 1.5, maxWidth: '420px' } },
          'Öffne in Lyra „Campus“ (das Personen-Symbol neben dem Eingabefeld), melde dich an und erstelle oder betritt einen Raum – dann kannst du hier teilen.'),
        [{ text: 'OK', wert: true }]);
      return null;
    }
    const wahl = { raum: (raeume.find((r) => r.host) || raeume[0]).id, modus: arten[0], frist: '', pflicht: false };
    const box = hh('div', { class: 'spalte', style: { minWidth: '420px', gap: '14px' } });
    const malen = () => {
      const r = raeume.find((x) => x.id === wahl.raum);
      const optionen = [
        ['material', '📚 Material', 'Zum Lernen und Nachschlagen – ohne Abgabe'],
        ['aufgabe', '📝 Aufgabe', 'Mit Frist; der Fortschritt geht verschlüsselt an Host und Co-Hosts'],
      ].filter(([w]) => arten.includes(w));
      box.replaceChildren(...[
        hh('div', { class: 'zeile umbruch' },
          lyra.auswahl({ titel: 'Raum', symbol: '👥', optionen: raeume.map((x) => [x.id, x.name, `${x.mitglieder} Mitglieder${x.host ? ' · du bist Host' : ''}`]), wert: wahl.raum, beiWahl: (w) => { wahl.raum = w; malen(); }, breit: true }),
          optionen.length > 1 ? lyra.auswahl({ titel: 'Als', optionen, wert: wahl.modus, beiWahl: (w) => { wahl.modus = w; malen(); }, breit: true }) : null),
        wahl.modus === 'aufgabe'
          ? hh('label', { class: 'zeile', style: { gap: '8px' } }, hh('span', { class: 'leise' }, 'Bis (optional)'),
            hh('input', { type: 'date', class: 'eingabe', value: wahl.frist, oninput: (e) => { wahl.frist = e.target.value; } }))
          : null,
        wahl.modus === 'aufgabe'
          ? lyra.schalter({ wert: wahl.pflicht, beiWahl: (v) => { wahl.pflicht = v; }, text: 'Pflicht (Hausaufgabe)', unter: 'Steht bei allen unter „Abgaben“ – mit Frist auch auf Lyras Startseite.' })
          : null,
        hh('div', { class: 'leise klein', style: { lineHeight: 1.5 } },
          `Geht Ende-zu-Ende-verschlüsselt an ${r ? r.mitglieder : 'alle'} Mitglieder von „${r ? r.name : ''}“. Jede:r bekommt eine eigene Kopie – dein eigener Lernstand bleibt bei dir.`),
      ].filter(Boolean));
    };
    malen();
    const ok = await lyra.dialog(`„${titel}“ teilen`, box, [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Weiter', wert: true }]);
    if (!ok) return null;
    try {
      const r = await lyra.campus.teilen({
        raum: wahl.raum, typ, titel, daten, beschreibung, modus: wahl.modus,
        pflicht: wahl.modus === 'aufgabe' && wahl.pflicht,
        frist: wahl.frist ? new Date(wahl.frist + 'T23:59:00').getTime() : null,
      });
      lyra.toast('✓ Geteilt – im Raum unter „Aufgaben“', 'ok');
      return r;
    } catch (e) {
      const m = String((e && e.message) || e);
      if (!/ABGEBROCHEN/.test(m)) lyra.toast(m, 'fehler');
      return null;
    }
  }

  async function kontext(typ) {
    try {
      const k = await lyra.campus.kontext();
      return k && k.inhalt && (!typ || k.inhalt.typ === typ) ? k : null;
    } catch (_) {
      return null;
    }
  }

  /** Fortschritt an Host und Co-Hosts – gebündelt (höchstens alle 20 Sekunden), nur bei Aufgaben. */
  function melden(daten, sofort = false) {
    wartend = daten;
    const los = async () => {
      plan = null;
      if (!wartend) return;
      const d = wartend;
      wartend = null;
      letzte = Date.now();
      try { await lyra.campus.anHost(d, 'Deinen Fortschritt'); } catch (_) { /* abgelehnt oder offline – beim nächsten Mal */ }
    };
    if (sofort || Date.now() - letzte > 20000) return los();
    if (!plan) plan = setTimeout(los, 20000 - (Date.now() - letzte));
  }

  /** Übersicht für Hosts: wer wie weit ist (aus den verschlüsselten Rückmeldungen). */
  async function fortschrittDialog(titel, spalten, zeile) {
    let ein = [], mitglieder = [];
    try { ein = (await lyra.campus.eingaenge()) || []; } catch (_) {}
    try { mitglieder = ((await lyra.campus.mitglieder()) || []).filter((m) => !m.ich && m.rolle === 'mitglied'); } catch (_) {}
    const offen = mitglieder.filter((m) => !ein.some((e) => e.von === m.id));
    await lyra.dialog(titel, hh('div', { class: 'spalte', style: { minWidth: '480px', maxHeight: '60vh', overflow: 'auto' } },
      ein.length
        ? hh('table', { class: 'campus-tabelle' },
          hh('tr', {}, hh('th', {}, 'Name'), spalten.map((s) => hh('th', {}, s)), hh('th', {}, 'Zuletzt')),
          ein.map((e) => hh('tr', {}, hh('td', { class: 'fett' }, e.name), zeile(e.daten || {}).map((x) => hh('td', {}, x)), hh('td', { class: 'leise' }, lyra.zeitText(Math.floor((e.zeit || 0) / 1000))))))
        : hh('p', { class: 'leise' }, 'Noch keine Rückmeldungen. Sobald jemand damit arbeitet (aus dem Raum geöffnet), steht es hier – verschlüsselt, nur für dich.'),
      offen.length ? hh('p', { class: 'leise klein' }, `Noch nicht dabei: ${offen.map((m) => m.name).join(', ')}`) : null),
    [{ text: 'Schließen', wert: true }]);
  }

  return { teilen, kontext, melden, fortschrittDialog };
})();
