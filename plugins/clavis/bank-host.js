'use strict';
/* Autoritativer Raub: Rollen, Alarm, Festnahmen und Neuverteilung liegen allein beim Host. */
const ClavisBank = (() => {
    const D = ClavisBankGeschichte, F = ClavisBankLogik, clone = x => JSON.parse(JSON.stringify(x));
    const RUF = ['RABE', 'KOBALT', 'IRIS', 'LOT', 'FUCHS', 'NACHT', 'KUPFER', 'ECHO'];
    function bauen(stufe = 'schwer', seed = Date.now()) {
        if (!Clavis.STUFEN[stufe])
            stufe = 'schwer';
        return { oeffentlich: { premium: 'reserve', nurTeam: true, titel: D.vorlage.titel, untertitel: D.vorlage.untertitel, alter: 'ab14', stufe, minuten: ({ leicht: 88, mittel: 76, schwer: 64, experte: 52 })[stufe], maxFehler: ({ leicht: 4, mittel: 3, schwer: 2, experte: 1 })[stufe], spurGrenze: ({ leicht: 2, mittel: 2, schwer: 1, experte: 1 })[stufe], hinweisKosten: ({ leicht: 45, mittel: 65, schwer: 85, experte: 110 })[stufe], kontrollFenster: ({ leicht: 40, mittel: 35, schwer: 30, experte: 25 })[stufe], minSpieler: 2, maxSpieler: 8, orte: D.orte, aufgaben: D.aufgaben, funde: D.funde, schreck: { standard: true, staerke: 6 }, premiumZugang: { sku: 'clavis.schwarze-reserve', modell: 'raum-in-clavis', zahlungsdienst: 'spaeter' } }, geheim: { seed, runden: {}, kontrollen: {} }, ersetzt: [] };
    }
    function erstellen(gebaut, { senden, beiEnde, jetzt = Date.now, intervall = setInterval, aufheben = clearInterval }) {
        const R = gebaut.oeffentlich, G = gebaut.geheim, L = { phase: 'lobby', host: null, personen: new Map(), roster: [], bereit: {}, gefasst: {}, spuren: {}, stage: 0, rev: 0, seq: 0, gruppen: [], geloest: {}, start: null, pauseSeit: null, pauseSum: 0, manuell: false, scene: null, ruhe: null, ruheErledigt: false, kontrolle: null, naechsteKontrolle: null, wahl: {}, vote: null, alarm: 0, fehler: 0, strafe: 0, journal: [], chat: [], zuschauerchat: [], tips: {}, hinweise: 0, aktionen: [], ende: null, momente: new Set() };
        let tick, gestoppt = false;
        const last = new Map();
        const crew = () => L.roster.map(id => L.personen.get(id)).filter(Boolean), aktiv = () => crew().filter(p => !L.gefasst[p.id]), istAktiv = id => L.roster.includes(id) && !L.gefasst[id];
        const fehlen = () => L.phase === 'spiel' ? aktiv().filter(p => !p.da) : [];
        const pausen = () => [L.scene ? 'Filmszene' : null, L.ruhe ? 'Geschützter Salon' : null, L.manuell ? 'Teampause' : null, fehlen().length ? 'Verbindung fehlt' : null].filter(Boolean);
        const rest = () => Math.max(0, R.minuten * 60000 - (L.start === null ? 0 : (L.pauseSeit ?? jetzt()) - L.start - L.pauseSum) - L.strafe * 1000);
        const note = (titel, text, art = 'fund') => L.journal.push({ id: ++L.seq, titel, text, art });
        function fenster() {
            const mainStop = pausen().length > 0 || !!L.kontrolle;
            for (const g of L.gruppen) {
                if (mainStop && g.bis !== null) {
                    g.restFenster = Math.max(0, g.bis - jetzt());
                    g.bis = null;
                }
                else if (!mainStop && g.restFenster !== null) {
                    g.bis = jetzt() + g.restFenster;
                    g.restFenster = null;
                }
            }
            const k = L.kontrolle;
            if (k) {
                if (pausen().length && k.bis !== null) {
                    k.restFenster = Math.max(0, k.bis - jetzt());
                    k.bis = null;
                }
                else if (!pausen().length && k.restFenster !== null) {
                    k.bis = jetzt() + k.restFenster;
                    k.restFenster = null;
                }
            }
        }
        function syncPause() {
            const halt = L.phase === 'spiel' && pausen().length > 0;
            if (halt && L.pauseSeit === null)
                L.pauseSeit = jetzt();
            else if (!halt && L.pauseSeit !== null) {
                L.pauseSum += jetzt() - L.pauseSeit;
                L.pauseSeit = null;
            }
            fenster();
        }
        const gruppeVon = id => L.gruppen.find(g => g.ids.includes(id));
        function stand() { return clone({ typ: 'stand', phase: L.phase, restMs: rest(), geloest: L.geloest, hinweise: {}, spieler: [...L.personen.values()].filter(p => p.da).map(p => ({ id: p.id, name: p.name })), bank: { seq: ++L.seq, rev: L.rev, serverZeit: jetzt(), stage: L.stage, offen: offen(), roster: aktiv().map(p => ({ id: p.id, name: p.name, da: p.da })), crew: crew().map(p => ({ id: p.id, name: p.name, rufname: p.rufname || '', da: p.da, status: L.gefasst[p.id] ? 'gefasst' : 'aktiv', grund: L.gefasst[p.id]?.grund || '', spuren: L.spuren[p.id] || 0 })), bereit: L.bereit, pausen: pausen(), scene: L.scene, ruhe: L.ruhe, kontrolle: L.kontrolle ? { id: L.kontrolle.id, titel: L.kontrolle.titel, text: L.kontrolle.text, bereit: Object.keys(L.kontrolle.bereit), abgegeben: Object.keys(L.kontrolle.abgaben), bis: L.kontrolle.bis, restFenster: L.kontrolle.restFenster, fenster: R.kontrollFenster } : null, vote: L.vote, wahl: L.wahl, alarm: L.alarm, fehler: L.fehler, maxFehler: R.maxFehler, strafe: L.strafe, journal: L.journal, chat: [], gruppen: L.gruppen.map(g => ({ id: g.id, ids: g.ids, namen: g.ids.map(id => L.personen.get(id).name), fertig: g.fertig, abgegeben: Object.keys(g.abgaben), bereit: Object.keys(g.bereit), runde: g.runde, schritt: g.schritt, bis: g.bis, restFenster: g.restFenster, hinweise: L.tips[L.stage] || [] })), fehlen: fehlen().map(p => ({ id: p.id, name: p.name })), spaet: [...L.personen.values()].filter(p => p.da && !L.roster.includes(p.id)).map(p => ({ id: p.id, name: p.name })), aktionen: L.aktionen.slice(-12) } }); }
        function privat(id) {
            const g = istAktiv(id) ? gruppeVon(id) : null, q = g ? G.runden[g.id] : null, i = g?.ids.indexOf(id), k = L.kontrolle;
            let kontrolle = null;
            if (k && istAktiv(id)) {
                const index = k.ids.indexOf(id), next = (index + 1) % k.ids.length;
                kontrolle = { fuer: L.personen.get(k.ids[next]).name, zeichen: G.kontrollen[k.id][next] };
            }
            return clone({ typ: 'bank_priv', an: id, seq: L.seq, rev: L.rev, stage: L.stage, rufname: L.personen.get(id)?.rufname || '', gefasst: L.gefasst[id] || null, zuschauer: L.phase === 'spiel' && !istAktiv(id), daten: g ? { gruppe: g.id, p: q.p, ...q.privat[i], eigeneAbgabe: g.abgaben[id] ?? null, chat: g.chat.slice(-20) } : null, kontrolle, teamchat: istAktiv(id) ? L.chat.slice(-24) : [], zuschauerchat: !istAktiv(id) ? L.zuschauerchat.slice(-20) : [] });
        }
        function melden(personal = false) {
            if (gestoppt)
                return;
            syncPause();
            senden(stand(), null, !personal);
            if (personal)
                for (const p of L.personen.values())
                    if (p.da)
                        senden(privat(p.id), p.id);
        }
        function fx(art, p = null, extra = {}) { const e = { id: ++L.seq, art, person: p?.id || null, name: p?.name || '', ...extra }; L.aktionen.push(e); L.aktionen = L.aktionen.slice(-30); senden({ typ: 'bank_fx', ...e }); }
        function szene(id) {
            const s = D.szenen[id];
            if (!s)
                return;
            L.scene = { ...clone(s), id: id + ':' + (++L.seq), bestaetigt: [] };
            note(L.scene.titel, L.scene.zeilen.map(b => b.titel + '\n' + b.text).join('\n\n'), 'szene');
            syncPause();
        }
        function umbruch(titel, text, ids) { L.scene = { id: 'zugriff:' + ++L.seq, titel, bestaetigt: [], zeilen: [{ titel: 'Die Bank hat eine Spur', text, ort: 'zelle', effekt: 'festnahme', bild: 'glas' }, { titel: 'Die Gang muss neu planen', text: 'Die Festnahme bleibt für diesen Raub bestehen. Bereits geöffnete Hauptbereiche sind offen. Die aktuelle Operation erhält für die verbleibenden aktiven Personen neue Gruppen und neue Rollenblätter. Alte Eingaben gelten nicht mehr.', ort: D.aufgaben[Math.min(11, L.stage)].ort, effekt: 'riegel', bild: 'weit' }] }; note(titel, text, 'festnahme'); syncPause(); }
        function setup(stage) {
            L.stage = stage;
            L.rev++;
            L.gruppen = [];
            if (stage >= 12 || aktiv().length < 2)
                return;
            const ids = aktiv().map(p => p.id), teams = stage >= 10 ? [ids] : F.gruppe(ids, G.seed ^ Math.imul(stage + 3, 19379) ^ L.rev);
            teams.forEach((team, i) => { const id = 'b' + stage + '-' + L.rev + '-' + i; L.gruppen.push({ id, ids: team, fertig: false, abgaben: {}, bereit: {}, runde: 0, schritt: 0, bis: null, restFenster: null, chat: [] }); G.runden[id] = F.bauen(D.aufgaben[stage].id, team.map(id => L.personen.get(id)), G.seed ^ Math.imul(stage + 11, 87643) ^ Math.imul(L.rev + 1, 9031) ^ Math.imul(i + 9, 6781), R.stufe, L.wahl); });
            F.verbinden(L.gruppen, G.runden);
        }
        function abstimmung(key) { const def = { beute: { titel: 'Was ist euer Anteil?', text: 'Im Salon entscheidet ihr, was ihr als Erstes aus der Reserve nehmt. Die Auswahl verändert die tatsächliche Zuladung im Förderwerk. Alle aktiven Personen stimmen ab; eine Mehrheit entscheidet.', optionen: [['gold', 'Gold aus der Reserve', '42 kg Zuladung pro Lastgruppe. Schwer, greifbar, echt.'], ['platten', 'Die Originalplatten', '24 kg. Die Maklerin will genau diese Platten.'], ['buch', 'Die Schwarze Reserve', '9 kg. Ein Buch, das diese Bank nicht verlieren darf.']] }, finale: { titel: 'Wem gehört euer letzter Anteil?', text: 'Alle aktiven Personen müssen sich einig sein. Gefangene haben keinen aktiven Riegel mehr. Ihr könnt eure Stimme ändern, bis jede aktive Person denselben Weg wählt.', optionen: [['eigen', 'Den ungebuchten Ausgang nehmen', 'Die Gang bricht mit der Maklerin und behält ihren Anteil.'], ['liefern', 'An die Maklerin liefern', 'Der Wagen und die versprochene Auszahlung warten am Tor.'], ['offenlegen', 'Die Reserve offenlegen', 'Das Buch und die Platten werden zu einem Beweis gegen die Bank.']] } }[key]; L.vote = { key, ...def, stimmen: {}, einstimmig: key === 'finale' }; }
        function kontrollStart(art) {
            if (L.ende || aktiv().length < 2)
                return;
            const texte = { blick: ['Die Kamera schaut zurück', 'Auf allen Bildschirmen erscheint ein Prüfzeichen. Jeder sieht das richtige Zeichen für eine ANDERE aktive Person. Gebt es weiter. Meldet erst dann gemeinsam Bereitschaft.'], aufzug: ['Der Aufzug hält zwischen den Etagen', 'Eine Uniform steht hinter dem Glas. Die Revision verlangt getrennte Bestätigungen. Jeder kennt das Zeichen für eine andere Person.'], personal: ['Die Revision ruft euch einzeln', 'Das Personal nennt eure Rufnamen. Tauscht die Prüfzeichen aus, bevor ihr das sichtbare Zeitfenster startet. Wer später fehlt oder falsch antwortet, kann persönlich festgesetzt werden.'], weisslicht: ['Weißlicht in Reserve Neun', 'Alle Lampen gehen gleichzeitig an. Die Bank verlangt einen letzten unabhängigen Beleg pro aktiver Person.'] };
            const [titel, text] = texte[art];
            const id = 'k' + ++L.seq, ids = aktiv().map(p => p.id), r = Clavis.zufall(G.seed ^ L.seq ^ L.rev);
            L.kontrolle = { id, titel, text, ids, bereit: {}, abgaben: {}, bis: null, restFenster: null };
            G.kontrollen[id] = ids.map(() => r.zahl(0, 3));
            fx('kontrolle', null, { titel });
            fenster();
        }
        function nachSzene() {
            if (L.naechsteKontrolle) {
                const art = L.naechsteKontrolle;
                L.naechsteKontrolle = null;
                kontrollStart(art);
            }
        }
        function ende(geschafft, grund = 'zeit') {
            if (gestoppt || L.ende)
                return;
            aufheben(tick);
            const lebend = aktiv(), gefangen = crew().filter(p => L.gefasst[p.id]), w = L.wahl;
            let titel, text, nach;
            if (!geschafft) {
                titel = lebend.length ? 'Der letzte Rückzug' : 'Die neue Nachtschicht';
                text = lebend.length ? 'Die Bank schließt nicht die Tür. Sie schließt eure Möglichkeiten. ' + lebend.map(p => p.rufname).join(' und ') + ' erreicht einen Seitengang ohne Beute. Der Auftrag ist gescheitert. Hinter dem Glas bleibt ein Licht für jede festgesetzte Person an.' : 'Das Personal erscheint, ohne sich zu beeilen. Ein Umschlag liegt bereit. Für jede Person ein Rufname und ein Kästchen. Als die letzte Tür schließt, wird aus eurer Gang der neue Bestand der Nachtschicht.';
                nach = 'Am nächsten Morgen öffnet die Staatliche Reservebank AUREL pünktlich. In der Bilanz steht kein Überfall. Nur eine Personalbewegung.';
            }
            else if (w.finale === 'liefern') {
                titel = 'Pünktlich zur Auszahlung';
                text = 'Der Wagen der Maklerin wartet tatsächlich. Die Beute wird eingeladen, die Türen werden von außen geschlossen. Auf jedem Sitz liegt ein neues Paar Handschuhe. „Sie haben bestanden“, sagt sie. „Die Frühschicht beginnt gleich.“';
                nach = 'Die Bank hat nicht ihre Reserve verloren. Sie hat die einzige Gang gefunden, die sie ihr wiederbringen konnte.';
            }
            else if (w.finale === 'offenlegen') {
                titel = 'Ein Staat ohne schwarze Seite';
                text = 'Ihr schickt die Reserve an mehr als einen Empfänger. Zum ersten Mal kann niemand in der Bank allein bestätigen, was passiert ist. Auf der anderen Seite des Flusses gehen Nachrichtenfenster an. Die Maklerin ruft noch einmal. Ihr lasst es klingeln.';
                nach = gefangen.length ? 'Die Namen hinter dem Sicherheitsglas stehen jetzt außerhalb der Bank. Ihre Befreiung ist noch nicht erzählt. Aber sie können nicht mehr als Personal verschwinden.' : 'Ihr habt weniger Gold, als ihr geplant hattet. Und mehr Zeugen, als die Bank je zulassen wollte.';
            }
            else {
                titel = gefangen.length ? 'Ein Anteil fehlt' : 'Die ungebuchte Gang';
                text = 'Die Riegel hinter euch verriegeln ins Leere. Ihr erreicht das andere Ufer mit ' + ({ gold: 'echtem Gold', platten: 'den Originalplatten', buch: 'der Schwarzen Reserve' })[w.beute] + '. Keine Uniform. Kein Kästchen. Nur nasse Kleidung und ein Anteil, über den ihr selbst entscheiden könnt.';
                nach = gefangen.length ? 'Ihr zählt eure Anteile, dann eure Namen. Nicht alle haben dieses Ufer erreicht. Der Raub ist gelungen; die Nacht bleibt unvollständig.' : 'Beim Teilen fällt ein schwarzer Zettel aus dem Umschlag. Kein Rufname mehr. Nur eine handgeschriebene Nachricht: „Wir hatten euch nicht gemeinsam bestellt.“ Ihr werft ihn in den Fluss.';
            }
            const personal = {};
            for (const p of crew())
                personal[p.id] = { name: p.name, rufname: p.rufname, status: L.gefasst[p.id] ? 'gefasst' : geschafft && w.finale === 'liefern' ? 'uebernommen' : geschafft ? 'entkommen' : 'rueckzug', grund: L.gefasst[p.id]?.grund || '' };
            L.ende = { geschafft, grund, zeit: Math.max(0, R.minuten * 60000 - rest()), sterne: geschafft ? 1 + (w.finale !== 'liefern' ? 1 : 0) + (gefangen.length === 0 && L.fehler === 0 ? 1 : 0) : 0, hinweise: L.hinweise, geloest: Object.keys(L.geloest).length, stationen: 12, bank: { titel, text, nach, wahl: clone(w), personal, gefangen: gefangen.length + (geschafft && w.finale === 'liefern' ? lebend.length : 0), entkommen: geschafft && w.finale !== 'liefern' ? lebend.length : 0, fehler: L.fehler } };
            L.phase = 'ende';
            senden({ typ: 'ende', ergebnis: clone(L.ende) });
            beiEnde?.(clone(L.ende));
        }
        function alleFestsetzen(grund) {
            for (const p of aktiv())
                L.gefasst[p.id] = { grund, stage: L.stage, zeit: jetzt() };
            fx('zugriff', null, { alle: true });
            ende(false, grund);
        }
        function festsetzen(ids, grund) {
            const neu = ids.filter(id => istAktiv(id));
            if (!neu.length)
                return false;
            for (const id of neu)
                L.gefasst[id] = { grund, stage: L.stage, zeit: jetzt() };
            L.alarm = Math.min(100, L.alarm + neu.length * 12);
            fx('festnahme', null, { ids: neu });
            if (aktiv().length < 2) {
                ende(false, 'gang');
                return true;
            }
            L.kontrolle = null;
            L.naechsteKontrolle = null;
            setup(L.stage);
            if (L.vote) {
                L.vote.stimmen = Object.fromEntries(Object.entries(L.vote.stimmen).filter(([id]) => istAktiv(id)));
            }
            umbruch('Die Revision hat jemanden behalten', neu.map(id => L.personen.get(id).name).join(', ') + ' wurde festgesetzt. ' + grund, neu);
            return true;
        }
        function fehler(ids, grund, zeitfehler = false) {
            if (zeitfehler && !L.ruheErledigt)
                zeitfehler = false;
            if (!zeitfehler) {
                L.fehler++;
                L.alarm = Math.min(100, L.alarm + 28);
                L.strafe += 20;
            }
            else
                L.alarm = Math.min(100, L.alarm + 12);
            fx('alarm', null, { fehler: L.fehler });
            note('Die Bank bemerkt eine Spur', grund + (zeitfehler ? '' : ' · 20 Sekunden und ein gemeinsamer Fehlversuch.'), 'alarm');
            if (L.fehler >= R.maxFehler || L.alarm >= 100) {
                alleFestsetzen('Vollständiger Zugriff der Revision');
                return true;
            }
            if (L.ruheErledigt) {
                const gef = [];
                for (const id of ids.filter(istAktiv)) {
                    L.spuren[id] = (L.spuren[id] || 0) + 1;
                    if (zeitfehler || L.spuren[id] >= R.spurGrenze)
                        gef.push(id);
                }
                if (gef.length)
                    return festsetzen(gef, grund);
            }
            return false;
        }
        function next(g) {
            g.fertig = true;
            g.bis = null;
            g.restFenster = null;
            fx('freigabe', null, { gruppe: g.id });
            if (L.gruppen.every(x => x.fertig)) {
                const old = L.stage, id = D.aufgaben[old].id;
                L.geloest[id] = true;
                L.alarm = Math.max(0, L.alarm - 2);
                note(D.aufgaben[old].titel, 'Alle aktiven Gruppen haben unabhängig freigegeben.', 'fortschritt');
                setup(old + 1);
                if (old === 1)
                    L.naechsteKontrolle = 'blick';
                if (old === 3)
                    L.naechsteKontrolle = 'aufzug';
                if (old === 7)
                    L.naechsteKontrolle = 'personal';
                if (old === 9)
                    L.naechsteKontrolle = 'weisslicht';
                if (old === 5)
                    L.ruhe = { seit: jetzt(), mindestens: 20, bereit: {} };
                if (old === 11)
                    abstimmung('finale');
                szene(id);
            }
        }
        const antwort = (p, d, richtig, info = '') => senden({ typ: 'antwort', nr: d.nr, richtig, info }, p.id);
        function eingang(p, d) {
            if (!d || typeof d !== 'object' || gestoppt || !L.personen.get(p?.id)?.da)
                return;
            if (d.typ === 'bank_sync') {
                senden({ typ: 'raum', raum: R }, p.id);
                senden(stand(), p.id);
                senden(privat(p.id), p.id);
                if (L.ende)
                    senden({ typ: 'ende', ergebnis: clone(L.ende) }, p.id);
                return;
            }
            if (L.ende)
                return;
            if (d.typ === 'bank_bereit' && L.phase === 'lobby') {
                L.bereit[p.id] = d.wert !== false;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'bank_pause') {
                if (p.id !== L.host || L.phase !== 'spiel')
                    return antwort(p, d, false, 'Nur die Spielleitung schaltet eine Teampause.');
                L.manuell = !L.manuell;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'bank_ersatz') {
                if (p.id !== L.host)
                    return antwort(p, d, false, 'Nur die Spielleitung besetzt einen fehlenden aktiven Platz neu.');
                const alt = L.personen.get(d.alt), neu = L.personen.get(d.neu);
                if (!alt || alt.da || !istAktiv(d.alt) || !neu?.da || L.roster.includes(d.neu))
                    return antwort(p, d, false, 'Gefangene Plätze bleiben ausgeschieden. Ersetzbar ist nur eine fehlende aktive Verbindung.');
                const at = L.roster.indexOf(d.alt);
                L.roster[at] = d.neu;
                neu.rufname = alt.rufname;
                L.spuren[d.neu] = L.spuren[d.alt] || 0;
                for (const g of L.gruppen) {
                    const i = g.ids.indexOf(d.alt);
                    if (i >= 0) {
                        g.ids[i] = d.neu;
                        delete g.abgaben[d.alt];
                        delete g.bereit[d.alt];
                        if (g.bis !== null || g.restFenster !== null) {
                            g.bis = null;
                            g.restFenster = null;
                            g.abgaben = {};
                            g.bereit = {};
                            g.runde = 0;
                            g.schritt = 0;
                        }
                        const q = G.runden[g.id];
                        for (const x of q.privat) {
                            x.hinweis = x.hinweis.split(alt.name).join(neu.name);
                            if (x.blatt.fuer === alt.name)
                                x.blatt.fuer = neu.name;
                            if (x.blatt.vorgaenger === alt.name)
                                x.blatt.vorgaenger = neu.name;
                            x.partner = g.ids.map(id => L.personen.get(id).name);
                        }
                        q.privat[i].name = neu.name;
                    }
                }
                if (L.scene)
                    L.scene.bestaetigt = L.scene.bestaetigt.filter(id => id !== d.alt);
                if (L.ruhe)
                    delete L.ruhe.bereit[d.alt];
                if (L.vote)
                    delete L.vote.stimmen[d.alt];
                if (L.kontrolle) {
                    const k = L.kontrolle, i = k.ids.indexOf(d.alt);
                    if (i >= 0) {
                        k.ids[i] = d.neu;
                        k.bis = null;
                        k.restFenster = null;
                        k.abgaben = {};
                        k.bereit = {};
                    }
                }
                L.rev++;
                antwort(p, d, true);
                note('Ersatz für eine Verbindung', neu.name + ' übernimmt den aktiven Rufnamen ' + neu.rufname + '. Eine Festnahme wurde dadurch nicht aufgehoben.', 'team');
                melden(true);
                return;
            }
            if (d.typ === 'bank_chat') {
                const channel = istAktiv(p.id) ? d.kanal : 'zuschauer', text = String(d.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
                if (!text)
                    return antwort(p, d, false, 'Die Nachricht ist leer.');
                const k = 'chat:' + p.id;
                if (jetzt() - (last.get(k) ?? -Infinity) < 750)
                    return antwort(p, d, false, 'Bitte einen Augenblick warten.');
                last.set(k, jetzt());
                const msg = { id: ++L.seq, von: p.id, name: p.name, text };
                if (channel === 'zuschauer') {
                    L.zuschauerchat.push(msg);
                    L.zuschauerchat = L.zuschauerchat.slice(-40);
                }
                else if (channel === 'team') {
                    L.chat.push(msg);
                    L.chat = L.chat.slice(-40);
                }
                else {
                    const g = gruppeVon(p.id);
                    if (!g)
                        return antwort(p, d, false, 'Keine aktive Gruppe.');
                    g.chat.push(msg);
                    g.chat = g.chat.slice(-40);
                }
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (L.phase !== 'spiel' || !istAktiv(p.id))
                return antwort(p, d, false, L.gefasst[p.id] ? 'Du bist für diesen Raub ausgeschieden. Zuschauerfunk und Kameras bleiben verfügbar.' : 'Du hast keinen aktiven Gangplatz.');
            if (d.typ === 'bank_szene') {
                if (!L.scene || d.id !== L.scene.id)
                    return antwort(p, d, false, 'Die Szene ist bereits vorbei.');
                if (!L.scene.bestaetigt.includes(p.id))
                    L.scene.bestaetigt.push(p.id);
                if (aktiv().every(p => L.scene.bestaetigt.includes(p.id))) {
                    if (L.ruhe && L.scene.id.startsWith('praegung:'))
                        L.ruhe.seit = jetzt();
                    L.scene = null;
                    nachSzene();
                }
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'bank_ruhebereit') {
                if (!L.ruhe || L.scene)
                    return antwort(p, d, false, 'Der geschützte Salon ist noch nicht offen.');
                L.ruhe.bereit[p.id] = true;
                antwort(p, d, true);
                ruhePruefen();
                melden(true);
                return;
            }
            if (L.scene || L.manuell || fehlen().length)
                return antwort(p, d, false, 'Die Gang hält an. Während einer Pause zählt keine Eingabe als Fehler.');
            if (rest() <= 0) {
                alleFestsetzen('Die Zeit des Raubs ist abgelaufen');
                return;
            }
            if (L.ruhe)
                return antwort(p, d, false, 'Hier könnt ihr ohne Risiko verschnaufen. Meldet gemeinsam Bereitschaft zum Weitergehen.');
            if (d.typ === 'bank_stimme') {
                if (!L.vote || !L.vote.optionen.some(o => o[0] === d.wert))
                    return antwort(p, d, false, 'Keine passende Abstimmung offen.');
                L.vote.stimmen[p.id] = d.wert;
                antwort(p, d, true);
                const ids = aktiv().map(p => p.id);
                if (ids.every(id => L.vote.stimmen[id])) {
                    const counts = {};
                    for (const id of ids)
                        counts[L.vote.stimmen[id]] = (counts[L.vote.stimmen[id]] || 0) + 1;
                    const [v, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    if (L.vote.einstimmig ? count === ids.length : count > ids.length / 2) {
                        const key = L.vote.key;
                        L.wahl[key] = v;
                        note(L.vote.titel, L.vote.optionen.find(o => o[0] === v)[1] + ' · ' + count + ' von ' + ids.length + ' aktiven Stimmen.', 'wahl');
                        L.vote = null;
                        if (key === 'beute')
                            setup(6);
                        if (key === 'finale') {
                            ende(true, 'beute');
                            return;
                        }
                    }
                }
                melden(true);
                return;
            }
            if (d.typ === 'bank_kontrollbereit') {
                const k = L.kontrolle;
                if (!k || d.id !== k.id || k.bis !== null)
                    return antwort(p, d, false, 'Diese Kontrolle ist bereits gestartet oder beendet.');
                k.bereit[p.id] = true;
                if (k.ids.every(id => k.bereit[id]))
                    k.bis = jetzt() + R.kontrollFenster * 1000;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'bank_kontrolle') {
                const k = L.kontrolle;
                if (!k || d.id !== k.id || k.bis === null || !Number.isInteger(d.antwort) || d.antwort < 0 || d.antwort > 3)
                    return antwort(p, d, false, 'Bitte bestätigt den aktuellen sichtbaren Kontrollbeleg.');
                if (jetzt() > k.bis) {
                    kontrollZeit();
                    return;
                }
                k.abgaben[p.id] = d.antwort;
                antwort(p, d, true);
                fx('beleg', p);
                if (k.ids.every(id => Object.hasOwn(k.abgaben, id))) {
                    const wrong = k.ids.filter((id, i) => k.abgaben[id] !== G.kontrollen[k.id][i]);
                    L.kontrolle = null;
                    if (wrong.length) {
                        fehler(wrong, 'Eine persönliche Kontrollantwort war falsch.');
                    }
                    else {
                        L.alarm = Math.max(0, L.alarm - 3);
                        fx('kontrolle-frei');
                        note('Die Revision geht weiter', 'Alle aktiven Personen haben ihren unabhängigen Beleg vorgelegt.', 'team');
                    }
                }
                melden(true);
                return;
            }
            if (L.kontrolle || L.vote)
                return antwort(p, d, false, L.kontrolle ? 'Die Bankkontrolle hat Vorrang. Eure Gerätefenster sind dafür angehalten.' : 'Entscheidet zuerst gemeinsam über eure Beute.');
            if (d.typ === 'bank_lesen') {
                const id = d.ort, i = d.index;
                if (!Object.hasOwn(D.orte, id) || !Number.isInteger(i) || i < 0 || i > 1 || !offen().includes(id))
                    return antwort(p, d, false, 'Dieser Gegenstand liegt noch hinter einem geschlossenen Bereich.');
                const f = D.funde[id][i];
                if (!L.journal.some(x => x.titel === f[0] && x.art === 'fund'))
                    note(f[0], f[1]);
                antwort(p, d, true);
                fx('papier', p, { ort: id });
                melden();
                return;
            }
            if (d.typ === 'bank_geste') {
                const k = 'geste:' + p.id;
                if (jetzt() - (last.get(k) ?? -Infinity) < 900)
                    return;
                last.set(k, jetzt());
                if (['rad', 'karte', 'taste', 'boden', 'hebel', 'papier'].includes(d.art))
                    fx('crew', p, { geste: d.art });
                return;
            }
            const g = gruppeVon(p.id);
            if (!g || g.fertig || g.id !== d.gruppe || d.rev !== L.rev)
                return antwort(p, d, false, 'Die Operation wurde neu zugeteilt. Alte Eingaben zählen nicht als Fehlversuch.');
            const q = G.runden[g.id], role = g.ids.indexOf(p.id);
            if (d.typ === 'bank_hinweis') {
                const tips = L.tips[L.stage] || [];
                if (Number.isInteger(d.index) && d.index !== tips.length) {
                    antwort(p, d, true, 'Diesen Hinweis hat die Gang bereits geöffnet.');
                    melden(true);
                    return;
                }
                if (tips.length >= 3)
                    return antwort(p, d, false, 'Alle drei Hinweise sind offen.');
                L.tips[L.stage] = [...tips, D.hinweise[q.p.art][tips.length]];
                L.hinweise++;
                L.strafe += R.hinweisKosten;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'bank_scharf') {
                if (!['taktwerk', 'flucht'].includes(q.p.art) || g.bis !== null || g.restFenster !== null)
                    return antwort(p, d, false, 'Diese Folge läuft bereits oder braucht kein Zeitfenster.');
                g.bereit[p.id] = true;
                if (g.ids.every(id => g.bereit[id]))
                    g.bis = jetzt() + q.p.fenster * 1000;
                antwort(p, d, true);
                fx('scharf', p);
                melden(true);
                return;
            }
            if (d.typ !== 'bank_beitrag')
                return;
            const a = F.normal(q, role, d.antwort);
            if (a === null)
                return antwort(p, d, false, 'Die Eingabe ist noch unvollständig. Unvollständige Bedienung ist kein Fehlversuch.');
            if (['taktwerk', 'flucht'].includes(q.p.art)) {
                if (g.bis === null || d.runde !== g.runde || d.schritt !== g.schritt)
                    return antwort(p, d, false, 'Wartet auf die aktuelle Freigabe und das sichtbare Zeitfenster.');
                if (jetzt() > g.bis) {
                    gruppenZeit(g);
                    return;
                }
            }
            if (q.p.art === 'flucht') {
                if (Object.hasOwn(g.abgaben, p.id))
                    return antwort(p, d, true, 'Dein Riegel ist bereits offen.');
                const expected = g.ids[q.reihenfolge[g.schritt]];
                if (expected !== p.id || a !== q.antworten[role]) {
                    antwort(p, d, true, 'Der Riegel hat eine Spur hinterlassen.');
                    const changed = fehler([p.id], 'Ein Fluchtriegel wurde von der falschen Person oder mit dem falschen Zeichen gezogen.');
                    if (!changed && !L.ende) {
                        g.abgaben = {};
                        g.bereit = {};
                        g.bis = null;
                        g.schritt = 0;
                    }
                    melden(true);
                    return;
                }
                g.abgaben[p.id] = a;
                g.schritt++;
                antwort(p, d, true, 'Dein Riegel ist offen.');
                fx('riegel', p, { schritt: g.schritt });
                if (g.schritt === g.ids.length)
                    next(g);
                else
                    g.bis = jetzt() + q.p.fenster * 1000;
                melden(true);
                return;
            }
            g.abgaben[p.id] = clone(a);
            antwort(p, d, true, 'Dein unabhängiger Beitrag ist eingegangen.');
            fx('beitrag', p, { gruppe: g.id });
            if (g.ids.every(id => Object.hasOwn(g.abgaben, id))) {
                const werte = g.ids.map(id => g.abgaben[id]);
                if (F.pruefen(q, werte, g.runde)) {
                    if (q.p.art === 'taktwerk' && g.runde < 3) {
                        g.runde++;
                        g.abgaben = {};
                        g.bis = jetzt() + q.p.fenster * 1000;
                        fx('impuls', null, { runde: g.runde });
                    }
                    else
                        next(g);
                }
                else {
                    const wrong = F.falsch(q, werte, g.runde).flatMap((bad, i) => bad ? [g.ids[i]] : []), changed = fehler(wrong, 'Die gemeinsamen Gerätewerte passen nicht zusammen.');
                    if (!changed && !L.ende) {
                        g.abgaben = {};
                        g.bereit = {};
                        g.bis = null;
                        g.restFenster = null;
                        g.runde = 0;
                        g.schritt = 0;
                    }
                }
            }
            melden(true);
        }
        function offen() {
            const ids = ['aussen', ...D.aufgaben.slice(0, Math.min(12, L.stage + 1)).map(a => a.ort)];
            if (L.stage >= 6)
                ids.push('salon');
            return [...new Set(ids)];
        }
        function ruhePruefen() {
            if (L.ruhe && !L.scene && jetzt() - L.ruhe.seit >= L.ruhe.mindestens * 1000 && aktiv().every(p => L.ruhe.bereit[p.id])) {
                L.ruhe = null;
                L.ruheErledigt = true;
                L.alarm = Math.max(0, L.alarm - 10);
                abstimmung('beute');
                syncPause();
            }
        }
        function kontrollZeit() {
            const k = L.kontrolle;
            if (!k)
                return;
            const missing = k.ids.filter((id, i) => !Object.hasOwn(k.abgaben, id) || k.abgaben[id] !== G.kontrollen[k.id][i]);
            L.kontrolle = null;
            if (missing.length)
                fehler(missing, 'Das angekündigte Kontrollfenster ist ohne persönlichen Beleg abgelaufen.', true);
        }
        function gruppenZeit(g) {
            const q = G.runden[g.id], wrong = F.falsch(q, g.ids.map(id => g.abgaben[id] ?? null), g.runde), missing = q.p.art === 'flucht' ? [g.ids[q.reihenfolge[g.schritt]]] : g.ids.filter((id, i) => !Object.hasOwn(g.abgaben, id) || wrong[i]);
            const changed = fehler(missing, 'Das angekündigte Gerätefenster ist abgelaufen.', true);
            if (!changed && !L.ende) {
                g.abgaben = {};
                g.bereit = {};
                g.bis = null;
                g.restFenster = null;
                g.runde = 0;
                g.schritt = 0;
            }
        }
        tick = intervall(() => {
            if (gestoppt || L.phase !== 'spiel' || L.ende)
                return;
            syncPause();
            ruhePruefen();
            if (!pausen().length) {
                if (rest() <= 0) {
                    alleFestsetzen('Die Zeit des Raubs ist abgelaufen');
                    return;
                }
                if (L.kontrolle?.bis !== null && L.kontrolle?.bis !== undefined && jetzt() > L.kontrolle.bis) {
                    kontrollZeit();
                    melden(true);
                    return;
                }
                if (!L.kontrolle)
                    for (const g of L.gruppen.slice())
                        if (!g.fertig && g.bis !== null && jetzt() > g.bis) {
                            gruppenZeit(g);
                            melden(true);
                            return;
                        }
                const fort = 1 - rest() / (R.minuten * 60000);
                for (const [grenze, art] of [[.15, 'blick'], [.33, 'telefon'], [.62, 'schatten'], [.82, 'gitter'], [.94, 'letzter']])
                    if (fort >= grenze && !L.momente.has(art)) {
                        L.momente.add(art);
                        fx('moment', null, { moment: art });
                    }
            }
            melden();
        }, 1000);
        return { dazu(p) {
                if (gestoppt || !p?.id)
                    return;
                const old = L.personen.get(p.id);
                L.personen.set(p.id, { ...old, id: p.id, name: String(p.name || old?.name || 'Gast').slice(0, 24), da: true });
                if (!L.host)
                    L.host = p.id;
                senden({ typ: 'raum', raum: R }, p.id);
                melden(true);
                if (L.ende)
                    senden({ typ: 'ende', ergebnis: clone(L.ende) }, p.id);
            }, weg(p) {
                const person = L.personen.get(p?.id);
                if (!person)
                    return;
                person.da = false;
                L.bereit[p.id] = false;
                melden(true);
            }, eingang, stand, offen, starten() {
                if (gestoppt || L.phase !== 'lobby')
                    return false;
                const all = [...L.personen.values()].filter(p => p.da);
                if (all.length < 2 || all.length > 8 || all.some(p => !L.bereit[p.id]))
                    return false;
                L.roster = all.map(p => p.id);
                const mix = Clavis.zufall(G.seed).mischen(RUF);
                all.forEach((p, i) => p.rufname = mix[i]);
                L.phase = 'spiel';
                L.start = jetzt();
                setup(0);
                szene('intro');
                melden(true);
                return true;
            }, beenden: () => ende(false, 'aufgegeben'), stoppen() { gestoppt = true; aufheben(tick); }, get phase() { return L.phase; }, get ende() { return L.ende; } };
    }
    return { bauen, erstellen, VORLAGE: D.vorlage };
})();
