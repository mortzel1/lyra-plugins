'use strict';
/*
 * Clavis – die Spielansicht: Kino-Intro, Szene mit Objekten, Nahaufnahme je Station, Fundstücke, Zeit, Hinweise,
 * Notizbuch, Ereignisse, Wendungen (Dunkelheit, Nebel, Countdown, verriegelte Rätsel, Geheimfach …), Jumpscares und Ende.
 * Dieselbe Ansicht in Lyra (allein oder als Host) und im Browser (Mitspielende). Sie kennt keine Lösungen: Jede Antwort
 * geht an den Spielleiter (beim Host) und kommt als richtig/falsch zurück.
 *
 *   const s = Clavis.Spiel.erstellen(wurzel, { senden, ich, host: { starten, beenden, fertig } | null });
 *   s.empfangen({ typ: 'raum' | 'stand' | 'zettel' | 'antwort' | 'geloest' | 'hinweis' | 'ereignis' | 'wendung' |
 *                 'wendung_ende' | 'schreck' | 'ende' | 'vorbei' | 'entfernt', … })
 */
(() => {
  const { el } = Clavis;
  const zeitText = (ms) => { const s = Math.max(0, Math.round(Math.abs(ms) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const KULISSE = {
    krimi: ['regen', 'jalousie', 'lampe'], labor: ['raster', 'scan', 'blasen'], grab: ['fackel l', 'fackel r', 'sand', 'zeichen'], station: ['sterne', 'bullauge', 'warnlicht'],
    spuk: ['mond', 'nebel', 'nebel zwei', 'kerzenlicht'], bibliothek: ['regale', 'staub', 'glanz'], pirat: ['planken', 'wellen', 'laterne'], akademie: ['tafel', 'fenster', 'mond'],
    zirkus: ['zeltbahnen', 'scheinwerfer', 'staub'], dschungel: ['blaetter', 'gluehwuermchen', 'nebel'], unterwasser: ['lichtwellen', 'blasen', 'bullauge'],
    spielzeug: ['tapete', 'sterne', 'glanz'], western: ['sonne', 'staub', 'planken'], sanatorium: ['kacheln', 'roehre', 'flecken', 'nebel'],
  };
  const TITEL_EFFEKT = { krimi: 'schreibmaschine', bibliothek: 'schreibmaschine', akademie: 'schreibmaschine', western: 'schreibmaschine', labor: 'glitch', station: 'glitch', unterwasser: 'glitch',
    spuk: 'flackern', sanatorium: 'flackern', grab: 'sand', dschungel: 'sand', pirat: 'sand', zirkus: 'huepfen', spielzeug: 'huepfen' };

  function erstellen(wurzel, { senden, ich, host = null }) {
    const z = {
      raum: null, stand: null, szene: 0, offen: null, zettel: {}, notizen: [], kinoGesehen: false, introGesehen: false, vorbei: '', ende: null,
      wartend: new Map(), nr: 0, endeZeit: null, gesehenGeloest: new Set(), dunkelBis: 0, nebelBis: 0, countdownBis: null, schreckLokal: false, kinoTakte: [],
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

    function toast(text, art = '') {
      const t = el('div', { class: 'cl-toast ' + art }, text);
      spiel.append(t);
      setTimeout(() => t.classList.add('weg'), 3600);
      setTimeout(() => t.remove(), 4100);
    }

    function wortLeiste() {
      const w = (z.stand && z.stand.wort) || new Array(z.raum.finale.laenge).fill(null);
      return el('div', { class: 'cl-wort', title: 'Das Lösungswort für den Ausgang' }, w.map((b, i) => el('span', { class: 'cl-wort-feld' + (b ? ' voll' : ''), 'data-i': i }, b || '')));
    }

    function uhrText() {
      if (!z.stand || z.stand.phase === 'lobby' || z.endeZeit == null) return z.raum ? `${z.raum.minuten}:00` : '';
      const rest = z.endeZeit - Date.now();
      return rest >= 0 ? zeitText(rest) : '+' + zeitText(rest);
    }

    function hud() {
      const r = z.raum;
      const rest = z.endeZeit != null ? z.endeZeit - Date.now() : null;
      return el('div', { class: 'cl-hud' },
        el('div', { class: 'cl-hud-titel' }, el('span', { class: 'cl-marke' }, 'Clavis'), el('b', {}, r.titel)),
        el('div', { class: 'cl-uhr-anzeige' + (rest != null && rest < 5 * 60000 ? ' knapp' : '') + (rest != null && rest < 0 ? ' ueber' : '') }, el('span', { id: 'cl-uhr' }, uhrText())),
        wortLeiste(),
        el('div', { class: 'cl-hud-knoepfe' },
          z.stand && z.stand.spieler && z.stand.spieler.length > 1 ? el('span', { class: 'cl-team', title: z.stand.spieler.map((s) => s.name).join(', ') }, `👥 ${z.stand.spieler.length}`) : null,
          el('button', { class: 'cl-hud-knopf', type: 'button', title: 'Notizbuch', onclick: notizbuch }, '📓'),
          el('button', { class: 'cl-hud-knopf' + (k.musikAn() ? '' : ' aus'), type: 'button', title: k.musikAn() ? 'Musik aus' : 'Musik an', onclick: () => { k.musikSchalten(!k.musikAn()); hudNeu(); } }, '♫'),
          el('button', { class: 'cl-hud-knopf', type: 'button', title: k.an() ? 'Ton aus' : 'Ton an', onclick: () => { k.schalten(!k.an()); hudNeu(); } }, k.an() ? '🔊' : '🔈'),
          host ? el('button', { class: 'cl-hud-knopf', type: 'button', title: 'Spiel beenden', onclick: () => host.beenden() }, '⏻') : null),
        z.countdownBis ? el('div', { class: 'cl-countdown' }, el('div', { class: 'cl-countdown-balken', id: 'cl-countdown-balken' }), el('span', { id: 'cl-countdown-text' }, '')) : null);
    }
    const hudNeu = () => { const h = spiel.querySelector('.cl-hud'); if (h) h.replaceWith(hud()); };

    function blutDeko() {
      const tropfen = [];
      for (let i = 0; i < 9; i++) tropfen.push(el('i', { style: { left: `${4 + Math.random() * 92}%`, height: `${20 + Math.random() * 90}px`, animationDelay: `${Math.random() * 6}s`, width: `${4 + Math.random() * 6}px` } }));
      const hand = () => el('svg', { viewBox: '0 0 200 240', class: 'cl-handabdruck', style: { left: `${5 + Math.random() * 80}%`, top: `${20 + Math.random() * 50}%`, transform: `rotate(${-30 + Math.random() * 60}deg)` } },
        el('path', { d: 'M60 230 C40 180 30 150 34 120 C36 105 52 104 56 118 L62 140 L58 52 C57 38 76 36 78 50 L84 118 L86 30 C86 14 106 14 106 30 L106 116 L114 40 C116 26 134 28 132 44 L126 122 L140 70 C144 56 162 60 158 76 L146 150 C140 190 132 210 130 230 Z' }));
      return [el('div', { class: 'cl-deko blut' }, tropfen), el('div', { class: 'cl-deko handabdruecke' }, hand(), Math.random() < 0.6 ? hand() : null)];
    }

    function kulisse(welt) {
      const teile = (KULISSE[welt] || []).slice();
      const st = (z.raum && z.raum.stimmung) || {};
      if (!kinder()) {
        if (st.spuk >= 4) teile.push('geist');
        if (st.spuk >= 7) teile.push('geist zwei');
        if (st.grusel >= 4) teile.push('schatten');
        if (st.grusel >= 6) teile.push('augen');
        if (st.gefahr >= 6) teile.push('gefahr-rand');
      } else teile.push('funkeln');
      return el('div', { class: 'cl-kulisse' }, teile.map((t) => el('div', { class: 'cl-deko ' + t })), z.raum && z.raum.blut ? blutDeko() : null);
    }

    function buehne() {
      const r = z.raum;
      const sz = r.szenen[z.szene];
      const letzte = z.szene === r.szenen.length - 1;
      setTimeout(() => { z.belebt = z.szene; }, 0);
      const bonus = (r.bonus || []).filter((id) => z.stand && z.stand.sichtbar && z.stand.sichtbar[id] === z.szene);
      const objekte = sz.stationen.concat(bonus).map((id, i) => {
        const s = station(id);
        const fertig = geloest(id);
        const zu = !fertig && blockiertMs(id) > 0;
        return el('button', { class: 'cl-objekt' + (fertig ? ' fertig' : '') + (s.tuer ? ' tuer-station' : '') + (s.bonus ? ' bonus' : '') + (zu ? ' blockiert' : ''), 'data-id': id, type: 'button', style: { '--v': `${(i % 3) * 6 - 6}px`, '--d': `${i * 70}ms` }, onclick: () => oeffnen(id) },
          el('div', { class: 'cl-objekt-licht' }),
          el('div', { class: 'cl-objekt-bild' }, Clavis.icon(s.symbol)),
          el('div', { class: 'cl-objekt-name' }, s.ort),
          fertig ? el('div', { class: 'cl-objekt-haken' }, '✓') : null,
          s.bonus && !fertig ? el('div', { class: 'cl-objekt-neu' }, 'Bonus') : null,
          zu ? el('div', { class: 'cl-objekt-kette' }, '⛓') : null,
          !fertig && z.stand && z.stand.hinweise && z.stand.hinweise[id] && z.stand.hinweise[id].length ? el('div', { class: 'cl-objekt-tipp' }, '?') : null);
      });
      if (letzte) {
        objekte.push(el('button', { class: 'cl-objekt ausgang' + (z.stand && z.stand.finale ? ' fertig' : ''), type: 'button', onclick: () => oeffnen('finale') },
          el('div', { class: 'cl-objekt-licht' }), el('div', { class: 'cl-objekt-bild' }, Clavis.icon('ausgang')), el('div', { class: 'cl-objekt-name' }, 'Ausgang')));
      }
      const jetzt = Date.now();
      const b = el('div', { class: 'cl-buehne' + (z.dunkelBis > jetzt ? ' dunkel' : '') + (z.nebelBis > jetzt ? ' vernebelt' : '') },
        kulisse(r.welt),
        r.szenen.length > 1 ? el('div', { class: 'cl-szenen' }, r.szenen.map((s, i) => el('button', {
          class: 'cl-szene-reiter' + (i === z.szene ? ' an' : '') + (szeneOffen(i) ? '' : ' zu'), type: 'button', disabled: !szeneOffen(i),
          onclick: () => { z.szene = i; k.spielen('tuer'); malen(); },
        }, szeneOffen(i) ? s.titel : '🔒 ' + s.titel))) : null,
        el('div', { class: 'cl-szene-kopf' }, el('h2', {}, sz.titel), sz.text ? el('p', {}, sz.text) : null),
        el('div', { class: 'cl-objekte' + (z.belebt !== z.szene ? ' neu' : '') }, objekte),
        el('div', { class: 'cl-taschenlampe' }), el('div', { class: 'cl-nebelschicht' }));
      b.addEventListener('pointermove', (e) => { const q = b.getBoundingClientRect(); b.style.setProperty('--lx', `${e.clientX - q.left}px`); b.style.setProperty('--ly', `${e.clientY - q.top}px`); });
      return b;
    }

    // ---------------------------------------------------------------- Nahaufnahme
    function oeffnen(id) {
      if (!imSpiel()) return;
      z.offen = id;
      k.spielen('papier');
      nahMalen(true);
      // Jumpscare beim Öffnen – einmal, zufällig
      const sch = z.raum.schreck;
      if (sch && !z.schreckLokal && id !== 'finale' && Math.random() < 0.14) {
        z.schreckLokal = true;
        setTimeout(() => { if (z.offen === id) Clavis.schreck(spiel, sch.arten[Math.floor(Math.random() * sch.arten.length)], { blut: z.raum.blut }); }, 650 + Math.random() * 900);
      }
    }

    function schliessen() {
      z.offen = null;
      const n = spiel.querySelector('.cl-nah');
      if (n) { n.classList.add('weg'); setTimeout(() => n.remove(), 250); }
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
          kosten ? `Hinweis nehmen (kostet ${kosten >= 60 ? `${kosten / 60} Min.` : `${kosten} s`})` : 'Hinweis nehmen') : null,
        !geloest(id) && l.length >= max && max ? el('div', { class: 'cl-leise klein' }, 'Keine Hinweise mehr für dieses Rätsel.') : null);
    }

    function belohnungTeil(id) {
      const g = z.stand.geloest[id];
      const s = station(id);
      const b = g && g.belohnung;
      return el('div', { class: 'cl-belohnung' },
        el('div', { class: 'cl-belohnung-schloss' }, Clavis.icon(s.symbol)),
        el('div', { class: 'cl-belohnung-titel' }, 'Gelöst', g.name && z.stand.spieler && z.stand.spieler.length > 1 ? ` – von ${g.name}` : ''),
        b && b.art === 'fragment' ? el('div', { class: 'cl-fragment' }, el('span', {}, b.bonus ? 'Bonus-Fundstück' : 'Fundstück'), el('div', { class: 'cl-fragment-steine' }, b.stellen.map((st, i) => el('div', { class: 'cl-fragment-stein' }, el('b', {}, b.buchstaben[i]), el('small', {}, `${st + 1}. Stelle`))))) : null,
        b && b.art === 'tuer' ? el('div', { class: 'cl-fragment' }, el('span', {}, 'Ein Weg öffnet sich'), el('b', {}, `→ ${z.raum.szenen[b.szene].titel}`)) : null,
        b && b.art === 'zeit' ? el('div', { class: 'cl-fragment' }, el('span', {}, 'Bonus'), el('b', { class: 'cl-zeitbonus' }, '+2:00')) : null);
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
      const api = {
        loesen: async (antwort) => {
          const r = await anfrage(finale ? { typ: 'finale', antwort } : { typ: 'loesen', station: id, antwort });
          if (!r.richtig) {
            k.spielen('falsch');
            const karte = n.querySelector('.cl-nah-karte');
            if (karte) { karte.classList.remove('wackeln'); void karte.offsetWidth; karte.classList.add('wackeln'); }
            if (r.info) toast(r.info, 'falsch');
            if (r.falle) falleZeigen(r.falle);
          }
          return r;
        },
        ton: (x) => k.spielen(x),
        stufe: z.raum.stufe,
        welt: z.raum.welt,
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
      n.replaceChildren(el('div', { class: 'cl-nah-karte' + (neu ? ' auf' : '') },
        el('div', { class: 'cl-nah-kopf' },
          el('div', { class: 'cl-nah-symbol' }, Clavis.icon(finale ? 'ausgang' : s.symbol)),
          el('div', { class: 'cl-wachsen' }, el('div', { class: 'cl-nah-ort' }, finale ? 'Ausgang' : s.ort), el('h3', {}, finale ? 'Das letzte Schloss' : s.titel)),
          el('button', { class: 'cl-schliessen', type: 'button', 'aria-label': 'Schließen', onclick: schliessen }, '✕')),
        finale ? el('p', { class: 'cl-nah-text' }, z.raum.finale.text || 'Die Tür nach draußen hat ein Buchstabenschloss. Die Fundstücke ergeben das Wort.') : s.text ? el('p', { class: 'cl-nah-text' }, s.text) : null,
        fertig ? (finale ? el('div', { class: 'cl-belohnung' }, el('div', { class: 'cl-belohnung-titel' }, 'Offen!')) : belohnungTeil(id)) : null,
        zu ? el('div', { class: 'cl-verriegelt' }, el('div', { class: 'cl-verriegelt-kette' }, '⛓'), el('b', {}, 'Verriegelt'), el('span', { id: 'cl-verriegelt-zeit' }, `noch ${Math.ceil(blockiertMs(id) / 1000)} Sekunden`)) : null,
        !fertig && !finale && !zu ? zettelTeil(id) : null,
        mech ? el('div', { class: 'cl-nah-mech' }, mech) : null,
        !fertig && !finale && !zu ? hinweisTeil(id) : null));
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
        const b = spiel.querySelector('.cl-buehne');
        if (b && imSpiel()) {
          let arten = ['flackern', 'knarren'];
          if (kinder()) arten = ['funkeln', 'plopp'];
          else {
            if (st.spuk >= 5) arten.push('schatten', 'kaelte', 'flackern');
            if (st.grusel >= 5) arten.push('augen', 'atem', 'wackeln');
            if (z.raum.blut) arten.push('blutspur', 'blutspur');
          }
          const a = arten[Math.floor(Math.random() * arten.length)];
          if (a === 'knarren' || a === 'atem' || a === 'plopp') k.spielen(a);
          else if (a === 'wackeln') { const o = [...b.querySelectorAll('.cl-objekt:not(.fertig)')]; const x = o[Math.floor(Math.random() * o.length)]; if (x) { x.classList.add('zittern'); setTimeout(() => x.classList.remove('zittern'), 1300); k.spielen('knarren'); } }
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
      const kinoEl = el('div', { class: 'cl-kino' + (kinder() ? ' kinder' : '') + (r.blut ? ' blut' : ''), 'data-effekt': effekt },
        kulisse(r.welt), el('div', { class: 'cl-kino-vignette' }), flaeche,
        el('button', { class: 'cl-kino-weiter', type: 'button', onclick: kinoEnde }, 'Überspringen ›'));
      spiel.replaceChildren(kinoEl);
      k.bereit();
      k.musik(r.welt, r.alter, r.stimmung);
      k.intensitaet(0.05);
      const zeigen = (inhalt) => {
        const alt = flaeche.firstChild;
        if (alt) { alt.classList.add('raus'); setTimeout(() => alt.remove(), 600); }
        flaeche.append(inhalt);
      };
      const plan = (ms, f) => z.kinoTakte.push(setTimeout(f, ms));
      let t = 250;
      plan(t, () => { k.spielen(kinder() ? 'plopp' : 'riser'); zeigen(el('div', { class: 'cl-kino-vorspann' }, kinder() ? 'Clavis zeigt' : 'Clavis präsentiert')); });
      t += kinder() ? 1700 : 2600;
      teaserZeilen().forEach((zeile, i) => {
        plan(t, () => { k.spielen(kinder() ? (i % 2 ? 'plopp' : 'kichern') : i === 0 ? 'braam' : 'whoosh'); zeigen(el('div', { class: 'cl-kino-zeile', style: { '--i': i } }, zeile)); });
        t += Math.min(3400, 1500 + zeile.length * 28);
      });
      plan(t, () => {
        k.spielen(kinder() ? 'fanfare' : 'braam');
        if (!kinder() && r.stimmung && r.stimmung.grusel >= 6) setTimeout(() => k.spielen('schrei'), 900);
        zeigen(el('div', { class: 'cl-kino-titelblock' },
          el('div', { class: 'cl-kino-welt' }, kinder() && w.kinderName ? w.kinderName : w.name || ''),
          el('h1', { class: 'cl-kino-titel' }, [...r.titel].map((c, i) => el('span', { style: { '--i': i } }, c === ' ' ? ' ' : c))),
          el('div', { class: 'cl-kino-unter' }, `${(Clavis.STUFEN[r.stufe] || {}).name || ''} · ${r.minuten} Minuten${r.schreck ? ' · ⚡ Jumpscares' : ''}`)));
      });
      t += 3600;
      plan(t, kinoEnde);
    }

    function kinoEnde() {
      z.kinoTakte.forEach(clearTimeout);
      z.kinoTakte = [];
      if (z.kinoGesehen) return;
      z.kinoGesehen = true;
      k.intensitaet(0.15);
      malen();
      if (phase() === 'spiel' && z.introGesehen) Clavis.tuerAuf(spiel);
    }

    function eintreten() {
      z.introGesehen = true;
      k.bereit();
      k.intensitaet(0.25);
      malen();
      Clavis.tuerAuf(spiel);
    }

    // ---------------------------------------------------------------- Notizbuch, Intro, Ende
    function notizbuch() {
      const r = z.raum;
      const n = el('div', { class: 'cl-nah', onclick: (e) => { if (e.target === n) n.remove(); } });
      const eigene = Object.entries(z.zettel).filter(([id]) => station(id));
      n.append(el('div', { class: 'cl-nah-karte cl-notizbuch auf' },
        el('div', { class: 'cl-nah-kopf' }, el('div', { class: 'cl-wachsen' }, el('div', { class: 'cl-nah-ort' }, 'Notizbuch'), el('h3', {}, r.titel)), el('button', { class: 'cl-schliessen', type: 'button', onclick: () => n.remove() }, '✕')),
        el('p', { class: 'cl-nah-text' }, r.intro),
        eigene.length ? [el('h4', {}, 'Deine Zettel'), eigene.map(([id, zt]) => el('div', { class: 'cl-notiz' }, el('b', {}, station(id).ort + ' – '), zt.text || (zt.zeilen ? `Tabelle mit ${zt.zeilen.length} Einträgen (in der Nahaufnahme)` : '')))] : null,
        z.notizen.length ? [el('h4', {}, 'Was geschah'), z.notizen.slice().reverse().map((t) => el('div', { class: 'cl-notiz' }, t))] : el('p', { class: 'cl-leise' }, 'Noch nichts notiert.'),
        el('h4', {}, 'Regeln'),
        el('p', { class: 'cl-leise klein' }, `Jedes gelöste Rätsel bringt ein Fundstück – Buchstaben des Lösungsworts für den Ausgang – oder öffnet den Weg weiter. Unterwegs passiert einiges: Manches hilft, manches macht es schwerer. Hinweise kosten ${r.hinweisKosten ? zeitText(r.hinweisKosten * 1000) + ' Min.' : 'nichts'}.`)));
      spiel.append(n);
    }

    function intro() {
      const r = z.raum;
      const w = Clavis.WELTEN[r.welt] || {};
      const text = el('p', { class: 'cl-intro-text' });
      let i = 0;
      const tippen = () => { if (!text.isConnected) return; text.textContent = r.intro.slice(0, i); i += 2; if (i % 12 === 0) k.spielen('klick'); if (i <= r.intro.length + 1) setTimeout(tippen, 20); };
      setTimeout(tippen, 500);
      const p = phase();
      const spieler = (z.stand && z.stand.spieler) || [];
      return el('div', { class: 'cl-intro' },
        kulisse(r.welt),
        el('div', { class: 'cl-intro-karte' },
          el('div', { class: 'cl-intro-welt' }, `${kinder() && w.kinderName ? w.kinderName : w.name || ''} · ${(Clavis.STUFEN[r.stufe] || {}).name || ''} · ${r.minuten} Minuten`),
          el('h1', { class: 'cl-intro-titel' }, r.titel),
          text,
          r.schreck ? el('div', { class: 'cl-warnung' }, r.schreck.mild ? '⚡ Mit kleinen Schreckmomenten' : '⚡ Achtung: Jumpscares') : null,
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
        kulisse(r.welt),
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
      spiel.replaceChildren(hud(), buehne());
      if (offen) { z.offen = offen; nahMalen(true); }
    }

    // Jede Sekunde: Uhr, Countdown, Dunkelheit/Nebel, verriegelte Rätsel, Musik-Intensität, Herzschlag
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
      if (z.countdownBis) {
        const r2 = z.countdownBis - jetzt;
        const t = spiel.querySelector('#cl-countdown-text');
        const b = spiel.querySelector('#cl-countdown-balken');
        if (t) t.textContent = r2 > 0 ? `${kinder() ? 'Rakete' : 'Countdown'}: ${Math.ceil(r2 / 1000)} s – löst ein Rätsel!` : '…';
        if (b) b.style.width = `${Math.max(0, Math.min(1, r2 / 90000)) * 100}%`;
        if (r2 > 0 && r2 < 30000 && !kinder()) k.spielen('klick');
      }
      const b = spiel.querySelector('.cl-buehne');
      if (b) { b.classList.toggle('dunkel', z.dunkelBis > jetzt); b.classList.toggle('vernebelt', z.nebelBis > jetzt); }
      // Verriegelte Rätsel: Sekunden zählen, beim Freiwerden neu zeichnen
      if (z.offen && z.offen !== 'finale') {
        const n = spiel.querySelector('.cl-nah');
        const zu = blockiertMs(z.offen) > 0 && !geloest(z.offen);
        if (n && (n.dataset.zu === '1') !== zu) nahMalen(false);
        const zt = spiel.querySelector('#cl-verriegelt-zeit');
        if (zt) zt.textContent = `noch ${Math.max(0, Math.ceil(blockiertMs(z.offen) / 1000))} Sekunden`;
      }
      spiel.querySelectorAll('.cl-objekt.blockiert').forEach((o) => { if (blockiertMs(o.dataset.id) <= 0) { o.classList.remove('blockiert'); const kt = o.querySelector('.cl-objekt-kette'); if (kt) kt.remove(); } });
      if (imSpiel() && z.raum) {
        const anteil = rest != null ? rest / (z.raum.minuten * 60000) : 1;
        k.intensitaet(Math.max(0.2, Math.min(1, (1 - anteil) * 0.9 + (z.countdownBis > jetzt ? 0.4 : 0))));
        const st = z.raum.stimmung || {};
        if (st.spannung >= 6 && rest != null && rest > 0 && anteil < 0.2 && Math.floor(rest / 1000) % (st.spannung >= 9 ? 2 : 3) === 0) k.spielen('herz');
      }
    }, 1000);

    function wendungZeigen(d) {
      const g = d.daten || {};
      Clavis.effekt(spiel, d.ereignis, d.text, { alter: z.raum.alter }).then(() => {
        const folgen = {
          tipp: () => [`Neuer Hinweis: ${g.ort}`, 'ok'],
          buchstabe: () => [`Ein Buchstabe: ${g.stelle + 1}. Stelle = ${g.buchstabe}`, 'ok'],
          zeitplus: () => ['+2 Minuten!', 'ok'],
          geheimfach: () => [`Neues Rätsel: ${g.ort}`, 'ok'],
          dunkel: () => [kinder() ? 'Taschenlampen-Zeit! Fahr mit der Maus über den Raum.' : 'Dunkelheit – deine Lampe zeigt nur, wohin du leuchtest.', 'falsch'],
          nebel: () => [kinder() ? 'Blubb – alles voller Blasen!' : 'Nebel – du siehst kaum noch etwas.', 'falsch'],
          countdown: () => [kinder() ? 'Schnell, ein Rätsel lösen!' : '90 Sekunden – löst ein Rätsel!', 'falsch'],
          blockiert: () => [`${g.ort} ist für ${g.sekunden} s verriegelt`, 'falsch'],
          zeitminus: () => ['−1 Minute!', 'falsch'],
        }[d.art];
        const [t, art] = folgen ? folgen() : ['', ''];
        if (t) toast(t, art);
        if (d.art === 'buchstabe') setTimeout(() => spiel.querySelectorAll('.cl-wort-feld').forEach((f) => { if (Number(f.dataset.i) === g.stelle) f.classList.add('neu'); }), 60);
        if (d.art === 'geheimfach' && g.szene != null && z.szene !== g.szene) { z.szene = g.szene; malen(); }
        if (d.art === 'tipp' && z.offen === g.station) { const alt = spiel.querySelector('.cl-hinweise'); if (alt) alt.replaceWith(hinweisTeil(g.station)); }
      });
      if (d.art === 'dunkel') { z.dunkelBis = Date.now() + (g.sekunden || 60) * 1000; }
      if (d.art === 'nebel') { z.nebelBis = Date.now() + (g.sekunden || 45) * 1000; }
      z.notizen.push(d.text + (d.art === 'tipp' ? ` (Hinweis für ${g.ort})` : d.art === 'buchstabe' ? ` (${g.stelle + 1}. Buchstabe: ${g.buchstabe})` : ''));
    }

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
          // Aus der Lobby heraus gestartet: Das Intro kennen alle schon – Tür auf, hinein
          if (d.phase !== 'lobby' && vorher && vorher.phase === 'lobby' && z.kinoGesehen) { eintreten(); break; }
          if (d.phase !== 'lobby' && vorher && vorher.phase === 'lobby') z.introGesehen = true;
          if (vorher && d.szenen) d.szenen.forEach((o, i) => { if (o && !(vorher.szenen || [])[i] && i > 0) { z.szene = i; toast(`Ein neuer Raum: ${z.raum.szenen[i].titel}`, 'ok'); } });
          const offen = z.offen;
          if (z.raum && !z.ende && z.kinoGesehen) {
            if (phase() === 'lobby' || !z.introGesehen) { if (!vorher || vorher.phase !== d.phase || JSON.stringify(vorher.spieler) !== JSON.stringify(d.spieler)) malen(); }
            else {
              const h = spiel.querySelector('.cl-hud');
              const b = spiel.querySelector('.cl-buehne');
              if (h && b) { h.replaceWith(hud()); b.replaceWith(buehne()); } else malen();
              if (offen) {
                // Nahaufnahme nur neu, wenn sich dort etwas geändert hat (sonst bliebe ein halb gelöstes Rätsel nicht stehen)
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
          const s = station(d.station);
          k.spielen('auf');
          if (kinder()) { Clavis.konfetti(spiel); setTimeout(() => k.spielen('fanfare'), 300); }
          const team = z.stand && z.stand.spieler && z.stand.spieler.length > 1;
          const wer = d.name && d.von !== ich.id && team ? `${d.name}: ` : '';
          if (s) {
            const b = d.belohnung || {};
            z.notizen.push(`${s.ort}: gelöst${d.name && team ? ` (${d.name})` : ''}${b.art === 'fragment' ? ` – Buchstaben ${b.buchstaben.join(', ')}` : b.art === 'zeit' ? ' – 2 Minuten geschenkt' : ''}`);
            toast(`${wer}${s.ort} geöffnet${b.art === 'fragment' ? ` – ${b.buchstaben.join(' ')}` : b.art === 'zeit' ? ' – +2:00' : ''}`, 'ok');
          }
          setTimeout(() => spiel.querySelectorAll('.cl-wort-feld.voll').forEach((f) => { if (d.belohnung && d.belohnung.stellen && d.belohnung.stellen.includes(Number(f.dataset.i))) f.classList.add('neu'); }), 80);
          if (d.ereignis) setTimeout(() => { z.notizen.push(d.ereignis.text || ''); Clavis.effekt(spiel, d.ereignis.art, d.ereignis.text, { alter: z.raum.alter }); }, 1400);
          break;
        }
        case 'hinweis':
          k.spielen('hinweis');
          if (d.name && d.von !== ich.id && station(d.station)) toast(`${d.name} hat einen Hinweis genommen (${station(d.station).ort})`);
          break;
        case 'ereignis':
          z.notizen.push(d.text || '');
          if (imSpiel()) Clavis.effekt(spiel, d.art, d.text, { alter: z.raum.alter });
          break;
        case 'wendung':
          if (imSpiel()) wendungZeigen(d);
          else z.notizen.push(d.text);
          break;
        case 'wendung_ende':
          k.spielen(d.erfolg ? 'erfolg' : 'falle');
          if (!d.erfolg && !kinder()) falleZeigen(120);
          toast(d.text, d.erfolg ? 'ok' : 'falsch');
          z.countdownBis = null;
          hudNeu();
          z.notizen.push(d.text);
          break;
        case 'schreck':
          if (imSpiel() && z.raum.schreck) Clavis.schreck(spiel, d.art, { blut: z.raum.blut });
          break;
        case 'ende':
          z.ende = d.ergebnis;
          z.offen = null;
          k.musikStoppen();
          k.spielen(d.ergebnis.geschafft ? 'ende' : 'falsch');
          if (d.ergebnis.geschafft && kinder()) setTimeout(() => Clavis.konfetti(spiel), 300);
          malen();
          break;
        case 'vorbei': case 'entfernt':
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
