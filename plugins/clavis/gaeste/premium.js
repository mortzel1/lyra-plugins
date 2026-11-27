'use strict';
/* Premium-Spielansicht. Derselbe Transport wie Clavis.Spiel, mit einer eigenen räumlichen Inszenierung. */
(() => {
  const h = (tag, attr, ...children) => Clavis.el(tag, attr, ...children.flat(Infinity));
  const zeit = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const ORDER = ['strom', 'frequenz', 'peilung', 'ventile', 'chronik', 'band', 'relais', 'leuchtfeuer'];
  const LABELS = { hof: 'Forsthaus', buero: 'Nachtwache', funk: 'Funkstube', pfad: 'Waldpfad', wehr: 'Wehr', keller: 'Keller', turm: 'Feuerturm' };
  function erstellen(wurzel, { senden, ich, host = null }) {
    const z = { raum: null, stand: null, ort: 'hof', ortVorher: null, modal: null, film: null, filmIndex: 0, filmId: null, filmFertig: false, gesehen: new Set(), ende: null, vorbei: false, verlassen: false, rest: 0, empfangenUm: Date.now(), nr: 0, wartend: new Map(), szeneSprachNr: 0, bewegen: false, letzteSequenz: -1, jetztTon: false, introWahl: false };
    const k = Clavis.klang, sound = Clavis.PremiumKlang();
    const spiel = h('section', { class: 'px-spiel', 'data-welt': 'spuk', 'data-alter': 'ab14', 'aria-label': 'Der Wald hört mit' });
    wurzel.replaceChildren(spiel);
    const reduziert = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let uhr = null, status = null, leinwand = null, seitenleiste = null, footer = null, kunstStand = '', uiStand = '';
    let takt = null, filmTimer = null, lockTimer = null, animTimer = null, destroyTimer = null;
    let prefs = { schreck: null, staerke: 7, stimmen: true };
    try { const p = JSON.parse(localStorage.getItem('clavis:premium:vorlieben') || 'null'); if (p) prefs = { ...prefs, ...p }; } catch (_) {}
    prefs.stimmen = !!prefs.stimmen && Clavis.stimme.an();
    const speichern = () => { try { localStorage.setItem('clavis:premium:vorlieben', JSON.stringify(prefs)); } catch (_) {} };
    const R = () => z.raum;
    const P = () => z.stand?.premium || { offen: ['hof'], inventar: [], journal: [], gelesen: {}, entscheidungen: {}, bereit: [] };
    const geloest = id => !!z.stand?.geloest?.[id];
    const offen = id => P().offen.includes(id);
    const zeitRest = () => Math.max(0, z.rest - (P().pausiert || z.stand?.phase !== 'spiel' || z.ende ? 0 : Date.now() - z.empfangenUm));
    const knopf = (text, f, klasse = '', attr = {}) => h('button', { class: 'px-button ' + klasse, type: 'button', onclick: f, ...attr }, text);
    function tonal(art) { if (z.jetztTon) sound.cue(art); }
    function sprich(text, rolle = 'erzaehler') { if (prefs.stimmen && z.jetztTon) return Clavis.stimme.sprechen(text, rolle); return Promise.resolve(false); }
    function tonStart() { z.jetztTon = true; k.bereit(); k.musik('spuk', 'ab14', R().stimmung); k.intensitaet(.18); sound.start(z.ort); }
    function req(d) {
      const nr = ++z.nr;
      return new Promise(resolve => {
        const t = setTimeout(() => { z.wartend.delete(nr); resolve({ richtig: false, info: 'Die Leitung antwortet nicht. Prüfe die Verbindung und versuche es erneut.' }); }, 12000);
        z.wartend.set(nr, { resolve, t });
        Promise.resolve(senden({ ...d, nr })).catch(() => { clearTimeout(t); z.wartend.delete(nr); resolve({ richtig: false, info: 'Verbindung unterbrochen.' }); });
      });
    }
    function toast(text, art = '') {
      if (z.verlassen) return;
      const t = h('div', { class: 'px-toast ' + art, role: 'status' }, text); spiel.append(t);
      setTimeout(() => t.remove(), 6500);
    }
    function dekorBild(ort, cls = '') {
      const b = h('div', { class: 'px-illustration ' + cls });
      const svg = Clavis.PremiumWelt.bild(ort, { geloest: z.stand?.geloest, entscheidungen: P().entscheidungen });
      b.innerHTML = cls === 'px-stage-art' ? svg.replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="none"') : svg;
      return b;
    }
    function settings() {
      const form = h('div', { class: 'px-settings' },
        h('p', { class: 'px-muted' }, 'Das Spiel bleibt mit ausgeschaltetem Ton vollständig lösbar. Alle Funkaufnahmen haben eine Abschrift.'),
        knopf(k.an() ? 'Geräusche: an' : 'Geräusche: aus', () => { k.schalten(!k.an()); if (k.an()) tonStart(); else sound.stop(); settings(); }, 'secondary'),
        knopf(k.musikAn() ? 'Musik: an' : 'Musik: aus', () => { k.musikSchalten(!k.musikAn()); settings(); }, 'secondary'),
        knopf(prefs.stimmen ? 'Erzähler: an' : 'Erzähler: aus', () => { prefs.stimmen = !prefs.stimmen; Clavis.stimme.schalten(prefs.stimmen); speichern(); settings(); }, 'secondary'),
        knopf(prefs.schreck ? 'Jumpscares: an' : 'Jumpscares: aus', () => { prefs.schreck = !prefs.schreck; speichern(); settings(); }, 'secondary', { role: 'switch', 'aria-checked': String(!!prefs.schreck) }),
        h('label', { class: 'px-control' }, `Stärke der Jumpscares · ${prefs.staerke}`, h('input', { type: 'range', min: 1, max: 10, value: prefs.staerke, 'aria-label': 'Stärke der Jumpscares', onchange: e => { prefs.staerke = Number(e.target.value); speichern(); settings(); } })),
        h('p', { class: 'px-small px-muted' }, 'Plötzliche Gestalten und Schreckeffekte folgen dieser Einstellung. Bedrohliche Geräusche der Geschichte bleiben Teil der Atmosphäre.'));
      modal('Deine Nacht', form, { art: 'settings' });
    }
    function lobby() {
      spiel.classList.add('px-cover');
      if (!R()) { spiel.replaceChildren(h('div', { class: 'px-wait' }, h('span', { class: 'px-eyebrow' }, 'CLAVIS · PREMIUM'), h('h1', {}, 'Eine Leitung ins Dunkel.'), h('p', {}, 'Verbindung zum Forstrevier wird aufgebaut …'))); return; }
      const rest = knopf(host ? 'Die Nachtwache beginnen' : z.introWahl ? 'Bereit · Auf die Spielleitung warten' : 'Bereit für die Nacht', () => {
        z.introWahl = true; tonStart();
        if (host) host.starten(); else lobby();
      }, 'primary', { disabled: !host && z.introWahl });
      spiel.replaceChildren(
        dekorBild('hof', 'px-cover-art'), h('div', { class: 'px-cover-shade' }),
        h('div', { class: 'px-cover-top' }, h('span', { class: 'px-brand' }, 'CLAVIS'), h('span', { class: 'px-edition' }, 'EIN PREMIUM-ABENTEUER')),
        h('div', { class: 'px-cover-content' }, h('span', { class: 'px-eyebrow' }, 'FORSTREVIER 17 · EINE NACHT, DIE DICH KENNT'),
          h('h1', { class: 'px-title' }, h('span', {}, 'Der Wald'), h('em', {}, 'hört mit.')),
          h('p', { class: 'px-cover-copy' }, 'Deine Schwester ist seit elf Tagen verschwunden. Heute Nacht ruft sie an. Aus einem Forsthaus, das seit Jahren leer steht.'),
          h('div', { class: 'px-cover-meta' }, h('span', {}, '8 verbundene Rätsel'), h('span', {}, '7 Schauplätze'), h('span', {}, `${R().minuten} Minuten`), h('span', {}, 'Ab 14')),
          h('div', { class: 'px-cover-actions' }, rest, knopf('Ton & Schreckmomente', settings, 'secondary')),
          h('label', { class: 'px-lobby-scare' }, h('input', { type: 'checkbox', checked: prefs.schreck, onchange: e => { prefs.schreck = e.target.checked; speichern(); } }), 'Jumpscares erlauben', h('small', {}, 'Jederzeit über die Einstellungen änderbar')),
          h('p', { class: 'px-cover-instruction' }, 'Sieh genau hin. Behalte Aufzeichnungen im Einsatzbuch. Deine Entscheidungen bleiben.'),
          z.stand?.spieler?.length > 1 ? h('div', { class: 'px-team-list' }, 'Mit dir im Wald · ' + z.stand.spieler.map(x => x.name).join(' · ')) : null),
        h('div', { class: 'px-cover-bottom' }, h('span', {}, 'Eine handgeschriebene Geschichte'), h('span', {}, 'Kopfhörer empfohlen · auch ohne Ton spielbar')));
    }
    function ziel() {
      if (geloest('leuchtfeuer')) return 'Alle Fundstücke sind da. Triff deine letzte Entscheidung am Ausgang.';
      if (geloest('relais')) return 'Steig auf den Feuerturm. Die Gravur am Wehr erklärt das Leuchtfeuer.';
      if (geloest('band')) return 'Unterbrich die Rufschleife im Keller. Das Schaltbild hilft dir.';
      if (geloest('chronik')) return 'Prüfe die Magnetbänder in der Funkstube. Welche Stimme ist echt?';
      if (geloest('ventile')) return P().entscheidungen.nora ? 'Rekonstruiere die Nacht an den Protokollen im Keller.' : 'Nora ist hinter dem Gitter. Untersuche sie – und entscheide, was du tust.';
      if (geloest('peilung')) return 'Suche am Waldpfad den Ventilplan und geh zum alten Wehr.';
      if (geloest('frequenz')) return P().entscheidungen.funk ? 'Noras Notiz am Schreibtisch führt dich zur richtigen Peilung.' : 'Dein Finger liegt auf der Sprechtaste. Antworten oder nur zuhören?';
      if (geloest('strom')) return 'Die Funkstube ist offen. Suche den stillen Nachtkanal.';
      if (P().inventar.some(i => i.id === 'schluessel')) return 'Untersuche das Dienstbuch und schalte das Notnetz im Haus.';
      return 'Noras Wagen steht vor dem Haus. Untersuche ihn.';
    }
    function game() {
      if (!R() || z.verlassen) return;
      spiel.classList.remove('px-cover');
      uiStand = '';
      const ort = R().orte[z.ort];
      const world = dekorBild(z.ort, 'px-stage-art');
      kunstStand = JSON.stringify([z.stand?.geloest, P().entscheidungen]);
      leinwand = h('div', { class: 'px-stage', tabindex: -1, 'aria-label': ort.name }, world,
        h('div', { class: 'px-fog f1' }), h('div', { class: 'px-fog f2' }),
        h('div', { class: 'px-film-grain' }), h('div', { class: 'px-rain' }), h('div', { class: 'px-light-cone' }),
        h('div', { class: 'px-location-label' }, h('span', { class: 'px-eyebrow' }, ort.akt), h('h2', {}, ort.name), h('p', {}, 'Untersuche die Dinge, die eine Geschichte erzählen.')),
        h('div', { class: 'px-hotspots' }), h('div', { class: 'px-ambient-caption', 'aria-live': 'polite' }),
        knopf('◎ Dinge zeigen', () => { spiel.classList.toggle('px-reveal'); }, 'px-reveal-button', { 'aria-label': 'Alle untersuchbaren Gegenstände hervorheben' }));
      leinwand.dataset.ort = z.ort;
      const header = h('header', { class: 'px-header' },
        h('div', { class: 'px-logo-group' }, h('span', { class: 'px-brand' }, 'CLAVIS'), h('span', { class: 'px-premium-pill' }, 'PREMIUM')),
        h('div', { class: 'px-header-name' }, 'Der Wald hört mit', h('small', {}, 'FORSTREVIER 17')),
        h('div', { class: 'px-time' }, h('small', {}, 'BIS ZUM LETZTEN RUF'), uhr = h('b', { 'aria-label': 'Verbleibende Spielzeit', role: 'timer' }, zeit(zeitRest()))),
        knopf('♫', () => { if (!z.jetztTon) tonStart(); else { k.schalten(!k.an()); if (k.an()) tonStart(); else sound.stop(); } update(); }, 'px-icon', { title: 'Ton umschalten', 'aria-label': 'Ton umschalten' }),
        knopf('☷', settings, 'px-icon', { title: 'Einstellungen', 'aria-label': 'Einstellungen' }),
        host ? knopf('×', () => host.beenden(), 'px-icon', { title: 'Spiel verlassen', 'aria-label': 'Spiel verlassen' }) : null);
      seitenleiste = h('aside', { class: 'px-sidebar' });
      footer = h('footer', { class: 'px-footer' });
      status = h('div', { class: 'px-objective', role: 'status' });
      spiel.replaceChildren(header, h('div', { class: 'px-layout' }, leinwand, seitenleiste), status, footer);
      leinwand.addEventListener('pointermove', e => {
        if (reduziert || e.pointerType !== 'mouse') return;
        const q = leinwand.getBoundingClientRect(), x = (e.clientX - q.left) / q.width, y = (e.clientY - q.top) / q.height;
        world.style.setProperty('--px', ((x - .5) * 8).toFixed(1) + 'px'); world.style.setProperty('--py', ((y - .5) * 5).toFixed(1) + 'px');
        leinwand.style.setProperty('--lx', x * 100 + '%'); leinwand.style.setProperty('--ly', y * 100 + '%');
      });
      if (z.jetztTon) sound.ort(z.ort);
      update();
    }
    function update() {
      if (!leinwand?.isConnected || !R()) return;
      spiel.classList.toggle('px-powered', geloest('strom'));
      spiel.classList.toggle('px-listened', P().entscheidungen.funk === 'antworten');
      spiel.classList.toggle('px-danger', zeitRest() < 5 * 60000);
      uhr.textContent = zeit(zeitRest());
      const uiNeu = JSON.stringify([z.stand?.geloest, z.stand?.hinweise, z.stand?.spieler, P().gelesen, P().inventar, P().entscheidungen, P().pausiert]);
      if (uiNeu === uiStand) return;
      uiStand = uiNeu;
      const kunstNeu = JSON.stringify([z.stand?.geloest, P().entscheidungen]);
      if (kunstNeu !== kunstStand) {
        const bild = leinwand.querySelector('.px-stage-art');
        if (bild) bild.innerHTML = Clavis.PremiumWelt.bild(z.ort, { geloest: z.stand?.geloest, entscheidungen: P().entscheidungen }).replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="none"');
        kunstStand = kunstNeu;
      }
      const ort = R().orte[z.ort], layer = leinwand.querySelector('.px-hotspots');
      layer.replaceChildren(...ort.objekte.map(id => {
        const st = R().stationen[id], o = st || R().objekte[id];
        if (!o) return null;
        const done = geloest(id), lu = st && !P().bereit.includes(id), known = !st && P().gelesen[id];
        const b = knopf('', () => untersuchen(id), 'px-hotspot' + (st ? ' puzzle' : '') + (done ? ' done' : '') + (known ? ' known' : '') + (lu ? ' locked' : ''), { style: { left: (o.x || 54) + '%', top: (o.y || 55) + '%' }, 'aria-label': (o.name || o.titel) + (done ? ' · gelöst' : '') });
        b.append(h('span', { class: 'px-hotspot-dot', 'aria-hidden': 'true' }, done ? '✓' : st ? '◇' : '+'), h('span', { class: 'px-hotspot-name' }, o.name || o.titel, h('small', {}, done ? 'Gelöst' : lu ? 'Verbindung fehlt' : st ? 'Untersuchen · Rätsel' : known ? 'Noch einmal ansehen' : o.art === 'entscheidung' ? 'Untersuchen · Entscheidung' : 'Untersuchen')));
        return b;
      }).filter(Boolean));
      seitenleiste.replaceChildren(h('div', { class: 'px-map-heading' }, h('span', { class: 'px-eyebrow' }, 'DEIN WEG'), h('h3', {}, 'Das Revier')),
        h('nav', { class: 'px-map', 'aria-label': 'Schauplätze' }, Object.keys(LABELS).map((id, i) => {
          const reachable = offen(id), current = z.ort === id;
          return knopf('', () => gehen(id), 'px-map-place' + (reachable ? ' open' : '') + (current ? ' current' : ''), { disabled: !reachable, title: reachable ? LABELS[id] : 'Noch nicht erreichbar', 'aria-current': current ? 'location' : null });
        }).map((b, i) => { const id = Object.keys(LABELS)[i]; b.append(h('span', { class: 'px-map-node' }, String(i + 1).padStart(2, '0')), h('span', {}, LABELS[id]), h('i', {}, z.ort === id ? '←' : offen(id) ? '↗' : '·')); return b; })),
        h('div', { class: 'px-sidebar-bottom' }, h('span', { class: 'px-eyebrow' }, 'WAS DU WEISST'), h('p', {}, geloest('chronik') ? 'Der Ruf kam nach dem Unfall. Das war nicht Nora.' : geloest('frequenz') ? 'Jemand hat auf dich gewartet.' : 'Elf Tage vermisst. Ein Anruf.'), knopf('Einsatzbuch öffnen ↗', journal, 'secondary'),
          h('div', { class: 'px-progress' }, h('span', {}, `${Object.keys(z.stand?.geloest || {}).length} / 8`), h('div', {}, h('i', { style: { width: `${Object.keys(z.stand?.geloest || {}).length * 12.5}%` } }))),
          z.stand?.spieler?.length > 1 ? h('p', { class: 'px-small px-muted' }, `Gemeinsam unterwegs · ${z.stand.spieler.length} Personen`) : null));
      footer.replaceChildren(h('div', { class: 'px-inventory' }, h('small', {}, 'BEI DIR'), P().inventar.length ? P().inventar.map(i => h('span', { title: i.name }, h('b', {}, i.zeichen), h('span', {}, i.name))) : h('span', { class: 'px-empty' }, 'Eine Taschenlampe. Sonst nichts.')),
        h('div', { class: 'px-word' }, h('small', {}, 'FUNDSTÜCKE'), h('div', {}, (z.stand?.wort || new Array(8).fill(null)).map((v, i) => h('span', { class: v ? 'found' : '', title: `Fundstück ${i + 1}` }, v || '·')))));
      status.replaceChildren(h('span', { class: 'px-objective-dot' }), h('small', {}, 'DEIN NÄCHSTER SCHRITT'), h('span', {}, ziel()), P().pausiert ? h('b', {}, 'Zeit pausiert') : null);
      uhr.textContent = zeit(zeitRest());
      if (z.stand?.phase === 'spiel' && !P().szene && geloest('frequenz') && !P().entscheidungen.funk && z.modal?.art !== 'wahl') wahlFunk();
    }
    function gehen(id) {
      if (!offen(id) || id === z.ort || P().szene || z.ende || z.bewegen) return;
      z.bewegen = true; schliessen(); tonal('schritte'); spiel.classList.add('px-travel');
      animTimer = setTimeout(() => { if (z.verlassen) return; z.ortVorher = z.ort; z.ort = id; game(); spiel.classList.remove('px-travel'); z.bewegen = false; const heading = leinwand.querySelector('h2'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); }, reduziert ? 0 : 450);
    }
    function modal(titel, body, { art = '', id = '' } = {}) {
      const old = spiel.querySelector('.px-modal'), vorher = old ? z.modal?.vorher : document.activeElement;
      if (old) old.remove();
      const close = knopf('×', schliessen, 'px-close', { 'aria-label': 'Zurück in den Raum' });
      const panel = h('section', { class: 'px-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: -1 }, h('header', { class: 'px-panel-header' }, h('span', { class: 'px-eyebrow' }, art === 'puzzle' ? 'NAHAUFNAHME · REVIER 17' : 'FORSTREVIER 17'), close), h('h2', {}, titel), body);
      const ground = h('div', { class: 'px-modal ' + art, onclick: e => { if (e.target === ground) schliessen(); } }, panel);
      z.modal = { art, id, vorher }; spiel.append(ground); panel.focus({ preventScroll: true });
      return panel;
    }
    function schliessen() { const previous = z.modal?.vorher; spiel.querySelector('.px-modal')?.remove(); z.modal = null; Clavis.stimme.stopp(); if (previous?.isConnected) previous.focus({ preventScroll: true }); }
    function journal() {
      modal('Das Einsatzbuch', h('div', { class: 'px-journal' }, h('p', { class: 'px-muted' }, 'Funde, Entscheidungen und Erkenntnisse. Im Team sehen alle dieselben Aufzeichnungen.'),
        P().journal.length ? P().journal.map(x => h('article', { class: 'px-journal-entry ' + x.art }, h('span', { class: 'px-eyebrow' }, x.art === 'wahl' ? 'DEINE ENTSCHEIDUNG' : x.art === 'erkenntnis' ? 'EINE VERBINDUNG' : 'FUND'), h('h3', {}, x.titel), h('p', {}, x.text))) : h('p', {}, 'Noch keine Einträge. Untersuche Noras Wagen.')), { art: 'journal' });
    }
    async function untersuchen(id) {
      if (P().szene || z.ende || z.bewegen) return;
      const st = R().stationen[id];
      if (st) {
        if (geloest(id)) { const i = ORDER.indexOf(id); return modal(st.titel, h('div', { class: 'px-solved' }, h('div', { class: 'px-big-letter' }, z.stand.wort[i]), h('p', {}, `${i + 1}. Fundstück für das letzte Schloss.`), h('p', { class: 'px-muted' }, P().journal.find(x => x.titel === st.titel)?.text || 'Der Mechanismus ist gelöst.'), knopf('Zurück in den Raum', schliessen, 'primary'))); }
        if (!P().bereit.includes(id)) {
          const prerequisite = st.braucht.find(x => !geloest(x)), note = st.lesen.find(x => !P().gelesen[x]);
          return modal(st.titel, h('div', { class: 'px-document' }, h('span', { class: 'px-eyebrow' }, 'EINE VERBINDUNG FEHLT'), h('p', {}, prerequisite ? `Hier fehlt noch die Verbindung zu „${R().stationen[prerequisite].titel}“.` : `Untersuche zuerst „${R().objekte[note]?.name || note}“. Dort steht etwas, das du hier brauchst.`), knopf('Einsatzbuch', journal, 'secondary')));
        }
        return raetsel(id);
      }
      const o = R().objekte[id];
      if (!o) return;
      if (id === 'ausgang') return finale();
      if (id === 'sendetaste') return geloest('frequenz') ? (P().entscheidungen.funk ? modal('Die Sprechtaste', h('p', { class: 'px-lead' }, P().entscheidungen.funk === 'lauschen' ? 'Du hast nur zugehört. Der Wald hat deine Stimme nicht bekommen.' : 'Du hast geantwortet. In den Leitungen lebt jetzt auch deine Stimme.')) : wahlFunk()) : modal('Die Sprechtaste', h('p', { class: 'px-lead' }, 'Noch kein Empfang. Finde zuerst den stillen Kanal.'));
      const result = await req({ typ: 'premium_lesen', objekt: id });
      if (!result.richtig) return toast(result.info, 'bad');
      if (z.ende || P().szene) return;
      tonal(o.art === 'fund' ? 'papier' : 'knarren');
      if (id === 'nora') return wahlNora();
      if (id === 'kopie') return wahlKopie();
      const text = id === 'funknotiz' ? `DIENSTSTELLE REVIER 17\nGrundträger ${(R().stationen.frequenz.p.basis / 10).toFixed(1)} MHz\nNachtschicht +${(R().stationen.frequenz.p.delta / 10).toFixed(1)} MHz\nRauschfilter III · Tagesphase 0\nNachts: Gegenphase (eine halbe Umdrehung)\nTageskennung: ${R().kennung}` : id === 'gravur' ? `Vier Zeichen sind in den Stein geschnitten:\n${R().stationen.leuchtfeuer.p.gravur}\nDarunter: „Das Licht spricht. Lass die Leitung still.“` : o.text;
      const content = h('div', { class: 'px-document' }, h('span', { class: 'px-paper-stamp' }, 'REVIER 17'), h('p', {}, text), o.item ? h('div', { class: 'px-found-item' }, o.item[2], '  ', o.item[1], h('small', {}, 'Im gemeinsamen Inventar')) : null,
        id === 'haustuer' ? knopf(offen('buero') ? 'Mit Noras Schlüssel eintreten →' : 'Der Schlüssel fehlt noch', () => gehen('buero'), 'primary', { disabled: !offen('buero') }) : knopf('Im Einsatzbuch merken · zurück', schliessen, 'secondary'));
      modal(o.name, content, { art: 'dokument', id });
      if (id === 'kerben') moment('ast');
    }
    function entscheidung(titel, text, key, optionen) {
      const body = h('div', { class: 'px-choice-body' }, h('p', { class: 'px-lead' }, text), h('span', { class: 'px-eyebrow' }, 'DIESE ENTSCHEIDUNG BLEIBT'),
        optionen.map(([value, label, desc]) => knopf('', async e => {
          const button = e.currentTarget; button.disabled = true;
          const r = await req({ typ: 'premium_wahl', schluessel: key, wert: value });
          if (!r.richtig) { button.disabled = false; return toast(r.info, 'bad'); }
          schliessen(); update();
          if (key === 'nora' && value === 'retten') { tonal('tuer'); toast('Nora ist bei dir. Ihr verliert eine Minute – und geht gemeinsam weiter.'); game(); }
          else if (key === 'ausgang') finale();
        }, 'px-choice').appendChild(h('span', {}, h('b', {}, label), h('small', {}, desc))).parentNode));
      modal(titel, body, { art: 'wahl', id: key });
    }
    function wahlFunk() { entscheidung('Wirst du antworten?', 'Die Stimme wartet. Wenn du die Sprechtaste drückst, weiß sie, dass du da bist. Wenn du schweigst, kannst du weiter lauschen.', 'funk', [['antworten', '„Nora? Ich bin hier.“', 'Du sendest deine Stimme in den Wald.'], ['lauschen', 'Die Sprechtaste nicht drücken', 'Du hörst zu, ohne deinen Standort zu verraten.']]); }
    function wahlNora() {
      if (P().entscheidungen.nora === 'retten') return modal('Nora ist bei dir', h('p', { class: 'px-lead' }, 'Ihr Fuß ist verbunden. Sie folgt dir. „Das Licht am Turm“, sagt sie. „Und danach kein Wort mehr.“'));
      entscheidung('Nora hinter dem Gitter', R().objekte.nora.text, 'nora', [['retten', 'Nora befreien und mitnehmen', 'Du verlierst 60 Sekunden. Ab jetzt geht ihr gemeinsam.'], ['weiter', 'Zuerst das Signal erreichen', 'Du lässt sie hier. Bis zum Ausgang kannst du zurückkommen.']]);
    }
    function wahlKopie() {
      if (!geloest('chronik')) return modal('Das Beweisband', h('p', { class: 'px-lead' }, 'Die Aufzeichnungen sind durcheinander. Rekonstruiere zuerst die Nacht an den Protokollen. Danach kannst du eine lesbare Kopie sichern.'));
      if (P().entscheidungen.kopie) return modal('Das Beweisband', h('p', { class: 'px-lead' }, P().entscheidungen.kopie === 'sichern' ? 'Die trockene Kopie liegt in deiner Tasche. Die Aufzeichnungen können mit euch ins Tal.' : 'Du hast dich für den schnellen Aufstieg entschieden. Das Original bleibt hier.'));
      entscheidung('Die Geschichte mitnehmen?', R().objekte.kopie.text, 'kopie', [['sichern', 'Eine Sicherheitskopie anfertigen', 'Kostet 45 Sekunden. Ihr nehmt einen Beweis mit.'], ['lassen', 'Das Original hierlassen', 'Du sparst Zeit. Die Aufzeichnungen bleiben im Wald.']]);
    }
    function finale() {
      if (!geloest('leuchtfeuer')) return modal('Das letzte Schloss', h('p', { class: 'px-lead' }, 'Das Leuchtfeuer ist noch nicht ausgerichtet. Bevor du gehst, muss jemand im Tal dich sehen können.'));
      if (!P().entscheidungen.ausgang) return entscheidung('Ein letzter Ruf', 'Unten wartet die Rettung. Die Sprechtaste leuchtet. Nora hat dich gewarnt: Der Rückruf darf den Wald nicht verlassen. Du entscheidest, ob du noch einmal sendest.', 'ausgang', [['stille', 'Die Funkleitung endgültig trennen', 'Nur das Leuchtfeuer spricht. Du bleibst still.'], ['senden', 'Die Rettung über Funk einweisen', 'Du sendest. Die Leitung bleibt offen.']]);
      const f = h('input', { class: 'px-input px-final-input', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, placeholder: 'ACHT BUCHSTABEN', 'aria-label': 'Lösungswort aus den Fundstücken' });
      const form = h('form', { class: 'px-final-form', onsubmit: async e => { e.preventDefault(); const r = await req({ typ: 'finale', antwort: f.value }); if (!r.richtig) toast(r.info, 'bad'); } },
        h('p', { class: 'px-lead' }, 'Die acht Fundstücke ergeben das Wort. Das letzte Schloss hält den Weg zum Rettungsfahrzeug geschlossen.'),
        h('div', { class: 'px-final-fragments' }, (z.stand.wort || []).map(x => h('span', {}, x || '·'))), f,
        h('button', { class: 'px-button primary', type: 'submit' }, 'Den Wald verlassen →'));
      modal('Dein Weg nach draußen', form, { art: 'finale' });
      f.focus();
    }
    function raetsel(id) {
      const s = R().stationen[id], p = s.p;
      const feedback = h('div', { class: 'px-feedback', role: 'status' });
      const submit = async a => {
        const r = await req({ typ: 'loesen', station: id, antwort: a });
        if (!r.richtig) { feedback.textContent = r.info; tonal('falsch'); spiel.classList.add('px-feedback-shake'); setTimeout(() => spiel.classList.remove('px-feedback-shake'), 350); }
        else tonal('einrasten');
        return r;
      };
      const controls = puzzle(p, submit, tonal);
      const tips = h('div', { class: 'px-tips' });
      const tip = () => {
        const l = z.stand?.hinweise?.[id] || [];
        tips.replaceChildren(...l.map((t, i) => h('p', {}, h('b', {}, `Hinweis ${i + 1} · `), t)), l.length < R().hinweisAnzahl ? knopf(`Hinweis anfordern · −${R().hinweisKosten} s`, e => { e.currentTarget.disabled = true; senden({ typ: 'hinweis', station: id }); }, 'secondary') : h('p', { class: 'px-muted' }, 'Alle Hinweise für dieses Rätsel verwendet.'));
      };
      const body = h('div', { class: 'px-puzzle' }, h('p', { class: 'px-lead' }, s.text), h('div', { class: 'px-puzzle-tools' }, knopf('Aufzeichnungen danebenlegen', () => {
        const read = body.querySelector('.px-inline-notes');
        if (read) return read.remove();
        const relevant = [...s.lesen, ...(id === 'chronik' ? [] : [])];
        const notes = relevant.map(n => P().journal.find(x => x.titel === R().objekte[n]?.name)).filter(Boolean);
        const panel = h('aside', { class: 'px-inline-notes' }, h('b', {}, 'Deine Aufzeichnungen'), notes.length ? notes.map(x => h('p', {}, x.text)) : h('p', {}, 'Alle nötigen Angaben stehen am Gerät. Weitere Funde stehen im Einsatzbuch.'));
        body.querySelector('.px-puzzle-tools').after(panel);
      }, 'secondary')), controls, feedback, tips);
      modal(s.titel, body, { art: 'puzzle', id }); z.modal.tip = tip; tip();
    }
    // ---------------------------------------------------------------- Rätsel zum Benutzen, mit sichtbarer Rückmeldung
    function puzzle(p, submit, ton) {
      const root = h('div', { class: 'px-machine machine-' + p.art });
      const submitButton = (text, value) => knopf(text, async e => { const b = e.currentTarget; b.disabled = true; try { await submit(value()); } finally { if (b.isConnected) b.disabled = false; } }, 'primary');
      if (p.art === 'strom') {
        const a = new Array(6).fill(0), meter = h('b', {}), label = h('span', {});
        const buttons = p.namen.map((name, i) => knopf('', () => { a[i] ^= 1; ton('einrasten'); draw(); }, 'px-fuse', { 'aria-label': name }));
        const draw = () => { const sum = a.reduce((n, x, i) => n + x * p.lasten[i], 0); meter.textContent = `${sum} / ${p.ziel} A`; meter.className = sum > p.ziel ? 'bad' : ''; label.textContent = `${a.filter(Boolean).length} von 3 Verbrauchern`; buttons.forEach((b, i) => { b.classList.toggle('on', !!a[i]); b.setAttribute('aria-pressed', String(!!a[i])); b.replaceChildren(h('i', { class: 'px-switch' }), h('b', {}, p.namen[i]), h('small', {}, p.lasten[i] + ' A')); }); };
        root.append(h('div', { class: 'px-meter' }, h('small', {}, 'NOTNETZ · LASTGRENZE'), meter, label), h('div', { class: 'px-fuse-grid' }, buttons), submitButton('Notnetz zuschalten', () => a.slice())); draw();
      } else if (p.art === 'frequenz') {
        const a = { wert: 1460, phase: 0, filter: 0 }, read = h('b', {}), filter = h('span', {}), phase = h('span', {});
        const range = h('input', { type: 'range', min: 1450, max: 1495, step: 1, value: a.wert, 'aria-label': 'Frequenz in Zehntel-Megahertz', oninput: e => { a.wert = Number(e.target.value); draw(); } });
        const draw = () => { read.textContent = (a.wert / 10).toFixed(1).replace('.', ',') + ' MHz'; filter.textContent = ['0', 'I', 'II', 'III', 'IV'][a.filter]; phase.textContent = a.phase * 90 + '°'; range.value = a.wert; };
        root.append(h('div', { class: 'px-radio-screen' }, h('small', {}, 'TRÄGER ABSTIMMEN'), read, h('div', { class: 'px-scope' }, h('i'), h('i'), h('i'), h('i'), h('i')), h('p', {}, 'Nur Rauschen. Der Tagkanal ist hier nachts nicht erreichbar.')),
          h('div', { class: 'px-tuner' }, knopf('−', () => { a.wert = Math.max(1450, a.wert - 1); ton('rad'); draw(); }, 'secondary', { 'aria-label': 'Frequenz um 0,1 MHz senken' }), range, knopf('+', () => { a.wert = Math.min(1495, a.wert + 1); ton('rad'); draw(); }, 'secondary', { 'aria-label': 'Frequenz um 0,1 MHz erhöhen' })),
          h('div', { class: 'px-dials' }, h('label', {}, 'Rauschfilter', knopf('', () => { a.filter = (a.filter + 1) % 5; ton('rad'); draw(); }, 'px-dial').appendChild(filter).parentNode), h('label', {}, 'Phasendrehung', knopf('', () => { a.phase = (a.phase + 1) % 4; ton('rad'); draw(); }, 'px-dial').appendChild(phase).parentNode)), submitButton('Den stillen Kanal öffnen', () => ({ ...a }))); draw();
      } else if (p.art === 'peilung') {
        let cell = null; const out = h('div', { class: 'px-coordinate' }, 'Zwei Peilungen · ein Schnittpunkt');
        root.append(h('p', { class: 'px-muted px-small' }, 'Norden ↑ · Eine diagonale Peilung geht pro Feld einen Schritt seitlich und einen nach oben. Zähle Spalten A–G, Reihen 1–7.'),
          h('div', { class: 'px-grid-map' }, Array.from({ length: 49 }, (_, i) => { const x = i % 7, y = Math.floor(i / 7), ref = p.punkte.find(q => q.x === x && q.y === y), pos = 'ABCDEFG'[x] + (y + 1); return knopf('', e => { cell = pos; root.querySelectorAll('.px-map-cell').forEach(b => b.classList.remove('selected')); e.currentTarget.classList.add('selected'); out.textContent = `Deine Peilung: ${cell}`; ton('klick'); }, 'px-map-cell' + (ref ? ' ref' : ''), { 'aria-label': pos + (ref ? ' · ' + ref.name : ''), title: pos }).appendChild(h('span', {}, h('small', {}, pos), ref ? '⌂' : h('i'))).parentNode; })), out, submitButton('Hier am Wehr suchen', () => cell || ''));
      } else if (p.art === 'ventile') {
        const a = [0, 0, 0], meters = p.ziel.map(() => h('div', { class: 'px-gauge' })), vals = a.map(() => h('b', {}));
        const draw = () => { meters.forEach((g, j) => { const value = p.matrix[j].reduce((n, x, i) => n + x * a[i], 0); g.replaceChildren(h('small', {}, 'PEGEL ' + ['I', 'II', 'III'][j]), h('div', { class: 'px-gauge-dial', style: { '--angle': (-80 + value * 9) + 'deg' } }, h('i')), h('b', {}, `${value} / ${p.ziel[j]}`)); g.classList.toggle('matched', value === p.ziel[j]); }); vals.forEach((b, i) => b.textContent = a[i]); };
        root.append(h('div', { class: 'px-gauges' }, meters), h('div', { class: 'px-valves' }, a.map((_, i) => h('div', {}, h('small', {}, 'HANDRAD ' + 'ABC'[i]), h('div', {}, knopf('−', () => { a[i] = Math.max(0, a[i] - 1); ton('rad'); draw(); }, 'secondary', { 'aria-label': 'Handrad ' + 'ABC'[i] + ' senken' }), vals[i], knopf('+', () => { a[i] = Math.min(p.max, a[i] + 1); ton('rad'); draw(); }, 'secondary', { 'aria-label': 'Handrad ' + 'ABC'[i] + ' erhöhen' }))))), submitButton('Druckausgleich freigeben', () => a.slice())); draw();
      } else if (p.art === 'chronik') {
        const a = p.karten.map((_, i) => i), list = h('div', { class: 'px-records' });
        const draw = () => list.replaceChildren(...a.map((j, i) => h('article', {}, h('span', { class: 'px-record-number' }, String(i + 1).padStart(2, '0')), h('div', {}, h('small', {}, `${p.uhren[p.karten[j].uhr]} · ${p.karten[j].zeit}`), h('b', {}, p.karten[j].name), h('p', {}, p.karten[j].text)), h('div', { class: 'px-record-arrows' }, knopf('↑', () => { [a[i], a[i - 1]] = [a[i - 1], a[i]]; ton('papier'); draw(); }, 'secondary', { disabled: i === 0, 'aria-label': p.karten[j].name + ' nach vorne' }), knopf('↓', () => { [a[i], a[i + 1]] = [a[i + 1], a[i]]; ton('papier'); draw(); }, 'secondary', { disabled: i === a.length - 1, 'aria-label': p.karten[j].name + ' nach hinten' })))));
        root.append(h('div', { class: 'px-clock-note' }, h('span', { class: 'px-eyebrow' }, 'ABGLEICH MIT DER TALZEIT'), p.uhren.map((u, i) => h('span', {}, `${u}: ${p.versatz[i] > 0 ? '+' : '−'}${Math.abs(p.versatz[i])} Minuten`)), h('p', {}, 'Eine vorgehende Uhr zeigt zu viel. Ziehe ihren Vorsprung ab. Ordne von früh nach spät.')), list, submitButton('Die Nacht rekonstruieren', () => a.slice())); draw();
      } else if (p.art === 'band') {
        const selected = new Set();
        root.append(h('div', { class: 'px-tape-intro' }, h('div', { class: 'px-tape-reel' }), h('div', { class: 'px-tape-reel' }), h('span', {}, 'ORIGINAL ODER NACHAHMUNG?')),
          h('p', { class: 'px-muted' }, 'Noras Notiz beschreibt die Echtheitsmerkmale. Wähle genau drei Originalaufnahmen. Die Abschriften enthalten alle hörbaren Informationen.'),
          h('div', { class: 'px-tapes' }, p.baender.map((b, i) => { const choice = knopf('Original markieren', e => { if (selected.has(i)) selected.delete(i); else if (selected.size < 3) selected.add(i); const on = selected.has(i); e.currentTarget.classList.toggle('selected', on); e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = on ? '✓ Als Original markiert' : 'Original markieren'; }, 'secondary', { 'aria-pressed': 'false' }); return h('article', {}, h('div', {}, h('span', { class: 'px-eyebrow' }, `BAND ${String(i + 1).padStart(2, '0')}`), knopf('▶ Anhören', () => { tonal('funk'); Clavis.stimme.stopp(); sprich(b.text, 'funk'); }, 'secondary', { 'aria-label': 'Band ' + (i + 1) + ' anhören' })), h('p', {}, b.text), choice); })), submitButton('Nur die Originale übernehmen', () => [...selected]));
      } else if (p.art === 'relais') {
        const moves = [], a = p.links.slice(), b = p.rechts.slice(), left = h('div', { class: 'px-relay-grid' }), right = h('div', { class: 'px-relay-grid right' }), count = h('span', { class: 'px-muted px-small' });
        const draw = () => { left.replaceChildren(...a.map((v, i) => knopf('', () => { moves.push(i); Clavis.PremiumLogik.schalten(a, i, false); Clavis.PremiumLogik.schalten(b, i, true); ton('einrasten'); draw(); }, 'px-relay-cell' + (v ? ' on' : ''), { 'aria-label': `Kontakt ${Math.floor(i / 3) + 1}/${i % 3 + 1} · ${v ? 'an' : 'aus'}` }).appendChild(h('span', {}, h('i'), h('small', {}, `${Math.floor(i / 3) + 1}/${i % 3 + 1}`))).parentNode)); right.replaceChildren(...b.map(v => h('div', { class: 'px-relay-cell' + (v ? ' on' : ''), 'aria-label': v ? 'Rückkanal an' : 'Rückkanal aus' }, h('i')))); count.textContent = `${moves.length} Schaltungen · ${a.filter(Boolean).length}/${a.length} ${p.doppelt ? 'und ' + b.filter(Boolean).length + '/' + b.length : ''} Kontakte`; };
        const reset = () => { moves.length = 0; a.splice(0, 9, ...p.links); b.splice(0, 9, ...p.rechts); draw(); };
        root.append(h('p', { class: 'px-muted' }, p.doppelt ? 'Links schalten die Kontakte im Kreuz. Rechts reagieren sie diagonal. Alle 18 Lampen müssen gleichzeitig leuchten.' : 'Jeder Kontakt schaltet sich selbst und seine vier direkten Nachbarn. Alle neun Lampen müssen leuchten.'), h('div', { class: 'px-relay-pair' }, h('div', {}, h('small', {}, 'SENDESCHLEIFE · BEDIENFELD'), left), p.doppelt ? h('div', {}, h('small', {}, 'RÜCKKANAL · ANZEIGE'), right) : null), count,
          h('div', { class: 'px-machine-actions' }, knopf('Letzten Zug zurück', () => { const i = moves.pop(); if (i != null) { Clavis.PremiumLogik.schalten(a, i, false); Clavis.PremiumLogik.schalten(b, i, true); draw(); } }, 'secondary'), knopf('Ausgangszustand', reset, 'secondary')), submitButton('Die Rufschleife löschen', () => [...new Set(moves)].filter(i => moves.filter(j => j === i).length % 2))); draw();
      } else if (p.art === 'leuchtfeuer') {
        const a = [0, 1, 2, 3], list = h('div', { class: 'px-signal-order' }); let chosen = null;
        const icons = ['♧', '♤', '≈', '✧'];
        const draw = () => list.replaceChildren(...a.map((v, i) => knopf('', () => { if (chosen === null) chosen = i; else { [a[chosen], a[i]] = [a[i], a[chosen]]; chosen = null; ton('rad'); } draw(); }, 'px-signal-stone' + (chosen === i ? ' selected' : '')).appendChild(h('span', {}, h('small', {}, String(i + 1)), h('b', {}, icons[v]), h('span', {}, p.namen[v]))).parentNode));
        root.append(h('p', { class: 'px-muted' }, 'Die Gravur am Wehr nennt die Reihenfolge. Tippe zwei Linsen an, um sie zu tauschen.'), list, submitButton('Das Leuchtfeuer senden', () => a.slice())); draw();
      }
      return root;
    }
    // ---------------------------------------------------------------- Kapitel mit eigener Kamera und synchronisierten Untertiteln
    function film(scene, finish) {
      clearTimeout(filmTimer); Clavis.stimme.stopp(); z.szeneSprachNr++;
      spiel.querySelector('.px-cinema')?.remove(); schliessen();
      z.film = scene; z.filmIndex = 0; z.filmFertig = false;
      const image = dekorBild(scene.ort || z.ort, 'px-cinema-art');
      const caption = h('p', { class: 'px-cinema-caption', 'aria-live': 'polite' }), label = h('span', { class: 'px-eyebrow' }), progress = h('div', { class: 'px-film-progress' });
      const next = knopf('Weiter →', step, 'primary');
      const skip = knopf('Szene überspringen', () => end(), 'px-skip');
      const overlay = h('div', { class: 'px-cinema', role: 'dialog', 'aria-modal': 'true', 'aria-label': scene.titel, tabindex: -1 }, image, h('div', { class: 'px-cinema-shade' }), h('div', { class: 'px-cinema-top' }, h('span', { class: 'px-brand' }, 'CLAVIS · PREMIUM'), h('span', {}, scene.titel)),
        h('div', { class: 'px-cinema-middle' }, h('span', { class: 'px-cinema-number' }, scene.id?.startsWith('intro') ? 'PROLOG' : 'REVIER 17')),
        h('div', { class: 'px-cinema-bottom' }, progress, label, caption, h('div', { class: 'px-cinema-actions' }, h('small', {}, 'Die Spielzeit pausiert während dieser Szene.'), skip, next)));
      spiel.append(overlay); overlay.focus({ preventScroll: true });
      function line() {
        clearTimeout(filmTimer); const token = ++z.szeneSprachNr; Clavis.stimme.stopp();
        const entry = scene.zeilen[z.filmIndex]; if (!entry) return end();
        const [heading, text, role, soundName] = entry;
        label.textContent = heading; caption.textContent = text; caption.className = 'px-cinema-caption ' + (role || '');
        next.textContent = z.filmIndex >= scene.zeilen.length - 1 ? 'Weiter ins Revier →' : 'Weiter →';
        progress.replaceChildren(...scene.zeilen.map((_, i) => h('i', { class: i <= z.filmIndex ? 'seen' : '' })));
        if (soundName) tonal(soundName);
        image.style.setProperty('--shot', String(z.filmIndex));
        const minimum = Math.max(5500, text.length * 45);
        next.disabled = true; clearTimeout(lockTimer); lockTimer = setTimeout(() => { if (next.isConnected) next.disabled = false; }, reduziert ? 200 : 1800);
        // Ton und Untertitel können aus sein; der Text bekommt trotzdem genug Lesezeit.
        const start = Date.now();
        sprich(text, role || 'erzaehler').then(() => { if (token !== z.szeneSprachNr || z.verlassen) return; filmTimer = setTimeout(() => { if (overlay.isConnected && token === z.szeneSprachNr) step(); }, Math.max(1200, minimum - (Date.now() - start))); });
      }
      function step() { if (next.disabled) return; z.filmIndex++; line(); }
      function end() {
        if (z.filmFertig) return; z.filmFertig = true; clearTimeout(filmTimer); clearTimeout(lockTimer); z.szeneSprachNr++; Clavis.stimme.stopp();
        overlay.classList.add('leaving');
        setTimeout(() => { overlay.remove(); if (z.verlassen) return; z.film = null; finish(); }, reduziert ? 0 : 400);
      }
      line();
    }
    function sceneFromState(scene) {
      if (z.filmId === scene.id) return;
      z.filmId = scene.id; z.gesehen.add(scene.id);
      if (!z.jetztTon) { game(); const gate = h('div', { class: 'px-cinema px-resume-gate' }, h('div', {}, h('span', { class: 'px-eyebrow' }, 'DU BIST IM FORSTREVIER'), h('h2', {}, 'Die Nacht wartet.'), knopf('Mit Ton fortsetzen', () => { gate.remove(); tonStart(); play(); }, 'primary'), knopf('Ohne Ton fortsetzen', () => { gate.remove(); z.jetztTon = true; k.schalten(false); play(); }, 'secondary'))); spiel.append(gate); return; }
      play();
      function play() { film(scene, () => { if (host) senden({ typ: 'premium_weiter', id: scene.id }); else { toast('Auf die Spielleitung warten · die Zeit bleibt pausiert.'); update(); } }); }
    }
    function moment(art) {
      if (!leinwand?.isConnected || z.film || z.ende || z.verlassen) return;
      const t = ({ ast: 'Ein Ast bricht. Die Schritte dahinter halten mit deinen an.', fenster: 'Im Fenster hinter dir steht jemand. Als du hinsiehst, ist dort nur dein Spiegelbild.', ruf: 'Ganz weit zwischen den Bäumen hörst du deine eigene Stimme.', morgen: 'Der Wind dreht. Im Osten wird der Himmel heller. Die Leitung beginnt wieder zu summen.', antwort: 'Drei Lichter gehen zwischen den Bäumen an. Du hast geantwortet.', lauschen: 'Du hörst Wasser. Ein loses Rad. Und darunter einen echten Atemzug.' })[art] || '';
      const label = leinwand.querySelector('.px-ambient-caption'); if (label) { label.textContent = t; label.classList.add('show'); setTimeout(() => label.classList.remove('show'), 8500); }
      tonal(['antwort', 'ruf', 'fenster'].includes(art) ? 'ruf' : art === 'morgen' ? 'knarren' : 'ast');
      leinwand.classList.add('px-moment-' + art); setTimeout(() => leinwand?.classList.remove('px-moment-' + art), 5000);
      if (prefs.schreck && ['fenster', 'antwort'].includes(art) && !document.hidden) {
        setTimeout(() => { if (!prefs.schreck || z.verlassen || z.film || z.ende || document.hidden) return; Clavis.schreck(spiel, 'gestalt', { blut: false, staerke: reduziert ? Math.min(2, prefs.staerke) : prefs.staerke }); }, 1300);
      }
    }
    function ende(e) {
      z.ende = e; schliessen(); clearTimeout(filmTimer); Clavis.stimme.stopp(); k.musikStoppen(); k.ambienteStoppen();
      const p = e.premium;
      film({ titel: p.titel, ort: e.geschafft ? 'turm' : 'hof', id: 'outro', zeilen: [[e.geschafft ? 'Das Ende deiner Nacht' : e.grund === 'zeit' ? 'Die letzte Minute ist vergangen' : 'Du beendest die Nachtwache', p.text, 'erzaehler', e.geschafft ? 'erfolg' : 'herz'], ['Am nächsten Morgen', p.nach, 'brief', 'regen']] }, () => {
        sound.stop(); k.musikStoppen(); spiel.classList.add('px-ending-screen');
        spiel.replaceChildren(dekorBild(e.geschafft ? 'turm' : 'hof', 'px-cover-art'), h('div', { class: 'px-cover-shade' }), h('div', { class: 'px-ending' },
          h('span', { class: 'px-eyebrow' }, e.geschafft ? 'DEINE GESCHICHTE · ABGESCHLOSSEN' : 'REVIER 17 · DIE LEITUNG BLEIBT OFFEN'), h('h1', {}, p.titel),
          h('div', { class: 'px-stars', 'aria-label': e.sterne + ' von 3 Sternen' }, '★'.repeat(e.sterne) + '☆'.repeat(3 - e.sterne)), h('p', { class: 'px-lead' }, p.nach),
          h('div', { class: 'px-ending-numbers' }, h('span', {}, h('b', {}, zeit(e.zeit)), 'Deine Zeit'), h('span', {}, h('b', {}, `${e.geloest}/8`), 'Verbindungen gelöst'), h('span', {}, h('b', {}, String(e.hinweise)), 'Hinweise')),
          h('div', { class: 'px-ending-choices' }, h('span', {}, p.gerettet ? '◉ Nora mitgenommen' : '○ Nora zurückgelassen'), h('span', {}, p.kopie ? '▣ Beweise gesichert' : '□ Aufzeichnungen zurückgelassen'), h('span', {}, p.still ? '⌁ Rückruf getrennt' : '⌁ Leitung offengehalten')),
          !e.geschafft ? h('p', { class: 'px-muted' }, `Das Lösungswort war ${e.wort}.`) : null,
          host ? knopf('Zurück zu Clavis', () => host.fertig(), 'primary') : h('p', {}, 'Danke fürs Mitspielen. Du kannst diese Seite schließen.')));
      });
    }
    function destroy() {
      if (z.verlassen) return; z.verlassen = true;
      [filmTimer, lockTimer, animTimer].forEach(clearTimeout); clearInterval(takt); clearInterval(destroyTimer); z.szeneSprachNr++;
      z.wartend.forEach(w => { clearTimeout(w.t); w.resolve({ richtig: false, info: 'Das Spiel wurde beendet.' }); }); z.wartend.clear();
      sound.dispose(); Clavis.stimme.stopp(); k.musikStoppen(); k.ambienteStoppen(); document.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('pagehide', destroy);
    }
    function key(e) {
      if (!spiel.isConnected) return destroy();
      const dialog = spiel.querySelector('.px-cinema') || spiel.querySelector('.px-modal');
      if (dialog && e.key === 'Tab') {
        const a = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(x => x.getClientRects().length);
        if (a.length && e.shiftKey && document.activeElement === a[0]) { e.preventDefault(); a[a.length - 1].focus(); }
        else if (a.length && !e.shiftKey && document.activeElement === a[a.length - 1]) { e.preventDefault(); a[0].focus(); }
      }
      if (e.key === 'Escape' && z.modal && !z.film) schliessen();
      if (dialog && e.key === 'Tab' && document.activeElement === dialog) { const first = dialog.querySelector('button:not(:disabled),input:not(:disabled)'); if (first) { e.preventDefault(); first.focus(); } }
      if (e.key.toLowerCase() === 'j' && !/INPUT|TEXTAREA/.test(e.target.tagName) && !dialog) journal();
    }
    function empfangen(d) {
      if (!d || z.verlassen) return;
      if (d.typ === 'raum') {
        z.raum = d.raum;
        if (prefs.schreck == null || R().schreck?.standard === false) prefs.schreck = !!R().schreck?.standard;
        if (!z.stand) lobby();
      } else if (d.typ === 'stand') {
        if (d.premium?.sequenz < z.letzteSequenz) return;
        z.letzteSequenz = d.premium?.sequenz ?? z.letzteSequenz;
        const old = z.stand; z.stand = d; z.rest = d.restMs; z.empfangenUm = Date.now();
        if (!R() || z.ende) return;
        if (d.phase === 'lobby') return lobby();
        if (!leinwand?.isConnected) game();
        const newlySolved = ORDER.find(id => d.geloest?.[id] && !old?.geloest?.[id]);
        if (newlySolved) { schliessen(); toast(`Verbindung hergestellt · Fundstück ${d.wort[ORDER.indexOf(newlySolved)]}`, 'good'); }
        if (d.premium?.szene) sceneFromState(d.premium.szene);
        else if (z.film && z.film.id !== 'outro') { clearTimeout(filmTimer); clearTimeout(lockTimer); z.szeneSprachNr++; Clavis.stimme.stopp(); spiel.querySelector('.px-cinema')?.remove(); z.film = null; }
        if (z.modal?.art === 'puzzle') z.modal.tip();
        update();
      } else if (d.typ === 'antwort') { const w = z.wartend.get(d.nr); if (w) { clearTimeout(w.t); z.wartend.delete(d.nr); w.resolve(d); } }
      else if (d.typ === 'premium_moment') moment(d.art);
      else if (d.typ === 'ende' && !z.ende) ende(d.ergebnis);
      else if (d.typ === 'vorbei' || d.typ === 'entfernt') { destroy(); spiel.replaceChildren(h('div', { class: 'px-wait' }, h('h1', {}, 'Die Leitung ist getrennt.'), h('p', {}, d.typ === 'entfernt' ? 'Du wurdest von der Runde abgemeldet.' : 'Die Spielleitung hat die Runde geschlossen.'))); }
    }
    takt = setInterval(() => {
      if (z.verlassen || !spiel.isConnected) return destroy();
      if (uhr?.isConnected) { uhr.textContent = zeit(zeitRest()); uhr.parentElement.classList.toggle('urgent', zeitRest() < 5 * 60000); }
      if (z.jetztTon && !z.ende && z.stand?.phase === 'spiel') k.intensitaet(.15 + .6 * (1 - zeitRest() / (R().minuten * 60000)));
    }, 500);
    function sichtbar() { if (!document.hidden && spiel.isConnected && z.jetztTon && !z.ende && k.an()) k.musik('spuk', 'ab14', R().stimmung); }
    document.addEventListener('keydown', key); document.addEventListener('visibilitychange', sichtbar); window.addEventListener('pagehide', destroy);
    lobby();
    return { empfangen, destroy, element: spiel };
  }
  // Die bisherige Ansicht wird erst bei der ersten Raum-Nachricht erzeugt. Keine verwaisten Timer beim Umschalten.
  const standard = Clavis.Spiel.erstellen;
  Clavis.Spiel.erstellen = (root, opt) => {
    let view = null; const warten = [];
    root.replaceChildren(h('div', { class: 'px-verbindung' }, 'Der Raum wird vorbereitet …'));
    return { empfangen(d) { if (!view && d?.typ === 'raum') { view = d.raum?.premium === 'wald17' ? erstellen(root, opt) : standard(root, opt); view.empfangen(d); warten.splice(0).forEach(x => view.empfangen(x)); } else if (view) view.empfangen(d); else if (d?.typ === 'vorbei' || d?.typ === 'entfernt') root.textContent = 'Die Runde ist geschlossen.'; else warten.push(d); }, destroy() { if (view?.destroy) view.destroy(); }, get element() { return view?.element; } };
  };
  Clavis.PremiumSpiel = { erstellen };
})();
