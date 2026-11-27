'use strict';
/* Mercy Creek – Die letzte Schicht. Story und autoritativer Spielleiter, nur beim Host. */
const ClavisFrontier = (() => {
    const VORLAGE = { id: 'v-mercy-creek', premium: 'mercy', titel: 'Mercy Creek – Die letzte Schicht', welt: 'western', alter: 'ab14', jumpscares: true, empfohlen: 'schwer', spieler: '1–4', stimmung: { spannung: 10, gefahr: 8, spuk: 8, grusel: 7 }, anriss: 'Rocky Mountains, 1897. Dreizehn Bergleute wurden aus den Büchern gestrichen. Heute Nacht steht die letzte Schicht auf deinem Namen.', intro: 'Du reist nach Mercy Creek, um eine Erbschaft anzutreten. Der Zug fährt nicht zurück. In der verlassenen Stadt wartet ein Mann, der seit sechs Jahren tot ist.', outro: 'Zum ersten Mal läutet die Glocke für die Lebenden.', szenen: [{ titel: 'Mercy Creek', stationen: [] }] };
    const ORTE = {
        bahnhof: { name: 'Letzter Halt', kapitel: 'I · Das Erbe', sub: 'Der Zug fährt nicht zurück.', objekte: ['koffer', 'fahrbefehl', 'weiche', 'plakat'], nachbarn: ['strasse'] },
        strasse: { name: 'Mercy Creek', kapitel: 'I · Das Erbe', sub: 'Eine Stadt, die ihre Toten verschweigt.', objekte: ['brunnen', 'aushang', 'vane', 'wegweiser'], nachbarn: ['bahnhof', 'saloon', 'sheriff', 'bank', 'foerderhaus', 'kapelle'] },
        saloon: { name: 'The Last Dollar', kapitel: 'II · Unter dem Gold', sub: 'Am Tisch steht noch ein warmes Glas.', objekte: ['pianola', 'rolle', 'spiegel', 'voss'], nachbarn: ['strasse'] },
        sheriff: { name: 'Das leere Revier', kapitel: 'II · Unter dem Gold', sub: 'Niemand hat die Zellen von außen verschlossen.', objekte: ['depesche', 'chiffre', 'zelle', 'kalender'], nachbarn: ['strasse'] },
        bank: { name: 'Blackwater Bank', kapitel: 'II · Unter dem Gold', sub: 'Hier bekamen Menschen einen Preis.', objekte: ['tresor', 'bankbrief', 'gold', 'vertrag'], nachbarn: ['strasse'] },
        foerderhaus: { name: 'Der Schachtkopf', kapitel: 'III · Die Zeugen', sub: 'Von unten kommt ein Atemzug.', objekte: ['pumpen', 'pumpplan', 'mara', 'winde', 'lasttafel'], nachbarn: ['strasse', 'stollen'] },
        stollen: { name: 'Unter den Rockies', kapitel: 'III · Die Zeugen', sub: 'Die Grube wurde von innen gesprengt.', objekte: ['stollen', 'grubenplan', 'helm', 'wand'], nachbarn: ['foerderhaus', 'kammer'] },
        kammer: { name: 'Schicht dreizehn', kapitel: 'IV · Wem gehört die Schuld?', sub: 'Nicht jeder, der geblieben ist, wurde begraben.', objekte: ['schichten', 'schichtzettel', 'belege', 'sprengung', 'zuendplan', 'sarg'], nachbarn: ['stollen', 'kapelle'] },
        kapelle: { name: 'Die dreizehnte Glocke', kapitel: 'V · Deine letzte Unterschrift', sub: 'Diesmal entscheidest du, für wen sie läutet.', objekte: ['glocke', 'glockenbuch', 'ende', 'fenster'], nachbarn: ['strasse', 'kammer'] },
    };
    const O = {
        koffer: { name: 'Dein Reisekoffer', ort: 'bahnhof', x: 14, y: 86, art: 'fund', text: 'Zwischen trockenen Hemden liegt das Testament. Du hast den Umschlag nie geöffnet. Jetzt ist das Siegel gebrochen. Darin: ein Anteilsschein der Blackwater Mining Company und eine Fahrkarte. Auf der Rückseite steht: „Eine Erbschaft kann man ausschlagen. Eine Schuld nicht.“', item: ['anteil', 'Blackwater-Anteilsschein', '▣'] },
        fahrbefehl: { name: 'Der letzte Fahrbefehl', ort: 'bahnhof', x: 69, y: 51, art: 'papier', text: 'SONDERFAHRT NACH MERCY CREEK\nDie Lok muss über Waage B, Wasserturm E und Prüfposten G. Die Bruchbrücke F ist gesperrt. Stelle alle befahrenen Weichen und gib den Zug erst danach frei.\nAm unteren Rand steht in anderer Tinte: „Rückfahrten sind im Fahrpreis nicht enthalten.“' },
        plakat: { name: 'Das Suchplakat', ort: 'bahnhof', x: 85, y: 44, art: 'papier', text: 'GESUCHT: MARA BELL. Vermessungsingenieurin. Sabotage an Firmeneigentum. Bewaffnet mit falschen Behauptungen.\nDas Foto zeigt eine junge Frau mit einer Narbe über der Braue. Eine Ecke des Plakats ist abgerissen. Darunter steht der Name des Auftraggebers: SILAS VANE.' },
        brunnen: { name: 'Der Stadtbrunnen', ort: 'strasse', x: 50, y: 70, art: 'fund', text: 'Das Wasser ist schwarz. Dreizehn Messingplaketten hängen am Eimer. Auf jeder steht ein Name. Als der Wind nachlässt, bewegen sie sich weiter. Gegen den Wind.\nAm Brunnenrand: „Die Pumpe läuft nicht. Unten ist noch Luft.“', item: ['plaketten', 'Dreizehn Namensplaketten', '◈'] },
        aushang: { name: 'Bekanntmachung von 1891', ort: 'strasse', x: 22, y: 52, art: 'papier', text: 'BLACKWATER MINING COMPANY\nAlle Beschäftigten der Nachtschicht haben Mercy Creek freiwillig verlassen. Lohnansprüche sind erloschen. Das Bergwerk bleibt bis auf Weiteres geschlossen.\nDarunter klebt eine Todesanzeige. Derselbe Tag. Derselbe Firmenstempel. Kein einziger Name.' },
        vane: { name: 'Der Mann am Saloon', ort: 'strasse', x: 70, y: 56, art: 'fund', text: 'Ein Mann im langen Mantel steht vor dem Saloon. Sein Hutrand ist trocken. „Vane“, sagt er. „Ich verwalte Ihr Erbe. Der Tresor gehört Ihnen. Was darunter liegt, geht Sie nichts an.“\nAls du auf seine Stiefel siehst, steht er bereits hinter der Tür.' },
        wegweiser: { name: 'Die Straße ins Tal', ort: 'strasse', x: 88, y: 72, art: 'papier', text: 'Die Brücke ist fort. Im Felssturz stecken frische Schwellen. Der einzige Durchgang liegt hinter der Kapelle, doch der Eisenriegel hängt am Glockenwerk. Auf der Uhr steht 04:13. Keine der beiden Zeigerachsen bewegt sich.' },
        rolle: { name: 'Die zerrissene Spielrolle', ort: 'saloon', x: 30, y: 47, art: 'papier', text: 'Sechs Stücke einer Pianolarolle. Die Randzeichen verbinden die Abschnitte: Das rechte Zeichen eines Stücks muss links am nächsten wiederkehren. Jedes Stück darf gedreht werden. Die Anfangs- und Endmarke stehen am Gerät.\nHandschrift: „Wenn sie verstummt, merke dir die vier Zeichen. Die Glocke kennt die Melodie noch.“' },
        spiegel: { name: 'Der blinde Spiegel', ort: 'saloon', x: 73, y: 35, art: 'papier', text: 'Du wischst Staub vom Spiegel. Die Tische spiegeln sich, die Lampe auch. Der Mann hinter dir nicht.\nAuf der Rückseite des Rahmens steht eine Rechnung: „Ein Spiegel, ersetzt nach der Beerdigung von Mr. Silas Vane.“' },
        voss: { name: 'Das Glas am Tisch', ort: 'saloon', x: 84, y: 79, art: 'fund', text: 'Whisky, unberührt. Daneben ein Messingring mit dem Firmenzeichen. Du hebst das Glas an. Im nassen Kreis auf dem Tisch erscheint ein Satz: „Er braucht keine Tür. Nur eine Unterschrift.“', item: ['ring', 'Blackwater-Siegelring', '◎'] },
        chiffre: { name: 'Chiffrierbuch', ort: 'sheriff', x: 66, y: 79, art: 'papier', text: 'TELEGRAFENDIENST · PRIVATES QUADRAT\nDie Ziffernpaare bezeichnen zuerst eine Zeile, dann eine Spalte im Buchstabenquadrat. I und J teilen sich ein Feld.\nDie chiffrierte Depesche stammt nicht vom Sheriff. Auf dem Verschluss sitzt das Siegel der Bank.' },
        zelle: { name: 'Zelle drei', ort: 'sheriff', x: 25, y: 51, art: 'papier', text: 'Der Schlüssel steckt innen. In die Pritsche sind dreizehn Striche geritzt. Daneben: „Sie haben uns vorgeladen, damit wir nicht in der Grube wären. Als wir nicht unterschreiben wollten, brachten sie uns zurück.“' },
        kalender: { name: 'Der abgerissene Kalender', ort: 'sheriff', x: 82, y: 33, art: 'papier', text: '14. NOVEMBER 1891. Der Tag des Unglücks. Ein Blatt wurde unter den Kalender geschoben: „Silas Vane, Direktor. Beim Einsturz verschollen. Später im verschlossenen Büro aufgefunden.“\nDu hörst draußen Schritte. Sie halten vor der Tür an.' },
        bankbrief: { name: 'Der Brief der Bank', ort: 'bank', x: 24, y: 83, art: 'dynamisch' },
        vertrag: { name: 'Das Testament', ort: 'bank', x: 77, y: 43, art: 'papier', text: 'Die Firma überträgt Ihnen das letzte Grubenrecht. Besitzübergang erfolgt durch Bestätigung am Glockensiegel.\nKleingedruckt: Mit dem Recht gehen sämtliche unbeglichenen Ansprüche auf den neuen Eigentümer über.\nDein Vorfahr hat die erste Abschrift gezeichnet. Die Zeile für deinen Namen ist noch leer.' },
        gold: { name: 'Der Goldbarren', ort: 'bank', x: 68, y: 80, art: 'wahl', wahl: 'gold', text: 'Ein Barren liegt auf schwarzem Samt. 18 Kilogramm. Kein Staub, kein Rost. Dein Erbe, sagt Vane. Unter dem Gold liegt der Plan des Förderhauses. Du kannst den Barren mitnehmen oder ihn liegen lassen.' },
        pumpplan: { name: 'Die Pumpentafel', ort: 'foerderhaus', x: 21, y: 47, art: 'papier', text: 'ENTWÄSSERUNG · ALLE NEUN FELDER DURCHSTRÖMEN\nDrehe die Rohrstücke. Wasser tritt links oben ein und rechts unten aus. Keine offene Verbindung darf in den Boden laufen. Die gesamte Leitung muss zusammenhängen.\nDie Pumpe hebt das Schutzgitter. Darunter klopft jemand.' },
        mara: { name: 'Unter dem Schutzgitter', ort: 'foerderhaus', x: 85, y: 80, art: 'wahl', wahl: 'mara', text: 'Die Frau vom Suchplakat lebt. Ein Balken hält ihr Bein fest. „Vane ist tot“, sagt Mara Bell. „Er war der einzige im Büro, als die Eingeschlossenen unten erstickten. Er kommt hier nicht weg, solange die letzte Schicht noch einen Anspruch gegen ihn hat.“\nDu kannst sie befreien. Der Förderkorb muss dann ihr Gewicht mittragen.' },
        lasttafel: { name: 'Die Lasttafel', ort: 'foerderhaus', x: 80, y: 40, art: 'dynamisch' },
        grubenplan: { name: 'Der Grubenriss', ort: 'stollen', x: 13, y: 27, art: 'papier', text: 'Der alte Riss zeigt alle offenen Verbindungen. Zwei mit Messing markierte Kontrollstellen müssen auf dem Weg zum Archiv passiert werden. Vermeide Umwege: Deine Lampe hat nur eine begrenzte Zahl Wegschritte.\nDie Karte bleibt während des Gehens sichtbar. Du kannst jederzeit zum Eingang zurückkehren und neu planen.' },
        helm: { name: 'Der kleine Helm', ort: 'stollen', x: 82, y: 80, art: 'fund', text: 'Ein Helm, kaum größer als eine Schüssel. Innen steht: NOAH BELL, 14. Du findest daneben ein Bild: eine Frau mit zwei Kindern. Das ältere Mädchen legt dem kleinen Jungen den Arm um die Schulter.\nMara ist nicht wegen des Goldes hier. Noah war ihr Bruder.', item: ['foto', 'Foto der Familie Bell', '▧'] },
        wand: { name: 'Die Spuren im Fels', ort: 'stollen', x: 82, y: 43, art: 'papier', text: 'Die Splitter liegen auf der falschen Seite. Jemand hat den Ausgang von innen gesprengt. Auf einem Balken steht in Kreide: „Wir waren dreizehn. Nicht zwölf. Er hat den Jungen nie eingetragen.“' },
        schichtzettel: { name: 'Die Schichtzettel', ort: 'kammer', x: 22, y: 45, art: 'papier', text: 'Fünf Fördergruppen. Die Reihenfolge wurde nachträglich geändert, damit die Beschäftigten als abgereist galten. Ordne die Namensschilder mit den Aussagen am Buch. Nur eine Reihenfolge erfüllt alle Aussagen.\nDer letzte Zettel gehört Noah Bell. Er erhielt keinen Lohn. Deshalb fehlt er im Hauptbuch.' },
        belege: { name: 'Das Originalbuch', ort: 'kammer', x: 29, y: 70, art: 'wahl', wahl: 'belege', text: 'Zwischen den Seiten liegt der Sprengbefehl. Vanes Unterschrift. Dreizehn Namen. Auch der deiner Familie als Geldgeber. Das feuchte Buch zu sichern dauert eine Minute. Verbrennst du es, gibt die trockene Bindung der Lampe neue Zeit. Aber die Beweise verschwinden.' },
        zuendplan: { name: 'Das Zündschema', ort: 'kammer', x: 81, y: 44, art: 'papier', text: 'NOTABSCHALTUNG\nTrenne genau zwei Leitungen. Das Herz der Grube muss von EIN getrennt sein. LUFT und AUS müssen weiterhin mit EIN verbunden bleiben. Leitungen sind in beide Richtungen verbunden.\nVane hat seine Glocke an die Sprengleitung gekoppelt. Die falsche Trennung nimmt dir den Rückweg.' },
        sarg: { name: 'Der verschlossene Bürotresen', ort: 'kammer', x: 57, y: 71, art: 'papier', text: 'Kein Sarg. Ein Schreibtisch. Dahinter liegt ein Mantel, wie du ihn eben im Saloon gesehen hast. Die Manschetten sind an das Holz genagelt.\nVane war nicht beim Einsturz gestorben. Die Überlebenden hatten ihn hier eingeschlossen. Er wartete sechs Jahre auf einen Erben.' },
        glockenbuch: { name: 'Das Buch des Glöckners', ort: 'kapelle', x: 78, y: 59, art: 'papier', text: 'Die Pianola nennt vier Zeichen. Spiele sie am Glockenwerk rückwärts. Dann das zweite Zeichen des Originals, dann das erste.\n„Die Glocke darf wieder läuten. Aber nicht für einen Besitzer. Für die Namen.“\nDas Grubenrecht lässt sich am letzten Siegel ausschlagen. Dazu muss alles Gold hierbleiben.' },
        ende: { name: 'Das letzte Siegel', ort: 'kapelle', x: 60, y: 67, art: 'finale' },
        fenster: { name: 'Blick auf die Hauptstraße', ort: 'kapelle', x: 32, y: 40, art: 'papier', text: 'Dreizehn Lampen gehen auf der Straße an. Unter jeder steht ein Mensch. Niemand sieht zu dir herauf. Alle sehen zum Berg.\nZum ersten Mal wirkt die Stadt nicht verlassen. Nur wartend.' },
    };
    const ST = {
        weiche: ['bahnhof', 54, 76, [], ['fahrbefehl'], 'Das letzte Stellwerk', 'Führe die Lok über alle drei Kontrollpunkte. Die Bruchbrücke darf nicht befahren werden.'],
        pianola: ['saloon', 31, 65, [], ['rolle'], 'Eine Rolle für die Toten', 'Verbinde alle sechs Streifen. Jeder Rand muss zum nächsten passen.'],
        depesche: ['sheriff', 42, 76, [], ['chiffre'], 'Die private Depesche', 'Entschlüssele die Nachricht mit dem Quadrat des Sheriffs.'],
        tresor: ['bank', 53, 49, ['pianola', 'depesche'], ['bankbrief'], 'Der Tresor ohne Schlüssel', 'Vier gekoppelte Räder. Der Brief nennt die Zielstellung.'],
        pumpen: ['foerderhaus', 18, 64, ['tresor'], ['pumpplan'], 'Wasser unter der Stadt', 'Schließe die gesamte Rohrstrecke. Kein Feld darf trocken bleiben.'],
        winde: ['foerderhaus', 55, 31, ['pumpen'], ['lasttafel'], 'Wer fährt mit nach unten?', 'Gegengewichte können am anderen Seil oder im Korb hängen. Gleiche die tatsächliche Last aus.'],
        stollen: ['stollen', 50, 55, ['winde'], ['grubenplan'], 'Der Weg durch den Berg', 'Gehe zu beiden Kontrollmarken und erreiche das Archiv innerhalb der Lampenreichweite.'],
        schichten: ['kammer', 33, 65, ['stollen'], ['schichtzettel'], 'Die Menschen hinter den Zahlen', 'Stelle die fünf Fördergruppen mit den Zeugenaussagen wieder her.'],
        sprengung: ['kammer', 72, 36, ['schichten'], ['zuendplan'], 'Das Herz aus Gold', 'Zwei Trennstellen. Das Herz muss still werden, Luft und Rückweg müssen bleiben.'],
        glocke: ['kapelle', 57, 31, ['sprengung'], ['glockenbuch'], 'Für wen die Glocke läutet', 'Die Melodie aus dem Saloon öffnet den letzten Riegel.'],
    };
    const beat = (titel, text, ort, effekt = 'wind', bild = 'weit') => ({ titel, text, ort, effekt, bild });
    const SZ = {
        intro: { titel: 'Die Erbschaft', zeilen: [beat('Colorado · November 1897', 'Die Kanzlei hat dich viermal angeschrieben. Du hast viermal nicht geantwortet. Beim fünften Brief lag eine Fahrkarte bei. Und ein Goldstück, das wärmer war als deine Hand.', 'bahnhof', 'zug', 'zug'), beat('Eine Stadt oberhalb der Wolken', 'Mercy Creek. Zweiundvierzig Häuser. Ein Bergwerk. Seit sechs Jahren kein ausgezahlter Lohn. Der Schaffner nimmt deine Karte nicht zurück. „Die brauchen Sie dort noch.“', 'strasse', 'wind', 'berg'), beat('Der letzte Halt', 'Der Zug hält im Schneeregen. Niemand steigt ein. Als du dich umdrehst, rollt der leere letzte Wagen bereits in den Nebel. Auf deiner Karte steht jetzt: EINFACHE FAHRT.', 'bahnhof', 'bremse', 'ticket'), beat('04:13', 'Aus der Stadt schlägt eine Glocke. Einmal. Dann noch einmal. Die Bahnhofsuhr springt auf vier Uhr dreizehn. In dem Moment verschüttet eine Lawine die Strecke hinter dir.', 'bahnhof', 'lawine', 'uhr'), beat('Ein Telegramm ohne Absender', 'AM DREIZEHNTEN SCHLAG BEGINNT DIE LETZTE SCHICHT.\nDER ERBE WIRD GEBETEN, SEINEN PLATZ EINZUNEHMEN.', 'sheriff', 'telegraf', 'papier'), beat('Die Nacht gehört dir', 'Ein Licht bewegt sich im Saloon. Der Rest der Stadt liegt dunkel. Bevor die Glocke zum dreizehnten Mal schlägt, musst du verstehen, was du geerbt hast.', 'strasse', 'glocke', 'tuer')] },
        weiche: { titel: 'Die Stadt nimmt dich auf', zeilen: [beat('Ein Zug ohne Personal', 'Du gibst die Weichen frei. Die Lok stößt einen Atemzug aus. Dann rollt sie davon, ohne dass jemand im Führerstand steht.', 'bahnhof', 'zug', 'zug'), beat('Der Verwalter', 'Vor dem Saloon wartet ein Mann. „Silas Vane. Willkommen zu Hause.“ Er nimmt den Hut ab. Die Stirn darunter ist so kalt und weiß wie der Schnee.', 'saloon', 'stiefel', 'gesicht')] },
        pianola: { titel: 'Die vier Zeichen', zeilen: [beat('Eine Melodie bleibt übrig', 'Die Rolle läuft an. Sechs Töne. Dann wieder dieselben vier. Unter dem Klavierboden fällt ein Schlüssel auf die Dielen. Eingraviert: BLACKWATER BANK.', 'saloon', 'pianola', 'rolle'), beat('Nicht für dich', 'Im Spiegel stehen Menschen hinter deinem Stuhl. Du drehst dich um. Nur die Stühle sind da. Einer schaukelt langsam zurück.', 'saloon', 'lachen', 'spiegel')] },
        depesche: { titel: 'Unter dem Gold', zeilen: [beat('Die letzte Anweisung', 'Die Depesche ist kein Notruf. Sie ist ein Auftrag: „Dreizehn Ansprüche abschließen. Die Auszahlung erfolgt aus dem Erlös der Grube.“', 'sheriff', 'telegraf', 'papier'), beat('Ein Preis pro Mensch', 'Neben der Nachricht liegen dreizehn Quittungen. Auf jeder ein Name. Auf jeder derselbe Stempel: ABGEREIST. Der Stempel passt exakt auf eine Todesanzeige.', 'bank', 'herz', 'vertrag')] },
        tresor: { titel: 'Dein Anteil', zeilen: [beat('Was hier glänzt', 'Der Tresor öffnet sich. Ein einziger Goldbarren. Der Rest des Raums ist mit Namensschildern gefüllt. Vane tritt an deine Schulter. „Alles gehört jetzt Ihnen.“', 'bank', 'tresor', 'gold'), beat('Eine fremde Hand', 'Als du nach dem Plan unter dem Barren greifst, schließt sich der Tresorgriff hinter deinem Rücken. Aus dem Förderhaus kommt ein Schrei. Lebendig.', 'foerderhaus', 'schrei', 'gitter')] },
        pumpen: { titel: 'Mara Bell', zeilen: [beat('Ein echter Atemzug', 'Das Wasser sinkt. Hinter dem Gitter liegt eine Frau. Sie zuckt vor deinem Licht zurück und hält dir eine leere Pistole entgegen.', 'foerderhaus', 'wasser', 'gitter'), beat('Vane ist tot', '„Wenn der Mann im Saloon Sie hierhergeschickt hat, hören Sie auf, ihm zuzuhören.“ Ihre Hand zittert. „Silas Vane ist vor sechs Jahren gestorben. Ich habe seinen Grabstein gesehen.“', 'foerderhaus', 'atmen', 'gesicht')] },
        winde: { titel: 'Die Fahrt nach unten', zeilen: [beat('Unter die Fundamente', 'Der Korb fährt an. Holz wird zu schwarzem Fels. Durch das Drahtgitter siehst du die Stadt über dir kleiner werden. Dann erlischt oben jede Lampe gleichzeitig.', 'stollen', 'aufzug', 'schacht'), beat('Die dreizehnte Plakette', 'Am ersten Halt hängt ein Kinderhelm. NOAH BELL. Auf dem Grubenplan sind zwölf Beschäftigte eingetragen. Du zählst die Plaketten. Dreizehn.', 'stollen', 'klopfen', 'helm')] },
        stollen: { titel: 'Die falsche Seite des Einsturzes', zeilen: [beat('Der Ausgang wurde gesprengt', 'Du findest die Sprenglöcher. Der Fels ist nach innen gefallen. Die Eingeschlossenen sollten hier nicht herauskommen. Zwischen den Steinen steckt eine Lohnforderung mit dreizehn Unterschriften.', 'kammer', 'steine', 'fels'), beat('Der Helfer', 'Hinter einem Schreibtisch liegt Vanes Mantel. Die Ärmel sind an das Holz genagelt. Er war nie bei den Eingeschlossenen gewesen. Die wenigen Überlebenden hatten ihn hier zurückgelassen.', 'kammer', 'lachen', 'mantel'), beat('Du bist die offene Tür', 'Der Mann im Saloon brauchte keinen geretteten Bergmann. Er brauchte einen neuen Besitzer. Mit deiner letzten Unterschrift könnten die Ansprüche auf dich übergehen. Und Vane wäre frei.', 'bank', 'herz', 'vertrag')] },
        schichten: { titel: 'Dreizehn Namen', zeilen: [beat('Wieder Menschen', 'Du legst die Schichtzettel zurück in ihre Reihenfolge. Namen statt Nummern. Noahs Blatt liegt unter dem seines Vaters. Ein Kind, das die Firma nie beschäftigt haben wollte.', 'kammer', 'papier', 'namen'), beat('Die Stadt erinnert sich', 'Oben beginnen die Glockenseile zu schlagen, obwohl niemand daran zieht. Auf der Hauptstraße erscheinen Lampen. Eine nach der anderen. Dreizehn.', 'strasse', 'glocke', 'lampen')] },
        sprengung: { titel: 'Vane verliert die Geduld', zeilen: [beat('Das Herz verstummt', 'Die Zündleitung ist tot. Die Pumpen laufen weiter. Von oben kommt ein Schlag, so schwer, dass Staub aus den Balken regnet.', 'kammer', 'bruch', 'fels'), beat('Der Vertrag', 'Vane steht auf der anderen Seite des Gitters. Zum ersten Mal lächelt er nicht. „Ohne mich kommen Sie hier niemals heraus.“ Dann fährt der Korb nach oben. Leer.', 'foerderhaus', 'metall', 'gitter'), beat('Ein Weg für die Namen', 'Hinter dem Schreibtisch öffnet sich ein alter Fluchtstollen. Er führt direkt in die Kapelle. In die Wand sind dreizehn Namen geritzt. Der letzte ist Noahs.', 'kapelle', 'schritte', 'tuer')] },
        glocke: { titel: 'Der letzte Schlag', zeilen: [beat('Die Straße wird hell', 'Der Riegel gleitet zurück. Hinter der Kapelle siehst du den Pfad ins Tal. Dreizehn Menschen stehen am Ausgang der Stadt. Sie sehen nicht mehr zum Berg. Sie sehen zu dir.', 'kapelle', 'glocke', 'fenster'), beat('Dein Name fehlt noch', 'Auf dem Altar liegt der Anteilsschein. Vane wartet am anderen Ende des Gangs. „Nur eine Unterschrift. Dann sind wir beide frei.“ Du hast verstanden, wer von euch beiden mit „wir“ gemeint ist.', 'kapelle', 'atmen', 'vertrag')] },
    };
    function bauen(entwurf, stufe = 'schwer', seed = Date.now()) {
        if (!Clavis.STUFEN[stufe])
            stufe = 'schwer';
        const q = Clavis.FrontierLogik.bauen(stufe, seed), stationen = {}, geheim = {};
        for (const [id, [ort, x, y, braucht, lesen, titel, text]] of Object.entries(ST)) {
            stationen[id] = { ortId: ort, x, y, braucht, lesen, titel, text, p: q.p[id], mech: 'frontier_' + id };
            geheim[id] = { loesung: q.geheim[id] };
        }
        return { oeffentlich: { premium: 'mercy', titel: VORLAGE.titel, welt: 'western', alter: 'ab14', stufe, minuten: ({ leicht: 85, mittel: 70, schwer: 58, experte: 46 })[stufe], stimmung: VORLAGE.stimmung, stationen, orte: ORTE, objekte: O, szenen: [{ titel: 'Mercy Creek', stationen: Object.keys(ST) }], bonus: [], intro: VORLAGE.intro, schreck: { standard: entwurf.jumpscares !== false, staerke: 6 }, hinweisKosten: ({ leicht: 25, mittel: 40, schwer: 65, experte: 90 })[stufe], hinweisAnzahl: 3 }, geheim: { stationen: geheim }, ersetzt: [] };
    }
    function erstellen(gebaut, { senden, beiEnde, jetzt = Date.now, intervall = setInterval, aufheben = clearInterval }) {
        const R = gebaut.oeffentlich, G = gebaut.geheim, clone = x => JSON.parse(JSON.stringify(x));
        const L = { phase: 'lobby', start: null, strafe: 0, pause: 0, seit: null, szene: null, folge: 0, sequenz: 0, host: null, spieler: new Map(), geloest: {}, gelesen: {}, inventar: [], journal: [], wahl: {}, hinweise: {}, ende: null, besucht: new Set(), momente: new Set() };
        let gestoppt = false, takt;
        const cooldown = new Map();
        const rest = () => Math.max(0, R.minuten * 60000 - (L.start === null ? 0 : (L.seit ?? jetzt()) - L.start - L.pause) - L.strafe * 1000);
        const done = id => !!L.geloest[id], frei = id => ({ bahnhof: true, strasse: done('weiche'), saloon: done('weiche'), sheriff: done('weiche'), bank: done('pianola') && done('depesche'), foerderhaus: done('tresor'), stollen: done('winde'), kammer: done('stollen'), kapelle: done('sprengung') })[id] === true;
        const bereit = id => { const s = R.stationen[id]; return frei(s.ortId) && s.braucht.every(done) && s.lesen.every(x => L.gelesen[x]) && (id !== 'winde' || !!L.wahl.mara && !!L.wahl.gold); };
        const notiz = (titel, text, art = 'fund') => L.journal.push({ id: ++L.sequenz, titel, text, art });
        const item = (id, name, zeichen) => { if (!L.inventar.some(i => i.id === id))
            L.inventar.push({ id, name, zeichen }); };
        function stand() { L.schlaege=Math.max(L.schlaege||1,Math.min(12,Math.max(1,1+Math.floor((1-rest()/(R.minuten*60000))*12)))); return clone({ typ: 'stand', phase: L.phase, restMs: rest(), geloest: L.geloest, hinweise: L.hinweise, spieler: [...L.spieler.values()].filter(p => p.da).map(({ id, name }) => ({ id, name })), wort: [], frontier: { sequenz: ++L.sequenz, szene: L.szene, pausiert: L.seit !== null, gelesen: L.gelesen, inventar: L.inventar, journal: L.journal, wahl: L.wahl, offen: Object.keys(ORTE).filter(frei), bereit: Object.keys(ST).filter(bereit), last: Clavis.FrontierLogik.windenLast(L.wahl), motiv: done('pianola') ? R.stationen.glocke.p.motiv : null, glockenschlag: L.schlaege, strafe: L.strafe } }); }
        const melden = () => { if (!gestoppt)
            senden(stand(), null, true); };
        function szene(id) {
            if (L.szene || !SZ[id])
                return;
            L.seit = jetzt();
            L.szene = { ...clone(SZ[id]), id: id + ':' + (++L.folge) };
            if (id === 'winde' && L.wahl.mara === 'retten')
                L.szene.zeilen[1] = beat('Ein Bruder ohne Lohn', 'Mara sieht den Helm, bevor du den Namen lesen kannst. Sie setzt sich auf den Boden. „Noah“, sagt sie. Mehr nicht. Du wartest, bis sie wieder aufsteht.', 'stollen', 'atmen', 'helm');
            if (id === 'sprengung' && L.wahl.mara === 'retten')
                L.szene.zeilen[2] = beat('Ein Mensch kennt den Weg', 'Mara packt deine Hand. „Die alte Bewetterung. Mein Vater hat sie gebaut.“ Sie schiebt eine Holztafel beiseite. Dahinter führt eine Leiter in die Kapelle. Diesmal geht sie voraus.', 'kapelle', 'schritte', 'tuer');
            notiz('Szene: '+L.szene.titel,L.szene.zeilen.map(b=>b.titel+'\n'+b.text).join('\n\n'),'szene');
        }
        function ende(geschafft, grund = '', weg = L.wahl.finale) {
            if (L.ende || gestoppt)
                return;
            aufheben(takt);
            const mara = L.wahl.mara === 'retten', belege = L.wahl.belege === 'sichern', gold = L.wahl.gold === 'nehmen';
            let titel, text, nach;
            if (!geschafft) {
                titel = 'Schichtbeginn';
                text = 'Die Glocke schlägt zum dreizehnten Mal. Im Förderkorb geht Licht an. Dreizehn Gestalten warten auf den neuen Besitzer. Einer trägt deinen Koffer. Oben schließt Vane das Testament und steckt deinen Anteilsschein ein.';
                nach = mara ? 'Mara hält deine Hand, als der Korb anfährt. Auf der Lasttafel steht jetzt ein Name mehr.' : 'Auf dem nächsten Zug liegt eine Fahrkarte. Einfache Fahrt. Darunter ein Goldstück, warm wie eine Hand.';
            }
            else if (weg === 'anspruch') {
                titel = 'Der neue Besitzer';
                text = 'Du setzt den Siegelring unter das Testament. Vane atmet aus. Zum ersten Mal siehst du seinen Atem in der Kälte. Deiner ist verschwunden. Er nimmt den Hut und geht an dir vorbei ins Morgenlicht.';
                nach = mara ? 'Mara geht nicht mit dir. Als du sie rufst, antwortet aus der Grube nur die Glocke. Du hast eine Stadt geerbt. Und alle, die darin bleiben.' : 'Der Barren ist makellos. Jede Nacht wird er wärmer. In Mercy Creek bezahlt niemand mit Gold. Man bezahlt mit Jahren.';
            }
            else if (weg === 'bleiben') {
                titel = 'Die letzte Schicht';
                text = 'Du streichst Vanes Namen durch und schreibst deinen an seine Stelle. Die dreizehn Lampen gehen aus. Nicht gleichzeitig. Eine nach der anderen, als trüge jemand sie endlich nach Hause.';
                nach = mara ? 'Mara erreicht das Tal. Sie erzählt von der Person, die blieb, damit eine Stadt gehen konnte. Einmal im Jahr bringt sie Blumen an den Pass.' : 'Die Straße wird frei. Die Grube verstummt. Nur hinter dem Schutzgitter bleibt noch ein lebender Atemzug. Nicht jede Schuld lässt sich durch ein Opfer heilen.';
            }
            else {
                titel = mara ? 'Ein Morgen ohne Schuld' : 'Ein freier Platz';
                text = gold ? 'Du lässt den Barren auf dem Altar liegen und zerreißt den Anteilsschein. Vane greift nach den Papierhälften. Seine Finger gehen hindurch. Zum ersten Mal läutet die Glocke für Namen statt für Eigentum.' : 'Du zerreißt den Anteilsschein. Der Ring bricht auf den Steinstufen. Draußen nehmen dreizehn Menschen ihre Lampen ab. Noah ist der Letzte. Er nickt, bevor das erste Sonnenlicht ihn erreicht.';
                nach = mara ? (belege ? 'Mara und du bringen das Originalbuch ins Tal. Die Namen werden veröffentlicht. Blackwater kann das Unglück nicht mehr als freiwillige Abreise abrechnen.' : 'Mara erreicht mit dir das Tal. Ohne das Buch wird es Jahre dauern, bis man euch glaubt. Die Menschen haben ihre Namen zurück. Die Firma behält ihre Lüge.') : 'Du kommst aus dem Wald allein zurück. Die Namen sind frei. Als man fragt, wer noch in der Grube war, denkst du an die Frau hinter dem Gitter.';
            }
            const h = Object.values(L.hinweise).reduce((n, a) => n + a.length, 0);
            L.ende = { geschafft, grund, zeit: Math.max(0, R.minuten * 60000 - rest()), sterne: geschafft ? 1 + (mara ? 1 : 0) + (mara && belege && weg === 'ausschlagen' ? 1 : 0) : 0, hinweise: h, geloest: Object.keys(L.geloest).length, stationen: 10, wort: '', frontier: { titel, text, nach, mara, belege, gold, weg, wahl: clone(L.wahl) } };
            L.phase = 'ende';
            senden({ typ: 'ende', ergebnis: clone(L.ende) });
            beiEnde?.(clone(L.ende));
        }
        const antwort = (p, d, richtig, info = '') => senden({ typ: 'antwort', nr: d.nr, richtig, info }, p.id);
        function eingang(p, d) {
            if (!d || typeof d !== 'object' || gestoppt || L.ende || !L.spieler.get(p.id)?.da)
                return;
            if (d.typ === 'frontier_weiter') {
                if (p.id !== L.host || !L.szene || d.id !== L.szene.id)
                    return;
                L.pause += jetzt() - L.seit;
                L.seit = null;
                L.szene = null;
                melden();
                return;
            }
            if (L.phase !== 'spiel' || L.szene)
                return antwort(p, d, false, 'Die Szene läuft noch.');
            if (rest() <= 0)
                return ende(false, 'zeit');
            if (d.typ === 'frontier_lesen') {
                const o = O[d.objekt];
                if (!o || !frei(o.ort))
                    return antwort(p, d, false, 'Dieser Ort ist noch nicht erreichbar.');
                if (d.objekt === 'mara' && !done('pumpen'))
                    return antwort(p, d, false, 'Lass zuerst das Wasser ab. Das Gitter steht unter Druck.');
                if (!L.gelesen[d.objekt]) {
                    L.gelesen[d.objekt] = true;
                    if (o.item)
                        item(...o.item);
                    let text = o.text || '';
                    if (d.objekt === 'bankbrief')
                        text = `Der Depeschenbegriff lautet ${G.stationen.depesche.loesung}. Die vier Tresorräder müssen ${R.stationen.tresor.p.ziel.join(' · ')} zeigen. Ein Rad nimmt das rechts benachbarte mit.`;
                    if (d.objekt === 'lasttafel')
                        text = 'Korb und Erbe: 87 kg. Mara: 54 kg, falls sie mitfährt. Gold: 18 kg, falls du es mitnimmst. Gegengewichte dürfen ins Gegenseil (+) oder in den Korb (−). Die Summe muss die gesamte Last ausgleichen.';
                    notiz(o.name, text);
                }
                antwort(p, d, true);
                melden();
            }
            else if (d.typ === 'frontier_wahl') {
                const k = d.schluessel, v = d.wert, regeln = { gold: { werte: ['nehmen', 'lassen'], frei: done('tresor') && L.gelesen.gold }, mara: { werte: ['retten', 'lassen'], frei: done('pumpen') && L.gelesen.mara }, belege: { werte: ['sichern', 'verbrennen'], frei: done('schichten') && L.gelesen.belege } };
                const regel = regeln[k];
                if (!regel?.frei || !regel.werte.includes(v))
                    return antwort(p, d, false, 'Diese Entscheidung ist noch nicht möglich.');
                if (L.wahl[k])
                    return antwort(p, d, L.wahl[k] === v, 'Diese Entscheidung ist bereits gefallen.');
                L.wahl[k] = v;
                if (k === 'gold') {
                    item('plan', 'Plan des Förderhauses', '▤');
                    if (v === 'nehmen')
                        item('gold', 'Goldbarren · 18 kg', '▰');
                    notiz('Dein Erbe', v === 'nehmen' ? 'Du trägst 18 kg Gold. Der Förderkorb muss dieses Gewicht berücksichtigen.' : 'Du hast den Barren liegen lassen. Der Plan darunter führt zum Förderhaus.', 'wahl');
                    senden({ typ: 'frontier_moment', art: v === 'nehmen' ? 'gier' : 'siegel' });
                }
                if (k === 'mara') {
                    if (v === 'retten') {
                        L.strafe += 45;
                        item('mara', 'Mara ist bei dir', '◉');
                    }
                    notiz('Mara Bell', v === 'retten' ? 'Du befreist Mara. 45 Sekunden. Ihr Gewicht von 54 kg muss in die Windenrechnung.' : 'Du lässt Mara zurück und steigst allein in den Korb. Diese Entscheidung bleibt.', 'wahl');
                }
                if (k === 'belege') {
                    if (v === 'sichern') {
                        L.strafe += 60;
                        item('buch', 'Originalbuch mit Sprengbefehl', '▥');
                    }
                    else
                        L.strafe -= 60;
                    notiz('Das Originalbuch', v === 'sichern' ? 'Du sicherst die Beweise. Das kostet eine Minute.' : 'Du verbrennst das Buch. Die Lampe gewinnt eine Minute. Der Beweis ist verloren.', 'wahl');
                }
                antwort(p, d, true);
                if (rest() <= 0)
                    return ende(false, 'zeit');
                melden();
            }
            else if (d.typ === 'loesen') {
                const id = d.station, s = R.stationen[id];
                if (!s || !bereit(id))
                    return antwort(p, d, false, 'Eine Verbindung fehlt. Untersuche die Unterlagen und die Entscheidungen dieses Ortes.');
                if (done(id))
                    return antwort(p, d, true);
                const key = p.id + ':' + id;
                if (jetzt() - (cooldown.get(key) ?? -Infinity) < 1200)
                    return antwort(p, d, false, 'Der Mechanismus setzt sich zurück.');
                if (!Clavis.FrontierLogik.pruefen(id, s.p, G.stationen[id].loesung, d.antwort, L.wahl)) {
                    cooldown.set(key, jetzt());
                    L.strafe += 15;
                    antwort(p, d, false, 'Der Mechanismus greift nicht. Die Glocke rückt 15 Sekunden näher.');
                    senden({ typ: 'frontier_moment', art: 'fehler' });
                    if (rest() <= 0)
                        return ende(false, 'zeit');
                    melden();
                    return;
                }
                L.geloest[id] = { von: p.id, zeit: jetzt() - L.start };
                notiz(s.titel, ({ weiche: 'Die drei Kontrollpunkte sind passiert. Mercy Creek ist erreichbar.', pianola: 'Die Bank hat einen Schlüssel. Die Glockenmelodie: ' + R.stationen.glocke.p.motiv.map(i => R.stationen.glocke.p.namen[i]).join(' → '), depesche: 'Die Depesche ist ein Auszahlungsauftrag. Kennwort: ' + G.stationen.depesche.loesung, tresor: 'Der Tresor ist offen. Das Gold liegt auf dem Plan zum Förderhaus.', pumpen: 'Die Leitung ist dicht. Du kannst Mara erreichen.', winde: 'Die Last ist ausgeglichen. Der Korb fährt in die Grube.', stollen: 'Der Ausgang wurde von innen gesprengt. Vane braucht dich als neuen Besitzer.', schichten: 'Dreizehn Menschen bekommen ihre Namen zurück: Jonah Reed, Esther Cole, Luis Ortega, Otto Brandt, Amos Bell, Noah Bell, Mei Chen, Beatrice Oakes, Elias Harlan, Tomas Novák, Ruth Mercer, Isaac Freeman und Samuel Pike. Sie waren nicht abgereist. Die Firma hatte sie abgeschrieben.', sprengung: 'Die Sprengleitung ist getrennt. Luft und Rückweg bleiben offen.', glocke: 'Der Riegel ist offen. Das letzte Siegel entscheidet, wer die Stadt verlässt.' })[id], 'erkenntnis');
                antwort(p, d, true);
                szene(id);
                melden();
            }
            else if (d.typ === 'hinweis') {
                const id = d.station, s = R.stationen[id];
                if (!s || !bereit(id) || done(id))
                    return;
                const h = L.hinweise[id] || (L.hinweise[id] = []);
                if (h.length >= 3)
                    return;
                h.push(hinweise(id, s.p, G.stationen[id].loesung, L.wahl)[h.length]);
                L.strafe += R.hinweisKosten;
                if (rest() <= 0)
                    return ende(false, 'zeit');
                melden();
            }
            else if (d.typ === 'frontier_finale') {
                if (!done('glocke'))
                    return antwort(p, d, false, 'Der Glockenriegel ist noch geschlossen.');
                if (!['ausschlagen', 'anspruch', 'bleiben'].includes(d.wert))
                    return antwort(p, d, false, 'Wähle eine der drei Möglichkeiten am Siegel.');
                L.wahl.finale = d.wert;
                antwort(p, d, true);
                ende(true, '', d.wert);
            }
        }
        takt = intervall(() => { if (L.phase !== 'spiel' || L.szene || L.ende || gestoppt)
            return; if (rest() <= 0)
            return ende(false, 'zeit'); const fort = 1 - rest() / (R.minuten * 60000); for (const [grenze, art] of [[.17, 'reiter'], [.36, 'fenster'], [.57, 'glocke'], [.77, 'riss'], [.91, 'letzter']])
            if (fort >= grenze && !L.momente.has(art)) {
                L.momente.add(art);
                senden({ typ: 'frontier_moment', art });
            } melden(); }, 2000);
        return { dazu(p) { if (gestoppt)
                return; if (!L.host)
                L.host = p.id; L.spieler.set(p.id, { id: p.id, name: String(p.name || 'Gast').slice(0, 24), da: true }); senden({ typ: 'raum', raum: R }, p.id); senden(stand(), p.id); if (L.ende)
                senden({ typ: 'ende', ergebnis: clone(L.ende) }, p.id); melden(); }, weg(p) { if (L.spieler.has(p.id))
                L.spieler.get(p.id).da = false; melden(); }, eingang, stand, starten() { if (L.phase !== 'lobby' || gestoppt)
                return; L.phase = 'spiel'; L.start = jetzt(); szene('intro'); melden(); }, beenden: () => ende(false, 'aufgegeben'), stoppen() { gestoppt = true; aufheben(takt); }, get phase() { return L.phase; }, get ende() { return L.ende; } };
    }
    function hinweise(id, p, g, w) { const f = { weiche: () => ['Die Pflichtpunkte müssen alle auf einer einzigen Fahrt liegen.', 'B führt zu E. E muss zu G führen. Die Bruchbrücke F bleibt außen vor.', 'Stelle den befahrenen Weg A → B → E → G → T. Unbefahrene Weichen sind egal.'], pianola: () => ['Anfang und Ende stehen am Gerät. Jedes Randzeichen muss zum nächsten passen.', 'Ein falsch herum liegender Streifen kann am Platz richtig sein. Drehe ihn.', 'Reihenfolge der ursprünglichen Stücknummern: ' + g.map(x => (x.i + 1) + (x.flip ? ' gedreht' : '')).join(' → ')], depesche: () => ['Das Chiffrierbuch erklärt die Ziffernpaare.', 'Die erste Ziffer ist die Zeile, die zweite die Spalte.', 'Die Depesche ergibt: ' + g], tresor: () => ['Beginne links. Das erste Rad lässt sich später durch kein anderes Rad mehr verändern.', 'Bringe Rad 1 auf sein Ziel. Dann Rad 2, dann 3, dann 4.', 'Aus der Ausgangsstellung drehen: ' + g.map((n, i) => `Rad ${i + 1}: ${n} Schritte`).join(' · ')], pumpen: () => ['Der Einlass ist links oben, der Auslass rechts unten. Alle neun Stücke müssen nass werden.', 'Jeder offene Anschluss muss genau auf einen Anschluss im Nachbarfeld treffen.', 'Aus der Ausgangsstellung je Feld im Uhrzeigersinn drehen: ' + g.join(', ')], winde: () => ['Die Lasttafel nennt 87 kg Grundlast. Addiere Mara und Gold nur, wenn sie mitfahren.', 'Gewichte im Korb zählen negativ, am Gegenseil positiv. Die Dreierpotenzen erlauben beides.', 'Die Last ist ' + Clavis.FrontierLogik.windenLast(w) + ' kg. Wähle zuerst das größte Gewicht unterhalb oder knapp oberhalb der Last.'], stollen: () => ['Der vollständige Grubenriss ist sichtbar. Plane vor dem Gehen.', 'Die zwei Messingmarken liegen auf dem Weg zum Archiv. Sackgassen kosten nur Wegschritte.', 'Der direkte Weg hat ' + g.length + ' Felder. Von Feld 1 aus: ' + g.slice(1).map((v, i) => v - g[i] === 1 ? 'O' : v - g[i] === -1 ? 'W' : v > g[i] ? 'S' : 'N').join(' · ')], schichten: () => ['Alle Hinweise am Buch müssen gleichzeitig stimmen.', 'Lege zunächst Namen mit mehreren Einschränkungen. Prüfe dann die Reihenfolge-Aussagen.', 'Von der ersten bis zur fünften Gruppe: ' + g.map(i => p.namen[i]).join(' → ')], sprengung: () => ['Verfolge die Verbindungen von EIN aus. Trenne das HERZ, nicht die Luft.', 'Es gibt zwei direkte Leitungen in das HERZ. Der zusätzliche Querweg B–D muss bestehen bleiben.', 'Trenne B–HERZ und D–HERZ.'], glocke: () => ['Die vier Originalzeichen stehen seit dem Saloon im Einsatzbuch.', 'Erst die vier Zeichen rückwärts, dann Originalzeichen 2 und Originalzeichen 1.', 'Spiele: ' + g.map(i => p.namen[i]).join(' → ')] }; return f[id](); }
    CLAVIS_VORLAGEN.unshift(VORLAGE);
    return { VORLAGE, bauen, erstellen };
})();
