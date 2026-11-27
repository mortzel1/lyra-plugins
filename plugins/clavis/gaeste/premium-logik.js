'use strict';
/* Die überprüfbaren Rätsel des Forstreviers. Keine DOM-Abhängigkeit: Bau und Prüfung laufen beim Host. */
(() => {
  const P = Clavis.PremiumLogik = {};
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ints = (a, n, min, max) => Array.isArray(a) && a.length === n && a.every(x => Number.isInteger(x) && x >= min && x <= max);
  const perm = (a, n) => ints(a, n, 0, n - 1) && new Set(a).size === n;
  const norm = a => String(a == null ? '' : a).toUpperCase().replace(/\s/g, '');
  const matrix = [[2, 1, 0], [0, 2, 1], [1, 0, 2]];
  function schalten(g, i, diagonal) {
    const x = i % 3, y = Math.floor(i / 3);
    const nb = diagonal ? [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] : [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of nb) if (x + dx >= 0 && x + dx < 3 && y + dy >= 0 && y + dy < 3) g[(y + dy) * 3 + x + dx] ^= 1;
  }
  P.schalten = schalten;
  P.bauen = (stufe, seed) => {
    const r = Clavis.zufall(seed), s = ['leicht', 'mittel', 'schwer', 'experte'].indexOf(stufe);
    const frequenz = r.wahl([1462, 1464, 1466]), delta = r.wahl([7, 9, 11]);
    const druck = [r.zahl(1, 4), r.zahl(1, 4), r.zahl(1, 4)];
    const min = r.zahl(13, 22), versatz = [7, -4, 11];
    const ereignisse = [
      ['Wache', 'Nora übernimmt die Nachtwache.', 0, min],
      ['Messung', 'Der Pegel springt auf Rot. Nora meldet den Defekt.', 1, min + 3],
      ['Warnung', 'Nora sperrt die alte Straße. Der Dispatcher bestätigt.', 2, min + 7],
      ['Abschaltung', 'Nora trennt den automatischen Ruf vom Netz.', 0, min + 11],
      ['Unfall', 'Der Steg bricht. Nora stürzt am Wehr.', 1, min + 14],
      ['Notruf', 'Ein Ruf kommt aus dem Forsthaus. Nora liegt bereits am Wehr.', 2, min + 18],
    ];
    const cards = r.mischen(ereignisse.map(([name, text, uhr, zeit], i) => ({ name, text, uhr, zeit: `02:${String(zeit + versatz[uhr]).padStart(2, '0')}`, order: i })));
    const chronik = cards.map((_, i) => i).sort((a, b) => cards[a].order - cards[b].order);
    const kennung = r.wahl(['EICHE', 'FARNE', 'MOOS']), kennziffer = r.zahl(2, 8);
    const bandRoh = [
      { text: `${kennung}. Hier ist Nora. Ich bin am Wehr. Zweimal kurz, einmal lang.`, echt: true, code: 'W' },
      { text: `${kennung}. Wenn eine Stimme deinen Namen sagt: antworte nicht. Zweimal kurz, einmal lang.`, echt: true, code: 'A' },
      { text: `${kennung}. Der Turm braucht den stillen Kanal. Zweimal kurz, einmal lang.`, echt: true, code: 'L' },
      { text: `${kennung}. Ich bin im Forsthaus. Mach die Kellertür auf. Einmal kurz, zweimal lang.`, echt: false, code: 'D' },
      { text: `BIRKE. Hier ist Nora. Ich bin am Wehr. Zweimal kurz, einmal lang.`, echt: false, code: 'R' },
      { text: `${kennung}. Komm allein zu den Bäumen. Dreimal kurz.`, echt: false, code: 'F' },
    ];
    const baender = r.mischen(bandRoh), band = baender.map((x, i) => x.echt ? i : -1).filter(i => i >= 0);
    const links = new Array(9).fill(1), rechts = new Array(9).fill(1);
    const zuege = r.mischen([...Array(9).keys()]).slice(0, [3, 4, 5, 7][Math.max(0, s)]);
    for (const i of zuege) { schalten(links, i, false); schalten(rechts, i, true); }
    const signal = r.mischen([0, 1, 2, 3]);
    const namen = ['WURZEL', 'KRONE', 'WASSER', 'STERN'];
    const p = {
      strom: { art: 'strom', titel: 'Das Netz der Nachtwache', namen: ['Funk', 'Archiv', 'Pumpe', 'Turm', 'Flutlicht', 'Heizung'], lasten: [4, 3, 5, 7, 6, 2], ziel: 12 },
      frequenz: { art: 'frequenz', titel: 'Der stille Kanal', basis: frequenz, delta, zeichen: kennziffer, filter: 3, phase: 2 },
      peilung: { art: 'peilung', titel: 'Zwei Peilungen, ein Ort', groesse: 7, punkte: [{ x: 0, y: 5, name: 'Alter Turm', richtung: 'Nordost' }, { x: 6, y: 5, name: 'Grenzstein', richtung: 'Nordwest' }] },
      ventile: { art: 'ventile', titel: 'Unter dem Steg', matrix, ziel: matrix.map(z => z.reduce((a, x, i) => a + x * druck[i], 0)), max: 5 },
      chronik: { art: 'chronik', titel: 'Die Nacht in der richtigen Reihenfolge', uhren: ['Wanduhr', 'Funkuhr', 'Pegelwerk'], versatz, karten: cards.map(({ order, ...x }) => x) },
      band: { art: 'band', titel: 'Die Stimme im Magnetband', kennung, baender: baender.map(({ echt, ...x }) => x), anzahl: 3 },
      relais: { art: 'relais', titel: 'Der Kreis muss schweigen', links, rechts, doppelt: s >= 1 },
      leuchtfeuer: { art: 'leuchtfeuer', titel: 'Eine Nachricht nach draußen', namen, gravur: `${namen[signal[0]]} steht vor ${namen[signal[2]]}, aber nicht direkt daneben. ${namen[signal[1]]} steht unmittelbar vor ${namen[signal[2]]}. ${namen[signal[3]]} steht hinter ${namen[signal[1]]} und nicht neben ${namen[signal[0]]}.`, laenge: 4 },
    };
    // Nur technische Hinweise. Die Lösungen sind ausschließlich im Rückgabeteil „geheim“.
    return { p, geheim: { strom: [1, 1, 1, 0, 0, 0], frequenz: { wert: frequenz + delta, filter: 3, phase: 2 }, peilung: 'D3', ventile: druck, chronik, band, relais: zuege, leuchtfeuer: signal } };
  };
  P.pruefen = (art, p, l, a) => {
    switch (art) {
      case 'strom': return ints(a, 6, 0, 1) && a[0] === 1 && a.reduce((n, x) => n + x, 0) === 3 && a.reduce((n, x, i) => n + x * p.lasten[i], 0) === p.ziel && (!a[1] || a[2] === 1) && !(a[4] && a[5]);
      case 'frequenz': return a && typeof a === 'object' && Number.isInteger(a.wert) && a.wert === l.wert && a.filter === l.filter && a.phase === l.phase;
      case 'peilung': return norm(a) === l;
      case 'ventile': return ints(a, 3, 0, p.max) && p.ziel.every((z, i) => p.matrix[i].reduce((n, x, j) => n + x * a[j], 0) === z);
      case 'chronik': return perm(a, p.karten.length) && gleich(a, l);
      case 'band': return ints(a, p.anzahl, 0, p.baender.length - 1) && new Set(a).size === p.anzahl && gleich(a.slice().sort((x, y) => x - y), l.slice().sort((x, y) => x - y));
      case 'relais': {
        if (!Array.isArray(a) || a.length > 100 || !a.every(i => Number.isInteger(i) && i >= 0 && i < 9)) return false;
        const links = p.links.slice(), rechts = p.rechts.slice();
        for (const i of a) { schalten(links, i, false); schalten(rechts, i, true); }
        return links.every(Boolean) && (!p.doppelt || rechts.every(Boolean));
      }
      case 'leuchtfeuer': return perm(a, 4) && gleich(a, l);
      default: return false;
    }
  };
})();
