'use strict';
/* Spieleransicht: Nur das adressierte Rollenblatt wird angezeigt. Kein Umschalten auf fremde Rollen. */
(() => {
    const h = (t, a, ...c) => Clavis.el(t, a, ...c.flat(Infinity)), SY = { KREIS: '◯', DREIECK: '△', WELLE: '≈', STERN: '✦', RAUTE: '◇', KREUZ: '+' };
    const zeit = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    const shots = { weit: [50, 50, 1.02], fahrt: [30, 56, 1.1], reifen: [82, 78, 1.45], mast: [42, 30, 1.25], zeuge: [30, 45, 1.15], luke: [75, 73, 1.35], pult: [35, 80, 1.3], tuer: [50, 48, 1.25], glas: [52, 41, 1.3], flucht: [50, 48, 1.1], monitor: [48, 50, 1.4], akte: [35, 76, 1.4], bruecke: [50, 43, 1.23], kern: [50, 35, 1.22] };
    function erstellen(root, { senden, ich, host = null }) {
        const el = h('section', { class: 'az-spiel', 'aria-label': 'NULLMEILE – Protokoll JANUS' }), main = h('div', { class: 'az-main' }), layer = h('div', { class: 'az-layer' });
        el.append(main, layer);
        root.replaceChildren(el);
        const K = Clavis.klang, S = Clavis.stimme, sound = Clavis.ArizonaKlang(), reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const z = { raum: null, stand: null, priv: null, seq: -1, ort: 'strasse', modal: null, scene: null, shot: 0, sceneAck: false, filmToken: 0, ende: null, verlassen: false, rest: 0, seit: Date.now(), nr: 0, pending: new Map(), drafts: new Map(), ton: false, sig: '', feedback: '', chatDraft: '', kanal: 'gruppe', seen: new Set() };
        let prefs = { bewegung: !reduced, schreck: true, musik: true, laut: .6, stimme: false };
        try {
            prefs = { ...prefs, ...JSON.parse(localStorage.getItem('clavis:arizona:prefs') || '{}') };
        }
        catch (_) { }
        if (reduced)
            prefs.bewegung = false;
        const timers = new Set();
        let beatTimer = null, heartbeat;
        const later = (ms, f) => {
            const id = setTimeout(() => {
                timers.delete(id);
                if (!z.verlassen)
                    f();
            }, ms);
            timers.add(id);
            return id;
        };
        const save = () => {
            try {
                localStorage.setItem('clavis:arizona:prefs', JSON.stringify(prefs));
            }
            catch (_) { }
        };
        const A = () => z.stand?.arizona || { roster: [], bereit: {}, gruppen: [], pausen: [], journal: [], wahl: {}, chat: [], fehlen: [], spaet: [] }, R = () => z.raum;
        const me = () => z.priv?.stage === A().stage ? z.priv?.daten : null, group = () => A().gruppen.find(g => g.ids.includes(ich.id)), spectator = () => z.stand?.phase === 'spiel' && !A().roster.some(p => p.id === ich.id);
        const pulseRest = g => Math.max(0, (g?.bis || 0) - ((A().serverZeit ?? Date.now()) + Date.now() - z.seit));
        const rest = () => Math.max(0, z.rest - (z.stand?.phase === 'spiel' && !A().pausen.length && !z.ende ? Date.now() - z.seit : 0));
        const btn = (t, f, c = '', a = {}) => h('button', { type: 'button', class: 'az-btn ' + c, onclick: f, ...a }, t);
        const small = t => h('span', { class: 'az-kicker' }, t), cue = t => {
            if (z.ton)
                sound.cue(t);
        };
        function image(ort, cls = '', extra = {}) { const n = h('div', { class: 'az-picture ' + cls, 'aria-hidden': 'true' }); n.innerHTML = Clavis.ArizonaWelt.bild(ort, { nika: A().wahl.nika, spannung: 1 - rest() / ((R()?.minuten || 72) * 60000), geloest: z.stand?.geloest, ...extra }); return n; }
        function audio() { z.ton = true; K.bereit(); K.musikStoppen?.(); K.ambienteStoppen?.(); sound.laut(prefs.laut); sound.musik(prefs.musik); sound.start(z.ort); }
        function request(d) { const nr = ++z.nr; return new Promise(resolve => { const timer = later(15000, () => { z.pending.delete(nr); resolve({ richtig: false, info: 'Keine Antwort aus der Station. Prüfe die Verbindung zur Spielleitung.' }); }); z.pending.set(nr, { resolve, timer }); Promise.resolve(senden({ ...d, nr })).catch(() => { clearTimeout(timer); timers.delete(timer); z.pending.delete(nr); resolve({ richtig: false, info: 'Die Verbindung zur Spielleitung ist unterbrochen.' }); }); }); }
        function toast(t, art = '') {
            if (!t)
                return;
            const n = h('div', { class: 'az-toast ' + art, role: 'status' }, t);
            el.append(n);
            later(5500, () => n.remove());
        }
        function shellClass() { el.className = 'az-spiel' + (!prefs.bewegung ? ' az-ruhig' : '') + (rest() < 180000 ? ' az-critical' : ''); }
        function lobby() {
            if (!R())
                return main.replaceChildren(h('div', { class: 'az-loading' }, 'Die Station sucht unabhängige Zeugen …'));
            const people = z.stand?.spieler || [], ready = people.filter(p => A().bereit[p.id]).length, own = !!A().bereit[ich.id];
            main.replaceChildren(h('div', { class: 'az-lobby' }, image('strasse', 'az-cover'), h('div', { class: 'az-cover-overlay' }), h('header', { class: 'az-cover-header' }, h('b', { class: 'az-logo' }, 'CLAVIS'), small('PREMIUM III · COOPERATIVE ONLY')), h('div', { class: 'az-lobby-copy' }, small('ARIZONA · 18:42 · EMPFANG VERLOREN'), h('h1', {}, 'NULL', h('em', {}, 'MEILE')), h('div', { class: 'az-subtitle' }, 'PROTOKOLL JANUS'), h('p', { class: 'az-lobby-lead' }, 'Euer Roadtrip endet dort, wo auf der Karte nichts mehr ist. Unter dem Sand läuft bereits eine Aufnahme eurer Ankunft.'), h('div', { class: 'az-specs' }, h('span', {}, '2–8 Personen'), h('span', {}, '8 Teamoperationen'), h('span', {}, R().minuten + ' Minuten'), h('span', {}, 'Ab 14')), h('div', { class: 'az-team-rule' }, h('b', {}, 'Eine Person reicht nicht.'), h('p', {}, 'Jeder braucht einen eigenen Referenzplatz. Ihr erhaltet unterschiedliche Informationen und bedient verschiedene Geräte. Sprecht miteinander oder nutzt den Gruppenfunk.')), h('div', { class: 'az-lobby-actions' }, btn(own ? 'Bereit · ' + ich.name : 'Ich bin bereit', async () => {
                audio();
                const a = await request({ typ: 'arizona_bereit', wert: !own });
                if (!a.richtig)
                    toast(a.info, 'bad');
            }, own ? 'selected' : 'primary'), host ? btn('Den Roadtrip beginnen →', () => { audio(); host.starten(); }, 'primary', { disabled: people.length < 2 || people.length > 8 || ready !== people.length }) : null, btn('Klang & Darstellung', settings, 'ghost')), h('div', { class: 'az-lobby-team' }, small(ready + '/' + people.length + ' REFERENZPLÄTZE BEREIT'), people.map(p => h('span', { class: 'az-person ' + (A().bereit[p.id] ? 'ready' : '') }, h('i', {}), p.name))), h('p', { class: 'az-lobby-note' }, people.length < 2 ? 'Lade mindestens eine weitere Person über den Link, QR-Code oder Campus ein.' : people.length > 8 ? 'Mehr als acht Personen: Die Spielleitung muss überzählige Gäste entfernen.' : ready < people.length ? 'Alle Personen bestätigen ihre Bereitschaft. Danach startet die Spielleitung.' : 'Euer Gespräch gehört zum Spiel. Kopfhörer empfohlen; alle Hinweise funktionieren ohne Ton.')), h('footer', { class: 'az-lobby-footer' }, h('span', {}, 'ASTER N9 · UNABHÄNGIGE BEOBACHTUNG ERFORDERLICH'), h('span', {}, 'Ein Abend. Mehrere Wirklichkeiten.'))));
        }
        function heading() { return h('header', { class: 'az-header' }, h('div', { class: 'az-wordmark' }, h('b', {}, 'NULLMEILE'), small('PROTOKOLL JANUS')), h('div', { class: 'az-contour-mini' }, Array.from({ length: 18 }, (_, i) => h('i', { style: { height: (8 + Math.sin(i * .8) * 7 + Math.sin(i * 2.7) * 4) + 'px' } }))), h('div', { class: 'az-clock' }, small('BIS DER HORIZONT SCHLIESST'), h('b', { 'data-clock': 'global' }, zeit(rest()))), btn('⌖', karte, 'icon', { 'aria-label': 'Stationsplan öffnen' }), btn('▤', journal, 'icon', { 'aria-label': 'Feldbuch öffnen' }), btn('≋', () => chat('team'), 'icon', { 'aria-label': 'Teamfunk öffnen' }), btn('♫', settings, 'icon', { 'aria-label': 'Klang und Darstellung' }), host ? btn('Ⅱ', () => request({ typ: 'arizona_pause' }), 'icon', { 'aria-label': 'Teampause schalten' }) : null, host ? btn('×', () => host.beenden(), 'icon', { 'aria-label': 'Spiel verlassen' }) : null); }
        function world() {
            const info = R().orte[z.ort], op = R().aufgaben[Math.min(A().stage, 7)], g = group(), p = me();
            const active = z.ort === op.ort && !spectator();
            const stage = h('div', { class: 'az-stage', 'data-ort': z.ort }, image(z.ort, 'az-stage-picture'), h('div', { class: 'az-crosshair' }), h('div', { class: 'az-stage-top' }, small(info.kapitel), h('h2', {}, info.name), h('p', {}, info.sub)), h('div', { class: 'az-frame-corner tl' }), h('div', { class: 'az-frame-corner tr' }), h('div', { class: 'az-frame-corner bl' }), h('div', { class: 'az-frame-corner br' }), h('span', { class: 'az-camera-stamp' }, 'ASTER N9 · ' + String(Object.keys(R().orte).indexOf(z.ort) + 1).padStart(2, '0') + ' / 09'), h('div', { class: 'az-hotspots' }, R().funde[z.ort].map((f, i) => btn('', () => fund(z.ort, i), 'az-hotspot', { style: { left: (i ? 75 : 22) + '%', top: (i ? 64 : 72) + '%' }, 'aria-label': f[0] }).appendChild(h('span', {}, h('b', {}, '+'), h('span', {}, f[0]))).parentNode), active ? btn('', operation, 'az-hotspot az-operation', { style: { left: '50%', top: '51%' }, 'aria-label': 'Operation öffnen' }).appendChild(h('span', {}, h('b', {}, '◈'), h('span', {}, op.titel, h('small', {}, g?.fertig ? 'GRUPPE FREIGEGEBEN' : p ? p.p.rollen[p.rolle] : 'ROLLENBLATT WIRD GELADEN')))).parentNode : null), h('div', { class: 'az-stage-bottom' }, h('span', { class: 'az-live' }, 'UNABHÄNGIGE PERSPEKTIVE · ' + ich.name), btn('Untersuchen', () => el.classList.toggle('az-labels'), 'ghost')));
            stage.addEventListener('pointermove', e => {
                if (!prefs.bewegung)
                    return;
                const r = stage.getBoundingClientRect();
                stage.style.setProperty('--az-px', ((e.clientX - r.left) / r.width - .5) * -10 + 'px');
                stage.style.setProperty('--az-py', ((e.clientY - r.top) / r.height - .5) * -6 + 'px');
            });
            return stage;
        }
        function render(force = false) {
            if (!R() || !z.stand)
                return;
            shellClass();
            if (z.stand.phase === 'lobby') {
                lobby();
                return;
            }
            if (z.ende)
                return;
            const a = A(), g = group(), p = me(), op = R().aufgaben[Math.min(a.stage, 7)];
            const sig = JSON.stringify([a.stage, a.roster, a.gruppen, a.pausen, a.vote, a.wahl, a.chat, z.priv?.daten, z.priv?.zuschauer, z.priv?.zeuge, z.ort]);
            if (sig !== z.sig || force) {
                z.sig = sig;
                const board = h('aside', { class: 'az-mission' }, small('EURE GEMEINSAME OPERATION'), h('div', { class: 'az-mission-count' }, h('span', {}, String(Math.min(a.stage + 1, 8)).padStart(2, '0')), h('i', {}, '/ 08')), h('h3', {}, op.titel), h('p', { class: 'az-muted' }, op.text), h('div', { class: 'az-mission-role' }, small(spectator() ? 'ZUSCHAUERPLATZ' : 'DEIN REFERENZPLATZ'), h('b', {}, spectator() ? 'Runde bereits gestartet' : p ? p.p.rollen[p.rolle] : 'Rollenblatt wird übertragen …'), h('p', {}, spectator() ? 'Die Spielleitung kann dir einen fehlenden Platz zuweisen.' : g ? g.namen.join(' · ') : 'Warte auf deine Gruppenzuteilung.')), btn(g?.fertig ? 'Euren Beitrag nachlesen' : 'Zu deinem Gerät →', () => { z.ort = op.ort; render(true); operation(); }, 'primary', { disabled: spectator() || !p }), h('div', { class: 'az-group-progress' }, small(a.stage >= 6 ? 'DAS GANZE TEAM' : 'ALLE GRUPPEN MÜSSEN FREIGEBEN'), a.gruppen.map((v, i) => h('div', { class: 'az-group-line ' + (v.fertig ? 'done' : '') }, h('span', {}, v.ids.includes(ich.id) ? '●' : '○'), h('span', {}, 'Gruppe ' + (i + 1)), h('b', {}, v.fertig ? 'FREI' : v.abgegeben.length + '/' + v.ids.length)))), btn('Gruppenfunk öffnen', () => chat('gruppe'), 'ghost', { disabled: !g }), btn('Stationsplan', karte, 'ghost'));
                main.replaceChildren(heading(), h('div', { class: 'az-game-layout' }, world(), board), h('footer', { class: 'az-statusbar' }, h('span', {}, '◉ ' + a.roster.filter(p => p.da).length + '/' + a.roster.length + ' ZEUGEN VERBUNDEN'), h('span', {}, 'Jede Perspektive zählt. Vergleicht eure Informationen.'), h('span', {}, Object.keys(z.stand.geloest).length + '/8 SYSTEME FREI')));
                if (z.modal === 'operation' && z.operationSig !== JSON.stringify([g, p]))
                    operation(true);
                else if (z.modal === 'chat')
                    chat(z.kanal, true);
                else if (z.modal === 'manage')
                    manage(true);
            }
            const scene = a.scene;
            if (scene) {
                if (z.modal !== 'manage') {
                    if (z.scene?.id !== scene.id)
                        film(scene);
                    else
                        updateFilmWait();
                }
            }
            else if (z.scene) {
                z.scene = null;
                z.sceneAck = false;
                sound.ort(z.ort);
                S.stopp();
                sound.ducken(false);
                layer.replaceChildren();
                z.modal = null;
            }
            if (!a.scene && !z.scene) {
                if (a.pausen.length) {
                    if (z.modal !== 'settings' && z.modal !== 'manage' && (z.modal !== 'pause' || z.pauseSig !== JSON.stringify([a.fehlen, a.pausen])))
                        pause();
                }
                else if (a.vote) {
                    if (z.modal !== 'settings' && z.modal !== 'manage' && z.modal !== 'chat' && (z.modal !== 'vote' || z.voteSig !== JSON.stringify(a.vote)))
                        vote();
                }
                else if (z.modal === 'pause' || z.modal === 'vote')
                    close();
            }
        }
        function modal(titel, body, typ = 'document', wide = false) {
            const prev = document.activeElement, oldPanel = layer.querySelector('.az-panel');
            const refresh = !!oldPanel && z.modal === typ, scroll = refresh ? oldPanel.scrollTop || 0 : 0;
            const label = refresh ? prev?.getAttribute?.('aria-label') : null;
            const selection = refresh && prev?.tagName === 'INPUT' ? [prev.selectionStart, prev.selectionEnd] : null;
            z.modal = typ;
            const panel = h('section', { class: 'az-panel' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: -1 }, h('div', { class: 'az-panel-header' }, small('ASTER · UNABHÄNGIGE REFERENZ'), btn('×', close, 'icon', { 'aria-label': 'Dialog schließen' })), h('h2', {}, titel), body);
            layer.replaceChildren(h('div', { class: 'az-modal' }, panel));
            if (!refresh)
                z.previous = prev;
            const target = label ? [...panel.querySelectorAll('button,input,select')].find(n => n.getAttribute('aria-label') === label && !n.disabled) : null;
            (target || panel).focus({ preventScroll: true });
            if (target && selection && selection[0] !== null && target.setSelectionRange)
                target.setSelectionRange(...selection);
            panel.scrollTop = scroll;
            return panel;
        }
        function close() {
            if (z.scene && z.modal === 'manage') {
                z.modal = null;
                if (z.sceneAck)
                    updateFilmWait();
                else
                    drawShot();
                return;
            }
            if (z.scene)
                return;
            layer.replaceChildren();
            z.modal = null;
            z.feedback = '';
            if (z.previous?.isConnected)
                z.previous.focus({ preventScroll: true });
        }
        function karte() {
            const max = Math.min(8, A().stage + 1), ids = Object.keys(R().orte), svg = h('div', { class: 'az-map-lines', 'aria-hidden': 'true' });
            svg.innerHTML = '<svg viewBox="0 0 1000 800"><path d="M90 168L250 144L360 344L490 288L610 200L570 496L720 520L820 352L910 584" fill="none" stroke="#bca66b" stroke-width="2" stroke-dasharray="5 10" opacity=".4"/></svg>';
            modal('Die Station unter der Straße', h('div', {}, h('p', { class: 'az-muted' }, 'Freigegebene Bereiche bleiben erreichbar. Jede Person bewegt sich auf ihrem eigenen Gerät.'), h('div', { class: 'az-map' }, svg, ids.map((id, i) => btn('', () => {
                if (i > max)
                    return;
                z.ort = id;
                close();
                sound.ort(id);
                render(true);
            }, 'az-map-node' + (id === z.ort ? ' current' : ''), { disabled: i > max, style: { left: R().orte[id].x + '%', top: R().orte[id].y + '%' }, 'aria-label': R().orte[id].name }).appendChild(h('span', {}, h('b', {}, i > max ? '·' : String(i + 1).padStart(2, '0')), h('small', {}, R().orte[id].name))).parentNode)), h('div', { class: 'az-map-legend' }, '● FREIGEGEBEN  ·  ◉ DEIN STANDORT  ·  · GESCHLOSSEN')), 'map', true);
        }
        async function fund(ort, i) {
            const r = await request({ typ: 'arizona_lesen', ort, index: i });
            if (!r.richtig)
                return toast(r.info, 'bad');
            if (A().scene || z.ende || A().vote || A().pausen.length)
                return;
            cue('papier');
            const f = R().funde[ort][i];
            modal(f[0], h('div', { class: 'az-paper' }, small('FELDBEOBACHTUNG · ' + R().orte[ort].name), h('p', {}, f[1]), btn('Im gemeinsamen Feldbuch · zurück', close, 'ghost')));
        }
        function journal() { const entries = h('div', { class: 'az-journal' }); const draw = scene => entries.replaceChildren(...A().journal.filter(x => scene ? x.art === 'szene' : x.art !== 'szene').map(x => h('article', { class: 'az-entry ' + x.art }, small(x.art === 'wahl' ? 'GEMEINSAME ENTSCHEIDUNG' : x.art === 'szene' ? 'SZENE NACHLESEN' : 'FELDPROTOKOLL'), h('h3', {}, x.titel), h('p', {}, x.text)))); modal('Euer gemeinsames Feldbuch', h('div', {}, h('p', { class: 'az-muted' }, 'Funde und Filmtexte bleiben nachlesbar. Beim Lesen läuft die Spielzeit weiter.'), h('div', { class: 'az-journal-tabs' }, btn('Funde & Entscheidungen', () => draw(false), 'ghost'), btn('Szenen nachlesen', () => draw(true), 'ghost')), entries), 'journal', true); draw(false); }
        function groupStatus() {
            const g = group();
            if (!g)
                return h('div');
            return h('div', { class: 'az-collaborators' }, g.ids.map((id, i) => h('span', { class: 'az-collaborator ' + (g.abgegeben.includes(id) ? 'sent' : '') }, h('i', {}), g.namen[i], h('small', {}, g.abgegeben.includes(id) ? 'BESTÄTIGT' : 'ARBEITET'))));
        }
        function chatBox(kanal = 'gruppe') {
            const g = group(), messages = kanal === 'team' ? A().chat : me()?.chat || [], input = h('input', { class: 'az-input', type: 'text', maxlength: 280, value: z.chatDraft, placeholder: kanal === 'team' ? 'An das ganze Team …' : 'An deine Gruppe …', 'aria-label': 'Funknachricht', oninput: e => z.chatDraft = e.target.value });
            const send = async () => {
                const text = input.value.trim();
                if (!text)
                    return;
                z.chatDraft = '';
                input.value = '';
                const r = await request({ typ: 'arizona_chat', kanal, text });
                if (r.richtig) {
                    z.chatDraft = '';
                    input.value = '';
                }
                else
                    toast(r.info, 'bad');
            };
            return h('div', { class: 'az-chat-box' }, h('div', { class: 'az-chat-caption' }, small(kanal === 'team' ? 'TEAMFUNK' : 'NUR DEINE GRUPPE'), h('span', {}, kanal === 'team' ? A().roster.length + ' REFERENZEN' : (g?.ids.length || 0) + ' REFERENZEN')), h('div', { class: 'az-chat-log', 'aria-live': 'polite' }, messages.length ? messages.slice(-12).map(m => h('p', { class: m.von === ich.id ? 'own' : '' }, h('b', {}, m.name), h('span', {}, m.text))) : h('p', { class: 'az-muted' }, 'Beschreibt eure Hinweise. Ihr könnt euch auch direkt unterhalten.')), h('form', { class: 'az-chat-form', onsubmit: e => { e.preventDefault(); send(); } }, input, h('button', { class: 'az-btn', type: 'submit' }, 'Senden')));
        }
        function chat(kanal = 'gruppe', refresh = false) {
            if (!refresh)
                z.chatDraft = '';
            z.kanal = kanal;
            modal('Funkverbindung', h('div', {}, h('div', { class: 'az-chat-tabs' }, btn('Gruppenfunk', () => chat('gruppe'), 'ghost', { disabled: !group() }), btn('Ganzes Team', () => chat('team'), 'ghost')), chatBox(kanal)), 'chat', true);
        }
        function operation(refresh = false) {
            const mine = me(), g = group();
            if (!mine || !g)
                return toast('Dein Rollenblatt wird noch übertragen.');
            if (!refresh)
                z.feedback = '';
            const p = mine.p, bl = mine.blatt, art = p.art;
            z.operationSig = JSON.stringify([g, mine]);
            const key = g.id + ':' + (art === 'anker' ? g.impuls : 0);
            if (!z.drafts.has(key)) {
                z.drafts.set(key, art === 'gang' ? [0] : art === 'echo' ? [0, 1, 2, 3, 4] : art === 'strom' ? [0, 0] : art === 'funk' && mine.rolle === 0 || art === 'nullpunkt' ? '' : 0);
            }
            let value = z.drafts.get(key);
            const set = v => { z.drafts.set(key, v); value = v; };
            const sheet = h('div', { class: 'az-role-sheet' }, small('NUR DEINE PERSPEKTIVE · ' + (mine.rolle + 1)), h('h3', {}, p.rollen[mine.rolle]), h('p', {}, mine.hinweis));
            if (bl.typ === 'empfang') {
                sheet.append(h('div', { class: 'az-signal' }, bl.folge.map((s, i) => h('span', {}, h('small', {}, i + 1), h('b', {}, SY[s]), h('em', {}, s)))));
                if (bl.reihenfolge)
                    sheet.append(h('p', { class: 'az-readout' }, 'Positionen lesen: ' + bl.reihenfolge.map(i => i + 1).join(' → ')));
            }
            if (bl.typ === 'chiffre')
                sheet.append(h('div', { class: 'az-cipher' }, bl.paare.map(([s, n]) => h('span', {}, h('b', {}, SY[s]), h('small', {}, s), h('strong', {}, n)))));
            if (bl.typ === 'phase')
                sheet.append(h('div', { class: 'az-phase' }, small('DIE POSITIONEN DES ORIGINALSIGNALS'), h('b', {}, bl.reihenfolge.map(i => i + 1).join(' → '))));
            if (bl.typ === 'druck')
                sheet.append(h('div', { class: 'az-equation' }, h('span', {}, String.fromCharCode(65 + bl.a) + (bl.art === 'summe' ? ' + ' : ' − ') + String.fromCharCode(65 + bl.b)), h('b', {}, '= ' + bl.wert + ' bar')));
            if (bl.typ === 'karte')
                sheet.append(h('div', { class: 'az-hazard-list' }, small('DEINE GEFÄHRLICHEN FELDER'), h('b', {}, bl.verbot.map(i => i + 1).sort((a, b) => a - b).join(' · '))));
            if (bl.typ === 'regeln')
                sheet.append(h('ul', { class: 'az-clues' }, bl.regeln.map(q => h('li', {}, q.text))));
            if (bl.typ === 'schaltung')
                sheet.append(small('KALIBRIERBLATT FÜR ' + bl.fuer), h('div', { class: 'az-calibration' }, bl.ziele.map(t => h('span', {}, 'ANZEIGE ' + (t.index + 1), h('b', {}, t.wert)))));
            if (bl.typ === 'impulse')
                sheet.append(small('FOLGE FÜR ' + bl.fuer), h('div', { class: 'az-signal' }, bl.folge.map((v, i) => h('span', {}, h('small', {}, 'IMPULS ' + (i + 1)), h('b', {}, SY[p.symbole[v]]), h('em', {}, p.symbole[v])))));
            if (bl.typ === 'zeuge')
                sheet.append(h('div', { class: 'az-testimony' }, bl.merkmale.map(m => h('div', {}, small(m.feld), h('b', {}, m.wert)))));
            if (bl.typ === 'fragment')
                sheet.append(h('div', { class: 'az-fragment' }, bl.ziffern.map((v, i) => h('span', {}, h('small', {}, 'SPALTE ' + (i + 1)), h('b', {}, v)))));
            const device = h('div', { class: 'az-device ' + art });
            if ((art === 'funk' && mine.rolle === 0) || art === 'nullpunkt') {
                device.append(small('VIER ZIFFERN · FÜHRENDE NULLEN ZÄHLEN'), h('input', { class: 'az-code', value: String(value), inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: 4, 'aria-label': 'Vierstelliger Code', oninput: e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = v; set(v); } }));
            }
            else if (art === 'funk' || art === 'schleuse') {
                const max = art === 'schleuse' ? 16 : 9;
                device.append(small(art === 'schleuse' ? 'DEIN VENTIL · BAR' : 'DEINE PRÜFSUMME MODULO 10'), h('div', { class: 'az-dial' }, btn('−', () => { set((Number(value) + max) % (max + 1)); operation(true); }, 'ghost', { 'aria-label': 'Wert verringern' }), h('b', {}, String(value).padStart(2, '0')), btn('+', () => { set((Number(value) + 1) % (max + 1)); operation(true); }, 'ghost', { 'aria-label': 'Wert erhöhen' })), h('div', { class: 'az-dial-scale' }, Array.from({ length: max + 1 }, (_, i) => h('i', { class: i === value ? 'on' : '' }))));
            }
            else if (art === 'gang') {
                device.append(small('GEMEINSAMER WEG · 1 → 16'), h('div', { class: 'az-grid-map' }, Array.from({ length: 16 }, (_, i) => btn(String(i + 1), () => {
                    const prev = value.at(-1);
                    if (value.includes(i) || bl.verbot.includes(i) || !(Math.abs(i - prev) === 4 || Math.floor(i / 4) === Math.floor(prev / 4) && Math.abs(i - prev) === 1))
                        return;
                    set([...value, i]);
                    operation(true);
                }, 'az-grid-cell' + (value.includes(i) ? ' path' : '') + (bl.verbot.includes(i) ? ' danger' : '') + (value.at(-1) === i ? ' current' : ''), { 'aria-label': 'Bodenfeld ' + (i + 1), disabled: bl.verbot.includes(i) }))), h('p', { class: 'az-readout' }, value.map(i => i + 1).join(' → ')), h('div', { class: 'az-control-row' }, btn('Schritt zurück', () => { set(value.slice(0, Math.max(1, value.length - 1))); operation(true); }, 'ghost'), btn('Am Eingang neu planen', () => { set([0]); operation(true); }, 'ghost')));
            }
            else if (art === 'echo') {
                let selected = z.drafts.get(key + ':selected');
                device.append(small('FRÜH → SPÄT · ZWEI KARTEN TAUSCHEN'), h('div', { class: 'az-timeline' }, value.map((id, i) => btn('', () => {
                    if (selected === undefined) {
                        z.drafts.set(key + ':selected', i);
                    }
                    else {
                        const a = value.slice();
                        [a[i], a[selected]] = [a[selected], a[i]];
                        set(a);
                        z.drafts.delete(key + ':selected');
                    }
                    operation(true);
                }, 'az-film-card' + (selected === i ? ' selected' : ''), { 'aria-label': 'Aufnahme an Position ' + (i + 1) }).appendChild(h('span', {}, h('b', {}, '0' + (i + 1)), h('i', {}, ['▱', '⌁', '◐', '◷', '✋'][id]), h('strong', {}, p.karten[id]))).parentNode)));
            }
            else if (art === 'strom') {
                const calc = p.start.slice();
                bl.eigene.forEach((index, j) => {
                    calc[index] = (calc[index] + value[j]) % 5;
                    if (index + 1 < calc.length)
                        calc[index + 1] = (calc[index + 1] + value[j]) % 5;
                });
                device.append(small('AUSGANGSANZEIGEN · KEINE ZIELWERTE'), h('div', { class: 'az-power-baseline' }, p.start.map((v, i) => h('span', {}, h('small', {}, i + 1), h('b', {}, v)))), small('DEINE DREHUNGEN AB AUSGANGSLAGE'), h('div', { class: 'az-two-dials' }, bl.eigene.map((index, j) => h('div', {}, small('STELLGLIED ' + (index + 1)), btn('', () => { const a = value.slice(); a[j] = (a[j] + 1) % 5; set(a); cue('klick'); operation(true); }, 'az-rotor', { 'aria-label': 'Stellglied ' + (index + 1) + ' drehen' }).appendChild(h('span', {}, h('b', {}, value[j]), h('small', {}, 'DREHUNGEN'))).parentNode))), h('p', { class: 'az-muted' }, 'Die Drehung am linken Nachbarstellglied zählt mit. Rechnet die gemeinsamen Zielanzeigen vor dem Bestätigen durch.'));
            }
            else if (art === 'anker') {
                device.append(small('IMPULS ' + (g.impuls + 1) + ' / 4'), h('div', { class: 'az-pulse-time', 'data-pulse-clock': 'true' }, g.bis ? zeit(pulseRest(g)) : 'BEREITSCHAFT'), h('div', { class: 'az-pulse-track' }, Array.from({ length: 4 }, (_, i) => h('i', { class: i < g.impuls ? 'done' : i === g.impuls ? 'current' : '' }))), g.bis ? h('div', { class: 'az-symbol-keys' }, p.symbole.map((s, i) => btn('', () => { set(i); cue('impuls'); operation(true); }, 'az-symbol-key' + (value === i ? ' selected' : ''), { 'aria-label': 'Ankerzeichen ' + s }).appendChild(h('span', {}, h('b', {}, SY[s]), h('small', {}, s))).parentNode)) : h('div', { class: 'az-arm' }, h('p', {}, 'Sprecht zuerst alle Folgen ab. Sobald alle Gruppenmitglieder bereit sind, beginnt das erste Zeitfenster.'), btn(g.bereit.includes(ich.id) ? 'Dein Anker ist bereit' : 'Meinen Anker bereit melden', async () => {
                    const r = await request({ typ: 'arizona_ankerbereit', gruppe: g.id, rev: z.priv.rev });
                    if (!r.richtig)
                        toast(r.info, 'bad');
                }, 'primary', { disabled: g.bereit.includes(ich.id) }), h('small', {}, g.bereit.length + '/' + g.ids.length + ' ANKER BEREIT')));
            }
            else if (art === 'zeugen') {
                device.append(small('EIN ORIGINALSIGNAL · ALLE MERKMALE MÜSSEN STIMMEN'), h('div', { class: 'az-monitor-grid' }, p.quellen.map(q => btn('', () => { set(q.id); cue('klick'); operation(true); }, 'az-monitor' + (value === q.id ? ' selected' : ''), { 'aria-label': q.name }).appendChild(h('span', {}, h('b', {}, q.name), h('i', {}), q.werte.map((v, i) => h('small', {}, p.felder[i] + ': ' + v)))).parentNode)));
            }
            const feedback = h('p', { class: 'az-feedback', role: 'status' }, z.feedback || ((g.abgegeben.includes(ich.id) && !g.fertig) ? 'Dein Beitrag ist eingegangen. Die gemeinsame Prüfung wartet auf alle anderen.' : ''));
            const submit = btn(g.fertig ? 'Gruppe freigegeben' : g.abgegeben.includes(ich.id) ? 'Eigenen Beitrag aktualisieren' : 'Meinen Beitrag bestätigen', async () => {
                const r = await request({ typ: 'arizona_beitrag', gruppe: g.id, rev: z.priv.rev, impuls: g.impuls, antwort: z.drafts.get(key) });
                if (group()?.id !== g.id)
                    return;
                z.feedback = r.info;
                if (!r.richtig) {
                    cue('fehler');
                    toast(r.info, 'bad');
                }
                else
                    cue('klick');
                if (z.modal === 'operation')
                    operation(true);
            }, 'primary', { disabled: g.fertig || art === 'anker' && !g.bis });
            device.append(feedback, submit);
            const hints = h('div', { class: 'az-hints' }, g.hinweise.map((t, i) => h('p', {}, h('b', {}, 'HINWEIS ' + (i + 1) + ' · '), t)), g.hinweise.length < 3 ? btn('Gruppenhinweis · −' + R().hinweisKosten + ' s', async () => {
                const r = await request({ typ: 'arizona_hinweis', gruppe: g.id, rev: z.priv.rev, index: g.hinweise.length });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'ghost', { disabled: g.fertig }) : small('ALLE DREI HINWEISE GEÖFFNET'));
            modal(R().aufgaben[Math.min(A().stage, 7)].titel, h('div', {}, h('p', { class: 'az-operation-intro' }, p.anleitung), groupStatus(), h('div', { class: 'az-workbench' }, h('aside', { class: 'az-private-column' }, sheet, hints), h('div', { class: 'az-device-column' }, device)), chatBox('gruppe')), 'operation', true);
        }
        function vote() {
            const v = A().vote;
            z.voteSig = JSON.stringify(v);
            if (!v)
                return;
            modal(v.titel, h('div', { class: 'az-vote' }, h('p', { class: 'az-lead' }, v.text), h('div', { class: 'az-vote-options' }, v.optionen.map(([value, label, text]) => btn('', async () => {
                const r = await request({ typ: 'arizona_stimme', wert: value });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'az-vote-option' + (v.stimmen[ich.id] === value ? ' selected' : ''), { disabled: spectator() }).appendChild(h('span', {}, h('b', {}, label), h('small', {}, text), h('em', {}, Object.values(v.stimmen).filter(x => x === value).length + ' STIMMEN'))).parentNode)), h('p', { class: 'az-vote-state' }, Object.keys(v.stimmen).length + '/' + A().roster.length + ' Personen haben abgestimmt.'), Object.keys(v.stimmen).length === A().roster.length ? h('p', { class: 'az-muted' }, v.einstimmig ? 'Ihr seid euch noch nicht einig. Sprecht miteinander; jede Person kann ihre Stimme ändern.' : 'Noch keine Mehrheit. Bei Gleichstand müsst ihr eure Stimmen abstimmen.') : null, btn('Im Teamfunk besprechen', () => chat('team'), 'ghost')), 'vote', true);
        }
        function pause() { z.pauseSig = JSON.stringify([A().fehlen, A().pausen]); modal('Eure Perspektiven fehlen', h('div', { class: 'az-pause' }, h('div', { class: 'az-pause-mark' }, 'Ⅱ'), h('p', { class: 'az-lead' }, A().fehlen.length ? 'Die gemeinsame Zeit ist angehalten, bis alle Referenzplätze wieder verbunden sind.' : 'Die Spielleitung hat eine Teampause eingelegt.'), h('p', {}, A().fehlen.map(p => p.name).join(' · ')), host ? btn('Referenzplätze verwalten', manage, 'ghost') : null, host ? btn('Teampause schalten', () => request({ typ: 'arizona_pause' }), 'primary') : null), 'pause'); }
        function manage() {
            modal('Referenzplätze verwalten', h('div', { class: 'az-management' }, h('p', { class: 'az-muted' }, 'Eine zurückkehrende Person behält ihre Rolle. Ist jemand dauerhaft weg, kann ein neu verbundener Gast den fehlenden Referenzplatz übernehmen. Laufende Impulse werden dabei zurückgesetzt.'), A().fehlen.length ? A().fehlen.map(old => h('div', { class: 'az-replace' }, h('h3', {}, old.name + ' · Verbindung fehlt'), A().spaet.length ? A().spaet.map(neu => btn('Mit ' + neu.name + ' besetzen', async () => {
                const r = await request({ typ: 'arizona_ersatz', alt: old.id, neu: neu.id });
                if (!r.richtig)
                    toast(r.info, 'bad');
                else {
                    close();
                    render(true);
                }
            }, 'ghost')) : h('p', {}, 'Noch kein neuer Gast verbunden. Öffne „Einladen“ in der Host-Leiste.'))) : h('p', {}, 'Alle Referenzplätze sind verbunden.')), 'manage', true);
        }
        function settings() {
            const voices = S?.stimmen?.() || [];
            modal('Klang & Darstellung', h('div', { class: 'az-settings' }, h('p', { class: 'az-muted' }, 'Alle Hinweise sind lesbar. Geräusche und Kamerabewegungen lassen sich getrennt einstellen.'), btn(K.an() ? 'Geräusche ausschalten' : 'Geräusche einschalten', () => {
                K.schalten(!K.an());
                if (K.an())
                    audio();
                else {
                    sound.stop();
                    S.stopp();
                }
                settings();
            }, 'ghost'), h('label', {}, 'Lautstärke', h('input', { type: 'range', min: 0, max: 1, step: .05, value: prefs.laut, 'aria-label': 'Lautstärke', oninput: e => { prefs.laut = Number(e.target.value); sound.laut(prefs.laut); save(); } })), btn(prefs.musik ? 'Musik an' : 'Musik aus', () => { prefs.musik = !prefs.musik; sound.musik(prefs.musik); save(); settings(); }, 'ghost'), btn(prefs.bewegung ? 'Animation & Kamera an' : 'Reduzierte Bewegung', () => { prefs.bewegung = !prefs.bewegung; save(); shellClass(); settings(); }, 'ghost'), btn(prefs.schreck ? 'Schreckmomente an' : 'Schreckmomente aus', () => { prefs.schreck = !prefs.schreck; save(); settings(); }, 'ghost'), btn(prefs.stimme ? 'Vorlesen an' : 'Filmmodus · Text und Geräusche', () => { prefs.stimme = !prefs.stimme; S.schalten(prefs.stimme); save(); settings(); }, 'ghost'), voices.length ? h('div', {}, h('label', {}, 'Lokale deutsche Stimme', h('select', { class: 'az-input', 'aria-label': 'Lokale deutsche Stimme', onchange: e => S.waehlen(e.target.value) }, voices.map(v => h('option', { value: v.id, selected: v.id === S.auswahl() }, v.name)))), btn('Stimme probehören', async () => {
                audio();
                S.schalten(true);
                await S.sprechen('Nullmeile. Eine Straße. Mehrere Wirklichkeiten. Bleibt im Gespräch.');
                if (!prefs.stimme)
                    S.schalten(false);
            }, 'ghost')) : h('p', { class: 'az-muted' }, 'Keine passende deutsche Lokalstimme installiert. Der Filmmodus bleibt vollständig lesbar.'), host && z.stand?.phase === 'spiel' ? btn('Referenzplätze verwalten', manage, 'ghost') : null), 'settings');
        }
        function film(scene, outro = false) { z.modal = null; z.scene = { ...scene, outro }; z.shot = 0; z.sceneAck = false; z.replay = false; z.filmToken++; S.stopp(); drawShot(); }
        function drawShot() {
            const scene = z.scene;
            if (!scene)
                return;
            const shot = scene.zeilen[z.shot];
            if (!shot)
                return ackFilm();
            const token = ++z.filmToken;
            S.stopp();
            sound.ducken(false);
            const focus = shots[shot.bild] || shots.weit;
            sound.ort(shot.ort);
            const art = image(shot.ort, 'az-film-image', { portrait: shot.portrait, outro: shot.outro });
            art.style.setProperty('--shot-x', focus[0] + '%');
            art.style.setProperty('--shot-y', focus[1] + '%');
            art.style.setProperty('--shot-zoom', String(prefs.bewegung ? focus[2] : 1));
            art.dataset.effekt = shot.effekt;
            let text = shot.text;
            if (shot.bild === 'zeuge')
                text = z.priv?.zeuge || text;
            const next = btn(z.shot === scene.zeilen.length - 1 ? (scene.outro ? 'Euer Ergebnis →' : 'Ich habe die Szene gesehen') : 'Weiter →', () => {
                if (z.shot < scene.zeilen.length - 1) {
                    z.shot++;
                    drawShot();
                }
                else
                    ackFilm();
            }, 'primary', { disabled: true });
            const n = h('section', { class: 'az-film' + (['reifen', 'riss'].includes(shot.effekt) && prefs.bewegung ? ' impact' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': scene.titel, tabindex: -1 }, art, h('div', { class: 'az-film-overlay' }), h('header', { class: 'az-film-header' }, h('b', { class: 'az-logo' }, 'CLAVIS · PREMIUM III'), h('span', {}, scene.titel)), h('div', { class: 'az-film-focus' }, h('i', {}), small(shot.bild === 'zeuge' ? 'DEINE PERSÖNLICHE BEOBACHTUNG' : 'EINSTELLUNG ' + String(z.shot + 1).padStart(2, '0'))), h('div', { class: 'az-film-copy' }, h('div', { class: 'az-film-progress' }, scene.zeilen.map((_, i) => h('i', { class: i <= z.shot ? 'seen' : '' }))), small(shot.titel), h('p', { class: 'az-film-caption', 'aria-live': 'polite' }, text), h('div', { class: 'az-film-actions' }, h('small', { 'data-film-wait': 'true' }, 'Die gemeinsame Spielzeit ist pausiert.'), btn('←', () => { z.shot = Math.max(0, z.shot - 1); drawShot(); }, 'ghost', { 'aria-label': 'Vorherige Einstellung', disabled: z.shot === 0 }), btn('Szene überspringen', ackFilm, 'az-skip'), next)));
            layer.replaceChildren(n);
            n.focus({ preventScroll: true });
            cue(shot.effekt);
            if (prefs.stimme && S.verfuegbar?.()) {
                S.schalten(true);
                sound.ducken(true);
                S.sprechen(text).then(() => {
                    if (token === z.filmToken)
                        sound.ducken(false);
                });
            }
            clearTimeout(beatTimer);
            beatTimer = later(prefs.bewegung ? 850 : 80, () => next.disabled = false);
        }
        async function ackFilm() {
            z.replay = false;
            if (!z.scene)
                return;
            if (z.scene.outro) {
                z.scene = null;
                S.stopp();
                sound.ducken(false);
                result();
                return;
            }
            const id = z.scene.id;
            S.stopp();
            sound.ducken(false);
            const r = await request({ typ: 'arizona_szene', id });
            if (!r.richtig)
                return toast(r.info, 'bad');
            if (z.scene?.id !== id)
                return;
            z.sceneAck = true;
            updateFilmWait();
        }
        function updateFilmWait() {
            if (z.replay || !z.scene || z.scene.outro)
                return;
            if (!z.sceneAck && !A().scene?.bestaetigt.includes(ich.id))
                return;
            z.sceneAck = true;
            const scene = A().scene;
            if (!scene)
                return;
            const waitSig = JSON.stringify([scene.id, scene.bestaetigt, A().roster]);
            if (z.waitSig === waitSig && layer.querySelector('.az-film-wait'))
                return;
            z.waitSig = waitSig;
            layer.replaceChildren(h('section', { class: 'az-film az-film-wait', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Gemeinsame Szene' }, image(scene.zeilen.at(-1).ort, 'az-film-image'), h('div', { class: 'az-film-overlay' }), h('div', { class: 'az-film-wait-copy' }, small('EURE ZEIT IST ANGEHALTEN'), h('h2', {}, 'Ein Augenblick für alle.'), h('p', {}, scene.bestaetigt.length + '/' + A().roster.length + ' Personen haben die Szene gesehen.'), h('div', { class: 'az-film-wait-people' }, A().roster.map(p => h('span', { class: scene.bestaetigt.includes(p.id) ? 'seen' : '' }, scene.bestaetigt.includes(p.id) ? '✓ ' + p.name : '○ ' + p.name))), btn('Szene nachlesen', () => { z.sceneAck = false; z.replay = true; z.shot = 0; drawShot(); }, 'ghost'), host ? btn('Referenzplätze verwalten', () => { manage(); }, 'ghost') : null)));
        }
        function endgame(e) {
            if (z.ende)
                return;
            z.ende = e;
            z.scene = null;
            z.modal = null;
            clearTimeout(beatTimer);
            S.stopp();
            sound.ducken(false);
            const f = e.arizona;
            film({ id: 'outro', titel: f.titel, zeilen: [{ titel: e.geschafft ? 'Eure gemeinsame Entscheidung' : 'Der Horizont schließt sich', text: f.text, ort: e.geschafft ? 'kern' : 'strasse', effekt: e.geschafft ? 'nullpunkt' : 'reifen', bild: 'weit' }, { titel: 'Was von euch bleibt', text: f.nach, ort: 'strasse', effekt: e.geschafft ? 'wind' : 'funk', bild: 'weit', outro: e.geschafft && f.wahl.finale === 'versiegeln' ? 'morgen' : 'nacht' }] }, true);
        }
        function result() { layer.replaceChildren(); z.modal = null; sound.stop(); const e = z.ende, f = e.arizona; main.replaceChildren(h('div', { class: 'az-result' }, image('strasse', 'az-result-image', { outro: e.geschafft && f.wahl.finale === 'versiegeln' ? 'morgen' : 'nacht' }), h('div', { class: 'az-result-overlay' }), h('div', { class: 'az-result-copy' }, small('EURE GEMEINSAME GESCHICHTE'), h('h1', {}, f.titel), h('div', { class: 'az-stars' }, '★'.repeat(e.sterne) + '☆'.repeat(3 - e.sterne)), h('p', { class: 'az-lead' }, f.nach), h('div', { class: 'az-result-people' }, f.personen.map(n => h('span', {}, n))), h('div', { class: 'az-result-stats' }, h('span', {}, h('b', {}, zeit(e.zeit)), 'GEMEINSAME ZEIT'), h('span', {}, h('b', {}, e.geloest + '/8'), 'OPERATIONEN'), h('span', {}, h('b', {}, e.hinweise), 'HINWEISE')), h('p', { class: 'az-muted' }, f.wahl.nika === 'retten' ? 'Nika verlässt ihre Referenzposition.' : f.wahl.nika === 'halten' ? 'Nika bleibt Referenz 01.' : 'Eure Geschichte wurde nicht zu Ende geschrieben.'), host ? btn('Zurück zu Clavis', () => host.fertig(), 'primary') : h('p', { class: 'az-muted' }, 'Danke fürs Mitspielen. Du kannst diese Seite schließen.')))); }
        function moment(art) {
            if (z.ende || z.seen.has(art))
                return;
            z.seen.add(art);
            const text = { rueckspiegel: 'Im Rückspiegel geht eine Tür auf. Hinter euch ist kein Auto.', telefon: 'Ein Telefon vibriert. Auf dem Display steht die Nummer der Station. Die Leitung hat nie nach draußen geführt.', schatten: 'Euer Schatten wartet bereits am Ende des Gangs.', horizont: 'Der Horizont schließt sich. Die Straße wird zu einer dünnen Linie.', morgen: 'Aus dem Radio kommt wieder derselbe Refrain. Diesmal summt jemand mit.' }[art];
            toast(text);
            cue(art === 'telefon' ? 'funk' : art === 'morgen' ? 'radio' : 'riss');
            if (prefs.schreck && prefs.bewegung) {
                el.classList.add('az-distortion');
                later(1700, () => el.classList.remove('az-distortion'));
            }
        }
        function empfangen(d) {
            if (z.verlassen || !d)
                return;
            if (d.typ === 'raum') {
                if (d.raum?.premium !== 'arizona')
                    return;
                if (z.ende)
                    return;
                z.raum = d.raum;
                prefs.schreck = prefs.schreck && R().schreck.standard;
                if (z.stand?.phase === 'spiel')
                    render(true);
                else
                    lobby();
            }
            else if (d.typ === 'stand') {
                if (!d.arizona || d.arizona.seq < z.seq)
                    return;
                const old = A().stage, oldPhase = z.stand?.phase;
                z.seq = d.arizona.seq;
                z.stand = d;
                z.rest = d.restMs;
                z.seit = Date.now();
                if (d.phase === 'spiel' && (old !== A().stage || oldPhase !== 'spiel')) {
                    if (z.modal === 'operation') {
                        z.modal = null;
                        layer.replaceChildren();
                    }
                    z.ort = R()?.aufgaben[Math.min(A().stage, 7)].ort || 'kern';
                    sound.ort(z.ort);
                    z.feedback = '';
                    cue('gut');
                }
                render();
            }
            else if (d.typ === 'arizona_priv') {
                if (d.an !== ich.id || d.rev < (z.priv?.rev ?? -1) || d.seq < (z.priv?.seq ?? -1))
                    return;
                z.priv = d;
                render();
            }
            else if (d.typ === 'antwort') {
                const p = z.pending.get(d.nr);
                if (p) {
                    clearTimeout(p.timer);
                    timers.delete(p.timer);
                    z.pending.delete(d.nr);
                    p.resolve(d);
                }
            }
            else if (d.typ === 'arizona_moment')
                moment(d.art);
            else if (d.typ === 'ende')
                endgame(d.ergebnis);
            else if (['vorbei', 'entfernt'].includes(d.typ)) {
                destroy();
                main.replaceChildren(h('div', { class: 'az-loading' }, 'Die Verbindung zur Station wurde geschlossen.'));
                layer.replaceChildren();
            }
        }
        function key(e) {
            if (z.verlassen || !el.isConnected)
                return;
            const form = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
            if (e.key === 'Escape' && z.modal && !z.scene) {
                close();
                render(true);
            }
            if (!form && !z.modal && !z.scene) {
                if (e.key.toLowerCase() === 'j')
                    journal();
                if (e.key.toLowerCase() === 'm')
                    karte();
                if (e.key.toLowerCase() === 'c')
                    chat('gruppe');
            }
            if (e.key === 'Tab' && layer.children.length) {
                const buttons = [...layer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n => n.getClientRects().length);
                if (!buttons.length)
                    return;
                const first = buttons[0], last = buttons.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        function destroy() {
            if (z.verlassen)
                return;
            z.verlassen = true;
            z.filmToken++;
            clearInterval(heartbeat);
            timers.forEach(clearTimeout);
            timers.clear();
            for (const p of z.pending.values())
                p.resolve({ richtig: false, info: 'Die Runde ist beendet.' });
            z.pending.clear();
            sound.dispose();
            S.stopp();
            document.removeEventListener('keydown', key);
            window.removeEventListener('pagehide', destroy);
        }
        heartbeat = setInterval(() => {
            if (!el.isConnected)
                return destroy();
            for (const n of main.querySelectorAll('[data-clock="global"]'))
                n.textContent = zeit(rest());
            const g = group();
            for (const n of layer.querySelectorAll('[data-pulse-clock="true"]'))
                n.textContent = g?.bis ? zeit(pulseRest(g)) : 'BEREITSCHAFT';
            sound.spannung(1 - rest() / ((R()?.minuten || 72) * 60000));
        }, 500);
        document.addEventListener('keydown', key);
        window.addEventListener('pagehide', destroy);
        lobby();
        return { empfangen, destroy, element: el };
    }
    Clavis.ArizonaSpiel = { erstellen };
    const alt = Clavis.Spiel.erstellen;
    Clavis.Spiel.erstellen = (root, opt) => {
        let view = null;
        const queue = [];
        return { empfangen(d) {
                if (!view && d?.typ === 'raum') {
                    view = d.raum?.premium === 'arizona' ? erstellen(root, opt) : alt(root, opt);
                    view.empfangen(d);
                    queue.splice(0).forEach(x => view.empfangen(x));
                }
                else if (view)
                    view.empfangen(d);
                else if (['vorbei', 'entfernt'].includes(d?.typ))
                    root.textContent = 'Die Runde ist geschlossen.';
                else
                    queue.push(d);
            }, destroy() { view?.destroy?.(); }, get element() { return view?.element; } };
    };
})();
