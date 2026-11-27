'use strict';
/*
 * Clavis – der Spielleiter (nur beim Host, die Lösungen verlassen ihn nie).
 *   ClavisLeiter.bauen(entwurf, stufe, seed) → { oeffentlich, geheim, ersetzt }
 *     Macht aus einem Entwurf (KI, Vorlage oder Editor) einen spielbaren Raum: baut jede Mechanik lösbar, ersetzt
 *     Untaugliches, verteilt das Lösungswort, setzt Türen, plant Ereignisse, Wendungen, Bonusrätsel und Jumpscares –
 *     passend zu Altersstufe und Stimmung.
 *   ClavisLeiter.erstellen(gebaut, { senden(d, an, gebuendelt), beiEnde(ergebnis) }) → Spielleiter
 *     eingang(person, d), dazu(person), weg(person), starten(), beenden(geschafft), stand(), stoppen()
 *
 * Wendungen passieren unvorhersehbar (nach Zeit oder nach dem soundsovielten gelösten Rätsel) und ändern das Spiel:
 * ein geschenkter Hinweis, ein Buchstabe, Zeit, ein Geheimfach mit Bonusrätsel – oder Dunkelheit, Nebel, ein
 * Countdown, ein verriegeltes Rätsel, gestohlene Zeit.
 */
const ClavisLeiter = (() => {
    const { norm } = Clavis;
    const S = (stufe) => ({ leicht: 0, mittel: 1, schwer: 2, experte: 3 }[stufe] ?? 1);
    const WOERTER = ['SCHLUESSEL', 'FREIHEIT', 'AUSGANG', 'GEHEIMNIS', 'LOESUNG', 'WAHRHEIT', 'TUERSCHLOSS', 'ENTKOMMEN'];
    const BONUS_MECH = ['labyrinth', 'rohre', 'memory', 'farbcode', 'schalter', 'melodie', 'binaer', 'suchbild', 'tresor'];
    function gewichtetWaehlen(r, gewichte) {
        const l = Object.entries(gewichte).filter(([, w]) => w > 0);
        if (!l.length)
            return null;
        let x = r() * l.reduce((a, [, w]) => a + w, 0);
        return (l.find(([, w]) => (x -= w) <= 0) || l[0])[0];
    }
    function bauen(entwurf, stufe = 'mittel', seed = Date.now()) {
        if (entwurf.premium === 'reserve') {
            const b = ClavisBank.bauen(stufe, seed);
            if (entwurf.jumpscares === false)
                b.oeffentlich.schreck.standard = false;
            return b;
        }
        if (entwurf.premium === 'nachtakte')
            return ClavisAkte.bauen(entwurf, stufe, seed);
        if (entwurf.premium === 'arizona')
            return ClavisArizona.bauen(entwurf, stufe, seed);
        if (entwurf.premium === 'mercy')
            return ClavisFrontier.bauen(entwurf, stufe, seed);
        if (entwurf.premium === 'wald17')
            return ClavisPremium.bauen(entwurf, stufe, seed);
        const r = Clavis.zufall(seed);
        const st = Clavis.STUFEN[stufe] || Clavis.STUFEN.mittel;
        const welt = Clavis.WELTEN[entwurf.welt] ? entwurf.welt : 'akademie';
        const alter = Clavis.ALTER[entwurf.alter] ? entwurf.alter : 'ab14';
        const A = Clavis.ALTER[alter];
        const stimmung = Clavis.stimmungAus(entwurf.stimmung, alter);
        const dunkel = alter !== 'kinder' && alter !== 'ab10' && Math.max(stimmung.grusel, stimmung.spuk, stimmung.gefahr) >= 7;
        const kontext = { welt, geschichte: String(entwurf.intro || '').slice(0, 300) };
        const ersetzt = [];
        const benutzt = new Set();
        const szenen = [];
        const stationen = {};
        const geheim = {};
        let nr = 0;
        const mechanikBauen = (mech, inhalt) => {
            const m = Clavis.MECHANIKEN[mech];
            if (!m)
                return null;
            let g = null;
            try {
                g = m.bauen(inhalt || {}, stufe, r, kontext);
            }
            catch (e) {
                console.error(e);
                g = null;
            }
            if (!g && m.ohneInhalt) {
                try {
                    g = m.bauen(m.ohneInhalt(r, stufe), stufe, r, kontext);
                }
                catch (_) {
                    g = null;
                }
            }
            return g;
        };
        const ereignisAus = (e) => {
            const ur = e && (e.art || e);
            if (!ur || !Clavis.EREIGNISSE[ur])
                return null;
            // Nur, was in diese Welt passt (kein Regen im All, kein Telefon im Pharaonengrab)
            const art = Clavis.ereignisFuerWelt ? Clavis.ereignisFuerWelt(ur, welt) : ur;
            const weltText = ((Clavis.EREIGNIS_WELT || {})[art] || {})[welt];
            const botschaft = ['anruf', 'funkspruch', 'brief'];
            const eigener = art === ur || (botschaft.includes(art) && botschaft.includes(ur)) ? String((e && e.text) || '').slice(0, 300) : weltText || '';
            // Für Kinder nur kindgerechte Ereignisse (eigene Texte der KI sind dann schon kindgerecht geschrieben)
            const t = alter === 'kinder' ? (Clavis.EREIGNISSE[art].kinder ? eigener || Clavis.EREIGNISSE[art].kinder : null) : eigener || Clavis.ereignisText(art, alter, dunkel);
            return t ? { art, text: t } : null;
        };
        const roh = (entwurf.szenen || []).map((sz) => ({ ...sz, stationen: (sz.stationen || []).filter((s) => !s.ab || S(s.ab) <= S(stufe)) })).filter((sz) => sz.stationen.length);
        if (!roh.length)
            throw new Error('Der Raum hat keine Rätsel.');
        roh.forEach((sz, si) => {
            const ids = [];
            sz.stationen.forEach((s) => {
                const id = 's' + (++nr);
                let mech = Clavis.MECHANIKEN[s.mech] ? s.mech : null;
                let g = mech ? mechanikBauen(mech, s.inhalt) : null;
                if (!g) {
                    // Ersatz: eine Mechanik, die sich selbst baut – am liebsten eine, die zu Welt und Gegenstand passt
                    const passend = Clavis.passendeMechaniken ? Clavis.passendeMechaniken(welt, s.symbol, benutzt) : [];
                    for (const x of passend.concat(r.mischen(Clavis.OHNE_INHALT.filter((y) => !benutzt.has(y))), r.mischen(Clavis.OHNE_INHALT))) {
                        g = mechanikBauen(x, {});
                        if (g) {
                            ersetzt.push({ ort: s.ort || '', von: s.mech || '?', zu: x });
                            mech = x;
                            break;
                        }
                    }
                }
                if (!g)
                    return;
                benutzt.add(mech);
                const eigene = (Array.isArray(s.hinweise) ? s.hinweise : []).map((h) => String(h || '').trim()).filter(Boolean).slice(0, 2);
                stationen[id] = {
                    ort: String(s.ort || Clavis.MECHANIKEN[mech].name).slice(0, 40),
                    symbol: Clavis.ICONS[s.symbol] ? s.symbol : r.wahl(Clavis.WELTEN[welt].objekte),
                    titel: String(s.titel || Clavis.MECHANIKEN[mech].name).slice(0, 80),
                    text: String(s.text || '').slice(0, 500),
                    mech, p: g.p, tuer: false,
                };
                geheim[id] = { loesung: g.loesung, zettel: g.zettel || null, hinweise: eigene.concat(g.hilfen || []).slice(0, 3), ereignis: ereignisAus(s.ereignis), wunschTuer: !!s.tuer, eigeneGeschichte: String(s.geschichte || '').trim().slice(0, 300) };
                ids.push(id);
            });
            if (ids.length)
                szenen.push({ titel: String(sz.titel || `Raum ${si + 1}`).slice(0, 60), text: String(sz.text || '').slice(0, 400), art: typeof sz.art === 'string' ? sz.art.slice(0, 20) : '', stationen: ids });
        });
        if (!szenen.length)
            throw new Error('Kein Rätsel ließ sich bauen.');
        // Die Geschichte: jedes Rätsel deckt ein Stück auf – gleichmäßig verteilt, die letzte Erkenntnis beim letzten Rätsel
        {
            const Q = typeof CLAVIS_GESCHICHTE !== 'undefined' ? CLAVIS_GESCHICHTE : null;
            const kinderListe = alter === 'kinder' && !['zirkus', 'spielzeug'].includes(welt);
            const liste = Q ? (Q.vorlagen[entwurf.id] || (kinderListe ? Q.kinder : Q.welten[welt]) || Q.kinder) : [];
            const alleIds = szenen.flatMap((sz) => sz.stationen);
            alleIds.forEach((id, k) => {
                const eigen = geheim[id].eigeneGeschichte;
                const j = alleIds.length > 1 ? Math.round((k * (liste.length - 1)) / (alleIds.length - 1)) : liste.length - 1;
                geheim[id].geschichte = eigen || liste[Math.max(0, j)] || '';
                delete geheim[id].eigeneGeschichte;
            });
        }
        // Türen: je Szene (außer der letzten) eine Station, die den Weg weiter öffnet
        szenen.forEach((sz, i) => {
            if (i === szenen.length - 1)
                return;
            const id = sz.stationen.find((x) => geheim[x].wunschTuer) || sz.stationen[sz.stationen.length - 1];
            stationen[id].tuer = true;
            geheim[id].belohnung = { art: 'tuer', szene: i + 1 };
            if (!geheim[id].ereignis)
                geheim[id].ereignis = ereignisAus({ art: 'geheimtuer', text: alter === 'kinder' ? '' : `Ein Durchgang öffnet sich: ${szenen[i + 1].titel}.` });
        });
        // Lösungswort auf die übrigen Stationen verteilen
        const frag = Object.keys(stationen).filter((id) => !stationen[id].tuer);
        let wort = norm(entwurf.loesungswort).replace(/[0-9]/g, '');
        if (wort.length < 3 || wort.length > 14)
            wort = r.wahl(WOERTER.filter((w) => w.length >= Math.min(frag.length, 10))) || 'SCHLUESSEL';
        const stellen = r.mischen([...wort].map((_, i) => i));
        frag.forEach((id, i) => {
            const meine = [];
            for (let k = i; k < stellen.length; k += frag.length)
                meine.push(stellen[k]);
            if (!meine.length)
                meine.push(stellen[i % stellen.length]);
            meine.sort((a, b) => a - b);
            geheim[id].belohnung = { art: 'fragment', stellen: meine, buchstaben: meine.map((p) => wort[p]) };
        });
        // ---- Ereignisse (passieren einfach): Spannung bestimmt, wie viele; Gefahr, Spuk und Grusel, welche
        const ereignisse = [];
        const genutzt = new Set(Object.values(geheim).map((g) => g.ereignis && g.ereignis.art).filter(Boolean));
        const geeignet = (a) => !!Clavis.ereignisText(a, alter, dunkel);
        const nEreignisse = 1 + Math.floor((stimmung.spannung - 1) / 3);
        for (let i = 0; i < nEreignisse; i++) {
            const gw = {};
            const dazu = (arten, w) => arten.forEach((a) => {
                if (geeignet(a) && !genutzt.has(a))
                    gw[a] = (gw[a] || 0) + w;
            });
            dazu(Clavis.WELTEN[welt].ereignisse.filter((a) => a !== 'geheimtuer'), 3);
            dazu(['alarm', 'beben', 'stromausfall', 'explosion', 'tuerknall'], stimmung.gefahr / 2);
            dazu(['fluestern', 'gewitter', 'schritte', 'lachen', 'ketten', 'uhrschlag', 'spieluhr'], stimmung.spuk / 2);
            dazu(['schrei', 'schritte', 'stromausfall', 'heulen', 'kraehen', 'glas'], stimmung.grusel / 2);
            dazu(['anruf', 'brief', 'funkspruch', 'glitch', 'regen'], stimmung.spannung / 3);
            if (alter === 'kinder')
                dazu(['konfetti', 'kichern', 'spieluhr', 'kraehen', 'regen'], 2);
            const art = gewichtetWaehlen(r, gw);
            if (!art)
                break;
            genutzt.add(art);
            ereignisse.push({ art, text: Clavis.ereignisText(art, alter, dunkel) });
        }
        // ---- Wendungen (ändern das Spiel)
        const wendungen = [];
        const nWendungen = Math.min(5, 1 + Math.round(stimmung.spannung / 3.2) + (st.stationen >= 8 ? 1 : 0));
        const schlecht = alter === 'kinder' ? 0.35 : 1;
        const gewichte = {
            tipp: 3, buchstabe: 2, zeitplus: 1.2, geheimfach: 2.6,
            dunkel: (1 + stimmung.gefahr / 3 + stimmung.grusel / 4) * schlecht, nebel: (1 + stimmung.spuk / 4) * schlecht,
            countdown: (stimmung.gefahr / 2.5 + stimmung.spannung / 4) * schlecht, blockiert: (stimmung.gefahr / 3) * schlecht,
            zeitminus: alter === 'kinder' ? 0 : stimmung.gefahr / 3.5,
        };
        const nStationen = Object.keys(stationen).length;
        for (let i = 0; i < nWendungen; i++) {
            const art = gewichtetWaehlen(r, gewichte);
            if (!art)
                break;
            gewichte[art] = art === 'geheimfach' ? 0 : gewichte[art] * 0.35;
            const nachLoesung = r() < 0.4 && nStationen > 2;
            wendungen.push({ art, nachLoesung: nachLoesung ? r.zahl(1, Math.max(1, nStationen - 2)) : null, bei: 0 });
        }
        // Zeitpunkte: Ereignisse und Wendungen verteilt über 12–88 % der Zeit, mit Zufall
        const zeitlich = [...ereignisse.map((e) => ({ x: e })), ...wendungen.filter((w) => !w.nachLoesung).map((w) => ({ x: w }))];
        r.mischen(zeitlich).forEach((z2, i) => { z2.x.bei = Math.max(0.08, Math.min(0.9, 0.12 + (0.76 * (i + 0.5)) / zeitlich.length + (r() - 0.5) * 0.08)); });
        // ---- Bonusrätsel im Geheimfach
        const bonus = [];
        if (wendungen.some((w) => w.art === 'geheimfach')) {
            for (const x of r.mischen(BONUS_MECH.filter((y) => !benutzt.has(y))).concat(BONUS_MECH)) {
                const g = mechanikBauen(x, {});
                if (!g)
                    continue;
                const id = 'b' + (++nr);
                stationen[id] = { ort: 'Geheimfach', symbol: r.wahl(['truhe', 'schluessel', 'tresor', 'spieluhr', 'buch']), titel: 'Das Geheimfach', text: alter === 'kinder' ? 'Ein Bonusrätsel! Wer es löst, bekommt eine Belohnung.' : 'Ein verborgenes Fach. Wer das hier löst, wird belohnt.', mech: x, p: g.p, tuer: false, bonus: true };
                geheim[id] = { loesung: g.loesung, zettel: g.zettel || null, hinweise: (g.hilfen || []).slice(0, 3), ereignis: null, belohnung: { art: 'bonus' } };
                bonus.push(id);
                break;
            }
        }
        // ---- Jumpscares
        // Erlaubt die Altersstufe Jumpscares, werden sie immer geplant – jedes Gerät entscheidet am Eingang selbst (an/aus, Stärke 1–10).
        // Die Einstellung im Menü ist nur die Vorgabe.
        const schreckErlaubt = A.schreck && (entwurf.jumpscares === true || (entwurf.jumpscares !== false && stimmung.grusel >= 7));
        const mild = A.schreck === 'mild';
        const schrecken = [];
        if (A.schreck) {
            const n = mild ? 2 : 2 + (stimmung.grusel >= 6 ? 1 : 0) + (stimmung.grusel >= 9 ? 1 : 0);
            const arten = mild ? ['fledermaeuse', 'spinnen', 'katze'] : ['fratze', 'gestalt', 'hand', 'puppe', 'spinnen'];
            for (let i = 0; i < n; i++)
                schrecken.push({ bei: 0.2 + r() * 0.65, art: r.wahl(arten) });
        }
        // Gefahr: weniger Zeit (bis −15 %) und ab 6 Fallen – ein falscher Versuch lässt die Uhr vorspringen
        const minuten = Math.round((Number(entwurf.minuten) || st.minuten) * (1 - Math.max(0, stimmung.gefahr - 5) * 0.03));
        const falle = stimmung.gefahr >= 6 ? (stimmung.gefahr - 5) * 6 : 0;
        const blut = A.blut && stimmung.grusel >= 4 && entwurf.blut !== false;
        const teaser = (Array.isArray(entwurf.teaser) ? entwurf.teaser : []).map((t) => String(t || '').trim().slice(0, 90)).filter(Boolean).slice(0, 5);
        const oeffentlich = {
            titel: String(entwurf.titel || 'Unbenannter Raum').slice(0, 80), welt, stufe, alter, minuten, stimmung, falle, blut, teaser,
            schreck: A.schreck ? { mild, standard: !!schreckErlaubt, staerke: mild ? 3 : Math.max(3, Math.min(10, stimmung.grusel + 1)), arten: mild ? ['fledermaeuse', 'spinnen', 'katze'] : ['fratze', 'gestalt', 'hand', 'puppe'] } : null,
            intro: String(entwurf.intro || '').slice(0, 1500), outro: String(entwurf.outro || 'Die Tür springt auf – frische Luft. Ihr seid draußen.').slice(0, 1200),
            hinweisKosten: st.kosten, hinweisAnzahl: st.hinweise, szenen, stationen, bonus,
            finale: { laenge: wort.length, text: String(entwurf.finaleText || '').slice(0, 400) },
        };
        return { oeffentlich, geheim: { stationen: geheim, wort, ereignisse, wendungen, schrecken, dunkel }, ersetzt };
    }
    function erstellen(gebaut, optionen) {
        const { senden, beiEnde } = optionen;
        if (gebaut.oeffentlich.premium === 'reserve')
            return ClavisBank.erstellen(gebaut, optionen);
        if (gebaut.oeffentlich.premium === 'nachtakte')
            return ClavisAkte.erstellen(gebaut, optionen);
        if (gebaut.oeffentlich.premium === 'arizona')
            return ClavisArizona.erstellen(gebaut, { senden, beiEnde });
        if (gebaut.oeffentlich.premium === 'mercy')
            return ClavisFrontier.erstellen(gebaut, { senden, beiEnde });
        if (gebaut.oeffentlich.premium === 'wald17')
            return ClavisPremium.erstellen(gebaut, { senden, beiEnde });
        const R = gebaut.oeffentlich;
        const G = gebaut.geheim;
        const L = {
            phase: 'lobby', start: 0, strafe: 0, geloest: {}, hinweise: {}, szenen: R.szenen.map((_, i) => i === 0), wort: new Array(G.wort.length).fill(null),
            spieler: new Map(), zettelBei: {}, gefeuert: new Set(), zeitUm: false, finale: false, ende: null,
            sichtbar: {}, blockiert: {}, countdown: null, letzteWendung: 0,
        };
        const restMs = () => (L.phase === 'lobby' ? R.minuten * 60000 : L.start + R.minuten * 60000 - L.strafe * 1000 - Date.now());
        const aktiv = () => [...L.spieler.values()].filter((p) => p.da);
        const anzahlGeloest = () => Object.keys(L.geloest).filter((id) => !R.stationen[id].bonus).length;
        const szeneVon = (id) => (R.stationen[id] && R.stationen[id].bonus ? L.sichtbar[id] : R.szenen.findIndex((sz) => sz.stationen.includes(id)));
        const sichtbar = (id) => { const s = szeneVon(id); return s != null && s >= 0 && L.szenen[s]; };
        const textStufe = R.alter === 'kinder' ? 'kinder' : G.dunkel ? 'dunkel' : 'normal';
        function stand() {
            const zb = {};
            for (const [id, pid] of Object.entries(L.zettelBei)) {
                const p = L.spieler.get(pid);
                if (p)
                    zb[id] = p.name;
            }
            const jetzt = Date.now();
            const blockiert = {};
            for (const [id, bis] of Object.entries(L.blockiert))
                if (bis > jetzt)
                    blockiert[id] = bis - jetzt;
            // Immer eine Kopie: Allein im Spiel geht die Nachricht ohne Umweg an die Ansicht, die alt und neu vergleicht
            return JSON.parse(JSON.stringify({
                typ: 'stand', phase: L.ende ? 'ende' : L.phase, restMs: restMs(), strafe: L.strafe, geloest: L.geloest, hinweise: L.hinweise, szenen: L.szenen, wort: L.wort,
                finale: L.finale, zettelBei: zb, spieler: aktiv().map((p) => ({ id: p.id, name: p.name })), sichtbar: L.sichtbar, blockiert,
                countdown: L.countdown ? Math.max(0, L.countdown.bis - jetzt) : null,
            }));
        }
        const melden = () => senden(stand(), null, true);
        /** Zettel verteilen: allein bekommst du alle; im Team gehen sie reihum an verschiedene Leute */
        function zettelVerteilen() {
            const l = aktiv();
            if (!l.length)
                return;
            const mitZettel = Object.keys(G.stationen).filter((id) => G.stationen[id].zettel && !L.geloest[id] && (!R.stationen[id].bonus || L.sichtbar[id] != null));
            let i = 0;
            for (const id of mitZettel) {
                const bei = L.zettelBei[id] && L.spieler.get(L.zettelBei[id]);
                if (bei && bei.da)
                    continue;
                const p = l[i++ % l.length];
                L.zettelBei[id] = p.id;
                senden({ typ: 'zettel', station: id, zettel: G.stationen[id].zettel }, p.id);
            }
        }
        function dazu(p) {
            const alt = L.spieler.get(p.id);
            L.spieler.set(p.id, { id: p.id, name: p.name, da: true });
            senden({ typ: 'raum', raum: R }, p.id);
            senden(stand(), p.id);
            for (const [id, pid] of Object.entries(L.zettelBei))
                if (pid === p.id)
                    senden({ typ: 'zettel', station: id, zettel: G.stationen[id].zettel }, p.id);
            if (L.phase !== 'lobby')
                zettelVerteilen();
            if (!alt)
                melden();
        }
        function weg(p) {
            const s = L.spieler.get(p.id);
            if (!s)
                return;
            s.da = false;
            if (L.phase !== 'lobby')
                zettelVerteilen();
            melden();
        }
        function starten() {
            if (L.phase !== 'lobby')
                return;
            L.phase = 'spiel';
            L.start = Date.now();
            zettelVerteilen();
            melden();
        }
        function beenden(geschafft) {
            if (L.ende)
                return;
            clearInterval(takt);
            const zeit = Date.now() - L.start + L.strafe * 1000;
            const nHinweise = Object.values(L.hinweise).reduce((a, l) => a + l.length, 0);
            const n = Object.values(R.stationen).filter((s) => !s.bonus).length;
            const sterne = geschafft ? 1 + (restMs() >= 0 ? 1 : 0) + (nHinweise <= Math.floor(n / 4) ? 1 : 0) : 0;
            L.ende = { geschafft: !!geschafft, zeit, hinweise: nHinweise, geloest: anzahlGeloest(), stationen: n, sterne, wort: G.wort };
            senden({ typ: 'ende', ergebnis: L.ende }, null);
            if (beiEnde)
                beiEnde(L.ende);
        }
        function antworten(p, nr, richtig, info = '', falle = 0) { senden({ typ: 'antwort', nr, richtig, info, falle }, p.id); }
        /** Falle (bei Gefahr ab 6): ein falscher Versuch lässt die Uhr vorspringen – höchstens alle 5 s je Person */
        const fallen = new Map();
        function falleAusloesen(p) {
            if (!R.falle || L.phase !== 'spiel')
                return 0;
            if (Date.now() - (fallen.get(p.id) || 0) < 5000)
                return 0;
            fallen.set(p.id, Date.now());
            L.strafe += R.falle;
            setTimeout(melden, 0);
            return R.falle;
        }
        // ---------------------------------------------------------------- Wendungen
        const offeneStationen = () => Object.keys(R.stationen).filter((id) => !L.geloest[id] && sichtbar(id) && !R.stationen[id].bonus);
        function fehlendeStelle() { const l = L.wort.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0); return l.length ? l[Math.floor(Math.random() * l.length)] : -1; }
        function wendung(w) {
            if (L.ende || L.phase !== 'spiel')
                return;
            let art = w.art;
            const daten = {};
            if (art === 'tipp') {
                const l = offeneStationen().filter((id) => (L.hinweise[id] || []).length < G.stationen[id].hinweise.length);
                if (!l.length)
                    art = 'zeitplus';
                else {
                    const id = l[Math.floor(Math.random() * l.length)];
                    const h = L.hinweise[id] || (L.hinweise[id] = []);
                    h.push(G.stationen[id].hinweise[h.length]);
                    Object.assign(daten, { station: id, ort: R.stationen[id].ort, hinweis: h[h.length - 1] });
                }
            }
            if (art === 'buchstabe') {
                const p = fehlendeStelle();
                if (p < 0)
                    art = 'zeitplus';
                else {
                    L.wort[p] = G.wort[p];
                    Object.assign(daten, { stelle: p, buchstabe: G.wort[p] });
                }
            }
            if (art === 'geheimfach') {
                const id = R.bonus.find((x) => L.sichtbar[x] == null);
                if (!id)
                    art = 'zeitplus';
                else {
                    const sz = L.szenen.lastIndexOf(true);
                    L.sichtbar[id] = sz;
                    Object.assign(daten, { station: id, ort: R.stationen[id].ort, szene: sz });
                    setTimeout(zettelVerteilen, 50);
                }
            }
            if (art === 'blockiert') {
                const l = offeneStationen().filter((id) => !(L.blockiert[id] > Date.now()));
                if (!l.length)
                    art = 'zeitminus';
                else {
                    const id = l[Math.floor(Math.random() * l.length)];
                    L.blockiert[id] = Date.now() + 60000;
                    Object.assign(daten, { station: id, ort: R.stationen[id].ort, sekunden: 60 });
                }
            }
            if (art === 'countdown') {
                // Nur, wenn es etwas zu lösen gibt; jedes gelöste Rätsel zählt (auch ein Bonus)
                if (L.countdown || !offeneStationen().length)
                    art = 'zeitminus';
                else {
                    L.countdown = { bis: Date.now() + 90000, geloest: Object.keys(L.geloest).length };
                    daten.sekunden = 90;
                }
            }
            if (art === 'zeitplus') {
                L.strafe -= 120;
                daten.sekunden = 120;
            }
            if (art === 'zeitminus') {
                L.strafe += 60;
                daten.sekunden = 60;
            }
            if (art === 'dunkel')
                daten.sekunden = 60;
            if (art === 'nebel')
                daten.sekunden = 45;
            const W = Clavis.WENDUNGEN[art];
            const texte = W.texte[textStufe] || W.texte.normal;
            // Kinder: nur kindgerechte Bilder; ab 10: kein Konfetti und Kichern (passt nicht zu Gefahr und Grusel)
            const ereignisse = W.ereignisse.filter((e) => (R.alter === 'kinder' ? !!(Clavis.EREIGNISSE[e] && Clavis.EREIGNISSE[e].kinder) : !['konfetti', 'kichern'].includes(e)));
            // Lieber ein Bild, das zur Welt passt (kein Wolfsheulen auf der Raumstation)
            const zurWelt = ereignisse.filter((e) => ((Clavis.WELTEN[R.welt] || {}).ereignisse || []).includes(e));
            const auswahl = (zurWelt.length ? zurWelt : ereignisse).map((e) => (Clavis.ereignisFuerWelt ? Clavis.ereignisFuerWelt(e, R.welt) : e));
            L.letzteWendung = Date.now();
            senden({ typ: 'wendung', art, gut: W.gut, ereignis: auswahl[Math.floor(Math.random() * auswahl.length)] || (R.alter === 'kinder' ? 'konfetti' : 'uhrschlag'), text: texte[Math.floor(Math.random() * texte.length)], daten }, null);
            melden();
        }
        function eingang(p, d) {
            if (!d || L.ende)
                return;
            const person = L.spieler.get(p.id) || { id: p.id, name: p.name };
            if (d.typ === 'loesen') {
                const id = d.station;
                const s = R.stationen[id];
                const g = G.stationen[id];
                if (!s || L.phase === 'lobby')
                    return antworten(person, d.nr, false, 'Das Spiel hat noch nicht begonnen.');
                if (L.geloest[id])
                    return antworten(person, d.nr, true);
                if (!sichtbar(id))
                    return antworten(person, d.nr, false);
                if (L.blockiert[id] > Date.now())
                    return antworten(person, d.nr, false, `Verriegelt – noch ${Math.ceil((L.blockiert[id] - Date.now()) / 1000)} Sekunden.`);
                let r = false;
                try {
                    r = Clavis.MECHANIKEN[s.mech].pruefen(s.p, g.loesung, d.antwort);
                }
                catch (e) {
                    console.error(e);
                    r = false;
                }
                const richtig = r === true || (r && r.richtig === true);
                const f = richtig ? 0 : falleAusloesen(person);
                antworten(person, d.nr, richtig, r && r.info ? r.info : '', f);
                if (!richtig)
                    return;
                let b = g.belohnung;
                if (b.art === 'bonus') {
                    const pos = fehlendeStelle();
                    if (pos >= 0)
                        b = { art: 'fragment', stellen: [pos], buchstaben: [G.wort[pos]], bonus: true };
                    else {
                        L.strafe -= 120;
                        b = { art: 'zeit', sekunden: 120, bonus: true };
                    }
                }
                L.geloest[id] = { von: person.id, name: person.name, zeit: Date.now() - L.start, belohnung: b, geschichte: g.geschichte || '' };
                if (b.art === 'fragment')
                    b.stellen.forEach((st, i) => { L.wort[st] = b.buchstaben[i]; });
                if (b.art === 'tuer')
                    L.szenen[b.szene] = true;
                delete L.zettelBei[id];
                delete L.blockiert[id];
                senden({ typ: 'geloest', station: id, von: person.id, name: person.name, belohnung: b, ereignis: g.ereignis, geschichte: g.geschichte || '' }, null);
                // Countdown entschärft?
                if (L.countdown && Object.keys(L.geloest).length > L.countdown.geloest) {
                    L.countdown = null;
                    senden({ typ: 'wendung_ende', art: 'countdown', erfolg: true, text: R.alter === 'kinder' ? 'Geschafft! Die Wecker-Rakete fliegt davon.' : 'Countdown gestoppt – gerade noch rechtzeitig!' }, null);
                }
                melden();
                // Wendungen nach dem soundsovielten gelösten Rätsel (kurz danach, damit die Freude erst ankommt)
                const n = anzahlGeloest();
                for (const w of G.wendungen)
                    if (w.nachLoesung && !w.gefeuert && n >= w.nachLoesung) {
                        w.gefeuert = true;
                        setTimeout(() => wendung(w), 2600 + (g.ereignis ? 3000 : 0));
                        break;
                    }
            }
            else if (d.typ === 'finale') {
                if (L.phase === 'lobby')
                    return antworten(person, d.nr, false);
                const richtig = norm(d.antwort) === G.wort;
                antworten(person, d.nr, richtig, richtig ? '' : 'Das Schloss rührt sich nicht.', richtig ? 0 : falleAusloesen(person));
                if (richtig) {
                    L.finale = true;
                    melden();
                    setTimeout(() => beenden(true), 900);
                }
            }
            else if (d.typ === 'hinweis') {
                const id = d.station;
                const g = G.stationen[id];
                if (!g || L.geloest[id] || L.phase === 'lobby')
                    return;
                const l = L.hinweise[id] || (L.hinweise[id] = []);
                if (l.length >= R.hinweisAnzahl || l.length >= g.hinweise.length)
                    return;
                l.push(g.hinweise[l.length]);
                L.strafe += R.hinweisKosten;
                senden({ typ: 'hinweis', station: id, von: person.id, name: person.name }, null);
                melden();
            }
        }
        // Uhr: Ereignisse, Wendungen, Jumpscares, Countdown, „Zeit ist um“
        const takt = setInterval(() => {
            if (L.phase !== 'spiel' || L.ende)
                return;
            const jetzt = Date.now();
            const verstrichen = (jetzt - L.start + Math.max(0, L.strafe) * 1000) / (R.minuten * 60000);
            G.ereignisse.forEach((e, i) => {
                if (!L.gefeuert.has('e' + i) && verstrichen >= e.bei) {
                    L.gefeuert.add('e' + i);
                    senden({ typ: 'ereignis', art: e.art, text: e.text }, null);
                }
            });
            // Wendungen nicht direkt hintereinander (mindestens 40 s Abstand)
            for (const w of G.wendungen) {
                if (w.gefeuert || w.nachLoesung || verstrichen < w.bei || jetzt - L.letzteWendung < 40000)
                    continue;
                w.gefeuert = true;
                wendung(w);
                break;
            }
            G.schrecken.forEach((s, i) => {
                if (!L.gefeuert.has('j' + i) && verstrichen >= s.bei) {
                    L.gefeuert.add('j' + i);
                    senden({ typ: 'schreck', art: s.art }, null);
                }
            });
            if (L.countdown && jetzt >= L.countdown.bis) {
                L.countdown = null;
                L.strafe += 120;
                senden({ typ: 'wendung_ende', art: 'countdown', erfolg: false, text: R.alter === 'kinder' ? 'Pffft – die Rakete hat dir zwei Minuten stibitzt!' : 'Zu spät! Die Uhr springt zwei Minuten vor.' }, null);
                melden();
            }
            for (const [id, bis] of Object.entries(L.blockiert))
                if (bis <= jetzt) {
                    delete L.blockiert[id];
                    melden();
                }
            if (!L.zeitUm && restMs() < 0) {
                L.zeitUm = true;
                senden({ typ: 'ereignis', art: 'alarm', text: R.alter === 'kinder' ? 'Die Zeit ist um! Macht ruhig weiter – ihr schafft das!' : 'Die Zeit ist um! Ihr dürft weitermachen – aber die Uhr läuft jetzt gegen euch.' }, null);
                melden();
            }
        }, 1000);
        return { eingang, dazu, weg, starten, beenden, stand, get phase() { return L.phase; }, get ende() { return L.ende; }, stoppen: () => clearInterval(takt), wendung };
    }
    return { bauen, erstellen };
})();
