'use strict';
/* NULLMEILE – der Host verteilt unterschiedliche Perspektiven und prüft echte Teambeiträge. */
const ClavisArizona = (() => {
    const VORLAGE = { id: 'v-nullmeile', premium: 'arizona', nurTeam: true, titel: 'NULLMEILE – Protokoll JANUS', welt: 'labor', alter: 'ab14', spieler: '2–8', empfohlen: 'schwer', jumpscares: true, stimmung: { spannung: 10, gefahr: 8, spuk: 9, grusel: 7 }, anriss: 'Ein geplatzter Reifen. Eine Straße ohne Ende. Unter Arizona wartet ein Labor, das eure Ankunft bereits aufgezeichnet hat.', intro: 'Ihr seid nicht allein gestrandet. Euer nächster Morgen ist schon hier.', szenen: [{ titel: 'Die Nullmeile', stationen: [] }] };
    const ORTE = {
        strasse: { name: 'Meile 0', sub: 'Der nächste Ort ist 142 Meilen entfernt.', kapitel: 'I · Der falsche Abend', x: 9, y: 21 },
        mast: { name: 'Station N9', sub: 'Der Notruf kommt von unter euren Füßen.', kapitel: 'I · Der falsche Abend', x: 25, y: 18 },
        schleuse: { name: 'Die Druckschleuse', sub: 'Zwei Türen. Ein gemeinsamer Atemzug.', kapitel: 'II · Unabhängige Zeugen', x: 36, y: 43 },
        gang: { name: 'Korridor minus eins', sub: 'Nicht jeder sieht denselben Boden.', kapitel: 'II · Unabhängige Zeugen', x: 49, y: 36 },
        archiv: { name: 'Das Archiv von morgen', sub: 'Jede Aufnahme ist echt. Nicht jede Zeit.', kapitel: 'III · Der gespeicherte Tag', x: 61, y: 25 },
        turbine: { name: 'Der Gegenstrom', sub: 'Eure Anzeigen gehören jemand anderem.', kapitel: 'III · Der gespeicherte Tag', x: 57, y: 62 },
        quarantaene: { name: 'Die Zeugenbrücke', sub: 'Jemand wartet auf der anderen Seite.', kapitel: 'IV · Eine Stimme zu viel', x: 72, y: 65 },
        beobachtung: { name: 'Achtmal Nika', sub: 'Eine Stimme kann lügen. Drei Merkmale nicht.', kapitel: 'IV · Eine Stimme zu viel', x: 82, y: 44 },
        kern: { name: 'Der Nullpunkt', sub: 'Ein Morgen. So viele Perspektiven wie ihr.', kapitel: 'V · Was ihr zurücklasst', x: 91, y: 73 }
    };
    const AUFGABEN = [
        { id: 'funk', ort: 'mast', titel: 'Ein Notruf in Teilen', text: 'Rekonstruiert das Signal mit getrenntem Empfang, Schlüssel und Phasenlage.', effekt: 'funk' },
        { id: 'schleuse', ort: 'schleuse', titel: 'Der gemeinsame Druck', text: 'Keine Person hat alle Messwerte. Stellt eure eigenen Ventile so ein, dass alle Bedingungen zugleich gelten.', effekt: 'druck' },
        { id: 'gang', ort: 'gang', titel: 'Die unsichtbaren Felder', text: 'Eure Sensoren erkennen verschiedene Gefahren. Nur die gemeinsame Karte führt hindurch.', effekt: 'schritte' },
        { id: 'echo', ort: 'archiv', titel: 'Ein Experiment ohne Uhr', text: 'Ordnet fünf Aufnahmen mit den Beobachtungen aller Archivspuren.', effekt: 'band' },
        { id: 'strom', ort: 'turbine', titel: 'Fremde Zielwerte', text: 'Die Zielwerte deiner Stellglieder liegen auf einem anderen Bildschirm.', effekt: 'strom' },
        { id: 'anker', ort: 'quarantaene', titel: 'Vier Impulse Wirklichkeit', text: 'Vier Impulse, mehrere Anker. Gebt die Folge weiter und haltet den Übergang gemeinsam stabil.', effekt: 'anker' },
        { id: 'zeugen', ort: 'beobachtung', titel: 'Wer spricht dort wirklich?', text: 'Vergleicht eure unabhängigen Beobachtungen. Bestätigt gemeinsam das einzige echte Signal.', effekt: 'intercom' },
        { id: 'nullpunkt', ort: 'kern', titel: 'Unsere gemeinsame Kontur', text: 'Ein Messstreifen pro Person. Kein Streifen lässt sich ersetzen. Bestätigt die Kontur gemeinsam.', effekt: 'nullpunkt' }
    ];
    const FUNDE = {
        strasse: [['Der Reifen', 'Der Schnitt läuft vom Inneren des Gummis nach außen. Im Staub liegt ein Nagel, noch kalt vom Regen. Über euch ist der Himmel trocken.'], ['Das Foto im Handschuhfach', 'Ihr habt es an der letzten Tankstelle gemacht. Im Hintergrund steht der Messmast, den ihr erst jetzt am Horizont seht. Auf der Rückseite steht eure heutige Uhrzeit. In eurer eigenen Handschrift.']],
        mast: [['Messprotokoll N9', 'ASTER · JANUS\nEin Beobachter ist eine Geschichte. Zwei unabhängige Beobachter sind eine Prüfung. Einzelbedienung nach Vorfall 06 nicht mehr zulässig.'], ['Das Rücklicht', 'Zwischen den Büschen leuchtet für einen Moment das Rücklicht eures Vans. Es ist näher, als es sein dürfte. Dann ist es wieder der rote Mastblinker.']],
        schleuse: [['Die Sicherheitsanweisung', 'Messungen dürfen nicht zentral zusammengeführt werden. Das Phänomen passt sich der Perspektive eines einzelnen Beobachters an. Vergleich durch Menschen bleibt zulässig. Bedienung immer an unabhängigen Referenzplätzen.'], ['Die Hand am Glas', 'Im beschlagenen Fenster erscheint ein Handabdruck. Er ist genau so groß wie deiner. Als du deine Hand hebst, ist der Abdruck bereits an der nächsten Stelle.']],
        gang: [['Die Markierung im Boden', 'Eine gelbe Linie läuft durch den Beton. Daneben: „Wenn ihr den Weg alleine seht, geht ihn nicht.“ Alle Kameras zeigen einen leicht anderen Verlauf.'], ['Der verlorene Schuh', 'Am Schaft klebt ein Besucherausweis: NIKA VOSS · FELDTECHNIK. Das Ablaufdatum liegt morgen. Unter der Sohle haftet roter Wüstensand.']],
        archiv: [['Versuch A-0', 'A-0 ist kein Stoff. Die schwarze Kontur ist die Grenze zwischen zwei möglichen Tagen. JANUS speichert keinen Film. Er hält eine Möglichkeit offen, bis jemand sie beobachtet.'], ['Die Aufnahme 18:43', 'Ihr seht euren Van. Die Seitentür geht auf. Menschen steigen aus, deren Kleidung ihr kennt. Dann seht ihr euch selbst auf die Kamera zukommen. Der Film endet eine Minute nach der Zeit auf eurer Uhr.']],
        turbine: [['Handschrift unter dem Pult', 'ELIAN VALE: „Wir haben die Zukunft nicht gefunden. Wir haben ihr beigebracht, dass wir zurückkommen.“ Der letzte Satz wurde mehrfach durchgestrichen.'], ['Das zweite Summen', 'Die Turbine läuft nicht. Das Summen kommt aus dem Raum daneben. Als ihr alle gleichzeitig still seid, summt jemand den Refrain, der vor der Panne im Autoradio lief.']],
        quarantaene: [['Nikas Notiz', '„Falls meine Stimme euch sagt, ihr sollt die Tür allein öffnen: Das bin nicht ich. Es lernt von jeder Person, die ihm zuhört. Nur ihr könnt euch gegenseitig beweisen, was gerade passiert.“'], ['Das Armband', 'NIKA VOSS · REFERENZ 01. Die Haut darunter ist unversehrt. Sie sitzt seit Monaten im Labor. Auf der Stationsuhr ist keine einzige Minute vergangen.']],
        beobachtung: [['Die Anweisung der Leitstelle', 'Die Monitore behaupten, sie seien eine Rettungsstelle. Unter der Konsole liegt die Servicekarte: JANUS hat nie eine Außenleitung besessen.'], ['Das Originalmikrofon', 'Ein Mikrofon ist mit Kupferdraht direkt zur Quarantäne verbunden. Die sieben anderen Kanäle laufen durch den Nullpunkt. Gleiche Stimme. Andere Wirklichkeit.']],
        kern: [['Der letzte Messstreifen', 'Die Maschine kennt jeden von euch einzeln. Was sie nicht kennt, ist der Moment, in dem ihr eure unterschiedlichen Beobachtungen zusammenbringt. Eure gemeinsame Kontur ist kein Passwort. Sie ist ein Ereignis.'], ['Der Rückweg', 'Hinter dem Kern führt eine Treppe ans Tageslicht. Der Schatten eines Vans fällt bis auf die letzte Stufe. Die Räder sind ganz. Ihr könnt nicht sehen, ob jemand darin wartet.']]
    };
    const b = (titel, text, ort, effekt = 'wind', bild = 'weit') => ({ titel, text, ort, effekt, bild });
    const SZENEN = {
        intro: { titel: 'Die falsche Ausfahrt', zeilen: [
                b('Arizona · 18:42', 'Seit zwanzig Minuten spricht niemand mehr. Die Straße ist leer, der Tank halb voll, der nächste Ort weit hinter dem Horizont. Aus dem Radio kommt das Ende eines Songs. Dann beginnt derselbe Refrain noch einmal.', 'strasse', 'radio', 'fahrt'),
                b('Ein Schlag von unten', 'Der Reifen platzt so hart, dass die Kamera vom Armaturenbrett fällt. Ihr kommt quer am Straßenrand zum Stehen. Hinter euch liegt schwarzer Gummi. Vor euch steht ein Kilometerstein. Darauf ist keine Zahl. Nur eine Null.', 'strasse', 'reifen', 'reifen'),
                b('Kein Empfang. Ein Anruf.', 'Alle Telefone zeigen keinen Empfang. Trotzdem leuchtet ein Display auf. Eine Nachricht ohne Nummer: „Wenn ihr am Mast seid, lasst den Motor nicht laufen.“ Ihr habt den Mast noch nicht bemerkt.', 'mast', 'funk', 'mast'),
                b('Was du gesehen hast', 'Für einen Augenblick fällt euer Blick auf denselben Ort. Später werdet ihr merken, dass ihr euch an verschiedene Dinge erinnert. Keine Erinnerung ist erfunden. Keine reicht allein.', 'strasse', 'riss', 'zeuge'),
                b('Die Station', 'Zwischen trockenem Gras steht eine aufgegebene Wetterstation. In der Wand knackt ein Funkgerät. „Hier ist Nika Voss. Bitte nicht der Stimme im Fahrstuhl antworten.“ Hinter der Station öffnet sich eine Betontreppe.', 'mast', 'intercom', 'luke'),
                b('Eine Minute zu früh', 'Das Funkgerät spielt euren letzten Satz ab. Ihr habt ihn noch nicht ausgesprochen. Dann schlägt unten eine Tür zu. Auf allen Geräten erscheint ein anderer Teil desselben Notrufs.', 'mast', 'tuer', 'pult')
            ] },
        funk: { titel: 'Unter der Straße', zeilen: [b('Die Station antwortet', 'Euer Signal setzt sich zusammen. Unter dem Sand springt ein Generator an. Der Mast dreht sich langsam nach unten, obwohl seine Achse das nicht zulässt. In der Treppe geht Licht an.', 'mast', 'strom', 'luke'), b('JANUS begrüßt euch', 'Im Fahrstuhl läuft eine Aufnahme: „Willkommen zurück.“ Eine zweite Stimme, leiser: „Ihr wart noch nie hier. Glaubt mir wenigstens das.“ Als die Tür öffnet, stehen zwei Luftschleusen vor euch.', 'schleuse', 'aufzug', 'tuer')] },
        schleuse: { titel: 'Unabhängige Zeugen', zeilen: [b('Ein Atemzug, mehrere Räume', 'Die Ventile rasten ein. Auf der anderen Seite der Scheibe hebt eine Person die Hand. Erst als ihr euch umseht, merkt ihr: Die Bewegung gehört zu niemandem von euch.', 'schleuse', 'druck', 'glas'), b('Das erste Protokoll', 'Auf einem Besucherterminal steht: „Eine Perspektive kann reproduziert werden. Zwei müssen übereinstimmen.“ Nika flüstert aus dem Lautsprecher: „Bleibt im Gespräch. Es kann zuhören. Aber es kann nicht gleichzeitig ihr alle sein.“', 'gang', 'intercom', 'flucht')] },
        gang: { titel: 'Der gespeicherte Tag', zeilen: [b('Der Boden bleibt zurück', 'Hinter euch löst sich ein Stück Korridor aus dem Raum. Kein Einsturz. Es ist einfach nicht mehr da. Vor euch steht ein Glas Wasser über einem Tisch. Das Glas schwebt. Das Wasser fällt nach oben.', 'archiv', 'riss', 'glas'), b('Ihr auf Band', 'Im Archiv läuft eine Filmrolle. Darauf kommt euer Van an der Station an. Gleich neben dem Bild liegt das Aufnahmeprotokoll. Es wurde vor elf Monaten unterschrieben. Von euch.', 'archiv', 'band', 'monitor'), b('Kein heimlicher Verräter', 'Auf dem nächsten Blatt steht: „Widersprüchliche Zeugenaussagen sind zu erwarten.“ Eure verschiedenen Erinnerungen bedeuten nicht, dass jemand lügt. Sie sind die einzige Chance, den Ablauf zu prüfen.', 'archiv', 'atmen', 'akte')] },
        echo: { titel: 'Der Versuch, der morgen begann', zeilen: [b('A-0', 'Ihr bringt die Aufnahmen in ihre echte Reihenfolge. Erst kommt der Schatten. Dann der Körper, der ihn werfen müsste. JANUS hat nicht die Zukunft gesehen. Er hat einen möglichen Morgen im Labor festgehalten.', 'archiv', 'nullpunkt', 'glas'), b('Die Referenzperson', 'Eine junge Technikerin hält am Rand des Films eine Kalibrierkarte. Nika Voss. Sie schaut direkt in die Kamera. „Wenn ihr das seht, war das nicht mein erster Versuch.“ Im Hintergrund geht das Quarantänelicht an.', 'quarantaene', 'intercom', 'glas'), b('Der Preis des Bildes', 'Aus einem Bandgerät fällt eine Wartungsnotiz: „Referenz 01 darf die Station nicht verlassen.“ Die Anlage hält einen Menschen fest, damit derselbe Tag nicht auseinanderfällt. Die Leitstelle nennt das einen Stabilitätswert.', 'turbine', 'strom', 'pult')] },
        strom: { titel: 'Die Stimme hinter dem Glas', zeilen: [b('Gegenstrom', 'Die Turbinen kommen gegenläufig in Bewegung. Durch das ganze Labor läuft eine warme Druckwelle. Jenseits der Brücke hebt Nika den Kopf. Zum ersten Mal ist ihre Stimme nicht auf einem Band.', 'quarantaene', 'strom', 'bruecke'), b('Nicht alleine öffnen', '„Vier Impulse“, sagt sie. „Nicht gleichzeitig drücken. Richtig weitergeben.“ Hinter ihr erscheinen dieselben Handabdrücke wie in der Schleuse. Alle bewegen sich einen Augenblick zu früh.', 'quarantaene', 'klopfen', 'glas')] },
        anker: { titel: 'Ein Mensch oder eine Konstante', zeilen: [b('Vier Impulse Wirklichkeit', 'Die Anker laufen durch. Der Übergang trägt. Nika kommt bis an die Scheibe und legt ein Armband auf das Mikrofon. „Ich bin keine Konstante. Ich bin achtundzwanzig Jahre alt.“ Ihre Stimme bricht. „Das war ich, als ich hier angefangen habe.“', 'quarantaene', 'anker', 'bruecke'), b('Die angebotene Abkürzung', 'Die Leitstelle bietet an, sie hierzulassen. Dann bleibe der Rückweg sicher. Nika sagt nichts mehr. Auf euren Geräten öffnet sich dieselbe Frage. Diesmal reicht kein einzelner Knopfdruck.', 'beobachtung', 'intercom', 'monitor')] },
        zeugen: { titel: 'Der Anruf aus dem Morgen', zeilen: [b('Eine Stimme bleibt übrig', 'Ihr vergleicht eure Beobachtungen. Sieben Kanäle verstummen. Die echte Leitung knackt. Nika sagt nur: „Danke.“ Im schwarzen Fenster dahinter bildet sich die Kontur einer Straße.', 'beobachtung', 'intercom', 'monitor'), b('Der Notruf war eurer', 'Die Leitstelle verliert ihre freundliche Stimme. Auf dem Hauptmonitor steht kein Stationsname mehr, sondern die Uhrzeit eurer Panne. JANUS hat euren Notruf aus einem möglichen Morgen empfangen. Er hat ihn euch zurückgesendet. Damit ihr herkommt.', 'kern', 'riss', 'kern'), b('Was im Archiv bleibt', 'Die vollständigen Versuchsaufnahmen liegen jetzt zum Kopieren bereit. Sichert ihr sie, kann jemand draußen die Station finden. Löscht ihr sie, verliert JANUS seine Anleitung für den nächsten Anruf. Ihr müsst entscheiden, welche Spur ihr hinterlasst.', 'archiv', 'band', 'akte')] },
        nullpunkt: { titel: 'Ein Morgen, den die Maschine nicht kennt', zeilen: [b('Unsere Kontur', 'Eure getrennten Messstreifen ergeben ein gemeinsames Muster. Im Kern zeichnet sich zum ersten Mal etwas ab, das nicht in den Aufnahmen vorkommt. Die Straße dahinter ist leer. Niemand steigt vor euch aus dem Van.', 'kern', 'nullpunkt', 'kern'), b('Die letzte gemeinsame Entscheidung', 'Die Tür steht offen. JANUS bietet euch an, den nächsten Morgen selbst zu wählen. Ihr könnt die Kontur versiegeln, sie öffnen oder die Anlage übernehmen. Keine Person kann für die anderen unterschreiben.', 'kern', 'herz', 'kern')] }
    };
    SZENEN.anker.zeilen[0].portrait = true;
    SZENEN.strom.zeilen[1].portrait = true;
    const ZEUGNISSE = [
        'Im Rückspiegel war der Van für einen Augenblick leer. Auch der Fahrersitz.',
        'Am Mast stand eine Frau. Sie hob die Hand, als hätte sie euch erkannt. Dann war sie hinter einer Welle aus heißer Luft verschwunden.',
        'Der Schatten des Kilometersteins zeigte zur Sonne. Du hast dich extra noch einmal umgedreht.',
        'Auf dem Beifahrersitz lag ein Stationsausweis. Als du danach griffst, war es nur die zusammengefaltete Straßenkarte.',
        'Das Autoradio sagte deinen Namen. Der Song lief weiter. Niemand sonst reagierte.',
        'Neben dem platten Reifen lag dein eigener Schuhabdruck. Unter dem frischen Gummi.',
        'Über der Straße blieb ein Vogel im Flug stehen. Der Wind bewegte nur seinen Schatten.',
        'Die Uhr sprang von 18:42 auf 18:41. Auf dem Foto an der letzten Tankstelle zeigte sie schon 18:43.'
    ];
    const HINWEISE = {
        funk: ['Beschreibt die Zeichen am Empfang in der ursprünglichen Reihenfolge. Der Schlüssel liegt auf einem anderen Gerät.', 'Lest erst die Positionen der Phasenlage, übersetzt dann jedes Zeichen. Die Prüfsummen beziehen sich auf den so gelesenen Code.', 'Modulo 10 heißt: Behaltet nur die letzte Ziffer. Beispiel: 8 + 7 + 5 + 3 ergibt 23, also 3.'],
        schleuse: ['Schreibt eure Messgleichungen mit den Ventilbuchstaben auf. Jeder Messwert bleibt wahr.', 'Bei zwei Personen: Summe plus Differenz ist zweimal A. Bei drei Personen: (A+B)+(B+C)−(C+A) ist zweimal B.', 'Teilt das entsprechende Ergebnis durch zwei. Setzt die gefundenen Drücke zur Kontrolle in ALLE Gleichungen ein.'],
        gang: ['Tragt die roten Felder ALLER Sensoren auf derselben Karte zusammen.', 'Die sicheren Felder bilden einen zusammenhängenden Weg von 1 nach 16. Diagonale Schritte sind nicht erlaubt.', 'Ein vollständiger Weg hat sieben Felder einschließlich Start und Ziel. Jede Person bestätigt genau dieselbe Route.'],
        echo: ['Sammelt zunächst alle Aussagen. „Vor“ bedeutet nicht unmittelbar davor.', 'Probiert die fünf Positionen durch und streicht jede Reihenfolge, die auch nur eine Aussage verletzt.', 'Es gibt genau eine Reihenfolge. Jedes Teammitglied muss die fünf Karten auf seinem Gerät genauso anordnen.'],
        strom: ['Fragt nach den Zielwerten eurer eigenen Stellglieder. Euer Blatt erklärt andere Stellglieder.', 'Geht von links nach rechts vor. Ziel minus Ausgangswert minus vorherige Drehung ergibt die benötigte eigene Drehung.', 'Rechnet modulo 5: Ein negatives Ergebnis erhält so oft +5, bis es zwischen 0 und 4 liegt. Das letzte Stellglied hat keinen rechten Nachbarn.'],
        anker: ['Lest die Überschrift eures privaten Blattes: Die Folge gehört einer ANDEREN Person.', 'Gebt alle vier Zeichen vor dem Start weiter. Dann melden alle Bereitschaft und bestätigen pro Impuls das eigene Zeichen.', 'Das Zeitfenster gilt pro Impuls, nicht für alle vier zusammen. Nach einem Fehlschlag könnt ihr die gesamte Folge mit neuer Bereitschaft wiederholen.'],
        zeugen: ['Jede Person besitzt echte Merkmale. Kein Merkmal darf ignoriert werden.', 'Vergleicht bei allen acht Kanälen Zeitanker, Schattenrichtung und Kondensat. Ein Widerspruch schließt den Kanal aus.', 'Genau ein Kanal erfüllt die Kombination aller unabhängigen Merkmale. Alle wählen denselben Kanal.'],
        nullpunkt: ['Lest die vier Ziffern jedes Messstreifens spaltenweise vor.', 'Addiert nur die erste Spalte aller Personen für die erste Codeziffer. Dann die zweite, dritte und vierte Spalte.', 'Behaltet von jeder Summe nur die letzte Ziffer. Führt jeden Referenzplatz genau einmal auf; jede Person bestätigt denselben vierstelligen Code.']
    };
    const clone = x => JSON.parse(JSON.stringify(x));
    function bauen(entwurf, stufe = 'schwer', seed = Date.now()) {
        if (!Clavis.STUFEN[stufe])
            stufe = 'schwer';
        return { oeffentlich: { premium: 'arizona', nurTeam: true, titel: VORLAGE.titel, welt: 'labor', alter: 'ab14', stufe, minuten: ({ leicht: 95, mittel: 85, schwer: 72, experte: 60 })[stufe], minSpieler: 2, maxSpieler: 8, orte: ORTE, aufgaben: AUFGABEN, funde: FUNDE, stationen: Object.fromEntries(AUFGABEN.map((a, i) => [a.id, { ...a, index: i, mech: 'arizona_' + a.id }])), szenen: [{ titel: 'Die Nullmeile', stationen: AUFGABEN.map(x => x.id) }], stimmung: VORLAGE.stimmung, schreck: { standard: entwurf.jumpscares !== false, staerke: 6 }, hinweisKosten: ({ leicht: 25, mittel: 40, schwer: 55, experte: 75 })[stufe] }, geheim: { seed, runden: {} }, ersetzt: [] };
    }
    function erstellen(gebaut, { senden, beiEnde, jetzt = Date.now, intervall = setInterval, aufheben = clearInterval }) {
        const R = gebaut.oeffentlich, G = gebaut.geheim;
        const L = { phase: 'lobby', host: null, personen: new Map(), roster: [], bereit: {}, stage: 0, gruppen: [], rev: 0, seq: 0, start: null, pauseSeit: null, pauseSum: 0, manuell: false, scene: null, vote: null, wahl: {}, geloest: {}, journal: [], chat: [], strafe: 0, ende: null, momente: new Set(), versuche: 0, hinweiseGesamt: 0 };
        let tick, gestoppt = false;
        const last = new Map();
        const teilnehmer = () => L.roster.map(id => L.personen.get(id)).filter(Boolean);
        const fehlen = () => L.phase === 'spiel' ? teilnehmer().filter(p => !p.da) : [];
        const pausen = () => [L.scene ? 'Filmszene' : null, L.manuell ? 'Teampause' : null, fehlen().length ? 'Verbindung fehlt' : null].filter(Boolean);
        function syncPause() {
            const stop = L.phase === 'spiel' && pausen().length > 0;
            if (stop && L.pauseSeit === null)
                L.pauseSeit = jetzt();
            else if (!stop && L.pauseSeit !== null) {
                L.pauseSum += jetzt() - L.pauseSeit;
                L.pauseSeit = null;
            }
        }
        const rest = () => Math.max(0, R.minuten * 60000 - (L.start === null ? 0 : (L.pauseSeit ?? jetzt()) - L.start - L.pauseSum) - L.strafe * 1000);
        const notiz = (titel, text, art = 'fund') => L.journal.push({ id: ++L.seq, titel, text, art });
        const gruppeVon = id => L.gruppen.find(g => g.ids.includes(id));
        function stand() { return clone({ typ: 'stand', phase: L.phase, restMs: rest(), geloest: L.geloest, hinweise: {}, wort: [], spieler: [...L.personen.values()].filter(p => p.da).map(p => ({ id: p.id, name: p.name })), arizona: { seq: ++L.seq, serverZeit: jetzt(), stage: L.stage, roster: teilnehmer().map(p => ({ id: p.id, name: p.name, da: p.da })), bereit: L.bereit, pausen: pausen(), scene: L.scene, vote: L.vote, wahl: L.wahl, journal: L.journal, chat: L.chat.slice(-20), gruppen: L.gruppen.map(g => ({ id: g.id, ids: g.ids, namen: g.ids.map(id => L.personen.get(id).name), fertig: g.fertig, abgegeben: Object.keys(g.abgaben), bereit: Object.keys(g.bereit), impuls: g.impuls, bis: g.bis, hinweise: g.hinweise, versuche: g.versuche })), fehlen: fehlen().map(p => ({ id: p.id, name: p.name })), spaet: [...L.personen.values()].filter(p => p.da && !L.roster.includes(p.id)).map(p => ({ id: p.id, name: p.name })), strafe: L.strafe } }); }
        function privat(id) { const p = L.personen.get(id), g = gruppeVon(id), rolle = g?.ids.indexOf(id), q = g ? G.runden[g.id] : null; return clone({ typ: 'arizona_priv', an: id, seq: L.seq, rev: L.rev, stage: L.stage, zeuge: ZEUGNISSE[Math.max(0, L.roster.indexOf(id)) % ZEUGNISSE.length], daten: g ? { gruppe: g.id, p: q.p, ...q.privat[rolle], eigeneAbgabe: g.abgaben[id] ?? null, chat: g.chat.slice(-16) } : null, zuschauer: L.phase === 'spiel' && !L.roster.includes(id) }); }
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
        function scene(id) {
            if (!SZENEN[id])
                return;
            L.scene = { ...clone(SZENEN[id]), id: id + ':' + (++L.seq), bestaetigt: [] };
            notiz(L.scene.titel, L.scene.zeilen.map(z => z.titel + '\n' + z.text).join('\n\n'), 'szene');
            syncPause();
        }
        function setup(stage) {
            L.stage = stage;
            L.rev++;
            L.gruppen = [];
            if (stage >= AUFGABEN.length)
                return;
            const ids = stage >= 6 ? [L.roster.slice()] : ClavisArizonaLogik.gruppen(L.roster, G.seed ^ Math.imul(stage + 1, 0x45d9f3b) ^ L.rev);
            ids.forEach((team, i) => { const id = 'j' + stage + '-' + L.rev + '-' + i; L.gruppen.push({ id, ids: team, fertig: false, abgaben: {}, bereit: {}, impuls: 0, bis: null, hinweise: [], chat: [], versuche: 0 }); G.runden[id] = ClavisArizonaLogik.bauen(AUFGABEN[stage].id, team.map(id => L.personen.get(id)), G.seed ^ Math.imul(stage + 5, 73471) ^ Math.imul(i + 7, 23497), R.stufe); });
        }
        function abstimmung(key) { const def = { nika: { titel: 'Ein Mensch oder eine Konstante?', text: 'Nika kann mitkommen. Ihre Befreiung kostet euch 45 Sekunden. Haltet ihr die Isolierung geschlossen, bleibt sie Referenz 01. Alle stimmen ab; eine Mehrheit entscheidet. Bei Gleichstand müsst ihr euch einigen.', optionen: [['retten', 'Nika befreien', '45 Sekunden. Sie verlässt ihre Referenzposition.'], ['halten', 'Isolierung halten', 'Nika bleibt in der Station.']] }, daten: { titel: 'Welche Spur bleibt?', text: 'Die Versuchsaufnahmen können belegen, was hier passiert ist. Sie können auch die nächste Expedition anlocken. Alle stimmen ab; eine Mehrheit entscheidet.', optionen: [['sichern', 'Aufnahmen sichern', '60 Sekunden. Beweise verlassen die Station.'], ['loeschen', 'Archiv löschen', 'Die Anleitung für den nächsten Notruf verschwindet.']] }, finale: { titel: 'Welchen Morgen wählt ihr?', text: 'Diese Entscheidung verlangt Einstimmigkeit. Jede Person muss selbst wählen. Ihr könnt eure Stimme ändern, bis ihr alle derselben Möglichkeit zustimmt.', optionen: [['versiegeln', 'Den Nullpunkt versiegeln', 'Ihr schließt die Kontur und nehmt den ungewissen Rückweg.'], ['oeffnen', 'Den nächsten Morgen öffnen', 'Ihr lasst die Möglichkeit hinter dem Glas frei.'], ['uebernehmen', 'JANUS übernehmen', 'Ihr bleibt als neue Referenzen und wählt den nächsten Tag.']] } }[key]; L.vote = { key, ...def, stimmen: {}, einstimmig: key === 'finale' }; }
        function ende(geschafft, grund = 'zeit') {
            if (gestoppt || L.ende)
                return;
            aufheben(tick);
            const w = L.wahl;
            let titel, text, nach;
            if (!geschafft) {
                titel = 'Der nächste Versuch';
                text = 'Der Horizont schließt sich. Ihr sitzt wieder im Van. Derselbe Refrain. Derselbe warme Wind. Nur eine Sache ist anders: Im Handschuhfach liegt ein Foto von euch vor der Station. Jemand hat „Versuch ' + (L.versuche + 2) + '“ auf die Rückseite geschrieben.';
                nach = 'Als der Reifen platzt, weiß eine Person von euch bereits, welcher Mast gleich am Horizont erscheint. Die anderen haben es noch nicht bemerkt.';
            }
            else if (w.finale === 'versiegeln') {
                titel = w.nika === 'retten' ? 'Ein Morgen ohne Aufnahme' : 'Die Straße und das Glas';
                text = 'Ihr bestätigt die letzte Kontur. Der schwarze Rand zieht sich zusammen. Zum ersten Mal kommt das Echo nach euren Schritten. Die Treppe führt nach oben. Euer Van steht am Straßenrand. Der Reifen ist noch immer platt. Das fühlt sich unerwartet richtig an.';
                nach = w.nika === 'retten' ? 'Nika sitzt mit euch auf dem warmen Asphalt und hält das Gesicht in den ersten Sonnenstreifen. „Wie spät?“, fragt sie. Niemand schaut auf eine Uhr. ' + (w.daten === 'sichern' ? 'Auf der Speicherkarte liegt genau eine Aufnahme mehr, als ihr kopiert habt. Ihr öffnet sie heute nicht.' : 'Unter dem Mast erlischt das letzte Licht. Diesmal ruft niemand zurück.') : 'Ihr erreicht die Straße. Unter euren Füßen hält ein Mensch die Referenzposition. Als der Van später wieder fährt, bleibt ein warmer Handabdruck auf der Scheibe zurück.';
            }
            else if (w.finale === 'oeffnen') {
                titel = 'Der bessere Morgen';
                text = 'Hinter der Kontur steht euer Van. Alle Reifen sind ganz. Der Tank ist voll. Die Straße führt direkt ans Meer. Ihr geht hindurch. Eine Stimme aus dem Radio sagt: „Diesmal kommt ihr an.“ Sie klingt, als kenne sie euch schon lange.';
                nach = 'Beim ersten Halt macht ihr ein Foto. Auf dem Bildschirm seid ihr alle zu sehen. Im Rückspiegel sitzt eine weitere Person. Als ihr euch umdreht, ist dort nur das Licht eines ganz gewöhnlichen Morgens.';
            }
            else {
                titel = 'Die neuen Referenzen';
                text = 'Ihr legt eure Konturen in die Anlage. Für einen Moment seht ihr alle möglichen Straßen gleichzeitig. Der Van erreicht jedes Ziel. Niemand geht verloren. Jeder von euch sieht einen anderen perfekten Tag.';
                nach = 'Oben bleibt die Straße leer. Im Labor läuft ein neuer Besucherfilm an. Darauf kommt ein anderer Wagen zum Stehen. Die erste Nachricht, die er empfängt, trägt eure Stimmen.';
            }
            L.ende = { geschafft, grund, zeit: Math.max(0, R.minuten * 60000 - rest()), sterne: geschafft ? 1 + (w.finale === 'versiegeln' ? 1 : 0) + (w.finale === 'versiegeln' && w.nika === 'retten' ? 1 : 0) : 0, hinweise: L.hinweiseGesamt, geloest: Object.keys(L.geloest).length, stationen: 8, wort: '', arizona: { titel, text, nach, wahl: clone(w), personen: teilnehmer().map(p => p.name) } };
            L.phase = 'ende';
            senden({ typ: 'ende', ergebnis: clone(L.ende) });
            beiEnde?.(clone(L.ende));
        }
        function next(g) {
            g.fertig = true;
            g.bis = null;
            notiz('Gruppe ' + (L.gruppen.indexOf(g) + 1) + ' · ' + AUFGABEN[L.stage].titel, g.ids.map(id => L.personen.get(id).name).join(', ') + ' haben ihre unabhängigen Beiträge zusammengeführt.', 'team');
            if (L.gruppen.every(x => x.fertig)) {
                const art = AUFGABEN[L.stage].id;
                L.geloest[art] = true;
                notiz(AUFGABEN[L.stage].titel, 'Alle Gruppen haben die Station gemeinsam freigegeben.', 'fortschritt');
                const old = L.stage;
                setup(old + 1);
                if (old === 5)
                    abstimmung('nika');
                if (old === 6)
                    abstimmung('daten');
                if (old === 7)
                    abstimmung('finale');
                scene(art);
            }
        }
        const antwort = (p, d, richtig, info = '') => senden({ typ: 'antwort', nr: d.nr, richtig, info }, p.id);
        function eingang(p, d) {
            if (!d || typeof d !== 'object' || gestoppt || L.ende || !L.personen.get(p.id)?.da)
                return;
            if (d.typ === 'arizona_sync') {
                senden({ typ: 'raum', raum: R }, p.id);
                senden(stand(), p.id);
                senden(privat(p.id), p.id);
                return;
            }
            if (d.typ === 'arizona_bereit' && L.phase === 'lobby') {
                L.bereit[p.id] = d.wert !== false;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'arizona_pause') {
                if (p.id !== L.host)
                    return antwort(p, d, false, 'Nur die Spielleitung kann die Teampause schalten.');
                L.manuell = !L.manuell;
                if (L.manuell)
                    for (const g of L.gruppen)
                        if (g.bis) {
                            g.bis = null;
                            g.bereit = {};
                            g.abgaben = {};
                            g.impuls = 0;
                        }
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'arizona_ersatz') {
                if (p.id !== L.host)
                    return antwort(p, d, false, 'Nur die Spielleitung besetzt einen fehlenden Platz neu.');
                const alt = L.personen.get(d.alt), neu = L.personen.get(d.neu);
                if (!alt || alt.da || !L.roster.includes(d.alt) || !neu?.da || L.roster.includes(d.neu))
                    return antwort(p, d, false, 'Wähle einen fehlenden Platz und einen verbundenen neuen Gast.');
                const at = L.roster.indexOf(d.alt);
                L.roster[at] = d.neu;
                for (const g of L.gruppen) {
                    const i = g.ids.indexOf(d.alt);
                    if (i >= 0) {
                        g.ids[i] = d.neu;
                        delete g.abgaben[d.alt];
                        g.bereit = {};
                        g.bis = null;
                        g.impuls = 0;
                        const q = G.runden[g.id];
                        q.privat.forEach((x, j) => { x.hinweis = x.hinweis.split(alt.name).join(neu.name); if (x.blatt.fuer === alt.name)
                            x.blatt.fuer = neu.name; x.name = L.personen.get(g.ids[j]).name; x.partner = g.ids.map(id => L.personen.get(id).name); });
                    }
                }
                if (L.scene) {
                    L.scene.bestaetigt = L.scene.bestaetigt.filter(id => id !== d.alt);
                }
                if (L.vote)
                    delete L.vote.stimmen[d.alt];
                L.rev++;
                notiz('Neuer unabhängiger Zeuge', neu.name + ' übernimmt den Referenzplatz von ' + alt.name + '.', 'team');
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (!L.roster.includes(p.id) || L.phase !== 'spiel')
                return antwort(p, d, false, 'Du bist noch keinem aktiven Referenzplatz zugeteilt.');
            if (d.typ === 'arizona_szene') {
                if (!L.scene || d.id !== L.scene.id)
                    return antwort(p, d, false, 'Diese Szene ist bereits beendet.');
                if (!L.scene.bestaetigt.includes(p.id))
                    L.scene.bestaetigt.push(p.id);
                if (L.roster.every(id => L.scene.bestaetigt.includes(id)))
                    L.scene = null;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'arizona_chat') {
                const text = String(d.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 280);
                if (!text)
                    return antwort(p, d, false, 'Die Nachricht ist leer.');
                const key = 'chat:' + p.id;
                if (jetzt() - (last.get(key) ?? -Infinity) < 900)
                    return antwort(p, d, false, 'Bitte kurz warten.');
                last.set(key, jetzt());
                const msg = { id: ++L.seq, von: p.id, name: L.personen.get(p.id).name, text };
                if (d.kanal === 'team') {
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
            if (L.scene || pausen().length)
                return antwort(p, d, false, 'Die gemeinsame Zeit ist pausiert.');
            if (rest() <= 0)
                return ende(false, 'zeit');
            if (d.typ === 'arizona_stimme') {
                if (!L.vote || !L.vote.optionen.some(o => o[0] === d.wert))
                    return antwort(p, d, false, 'Diese Abstimmung ist nicht offen.');
                L.vote.stimmen[p.id] = d.wert;
                antwort(p, d, true);
                if (L.roster.every(id => L.vote.stimmen[id])) {
                    const counts = {};
                    for (const id of L.roster)
                        counts[L.vote.stimmen[id]] = (counts[L.vote.stimmen[id]] || 0) + 1;
                    const [wert, anzahl] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    if (L.vote.einstimmig ? anzahl === L.roster.length : anzahl > L.roster.length / 2) {
                        const key = L.vote.key;
                        L.wahl[key] = wert;
                        notiz(L.vote.titel, L.vote.optionen.find(o => o[0] === wert)[1] + ' · ' + anzahl + ' von ' + L.roster.length + ' Stimmen.', 'wahl');
                        L.vote = null;
                        if (key === 'nika' && wert === 'retten')
                            L.strafe += 45;
                        if (key === 'daten' && wert === 'sichern')
                            L.strafe += 60;
                        if (key === 'finale')
                            return ende(true, 'entscheidung');
                    }
                }
                melden(true);
                return;
            }
            if (L.vote)
                return antwort(p, d, false, 'Entscheidet zuerst gemeinsam in der offenen Abstimmung.');
            if (d.typ === 'arizona_lesen') {
                const ort = d.ort, i = d.index;
                if (!Object.hasOwn(ORTE, ort) || !Number.isInteger(i) || i < 0 || i > 1)
                    return antwort(p, d, false, 'Unbekannter Fund.');
                const max = Math.min(8, L.stage + 1), idx = Object.keys(ORTE).indexOf(ort);
                if (idx > max)
                    return antwort(p, d, false, 'Dieser Bereich ist noch geschlossen.');
                const f = FUNDE[ort][i];
                if (!L.journal.some(x => x.art === 'fund' && x.titel === f[0]))
                    notiz(f[0], f[1]);
                antwort(p, d, true);
                melden();
                return;
            }
            const g = gruppeVon(p.id);
            if (!g || g.fertig || d.gruppe !== g.id || d.rev !== L.rev)
                return antwort(p, d, false, 'Diese Gruppe oder Aufgabe hat sich geändert. Bitte den aktuellen Stand verwenden.');
            const q = G.runden[g.id], rolle = g.ids.indexOf(p.id);
            if (d.typ === 'arizona_hinweis') {
                if (Number.isInteger(d.index) && d.index !== g.hinweise.length) { antwort(p,d,true,'Dieser Hinweis wurde bereits von eurer Gruppe geöffnet.'); melden(true); return; }
                if (g.hinweise.length >= 3)
                    return antwort(p, d, false, 'Alle drei Hinweise sind bereits geöffnet.');
                g.hinweise.push(HINWEISE[q.p.art][g.hinweise.length]);
                L.hinweiseGesamt++;
                L.strafe += R.hinweisKosten;
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ === 'arizona_ankerbereit') {
                if (q.p.art !== 'anker' || g.bis)
                    return antwort(p, d, false, 'Ein Impuls läuft bereits.');
                g.bereit[p.id] = true;
                if (g.ids.every(id => g.bereit[id])) {
                    g.bis = jetzt() + q.p.fenster * 1000;
                    g.abgaben = {};
                }
                antwort(p, d, true);
                melden(true);
                return;
            }
            if (d.typ !== 'arizona_beitrag')
                return;
            const key = 'beitrag:' + p.id;
            if (jetzt() - (last.get(key) ?? -Infinity) < 550)
                return antwort(p, d, false, 'Bitte kurz warten, bevor du erneut bestätigst.');
            last.set(key, jetzt());
            if (q.p.art === 'anker' && (!g.bis || d.impuls !== g.impuls))
                return antwort(p, d, false, 'Wartet, bis alle Anker bereit sind, und bestätigt den aktuellen Impuls.');
            if (q.p.art === 'anker' && jetzt() > g.bis) {
                reset(g, 'Das Impulsfenster ist abgelaufen.');
                antwort(p, d, false, 'Bitte vor dem Neustart erneut abstimmen.');
                melden(true);
                return;
            }
            const a = ClavisArizonaLogik.normal(q.p.art, rolle, d.antwort);
            if (a === null)
                return antwort(p, d, false, 'Die Eingabe hat nicht das erwartete Format.');
            g.abgaben[p.id] = clone(a);
            antwort(p, d, true, 'Dein unabhängiger Beitrag liegt vor.');
            if (g.ids.every(id => Object.hasOwn(g.abgaben, id))) {
                if (ClavisArizonaLogik.pruefen(q, g.ids.map(id => g.abgaben[id]), g.impuls)) {
                    if (q.p.art === 'anker' && g.impuls < 3) {
                        g.impuls++;
                        g.abgaben = {};
                        g.bis = jetzt() + q.p.fenster * 1000;
                    }
                    else
                        next(g);
                }
                else
                    reset(g, 'Eure Beiträge passen noch nicht zusammen. Vergleicht alle Informationen.');
            }
            melden(true);
        }
        function reset(g, text) { g.abgaben = {}; g.bereit = {}; g.bis = null; g.impuls = 0; g.versuche++; L.versuche++; L.strafe += 20; g.chat.push({ id: ++L.seq, von: 'janus', name: 'Stationsprotokoll', text: text + ' 20 Sekunden Verlust.' }); }
        tick = intervall(() => {
            let persoenlich = false;
            if (gestoppt || L.phase !== 'spiel' || L.ende)
                return;
            syncPause();
            if (!pausen().length) {
                if (rest() <= 0)
                    return ende(false, 'zeit');
                for (const g of L.gruppen)
                    if (!g.fertig && g.bis && jetzt() > g.bis) {
                        reset(g, 'Das Impulsfenster ist abgelaufen.');
                        persoenlich = true;
                    }
                const fort = 1 - rest() / (R.minuten * 60000);
                for (const [schwelle, art] of [[.2, 'rueckspiegel'], [.42, 'telefon'], [.64, 'schatten'], [.83, 'horizont'], [.94, 'morgen']])
                    if (fort >= schwelle && !L.momente.has(art)) {
                        L.momente.add(art);
                        senden({ typ: 'arizona_moment', art });
                    }
            }
            melden(persoenlich);
        }, 1000);
        return { dazu(p) {
                if (gestoppt || !p?.id)
                    return;
                const alt = L.personen.get(p.id);
                L.personen.set(p.id, { id: p.id, name: String(p.name || alt?.name || 'Gast').slice(0, 24), da: true });
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
                for (const g of L.gruppen)
                    if (g.ids.includes(p.id) && g.bis) {
                        g.bis = null;
                        g.abgaben = {};
                        g.bereit = {};
                        g.impuls = 0;
                    }
                melden(true);
            }, eingang, stand, starten() {
                if (gestoppt || L.phase !== 'lobby')
                    return false;
                const aktiv = [...L.personen.values()].filter(p => p.da);
                if (aktiv.length < 2 || aktiv.length > 8 || aktiv.some(p => !L.bereit[p.id]))
                    return false;
                L.roster = aktiv.map(p => p.id);
                L.phase = 'spiel';
                L.start = jetzt();
                setup(0);
                scene('intro');
                melden(true);
                return true;
            }, beenden: () => ende(false, 'aufgegeben'), stoppen() { gestoppt = true; aufheben(tick); }, get phase() { return L.phase; }, get ende() { return L.ende; } };
    }
    CLAVIS_VORLAGEN.unshift(VORLAGE);
    return { VORLAGE, bauen, erstellen };
})();
