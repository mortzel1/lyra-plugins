'use strict';
/*
 * Clavis – die Spielansicht. Du stehst im Raum: ein Panorama mit Tiefe, in dem du dich umsiehst (Maus, Finger, Pfeiltasten).
 * Gegenstände stehen auf dem Boden, liegen auf Tischen, hängen an der Wand – ein Klick, und du gehst nah heran: das Rätsel
 * erscheint im Material des Gegenstands (Metall, Papier, Holz, Stein, Bildschirm, Glas). Gelöstes geht auf, Buchstaben fliegen
 * ins Lösungswort, Türen schwingen auf und du gehst hindurch. Ein Erzähler begleitet dich; jede Wendung sagt klar, was zu tun ist.
 * Dieselbe Ansicht in Lyra (allein oder als Host) und im Browser (Mitspielende). Sie kennt keine Lösungen.
 *
 *   const s = Clavis.Spiel.erstellen(wurzel, { senden, ich, host: { starten, beenden, fertig } | null });
 *   s.empfangen({ typ: 'raum' | 'stand' | 'zettel' | 'antwort' | 'geloest' | 'hinweis' | 'ereignis' | 'wendung' |
 *                 'wendung_ende' | 'schreck' | 'ende' | 'vorbei' | 'entfernt', … })
 */
(() => {
  const { el } = Clavis;
  const zeitText = (ms) => { const s = Math.max(0, Math.round(Math.abs(ms) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const TITEL_EFFEKT = { krimi: 'schreibmaschine', bibliothek: 'schreibmaschine', akademie: 'schreibmaschine', western: 'schreibmaschine', labor: 'glitch', station: 'glitch', unterwasser: 'glitch',
    spuk: 'flackern', sanatorium: 'flackern', grab: 'sand', dschungel: 'sand', pirat: 'sand', zirkus: 'huepfen', spielzeug: 'huepfen' };
  const GERAHMT = ['bild', 'portraet', 'wandbild', 'karte', 'tafel', 'spiegel'];
  const AUFGABE_SYMBOL = { tipp: '💡', buchstabe: '🔤', zeitplus: '⏳', geheimfach: '🗝', dunkel: '🔦', nebel: '🌫', countdown: '⏱', blockiert: '⛓', zeitminus: '⌛' };
  const hash = (t) => [...String(t)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

  function erstellen(wurzel, { senden, ich, host = null }) {
    const z = {
      raum: null, stand: null, szene: 0, offen: null, zettel: {}, notizen: [], kinoGesehen: false, introGesehen: false, vorbei: '', ende: null,
      wartend: new Map(), nr: 0, endeZeit: null, gesehenGeloest: new Set(), dunkelBis: 0, nebelBis: 0, countdownBis: null, schreckLokal: false, kinoTakte: [],
      pan: 0.5, panZiel: 0.5, panRichtung: 0, besucht: new Set(), geoeffnet: new Set(), markiert: new Map(), frisch: new Map(), erz: [], erzAktiv: false, erzTakt: null,
      letzterFortschritt: Date.now(), gerade: null, zuletztGemalteSzene: -1,
      spuren: {}, briefe: [], funde: {}, inventar: [], gefundenTeile: new Set(), zeitStufe: 0, lichtStand: {}, erzSeit: 0, bau: null,
    };
    const k = Clavis.klang;
    const spiel = el('div', { class: 'cl-spiel' });
    wurzel.replaceChildren(spiel);
    const kinder = () => z.raum && z.raum.alter === 'kinder';

    const anfrage = (d) => new Promise((ok) => {
      const nr = ++z.nr;
      z.wartend.set(nr, ok);
      Promise.resolve(senden({ ...d, nr })).catch(() => {});
      setTimeout(() => { if (z.wartend.has(nr)) { z.wartend.delete(nr); ok({ richtig: false, info: 'Keine Antwort vom Spielleiter – ist die Verbindung weg?' }); } }, 12000);
    });

    // ---------------------------------------------------------------- Bausteine
    const station = (id) => z.raum && z.raum.stationen[id];
    const geloest = (id) => !!(z.stand && z.stand.geloest && z.stand.geloest[id]);
    const szeneOffen = (i) => !!(z.stand && z.stand.szenen && z.stand.szenen[i]);
    const phase = () => (z.stand ? z.stand.phase : 'lobby');
    const blockiertMs = (id) => { const b = z.stand && z.stand.blockiert && z.stand.blockiert[id]; return b ? b - (Date.now() - (z.standZeit || Date.now())) : 0; };
    const imSpiel = () => phase() === 'spiel' && z.kinoGesehen && z.introGesehen && !z.ende;
    const stationenDerSzene = (i) => z.raum.szenen[i].stationen.concat((z.raum.bonus || []).filter((id) => z.stand && z.stand.sichtbar && z.stand.sichtbar[id] === i));

    function toast(text, art = '') {
      const t = el('div', { class: 'cl-toast ' + art }, text);
      spiel.append(t);
      setTimeout(() => t.classList.add('weg'), 3600);
      setTimeout(() => t.remove(), 4100);
    }

    // ---------------------------------------------------------------- Erzähler (Untertitel)
    // Der Erzähler spricht (Stimme des Geräts) – die Anzeige zeigt nur den Satz, der gerade gesprochen wird.
    // Ein Klick springt zur nächsten Zeile. Während einer Zwischenszene wartet er.
    const erzEl = el('div', { class: 'cl-erzaehler', onclick: () => { if (Date.now() - z.erzSeit > 1200) { Clavis.stimme.stopp(); naechsteZeile(); } } });
    const ERZ_SYMBOL = { telefon: '☎', funk: '📡', ereignis: '!', erfolg: '✓', warnung: '⚠', hilfe: '💡', fund: '✦', geschichte: '📖', geist: '👁' };
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    const rolleVon = (art) => (art === 'telefon' ? 'telefon' : art === 'funk' ? 'funk' : art === 'geist' ? 'geist' : kinder() ? 'kind' : 'erzaehler');
    z.erzNr = 0;
    function sagen(text, art = '') {
      if (!text) return;
      // Wer abnimmt, hört sofort zu – Anrufe und Funksprüche gehen vor
      if (art === 'telefon' || art === 'funk') { z.erz.unshift({ text, art }); Clavis.stimme.stopp(); naechsteZeile(); return; }
      z.erz.push({ text, art });
      if (z.erz.length > 6) z.erz.splice(0, z.erz.length - 6);
      if (!z.erzAktiv || (z.erzArt === 'hilfe' && art !== 'hilfe')) { if (z.erzAktiv) Clavis.stimme.stopp(); naechsteZeile(); }
    }
    function naechsteZeile() {
      clearTimeout(z.erzTakt);
      const nr = ++z.erzNr;
      const l = z.erz.shift();
      if (!l) { z.erzAktiv = false; erzEl.classList.remove('an'); return; }
      z.erzAktiv = true;
      z.erzArt = l.art;
      z.erzSeit = Date.now();
      const zeige = (satz) => {
        erzEl.className = 'cl-erzaehler an ' + l.art;
        erzEl.replaceChildren(...[ERZ_SYMBOL[l.art] ? el('b', { class: 'cl-erz-symbol' }, ERZ_SYMBOL[l.art]) : null, el('span', { class: 'cl-erz-text' }, satz), z.erz.length ? el('small', { class: 'cl-erz-mehr' }, `+${z.erz.length}`) : null].filter(Boolean));
      };
      (async () => {
        for (const satz of Clavis.stimme.saetze(l.text)) {
          while (Clavis.Szenen && Clavis.Szenen.aktiv() && nr === z.erzNr) await warte(300);
          if (nr !== z.erzNr) return;
          zeige(satz);
          const gesprochen = await Clavis.stimme.sprechen(satz, rolleVon(l.art));
          if (nr !== z.erzNr) return;
          await warte(gesprochen ? 350 : 1500 + satz.length * 50);
        }
        if (nr === z.erzNr) naechsteZeile();
      })();
    }

    // ---------------------------------------------------------------- Kopf, Ziel, Lösungswort
    function uhrText() {
      if (!z.stand || z.stand.phase === 'lobby' || z.endeZeit == null) return z.raum ? `${z.raum.minuten}:00` : '';
      const rest = z.endeZeit - Date.now();
      return rest >= 0 ? zeitText(rest) : '+' + zeitText(rest);
    }

    /** Was jetzt zu tun ist – oben in der Mitte */
    function ziel() {
      const jetzt = Date.now();
      const s = (ms) => Math.max(0, Math.ceil(ms / 1000));
      const ww = (a) => weltWendung(a);
      if (z.countdownBis && z.countdownBis > jetzt) return { art: 'dringend', text: `⏱ ${(ww('countdown') && ((kinder() && ww('countdown').kinder ? 'Schnell' : ww('countdown').kurz))) || (kinder() ? 'Schnell' : 'Countdown')}: Löse irgendein Rätsel – noch ${s(z.countdownBis - jetzt)} s` };
      if (z.dunkelBis > jetzt) return { art: 'warnung', text: `🔦 ${ww('dunkel') ? ww('dunkel').titel.replace('!', '') : 'Stromausfall'} – leuchte mit der Maus oder dem Finger. Hell in ${s(z.dunkelBis - jetzt)} s` };
      if (z.nebelBis > jetzt) return { art: 'warnung', text: `🌫 ${ww('nebel') ? ww('nebel').titel.replace('!', '') : 'Nebel'} – vorbei in ${s(z.nebelBis - jetzt)} s` };
      const bl = Object.keys((z.stand && z.stand.blockiert) || {}).find((id) => blockiertMs(id) > 0 && !geloest(id));
      if (bl) return { art: 'warnung', text: `⛓ „${station(bl).ort}“ ist verriegelt – noch ${s(blockiertMs(bl))} s` };
      const brief = z.briefe.find((b) => b.szene === z.szene && !b.gelesen);
      if (brief) return { art: 'gut', text: '✉ Ein Brief liegt auf dem Boden – heb ihn auf und lies ihn.' };
      const w = (z.stand && z.stand.wort) || [];
      const n = w.filter(Boolean).length;
      const letzte = z.szene === z.raum.szenen.length - 1;
      if (!letzte && !szeneOffen(z.szene + 1)) return { art: '', text: `Ziel: Finde den Weg nach „${z.raum.szenen[z.szene + 1].titel}“ · Lösungswort ${n}/${z.raum.finale.laenge}` };
      if (!letzte && szeneOffen(z.szene + 1)) return { art: 'gut', text: `Die Tür nach „${z.raum.szenen[z.szene + 1].titel}“ ist offen – geh hindurch (rechts) →` };
      if (n >= z.raum.finale.laenge) return { art: 'gut', text: 'Alle Buchstaben gefunden – öffne den Ausgang!' };
      return { art: '', text: `Ziel: Sammle die Buchstaben für den Ausgang – ${n} von ${z.raum.finale.laenge}` };
    }

    function hud() {
      const r = z.raum;
      const rest = z.endeZeit != null ? z.endeZeit - Date.now() : null;
      const zi = ziel();
      return el('div', { class: 'cl-hud' },
        el('div', { class: 'cl-hud-titel' }, el('span', { class: 'cl-marke' }, 'Clavis'),
          el('div', { class: 'cl-ort-anzeige' }, el('b', {}, `📍 ${r.szenen[z.szene].titel}`), el('small', {}, r.titel)),
          r.szenen.length > 1 ? el('div', { class: 'cl-lageplan', title: 'Lageplan: ' + r.szenen.map((s) => s.titel).join(' → ') }, r.szenen.map((s, i) => el('i', { class: (i === z.szene ? 'hier' : '') + (i === 0 || szeneOffen(i) ? ' offen' : '') }))) : null),
        el('div', { class: 'cl-ziel ' + zi.art, id: 'cl-ziel' }, zi.text),
        el('div', { class: 'cl-uhr-anzeige' + (rest != null && rest < 5 * 60000 ? ' knapp' : '') + (rest != null && rest < 0 ? ' ueber' : '') }, el('span', { id: 'cl-uhr' }, uhrText())),
        el('div', { class: 'cl-hud-knoepfe' },
          z.stand && z.stand.spieler && z.stand.spieler.length > 1 ? el('span', { class: 'cl-team', title: z.stand.spieler.map((s) => s.name).join(', ') }, `👥 ${z.stand.spieler.length}`) : null,
          el('button', { class: 'cl-hud-knopf', type: 'button', title: 'Notizbuch', onclick: notizbuch }, '📓'),
          schreckEinst().moeglich ? el('button', { class: 'cl-hud-knopf schreck' + (schreckEinst().an ? ' an' : ''), type: 'button', title: schreckEinst().an ? `Jumpscares an (Stärke ${schreckEinst().staerke}) – ausschalten` : 'Jumpscares aus – einschalten', onclick: () => { schreckSetzen(!schreckEinst().an); hudNeu(); toast(schreckEinst().an ? `⚡ Jumpscares an (Stärke ${schreckEinst().staerke})` : 'Jumpscares aus'); } }, '⚡') : null,
          el('button', { class: 'cl-hud-knopf' + (Clavis.stimme.an() && Clavis.stimme.verfuegbar() ? '' : ' aus'), type: 'button', title: !Clavis.stimme.verfuegbar() ? 'Keine Stimme auf diesem Gerät – nur Untertitel' : Clavis.stimme.an() ? 'Erzähler-Stimme aus' : 'Erzähler-Stimme an', onclick: () => { Clavis.stimme.schalten(!Clavis.stimme.an()); hudNeu(); } }, '🗣'),
          el('button', { class: 'cl-hud-knopf' + (k.musikAn() ? '' : ' aus'), type: 'button', title: k.musikAn() ? 'Musik aus' : 'Musik an', onclick: () => { k.musikSchalten(!k.musikAn()); hudNeu(); } }, '♫'),
          el('button', { class: 'cl-hud-knopf', type: 'button', title: k.an() ? 'Ton aus' : 'Ton an', onclick: () => { k.schalten(!k.an()); hudNeu(); } }, k.an() ? '🔊' : '🔈'),
          host ? el('button', { class: 'cl-hud-knopf', type: 'button', title: 'Spiel beenden', onclick: () => host.beenden() }, '⏻') : null));
    }
    const hudNeu = () => { const h = spiel.querySelector('.cl-hud'); if (h) { const n = hud(); h.replaceWith(n); spiel.style.setProperty('--hud-h', `${n.offsetHeight}px`); } };

    function unten() {
      const w = (z.stand && z.stand.wort) || new Array(z.raum.finale.laenge).fill(null);
      return el('div', { class: 'cl-unten' },
        z.inventar.length ? el('div', { class: 'cl-inventar', title: 'Was du bei dir trägst' }, el('span', { class: 'cl-wort-titel' }, 'Dabei'),
          el('div', { class: 'cl-inventar-liste' }, z.inventar.map((t) => el('span', { class: 'cl-inventar-ding', title: t.name }, t.zeichen)))) : null,
        el('div', { class: 'cl-wort-tafel', title: 'Das Lösungswort für den Ausgang' },
          el('span', { class: 'cl-wort-titel' }, 'Lösungswort'),
          el('div', { class: 'cl-wort' }, w.map((b, i) => el('span', { class: 'cl-wort-feld' + (b ? ' voll' : ''), 'data-i': i }, b || '')))));
    }
    const untenNeu = () => { const u = spiel.querySelector('.cl-unten'); if (u) u.replaceWith(unten()); };

    // ---------------------------------------------------------------- Blut (nur ab 18)
    function blutDeko() {
      const tropfen = [];
      for (let i = 0; i < 9; i++) tropfen.push(el('i', { style: { left: `${4 + Math.random() * 92}%`, height: `${20 + Math.random() * 90}px`, animationDelay: `${Math.random() * 6}s`, width: `${4 + Math.random() * 6}px` } }));
      const hand = () => el('svg', { viewBox: '0 0 200 240', class: 'cl-handabdruck', style: { left: `${5 + Math.random() * 80}%`, top: `${20 + Math.random() * 50}%`, transform: `rotate(${-30 + Math.random() * 60}deg)` } },
        el('path', { d: 'M60 230 C40 180 30 150 34 120 C36 105 52 104 56 118 L62 140 L58 52 C57 38 76 36 78 50 L84 118 L86 30 C86 14 106 14 106 30 L106 116 L114 40 C116 26 134 28 132 44 L126 122 L140 70 C144 56 162 60 158 76 L146 150 C140 190 132 210 130 230 Z' }));
      return [el('div', { class: 'cl-deko blut' }, tropfen), el('div', { class: 'cl-deko handabdruecke' }, hand(), Math.random() < 0.6 ? hand() : null)];
    }

    // ---------------------------------------------------------------- Der Raum
    /** Wo was steht – fest je Raum und Szene, damit nichts springt */
    function aufstellung(si) {
      const ids = stationenDerSzene(si);
      const r = Clavis.zufall(hash(z.raum.titel + si));
      const weltDeko = (Clavis.DEKO[z.raum.welt] || []).filter(([icon]) => !ids.some((id) => station(id).symbol === icon));
      const deko = r.mischen(weltDeko).slice(0, ids.length >= 7 ? 1 : 2);
      const n = ids.length;
      const plaetze = [];
      // Stationen gleichmäßig über die Breite, mit etwas Zufall; Boden abwechselnd hinten und vorn
      ids.forEach((id, i) => {
        const s = station(id);
        const platz = Clavis.platzVon(s.symbol);
        const x = 12 + (76 * (i + 0.5)) / n + (r() - 0.5) * (40 / n);
        const vorn = i % 2 === 1;
        const y = platz === 'wand' ? 34 + (r() - 0.5) * 6 : platz === 'tisch' ? (vorn ? 76 : 68) : (vorn ? 86 : 74);
        const gr = platz === 'wand' ? 1 : vorn ? 1.12 : 0.92;
        plaetze.push({ id, art: 'station', icon: s.symbol, platz, x, y, gr });
      });
      deko.forEach(([icon, text], j) => {
        const x = j === 0 ? 13 : 87;
        const platz = Clavis.platzVon(icon);
        plaetze.push({ id: 'deko' + j, art: 'deko', icon, text, platz, x: platz === 'wand' ? x + (j ? -2 : 2) : x, y: platz === 'wand' ? 30 : platz === 'tisch' ? 64 : 70, gr: 0.78 });
      });
      return plaetze;
    }

    function requisitIcon(name) {
      const d = Clavis.ICONS[name] || Clavis.ICONS.truhe;
      return el('svg', { viewBox: '0 0 24 24', class: 'cl-req-svg', 'aria-hidden': 'true' },
        el('path', { d, class: 'f' }), el('path', { d, class: 's', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }

    function requisit(p) {
      const jetzt = Date.now();
      const s = p.art === 'station' ? station(p.id) : null;
      const fertig = s && geloest(p.id);
      const zu = s && !fertig && blockiertMs(p.id) > 0;
      const mark = z.markiert.get(p.id);
      const dringend = s && !fertig && z.countdownBis > jetzt;
      const frisch = z.frisch.get(p.id) > jetzt - 1800;
      const tipp = s && !fertig && z.stand && z.stand.hinweise && z.stand.hinweise[p.id] && z.stand.hinweise[p.id].length;
      const b = el('button', {
        class: `cl-req ${p.platz} ${p.art} mat-${Clavis.materialVon(p.icon)}${fertig ? ' fertig' : ''}${zu ? ' blockiert' : ''}${s && s.bonus ? ' bonus' : ''}${mark && mark > jetzt ? ' markiert' : ''}${dringend ? ' dringend' : ''}${frisch ? ' oeffnet' : ''}${s && s.tuer ? ' schluessel-station' : ''}`,
        type: 'button', 'data-id': p.id, title: s ? `${s.ort} – ${s.titel}` : '',
        style: { left: `${p.x}%`, top: `${p.y}%`, '--s': String(p.gr), zIndex: String(Math.round(p.y)), '--d': `${(hash(p.id) % 7) * 0.4}s` },
        onclick: () => (s ? oeffnen(p.id) : dekoKlick(b, p)),
      },
      el('div', { class: 'cl-req-schatten' }),
      p.platz === 'tisch' ? el('div', { class: 'cl-tischchen' }, el('i'), el('i')) : null,
      p.platz === 'wand' && GERAHMT.includes(p.icon) ? el('div', { class: 'cl-rahmen' }) : null,
      el('div', { class: 'cl-req-bild' }, requisitIcon(p.icon)),
      el('div', { class: 'cl-req-schild' }, s ? s.ort : ''),
      fertig ? el('div', { class: 'cl-req-marke ok' }, '✓') : null,
      tipp ? el('div', { class: 'cl-req-marke tipp' }, '?') : null,
      zu ? el('div', { class: 'cl-req-kette' }, '⛓') : null,
      s && s.bonus && !fertig ? el('div', { class: 'cl-req-neu' }, 'Bonus') : null,
      s && !fertig ? el('div', { class: 'cl-req-funkeln' }) : null);
      return b;
    }

    function dekoKlick(b, p) {
      b.classList.remove('wackel');
      void b.offsetWidth;
      b.classList.add('wackel');
      k.spielen('knarren');
      const f = fundstellen(z.szene).find((x) => x.in === p.id);
      if (f) { sagen(kinder() ? 'Da ist doch was …' : 'Du schaust genauer hin – dahinter steckt etwas …'); setTimeout(() => finden(f, b), 600); return; }
      sagen(p.text);
    }

    function tuerProp(art, ziel2) {
      const offen = art === 'zurueck' || (art === 'weiter' && szeneOffen(ziel2)) || (art === 'ausgang' && z.stand && z.stand.finale);
      const titel = art === 'ausgang' ? 'Ausgang' : z.raum.szenen[ziel2].titel;
      return el('button', {
        class: `cl-durchgang ${art}${offen ? ' offen' : ''}${z.tuerOeffnet === ziel2 && art === 'weiter' ? ' oeffnet' : ''}`, type: 'button', 'data-tuer': art,
        onclick: () => {
          if (art === 'ausgang') return oeffnen('finale');
          if (art === 'zurueck') return gehen(ziel2);
          if (offen) return gehen(ziel2);
          k.spielen('knarren');
          const b = spiel.querySelector(`.cl-durchgang.${art}`);
          if (b) { b.classList.remove('wackel'); void b.offsetWidth; b.classList.add('wackel'); }
          sagen(`Die Tür nach „${titel}“ ist verschlossen. Irgendwo hier muss der Weg verborgen sein.`);
        },
      },
      el('div', { class: 'cl-tuer-rahmen' }, el('div', { class: 'cl-tuer-licht' }), el('div', { class: 'cl-tuer-blatt' }, el('i', { class: 'cl-tuer-griff' }))),
      el('div', { class: 'cl-tuer-schild' }, art === 'zurueck' ? `← ${titel}` : art === 'ausgang' ? (offen ? 'Offen!' : 'Ausgang') : (offen ? `${titel} →` : `🔒 ${titel}`)));
    }

    // ---------------------------------------------------------------- Fundstellen: versteckte Zeichen und Teile im Raum
    const WO = { wand: ['In die Wand geritzt', 'Mit Kreide an die Wand gemalt', 'Hinter abblätterndem Putz', 'Klein in eine Ecke gekritzelt'], boden: ['In den Boden gekratzt', 'Unter einer losen Diele', 'Im Staub am Boden', 'Auf einem Zettel am Boden'] };
    function fundstellen(si) {
      const liste = [];
      for (const id of stationenDerSzene(si)) {
        const s = station(id);
        if (!s || geloest(id)) continue;
        if (s.mech === 'raumcode' && s.p && s.p.spuren) s.p.spuren.forEach((sp, i) => liste.push({ key: `${id}:${i}`, id, i, art: 'zeichen', z: sp.z, d: sp.d }));
        if (s.mech === 'fehlteil' && s.p && !z.gefundenTeile.has(id)) liste.push({ key: `${id}:t`, id, art: 'teil', zeichen: s.p.zeichen, name: s.p.name, teil: s.p.teil });
      }
      if (!liste.length) return [];
      const r = Clavis.zufall(hash(z.raum.titel + 'fund' + si));
      const belegt = aufstellung(si).map((q) => q.x);
      const deko = aufstellung(si).filter((q) => q.art === 'deko').map((q) => q.id);
      return liste.map((f) => {
        if (f.art === 'teil' && deko.length) { const d = deko.shift(); return { ...f, in: d }; }
        let x; let n = 0;
        do { x = 11 + r() * 78; } while (belegt.some((b) => Math.abs(b - x) < 7) && n++ < 30);
        belegt.push(x);
        const wand = r() < 0.55;
        return { ...f, x, y: wand ? 12 + r() * 32 : 70 + r() * 22, platz: wand ? 'wand' : 'boden', wo: r.wahl(wand ? WO.wand : WO.boden) };
      });
    }
    function fundElement(f) {
      if (f.in) return null;
      const gefunden = f.art === 'zeichen' && (z.funde[f.id] || []).includes(f.i);
      return el('button', { class: `cl-fund ${f.art} ${f.platz}${gefunden ? ' gefunden' : ''}`, type: 'button', 'data-fund': f.key, title: gefunden ? `${f.z} = ${f.d}` : '',
        style: { left: `${f.x}%`, top: `${f.y}%`, '--d': `${(hash(f.key) % 9) * 0.7}s` }, onclick: (e) => finden(f, e.currentTarget) },
      f.art === 'zeichen' ? el('span', { class: 'cl-fund-zeichen' }, f.z, gefunden ? el('b', {}, ` ${f.d}`) : null) : el('span', { class: 'cl-fund-glanz' }));
    }
    function finden(f, knoten) {
      if (!imSpiel()) return;
      z.letzterFortschritt = Date.now();
      if (f.art === 'zeichen') {
        const l = z.funde[f.id] || (z.funde[f.id] = []);
        if (l.includes(f.i)) { sagen(`${f.wo}: ${f.z} = ${f.d}`, 'fund'); return; }
        l.push(f.i);
        k.spielen('hinweis');
        sagen(`${f.wo}: ${f.z} = ${f.d}. (${l.length} von ${station(f.id).p.spuren.length} Zeichen für „${station(f.id).ort}“)`, 'fund');
        z.notizen.push(`${station(f.id).ort}: ${f.z} = ${f.d}`);
        requisitenMalen();
      } else {
        z.gefundenTeile.add(f.id);
        z.inventar.push({ teil: f.teil, zeichen: f.zeichen, name: f.name, fuer: f.id });
        k.spielen('auf');
        sagen(kinder() ? `Juhu! Gefunden: ${f.zeichen} ${f.name}!` : `Gefunden: ${f.zeichen} ${f.name}. Du steckst es ein – wo könnte es hineinpassen?`, 'fund');
        z.notizen.push(`Gefunden: ${f.zeichen} ${f.name}`);
        if (knoten) dingFliegen(knoten, f.zeichen);
        setTimeout(() => { requisitenMalen(); untenNeu(); }, 900);
      }
    }
    function dingFliegen(von, zeichen) {
      const q0 = spiel.getBoundingClientRect();
      const a = von.getBoundingClientRect();
      const b = (spiel.querySelector('.cl-unten') || spiel).getBoundingClientRect();
      const t = el('div', { class: 'cl-flug ding' }, zeichen);
      spiel.append(t);
      t.animate([
        { transform: `translate(${a.left + a.width / 2 - q0.left}px, ${a.top - q0.top}px) scale(0.5)`, opacity: 0 },
        { transform: `translate(${a.left + a.width / 2 - q0.left}px, ${a.top - q0.top - 90}px) scale(2.2)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${b.left + 40 - q0.left}px, ${b.top + b.height / 2 - q0.top}px) scale(1)`, opacity: 0.9 },
      ], { duration: 1200, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).onfinish = () => t.remove();
    }

    // ---------------------------------------------------------------- Briefe (bleiben am Boden liegen)
    function briefElement(b, i) {
      return el('button', { class: 'cl-brief-fund' + (b.gelesen ? ' gelesen' : ''), type: 'button', title: 'Brief', style: { left: `${44 + i * 6}%`, top: `${79 - (i % 2) * 3}%` }, onclick: () => briefLesen(b) }, el('i'));
    }
    function briefLesen(b) {
      b.gelesen = true;
      k.spielen('papier');
      const n = el('div', { class: 'cl-nah', onclick: (e) => { if (e.target === n) n.remove(); } });
      n.append(el('div', { class: 'cl-nah-rahmen material-papier auf' }, el('div', { class: 'cl-nah-karte cl-brief-karte' },
        el('div', { class: 'cl-nah-kopf' }, el('button', { class: 'cl-zurueck', type: 'button', onclick: () => n.remove() }, '← Weglegen'), el('div', { class: 'cl-wachsen' }, el('div', { class: 'cl-nah-ort' }, 'Ein Brief'), el('h3', {}, 'Unter der Tür hindurch'))),
        el('div', { class: 'cl-brief-papier' }, el('div', { class: 'cl-brief-siegel' }), el('p', {}, b.text || '…')))));
      spiel.append(n);
      requisitenMalen();
      hudNeu();
    }

    // ---------------------------------------------------------------- Der lebendige Raum: Lichter, Spuren, Verfall
    function lichterSetzen() {
      const raum = spiel.querySelector('.cl-raum');
      if (!raum) return;
      const ids = stationenDerSzene(z.szene);
      const n = ids.filter(geloest).length;
      const vorher = z.lichtStand[z.szene];
      const lampen = [...raum.querySelectorAll('.cl-licht-punkt')];
      const anteil = ids.length ? n / ids.length : 0;
      const an = Math.round(anteil * lampen.length);
      lampen.forEach((l, i) => {
        const soll = i < an;
        if (soll && !l.classList.contains('an')) {
          l.classList.add('an');
          if (vorher != null && i >= Math.round((vorher / Math.max(1, ids.length)) * lampen.length)) { l.classList.add('zuendet'); setTimeout(() => k.spielen(z.bau && /fackel|kerze|laterne/.test(z.bau.licht) ? 'zuenden' : 'einrasten'), 250 + i * 60); }
        } else if (!soll) l.classList.remove('an');
      });
      z.lichtStand[z.szene] = n;
      raum.style.setProperty('--hell', (0.5 + 0.5 * anteil).toFixed(2));
      const letzte = z.szene === z.raum.szenen.length - 1;
      raum.classList.toggle('frei', letzte ? !!(z.stand && z.stand.wort && z.stand.wort.every(Boolean)) : szeneOffen(z.szene + 1));
    }
    function spurenSetzen() {
      const raum = spiel.querySelector('.cl-raum');
      if (!raum) return;
      [...raum.classList].filter((c) => c.startsWith('spur-')).forEach((c) => raum.classList.remove(c));
      (z.spuren[z.szene] || new Set()).forEach((sp) => raum.classList.add('spur-' + sp));
    }
    function zeitStufe() {
      if (z.endeZeit == null || !z.raum) return 0;
      const anteil = (z.endeZeit - Date.now()) / (z.raum.minuten * 60000);
      return anteil > 0.5 ? 0 : anteil > 0.25 ? 1 : anteil > 0.1 ? 2 : 3;
    }

    /** Requisiten neu (Zustände), ohne den Raum neu aufzubauen */
    function requisitenMalen() {
      const lage = spiel.querySelector('.cl-requisiten');
      if (!lage) return;
      const funde = fundstellen(z.szene);
      lage.replaceChildren(...aufstellung(z.szene).map(requisit), ...funde.map(fundElement).filter(Boolean), ...z.briefe.filter((b) => b.szene === z.szene).map(briefElement));
      funde.filter((f) => f.in).forEach((f) => { const b = lage.querySelector(`.cl-req[data-id="${f.in}"]`); if (b) b.classList.add('versteckt'); });
      const tueren = spiel.querySelector('.cl-tueren-lage');
      if (tueren) {
        const letzte = z.szene === z.raum.szenen.length - 1;
        tueren.replaceChildren(...[z.szene > 0 ? tuerProp('zurueck', z.szene - 1) : null, letzte ? tuerProp('ausgang', null) : tuerProp('weiter', z.szene + 1)].filter(Boolean));
      }
      lichterSetzen();
    }

    function atmo() {
      const st = (z.raum && z.raum.stimmung) || {};
      const teile = [];
      if (!kinder()) {
        if (st.spuk >= 4) teile.push('geist');
        if (st.spuk >= 7) teile.push('geist zwei');
        if (st.grusel >= 4) teile.push('schatten');
        if (st.grusel >= 6) teile.push('augen');
        if (st.gefahr >= 6) teile.push('gefahr-rand');
      } else teile.push('funkeln');
      return el('div', { class: 'cl-atmo' }, teile.map((t) => el('div', { class: 'cl-deko ' + t })));
    }

    function raumAnsicht() {
      const r = z.raum;
      const sz = r.szenen[z.szene];
      const pl = aufstellung(z.szene);
      const schmal = (wurzel.clientWidth || window.innerWidth) < 720;
      const breite = Math.min(schmal ? 3.2 : 2.3, Math.max(schmal ? 2.1 : 1.35, 0.95 + (pl.length + 1) * (schmal ? 0.3 : 0.16)));
      z.breite = breite;
      const bau = Clavis.Kulisse.bauen({ welt: r.welt, szene: z.szene, titel: sz.titel, art: sz.art, breite, alter: r.alter, blut: r.blut, stimmung: r.stimmung, belegt: pl, lichter: sz.stationen.length, seed: hash(r.titel) });
      z.bau = bau;
      if (r.blut) bau.wand.append(el('div', { class: 'cl-blut-wand' }, blutDeko()));
      const jetzt = Date.now();
      const raum = el('div', { class: `cl-raum verfall-${bau.verfallArt}` + (z.dunkelBis > jetzt ? ' dunkel' : '') + (z.nebelBis > jetzt ? ' vernebelt' : '') + (z.countdownBis > jetzt ? ' alarm' : ''), 'data-ort': bau.ort, 'data-licht': bau.licht, 'data-zeit': String(z.zeitStufe) },
        el('div', { class: 'cl-kamera' },
          el('div', { class: 'cl-panorama', style: { width: `${breite * 100}%` } },
            el('div', { class: 'cl-wand' }, bau.wand, bau.decke, bau.lichter, el('div', { class: 'cl-wand-licht' })),
            bau.boden, bau.links, bau.rechts, bau.verfall,
            el('div', { class: 'cl-tueren-lage' }),
            el('div', { class: 'cl-requisiten' })),
          el('div', { class: 'cl-vordergrund' }, el('div', { class: 'cl-vg links' }), el('div', { class: 'cl-vg rechts' }))),
        atmo(),
        el('div', { class: 'cl-szenen-titel' }, sz.titel),
        el('div', { class: 'cl-taschenlampe' }), el('div', { class: 'cl-nebelschicht' }), el('div', { class: 'cl-alarmlicht' }, el('i'), el('i')),
        el('div', { class: 'cl-umsehen links', onclick: () => { z.panZiel = Math.max(0, z.panZiel - 0.35); } }, '‹'),
        el('div', { class: 'cl-umsehen rechts', onclick: () => { z.panZiel = Math.min(1, z.panZiel + 0.35); } }, '›'));
      // Umsehen: Maus bewegt den Blick, Finger zieht
      raum.addEventListener('pointermove', (e) => {
        const q = raum.getBoundingClientRect();
        raum.style.setProperty('--lx', `${e.clientX - q.left}px`);
        raum.style.setProperty('--ly', `${e.clientY - q.top}px`);
        raum.style.setProperty('--bx', (((e.clientX - q.left) / q.width) * 2 - 1).toFixed(2));
        // Umsehen nur am Rand (sonst rutscht das Ziel unter der Maus weg): je näher am Rand, desto schneller
        if (e.pointerType === 'mouse') {
          const x = (e.clientX - q.left) / q.width;
          z.panRichtung = z.offen ? 0 : x < 0.14 ? -(0.14 - x) / 0.14 : x > 0.86 ? (x - 0.86) / 0.14 : 0;
        }
      });
      raum.addEventListener('pointerleave', () => { z.panRichtung = 0; });
      raum.addEventListener('wheel', (e) => {
        if (z.offen) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        z.panZiel = Math.max(0, Math.min(1, z.panZiel + d / (raum.clientWidth * (breite - 1) || 1)));
        e.preventDefault();
      }, { passive: false });
      let x0 = null;
      raum.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      raum.addEventListener('touchmove', (e) => {
        if (x0 == null || z.offen) return;
        const dx = e.touches[0].clientX - x0;
        x0 = e.touches[0].clientX;
        z.panZiel = Math.max(0, Math.min(1, z.panZiel - (dx / raum.clientWidth) / (breite - 1)));
        const q = raum.getBoundingClientRect();
        raum.style.setProperty('--lx', `${e.touches[0].clientX - q.left}px`);
        raum.style.setProperty('--ly', `${e.touches[0].clientY - q.top}px`);
      }, { passive: true });
      setTimeout(() => { requisitenMalen(); spurenSetzen(); nebelStil(raum); }, 0);
      return raum;
    }

    // Kamera: sanft dem Blick folgen (mit Tiefe: Wand langsamer, Vordergrund schneller)
    let letzterTakt = performance.now();
    function kameraSchleife(jetzt = performance.now()) {
      if (!spiel.isConnected) return;
      const dt = Math.min(0.5, Math.max(0, (jetzt - letzterTakt) / 1000));
      letzterTakt = jetzt;
      const raum = spiel.querySelector('.cl-raum');
      if (raum) {
        if (z.panRichtung) z.panZiel = Math.max(0, Math.min(1, z.panZiel + z.panRichtung * dt * 0.95 / Math.max(0.3, z.breite - 1)));
        z.pan += (z.panZiel - z.pan) * (1 - Math.pow(0.92, dt * 60));
        const w = raum.clientWidth;
        const weg = w * (z.breite - 1) * z.pan;
        const pano = raum.querySelector('.cl-panorama');
        const wand = raum.querySelector('.cl-wand');
        const vg = raum.querySelector('.cl-vordergrund');
        if (pano) pano.style.transform = `translate3d(${-weg}px, 0, 0)`;
        if (wand) wand.style.transform = `translate3d(${weg * 0.12}px, 0, 0)`;
        if (vg) vg.style.transform = `translate3d(${-weg * 0.25}px, 0, 0)`;
        const l = raum.querySelector('.cl-umsehen.links');
        const r = raum.querySelector('.cl-umsehen.rechts');
        if (l) l.classList.toggle('weg', z.pan < 0.04);
        if (r) r.classList.toggle('weg', z.pan > 0.96);
      }
      requestAnimationFrame(kameraSchleife);
    }
    requestAnimationFrame(kameraSchleife);

    function blickAuf(id) {
      const p = aufstellung(z.szene).find((q) => q.id === id);
      if (!p || z.breite <= 1) return;
      const sicht = 1 / z.breite;
      z.panZiel = Math.max(0, Math.min(1, (p.x / 100 - sicht / 2) / (1 - sicht)));
    }

    function markieren(ids, ms = 9000) {
      const bis = Date.now() + ms;
      ids.forEach((id) => z.markiert.set(id, bis));
      requisitenMalen();
      setTimeout(requisitenMalen, ms + 50);
    }

    /** Durch eine Tür in einen anderen Raum gehen */
    function gehen(nach) {
      if (z.gerade === 'gehen') return;
      z.gerade = 'gehen';
      z.offen = null;
      const kam = spiel.querySelector('.cl-kamera');
      k.spielen(nach > z.szene ? 'tueroeffnen' : 'tuer');
      if (kam) kam.classList.add('gehen');
      setTimeout(() => {
        z.szene = nach;
        z.pan = nach > (z.vorherigeSzene ?? 0) ? 0.05 : 0.95;
        z.panZiel = 0.5;
        z.vorherigeSzene = nach;
        z.gerade = null;
        malen();
        const sz = z.raum.szenen[nach];
        const karte = el('div', { class: 'cl-ort-karte' }, el('small', {}, z.besucht.has(nach) ? 'Zurück in' : 'Du betrittst'), el('b', {}, sz.titel));
        spiel.append(karte);
        setTimeout(() => karte.remove(), 2600);
        if (!z.besucht.has(nach)) { z.besucht.add(nach); if (sz.text) setTimeout(() => sagen(sz.text), 900); }
      }, 650);
    }

    // ---------------------------------------------------------------- Heran: die Nahansicht
    function oeffnen(id) {
      if (!imSpiel() || z.gerade) return;
      z.offen = id;
      z.panRichtung = 0;
      z.letzterFortschritt = Math.max(z.letzterFortschritt, Date.now() - 60000);
      const ziel2 = id === 'finale' ? spiel.querySelector('.cl-durchgang.ausgang') : spiel.querySelector(`.cl-req[data-id="${id}"]`);
      const raum = spiel.querySelector('.cl-raum');
      const kam = spiel.querySelector('.cl-kamera');
      if (ziel2 && raum && kam) {
        const q = raum.getBoundingClientRect();
        const p = ziel2.getBoundingClientRect();
        kam.style.transformOrigin = `${p.left + p.width / 2 - q.left}px ${p.top + p.height / 2 - q.top}px`;
        kam.classList.add('zoom');
      }
      k.spielen('whoosh');
      if (id !== 'finale' && !z.geoeffnet.has(id)) { z.geoeffnet.add(id); }
      setTimeout(() => { if (z.offen === id) nahMalen(true); }, 260);
      // Jumpscare beim Öffnen – einmal, zufällig
      const sch = z.raum.schreck;
      if (sch && schreckEinst().an && !z.schreckLokal && id !== 'finale' && Math.random() < 0.14) {
        z.schreckLokal = true;
        setTimeout(() => { if (z.offen === id) Clavis.schreck(spiel, sch.arten[Math.floor(Math.random() * sch.arten.length)], { blut: z.raum.blut, staerke: schreckEinst().staerke }); }, 900 + Math.random() * 900);
      }
    }

    function schliessen() {
      z.offen = null;
      const n = spiel.querySelector('.cl-nah');
      if (n) { n.classList.add('weg'); setTimeout(() => n.remove(), 250); }
      const kam = spiel.querySelector('.cl-kamera');
      if (kam) kam.classList.remove('zoom');
    }

    function zettelTeil(id) {
      const zt = z.zettel[id];
      const bei = z.stand && z.stand.zettelBei && z.stand.zettelBei[id];
      if (!zt && !bei) return null;
      if (!zt) return el('div', { class: 'cl-zettel fremd' }, el('b', {}, 'Ein Zettel fehlt'), el('div', {}, `Den Zettel zu diesem Rätsel hat ${bei}. Fragt euch gegenseitig!`));
      return el('div', { class: 'cl-zettel' }, el('b', {}, zt.titel || 'Zettel'), zt.text ? el('div', { class: 'cl-zettel-text' }, zt.text) : null,
        zt.zeilen ? el('div', { class: 'cl-zettel-tabelle' + (zt.runen ? ' runen' : '') }, zt.zeilen.map(([a, b]) => el('div', { class: 'cl-zettel-paar' }, zt.runen ? Clavis.rune(a) : el('span', {}, a), el('b', {}, b)))) : null);
    }

    function hinweisTeil(id) {
      const l = (z.stand && z.stand.hinweise && z.stand.hinweise[id]) || [];
      const max = z.raum.hinweisAnzahl;
      const kosten = z.raum.hinweisKosten;
      return el('div', { class: 'cl-hinweise' },
        l.map((t, i) => el('div', { class: 'cl-hinweis' }, el('span', { class: 'cl-hinweis-nr' }, `Hinweis ${i + 1}`), t)),
        !geloest(id) && l.length < max ? el('button', { class: 'cl-knopf zart klein', type: 'button', onclick: (e) => { e.target.disabled = true; senden({ typ: 'hinweis', station: id }); } },
          kosten ? `💡 Hinweis nehmen (kostet ${kosten >= 60 ? `${kosten / 60} Min.` : `${kosten} s`})` : '💡 Hinweis nehmen') : null,
        !geloest(id) && l.length >= max && max ? el('div', { class: 'cl-leise klein' }, 'Keine Hinweise mehr für dieses Rätsel.') : null);
    }

    function belohnungTeil(id) {
      const g = z.stand.geloest[id];
      const s = station(id);
      const b = g && g.belohnung;
      return el('div', { class: 'cl-belohnung' },
        el('div', { class: 'cl-belohnung-schloss' }, Clavis.icon(s.symbol)),
        el('div', { class: 'cl-belohnung-titel' }, 'Gelöst', g.name && z.stand.spieler && z.stand.spieler.length > 1 ? ` – von ${g.name}` : ''),
        el('p', { class: 'cl-leise' }, Clavis.ERFOLG[s.mech] || ''),
        b && b.art === 'fragment' ? el('div', { class: 'cl-fragment' }, el('span', {}, b.bonus ? 'Bonus-Fundstück' : 'Fundstück'), el('div', { class: 'cl-fragment-steine' }, b.stellen.map((st, i) => el('div', { class: 'cl-fragment-stein' }, el('b', {}, b.buchstaben[i]), el('small', {}, `${st + 1}. Stelle`))))) : null,
        b && b.art === 'tuer' ? el('div', { class: 'cl-fragment' }, el('span', {}, 'Ein Weg öffnet sich'), el('b', {}, `→ ${z.raum.szenen[b.szene].titel}`)) : null,
        b && b.art === 'zeit' ? el('div', { class: 'cl-fragment' }, el('span', {}, 'Bonus'), el('b', { class: 'cl-zeitbonus' }, '+2:00')) : null,
        g.geschichte ? el('div', { class: 'cl-geschichte' }, el('small', {}, 'Du findest heraus'), el('p', {}, g.geschichte)) : null,
        el('button', { class: 'cl-knopf', type: 'button', onclick: schliessen }, 'Zurücktreten'));
    }

    function nahMalen(neu = false) {
      const id = z.offen;
      if (!id) return;
      let n = spiel.querySelector('.cl-nah');
      if (neu || !n) {
        if (n) n.remove();
        n = el('div', { class: 'cl-nah', onclick: (e) => { if (e.target === n) schliessen(); } });
        spiel.append(n);
      }
      const finale = id === 'finale';
      const s = finale ? null : station(id);
      const fertig = finale ? !!(z.stand && z.stand.finale) : geloest(id);
      const zu = !finale && !fertig && blockiertMs(id) > 0;
      const material = finale ? 'holz' : Clavis.materialVon(s.symbol);
      const api = {
        loesen: async (antwort) => {
          const r = await anfrage(finale ? { typ: 'finale', antwort } : { typ: 'loesen', station: id, antwort });
          if (!r.richtig) {
            k.spielen('falsch');
            const karte = n.querySelector('.cl-nah-rahmen');
            if (karte) { karte.classList.remove('wackeln'); void karte.offsetWidth; karte.classList.add('wackeln'); }
            if (r.info) toast(r.info, 'falsch');
            if (r.falle) falleZeigen(r.falle);
          }
          return r;
        },
        ton: (x) => k.spielen(x),
        stufe: z.raum.stufe,
        welt: z.raum.welt,
        funde: (z.funde[id] || []).slice(),
        inventar: z.inventar.map((x) => x.teil),
      };
      let mech = null;
      if (!fertig && !zu) {
        if (finale) mech = finaleAnsicht(api);
        else {
          const m = Clavis.MECHANIKEN[s.mech];
          try { mech = m ? m.ansicht(s.p, api) : el('div', {}, 'Unbekanntes Rätsel'); } catch (e) { console.error(e); mech = el('div', { class: 'cl-leise' }, 'Dieses Rätsel lässt sich nicht anzeigen.'); }
        }
      }
      n.dataset.zu = zu ? '1' : '';
      n.replaceChildren(el('div', { class: `cl-nah-rahmen material-${material}${neu ? ' auf' : ''}` },
        el('div', { class: 'cl-nah-karte' },
          el('div', { class: 'cl-nah-kopf' },
            el('button', { class: 'cl-zurueck', type: 'button', onclick: schliessen }, '← Zurücktreten'),
            el('div', { class: 'cl-wachsen' }, el('div', { class: 'cl-nah-ort' }, finale ? 'Ausgang' : s.ort), el('h3', {}, finale ? 'Das letzte Schloss' : s.titel)),
            el('div', { class: 'cl-nah-symbol' }, Clavis.icon(finale ? 'ausgang' : s.symbol))),
          finale ? el('p', { class: 'cl-nah-text' }, z.raum.finale.text || 'Die Tür nach draußen hat ein Buchstabenschloss. Die Fundstücke ergeben das Wort.') : s.text ? el('p', { class: 'cl-nah-text' }, s.text) : null,
          fertig ? (finale ? el('div', { class: 'cl-belohnung' }, el('div', { class: 'cl-belohnung-titel' }, 'Offen!')) : belohnungTeil(id)) : null,
          zu ? el('div', { class: 'cl-verriegelt' }, el('div', { class: 'cl-verriegelt-kette' }, '⛓'), el('b', {}, 'Verriegelt'), el('span', { id: 'cl-verriegelt-zeit' }, `noch ${Math.ceil(blockiertMs(id) / 1000)} Sekunden – versuch solange etwas anderes`)) : null,
          !fertig && !finale && !zu ? zettelTeil(id) : null,
          mech ? el('div', { class: 'cl-nah-mech' }, mech) : null,
          !fertig && !finale && !zu ? hinweisTeil(id) : null)));
    }

    function finaleAnsicht(api) {
      const w = (z.stand && z.stand.wort) || [];
      const laenge = z.raum.finale.laenge;
      const werte = w.map((b) => (b ? b.charCodeAt(0) - 65 : 0));
      while (werte.length < laenge) werte.push(0);
      const anzeigen = [];
      const drehen = (i, d) => { werte[i] = (werte[i] + d + 26) % 26; anzeigen[i].textContent = String.fromCharCode(65 + werte[i]); api.ton('rad'); };
      const reihe = el('div', { class: 'cl-rollen finale' }, werte.map((v, i) => {
        const a = el('div', { class: 'cl-rolle-wert' }, String.fromCharCode(65 + v));
        anzeigen.push(a);
        const r = el('div', { class: 'cl-rolle' + (w[i] ? ' bekannt' : '') },
          el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => drehen(i, -1) }, '▲'), el('div', { class: 'cl-rolle-fenster' }, a), el('button', { class: 'cl-rolle-knopf', type: 'button', onclick: () => drehen(i, 1) }, '▼'));
        r.addEventListener('wheel', (e) => { e.preventDefault(); drehen(i, e.deltaY > 0 ? 1 : -1); }, { passive: false });
        return r;
      }));
      const fehlen = w.filter((b) => !b).length + Math.max(0, laenge - w.length);
      return el('div', { class: 'cl-schloss' },
        el('div', { class: 'cl-leise klein' }, fehlen ? `Noch ${fehlen} Buchstabe${fehlen > 1 ? 'n' : ''} unbekannt – findet die Fundstücke (oder ratet).` : 'Alle Buchstaben gefunden!'),
        reihe,
        el('button', { class: 'cl-knopf gross', type: 'button', onclick: () => api.loesen(werte.map((v) => String.fromCharCode(65 + v)).join('')) }, 'Tür öffnen'));
    }

    function falleZeigen(sek) {
      k.spielen('falle');
      spiel.classList.remove('cl-falle');
      void spiel.offsetWidth;
      spiel.classList.add('cl-falle');
      setTimeout(() => spiel.classList.remove('cl-falle'), 900);
      toast(`Falle! Die Uhr springt ${sek} Sekunden vor.`, 'falsch');
    }

    /** Ein Buchstabe fliegt vom Gegenstand ins Lösungswort */
    function buchstabeFliegen(vonId, stellen, buchstaben) {
      const von = spiel.querySelector(`.cl-req[data-id="${vonId}"]`) || spiel.querySelector('.cl-raum');
      if (!von) return;
      const q0 = spiel.getBoundingClientRect();
      const a = von.getBoundingClientRect();
      stellen.forEach((st, i) => {
        const ziel2 = spiel.querySelector(`.cl-wort-feld[data-i="${st}"]`);
        if (!ziel2) return;
        const b = ziel2.getBoundingClientRect();
        const t = el('div', { class: 'cl-flug' }, buchstaben[i]);
        spiel.append(t);
        const x0 = a.left + a.width / 2 - q0.left;
        const y0 = a.top + a.height / 3 - q0.top;
        const x1 = b.left + b.width / 2 - q0.left;
        const y1 = b.top + b.height / 2 - q0.top;
        t.animate([
          { transform: `translate(${x0}px, ${y0}px) scale(0.4)`, opacity: 0 },
          { transform: `translate(${x0}px, ${y0 - 80}px) scale(1.6)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1 },
        ], { duration: 1300 + i * 180, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).onfinish = () => { t.remove(); ziel2.classList.add('neu'); k.spielen('klick'); };
      });
    }

    // ---------------------------------------------------------------- Wendungen: klar sagen, was zu tun ist
    const weltWendung = (art) => ((Clavis.WENDUNG_WELT || {})[art] || {})[z.raum && z.raum.welt] || null;

    /** Was jetzt zu tun ist – bleibt stehen, bis es gelesen ist (der Knopf geht erst nach ein paar Sekunden) */
    function auftragZeigen(d, ww) {
      const g = d.daten || {};
      const a = Clavis.AUFGABE[d.art] || { titel: 'Achtung!', tun: '' };
      let tun = ((kinder() && a.kinder) || a.tun).replace('{ort}', g.ort || '').replace('{n}', g.stelle != null ? g.stelle + 1 : '').replace('{b}', g.buchstabe || '');
      if (d.art === 'countdown' && ww) tun = `Löse schnell IRGENDEIN Rätsel, bevor es zu spät ist (90 Sekunden) – ${ww.kurz}! Schaffst du es nicht, verlierst du 2 Minuten.`;
      if (d.art === 'dunkel' && ww) tun = 'Beweg die Maus – oder den Finger – über den Raum: Deine Lampe zeigt, wohin du leuchtest. In 60 Sekunden wird es wieder hell. Rätsel öffnen geht weiterhin.';
      if (d.art === 'nebel' && ww) tun = `Du siehst kaum etwas – aber du kannst weiter Rätsel öffnen. In 45 Sekunden ist es vorbei.`;
      const alt = spiel.querySelector('.cl-auftrag');
      if (alt) alt.remove();
      const weg = () => { karte.classList.add('weg'); setTimeout(() => karte.remove(), 300); };
      const lesen = d.art === 'zeitplus' || d.art === 'zeitminus' ? 2 : 4;
      const knopf = el('button', { class: 'cl-knopf', type: 'button', disabled: true, onclick: weg }, `Lesen … ${lesen}`);
      const karte = el('div', { class: 'cl-auftrag ' + (d.gut ? 'gut' : 'schlecht') },
        el('div', { class: 'cl-auftrag-karte' },
          el('div', { class: 'cl-auftrag-symbol' }, AUFGABE_SYMBOL[d.art] || '!'),
          el('div', { class: 'cl-auftrag-titel' }, (ww && ww.titel) || a.titel),
          el('div', { class: 'cl-auftrag-tun' }, el('small', {}, d.gut ? 'Das bedeutet' : 'Deine Aufgabe'), el('b', {}, tun)),
          knopf));
      spiel.append(karte);
      let rest = lesen;
      const zaehl = setInterval(() => { rest--; if (!knopf.isConnected) return clearInterval(zaehl); if (rest > 0) knopf.textContent = `Lesen … ${rest}`; else { clearInterval(zaehl); knopf.disabled = false; knopf.textContent = d.gut ? 'Super!' : 'Verstanden – los!'; knopf.focus(); } }, 1000);
    }

    /** Ein Ereignis: Das Spiel friert ein, eine Zwischenszene spielt (Nahaufnahme, Effekte, Klang, Untertitel) – danach Spuren im Raum */
    function ereignisZeigen(art0, text0) {
      const welt = z.raum.welt;
      const art = Clavis.ereignisFuerWelt ? Clavis.ereignisFuerWelt(art0, welt) : art0;
      const stark = !kinder() && ((z.raum.stimmung || {}).grusel || 0) >= 6;
      const botschaft = ['anruf', 'funkspruch', 'brief'];
      const textBleibt = art === art0 || (botschaft.includes(art) && botschaft.includes(art0));
      const text = (textBleibt && text0) || ((Clavis.EREIGNIS_WELT || {})[art] || {})[welt] || Clavis.ereignisText(art, z.raum.alter, stark) || (Clavis.EREIGNISSE[art] || {}).text || '';
      z.notizen.push(text);
      const brief = art === 'brief';
      const erz = kinder() ? 'kind' : 'erzaehler';
      // Wer spricht? Anrufer am Telefon, eine Stimme im Funk, der Brief wird vorgelesen – und wo von Stimmen die Rede ist, sind sie zu hören
      const geisterhaft = !kinder() && (['fluestern', 'lachen', 'schrei', 'ketten', 'heulen'].includes(art) || /stimme|flüster|wisper|murmel|ruft|rufen|singt|summt/i.test(text));
      const GEISTER = ['Du gehörst jetzt hierher.', 'Wir sehen dich.', 'Bleib … bei uns.', 'Hier unten ist es so kalt.', 'Komm … näher.', 'Niemand geht hier fort.'];
      const sprache = brief ? [{ text: kinder() ? 'Ein bunter Umschlag rutscht unter der Tür hindurch. Darin steht:' : 'Ein Umschlag rutscht unter der Tür hindurch. Darin steht:', rolle: erz }, { text, rolle: 'brief' }]
        : art === 'anruf' ? [{ text, rolle: 'telefon' }] : art === 'funkspruch' ? [{ text, rolle: 'funk' }]
          : geisterhaft ? [{ text, rolle: erz }, { text: GEISTER[Math.floor(Math.random() * GEISTER.length)], rolle: 'geist', fluestern: true }] : [{ text, rolle: erz }];
      Clavis.Szenen.zeigen(spiel, {
        art, text, sprache, alter: z.raum.alter, welt, sprecher: art === 'anruf' ? 'telefon' : art === 'funkspruch' ? 'funk' : '',
        vorher: () => {
          if (!['anruf', 'funkspruch', 'brief'].includes(art)) Clavis.effekt(spiel, art, text, { alter: z.raum.alter, raum: spiel.querySelector('.cl-raum'), stumm: true, stark });
          if (art === 'regen') k.wetter('starkregen', 24);
          if (art === 'gewitter') { k.wetter('starkregen', 18); k.wetter('sturm', 18); }
          if (art === 'beben' || art === 'explosion') k.wetter('risse', 6);
        },
      }).then(() => {
        const spur = Clavis.Kulisse.SPUR[art];
        if (brief) z.briefe.push({ szene: z.szene, text, gelesen: true });
        if (spur && !(kinder() && spur === 'risse')) (z.spuren[z.szene] || (z.spuren[z.szene] = new Set())).add(spur);
        spurenSetzen(); requisitenMalen(); hudNeu();
      });
    }

    /** Eine Wendung: Zwischenszene (passend zur Welt), dann die Karte mit der Aufgabe */
    function wendungZeigen(d) {
      const g = d.daten || {};
      const ww = weltWendung(d.art);
      const titel = (ww && ww.titel) || (Clavis.AUFGABE[d.art] || {}).titel || '';
      const text = ww ? ((kinder() && ww.kinder) || ww.text) : d.text;
      if (d.art === 'dunkel') z.dunkelBis = Date.now() + (g.sekunden || 60) * 1000;
      if (d.art === 'nebel') { z.nebelBis = Date.now() + (g.sekunden || 45) * 1000; z.nebelStil = (ww && ww.stil) || 'nebel'; }
      if (d.art === 'countdown') z.countdownBis = Date.now() + (g.sekunden || 90) * 1000;
      z.notizen.push(text + (d.art === 'tipp' ? ` (Hinweis für ${g.ort})` : d.art === 'buchstabe' ? ` (${g.stelle + 1}. Buchstabe: ${g.buchstabe})` : ''));
      const ereignis = Clavis.ereignisFuerWelt ? Clavis.ereignisFuerWelt(d.ereignis, z.raum.welt) : d.ereignis;
      Clavis.Szenen.zeigen(spiel, {
        wendung: d.art, gut: d.gut, titel, text, alter: z.raum.alter, welt: z.raum.welt, sprache: [{ text: titel, rolle: kinder() ? 'kind' : 'erzaehler' }, { text, rolle: kinder() ? 'kind' : 'erzaehler' }],
        vorher: () => {
          if (ereignis && !['anruf', 'funkspruch', 'brief'].includes(ereignis)) Clavis.effekt(spiel, ereignis, text, { alter: z.raum.alter, raum: spiel.querySelector('.cl-raum'), stumm: true });
          const r = spiel.querySelector('.cl-raum');
          if (r) { r.classList.toggle('dunkel', z.dunkelBis > Date.now()); r.classList.toggle('vernebelt', z.nebelBis > Date.now()); nebelStil(r); }
        },
      }).then(() => {
        auftragZeigen(d, ww);
        if (d.art === 'geheimfach' && g.szene != null) {
          if (z.szene !== g.szene) gehen(g.szene);
          setTimeout(() => { blickAuf(g.station); markieren([g.station], 12000); }, z.szene !== g.szene ? 1200 : 100);
        }
        if (d.art === 'tipp' && g.station) {
          if (z.offen === g.station) { const alt = spiel.querySelector('.cl-hinweise'); if (alt) alt.replaceWith(hinweisTeil(g.station)); }
          else { blickAuf(g.station); markieren([g.station], 12000); }
        }
        if (d.art === 'blockiert' && g.station) { blickAuf(g.station); markieren([g.station], 4000); }
        if (d.art === 'buchstabe' && g.stelle != null) buchstabeFliegen('', [g.stelle], [g.buchstabe]);
        requisitenMalen();
        hudNeu();
      });
    }
    function nebelStil(r) {
      [...r.classList].filter((c) => c.startsWith('nebel-')).forEach((c) => r.classList.remove(c));
      if (z.nebelBis > Date.now()) r.classList.add('nebel-' + (z.nebelStil || 'nebel'));
    }

    /** Kleine Momente zwischendurch – unheimlich je nach Spuk und Grusel, für Kinder nur Funkeln */
    let momentTakt = null;
    function momente() {
      clearTimeout(momentTakt);
      const st = (z.raum && z.raum.stimmung) || {};
      const staerke = kinder() ? 8 : (st.spuk || 0) + (st.grusel || 0) + (z.raum && z.raum.blut ? 3 : 0);
      if (staerke < 7) return;
      const warten = Math.max(18, 80 - staerke * 3.2) * 1000 * (0.7 + Math.random() * 0.6);
      momentTakt = setTimeout(() => {
        if (!spiel.isConnected) return;
        const b = spiel.querySelector('.cl-raum');
        if (b && imSpiel() && !z.offen) {
          let arten = ['flackern', 'knarren'];
          if (kinder()) arten = ['funkeln', 'plopp'];
          else {
            if (st.spuk >= 5) arten.push('schatten', 'kaelte', 'flackern');
            if (st.grusel >= 5) arten.push('augen', 'atem', 'wackeln', 'schemen');
            if (st.spuk >= 4) arten.push('schemen');
            if (z.raum.blut) arten.push('blutspur', 'blutspur');
          }
          const a = arten[Math.floor(Math.random() * arten.length)];
          if (a === 'knarren' || a === 'atem' || a === 'plopp') k.spielen(a);
          else if (a === 'schemen') { b.classList.add('schemen'); setTimeout(() => b.classList.remove('schemen'), 3400); k.spielen('schritte'); }
          else if (a === 'wackeln') { const o = [...b.querySelectorAll('.cl-req.station:not(.fertig)')]; const x = o[Math.floor(Math.random() * o.length)]; if (x) { x.classList.add('zittern'); setTimeout(() => x.classList.remove('zittern'), 1300); k.spielen('knarren'); } }
          else {
            const m = el('div', { class: 'cl-moment ' + a, style: { '--x': `${10 + Math.random() * 75}%`, '--y': `${15 + Math.random() * 55}%` } });
            b.append(m);
            if (a === 'kaelte') k.spielen('fluestern');
            if (a === 'funkeln') k.spielen('konfetti');
            setTimeout(() => m.remove(), 4200);
          }
        }
        momente();
      }, warten);
    }

    // ---------------------------------------------------------------- Kino-Intro
    function teaserZeilen() {
      const r = z.raum;
      if (r.teaser && r.teaser.length) return r.teaser;
      const saetze = (r.intro.match(/[^.!?…]+[.!?…]+/g) || []).map((x) => x.trim()).filter((x) => x.length <= 80).slice(0, 3);
      return saetze.concat([kinder() ? `Schaffst du es in ${r.minuten} Minuten?` : `Du hast ${r.minuten} Minuten.`]);
    }

    function kino() {
      const r = z.raum;
      const w = Clavis.WELTEN[r.welt] || {};
      const effekt = kinder() ? 'huepfen' : TITEL_EFFEKT[r.welt] || 'schreibmaschine';
      const flaeche = el('div', { class: 'cl-kino-flaeche' });
      const kinoEl = el('div', { class: 'cl-kino' + (kinder() ? ' kinder' : '') + (r.blut ? ' blut' : ''), 'data-effekt': effekt }, flaeche,
        el('button', { class: 'cl-kino-weiter', type: 'button', onclick: kinoEnde }, 'Überspringen ›'));
      spiel.replaceChildren(kinoEl);
      k.bereit();
      k.musik(r.welt, r.alter, r.stimmung);
      k.intensitaet(0.05);
      const titelBlock = el('div', { class: 'cl-kino-titelblock' },
        el('div', { class: 'cl-kino-welt' }, kinder() && w.kinderName ? w.kinderName : w.name || ''),
        el('h1', { class: 'cl-kino-titel' }, [...r.titel].map((c, i) => el('span', { style: { '--i': i } }, c === ' ' ? ' ' : c))),
        el('div', { class: 'cl-kino-unter' }, `${(Clavis.STUFEN[r.stufe] || {}).name || ''} · ${r.minuten} Minuten${schreckEinst().an ? ' · ⚡ Jumpscares' : ''}`));
      const plan = (ms, f) => z.kinoTakte.push(setTimeout(f, ms));
      const dauer = Clavis.Kino.zeigen(flaeche, { raum: r, kinder: kinder(), zeilen: teaserZeilen(), titelBlock, beiTakt: plan, ton: (n) => k.spielen(n), sprich: (t) => Clavis.stimme.sprechen(t, kinder() ? 'kind' : 'trailer') });
      if (!kinder() && r.stimmung && r.stimmung.grusel >= 6) plan(dauer - 2900, () => k.spielen('schrei'));
      plan(dauer, kinoEnde);
    }

    function kinoEnde() {
      Clavis.stimme.stopp();
      z.kinoTakte.forEach(clearTimeout);
      z.kinoTakte = [];
      if (z.kinoGesehen) return;
      z.kinoGesehen = true;
      k.intensitaet(0.15);
      malen();
      if (phase() === 'spiel' && z.introGesehen) { Clavis.tuerAuf(spiel); ersterSchritt(); }
    }

    function eintreten() {
      Clavis.stimme.stopp();
      z.introGesehen = true;
      k.bereit();
      k.intensitaet(0.25);
      malen();
      Clavis.tuerAuf(spiel);
      ersterSchritt();
    }

    /** Die ersten Sekunden im Raum: der Erzähler setzt die Szene, der Blick schweift einmal durch den Raum */
    function ersterSchritt() {
      z.besucht.add(z.szene);
      z.pan = 0;
      z.panZiel = 1;
      setTimeout(() => { z.panZiel = 0.5; }, 2400);
      const sz = z.raum.szenen[z.szene];
      setTimeout(() => {
        if (sz.text) sagen(sz.text);
        sagen(kinder() ? 'Sieh dich um! Alles, was glitzert, kannst du anklicken.' : 'Sieh dich um. Was schimmert, kannst du untersuchen.', 'hilfe');
      }, 1500);
    }

    // ---------------------------------------------------------------- Notizbuch, Intro, Ende
    function notizbuch() {
      const r = z.raum;
      const n = el('div', { class: 'cl-nah', onclick: (e) => { if (e.target === n) n.remove(); } });
      const eigene = Object.entries(z.zettel).filter(([id]) => station(id));
      n.append(el('div', { class: 'cl-nah-rahmen material-papier auf' }, el('div', { class: 'cl-nah-karte cl-notizbuch' },
        el('div', { class: 'cl-nah-kopf' }, el('button', { class: 'cl-zurueck', type: 'button', onclick: () => n.remove() }, '← Zurück'), el('div', { class: 'cl-wachsen' }, el('div', { class: 'cl-nah-ort' }, 'Notizbuch'), el('h3', {}, r.titel))),
        el('p', { class: 'cl-nah-text' }, r.intro),
        eigene.length ? [el('h4', {}, 'Deine Zettel'), eigene.map(([id, zt]) => el('div', { class: 'cl-notiz' }, el('b', {}, station(id).ort + ' – '), zt.text || (zt.zeilen ? `Tabelle mit ${zt.zeilen.length} Einträgen (in der Nahansicht)` : '')))] : null,
        (z.wissen || []).length ? [el('h4', {}, 'Was wir wissen'), el('ol', { class: 'cl-wissen' }, z.wissen.map((t) => el('li', {}, t)))] : null,
        z.notizen.length ? [el('h4', {}, 'Was geschah'), z.notizen.slice().reverse().map((t) => el('div', { class: 'cl-notiz' }, t))] : el('p', { class: 'cl-leise' }, 'Noch nichts notiert.'),
        el('h4', {}, 'So geht’s'),
        el('p', { class: 'cl-leise klein' }, `Sieh dich im Raum um (Maus an den Rand, Mausrad, Pfeiltasten oder wischen) und klicke auf Dinge, die schimmern – auch Dinge ohne Rätsel können etwas verstecken; schwach schimmernde Zeichen an Wand und Boden gehören zu Zeichenschlössern. Jedes gelöste Rätsel bringt Buchstaben für das Lösungswort am Ausgang – oder öffnet eine Tür. Unterwegs passiert einiges: Was zu tun ist, steht oben in der Leiste. Hinweise kosten ${r.hinweisKosten ? zeitText(r.hinweisKosten * 1000) + ' Min.' : 'nichts'}.`))));
      spiel.append(n);
    }

    // ---------------------------------------------------------------- Jumpscares: jedes Gerät entscheidet selbst (an/aus, Stärke 1–10)
    function schreckEinst() {
      const s = z.raum && z.raum.schreck;
      if (!s) return { moeglich: false, an: false, staerke: 0 };
      let an = null; let st = NaN;
      try { an = localStorage.getItem('clavis:schreck'); st = Number(localStorage.getItem('clavis:schreckStaerke')); } catch (_) {}
      if (z.schreckWahl) { an = z.schreckWahl.an ? 'an' : 'aus'; st = z.schreckWahl.staerke || st; }
      const ein = an == null ? !!s.standard : an === 'an';
      let staerke = st >= 1 && st <= 10 ? st : s.staerke || 6;
      if (s.mild) staerke = Math.min(staerke, 4);
      return { moeglich: true, an: ein, staerke, mild: !!s.mild };
    }
    function schreckSetzen(an, staerke) {
      const e = schreckEinst();
      z.schreckWahl = { an, staerke: staerke || e.staerke };
      try { localStorage.setItem('clavis:schreck', an ? 'an' : 'aus'); localStorage.setItem('clavis:schreckStaerke', String(staerke || e.staerke)); } catch (_) {}
    }
    /** Am Eingang gut sichtbar: Jumpscares erlauben? Und wie stark? */
    function schreckWahl() {
      const e = schreckEinst();
      if (!e.moeglich) return null;
      const max = e.mild ? 4 : 10;
      const beschreibung = el('div', { class: 'cl-schreck-beschreibung' }, Clavis.schreckText(e.staerke, e.mild));
      const ausgabe = el('output', {}, String(e.staerke));
      const regler = el('input', { type: 'range', min: '1', max: String(max), step: '1', value: String(e.staerke), 'aria-label': 'Stärke der Jumpscares', oninput: (ev) => { const v = Number(ev.target.value); ausgabe.textContent = String(v); beschreibung.textContent = Clavis.schreckText(v, e.mild); schreckSetzen(true, v); } });
      const panel = el('div', { class: 'cl-schreck-wahl' + (e.an ? '' : ' aus') },
        el('div', { class: 'cl-schreck-kopf' }, el('span', { style: { fontSize: '26px' } }, '⚡'),
          el('b', {}, 'Jumpscares erlauben?', el('small', {}, e.mild ? 'Nur kleine Schreckmomente: Fledermäuse, Spinnen, eine Katze.' : 'Plötzliche Schreckmomente im Raum – gilt nur für dieses Gerät.')),
          el('button', { class: 'cl-schalter-gross' + (e.an ? ' an' : ''), type: 'button', role: 'switch', 'aria-checked': String(e.an), 'aria-label': 'Jumpscares erlauben', onclick: () => { schreckSetzen(!schreckEinst().an); panel.replaceWith(schreckWahl()); } })),
        e.an ? [el('div', { class: 'cl-schreck-regler' }, el('small', {}, 'Stärke'), regler, ausgabe), beschreibung,
          el('button', { class: 'cl-knopf zart klein cl-schreck-probe', type: 'button', onclick: () => { k.bereit(); const a = schreckEinst(); Clavis.schreck(spiel, a.mild ? 'fledermaeuse' : 'fratze', { blut: z.raum.blut, staerke: a.staerke }); } }, 'Probe ansehen')] : null);
      return panel;
    }

    /** Die gezeichnete Außenansicht der Welt – langsam bewegt, als Hintergrund für Einleitung und Ende */
    function aussenBild() {
      const a = (Clavis.Kino.AUSSEN[z.raum.welt] || Clavis.Kino.AUSSEN.akademie)(kinder());
      const b = el('div', { class: 'cl-intro-bild', style: { transformOrigin: `${a.fokus[0]}% ${a.fokus[1]}%` } });
      b.innerHTML = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="cl-aussen">${a.svg}</svg>`;
      return el('div', { class: 'cl-intro-hinten' + (kinder() ? ' kinder' : '') }, b, el('div', { class: 'cl-film-wetter w-' + (kinder() && (a.wetter === 'gewitter' || a.wetter === 'nebel') ? 'sterne' : a.wetter) }));
    }

    function intro() {
      const r = z.raum;
      const w = Clavis.WELTEN[r.welt] || {};
      const text = el('p', { class: 'cl-intro-text' });
      if (!z.introGesprochen) { z.introGesprochen = true; setTimeout(() => { if (text.isConnected) Clavis.stimme.sprechen(r.intro, kinder() ? 'kind' : 'erzaehler'); }, 700); }
      let i = 0;
      const tippen = () => { if (!text.isConnected) return; text.textContent = r.intro.slice(0, i); i += 2; if (i % 12 === 0) k.spielen('klick'); if (i <= r.intro.length + 1) setTimeout(tippen, 20); };
      setTimeout(tippen, 500);
      const p = phase();
      const spieler = (z.stand && z.stand.spieler) || [];
      return el('div', { class: 'cl-intro' },
        aussenBild(),
        el('div', { class: 'cl-intro-karte' },
          el('div', { class: 'cl-intro-welt' }, `${kinder() && w.kinderName ? w.kinderName : w.name || ''} · ${(Clavis.STUFEN[r.stufe] || {}).name || ''} · ${r.minuten} Minuten`),
          el('h1', { class: 'cl-intro-titel' }, r.titel),
          text,
          schreckWahl(),
          p === 'lobby' && spieler.length > 1 ? el('div', { class: 'cl-intro-team' }, el('span', { class: 'cl-leise' }, 'Im Team: '), spieler.map((s) => s.name).join(', ')) : null,
          p === 'lobby'
            ? (host ? el('button', { class: 'cl-knopf gross puls', type: 'button', onclick: () => host.starten() }, 'Eintreten – die Zeit läuft')
              : el('div', { class: 'cl-leise cl-warten' }, 'Gleich geht es los – der Host öffnet die Tür …'))
            : el('button', { class: 'cl-knopf gross puls', type: 'button', onclick: eintreten }, 'Eintreten')));
    }

    function endeAnsicht() {
      const e = z.ende;
      const r = z.raum;
      return el('div', { class: 'cl-intro ende' + (e.geschafft ? ' geschafft' : '') },
        aussenBild(),
        el('div', { class: 'cl-intro-karte' },
          el('div', { class: 'cl-intro-welt' }, e.geschafft ? 'Entkommen' : 'Die Tür blieb zu'),
          el('h1', { class: 'cl-intro-titel' }, e.geschafft ? 'Geschafft!' : 'Nicht diesmal'),
          e.geschafft ? el('div', { class: 'cl-sterne' }, [1, 2, 3].map((i) => el('span', { class: i <= e.sterne ? 'an' : '', style: { '--d': `${i * 200}ms` } }, '★'))) : null,
          el('div', { class: 'cl-ende-zahlen' },
            el('div', {}, el('b', {}, zeitText(e.zeit)), el('span', {}, 'Zeit')),
            el('div', {}, el('b', {}, String(e.hinweise)), el('span', {}, 'Hinweise')),
            el('div', {}, el('b', {}, `${e.geloest}/${e.stationen}`), el('span', {}, 'Rätsel'))),
          el('p', { class: 'cl-intro-text' }, e.geschafft ? r.outro : `Das Lösungswort war ${e.wort}.`),
          host ? el('button', { class: 'cl-knopf', type: 'button', onclick: () => host.fertig() }, 'Fertig') : el('p', { class: 'cl-leise klein' }, 'Danke fürs Mitspielen! Du kannst die Seite schließen.')));
    }

    // ---------------------------------------------------------------- Zeichnen
    function malen() {
      if (z.vorbei) {
        k.musikStoppen();
        spiel.removeAttribute('data-welt');
        spiel.replaceChildren(el('div', { class: 'cl-leer' }, el('div', { class: 'cl-schluessel-gross' }, Clavis.icon('schluessel')), el('h2', {}, z.vorbei === 'entfernt' ? 'Du wurdest abgemeldet' : 'Das Spiel ist vorbei'), el('p', { class: 'cl-leise' }, 'Du kannst die Seite schließen.')));
        return;
      }
      if (!z.raum) {
        spiel.replaceChildren(el('div', { class: 'cl-leer' }, el('div', { class: 'cl-schluessel-gross drehen' }, Clavis.icon('schluessel')), el('h2', {}, 'Clavis'), el('p', { class: 'cl-leise' }, 'Der Raum wird vorbereitet …')));
        return;
      }
      spiel.setAttribute('data-welt', z.raum.welt);
      spiel.setAttribute('data-alter', z.raum.alter || 'ab14');
      const offen = z.offen;
      if (z.ende) { spiel.replaceChildren(endeAnsicht()); return; }
      if (!z.kinoGesehen) { kino(); return; }
      if (phase() === 'lobby' || !z.introGesehen) { spiel.replaceChildren(intro()); return; }
      spiel.replaceChildren(hud(), raumAnsicht(), unten(), erzEl);
      requestAnimationFrame(() => { const h = spiel.querySelector('.cl-hud'); if (h) spiel.style.setProperty('--hud-h', `${h.offsetHeight}px`); });
      z.zuletztGemalteSzene = z.szene;
      if (offen) {
        z.offen = offen;
        const kam = spiel.querySelector('.cl-kamera');
        if (kam) kam.classList.add('zoom', 'sofort');
        nahMalen(true);
      }
    }

    // Jede Sekunde: Uhr, Ziel, Dunkelheit/Nebel, verriegelte Rätsel, Musik-Intensität, Herzschlag, Anstupsen
    const takt = setInterval(() => {
      if (!spiel.isConnected) { clearInterval(takt); k.musikStoppen(); return; }
      const jetzt = Date.now();
      const u = spiel.querySelector('#cl-uhr');
      const rest = z.endeZeit != null ? z.endeZeit - jetzt : null;
      if (u) {
        u.textContent = uhrText();
        u.parentElement.classList.toggle('knapp', rest != null && rest < 5 * 60000);
        u.parentElement.classList.toggle('ueber', rest != null && rest < 0);
      }
      const zi = spiel.querySelector('#cl-ziel');
      if (zi && z.raum) { const x = ziel(); zi.textContent = x.text; zi.className = 'cl-ziel ' + x.art; }
      if (z.countdownBis && z.countdownBis > jetzt && z.countdownBis - jetzt < 30000 && !kinder()) k.spielen('klick');
      const raum = spiel.querySelector('.cl-raum');
      if (raum) { raum.classList.toggle('dunkel', z.dunkelBis > jetzt); raum.classList.toggle('vernebelt', z.nebelBis > jetzt); raum.classList.toggle('alarm', z.countdownBis > jetzt); }
      // Läuft die Zeit ab, verfällt der Raum – Stufe für Stufe, mit einem Satz vom Erzähler
      if (imSpiel()) {
        if (k.ambienteWelt() !== z.raum.welt) k.ambiente(z.raum.welt, z.raum.alter);
        const stufe = zeitStufe();
        if (stufe !== z.zeitStufe) {
          if (stufe > z.zeitStufe && z.bau) sagen(Clavis.Kulisse.verfallText(z.bau.verfallArt, stufe, kinder()), 'warnung');
          z.zeitStufe = stufe;
        }
        if (z.bau) k.verfall(z.bau.verfallArt, stufe);
        if (raum && raum.dataset.zeit !== String(stufe)) raum.dataset.zeit = String(stufe);
        if (raum) nebelStil(raum);
      }
      if (z.offen && z.offen !== 'finale') {
        const n = spiel.querySelector('.cl-nah');
        const zu = blockiertMs(z.offen) > 0 && !geloest(z.offen);
        if (n && (n.dataset.zu === '1') !== zu) nahMalen(false);
        const zt = spiel.querySelector('#cl-verriegelt-zeit');
        if (zt) zt.textContent = `noch ${Math.max(0, Math.ceil(blockiertMs(z.offen) / 1000))} Sekunden – versuch solange etwas anderes`;
      }
      spiel.querySelectorAll('.cl-req.blockiert').forEach((o) => { if (blockiertMs(o.dataset.id) <= 0) requisitenMalen(); });
      if (z.countdownBis && z.countdownBis <= jetzt) { z.countdownBis = null; requisitenMalen(); }
      if (imSpiel() && z.raum) {
        const anteil = rest != null ? rest / (z.raum.minuten * 60000) : 1;
        k.intensitaet(Math.max(0.2, Math.min(1, (1 - anteil) * 0.9 + (z.countdownBis > jetzt ? 0.4 : 0))));
        const st = z.raum.stimmung || {};
        if (st.spannung >= 6 && rest != null && rest > 0 && anteil < 0.2 && Math.floor(rest / 1000) % (st.spannung >= 9 ? 2 : 3) === 0) k.spielen('herz');
        // Lange nichts passiert: sanft auf etwas Ungelöstes zeigen (kein Hinweis, nur ein Blick)
        if (!z.offen && !(Clavis.Szenen && Clavis.Szenen.aktiv()) && jetzt - z.letzterFortschritt > 140000) {
          const offen = stationenDerSzene(z.szene).filter((id) => !geloest(id) && blockiertMs(id) <= 0);
          if (offen.length) {
            const id = offen[Math.floor(Math.random() * offen.length)];
            sagen(kinder() ? `Psst … schau mal bei „${station(id).ort}“!` : `Vielleicht lohnt sich ein genauerer Blick auf „${station(id).ort}“ …`, 'hilfe');
            blickAuf(id);
            markieren([id], 7000);
          } else if (z.szene < z.raum.szenen.length - 1 && szeneOffen(z.szene + 1)) sagen('Hier ist alles erledigt – die Tür rechts führt weiter.', 'hilfe');
          z.letzterFortschritt = jetzt - 70000;
        }
      }
    }, 1000);

    // Tastatur: Esc tritt zurück, Pfeile sehen sich um
    const tasten = (e) => {
      if (!spiel.isConnected) { document.removeEventListener('keydown', tasten); return; }
      if (e.key === 'Escape') {
        const a = spiel.querySelector('.cl-auftrag');
        if (a) { a.remove(); return; }
        if (z.offen) { schliessen(); return; }
        const n = spiel.querySelector('.cl-nah');
        if (n) n.remove();
      }
      if (!z.offen && imSpiel() && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) {
        if (e.key === 'ArrowLeft') z.panZiel = Math.max(0, z.panZiel - 0.25);
        if (e.key === 'ArrowRight') z.panZiel = Math.min(1, z.panZiel + 0.25);
      }
    };
    document.addEventListener('keydown', tasten);

    function empfangen(d) {
      if (!d || typeof d !== 'object') return;
      switch (d.typ) {
        case 'raum': {
          const erstes = !z.raum;
          z.raum = d.raum;
          if (erstes) z.szene = 0;
          const st = d.raum.stimmung || {};
          for (const [n2, v] of Object.entries(st)) { spiel.style.setProperty('--' + n2, String(v / 10)); spiel.classList.toggle('stark-' + n2, v >= 6 && d.raum.alter !== 'kinder'); }
          spiel.classList.toggle('mit-blut', !!d.raum.blut);
          momente();
          if (erstes) malen();
          break;
        }
        case 'stand': {
          const vorher = z.stand;
          z.stand = d;
          z.standZeit = Date.now();
          if (typeof d.restMs === 'number') z.endeZeit = Date.now() + d.restMs;
          z.countdownBis = d.countdown != null ? Date.now() + d.countdown : null;
          if (d.phase !== 'lobby' && vorher && vorher.phase === 'lobby' && z.kinoGesehen) { eintreten(); break; }
          if (d.phase !== 'lobby' && vorher && vorher.phase === 'lobby') z.introGesehen = true;
          // Neue Tür offen: sie schwingt auf, der Erzähler sagt es
          if (vorher && d.szenen) d.szenen.forEach((o, i) => {
            if (o && !(vorher.szenen || [])[i] && i > 0) {
              z.tuerOeffnet = i;
              setTimeout(() => { z.tuerOeffnet = null; }, 2500);
              k.spielen('tueroeffnen');
              sagen(kinder() ? `Juhu! Die Tür nach „${z.raum.szenen[i].titel}“ ist offen!` : `Mit einem Knarzen schwingt die Tür nach „${z.raum.szenen[i].titel}“ auf.`);
            }
          });
          const offen = z.offen;
          if (z.raum && !z.ende && z.kinoGesehen) {
            if (phase() === 'lobby' || !z.introGesehen) { if (!vorher || vorher.phase !== d.phase || JSON.stringify(vorher.spieler) !== JSON.stringify(d.spieler)) malen(); }
            else if (!spiel.querySelector('.cl-raum') || z.zuletztGemalteSzene !== z.szene) malen();
            else {
              requisitenMalen();
              hudNeu();
              untenNeu();
              if (offen) {
                // Nahansicht nur neu, wenn sich dort etwas geändert hat (sonst bliebe ein halb gelöstes Rätsel nicht stehen)
                const war = vorher && (offen === 'finale' ? !!vorher.finale : !!(vorher.geloest || {})[offen]);
                const ist = offen === 'finale' ? !!d.finale : !!(d.geloest || {})[offen];
                const hw = JSON.stringify(((vorher && vorher.hinweise) || {})[offen] || []) !== JSON.stringify((d.hinweise || {})[offen] || []);
                const zb = JSON.stringify(((vorher && vorher.zettelBei) || {})[offen] || '') !== JSON.stringify((d.zettelBei || {})[offen] || '');
                const blWar = !!(vorher && vorher.blockiert && vorher.blockiert[offen]);
                const blIst = !!(d.blockiert && d.blockiert[offen]);
                if (war !== ist || blWar !== blIst) nahMalen(false);
                else if (hw || zb) {
                  const alt = spiel.querySelector('.cl-hinweise');
                  if (alt) alt.replaceWith(hinweisTeil(offen));
                  const zt = spiel.querySelector('.cl-zettel');
                  if (zb && zt) zt.replaceWith(zettelTeil(offen) || el('span'));
                }
              }
            }
          }
          break;
        }
        case 'zettel':
          z.zettel[d.station] = d.zettel;
          if (z.offen === d.station) { const zt = spiel.querySelector('.cl-zettel'); if (zt) zt.replaceWith(zettelTeil(d.station)); }
          if (z.stand && z.stand.spieler && z.stand.spieler.length > 1 && station(d.station)) toast(`Du hast einen Zettel: ${station(d.station).ort}`, '');
          break;
        case 'antwort': {
          const ok = z.wartend.get(d.nr);
          if (ok) { z.wartend.delete(d.nr); ok({ richtig: !!d.richtig, info: d.info || '', falle: d.falle || 0 }); }
          break;
        }
        case 'geloest': {
          if (z.gesehenGeloest.has(d.station)) break;
          z.gesehenGeloest.add(d.station);
          z.letzterFortschritt = Date.now();
          z.frisch.set(d.station, Date.now());
          const s = station(d.station);
          k.spielen('auf');
          if (kinder()) { Clavis.konfetti(spiel); setTimeout(() => k.spielen('fanfare'), 300); }
          const team = z.stand && z.stand.spieler && z.stand.spieler.length > 1;
          const b = d.belohnung || {};
          if (s) {
            const wer = d.name && d.von !== ich.id && team ? `${d.name} hat „${s.ort}“ gelöst. ` : '';
            const lohn = b.art === 'fragment' ? `${b.buchstaben.length > 1 ? 'Die Buchstaben' : 'Der Buchstabe'} ${b.buchstaben.join(', ')} – ab ins Lösungswort!` : b.art === 'zeit' ? 'Zwei Minuten geschenkt!' : b.art === 'tuer' ? '' : '';
            sagen(`${wer}${Clavis.ERFOLG[s.mech] || 'Geschafft!'} ${lohn}`.trim(), 'erfolg');
            z.notizen.push(`${s.ort}: gelöst${d.name && team ? ` (${d.name})` : ''}${b.art === 'fragment' ? ` – Buchstaben ${b.buchstaben.join(', ')}` : b.art === 'zeit' ? ' – 2 Minuten geschenkt' : ''}`);
          }
          if (b.art === 'fragment') setTimeout(() => buchstabeFliegen(d.station, b.stellen, b.buchstaben), z.offen ? 1400 : 300);
          if (d.geschichte) { z.wissen = z.wissen || []; if (!z.wissen.includes(d.geschichte)) z.wissen.push(d.geschichte); setTimeout(() => sagen(d.geschichte, 'geschichte'), 1600); }
          if (s && s.mech === 'fehlteil') { z.inventar = z.inventar.filter((x) => x.fuer !== d.station); setTimeout(untenNeu, 300); }
          if (d.ereignis) setTimeout(() => ereignisZeigen(d.ereignis.art, d.ereignis.text), 2400);
          break;
        }
        case 'hinweis':
          k.spielen('hinweis');
          if (d.name && d.von !== ich.id && station(d.station)) toast(`${d.name} hat einen Hinweis genommen (${station(d.station).ort})`);
          break;
        case 'ereignis':
          if (imSpiel()) ereignisZeigen(d.art, d.text);
          else z.notizen.push(d.text || '');
          break;
        case 'wendung':
          if (imSpiel()) wendungZeigen(d);
          else z.notizen.push(d.text);
          break;
        case 'wendung_ende':
          k.spielen(d.erfolg ? 'erfolg' : 'falle');
          if (!d.erfolg && !kinder()) falleZeigen(120);
          sagen(d.text, d.erfolg ? 'erfolg' : 'warnung');
          z.countdownBis = null;
          hudNeu();
          requisitenMalen();
          z.notizen.push(d.text);
          break;
        case 'schreck':
          if (imSpiel() && z.raum.schreck && schreckEinst().an && !(Clavis.Szenen && Clavis.Szenen.aktiv())) Clavis.schreck(spiel, d.art, { blut: z.raum.blut, staerke: schreckEinst().staerke });
          break;
        case 'ende': {
          const imRaum = !!spiel.querySelector('.cl-raum') && !z.ende;
          z.ende = d.ergebnis;
          z.offen = null;
          k.musikStoppen();
          k.ambienteStoppen();
          const danach = () => { k.spielen(d.ergebnis.geschafft ? 'ende' : 'falsch'); if (d.ergebnis.geschafft && kinder()) setTimeout(() => Clavis.konfetti(spiel), 300); malen(); };
          if (imRaum && Clavis.Szenen) Clavis.Szenen.outro(spiel, { raum: z.raum, ergebnis: d.ergebnis, kinder: kinder() }).then(danach);
          else danach();
          break;
        }
        case 'vorbei': case 'entfernt':
          k.ambienteStoppen();
          z.vorbei = d.typ;
          z.kinoTakte.forEach(clearTimeout);
          malen();
          break;
        default:
      }
    }

    malen();
    return { empfangen, element: spiel };
  }

  Clavis.Spiel = { erstellen };
})();
