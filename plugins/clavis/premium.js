'use strict';
/* Eine handgeschriebene Kampagne. Gleicher Raum/Stand/Antwort-Vertrag wie ClavisLeiter; nur der Host kennt die Lösungen. */
const ClavisPremium = (() => {
  const ID = 'v-wald17';
  const VORLAGE = {
    id: ID, premium: 'wald17', welt: 'spuk', alter: 'ab14', jumpscares: true, empfohlen: 'schwer', spieler: '1–4',
    titel: 'Der Wald hört mit', anriss: 'Forstrevier 17. Eine Nachtwache, die nie endete. Acht verbundene Rätsel, sieben Schauplätze – und eine Stimme, die dich kennt.',
    intro: 'Nach elf Tagen erreicht dich Noras Nachricht. Jetzt ist es 02:17 Uhr und du stehst vor dem alten Forsthaus. Ihr Wagen steht auf dem Hof. An der Tür hängt dein Foto.',
    outro: 'Zum ersten Mal seit Tagen klingt der Wald wie ein Wald.', loesungswort: 'WALDRAND', stimmung: { spannung: 9, gefahr: 8, spuk: 8, grusel: 7 },
    szenen: [{ titel: 'Forstrevier 17', stationen: [] }],
  };
  const ORTE = {
    hof: { name: 'Vor dem Forsthaus', akt: 'I · Die Stimme', ziel: 'Untersuche den Wagen. Nora hat dir etwas hinterlassen.', objekte: ['wagen', 'anschlag', 'haustuer'], nachbarn: ['buero', 'pfad'] },
    buero: { name: 'Die Nachtwache', akt: 'I · Die Stimme', ziel: 'Bring das Notnetz zum Laufen und suche Noras Aufzeichnungen.', objekte: ['strom', 'dienstbuch', 'peilung', 'tisch'], nachbarn: ['hof', 'funk', 'keller'] },
    funk: { name: 'Die Funkstube', akt: 'II · Was antwortet', ziel: 'Finde den stillen Kanal. Nicht jede Stimme kommt von draußen.', objekte: ['frequenz', 'band', 'funknotiz', 'sendetaste'], nachbarn: ['buero'] },
    pfad: { name: 'Der Weg ohne Vögel', akt: 'II · Was antwortet', ziel: 'Lies die Spuren. Zwei Peilungen führen zum Wehr.', objekte: ['kerben', 'mantel', 'wegzeichen'], nachbarn: ['hof', 'wehr'] },
    wehr: { name: 'Das alte Wehr', akt: 'III · Die andere Nacht', ziel: 'Entlaste den Steg. Hinter dem Gitter bewegt sich jemand.', objekte: ['ventile', 'nora', 'gravur'], nachbarn: ['pfad', 'keller'] },
    keller: { name: 'Unter dem Forsthaus', akt: 'III · Die andere Nacht', ziel: 'Rekonstruiere die Nacht und unterbrich die Rufschleife.', objekte: ['chronik', 'relais', 'wartung', 'kopie'], nachbarn: ['buero', 'wehr', 'turm'] },
    turm: { name: 'Über den Baumkronen', akt: 'IV · Dein letzter Ruf', ziel: 'Richte das Leuchtfeuer aus. Entscheide, was den Wald verlässt.', objekte: ['leuchtfeuer', 'ausgang', 'fernglas'], nachbarn: ['keller'] },
  };
  const OBJECTS = {
    wagen: { name: 'Noras Wagen', x: 22, y: 75, symbol: 'schluessel', art: 'fund', text: 'Der Motor ist kalt. Auf der Windschutzscheibe steht im Tau: „Du bist zu spät.“ Unter der Sonnenblende steckt Noras Schlüssel. Daneben liegt ihr Dienstausweis – mit einer Kerbe quer durch das Gesicht.', item: ['schluessel', 'Forsthausschlüssel', '🗝'], notiz: 'Noras Wagen: Schlüssel unter der Sonnenblende. Auf dem Ausweis wurde ihr Gesicht durchgestrichen.' },
    anschlag: { name: 'Sperrgebiet', x: 75, y: 51, symbol: 'akte', art: 'dokument', text: 'FORSTREVIER 17 · BETRETEN VERBOTEN\nDie Straße zum Tal ist überschwemmt. Einziger Notrufpunkt: der Feuerturm. Automatische Rufanlage wegen technischer Störung außer Betrieb.\nHandschrift darunter: „Wenn es nach dir ruft, bleib auf dem Weg.“' },
    haustuer: { name: 'Forsthaustür', x: 54, y: 54, symbol: 'tuer', art: 'tuer', text: 'Im Schloss steckt ein abgebrochener Draht. Mit Noras Schlüssel lässt sich der Riegel zurückschieben. Drinnen ist Licht – obwohl der Strom abgestellt sein müsste.' },
    dienstbuch: { name: 'Dienstbuch', x: 27, y: 66, symbol: 'buch', art: 'dokument', text: 'NACHTSCHALTUNG\nNur drei Verbraucher dürfen laufen, zusammen genau 12 A. Der Funk muss erreichbar bleiben. Das Archiv darf nur mit laufender Entwässerung betrieben werden. Heizung und Flutlicht liegen auf derselben Rückleitung: niemals beide einschalten.\nNora, Randnotiz: „Ich habe die Sicherungen absichtlich getrennt. Nicht blind alles einschalten.“' },
    tisch: { name: 'Noras Platz', x: 75, y: 68, symbol: 'akte', art: 'dokument', text: 'Ein Foto von euch beiden vor diesem Haus. Dahinter: eine Notiz.\n„Wenn ich mich nicht melde, glaub dem Band. Nicht dem Funk. Die Originale beginnen mit meiner Tageskennung und enden mit unserem Klopfzeichen. Zweimal kurz. Einmal lang.“\nDarunter zwei Peilungen: Alter Turm A6 → Nordost. Grenzstein G6 → Nordwest. Norden ist oben. Der Schnittpunkt ist mein Versteck.', item: ['notiz', 'Noras Notiz', '✉'] },
    funknotiz: { name: 'Frequenztafel', x: 78, y: 44, symbol: 'tafel', art: 'dynamisch' },
    sendetaste: { name: 'Die Sprechtaste', x: 61, y: 71, symbol: 'funk', art: 'entscheidung', text: 'Wer antwortet, wird gehört.' },
    kerben: { name: 'Die Birke', x: 33, y: 49, symbol: 'wandbild', art: 'dokument', text: 'Eine Birke mit drei frischen Kerben. Jemand hat „KEIN ECHO“ in die Rinde geschnitten. Darunter dieselben Worte wie auf dem Schild am Haus. Nur eines ist neu: dein Vorname.\nDu trittst zurück. Zwischen den Bäumen tritt etwas mit zurück.' },
    mantel: { name: 'Noras Mantel', x: 68, y: 72, symbol: 'akte', art: 'fund', text: 'Der Mantel hängt viel zu ordentlich am Ast. Die Ärmel sind nass. In der Tasche steckt eine Wartungskarte: „Die drei Handräder wirken gekoppelt. A wirkt doppelt auf I und einfach auf III. B wirkt einfach auf I und doppelt auf II. C wirkt einfach auf II und doppelt auf III.“', item: ['wartung', 'Ventilplan', '▤'] },
    wegzeichen: { name: 'Die Weggabelung', x: 53, y: 60, symbol: 'karte', art: 'dokument', text: 'Zwei Wege. Auf beiden dieselben Fußspuren – auch der Riss in Noras linker Sohle. Nur der Pfad zum Wehr führt gegen die Fließrichtung des Wassers. Verlass dich auf die Peilungen, nicht auf die Spuren.' },
    nora: { name: 'Hinter dem Gitter', x: 69, y: 46, symbol: 'portraet', art: 'entscheidung', text: 'Nora sitzt im Schutz des Pegelhauses, den Fuß eingeklemmt. Auf ihrem Ausweis steht ein Datum von vor elf Tagen. „Das war gestern“, flüstert sie. Sie hat seit dem Unfall kein Funkgerät. Als du ihr den Notruf vorspielst, wird sie ganz still. „Das habe ich nie gesagt.“' },
    gravur: { name: 'Vier Zeichen', x: 27, y: 47, symbol: 'wandbild', art: 'dynamisch' },
    wartung: { name: 'Schaltbild', x: 75, y: 49, symbol: 'akte', art: 'dokument', text: 'RUFRELAIS · LÖSCHZYKLUS\nJede Taste kippt ihren Kontakt und die vier Nachbarn im Kreuz. Im Rückkanal kippt dieselbe Taste die vier diagonalen Nachbarn und sich selbst. Am Rand entfallen Kontakte. Alle Kontrolllampen müssen gleichzeitig leuchten. Zweimal dieselbe Taste hebt sich auf.\nWarnung: Die mit „RÜCKRUF“ markierte Leitung nie abtrennen, solange das Band nicht geprüft ist.' },
    kopie: { name: 'Das Beweisband', x: 20, y: 73, symbol: 'buch', art: 'entscheidung', text: 'Noras Aufzeichnungen erklären, warum die automatische Rufanlage abgeschaltet wurde. Das Original ist feucht. Eine Sicherheitskopie dauert 45 Sekunden. Du kannst sie mitnehmen – oder die Zeit für den Aufstieg nutzen.' },
    fernglas: { name: 'Blick ins Tal', x: 72, y: 49, symbol: 'fernrohr', art: 'dokument', text: 'Unten liegt der Wald wie schwarzes Wasser. Am Forsthaus brennt jetzt jedes Fenster. Im obersten steht eine Gestalt. Sie hebt den Arm, als du es tust.\nDu nimmst das Fernglas herunter. Die Gestalt tut es eine Sekunde zu spät.' },
    ausgang: { name: 'Das letzte Schloss', x: 47, y: 69, symbol: 'ausgang', art: 'finale' },
  };
  const STATIONEN = {
    strom: ['buero', 49, 43, [], ['dienstbuch'], 'Die drei aktiven Stromkreise müssen genau 12 A ergeben.'],
    frequenz: ['funk', 43, 62, ['strom'], ['funknotiz'], 'Ein alter Träger, eine Nachtverschiebung und eine verkehrte Phase.'],
    peilung: ['buero', 22, 43, ['frequenz'], ['tisch'], 'Trage die beiden Sichtlinien auf der Revierkarte ein.'],
    ventile: ['wehr', 47, 57, ['peilung'], ['mantel'], 'Drei Handräder, drei gekoppelte Pegel. Finde die gemeinsame Einstellung.'],
    chronik: ['keller', 28, 47, ['ventile'], [], 'Drei ungenaue Uhren. Sechs Einträge. Was geschah wirklich zuerst?'],
    band: ['funk', 26, 67, ['chronik'], ['tisch'], 'Nur die drei Originalaufnahmen dürfen auf den Sendekanal.'],
    relais: ['keller', 55, 51, ['band'], ['wartung'], 'Zwei gekoppelte Kontaktfelder. Löse die Schleife von innen heraus.'],
    leuchtfeuer: ['turm', 40, 49, ['relais'], ['gravur'], 'Die Reihenfolge steht am Wehr. Jeder falsche Ruf erreicht auch den Wald.'],
  };
  const SZENEN = {
    intro: { titel: 'Eine Nachricht nach elf Tagen', ort: 'straße', zeilen: [
      ['23:41 · Deine Wohnung', 'Elf Tage. So lange hat die Suche nach deiner Schwester gedauert. Heute hat man sie eingestellt. Du sitzt noch vor dem Telefon, als die Nachricht eingeht.', 'erzaehler', 'regen'],
      ['Nora · Sprachnachricht', '„Du bist noch wach. Gut. Hör mir zu. Ich bin am alten Forsthaus. Nimm keinen anderen Weg. Und wenn du meine Stimme im Wald hörst …“', 'telefon', 'funk'],
      ['Forstrevier 17 · 02:17', 'Die Aufnahme bricht ab. Im Hintergrund klopft es zweimal kurz. Einmal lang. Euer Zeichen aus Kindertagen. Du fährst los.', 'erzaehler', 'klopf'],
      ['Die letzte Straße', 'Der Sturm hat die Brücke genommen. Du gehst die letzten Meter zu Fuß. Vor dem Forsthaus steht Noras Wagen. An den Fenstern hängt kein Staub. An der Tür hängt dein Foto.', 'erzaehler', 'schritte'],
      ['Aus deinem ausgeschalteten Funkgerät', '„Du bist zu spät.“ Dann noch einmal, leiser: „Du warst schon einmal hier.“', 'geist', 'atem'],
    ] },
    strom: { titel: 'Nicht allein im Haus', ort: 'buero', zeilen: [['Das Notnetz erwacht', 'Das Licht im Flur geht an. Drei Türen weiter geht es wieder aus. Eine nach der anderen. Als käme jemand auf dich zu.', 'erzaehler', 'stromaus'], ['Unter dem Boden', 'Drei Schläge. Zweimal kurz. Einmal lang. Dann rutscht unter der Kellertür ein Zettel hervor: „Frag sie nach der letzten Nacht.“', 'erzaehler', 'klopf']] },
    frequenz: { titel: 'Die Stimme kennt dich', ort: 'funk', zeilen: [['Ein sauberes Signal', '„Ich wusste, dass du kommst.“ Nora klingt nah. Zu nah. Draußen knackt ein Ast im selben Moment, in dem die Stimme Luft holt.', 'telefon', 'funk'], ['Dein Daumen am Sendeknopf', 'Auf dem Tisch steht: Wer antwortet, wird gehört. Du kannst senden – oder die Leitung offen lassen und nur zuhören.', 'erzaehler', 'atem']] },
    ventile: { titel: 'Die echte Nora', ort: 'wehr', zeilen: [['Das Gitter hebt sich', 'Im Pegelhaus liegt Nora. Ihr Gesicht ist bleich. Als du sie beim Namen nennst, packt sie dein Handgelenk. „Sag ihn nicht so laut.“', 'erzaehler', 'tuer'], ['Ohne Funkgerät', '„Ich habe die Rufanlage abgeschaltet. Sie hat die Stimmen der Vermissten abgespielt. Erst die Stimmen. Dann die Namen derer, die noch gesucht haben.“', 'brief', 'fluestern']] },
    chronik: { titel: 'Der Anruf kam danach', ort: 'keller', zeilen: [['Der Anruf kam zu spät', 'Nora lag schon am Wehr, als der Notruf aus dem Forsthaus kam. Die Stimme hat dich hierhergebracht. Nicht deine Schwester.', 'erzaehler', 'herz'], ['Die Leitung im Beton', 'Aus dem offenen Kabelkanal kommt ein Flüstern. Es probiert deinen Atem aus. Dann sagt es mit deiner Stimme: „Ich hab sie gefunden. Komm schnell.“', 'geist', 'fluestern']] },
    band: { titel: 'Was Nora wirklich sagte', ort: 'funk', zeilen: [['Die Originalaufnahme', '„Ich wollte zurück ins Tal. Jedes Mal stand das Haus wieder vor mir. Der Wald ist kein Kreis. Die Leitung ist einer. Solange sie uns zurückruft, finden wir nicht hinaus.“', 'brief', 'spieluhr'], ['Ein letzter Ausweg', '„Lösch den Rückkanal im Keller. Dann hoch zum Turm. Das Leuchtfeuer erreicht die Straße. Aber öffne danach nie wieder den Funk.“', 'brief', 'funk']] },
    relais: { titel: 'Zum ersten Mal Stille', ort: 'keller', zeilen: [['Alle Kontakte stehen still', 'Das Summen verstummt. Du hörst deinen Puls. Dann Schritte über dir. Einer. Zwei. Drei. Sie bleiben genau über deinem Kopf stehen.', 'erzaehler', 'schritte'], ['Der Wald antwortet ohne Leitung', 'Am Türspalt schiebt sich eine Hand vorbei. Sie zieht sich zurück, als der erste Vogel ruft. Der Turm ist frei. Noch.', 'erzaehler', 'tuerknall']] },
    leuchtfeuer: { titel: 'Das Tal sieht dich', ort: 'turm', zeilen: [['Vier Lichtzeichen', 'Weit unten antwortet ein Scheinwerfer. Ein echter Mensch. Du hörst ein Fahrzeug auf der Straße. Hinter dir klickt das Funkgerät.', 'erzaehler', 'erfolg'], ['Ein Angebot', '„Wenn du gehst, bleibt sie hier.“ Die Stimme klingt jetzt wie du. Vor dir ist das letzte Schloss. Das Wort aus den acht Fundstücken öffnet den Weg.', 'geist', 'funk']] },
  };
  const ORDER = Object.keys(STATIONEN), WORT = 'WALDRAND';
  function bauen(entwurf, stufe = 'schwer', seed = Date.now()) {
    const st = Clavis.STUFEN[stufe] || Clavis.STUFEN.schwer;
    const q = Clavis.PremiumLogik.bauen(stufe, seed);
    const stationen = {}, geheim = {};
    ORDER.forEach((id, i) => {
      const [ort, x, y, braucht, lesen, text] = STATIONEN[id];
      stationen[id] = { ort: q.p[id].titel, titel: q.p[id].titel, mech: 'premium_' + id, p: q.p[id], text, symbol: ({ strom: 'schaltkasten', frequenz: 'funk', peilung: 'karte', ventile: 'ventil', chronik: 'akte', band: 'spieluhr', relais: 'reaktor', leuchtfeuer: 'lampe' })[id], ortId: ort, x, y, braucht, lesen };
      geheim[id] = { loesung: q.geheim[id], buchstabe: WORT[i] };
    });
    const publicData = { titel: VORLAGE.titel, premium: 'wald17', welt: 'spuk', alter: 'ab14', stufe, minuten: ({ leicht: 60, mittel: 50, schwer: 42, experte: 35 })[stufe] || 42,
      stimmung: { ...VORLAGE.stimmung }, intro: VORLAGE.intro, outro: VORLAGE.outro, hinweisKosten: st.kosten, hinweisAnzahl: st.hinweise,
      stationen, szenen: [{ titel: 'Forstrevier 17', stationen: ORDER.slice() }], finale: { laenge: 8 }, bonus: [],
      schreck: { mild: false, standard: entwurf.jumpscares !== false, staerke: 7, arten: ['gestalt', 'hand'] },
      orte: ORTE, objekte: OBJECTS, introSzene: SZENEN.intro, kennung: q.p.band.kennung, zeichen: q.p.frequenz.zeichen,
    };
    return { oeffentlich: publicData, geheim: { stationen: geheim, wort: WORT }, ersetzt: [] };
  }
  function erstellen(gebaut, { senden, beiEnde, jetzt = Date.now, intervall = setInterval, aufheben = clearInterval }) {
    const R = gebaut.oeffentlich, G = gebaut.geheim;
    const L = { phase: 'lobby', start: 0, strafe: 0, pause: 0, pausiert: null, szene: null, szeneNr: 0, geloest: {}, gelesen: {}, inventar: [], entscheidungen: {}, spieler: new Map(), hinweise: {}, journal: [], ende: null, ereignisse: new Set(), sequenz: 0, host: null };
    let takt = null, gestoppt = false;
    const clone = a => JSON.parse(JSON.stringify(a));
    const rest = () => R.minuten * 60000 - (L.start ? (L.pausiert ?? jetzt()) - L.start - L.pause : 0) - L.strafe * 1000;
    const fertig = id => !!L.geloest[id];
    function ortOffen(id) {
      return ({ hof: true, buero: L.inventar.some(x => x.id === 'schluessel'), funk: fertig('strom'), pfad: fertig('frequenz') && !!L.entscheidungen.funk, wehr: fertig('peilung'), keller: fertig('ventile'), turm: fertig('relais') })[id] === true;
    }
    const fehlend = id => { const s = R.stationen[id]; return s.braucht.find(x => !fertig(x)) || s.lesen.find(x => !L.gelesen[x]); };
    function stand() {
      return clone({ typ: 'stand', phase: L.ende ? 'ende' : L.phase, restMs: rest(), strafe: L.strafe, geloest: L.geloest, hinweise: L.hinweise,
        wort: ORDER.map(id => fertig(id) ? G.stationen[id].buchstabe : null), spieler: [...L.spieler.values()].filter(x => x.da).map(({ id, name }) => ({ id, name })),
        premium: { sequenz: ++L.sequenz, szene: L.szene, gelesen: L.gelesen, inventar: L.inventar, entscheidungen: L.entscheidungen, journal: L.journal, offen: Object.keys(ORTE).filter(ortOffen), bereit: ORDER.filter(id => ortOffen(R.stationen[id].ortId) && !fehlend(id)), pausiert: L.pausiert !== null },
      });
    }
    const melden = () => { if (!gestoppt) senden(stand(), null, true); };
    const eintrag = (titel, text, art = 'fund') => { L.journal.push({ id: ++L.sequenz, titel, text, art }); };
    function szene(id) {
      if (L.szene || !SZENEN[id]) return;
      L.pausiert = jetzt();
      L.szene = { ...clone(SZENEN[id]), id: id + ':' + (++L.szeneNr) };
      if (id === 'chronik' && L.entscheidungen.funk === 'antworten') L.szene.zeilen[1] = ['Deine Stimme im Beton', 'Aus dem Kabelkanal kommt dein eigener Satz: „Nora? Ich bin hier.“ Genau dein Zögern. Genau dein Atem. Die Leitung hat deine Antwort behalten.', 'geist', 'fluestern'];
      if (id === 'band' && L.entscheidungen.nora === 'retten') L.szene.zeilen.push(['Nora neben dir', 'Nora hält das Band an. „Der letzte Satz“, sagt sie. „Wenn wir da oben sind, wird es mich noch einmal benutzen. Schau mich an. Nicht das Funkgerät.“', 'brief', 'atem']);
      if (id === 'leuchtfeuer' && L.entscheidungen.nora === 'retten') L.szene.zeilen[1] = ['Es versucht es noch einmal', '„Wenn du gehst, bleibt sie hier.“ Nora steht neben dir. Sie nimmt deine Hand und schüttelt den Kopf. „Ich bin hier. Du weißt, wo ich bin.“ Vor euch wartet das letzte Schloss.', 'erzaehler', 'funk'];
    }
    function ende(geschafft, grund) {
      if (L.ende || gestoppt) return;
      aufheben(takt);
      const gerettet = L.entscheidungen.nora === 'retten', kopie = L.entscheidungen.kopie === 'sichern', still = L.entscheidungen.ausgang === 'stille';
      let titel, text, nach;
      if (!geschafft) { titel = 'Die nächste Nachtwache'; text = gerettet ? 'Nora ist bei dir, als das Leuchtfeuer erlischt. Unten springt die Tür zum Forsthaus auf. Ihr hört den Motor eures Wagens. Dann eure eigenen Schritte auf dem Kies – sie kommen auf euch zu.' : 'Die Straße verschwindet im Nebel. Auf dem Funkgerät erscheint eine neue Nachricht. Deine Stimme sagt: „Ich bin am alten Forsthaus. Nimm keinen anderen Weg.“'; nach = 'Am nächsten Morgen liegt auf dem Schreibtisch ein Foto von dir.'; }
      else if (still && gerettet) { titel = 'Zwei Menschen im Morgenlicht'; text = 'Du ziehst den letzten Stecker. Kein Abschiedsgruß. Kein neuer Ruf. Nur das Signallicht zeigt den Rettern den Weg. Nora lehnt schwer auf deiner Schulter. Am Waldrand dreht sie sich noch einmal um. „Jetzt“, sagt sie, „kennt er uns nicht mehr.“'; nach = kopie ? 'Die Kopie erreicht das Tal. Revier 17 bleibt geschlossen. Was dort geschehen ist, wird endlich untersucht.' : 'Das Band bleibt im Haus. Niemand glaubt euch die ganze Geschichte. Aber ihr seid beide hier.'; }
      else if (still) { titel = 'Ein Platz bleibt leer'; text = 'Du trennst den Funk und folgst dem Scheinwerfer ins Tal. Der Wald bleibt still. Am Rettungswagen fragt man, wo Nora ist. Zum ersten Mal an diesem Abend findest du keine Antwort.'; nach = 'Du hast den Kreis gebrochen. Aber du bist allein herausgekommen.'; }
      else { titel = gerettet ? 'Die Leitung bleibt offen' : 'Der Ruf ins Tal'; text = 'Du drückst die Sprechtaste. „Hier Revier 17.“ Die Leitstelle antwortet. Dahinter hörst du noch eine Stimme. Sie spricht deinen Satz mit. Eine Sekunde später. Auf der Straße unten gehen nacheinander die Laternen aus.'; nach = gerettet ? 'Ihr verlasst den Wald gemeinsam. Drei Nächte später klingelt Noras Telefon. Im Hintergrund: zweimal kurz, einmal lang.' : 'Die Rettung erreicht dich. Am nächsten Abend empfängt die Leitstelle Noras Stimme. Diesmal aus dem Tal.'; }
      if (kopie && !(geschafft && still && gerettet)) nach += geschafft ? ' Die gesicherte Kopie beweist, dass die Aufnahmen aus Revier 17 stammen.' : ' Bei der nächsten Suche findet man deine Kopie. Die Retter wissen jetzt, dass sie auf die Stimmen nicht antworten dürfen.';
      const nH = Object.values(L.hinweise).reduce((n, a) => n + a.length, 0);
      L.ende = { geschafft, grund: grund || '', zeit: Math.max(0, R.minuten * 60000 - rest()), hinweise: nH, geloest: Object.keys(L.geloest).length, stationen: 8,
        sterne: geschafft ? 1 + (nH <= 3 ? 1 : 0) + (gerettet && still ? 1 : 0) : 0, wort: G.wort,
        premium: { titel, text, nach, gerettet, kopie, still, entscheidungen: clone(L.entscheidungen) } };
      L.phase = 'ende'; senden({ typ: 'ende', ergebnis: clone(L.ende) });
      if (beiEnde) beiEnde(clone(L.ende));
    }
    function starten() { if (L.phase !== 'lobby' || gestoppt) return; L.phase = 'spiel'; L.start = jetzt(); szene('intro'); melden(); }
    function dazu(p) { if (gestoppt) return; if (!L.host) L.host = p.id; L.spieler.set(p.id, { id: p.id, name: String(p.name || 'Gast').slice(0, 24), da: true }); senden({ typ: 'raum', raum: R }, p.id); senden(stand(), p.id); if (L.ende) senden({ typ: 'ende', ergebnis: clone(L.ende) }, p.id); melden(); }
    function weg(p) { const x = L.spieler.get(p.id); if (x) x.da = false; melden(); }
    const antwort = (p, d, richtig, info = '') => senden({ typ: 'antwort', nr: d.nr, richtig, info }, p.id);
    const fehlerZeit = new Map();
    function eingang(p, d) {
      if (!d || typeof d !== 'object' || gestoppt || L.ende || !L.spieler.get(p.id)?.da) return;
      if (d.typ === 'premium_weiter') {
        if (p.id !== L.host || !L.szene || d.id !== L.szene.id) return;
        const art = L.szene.id.split(':')[0];
        L.pause += jetzt() - L.pausiert; L.pausiert = null; L.szene = null;
        if (art === 'frequenz') L.entscheidungen.funkOffen = true;
        melden(); return;
      }
      if (L.phase !== 'spiel' || L.szene) return antwort(p, d, false, 'Die Szene läuft noch.');
      if (rest() <= 0) return ende(false, 'zeit');
      if (d.typ === 'premium_lesen') {
        const id = d.objekt, o = OBJECTS[id];
        const ort = Object.keys(ORTE).find(x => ORTE[x].objekte.includes(id));
        if (!o || !ortOffen(ort)) return antwort(p, d, false, 'Dieser Ort ist noch nicht erreichbar.');
        if (id === 'nora' && !fertig('ventile')) return antwort(p, d, false, 'Das Gitter steht unter Druck. Entlaste zuerst den Steg.');
        if (!L.gelesen[id]) {
          L.gelesen[id] = true;
          if (o.item && !L.inventar.some(x => x.id === o.item[0])) L.inventar.push({ id: o.item[0], name: o.item[1], zeichen: o.item[2] });
          if (id === 'funknotiz') eintrag(o.name, `Grundträger ${(R.stationen.frequenz.p.basis / 10).toFixed(1)} MHz. Nachtschicht: +${(R.stationen.frequenz.p.delta / 10).toFixed(1)} MHz. Filter auf III. Die Nachtphase liegt dem Tag um eine halbe Umdrehung gegenüber. Tagesphase = 0. Tageskennung ${R.kennung}.`);
          else if (id === 'gravur') eintrag(o.name, `Leuchtfeuer: ${R.stationen.leuchtfeuer.p.gravur}. Nur ein stiller Träger führt zum Tal.`);
          else eintrag(o.name, o.notiz || o.text || '');
        }
        antwort(p, d, true); melden();
      } else if (d.typ === 'premium_wahl') {
        const { schluessel: k, wert: v } = d;
        const regeln = { funk: { werte: ['antworten', 'lauschen'], frei: fertig('frequenz') }, nora: { werte: ['retten', 'weiter'], frei: fertig('ventile') && L.gelesen.nora }, kopie: { werte: ['sichern', 'lassen'], frei: fertig('chronik') && L.gelesen.kopie }, ausgang: { werte: ['stille', 'senden'], frei: fertig('leuchtfeuer') } };
        const regel = regeln[k];
        if (!regel || !regel.frei || !regel.werte.includes(v)) return antwort(p, d, false, 'Diese Entscheidung ist noch nicht möglich.');
        const alt = L.entscheidungen[k];
        if (alt && !(k === 'nora' && alt === 'weiter' && v === 'retten')) return antwort(p, d, alt === v, 'Diese Entscheidung ist bereits gefallen.');
        L.entscheidungen[k] = v;
        if (k === 'nora' && v === 'retten') { L.strafe += 60; L.inventar.push({ id: 'nora', name: 'Nora ist bei dir', zeichen: '◉' }); eintrag('Du hilfst Nora', 'Du befreist ihren Fuß und bringst sie ins Forsthaus. Das kostet eine Minute. Ab jetzt geht ihr gemeinsam.', 'wahl'); }
        if (k === 'kopie' && v === 'sichern') { L.strafe += 45; L.inventar.push({ id: 'kopie', name: 'Gesichertes Beweisband', zeichen: '▣' }); eintrag('Die Sicherheitskopie', 'Du sicherst die Aufnahmen. 45 Sekunden. Die Geschichte kann den Wald mit euch verlassen.', 'wahl'); }
        if (k === 'funk') { eintrag('Deine erste Antwort', v === 'antworten' ? 'Du hast geantwortet. Im Wald gingen drei Lichter an. Sie kennen jetzt deine Stimme.' : 'Du hast nur zugehört. Im Rauschen war der Bach am Wehr zu hören.', 'wahl'); senden({ typ: 'premium_moment', art: v === 'antworten' ? 'antwort' : 'lauschen' }); }
        antwort(p, d, true); melden();
      } else if (d.typ === 'loesen') {
        const id = d.station, s = R.stationen[id];
        if (!s || !ortOffen(s.ortId)) return antwort(p, d, false, 'Dieser Ort ist noch nicht erreichbar.');
        if (fertig(id)) return antwort(p, d, true);
        if (fehlend(id)) return antwort(p, d, false, 'Dir fehlt noch eine Verbindung. Schau ins Einsatzbuch und untersuche die markierten Gegenstände.');
        const key = p.id + ':' + id, vorher = fehlerZeit.get(key) || -Infinity;
        if (jetzt() - vorher < 1400) return antwort(p, d, false, 'Der Mechanismus setzt sich zurück. Einen Moment.');
        const ok = Clavis.PremiumLogik.pruefen(id, s.p, G.stationen[id].loesung, d.antwort);
        if (!ok) { fehlerZeit.set(key, jetzt()); L.strafe += 12; antwort(p, d, false, 'Es passt noch nicht. Der Rückruf kostet 12 Sekunden.'); melden(); return; }
        L.geloest[id] = { von: p.id, name: p.name, zeit: jetzt() - L.start, belohnung: { art: 'fragment', stellen: [ORDER.indexOf(id)], buchstaben: [G.stationen[id].buchstabe] } };
        const fund = ({ strom: 'Das Netz trägt. Die Funkstube ist offen.', frequenz: 'Der stille Kanal ist gefunden. Du kannst entscheiden, ob du antwortest.', peilung: 'Beide Sichtlinien treffen sich bei D3: am alten Wehr.', ventile: 'Das Gitter öffnet sich. Du kannst zu Nora.', chronik: 'Der Notruf kam nach Noras Unfall. Die Stimme ist nicht Nora.', band: 'Nur die Aufnahmen mit Tageskennung und richtigem Klopfzeichen sind echt.', relais: 'Die Rufschleife ist gelöscht. Der Weg zum Feuerturm ist frei.', leuchtfeuer: 'Das Signal erreicht die Straße. Du hast alle Buchstaben.' })[id];
        eintrag(s.titel, fund, 'erkenntnis'); antwort(p, d, true); szene(id); melden();
      } else if (d.typ === 'hinweis') {
        const id = d.station, s = R.stationen[id];
        if (!s || fertig(id) || !ortOffen(s.ortId)) return;
        const h = L.hinweise[id] || (L.hinweise[id] = []);
        if (h.length >= R.hinweisAnzahl) return;
        const tips = hinweise(id, s.p, G.stationen[id].loesung);
        h.push(tips[h.length]); L.strafe += R.hinweisKosten; melden();
      } else if (d.typ === 'finale') {
        if (!ORDER.every(fertig) || !L.entscheidungen.ausgang) return antwort(p, d, false, 'Das Leuchtfeuer und deine letzte Entscheidung fehlen noch.');
        if (Clavis.norm(d.antwort) !== G.wort) return antwort(p, d, false, 'Die Fundstücke ergeben ein anderes Wort.');
        antwort(p, d, true); ende(true);
      }
    }
    takt = intervall(() => {
      if (L.phase !== 'spiel' || L.ende || L.szene || gestoppt) return;
      if (rest() <= 0) return ende(false, 'zeit');
      const anteil = 1 - rest() / (R.minuten * 60000);
      for (const [key, grenze, art] of [['ast', 0.18, 'ast'], ['fenster', 0.42, 'fenster'], ['ruf', 0.68, 'ruf'], ['morgen', 0.86, 'morgen']]) {
        if (anteil >= grenze && !L.ereignisse.has(key)) { L.ereignisse.add(key); senden({ typ: 'premium_moment', art }); }
      }
      melden();
    }, 2000);
    return { dazu, weg, starten, eingang, stand, beenden: geschafft => ende(!!geschafft, 'aufgegeben'), stoppen() { gestoppt = true; aufheben(takt); }, get phase() { return L.phase; }, get ende() { return L.ende; } };
  }
  function hinweise(id, p, l) {
    return ({
      strom: () => ['Das Dienstbuch nennt vier Bedingungen. Funk ist Pflicht; die Last muss exakt 12 A sein.', 'Funk + Flutlicht + Heizung wären 12 A, sind wegen der Rückleitung aber verboten.', 'Schalte Funk, Archiv und Pumpe ein. Alles andere bleibt aus.'],
      frequenz: () => ['Lies die Frequenztafel. Zehntel-MHz zählen mit. Eine halbe Umdrehung bedeutet 180° Gegenphase.', `Grundträger plus Nachtverschiebung: ${((p.basis + p.delta) / 10).toFixed(1)} MHz.`, `${(l.wert / 10).toFixed(1)} MHz · Filter III · Phase 180°.`],
      peilung: () => ['Ziehe vom Alten Turm A6 eine Linie nach Nordost und vom Grenzstein G6 eine nach Nordwest.', 'Beide Linien treffen sich oberhalb der Mitte.', 'Das gesuchte Feld ist D3.'],
      ventile: () => ['Der Ventilplan aus Noras Mantel beschreibt die Wirkung aller drei Räder.', 'Anzeige I = 2A + B. Anzeige II = 2B + C. Anzeige III = A + 2C.', `A = ${l[0]}, B = ${l[1]}, C = ${l[2]}.`],
      chronik: () => ['Rechne die Abweichung jeder Uhr heraus: Eine vorgehende Uhr zeigt zu viel an.', 'Die Abschaltung kam vor dem Unfall. Der Notruf kam erst danach.', l.map(i => p.karten[i].name).join(' → ')],
      band: () => ['Noras Notiz nennt zwei Echtheitsmerkmale. Beide müssen stimmen.', `Die Aufnahme muss mit ${p.kennung} anfangen und mit „zweimal kurz, einmal lang“ enden.`, 'Originale: ' + l.map(i => `Band ${i + 1}`).join(', ')],
      relais: () => ['Du kannst Züge zurücknehmen. Jede Taste zweimal zu drücken hebt beide Änderungen auf.', 'Das linke Feld reagiert im Kreuz, das rechte diagonal. Die Reihenfolge der Tasten ist egal.', 'Drücke ab dem Ausgangszustand: ' + l.map(i => `${Math.floor(i / 3) + 1}/${i % 3 + 1}`).join(', ') + '.'],
      leuchtfeuer: () => ['Die Gravur am Wehr nennt Beziehungen zwischen den vier Zeichen. Lege deine Aufzeichnungen daneben.', 'Suche zuerst das Paar, das unmittelbar aufeinander folgt. Die übrigen Regeln bestimmen Anfang und Ende.', l.map(i => p.namen[i]).join(' → ')],
    })[id]();
  }
  CLAVIS_VORLAGEN.unshift(VORLAGE);
  return { bauen, erstellen, VORLAGE };
})();
