'use strict';
/* Spieleransicht: Nur das adressierte Rollenblatt wird angezeigt. Kein Umschalten auf fremde Rollen. */
(() => {
    const h = (t, a, ...c) => Clavis.el(t, a, ...c.flat(Infinity)), SY = { KREIS: '◯', DREIECK: '△', WELLE: '≈', STERN: '✦', RAUTE: '◇', KREUZ: '+' };
    const zeit = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    const shots = { weit: [50, 50, 1.02], fahrt: [30, 56, 1.1], reifen: [82, 78, 1.45], mast: [42, 30, 1.25], zeuge: [30, 45, 1.15], luke: [75, 73, 1.35], pult: [35, 80, 1.3], tuer: [50, 48, 1.25], glas: [52, 41, 1.3], flucht: [50, 48, 1.1], monitor: [48, 50, 1.4], akte: [35, 76, 1.4], bruecke: [50, 43, 1.23], kern: [50, 35, 1.22] };
    function erstellen(root, { senden, ich, host = null }) {
        const el = h('section', { class: 'br-spiel', 'aria-label': 'Die Schwarze Reserve' }), main = h('div', { class: 'br-main' }), layer = h('div', { class: 'br-layer' });
        el.append(main, layer);
        root.replaceChildren(el);
        const K = Clavis.klang, S = Clavis.stimme, sound = Clavis.BankKlang(), reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const z = { raum: null, stand: null, priv: null, seq: -1, ort: 'aussen', modal: null, scene: null, shot: 0, sceneAck: false, filmToken: 0, ende: null, verlassen: false, rest: 0, seit: Date.now(), nr: 0, pending: new Map(), drafts: new Map(), ton: false, sig: '', feedback: '', chatDraft: '', kanal: 'gruppe', seen: new Set() };
        let prefs = { bewegung: !reduced, schreck: true, musik: true, laut: .6, stimme: false };
        try {
            prefs = { ...prefs, ...JSON.parse(localStorage.getItem('clavis:bank:prefs') || '{}') };
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
                localStorage.setItem('clavis:bank:prefs', JSON.stringify(prefs));
            }
            catch (_) { }
        };
        const A = () => z.stand?.bank || { crew: [], offen: ['aussen', 'dach'], roster: [], bereit: {}, gruppen: [], pausen: [], journal: [], wahl: {}, chat: [], fehlen: [], spaet: [] }, R = () => z.raum;
        const me = () => !spectator() && z.priv?.stage === A().stage ? z.priv?.daten : null, group = () => A().gruppen.find(g => g.ids.includes(ich.id)), spectator = () => z.stand?.phase === 'spiel' && !A().roster.some(p => p.id === ich.id);
        const pulseRest = g => Math.max(0, (g?.bis || 0) - ((A().serverZeit ?? Date.now()) + Date.now() - z.seit));
        const rest = () => Math.max(0, z.rest - (z.stand?.phase === 'spiel' && !A().pausen.length && !z.ende ? Date.now() - z.seit : 0));
        const effects = Clavis.BankEffekte(el, () => !prefs.bewegung, () => prefs.schreck);
        function aktion(art, e) {
            effects.aktion(art, e);
            if (z.stand?.phase === 'spiel' && !spectator() && ['rad', 'karte', 'taste', 'boden', 'hebel', 'papier'].includes(art))
                senden({ typ: 'bank_geste', art });
        }
        const btn = (t, f, c = '', a = {}) => h('button', { type: 'button', class: 'br-btn ' + c, onclick: e => { aktion('taste', e); f?.(e); }, ...a }, t);
        const small = t => h('span', { class: 'br-kicker' }, t), cue = t => {
            if (z.ton)
                sound.cue(t);
        };
        function image(ort, cls = '', extra = {}) { const n = h('div', { class: 'br-picture ' + cls, 'aria-hidden': 'true' }); n.innerHTML = Clavis.BankWelt.bild(ort, { alarm: A().alarm || 0, sicher: !!A().ruhe, geloest: z.stand?.geloest, ...extra }); return n; }
        function audio() { z.ton = true; K.bereit(); K.musikStoppen?.(); K.ambienteStoppen?.(); sound.laut(prefs.laut); sound.musik(prefs.musik); sound.start(z.ort); }
        function request(d) { const nr = ++z.nr; return new Promise(resolve => { const timer = later(15000, () => { z.pending.delete(nr); resolve({ richtig: false, info: 'Keine Antwort aus der Bank. Prüfe die Verbindung zur Spielleitung.' }); }); z.pending.set(nr, { resolve, timer }); Promise.resolve(senden({ ...d, nr })).catch(() => { clearTimeout(timer); timers.delete(timer); z.pending.delete(nr); resolve({ richtig: false, info: 'Die Verbindung zur Spielleitung ist unterbrochen.' }); }); }); }
        function toast(t, art = '') {
            if (!t)
                return;
            const n = h('div', { class: 'br-toast ' + art, role: 'status' }, t);
            el.append(n);
            later(5500, () => n.remove());
        }
        function shellClass() { el.className = 'br-spiel' + (!prefs.bewegung ? ' br-ruhig' : '') + (rest() < 180000 ? ' br-critical' : ''); }
        function lobby() {
            if (!R())
                return main.replaceChildren(h('div', { class: 'br-loading' }, 'Der Umschlag für die Nachtseite wird vorbereitet …'));
            const people = z.stand?.spieler || [], ready = people.filter(p => A().bereit[p.id]).length, own = !!A().bereit[ich.id], erlaubt = R().maxFehler - 1;
            main.replaceChildren(h('div', { class: 'br-lobby' }, image('aussen', 'br-cover'), h('div', { class: 'br-cover-overlay' }), h('header', { class: 'br-cover-header' }, h('b', { class: 'br-logo' }, 'CLAVIS NOIR'), small('MEGA PREMIUM · NUR IM TEAM')), h('div', { class: 'br-lobby-copy' }, small('23:17 · STAATLICHE RESERVEBANK AUREL'), h('h1', {}, 'DIE SCHWARZE', h('em', {}, 'RESERVE.')), h('div', { class: 'br-subtitle' }, 'DER NEUNTE TRESOR'), h('p', { class: 'br-lobby-lead' }, 'Die Maklerin kennt eure Rufnamen. Das Personal noch nicht. Heute Nacht entscheidet ihr, wem die Reserve gehört.'), h('div', { class: 'br-specs' }, h('span', {}, '2–8 Personen · 4–8 empfohlen'), h('span', {}, '12 Teamoperationen'), h('span', {}, R().minuten + ' Minuten'), h('span', {}, 'Ab 14')), h('div', { class: 'br-team-rule' }, h('b', {}, erlaubt === 0 ? 'Kein Fehlversuch erlaubt.' : erlaubt + ' gemeinsamer Fehlversuch' + (erlaubt === 1 ? '' : 'e') + ' erlaubt.'), h('p', {}, 'Geprüft wird erst nach den Beiträgen aller zugeteilten Personen. Unvollständige Eingaben sind kein Fehler. Nach dem geschützten Salon können eigene Fehlbeiträge oder abgelaufene angekündigte Zeitfenster zu endgültigen Festnahmen führen. Unter zwei aktiven Personen scheitert der Raub.')), h('div', { class: 'br-lobby-actions' }, btn(own ? 'Bereit · ' + ich.name : 'Ich bin bereit', async () => {
                audio();
                const a = await request({ typ: 'bank_bereit', wert: !own });
                if (!a.richtig)
                    toast(a.info, 'bad');
            }, own ? 'selected' : 'primary'), host ? btn('Den Raub beginnen →', () => { audio(); host.starten(); }, 'primary', { disabled: people.length < 2 || people.length > 8 || ready !== people.length }) : null, host ? btn('Gang einladen', einladung, 'ghost') : null, btn('Klang & Darstellung', settings, 'ghost')), h('div', { class: 'br-lobby-team' }, small(ready + '/' + people.length + ' GANGPLÄTZE BEREIT'), people.map(p => h('span', { class: 'br-person ' + (A().bereit[p.id] ? 'ready' : '') }, h('i', {}), p.name, host?.entfernen && p.id !== ich.id ? btn('×', () => host.entfernen(p.id), 'icon', { 'aria-label': p.name + ' aus der Lobby entfernen' }) : null))), h('p', { class: 'br-lobby-note' }, people.length < 2 ? 'Teile den Link oder QR-Code mit mindestens einer weiteren Person.' : ready < people.length ? 'Jede Person bestätigt ihre Bereitschaft. Die Spielleitung startet anschließend.' : 'Kein heimlicher Verräter. Unterschiedliche Rollen. Eine gemeinsame Gang.')), h('footer', { class: 'br-lobby-footer' }, h('span', {}, 'DIE NACHTSEITE · EIN RAUM IN CLAVIS'), h('span', {}, 'Redet miteinander. Niemand zieht für die anderen.'))));
        }
        function heading() {
            return h('header', { class: 'br-header' }, h('div', { class: 'br-wordmark' }, h('b', {}, 'CLAVIS · PREMIUM IV'), small('DIE SCHWARZE RESERVE')), h('div', { class: 'br-alarm-panel' }, small('AUFMERKSAMKEIT DER BANK'), h('div', { class: 'br-alarm-meter' }, h('i', { style: { width: (A().alarm || 0) + '%' } })), h('span', {}, 'FEHLER ' + (A().fehler || 0) + ' / ' + R().maxFehler + ' · ZUGRIFF BEI ' + R().maxFehler)), h('div', { class: 'br-clock' }, small(A().ruhe ? 'GESCHÜTZTER SALON' : 'VERBLEIBENDE NACHT'), h('b', { 'data-clock': 'global' }, zeit(rest()))), btn('⌖', karte, 'icon', { 'aria-label': 'Bankplan öffnen' }), btn('▤', journal, 'icon', { 'aria-label': 'Gangbuch öffnen' }), btn('≋', () => chat(spectator() ? 'zuschauer' : 'team'), 'icon', { 'aria-label': 'Gangfunk öffnen' }), btn('♫', settings, 'icon', { 'aria-label': 'Klang und Darstellung' }), host ? btn('Ⅱ', () => request({ typ: 'bank_pause' }), 'icon', { 'aria-label': 'Teampause schalten' }) : null, host ? btn('×', () => host.beenden(), 'icon', { 'aria-label': 'Raub verlassen' }) : null);
        }
        function world() {
            const info = R().orte[z.ort] || R().orte.aussen, op = R().aufgaben[Math.min(A().stage, 11)], g = group(), p = me(), aktiv = z.ort === op.ort && !spectator();
            const stage = h('div', { class: 'br-stage', 'data-ort': z.ort }, image(z.ort, 'br-stage-picture'), h('div', { class: 'br-stage-top' }, small(info.kapitel), h('h2', {}, info.name), h('p', {}, info.sub)), h('div', { class: 'br-frame-corner tl' }), h('div', { class: 'br-frame-corner tr' }), h('div', { class: 'br-frame-corner bl' }), h('div', { class: 'br-frame-corner br' }), h('span', { class: 'br-camera-stamp' }, 'AUREL · NACHTAUFNAHME'), !spectator() ? h('div', { class: 'br-hotspots' }, R().funde[z.ort].map((f, i) => btn('', () => fund(z.ort, i), 'br-hotspot', { style: { left: (i ? 75 : 22) + '%', top: (i ? 65 : 73) + '%' }, 'aria-label': f[0] }).appendChild(h('span', {}, h('b', {}, '+'), h('span', {}, f[0]))).parentNode), aktiv ? btn('', operation, 'br-hotspot br-operation', { style: { left: '50%', top: '51%' }, 'aria-label': 'Operation öffnen' }).appendChild(h('span', {}, h('b', {}, '◈'), h('span', {}, op.titel, h('small', {}, g?.fertig ? 'GRUPPE FREIGEGEBEN' : p ? p.p.rollen[p.rolle] : 'ROLLENBLATT WIRD ÜBERTRAGEN')))).parentNode : null) : null, h('div', { class: 'br-stage-bottom' }, h('span', { class: 'br-live' }, (z.priv?.rufname || ich.name) + ' · ' + (spectator() ? 'NUR ZUSCHAUERKAMERA' : 'EIGENER BLICK')), btn('Untersuchen', () => el.classList.toggle('br-labels'), 'ghost')));
            stage.addEventListener('pointermove', e => {
                if (!prefs.bewegung)
                    return;
                const r = stage.getBoundingClientRect();
                stage.style.setProperty('--br-px', ((e.clientX - r.left) / r.width - .5) * -9 + 'px');
                stage.style.setProperty('--br-py', ((e.clientY - r.top) / r.height - .5) * -5 + 'px');
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
            const a = A(), g = group(), p = me(), op = R().aufgaben[Math.min(a.stage, 11)], caught = a.crew?.find(c => c.id === ich.id)?.status === 'gefasst';
            const sig = JSON.stringify([a.rev, a.stage, a.crew, a.gruppen, a.pausen, a.vote, a.ruhe, a.kontrolle, a.wahl, z.priv?.teamchat, z.priv?.daten, z.priv?.zuschauerchat, z.ort]);
            if (sig !== z.sig || force) {
                z.sig = sig;
                const board = h('aside', { class: 'br-mission' }, small(spectator() ? 'DEIN RAUB IST VORBEI' : 'DIE NACHTSEITE'), h('div', { class: 'br-mission-count' }, h('span', {}, String(Math.min(a.stage + 1, 12)).padStart(2, '0')), h('i', {}, '/ 12')), h('h3', {}, spectator() ? (caught ? 'Festgesetzt.' : 'Zuschauerplatz') : op.titel), h('p', { class: 'br-muted' }, spectator() ? (caught ? 'Das Personal hat deinen Gangplatz geschlossen. Deine Festnahme bleibt für diesen Raub bestehen.' : 'Der Raub läuft bereits. Nur eine fehlende aktive Verbindung kann durch die Spielleitung ersetzt werden.') : op.text), h('div', { class: 'br-mission-role' }, small(spectator() ? 'KEINE AKTIVE BEDIENUNG' : z.priv?.rufname || 'DEIN GANGPLATZ'), h('b', {}, spectator() ? 'Kameras und Zuschauerfunk' : p ? p.p.rollen[p.rolle] : 'Rolle wird übertragen …'), h('p', {}, g ? g.namen.join(' · ') : '')), !spectator() ? btn(g?.fertig ? 'Euren Beitrag nachlesen' : 'Zu deinem Gerät →', () => { z.ort = op.ort; sound.ort(z.ort); render(true); operation(); }, 'primary', { disabled: !p }) : btn('Zuschauerfunk öffnen', () => chat('zuschauer'), 'ghost'), h('div', { class: 'br-group-progress' }, small(a.stage >= 10 ? 'DIE AKTIVE GANG' : 'JEDE GRUPPE MUSS FREIGEBEN'), a.gruppen.map((v, i) => h('div', { class: 'br-group-line ' + (v.fertig ? 'done' : '') }, h('span', {}, v.ids.includes(ich.id) ? '●' : '○'), h('span', {}, 'Gruppe ' + (i + 1)), h('b', {}, v.fertig ? 'FREI' : v.abgegeben.length + '/' + v.ids.length)))), h('div', { class: 'br-crew-list' }, (a.crew || []).map(c => h('span', { class: c.status === 'gefasst' ? 'caught' : c.da ? 'active' : 'offline' }, h('b', {}, c.rufname), h('small', {}, c.status === 'gefasst' ? 'FESTGESETZT' : c.da ? c.name : 'VERBINDUNG FEHLT')))), !spectator() ? btn('Gruppenfunk öffnen', () => chat('gruppe'), 'ghost', { disabled: !g }) : null, btn('Bankplan', karte, 'ghost'), host ? btn('Gangplätze verwalten', manage, 'ghost') : null);
                main.replaceChildren(heading(), h('div', { class: 'br-game-layout' }, world(), board), h('footer', { class: 'br-statusbar' }, h('span', {}, '● ' + a.roster.length + ' AKTIV · ' + ((a.crew?.length || 0) - a.roster.length) + ' FESTGESETZT'), h('span', {}, a.ruhe ? 'Im geschützten Salon zählt keine Aktion als Fehler.' : 'Die Bank vergisst keinen Fehlversuch.'), h('span', {}, Object.keys(z.stand.geloest).length + '/12 FREIGABEN')));
                if (z.modal === 'operation' && z.operationSig !== JSON.stringify([g, p]))
                    operation(true);
                else if (z.modal === 'chat')
                    chat(z.kanal, true);
                else if (z.modal === 'manage')
                    manage(true);
            }
            const scene = a.scene, seen = spectator() && z.seen.has('scene:' + scene?.id);
            if (scene && !seen) {
                if (!['manage', 'invite'].includes(z.modal)) {
                    if (z.scene?.id !== scene.id)
                        film(scene);
                    else
                        updateFilmWait();
                }
            }
            else if (z.scene && !z.scene.outro) {
                z.scene = null;
                z.sceneAck = false;
                S.stopp();
                sound.ducken(false);
                sound.ort(z.ort);
                layer.replaceChildren();
                z.modal = null;
            }
            if (scene && !seen)
                return;
            if (z.scene)
                return;
            const protectedModal = ['settings', 'manage', 'invite'].includes(z.modal);
            if (a.ruhe && !spectator()) {
                if (!protectedModal && (z.modal !== 'rest' || z.restSig !== JSON.stringify(a.ruhe)))
                    ruhe();
            }
            else if (a.pausen.length) {
                if (!protectedModal && (z.modal !== 'pause' || z.pauseSig !== JSON.stringify([a.fehlen, a.pausen])))
                    pause();
            }
            else if (a.kontrolle && !spectator()) {
                const signature = JSON.stringify([a.kontrolle, z.priv?.kontrolle]);
                if (!protectedModal && z.modal !== 'chat' && (z.modal !== 'control' || z.controlSig !== signature))
                    kontrolle();
            }
            else if (a.vote && !spectator()) {
                if (!protectedModal && z.modal !== 'chat' && (z.modal !== 'vote' || z.voteSig !== JSON.stringify(a.vote)))
                    vote();
            }
            else if (['pause', 'vote', 'rest', 'control'].includes(z.modal))
                close();
        }
        function modal(titel, body, typ = 'document', wide = false) {
            const prev = document.activeElement, oldPanel = layer.querySelector('.br-panel');
            const refresh = !!oldPanel && z.modal === typ, scroll = refresh ? oldPanel.scrollTop || 0 : 0;
            const label = refresh ? prev?.getAttribute?.('aria-label') : null;
            const selection = refresh && prev?.tagName === 'INPUT' ? [prev.selectionStart, prev.selectionEnd] : null;
            z.modal = typ;
            const panel = h('section', { class: 'br-panel' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: -1 }, h('div', { class: 'br-panel-header' }, small('AUREL · DIE NACHTSEITE'), btn('×', close, 'icon', { 'aria-label': 'Dialog schließen' })), h('h2', {}, titel), body);
            layer.replaceChildren(h('div', { class: 'br-modal' }, panel));
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
            if (z.scene && (z.modal === 'manage' || z.modal === 'invite')) {
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
            const ids = Object.keys(R().orte).filter(id => id !== 'ufer'), allowed = new Set([...(A().offen || ['aussen', 'dach']), ...(spectator() ? ['zelle'] : [])]), lines = h('div', { class: 'br-map-lines', 'aria-hidden': 'true' });
            lines.innerHTML = '<svg viewBox="0 0 1000 1000"><path d="M80 150L210 120L290 340L440 230L530 380L390 560L190 660L290 830L540 800L650 610L760 770L770 430L880 260L920 660" fill="none" stroke="#bfa575" opacity=".35" stroke-dasharray="4 8"/></svg>';
            modal('Die ungebuchten Wege', h('div', {}, h('p', { class: 'br-muted' }, spectator() ? 'Kamerabilder enthalten keine aktiven Geräte oder privaten Rollenblätter.' : 'Jede Person bewegt sich auf ihrem eigenen Gerät. Bereits freigegebene Hauptbereiche bleiben offen.'), h('div', { class: 'br-map' }, lines, ids.map(id => btn('', () => { z.ort = id; close(); sound.ort(id); effects.ereignis('rohrpost'); render(true); }, 'br-map-node' + (id === z.ort ? ' current' : ''), { disabled: !allowed.has(id), style: { left: R().orte[id].x + '%', top: R().orte[id].y + '%' }, 'aria-label': R().orte[id].name }).appendChild(h('span', {}, h('b', {}, allowed.has(id) ? '◈' : '·'), h('small', {}, R().orte[id].name))).parentNode))), 'map', true);
        }
        async function fund(ort, i) {
            const r = await request({ typ: 'bank_lesen', ort, index: i });
            if (!r.richtig)
                return toast(r.info, 'bad');
            if (A().scene || z.ende || A().vote || A().pausen.length)
                return;
            cue('papier');
            const f = R().funde[ort][i];
            modal(f[0], h('div', { class: 'br-paper' }, small('FELDBEOBACHTUNG · ' + R().orte[ort].name), h('p', {}, f[1]), btn('Im gemeinsamen Gangbuch · zurück', close, 'ghost')));
        }
        function journal() { const entries = h('div', { class: 'br-journal' }); const draw = scene => entries.replaceChildren(...A().journal.filter(x => scene ? x.art === 'szene' : x.art !== 'szene').map(x => h('article', { class: 'br-entry ' + x.art }, small(x.art === 'wahl' ? 'GEMEINSAME ENTSCHEIDUNG' : x.art === 'szene' ? 'SZENE NACHLESEN' : 'FELDPROTOKOLL'), h('h3', {}, x.titel), h('p', {}, x.text)))); modal('Euer gemeinsames Gangbuch', h('div', {}, h('p', { class: 'br-muted' }, 'Funde und Filmtexte bleiben nachlesbar. Beim Lesen läuft die Spielzeit weiter.'), h('div', { class: 'br-journal-tabs' }, btn('Funde & Entscheidungen', () => draw(false), 'ghost'), btn('Szenen nachlesen', () => draw(true), 'ghost')), entries), 'journal', true); draw(false); }
        function groupStatus() {
            const g = group();
            if (!g)
                return h('div');
            return h('div', { class: 'br-collaborators' }, g.ids.map((id, i) => h('span', { class: 'br-collaborator ' + (g.abgegeben.includes(id) ? 'sent' : '') }, h('i', {}), g.namen[i], h('small', {}, g.abgegeben.includes(id) ? 'BESTÄTIGT' : 'ARBEITET'))));
        }
        function chatBox(kanal = 'gruppe') {
            if (spectator())
                kanal = 'zuschauer';
            z.chatDrafts = z.chatDrafts || {};
            const messages = kanal === 'zuschauer' ? z.priv?.zuschauerchat || [] : kanal === 'team' ? z.priv?.teamchat || [] : me()?.chat || [], input = h('input', { class: 'br-input', type: 'text', maxlength: 300, value: z.chatDrafts[kanal] || '', placeholder: kanal === 'zuschauer' ? 'Nur an die anderen Zuschauer …' : kanal === 'team' ? 'An die aktive Gang …' : 'An deine Kleingruppe …', 'aria-label': 'Funknachricht', oninput: e => { z.chatDrafts[kanal] = e.target.value; aktion('schrift', e); } });
            const send = async () => {
                const text = input.value.trim();
                if (!text)
                    return;
                z.chatDrafts[kanal] = '';
                input.value = '';
                const r = await request({ typ: 'bank_chat', kanal, text });
                if (!r.richtig)
                    toast(r.info, 'bad');
            };
            return h('div', { class: 'br-chat-box' }, h('div', { class: 'br-chat-caption' }, small(kanal === 'zuschauer' ? 'NUR ZUSCHAUER' : kanal === 'team' ? 'DIE AKTIVE GANG' : 'NUR DEINE KLEINGRUPPE'), h('span', {}, kanal === 'gruppe' ? (group()?.ids.length || 0) + ' PERSONEN' : kanal === 'team' ? A().roster.length + ' AKTIV' : 'KEIN KANAL ZUR AKTIVEN GANG')), h('div', { class: 'br-chat-log', 'aria-live': 'polite' }, messages.length ? messages.slice(-16).map(m => h('p', { class: m.von === ich.id ? 'own' : '' }, h('b', {}, m.name), h('span', {}, m.text))) : h('p', { class: 'br-muted' }, kanal === 'zuschauer' ? 'Ihr könnt hier zusammen zuschauen. Nachrichten gehen nicht an die aktive Gang.' : 'Beschreibt eure Hinweise. Jeder Bildschirm enthält andere Informationen.')), h('form', { class: 'br-chat-form', onsubmit: e => { e.preventDefault(); aktion('taste', e); send(); } }, input, h('button', { class: 'br-btn', type: 'submit' }, 'Senden')));
        }
        function chat(kanal = 'gruppe', refresh = false) {
            if (spectator())
                kanal = 'zuschauer';
            z.kanal = kanal;
            modal(kanal === 'zuschauer' ? 'Hinter Sicherheitsglas' : 'Funk der Nachtseite', h('div', {}, !spectator() ? h('div', { class: 'br-chat-tabs' }, btn('Kleingruppe', () => chat('gruppe'), 'ghost', { disabled: !group() }), btn('Aktive Gang', () => chat('team'), 'ghost')) : null, chatBox(kanal)), 'chat', true);
        }
        function operation(refresh = false) {
            const mine = me(), g = group();
            if (!mine || !g || spectator())
                return;
            const p = mine.p, b = mine.blatt, art = p.art;
            z.operationSig = JSON.stringify([g, mine]);
            if (!refresh)
                z.feedback = '';
            const key = g.id + ':' + (art === 'taktwerk' ? g.runde : 0);
            if (!z.drafts.has(key)) {
                let v = 0;
                if (['rohrpost', 'reserve'].includes(art))
                    v = '';
                else if (art === 'legende' || art === 'taktwerk' || art === 'flucht')
                    v = -1;
                else if (art === 'bilanz')
                    v = [0, 0];
                else if (art === 'blickfeld')
                    v = [0, 0, 0];
                else if (art === 'lasten')
                    v = b.eigene.map(() => 0);
                else if (art === 'register')
                    v = b.zeilen.flatMap(() => [0, 0, 0, 0]);
                else if (art === 'messboden')
                    v = [0];
                z.drafts.set(key, v);
            }
            let value = z.drafts.get(key);
            const set = v => { value = v; z.drafts.set(key, v); };
            const sheet = h('div', { class: 'br-role-sheet' }, small('NUR DEIN PRÜFBLATT · ' + (mine.rolle + 1)), h('h3', {}, p.rollen[mine.rolle]), h('p', {}, mine.hinweis));
            if (b.typ === 'merkmale')
                sheet.append(h('div', { class: 'br-testimony' }, b.zeilen.map(m => h('div', {}, small(m.feld), h('b', {}, m.wert)))));
            if (b.typ === 'bilanz')
                sheet.append(small('DEINE ÄNDERUNGSZEILE · ALLE SPALTEN'), h('div', { class: 'br-ledger-line' }, b.aenderungen.map((v, i) => h('span', {}, h('small', {}, 'B' + (i + 1)), h('b', {}, v > 0 ? '+' + v : String(v))))));
            if (b.typ === 'lichtbus')
                sheet.append(small('ZIELLICHTER FÜR ' + b.fuer), h('div', { class: 'br-light-readout' }, b.ziele.map((v, i) => h('span', { class: v ? 'on' : '' }, h('i', {}), h('small', {}, 'LAMPE ' + (b.ab + i + 1))))));
            if (b.typ === 'takt')
                sheet.append(h('div', { class: 'br-equation' }, h('span', {}, String.fromCharCode(65 + b.a) + (b.minus ? ' − ' : ' + ') + String.fromCharCode(65 + b.b)), h('b', {}, '≡ ' + b.wert), small('MODULO 13')));
            if (b.typ === 'sendestreifen')
                sheet.append(small('EUER SENDESIEGEL BRAUCHT ALLE STREIFEN'), h('div', { class: 'br-fragment' }, b.fragment.map((v, i) => h('span', {}, h('small', {}, 'SPALTE ' + (i + 1)), h('b', {}, v)))), h('p', { class: 'br-receive-info' }, 'Deine Empfangs-Startposition: ' + (b.start + 1)));
            if (b.typ === 'stempel')
                sheet.append(small('NUR DEINE ZIELFELDER'), h('div', { class: 'br-stamp-target' }, Array.from({ length: 9 }, (_, i) => { const t = b.ziele.find(x => x.feld === i); return h('span', { class: t ? (t.an ? 'on' : 'off') : 'unknown' }, h('small', {}, i + 1), t ? (t.an ? '●' : '○') : '?'); })));
            if (b.typ === 'gewicht')
                sheet.append(small('DEINE TEILMASSE'), h('div', { class: 'br-mass' }, b.teilmasse + ' kg'), h('p', {}, 'Bekannte zusätzliche Beutelast: ' + p.zusatz + ' kg. Die anderen Teilmassen musst du erfragen.'));
            if (b.typ === 'register')
                sheet.append(small('DEINE ORIGINALWERTE'), h('ul', { class: 'br-clues' }, b.gegeben.map(c => h('li', {}, 'Feld ' + (c.feld + 1) + ' · Zeile ' + (Math.floor(c.feld / 4) + 1) + ', Spalte ' + (c.feld % 4 + 1) + ': ' + c.wert))), h('p', {}, 'Du bedienst Zeile ' + b.zeilen.map(r => r + 1).join(' und ') + '.'));
            if (b.typ === 'folge')
                sheet.append(small('VIER ZEICHEN FÜR ' + b.fuer), h('div', { class: 'br-signal' }, b.folge.map((v, i) => h('span', {}, h('small', {}, 'IMPULS ' + (i + 1)), h('b', {}, SY[p.symbole[v]]), h('em', {}, p.symbole[v])))));
            if (b.typ === 'boden')
                sheet.append(small('DEINE VERBOTENEN FELDER'), h('div', { class: 'br-hazard-list' }, h('b', {}, b.verbot.map(i => i + 1).sort((a, b) => a - b).join(' · '))));
            if (b.typ === 'reserve')
                sheet.append(small('DEIN FRAGMENT FÜR DIE GANGBASIS'), h('div', { class: 'br-fragment' }, b.fragment.map((v, i) => h('span', {}, h('small', {}, i + 1), h('b', {}, v)))), small('PERSÖNLICHER SCHLÜSSEL FÜR ' + b.fuer), h('div', { class: 'br-receive-info' }, b.schluessel.join(' · ')));
            if (b.typ === 'kette')
                sheet.append(small('DEIN UNMITTELBARER VORGÄNGER'), h('p', { class: 'br-chain-person' }, b.vorgaenger || 'DU BIST DER ANFANG'), small('RICHTIGES ZEICHEN FÜR ' + b.fuer), h('div', { class: 'br-chain-symbol' }, SY[p.symbole[b.zeichen]] + ' · ' + p.symbole[b.zeichen]));
            const device = h('div', { class: 'br-device ' + art });
            if (art === 'legende')
                device.append(small('WELCHE LEGENDE ERFÜLLT ALLE MERKMALE?'), h('div', { class: 'br-legend-grid' }, p.karten.map(c => btn('', () => { set(c.id); operation(true); }, 'br-legend' + (value === c.id ? ' selected' : ''), { 'aria-label': c.titel }).appendChild(h('span', {}, h('b', {}, c.titel), c.werte.map((v, i) => h('small', {}, p.felder[i] + ': ' + v)))).parentNode)));
            if (art === 'bilanz')
                device.append(small('AUSGANGSZIFFERN'), h('div', { class: 'br-power-baseline' }, p.basis.map((v, i) => h('span', {}, h('small', {}, 'B' + (i + 1)), h('b', {}, v)))), h('div', { class: 'br-two-dials' }, b.eigene.map((index, i) => h('div', {}, small('BUCHWERK ' + (index + 1)), btn('', () => { const v = value.slice(); v[i] = (v[i] + 1) % 10; set(v); aktion('rad'); operation(true); }, 'br-rotor', { 'aria-label': 'Buchwerk ' + (index + 1) + ' drehen' }).appendChild(h('span', {}, h('b', {}, value[i]), h('small', {}, 'ABSCHLUSSZIFFER'))).parentNode))));
            if (art === 'blickfeld')
                device.append(small('AUSGANGSLAMPEN'), h('div', { class: 'br-light-readout' }, p.start.map((v, i) => h('span', { class: v ? 'on' : '' }, h('i', {}), h('small', {}, i + 1)))), small('DEINE SCHALTER · 0 UNBERÜHRT / 1 KIPPEN'), h('div', { class: 'br-toggle-row' }, b.eigene.map((index, i) => btn('', () => { const v = value.slice(); v[i] = 1 - v[i]; set(v); aktion('rad'); operation(true); }, 'br-toggle' + (value[i] ? ' on' : ''), { 'aria-label': 'Lichtschalter ' + (index + 1) }).appendChild(h('span', {}, h('i', {}), h('b', {}, 'S' + (index + 1)), h('small', {}, value[i] ? '1 · KIPPEN' : '0 · UNBERÜHRT'))).parentNode)));
            if (art === 'chronos')
                device.append(small('DEIN TAKT · 0 BIS 12'), h('div', { class: 'br-clock-dial' }, h('i', { style: { rotate: (Number(value) * 360 / 13) + 'deg' } }), h('b', {}, value)), h('div', { class: 'br-control-row' }, btn('−', () => { set((Number(value) + 12) % 13); operation(true); }, 'ghost', { 'aria-label': 'Takt verringern' }), btn('+', () => { set((Number(value) + 1) % 13); operation(true); }, 'ghost', { 'aria-label': 'Takt erhöhen' })));
            if (art === 'rohrpost' || art === 'reserve') {
                if (art === 'rohrpost')
                    device.append(h('div', { class: 'br-route-card' }, small('SIEGEL VON PARTNERGRUPPE'), h('b', {}, String(p.partnerGruppe).padStart(2, '0')), h('span', {}, 'Ab deiner Startposition ' + (b.start + 1) + ' lesen.')));
                device.append(small(art === 'reserve' ? 'DEIN PERSÖNLICHER ABSCHLUSSCODE' : 'DEIN GEDREHTER EMPFANGSCODE'), h('input', { class: 'br-code', value: String(value), inputmode: 'numeric', maxlength: 4, 'aria-label': 'Vierstelliger Code', oninput: e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = v; set(v); aktion('schrift', e); } }));
            }
            if (art === 'praegung') {
                const mask = Clavis.BankWelt.drehen(b.maske, value), disc = h('div', { class: 'br-stamp-disc', style: { '--stamp-angle': (value * 90) + 'deg' } });
                disc.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57" fill="#13201a" stroke="#baa775" stroke-width="2"/><g>' + Array.from({ length: 9 }, (_, i) => '<circle cx="' + (33 + i % 3 * 27) + '" cy="' + (33 + Math.floor(i / 3) * 27) + '" r="7" fill="' + ((b.maske & (1 << i)) ? '#cabb8a' : '#09120f') + '"/>').join('') + '</g></svg>';
                device.append(small('DEIN STEMPEL · ' + (value * 90) + '°'), disc, h('p', { class: 'br-readout' }, 'Offen nach Drehung: ' + Array.from({ length: 9 }, (_, i) => i).filter(i => mask & (1 << i)).map(i => i + 1).join(' · ')), btn('Stempel 90° drehen', () => { set((value + 1) % 4); aktion('rad'); operation(true); }, 'ghost', { 'aria-label': 'Stempel drehen' }));
            }
            if (art === 'lasten')
                device.append(small('DEINE GEWICHTE'), h('div', { class: 'br-weight-grid' }, b.eigene.map((w, i) => btn('', () => { const v = value.slice(); v[i] = v[i] === 0 ? 1 : v[i] === 1 ? -1 : 0; set(v); aktion('rad'); operation(true); }, 'br-weight ' + (value[i] === 1 ? 'plus' : value[i] === -1 ? 'minus' : ''), { 'aria-label': 'Gewicht ' + p.gewichte[w] + ' kg' }).appendChild(h('span', {}, h('b', {}, p.gewichte[w]), h('em', {}, 'kg'), h('small', {}, value[i] === 1 ? 'GEGENSEIL +' : value[i] === -1 ? 'LASTKORB −' : 'UNBENUTZT'))).parentNode)));
            if (art === 'register')
                device.append(small('DEINE ZEILEN IM GEMEINSAMEN REGISTER'), h('div', { class: 'br-register-grid' }, Array.from({ length: 16 }, (_, cell) => { const row = Math.floor(cell / 4), own = b.zeilen.indexOf(row), at = own * 4 + cell % 4; return btn(own < 0 ? '·' : value[at] || '', () => { const v = value.slice(); v[at] = v[at] % 4 + 1; set(v); operation(true); }, 'br-register-cell ' + (own < 0 ? 'foreign' : ''), { 'aria-label': 'Registerfeld ' + (cell + 1), disabled: own < 0 }); })), h('p', { class: 'br-muted' }, 'Mit jedem Klick zählt ein eigenes Feld von 1 bis 4 weiter. Fremde Zeilen bedient die jeweilige andere Person.'));
            if (art === 'taktwerk' || art === 'flucht') {
                const armed = g.bis !== null || g.restFenster !== null;
                device.append(small(art === 'taktwerk' ? 'IMPULS ' + (g.runde + 1) + ' / 4' : 'OFFENE RIEGEL ' + g.schritt + ' / ' + g.ids.length), h('div', { class: 'br-pulse-time', 'data-pulse-clock': 'true' }, g.bis !== null ? zeit(pulseRest(g)) : g.restFenster !== null ? 'ANGEHALTEN' : 'BEREITSCHAFT'), h('div', { class: 'br-pulse-track' }, Array.from({ length: art === 'taktwerk' ? 4 : g.ids.length }, (_, i) => h('i', { class: i < (art === 'taktwerk' ? g.runde : g.schritt) ? 'done' : '' }))), h('div', { class: 'br-symbol-keys' }, p.symbole.map((sym, i) => btn('', () => { set(i); operation(true); }, 'br-symbol-key' + (value === i ? ' selected' : ''), { 'aria-label': 'Kontaktzeichen ' + sym }).appendChild(h('span', {}, h('b', {}, SY[sym]), h('small', {}, sym))).parentNode)), !armed ? btn(g.bereit.includes(ich.id) ? 'Bereit gemeldet' : 'Mein Gerät scharf melden', async () => {
                    const r = await request({ typ: 'bank_scharf', gruppe: g.id, rev: z.priv.rev });
                    if (!r.richtig)
                        toast(r.info, 'bad');
                }, 'primary', { disabled: g.bereit.includes(ich.id) }) : h('p', { class: 'br-muted' }, art === 'flucht' ? 'Nur die richtige nächste Person zieht. Alle anderen warten auf ihren Platz in der Kette.' : 'Alle bestätigen den aktuellen eigenen Impuls. Das Fenster gilt für diesen einen Impuls.'));
            }
            if (art === 'messboden')
                device.append(small('GEMEINSAMER WEG · 1 → 25'), h('div', { class: 'br-grid-map five' }, Array.from({ length: 25 }, (_, i) => btn(String(i + 1), () => {
                    const at = value.at(-1);
                    if (value.includes(i) || b.verbot.includes(i) || !(Math.abs(i - at) === 5 || Math.floor(i / 5) === Math.floor(at / 5) && Math.abs(i - at) === 1))
                        return;
                    set([...value, i]);
                    aktion('boden');
                    operation(true);
                }, 'br-grid-cell' + (value.includes(i) ? ' path' : '') + (b.verbot.includes(i) ? ' danger' : ''), { 'aria-label': 'Bodenfeld ' + (i + 1), disabled: b.verbot.includes(i) }))), h('p', { class: 'br-readout' }, value.map(i => i + 1).join(' → ')), h('div', { class: 'br-control-row' }, btn('Schritt zurück', () => { set(value.slice(0, Math.max(1, value.length - 1))); operation(true); }, 'ghost'), btn('Neu planen', () => { set([0]); operation(true); }, 'ghost')));
            const done = g.fertig || art === 'flucht' && g.abgegeben.includes(ich.id), armed = !['taktwerk', 'flucht'].includes(art) || g.bis !== null;
            device.append(h('p', { class: 'br-feedback', role: 'status' }, z.feedback || (g.abgegeben.includes(ich.id) && !done ? 'Dein Beitrag liegt vor. Die Gang wartet auf die anderen.' : '')), btn(done ? 'Dein Gerät ist freigegeben' : art === 'flucht' ? 'Meinen Riegel ziehen' : g.abgegeben.includes(ich.id) ? 'Eigenen Beitrag aktualisieren' : 'Meinen Beitrag bestätigen', async (e) => {
                e.currentTarget.disabled = true;
                const rev = z.priv.rev;
                const r = await request({ typ: 'bank_beitrag', gruppe: g.id, rev, runde: g.runde, schritt: g.schritt, antwort: z.drafts.get(key) });
                if (group()?.id !== g.id || spectator())
                    return;
                z.feedback = r.info;
                if (!r.richtig)
                    toast(r.info, 'bad');
                if (z.modal === 'operation')
                    operation(true);
            }, 'primary', { disabled: done || !armed }));
            const tips = h('div', { class: 'br-hints' }, g.hinweise.map((t, i) => h('p', {}, h('b', {}, 'GANGHINWEIS ' + (i + 1) + ' · '), t)), g.hinweise.length < 3 ? btn('Ganghinweis · −' + R().hinweisKosten + ' s', async () => {
                const r = await request({ typ: 'bank_hinweis', gruppe: g.id, rev: z.priv.rev, index: g.hinweise.length });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'ghost', { disabled: g.fertig }) : small('ALLE HINWEISE OFFEN'));
            modal(R().aufgaben[Math.min(A().stage, 11)].titel, h('div', {}, h('p', { class: 'br-operation-intro' }, p.anleitung), groupStatus(), h('div', { class: 'br-workbench' }, h('aside', { class: 'br-private-column' }, sheet, tips), h('div', { class: 'br-device-column' }, device)), h('div', { class: 'br-chat-tabs' }, btn('Gruppenfunk', () => { z.operationKanal = 'gruppe'; operation(true); }, 'ghost'), btn('Teamfunk', () => { z.operationKanal = 'team'; operation(true); }, 'ghost')), chatBox(z.operationKanal || 'gruppe')), 'operation', true);
        }
        function ruhe() {
            z.restSig = JSON.stringify(A().ruhe);
            sound.ort('salon');
            const r = A().ruhe, own = !!r.bereit[ich.id];
            modal('Der tote Winkel', h('div', { class: 'br-rest' }, image('salon', 'br-rest-picture'), h('div', { class: 'br-rest-copy' }, small('GESCHÜTZTER SALON · UHR ANGEHALTEN'), h('h3', {}, 'Ihr dürft sitzen.'), h('p', {}, 'Hier gibt es keine Kontrollen, keine Festnahmen und keine versteckte Frist. Sprecht miteinander. Erst wenn alle aktiven Personen bereit sind, geht ihr weiter.'), h('div', { class: 'br-rest-people' }, A().roster.map(p => h('span', { class: r.bereit[p.id] ? 'ready' : '' }, r.bereit[p.id] ? '✓ ' + p.name : '○ ' + p.name))), btn(own ? 'Bereit · ich warte auf die Gang' : 'Ich bin bereit weiterzugehen', async () => {
                const reply = await request({ typ: 'bank_ruhebereit' });
                if (!reply.richtig)
                    toast(reply.info, 'bad');
            }, 'primary', { disabled: own }), h('small', {}, 'Mindestens zwanzig ruhige Sekunden. Danach bestimmt ihr den Moment gemeinsam.'))), 'rest', true);
        }
        function kontrolle(refresh = false) {
            const k = A().kontrolle;
            if (!k || spectator())
                return;
            z.controlSig = JSON.stringify([k, z.priv?.kontrolle]);
            const code = z.priv?.kontrolle, key = 'kontrolle:' + k.id;
            if (!z.drafts.has(key))
                z.drafts.set(key, -1);
            const value = z.drafts.get(key), armed = k.bis !== null || k.restFenster !== null, own = k.abgegeben.includes(ich.id);
            modal(k.titel, h('div', { class: 'br-live-control' }, h('div', { class: 'br-control-camera' }, image('kamera'), h('div', { class: 'br-control-lens' }), small('REVISION · LIVE')), h('p', { class: 'br-lead' }, k.text), code ? h('div', { class: 'br-control-handoff' }, small('RICHTIGES ZEICHEN FÜR ' + code.fuer), h('b', {}, SY[['KREIS', 'RAUTE', 'WELLE', 'STERN'][code.zeichen]]), h('span', {}, ['KREIS', 'RAUTE', 'WELLE', 'STERN'][code.zeichen])) : h('p', {}, 'Dein Kontrollbeleg wird übertragen …'), h('p', { class: 'br-muted' }, 'Dieses Zeichen ist für die bezeichnete ANDERE Person. Erfrage dein eigenes, bevor ihr startet.'), h('div', { class: 'br-pulse-time', 'data-control-clock': 'true' }, k.bis !== null ? zeit(pulseRest(k)) : k.restFenster !== null ? 'ANGEHALTEN' : 'GEMEINSAM VORBEREITEN'), h('div', { class: 'br-symbol-keys' }, ['KREIS', 'RAUTE', 'WELLE', 'STERN'].map((sym, i) => btn('', () => { z.drafts.set(key, i); kontrolle(true); }, 'br-symbol-key' + (value === i ? ' selected' : ''), { 'aria-label': 'Kontrollzeichen ' + sym }).appendChild(h('span', {}, h('b', {}, SY[sym]), h('small', {}, sym))).parentNode)), armed ? btn(own ? 'Dein Kontrollbeleg liegt vor' : 'Meinen Kontrollbeleg abgeben', async () => {
                const r = await request({ typ: 'bank_kontrolle', id: k.id, antwort: z.drafts.get(key) });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'primary', { disabled: own || value < 0 }) : btn(k.bereit.includes(ich.id) ? 'Für Kontrolle bereit' : 'Ich kenne meinen Kontrollbeleg', async () => {
                const r = await request({ typ: 'bank_kontrollbereit', id: k.id });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'primary', { disabled: k.bereit.includes(ich.id) || !code }), h('p', { class: 'br-muted' }, armed ? k.abgegeben.length + '/' + A().roster.length + ' persönliche Belege eingegangen.' : k.bereit.length + '/' + A().roster.length + ' Personen bereit. Vor gemeinsamer Bereitschaft beginnt kein Zeitfenster.'), btn('Im Teamfunk absprechen', () => chat('team'), 'ghost')), 'control', true);
        }
        function vote() {
            const v = A().vote;
            z.voteSig = JSON.stringify(v);
            if (!v)
                return;
            modal(v.titel, h('div', { class: 'br-vote' }, h('p', { class: 'br-lead' }, v.text), h('div', { class: 'br-vote-options' }, v.optionen.map(([value, label, text]) => btn('', async () => {
                const r = await request({ typ: 'bank_stimme', wert: value });
                if (!r.richtig)
                    toast(r.info, 'bad');
            }, 'br-vote-option' + (v.stimmen[ich.id] === value ? ' selected' : ''), { disabled: spectator() }).appendChild(h('span', {}, h('b', {}, label), h('small', {}, text), h('em', {}, Object.values(v.stimmen).filter(x => x === value).length + ' STIMMEN'))).parentNode)), h('p', { class: 'br-vote-state' }, Object.keys(v.stimmen).length + '/' + A().roster.length + ' Personen haben abgestimmt.'), Object.keys(v.stimmen).length === A().roster.length ? h('p', { class: 'br-muted' }, v.einstimmig ? 'Ihr seid euch noch nicht einig. Sprecht miteinander; jede Person kann ihre Stimme ändern.' : 'Noch keine Mehrheit. Bei Gleichstand müsst ihr eure Stimmen abstimmen.') : null, btn('Im Teamfunk besprechen', () => chat('team'), 'ghost')), 'vote', true);
        }
        function pause() { z.pauseSig = JSON.stringify([A().fehlen, A().pausen]); modal('Eure Perspektiven fehlen', h('div', { class: 'br-pause' }, h('div', { class: 'br-pause-mark' }, 'Ⅱ'), h('p', { class: 'br-lead' }, A().fehlen.length ? 'Die gemeinsame Zeit ist angehalten, bis alle Gangplätze wieder verbunden sind.' : 'Die Spielleitung hat eine Teampause eingelegt.'), h('p', {}, A().fehlen.map(p => p.name).join(' · ')), host ? btn('Gangplätze verwalten', manage, 'ghost') : null, host ? btn('Teampause schalten', () => request({ typ: 'bank_pause' }), 'primary') : null), 'pause'); }
        function einladung() {
            const inhalt = host?.einladung?.();
            if (!inhalt)
                return toast('Öffne den bereits geteilten Einladungslink in einem neuen Spielerfenster.');
            modal('Weitere Person einladen', h('div', {}, h('p', { class: 'br-muted' }, z.stand?.phase === 'lobby' ? 'Teile den Link oder QR-Code mit deiner Gang. Jede Person braucht einen eigenen Gangplatz.' : 'Der neue Gast tritt zunächst als Zuschauer bei. Danach kannst du ihm einen fehlenden aktiven Gangplatz zuweisen. Gefasste Plätze bleiben geschlossen.'), inhalt, btn('Zur Platzverwaltung', manage, 'ghost')), 'invite', true);
        }
        function manage() {
            modal('Gangplätze verwalten', h('div', { class: 'br-management' }, h('p', { class: 'br-muted' }, 'Eine zurückkehrende Person behält ihre Rolle. Ist jemand dauerhaft weg, kann ein neu verbundener Gast den fehlenden Gangplatz übernehmen. Laufende Impulse werden dabei zurückgesetzt.'), host?.einladung ? btn('Weitere Person einladen', einladung, 'ghost') : null, A().fehlen.length ? A().fehlen.map(old => h('div', { class: 'br-replace' }, h('h3', {}, old.name + ' · Verbindung fehlt'), A().spaet.length ? A().spaet.map(neu => btn('Mit ' + neu.name + ' besetzen', async () => {
                const r = await request({ typ: 'bank_ersatz', alt: old.id, neu: neu.id });
                if (!r.richtig)
                    toast(r.info, 'bad');
                else {
                    close();
                    render(true);
                }
            }, 'ghost')) : h('p', {}, 'Noch kein neuer Gast verbunden. Verwende die Einladung oder den bereits geteilten Link.'))) : h('p', {}, 'Alle Gangplätze sind verbunden.')), 'manage', true);
        }
        function settings() {
            const voices = S?.stimmen?.() || [];
            modal('Klang & Darstellung', h('div', { class: 'br-settings' }, h('p', { class: 'br-muted' }, 'Alle Hinweise sind lesbar. Geräusche und Kamerabewegungen lassen sich getrennt einstellen.'), btn(K.an() ? 'Geräusche ausschalten' : 'Geräusche einschalten', () => {
                K.schalten(!K.an());
                if (K.an())
                    audio();
                else {
                    sound.stop();
                    S.stopp();
                }
                settings();
            }, 'ghost'), h('label', {}, 'Lautstärke', h('input', { type: 'range', min: 0, max: 1, step: .05, value: prefs.laut, 'aria-label': 'Lautstärke', oninput: e => { aktion('schrift', e); prefs.laut = Number(e.target.value); sound.laut(prefs.laut); save(); } })), btn(prefs.musik ? 'Musik an' : 'Musik aus', () => { prefs.musik = !prefs.musik; sound.musik(prefs.musik); save(); settings(); }, 'ghost'), btn(prefs.bewegung ? 'Animation & Kamera an' : 'Reduzierte Bewegung', () => { prefs.bewegung = !prefs.bewegung; save(); shellClass(); settings(); }, 'ghost'), btn(prefs.schreck ? 'Schreckmomente an' : 'Schreckmomente aus', () => { prefs.schreck = !prefs.schreck; save(); settings(); }, 'ghost'), btn(prefs.stimme ? 'Vorlesen an' : 'Filmmodus · Text und Geräusche', () => { prefs.stimme = !prefs.stimme; S.schalten(prefs.stimme); save(); settings(); }, 'ghost'), voices.length ? h('div', {}, h('label', {}, 'Lokale deutsche Stimme', h('select', { class: 'br-input', 'aria-label': 'Lokale deutsche Stimme', onchange: e => { aktion('taste', e); S.waehlen(e.target.value); } }, voices.map(v => h('option', { value: v.id, selected: v.id === S.auswahl() }, v.name)))), btn('Stimme probehören', async () => {
                audio();
                S.schalten(true);
                await S.sprechen('Die Schwarze Reserve. Keine Einzelgänge. Die Bank hört mit.');
                if (!prefs.stimme)
                    S.schalten(false);
            }, 'ghost')) : h('p', { class: 'br-muted' }, 'Keine passende deutsche Lokalstimme installiert. Der Filmmodus bleibt vollständig lesbar.'), host && z.stand?.phase === 'spiel' ? btn('Gangplätze verwalten', manage, 'ghost') : null), 'settings');
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
            const art = image(shot.ort, 'br-film-image', { portrait: shot.portrait, outro: shot.outro });
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
            const n = h('section', { class: 'br-film' + (['reifen', 'riss'].includes(shot.effekt) && prefs.bewegung ? ' impact' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': scene.titel, tabindex: -1 }, art, h('div', { class: 'br-film-overlay' }), h('header', { class: 'br-film-header' }, h('b', { class: 'br-logo' }, 'CLAVIS · NOIR EDITION'), h('span', {}, scene.titel)), h('div', { class: 'br-film-focus' }, h('i', {}), small(shot.bild === 'zeuge' ? 'DEINE PERSÖNLICHE BEOBACHTUNG' : 'EINSTELLUNG ' + String(z.shot + 1).padStart(2, '0'))), h('div', { class: 'br-film-copy' }, h('div', { class: 'br-film-progress' }, scene.zeilen.map((_, i) => h('i', { class: i <= z.shot ? 'seen' : '' }))), small(shot.titel), h('p', { class: 'br-film-caption', 'aria-live': 'polite' }, text), h('div', { class: 'br-film-actions' }, h('small', { 'data-film-wait': 'true' }, 'Die Zeit der Gang ist angehalten.'), btn('←', () => { z.shot = Math.max(0, z.shot - 1); drawShot(); }, 'ghost', { 'aria-label': 'Vorherige Einstellung', disabled: z.shot === 0 }), btn('Szene überspringen', ackFilm, 'br-skip'), next)));
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
            if (spectator()) {
                z.seen.add('scene:' + z.scene.id);
                z.scene = null;
                layer.replaceChildren();
                z.modal = null;
                sound.ort(z.ort);
                render(true);
                return;
            }
            const id = z.scene.id;
            S.stopp();
            sound.ducken(false);
            const r = await request({ typ: 'bank_szene', id });
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
            if (z.waitSig === waitSig && layer.querySelector('.br-film-wait'))
                return;
            z.waitSig = waitSig;
            layer.replaceChildren(h('section', { class: 'br-film br-film-wait', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Gemeinsame Szene' }, image(scene.zeilen.at(-1).ort, 'br-film-image'), h('div', { class: 'br-film-overlay' }), h('div', { class: 'br-film-wait-copy' }, small('EURE ZEIT IST ANGEHALTEN'), h('h2', {}, 'Ein Augenblick für alle.'), h('p', {}, scene.bestaetigt.length + '/' + A().roster.length + ' Personen haben die Szene gesehen.'), h('div', { class: 'br-film-wait-people' }, A().roster.map(p => h('span', { class: scene.bestaetigt.includes(p.id) ? 'seen' : '' }, scene.bestaetigt.includes(p.id) ? '✓ ' + p.name : '○ ' + p.name))), btn('Szene nachlesen', () => { z.sceneAck = false; z.replay = true; z.shot = 0; drawShot(); }, 'ghost'), host ? btn('Gangplätze verwalten', () => { manage(); }, 'ghost') : null)));
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
            const f = e.bank, own = f.personal[ich.id], caught = own?.status === 'gefasst' || own?.status === 'uebernommen';
            film({ id: 'outro', titel: f.titel, zeilen: [{ titel: 'Was aus dem Raub wurde', text: f.text, ort: e.geschafft ? 'ufer' : 'zelle', effekt: e.geschafft ? 'regen' : 'festnahme', bild: 'weit' }, { titel: caught ? 'Dein Platz hinter Glas' : 'Dein letzter Anteil', text: (caught ? 'Dein Gangplatz ist geschlossen. Du bist aus dem Raub ausgeschieden. ' : '') + f.nach, ort: caught ? 'zelle' : 'ufer', effekt: caught ? 'intercom' : 'regen', bild: 'weit' }] }, true);
        }
        function result() { layer.replaceChildren(); z.modal = null; sound.stop(); const e = z.ende, f = e.bank, own = f.personal[ich.id], caught = own?.status === 'gefasst' || own?.status === 'uebernommen'; main.replaceChildren(h('div', { class: 'br-result' }, image(caught ? 'zelle' : 'ufer', 'br-result-image'), h('div', { class: 'br-result-overlay' }), h('div', { class: 'br-result-copy' }, small(caught ? 'DEIN PERSÖNLICHES ENDE · FESTGESETZT' : 'EURE GEMEINSAME BILANZ'), h('h1', {}, caught ? 'Hinter Sicherheitsglas' : f.titel), h('div', { class: 'br-stars' }, '★'.repeat(e.sterne) + '☆'.repeat(3 - e.sterne)), h('p', { class: 'br-lead' }, caught ? 'Die Gang hat ihre Geschichte geschrieben. Deine Rolle endete mit einer Festnahme. ' + (own.grund || 'Die Bank hat deinen Gangplatz übernommen.') : f.nach), h('div', { class: 'br-result-people' }, Object.values(f.personal).map(p => h('span', { class: p.status === 'gefasst' || p.status === 'uebernommen' ? 'caught' : '' }, p.rufname + ' · ' + (p.status === 'gefasst' ? 'FESTGESETZT' : p.status === 'uebernommen' ? 'ÜBERNOMMEN' : p.status === 'entkommen' ? 'ENTKOMMEN' : 'RÜCKZUG')))), h('div', { class: 'br-result-stats' }, h('span', {}, h('b', {}, zeit(e.zeit)), 'ZEIT IM RAUB'), h('span', {}, h('b', {}, e.geloest + '/12'), 'OPERATIONEN'), h('span', {}, h('b', {}, f.fehler), 'FEHLVERSUCHE'), h('span', {}, h('b', {}, f.entkommen), 'ENTKOMMEN')), caught ? h('p', { class: 'br-muted' }, 'Gesamtende der Gang: ' + f.titel) : null, host ? btn('Zurück zu Clavis', () => host.fertig(), 'primary') : h('p', { class: 'br-muted' }, 'Der Raub ist beendet. Du kannst diese Seite schließen.')))); }
        function bankEvent(d) {
            effects.ereignis(d.art, d);
            if (d.art === 'festnahme' && d.ids?.includes(ich.id)) {
                if (z.priv)
                    z.priv.daten = null;
                z.modal = null;
                layer.replaceChildren();
                z.ort = 'zelle';
                cue('festnahme');
            }
            else if (d.art === 'zugriff') {
                cue('zugriff');
            }
            else if (d.art === 'alarm')
                cue('alarm');
            else if (d.art === 'kontrolle')
                cue('intercom');
            else if (['freigabe', 'riegel', 'impuls', 'scharf', 'beleg'].includes(d.art))
                cue(d.art);
            else if (d.art === 'crew' && d.person !== ich.id)
                cue('crew');
            if (d.art === 'moment') {
                const text = { blick: 'Die Kamera folgt einer Bewegung, die ihr gerade erst machen wolltet.', telefon: 'Das Diensttelefon klingelt. Niemand kennt die Nummer, aber alle schauen hin.', schatten: 'Hinter dem Mattglas hebt das Personal gleichzeitig den Kopf.', gitter: 'Ein Rollgitter fällt außerhalb eures Blickfelds. Die Bank hat einen Weg weniger.', letzter: 'Die Maklerin hört auf zu sprechen. Ihr hört ihre Tasse noch einmal. Ganz in eurer Nähe.' }[d.moment];
                toast(text);
                cue(d.moment === 'telefon' ? 'intercom' : 'schritte');
            }
        }
        function empfangen(d) {
            if (z.verlassen || !d)
                return;
            if (d.typ === 'raum') {
                if (d.raum?.premium !== 'reserve' || z.ende)
                    return;
                z.raum = d.raum;
                prefs.schreck = prefs.schreck && R().schreck.standard;
                if (z.stand?.phase === 'spiel')
                    render(true);
                else
                    lobby();
            }
            else if (d.typ === 'stand') {
                if (!d.bank || d.bank.seq < z.seq)
                    return;
                const old = A().stage, oldRev = A().rev, oldPhase = z.stand?.phase;
                z.seq = d.bank.seq;
                z.stand = d;
                z.rest = d.restMs;
                z.seit = Date.now();
                if (d.phase === 'spiel' && (old !== A().stage || oldRev !== A().rev || oldPhase !== 'spiel')) {
                    if (z.modal === 'operation') {
                        z.modal = null;
                        layer.replaceChildren();
                    }
                    z.ort = spectator() ? 'zelle' : A().ruhe ? 'salon' : R().aufgaben[Math.min(11, A().stage)].ort;
                    sound.ort(z.ort);
                    z.feedback = '';
                }
                render();
            }
            else if (d.typ === 'bank_priv') {
                if (d.an !== ich.id || d.rev < (z.priv?.rev ?? -1) || d.seq < (z.priv?.seq ?? -1))
                    return;
                z.priv = d;
                if (d.gefasst && z.modal === 'operation') {
                    z.modal = null;
                    layer.replaceChildren();
                }
                render();
            }
            else if (d.typ === 'antwort') {
                const pending = z.pending.get(d.nr);
                if (pending) {
                    clearTimeout(pending.timer);
                    timers.delete(pending.timer);
                    z.pending.delete(d.nr);
                    pending.resolve(d);
                }
            }
            else if (d.typ === 'bank_fx')
                bankEvent(d);
            else if (d.typ === 'ende')
                endgame(d.ergebnis);
            else if (['vorbei', 'entfernt'].includes(d.typ)) {
                destroy();
                main.replaceChildren(h('div', { class: 'br-loading' }, 'Die Verbindung zur Bank wurde geschlossen.'));
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
            effects.dispose();
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
            for (const n of layer.querySelectorAll('[data-control-clock="true"]'))
                n.textContent = A().kontrolle?.bis !== null ? zeit(pulseRest(A().kontrolle)) : 'VORBEREITUNG';
            sound.spannung(Math.max((A().alarm || 0) / 100, 1 - rest() / ((R()?.minuten || 64) * 60000)));
        }, 500);
        document.addEventListener('keydown', key);
        window.addEventListener('pagehide', destroy);
        lobby();
        return { empfangen, destroy, element: el };
    }
    Clavis.BankSpiel = { erstellen };

})();
