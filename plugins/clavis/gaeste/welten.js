'use strict';
/*
 * Clavis – Welten, Altersstufen, Stimmung, Symbole, Ereignisse und Wendungen. Läuft in Lyra (Host) und im Browser.
 * Ohne Abhängigkeiten, ohne Dateien von außen. Klang: klang.js, Effekte: effekte.js.
 */
const Clavis = window.Clavis || (window.Clavis = {});

Clavis.el = function el(tag, attr, ...kinder) {
  const svg = /^(svg|path|circle|rect|line|polyline|polygon|g|text|ellipse|defs|radialGradient|stop|filter|feTurbulence|feDisplacementMap)$/.test(tag);
  const e = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { for (const [n, w] of Object.entries(v)) { if (n.startsWith('--')) e.style.setProperty(n, w); else e.style[n] = w; } }
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};

/** Zufall mit Startwert – gleiche Startzahl, gleicher Raum */
Clavis.zufall = function zufall(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.zahl = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.wahl = (l) => l[Math.floor(r() * l.length)];
  r.mischen = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return r;
};

/** Für Schlösser und Vergleiche: nur A–Z und 0–9 (Umlaute ausgeschrieben) */
Clavis.norm = (s) => String(s == null ? '' : s).toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');

Clavis.STUFEN = {
  leicht: { name: 'Leicht', minuten: 25, stationen: 4, hinweise: 3, kosten: 30, beschreibung: 'Entspannt – viele Hinweise, großzügige Zeit' },
  mittel: { name: 'Mittel', minuten: 35, stationen: 6, hinweise: 3, kosten: 60, beschreibung: 'Ausgewogen – für die meisten Gruppen' },
  schwer: { name: 'Schwer', minuten: 45, stationen: 8, hinweise: 2, kosten: 120, beschreibung: 'Knifflig – größere Rätsel, teure Hinweise' },
  experte: { name: 'Experte', minuten: 50, stationen: 10, hinweise: 1, kosten: 180, beschreibung: 'Für Profis – kaum Hilfe, viele Stationen' },
};

/** Altersstufe: begrenzt Gefahr, Spuk und Grusel, entscheidet über Jumpscares und Blut */
Clavis.ALTER = {
  kinder: { name: 'Kinder', kurz: 'ab 6 – verspielt, lustig, gar nicht gruselig', max: { gefahr: 3, spuk: 3, grusel: 1 }, schreck: false, blut: false,
    ki: 'Für Kinder ab 6: verspielt, fröhlich, witzig, mit freundlichen Figuren. Nichts Gruseliges, keine Bedrohung, keine Gewalt, keine Toten. Einfache Sprache, kurze Sätze, Rätselinhalte kindgerecht.' },
  ab10: { name: 'Ab 10', kurz: 'abenteuerlich, ein bisschen unheimlich', max: { gefahr: 6, spuk: 6, grusel: 4 }, schreck: 'mild', blut: false,
    ki: 'Für Kinder ab 10: abenteuerlich und spannend, höchstens ein wenig unheimlich (wie ein Jugendbuch). Keine Gewalt, kein Blut, keine Toten.' },
  ab14: { name: 'Ab 14', kurz: 'düster und gruselig – Jumpscares möglich', max: { gefahr: 9, spuk: 10, grusel: 8 }, schreck: true, blut: false,
    ki: 'Für Jugendliche ab 14: darf düster, gruselig und bedrohlich sein (wie ein Gruselfilm ab 12/16). Kein Blut und keine drastischen Verletzungen.' },
  ab18: { name: 'Ab 18', kurz: 'Horror pur – brutale Geschichten, auch Blut', max: {}, schreck: true, blut: true,
    ki: 'Für Erwachsene: darf richtig düster, brutal und verstörend sein (wie ein Horrorthriller) – Blut, Leichen, Mord und Wahnsinn sind erlaubt, aber keine sexuelle Gewalt und keine Folter im Detail.' },
};

/** Stimmung: vier Regler (1–10) */
Clavis.STIMMUNG = {
  spannung: { name: 'Spannung', en: 'Excitement', stufen: ['ruhig und gemütlich', 'spannende Momente', 'Wendung auf Wendung', 'atemlos – alles auf einmal'],
    ki: ['ruhig, gemütlich, kaum Zeitdruck, wenige Überraschungen', 'spannende Momente und eine überraschende Wendung', 'Wendung auf Wendung, Zeitdruck, jede Szene endet mit einem Cliffhanger', 'atemlos: ständige Wendungen, Countdowns, Verfolgung, ein großes Finale'] },
  gefahr: { name: 'Gefahr', en: 'Danger', stufen: ['keine Bedrohung', 'etwas stimmt nicht', 'echte Bedrohung – Fehler kosten Zeit', 'Lebensgefahr – jeder Fehler rächt sich'],
    ki: ['keine Bedrohung, niemand ist in Gefahr', 'leise Bedrohung: etwas stimmt nicht, man sollte sich beeilen', 'echte Bedrohung: Fallen, Alarm, Einsturzgefahr, jemand ist hinter dir her', 'Lebensgefahr: Fallen überall, die Zeit läuft gegen dich, ein Fehler kann alles beenden'] },
  spuk: { name: 'Spuk', en: 'Spookiness', stufen: ['alles erklärbar', 'seltsame Zufälle', 'Geister und Flüstern', 'der Ort lebt'],
    ki: ['nichts Übernatürliches, alles ist erklärbar', 'seltsame Zufälle, die man sich kaum erklären kann', 'Geister, Flüstern, Dinge bewegen sich von selbst', 'der Ort selbst lebt: Stimmen, Erscheinungen, ein Fluch, der dich beobachtet'] },
  grusel: { name: 'Grusel', en: 'Creepiness', stufen: ['gar nicht gruselig', 'unheimliche Details', 'richtig gruselig', 'Albtraum – nichts für schwache Nerven'],
    ki: ['freundlich und hell, nichts Gruseliges', 'ein paar unheimliche Details (Puppen, kalte Luft, Schatten)', 'richtig gruselig: Augen in der Dunkelheit, verstörende Botschaften, das Gefühl, nicht allein zu sein', 'ein Albtraum: beklemmend, verstörend, schockierend'] },
};
Clavis.stimmungAus = (s, alter = 'ab14') => {
  const d = { spannung: 5, gefahr: 4, spuk: 2, grusel: 2 };
  const max = (Clavis.ALTER[alter] || Clavis.ALTER.ab14).max;
  const o = {};
  for (const k of Object.keys(d)) { const v = Math.round(Number(s && s[k])); o[k] = Math.min(max[k] || 10, v >= 1 && v <= 10 ? v : d[k]); }
  return o;
};
Clavis.stimmungStufe = (v) => (v <= 2 ? 0 : v <= 5 ? 1 : v <= 8 ? 2 : 3);
Clavis.stimmungText = (k, v) => Clavis.STIMMUNG[k].stufen[Clavis.stimmungStufe(v)];

// ================================================================== Welten
Clavis.WELTEN = {
  krimi: { name: 'Krimi', kurz: 'Regen an den Scheiben, ein Detektivbüro, Akten, Zigarettenrauch und ein Fall, der nicht aufgeht.',
    musik: 'noir', ereignisse: ['anruf', 'stromausfall', 'brief', 'schritte', 'tuerknall', 'schrei', 'regen'], objekte: ['schreibtisch', 'akte', 'telefon', 'tresor', 'schreibmaschine', 'lampe', 'bild', 'radio', 'schrank'],
    personen: ['Vera Lindqvist', 'Harald Brenner', 'Rosa Kessler', 'Dr. Albert Moll', 'Frieda Stark', 'Konrad Weiß', 'Ida Ferber'],
    merkmale: { Mantel: ['grauer Mantel', 'schwarzer Mantel', 'beiger Mantel'], Hut: ['mit Hut', 'ohne Hut'], Gewohnheit: ['Raucher', 'Nichtraucher'], Abend: ['in der Bar', 'im Hotel', 'am Hafen', 'am Bahnhof'] },
    taeter: 'Täter', fall: 'Wer hat es getan?', kinderName: 'Detektivbüro' },
  labor: { name: 'Labor', kurz: 'Ein verlassenes Forschungslabor, Neonlicht, blubbernde Proben – ein Experiment ist außer Kontrolle.',
    musik: 'labor', ereignisse: ['alarm', 'glitch', 'stromausfall', 'funkspruch', 'explosion', 'glas'], objekte: ['mikroskop', 'reagenz', 'computer', 'schaltkasten', 'kuehlschrank', 'tafel', 'tresor', 'monitor', 'roboter'],
    personen: ['Dr. Lena Vogt', 'Prof. Ilja Sorokin', 'Dr. Maya Chen', 'Tom Berger', 'Dr. Sven Aalto', 'Nora Quist'],
    merkmale: { Abteilung: ['Genetik', 'Chemie', 'Physik'], Kittel: ['weißer Kittel', 'grüner Kittel'], Zugang: ['Stufe 1', 'Stufe 2', 'Stufe 3'], Pause: ['in der Kantine', 'im Serverraum', 'auf dem Dach'] },
    taeter: 'Verantwortliche', fall: 'Wer hat das Experiment sabotiert?', kinderName: 'Erfinderlabor' },
  grab: { name: 'Grabkammer', kurz: 'Eine vergessene Grabkammer unter dem Sand: Fackeln, Hieroglyphen, Fallen und ein Fluch.',
    musik: 'wueste', ereignisse: ['beben', 'geheimtuer', 'fackel', 'fluestern', 'kraehen'], objekte: ['sarkophag', 'statue', 'truhe', 'vase', 'fackel', 'wandbild', 'altar', 'schluessel'],
    personen: ['Nefer', 'Sethi', 'Merit', 'Khaemwaset', 'Tiye', 'Amenemope'],
    merkmale: { Amulett: ['Skarabäus', 'Ankh', 'Udjat-Auge'], Gewand: ['Leinen', 'Gold', 'Purpur'], Opfer: ['Weihrauch', 'Brot', 'Wein'], Ort: ['am Nil', 'im Tempel', 'in der Wüste', 'im Palast'] },
    taeter: 'Grabräuber', fall: 'Wer hat das Siegel gebrochen?', kinderName: 'Pyramide' },
  station: { name: 'Raumstation', kurz: 'Eine Raumstation im Orbit, rote Alarmlichter, die Luft wird knapp – und die Funkverbindung ist tot.',
    musik: 'orbit', ereignisse: ['alarm', 'glitch', 'funkspruch', 'stromausfall', 'explosion'], objekte: ['steuerpult', 'monitor', 'schaltkasten', 'luke', 'raumanzug', 'funk', 'computer', 'reaktor', 'roboter'],
    personen: ['Kommandantin Reyes', 'Ingenieur Okafor', 'Dr. Lindgren', 'Pilot Haruki', 'Technikerin Volkov', 'Biologe Santos'],
    merkmale: { Modul: ['Brücke', 'Labor', 'Antrieb', 'Kantine'], Anzug: ['orangener Anzug', 'weißer Anzug'], Schicht: ['Frühschicht', 'Nachtschicht'], Rang: ['Offizier', 'Crew'] },
    taeter: 'Saboteur', fall: 'Wer hat die Station sabotiert?', kinderName: 'Weltraumschiff' },
  spuk: { name: 'Spukhaus', kurz: 'Ein Herrenhaus um Mitternacht: knarrende Dielen, flackernde Kerzen und Porträts, deren Augen dir folgen.',
    musik: 'spuk', ereignisse: ['gewitter', 'fluestern', 'schritte', 'stromausfall', 'lachen', 'uhrschlag', 'tuerknall', 'schrei'], objekte: ['kamin', 'spiegel', 'portraet', 'klavier', 'standuhr', 'kerze', 'truhe', 'buch', 'puppe'],
    personen: ['Lady Ravensmoor', 'Butler Hobbs', 'Gärtner Finch', 'Miss Ellery', 'Lord Ashby', 'Köchin Mabel'],
    merkmale: { Zimmer: ['im Salon', 'auf dem Dachboden', 'im Keller', 'in der Bibliothek'], Kerze: ['rote Kerze', 'weiße Kerze', 'schwarze Kerze'], Ring: ['Silberring', 'Goldring', 'kein Ring'] },
    taeter: 'Geist', fall: 'Wessen Geist spukt hier?', kinderName: 'Gespensterschloss' },
  bibliothek: { name: 'Bibliothek', kurz: 'Eine uralte Bibliothek mit geheimen Gängen, verstaubten Folianten und einer tickenden Standuhr.',
    musik: 'bibliothek', ereignisse: ['geheimtuer', 'brief', 'schritte', 'fluestern', 'uhrschlag', 'kraehen'], objekte: ['regal', 'buch', 'globus', 'standuhr', 'lesepult', 'kerze', 'schreibtisch', 'karte'],
    personen: ['Bibliothekar Aurelius', 'Schwester Agnes', 'Magister Quandt', 'Gräfin Liebenau', 'Student Emil', 'Archivarin Thea'],
    merkmale: { Saal: ['im Lesesaal', 'im Archiv', 'im Turm', 'in der Krypta'], Buch: ['Atlas', 'Chronik', 'Herbarium'], Brille: ['mit Brille', 'ohne Brille'] },
    taeter: 'Dieb', fall: 'Wer hat die Handschrift gestohlen?', kinderName: 'Zauberbibliothek' },
  pirat: { name: 'Piratenschiff', kurz: 'Das Wrack eines Piratenschiffs: Seekarten, ein rostiger Kompass und eine Truhe, auf der ein Fluch liegt.',
    musik: 'see', ereignisse: ['gewitter', 'beben', 'brief', 'schritte', 'kraehen', 'regen', 'explosion'], objekte: ['truhe', 'karte', 'kompass', 'steuerrad', 'anker', 'fass', 'laterne', 'flasche'],
    personen: ['Käpt’n Rotbart', 'Anne Flint', 'Smutje Jonas', 'Maat Silva', 'Ole Holzbein', 'Mary Teach'],
    merkmale: { Waffe: ['Säbel', 'Pistole', 'Enterhaken'], Augenklappe: ['mit Augenklappe', 'ohne Augenklappe'], Posten: ['im Krähennest', 'unter Deck', 'am Steuer', 'in der Kombüse'] },
    taeter: 'Verräter', fall: 'Wer hat die Karte gestohlen?', kinderName: 'Piratenschiff' },
  akademie: { name: 'Akademie', kurz: 'Ein Hörsaal bei Nacht – das Institut ist abgeschlossen, und nur dein Wissen öffnet die Türen.',
    musik: 'akademie', ereignisse: ['stromausfall', 'brief', 'alarm', 'geheimtuer', 'anruf'], objekte: ['tafel', 'computer', 'buch', 'schrank', 'beamer', 'pult', 'tresor', 'lampe'],
    personen: ['Prof. Hartmann', 'Dr. Yilmaz', 'Hausmeister Kruse', 'Tutorin Jana', 'Dekanin Brandt', 'Student Malte'],
    merkmale: { Fach: ['Mathematik', 'Geschichte', 'Biologie'], Tasche: ['Rucksack', 'Aktentasche'], Ort: ['in der Mensa', 'in der Bibliothek', 'im Labor', 'im Hörsaal'] },
    taeter: 'Täter', fall: 'Wer hat die Klausur gestohlen?', kinderName: 'Schule bei Nacht' },
  zirkus: { name: 'Zirkus', kurz: 'Ein Zirkuszelt nach der Vorstellung: Manege, Scheinwerfer, Zauberkisten – und ein Zauberer, der verschwunden ist.',
    musik: 'zirkus', ereignisse: ['konfetti', 'kichern', 'stromausfall', 'tuerknall', 'lachen', 'spieluhr'], objekte: ['zelt', 'zylinder', 'ballon', 'kanone', 'truhe', 'spiegel', 'klavier', 'laterne'],
    personen: ['Zauberer Magnifico', 'Clown Pepe', 'Akrobatin Lia', 'Dompteur Bruno', 'Wahrsagerin Zora', 'Direktor Fellini'],
    merkmale: { Kostüm: ['Glitzerkostüm', 'Frack', 'Ringelhemd'], Nummer: ['Trapez', 'Zauberei', 'Jonglage'], Pause: ['im Wohnwagen', 'an der Kasse', 'bei den Tieren'] },
    taeter: 'Übeltäter', fall: 'Wer hat den Zauberstab versteckt?', kinderName: 'Zauberzirkus' },
  dschungel: { name: 'Dschungeltempel', kurz: 'Ein überwucherter Tempel tief im Dschungel: Lianen, Steinköpfe, Glühwürmchen und uralte Fallen.',
    musik: 'dschungel', ereignisse: ['beben', 'kraehen', 'regen', 'geheimtuer', 'trommeln', 'fluestern'], objekte: ['totem', 'statue', 'pflanze', 'fackel', 'truhe', 'vase', 'altar', 'karte'],
    personen: ['Forscherin Ana', 'Führer Kito', 'Professor Hale', 'Fotografin Mei', 'Pilotin Rosa', 'Koch Ramón'],
    merkmale: { Ausrüstung: ['Machete', 'Fernglas', 'Kamera'], Hut: ['Tropenhelm', 'Kappe'], Lager: ['am Fluss', 'auf der Lichtung', 'am Wasserfall'] },
    taeter: 'Dieb', fall: 'Wer hat das goldene Idol genommen?', kinderName: 'Dschungelabenteuer' },
  unterwasser: { name: 'Unterwasserstation', kurz: 'Eine Forschungsstation am Meeresgrund: Bullaugen, blaues Licht, knarzender Stahl – und draußen bewegt sich etwas.',
    musik: 'tiefsee', ereignisse: ['alarm', 'beben', 'funkspruch', 'stromausfall', 'glas'], objekte: ['luke', 'monitor', 'muschel', 'taucherhelm', 'anker', 'kompass', 'reaktor', 'fass'],
    personen: ['Kapitänin Nordby', 'Taucher Ruiz', 'Dr. Okonkwo', 'Funker Lasse', 'Technikerin Ama', 'Biologin Sato'],
    merkmale: { Deck: ['Oberdeck', 'Labordeck', 'Maschinendeck'], Anzug: ['gelber Anzug', 'roter Anzug'], Schicht: ['Tagschicht', 'Nachtschicht'] },
    taeter: 'Saboteur', fall: 'Wer hat die Ballasttanks geöffnet?', kinderName: 'U-Boot' },
  spielzeug: { name: 'Spielzeugladen', kurz: 'Ein Spielzeugladen um Mitternacht: Teddys, Spieluhren und Blechroboter – und alle sehen dich an.',
    musik: 'spielzeug', ereignisse: ['spieluhr', 'kichern', 'konfetti', 'stromausfall', 'lachen', 'uhrschlag'], objekte: ['teddy', 'spieluhr', 'wuerfel', 'roboter', 'truhe', 'zug', 'puppe', 'ballon'],
    personen: ['Teddy Brumm', 'Puppe Lotte', 'Roboter Zack', 'Holzpferd Fritz', 'Zinnsoldat Karl', 'Kreisel Kira'],
    merkmale: { Farbe: ['rot', 'blau', 'gelb'], Material: ['aus Holz', 'aus Blech', 'aus Stoff'], Regal: ['im Schaufenster', 'auf dem Dachboden', 'an der Kasse'] },
    taeter: 'Spielzeug', fall: 'Welches Spielzeug hat den Schlüssel versteckt?', kinderName: 'Spielzeugladen' },
  western: { name: 'Wilder Westen', kurz: 'Eine Geisterstadt in der Wüste: ein verlassener Saloon, ein Sheriffbüro und eine Goldmine, aus der niemand zurückkam.',
    musik: 'western', ereignisse: ['schritte', 'kraehen', 'tuerknall', 'heulen', 'explosion', 'brief'], objekte: ['stern', 'fass', 'laterne', 'karte', 'tresor', 'hufeisen', 'kaktus', 'flasche'],
    personen: ['Sheriff Callahan', 'Lucky Joe', 'Miss Daisy', 'Doc Holloway', 'Kid Morgan', 'Barkeeper Sam'],
    merkmale: { Hut: ['schwarzer Hut', 'brauner Hut', 'kein Hut'], Pferd: ['Schimmel', 'Rappe', 'Fuchs'], Ort: ['im Saloon', 'in der Mine', 'am Bahnhof'] },
    taeter: 'Bandit', fall: 'Wer hat das Gold geraubt?', kinderName: 'Cowboystadt' },
  sanatorium: { name: 'Sanatorium', ab: 'ab14', kurz: 'Ein verlassenes Sanatorium: flackernde Röhren, rostige Betten, Akten mit geschwärzten Namen – und Schritte auf dem Flur.',
    musik: 'sanatorium', ereignisse: ['schrei', 'stromausfall', 'schritte', 'lachen', 'ketten', 'tuerknall', 'fluestern', 'glas'], objekte: ['rollstuhl', 'akte', 'spiegel', 'bett', 'spritze', 'schrank', 'monitor', 'puppe'],
    personen: ['Dr. Blackwood', 'Schwester Agathe', 'Patient 13', 'Pfleger Grimm', 'Professor Voss', 'Hausmeister Lund'],
    merkmale: { Station: ['Station A', 'Station B', 'Keller'], Kleidung: ['weißer Kittel', 'grauer Kittel', 'Patientenhemd'], Nacht: ['im Wachraum', 'im Waschraum', 'auf dem Dach'] },
    taeter: 'Täter', fall: 'Wer hat die Patienten verschwinden lassen?' },
};

// ================================================================== Symbole (24×24, Strichzeichnung)
Clavis.ICONS = {
  schreibtisch: 'M3 10h18M5 10v9M19 10v9M5 14h6M11 10v4M14 7h4v3h-4zM6 7h5v3',
  akte: 'M4 5h6l2 2h8v12H4zM4 9h16M8 13h8M8 16h5',
  telefon: 'M6 4c-1.5 1-2 3-1 5.5 2 4.5 5 7.5 9.5 9.5 2.5 1 4.5.5 5.5-1l-2.5-3-3 1.5c-2-1-4-3-5-5L11 8 8 4.5z',
  tresor: 'M4 4h16v15H4zM6 19v1.5M18 19v1.5M12 8a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 11.5h2.5M17 9v5',
  schreibmaschine: 'M5 13h14l2 6H3zM7 13V8h10v5M9 4h6v4M6 16h1M9 16h1M12 16h1M15 16h1M18 16h1',
  lampe: 'M8 3h8l3 8H5zM12 11v8M8 20h8M10 15h4',
  bild: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 8.5a1.5 1.5 0 1 0 0 .1',
  radio: 'M4 9h16v10H4zM7 9l9-5M8 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM14 12h4M14 15h4',
  schrank: 'M5 3h14v18H5zM12 3v18M10 11v2M14 11v2',
  mikroskop: 'M9 3h4l-1 8H10zM11 11v2M6 20h12M8 20c0-4 2-6 6-6M15 8c3 1 4 4 3 7',
  reagenz: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9',
  computer: 'M3 5h18v11H3zM9 20h6M12 16v4M6 8h7M6 11h4',
  schaltkasten: 'M5 3h14v18H5zM8 7h3v4H8zM13 7h3v4h-3zM8 14h8M8 17h8M12 7v-2',
  kuehlschrank: 'M6 3h12v18H6zM6 10h12M9 6v2M9 13v3',
  tafel: 'M3 4h18v12H3zM8 20l2-4M16 20l-2-4M6 8h6M6 11h9',
  monitor: 'M3 4h18v12H3zM8 20h8M5 12l3-3 3 2 4-5 4 4',
  sarkophag: 'M8 2h8l2 6-1 13H7L6 8zM10 6h4M12 6v4M9.5 12h5M10 15h4',
  statue: 'M12 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 9h6l1 8H8zM6 17h12v4H6zM12 9v8',
  truhe: 'M3 10h18v10H3zM3 10c0-4 3-6 9-6s9 2 9 6M3 13h18M11 12h2v3h-2z',
  vase: 'M9 3h6M10 3c0 3-4 4-4 9 0 5 3 8 6 8s6-3 6-8c0-5-4-6-4-9M8 12h8',
  fackel: 'M12 3c2 2 3 3.5 2 6-1 1.5-3 1.5-4 0-1-2.5 1-4 2-6zM10 11h4l-1 10h-2z',
  wandbild: 'M3 3h18v18H3zM7 17V9l3-3 3 3v8M15 17v-5h3v5M7 13h6',
  altar: 'M4 10h16v3H4zM6 13v7M18 13v7M9 10V7h6v3M12 3v4',
  schluessel: 'M8 9a4 4 0 1 0 0 .1M11.5 11.5L20 20M16 16l2-2M18 18l2-2',
  steuerpult: 'M2 15l3-6h14l3 6zM2 15h20v4H2zM7 12h2M11 12h2M15 12h2M6 17h3M15 17h3',
  luke: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM8 12h8M12 8v8',
  raumanzug: 'M8 3h8v6H8zM10 5h4v2h-4zM6 10h12l1 7h-3l-1 4H9l-1-4H5z',
  funk: 'M6 10h12v10H6zM9 10V4M15 6c2 1 3 2.5 3 4M17 3c3 1.5 4.5 4 4.5 7M9 14h6M9 17h3',
  reaktor: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  kamin: 'M3 4h18v3H3zM5 7v14M19 7v14M5 21h14M9 21v-6c0-2 6-2 6 0v6M11 17c0-1 1-2 1-3 1 1 1 2 1 3',
  spiegel: 'M12 3c4 0 6 3.5 6 8s-2 8-6 8-6-3.5-6-8 2-8 6-8zM12 19v2M9 21h6M9 8l2-2M10 11l4-4',
  portraet: 'M4 3h16v18H4zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM7.5 18c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5',
  klavier: 'M3 6h18v12H3zM3 12h18M7 12v6M11 12v6M15 12v6M6 12V9M10 12V9M14 12V9M18 12V9',
  standuhr: 'M8 2h8v20H8zM12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 6.5V8l1 1M12 13v5M12 18l-1.5 1.5',
  kerze: 'M10 10h4v11h-4zM12 3c1.5 1.5 2 3 1 4.5-.6.8-1.4.8-2 0-1-1.5-.5-3 1-4.5zM8 21h8',
  buch: 'M4 4h7c1 0 1 1 1 2v14c0-1-1-1.5-2-1.5H4zM20 4h-7c-1 0-1 1-1 2v14c0-1 1-1.5 2-1.5h6zM6 8h4M14 8h4',
  regal: 'M4 3h16v18H4zM4 9h16M4 15h16M7 3v6M9 3v6M14 9v6M16 9v6M8 15v6M15 15v6',
  globus: 'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM5 10h14M12 3c-2.5 2-2.5 12 0 14M12 3c2.5 2 2.5 12 0 14M12 17v4M8 21h8',
  lesepult: 'M5 8l14-3v4L5 12zM12 10v10M8 20h8',
  karte: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14M5 11l2 1M17 9l1 2',
  kompass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5zM12 3v2M12 19v2M3 12h2M19 12h2',
  steuerrad: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 1v8M12 15v8M1 12h8M15 12h8M4 4l5.5 5.5M14.5 14.5L20 20M4 20l5.5-5.5M14.5 9.5L20 4',
  anker: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 7v14M8 10h8M4 14c0 4 4 7 8 7s8-3 8-7M4 14l-1.5 1.5M20 14l1.5 1.5',
  fass: 'M7 3h10c2 3 2 15 0 18H7c-2-3-2-15 0-18zM5.5 8h13M5.5 16h13M12 3v18',
  laterne: 'M9 3h6M8 6h8v12H8zM10 21h4M12 18v3M12 9c1 1 1.5 2 .8 3-.4.5-1.2.5-1.6 0-.7-1-.2-2 .8-3z',
  flasche: 'M10 2h4v5l2 3v11H8V10l2-3zM8 14h8',
  beamer: 'M3 9h14v7H3zM13 12.5a2 2 0 1 0 0 .1M17 11l4-2v8l-4-2M6 16v2M14 16v2',
  pult: 'M4 7h16l-2 13H6zM4 7l2-3h12l2 3M9 11h6',
  tuer: 'M6 3h12v18H6zM6 21h12M15 12h.5M9 6h6v4H9z',
  ausgang: 'M5 3h10v18H5zM15 12h6M18 9l3 3-3 3M11 12h.5',
  zelt: 'M12 3L2 20h20zM12 3v17M7 20l5-9 5 9M12 3l1.5-1.5',
  zylinder: 'M7 4h10v12H7zM3 16h18v2H3zM7 12h10',
  ballon: 'M12 2a6 6 0 0 0-6 6c0 4 3 7 6 8 3-1 6-4 6-8a6 6 0 0 0-6-6zM12 16l-1 2h2zM12 18c0 2 1 2 0 4',
  kanone: 'M3 15l13-6 2 4-13 6zM6 18a3 3 0 1 0 0 .1M18 11l3-1',
  totem: 'M8 2h8v20H8zM8 7h8M8 13h8M10 4.5h1M13 4.5h1M10 10h4M10 16h1M13 16h1M10 19h4M5 9h3M16 9h3',
  pflanze: 'M12 22V10M12 14c-4 0-6-3-6-7 4 0 6 3 6 7zM12 11c3 0 5-2 5-6-3 0-5 2-5 6zM8 22h8',
  muschel: 'M12 4L3 15c2 4 16 4 18 0zM12 4v14M12 4L7 17M12 4l5 13M12 4L4 13M12 4l8 9',
  taucherhelm: 'M12 3a8 8 0 0 0-8 8v6h16v-6a8 8 0 0 0-8-8zM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 17h16v4H4zM2 11h2M20 11h2',
  teddy: 'M7 4a2 2 0 1 0 0 .1M17 4a2 2 0 1 0 0 .1M12 4a5 5 0 0 0-5 5c0 2.5 2 4 5 4s5-1.5 5-4a5 5 0 0 0-5-5zM10 8h.5M13.5 8h.5M11 10.5h2M8 13c-2 2-2 6 0 8h8c2-2 2-6 0-8',
  spieluhr: 'M4 10h16v10H4zM4 10l2-4h12l2 4M12 6V3M10 3h4M8 14h8M8 17h5M19 15h3',
  wuerfel: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M8 8h.5M15.5 8h.5M8 14h.5M16 15h.5M16 12h.5',
  roboter: 'M7 7h10v8H7zM12 3v4M10 10h.5M13.5 10h.5M10 13h4M4 9v4M20 9v4M9 15v5M15 15v5M7 20h4M13 20h4',
  zug: 'M3 8h12v8H3zM15 11h6v5h-6zM5 4h4v4M5 19a2 2 0 1 0 0 .1M11 19a2 2 0 1 0 0 .1M18 19a2 2 0 1 0 0 .1M3 12h12',
  puppe: 'M12 2a4 4 0 0 0-4 4c0 2.5 2 4 4 4s4-1.5 4-4a4 4 0 0 0-4-4zM10 5.5h.5M13.5 5.5h.5M11 8h2M8 10l-2 11h12l-2-11M6 14h12M9 21v1M15 21v1',
  stern: 'M12 2l2.5 6.5L21 9l-5 4.5 1.5 6.5L12 16.5 6.5 20 8 13.5 3 9l6.5-.5zM12 9a2 2 0 1 0 0 .1',
  hufeisen: 'M5 3v8a7 7 0 0 0 14 0V3h-4v8a3 3 0 0 1-6 0V3zM5 6h4M15 6h4M6 13l3-.5M18 13l-3-.5',
  kaktus: 'M10 21V5a2 2 0 0 1 4 0v16M10 13H7a2 2 0 0 1-2-2V8M14 10h3a2 2 0 0 0 2-2V5M7 21h10',
  rollstuhl: 'M9 4a1.5 1.5 0 1 0 0 .1M9 7v7h6l3 6M9 10h5M14 20a5 5 0 1 1-8-6',
  bett: 'M3 17V7M3 13h18v4M21 17v-3M3 17v3M21 17v3M6 10h4v3H6zM10 10h11v3',
  spritze: 'M18 3l3 3M19.5 4.5L9 15l-3-3L16.5 1.5M7 14l-4 4M3 18l-1 3 3-1M11 7l3 3M13 5l3 3',
  trommel: 'M4 8c0-2 16-2 16 0v8c0 2-16 2-16 0zM4 8c0 2 16 2 16 0M8 3l3 6M16 3l-3 6',
};
Clavis.icon = (name, klasse = '') => {
  const d = Clavis.ICONS[name] || Clavis.ICONS.truhe;
  return Clavis.el('svg', { viewBox: '0 0 24 24', class: 'cl-icon ' + klasse, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, Clavis.el('path', { d }));
};

// ================================================================== Ereignisse (passieren einfach – Stimmung)
// text: normal · stark: unheimlich (ab 14, hohe Stimmung) · kinder: verspielt (fehlt sie, gibt es das Ereignis für Kinder nicht)
Clavis.EREIGNISSE = {
  stromausfall: { name: 'Stromausfall', ton: 'stromaus', text: 'Das Licht flackert – und geht aus.', stark: 'Das Licht erlischt. In der Dunkelheit atmet etwas – ganz in deiner Nähe.', kinder: 'Huch! Das Licht geht aus – und mit einem Plopp wieder an.' },
  alarm: { name: 'Alarm', ton: 'alarm', text: 'Alarm! Irgendwo hat jemand etwas ausgelöst.', stark: 'ALARM! Rote Lichter, eine Sirene – und irgendwo schließen sich Türen.', kinder: 'Tröööt! Eine Alarmhupe – aber nur der Wecker eines Spielzeugroboters.' },
  brief: { name: 'Brief', ton: 'papier', text: 'Ein Umschlag wird unter der Tür hindurchgeschoben.', stark: 'Ein Umschlag gleitet unter der Tür hindurch. Die Tinte ist noch feucht: „Ich sehe dich.“', kinder: 'Ein Brief mit einem Herz-Siegel rutscht unter der Tür durch.' },
  anruf: { name: 'Anruf', ton: 'telefon', text: 'Das Telefon klingelt.', stark: 'Das Telefon klingelt. Am anderen Ende: nur Atmen. Dann ein Klicken.', kinder: 'Riiing! Das Telefon klingelt – am anderen Ende kichert jemand.' },
  geheimtuer: { name: 'Geheimtür', ton: 'tuer', text: 'Mit einem Knirschen schiebt sich ein Teil der Wand zur Seite.', stark: 'Mit einem Knirschen schiebt sich die Wand zur Seite. Eiskalte Luft strömt heraus.', kinder: 'Rumms! Ein Bücherregal dreht sich – dahinter ist ein Geheimgang!' },
  glitch: { name: 'Störung', ton: 'glitch', text: 'Die Bildschirme flackern. Irgendetwas stimmt hier nicht.', stark: 'Die Bildschirme flackern. Für einen Moment zeigen alle dasselbe Wort: LAUF.', kinder: 'Die Bildschirme zeigen auf einmal lustige Gesichter.' },
  gewitter: { name: 'Gewitter', ton: 'gewitter', text: 'Ein Blitz zuckt, Donner rollt über das Dach.', stark: 'Ein Blitz – und für einen Herzschlag steht eine Gestalt im Fenster.' },
  schritte: { name: 'Schritte', ton: 'schritte', text: 'Schritte im Flur. Jemand kommt näher … und bleibt stehen.', stark: 'Schritte. Sie bleiben direkt vor der Tür stehen. Die Klinke bewegt sich – langsam.', kinder: 'Tapp, tapp, tapp – ein kleiner Hund tapst vorbei und wedelt mit dem Schwanz.' },
  beben: { name: 'Beben', ton: 'beben', text: 'Der Boden bebt. Staub rieselt von der Decke.', stark: 'Die Decke ächzt. Steine stürzen herab – nur knapp neben dir.', kinder: 'Rumpel, rumpel! Der Boden wackelt wie Wackelpudding.' },
  fluestern: { name: 'Flüstern', ton: 'fluestern', text: 'Ein Flüstern, ganz nah. Doch da ist niemand.', stark: 'Ein Flüstern, direkt an deinem Ohr: „Du gehörst jetzt hierher.“' },
  funkspruch: { name: 'Funkspruch', ton: 'funk', text: 'Rauschen im Funk – dann eine Stimme.', stark: 'Rauschen – dann eine Stimme: „Wer ist da? Hier sollte niemand mehr leben …“', kinder: 'Das Funkgerät piept: „Hallo? Hier spricht der Kapitän der Gummienten!“' },
  fackel: { name: 'Fackel', ton: 'fackel', text: 'Eine Fackel flammt auf und erhellt eine verborgene Inschrift.', stark: 'Eine Fackel flammt von selbst auf. Niemand hat sie berührt.', kinder: 'Fwusch! Eine Fackel geht an und alles glitzert golden.' },
  schrei: { ab: 'ab14', name: 'Schrei', ton: 'schrei', text: 'Ein Schrei hallt durch das Gebäude – dann Stille.', stark: 'Ein gellender Schrei, ganz nah. Dann bricht er ab, als hätte ihn jemand erstickt.' },
  glas: { name: 'Klirren', ton: 'glas', text: 'Irgendwo zerspringt Glas.', stark: 'Glas zerspringt – und auf dem Boden glitzern Scherben, die vorhin nicht da waren.', kinder: 'Klirr! Ein Wasserglas ist umgefallen – Glück gehabt, nichts passiert.' },
  tuerknall: { name: 'Türknall', ton: 'tuerknall', text: 'Eine Tür knallt zu. Der Luftzug löscht eine Kerze.', stark: 'BUMM! Eine Tür knallt zu. Jemand – oder etwas – will nicht, dass du gehst.', kinder: 'Rumms! Der Wind hat eine Tür zugeweht.' },
  heulen: { name: 'Heulen', ton: 'heulen', text: 'Draußen heult ein Wolf.', stark: 'Ein Heulen, viel zu nah. Und es klingt beinahe menschlich.' },
  lachen: { ab: 'ab14', name: 'Lachen', ton: 'lachen', text: 'Ein leises Lachen aus einem anderen Raum.', stark: 'Ein Lachen, kalt und hohl – es kommt aus der Wand.' },
  kichern: { name: 'Kichern', ton: 'kichern', text: 'Irgendwo kichert jemand.', kinder: 'Hihihi! Irgendwo kichert jemand – ein Kobold vielleicht?' },
  ketten: { ab: 'ab14', name: 'Ketten', ton: 'ketten', text: 'Ketten rasseln unter dem Boden.', stark: 'Ketten rasseln. Etwas zerrt an ihnen – direkt unter deinen Füßen.' },
  uhrschlag: { name: 'Glockenschlag', ton: 'uhrschlag', text: 'Eine Uhr schlägt – dreizehnmal.', stark: 'Die Uhr schlägt dreizehn. Beim letzten Schlag bleibt dein Herz fast stehen.', kinder: 'Ding-dong! Eine Kuckucksuhr ruft „Kuckuck!“' },
  regen: { name: 'Wolkenbruch', ton: 'regen', text: 'Plötzlich prasselt Regen gegen die Scheiben.', stark: 'Regen prasselt herab. Am Fenster: Handabdrücke – von innen.', kinder: 'Plitsch, platsch! Ein Regenschauer – und danach ein Regenbogen.' },
  explosion: { name: 'Explosion', ton: 'explosion', text: 'Eine Explosion erschüttert die Wände.', stark: 'Eine Explosion! Rauch quillt unter der Tür hindurch.', kinder: 'Puff! Eine Konfetti-Kanone ist losgegangen!' },
  kraehen: { name: 'Krähen', ton: 'kraehen', text: 'Krähen schreien draußen auf und flattern davon.', stark: 'Ein Schwarm Krähen schlägt gegen das Fenster – als wollten sie herein.', kinder: 'Ein frecher Papagei kräht „Hallo!“ und fliegt davon.' },
  spieluhr: { name: 'Spieluhr', ton: 'spieluhr', text: 'Eine Spieluhr beginnt von selbst zu spielen.', stark: 'Eine Spieluhr spielt. Die Melodie ist falsch – und sie kommt näher.', kinder: 'Eine Spieluhr spielt ein fröhliches Lied und ein Tänzer dreht sich.' },
  konfetti: { name: 'Konfetti', ton: 'konfetti', text: 'Konfetti regnet von der Decke.', kinder: 'Konfetti! Bunte Schnipsel regnen von der Decke.' },
  trommeln: { name: 'Trommeln', ton: 'trommeln', text: 'Aus der Tiefe dröhnen Trommeln.', stark: 'Trommeln, immer schneller. Als würde jemand etwas herbeirufen.', kinder: 'Bumm-bumm! Affen trommeln auf hohlen Baumstämmen.' },
};

/** Ereignistext passend zu Alter und Stimmung (null: für Kinder nicht geeignet) */
Clavis.ereignisText = (art, alter, stark) => {
  const e = Clavis.EREIGNISSE[art];
  if (!e) return null;
  if (alter === 'kinder') return e.kinder || null;
  if (e.ab === 'ab14' && alter === 'ab10') return null;
  if (stark && e.stark && alter !== 'ab10') return e.stark;
  return e.text;
};

// ================================================================== Wendungen (passieren und ändern das Spiel)
// gut: hilft · schlecht: erschwert. ereignis: Bild und Klang dazu. Texte je Alter.
Clavis.WENDUNGEN = {
  tipp: { gut: true, ereignisse: ['anruf', 'funkspruch', 'brief'], texte: {
    kinder: ['Ein Papagei landet auf deiner Schulter und krächzt: „Tipp! Tipp!“', 'Eine freundliche Stimme am Telefon: „Ich verrate dir was …“'],
    normal: ['Eine Stimme am Telefon: „Ich kann nicht lange reden. Hör zu …“', 'Ein Zettel unter der Tür, in hastiger Schrift: Ein Hinweis!'],
    dunkel: ['Eine heisere Stimme am Telefon: „Du willst hier raus? Dann hör gut zu …“', 'Auf dem beschlagenen Spiegel erscheinen Worte, geschrieben von einem Finger, den du nicht siehst.'] } },
  buchstabe: { gut: true, ereignisse: ['glas', 'konfetti', 'fackel'], texte: {
    kinder: ['Plopp! Aus einer Wunderkiste springt ein Buchstabe heraus.', 'Ein Glühwürmchen schreibt einen Buchstaben in die Luft.'],
    normal: ['Aus einem Buch fällt ein Zettel – darauf ein einzelner Buchstabe.', 'In den Staub ist ein Buchstabe geschrieben. Jemand will dir helfen.'],
    dunkel: ['Ein Buchstabe brennt sich in die Tapete, Funken sprühen.', 'An der Wand läuft etwas herunter und formt einen Buchstaben.'] } },
  zeitplus: { gut: true, ereignisse: ['uhrschlag', 'konfetti'], texte: {
    kinder: ['Eine Zaubersanduhr! Die Zeit läuft rückwärts.'],
    normal: ['Du findest eine alte Sanduhr – als du sie umdrehst, läuft die Zeit zurück.'],
    dunkel: ['Die Uhr stockt, als hätte jemand sie festgehalten. Du gewinnst Zeit – warum auch immer.'] } },
  geheimfach: { gut: true, ereignisse: ['geheimtuer', 'beben'], texte: {
    kinder: ['Klick! Ein Geheimfach springt auf – darin wartet ein Bonusrätsel!'],
    normal: ['Ein Geheimfach springt auf! Darin: ein Rätsel, das vorher niemand sehen sollte.'],
    dunkel: ['Hinter einer losen Wandplatte: ein Versteck. Jemand hat hier etwas für dich vorbereitet …'] } },
  dunkel: { gut: false, ereignisse: ['stromausfall'], texte: {
    kinder: ['Licht aus! Nimm die Taschenlampe – mal sehen, was du findest.'],
    normal: ['Stromausfall! Nur deine Taschenlampe hilft – eine Minute lang.'],
    dunkel: ['Totale Finsternis. Deine Taschenlampe flackert. Und irgendwo atmet etwas.'] } },
  nebel: { gut: false, ereignisse: ['explosion', 'fluestern'], texte: {
    kinder: ['Pffff! Eine Seifenblasenmaschine – alles ist voller Blasen.'],
    normal: ['Dichter Rauch quillt aus den Lüftungsschlitzen. Du siehst kaum noch etwas.'],
    dunkel: ['Ein kalter Nebel kriecht über den Boden. Darin bewegen sich Schatten.'] } },
  countdown: { gut: false, ereignisse: ['alarm'], texte: {
    kinder: ['Die Wecker-Rakete zählt runter! Löst schnell ein Rätsel, dann fliegt sie weg.'],
    normal: ['Alarm! Löst in 90 Sekunden ein Rätsel – sonst springt die Uhr 2 Minuten vor.'],
    dunkel: ['Ein Countdown startet. 90 Sekunden. Was passiert bei null, willst du nicht wissen.'] } },
  blockiert: { gut: false, ereignisse: ['tuerknall', 'ketten'], texte: {
    kinder: ['Ein frecher Kobold hat ein Schloss verknotet – eine Minute Geduld!'],
    normal: ['Mit einem Klacken verriegelt sich etwas. Eine Minute lang geht dort nichts.'],
    dunkel: ['Ketten schlingen sich um etwas im Raum. Sie lösen sich erst in einer Minute.'] } },
  zeitminus: { gut: false, ereignisse: ['uhrschlag', 'glitch'], texte: {
    kinder: ['Der Uhr-Kobold hat an den Zeigern gedreht!'],
    normal: ['Die Uhr springt vor! Jemand hat dir Zeit gestohlen.'],
    dunkel: ['Die Zeiger rasen. Als sie stehen bleiben, fehlt dir eine Minute deines Lebens.'] } },
};
