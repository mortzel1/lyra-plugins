'use strict';
/* Nur beim Host: zwölf asymmetrische Bankoperationen. Kein realer Sicherheits- oder Bankablauf. */
const ClavisBankLogik = (() => {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b), mod = (a, n) => (a % n + n) % n;
    const bits = ['KREIS', 'RAUTE', 'WELLE', 'STERN'];
    const gruppe = (ids, seed) => {
        if (!Array.isArray(ids) || ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length)
            throw Error('Zwei bis acht aktive Personen erforderlich.');
        const r = Clavis.zufall(seed), a = r.mischen(ids), out = [];
        while (a.length) {
            const k = a.length === 2 ? 2 : a.length === 3 ? 3 : a.length === 4 ? 2 : r.wahl([2, 3]);
            out.push(a.splice(0, k));
        }
        return out;
    };
    function drehen(mask, n = 1) {
        for (let t = 0; t < n; t++) {
            let out = 0;
            for (let i = 0; i < 9; i++)
                if (mask & (1 << i))
                    out |= 1 << ((i % 3) * 3 + 2 - Math.floor(i / 3));
            mask = out;
        }
        return mask;
    }
    const sudokus = [];
    function sudoku(a = []) {
        if (a.length === 16) {
            sudokus.push(a);
            return;
        }
        const at = a.length, row = Math.floor(at / 4), col = at % 4;
        for (let v = 1; v <= 4; v++) {
            let ok = true;
            for (let i = 0; i < at; i++)
                if (a[i] === v && (Math.floor(i / 4) === row || i % 4 === col || Math.floor(i / 8) === Math.floor(row / 2) && Math.floor((i % 4) / 2) === Math.floor(col / 2))) {
                    ok = false;
                    break;
                }
            if (ok)
                sudoku([...a, v]);
        }
    }
    sudoku();
    const mono = [];
    function pfad(a = [0]) {
        const x = a.at(-1);
        if (x === 24) {
            mono.push(a);
            return;
        }
        if (x % 5 < 4)
            pfad([...a, x + 1]);
        if (x < 20)
            pfad([...a, x + 5]);
    }
    pfad();
    function bauen(art, personen, seed, stufe = 'schwer', wahl = {}) {
        const r = Clavis.zufall(seed), n = personen.length, namen = personen.map(p => p.name), privat = personen.map((p, i) => ({ rolle: i, name: p.name, partner: namen, hinweis: '', blatt: {} }));
        let p = { art }, antworten = [], extra = {};
        if (art === 'legende') {
            const merkmale = [['Material', ['SCHWARZ', 'ELFENBEIN']], ['Rand', ['GLATT', 'GERIFFELT']], ['Prüfmarke', ['KREIS', 'RAUTE']], ['Prägung', ['OBEN', 'UNTEN']]], ziel = r.zahl(0, 15);
            p = { art, rollen: namen.map((_, i) => 'Prüfspur ' + (i + 1)), felder: merkmale.map(m => m[0]), karten: Array.from({ length: 16 }, (_, i) => ({ id: i, titel: 'Legende ' + String.fromCharCode(65 + i), werte: merkmale.map((m, j) => m[1][(i >> (3 - j)) & 1]) })), anleitung: 'Sechzehn fiktive Dienstlegenden. Nur eine erfüllt sämtliche Prüfmerkmale. Jeder sieht einen anderen Teil der echten Beschreibung. Vergleicht eure Blätter und bestätigt alle dieselbe Karte.' };
            privat.forEach((x, i) => { const own = Array.from({ length: 4 }, (_, j) => j).filter(j => j % n === i); x.blatt = { typ: 'merkmale', zeilen: own.map(j => ({ feld: merkmale[j][0], wert: merkmale[j][1][(ziel >> (3 - j)) & 1] })) }; x.hinweis = 'Deine Beschreibung allein lässt mehrere Karten übrig. Keine der anderen Personen sieht diese Merkmale.'; });
            antworten = privat.map(() => ziel);
        }
        else if (art === 'bilanz') {
            const basis = Array.from({ length: n * 2 }, () => r.zahl(0, 9)), zeilen = privat.map(() => Array.from({ length: n * 2 }, () => r.zahl(-4, 4))), ziel = basis.map((v, i) => mod(v + zeilen.reduce((s, z) => s + z[i], 0), 10));
            p = { art, basis, rollen: namen.map((_, i) => 'Buchwerk ' + (i * 2 + 1) + ' / ' + (i * 2 + 2)), anleitung: 'Jede Person besitzt eine andere Buchungszeile. Addiert für jede Spalte die Ausgangsziffer und ALLE signierten Änderungen. Behaltet nur die letzte Ziffer; bei negativen Ergebnissen zählt ihr 10 hinzu. Jede Person stellt nur ihre zwei Buchwerke.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'bilanz', aenderungen: zeilen[i], eigene: [i * 2, i * 2 + 1] }; x.hinweis = 'Deine Änderungen gelten für alle Buchwerke. Für deine eigenen Ziffern fehlen dir die Änderungen der anderen.'; });
            antworten = privat.map((_, i) => ziel.slice(i * 2, i * 2 + 2));
        }
        else if (art === 'blickfeld') {
            const start = Array.from({ length: n * 3 }, () => r.zahl(0, 1)), toggles = Array.from({ length: n * 3 }, () => r.zahl(0, 1)), ziel = start.map((v, i) => v ^ toggles[i] ^ (i ? toggles[i - 1] : 0));
            p = { art, start, rollen: namen.map((_, i) => 'Lichtbus ' + (i * 3 + 1) + '–' + (i * 3 + 3)), anleitung: 'Ein Schalter kippt die eigene Lampe UND die direkt rechts daneben. Der letzte kippt nur sich selbst. Jede Person besitzt drei Schalter. Deine Zielanzeigen liegen auf einem anderen Bildschirm. Rechnet von links nach rechts und bestätigt die eigenen drei Schalterstellungen.' };
            privat.forEach((x, i) => { const next = (i + 1) % n; x.blatt = { typ: 'lichtbus', eigene: [i * 3, i * 3 + 1, i * 3 + 2], fuer: namen[next], ziele: ziel.slice(next * 3, next * 3 + 3), ab: next * 3 }; x.hinweis = '0 bedeutet Ausgangsschalter unberührt; 1 bedeutet einmal kippen. Du kennst das Ziel eines anderen Lichtbusses. Erfrage dein eigenes.'; });
            antworten = privat.map((_, i) => toggles.slice(i * 3, i * 3 + 3));
        }
        else if (art === 'chronos') {
            const werte = Array.from({ length: n }, () => r.zahl(0, 12));
            p = { art, rollen: namen.map((_, i) => 'Takt ' + String.fromCharCode(65 + i)), anleitung: 'Die Bank misst hier keine Uhrzeit, sondern dreizehn Zustände von 0 bis 12. Jede Gleichung gilt modulo 13. Tauscht die Messungen aus und stellt den eigenen Takt. Negative Werte erhalten +13, Werte ab 13 verlieren 13.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'takt', a: n === 2 ? 0 : i, b: n === 2 ? 1 : (i + 1) % n, minus: n === 2 && i === 1, wert: mod(n === 2 && i === 1 ? werte[0] - werte[1] : werte[i] + werte[(i + 1) % n], 13) }; x.hinweis = 'Eine einzelne Taktgleichung ist mehrdeutig. Erst die Messung der anderen Person oder die drei gemeinsamen Messungen bestimmen die Takte.'; });
            antworten = werte;
        }
        else if (art === 'rohrpost') {
            const fragmente = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 9))), siegel = Array.from({ length: 4 }, (_, j) => fragmente.reduce((s, a) => s + a[j], 0) % 10).join('');
            p = { art, rollen: namen.map((_, i) => 'Empfang ' + (i + 1)), partnerGruppe: null, anleitung: 'Addiert eure privaten Sendestreifen spaltenweise und behaltet je die letzte Ziffer: Das ist EUER Sendesiegel. Tauscht es über den Teamfunk mit der bezeichneten Partnergruppe. Gebt deren vier Ziffern ein, beginnend an eurer persönlichen Startposition. Bei nur einer Gruppe verwendet ihr das eigene Siegel.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'sendestreifen', fragment: fragmente[i], start: i % 4 }; x.hinweis = 'Erst euer Siegel gemeinsam bestimmen und an die Partnergruppe senden. Deine Startposition dreht die vier EMPFANGENEN Ziffern; sie verändert nicht euer Sendesiegel.'; });
            extra.eigenesSiegel = siegel;
            antworten = privat.map((_, i) => (siegel + siegel).slice(i % 4, i % 4 + 4));
        }
        else if (art === 'praegung') {
            let masken, rot, ziel, loesungen;
            for (let tries = 0; tries < 300; tries++) {
                masken = privat.map(() => {
                    let m;
                    do {
                        m = r.zahl(1, 510);
                    } while (new Set([0, 1, 2, 3].map(k => drehen(m, k))).size < 4);
                    return m;
                });
                rot = privat.map(() => r.zahl(0, 3));
                ziel = masken.reduce((s, m, i) => s ^ drehen(m, rot[i]), 0);
                loesungen = [];
                const search = (a = []) => {
                    if (a.length === n) {
                        if (masken.reduce((s, m, i) => s ^ drehen(m, a[i]), 0) === ziel)
                            loesungen.push(a);
                        return;
                    }
                    for (let k = 0; k < 4; k++)
                        search([...a, k]);
                };
                search();
                if (loesungen.length === 1)
                    break;
            }
            if (loesungen.length !== 1)
                throw Error('Kein eindeutiges Prägesiegel.');
            p = { art, rollen: namen.map((_, i) => 'Stempel ' + (i + 1)), anleitung: 'Jede Person besitzt einen eigenen 3×3-Stempel. Dreht ihn im Uhrzeigersinn. Alle Stempel werden übereinandergelegt: Ein Feld leuchtet, wenn es auf einer ungeraden Zahl der gedrehten Stempel offen ist (XOR). Die neun geforderten Zielfelder liegen auf euren getrennten Blättern. Nur eine gemeinsame Drehung passt.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'stempel', maske: masken[i], ziele: Array.from({ length: 9 }, (_, j) => j).filter(j => j % n === i).map(j => ({ feld: j, an: !!(ziel & (1 << j)) })) }; x.hinweis = 'Beschreibe die offenen Felder deines Stempels über die Nummern 1–9. Ein Feld mit zwei Überlagerungen ist wieder dunkel. Die Zielvorgaben aller Personen gelten gleichzeitig.'; });
            antworten = rot;
            extra.eindeutig = loesungen.length;
        }
        else if (art === 'lasten') {
            const teile = privat.map(() => r.zahl(15, 47)), zusatz = ({ gold: 42, platten: 24, buch: 9 })[wahl.beute] ?? 24, target = teile.reduce((s, v) => s + v, 0) + zusatz, gewichte = [1, 3, 9, 27, 81, 243], digits = [];
            let value = target;
            for (let i = 0; i < 6; i++) {
                let d = mod(value, 3);
                if (d === 2)
                    d = -1;
                digits.push(d);
                value = (value - d) / 3;
            }
            p = { art, gewichte, zusatz, rollen: namen.map((_, i) => 'Lastseil ' + (i + 1)), anleitung: 'Die gesamte Last besteht aus ALLEN privaten Teilmassen plus der bekannten Beute-Zuladung. Jede Person bedient nur ihre zugeteilten Gewichte. Gegenseil ist +1, unbenutzt 0, Lastkorb −1. Die Summe der gewichteten Stellungen muss die gesamte Last ausgleichen.' };
            privat.forEach((x, i) => { const eigene = gewichte.map((_, j) => j).filter(j => j % n === i); x.blatt = { typ: 'gewicht', teilmasse: teile[i], eigene }; x.hinweis = 'Deine Teilmasse ist nur ein Anteil. Erfrage die anderen und addiere die Zuladung von ' + zusatz + ' kg. Ein Gewicht kann auch in den Lastkorb.'; });
            antworten = privat.map((_, i) => digits.filter((_, j) => j % n === i));
            extra.last = target;
        }
        else if (art === 'register') {
            const ziel = r.wahl(sudokus), alle = r.mischen(Array.from({ length: 16 }, (_, i) => i));
            let gegeben = alle.slice();
            for (const at of alle) {
                const next = gegeben.filter(i => i !== at);
                if (sudokus.filter(a => next.every(i => a[i] === ziel[i])).length === 1)
                    gegeben = next;
            }
            p = { art, rollen: namen.map((_, i) => 'Registerzeile ' + (i + 1)), anleitung: 'Vier Zeilen, vier Spalten, vier 2×2-Fächer. Jede enthält 1,2,3,4 genau einmal. Die echten Einträge sind auf eure privaten Blätter verteilt. Rekonstruiert das gesamte Register. Jede Person bestätigt nur ihre eigenen Zeilen.' };
            const mix = r.mischen(gegeben);
            privat.forEach((x, i) => { x.blatt = { typ: 'register', gegeben: mix.filter((_, j) => j % n === i).map(feld => ({ feld, wert: ziel[feld] })), zeilen: [0, 1, 2, 3].filter(j => j % n === i) }; x.hinweis = 'Deine bekannten Einträge stehen nicht nur in deinen eigenen Zeilen. Teilt alle bestätigten Werte; jedes leere Feld hat genau eine gemeinsame Lösung.'; });
            antworten = privat.map(x => x.blatt.zeilen.flatMap(row => ziel.slice(row * 4, row * 4 + 4)));
            extra.eindeutig = sudokus.filter(a => gegeben.every(i => a[i] === ziel[i])).length;
        }
        else if (art === 'taktwerk') {
            const folgen = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 3)));
            p = { art, symbole: bits, runden: 4, fenster: ({ leicht: 30, mittel: 25, schwer: 20, experte: 16 })[stufe], rollen: namen.map((_, i) => 'Kontakt ' + (i + 1)), anleitung: 'Du hast die vier Zeichen für einen ANDEREN Kontakt. Gebt die Folgen weiter, bevor ihr Bereitschaft meldet. Danach bestätigt pro Impuls jede Person ihr eigenes Zeichen. Vier richtige gemeinsame Impulse öffnen den Steg. Das sichtbare Zeitfenster gilt für jeden Impuls neu.' };
            privat.forEach((x, i) => { const next = (i + 1) % n; x.blatt = { typ: 'folge', fuer: namen[next], folge: folgen[next] }; x.hinweis = 'Diese Folge gehört ' + namen[next] + '. Deine eigene liegt bei einer anderen Person. Nach dem geschützten Salon können fehlende oder falsche Beiträge zu Festnahmen führen.'; });
            antworten = folgen;
        }
        else if (art === 'messboden') {
            let ziel, teile;
            for (let tries = 0; tries < 300; tries++) {
                ziel = r.wahl(mono.filter(a => a.slice(2).filter((x, i) => x - a[i + 1] !== a[i + 1] - a[i]).length >= 3));
                const verboten = r.mischen(Array.from({ length: 25 }, (_, i) => i).filter(i => !ziel.includes(i)));
                teile = privat.map((_, i) => verboten.filter((_, j) => j % n === i));
                if (teile.every(t => mono.filter(a => !a.some(x => t.includes(x))).length > 1))
                    break;
            }
            p = { art, groesse: 5, rollen: namen.map((_, i) => 'Messkanal ' + (i + 1)), anleitung: 'Jeder Sensor sieht andere verbotene Felder. Vereint ALLE Warnungen. Der sichere Weg führt von 1 nach 25 durch neun Felder inklusive Start und Ziel, nur über waagerechte oder senkrechte Nachbarn. Jede Person muss denselben Weg bestätigen.' };
            privat.forEach((x, i) => { x.blatt = { typ: 'boden', verbot: teile[i] }; x.hinweis = 'Ein freies Feld auf deinem Gerät kann für einen anderen Sensor gefährlich sein. Plant den ganzen Weg, bevor ihr ihn gemeinsam bestätigt.'; });
            antworten = privat.map(() => ziel);
        }
        else if (art === 'reserve') {
            const fragmente = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 9))), schluessel = privat.map(() => Array.from({ length: 4 }, () => r.zahl(0, 9))), sum = Array.from({ length: 4 }, (_, j) => fragmente.reduce((s, x) => s + x[j], 0) % 10);
            p = { art, rollen: namen.map((_, i) => 'Reserveplatz ' + (i + 1)), anleitung: 'Addiert die Fragmente ALLER aktiven Personen spaltenweise, letzte Ziffer zählt. Das ergibt die gemeinsame Basis. Jede Person addiert danach ihren eigenen vierstelligen Schlüssel ebenfalls spaltenweise modulo 10. Dein Schlüssel liegt bei einer anderen Person. Deshalb hat jeder einen eigenen Abschlusscode.' };
            privat.forEach((x, i) => { const next = (i + 1) % n; x.blatt = { typ: 'reserve', fragment: fragmente[i], fuer: namen[next], schluessel: schluessel[next] }; x.hinweis = 'Dein Fragment ist für die gemeinsame Basis nötig. Dein Blatt enthält außerdem den Schlüssel von ' + namen[next] + '. Den eigenen musst du erfragen.'; });
            antworten = privat.map((_, i) => sum.map((v, j) => (v + schluessel[i][j]) % 10).join(''));
        }
        else if (art === 'flucht') {
            const order = r.mischen(Array.from({ length: n }, (_, i) => i)), codes = privat.map(() => r.zahl(0, 3));
            p = { art, symbole: bits, fenster: ({ leicht: 35, mittel: 30, schwer: 25, experte: 20 })[stufe], rollen: namen.map((_, i) => 'Fluchtriegel ' + (i + 1)), anleitung: 'Ihr bildet eine einzige Riegelkette. Jede Person kennt ihre Vorgängerperson und das Zeichen einer anderen. Rekonstruiert die Reihenfolge vor dem Scharfstellen. Dann zieht jeder seinen eigenen Riegel im richtigen Moment mit dem richtigen Zeichen. Nach jedem richtigen Riegel beginnt ein neues sichtbares Zeitfenster.' };
            privat.forEach((x, i) => { const pos = order.indexOf(i), next = (i + 1) % n; x.blatt = { typ: 'kette', vorgaenger: pos ? namen[order[pos - 1]] : null, fuer: namen[next], zeichen: codes[next] }; x.hinweis = pos ? 'Dein Riegel folgt unmittelbar auf ' + namen[order[pos - 1]] + '.' : 'Du bist der Anfang der Kette. Dein eigenes Zeichen liegt trotzdem bei jemand anderem.'; });
            antworten = codes;
            extra.reihenfolge = order;
        }
        else
            throw Error('Unbekannte Operation ' + art);
        return { p, privat, antworten, ...extra };
    }
    function verbinden(gruppen, cache) {
        gruppen.forEach((g, i) => {
            const q = cache[g.id];
            if (q.p.art !== 'rohrpost')
                return;
            const j = gruppen.length === 1 ? i : (i + 1) % gruppen.length, seal = cache[gruppen[j].id].eigenesSiegel;
            q.p.partnerGruppe = j + 1;
            q.antworten = g.ids.map((_, role) => (seal + seal).slice(role % 4, role % 4 + 4));
        });
    }
    function normal(q, rolle, a) {
        const art = q.p.art, b = q.privat[rolle]?.blatt;
        if (!b)
            return null;
        if (['rohrpost', 'reserve'].includes(art))
            return typeof a === 'string' && /^\d{4}$/.test(a) ? a : null;
        const specs = { bilanz: [2, 0, 9], blickfeld: [3, 0, 1], lasten: [b.eigene?.length, -1, 1], register: [b.zeilen?.length * 4, 1, 4], messboden: [9, 0, 24] };
        if (specs[art]) {
            const [len, lo, hi] = specs[art];
            return Array.isArray(a) && a.length === len && a.every(v => Number.isInteger(v) && v >= lo && v <= hi) ? a : null;
        }
        const max = { legende: 15, chronos: 12, praegung: 3, taktwerk: 3, flucht: 3 }[art];
        return Number.isInteger(a) && a >= 0 && a <= max ? a : null;
    }
    const pruefen = (q, werte, runde = 0) => werte.length === q.antworten.length && werte.every((a, i) => normal(q, i, a) !== null && eq(a, q.p.art === 'taktwerk' ? q.antworten[i][runde] : q.antworten[i]));
    const falsch = (q, werte, runde = 0) => werte.map((a, i) => !eq(a, q.p.art === 'taktwerk' ? q.antworten[i][runde] : q.antworten[i]));
    return { bauen, verbinden, normal, pruefen, falsch, gruppe, drehen, sudokus };
})();
