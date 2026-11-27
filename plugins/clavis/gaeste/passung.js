'use strict';
/*
 * Clavis – was passt wozu. Jedes Rätsel passt zu bestimmten Welten und Gegenständen und hat je Welt ein eigenes Gesicht
 * („Skin“: Ort, Gegenstand, Titel, Text). Keine Waage auf der Raumstation, kein Gewichtesortieren am Computer.
 * Dazu: Ereignisse und Wendungen je Welt (kein Regen im All, Bühnennebel statt Nebel im Zirkus, Fackeln statt Strom im Grab).
 *
 *   Clavis.passt(mech, welt, symbol)         → true/false
 *   Clavis.skin(mech, welt)                  → { ort, symbol, titel, text }
 *   Clavis.stationAnpassen(station, welt, benutzt) → macht eine Station stimmig (ändert sie, wenn nötig)
 *   Clavis.ereignisFuerWelt(art, welt)       → passendes Ereignis
 *   Clavis.WENDUNG_WELT[art][welt]           → { titel, text, kinder, kurz, stil }
 */
(() => {
  const G = (Clavis.GRUPPE = { labor: 'technik', station: 'technik', unterwasser: 'technik', grab: 'alt', dschungel: 'alt', spuk: 'haus', bibliothek: 'haus', sanatorium: 'haus', akademie: 'haus', krimi: 'haus', pirat: 'see', western: 'west', zirkus: 'bunt', spielzeug: 'bunt' });
  const ALLE = '*';
  // w: Welten oder Gruppen ('*' = alle) · o: Gegenstände ('*' = alle) · s: Skins je Welt/Gruppe: [Ort, Gegenstand, Titel, Text]
  const P = (Clavis.PASSUNG = {
    zahlenschloss: { w: ALLE, o: ['truhe', 'tresor', 'schrank', 'luke', 'kuehlschrank', 'sarkophag', 'fass', 'tuer', 'buch', 'computer', 'tastenfeld'], s: { '*': ['Truhe', 'truhe', 'Das Zahlenschloss', 'Eine schwere Truhe mit Zahlenschloss.'], technik: ['Schließfach', 'schrank', 'Das Zahlenschloss', 'Ein Metallschrank mit Zahlenschloss.'], alt: ['Steintruhe', 'sarkophag', 'Die Zahlenscheiben', 'Eine Steintruhe mit eingemeißelten Zahlenscheiben.'] } },
    wortschloss: { w: ALLE, o: ['truhe', 'tresor', 'buch', 'schrank', 'sarkophag', 'altar', 'luke', 'tuer', 'computer'], s: { '*': ['Truhe', 'truhe', 'Das Buchstabenschloss', 'Eine Truhe mit Buchstabenrollen.'], alt: ['Altar', 'altar', 'Das Wort der Götter', 'In den Altar sind drehbare Buchstabensteine eingelassen.'], haus: ['Verschlossenes Buch', 'buch', 'Das verschlossene Buch', 'Ein dickes Buch mit Buchstabenschloss.'], technik: ['Zugangsterminal', 'computer', 'Das Passwort', 'Ein Terminal verlangt ein Passwort.'] } },
    caesar: { w: ALLE, o: ['buch', 'akte', 'karte', 'funk', 'radio', 'wandbild', 'lesepult', 'schreibmaschine', 'schreibtisch', 'monitor', 'computer'], s: { '*': ['Geheime Notiz', 'akte', 'Die verschlüsselte Botschaft', 'Eine Botschaft voller Buchstabensalat – und eine Drehscheibe dazu.'], technik: ['Funkspruch', 'funk', 'Der verschlüsselte Funkspruch', 'Ein abgefangener Funkspruch – verschlüsselt.'], alt: ['Wandinschrift', 'wandbild', 'Die verschobene Inschrift', 'Eine Inschrift, deren Zeichen verschoben scheinen.'], see: ['Logbuch', 'buch', 'Der Geheimcode des Käpt’ns', 'Ein Logbuch mit verschlüsseltem Eintrag.'] } },
    morse: { w: ['technik', 'haus', 'see', 'west', 'bunt'], o: ['funk', 'radio', 'lampe', 'laterne', 'telefon', 'schaltkasten', 'steuerpult', 'monitor', 'computer'], s: { '*': ['Lampe', 'lampe', 'Blinkzeichen', 'Eine Lampe blinkt in einem seltsamen Rhythmus.'], technik: ['Funkgerät', 'funk', 'Das Morsesignal', 'Aus dem Funkgerät piept es kurz und lang.'], see: ['Laterne', 'laterne', 'Signale vom anderen Schiff', 'Draußen blinkt eine Laterne – Morsezeichen!'], west: ['Telegraf', 'funk', 'Der Telegraf', 'Der alte Telegraf tickt eine Nachricht.'] } },
    runen: { w: ['alt', 'haus', 'see', 'bunt', 'technik'], o: ['wandbild', 'altar', 'statue', 'totem', 'sarkophag', 'buch', 'vase', 'truhe', 'spiegel', 'monitor', 'computer'], s: { '*': ['Wandrelief', 'wandbild', 'Die fremden Zeichen', 'Ein Relief mit Zeichen, die niemand mehr lesen kann.'], technik: ['Fremder Code', 'monitor', 'Die fremden Zeichen', 'Auf dem Bildschirm erscheinen Zeichen einer unbekannten Schrift – ein Zettel übersetzt sie.'], haus: ['Altes Buch', 'buch', 'Die Geheimschrift', 'Ein Buch in einer unbekannten Schrift.'], bunt: ['Zauberbuch', 'buch', 'Die Zauberschrift', 'Ein Zauberbuch mit glitzernden Zeichen.'] } },
    schalter: { w: ALLE, o: ['schaltkasten', 'steuerpult', 'lampe', 'reaktor', 'computer', 'monitor', 'kerze', 'laterne', 'totem', 'altar'], s: { '*': ['Schalttafel', 'schaltkasten', 'Licht an', 'Ein Feld aus Lampen – jeder Druck schaltet auch die Nachbarn um.'], alt: ['Leuchtsteine', 'altar', 'Die leuchtenden Steine', 'Steine, die aufleuchten, wenn man sie berührt – und ihre Nachbarn auch.'], spuk: ['Kerzenleuchter', 'kerze', 'Die Kerzen', 'Jede Kerze, die man berührt, lässt auch die Nachbarn auf- oder ausflackern.'], see: ['Laternen', 'laterne', 'Die Laternen', 'Ein Brett voller Laternen.'], west: ['Laternen', 'laterne', 'Die Laternen des Saloons', 'Ein Brett voller Öllampen.'], bunt: ['Lichterbrett', 'schaltkasten', 'Bunte Lichter', 'Ein Brett voller bunter Lämpchen.'] } },
    kabel: { w: ['technik', 'haus', 'bunt'], o: ['schaltkasten', 'steuerpult', 'computer', 'reaktor', 'roboter', 'telefon', 'radio', 'funk'], s: { '*': ['Verteilerkasten', 'schaltkasten', 'Die Verkabelung', 'Lose Kabel – jeder Stecker gehört an einen Anschluss.'], bunt: ['Roboter', 'roboter', 'Die Roboter-Kabel', 'Dem Roboter hängen die Kabel heraus.'] } },
    schiebepuzzle: { w: ALLE, o: ['bild', 'wandbild', 'portraet', 'karte', 'spieluhr', 'wuerfel', 'tafel', 'monitor', 'totem'], s: { '*': ['Gemälde', 'bild', 'Das verschobene Bild', 'Ein Bild aus Schiebekacheln – völlig durcheinander.'], alt: ['Mosaik', 'wandbild', 'Das Mosaik', 'Ein Mosaik aus verschiebbaren Steinplatten.'], technik: ['Bildschirm', 'monitor', 'Das verschobene Signal', 'Auf dem Bildschirm sind die Bildkacheln verschoben.'] } },
    reihenfolge: { w: ALLE, o: ['buch', 'akte', 'tafel', 'wandbild', 'regal', 'karte', 'lesepult', 'computer', 'schreibtisch', 'monitor'], s: { '*': ['Zeitleiste', 'tafel', 'Die richtige Reihenfolge', 'Karten, die in die richtige Reihenfolge gehören.'], alt: ['Bilderfries', 'wandbild', 'Der Bilderfries', 'Steinplatten mit Bildern – in falscher Reihenfolge.'], technik: ['Protokoll', 'computer', 'Das Protokoll', 'Die Einträge im Protokoll sind durcheinander.'] } },
    suchbild: { w: ALLE, o: ['bild', 'wandbild', 'portraet', 'schreibtisch', 'regal', 'karte', 'akte', 'tafel'], s: { '*': ['Schreibtisch', 'schreibtisch', 'Spurensuche', 'Ein Durcheinander – irgendwo hier sind Spuren.'], alt: ['Wandmalerei', 'wandbild', 'Die versteckten Zeichen', 'Eine Wandmalerei voller Details.'], bunt: ['Wimmelbild', 'bild', 'Such mich!', 'Ein buntes Wimmelbild.'] } },
    taschenlampe: { w: ALLE, o: ['wandbild', 'bild', 'schrank', 'kamin', 'statue', 'totem', 'luke', 'sarkophag', 'regal', 'spiegel'], s: { '*': ['Dunkle Ecke', 'schrank', 'Etwas an der Wand', 'Eine stockdunkle Ecke – leuchte hinein.'], alt: ['Dunkle Nische', 'statue', 'Die dunkle Nische', 'Hinter der Statue ist es stockfinster.'], technik: ['Wartungsschacht', 'luke', 'Im Schacht', 'Ein dunkler Wartungsschacht.'] } },
    geheimtinte: { w: ['haus', 'see', 'west', 'alt', 'bunt'], o: ['buch', 'akte', 'karte', 'schreibmaschine', 'lesepult', 'schreibtisch', 'bild'], s: { '*': ['Brief', 'akte', 'Unsichtbare Tinte', 'Ein Brief – aber zwischen den Zeilen ist noch etwas.'], alt: ['Papyrus', 'karte', 'Der leere Papyrus', 'Ein Papyrus – scheinbar leer.'] } },
    terminal: { w: ['technik', 'akademie', 'sanatorium'], o: ['computer', 'monitor', 'steuerpult', 'roboter', 'beamer'], s: { '*': ['Terminal', 'computer', 'Der alte Rechner', 'Ein Rechner mit blinkendem Cursor.'] } },
    akte: { w: ALLE, o: ['akte', 'schreibtisch', 'schrank', 'buch', 'computer', 'tafel', 'bild', 'wandbild'], s: { '*': ['Ermittlungsakte', 'akte', 'Die Verdächtigen', 'Eine Akte mit Verdächtigen und Spuren.'], west: ['Steckbriefe', 'bild', 'Die Steckbriefe', 'Steckbriefe an der Wand – und Zeugenaussagen.'], see: ['Logbuch', 'buch', 'Wer war es?', 'Das Logbuch der Mannschaft.'], technik: ['Personaldaten', 'computer', 'Wer hatte Zugang?', 'Die Personaldaten der Besatzung.'], alt: ['Namensinschrift', 'wandbild', 'Wer brach das Siegel?', 'Namen und Taten, in den Stein gemeißelt.'] } },
    verhoer: { w: ALLE, o: ['statue', 'portraet', 'roboter', 'puppe', 'teddy', 'totem', 'spiegel', 'telefon', 'funk'], s: { '*': ['Porträt', 'portraet', 'Das sprechende Bild', 'Ein Porträt, dessen Augen dich ansehen – es stellt Fragen.'], technik: ['Roboter', 'roboter', 'Die Sicherheitsabfrage', 'Ein Roboter will Antworten.'], alt: ['Wächterstatue', 'statue', 'Die Fragen des Wächters', 'Eine Statue, die Fragen stellt.'], bunt: ['Puppe', 'puppe', 'Die neugierige Puppe', 'Eine Puppe, die Fragen stellt.'] } },
    tresor: { w: ALLE, o: ['tresor', 'schrank', 'truhe', 'kuehlschrank', 'luke', 'sarkophag'], s: { '*': ['Tresor', 'tresor', 'Der Tresor', 'Ein Tresor mit Drehrad.'], alt: ['Steinrad', 'sarkophag', 'Das Steinrad', 'Ein Sarkophag mit steinernem Drehrad.'] } },
    melodie: { w: ['haus', 'bunt', 'alt', 'west', 'see'], o: ['klavier', 'spieluhr', 'trommel', 'radio', 'muschel', 'glocke', 'totem'], s: { '*': ['Spieluhr', 'spieluhr', 'Die Melodie', 'Eine Spieluhr spielt eine kurze Melodie.'], haus: ['Klavier', 'klavier', 'Die Melodie', 'Ein Klavier – jemand hat Noten liegen lassen.'], alt: ['Klangsteine', 'totem', 'Die singenden Steine', 'Steine, die beim Anschlagen singen.'], west: ['Saloon-Klavier', 'klavier', 'Das verstimmte Klavier', 'Das alte Saloon-Klavier.'], see: ['Muschelhorn', 'muschel', 'Das Muschellied', 'Eine Muschel, die eine Melodie summt.'] } },
    uhr: { w: ALLE, o: ['standuhr', 'schreibtisch', 'tafel', 'wandbild', 'altar', 'monitor'], s: { '*': ['Standuhr', 'standuhr', 'Die stehende Uhr', 'Eine Uhr, deren Zeiger stillstehen.'], alt: ['Sonnenuhr', 'altar', 'Die Sonnenuhr', 'Eine Sonnenuhr aus Stein.'], technik: ['Bordchronometer', 'monitor', 'Die Bordzeit', 'Die Bordzeit muss neu gestellt werden.'] } },
    anagramm: { w: ALLE, o: ['wuerfel', 'buch', 'akte', 'tafel', 'truhe', 'zylinder', 'vase', 'schreibtisch', 'wandbild'], s: { '*': ['Buchstabenwürfel', 'wuerfel', 'Buchstabensalat', 'Würfel mit Buchstaben – durcheinander.'], bunt: ['Zauberkiste', 'truhe', 'Wer wohnt hier drin?', 'Durcheinandergewürfelte Buchstaben.'], alt: ['Steintafel', 'wandbild', 'Die verstreuten Zeichen', 'Lose Buchstabensteine.'] } },
    karte: { w: ALLE, o: ['karte', 'globus', 'kompass', 'schreibtisch', 'steuerrad', 'lesepult', 'tafel', 'monitor'], s: { '*': ['Karte', 'karte', 'Die Schatzkarte', 'Eine alte Karte mit Wegbeschreibung.'], technik: ['Sektorkarte', 'monitor', 'Die Navigationskarte', 'Eine Karte des Sektors.'] } },
    binaer: { w: ['technik', 'haus', 'bunt'], o: ['schaltkasten', 'computer', 'steuerpult', 'reaktor', 'roboter', 'monitor'], s: { '*': ['Bitschalter', 'schaltkasten', 'Die Bitschalter', 'Schalter mit Lämpchen: 1, 2, 4, 8 …'] } },
    wissen: { w: ALLE, o: ALLE, s: { '*': ['Tafel', 'tafel', 'Die Prüfungsfrage', 'Eine Frage, eingeritzt oder angeschrieben.'] } },
    luecke: { w: ALLE, o: ALLE, s: { '*': ['Buch', 'buch', 'Die Lücke', 'In einem Satz fehlt ein Wort.'] } },
    labyrinth: { w: ALLE, o: ['karte', 'wandbild', 'wuerfel', 'spieluhr', 'tafel', 'monitor', 'globus', 'totem', 'luke'], s: { '*': ['Geduldsspiel', 'wuerfel', 'Das Labyrinth', 'Ein Irrgarten im Kleinen.'], technik: ['Lüftungsplan', 'monitor', 'Durch die Schächte', 'Der Plan der Lüftungsschächte.'], alt: ['Steinlabyrinth', 'wandbild', 'Der Irrgarten', 'Ein Irrgarten in die Wand gemeißelt.'] } },
    memory: { w: ALLE, o: ['bild', 'wandbild', 'tafel', 'monitor', 'wuerfel', 'schrank', 'regal', 'truhe'], s: { '*': ['Kartenwand', 'wandbild', 'Gedächtnis', 'Verdeckte Karten – finde die Paare.'], technik: ['Monitorwand', 'monitor', 'Die Monitore', 'Bildschirme, die Paare zeigen.'] } },
    rohre: { w: ['technik', 'see', 'west', 'alt', 'sanatorium', 'krimi', 'akademie', 'bibliothek', 'spuk'], o: ['reaktor', 'kuehlschrank', 'schaltkasten', 'steuerpult', 'luke', 'fass', 'kessel', 'ventil', 'altar'], s: { '*': ['Rohrleitung', 'ventil', 'Die Leitungen', 'Rohre, die nicht zusammenpassen.'], technik: ['Kühlkreislauf', 'reaktor', 'Der Kühlkreislauf', 'Die Leitungen des Kühlkreislaufs sind verdreht.'], alt: ['Wasserrinne', 'altar', 'Die Wasserrinnen', 'Steinrinnen, durch die Wasser fließen soll.'], see: ['Bilgepumpe', 'fass', 'Die Pumpe', 'Die Pumpenleitungen im Bauch des Schiffs.'], west: ['Grubenleitung', 'fass', 'Die Wasserleitung der Mine', 'Holzrinnen der alten Mine.'] } },
    farbcode: { w: ALLE, o: ['vase', 'totem', 'altar', 'reagenz', 'flasche', 'kerze', 'ballon', 'wuerfel'], s: { '*': ['Kristalle', 'altar', 'Die farbigen Kristalle', 'Kristalle in falscher Reihenfolge.'], technik: ['Proben', 'reagenz', 'Die farbigen Proben', 'Reagenzgläser in einer Reihe.'], bunt: ['Ballons', 'ballon', 'Die bunten Ballons', 'Ballons in falscher Reihenfolge.'], west: ['Flaschen', 'flasche', 'Die Flaschen am Tresen', 'Bunte Flaschen in falscher Reihenfolge.'] } },
    raumcode: { w: ALLE, o: ['truhe', 'tresor', 'schrank', 'luke', 'sarkophag', 'fass', 'kuehlschrank', 'tuer'], s: { '*': ['Truhe', 'truhe', 'Versteckte Zeichen', 'Ein Schloss mit Zeichen statt Zahlen.'], technik: ['Sicherheitsluke', 'luke', 'Die Zeichen-Codes', 'Eine Luke mit Symboltasten.'], alt: ['Sarkophag', 'sarkophag', 'Die Zeichen der Wächter', 'Ein Sarkophag mit Symbolscheiben.'] } },
    spiegel: { w: ['technik', 'alt', 'zirkus', 'spuk', 'bibliothek', 'akademie'], o: ['spiegel', 'statue', 'altar', 'laterne', 'reaktor', 'mikroskop', 'steuerpult', 'totem', 'globus'], s: { '*': ['Spiegel', 'spiegel', 'Der Lichtstrahl', 'Mondlicht fällt auf eine Reihe Spiegel.'], technik: ['Laser', 'reaktor', 'Der Laserstrahl', 'Ein Laser – Spiegel lenken ihn zum Sensor.'], alt: ['Sonnenaltar', 'altar', 'Der Sonnenstrahl', 'Ein Sonnenstrahl fällt durch die Decke – lenk ihn mit Spiegeln.'], zirkus: ['Spiegelkabinett', 'spiegel', 'Das Spiegelkabinett', 'Spiegel und ein Scheinwerferstrahl.'] } },
    timing: { w: ALLE, o: ['tresor', 'steuerpult', 'schaltkasten', 'kanone', 'luke', 'reaktor', 'steuerrad', 'zug', 'schluessel', 'statue', 'hufeisen'], s: { '*': ['Tresorschloss', 'tresor', 'Im richtigen Moment', 'Das Schloss klickt nur im richtigen Augenblick.'], technik: ['Andockkupplung', 'steuerpult', 'Die Kopplung', 'Die Kupplung rastet nur im richtigen Moment ein.'], bunt: ['Kanone', 'kanone', 'Der Kanonenschuss', 'Zünde im richtigen Moment.'], see: ['Steuerrad', 'steuerrad', 'Gegen die Wellen', 'Halte das Steuer im richtigen Moment.'], alt: ['Pendelfalle', 'statue', 'Die Pendelfalle', 'Ein Pendel schwingt – lauf im richtigen Moment.'], west: ['Lasso', 'hufeisen', 'Der Lassowurf', 'Wirf im richtigen Moment.'] } },
    veraendert: { w: ALLE, o: ['regal', 'bild', 'schreibtisch', 'schrank', 'monitor', 'tafel', 'kamin', 'altar', 'wandbild'], s: { '*': ['Regal', 'regal', 'Was hat sich verändert?', 'Ein Regal voller Dinge – merk sie dir gut.'], technik: ['Überwachungsbildschirm', 'monitor', 'Was hat sich verändert?', 'Ein Kamerabild – gleich ändert sich etwas.'], alt: ['Opfertisch', 'altar', 'Was fehlt?', 'Gaben auf dem Altar.'] } },
    klopfzeichen: { w: ALLE, o: ['luke', 'schrank', 'sarkophag', 'kamin', 'truhe', 'fass', 'kuehlschrank', 'tuer', 'statue'], s: { '*': ['Wandschrank', 'schrank', 'Klopfzeichen', 'Hinter dem Schrank klopft es.'], technik: ['Schott', 'luke', 'Klopfen am Schott', 'Jemand klopft gegen das Schott.'], alt: ['Sarkophag', 'sarkophag', 'Klopfen aus dem Sarkophag', 'Aus dem Sarkophag kommt ein Klopfen …'], see: ['Fass', 'fass', 'Klopfen im Fass', 'Im Fass klopft es.'] } },
    waage: { w: ['grab', 'dschungel', 'labor', 'bibliothek', 'akademie', 'pirat', 'western', 'krimi', 'zirkus', 'spielzeug', 'spuk'], o: ['waage', 'altar', 'statue', 'lesepult', 'schreibtisch'], s: { '*': ['Waage', 'waage', 'Die Waage', 'Eine alte Balkenwaage.'], alt: ['Waage der Götter', 'waage', 'Das Gewicht der Seele', 'Eine steinerne Waage vor dem Altar.'], see: ['Goldwaage', 'waage', 'Die Goldwaage', 'Die Waage für Gold und Münzen.'], west: ['Goldwaage', 'waage', 'Die Goldwaage im Saloon', 'Hier wurde Gold gewogen.'], labor: ['Präzisionswaage', 'waage', 'Die Präzisionswaage', 'Eine Laborwaage.'], bunt: ['Wippe', 'waage', 'Die Wippe', 'Eine Spielzeugwippe.'], krimi: ['Briefwaage', 'waage', 'Die Briefwaage', 'Die Briefwaage auf dem Schreibtisch.'] } },
    fehlteil: { w: ALLE, o: ['tresor', 'schaltkasten', 'steuerpult', 'reaktor', 'standuhr', 'spieluhr', 'kanone', 'statue', 'altar', 'roboter', 'zug', 'klavier', 'luke', 'totem', 'kompass', 'lampe', 'laterne', 'radio', 'funk', 'telefon', 'monitor', 'computer', 'truhe', 'schrank', 'zahnrad'], s: { '*': ['Mechanismus', 'zahnrad', 'Fehlendes Teil', 'Hier fehlt etwas.'], technik: ['Steuerpult', 'steuerpult', 'Fehlendes Teil', 'Ein leerer Steckplatz.'], alt: ['Statue', 'statue', 'Das fehlende Auge', 'Der Statue fehlt etwas.'] } },
    // ---- neue Rätsel zum Anfassen
    zahnraeder: { w: ALLE, o: ['zahnrad', 'standuhr', 'spieluhr', 'roboter', 'zug', 'reaktor', 'steuerrad', 'anker', 'tresor', 'kanone'], s: { '*': ['Uhrwerk', 'zahnrad', 'Das Getriebe', 'Ein Getriebe, dem Zahnräder fehlen.'], technik: ['Antrieb', 'zahnrad', 'Der Antrieb', 'Das Getriebe des Antriebs steht still.'], alt: ['Steinmechanismus', 'zahnrad', 'Das steinerne Getriebe', 'Steinräder hinter der Wand.'], bunt: ['Aufziehwerk', 'spieluhr', 'Das Aufziehwerk', 'Das Werk der Spieluhr klemmt.'], see: ['Ankerwinde', 'anker', 'Die Ankerwinde', 'Den Zahnrädern der Winde fehlen Teile.'], west: ['Förderrad', 'zahnrad', 'Das Förderrad der Mine', 'Das Getriebe des Förderturms.'], haus: ['Uhrwerk', 'standuhr', 'Das Uhrwerk', 'Im Inneren der Uhr fehlen Zahnräder.'] } },
    schaltkreis: { w: ['technik', 'haus', 'bunt'], o: ['schaltkasten', 'steuerpult', 'lampe', 'reaktor', 'computer', 'roboter', 'monitor'], s: { '*': ['Sicherungskasten', 'schaltkasten', 'Der Stromkreis', 'Ein Sicherungskasten mit Kippschaltern.'], technik: ['Energieverteiler', 'steuerpult', 'Die Energieverteilung', 'Die Lampen zeigen, welche Module Strom haben.'], bunt: ['Roboter', 'roboter', 'Der Roboter-Stromkreis', 'Ein Roboter mit Schaltern auf dem Rücken.'] } },
    ventile: { w: ['technik', 'see', 'west', 'sanatorium', 'akademie'], o: ['ventil', 'reaktor', 'kuehlschrank', 'luke', 'fass', 'steuerpult', 'taucherhelm', 'zug', 'kessel'], s: { '*': ['Ventile', 'ventil', 'Der Druck', 'Ventile und Manometer.'], technik: ['Druckregler', 'ventil', 'Der Druckausgleich', 'Der Druck in den Leitungen muss stimmen.'], see: ['Pumpwerk', 'fass', 'Die Pumpen', 'Pumpen, die den Laderaum lenzen.'], west: ['Dampflok', 'zug', 'Der Kessel der Lok', 'Der Druck im Kessel muss stimmen.'], haus: ['Heizung', 'ventil', 'Die alte Heizung', 'Rohre und Ventile der Heizung.'] } },
    sternbild: { w: ['station', 'akademie', 'bibliothek', 'pirat', 'grab', 'dschungel', 'western', 'spuk', 'zirkus', 'spielzeug'], o: ['globus', 'karte', 'tafel', 'fernrohr', 'kompass', 'wandbild', 'monitor', 'steuerpult'], s: { '*': ['Sternkarte', 'karte', 'Das Sternbild', 'Eine Sternkarte und ein Blick in den Himmel.'], technik: ['Navigationsschirm', 'monitor', 'Die Sternenpeilung', 'Der Navigationsschirm zeigt den Sternenhimmel.'], alt: ['Himmelsdecke', 'wandbild', 'Die Sterne der Ahnen', 'Eine Decke mit gemalten Sternen.'], see: ['Sextant', 'kompass', 'Navigation nach den Sternen', 'Finde das Sternbild, nach dem der Käpt’n segelte.'], bunt: ['Kristallkugel', 'globus', 'Die Sterne lügen nicht', 'Die Kristallkugel der Wahrsagerin zeigt Sterne.'] } },
    bildpuzzle: { w: ALLE, o: ['bild', 'wandbild', 'portraet', 'karte', 'tafel', 'monitor', 'spiegel', 'totem'], s: { '*': ['Gemälde', 'bild', 'Das verdrehte Bild', 'Ein Bild in verdrehten Kacheln.'], alt: ['Mosaik', 'wandbild', 'Das Mosaik', 'Ein Mosaik aus verdrehten Steinen.'], technik: ['Kamerabild', 'monitor', 'Das gestörte Bild', 'Das Kamerabild ist zerhackt.'], haus: ['Zerrissenes Foto', 'bild', 'Das Foto', 'Ein Foto in verdrehten Stücken.'] } },
    fingerabdruck: { w: ['krimi', 'labor', 'sanatorium', 'akademie', 'station', 'unterwasser', 'western'], o: ['akte', 'mikroskop', 'computer', 'schreibtisch', 'monitor', 'spiegel', 'fingerabdruck'], s: { '*': ['Spurensicherung', 'fingerabdruck', 'Der Fingerabdruck', 'Ein Fingerabdruck vom Tatort.'], technik: ['Scanner', 'computer', 'Der Zugangsscanner', 'Nur der richtige Abdruck öffnet.'], west: ['Whiskeyglas', 'fingerabdruck', 'Der Abdruck auf dem Glas', 'Ein Abdruck auf einem Whiskeyglas.'] } },
    schattenbild: { w: ['spuk', 'zirkus', 'spielzeug', 'grab', 'dschungel', 'bibliothek', 'sanatorium', 'akademie', 'krimi'], o: ['laterne', 'kerze', 'lampe', 'wandbild', 'beamer', 'spiegel', 'zelt', 'fackel'], s: { '*': ['Lampe', 'lampe', 'Das Schattenspiel', 'Eine Lampe wirft Schatten an die Wand.'], spuk: ['Kerze', 'kerze', 'Schatten an der Wand', 'Eine Kerze wirft unheimliche Schatten.'], zirkus: ['Schattentheater', 'zelt', 'Das Schattentheater', 'Hinter dem Vorhang ein Schattentheater.'], alt: ['Fackel', 'fackel', 'Schatten im Fackellicht', 'Die Fackel wirft Schatten an die Wand.'], akademie: ['Projektor', 'beamer', 'Der Schattenprojektor', 'Der Projektor wirft Schatten an die Leinwand.'] } },
    umfuellen: { w: ['pirat', 'western', 'grab', 'dschungel', 'labor', 'zirkus', 'spuk', 'bibliothek', 'spielzeug', 'akademie'], o: ['fass', 'flasche', 'reagenz', 'vase', 'krug', 'kessel'], s: { '*': ['Krüge', 'krug', 'Genau abgemessen', 'Drei Gefäße ohne Messstriche.'], labor: ['Messkolben', 'reagenz', 'Die Messkolben', 'Kolben ohne Skala.'], akademie: ['Messkolben', 'reagenz', 'Das Chemie-Experiment', 'Drei Kolben ohne Skala.'], see: ['Rumfässer', 'fass', 'Die Rumfässer', 'Drei Fässer – eins voll Rum.'], alt: ['Wasserkrüge', 'vase', 'Das Wasseropfer', 'Krüge vor dem Altar.'], west: ['Whiskeyflaschen', 'flasche', 'Am Tresen', 'Drei Flaschen hinter dem Tresen.'], bunt: ['Zaubertrank', 'krug', 'Der Zaubertrank', 'Drei Krüge für den Zaubertrank.'], spuk: ['Weinkaraffen', 'flasche', 'Der Wein des Lords', 'Drei Karaffen im Weinkeller.'] } },
    symbolsudoku: { w: ['grab', 'dschungel', 'bibliothek', 'akademie', 'spuk', 'spielzeug', 'zirkus', 'pirat', 'western'], o: ['wandbild', 'altar', 'totem', 'tafel', 'wuerfel', 'truhe', 'sarkophag', 'buch'], s: { '*': ['Kachelfeld', 'wandbild', 'Das Zeichenfeld', 'Ein Feld aus 4×4 Kacheln.'], alt: ['Bodenplatten', 'altar', 'Die Steinplatten', 'Steinplatten mit Zeichen.'], bunt: ['Bauklötze', 'wuerfel', 'Die Bauklötze', 'Bauklötze mit Bildern.'], see: ['Schatztruhe', 'truhe', 'Die Zeichen auf dem Deckel', 'Ein Deckel voller Kacheln.'] } },
    lichtfolge: { w: ['technik', 'bunt', 'akademie', 'alt', 'sanatorium'], o: ['steuerpult', 'schaltkasten', 'computer', 'monitor', 'roboter', 'totem', 'ballon', 'spieluhr', 'reaktor'], s: { '*': ['Lichtpult', 'steuerpult', 'Die Lichtfolge', 'Lampen leuchten in einer Folge auf.'], alt: ['Statue', 'totem', 'Die leuchtenden Augen', 'Die Augen des Totems leuchten nacheinander.'], bunt: ['Ballonwand', 'ballon', 'Ballon-Blinken', 'Ballons leuchten nacheinander auf.'] } },
    funkfrequenz: { w: ['technik', 'krimi', 'akademie', 'pirat', 'sanatorium'], o: ['funk', 'radio', 'steuerpult', 'telefon', 'computer', 'monitor'], s: { '*': ['Radio', 'radio', 'Die Frequenz', 'Ein altes Radio rauscht.'], technik: ['Funkanlage', 'funk', 'Die Funkfrequenz', 'Die Funkanlage sucht ein Signal.'], see: ['Funkgerät', 'funk', 'Notruf auf See', 'Das Funkgerät auf der Brücke rauscht.'] } },
    fernrohr: { w: ['pirat', 'akademie', 'station', 'western', 'dschungel', 'bibliothek', 'unterwasser', 'grab'], o: ['fernrohr', 'globus', 'kompass', 'steuerrad', 'luke', 'karte'], s: { '*': ['Fernrohr', 'fernrohr', 'Der Blick in die Ferne', 'Ein Fernrohr am Fenster.'], technik: ['Periskop', 'fernrohr', 'Das Periskop', 'Durch das Periskop sieht man nach draußen.'], akademie: ['Teleskop', 'fernrohr', 'Das Teleskop', 'Das Teleskop der Sternwarte.'], bibliothek: ['Teleskop', 'fernrohr', 'Das Turmteleskop', 'Ein Messingteleskop am Turmfenster.'], west: ['Fernglas', 'fernrohr', 'Das Fernglas des Sheriffs', 'Vom Fenster aus sieht man die Stadt.'] } },
    schluessel: { w: ALLE, o: ['truhe', 'tresor', 'schrank', 'luke', 'tuer', 'sarkophag', 'schluessel', 'kuehlschrank'], s: { '*': ['Schlüsselbund', 'schluessel', 'Der richtige Schlüssel', 'Ein Schloss und ein Bund ähnlicher Schlüssel.'] } },
    spiegelschrift: { w: ['spuk', 'sanatorium', 'zirkus', 'bibliothek', 'krimi', 'spielzeug', 'akademie'], o: ['spiegel', 'buch', 'akte', 'wandbild', 'tafel', 'bild'], s: { '*': ['Spiegel', 'spiegel', 'Die Spiegelschrift', 'Am Spiegel steht etwas – verkehrt herum.'], bibliothek: ['Notizbuch', 'buch', 'Die gespiegelte Notiz', 'Eine Notiz in Spiegelschrift.'] } },
    leitungsgewirr: { w: ['technik', 'pirat', 'zirkus', 'sanatorium', 'western', 'krimi', 'spielzeug', 'akademie'], o: ['schaltkasten', 'steuerpult', 'telefon', 'anker', 'steuerrad', 'zelt', 'puppe', 'roboter', 'reaktor', 'hufeisen', 'spritze'], s: { '*': ['Kabelsalat', 'schaltkasten', 'Das Leitungsgewirr', 'Ein Knäuel aus Kabeln.'], see: ['Taue', 'anker', 'Die Taue', 'Ein Gewirr aus Tauen.'], zirkus: ['Trapezseile', 'zelt', 'Die Seile der Artisten', 'Seile führen zu den Glöckchen.'], west: ['Lassos', 'hufeisen', 'Die verknoteten Lassos', 'Ein Haufen verknoteter Lassos.'], spielzeug: ['Marionette', 'puppe', 'Die Fäden der Marionette', 'Welcher Faden bewegt welche Hand?'], sanatorium: ['Schläuche', 'spritze', 'Die Schläuche', 'Schläuche führen zu den Flaschen.'], krimi: ['Telefonkabel', 'telefon', 'Die angezapfte Leitung', 'Welche Leitung ist angezapft?'] } },
    farbmischen: { w: ['labor', 'grab', 'dschungel', 'spuk', 'zirkus', 'spielzeug', 'akademie', 'bibliothek'], o: ['reagenz', 'flasche', 'kessel', 'vase', 'kerze', 'ballon'], s: { '*': ['Farbtöpfe', 'kessel', 'Die richtige Farbe', 'Farbtöpfe und eine Probe.'], labor: ['Reagenzien', 'reagenz', 'Die Mischung', 'Reagenzien und eine Probe.'], akademie: ['Reagenzien', 'reagenz', 'Die Mischung', 'Reagenzien und eine Probe.'], alt: ['Trankschale', 'vase', 'Der Trank der Priester', 'Eine Schale und drei Krüge.'], spuk: ['Hexenkessel', 'kessel', 'Der Trank', 'Ein Kessel und drei Fläschchen.'], bibliothek: ['Tintenfass', 'flasche', 'Die Tinte', 'Die Tinte muss genau dieselbe Farbe haben.'], zirkus: ['Zaubertrank', 'kessel', 'Der Zaubertrank', 'Der Trank des Zauberers.'] } },
    drehringe: { w: ['grab', 'dschungel', 'bibliothek', 'spuk', 'station', 'zirkus', 'pirat'], o: ['wandbild', 'altar', 'totem', 'globus', 'tresor', 'sarkophag', 'statue', 'kompass', 'luke'], s: { '*': ['Drehringe', 'altar', 'Die Ringe', 'Steinerne Ringe mit Zeichen.'], dschungel: ['Kalenderstein', 'wandbild', 'Der Kalenderstein', 'Ein runder Kalender aus Stein.'], bibliothek: ['Astrolabium', 'globus', 'Das Astrolabium', 'Ringe eines alten Astrolabiums.'], station: ['Andockring', 'luke', 'Die Andockringe', 'Die Ringe der Andockschleuse.'], pirat: ['Astrolabium', 'kompass', 'Das Astrolabium', 'Das Navigationsgerät des Käpt’ns.'], zirkus: ['Glücksrad', 'tresor', 'Das Glücksrad', 'Das Glücksrad der Wahrsagerin.'] } },
    lecks: { w: ['unterwasser', 'station', 'pirat', 'labor', 'zirkus', 'spielzeug', 'western'], o: ['luke', 'reaktor', 'fass', 'kuehlschrank', 'taucherhelm', 'ballon', 'steuerpult', 'ventil'], s: { '*': ['Leitung', 'ventil', 'Die Lecks', 'Überall zischt es.'], unterwasser: ['Rumpf', 'luke', 'Wassereinbruch!', 'Wasser spritzt durch die Nähte.'], station: ['Kühlleitung', 'reaktor', 'Kühlmittel tritt aus', 'Die Kühlleitungen sind leck.'], pirat: ['Schiffsrumpf', 'fass', 'Leck im Rumpf', 'Wasser dringt durch die Planken.'], zirkus: ['Ballons', 'ballon', 'Ballons fangen', 'Ballons platzen gleich.'], spielzeug: ['Ballons', 'ballon', 'Ballons fangen', 'Ballons sausen los.'], western: ['Wasserturm', 'fass', 'Der löchrige Wasserturm', 'Der Wasserturm hat Löcher.'] } },
    zahlenreihe: { w: ['technik', 'akademie', 'krimi', 'bibliothek', 'sanatorium'], o: ['computer', 'tafel', 'monitor', 'steuerpult', 'tresor', 'schaltkasten', 'buch'], s: { '*': ['Zahlentafel', 'tafel', 'Die Zahlenreihe', 'Eine Folge von Zahlen.'], technik: ['Display', 'monitor', 'Die Zahlenfolge', 'Auf dem Display läuft eine Zahlenfolge.'] } },
    dominos: { w: ['western', 'zirkus', 'spielzeug', 'pirat', 'krimi', 'spuk', 'bibliothek'], o: ['wuerfel', 'domino', 'schreibtisch', 'fass', 'truhe'], s: { '*': ['Dominosteine', 'domino', 'Die Dominokette', 'Dominosteine auf dem Tisch.'] } },
    huetchenspiel: { w: ['zirkus', 'western', 'pirat', 'spielzeug', 'krimi'], o: ['zylinder', 'becher', 'fass', 'schreibtisch', 'wuerfel', 'truhe'], s: { '*': ['Hütchenspiel', 'becher', 'Wo ist die Kugel?', 'Drei Becher und eine Kugel.'], zirkus: ['Zaubertisch', 'zylinder', 'Das Hütchenspiel des Zauberers', 'Unter welchem Hut ist die Münze?'], west: ['Spieltisch', 'becher', 'Das Spiel im Saloon', 'Unter welchem Becher ist die Bohne?'], see: ['Fässer', 'fass', 'Unter welchem Fass?', 'Ein Pirat versteckt eine Münze.'] } },
    glocken: { w: ['bibliothek', 'spuk', 'grab', 'dschungel', 'zirkus', 'spielzeug', 'akademie', 'western', 'pirat'], o: ['glocke', 'klavier', 'spieluhr', 'vase', 'trommel'], s: { '*': ['Glocken', 'glocke', 'Die Glocken', 'Glocken in verschiedener Tonhöhe.'], alt: ['Klangschalen', 'vase', 'Die Klangschalen', 'Schalen, die klingen.'], spuk: ['Weingläser', 'vase', 'Die singenden Gläser', 'Gläser mit Wasser – jedes klingt anders.'], see: ['Schiffsglocken', 'glocke', 'Die Schiffsglocken', 'Glocken an Deck.'], bunt: ['Glockenspiel', 'spieluhr', 'Das Glockenspiel', 'Ein buntes Glockenspiel.'] } },
    sonar: { w: ['unterwasser', 'station', 'pirat'], o: ['sonar', 'monitor', 'steuerpult', 'computer', 'funk', 'luke', 'anker'], s: { '*': ['Sonar', 'sonar', 'Das Sonar', 'Etwas liegt verborgen – das Sonar findet es.'], station: ['Radar', 'sonar', 'Das Radar', 'Etwas treibt im All.'], pirat: ['Lot', 'anker', 'Die Suche nach dem Wrack', 'Mit dem Lot das Wrack finden.'] } },
    tastenfeld: { w: ['technik', 'krimi', 'akademie', 'sanatorium'], o: ['tastenfeld', 'tresor', 'luke', 'computer', 'schaltkasten', 'kuehlschrank', 'steuerpult'], s: { '*': ['Tastenfeld', 'tastenfeld', 'Das Tastenfeld', 'Ein Tastenfeld mit abgenutzten Tasten.'] } },
    zerrissen: { w: ALLE, o: ['akte', 'buch', 'karte', 'schreibtisch', 'bild', 'wandbild', 'schreibmaschine', 'kamin'], s: { '*': ['Zerrissener Brief', 'akte', 'Der zerrissene Brief', 'Ein Brief in Streifen.'], alt: ['Papyrus', 'karte', 'Der zerrissene Papyrus', 'Ein zerrissener Papyrus.'], spuk: ['Kamin', 'kamin', 'Aus dem Feuer gerettet', 'Ein Brief, halb verbrannt und zerrissen.'] } },
  });

  const M = () => Clavis.MECHANIKEN;
  const passtWelt = (mech, welt) => { const p = P[mech]; return !p || p.w === ALLE || p.w.includes(welt) || p.w.includes(G[welt]); };
  const passtDing = (mech, symbol) => { const p = P[mech]; return !p || p.o === ALLE || p.o.includes(symbol); };
  Clavis.passt = (mech, welt, symbol) => passtWelt(mech, welt) && (symbol == null || passtDing(mech, symbol));
  Clavis.passtWelt = passtWelt;

  Clavis.skin = (mech, welt) => {
    const p = P[mech];
    const m = M()[mech] || {};
    const s = (p && (p.s[welt] || p.s[G[welt]] || p.s['*'])) || [m.name || mech, 'truhe', m.name || mech, m.kurz || ''];
    const symbol = Clavis.ICONS && Clavis.ICONS[s[1]] ? s[1] : (p && p.o !== ALLE && p.o.find((x) => Clavis.ICONS && Clavis.ICONS[x])) || 'truhe';
    return { ort: s[0], symbol, titel: s[2], text: s[3] };
  };

  /** Rätsel zum Anfassen, die zu Welt und Gegenstand passen (unbenutzte zuerst) */
  Clavis.passendeMechaniken = (welt, symbol, benutzt = new Set()) => {
    const liste = (Clavis.ZUM_ANFASSEN || []).filter((x) => M()[x] && passtWelt(x, welt) && (symbol == null || passtDing(x, symbol)));
    return liste.filter((x) => !benutzt.has(x)).concat(liste.filter((x) => benutzt.has(x)));
  };

  const hatInhalt = (s) => s.inhalt && Object.values(s.inhalt).some((v) => (Array.isArray(v) ? v.length : v !== '' && v != null && v !== 0));

  /** Station stimmig machen: Rätsel passt zur Welt, Gegenstand passt zum Rätsel. Ergebnis: true, wenn geändert. */
  Clavis.stationAnpassen = (s, welt, benutzt = new Set()) => {
    if (!s || !M()[s.mech]) return false;
    const okW = passtWelt(s.mech, welt);
    const okD = passtDing(s.mech, s.symbol);
    if (okW && okD) return false;
    if (hatInhalt(s) && M()[s.mech].stoff) {
      // Lernstoff bleibt – nur der Gegenstand wird passend
      const sk = Clavis.skin(s.mech, welt);
      if (!okD) Object.assign(s, { symbol: sk.symbol, ort: sk.ort });
      return true;
    }
    // Erst ein anderes Rätsel, das zum Gegenstand passt (Ort und Text bleiben stimmig) …
    const fuerDing = Clavis.passendeMechaniken(welt, s.symbol, benutzt);
    if (fuerDing.length) {
      // Abwechslung: unter den passenden, noch unbenutzten eins nach Ort und Titel wählen (fest je Station)
      const frei = fuerDing.filter((x) => !benutzt.has(x));
      const auswahl = frei.length ? frei.slice(0, 5) : fuerDing.slice(0, 3);
      const h = [...String(s.ort || '') + String(s.titel || '')].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
      const neu = auswahl[h % auswahl.length];
      const sk = Clavis.skin(neu, welt);
      Object.assign(s, { mech: neu, inhalt: {}, hinweise: [], titel: sk.titel, text: sk.text });
      benutzt.add(neu);
      return true;
    }
    // … sonst bekommt das Rätsel seinen eigenen, passenden Gegenstand
    const mech = okW ? s.mech : (Clavis.passendeMechaniken(welt, null, benutzt)[0] || s.mech);
    const sk = Clavis.skin(mech, welt);
    Object.assign(s, { mech, ort: sk.ort, symbol: sk.symbol, titel: sk.titel, text: sk.text });
    if (mech !== s.mech || !okW) Object.assign(s, { inhalt: {}, hinweise: [] });
    benutzt.add(mech);
    return true;
  };

  // ================================================================ Ereignisse je Welt
  const KEIN_STROM = { stromausfall: true };
  const ERSATZ = {
    station: { regen: 'funkspruch', gewitter: 'alarm', kraehen: 'glitch', heulen: 'funkspruch', fackel: 'glitch', trommeln: 'beben', anruf: 'funkspruch', brief: 'funkspruch', spieluhr: 'funkspruch' },
    unterwasser: { regen: 'beben', gewitter: 'alarm', kraehen: 'glitch', heulen: 'funkspruch', fackel: 'glitch', trommeln: 'beben', anruf: 'funkspruch', brief: 'funkspruch' },
    labor: { kraehen: 'glitch', heulen: 'glitch', trommeln: 'alarm', fackel: 'glitch' },
    grab: { anruf: 'fluestern', funkspruch: 'fluestern', alarm: 'beben', glitch: 'fluestern', regen: 'beben', gewitter: 'beben', explosion: 'beben', brief: 'fluestern' },
    dschungel: { anruf: 'trommeln', funkspruch: 'trommeln', alarm: 'trommeln', glitch: 'kraehen', brief: 'trommeln' },
    pirat: { anruf: 'brief', funkspruch: 'brief', glitch: 'gewitter', alarm: 'trommeln' },
    western: { anruf: 'brief', funkspruch: 'brief', glitch: 'heulen', alarm: 'schritte' },
    spuk: { glitch: 'fluestern', funkspruch: 'anruf', alarm: 'uhrschlag', explosion: 'gewitter' },
    bibliothek: { glitch: 'fluestern', funkspruch: 'brief', alarm: 'uhrschlag', explosion: 'beben' },
    zirkus: { glitch: 'stromausfall', funkspruch: 'anruf', heulen: 'lachen' },
    spielzeug: { glitch: 'spieluhr', funkspruch: 'anruf', heulen: 'kichern', schrei: 'kichern', ketten: 'spieluhr' },
    krimi: { glitch: 'stromausfall', funkspruch: 'anruf' },
    akademie: { funkspruch: 'anruf', heulen: 'schritte' },
    sanatorium: { funkspruch: 'anruf', glitch: 'stromausfall' },
  };
  Clavis.ereignisFuerWelt = (art, welt) => {
    const neu = (ERSATZ[welt] || {})[art] || art;
    return Clavis.EREIGNISSE && Clavis.EREIGNISSE[neu] ? neu : art;
  };
  void KEIN_STROM;
  /** Texte, die zur Welt passen, wenn sonst keiner da ist */
  Clavis.EREIGNIS_WELT = {
    stromausfall: { grab: 'Ein eisiger Windstoß – alle Fackeln erlöschen.', dschungel: 'Ein Windstoß fegt durch den Tempel und löscht die Fackeln.', pirat: 'Eine Welle schlägt gegen den Rumpf – die Laternen erlöschen.', western: 'Die Öllampen flackern und gehen aus.', spuk: 'Alle Kerzen erlöschen auf einmal.', bibliothek: 'Ein Luftzug – die Kerzen erlöschen.', zirkus: 'Klack – die Scheinwerfer gehen aus.' },
  };

  // ================================================================ Wenn die Zeit abläuft (Outro)
  Clavis.SCHEITERN = {
    krimi: { text: 'Die Tür geht auf – der Nachtportier steht im Rahmen. „Was machen Sie denn hier?“ Der Fall bleibt ungelöst.', kinder: 'Der Hausmeister schließt auf und lacht: „Fast hättest du den Fall gelöst!“' },
    labor: { text: 'Die Notabschaltung greift. Alles wird dunkel – und das Labor versiegelt sich.', kinder: 'Pffft – die Erfindung macht Pause. Aber du warst ganz nah dran!' },
    grab: { text: 'Der letzte Sand rieselt herab. Die Grabkammer behält ihr Geheimnis – und dich.', kinder: 'Die Sanduhr ist abgelaufen – aber die Pyramide lässt dich lachend wieder raus!' },
    station: { text: 'Der Sauerstoff wird knapp. Die Lichter dimmen, und die Station treibt weiter durchs Dunkel.', kinder: 'Die Rakete ist ohne dich gestartet – aber der Roboter holt dich gleich ab!' },
    spuk: { text: 'Die Uhr schlägt dreizehn. Aus allen Porträts sehen dich Augen an – du gehörst jetzt zum Haus.', kinder: 'Die Gespenster kichern: „Bleib doch zum Tee!“ Fast geschafft!' },
    bibliothek: { text: 'Die letzte Kerze erlischt. Die Bibliothek bewahrt ihr Geheimnis – noch einmal hundert Jahre.', kinder: 'Die Zauberbücher klappen zu – nächstes Mal schaffst du es!' },
    pirat: { text: 'Das Wasser steigt über die Planken. Das Wrack sinkt mit seinem Schatz in die Tiefe.', kinder: 'Der Papagei krächzt: „Fast! Fast!“ Nochmal?' },
    akademie: { text: 'Der Wachdienst leuchtet dir ins Gesicht. „Das wird ein Nachspiel haben.“', kinder: 'Der Hausmeister schaut verwundert – und schließt dir lächelnd die Tür auf.' },
    zirkus: { text: 'Die Lichter gehen an – Magnifico seufzt: „Die Show muss warten.“', kinder: 'Die Lichter gehen an – Magnifico lacht: „Nicht schlimm, die Show war trotzdem toll!“' },
    dschungel: { text: 'Der Steinblock rollt zu. Der Dschungel holt sich den Tempel zurück.', kinder: 'Die Affen kichern und schieben den Stein wieder weg. Fast geschafft!' },
    unterwasser: { text: 'Das Schott schließt sich. Draußen gleitet ein riesiger Schatten am Fenster vorbei.', kinder: 'Ein freundlicher Wal schiebt das U-Boot nach oben. Nochmal?' },
    spielzeug: { text: 'Die Spieluhr steht still. Alle Spielzeuge drehen langsam die Köpfe zu dir.', kinder: 'Der Teddy kichert: „Nochmal spielen?“ – und schon geht die Tür auf.' },
    western: { text: 'Der Bandit reitet in den Sonnenuntergang – mit dem Gold.', kinder: 'Der Zug fährt ohne dich los – aber der Sheriff winkt: „Nächstes Mal!“' },
    sanatorium: { text: 'Die Lichter flackern. Auf der Liste von Station 13 steht jetzt ein vierzehnter Name.' },
  };

  // ================================================================ Wendungen je Welt (was genau passiert, wie es aussieht)
  Clavis.WENDUNG_WELT = {
    nebel: {
      krimi: { stil: 'rauch', titel: 'Rauch!', text: 'Dichter Zigarrenrauch quillt aus dem Lüftungsschacht – du siehst kaum noch etwas.' },
      labor: { stil: 'dampf', titel: 'Gaswolke!', text: 'Ein Ventil platzt – eine Wolke aus Trockeneisnebel füllt das Labor.', kinder: 'Pffft! Die Nebelmaschine im Erfinderlabor ist an – alles ist voller Nebel.' },
      grab: { stil: 'sand', titel: 'Sandsturm!', text: 'Durch einen Spalt fegt Sand herein – du siehst kaum die Hand vor Augen.', kinder: 'Huiii! Wind pustet Sand durch die Pyramide.' },
      station: { stil: 'dampf', titel: 'Kühlmittel!', text: 'Eine Kühlleitung bricht – weißer Dampf füllt das Modul.' },
      spuk: { stil: 'nebel', titel: 'Geisternebel!', text: 'Kalter Nebel kriecht unter der Tür hindurch und füllt das Zimmer.', kinder: 'Ein freundlicher Gespensternebel schwebt herein.' },
      bibliothek: { stil: 'staub', titel: 'Staubwolke!', text: 'Ein Regal kippt – eine dicke Staubwolke hüllt alles ein.', kinder: 'Hatschi! Ein Regal wackelt und eine riesige Staubwolke fliegt herum.' },
      pirat: { stil: 'nebel', titel: 'Seenebel!', text: 'Dichter Seenebel zieht durch die Luken herein.' },
      akademie: { stil: 'rauch', titel: 'Rauch!', text: 'Ein Experiment im Nebenraum qualmt – Rauch zieht durch den Hörsaal.', kinder: 'Ein Experiment im Nebenraum macht ganz viel Dampf!' },
      zirkus: { stil: 'buehne', titel: 'Bühnennebel!', text: 'Die Nebelmaschine springt von selbst an – Bühnennebel wabert durch die Manege.', kinder: 'Die Nebelmaschine pustet bunten Bühnennebel in die Manege!' },
      dschungel: { stil: 'nebel', titel: 'Dschungelnebel!', text: 'Feuchter Nebel steigt vom Boden auf.' },
      unterwasser: { stil: 'dampf', titel: 'Dampf!', text: 'Ein Heizrohr platzt – heißer Dampf zischt in den Raum.', kinder: 'Zisch! Ein Rohr pustet Dampf – das U-Boot ist ganz neblig.' },
      spielzeug: { stil: 'blasen', titel: 'Seifenblasen!', text: 'Die Seifenblasenmaschine geht los – überall Blasen!', kinder: 'Die Seifenblasenmaschine geht los – überall Blasen!' },
      western: { stil: 'staub', titel: 'Staubsturm!', text: 'Ein Staubsturm fegt durch die Ritzen der Bretter.', kinder: 'Ein Wirbelwind pustet Staub in den Saloon!' },
      sanatorium: { stil: 'dampf', titel: 'Dampf!', text: 'Aus den alten Heizungsrohren zischt Dampf.' },
    },
    dunkel: {
      grab: { titel: 'Die Fackeln erlöschen!', text: 'Ein Windstoß – alle Fackeln gehen aus.' },
      dschungel: { titel: 'Die Fackeln erlöschen!', text: 'Ein Windstoß löscht die Fackeln.' },
      pirat: { titel: 'Die Laternen erlöschen!', text: 'Eine Welle schaukelt das Schiff – die Laternen gehen aus.' },
      western: { titel: 'Die Lampen gehen aus!', text: 'Ein Windstoß bläst die Öllampen aus.' },
      spuk: { titel: 'Die Kerzen erlöschen!', text: 'Alle Kerzen erlöschen auf einmal.' },
      bibliothek: { titel: 'Die Kerzen erlöschen!', text: 'Ein kalter Luftzug löscht die Kerzen.' },
      zirkus: { titel: 'Scheinwerfer aus!', text: 'Klack – die Scheinwerfer fallen aus. Stockdunkel in der Manege.' },
    },
    countdown: {
      krimi: { titel: 'Er kommt zurück!', kurz: 'Der Täter kommt zurück', text: 'Schritte auf der Treppe – in 90 Sekunden steht er in der Tür.', kinder: 'Der Hausmeister kommt gleich vorbei!' },
      labor: { titel: 'Der Reaktor überhitzt!', kurz: 'Der Reaktor überhitzt', text: 'Die Temperatur steigt – in 90 Sekunden schaltet die Notabschaltung alles ab.', kinder: 'Der Erfinderkessel blubbert gleich über!' },
      grab: { titel: 'Die Decke senkt sich!', kurz: 'Die Decke senkt sich', text: 'Mit einem Grollen senkt sich die Steindecke.', kinder: 'Der Sand rieselt – die Sanduhr der Pyramide läuft!' },
      station: { titel: 'Selbstzerstörung!', kurz: 'Selbstzerstörung aktiv', text: 'Eine Stimme zählt: „Selbstzerstörung in 90 Sekunden.“', kinder: 'Die Rakete startet gleich – und du bist noch drin!' },
      spuk: { titel: 'Gleich Mitternacht!', kurz: 'Mitternacht naht', text: 'Die Standuhr holt zum letzten Schlag aus – wenn sie Mitternacht schlägt, ist es zu spät.', kinder: 'Gleich schlägt die Gespensteruhr – dann tanzen die Gespenster!' },
      bibliothek: { titel: 'Die Kerze brennt herunter!', kurz: 'Die Kerze brennt herunter', text: 'Nur noch eine Kerze brennt – und sie ist fast herunter.' },
      pirat: { titel: 'Die Lunte brennt!', kurz: 'Die Lunte brennt', text: 'Jemand hat die Lunte am Pulverfass angezündet!', kinder: 'Die Konfettikanone ist angezündet!' },
      akademie: { titel: 'Der Wachdienst kommt!', kurz: 'Der Wachdienst kommt', text: 'Die Taschenlampe des Wachdienstes tanzt den Flur entlang.', kinder: 'Der Hausmeister macht gleich seine Runde!' },
      zirkus: { titel: 'Die Kanone!', kurz: 'Die Kanone wird gezündet', text: 'Die Menschenkanone ist geladen – die Lunte brennt.', kinder: 'Die Konfettikanone zählt rückwärts!' },
      dschungel: { titel: 'Das Wasser steigt!', kurz: 'Das Wasser steigt', text: 'Eine Falle ist ausgelöst – Wasser strömt in die Kammer.', kinder: 'Der Affe dreht am Wasserhahn – gleich wird es nass!' },
      unterwasser: { titel: 'Das Schott schließt!', kurz: 'Das Druckschott schließt', text: 'Sirene: In 90 Sekunden schließt sich das Druckschott.', kinder: 'Das U-Boot taucht gleich ab!' },
      spielzeug: { titel: 'Die Spieluhr läuft ab!', kurz: 'Die Spieluhr läuft ab', text: 'Die große Spieluhr dreht sich immer langsamer.', kinder: 'Der Aufzieh-Teddy läuft gleich ab!' },
      western: { titel: 'Dynamit!', kurz: 'Die Dynamitlunte brennt', text: 'Eine Dynamitlunte zischt im Schuppen nebenan.', kinder: 'Der Zug kommt gleich in die Stadt gefahren!' },
      sanatorium: { titel: 'Sie kommen!', kurz: 'Die Schritte kommen näher', text: 'Schritte auf dem Flur – sie kommen näher.' },
    },
  };
})();
