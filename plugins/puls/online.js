'use strict';
/*
 * Online-Baustein für Live-Plugins (Puls, Clavis …) – die Seite des Hosts in Lyra.
 * Mitmachen geht auf zwei Wegen, beide Ende-zu-Ende-verschlüsselt, Lyra fragt vorher:
 *   - per Link oder QR-Code im Browser, ohne Lyra und ohne Konto (Spielseite für Gäste über einen Cloudflare-Tunnel),
 *   - über Lyra Campus mit der eigenen Lyra (Live-Runde in einem Raum).
 * Plugins teilen keine Dateien: Jedes Plugin hat eine Kopie (Quelle: werkzeuge/online-baustein, verteilen.sh).
 *
 *   const runde = LyraOnline.runde({
 *     typ: 'puls',                                   // Inhaltstyp im Campus
 *     teilen: () => ({ titel, beschreibung, daten }), // was im Raum erscheint
 *     beiDazu(p), beiWeg(p), beiNachricht(p, daten, zeit), neuZeichnen(),
 *     max: 200, anonym: () => false,                  // anonym: Namen nirgends zeigen
 *   });
 *   runde.oeffnen({ titel })   Spielseite öffnen
 *   runde.campusTeilen()       Dialog: in einen Raum teilen
 *   runde.anAlle(d)            an alle sofort
 *   runde.stand(d)             Zwischenstand an alle – gebündelt (Gäste ≤ 2/s, Campus ≤ 1 je 3 s)
 *   runde.anEinen(p, d)        an eine Person (Campus: geht als Live-Nachricht mit „an“ an den Raum)
 *   runde.entfernen(p), runde.beenden()
 *   runde.aktiv() → [{id, name, quelle: 'link'|'campus', da}]
 *   runde.beitritt() → DOM mit QR-Code, Link und Campus-Knopf
 *   LyraOnline.mitmachen(kontext, { was, erstellen }) – in Lyra mitmachen (Campus-Mitglied)
 */
const LyraOnline = (() => {
  const { h } = lyra;
  const meldung = (e) => String((e && e.message) || e || '');
  const abgebrochen = (e) => /ABGEBROCHEN|Abgebrochen/.test(meldung(e));

  function runde(o) {
    const r = {
      teilnehmer: new Map(),
      gaeste: null, // {url, qr}
      gaesteFehler: '',
      gaesteLaedt: false,
      campus: null, // {raum: {id, name}}
      offen: true,
    };
    const neu = () => { try { o.neuZeichnen && o.neuZeichnen(); } catch (_) {} };
    const anonym = () => !!(o.anonym && o.anonym());

    r.aktiv = () => [...r.teilnehmer.values()].filter((p) => p.da);

    function dazu(id, name, quelle) {
      if (!id || !r.offen) return;
      let p = r.teilnehmer.get(id);
      if (!p) {
        if (r.teilnehmer.size >= (o.max || 200)) return;
        p = { id, name: String(name || 'Gast').slice(0, 24), quelle, da: true, seit: Date.now() };
        r.teilnehmer.set(id, p);
      } else {
        p.da = true;
      }
      try { o.beiDazu && o.beiDazu(p); } catch (e) { console.error(e); }
      neu();
    }

    function weg(id) {
      const p = r.teilnehmer.get(id);
      if (!p) return;
      p.da = false;
      try { o.beiWeg && o.beiWeg(p); } catch (e) { console.error(e); }
      neu();
    }

    function nachricht(id, daten, zeit) {
      const p = r.teilnehmer.get(id);
      if (!p || !daten || typeof daten !== 'object') return;
      if (daten.typ === 'name' && typeof daten.name === 'string') {
        p.name = daten.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || p.name;
        neu();
      }
      try { o.beiNachricht && o.beiNachricht(p, daten, zeit || Date.now()); } catch (e) { console.error(e); }
    }

    /** Signal „gaeste“ von Lyra */
    r.gastEreignis = (e) => {
      if (!e) return;
      if (e.art === 'beigetreten') dazu(e.id, e.name, 'link');
      else if (e.art === 'gegangen') weg(e.id);
      else if (e.art === 'nachricht') nachricht(e.id, e.daten || {}, e.zeit);
    };

    /** Signal „campus“ von Lyra (nur Rückmeldungen an dich als Host) */
    r.campusEreignis = (e) => {
      if (!e || !r.campus || e.art !== 'ergebnis') return;
      const d = e.daten || {};
      if (!r.teilnehmer.has(e.von) || d.typ === 'da') dazu(e.von, e.name, 'campus');
      if (d.typ !== 'da') nachricht(e.von, d, e.zeit);
    };

    r.oeffnen = async ({ titel = '' } = {}) => {
      if (r.gaeste || r.gaesteLaedt) return;
      r.gaesteLaedt = true;
      r.gaesteFehler = '';
      neu();
      try {
        const g = await lyra.gaeste.starten({ titel });
        if (!r.offen) { lyra.gaeste.beenden().catch(() => {}); return; }
        r.gaeste = g;
        for (const x of g.gaeste || []) dazu(x.id, x.name, 'link');
      } catch (e) {
        r.gaesteFehler = abgebrochen(e) ? 'Ohne Seite im Browser können nur Campus-Mitglieder mitmachen.' : meldung(e);
      }
      r.gaesteLaedt = false;
      neu();
    };

    r.campusTeilen = async () => {
      let raeume = [];
      try { raeume = await lyra.campus.raeume(); } catch (e) { return lyra.toast(meldung(e), 'fehler'); }
      if (!raeume.length) {
        return lyra.dialog('Noch kein Campus', h('p', { class: 'leise', style: { maxWidth: '420px', lineHeight: 1.5 } },
          'Melde dich in Lyra bei Campus an und tritt einem Campus bei – dann können seine Mitglieder mit ihrer Lyra mitmachen.'), [{ text: 'OK', wert: true }]);
      }
      let raum = raeume[0].id;
      const ok = await lyra.dialog('In einen Campus-Raum teilen', h('div', { class: 'spalte', style: { minWidth: '420px', gap: '12px' } },
        lyra.auswahl({ titel: 'Raum', symbol: '👥', optionen: raeume.map((x) => [x.id, x.name, `${x.mitglieder} Mitglieder`]), wert: raum, beiWahl: (w) => { raum = w; }, breit: true }),
        h('p', { class: 'leise klein', style: { lineHeight: 1.5 } }, 'Die Mitglieder öffnen die Live-Runde in ihrem Campus und machen mit ihrer Lyra mit – Ende-zu-Ende-verschlüsselt. Was sie schicken, geht nur an dich.')),
      [{ text: 'Abbrechen', art: 'text', wert: false }, { text: 'Teilen', wert: true }]);
      if (!ok || !r.offen) return;
      try {
        const t = o.teilen ? o.teilen() : {};
        await lyra.campus.teilen({ raum, typ: o.typ, modus: 'live', selbst: true, titel: t.titel || 'Live-Runde', beschreibung: t.beschreibung || '', daten: t.daten || {} });
        const k = await lyra.campus.kontext();
        if (k && k.raum) {
          r.campus = { raum: k.raum };
          lyra.toast(`✓ Live in „${k.raum.name}“ – die Mitglieder können jetzt mitmachen`, 'ok');
          if (o.beiCampus) o.beiCampus();
        }
      } catch (e) {
        if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
      }
      neu();
    };

    /** Aus einem Raum geöffnet und du leitest: Live-Runde läuft schon über diesen Raum. */
    r.campusUebernehmen = (k) => { if (k && k.raum) r.campus = { raum: k.raum }; };

    function campusLive(d) {
      if (!r.campus) return;
      lyra.campus.live(d).catch((e) => {
        if (abgebrochen(e)) { r.campus = null; lyra.toast('Campus-Mitglieder sind nicht dabei (ohne deine Zustimmung).', ''); neu(); }
      });
    }

    r.anAlle = (d, fuerGaeste) => {
      if (!r.offen) return;
      if (r.gaeste) lyra.gaeste.senden(fuerGaeste || d).catch(() => {});
      campusLive(d);
    };

    // Zwischenstände bündeln (je Art der Nachricht nur der neueste): Gäste höchstens alle 500 ms, Campus (jede Nachricht
    // landet im Raum) höchstens alle 3 s
    const buendel = { gaeste: { offen: new Map(), t: null, zuletzt: 0, ms: 500 }, campus: { offen: new Map(), t: null, zuletzt: 0, ms: 3000 } };
    function buendeln(kanal, d, senden) {
      const b = buendel[kanal];
      b.offen.set(d.typ || '', d);
      if (b.t) return;
      const warten = Math.max(0, b.zuletzt + b.ms - Date.now());
      b.t = setTimeout(() => {
        b.t = null;
        b.zuletzt = Date.now();
        const l = [...b.offen.values()];
        b.offen.clear();
        if (r.offen) l.forEach(senden);
      }, warten);
    }
    r.stand = (d, fuerGaeste) => {
      if (r.gaeste) buendeln('gaeste', fuerGaeste || d, (x) => lyra.gaeste.senden(x).catch(() => {}));
      if (r.campus) buendeln('campus', d, campusLive);
    };

    r.anEinen = (p, d) => {
      if (!p || !r.offen) return;
      if (p.quelle === 'link' && r.gaeste) lyra.gaeste.senden(d, p.id).catch(() => {});
      else if (p.quelle === 'campus') campusLive({ ...d, an: p.id });
    };

    r.entfernen = async (p) => {
      const ok = await lyra.bestaetigen({ titel: `${anonym() ? 'Diese Person' : p.name} entfernen?`, text: 'Die Person wird abgemeldet.', ja: 'Entfernen', gefahr: true });
      if (!ok) return;
      r.anEinen(p, { typ: 'entfernt' });
      if (p.quelle === 'link' && r.gaeste) lyra.gaeste.entfernen(p.id).catch(() => {});
      r.teilnehmer.delete(p.id);
      try { o.beiWeg && o.beiWeg(p, true); } catch (_) {}
      neu();
    };

    r.beenden = async (abschied = { typ: 'vorbei' }) => {
      if (!r.offen) return;
      try { if (abschied) r.anAlle(abschied); } catch (_) {}
      r.offen = false;
      for (const b of Object.values(buendel)) clearTimeout(b.t);
      if (r.gaeste) await new Promise((ok) => setTimeout(ok, 300));
      await lyra.gaeste.beenden().catch(() => {});
      r.gaeste = null;
      r.campus = null;
    };

    /** Beitritt: QR-Code (ganzes Quadrat), Link, Campus */
    r.beitritt = ({ campusText = 'Teile die Runde in einen Campus-Raum – die Mitglieder machen mit ihrer Lyra mit.' } = {}) => {
      const g = r.gaeste;
      return h('div', { class: 'lo-beitritt' },
        h('div', { class: 'lo-weg' },
          h('div', { class: 'lo-weg-titel' }, 'Link oder QR-Code'),
          h('div', { class: 'leise klein' }, 'Im Browser, von überall – ohne Lyra, ohne Konto.'),
          g ? h('div', { class: 'lo-portal' },
            g.qr ? h('img', { class: 'lo-qr', src: g.qr, alt: 'QR-Code zum Mitmachen' }) : null,
            h('div', { class: 'lo-link-zeile' },
              h('code', { class: 'lo-link' }, g.url.replace(/^https:\/\//, '').replace(/#.*$/, '#…')),
              h('button', { class: 'knopf tonal klein', onclick: () => lyra.kopieren(g.url) }, 'Kopieren')))
            : r.gaesteLaedt ? h('div', { class: 'leise lo-laedt' }, h('div', { class: 'lade' }), 'Seite wird geöffnet …')
              : h('div', { class: 'spalte', style: { gap: '8px', alignItems: 'flex-start', marginTop: '10px' } },
                r.gaesteFehler ? h('p', { class: 'fehler-text klein' }, r.gaesteFehler) : null,
                h('button', { class: 'knopf', onclick: () => r.oeffnen(o.seitenTitel ? { titel: o.seitenTitel() } : {}) }, 'Link öffnen'))),
        h('div', { class: 'lo-weg' },
          h('div', { class: 'lo-weg-titel' }, 'Lyra Campus'),
          r.campus
            ? h('div', { class: 'leise klein' }, `Live in „${r.campus.raum.name}“ – die Mitglieder öffnen die Runde im Campus.`)
            : [h('div', { class: 'leise klein' }, campusText),
              h('button', { class: 'knopf tonal', style: { marginTop: '10px' }, onclick: r.campusTeilen }, 'In einen Raum teilen …')]));
    };

    /** Chips der Teilnehmenden (Klick entfernt) – bei „anonym“ nur die Zahl */
    r.chips = (leer = 'Noch niemand da …') => {
      const l = r.aktiv();
      if (!l.length) return h('p', { class: 'leise lo-warten' }, leer);
      if (anonym()) return h('p', { class: 'leise' }, `${l.length} ${l.length === 1 ? 'Person' : 'Personen'} dabei – anonym`);
      return h('div', { class: 'lo-chips' }, l.map((p) => h('button', { class: 'lo-chip', title: 'Entfernen', onclick: () => r.entfernen(p) }, `${p.quelle === 'campus' ? '👥 ' : ''}${p.name}`)));
    };

    lyra.bei('gaeste', r.gastEreignis);
    lyra.bei('campus', r.campusEreignis);
    return r;
  }

  /** In Lyra mitmachen (aus einem Campus-Raum geöffnet, du leitest nicht). erstellen(wurzel, {senden, ich, daten}) → {empfangen} */
  async function mitmachen(k, { wurzel, was = 'Deine Beiträge in der Live-Runde', erstellen }) {
    const ich = { id: k.ich.id, name: k.ich.name };
    let ansicht = null;
    let zuletzt = 0;
    const senden = (d) => lyra.campus.anHost(d, was).catch((e) => {
      if (abgebrochen(e) && ansicht) ansicht.empfangen({ typ: 'vorbei' });
    });
    ansicht = erstellen(wurzel, { senden, ich, daten: (k.inhalt && k.inhalt.daten) || {}, inLyra: true });
    lyra.bei('campus', (e) => {
      if (!e || e.art !== 'live' || !e.daten) return;
      const d = e.daten;
      if (d.an && d.an !== ich.id) return;
      // Der Host öffnet (vielleicht erst nach dir): noch einmal „bin da“ – höchstens alle 5 s
      if ((d.typ === 'lobby' || d.typ === 'hallo') && Date.now() - zuletzt > 5000) { zuletzt = Date.now(); senden({ typ: 'da' }); }
      ansicht.empfangen(d);
    });
    try {
      zuletzt = Date.now();
      await lyra.campus.anHost({ typ: 'da' }, was);
    } catch (e) {
      ansicht.empfangen({ typ: 'vorbei' });
      if (!abgebrochen(e)) lyra.toast(meldung(e), 'fehler');
    }
    return ansicht;
  }

  return { runde, mitmachen, abgebrochen, meldung };
})();
