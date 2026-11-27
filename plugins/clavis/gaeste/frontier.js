'use strict';
/* Mercy Creek: feste Kameras, Spielgeräte, regieführende Filmsequenzen und gemeinsamer Zustand. */
(() => {
    const h = (tag, attr, ...kinder) => Clavis.el(tag, attr, ...kinder.flat(Infinity));
    const time = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    const ICON = { BERG: '△', STERN: '✦', RAD: '⊕', MOND: '☾', KREUZ: '✚', RAUTE: '◇', AUGE: '◉' };
    const POS = { A: [90, 150], B: [275, 70], C: [275, 260], D: [470, 45], E: [470, 170], F: [655, 290], G: [655, 90], T: [855, 85], R: [855, 280] };
    function erstellen(root, { senden, ich, host = null }) {
        const el = h('section', { class: 'mc-spiel', 'aria-label': 'Mercy Creek – Die letzte Schicht' });
        root.replaceChildren(el);
        const z = { raum: null, stand: null, ort: 'bahnhof', gestartet: false, ton: false, ende: null, verlassen: false, modal: null, film: null, filmId: null, filmToken: 0, seq: -1, nr: 0, anfragen: new Map(), rest: 0, empfangen: Date.now(), ui: '', travel: false, momente: new Set(), sturm: 0 };
        const sound = Clavis.FrontierKlang(), K = Clavis.klang, S = Clavis.stimme;
        const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        let prefs = { schreck: null, stimmen: false, laut: .65, musik: true, bewegung: !reduced };
        try {
            prefs = { ...prefs, ...JSON.parse(localStorage.getItem('clavis:mercy:prefs') || '{}') };
        }
        catch (_) { }
        if (reduced)
            prefs.bewegung = false;
        let stage, clock, map, goal, bag, world, heartbeat, travelTimer, filmTimer;
        const timers = new Set();
        const after = (ms, f) => { const id = setTimeout(() => { timers.delete(id); if (!z.verlassen)
            f(); }, ms); timers.add(id); return id; };
        const save = () => { try {
            localStorage.setItem('clavis:mercy:prefs', JSON.stringify(prefs));
        }
        catch (_) { } };
        const R = () => z.raum, P = () => z.stand?.frontier || { offen: ['bahnhof'], bereit: [], gelesen: {}, wahl: {}, journal: [], inventar: [] }, done = id => !!z.stand?.geloest[id];
        const rest = () => Math.max(0, z.rest - (z.stand?.phase === 'spiel' && !P().pausiert && !z.ende ? Date.now() - z.empfangen : 0));
        const button = (label, f, cls = '', attr = {}) => h('button', { type: 'button', class: 'mc-button ' + cls, onclick: f, ...attr }, label);
        const cue = art => { if (!z.ton)
            return; if (art === 'pianola' && P().motiv && sound.melodie)
            sound.melodie(P().motiv);
        else
            sound.cue(art); };
        function bild(ort, cls = '') { const b = h('div', { class: 'mc-bild ' + cls, 'aria-hidden': 'true' }); b.innerHTML = Clavis.FrontierWelt.bild(ort, { geloest: z.stand?.geloest, wahl: P().wahl }); return b; }
        function tonStart() { z.ton = true; K.bereit(); K.musikStoppen(); K.ambienteStoppen(); sound.laut(prefs.laut); sound.musik(prefs.musik); sound.start(z.ort); }
        function request(d) { const nr = ++z.nr; return new Promise(resolve => { const t = after(12000, () => { z.anfragen.delete(nr); resolve({ richtig: false, info: 'Keine Antwort aus Mercy Creek. Prüfe die Verbindung zur Spielleitung.' }); }); z.anfragen.set(nr, { resolve, t }); Promise.resolve(senden({ ...d, nr })).catch(() => { clearTimeout(t); timers.delete(t); z.anfragen.delete(nr); resolve({ richtig: false, info: 'Die Verbindung zur Spielleitung ist unterbrochen.' }); }); }); }
        function toast(text, art = '') { const t = h('div', { class: 'mc-toast ' + art, role: 'status' }, text); el.append(t); after(6500, () => t.remove()); }
        function lobby() {
            el.className = 'mc-spiel mc-eingang' + (!prefs.bewegung ? ' mc-ruhig' : '');
            if (!R()) {
                el.replaceChildren(h('div', { class: 'mc-warten' }, 'Eine Fahrkarte ins Gebirge wird vorbereitet …'));
                return;
            }
            const start = button(host ? 'Die letzte Fahrt antreten →' : z.gestartet ? 'Bereit · auf die Spielleitung warten' : 'Im Zug Platz nehmen', () => { z.gestartet = true; tonStart(); if (host)
                host.starten();
            else
                lobby(); }, 'primary', { disabled: !host && z.gestartet });
            el.replaceChildren(bild('strasse', 'mc-cover-art'), h('div', { class: 'mc-cover-shade' }), h('header', { class: 'mc-cover-header' }, h('b', { class: 'mc-brand' }, 'CLAVIS'), h('span', { class: 'mc-premium' }, 'PREMIUM · VOL. II')), h('div', { class: 'mc-cover-copy' }, h('span', { class: 'mc-eyebrow' }, 'ROCKY MOUNTAINS · COLORADO · 1897'), h('h1', {}, 'Mercy', h('em', {}, 'Creek.')), h('div', { class: 'mc-cover-sub' }, 'DIE LETZTE SCHICHT'), h('p', { class: 'mc-cover-lead' }, 'Dreizehn Menschen sind aus den Büchern verschwunden. Heute Nacht steht die letzte Schicht auf deinem Namen.'), h('div', { class: 'mc-fakten' }, h('span', {}, '9 Schauplätze'), h('span', {}, '10 verbundene Rätsel'), h('span', {}, R().minuten + ' Minuten'), h('span', {}, 'Ab 14')), h('div', { class: 'mc-cover-actions' }, start, button('Klang & Inszenierung', settings, 'ghost')), h('p', { class: 'mc-small mc-muted' }, 'Text & Klang statt automatischer Computerstimme. Auf Wunsch mit natürlicher lokaler Stimme.'), h('label', { class: 'mc-check' }, h('input', { type: 'checkbox', checked: prefs.schreck, onchange: e => { prefs.schreck = e.target.checked; save(); } }), 'Jumpscares erlauben'), z.stand?.spieler?.length > 1 ? h('p', { class: 'mc-small' }, 'Im selben Zug: ' + z.stand.spieler.map(p => p.name).join(' · ')) : null), h('footer', { class: 'mc-cover-footer' }, h('span', {}, 'Eine Stadt. Ein Berg. Dreizehn Namen.'), h('span', {}, 'Kopfhörer empfohlen · vollständig ohne Ton lösbar')));
        }
        function settings() {
            const voices = S.stimmen?.() || [], select = h('select', { class: 'mc-input', 'aria-label': 'Natürliche deutsche Stimme', onchange: e => S.waehlen(e.target.value) }, voices.map(v => h('option', { value: v.id, selected: v.id === S.auswahl?.() }, v.name)));
            const body = h('div', { class: 'mc-settings' }, h('p', { class: 'mc-lead' }, 'Deine Inszenierung. Alle Hinweise bleiben auch ohne Ton lesbar.'), button(K.an() ? 'Geräusche an' : 'Geräusche aus', () => { K.schalten(!K.an()); if (K.an())
                tonStart();
            else
                sound.stop(); settings(); }, 'ghost', { 'aria-pressed': String(K.an()) }), h('label', {}, 'Lautstärke', h('input', { type: 'range', min: .1, max: 1, step: .05, value: prefs.laut, 'aria-label': 'Lautstärke', oninput: e => { prefs.laut = Number(e.target.value); sound.laut(prefs.laut); save(); } })), button(prefs.musik ? 'Musikalische Spannung an' : 'Musikalische Spannung aus', () => { prefs.musik = !prefs.musik; sound.musik(prefs.musik); save(); settings(); }, 'ghost'), button(prefs.stimmen ? 'Vorlesen an · natürliche Stimme' : 'Filmmodus · Text und Geräusche', () => { prefs.stimmen = !prefs.stimmen; S.schalten(prefs.stimmen); if (prefs.stimmen && !z.ton)
                tonStart(); save(); settings(); }, 'ghost'), voices.length ? h('div', { class: 'mc-voice-choice' }, h('label', {}, 'Lokale deutsche Stimme', select), button('Stimme probehören', async () => { if (!K.an())
                K.schalten(true); if (!z.ton)
                tonStart(); const vorher = S.an(); S.schalten(true); S.stopp(); await S.sprechen('Mercy Creek. Eine Stadt, ein Berg und dreizehn Namen. Diesmal entscheidest du, für wen die Glocke läutet.'); if (!prefs.stimmen)
                S.schalten(vorher); }, 'ghost')) : h('p', { class: 'mc-small mc-muted' }, 'Keine natürliche deutsche Lokalstimme verfügbar. Es werden keine verfremdeten Ersatzstimmen verwendet.'), button(prefs.schreck ? 'Jumpscares an' : 'Jumpscares aus', () => { prefs.schreck = !prefs.schreck; save(); settings(); }, 'ghost', { role: 'switch', 'aria-checked': String(!!prefs.schreck) }), button(prefs.bewegung ? 'Kamerabewegung & Animation an' : 'Reduzierte Bewegung', () => { prefs.bewegung = !prefs.bewegung; el.classList.toggle('mc-ruhig', !prefs.bewegung); save(); settings(); }, 'ghost'), h('p', { class: 'mc-small mc-muted' }, 'Donner bleibt bei ausgeschalteten Jumpscares hörbar. Schreckgestalten und harte Lichtblitze folgen deiner Einstellung.'));
            modal('Klang & Inszenierung', body, { art: 'settings' });
        }
        function ziel() {
            if (done('glocke'))
                return 'Das Siegel wartet. Entscheide, was aus deinem Erbe wird.';
            if (done('sprengung'))
                return 'Der Fluchtstollen führt in die Kapelle. Das Glockenbuch und die Pianolazeichen gehören zusammen.';
            if (done('schichten'))
                return 'Sichere oder verbrenne das Originalbuch. Trenne dann die Sprengleitung zum Herzen der Grube.';
            if (done('stollen'))
                return 'Die Schichtzettel erklären das Unglück. Stelle die fünf Fördergruppen wieder her.';
            if (done('winde'))
                return 'Gehe mit dem Grubenriss durch den Stollen. Zwei Kontrollmarken führen ins Archiv.';
            if (done('pumpen'))
                return !P().wahl.mara ? 'Mara lebt unter dem Gitter. Entscheide, ob du sie mitnimmst.' : !P().wahl.gold ? 'Entscheide in der Bank, ob du den Goldbarren mitnimmst.' : 'Gleiche den Förderkorb aus. Die Lasttafel berücksichtigt deine Entscheidungen.';
            if (done('tresor'))
                return !P().wahl.gold ? 'Unter dem Gold liegt der Weg zur Mine. Entscheide, was du mitnimmst.' : 'Das Förderhaus ist offen. Stelle die Entwässerung wieder her.';
            if (done('pianola') && done('depesche'))
                return 'Die Bank ist offen. Der Brief erklärt die vier gekoppelten Tresorräder.';
            if (done('weiche'))
                return 'Untersuche Saloon und Sheriffbüro. Beide Spuren führen zur Blackwater Bank.';
            return P().gelesen.fahrbefehl ? 'Stelle die Weichen gemäß Fahrbefehl. Gib dann die letzte Fahrt frei.' : 'Untersuche deinen Koffer und den letzten Fahrbefehl am Bahnhof.';
        }
        function game() {
            el.className = 'mc-spiel' + (!prefs.bewegung ? ' mc-ruhig' : '');
            z.ui = '';
            world = bild(z.ort, 'mc-stage-art');
            const ort = R().orte[z.ort];
            stage = h('div', { class: 'mc-stage', 'data-ort': z.ort, tabindex: -1 }, world, h('div', { class: 'mc-weather' }), h('div', { class: 'mc-snow' }), h('div', { class: 'mc-fog' }), h('div', { class: 'mc-light' }), h('div', { class: 'mc-grain' }), h('div', { class: 'mc-flash' }), h('div', { class: 'mc-stage-title' }, h('span', { class: 'mc-eyebrow' }, ort.kapitel), h('h2', {}, ort.name), h('p', {}, ort.sub)), h('div', { class: 'mc-hotspots' }), h('div', { class: 'mc-whisper', role: 'status' }), button('◎ Gegenstände zeigen', () => { el.classList.toggle('mc-zeigen'); }, 'mc-reveal'));
            clock = h('b', { role: 'timer', 'aria-label': 'Verbleibende Spielzeit' }, time(rest()));
            map = h('nav', { class: 'mc-map', 'aria-label': 'Schauplätze' });
            goal = h('div', { class: 'mc-goal', role: 'status' });
            bag = h('footer', { class: 'mc-bag' });
            el.replaceChildren(h('header', { class: 'mc-header' }, h('div', { class: 'mc-brand-wrap' }, h('b', { class: 'mc-brand' }, 'CLAVIS'), h('small', {}, 'MERCY CREEK')), h('div', { class: 'mc-bell-counter' }, h('span', {}, 'DIE DREIZEHNTE GLOCKE'), h('div', { class: 'mc-bells' })), h('div', { class: 'mc-clock' }, h('small', {}, 'BIS ZUR LETZTEN SCHICHT'), clock), button('♫', settings, 'icon', { 'aria-label': 'Klang und Inszenierung' }), button('▤', journal, 'icon', { 'aria-label': 'Reisebuch öffnen' }), host ? button('×', () => host.beenden(), 'icon', { 'aria-label': 'Spiel verlassen' }) : null), h('div', { class: 'mc-layout' }, stage, h('aside', { class: 'mc-sidebar' }, h('div', { class: 'mc-map-top' }, h('span', { class: 'mc-eyebrow' }, 'EINE STADT IM GEBIRGE'), h('h3', {}, 'Dein Weg')), map, h('div', { class: 'mc-sidebar-bottom' }, h('p', { class: 'mc-current-truth' }), button('Das Reisebuch öffnen ↗', journal, 'ghost'), h('div', { class: 'mc-progress' })))), goal, bag);
            stage.addEventListener('pointermove', e => { if (!prefs.bewegung || e.pointerType !== 'mouse')
                return; const b = stage.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; stage.style.setProperty('--lx', x * 100 + '%'); stage.style.setProperty('--ly', y * 100 + '%'); world.style.setProperty('--px', ((x - .5) * 7) + 'px'); world.style.setProperty('--py', ((y - .5) * 4) + 'px'); });
            if (z.ton)
                sound.ort(z.ort);
            update();
        }
        function update() {
            if (!stage?.isConnected)
                return;
            clock.textContent = time(rest());
            el.classList.toggle('mc-bedrohung', rest() < 5 * 60000);
            const sig = JSON.stringify([z.stand.geloest, z.stand.spieler, P().gelesen, P().wahl, P().inventar, P().glockenschlag, P().pausiert]);
            if (sig === z.ui)
                return;
            z.ui = sig;
            world.innerHTML = Clavis.FrontierWelt.bild(z.ort, { geloest: z.stand.geloest, wahl: P().wahl });
            el.querySelector('.mc-bells').replaceChildren(...Array.from({ length: 13 }, (_, i) => h('i', { class: i < P().glockenschlag ? 'struck' : '', title: `Schlag ${i + 1}` })));
            const ort = R().orte[z.ort];
            stage.querySelector('.mc-hotspots').replaceChildren(...ort.objekte.map(id => { const s = R().stationen[id], o = s || R().objekte[id], known = !s && P().gelesen[id], solved = done(id); return button('', () => inspect(id), 'mc-hotspot' + (s ? ' puzzle' : '') + (solved ? ' solved' : '') + (known ? ' known' : ''), { style: { left: o.x + '%', top: o.y + '%' }, 'aria-label': (o.name || o.titel) + (solved ? ' · gelöst' : '') }).appendChild(h('span', {}, h('b', { class: 'mc-hotspot-dot', 'aria-hidden': 'true' }, solved ? '✓' : s ? '◇' : o.art === 'wahl' ? '!' : '+'), h('span', { class: 'mc-hotspot-label' }, o.name || o.titel, h('small', {}, solved ? 'Gelöst' : s ? 'Untersuchen · Mechanismus' : o.art === 'wahl' ? 'Deine Entscheidung' : 'Untersuchen')))).parentNode; }));
            map.replaceChildren(...Object.entries(R().orte).map(([id, o], i) => { const open = P().offen.includes(id); return button('', () => gehen(id), 'mc-map-place' + (id === z.ort ? ' current' : '') + (open ? ' open' : ''), { disabled: !open, 'aria-current': id === z.ort ? 'location' : null, title: open ? o.name : 'Noch nicht erreichbar' }).appendChild(h('span', {}, h('i', {}, String(i + 1).padStart(2, '0')), h('span', {}, o.name), h('b', {}, id === z.ort ? '←' : open ? '↗' : '·'))).parentNode; }));
            el.querySelector('.mc-current-truth').textContent = done('stollen') ? 'Vane braucht einen neuen Besitzer. Du bist seine offene Tür.' : done('pumpen') ? 'Mara ist am Leben. Und Vane ist seit sechs Jahren tot.' : done('depesche') ? 'Dreizehn Quittungen. Keine Rückfahrkarten.' : 'Dein Erbe hat auf dich gewartet.';
            const n = Object.keys(z.stand.geloest).length;
            el.querySelector('.mc-progress').replaceChildren(h('span', {}, `${n} / 10 VERBINDUNGEN`), h('div', {}, h('i', { style: { width: n * 10 + '%' } })));
            goal.replaceChildren(h('i'), h('small', {}, 'DEIN NÄCHSTER SCHRITT'), h('span', {}, ziel()), P().pausiert ? h('b', {}, 'Zeit pausiert') : null);
            bag.replaceChildren(h('span', { class: 'mc-eyebrow' }, 'BEI DIR'), P().inventar.length ? P().inventar.map(i => button('', () => journal(), 'mc-item', { title: i.name }).appendChild(h('span', {}, h('b', {}, i.zeichen), h('span', {}, i.name))).parentNode) : h('span', { class: 'mc-small mc-muted' }, 'Ein Koffer. Ein Testament. Eine einfache Fahrt.'), h('span', { class: 'mc-team' }, z.stand.spieler.length > 1 ? z.stand.spieler.length + ' Reisende · gemeinsames Inventar' : 'Allein unterwegs'));
        }
        function gehen(id) { if (!P().offen.includes(id) || z.ort === id || z.travel || P().szene || z.ende)
            return; z.travel = true; close(); cue('schritte'); el.classList.add('mc-travel'); travelTimer = after(prefs.bewegung ? 430 : 0, () => { z.ort = id; game(); el.classList.remove('mc-travel'); z.travel = false; stage.focus({ preventScroll: true }); if (['stollen', 'kammer'].includes(id) && !z.momente.has('enter:' + id)) {
            z.momente.add('enter:' + id);
            moment(id === 'stollen' ? 'atmen' : 'riss');
        } }); }
        function modal(titel, body, { art = '', id = '' } = {}) {
            const previous = z.modal?.vorher || document.activeElement;
            el.querySelector('.mc-modal')?.remove();
            const panel = h('section', { class: 'mc-panel ' + art, role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: -1 }, h('header', { class: 'mc-panel-head' }, h('span', { class: 'mc-eyebrow' }, art === 'puzzle' ? 'NAHAUFNAHME · MERCY CREEK' : 'AUS DEINEM REISEBUCH'), button('×', close, 'mc-close', { 'aria-label': 'Zurück in die Stadt' })), h('h2', {}, titel), body);
            const ground = h('div', { class: 'mc-modal', onclick: e => { if (e.target === ground)
                    close(); } }, panel);
            el.append(ground);
            z.modal = { art, id, vorher: previous };
            panel.focus({ preventScroll: true });
            return panel;
        }
        function close() { const p = z.modal?.vorher; el.querySelector('.mc-modal')?.remove(); z.modal = null; S.stopp(); if (p?.isConnected)
            p.focus({ preventScroll: true }); }
        function journal() {
            const entries=h('div',{class:'mc-journal-entries'});
            const draw=story=>{entries.replaceChildren(...P().journal.filter(x=>story?x.art==='szene':x.art!=='szene').map(x=>h('article',{class:'mc-entry '+x.art},h('span',{class:'mc-eyebrow'},x.art==='szene'?'KAPITEL NACHLESEN':x.art==='wahl'?'DIESE ENTSCHEIDUNG BLEIBT':x.art==='erkenntnis'?'EINE VERBINDUNG':'FUND'),h('h3',{},x.titel.replace(/^Szene: /,'')),h('p',{},x.text))));if(!entries.children.length)entries.append(h('p',{},'Noch keine Aufzeichnungen. Dein Koffer steht auf dem Bahnsteig.'));};
            const tabs=h('div',{class:'mc-journal-tabs'},button('Funde & Entscheidungen',()=>draw(false),'ghost'),button('Szenen nachlesen',()=>draw(true),'ghost'));
            modal('Dein Reisebuch',h('div',{class:'mc-journal'},h('p',{class:'mc-muted'},'Eure gemeinsamen Funde und die vollständige Geschichte. Beim Nachlesen läuft die Spielzeit weiter.'),tabs,entries),{art:'journal'});draw(false);
        }
        async function inspect(id) {
            if (P().szene || z.ende || z.travel)
                return;
            const s = R().stationen[id];
            if (s) {
                if (done(id))
                    return modal(s.titel, h('div', { class: 'mc-complete' }, h('b', {}, '✓'), h('p', {}, P().journal.find(x => x.titel === s.titel)?.text), button('Zurück in die Stadt', close, 'primary')));
                if (!P().bereit.includes(id)) {
                    const missing = s.braucht.find(x => !done(x)), note = s.lesen.find(x => !P().gelesen[x]);
                    return modal(s.titel, h('div', { class: 'mc-document' }, h('span', { class: 'mc-eyebrow' }, 'EINE VERBINDUNG FEHLT'), h('p', {}, missing ? `Untersuche zuerst „${R().stationen[missing].titel}“.` : note ? `Lies zuerst „${R().objekte[note].name}“.` : 'Entscheide zuerst über Mara und den Goldbarren. Deine Entscheidung verändert die Last des Korbs.'), button('Reisebuch öffnen', journal, 'ghost')));
                }
                return raetsel(id);
            }
            const o = R().objekte[id];
            if (o.art === 'finale')
                return finale();
            const reply = await request({ typ: 'frontier_lesen', objekt: id });
            if (!reply.richtig)
                return toast(reply.info, 'bad');
            if (z.ende || P().szene)
                return;
            if (o.art === 'wahl')
                return wahl(o.wahl);
            cue(o.art === 'papier' ? 'papier' : 'klick');
            const text = id === 'bankbrief' ? P().journal.find(x => x.titel === o.name)?.text : id === 'lasttafel' ? `Korb und Erbe: 87 kg\nMara: ${P().wahl.mara === 'retten' ? '54 kg' : 'noch nicht entschieden / fährt nicht mit'}\nGold: ${P().wahl.gold === 'nehmen' ? '18 kg' : 'bleibt hier / noch nicht entschieden'}\nAKTUELLE LAST: ${P().last} kg\n\nGewichte am Gegenseil zählen positiv. Gewichte im Korb zählen negativ. Das Gegenseil muss die gesamte Last ausgleichen.` : o.text;
            modal(o.name, h('div', { class: 'mc-document' }, h('span', { class: 'mc-stamp' }, 'MERCY CREEK · 1897'), h('p', {}, text), o.item ? h('div', { class: 'mc-fund' }, o.item[2] + ' ' + o.item[1], h('small', {}, 'Im gemeinsamen Inventar')) : null, button('Ins Reisebuch gelegt · zurück', close, 'ghost')), { art: 'document', id });
            if (id === 'spiegel')
                moment('spiegel');
            if (id === 'kalender')
                moment('stiefel');
            if (id === 'sarg')
                moment('lachen');
        }
        function wahl(k) {
            const definitions = { gold: { titel: 'Was nimmst du mit?', text: R().objekte.gold.text, options: [['lassen', 'Den Barren liegen lassen', 'Du nimmst nur den Förderhausplan.'], ['nehmen', 'Das Gold mitnehmen', '18 kg mehr im Förderkorb. Vane wird deine Gier bemerken.']] }, mara: { titel: 'Mara hinter dem Gitter', text: R().objekte.mara.text, options: [['retten', 'Mara befreien', '45 Sekunden. Ab jetzt geht ihr gemeinsam. Ihr Gewicht verändert die Winde.'], ['lassen', 'Allein in die Grube fahren', 'Mara bleibt zurück. Diese Entscheidung lässt sich nicht rückgängig machen.']] }, belege: { titel: 'Die Beweise oder die Zeit?', text: R().objekte.belege.text, options: [['sichern', 'Das Originalbuch sichern', 'Kostet 60 Sekunden. Die Beweise können ins Tal gelangen.'], ['verbrennen', 'Das Buch für die Lampe verbrennen', 'Du gewinnst 60 Sekunden. Das Original ist für immer verloren.']] } };
            if (k === 'gold' && !done('tresor'))
                return modal('Der Barren', h('p', { class: 'mc-lead' }, 'Erst muss der Tresor geöffnet werden.'));
            if (k === 'belege' && !done('schichten'))
                return modal('Das Originalbuch', h('p', { class: 'mc-lead' }, 'Rekonstruiere zuerst die Schichtgruppen. Vorher lässt sich die Bedeutung des Buches nicht sichern.'));
            if (P().wahl[k])
                return modal(definitions[k].titel, h('div', { class: 'mc-document' }, h('span', { class: 'mc-eyebrow' }, 'DEINE ENTSCHEIDUNG IST GEFALLEN'), h('p', {}, P().journal.find(x => x.art === 'wahl' && x.titel === ({ gold: 'Dein Erbe', mara: 'Mara Bell', belege: 'Das Originalbuch' })[k])?.text), button('Zurück in die Stadt', close, 'primary')));
            decision(definitions[k].titel, definitions[k].text, definitions[k].options, async (value) => { const r = await request({ typ: 'frontier_wahl', schluessel: k, wert: value }); if (r.richtig) {
                close();
                update();
                if (k === 'mara')
                    cue('metall');
            } return r; });
        }
        function decision(titel, text, options, choose) { const list = h('div', { class: 'mc-choices' }, h('p', { class: 'mc-lead' }, text), h('span', { class: 'mc-eyebrow' }, 'DEINE HANDLUNG VERÄNDERT DIE GESCHICHTE'), options.map(([value, label, desc]) => button('', async (e) => { const b = e.currentTarget; b.disabled = true; const r = await choose(value); if (!r.richtig) {
            b.disabled = false;
            toast(r.info, 'bad');
        } }, 'mc-choice').appendChild(h('span', {}, h('b', {}, label), h('small', {}, desc))).parentNode)); modal(titel, list, { art: 'choice' }); }
        function finale() {
            if (!done('glocke'))
                return modal('Das letzte Siegel', h('p', { class: 'mc-lead' }, 'Der eiserne Riegel hängt noch am Glockenwerk. Die Melodie aus dem Saloon öffnet ihn.'));
            decision('Wem gehört die letzte Schicht?', 'Vane wartet auf deine Unterschrift. Hinter ihm liegt der Weg ins Tal. Du weißt jetzt, was mit dem Besitz auch auf dich übergehen würde.', [
                ['ausschlagen', 'Das Erbe ausschlagen', 'Du zerreißt den Anteilsschein. Alles Gold bleibt hier. Die Namen werden frei.'], ['anspruch', 'Die Erbschaft annehmen', 'Du setzt das Siegel. Das Gold gehört dir – und die Schuld auch.'], ['bleiben', 'An Vanes Stelle bleiben', 'Du übernimmst die letzte Schicht, damit die Eingeschlossenen gehen können.']
            ], value => request({ typ: 'frontier_finale', wert: value }));
        }
        function raetsel(id) {
            const s = R().stationen[id], p = s.p, feedback = h('div', { class: 'mc-feedback', role: 'status' }), tips = h('div', { class: 'mc-tips' });
            const submit = async (a) => { const r = await request({ typ: 'loesen', station: id, antwort: a }); if (!r.richtig) {
                feedback.textContent = r.info;
                cue('fehler');
                el.classList.add('mc-error');
                after(420, () => el.classList.remove('mc-error'));
            } return r; };
            const tip = () => { const current = z.stand.hinweise[id] || []; tips.replaceChildren(...current.map((t, i) => h('p', {}, h('b', {}, 'Hinweis ' + (i + 1) + ' · '), t)), current.length < 3 ? button(`Hinweis anfordern · −${R().hinweisKosten} s`, e => { e.currentTarget.disabled = true; senden({ typ: 'hinweis', station: id }); }, 'ghost') : h('span', { class: 'mc-small mc-muted' }, 'Alle drei Hinweise verwendet.')); };
            const tools = h('div', { class: 'mc-puzzle-tools' }), notes = h('div', { class: 'mc-inline-notes' });
            notes.hidden = true;
            tools.append(button('Aufzeichnungen danebenlegen', () => { notes.hidden = !notes.hidden; }, 'ghost'));
            const relevant = P().journal.filter(x => s.lesen.some(n => R().objekte[n].name === x.titel) || (id === 'glocke' && x.titel === R().stationen.pianola.titel));
            notes.append(...relevant.map(x => h('article', {}, h('b', {}, x.titel), h('p', {}, x.text))));
            const machine = puzzle(p, submit);
            modal(s.titel, h('div', { class: 'mc-puzzle' }, h('p', { class: 'mc-lead' }, s.text), tools, notes, machine, feedback, tips), { art: 'puzzle', id });
            z.modal.tip = tip;
            tip();
        }
        function puzzle(p, submit) {
            const out = h('div', { class: 'mc-machine type-' + p.art });
            const test = (label, value) => button(label, async (e) => { const b = e.currentTarget; b.disabled = true; try {
                await submit(value());
            }
            finally {
                if (b.isConnected)
                    b.disabled = false;
            } }, 'primary');
            if (p.art === 'weiche') {
                const a = new Array(7).fill(0), diagram = h('div', { class: 'mc-track-diagram' }), route = h('div', { class: 'mc-readout' }), controls = h('div', { class: 'mc-track-controls' });
                const draw = () => { const active = Clavis.FrontierLogik.fahrt(p, a); let svg = '<svg viewBox="0 0 950 370" role="img" aria-label="Gleisplan">'; p.kanten.forEach((edges, i) => edges.forEach((to, j) => { const [x, y] = POS[p.ids[i]], [tx, ty] = POS[to], lit = active.includes(p.ids[i]) && a[i] === j; svg += `<path d="M${x} ${y} C${x + 70} ${y},${tx - 70} ${ty},${tx} ${ty}" fill="none" stroke="${lit ? '#e0b56a' : '#56645c'}" stroke-width="${lit ? 6 : 3}" opacity="${lit ? 1 : .6}"/>`; })); Object.entries(POS).forEach(([id, [x, y]]) => { svg += `<circle cx="${x}" cy="${y}" r="19" fill="${active.includes(id) ? '#d2a65c' : '#26372f'}" stroke="#9ba17a"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" fill="${active.includes(id) ? '#14251f' : '#e0d4ad'}">${id}</text><text x="${x}" y="${y + 39}" text-anchor="middle" font-size="11" fill="#c8c9ae">${p.namen[id]}</text>`; }); diagram.innerHTML = svg + '</svg>'; route.textContent = 'Fahrt: ' + active.map(id => p.namen[id]).join(' → '); controls.replaceChildren(...p.ids.map((id, i) => button(`${id} → ${p.kanten[i][a[i]]}`, () => { a[i] ^= 1; cue('metall'); draw(); }, 'mc-track-switch', { 'aria-label': 'Weiche ' + id }))); };
                out.append(h('div', { class: 'mc-brass-label' }, 'WAAGE B · WASSERTURM E · PRÜFPOSTEN G · BRUCHBRÜCKE F MEIDEN'), diagram, controls, route, test('Die letzte Fahrt freigeben', () => a.slice()));
                draw();
            }
            else if (p.art === 'pianola') {
                const a = p.teile.map((_, i) => ({ i, flip: false })), list = h('div', { class: 'mc-roll-pieces' });
                const draw = () => list.replaceChildren(...a.map((x, i) => { const t = p.teile[x.i], l = x.flip ? t.b : t.a, r = x.flip ? t.a : t.b; return h('article', { class: 'mc-roll-piece' }, h('span', { class: 'mc-roll-id' }, 'STÜCK ' + (x.i + 1)), h('div', { class: 'mc-roll-strip' }, h('b', {}, ICON[l]), h('span', {}, l), h('i', { class: 'mc-roll-holes' }), h('span', {}, r), h('b', {}, ICON[r])), h('div', { class: 'mc-roll-actions' }, button('↔', () => { x.flip = !x.flip; cue('papier'); draw(); }, 'ghost', { 'aria-label': 'Stück ' + (x.i + 1) + ' drehen' }), button('↑', () => { [a[i], a[i - 1]] = [a[i - 1], a[i]]; draw(); }, 'ghost', { disabled: i === 0, 'aria-label': 'Stück ' + (x.i + 1) + ' nach oben' }), button('↓', () => { [a[i], a[i + 1]] = [a[i + 1], a[i]]; draw(); }, 'ghost', { disabled: i === 5, 'aria-label': 'Stück ' + (x.i + 1) + ' nach unten' }))); }));
                out.append(h('p', { class: 'mc-readout' }, 'ANFANG ' + ICON[p.anfang] + ' ' + p.anfang + ' · ENDE ' + ICON[p.ende] + ' ' + p.ende), list, test('Die Rolle einlegen', () => a.map(x => ({ ...x }))));
                draw();
            }
            else if (p.art === 'depesche') {
                const input = h('input', { class: 'mc-input mc-code', maxlength: p.laenge, autocomplete: 'off', spellcheck: false, placeholder: 'ENTZIFFERTE NACHRICHT', 'aria-label': 'Entzifferte Depesche' });
                out.append(h('div', { class: 'mc-telegram' }, h('span', { class: 'mc-eyebrow' }, 'BLACKWATER · PRIVATLEITUNG'), h('b', {}, p.folge.join('   ')), h('small', {}, 'Die Zahlenpaare bleiben unverändert.')), h('div', { class: 'mc-polybius' }, h('span'), [1, 2, 3, 4, 5].map(x => h('b', {}, x)), p.quadrat.map((row, i) => [h('b', {}, i + 1), [...row].map(c => h('span', {}, c))])), h('p', { class: 'mc-small mc-muted' }, p.hinweis), input, test('Die Depesche lesen', () => input.value));
            }
            else if (p.art === 'tresor') {
                const moves = [0, 0, 0, 0], dials = h('div', { class: 'mc-safe-dials' });
                const draw = () => { const value = p.start.slice(); moves.forEach((n, i) => { value[i] = (value[i] + n) % 10; if (i < 3)
                    value[i + 1] = (value[i + 1] + n) % 10; }); dials.replaceChildren(...moves.map((n, i) => h('div', { class: 'mc-safe-dial' }, h('small', {}, 'RAD ' + (i + 1)), h('b', { style: { '--turn': n * 36 + 'deg' } }, h('span', {}, value[i])), h('div', {}, button('−', () => { moves[i] = (moves[i] + 9) % 10; cue('klick'); draw(); }, 'ghost', { 'aria-label': 'Tresorrad ' + (i + 1) + ' zurück' }), button('+', () => { moves[i] = (moves[i] + 1) % 10; cue('klick'); draw(); }, 'ghost', { 'aria-label': 'Tresorrad ' + (i + 1) + ' weiter' }))))); };
                out.append(h('p', { class: 'mc-readout' }, 'ZIELSTELLUNG · ' + p.ziel.join(' — ')), h('p', { class: 'mc-small mc-muted' }, p.regel), dials, button('Ausgangsstellung', () => { moves.fill(0); draw(); }, 'ghost'), test('Den Tresorgriff ziehen', () => moves.slice()));
                draw();
            }
            else if (p.art === 'pumpen') {
                const a = new Array(9).fill(0), grid = h('div', { class: 'mc-pipes' });
                const draw = () => grid.replaceChildren(...p.teile.map((m, i) => { const mask = Clavis.FrontierLogik.drehen(m, a[i]), b = button('', () => { a[i] = (a[i] + 1) % 4; cue('metall'); draw(); }, 'mc-pipe', { 'aria-label': `Rohr ${i + 1} drehen` }); b.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true">' + [0, 1, 2, 3].filter(d => mask & (1 << d)).map(d => `<path d="M50 50 L${[50, 100, 50, 0][d]} ${[0, 50, 100, 50][d]}" stroke="#748f82" stroke-width="23" fill="none"/><path d="M50 50 L${[50, 100, 50, 0][d]} ${[0, 50, 100, 50][d]}" stroke="#b5ba92" stroke-width="12" fill="none"/>`).join('') + '<circle cx="50" cy="50" r="13" fill="#b1b78c"/><circle cx="50" cy="50" r="7" fill="#415a50"/></svg>'; return b; }));
                out.append(h('div', { class: 'mc-pipe-flow-label' }, h('span', {}, 'WASSER →'), h('span', {}, '↘ ALLE NEUN FELDER')), grid, h('div', { class: 'mc-pipe-flow-label' }, h('span', {}, 'KEINE LECKS'), h('span', {}, '→ ABLASS')), test('Die Pumpe anlaufen lassen', () => a.slice()));
                draw();
            }
            else if (p.art === 'winde') {
                const a = new Array(6).fill(0), grid = h('div', { class: 'mc-weight-grid' }), meter = h('div', { class: 'mc-balance' }), target = P().last;
                const draw = () => { const sum = a.reduce((n, x, i) => n + x * p.gewichte[i], 0); meter.replaceChildren(h('span', {}, 'GEGENGEWICHT ' + sum + ' KG'), h('div', { class: 'mc-balance-arm', style: { '--tilt': Math.max(-12, Math.min(12, (sum - target) / 8)) + 'deg' } }, h('i'), h('b')), h('span', {}, 'LAST ' + target + ' KG')); grid.replaceChildren(...a.map((v, i) => button('', () => { a[i] = v === 0 ? 1 : v === 1 ? -1 : 0; cue('metall'); draw(); }, 'mc-weight ' + (v === 1 ? 'counter' : v === -1 ? 'basket' : ''), { 'aria-label': 'Gewicht ' + p.gewichte[i] + ' kg' }).appendChild(h('span', {}, h('b', {}, p.gewichte[i]), h('small', {}, 'KG'), h('em', {}, v === 1 ? 'Gegenseil +' : v === -1 ? 'Im Korb −' : 'Im Regal'))).parentNode)); };
                out.append(h('p', { class: 'mc-small mc-muted' }, `Grundlast 87 kg${P().wahl.mara === 'retten' ? ' + Mara 54 kg' : ''}${P().wahl.gold === 'nehmen' ? ' + Gold 18 kg' : ''}. Ein Klick: Gegenseil. Zweiter Klick: Korb. Dritter Klick: Regal.`), meter, grid, test('Die Förderbremse lösen', () => a.slice()));
                draw();
            }
            else if (p.art === 'stollen') {
                const route = [0], grid = h('div', { class: 'mc-mine-map', style: { gridTemplateColumns: `repeat(${p.groesse},1fr)` } }), read = h('div', { class: 'mc-readout' }), buttons = h('div', { class: 'mc-mine-controls' }), scene = h('div', { class: 'mc-tunnel-view' }, bild('stollen'));
                const draw = () => { const at = route.at(-1); grid.replaceChildren(...p.waende.map((mask, i) => h('div', { class: 'mc-mine-cell' + (route.includes(i) ? ' visited' : '') + (at === i ? ' here' : ''), style: { borderTopColor: mask & 1 ? '#a4ad8c' : 'transparent', borderRightColor: mask & 2 ? '#a4ad8c' : 'transparent', borderBottomColor: mask & 4 ? '#a4ad8c' : 'transparent', borderLeftColor: mask & 8 ? '#a4ad8c' : 'transparent' }, 'aria-label': `Feld ${i + 1}${at === i ? ' dein Standort' : ''}` }, h('small', {}, i + 1), h('b', {}, at === i ? '◉' : p.marken.includes(i) ? '◆' : i === p.ziel ? '▣' : i === 0 ? '↳' : '')))); read.textContent = `LAMPE ${Math.max(0, p.max - route.length)} SCHRITTE · KONTROLLMARKEN ${p.marken.filter(m => route.includes(m)).length}/2`; buttons.replaceChildren(...[['N', 0, -p.groesse], ['O', 1, 1], ['S', 2, p.groesse], ['W', 3, -1]].map(([name, d, delta]) => button(name, () => { route.push(at + delta); cue('schritte'); scene.classList.remove('moving'); void scene.offsetWidth; scene.classList.add('moving'); draw(); }, 'ghost', { 'aria-label': 'Im Stollen nach ' + name, disabled: !!(p.waende[at] & (1 << d)) || route.length >= p.max }))); };
                out.append(scene, h('p', { class: 'mc-small mc-muted' }, '◆ Kontrollmarken · ▣ Archiv · ◉ Dein Standort. Die Mauern sind vollständig eingezeichnet. Plane einen Weg durch beide Marken.'), grid, read, buttons, button('Zum Eingang zurück · neu planen', () => { route.splice(0, route.length, 0); draw(); }, 'ghost'), test('Den Archivzugang öffnen', () => route.slice()));
                draw();
            }
            else if (p.art === 'schichten') {
                const a = [0, 1, 2, 3, 4], list = h('div', { class: 'mc-name-order' });
                let picked = null;
                const draw = () => list.replaceChildren(...a.map((n, i) => button('', () => { if (picked === null)
                    picked = i;
                else {
                    [a[picked], a[i]] = [a[i], a[picked]];
                    picked = null;
                    cue('papier');
                } draw(); }, 'mc-name-tag' + (picked === i ? ' selected' : '')).appendChild(h('span', {}, h('small', {}, 'GRUPPE ' + (i + 1)), h('b', {}, p.namen[n]))).parentNode));
                out.append(h('div', { class: 'mc-witness-notes' }, h('span', { class: 'mc-eyebrow' }, 'ZEUGENAUSSAGEN'), p.regeln.map(q => h('p', {}, q.text))), h('p', { class: 'mc-small mc-muted' }, 'Tippe zwei Namensschilder an, um sie zu tauschen.'), list, test('Die Namen ins Buch zurücktragen', () => a.slice()));
                draw();
            }
            else if (p.art === 'sprengung') {
                const selected = new Set(), positions = { EIN: [70, 170], A: [210, 170], B: [360, 55], C: [360, 290], D: [545, 290], HERZ: [690, 85], LUFT: [545, 420], AUS: [730, 350] }, diagram = h('div', { class: 'mc-wire-diagram' }), switches = h('div', { class: 'mc-wire-switches' });
                const draw = () => { let svg = '<svg viewBox="0 0 820 470" role="img" aria-label="Zündschema mit zwei Trennstellen">'; p.leitungen.forEach(([x, y], i) => { const [a, b] = positions[x], [c, d] = positions[y]; svg += `<path d="M${a} ${b} L${c} ${d}" fill="none" stroke="${selected.has(i) ? '#a24d37' : '#bc9f61'}" stroke-width="${selected.has(i) ? 3 : 5}" ${selected.has(i) ? 'stroke-dasharray="8 10"' : ''}/><text x="${(a + c) / 2}" y="${(b + d) / 2 - 9}" font-size="13" fill="#d5c491">${i + 1}</text>`; }); Object.entries(positions).forEach(([name, [x, y]]) => { svg += `<rect x="${x - 34}" y="${y - 17}" width="68" height="34" rx="5" fill="${name === 'HERZ' ? '#632f25' : '#29463d'}" stroke="#b6a071"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" fill="#e7d9ae">${name}</text>`; }); diagram.innerHTML = svg + '</svg>'; switches.replaceChildren(...p.leitungen.map(([x, y], i) => button(`${i + 1} · ${x}–${y}`, () => { if (selected.has(i))
                    selected.delete(i);
                else if (selected.size < 2)
                    selected.add(i); cue('klick'); draw(); }, 'ghost' + (selected.has(i) ? ' selected' : ''), { 'aria-label': 'Leitung ' + (i + 1), 'aria-pressed': String(selected.has(i)) }))); };
                out.append(h('p', { class: 'mc-readout' }, 'HERZ TRENNEN · LUFT UND AUS VERBUNDEN LASSEN'), diagram, switches, test('Die beiden Leitungen trennen', () => [...selected]));
                draw();
            }
            else if (p.art === 'glocke') {
                const a = [], sequence = h('div', { class: 'mc-bell-sequence' }), draw = () => sequence.replaceChildren(...Array.from({ length: 6 }, (_, i) => h('span', { class: i < a.length ? 'set' : '' }, a[i] !== undefined ? ICON[p.namen[a[i]]] : '·')));
                out.append(h('p', { class: 'mc-small mc-muted' }, 'Die vier Originalzeichen stehen im Reisebuch. Die Eingabe hat kein Zeitlimit und funktioniert ohne Ton.'), h('div', { class: 'mc-bell-keys' }, p.namen.map((name, i) => button('', () => { if (a.length < 6) {
                    a.push(i);
                    if (z.ton && sound.zeichen)
                        sound.zeichen(i);
                    else
                        cue('glocke');
                    draw();
                } }, 'mc-bell-key', { 'aria-label': 'Glockenzeichen ' + name }).appendChild(h('span', {}, h('b', {}, ICON[name]), h('small', {}, name))).parentNode)), sequence, button('Letztes Zeichen zurück', () => { a.pop(); draw(); }, 'ghost'), test('Den Glockenriegel ziehen', () => a.slice()));
                draw();
            }
            return out;
        }
        const SHOTS = { weit: [50, 50, 1], zug: [25, 70, 1.4], berg: [50, 25, 1.3], ticket: [25, 75, 1.7], uhr: [70, 43, 1.7], papier: [50, 60, 1.55], tuer: [55, 58, 1.35], gesicht: [70, 53, 1.7], rolle: [38, 62, 1.7], spiegel: [74, 35, 1.8], vertrag: [53, 70, 1.7], gold: [56, 66, 1.8], gitter: [74, 65, 1.65], schacht: [50, 60, 1.6], helm: [72, 74, 1.8], fels: [55, 43, 1.4], mantel: [54, 70, 1.7], namen: [34, 52, 1.65], lampen: [50, 65, 1.5], fenster: [25, 42, 1.6] };
        function film(scene, finish) {
            close();
            S.stopp();
            clearTimeout(filmTimer);
            z.filmToken++;
            el.querySelector('.mc-cinema')?.remove();
            z.film = scene;
            let i = 0, ending = false;
            const image = h('div', { class: 'mc-cinema-image' }), title = h('span', { class: 'mc-eyebrow' }), caption = h('p', { class: 'mc-cinema-caption', 'aria-live': 'polite' }), progress = h('div', { class: 'mc-film-progress' }), number = h('span', { class: 'mc-shot-number' }), next = button('Weiter →', step, 'primary');
            const overlay = h('section', { class: 'mc-cinema', role: 'dialog', 'aria-modal': 'true', 'aria-label': scene.titel, tabindex: -1 }, image, h('div', { class: 'mc-cinema-shade' }), h('div', { class: 'mc-cinema-top' }, h('span', { class: 'mc-brand' }, 'CLAVIS · PREMIUM II'), h('span', {}, scene.titel)), h('div', { class: 'mc-cinema-mid' }, number), h('div', { class: 'mc-cinema-bottom' }, progress, title, caption, h('div', { class: 'mc-cinema-actions' }, h('small', {}, 'Die gemeinsame Spielzeit ist pausiert.'), button('←', () => { if (i > 0) {
                i--;
                line();
            } }, 'ghost', { 'aria-label': 'Vorherige Einstellung' }), button('Szene überspringen', end, 'mc-skip'), next)));
            el.append(overlay);
            overlay.focus({ preventScroll: true });
            function line() {
                const token = ++z.filmToken;
                S.stopp();
                const beat = scene.zeilen[i];
                if (!beat)
                    return end();
                title.textContent = beat.titel;
                caption.textContent = beat.text;
                number.textContent = scene.id?.startsWith('intro') ? 'PROLOG' : String(i + 1).padStart(2, '0');
                progress.replaceChildren(...scene.zeilen.map((_, j) => h('i', { class: j <= i ? 'seen' : '' })));
                image.replaceChildren(bild(beat.ort, 'mc-cinema-art'));
                const [x, y, zoom] = SHOTS[beat.bild] || SHOTS.weit;
                image.style.setProperty('--focus-x', x + '%');
                image.style.setProperty('--focus-y', y + '%');
                image.style.setProperty('--zoom', String(prefs.bewegung ? zoom : 1));
                image.dataset.effekt = beat.effekt;
                image.classList.remove('cut');
                void image.offsetWidth;
                image.classList.add('cut');
                cue(beat.effekt);
                if (['lawine', 'bruch', 'donner'].includes(beat.effekt) && prefs.bewegung)
                    overlay.classList.add('impact');
                else
                    overlay.classList.remove('impact');
                if (prefs.stimmen && S.verfuegbar()) {
                    S.schalten(true);
                    sound.ducken(true);
                    S.sprechen(beat.text, 'erzaehler').then(() => { if (token === z.filmToken)
                        sound.ducken(false); });
                }
                next.textContent = i === scene.zeilen.length - 1 ? 'Weiter nach Mercy Creek →' : 'Weiter →';
                next.disabled = true;
                clearTimeout(filmTimer);
                filmTimer = after(prefs.bewegung ? 950 : 120, () => { next.disabled = false; });
            }
            function step() { if (next.disabled)
                return; i++; line(); }
            function end() { if (ending)
                return; ending = true; clearTimeout(filmTimer); z.filmToken++; S.stopp(); sound.ducken(false); overlay.classList.add('leaving'); after(prefs.bewegung ? 350 : 0, () => { overlay.remove(); z.film = null; finish(); }); }
            line();
        }
        function sceneFromState(scene) {
            if (z.filmId === scene.id)
                return;
            z.filmId = scene.id;
            const play = () => film(scene, () => { if (host)
                senden({ typ: 'frontier_weiter', id: scene.id });
            else
                toast('Auf die Spielleitung warten. Die Zeit bleibt pausiert.'); });
            if (z.ton)
                return play();
            el.querySelector('.mc-resume')?.remove();
            const gate = h('div', { class: 'mc-cinema mc-resume' }, h('div', {}, h('span', { class: 'mc-eyebrow' }, 'MERCY CREEK WARTET'), h('h2', {}, 'Die letzte Fahrt.'), button('Mit Klang fortsetzen', () => { gate.remove(); if (!K.an())
                K.schalten(true); tonStart(); if (P().szene?.id === scene.id)
                play(); }, 'primary'), button('Ohne Ton fortsetzen', () => { gate.remove(); z.ton = true; K.schalten(false); if (P().szene?.id === scene.id)
                play(); }, 'ghost')));
            el.append(gate);
        }
        function moment(art) {
            if (!stage?.isConnected || z.ende || z.film || document.hidden)
                return;
            const text = ({ reiter: 'Ein Hufschlag. Auf der vereisten Straße ist kein einziges Pferd.', fenster: 'Im oberen Fenster hebt jemand den Hut. Dann wird das Fenster wieder schwarz.', glocke: 'Ein weiterer Schlag. Der Ton scheint von unterhalb der Straße zu kommen.', riss: 'Staub löst sich aus dem Holz. Tief unten antwortet der Berg.', letzter: 'Die Luft wird still. Der nächste Schlag gehört der letzten Schicht.', gier: 'Der Barren wird warm. Im Saloon lacht ein Mann, dem der Atem fehlt.', siegel: 'Du lässt das Gold liegen. Für einen Augenblick verstummt der Wind.', spiegel: 'Im Spiegel stehen Menschen. Hinter dir schaukelt nur ein leerer Stuhl.', stiefel: 'Schritte halten vor der Tür an. Das Holz biegt sich von außen.', lachen: 'Aus dem Mantel kommt ein kurzes, trockenes Lachen.', atmen: 'Ein Atemzug. Dieses Mal war es nicht deiner.', fehler: 'Die Glocke rückt näher.' })[art] || '';
            const label = stage.querySelector('.mc-whisper');
            label.textContent = text;
            label.classList.add('show');
            after(8000, () => label.classList.remove('show'));
            cue(({ reiter: 'stiefel', fenster: 'atmen', glocke: 'glocke', riss: 'steine', letzter: 'herz', gier: 'lachen', siegel: 'siegel', spiegel: 'lachen', stiefel: 'stiefel', lachen: 'lachen', atmen: 'atmen', fehler: 'fehler' })[art] || 'wind');
            stage.classList.add('event-' + art);
            after(4200, () => stage?.classList.remove('event-' + art));
            if (prefs.schreck && ['fenster', 'gier'].includes(art))
                after(1200, () => { if (!prefs.schreck || z.ende || z.film || document.hidden)
                    return; Clavis.schreck(el, 'gestalt', { blut: false, staerke: prefs.bewegung ? 6 : 2 }); });
        }
        function endgame(e) {
            if (z.ende)
                return;
            z.ende = e;
            close();
            S.stopp();
            const f = e.frontier;
            film({ id: 'outro', titel: f.titel, zeilen: [{ titel: e.geschafft ? 'Dein letzter Anspruch' : e.grund === 'zeit' ? 'Der dreizehnte Schlag' : 'Du beendest die letzte Schicht', text: f.text, ort: e.geschafft ? 'kapelle' : 'foerderhaus', effekt: e.geschafft ? 'glocke' : 'aufzug', bild: 'weit' }, { titel: 'Was Mercy Creek behält', text: f.nach, ort: 'strasse', effekt: e.geschafft ? 'wind' : 'lachen', bild: 'weit' }] }, () => { sound.stop(); S.stopp(); el.className = 'mc-spiel mc-result'; el.replaceChildren(bild('strasse', 'mc-cover-art'), h('div', { class: 'mc-result-shade' }), h('div', { class: 'mc-result-copy' }, h('span', { class: 'mc-eyebrow' }, 'DEIN ENDE · MERCY CREEK'), h('h1', {}, f.titel), h('div', { class: 'mc-stars' }, '★'.repeat(e.sterne) + '☆'.repeat(3 - e.sterne)), h('p', { class: 'mc-lead' }, f.nach), h('div', { class: 'mc-result-stats' }, h('span', {}, h('b', {}, time(e.zeit)), 'Deine Zeit'), h('span', {}, h('b', {}, e.geloest + '/10'), 'Verbindungen'), h('span', {}, h('b', {}, e.hinweise), 'Hinweise')), h('div', { class: 'mc-ending-choices' }, h('span', {}, f.mara ? '◉ Mara gerettet' : '○ Mara zurückgelassen'), h('span', {}, f.belege ? '▥ Beweise gesichert' : '□ Originalbuch verloren'), h('span', {}, f.gold ? '▰ Das Gold mitgenommen' : '◇ Das Gold liegen lassen')), host ? button('Zurück zu Clavis', () => host.fertig(), 'primary') : h('p', { class: 'mc-small' }, 'Danke fürs Mitspielen. Du kannst diese Seite schließen.'))); });
        }
        function empfangen(d) {
            if (!d || z.verlassen)
                return;
            if (d.typ === 'raum') {
                z.raum = d.raum;
                if (prefs.schreck === null || R().schreck.standard === false)
                    prefs.schreck = !!R().schreck.standard;
                if (!z.stand)
                    lobby();
            }
            else if (d.typ === 'stand') {
                if ((d.frontier?.sequenz ?? -1) < z.seq)
                    return;
                z.seq = d.frontier?.sequenz ?? z.seq;
                const before = z.stand;
                z.stand = d;
                z.rest = d.restMs;
                z.empfangen = Date.now();
                if (!R() || z.ende)
                    return;
                if (d.phase === 'lobby')
                    return lobby();
                if (!stage?.isConnected)
                    game();
                const fresh = Object.keys(d.geloest).find(id => !before?.geloest[id]);
                if (fresh) {
                    close();
                    toast('Eine Verbindung ist hergestellt.', 'good');
                }
                if (!P().szene)
                    el.querySelector('.mc-resume')?.remove();
                if (P().szene)
                    sceneFromState(P().szene);
                else if (z.film && z.film.id !== 'outro') {
                    clearTimeout(filmTimer);
                    z.filmToken++;
                    S.stopp();
                    sound.ducken(false);
                    el.querySelector('.mc-cinema')?.remove();
                    z.film = null;
                }
                if (z.modal?.art === 'puzzle')
                    z.modal.tip();
                update();
            }
            else if (d.typ === 'antwort') {
                const a = z.anfragen.get(d.nr);
                if (a) {
                    clearTimeout(a.t);
                    timers.delete(a.t);
                    z.anfragen.delete(d.nr);
                    a.resolve(d);
                }
            }
            else if (d.typ === 'frontier_moment')
                moment(d.art);
            else if (d.typ === 'ende')
                endgame(d.ergebnis);
            else if (['vorbei', 'entfernt'].includes(d.typ)) {
                destroy();
                el.replaceChildren(h('div', { class: 'mc-warten' }, h('h1', {}, 'Der letzte Zug ist fort.'), h('p', {}, 'Die Spielleitung hat die Verbindung geschlossen.')));
            }
        }
        function key(e) { if (!el.isConnected)
            return destroy(); const dialog = el.querySelector('.mc-cinema') || el.querySelector('.mc-modal'); if (e.key === 'Escape' && z.modal && !z.film)
            close(); if (e.key.toLowerCase() === 'j' && !dialog && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
            journal(); if (dialog && e.key === 'Tab') {
            const a = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n => n.getClientRects().length);
            if (!a.length)
                return;
            if (e.shiftKey && document.activeElement === a[0]) {
                e.preventDefault();
                a.at(-1).focus();
            }
            else if (!e.shiftKey && (document.activeElement === a.at(-1) || document.activeElement === dialog)) {
                e.preventDefault();
                a[0].focus();
            }
        } }
        function destroy() { if (z.verlassen)
            return; z.verlassen = true; z.filmToken++; clearInterval(heartbeat); clearTimeout(filmTimer); clearTimeout(travelTimer); timers.forEach(clearTimeout); timers.clear(); for (const a of z.anfragen.values())
            a.resolve({ richtig: false, info: 'Das Spiel wurde beendet.' }); z.anfragen.clear(); sound.dispose(); S.stopp(); document.removeEventListener('keydown', key); window.removeEventListener('pagehide', destroy); }
        heartbeat = setInterval(() => { if (z.verlassen || !el.isConnected)
            return destroy(); if (clock?.isConnected)
            clock.textContent = time(rest()); if (R() && z.stand?.phase === 'spiel')
            sound.spannung?.(Math.min(1, 1 - rest() / (R().minuten * 60000))); if (stage?.isConnected && !z.film && !z.ende && z.ton && !document.hidden && Date.now() - z.sturm > 42000) {
            z.sturm = Date.now();
            if (['bahnhof', 'strasse', 'foerderhaus', 'kapelle'].includes(z.ort)) {
                cue('donner');
                if (prefs.schreck && prefs.bewegung) {
                    stage.classList.add('mc-lightning');
                    after(500, () => stage?.classList.remove('mc-lightning'));
                }
            }
        } }, 500);
        document.addEventListener('keydown', key);
        window.addEventListener('pagehide', destroy);
        lobby();
        return { empfangen, destroy, element: el };
    }
    Clavis.FrontierSpiel = { erstellen };
    const alt = Clavis.Spiel.erstellen;
    Clavis.Spiel.erstellen = (root, opt) => { let view = null; const wartend = []; return { empfangen(d) { if (!view && d?.typ === 'raum') {
            view = d.raum?.premium === 'mercy' ? erstellen(root, opt) : alt(root, opt);
            view.empfangen(d);
            wartend.splice(0).forEach(x => view.empfangen(x));
        }
        else if (view)
            view.empfangen(d);
        else if (['vorbei', 'entfernt'].includes(d?.typ))
            root.textContent = 'Die Runde ist geschlossen.';
        else
            wartend.push(d); }, destroy() { view?.destroy?.(); }, get element() { return view?.element; } }; };
})();
