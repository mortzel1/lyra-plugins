'use strict';
/* Mercy Creek: zehn deterministische Mechanismen. Ohne DOM; Prüfung ausschließlich beim Host. */
(() => {
    const F = Clavis.FrontierLogik = {}, ints = (a, n, lo, hi) => Array.isArray(a) && a.length === n && a.every(x => Number.isInteger(x) && x >= lo && x <= hi), perm = (a, n) => ints(a, n, 0, n - 1) && new Set(a).size === n, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b), DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    F.drehen = (mask, n) => ((mask << n) | (mask >> (4 - n))) & 15;
    F.fahrt = (p, a) => { const route = ['A']; let at = 'A'; for (let i = 0; i < 9; i++) {
        const j = p.ids.indexOf(at);
        if (j < 0)
            return route;
        at = p.kanten[j][a[j]];
        route.push(at);
    } return route; };
    F.windenLast = w => 87 + (w.mara === 'retten' ? 54 : 0) + (w.gold === 'nehmen' ? 18 : 0);
    F.bauen = (stufe, seed) => {
        const r = Clavis.zufall(seed), schwierig = ['leicht', 'mittel', 'schwer', 'experte'].indexOf(stufe), p = {}, g = {};
        const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'], kanten = [['B', 'C'], ['D', 'E'], ['E', 'F'], ['F', 'G'], ['G', 'T'], ['T', 'R'], ['T', 'R']].map(a => r.mischen(a));
        p.weiche = { art: 'weiche', ids, kanten, namen: { A: 'Einfahrt', B: 'Waage', C: 'Erzrampe', D: 'Abstellgleis', E: 'Wasserturm', F: 'Bruchbrücke', G: 'Prüfposten', T: 'Mercy Creek', R: 'Felssturz' }, pflicht: ['B', 'E', 'G'], verbot: 'F' };
        g.weiche = ids.map((id, i) => Math.max(0, kanten[i].indexOf(({ A: 'B', B: 'E', E: 'G', G: 'T' })[id] || kanten[i][0])));
        const zeichen = r.mischen(['MOND', 'KREUZ', 'RAUTE', 'RAD', 'STERN', 'AUGE', 'BERG']);
        const rollen = r.mischen(Array.from({ length: 6 }, (_, i) => ({ a: zeichen[i], b: zeichen[i + 1], nr: i }))).map(x => r() > .5 ? { ...x, a: x.b, b: x.a, um: true } : { ...x, um: false });
        p.pianola = { art: 'pianola', anfang: zeichen[0], ende: zeichen[6], teile: rollen.map(({ nr, um, ...x }) => x) };
        g.pianola = Array.from({ length: 6 }, (_, i) => { const at = rollen.findIndex(x => x.nr === i); return { i: at, flip: rollen[at].um }; });
        const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ', wort = r.wahl(['SIEGEL', 'SCHULD', 'STIMME', 'GRABEN']);
        p.depesche = { art: 'depesche', quadrat: Array.from({ length: 5 }, (_, i) => alphabet.slice(i * 5, i * 5 + 5)), folge: [...wort].map(c => { const i = alphabet.indexOf(c === 'J' ? 'I' : c); return `${Math.floor(i / 5) + 1}${i % 5 + 1}`; }), hinweis: 'Erst die Zeile, dann die Spalte. I und J teilen sich ein Feld.', laenge: wort.length };
        g.depesche = wort;
        const start = Array.from({ length: 4 }, () => r.zahl(0, 9)), moves = Array.from({ length: 4 }, () => r.zahl(1, 8)), ziel = start.slice();
        moves.forEach((n, i) => { ziel[i] = (ziel[i] + n) % 10; if (i < 3)
            ziel[i + 1] = (ziel[i + 1] + n) % 10; });
        p.tresor = { art: 'tresor', start, ziel, regel: 'Ein Rad dreht sich selbst und das unmittelbar rechts benachbarte Rad weiter. Das rechte Rad dreht nur sich selbst.' };
        g.tresor = moves;
        const paths = [];
        function walk(path) { if (path.length === 9) {
            if (path[8] === 8)
                paths.push(path);
            return;
        } for (const [dx, dy] of DIR) {
            const at = path.at(-1), x = at % 3 + dx, y = Math.floor(at / 3) + dy, k = y * 3 + x;
            if (x >= 0 && x < 3 && y >= 0 && y < 3 && !path.includes(k))
                walk([...path, k]);
        } }
        walk([0]);
        const path = r.wahl(paths), mask = new Array(9).fill(0), direction = (a, b) => b === a - 3 ? 0 : b === a + 1 ? 1 : b === a + 3 ? 2 : 3;
        path.forEach((at, i) => { mask[at] |= 1 << (i ? direction(at, path[i - 1]) : 3); mask[at] |= 1 << (i === 8 ? 1 : direction(at, path[i + 1])); });
        const rot = mask.map(() => r.zahl(0, 3));
        p.pumpen = { art: 'pumpen', teile: mask.map((m, i) => F.drehen(m, rot[i])), groesse: 3 };
        g.pumpen = rot.map(n => (4 - n) % 4);
        p.winde = { art: 'winde', gewichte: [1, 3, 9, 27, 81, 243], basis: 87 };
        g.winde = null;
        const size = schwierig >= 2 ? 5 : 4, walls = Array.from({ length: size * size }, () => 15), seen = new Set([0]);
        function maze(at) { for (const d of r.mischen([0, 1, 2, 3])) {
            const x = at % size + DIR[d][0], y = Math.floor(at / size) + DIR[d][1], to = y * size + x;
            if (x < 0 || y < 0 || x >= size || y >= size || seen.has(to))
                continue;
            seen.add(to);
            walls[at] &= ~(1 << d);
            walls[to] &= ~(1 << ((d + 2) % 4));
            maze(to);
        } }
        maze(0);
        function find(at, target, prev = -1) { if (at === target)
            return [at]; for (let d = 0; d < 4; d++)
            if (!(walls[at] & (1 << d))) {
                const to = at + DIR[d][0] + DIR[d][1] * size;
                if (to !== prev) {
                    const rest = find(to, target, at);
                    if (rest)
                        return [at, ...rest];
                }
            } return null; }
        const route = find(0, size * size - 1);
        p.stollen = { art: 'stollen', groesse: size, waende: walls, ziel: size * size - 1, marken: [route[Math.floor(route.length / 3)], route[Math.floor(route.length * 2 / 3)]], max: route.length + (schwierig === 3 ? 4 : 12) };
        g.stollen = route;
        const namen = r.mischen(['Jonah Reed', 'Esther Cole', 'Luis Ortega', 'Otto Brandt', 'Amos Bell']), ordnung = r.mischen([0, 1, 2, 3, 4]), regeln = [];
        const perms = a => a.length ? a.flatMap(x => perms(a.filter(y => y !== x)).map(b => [x, ...b])) : [[]], alle = perms([0, 1, 2, 3, 4]), candidates = [];
        for (let i = 0; i < 5; i++)
            for (let j = i + 1; j < 5; j++)
                candidates.push({ art: 'vor', a: ordnung[i], b: ordnung[j] });
        for (let i = 0; i < 5; i++)
            for (let j = 0; j < 5; j++)
                if (ordnung[j] !== i)
                    candidates.push({ art: 'nicht', a: i, pos: j });
        const fits = (a, q) => q.art === 'vor' ? a.indexOf(q.a) < a.indexOf(q.b) : a[q.pos] !== q.a;
        let verbleibend = alle;
        for (const q of r.mischen(candidates)) {
            if (verbleibend.length === 1)
                break;
            const next = verbleibend.filter(a => fits(a, q));
            if (next.length < verbleibend.length) {
                regeln.push(q);
                verbleibend = next;
            }
        }
        p.schichten = { art: 'schichten', namen, regeln: regeln.map(q => ({ ...q, text: q.art === 'vor' ? `${namen[q.a]} fuhr vor ${namen[q.b]} ein.` : `${namen[q.a]} gehörte nicht zur ${q.pos + 1}. Gruppe.` })), gruppen: 5 };
        g.schichten = ordnung;
        p.sprengung = { art: 'sprengung', knoten: ['EIN', 'A', 'B', 'C', 'D', 'HERZ', 'LUFT', 'AUS'], leitungen: [['EIN', 'A'], ['A', 'B'], ['B', 'HERZ'], ['A', 'C'], ['C', 'D'], ['D', 'HERZ'], ['C', 'LUFT'], ['D', 'AUS'], ['B', 'D']], trenner: 2 };
        g.sprengung = [2, 5];
        const motif = r.mischen([0, 1, 2, 3]);
        p.glocke = { art: 'glocke', namen: ['BERG', 'STERN', 'RAD', 'MOND'], motiv: motif, laenge: 6, regel: 'Spiele die vier Zeichen der Pianola rückwärts. Dann das zweite Zeichen des Originals. Zuletzt das erste. Erst danach den Riegel ziehen.' };
        g.glocke = [...motif.slice().reverse(), motif[1], motif[0]];
        return { p, geheim: g };
    };
    F.pruefen = (id, p, g, a, wahl = {}) => {
        switch (id) {
            case 'weiche': {
                if (!ints(a, 7, 0, 1))
                    return false;
                const route = F.fahrt(p, a);
                return route.at(-1) === 'T' && !route.includes(p.verbot) && p.pflicht.every(x => route.includes(x));
            }
            case 'pianola': {
                if (!Array.isArray(a) || a.length !== 6 || !perm(a.map(x => x?.i), 6) || a.some(x => typeof x.flip !== 'boolean'))
                    return false;
                let at = p.anfang;
                for (const x of a) {
                    const t = p.teile[x.i], l = x.flip ? t.b : t.a, r = x.flip ? t.a : t.b;
                    if (l !== at)
                        return false;
                    at = r;
                }
                return at === p.ende;
            }
            case 'depesche': return typeof a === 'string' && Clavis.norm(a) === g;
            case 'tresor': {
                if (!ints(a, 4, 0, 9))
                    return false;
                const z = p.start.slice();
                a.forEach((n, i) => { z[i] = (z[i] + n) % 10; if (i < 3)
                    z[i + 1] = (z[i + 1] + n) % 10; });
                return eq(z, p.ziel);
            }
            case 'pumpen': {
                if (!ints(a, 9, 0, 3))
                    return false;
                const m = p.teile.map((v, i) => F.drehen(v, a[i]));
                if (!(m[0] & 8) || !(m[8] & 2))
                    return false;
                const seen = new Set(), queue = [0];
                while (queue.length) {
                    const at = queue.pop();
                    if (seen.has(at))
                        continue;
                    seen.add(at);
                    for (let d = 0; d < 4; d++)
                        if (m[at] & (1 << d)) {
                            const x = at % 3 + DIR[d][0], y = Math.floor(at / 3) + DIR[d][1], to = y * 3 + x;
                            if (x < 0 || y < 0 || x >= 3 || y >= 3) {
                                if (!((at === 0 && d === 3) || (at === 8 && d === 1)))
                                    return false;
                            }
                            else {
                                if (!(m[to] & (1 << ((d + 2) % 4))))
                                    return false;
                                queue.push(to);
                            }
                        }
                }
                return seen.size === 9;
            }
            case 'winde': return ints(a, 6, -1, 1) && a.reduce((n, x, i) => n + x * p.gewichte[i], 0) === F.windenLast(wahl);
            case 'stollen': {
                if (!Array.isArray(a) || a.length < 2 || a.length > p.max || a[0] !== 0 || a.at(-1) !== p.ziel || !a.every(x => Number.isInteger(x) && x >= 0 && x < p.groesse * p.groesse) || !p.marken.every(x => a.includes(x)))
                    return false;
                for (let i = 1; i < a.length; i++) {
                    const from = a[i - 1], to = a[i], dx = to % p.groesse - from % p.groesse, dy = Math.floor(to / p.groesse) - Math.floor(from / p.groesse), d = DIR.findIndex(([x, y]) => x === dx && y === dy);
                    if (d < 0 || (p.waende[from] & (1 << d)))
                        return false;
                }
                return true;
            }
            case 'schichten': return perm(a, 5) && p.regeln.every(q => q.art === 'vor' ? a.indexOf(q.a) < a.indexOf(q.b) : a[q.pos] !== q.a);
            case 'sprengung': {
                if (!ints(a, 2, 0, p.leitungen.length - 1) || new Set(a).size !== 2)
                    return false;
                const seen = new Set(['EIN']), queue = ['EIN'];
                while (queue.length) {
                    const k = queue.pop();
                    p.leitungen.forEach(([x, y], i) => { if (a.includes(i))
                        return; const to = x === k ? y : y === k ? x : null; if (to && !seen.has(to)) {
                        seen.add(to);
                        queue.push(to);
                    } });
                }
                return !seen.has('HERZ') && seen.has('LUFT') && seen.has('AUS');
            }
            case 'glocke': return ints(a, 6, 0, 3) && eq(a, g);
            default: return false;
        }
    };
})();
