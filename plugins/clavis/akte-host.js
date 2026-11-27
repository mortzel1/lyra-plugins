'use strict';
/* Nichtlineare Fallleitung: Wissen, Maßnahmen, Zeit, Zeugen und Folgen liegen beim Host. */
const ClavisAkte = (() => {
    const D = ClavisFall, copy = x => JSON.parse(JSON.stringify(x)), norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rollen = ['Fallkoordination', 'Spurensicherung', 'Zeugenführung', 'Medienanalyse', 'Quellenprüfung', 'Zeitrekonstruktion', 'Finanzspur', 'Observation'];
    function bauen(entwurf = D.vorlage, stufe = 'mittel', seed = Date.now()) {
        if (!Clavis.STUFEN[stufe])
            stufe = 'mittel';
        return { oeffentlich: { premium: 'nachtakte', modus: 'ermittlung', titel: D.vorlage.titel, untertitel: D.vorlage.untertitel, alter: 'ab14', stufe, minSpieler: 1, maxSpieler: 8, orte: D.orte, theorien: Object.fromEntries(Object.entries(D.theorien).map(([id, t]) => [id, { titel: t.titel, text: t.text }])), schreck: { standard: entwurf.jumpscares !== false }, minuten: 0 }, geheim: { seed }, ersetzt: [] };
    }
    function erstellen(gebaut, { senden, beiEnde, beiSpeichern, jetzt = Date.now, intervall = setInterval, aufheben = clearInterval }) {
        const R = gebaut.oeffentlich, personen = new Map();
        let tick, stop = false, seq = 0, lastTick = jetzt(), sammel = 0;
        let L = { schema: 1, fall: D.vorlage.id, phase: 'lobby', host: null, minute: 0, bereit: {}, beweise: {}, offen: ['einsatz', 'park', 'trail', 'ranger', 'tankstelle', 'wohnung', 'archiv', 'buero', 'klippe'], fertig: [], jobs: [], journal: [], chat: [], profil: null, spuren: [], links: [], timeline: [], auftraege: {}, scene: null, vote: null, pause: false, druck: 0, vertrauen: 3, wahlen: { presse: null, kontakt: null }, maraOrt: 'motel', maraGesichert: false, momente: [], gesperrt: [], fragen: [], besuche: [], abschluesse: [], ende: null };
        const saved = gebaut.geheim.sicherung;
        if (saved?.schema === 1 && saved.fall === D.vorlage.id && saved.zustand) {
            L = { ...L, ...copy(saved.zustand), phase: 'lobby', host: null, bereit: {}, pause: false, vote: null, ende: null };
            if (L.scene)
                L.scene.bestaetigt = [];
            for (const p of saved.personen || [])
                personen.set(p.id, { ...p, da: false });
        }
        const aktive = () => [...personen.values()].filter(p => p.da), has = id => Object.hasOwn(L.beweise, id), offen = id => L.offen.includes(id);
        const zeit = () => { const m = 18 * 60 + 40 + Math.floor(L.minute); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
        const note = (titel, text, art = 'massnahme', extra = {}) => {
            L.journal.push({ id: ++seq, titel, text, art, minute: Math.floor(L.minute), zeit: zeit(), ...extra });
            if (L.journal.length > 220)
                L.journal.shift();
        };
        const antwort = (p, d, richtig, info = '') => senden({ typ: 'antwort', nr: d.nr, richtig, info }, p.id);
        function snapshot() { return copy({ schema: 1, fall: D.vorlage.id, zustand: L, personen: [...personen.values()].map(({ id, name, rolle, ort, notiz }) => ({ id, name, rolle, ort, notiz })) }); }
        function speichern() {
            if (L.phase !== 'lobby')
                beiSpeichern?.(snapshot());
        }
        function fx(art, text, ort = null) { senden({ typ: 'akte_fx', id: ++seq, art, text, ort }); }
        function oeffnen(ids = []) {
            for (const id of ids)
                if (Object.hasOwn(D.orte, id) && !offen(id)) {
                    L.offen.push(id);
                    note('Neuer überprüfbarer Ort', D.orte[id].name + ' ist jetzt auf eurer Einsatzkarte verzeichnet.', 'ort');
                }
        }
        function beweis(id, p = null) {
            if (!Object.hasOwn(D.beweise, id) || has(id))
                return false;
            L.beweise[id] = { ...copy(D.beweise[id]), gesichertVon: p?.name || 'Einsatzteam', minute: Math.floor(L.minute), zeit: zeit() };
            note(D.beweise[id].titel, D.beweise[id].text, 'beweis', { beweis: id });
            fx('beweis', 'In der Fallakte gesichert: ' + D.beweise[id].titel, D.beweise[id].ort);
            return true;
        }
        function szene(key) {
            const s = D.szenen[key];
            if (!s)
                return;
            L.scene = { ...copy(s), id: key + ':' + ++seq, bestaetigt: [] };
            note(s.titel, s.zeilen.map(z => z.titel + '\n' + z.text).join('\n\n'), 'szene');
        }
        function spurStatus() {
            for (const s of L.spuren) {
                const tests = D.theorien[s.theorie].tests, known = tests.filter(has);
                s.geprueft = known;
                s.status = 'offen';
                s.befund = 'Eure Arbeitshypothese ist noch nicht unabhängig überprüft.';
                if (s.theorie === 'weissgaenger' && known.length >= 2) {
                    s.status = 'erschoepft';
                    s.befund = 'Die nachgeprüften Sichtungen haben technische oder kopierte Ursprünge. Diese konkrete Fährte liefert keinen unabhängigen Hinweis auf ein Wesen. Ihr könnt eure Annahme ändern.';
                }
                else if (s.theorie === 'jona' && has('jona_alibi') && has('uhr')) {
                    s.status = 'erschoepft';
                    s.befund = 'Nach Abgleich der Quellen bleibt kein Anschluss zwischen Jona und dem späteren Verschwinden. Der Streit allein trägt diese Fährte nicht.';
                }
                else if (s.theorie === 'unfall' && known.length === 2) {
                    s.status = 'erschoepft';
                    s.befund = 'Weder Gelände noch Stoffspur bestätigen den vermuteten Unfall hier. Noch einmal dieselbe Stelle abzusuchen fügt keine neue Quelle hinzu.';
                }
                else if (s.theorie === 'entfuehrung' && known.length >= 2) {
                    s.status = 'widerspruch';
                    s.befund = 'Zeitpunkt der Nachricht und selbstständige Bewegung passen nicht zur bisherigen Entführungsannahme. Die Erklärung muss überarbeitet oder unabhängig ergänzt werden.';
                }
                else if (s.theorie === 'inszenierung' && known.length >= 2) {
                    s.status = 'anschluss';
                    s.befund = 'Mehrere unabhängige Quellen geben dieser Annahme Anschluss. Für einen Fallabschluss fehlen möglicherweise noch Motiv, eindeutiges Lebenszeichen oder belastbare Belege.';
                }
                else if (known.length)
                    s.befund = 'Eine überprüfbare Quelle liegt vor. Was bestätigt sie — und was erklärt sie noch nicht?';
            }
        }
        function dynamik() {
            for (const j of L.jobs.filter(j => !j.fertig && j.bis <= L.minute)) {
                j.fertig = true;
                for (const id of j.gibt)
                    beweis(id);
                oeffnen(j.oeffnet);
                note('Rückmeldung: ' + j.titel, 'Die angeforderte Prüfung liegt jetzt in der Fallakte.', 'labor');
                fx('funk', 'Rückmeldung aus dem Labor.');
            }
            if (!L.maraGesichert && L.maraOrt === 'motel' && (L.druck >= 2 || L.minute >= 60)) {
                L.maraOrt = 'hafen';
                note('Die Lage verändert sich', 'Ein Fahrzeug hat Bay Crest verlassen. Die Bestätigung kommt erst bei einer Nachprüfung vor Ort.', 'lage');
                fx('telefon', 'Eine Rezeption versucht, die Einsatzleitung zu erreichen.', 'motel');
            }
            if (!L.maraGesichert && L.maraOrt === 'hafen' && L.druck >= 4 && L.minute >= 95) {
                L.maraOrt = 'fort';
                note('Eine Abfahrt ist erfolgt', 'Die Abfertigung meldet die Abfahrt des Abendtransports. Originalbilder und Register können weiterhin gesichert werden.', 'lage');
                fx('schiff', 'Ein Schiffshorn trägt bis zur Straße.', 'hafen');
            }
            const ev = [
                [8, 'rascheln', 'trail', 'Das Laub bewegt sich', 'Hinter dem abgesperrten Weg knickt ein Zweig. Der Lichtkegel eurer Kollegin bleibt eine Sekunde zu lange stehen. Dann läuft ein Reh unter dem Band durch.', 'schatten'],
                [18, 'netz', 'einsatz', 'Der Wald wird zur Schlagzeile', 'Ein Netzkanal nennt eure Ermittlungen bereits „die Rückkehr des Weißgängers“. Das ist keine neue Quelle. Ein sachlicher eigener Aufruf könnte andere Beobachter erreichen.', 'telefon'],
                [35, 'ranger_funk', 'ranger', 'Die Station wird dunkel', 'Elena wechselt in den Außendienst. Das Stationslicht geht aus. Für Befragungen bleibt sie am Funk erreichbar; Antworten dauern etwas länger.', 'radio'],
                [44, 'recorder', 'park', 'Der Rekorder läuft weiter', 'Die Parkplatzkamera überschreibt ungesicherte Randaufnahmen. Eine externe Sicherung kann über die Rangerstation angefordert werden. Andere Ermittlungswege bleiben offen.', 'kamera'],
                [52, 'schatten', 'tunnel', 'Ein zweiter Atem', 'Aus dem Durchlass kommt ein Atemgeräusch. Es setzt aus, als der Wind den Stromkasten berührt. Die Angst ist echt. Ihre Ursache ist noch nicht gesichert.', 'atmen'],
                [75, 'regen', 'park', 'Der Regen erreicht den Canyon', 'Die ersten großen Tropfen fallen ins Laub. Ungesicherte Beobachtungen werden schwerer nachzuvollziehen. Eure bereits aufgenommenen Belege bleiben erhalten.', 'donner']
            ];
            for (const [m, id, ort, titel, text, klang] of ev)
                if (L.minute >= m && !L.momente.includes(id)) {
                    L.momente.push(id);
                    note(titel, text, 'welt', { ort });
                    fx(klang, text, ort);
                }
            spurStatus();
        }
        function zeitWeiter(n) { L.minute += n; dynamik(); }
        function moeglich(a) {
            if (a.theorie && L.profil?.theorie !== a.theorie)
                return false;
            if ((a.braucht || []).some(id => !has(id)))
                return false;
            if (a.irgendein && !a.irgendein.some(has))
                return false;
            if (a.wenn === 'maraWeg' && (L.maraOrt === 'motel' || L.maraGesichert))
                return false;
            if (a.wenn === 'maraFort' && L.maraOrt !== 'fort')
                return false;
            if (a.wenn === 'kameraAlt' && L.minute < 44)
                return false;
            return true;
        }
        function aktionen(p, labor = false) { return D.aktionen.filter(a => (labor ? a.typ === 'analyse' : a.ort === p.ort) && moeglich(a)).map(a => ({ id: a.id, titel: a.titel, text: a.text, typ: a.typ, dauer: a.dauer, x: a.x, y: a.y, fertig: L.fertig.includes(a.id) || a.gibt.every(has), laeuft: L.jobs.some(j => j.id === a.id && !j.fertig) })); }
        function privat(p) { const cam = Object.values(D.kameras).filter(c => c.ort === p.ort).map(c => ({ id: c.id, titel: c.titel, verfuegbar: c.id !== 'park' || L.minute < 44 || has('park_cam') })); const zeugen = Object.values(D.zeugen).filter(w => w.ort === p.ort).map(w => ({ id: w.id, name: w.name, rolle: w.rolle, ton: w.ton, funk: w.id === 'elena' && L.minute >= 35, gesperrt: L.gesperrt.includes(w.id), fragen: w.fragen.filter(q => (q.braucht || []).every(has)).map(q => ({ id: q.id, titel: q.titel, fertig: L.fragen.includes(q.id) })) })); return copy({ typ: 'akte_priv', an: p.id, seq, ort: p.ort, rolle: p.rolle, notiz: p.notiz || '', aktionen: aktionen(p), labor: aktionen(p, true), zeugen, kameras: cam, video: p.video ? { ...p.video, offset: p.video.id === 'park' && has('uhr') ? 'Gerätezeit minus 7 Minuten · Wartungsbuch liegt vor' : p.video.offset, frames: p.video.frames.map(({ beweis, ...f }) => f) } : null, recherche: p.suche || null, kontakt: ['motel', 'hafen'].includes(p.ort) ? { ort: p.ort, moeglich: !L.maraGesichert && L.maraOrt === p.ort && (has('motelregister') || has('hafenliste')), text: L.maraGesichert ? 'Die Identitätsfeststellung ist abgeschlossen.' : L.maraOrt === p.ort ? 'Eine konkrete Kontaktaufnahme ist mit den zugeordneten Unterlagen möglich.' : 'Hier gibt es aktuell keinen bestätigten persönlichen Kontakt. Register, Befragung und weitere Nachprüfung bleiben möglich.' } : null }); }
        function stand() { return copy({ typ: 'stand', phase: L.phase, restMs: 0, geloest: {}, hinweise: {}, spieler: aktive().map(p => ({ id: p.id, name: p.name })), akte: { seq: ++seq, minute: Math.floor(L.minute), zeit: zeit(), wetter: L.minute >= 75 ? 'Regen im Canyon' : L.minute >= 25 ? 'Die Dämmerung fällt' : 'Restlicht über der Stadt', bereit: L.bereit, offen: L.offen, beweise: Object.values(L.beweise), team: aktive().map(({ id, name, rolle, ort }) => ({ id, name, rolle, ort })), scene: L.scene, pause: L.pause, abstimmung: L.vote, profil: L.profil, spuren: L.spuren, verknuepfungen: L.links, zeitlinie: L.timeline, jobs: L.jobs, journal: L.journal, chat: L.chat, auftraege: L.auftraege, entscheidungen: L.wahlen, vertrauen: L.vertrauen, abgeschlossen: L.phase === 'ende', fortsetzung: !!saved } }); }
        function melden(persist = true) {
            if (stop)
                return;
            senden(stand(), null, false);
            for (const p of aktive())
                senden(privat(p), p.id);
            if (persist)
                speichern();
        }
        function ende(theorie, motiv, ids, offenlassen = false) {
            const tags = new Set(ids.flatMap(id => D.beweise[id]?.tags || [])), gut = !offenlassen && theorie === 'inszenierung' && motiv === 'geld' && tags.has('inszenierung') && tags.has('finanzen') && tags.has('planung') && ['leben_motel', 'leben_hafen', 'leben_spaet'].some(id => ids.includes(id));
            let titel, text, nach;
            if (offenlassen) {
                titel = 'Eine Akte, die offen bleibt';
                text = 'Ihr haltet den Fall offen. Keine unbelegte Erklärung wird zum amtlichen Schluss. Die Suche wird übergeben; eure Quellen und offenen Widersprüche bleiben erhalten.';
                nach = 'Ihr könnt diese Akte mit ihrem bisherigen Wissensstand wieder aufnehmen.';
            }
            else if (!gut) {
                titel = 'Eine Erklärung ohne tragenden Boden';
                text = 'Die von euch vorgelegten Quellen tragen euren Abschluss nicht unabhängig genug. Eine Ermittlung ist nicht abgeschlossen, weil eine Geschichte plausibel klingt. Die Überprüfung findet Widersprüche oder fehlende Belege.';
                nach = 'In eurer Akte steht jetzt auch eure eigene Entscheidung. Ihr könnt sie wieder öffnen und die Schwachstellen untersuchen. Die Wahrheit wird euch nicht vorweggenommen.';
            }
            else {
                titel = L.maraGesichert ? (L.wahlen.presse === 'sensation' ? 'Die Wahrheit nach der Schlagzeile' : 'Die Frau auf dieser Seite der Tür') : 'Gelöst. Aber nicht festgehalten.';
                text = 'Mara Vale lebt. Sie hat ihr Verschwinden und einen vermeintlichen Tod inszeniert. Die großen Spuren, der Waldschatten und die verspätete Nachricht sollten die Suche an eine Legende binden. Die Sonderprüfung ihrer fingierten CedarGate-Belege lieferte das Motiv. Keine uralte Kreatur. Ein Mensch, der unter einem anderen Namen neu anfangen wollte.';
                nach = L.maraGesichert ? 'Eure unabhängigen Quellen haben Mara erreicht, bevor sie weiterreisen konnte. Jona bekommt keinen Verdacht als Abschied. Der Wald bleibt dunkel — aber er muss eure Erklärung nicht mehr tragen.' : 'Eure Quellen lösen den Fall, doch eure Entscheidungen ließen Mara Zeit zur Weiterreise. Ihr gebt eine belegte Identität und einen überprüfbaren Weg weiter. Die Fahndung geht über diese Nacht hinaus.';
            }
            const ergebnis = { geschafft: gut, zeit: Math.round(L.minute * 60000), sterne: gut ? 1 + (L.maraGesichert ? 1 : 0) + (L.vertrauen >= 2 && L.wahlen.presse !== 'sensation' ? 1 : 0) : 0, hinweise: 0, geloest: Object.keys(L.beweise).length, stationen: Object.keys(D.beweise).length, akte: { titel, text, nach, theorie, motiv, belege: ids.map(id => copy(L.beweise[id])), sicher: L.maraGesichert, offenlassen, entscheidungen: copy(L.wahlen), wiederaufnahme: !gut } };
            L.abschluesse.push({ minute: L.minute, theorie, motiv, gut });
            L.phase = 'ende';
            L.vote = null;
            L.scene = null;
            L.ende = ergebnis;
            senden(stand(), null, false);
            senden({ typ: 'ende', ergebnis: copy(ergebnis) });
            beiEnde?.(copy(ergebnis));
            speichern();
        }
        function beschluss(v) {
            L.vote = null;
            note(v.titel, 'Gemeinsamer Beschluss: ' + v.label, 'entscheidung');
            zeitWeiter(1);
            if (v.key === 'profil') {
                L.profil = { theorie: v.wert, notiz: v.notiz, belege: v.belege, minute: Math.floor(L.minute) };
                let s = L.spuren.find(s => s.theorie === v.wert);
                if (!s) {
                    s = { id: 'spur-' + v.wert, theorie: v.wert, titel: D.theorien[v.wert].titel, seit: Math.floor(L.minute), belege: v.belege };
                    L.spuren.push(s);
                }
                else
                    s.belege = [...new Set([...s.belege, ...v.belege])];
                spurStatus();
            }
            if (v.key === 'presse') {
                L.wahlen.presse = v.wert;
                if (v.wert === 'sensation') {
                    L.druck += 2;
                    L.vertrauen = Math.max(0, L.vertrauen - 1);
                    fx('telefon', 'Die Schlagzeile ist draußen. Andere hören jetzt mit.');
                }
                if (v.wert === 'sachlich') {
                    beweis('suche_meldung');
                    oeffnen(['motel']);
                }
                dynamik();
            }
            if (v.key === 'kontakt') {
                L.wahlen.kontakt = v.wert;
                if (v.wert === 'beobachten') {
                    zeitWeiter(4);
                    note('Observation', 'Ihr beobachtet den Ort. Die Zeit läuft weiter; es ist noch keine Identitätsfeststellung erfolgt.', 'observation');
                }
                else if (L.maraOrt === v.ort && !L.maraGesichert) {
                    L.maraGesichert = true;
                    beweis(v.ort === 'motel' ? 'leben_motel' : 'leben_hafen');
                    if (v.wert === 'zugriff')
                        L.vertrauen = Math.max(0, L.vertrauen - 1);
                    szene(v.ort === 'motel' ? 'kontakt' : 'hafen');
                }
                else
                    note('Kontakt verpasst', 'Die Zielperson ist nicht mehr an diesem Ort. Prüft die Weiterfahrt und die verbleibenden Quellen.', 'lage');
            }
            if (v.key === 'schluss')
                ende(v.wert, v.motiv, v.belege, false);
            if (v.key === 'offen')
                ende('', '', [], true);
        }
        function stimmenPruefen() {
            const v = L.vote, ids = aktive().map(p => p.id);
            if (!v || !ids.length || !ids.every(id => Object.hasOwn(v.stimmen, id)))
                return;
            const ja = ids.filter(id => v.stimmen[id] === true).length;
            if (ja > ids.length / 2)
                beschluss(v);
            else {
                L.vote = null;
                note('Keine gemeinsame Freigabe', 'Der Vorschlag wurde nicht angenommen. Ihr könnt weiter ermitteln oder einen neuen Vorschlag formulieren.', 'entscheidung');
            }
        }
        function vorschlag(p, key, wert, extra = {}) {
            if (L.vote)
                return 'Klärt zuerst den bereits offenen Teambeschluss.';
            const labels = { presse: { diskret: 'Ohne öffentliche Spekulation weiterarbeiten', sachlich: 'Sachlichen Suchaufruf veröffentlichen', sensation: 'Den Weißgänger als Erklärung öffentlich machen' }, kontakt: { ansprechen: 'Diskret ansprechen und Identität feststellen', zugriff: 'Offen auftreten und den Kontakt sichern', beobachten: 'Zunächst weiter beobachten' } };
            L.vote = { id: 'entscheidung-' + ++seq, key, wert, label: labels[key]?.[wert] || D.theorien[wert]?.titel || 'Akte offen halten', titel: key === 'profil' ? 'Arbeitshypothese des Teams' : key === 'schluss' ? 'Fall mit dieser Begründung abschließen' : key === 'presse' ? 'Öffentlichkeit einbeziehen' : key === 'kontakt' ? 'Gemeinsame Kontaktstrategie' : 'Den Fall offen übergeben', von: p.name, stimmen: { [p.id]: true }, ...extra };
            stimmenPruefen();
            return '';
        }
        function eingang(person, d) {
            const p = personen.get(person?.id);
            if (stop || !p?.da || !d || typeof d !== 'object')
                return;
            if (d.typ === 'akte_sync') {
                senden({ typ: 'raum', raum: R }, p.id);
                senden(stand(), p.id);
                senden(privat(p), p.id);
                if (L.ende)
                    senden({ typ: 'ende', ergebnis: copy(L.ende) }, p.id);
                return;
            }
            if (d.typ === 'akte_wiederaufnehmen' && p.id === L.host && L.phase === 'ende' && L.ende?.akte.wiederaufnahme) {
                L.phase = 'spiel';
                L.ende = null;
                L.vertrauen = Math.max(0, L.vertrauen - 1);
                zeitWeiter(3);
                lastTick = jetzt();
                melden();
                return;
            }
            if (L.phase === 'ende')
                return antwort(p, d, false, 'Diese Akte ist abgeschlossen.');
            if (d.typ === 'akte_bereit' && L.phase === 'lobby') {
                L.bereit[p.id] = d.wert !== false;
                antwort(p, d, true);
                melden(false);
                return;
            }
            if (d.typ === 'akte_chat') {
                const t = String(d.text || '').trim().slice(0, 350);
                if (!t)
                    return antwort(p, d, false, 'Eine Nachricht fehlt.');
                L.chat.push({ id: ++seq, von: p.id, name: p.name, text: t, zeit: zeit() });
                L.chat = L.chat.slice(-40);
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_notiz') {
                p.notiz = String(d.text || '').slice(0, 1500);
                antwort(p, d, true, 'Deine Notiz ist gesichert.');
                melden();
                return;
            }
            if (d.typ === 'akte_pause' && p.id === L.host && L.phase === 'spiel') {
                L.pause = !L.pause;
                lastTick = jetzt();
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_szene' && L.scene && d.id === L.scene.id) {
                if (!L.scene.bestaetigt.includes(p.id))
                    L.scene.bestaetigt.push(p.id);
                if (aktive().every(x => L.scene.bestaetigt.includes(x.id)))
                    L.scene = null;
                lastTick = jetzt();
                antwort(p, d, true);
                melden();
                return;
            }
            if (L.phase !== 'spiel' || L.scene || L.pause)
                return antwort(p, d, false, 'Die Ermittlung hält für eine Szene oder eine Teampause an.');
            if (d.typ === 'akte_stimme') {
                if (!L.vote || d.id !== L.vote.id || typeof d.ja !== 'boolean')
                    return antwort(p, d, false, 'Dieser Vorschlag ist nicht mehr offen.');
                L.vote.stimmen[p.id] = d.ja;
                antwort(p, d, true);
                stimmenPruefen();
                melden();
                return;
            }
            if (d.typ === 'akte_ort') {
                if (!offen(d.ort))
                    return antwort(p, d, false, 'Für diesen Ort habt ihr noch keine überprüfbare Adresse.');
                if (p.ort !== d.ort) {
                    p.ort = d.ort;
                    p.video = null;
                    p.gespraech = null;
                    zeitWeiter(1);
                    L.besuche.push({ ort: d.ort, von: p.id, minute: Math.floor(L.minute) });
                    fx('fahrt', p.name + ' ist jetzt bei ' + D.orte[d.ort].name + '.', d.ort);
                }
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_aktion') {
                const a = D.aktionen.find(a => a.id === d.id && (a.ort === p.ort || a.typ === 'analyse') && moeglich(a));
                if (!a)
                    return antwort(p, d, false, 'Diese Maßnahme ist hier mit dem derzeitigen Wissen nicht verfügbar.');
                if (L.fertig.includes(a.id) || a.gibt.every(has) || L.jobs.some(j => j.id === a.id && !j.fertig))
                    return antwort(p, d, false, 'Diese Maßnahme läuft bereits oder liefert hier keine neue Quelle.');
                L.fertig.push(a.id);
                zeitWeiter(a.dauer);
                note(a.titel, p.name + ': ' + a.text, 'massnahme', { ort: p.ort });
                if (a.typ === 'analyse')
                    L.jobs.push({ id: a.id, titel: a.titel, bis: L.minute + a.labor + ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 })[R.stufe], gibt: a.gibt, oeffnet: a.oeffnet || [], fertig: false });
                else {
                    a.gibt.forEach(id => beweis(id, p));
                    oeffnen(a.oeffnet);
                }
                if (a.id === 'audio' && !L.momente.includes('szene_notruf')) {
                    L.momente.push('szene_notruf');
                    szene('notruf');
                }
                if (a.id === 'negativ' && !L.momente.includes('szene_archiv')) {
                    L.momente.push('szene_archiv');
                    szene('archiv');
                }
                if (a.id === 'projektor' && !L.momente.includes('szene_tunnel')) {
                    L.momente.push('szene_tunnel');
                    szene('tunnel');
                }
                fx(a.klang || 'papier', a.typ === 'analyse' ? 'Prüfung beauftragt. Ihr könnt währenddessen andere Maßnahmen verfolgen.' : a.titel, p.ort);
                antwort(p, d, true, a.typ === 'analyse' ? 'Die Prüfung läuft. Verfolgt währenddessen eine andere Spur.' : 'In der Fallakte dokumentiert.');
                dynamik();
                melden();
                return;
            }
            if (d.typ === 'akte_frage') {
                const w = D.zeugen[d.zeuge], q = w?.fragen?.find(q => q.id === d.frage);
                if (!w || w.ort !== p.ort || !q || (q.braucht || []).some(id => !has(id)))
                    return antwort(p, d, false, 'Diese Frage ist hier noch nicht durch eure Quellen gedeckt.');
                if (L.gesperrt.includes(w.id) || L.fragen.includes(q.id))
                    return antwort(p, d, false, 'Das Gespräch liefert auf diese Frage derzeit keine neue Aussage.');
                L.fragen.push(q.id);
                zeitWeiter(w.id === 'elena' && L.minute >= 35 ? 4 : 2);
                q.gibt.forEach(id => beweis(id, p));
                oeffnen(q.oeffnet);
                if (q.druck)
                    L.druck += q.druck;
                if (q.misstrauen) {
                    L.gesperrt.push(w.id);
                    L.vertrauen = Math.max(0, L.vertrauen - 1);
                }
                let gespraechText = q.text;
                if (w.id === 'jona' && L.profil?.theorie === 'jona' && !has('jona_alibi'))
                    gespraechText += ' Er merkt, dass eure erste Annahme bereits auf ihn fällt. „Prüfen Sie meine Zeiten, bevor Sie aus meinem Streit eine Tat machen.“';
                if (w.id === 'elena' && has('projektor'))
                    gespraechText += ' Als ihr die Inventarnummer nennt, wird sie still: „Dann war die Kampagne heute nicht nur ein Vorwand für die Kiste.“';
                if (w.id === 'ava' && L.maraOrt !== 'motel')
                    gespraechText += ' Inzwischen steht der Parkplatz hinter Zimmer sechs leer. Die Rezeption bietet den Rückgabebeleg des Fahrers zur Nachprüfung an.';
                if (w.id === 'jules' && L.wahlen.presse === 'sensation')
                    gespraechText += ' Jules schaut auf die Schlagzeile. „Bitte machen Sie aus meinen Unterlagen nicht die nächste Waldgeschichte.“';
                note(w.name + ' · ' + q.titel, gespraechText, 'gespraech', { ort: w.ort, zeuge: w.id });
                senden({ typ: 'akte_dialog', zeuge: w.name, text: gespraechText, ton: w.ton }, p.id);
                antwort(p, d, true);
                dynamik();
                melden();
                return;
            }
            if (d.typ === 'akte_recherche') {
                const query = String(d.suche || '').trim().slice(0, 120), tokens = norm(query).split(/[^a-z0-9]+/).filter(t => t.length >= 3);
                if (!tokens.length)
                    return antwort(p, d, false, 'Gib einen Namen, Ort oder konkreten Begriff aus der Akte ein.');
                const matches = D.seiten.filter(s => tokens.some(t => norm(s.such).includes(t)) && (s.braucht || []).every(has));
                p.suche = { suchtext: query, ergebnisse: matches.map(({ id, titel, domain, snippet }) => ({ id, titel, domain, snippet })) };
                if (p.letzteSuche !== norm(query)) {
                    zeitWeiter(1);
                    p.letzteSuche = norm(query);
                }
                antwort(p, d, true, matches.length ? 'Quellen gefunden. Öffne und prüfe sie selbst.' : 'Keine unabhängig verwertbare Quelle. Probiere einen anderen Begriff aus eurer Akte.');
                melden();
                return;
            }
            if (d.typ === 'akte_seite') {
                const s = D.seiten.find(s => s.id === d.id);
                if (!s || !p.suche?.ergebnisse.some(r => r.id === s.id))
                    return antwort(p, d, false, 'Öffne zuerst eine Quelle aus deinen Suchergebnissen.');
                if (!L.fertig.includes('seite:' + s.id)) {
                    L.fertig.push('seite:' + s.id);
                    zeitWeiter(2);
                    s.gibt.forEach(id => beweis(id, p));
                    oeffnen(s.oeffnet);
                    note(s.titel, s.text, 'recherche', { quelle: s.domain });
                }
                senden({ typ: 'akte_dokument', titel: s.titel, quelle: s.domain, text: s.text }, p.id);
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_video') {
                const c = D.kameras[d.id];
                if (!c || c.ort !== p.ort)
                    return antwort(p, d, false, 'Diese Kamera gehört nicht zu deinem Standort.');
                if (c.id === 'park' && L.minute >= 44 && !has('park_cam'))
                    return antwort(p, d, false, 'Das Randmaterial wurde überschrieben. Fordert die Sicherung an der Rangerstation an.');
                p.video = copy({ ...c, offset: c.id === 'park' && has('uhr') ? 'Gerätezeit minus 7 Minuten · Wartungsbuch liegt vor' : c.offset });
                antwort(p, d, true);
                melden(false);
                return;
            }
            if (d.typ === 'akte_frame') {
                const c = D.kameras[d.id], i = d.index;
                if (!c || c.ort !== p.ort || p.video?.id !== c.id || !Number.isInteger(i) || !c.frames[i])
                    return antwort(p, d, false, 'Sichte zuerst die Originalaufnahme und wähle einen Ausschnitt.');
                const f = c.frames[i];
                if (!L.fertig.includes('frame:' + c.id + ':' + i)) {
                    L.fertig.push('frame:' + c.id + ':' + i);
                    zeitWeiter(2);
                    if (f.beweis)
                        beweis(f.beweis, p);
                    else
                        note(c.titel + ' · ' + f.zeit, f.text, 'sichtung');
                }
                antwort(p, d, true, f.beweis ? 'Ausschnitt mit Quellenangabe in der Akte gesichert.' : 'Die Beobachtung ist im Maßnahmenprotokoll festgehalten. Sie enthält derzeit keinen eigenständigen Personenbeleg.');
                melden();
                return;
            }
            if (d.typ === 'akte_zeitpunkt') {
                if (!has(d.beweis) || typeof d.zeit !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.zeit))
                    return antwort(p, d, false, 'Wähle einen gesicherten Beleg und eine Uhrzeit im Format HH:MM.');
                const entry = { beweis: d.beweis, zeit: d.zeit, notiz: String(d.notiz || '').slice(0, 350), von: p.name };
                const at = L.timeline.findIndex(x => x.beweis === d.beweis);
                if (at >= 0)
                    L.timeline[at] = entry;
                else
                    L.timeline.push(entry);
                L.timeline.sort((a, b) => a.zeit.localeCompare(b.zeit));
                antwort(p, d, true, 'Eure zeitliche Einordnung ist dokumentiert. Prüft die Zeitbasis der Originalquelle.');
                melden();
                return;
            }
            if (d.typ === 'akte_verknuepfen') {
                if (!has(d.beweis) || !Object.hasOwn(D.theorien, d.theorie) || !['stuetzt', 'widerspricht', 'offen'].includes(d.relation))
                    return antwort(p, d, false, 'Verknüpfe einen gesicherten Beleg mit einer vorhandenen These.');
                const old = L.links.find(l => l.beweis === d.beweis && l.theorie === d.theorie);
                if (old)
                    old.relation = d.relation;
                else
                    L.links.push({ beweis: d.beweis, theorie: d.theorie, relation: d.relation, von: p.name });
                antwort(p, d, true, 'Eure Einordnung ist festgehalten. Sie wird nicht automatisch zur Tatsache.');
                melden();
                return;
            }
            if (d.typ === 'akte_auftrag') {
                if (!aktive().some(x => x.id === d.person) || !offen(d.ort))
                    return antwort(p, d, false, 'Wähle eine verbundene Person und einen bekannten Ort.');
                L.auftraege[d.person] = { ort: d.ort, text: String(d.text || 'Vor Ort ermitteln').slice(0, 120), von: p.name };
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_warten') {
                if (!L.jobs.some(j => !j.fertig))
                    return antwort(p, d, false, 'Es steht keine Laborrückmeldung aus. Wähle eine eigene nächste Maßnahme.');
                zeitWeiter(3);
                antwort(p, d, true);
                melden();
                return;
            }
            if (d.typ === 'akte_profil') {
                const ids = Array.isArray(d.belege) ? [...new Set(d.belege)].filter(has) : [];
                if (!Object.hasOwn(D.theorien, d.theorie) || !ids.length)
                    return antwort(p, d, false, 'Eine Arbeitshypothese braucht mindestens eine Quelle aus eurer Akte.');
                const err = vorschlag(p, 'profil', d.theorie, { belege: ids, notiz: String(d.notiz || '').slice(0, 800) });
                antwort(p, d, !err, err);
                melden();
                return;
            }
            if (d.typ === 'akte_entscheidung') {
                if (d.key === 'presse' && ['diskret', 'sachlich', 'sensation'].includes(d.wert)) {
                    if (L.wahlen.presse === d.wert)
                        return antwort(p, d, false, 'Diese Strategie habt ihr bereits gewählt.');
                    const err = vorschlag(p, 'presse', d.wert);
                    antwort(p, d, !err, err);
                    melden();
                    return;
                }
                if (d.key === 'kontakt' && ['ansprechen', 'zugriff', 'beobachten'].includes(d.wert)) {
                    if (!['motel', 'hafen'].includes(p.ort) || L.maraOrt !== p.ort || L.maraGesichert || !(has('motelregister') || has('hafenliste')))
                        return antwort(p, d, false, 'Hier ist derzeit kein belegter persönlicher Kontakt möglich. Prüft Register und Weiterfahrt.');
                    const err = vorschlag(p, 'kontakt', d.wert, { ort: p.ort });
                    antwort(p, d, !err, err);
                    melden();
                    return;
                }
                if (d.key === 'schluss') {
                    const ids = Array.isArray(d.belege) ? [...new Set(d.belege)].filter(has) : [];
                    if (!Object.hasOwn(D.theorien, d.wert) || !['geld', 'beziehung', 'aufmerksamkeit', 'unbekannt'].includes(d.motiv) || ids.length < 3)
                        return antwort(p, d, false, 'Formuliert Geschehen und Motiv und nennt mindestens drei gesicherte Quellen.');
                    const err = vorschlag(p, 'schluss', d.wert, { belege: ids, motiv: d.motiv });
                    antwort(p, d, !err, err);
                    melden();
                    return;
                }
                if (d.key === 'offen') {
                    const err = vorschlag(p, 'offen', 'offen');
                    antwort(p, d, !err, err);
                    melden();
                    return;
                }
            }
            antwort(p, d, false, 'Diese Maßnahme ist nicht verfügbar.');
        }
        tick = intervall(() => {
            if (stop)
                return;
            const n = jetzt(), dt = Math.max(0, Math.min(60000, n - lastTick));
            lastTick = n;
            if (L.phase !== 'spiel' || L.scene || L.pause)
                return;
            sammel += dt;
            if (sammel >= 30000) {
                zeitWeiter(Math.floor(sammel / 30000));
                sammel %= 30000;
                melden();
            }
        }, 1000);
        return { dazu(p) {
                if (stop || !p?.id || (!personen.has(p.id) && aktive().length >= 8))
                    return;
                const old = personen.get(p.id);
                personen.set(p.id, { ...old, id: p.id, name: String(p.name || old?.name || 'Ermittler').replace(/[\u0000-\u001f]/g, '').slice(0, 24), rolle: old?.rolle || rollen[aktive().length % rollen.length], ort: old?.ort || 'einsatz', da: true });
                if (!L.host)
                    L.host = p.id;
                senden({ typ: 'raum', raum: R }, p.id);
                melden(false);
                if (L.ende)
                    senden({ typ: 'ende', ergebnis: copy(L.ende) }, p.id);
            }, weg(p) {
                const x = personen.get(p?.id);
                if (!x)
                    return;
                x.da = false;
                L.bereit[x.id] = false;
                if (L.scene && aktive().every(p => L.scene.bestaetigt.includes(p.id)))
                    L.scene = null;
                stimmenPruefen();
                melden();
            }, eingang, stand, starten() {
                if (stop || L.phase !== 'lobby' || !aktive().length || aktive().length > 8 || aktive().some(p => !L.bereit[p.id]))
                    return false;
                L.phase = 'spiel';
                beweis('auftrag');
                beweis('foto');
                if (!saved)
                    szene('intro');
                lastTick = jetzt();
                melden();
                return true;
            }, beenden() {
                if (!L.ende)
                    ende('', '', [], true);
            }, stoppen() { stop = true; aufheben(tick); }, sichern: snapshot, get phase() { return L.phase; }, get ende() { return L.ende; } };
    }
    return { bauen, erstellen, VORLAGE: D.vorlage };
})();
