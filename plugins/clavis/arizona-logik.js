'use strict';
/* Nur beim Host: asymmetrische Aufgaben, private Rollenblätter und Lösungen. */
const ClavisArizonaLogik = (() => {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const perm = a => a.length ? a.flatMap(x => perm(a.filter(y => y !== x)).map(p => [x, ...p])) : [[]];
    const ordnungen = perm([0, 1, 2, 3, 4]);
    const symbole = ['KREIS', 'DREIECK', 'WELLE', 'STERN', 'RAUTE', 'KREUZ'];
    const fits = (a, q) => q.art === 'vor' ? a.indexOf(q.a) < a.indexOf(q.b) : a[q.pos] !== q.a;
    function gruppen(ids, seed) {
        if (!Array.isArray(ids) || ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length)
            throw new Error("Zwei bis acht unterschiedliche Referenzplätze erforderlich.");
        const r = Clavis.zufall(seed), mix = r.mischen(ids), out = [];
        while (mix.length) {
            const n = mix.length === 3 ? 3 : mix.length === 2 ? 2 : mix.length === 4 ? 2 : r.wahl([2, 3]);
            out.push(mix.splice(0, n));
        }
        return out;
    }
    function bauen(art, personen, seed, stufe = 'schwer') {
        const r = Clavis.zufall(seed), n = personen.length, namen = personen.map(p => p.name), privat = personen.map((p, i) => ({ rolle: i, name: p.name, partner: namen, hinweis: '', blatt: {} }));
        let p = { art }, antworten = [];
        if (art === 'funk') {
            const alphabet = r.mischen(symbole), zahlen = r.mischen([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6), folge = r.mischen(alphabet).slice(0, 4), reihenfolge = r.mischen([0, 1, 2, 3]);
            const code = reihenfolge.map(i => zahlen[alphabet.indexOf(folge[i])]);
            p = { art, symbole: alphabet, rollen: ['Empfang', 'Chiffrierung', 'Phasenlage'].slice(0, n), anleitung: 'Empfang gibt vier Ziffern ein. Chiffrierung bestätigt ihre Summe modulo 10. Bei drei Personen bestätigt Phasenlage (2 × erste Ziffer + letzte Ziffer) modulo 10. Gelesen wird in der nummerierten Reihenfolge.' };
            privat[0].blatt = { typ: 'empfang', folge, reihenfolge: n === 2 ? reihenfolge : null };
            privat[0].hinweis = 'Du siehst das Signal, aber nicht die Ziffern. Beschreibe deine vier Zeichen. Erfrage die Chiffrierung' + (n === 3 ? ' und Phasenlage.' : '.');
            privat[1].blatt = { typ: 'chiffre', paare: alphabet.map((s, i) => [s, zahlen[i]]) };
            privat[1].hinweis = 'Nur du besitzt die Übersetzung. Erfrage die empfangenen Zeichen und bestätige die Ziffernsumme modulo 10.';
            if (n === 3) {
                privat[2].blatt = { typ: 'phase', reihenfolge };
                privat[2].hinweis = 'Nur du kennst die Leserichtung. Die Zahlen bezeichnen Positionen im ursprünglichen Signal. Erfrage danach die erste und letzte Ziffer.';
            }
            antworten = [code.join(''), code.reduce((s, x) => s + x, 0) % 10, ...(n === 3 ? [(2 * code[0] + code[3]) % 10] : [])];
        }
        else if (art === 'schleuse') {
            const werte = Array.from({ length: n }, () => r.zahl(2, 8));
            p = { art, rollen: namen.map((_, i) => 'Ventil ' + String.fromCharCode(65 + i)), anleitung: 'Jede Person bedient genau ihr Ventil. Tauscht eure Messwerte aus und bestimmt die unbekannten ganzzahligen Drücke. Alle Ventile müssen gemeinsam stimmen. Einheit: bar.' };
            privat.forEach((x, i) => {
                const next = (i + 1) % n;
                x.blatt = { typ: 'druck', a: i, b: n === 2 ? 1 : next, art: n === 2 && i === 1 ? 'differenz' : 'summe', wert: n === 2 && i === 1 ? werte[0] - werte[1] : werte[i] + werte[next] };
                if (n === 2)
                    x.blatt.a = 0;
                x.hinweis = 'Dein Messgerät zeigt ' + (x.blatt.art === 'summe' ? 'die Summe zweier Drücke.' : 'die Differenz A minus B, auch wenn sie negativ ist.') + ' Dein eigenes Ventil kannst nur du stellen.';
            });
            antworten = werte;
        }
        else if (art === 'gang') {
            const paths = [];
            function walk(path) {
                const at = path.at(-1);
                if (at === 15) {
                    paths.push(path);
                    return;
                }
                if (at % 4 < 3)
                    walk([...path, at + 1]);
                if (at < 12)
                    walk([...path, at + 4]);
            }
            walk([0]);
            let path, teile;
            for (let versuch = 0; versuch < 200; versuch++) {
                path = r.wahl(paths.filter(a => a.slice(2).filter((x, i) => x - a[i + 1] !== a[i + 1] - a[i]).length >= 2));
                const blocked = r.mischen(Array.from({ length: 16 }, (_, i) => i).filter(i => !path.includes(i)));
                teile = Array.from({ length: n }, (_, i) => blocked.filter((_, j) => j % n === i));
                if (teile.every(t => paths.filter(a => !a.some(x => t.includes(x))).length > 1))
                    break;
            }
            p = { art, groesse: 4, start: 0, ziel: 15, rollen: namen.map((_, i) => 'Sensor ' + (i + 1)), anleitung: 'Eure Sensoren erkennen verschiedene instabile Bodenfelder. Tauscht ALLE Warnungen aus. Plant vom Feld 1 zum Feld 16 einen gemeinsamen Weg über benachbarte Felder. Jede Person fährt denselben Weg auf ihrem eigenen Gerät ab und bestätigt ihn.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'karte', verbot: teile[i] }; x.hinweis = 'Rote Felder sind auf DEINEM Sensor gefährlich. Unmarkierte Felder können auf einem anderen Sensor rot sein. Ein Schritt führt nur waagerecht oder senkrecht.'; });
            antworten = privat.map(() => path);
        }
        else if (art === 'echo') {
            const ziel = r.mischen([0, 1, 2, 3, 4]), cand = [];
            for (let i = 0; i < 5; i++)
                for (let j = i + 1; j < 5; j++)
                    cand.push({ art: 'vor', a: ziel[i], b: ziel[j] });
            for (let i = 0; i < 5; i++)
                for (let j = 0; j < 5; j++)
                    if (ziel[j] !== i)
                        cand.push({ art: 'nicht', a: i, pos: j });
            let rest = ordnungen, regeln = [];
            for (const q of r.mischen(cand)) {
                const z = rest.filter(a => fits(a, q));
                if (z.length < rest.length) {
                    regeln.push(q);
                    rest = z;
                }
                if (rest.length === 1)
                    break;
            }
            let teile;
            for (let v = 0; v < 200; v++) {
                const mix = r.mischen(regeln);
                teile = Array.from({ length: n }, (_, i) => mix.filter((_, j) => j % n === i));
                if (teile.every(t => t.length && ordnungen.filter(a => t.every(q => fits(a, q))).length > 1))
                    break;
            }
            if (!teile.every(t => t.length && ordnungen.filter(a => t.every(q => fits(a, q))).length > 1)) {
                regeln = ziel.slice(1).map((b, i) => ({ art: 'vor', a: ziel[i], b }));
                teile = Array.from({ length: n }, (_, i) => regeln.filter((_, j) => j % n === i));
            }
            const karten = ['Die leere Flasche', 'Der Vogel im Raum', 'Die zweite Schattenkante', 'Die stehende Uhr', 'Die Hand am Glas'];
            p = { art, karten, rollen: namen.map((_, i) => 'Archivspur ' + (i + 1)), anleitung: 'Fünf Aufnahmen zeigen dasselbe Experiment. Ihre Zeitstempel sind gefälscht. Nur eure getrennten Beobachtungen bleiben wahr. Ordnet alle fünf Aufnahmen vom frühesten zum spätesten Ereignis. Jede Person bestätigt dieselbe Reihenfolge.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'regeln', regeln: teile[i].map(q => ({ ...q, text: q.art === 'vor' ? '„' + karten[q.a] + '“ geschah vor „' + karten[q.b] + '“.' : '„' + karten[q.a] + '“ war nicht die ' + (q.pos + 1) + '. Aufnahme.' })) }; x.hinweis = 'Deine Beobachtungen allein reichen nicht für eine eindeutige Reihenfolge. Notiert auch die Aussagen eurer Partner.'; });
            antworten = privat.map(() => ziel);
        }
        else if (art === 'strom') {
            const start = Array.from({ length: n * 2 }, () => r.zahl(0, 4)), drehungen = Array.from({ length: n * 2 }, () => r.zahl(0, 4)), ziel = start.map((v, i) => (v + drehungen[i] + (i ? drehungen[i - 1] : 0)) % 5);
            p = { art, start, anzahl: n * 2, rollen: namen.map((_, i) => 'Stellglied ' + (i * 2 + 1) + ' / ' + (i * 2 + 2)), anleitung: 'Jede Drehung erhöht die eigene Anzeige UND die unmittelbar rechts daneben um 1, nach 4 folgt 0. Stellglieder gehören paarweise zu euch. Die Zielanzeigen deines Paares liegen bei einer anderen Person. Beginnt links und gleicht die Anzeigen der Reihe nach ab. Eingabe: Drehungen ab der Ausgangslage.' };
            privat.forEach((x, i) => { const next = (i + 1) % n; x.blatt = { typ: 'schaltung', eigene: [i * 2, i * 2 + 1], fuer: namen[next], ziele: [{ index: next * 2, wert: ziel[next * 2] }, { index: next * 2 + 1, wert: ziel[next * 2 + 1] }] }; x.hinweis = 'Du besitzt das Kalibrierblatt für ' + namen[next] + '. Die beiden eigenen Zielwerte musst du erfragen. Berücksichtigt auch die Drehung am vorherigen Stellglied.'; });
            antworten = privat.map((_, i) => drehungen.slice(i * 2, i * 2 + 2));
        }
        else if (art === 'anker') {
            const folgen = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 3)));
            p = { art, symbole: ['KREIS', 'DREIECK', 'WELLE', 'STERN'], runden: 4, fenster: ({ leicht: 35, mittel: 30, schwer: 24, experte: 20 })[stufe], rollen: namen.map((_, i) => 'Anker ' + (i + 1)), anleitung: 'Die Handlungsfolge für deinen Anker liegt bei einer anderen Person. Sprecht euch VOR dem Start ab. Alle melden Bereitschaft; dann beginnt ein großzügiges Zeitfenster. Pro Impuls gibt jede Person ihr eigenes Zeichen ein. Vier gemeinsam richtige Impulse halten den Übergang offen. Bei einem Fehler startet die Folge neu.' };
            privat.forEach((x, i) => { const next = (i + 1) % n; x.blatt = { typ: 'impulse', fuer: namen[next], folge: folgen[next] }; x.hinweis = 'Diese vier Zeichen gehören zu ' + namen[next] + ', nicht zu dir. Erfrage deine eigene Folge bei einem anderen Gruppenmitglied. Kein Geräusch muss erkannt werden.'; });
            antworten = folgen;
        }
        else if (art === 'zeugen') {
            const bits = [r.zahl(0, 1), r.zahl(0, 1), r.zahl(0, 1)], ziel = bits[0] * 4 + bits[1] * 2 + bits[2];
            const felder = [['Zeitanker', ['18:42', '18:43']], ['Schattenrichtung', ['zur Tür', 'zum Fenster']], ['Kondensat', ['außen am Glas', 'innen am Glas']]];
            p = { art, rollen: namen.map((_, i) => 'Unabhängiger Zeuge ' + (i + 1)), felder: felder.map(x => x[0]), quellen: Array.from({ length: 8 }, (_, i) => ({ id: i, name: 'Kanal ' + String.fromCharCode(65 + i), werte: felder.map((f, j) => f[1][(i >> (2 - j)) & 1]) })), anleitung: 'Acht Kanäle behaupten, Nika zu sein. Nur einer erfüllt ALLE unabhängigen Beobachtungen. Tauscht eure Originalmerkmale aus und bestätigt gemeinsam denselben Kanal. Eine überzeugende Stimme ist kein Beweis.' };
            privat.forEach((x, i) => { const indices = n === 2 ? (i === 0 ? [0, 1] : [2]) : [i % 3]; x.blatt = { typ: 'zeuge', merkmale: indices.map(j => ({ feld: felder[j][0], wert: felder[j][1][bits[j]] })) }; x.hinweis = 'Diese Beobachtung stammt von deinem unabhängigen Sensor. Andere Personen haben andere Merkmale. Zusammen bleibt genau ein Originalsignal.'; });
            antworten = privat.map(() => ziel);
        }
        else if (art === 'nullpunkt') {
            const fragmente = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 9)));
            const code = Array.from({ length: 4 }, (_, j) => fragmente.reduce((s, f) => s + f[j], 0) % 10).join('');
            p = { art, rollen: namen.map((_, i) => 'Referenz ' + (i + 1)), stellen: 4, anleitung: 'Jede Person besitzt einen eigenen, nötigen Messstreifen. Addiert spaltenweise ALLE Streifen und behaltet jeweils nur die letzte Ziffer. Die vier Ziffern bilden eure gemeinsame Kontur. Jede Person muss diese Kontur an ihrem eigenen Referenzplatz bestätigen.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'fragment', ziffern: fragmente[i] }; x.hinweis = 'Dein Streifen gehört ausschließlich zu deiner Perspektive. Lest die vier Spalten nacheinander vor und berücksichtigt jede Person genau einmal. Ein fehlender Streifen macht die Kontur unbestimmt.'; });
            antworten = privat.map(() => code);
        }
        else
            throw new Error('Unbekannte JANUS-Aufgabe: ' + art);
        return { p, privat, antworten };
    }
    function normal(art, rolle, a) {
        if ((art === 'funk' && rolle === 0) || art === 'nullpunkt')
            return typeof a === 'string' && /^\d{4}$/.test(a) ? a : null;
        if (['gang', 'echo', 'strom'].includes(art)) {
            const n = art === 'gang' ? 7 : art === 'echo' ? 5 : 2, max = art === 'gang' ? 15 : 4;
            return Array.isArray(a) && a.length === n && a.every(v => Number.isInteger(v) && v >= 0 && v <= max) ? a : null;
        }
        return Number.isInteger(a) && a >= 0 && a <= (art === 'schleuse' ? 16 : art === 'zeugen' ? 7 : art === 'anker' ? 3 : 9) ? a : null;
    }
    function pruefen(aufgabe, werte, impuls = 0) { return werte.length === aufgabe.antworten.length && werte.every((v, i) => { const a = normal(aufgabe.p.art, i, v); return a !== null && eq(a, aufgabe.p.art === 'anker' ? aufgabe.antworten[i][impuls] : aufgabe.antworten[i]); }); }
    return { gruppen, bauen, pruefen, normal, ordnungen, fits };
})();
