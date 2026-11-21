'use strict';
/*
 * Justitia – Klassiker: geprüfte Übungsfälle mit Lösungsskizze, je Rechtsgebiet einer. Sie funktionieren ohne KI und
 * sind juristisch verlässlich; die Korrektur deiner Lösung misst sich an dieser Skizze.
 */
const KLASSIKER = [
  {
    gebiet: 'bgbat',
    titel: 'Das Taschengeld-Handy',
    fall: 'Die 15-jährige M kauft beim Händler V ein gebrauchtes Smartphone für 90 €. Sie bezahlt sofort bar mit Geld, das sie aus ihrem Taschengeld gespart hat. Ihre Eltern hatten ihr das Taschengeld zur freien Verfügung überlassen, wussten vom Kauf aber nichts. Als sie davon erfahren, sind sie verärgert und meinen, ein solcher Vertrag sei ohne ihre Zustimmung unwirksam.',
    frage: 'Ist zwischen M und V ein wirksamer Kaufvertrag über das Smartphone zustande gekommen?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Einigung durch Angebot und Annahme', norm: '§§ 145 ff., 433 BGB', definition: 'Ein Vertrag kommt durch zwei übereinstimmende, mit Bezug aufeinander abgegebene Willenserklärungen – Angebot und Annahme – zustande.', subsumtion: 'M und V haben sich über Kaufsache und Kaufpreis (90 €) geeinigt.' },
        { abschnitt: '2. Beschränkte Geschäftsfähigkeit der M', norm: '§§ 2, 106 BGB', definition: 'Minderjährige, die das siebente Lebensjahr vollendet haben, sind beschränkt geschäftsfähig.', subsumtion: 'M ist 15 Jahre alt und damit beschränkt geschäftsfähig.' },
        { abschnitt: '3. Kein lediglich rechtlicher Vorteil', norm: '§ 107 BGB', definition: 'Lediglich rechtlich vorteilhaft ist ein Geschäft, das dem Minderjährigen keine rechtlichen Pflichten auferlegt; auf wirtschaftliche Vorteile kommt es nicht an.', subsumtion: 'Der Kaufvertrag verpflichtet M zur Zahlung des Kaufpreises (§ 433 Abs. 2 BGB); er ist nicht lediglich rechtlich vorteilhaft. Eine Einwilligung der Eltern lag nicht vor, eine Genehmigung (§ 108 BGB) verweigern sie.' },
        { abschnitt: '4. Wirksamkeit nach dem Taschengeldparagrafen', norm: '§ 110 BGB', definition: 'Ein ohne Zustimmung geschlossener Vertrag gilt als von Anfang an wirksam, wenn der Minderjährige die vertragsmäßige Leistung mit Mitteln bewirkt, die ihm zu diesem Zweck oder zur freien Verfügung überlassen worden sind.', subsumtion: 'M hat den Kaufpreis vollständig und sofort mit Taschengeld bezahlt, das ihr zur freien Verfügung überlassen war. Damit gilt der Vertrag als von Anfang an wirksam; auf die Kenntnis der Eltern kommt es nicht an.' },
      ],
      schluss: 'Der Kaufvertrag zwischen M und V ist nach § 110 BGB wirksam.',
    },
  },
  {
    gebiet: 'schuldrecht',
    titel: 'Der streikende Akku',
    fall: 'K kauft als Verbraucherin beim Fahrradhändler V ein neues E-Bike für 2.400 €. Neun Tage nach der Übergabe fällt der Akku vollständig aus; ein Gutachter stellt einen Fertigungsfehler fest, der von Anfang an vorhanden war. K verlangt von V, den Akku zu ersetzen. V lehnt ab: K solle sich an den Hersteller wenden, er selbst habe das E-Bike ja nicht gebaut.',
    frage: 'Kann K von V die Lieferung eines neuen Akkus verlangen?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Wirksamer Kaufvertrag', norm: '§ 433 BGB', definition: 'Der Kaufvertrag verpflichtet den Verkäufer, die Sache frei von Sach- und Rechtsmängeln zu übergeben und zu übereignen.', subsumtion: 'K und V haben einen Kaufvertrag über das E-Bike geschlossen; Vertragspartner ist V, nicht der Hersteller.' },
        { abschnitt: '2. Sachmangel', norm: '§ 434 BGB', definition: 'Eine Sache ist mangelhaft, wenn sie bei Gefahrübergang nicht den subjektiven, objektiven oder Montageanforderungen entspricht – insbesondere wenn sie sich nicht für die gewöhnliche Verwendung eignet.', subsumtion: 'Ein E-Bike, dessen Akku nach neun Tagen ausfällt, eignet sich nicht für die gewöhnliche Verwendung.' },
        { abschnitt: '3. Mangel bei Gefahrübergang', norm: '§§ 446, 477 BGB', definition: 'Beim Verbrauchsgüterkauf wird vermutet, dass ein Mangel, der sich innerhalb eines Jahres seit Gefahrübergang zeigt, schon bei Gefahrübergang vorlag.', subsumtion: 'Der Fertigungsfehler bestand laut Gutachten von Anfang an; zudem greift die Vermutung, da er sich nach neun Tagen zeigte.' },
        { abschnitt: '4. Anspruch auf Nacherfüllung', norm: '§§ 437 Nr. 1, 439 Abs. 1 BGB', definition: 'Der Käufer kann als Nacherfüllung nach seiner Wahl die Beseitigung des Mangels oder die Lieferung einer mangelfreien Sache verlangen.', subsumtion: 'K wählt den Ersatz des Akkus. Der Verweis auf den Hersteller ist unbeachtlich; Schuldner der Nacherfüllung ist der Verkäufer V.' },
      ],
      schluss: 'K kann von V gemäß §§ 437 Nr. 1, 439 Abs. 1 BGB Nacherfüllung verlangen, also auch einen neuen Akku.',
    },
  },
  {
    gebiet: 'delikt',
    titel: 'Der Schuss ins Fenster',
    fall: 'Der 24-jährige A übt im Hinterhof Torschüsse. Obwohl er weiß, dass sich direkt hinter dem improvisierten Tor das Küchenfenster des Nachbarn N befindet, schießt er mit voller Kraft. Der Ball verfehlt das Tor und zerschlägt die Scheibe. Die Reparatur kostet 400 €.',
    frage: 'Hat N gegen A einen Anspruch auf Zahlung von 400 €?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Rechtsgutsverletzung', norm: '§ 823 Abs. 1 BGB', definition: 'Eigentum wird insbesondere durch eine Substanzverletzung der Sache verletzt.', subsumtion: 'Die Fensterscheibe im Eigentum des N wurde zerstört.' },
        { abschnitt: '2. Verletzungshandlung und haftungsbegründende Kausalität', norm: '§ 823 Abs. 1 BGB', definition: 'Ursächlich ist jede Handlung, die nicht hinweggedacht werden kann, ohne dass der Erfolg entfiele (Äquivalenz), und die nicht außerhalb aller Lebenserfahrung liegt (Adäquanz).', subsumtion: 'Ohne den Schuss wäre die Scheibe nicht zerbrochen; ein Fehlschuss ist auch nicht ungewöhnlich.' },
        { abschnitt: '3. Rechtswidrigkeit', norm: '§ 823 Abs. 1 BGB', definition: 'Die Rechtswidrigkeit wird durch die Rechtsgutsverletzung indiziert, sofern kein Rechtfertigungsgrund eingreift.', subsumtion: 'Rechtfertigungsgründe sind nicht ersichtlich.' },
        { abschnitt: '4. Verschulden', norm: '§ 276 Abs. 2 BGB', definition: 'Fahrlässig handelt, wer die im Verkehr erforderliche Sorgfalt außer Acht lässt.', subsumtion: 'A schoss in voller Kenntnis des dahinterliegenden Fensters mit voller Kraft; ein sorgfältiger Mensch hätte nicht in diese Richtung geschossen. A handelte fahrlässig.' },
        { abschnitt: '5. Schaden und Ersatz', norm: '§§ 249 Abs. 2 S. 1 BGB', definition: 'Bei Beschädigung einer Sache kann der Geschädigte statt der Herstellung den dazu erforderlichen Geldbetrag verlangen.', subsumtion: 'Die erforderlichen Reparaturkosten betragen 400 €.' },
      ],
      schluss: 'N hat gegen A einen Anspruch auf Zahlung von 400 € aus § 823 Abs. 1 BGB.',
    },
  },
  {
    gebiet: 'sachen',
    titel: 'Das verliehene Fahrrad',
    fall: 'E leiht seinem Bekannten B sein Rennrad für eine Woche. B gibt sich gegenüber D als Eigentümer aus und verkauft ihm das Rad für 600 €. D, der keinen Anlass zu Zweifeln hat, zahlt und nimmt das Rad mit. Als E davon erfährt, verlangt er das Rad von D heraus.',
    frage: 'Kann E von D die Herausgabe des Rennrads verlangen?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Anspruchsgrundlage', norm: '§ 985 BGB', definition: 'Der Eigentümer kann vom Besitzer die Herausgabe der Sache verlangen.', subsumtion: 'D ist Besitzer. Fraglich ist, ob E noch Eigentümer ist.' },
        { abschnitt: '2. Übereignung durch einen Nichtberechtigten', norm: '§ 929 S. 1 BGB', definition: 'Zur Übertragung des Eigentums an einer beweglichen Sache ist erforderlich, dass der Eigentümer die Sache dem Erwerber übergibt und beide sich über den Eigentumsübergang einig sind.', subsumtion: 'B und D haben sich geeinigt, das Rad wurde übergeben. B war aber nicht Eigentümer, also Nichtberechtigter.' },
        { abschnitt: '3. Gutgläubiger Erwerb', norm: '§ 932 BGB', definition: 'Der Erwerber wird auch dann Eigentümer, wenn die Sache nicht dem Veräußerer gehört, es sei denn, er ist nicht in gutem Glauben; das ist er, wenn ihm bekannt oder infolge grober Fahrlässigkeit unbekannt ist, dass die Sache nicht dem Veräußerer gehört.', subsumtion: 'D hatte keinen Anlass zu Zweifeln und war gutgläubig.' },
        { abschnitt: '4. Kein Abhandenkommen', norm: '§ 935 Abs. 1 BGB', definition: 'Abhandengekommen ist eine Sache, wenn der Eigentümer den unmittelbaren Besitz ohne seinen Willen verloren hat.', subsumtion: 'E hat das Rad freiwillig an B verliehen; es ist nicht abhandengekommen. D hat gutgläubig Eigentum erworben; E hat sein Eigentum verloren.' },
      ],
      schluss: 'E ist nicht mehr Eigentümer; ein Herausgabeanspruch aus § 985 BGB besteht nicht. (E bleiben Ansprüche gegen B, z. B. aus § 816 Abs. 1 S. 1 BGB auf den Erlös.)',
    },
  },
  {
    gebiet: 'strafat',
    titel: 'Der Angriff im Park',
    fall: 'O greift T im Park ohne Anlass mit Faustschlägen an. T, der nicht flüchten kann, stößt O mit beiden Händen kräftig von sich. O stürzt und zieht sich eine Prellung am Arm zu. Ein anderes Mittel, den Angriff sicher sofort zu beenden, hatte T nicht.',
    frage: 'Hat sich T wegen Körperverletzung (§ 223 Abs. 1 StGB) strafbar gemacht?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Objektiver Tatbestand', norm: '§ 223 Abs. 1 StGB', definition: 'Körperliche Misshandlung ist jede üble, unangemessene Behandlung, die das körperliche Wohlbefinden mehr als nur unerheblich beeinträchtigt; Gesundheitsschädigung ist das Hervorrufen oder Steigern eines pathologischen Zustands.', subsumtion: 'Die Prellung infolge des Stoßes ist eine Gesundheitsschädigung und körperliche Misshandlung.' },
        { abschnitt: '2. Subjektiver Tatbestand', norm: '§ 15 StGB', definition: 'Vorsatz ist das Wissen und Wollen der Tatbestandsverwirklichung; Eventualvorsatz genügt.', subsumtion: 'T stieß bewusst kräftig zu und nahm eine Verletzung zumindest billigend in Kauf.' },
        { abschnitt: '3. Rechtfertigung durch Notwehr – Notwehrlage', norm: '§ 32 Abs. 2 StGB', definition: 'Notwehrlage ist ein gegenwärtiger, rechtswidriger Angriff, also eine unmittelbar bevorstehende, gerade stattfindende oder noch andauernde Verletzung rechtlich geschützter Interessen durch menschliches Verhalten.', subsumtion: 'Die Faustschläge des O sind ein gegenwärtiger, rechtswidriger Angriff auf die körperliche Unversehrtheit des T.' },
        { abschnitt: '4. Notwehrhandlung und Verteidigungswille', norm: '§ 32 StGB', definition: 'Die Verteidigung muss erforderlich (geeignet und das relativ mildeste gleich wirksame Mittel) und geboten sein und mit Verteidigungswillen erfolgen.', subsumtion: 'Der Stoß war geeignet und das mildeste sicher wirksame Mittel; Einschränkungen der Gebotenheit liegen nicht vor. T handelte, um sich zu verteidigen.' },
      ],
      schluss: 'T hat den Tatbestand des § 223 Abs. 1 StGB verwirklicht, ist aber durch Notwehr (§ 32 StGB) gerechtfertigt und nicht strafbar.',
    },
  },
  {
    gebiet: 'strafbt',
    titel: 'Der Griff in die Kasse',
    fall: 'K arbeitet als Kellnerin im Restaurant des W. Die Kasse gehört W; K darf sie nur zum Kassieren und Wechseln öffnen. Am Abend nimmt K unbeobachtet 50 € aus der Kasse, um davon privat einzukaufen. Sie hat nicht vor, das Geld zurückzulegen.',
    frage: 'Hat sich K wegen Diebstahls (§ 242 Abs. 1 StGB) strafbar gemacht?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Fremde bewegliche Sache', norm: '§ 242 Abs. 1 StGB', definition: 'Fremd ist eine Sache, die zumindest auch im Eigentum eines anderen steht; beweglich ist sie, wenn sie tatsächlich fortgeschafft werden kann.', subsumtion: 'Das Geld in der Kasse steht im Eigentum des W und ist beweglich.' },
        { abschnitt: '2. Wegnahme', norm: '§ 242 Abs. 1 StGB', definition: 'Wegnahme ist der Bruch fremden und die Begründung neuen, nicht notwendig tätereigenen Gewahrsams; Gewahrsam ist die von einem Herrschaftswillen getragene tatsächliche Sachherrschaft nach der Verkehrsauffassung.', subsumtion: 'W hat übergeordneten Gewahrsam an der Kasse; K ist allenfalls Gewahrsamsdienerin. Indem sie das Geld ohne Einverständnis des W an sich nimmt, bricht sie dessen Gewahrsam und begründet eigenen.' },
        { abschnitt: '3. Vorsatz', norm: '§ 15 StGB', definition: 'Vorsatz ist das Wissen und Wollen aller objektiven Tatumstände.', subsumtion: 'K wusste, dass das Geld W gehört und er nicht einverstanden ist.' },
        { abschnitt: '4. Zueignungsabsicht', norm: '§ 242 Abs. 1 StGB', definition: 'Zueignungsabsicht verlangt die Absicht, sich die Sache zumindest vorübergehend anzueignen, und den Vorsatz, den Eigentümer dauerhaft aus seiner Position zu verdrängen; die erstrebte Zueignung muss rechtswidrig sein.', subsumtion: 'K will das Geld für sich ausgeben und nicht zurücklegen; einen fälligen Anspruch auf das Geld hat sie nicht.' },
      ],
      schluss: 'K hat sich wegen Diebstahls nach § 242 Abs. 1 StGB strafbar gemacht (eine mitverwirklichte Unterschlagung tritt zurück, § 246 Abs. 1 StGB).',
    },
  },
  {
    gebiet: 'grundrechte',
    titel: 'Die verbotene Demo',
    fall: 'Die Studentin S meldet für Samstag eine friedliche Demonstration für mehr Klimaschutz in der Innenstadt an; erwartet werden 300 Teilnehmende. Die Versammlungsbehörde verbietet die Versammlung vollständig mit der Begründung, sie störe den Einkaufsverkehr. Andere Gefahren sind nicht ersichtlich.',
    frage: 'Verletzt das Verbot S in ihrem Grundrecht aus Art. 8 Abs. 1 GG?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Schutzbereich', norm: 'Art. 8 Abs. 1 GG', definition: 'Versammlung ist eine örtliche Zusammenkunft mehrerer Personen zur gemeinschaftlichen, auf die Teilnahme an der öffentlichen Meinungsbildung gerichteten Erörterung oder Kundgebung; geschützt sind Deutsche, die sich friedlich und ohne Waffen versammeln.', subsumtion: 'Die geplante Klima-Demonstration ist eine friedliche Versammlung; S ist als Veranstalterin geschützt.' },
        { abschnitt: '2. Eingriff', norm: 'Art. 8 Abs. 1 GG', definition: 'Ein Eingriff ist jedes staatliche Handeln, das die Ausübung des Grundrechts ganz oder teilweise unmöglich macht.', subsumtion: 'Das vollständige Verbot macht die Versammlung unmöglich.' },
        { abschnitt: '3. Schranke', norm: 'Art. 8 Abs. 2 GG i. V. m. Versammlungsgesetz', definition: 'Versammlungen unter freiem Himmel können durch Gesetz oder aufgrund eines Gesetzes beschränkt werden; ein Verbot setzt eine unmittelbare Gefährdung der öffentlichen Sicherheit oder Ordnung voraus.', subsumtion: 'Bloße Störungen des Einkaufsverkehrs sind keine unmittelbare Gefahr für die öffentliche Sicherheit; zudem sind Belästigungen Dritter hinzunehmen.' },
        { abschnitt: '4. Verhältnismäßigkeit', norm: 'Rechtsstaatsprinzip, Art. 20 Abs. 3 GG', definition: 'Ein Eingriff muss einen legitimen Zweck verfolgen und geeignet, erforderlich und angemessen sein.', subsumtion: 'Selbst wenn der Verkehr geschützt werden soll, wären Auflagen (Route, Zeit) ein milderes, gleich wirksames Mittel. Das Totalverbot ist nicht erforderlich.' },
      ],
      schluss: 'Das Verbot ist nicht gerechtfertigt; S ist in ihrem Grundrecht aus Art. 8 Abs. 1 GG verletzt.',
    },
  },
  {
    gebiet: 'verwaltung',
    titel: 'Der Bescheid ohne Anhörung',
    fall: 'Die Stadt untersagt dem Imbissbetreiber B durch schriftlichen Bescheid, seine Tische weiterhin auf dem Gehweg aufzustellen. Vorher wurde B nicht angehört. B legt fristgerecht Widerspruch ein; dieser wird ohne Begründung zurückgewiesen. B möchte nun vor Gericht gegen den Bescheid vorgehen.',
    frage: 'Ist eine Anfechtungsklage des B zulässig?',
    loesung: {
      aufbau: [
        { abschnitt: '1. Verwaltungsrechtsweg', norm: '§ 40 Abs. 1 S. 1 VwGO', definition: 'Der Verwaltungsrechtsweg ist in allen öffentlich-rechtlichen Streitigkeiten nichtverfassungsrechtlicher Art eröffnet, soweit keine abdrängende Sonderzuweisung besteht.', subsumtion: 'Die Untersagung beruht auf Normen des Straßen- und Wegerechts, die einen Hoheitsträger berechtigen; es geht nicht um Verfassungsrecht.' },
        { abschnitt: '2. Statthafte Klageart', norm: '§ 42 Abs. 1 Alt. 1 VwGO, § 35 S. 1 VwVfG', definition: 'Die Anfechtungsklage ist statthaft, wenn der Kläger die Aufhebung eines Verwaltungsakts begehrt; ein Verwaltungsakt ist jede hoheitliche Maßnahme einer Behörde zur Regelung eines Einzelfalls auf dem Gebiet des öffentlichen Rechts mit unmittelbarer Außenwirkung.', subsumtion: 'Die Untersagung regelt verbindlich das Verhalten des B im Einzelfall; sie ist ein Verwaltungsakt.' },
        { abschnitt: '3. Klagebefugnis', norm: '§ 42 Abs. 2 VwGO', definition: 'Der Kläger muss geltend machen, durch den Verwaltungsakt in seinen Rechten verletzt zu sein; beim Adressaten eines belastenden Verwaltungsakts genügt das (Adressatentheorie).', subsumtion: 'B ist Adressat eines belastenden Bescheids; eine Verletzung jedenfalls seiner allgemeinen Handlungs- bzw. Berufsfreiheit ist möglich.' },
        { abschnitt: '4. Vorverfahren und Frist', norm: '§§ 68, 74 Abs. 1 VwGO', definition: 'Vor der Anfechtungsklage ist grundsätzlich ein Widerspruchsverfahren durchzuführen; die Klage ist innerhalb eines Monats nach Zustellung des Widerspruchsbescheids zu erheben.', subsumtion: 'Das Widerspruchsverfahren ist durchgeführt; B muss die Monatsfrist ab Zustellung wahren.' },
      ],
      schluss: 'Die Anfechtungsklage ist zulässig, wenn B sie fristgerecht erhebt. (In der Begründetheit wäre die fehlende Anhörung nach § 28 Abs. 1 VwVfG zu prüfen – heilbar nach § 45 Abs. 1 Nr. 3, Abs. 2 VwVfG.)',
    },
  },
];
