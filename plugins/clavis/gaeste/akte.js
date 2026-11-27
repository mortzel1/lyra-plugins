'use strict';
/* Ermitteln statt Schlösser lösen. Jede Ansicht hat einen eigenen Standort und eigene Arbeitsentwürfe. */
Clavis.AktenSpiel = (() => {
    const h = (t, a, ...c) => Clavis.el(t, a, ...c.flat(Infinity)), k = t => h('span', { class: 'na-eyebrow' }, t);
    function erstellen(root, { senden, ich, host = null }) {
        const el = h('section', { class: 'na-spiel', 'aria-label': 'Nachtakte – Die Frau am Black Alder Trail' }), main = h('div', { class: 'na-main' }), layer = h('div', { class: 'na-layer' }), effects = h('div', { class: 'na-effects', 'aria-hidden': 'true' });
        el.append(main, layer, effects);
        root.replaceChildren(el);
        const z = { raum: null, stand: null, priv: null, seq: -1, nr: 0, pending: new Map(), timers: new Set(), modal: null, film: null, shot: 0, ack: false, weg: false, sig: '', ort: 'einsatz', lampe: false, ton: false, ende: null, search: '', note: '', chat: '', dialog: null, frame: 0, selected: new Set(), theorie: '', motiv: '', begruendung: '', linkBeweis: '', linkTheorie: '', linkRelation: 'stuetzt', timelineBeweis: '', timelineZeit: '', timelineNotiz: '', assignmentPerson: '', assignmentOrt: '', assignmentText: '', boardTab: 'beweise', previous: null };
        const K = Clavis.klang, S = Clavis.stimme, sound = Clavis.AktenKlang();
        let prefs = { bewegung: !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches), schreck: true, laut: .5, musik: true, stimme: false };
        try {
            prefs = { ...prefs, ...JSON.parse(localStorage.getItem('clavis:akte:prefs') || '{}') };
        }
        catch (_) { }
        if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
            prefs.bewegung = false;
        const A = () => z.stand?.akte || { beweise: [], team: [], journal: [], offen: [], chat: [], jobs: [], spuren: [], verknuepfungen: [], auftraege: {}, bereit: {} }, R = () => z.raum;
        const later = (ms, f) => {
            const id = setTimeout(() => {
                z.timers.delete(id);
                if (!z.weg)
                    f();
            }, ms);
            z.timers.add(id);
            return id;
        };
        function cue(t) {
            if (z.ton && (!['schatten', 'atmen', 'donner', 'lachen'].includes(t) || prefs.schreck))
                sound.cue(t);
        }
        function fx(art, event) {
            if (z.weg)
                return;
            const r = event?.currentTarget?.getBoundingClientRect?.() || el.getBoundingClientRect();
            if (effects.children.length > 16)
                effects.children[0].remove();
            const n = h('i', { class: 'na-touch ' + art, style: { left: (event?.clientX || r.left + r.width / 2) + 'px', top: (event?.clientY || r.top + r.height / 2) + 'px' } });
            effects.append(n);
            later(prefs.bewegung ? 700 : 120, () => n.remove());
        }
        const btn = (text, f, cls = '', attrs = {}) => h('button', { type: 'button', class: 'na-btn ' + cls, onclick: e => { fx('click', e); cue('klick'); f?.(e); }, ...attrs }, text);
        function request(d) {
            const nr = ++z.nr;
            return new Promise(resolve => {
                const timer = later(15000, () => { z.pending.delete(nr); resolve({ richtig: false, info: 'Keine Antwort aus der Einsatzzentrale. Prüfe die Verbindung.' }); });
                z.pending.set(nr, { timer, resolve });
                Promise.resolve(senden({ ...d, nr })).catch(() => {
                    const p = z.pending.get(nr);
                    if (!p)
                        return;
                    clearTimeout(timer);
                    z.timers.delete(timer);
                    z.pending.delete(nr);
                    resolve({ richtig: false, info: 'Verbindung zur Einsatzzentrale unterbrochen.' });
                });
            });
        }
        async function run(d) {
            const r = await request(d);
            if (r.info)
                toast(r.info, r.richtig ? '' : 'bad');
            return r;
        }
        function toast(text, cls = '') {
            if (!text)
                return;
            const n = h('div', { class: 'na-toast ' + cls, role: 'status' }, text);
            el.append(n);
            later(6000, () => n.remove());
        }
        function audio() { z.ton = true; K.bereit(); K.musikStoppen?.(); K.ambienteStoppen?.(); sound.laut(prefs.laut); sound.musik(prefs.musik); sound.start(z.ort); }
        function savePrefs() {
            try {
                localStorage.setItem('clavis:akte:prefs', JSON.stringify(prefs));
            }
            catch (_) { }
            el.classList.toggle('na-ruhig', !prefs.bewegung);
            el.classList.toggle('na-ohne-schreck', !prefs.schreck);
        }
        function image(ort, cls = '', opt = {}) { const n = h('div', { class: 'na-picture ' + cls, 'aria-hidden': 'true' }); n.innerHTML = Clavis.AktenWelt.bild(ort, { minute: A().minute || 0, enttarnt: A().beweise.some(b => b.id === 'projektor'), ...opt }); return n; }
        function modal(titel, body, typ = 'dokument', wide = false) {
            const old = layer.querySelector('.na-panel'), same = z.modal === typ, scroll = same ? old?.scrollTop || 0 : 0, prev = document.activeElement, aria = same ? prev?.getAttribute?.('aria-label') : null, sel = same && prev?.tagName === 'INPUT' ? [prev.selectionStart, prev.selectionEnd] : null;
            z.modal = typ;
            if (!same)
                z.previous = prev;
            const panel = h('section', { class: 'na-panel' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titel, tabindex: -1 }, h('header', { class: 'na-panel-head' }, k('NACHTAKTE · FALL 01'), btn('×', close, 'icon', { 'aria-label': 'Dialog schließen' })), h('h2', {}, titel), body);
            layer.replaceChildren(h('div', { class: 'na-modal' }, panel));
            const focus = aria ? [...panel.querySelectorAll('button,input,select,textarea')].find(n => n.getAttribute('aria-label') === aria && !n.disabled) : null;
            (focus || panel).focus({ preventScroll: true });
            if (focus && sel && sel[0] !== null && focus.setSelectionRange)
                focus.setSelectionRange(...sel);
            panel.scrollTop = scroll;
            return panel;
        }
        function close() {
            if (z.film) {
                if (z.modal === 'invite' || z.modal === 'settings') {
                    z.modal = null;
                    if (z.ack)
                        filmWait();
                    else
                        drawFilm();
                }
                return;
            }
            layer.replaceChildren();
            z.modal = null;
            if (z.previous?.isConnected)
                z.previous.focus({ preventScroll: true });
        }
        function lobby() {
            if (!R())
                return main.replaceChildren(h('p', { class: 'na-loading' }, 'Die Vermisstenakte trifft ein …'));
            const all = z.stand?.spieler || [], ready = all.filter(p => A().bereit[p.id]).length, own = !!A().bereit[ich.id];
            main.replaceChildren(h('div', { class: 'na-lobby' }, image('park', 'na-lobby-art'), h('div', { class: 'na-lobby-shade' }), h('div', { class: 'na-lobby-copy' }, k('CLAVIS · NACHTAKTE · FALL 01'), h('h1', {}, 'Eine Frau.', h('em', {}, 'Ein Wald.'), 'Keine Gewissheit.'), h('p', { class: 'na-lead' }, 'Mara Vale ist nach einem Spaziergang nahe Los Angeles verschwunden. Ein Schal hängt im Wald. Eine Stimme warnt vor etwas zwischen den Bäumen. Ihr entscheidet, welcher Beobachtung ihr vertraut — und wie ihr sie überprüft.'), h('div', { class: 'na-specs' }, h('span', {}, 'Allein oder mit 2–8 Personen'), h('span', {}, 'Freie Ermittlungsreihenfolge'), h('span', {}, 'Ab 14 · düster und unblutig')), h('p', { class: 'na-muted' }, 'Keine Zahlenschlösser. Keine vorgegebene Lösungskette. Jeder eigene Schritt verändert eure Akte und die verfügbare Lage. Rollen helfen bei der Absprache; jede Person kann jede Maßnahme verfolgen.'), h('div', { class: 'na-button-row' }, btn(own ? 'Bereit · ' + ich.name : 'Ich übernehme den Fall', async () => { audio(); await run({ typ: 'akte_bereit', wert: !own }); }, own ? 'selected' : 'primary'), host ? btn(A().fortsetzung ? 'Ermittlung fortsetzen →' : 'Die Ermittlung beginnen →', () => { audio(); host.starten(); }, 'primary', { disabled: !all.length || all.length > 8 || ready !== all.length }) : null, host?.einladung ? btn('Team einladen', invite, 'ghost') : null, btn('Klang & Darstellung', settings, 'ghost')), h('div', { class: 'na-lobby-team' }, k(ready + '/' + all.length + ' PERSONEN BEREIT'), all.map(p => h('span', { class: A().bereit[p.id] ? 'ready' : '' }, A().bereit[p.id] ? '● ' : '○ ', p.name))), h('small', {}, 'Recherche verwendet ein fiktives Fallnetz. Die dargestellten Personen, Firmen und der Black Alder Trail sind erfunden.'))));
        }
        function header() { return h('header', { class: 'na-header' }, h('div', { class: 'na-wordmark' }, k('CLAVIS'), h('b', {}, 'NACHTAKTE')), h('div', { class: 'na-case-name' }, k('FALL 01 · LOS ANGELES'), h('span', {}, R().titel)), h('div', { class: 'na-case-time' }, k('FALLZEIT'), h('b', { 'data-case-time': 'true' }, A().zeit)), btn('⌖', karte, 'icon', { 'aria-label': 'Einsatzkarte öffnen' }), btn('▤', () => board('beweise'), 'icon', { 'aria-label': 'Fallakte öffnen' }), btn('≋', chat, 'icon', { 'aria-label': 'Teamfunk öffnen' }), btn('♫', settings, 'icon', { 'aria-label': 'Klang und Darstellung' }), host ? btn('Ⅱ', () => run({ typ: 'akte_pause' }), 'icon', { 'aria-label': 'Ermittlung pausieren' }) : null, host ? btn('×', () => host.beenden(), 'icon', { 'aria-label': 'Ermittlung verlassen' }) : null); }
        function world() {
            const p = R().orte[z.ort], actions = z.priv?.aktionen || [], hot = actions.filter(a => a.x !== undefined && !a.fertig && !a.laeuft), n = h('div', { class: 'na-stage', 'data-ort': z.ort }, image(z.ort, 'na-stage-picture'), h('div', { class: 'na-stage-title' }, k(p.sub), h('h2', {}, p.name)), h('div', { class: 'na-viewfinder tl' }), h('div', { class: 'na-viewfinder tr' }), h('div', { class: 'na-viewfinder bl' }), h('div', { class: 'na-viewfinder br' }), h('div', { class: 'na-hotspots' }, hot.map(a => btn('', () => massnahme(a), 'na-hotspot', { 'aria-label': a.titel, style: { left: a.x + '%', top: a.y + '%' } }).appendChild(h('span', {}, h('b', {}, '+'), h('span', {}, a.titel))).parentNode)), h('div', { class: 'na-stage-footer' }, h('span', { class: 'na-live' }, '● ' + ich.name.toUpperCase() + ' · EIGENER STANDORT'), btn('Lampe', e => { z.lampe = !z.lampe; el.classList.toggle('na-lampe', z.lampe); e.currentTarget.setAttribute('aria-pressed', String(z.lampe)); cue('klick'); }, 'ghost', { 'aria-label': 'Taschenlampe umschalten', 'aria-pressed': String(!!z.lampe) }), btn('Spuren hervorheben', () => el.classList.toggle('na-labels'), 'ghost')));
            n.addEventListener('pointermove', e => {
                const r = n.getBoundingClientRect();
                n.style.setProperty('--na-light-x', Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)) + '%');
                n.style.setProperty('--na-light-y', Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) + '%');
                if (!prefs.bewegung)
                    return;
                n.style.setProperty('--na-x', ((e.clientX - r.left) / r.width - .5) * -9 + 'px');
                n.style.setProperty('--na-y', ((e.clientY - r.top) / r.height - .5) * -6 + 'px');
            });
            return n;
        }
        function render(force = false) {
            if (!R() || !z.stand)
                return;
            savePrefs();
            if (z.stand.phase === 'lobby') {
                lobby();
                return;
            }
            if (z.ende)
                return;
            const a = A(), own = a.auftraege[ich.id];
            const sig = JSON.stringify([a.team, a.beweise.map(b => b.id), a.offen, a.profil, a.spuren, a.zeitlinie, a.jobs, a.abstimmung, a.pause, a.entscheidungen, a.journal.length, z.priv?.aktionen, z.priv?.zeugen, z.ort]);
            if (force || sig !== z.sig) {
                z.sig = sig;
                const aside = h('aside', { class: 'na-command' }, k('DU ENTSCHEIDEST DEN NÄCHSTEN SCHRITT'), h('h3', {}, 'Was übersehen wir?'), h('p', { class: 'na-role' }, z.priv?.rolle || 'Ermittlungsteam'), own ? h('div', { class: 'na-assigned' }, k('TEAMABSPRACHE'), h('b', {}, R().orte[own.ort].name), h('p', {}, own.text), btn('Zum vereinbarten Ort', () => move(own.ort), 'ghost')) : null, h('div', { class: 'na-tool-grid' }, btn('Recherche', recherche, 'tool', { 'aria-label': 'Fallnetz recherchieren' }), btn('Zeugen', zeugen, 'tool'), btn('Kameras', kameras, 'tool'), btn('Spuren & Maßnahmen', massnahmen, 'tool'), btn('Spurenlabor', labor, 'tool'), btn('Fallprofil', profil, 'tool'), btn('Öffentlichkeit', presse, 'tool'), btn('Einsatzkarte', karte, 'tool')), a.profil ? h('div', { class: 'na-current-theory' }, k('EURE ARBEITSHYPOTHESE'), h('b', {}, R().theorien[a.profil.theorie].titel), h('p', {}, a.profil.notiz || 'Eine Annahme, die ihr mit unabhängigen Quellen prüfen müsst.'), btn('Fährten überprüfen', () => board('spuren'), 'ghost')) : h('p', { class: 'na-muted' }, 'Noch keine gemeinsame Hypothese. Sichert erste Quellen und formuliert euer eigenes Fallprofil.'), h('div', { class: 'na-team-locations' }, k('IM EINSATZ'), a.team.map(p => h('div', {}, h('i', {}), h('span', {}, h('b', {}, p.name), h('small', {}, R().orte[p.ort].name))))), a.abstimmung ? btn('Teamentscheidung · ' + a.abstimmung.titel, abstimmung, 'na-decision-banner') : null, btn('Fallabschluss vorbereiten', abschluss, 'ghost'));
                const recent = a.journal.filter(j => ['welt', 'lage', 'labor'].includes(j.art)).at(-1);
                main.replaceChildren(header(), h('div', { class: 'na-layout' }, world(), aside), h('nav', { class: 'na-action-dock' }, h('div', {}, k('DEINE PERSPEKTIVE'), h('b', {}, R().orte[z.ort].name)), btn('Vor Ort untersuchen →', massnahmen, 'primary'), btn('Fallakte · ' + a.beweise.length + ' Quellen', () => board('beweise'), 'ghost'), btn('Eigene Notizen', notizen, 'ghost'), host ? btn('Stand sichern', async () => { await host.sichern?.(); toast('Der Ermittlungsstand ist gesichert.'); }, 'ghost') : null), h('footer', { class: 'na-status' }, h('span', {}, a.wetter), h('span', { class: 'na-ticker' }, recent ? recent.titel + ': ' + recent.text : 'Die nächste Entscheidung liegt bei euch.'), h('span', {}, a.jobs.filter(j => !j.fertig).length + ' PRÜFUNGEN OFFEN')));
            }
            for (const n of main.querySelectorAll('[data-case-time="true"]'))
                n.textContent = a.zeit;
            if (a.scene) {
                if (z.film?.id !== a.scene.id)
                    film(a.scene);
                else if (z.ack)
                    filmWait();
                return;
            }
            if (z.film && !z.film.outro && !z.film.replay) {
                z.film = null;
                z.ack = false;
                S.stopp();
                sound.ducken(false);
                z.modal = null;
                layer.replaceChildren();
                sound.ort(z.ort);
            }
            if (a.pause) {
                if (z.modal !== 'pause' && z.modal !== 'settings' && z.modal !== 'invite')
                    modal('Ermittlung angehalten', h('div', {}, h('p', { class: 'na-lead' }, 'Die Spielleitung hat eine Teampause eingelegt. Die Fallzeit und alle Maßnahmen halten an.'), host ? btn('Ermittlung fortsetzen', () => run({ typ: 'akte_pause' }), 'primary') : null), 'pause');
                return;
            }
            if (z.modal === 'pause')
                close();
            if (z.modal === 'labor')
                labor();
            else if (z.modal === 'massnahmen')
                massnahmen();
            else if (z.modal === 'karte')
                karte();
            else if (z.modal === 'beweise' || z.modal === 'spuren' || z.modal === 'journal' || z.modal === 'zeitlinie')
                board(z.modal);
            else if (z.modal === 'abstimmung') {
                if (a.abstimmung)
                    abstimmung();
                else
                    close();
            }
        }
        async function move(ort) {
            close();
            const r = await run({ typ: 'akte_ort', ort });
            if (r.richtig)
                cue('fahrt');
        }
        function karte() { modal('Wohin ermittelt ihr als Nächstes?', h('div', {}, h('p', { class: 'na-muted' }, 'Jede Person bewegt sich unabhängig. Eine neue Adresse kann aus ganz unterschiedlichen Quellen entstehen. Bereits bekannte Orte bleiben frei erreichbar.'), h('div', { class: 'na-map' }, h('div', { class: 'na-map-terrain' }), Object.entries(R().orte).map(([id, p]) => btn('', () => move(id), 'na-map-node ' + (id === z.ort ? 'current' : ''), { disabled: !A().offen.includes(id), style: { left: p.x + '%', top: p.y + '%' }, 'aria-label': p.name }).appendChild(h('span', {}, h('b', {}, A().offen.includes(id) ? '◈' : '·'), h('span', {}, p.name), h('small', {}, A().team.filter(x => x.ort === id).map(x => x.name).join(' · ')))).parentNode)), h('div', { class: 'na-map-list' }, Object.entries(R().orte).filter(([id]) => A().offen.includes(id)).map(([id, p]) => btn(p.name, () => move(id), 'ghost', { disabled: id === z.ort })))), 'karte', true); }
        function massnahme(a) { modal(a.titel, h('div', {}, k(R().orte[z.ort].name), h('p', { class: 'na-lead' }, a.text), h('p', { class: 'na-muted' }, 'Fallzeit: etwa ' + a.dauer + ' Minuten. ' + (a.typ === 'analyse' ? 'Die Rückmeldung kommt zeitversetzt. Ihr könnt parallel an anderen Spuren arbeiten.' : 'Fund und Quelle werden im Team dokumentiert.')), btn(a.typ === 'analyse' ? 'Prüfung beauftragen' : 'Maßnahme durchführen', async () => { close(); await run({ typ: 'akte_aktion', id: a.id }); }, 'primary')), 'massnahme'); }
        function labor() { const rows = z.priv?.labor || []; modal('Spurenlabor · Rückfragen per Funk', h('div', {}, h('p', { class: 'na-lead' }, 'Welche eurer gesicherten Quellen soll unabhängig nachgeprüft werden? Ihr könnt von jedem Standort aus einen Auftrag geben und währenddessen weiter ermitteln.'), h('div', { class: 'na-measure-list' }, rows.map(a => btn('', () => massnahme(a), 'na-measure', { 'aria-label': a.titel, disabled: a.fertig || a.laeuft }).appendChild(h('span', {}, k(a.laeuft ? 'PRÜFUNG LÄUFT' : a.fertig ? 'ERGEBNIS IN DER AKTE' : 'UNABHÄNGIGE PRÜFUNG'), h('b', {}, a.titel), h('p', {}, a.text))).parentNode)), !rows.length ? h('p', { class: 'na-muted' }, 'Noch kein untersuchbares Original gesichert. Ein Stofffund, ein Spurenguss, eine Originalaufnahme oder Geschäftsunterlagen können neue Prüfungen ermöglichen.') : null, A().jobs.some(j => !j.fertig) ? btn('Auf eine Rückmeldung warten', () => run({ typ: 'akte_warten' }), 'ghost') : null), 'labor', true); }
        function massnahmen() { const rows = z.priv?.aktionen || [], open = rows.filter(a => !a.fertig && !a.laeuft); modal('Vor Ort: ' + R().orte[z.ort].name, h('div', {}, h('p', { class: 'na-lead' }, 'Welche Information möchtet ihr hier als Nächstes erhalten?'), h('div', { class: 'na-measure-list' }, open.map(a => btn('', () => massnahme(a), 'na-measure', { 'aria-label': a.titel }).appendChild(h('span', {}, k(a.typ === 'analyse' ? 'SPURENLABOR' : 'VOR ORT'), h('b', {}, a.titel), h('p', {}, a.text), h('small', {}, '~ ' + a.dauer + ' MIN. FALLZEIT'))).parentNode)), !open.length ? h('p', { class: 'na-muted' }, 'Die bisher verfügbaren Maßnahmen liefern hier keine neue Quelle. Befragt jemanden, sichtet Kameras, recherchiert weiter oder wechselt den Ort. Neue Erkenntnisse können zusätzliche Möglichkeiten eröffnen.') : null, h('div', { class: 'na-button-row' }, btn('Zeugen befragen', zeugen, 'ghost'), btn('Kameras sichten', kameras, 'ghost'), btn('Fallnetz recherchieren', recherche, 'ghost'), btn('Anderen Ort wählen', karte, 'ghost')), z.priv?.kontakt ? h('div', { class: 'na-contact-panel' }, k('PERSÖNLICHER KONTAKT'), h('p', {}, z.priv.kontakt.text), z.priv.kontakt.moeglich ? btn('Kontaktstrategie wählen', kontakt, 'primary') : null) : null, rows.some(a => a.laeuft) ? h('p', { class: 'na-muted' }, 'Eine angeforderte Prüfung läuft bereits.') : null), 'massnahmen', true); }
        function zeugen() { const ws = z.priv?.zeugen || []; modal('Menschen, die etwas gesehen haben', h('div', {}, h('p', { class: 'na-muted' }, 'Eine Aussage ist eine Quelle, kein automatischer Tatnachweis. Nachfragen, belegte Konfrontation und unbelegte Anschuldigung verändern das Gespräch.'), ws.length ? ws.map(w => h('article', { class: 'na-witness' }, h('div', { class: 'na-witness-avatar' }, w.name.split(' ').map(s => s[0]).join('')), h('div', {}, k(w.rolle + (w.funk ? ' · ÜBER FUNK' : '')), h('h3', {}, w.name), h('blockquote', {}, w.ton), w.gesperrt ? h('p', { class: 'na-muted' }, 'Die Person beantwortet derzeit keine weiteren Fragen. Unabhängige Unterlagen und andere Quellen bleiben möglich.') : h('div', { class: 'na-question-list' }, w.fragen.map(q => btn((q.fertig ? '✓ ' : '') + q.titel, async () => { await run({ typ: 'akte_frage', zeuge: w.id, frage: q.id }); }, 'ghost', { disabled: q.fertig })))))) : h('div', {}, h('p', { class: 'na-lead' }, 'Hier ist gerade keine befragbare Person. Wo könntet ihr jemanden erreichen?'), btn('Einsatzkarte öffnen', karte, 'primary'))), 'zeugen', true); }
        function gespraech(d) { z.dialog = d; cue('radio'); modal(d.zeuge, h('div', { class: 'na-dialogue' }, k('PROTOKOLLIERTE AUSSAGE'), h('blockquote', {}, d.text), h('p', { class: 'na-muted' }, 'Die Aussage steht mit ihrer Quelle in eurer Fallakte. Welche andere Information könnte sie bestätigen oder widerlegen?'), h('div', { class: 'na-button-row' }, btn('Weiter nachfragen', zeugen, 'primary'), btn('Fallakte ansehen', () => board('beweise'), 'ghost'), btn('Nächste Maßnahme wählen', massnahmen, 'ghost'))), 'gespraech'); }
        function recherche() {
            const results = z.priv?.recherche?.ergebnisse || [];
            const input = h('input', { class: 'na-input', value: z.search, placeholder: 'Name, Ort oder Begriff aus eurer Akte …', 'aria-label': 'Suchbegriff im Fallnetz', maxlength: 120, oninput: e => { z.search = e.target.value; fx('schrift', e); } });
            const submit = async () => {
                const r = await run({ typ: 'akte_recherche', suche: z.search });
                if (r.richtig)
                    recherche();
            };
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                }
            });
            modal('Fallnetz · Recherche', h('div', {}, h('p', { class: 'na-muted' }, 'Fiktive Netzquellen innerhalb dieses Falls. Keine echte Websuche. Ihr wählt selbst die Suchbegriffe und entscheidet, ob eine Quelle eure Fährte tatsächlich trägt.'), h('div', { class: 'na-searchbar' }, input, btn('Recherchieren', submit, 'primary')), z.priv?.recherche ? h('p', { class: 'na-search-result-count' }, results.length + ' Quellen zu „' + z.priv.recherche.suchtext + '“') : null, h('div', { class: 'na-web-results' }, results.map(r => h('article', {}, k(r.domain), btn(r.titel, () => run({ typ: 'akte_seite', id: r.id }), 'na-web-title'), h('p', {}, r.snippet)))), !results.length && z.priv?.recherche ? h('p', { class: 'na-muted' }, 'Die bisherigen Suchwörter liefern keine unabhängige Quelle. Nutzt einen konkreten Namen, Ort oder Gegenstand aus eurer Akte.') : null, h('div', { class: 'na-research-tips' }, k('MÖGLICHE ANSÄTZE, KEINE VORGEGEBENE REIHENFOLGE'), h('p', {}, 'Die Person und ihre Arbeit · Herkunft eines Clips · alte Originalberichte · ein Name auf einem Beleg · ein technischer Gegenstand'))), 'recherche', true);
        }
        function kameras() {
            const cs = z.priv?.kameras || [];
            modal('Überwachungskameras', h('div', {}, h('p', { class: 'na-lead' }, 'Aufnahmen sichten, Zeitbasis prüfen, relevante Beobachtungen selbst sichern.'), cs.length ? cs.map(c => h('article', { class: 'na-camera-card' }, h('div', { class: 'na-camera-icon' }, '◉'), h('div', {}, k('ORIGINALQUELLE'), h('h3', {}, c.titel), h('p', {}, c.verfuegbar ? 'Die Aufnahmen können an diesem Standort gesichtet werden.' : 'Das laufende Gerät hat Randmaterial überschrieben. Eine Sicherung lässt sich an der Rangerstation anfordern.'), btn(c.verfuegbar ? 'Aufnahme sichten' : 'Sicherung an anderem Ort suchen', async () => {
                if (!c.verfuegbar)
                    return karte();
                z.frame = 0;
                const r = await run({ typ: 'akte_video', id: c.id });
                if (r.richtig)
                    video();
            }, 'primary')))) : h('div', {}, h('p', {}, 'An deinem Standort steht keine freigegebene Kamera zur Verfügung. Parkplatz und Tankstelle besitzen überprüfbare Originalquellen.'), btn('Standort wechseln', karte, 'primary'))), 'kameras');
        }
        function video() {
            const v = z.priv?.video;
            if (!v)
                return kameras();
            z.frame = Math.max(0, Math.min(v.frames.length - 1, z.frame));
            const f = v.frames[z.frame];
            modal(v.titel, h('div', {}, h('div', { class: 'na-video-screen' }, image(f.ort), h('div', { class: 'na-video-lines' }), h('div', { class: 'na-video-hud' }, h('span', {}, '● ORIGINAL · ' + v.id.toUpperCase()), h('b', {}, f.zeit)), h('div', { class: 'na-video-target' })), h('div', { class: 'na-video-timeline' }, btn('←', () => { z.frame = Math.max(0, z.frame - 1); video(); }, 'ghost', { 'aria-label': 'Vorheriger Kameraausschnitt' }), h('input', { type: 'range', min: 0, max: v.frames.length - 1, step: 1, value: z.frame, 'aria-label': 'Kamera-Zeitleiste', oninput: e => { z.frame = Number(e.target.value); fx('schrift', e); video(); } }), btn('→', () => { z.frame = Math.min(v.frames.length - 1, z.frame + 1); video(); }, 'ghost', { 'aria-label': 'Nächster Kameraausschnitt' })), h('div', { class: 'na-frame-labels' }, v.frames.map((f, i) => btn(f.zeit, () => { z.frame = i; video(); }, i === z.frame ? 'selected' : 'ghost'))), k(v.offset), h('p', { class: 'na-lead' }, f.text), h('p', { class: 'na-muted' }, 'Das Umsehen ist frei. Erst das Sichern dokumentiert eure Beobachtung in der gemeinsamen Akte. Ein undeutliches Bild erlaubt keine eindeutige Identifizierung.'), btn('Diesen Ausschnitt sichern', () => run({ typ: 'akte_frame', id: v.id, index: z.frame }), 'primary')), 'video', true);
        }
        function belegeAuswahl() {
            return h('div', { class: 'na-proof-pick' }, A().beweise.map(b => h('label', { class: z.selected.has(b.id) ? 'selected' : '' }, h('input', { type: 'checkbox', checked: z.selected.has(b.id), 'aria-label': 'Beleg auswählen: ' + b.titel, onchange: e => {
                    if (e.target.checked)
                        z.selected.add(b.id);
                    else
                        z.selected.delete(b.id);
                    fx('schrift', e);
                } }), h('span', {}, h('b', {}, b.titel), h('small', {}, b.art + ' · ' + b.quelle)))));
        }
        function theorieSelect(label = 'Eure Annahme') { return h('label', {}, k(label), h('select', { class: 'na-input', value: z.theorie, 'aria-label': label, onchange: e => { z.theorie = e.target.value; fx('schrift', e); } }, h('option', { value: '', selected: !z.theorie }, 'Eine Annahme wählen …'), Object.entries(R().theorien).map(([id, t]) => h('option', { value: id, selected: z.theorie === id }, t.titel)))); }
        function profil() {
            modal('Euer Fallprofil', h('div', {}, h('p', { class: 'na-lead' }, 'Was glaubt ihr, ist geschehen — und welche Quellen tragen diese Annahme?'), theorieSelect(), h('label', {}, k('EURE BEGRÜNDUNG / OFFENE FRAGEN'), h('textarea', { class: 'na-input', rows: 3, value: z.begruendung, 'aria-label': 'Begründung der Arbeitshypothese', oninput: e => { z.begruendung = e.target.value; fx('schrift', e); } })), k('QUELLEN FÜR DIESE ANNAHME · MINDESTENS EINE'), belegeAuswahl(), h('p', { class: 'na-muted' }, 'Eine These wird durch ihre Auswahl nicht wahr. Das Team entscheidet gemeinsam. Widersprüche zeigen sich durch weitere Maßnahmen.'), btn('Als Arbeitshypothese vorschlagen', async () => {
                const r = await run({ typ: 'akte_profil', theorie: z.theorie, notiz: z.begruendung, belege: [...z.selected] });
                if (r.richtig) {
                    if (A().abstimmung)
                        abstimmung();
                    else
                        board('spuren');
                }
            }, 'primary')), 'profil', true);
        }
        function board(tab = 'beweise') {
            z.boardTab = tab;
            const tabs = h('div', { class: 'na-tabs' }, btn('Belege', () => board('beweise'), tab === 'beweise' ? 'selected' : 'ghost'), btn('Fährten', () => board('spuren'), tab === 'spuren' ? 'selected' : 'ghost'), btn('Zeitlinie', () => board('zeitlinie'), tab === 'zeitlinie' ? 'selected' : 'ghost'), btn('Maßnahmen & Szenen', () => board('journal'), tab === 'journal' ? 'selected' : 'ghost'));
            let body;
            if (tab === 'beweise')
                body = h('div', {}, h('p', { class: 'na-muted' }, 'Originalbefund, Aussage und Interpretation bleiben unterscheidbar. Öffnet einen Beleg für Herkunft, Sicherung und vollständigen Inhalt.'), h('div', { class: 'na-evidence-grid' }, [...A().beweise].reverse().map(b => btn('', () => dokument(b), 'na-evidence-card').appendChild(h('span', {}, k(b.art), h('b', {}, b.titel), h('p', {}, b.text.slice(0, 145) + '…'), h('small', {}, b.quelle + ' · ' + b.zeit))).parentNode)), verknuepfung());
            else if (tab === 'spuren')
                body = h('div', {}, h('p', { class: 'na-lead' }, 'Eure Fährten sind überprüfbare Annahmen. Eine Sackgasse bleibt sichtbar, damit ihr nicht unbemerkt dieselbe Prüfung wiederholt.'), A().spuren.length ? A().spuren.map(s => h('article', { class: 'na-trail-card ' + s.status }, k(({ offen: 'OFFEN', erschoepft: 'KEIN WEITERER ANSCHLUSS', widerspruch: 'WIDERSPRUCH', anschluss: 'UNABHÄNGIGER ANSCHLUSS' })[s.status]), h('h3', {}, s.titel), h('p', {}, s.befund), h('div', { class: 'na-source-chips' }, s.belege.map(id => { const b = A().beweise.find(x => x.id === id); return b ? btn(b.titel, () => dokument(b), 'ghost') : null; })), h('small', {}, s.geprueft.length + ' zugehörige Quellen unabhängig nachgeprüft'))) : h('p', { class: 'na-muted' }, 'Noch kein Fallprofil angelegt. Beginnt mit euren ersten Quellen.'), btn('Hypothese neu formulieren', profil, 'primary'), h('div', { class: 'na-link-list' }, k('EURE BELEGVERKNÜPFUNGEN'), A().verknuepfungen.map(l => h('p', {}, A().beweise.find(b => b.id === l.beweis)?.titel + ' → ' + l.relation + ' → ' + R().theorien[l.theorie].titel))));
            else if (tab === 'zeitlinie')
                body = zeitlinie();
            else
                body = h('div', { class: 'na-journal' }, [...A().journal].reverse().map(j => h('article', {}, k(j.zeit + ' · ' + j.art), h('h3', {}, j.titel), h('p', {}, j.text), j.art === 'szene' ? btn('Szene nachlesen', () => film({ id: 'lese-' + j.id, titel: j.titel, zeilen: [{ titel: j.titel, text: j.text, ort: z.ort, effekt: 'papier' }] }, false, true), 'ghost') : null)), A().jobs.some(j => !j.fertig) ? h('div', {}, k('AUSSTEHENDE RÜCKMELDUNGEN'), A().jobs.filter(j => !j.fertig).map(j => h('p', {}, j.titel + ' · ungefähr ' + Math.max(0, Math.ceil(j.bis - A().minute)) + ' Minuten Fallzeit')), btn('Auf Rückmeldung warten', () => run({ typ: 'akte_warten' }), 'ghost')) : null);
            modal('Die Fallakte', h('div', {}, tabs, body), tab, true);
        }
        function zeitlinie() {
            return h('div', {}, h('p', { class: 'na-lead' }, 'Welche Reihenfolge ergibt sich aus euren Quellen? Tragt eure eigene zeitliche Einordnung ein. Gerätezeit, Zustellzeit und Aufnahmezeit sind verschiedene Angaben.'), h('div', { class: 'na-timeline' }, (A().zeitlinie || []).map(x => h('article', {}, h('time', {}, x.zeit), h('div', {}, h('h3', {}, A().beweise.find(b => b.id === x.beweis)?.titel), h('p', {}, x.notiz || 'Zeitlich eingeordnet durch ' + x.von), x.beweis === 'park_cam' && A().beweise.some(b => b.id === 'uhr') && x.zeit === '17:19' ? h('p', { class: 'na-timeline-warning' }, 'Das Wartungsbuch nennt sieben Minuten Vorlauf dieser Kamera. Eure Einordnung enthält offenbar noch Gerätezeit.') : k('EURE EINORDNUNG · KEINE AUTOMATISCHE TATSACHE'))))), h('section', { class: 'na-connect' }, k('ZEITPUNKT FESTHALTEN'), h('select', { class: 'na-input', 'aria-label': 'Quelle für Zeitlinie', value: z.timelineBeweis, onchange: e => z.timelineBeweis = e.target.value }, h('option', { value: '' }, 'Quelle wählen …'), A().beweise.map(b => h('option', { value: b.id, selected: z.timelineBeweis === b.id }, b.titel))), h('input', { class: 'na-input', type: 'text', value: z.timelineZeit, placeholder: 'HH:MM', 'aria-label': 'Zeitpunkt in der Fallchronologie', oninput: e => z.timelineZeit = e.target.value }), h('input', { class: 'na-input', value: z.timelineNotiz, placeholder: 'Was ist geschehen? Welche Zeitbasis verwendet ihr?', 'aria-label': 'Einordnung in der Zeitlinie', oninput: e => z.timelineNotiz = e.target.value }), btn('Zeitpunkt dokumentieren', async () => {
                const r = await run({ typ: 'akte_zeitpunkt', beweis: z.timelineBeweis, zeit: z.timelineZeit, notiz: z.timelineNotiz });
                if (r.richtig)
                    board('zeitlinie');
            }, 'primary')));
        }
        function dokument(b) { modal(b.titel, h('div', { class: 'na-document' }, k(b.art || 'QUELLE'), h('p', { class: 'na-document-source' }, b.quelle), h('p', { class: 'na-document-text' }, b.text), b.gesichertVon ? h('small', {}, 'Gesichert von ' + b.gesichertVon + ' · ' + b.zeit) : null, h('div', { class: 'na-button-row' }, btn('Zur Fallakte', () => board('beweise'), 'ghost'), btn('In Hypothese aufnehmen', () => { z.selected.add(b.id); profil(); }, 'primary'))), 'dokument'); }
        function verknuepfung() { return h('section', { class: 'na-connect' }, k('BEFUND UND INTERPRETATION VERKNÜPFEN'), h('div', { class: 'na-connect-fields' }, h('select', { class: 'na-input', value: z.linkBeweis, 'aria-label': 'Beleg für Verknüpfung', onchange: e => z.linkBeweis = e.target.value }, h('option', { value: '' }, 'Beleg wählen …'), A().beweise.map(b => h('option', { value: b.id, selected: z.linkBeweis === b.id }, b.titel))), h('select', { class: 'na-input', value: z.linkRelation, 'aria-label': 'Einordnung des Belegs', onchange: e => z.linkRelation = e.target.value }, [['stuetzt', 'stützt'], ['widerspricht', 'widerspricht'], ['offen', 'bleibt offen zu']].map(([id, t]) => h('option', { value: id, selected: z.linkRelation === id }, t))), h('select', { class: 'na-input', value: z.linkTheorie, 'aria-label': 'These für Verknüpfung', onchange: e => z.linkTheorie = e.target.value }, h('option', { value: '' }, 'These wählen …'), Object.entries(R().theorien).map(([id, t]) => h('option', { value: id, selected: z.linkTheorie === id }, t.titel)))), btn('Verknüpfung in der Akte festhalten', () => run({ typ: 'akte_verknuepfen', beweis: z.linkBeweis, theorie: z.linkTheorie, relation: z.linkRelation }), 'ghost')); }
        function abstimmung() {
            const v = A().abstimmung;
            if (!v)
                return close();
            modal(v.titel, h('div', {}, k('VORSCHLAG VON ' + v.von), h('h3', {}, v.label), v.notiz ? h('p', { class: 'na-lead' }, v.notiz) : null, v.belege?.length ? h('div', { class: 'na-source-chips' }, v.belege.map(id => h('span', {}, A().beweise.find(b => b.id === id)?.titel))) : null, h('p', { class: 'na-muted' }, 'Alle verbundenen Personen geben eine Stimme ab. Eine Mehrheit beschließt den Vorschlag. Ihr könnt bis zum Abschluss eure Stimme ändern. Währenddessen können andere weiter ermitteln.'), h('div', { class: 'na-voters' }, A().team.map(p => h('span', { class: Object.hasOwn(v.stimmen, p.id) ? 'ready' : '' }, p.name + ' · ' + (Object.hasOwn(v.stimmen, p.id) ? (v.stimmen[p.id] ? 'Zustimmung' : 'Ablehnung') : 'noch offen')))), h('div', { class: 'na-button-row' }, btn('Zustimmen', () => run({ typ: 'akte_stimme', id: v.id, ja: true }), 'primary'), btn('Ablehnen / weiter ermitteln', () => run({ typ: 'akte_stimme', id: v.id, ja: false }), 'ghost'), btn('Währenddessen weiterarbeiten', close, 'ghost'))), 'abstimmung');
        }
        function presse() {
            modal('Welche Öffentlichkeit wollt ihr?', h('div', {}, h('p', { class: 'na-lead' }, 'Eine Meldung kann neue Quellen erreichen. Sie kann aber auch Zeugen beeinflussen und eine beobachtete Person warnen.'), [['diskret', 'Diskret weiterarbeiten', 'Keine neue öffentliche Deutung. Andere Maßnahmen bleiben offen.'], ['sachlich', 'Sachlichen Suchaufruf senden', 'Mara als vermisst melden und nach überprüfbaren Beobachtungen fragen.'], ['sensation', 'Die Waldgestalt zur Erklärung machen', 'Eine ungesicherte Geschichte bekommt Reichweite. Das verändert, wer euch noch unbefangen antwortet.']].map(([wert, titel, text]) => btn('', async () => {
                const r = await run({ typ: 'akte_entscheidung', key: 'presse', wert });
                if (r.richtig) {
                    if (A().abstimmung)
                        abstimmung();
                    else
                        close();
                }
            }, 'na-choice').appendChild(h('span', {}, h('b', {}, titel), h('p', {}, text))).parentNode)), 'presse');
        }
        function kontakt() {
            modal('Wie geht ihr auf die Person zu?', h('div', {}, h('p', { class: 'na-lead' }, 'Ein Name im Register ist noch keine persönliche Identitätsfeststellung. Sprecht das Vorgehen ab.'), [['ansprechen', 'Diskret ansprechen', 'Die Identität vor Ort feststellen, ohne den gesamten Ort zu alarmieren.'], ['beobachten', 'Zunächst beobachten', 'Die Person weiter beobachten. Die Lage und die Fallzeit bewegen sich weiter.'], ['zugriff', 'Offen auftreten', 'Den Kontakt für alle sichtbar sichern. Das kann Vertrauen kosten.']].map(([wert, titel, text]) => btn('', async () => {
                const r = await run({ typ: 'akte_entscheidung', key: 'kontakt', wert });
                if (r.richtig && A().abstimmung)
                    abstimmung();
            }, 'na-choice').appendChild(h('span', {}, h('b', {}, titel), h('p', {}, text))).parentNode)), 'kontakt');
        }
        function abschluss() {
            modal('Was könnt ihr am Ende belegen?', h('div', {}, h('p', { class: 'na-lead' }, 'Formuliert euren Schluss aus den gesicherten Quellen. Eine plausible Geschichte reicht nicht. Auch eine unbegründete Erklärung kann als falscher Abschluss in eurer Akte landen.'), theorieSelect('Was ist nach eurer Ermittlung geschehen?'), h('label', {}, k('WELCHES MOTIV BELEGT IHR?'), h('select', { class: 'na-input', value: z.motiv, 'aria-label': 'Motiv für den Fallabschluss', onchange: e => z.motiv = e.target.value }, h('option', { value: '', selected: !z.motiv }, 'Motiv wählen …'), [['geld', 'Finanzieller Druck / Projektgelder'], ['beziehung', 'Konflikt im persönlichen Umfeld'], ['aufmerksamkeit', 'Öffentliche Aufmerksamkeit'], ['unbekannt', 'Motiv nicht belegt']].map(([id, t]) => h('option', { value: id, selected: z.motiv === id }, t)))), k('MINDESTENS DREI EIGENE QUELLEN FÜR DEN ABSCHLUSS'), belegeAuswahl(), h('div', { class: 'na-button-row' }, btn('Fall mit dieser Begründung abschließen', async () => {
                const r = await run({ typ: 'akte_entscheidung', key: 'schluss', wert: z.theorie, motiv: z.motiv, belege: [...z.selected] });
                if (r.richtig && A().abstimmung)
                    abstimmung();
            }, 'primary'), btn('Weiter ermitteln', close, 'ghost'), btn('Fall offen übergeben', async () => {
                const r = await run({ typ: 'akte_entscheidung', key: 'offen' });
                if (r.richtig && A().abstimmung)
                    abstimmung();
            }, 'ghost'))), 'abschluss', true);
        }
        function notizen() { modal('Deine Arbeitsnotizen', h('div', {}, h('p', { class: 'na-muted' }, 'Diese Notiz gehört deiner Ansicht. Teile wichtige Beobachtungen im Teamfunk oder sichere die Originalquelle in der gemeinsamen Akte.'), h('textarea', { class: 'na-input', rows: 9, value: z.note, 'aria-label': 'Eigene Ermittlungsnotiz', maxlength: 1500, oninput: e => { z.note = e.target.value; fx('schrift', e); } }), btn('Notiz sichern', () => run({ typ: 'akte_notiz', text: z.note }), 'primary')), 'notizen'); }
        function chat() {
            const input = h('input', { class: 'na-input', value: z.chat, placeholder: 'Was soll das Team wissen?', 'aria-label': 'Teamfunk-Nachricht', maxlength: 350, oninput: e => { z.chat = e.target.value; fx('schrift', e); } });
            const send = async () => {
                const r = await run({ typ: 'akte_chat', text: z.chat });
                if (r.richtig) {
                    z.chat = '';
                    chat();
                }
            };
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    send();
                }
            });
            modal('Teamfunk & Aufgabenverteilung', h('div', {}, h('div', { class: 'na-chat-log' }, A().chat.map(m => h('p', {}, h('b', {}, m.name + ' · ' + m.zeit), h('span', {}, m.text)))), h('div', { class: 'na-searchbar' }, input, btn('Senden', send, 'primary')), h('section', { class: 'na-assign' }, k('PARALLEL ERMITTELN'), h('p', { class: 'na-muted' }, 'Verabredet ein Ziel. Jede Person kann ihren Standort selbst wählen; eine Absprache sperrt keine anderen Maßnahmen.'), h('select', { class: 'na-input', value: z.assignmentPerson, 'aria-label': 'Person für Ermittlungsauftrag', onchange: e => z.assignmentPerson = e.target.value }, h('option', { value: '' }, 'Person wählen …'), A().team.map(p => h('option', { value: p.id, selected: z.assignmentPerson === p.id }, p.name))), h('select', { class: 'na-input', value: z.assignmentOrt, 'aria-label': 'Ort für Ermittlungsauftrag', onchange: e => z.assignmentOrt = e.target.value }, h('option', { value: '' }, 'Ort wählen …'), A().offen.map(id => h('option', { value: id, selected: z.assignmentOrt === id }, R().orte[id].name))), h('input', { class: 'na-input', value: z.assignmentText, placeholder: 'Worauf achten?', 'aria-label': 'Ermittlungsauftrag beschreiben', oninput: e => z.assignmentText = e.target.value }), btn('Teamabsprache festhalten', () => run({ typ: 'akte_auftrag', person: z.assignmentPerson, ort: z.assignmentOrt, text: z.assignmentText }), 'ghost')), host?.einladung ? btn('Weitere Person einladen', invite, 'ghost') : null), 'chat', true);
        }
        function invite() {
            const n = host?.einladung?.();
            modal('Gemeinsam ermitteln', h('div', {}, h('p', { class: 'na-lead' }, 'Bis zu acht Personen können mit eigenen Perspektiven dieselbe Fallakte bearbeiten.'), n || h('p', {}, 'Verwende den bereits geteilten Einladungslink.'), btn('Zurück zur Ermittlung', () => {
                z.modal = null;
                layer.replaceChildren();
                if (z.film)
                    drawFilm();
            }, 'ghost')), 'invite', true);
        }
        function settings() {
            const voices = S.stimmen?.() || [];
            modal('Klang & Darstellung', h('div', { class: 'na-settings' }, h('p', { class: 'na-muted' }, 'Die Welt darf unheimlich sein. Alle Informationen bleiben auch ohne Ton und Bewegung zugänglich.'), btn(K.an() ? 'Geräusche ausschalten' : 'Geräusche einschalten', () => {
                K.schalten(!K.an());
                if (K.an())
                    audio();
                else {
                    sound.stop();
                    S.stopp();
                }
                settings();
            }, 'ghost'), h('label', {}, k('LAUTSTÄRKE'), h('input', { type: 'range', min: 0, max: 1, step: .05, value: prefs.laut, 'aria-label': 'Lautstärke', oninput: e => { prefs.laut = Number(e.target.value); sound.laut(prefs.laut); savePrefs(); } })), btn(prefs.musik ? 'Musik an' : 'Musik aus', () => { prefs.musik = !prefs.musik; sound.musik(prefs.musik); savePrefs(); settings(); }, 'ghost'), btn(prefs.bewegung ? 'Kamerabewegung und Animation an' : 'Reduzierte Bewegung', () => { prefs.bewegung = !prefs.bewegung; savePrefs(); settings(); }, 'ghost'), btn(prefs.schreck ? 'Überraschungsmomente an' : 'Überraschungsmomente aus', () => { prefs.schreck = !prefs.schreck; savePrefs(); settings(); }, 'ghost'), btn(prefs.stimme ? 'Vorlesen an' : 'Filmmodus · Text und Geräusche', () => { prefs.stimme = !prefs.stimme; S.schalten(prefs.stimme); savePrefs(); settings(); }, 'ghost'), voices.length ? h('label', {}, k('LOKALE DEUTSCHE STIMME'), h('select', { class: 'na-input', 'aria-label': 'Lokale Stimme', onchange: e => S.waehlen(e.target.value) }, voices.map(v => h('option', { value: v.id, selected: v.id === S.auswahl() }, v.name)))) : h('p', { class: 'na-muted' }, 'Keine passende lokale Stimme verfügbar. Der Filmmodus verwendet Text und Geräusche.'), z.stand?.phase === 'spiel' ? btn('Öffentlichkeitsstrategie', presse, 'ghost') : null), 'settings');
        }
        function film(scene, outro = false, replay = false) { z.film = { ...scene, outro, replay }; z.shot = 0; z.ack = false; z.modal = null; drawFilm(); }
        function drawFilm() {
            if (!z.film)
                return;
            const f = z.film, shot = f.zeilen[z.shot];
            sound.ducken(true);
            cue(shot.effekt || 'papier');
            S.stopp();
            const art = image(shot.ort, 'na-film-art');
            art.style.setProperty('--na-shot-scale', String(1.06 + z.shot * .017));
            const n = h('section', { class: 'na-film', role: 'dialog', 'aria-modal': 'true', 'aria-label': f.titel, tabindex: -1 }, art, h('div', { class: 'na-film-shade' }), h('header', { class: 'na-film-header' }, k('CLAVIS · NACHTAKTE'), h('span', {}, f.titel)), h('div', { class: 'na-film-copy' }, h('div', { class: 'na-film-progress' }, f.zeilen.map((_, i) => h('i', { class: i <= z.shot ? 'seen' : '' }))), k(shot.titel), h('p', { class: 'na-film-caption' }, shot.text), h('div', { class: 'na-film-actions' }, h('small', {}, f.replay ? 'Nachlesen · die Ermittlung läuft weiter' : 'Die gemeinsame Fallzeit ist angehalten.'), btn('←', () => { z.shot = Math.max(0, z.shot - 1); drawFilm(); }, 'ghost', { 'aria-label': 'Vorherige Einstellung', disabled: z.shot === 0 }), btn('Szene überspringen', ackFilm, 'ghost'), btn(z.shot === f.zeilen.length - 1 ? 'Weiter ermitteln →' : 'Nächste Einstellung →', () => {
                if (z.shot < f.zeilen.length - 1) {
                    z.shot++;
                    drawFilm();
                }
                else
                    ackFilm();
            }, 'primary'))));
            layer.replaceChildren(n);
            n.focus({ preventScroll: true });
            if (prefs.stimme && S.verfuegbar?.())
                S.sprechen(shot.text);
        }
        async function ackFilm() {
            const f = z.film;
            if (!f)
                return;
            S.stopp();
            sound.ducken(false);
            if (f.outro) {
                z.film = null;
                result();
                return;
            }
            if (f.replay) {
                z.film = null;
                z.modal = null;
                layer.replaceChildren();
                return;
            }
            z.ack = true;
            await request({ typ: 'akte_szene', id: f.id });
            if (A().scene)
                filmWait();
        }
        function filmWait() {
            if (!A().scene || !z.film)
                return;
            layer.replaceChildren(h('section', { class: 'na-film na-film-wait', role: 'dialog', 'aria-modal': 'true' }, image(z.film.zeilen.at(-1).ort, 'na-film-art'), h('div', { class: 'na-film-shade' }), h('div', { class: 'na-film-copy' }, k('EIN AUGENBLICK FÜR ALLE'), h('h2', {}, 'Die anderen sehen noch hin.'), h('p', {}, A().scene.bestaetigt.length + '/' + A().team.length + ' Personen haben die Szene bestätigt.'), btn('Szene nachlesen', () => { z.ack = false; z.shot = 0; drawFilm(); }, 'ghost'), host?.einladung ? btn('Team einladen', invite, 'ghost') : null)));
        }
        function endgame(e) {
            if (z.ende)
                return;
            z.ende = e;
            z.modal = null;
            const a = e.akte;
            film({ id: 'outro', titel: a.titel, zeilen: [{ titel: 'Was eure Quellen tragen', text: a.text, ort: e.geschafft ? 'motel' : 'einsatz', effekt: 'papier' }, { titel: 'Was eure Entscheidungen hinterlassen', text: a.nach, ort: e.geschafft ? 'park' : 'einsatz', effekt: 'wald' }] }, true);
        }
        function result() { z.modal = null; layer.replaceChildren(); sound.stop(); const e = z.ende, a = e.akte; main.replaceChildren(h('div', { class: 'na-result' }, image(e.geschafft ? 'park' : 'einsatz', 'na-result-art'), h('div', { class: 'na-result-shade' }), h('div', { class: 'na-result-copy' }, k('NACHTAKTE · EURE ERMITTLUNG'), h('h1', {}, a.titel), h('div', { class: 'na-stars' }, '★'.repeat(e.sterne) + '☆'.repeat(3 - e.sterne)), h('p', { class: 'na-lead' }, a.nach), h('div', { class: 'na-result-stats' }, h('span', {}, h('b', {}, e.geloest), 'QUELLEN'), h('span', {}, h('b', {}, Math.round(e.zeit / 60000)), 'MINUTEN FALLZEIT'), h('span', {}, h('b', {}, a.sicher ? 'JA' : 'NEIN'), 'PERSÖNLICHER KONTAKT')), h('div', { class: 'na-button-row' }, host && a.wiederaufnahme ? btn('Akte wieder aufnehmen', () => { z.ende = null; z.film = null; run({ typ: 'akte_wiederaufnehmen' }); }, 'primary') : null, host ? btn('Zurück zu Clavis', () => host.fertig(), 'ghost') : h('p', {}, 'Die Ermittlung ist abgeschlossen. Du kannst diese Seite schließen.'))))); }
        function empfangen(d) {
            if (z.weg || !d)
                return;
            if (d.typ === 'raum') {
                if (d.raum.premium !== 'nachtakte')
                    return;
                z.raum = d.raum;
                if (d.raum.schreck?.standard === false)
                    prefs.schreck = false;
                if (z.stand?.phase === 'spiel')
                    render(true);
                else if (!z.ende)
                    lobby();
            }
            else if (d.typ === 'stand') {
                if (!d.akte || d.akte.seq < z.seq)
                    return;
                const old = z.stand?.phase;
                z.seq = d.akte.seq;
                z.stand = d;
                if (old === 'ende' && d.phase === 'spiel') {
                    z.ende = null;
                    z.film = null;
                    z.modal = null;
                    layer.replaceChildren();
                }
                render();
            }
            else if (d.typ === 'akte_priv') {
                if (d.an !== ich.id || d.seq < (z.priv?.seq ?? -1))
                    return;
                const oldOrt = z.ort;
                z.priv = d;
                z.ort = d.ort;
                if (z.modal !== 'notizen')
                    z.note = d.notiz;
                if (oldOrt !== z.ort) {
                    sound.ort(z.ort);
                    if (!z.film)
                        close();
                }
                render();
            }
            else if (d.typ === 'antwort') {
                const p = z.pending.get(d.nr);
                if (p) {
                    clearTimeout(p.timer);
                    z.timers.delete(p.timer);
                    z.pending.delete(d.nr);
                    p.resolve(d);
                }
            }
            else if (d.typ === 'akte_dialog')
                gespraech(d);
            else if (d.typ === 'akte_dokument')
                dokument(d);
            else if (d.typ === 'akte_fx') {
                cue(d.art);
                if (d.text)
                    toast(d.text);
                if (prefs.schreck && prefs.bewegung && ['schatten', 'donner', 'metall'].includes(d.art) && (d.ort === z.ort || d.art === 'donner')) {
                    el.classList.remove('na-surprise');
                    void el.offsetWidth;
                    el.classList.add('na-surprise');
                    later(1700, () => el.classList.remove('na-surprise'));
                }
            }
            else if (d.typ === 'ende')
                endgame(d.ergebnis);
            else if (['vorbei', 'entfernt'].includes(d.typ)) {
                destroy();
                main.replaceChildren(h('p', { class: 'na-loading' }, 'Die gemeinsame Ermittlung wurde geschlossen.'));
                layer.replaceChildren();
            }
        }
        function key(e) {
            if (z.weg || !el.isConnected)
                return;
            const form = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
            if (e.key === 'Escape' && z.modal && !z.film)
                close();
            if (!form && !z.film && !z.modal) {
                if (e.key.toLowerCase() === 'm')
                    karte();
                if (e.key.toLowerCase() === 'a')
                    board('beweise');
                if (e.key.toLowerCase() === 'r')
                    recherche();
            }
            if (e.key === 'Tab' && (z.modal || z.film)) {
                const ns = [...layer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(n => n.getClientRects().length);
                if (!ns.length)
                    return;
                const first = ns[0], last = ns.at(-1);
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
            if (z.weg)
                return;
            z.weg = true;
            z.timers.forEach(clearTimeout);
            z.timers.clear();
            for (const p of z.pending.values())
                p.resolve({ richtig: false, info: 'Ermittlung geschlossen.' });
            z.pending.clear();
            sound.dispose();
            S.stopp();
            document.removeEventListener('keydown', key);
            window.removeEventListener('pagehide', destroy);
            effects.remove();
        }
        document.addEventListener('keydown', key);
        window.addEventListener('pagehide', destroy);
        savePrefs();
        lobby();
        return { empfangen, destroy, element: el };
    }
    return { erstellen };
})();
