'use strict';
/*
 * Launchpad – Gründungs-Lotse (lädt nach app.js). Führt durch die Behördengänge einer Gründung in Deutschland:
 * Steckbrief → Fahrplan aus einem kuratierten Katalog (passend zu Rechtsform, Tätigkeit, Start, Mitarbeitenden) →
 * Fristen ab dem Startdatum, Unterlagen, Kosten, offizielle Portale → Launchpad bereitet vor (Ausfüllhilfen, Entwürfe,
 * Anschreiben als Dateien im Arbeitsbereich) → DU reichst ein. Launchpad schickt nichts an Behörden: Plugins haben kein
 * Internet, und Anträge brauchen deine Identität (ELSTER-Zertifikat, Unterschrift, Notar). Keine Rechts- oder Steuerberatung.
 */

Object.assign(ICONS, {
  behoerde: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
});

const RECHTSFORMEN = {
  einzel: ['Einzelunternehmen', 'Gewerbe allein, volle Haftung, unkompliziert'],
  freiberuf: ['Freiberufler:in', 'z. B. Design, Beratung, IT, Lehre – kein Gewerbe'],
  gbr: ['GbR', 'Mehrere Gründer:innen, ohne Mindestkapital'],
  ug: ['UG (haftungsbeschränkt)', 'Kapitalgesellschaft ab 1 € Stammkapital, Notar nötig'],
  gmbh: ['GmbH', 'Kapitalgesellschaft, 25.000 € Stammkapital, Notar nötig'],
  unsicher: ['Noch unsicher', 'Launchpad hilft bei der Entscheidung'],
};
const GEWERBLICH = ['einzel', 'gbr', 'ug', 'gmbh', 'unsicher'];
const KAPITAL = ['ug', 'gmbh'];
const BUNDESLAENDER = ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'];
const G_STATUS = { offen: ['Offen', 'grau'], vorbereitet: ['Vorbereitet', 'blau'], eingereicht: ['Eingereicht', 'lila'], erledigt: ['Erledigt', 'gruen'], entfaellt: ['Entfällt', 'grau'] };

/** Kuratierter Katalog der üblichen Schritte. `gilt(s)` entscheidet je Steckbrief; `tage` relativ zum Start (negativ = vorher). */
const KATALOG = [
  { id: 'rechtsform', titel: 'Rechtsform festlegen', behoerde: 'Du (ggf. mit IHK-Gründungsberatung)', tage: -42, kosten: 'kostenlos', online: false, gilt: (s) => s.rechtsform === 'unsicher',
    beschreibung: 'Die Rechtsform bestimmt Haftung, Kosten, Steuern und welche Behördengänge nötig sind.', unterlagen: ['Geschäftsidee', 'Grobe Umsatz- und Kostenschätzung'],
    vorbereitung: 'Eine Entscheidungshilfe: Vergleich der passenden Rechtsformen für diesen Fall (Haftung, Gründungskosten, laufender Aufwand, Steuern, Außenwirkung) mit klarer Empfehlung und Begründung.', link: 'https://www.existenzgruender.de' },
  { id: 'foerderung', titel: 'Förderung prüfen (vor dem Start!)', behoerde: 'Agentur für Arbeit, KfW, Förderbanken', tage: -35, kosten: 'kostenlos', online: true, gilt: () => true,
    beschreibung: 'Manche Förderungen (z. B. der Gründungszuschuss der Agentur für Arbeit) müssen vor dem Start beantragt werden. Auch Gründerstipendien, KfW-Kredite und Programme der Länder prüfen.', unterlagen: ['Businessplan', 'Finanzplan', 'ggf. Stellungnahme einer fachkundigen Stelle'],
    vorbereitung: 'Eine Übersicht der Förderungen, die für diesen Fall in Frage kommen, mit Voraussetzungen, Antragszeitpunkt und Ansprechstelle – und was dafür vorbereitet werden muss.', link: 'https://www.foerderdatenbank.de' },
  { id: 'nebenberuf', titel: 'Nebentätigkeit mit Arbeitgeber bzw. Hochschule klären', behoerde: 'Arbeitgeber, ggf. BAföG-Amt', tage: -28, kosten: 'kostenlos', online: false, gilt: (s) => s.nebenberuflich,
    beschreibung: 'Bei einer Gründung neben Job oder Studium: Arbeitsvertrag prüfen (Nebentätigkeit anzeigen), Auswirkungen auf BAföG, Familienversicherung und Studierendenstatus klären.', unterlagen: ['Arbeitsvertrag', 'ggf. BAföG-Bescheid'],
    vorbereitung: 'Ein höfliches Schreiben an den Arbeitgeber, das die geplante Nebentätigkeit anzeigt, plus eine Checkliste, was bei Krankenversicherung und BAföG zu prüfen ist.' },
  { id: 'name', titel: 'Namen prüfen: Marken und Domain', behoerde: 'DPMA (Markenregister)', tage: -28, kosten: 'Recherche kostenlos', online: true, gilt: () => true,
    beschreibung: 'Vor Logo, Website und Anmeldung prüfen, ob der Name als Marke geschützt oder schon belegt ist.', unterlagen: ['Wunschname und Alternativen'],
    vorbereitung: 'Eine Checkliste für die Namensprüfung (Markenregister, Handelsregister, Domain, Social Media) mit Suchbegriffen für diesen Namen.', link: 'https://register.dpma.de' },
  { id: 'erlaubnis', titel: 'Erlaubnisse und Genehmigungen prüfen', behoerde: 'Gewerbeamt, IHK oder Handwerkskammer', tage: -21, kosten: 'je nach Erlaubnis', online: false, gilt: (s) => s.rechtsform !== 'freiberuf',
    beschreibung: 'Manche Tätigkeiten brauchen vor dem Start eine Erlaubnis oder Eintragung (z. B. Gastronomie, Handwerk, Bewachung, Finanzvermittlung, Lebensmittel).', unterlagen: ['Tätigkeitsbeschreibung', 'ggf. Qualifikationsnachweise'],
    vorbereitung: 'Eine Prüfliste, welche Erlaubnisse, Nachweise oder Eintragungen für genau diese Tätigkeit nötig sein könnten, und wo man das verbindlich klärt.' },
  { id: 'businessplan', titel: 'Businessplan und Finanzplan', behoerde: 'Du (für Bank, Förderung, Notar)', tage: -21, kosten: 'kostenlos', online: false, gilt: () => true,
    beschreibung: 'Für Förderung, Kredit und die eigene Klarheit: Geschäftsmodell, Markt, Marketing, Kosten, Umsatz- und Liquiditätsplanung.', unterlagen: ['Kosten- und Preisannahmen'],
    vorbereitung: 'Eine Gliederung für den Businessplan mit den Kernaussagen zu diesem Vorhaben und einer einfachen Tabelle für Kosten, Umsatz und Liquidität der ersten 12 Monate (mit Platzhaltern).' },
  { id: 'konto', titel: 'Geschäftskonto eröffnen', behoerde: 'Bank deiner Wahl', tage: -14, kosten: 'je nach Bank', online: true, gilt: () => true,
    beschreibung: 'Bei UG und GmbH Pflicht (Stammkapital). Sonst sehr empfohlen, um Privates und Geschäftliches zu trennen.', unterlagen: ['Ausweis', 'bei UG/GmbH: notarielle Urkunde'],
    vorbereitung: null },
  { id: 'notar', titel: 'Notartermin: Gesellschaftsvertrag bzw. Musterprotokoll', behoerde: 'Notar:in', tage: -14, kosten: 'einige hundert Euro (je nach Stammkapital und Umfang)', online: false, gilt: (s) => KAPITAL.includes(s.rechtsform),
    beschreibung: 'Die Gründung einer UG oder GmbH wird notariell beurkundet; für einfache Fälle gibt es das günstigere Musterprotokoll.', unterlagen: ['Ausweise aller Gesellschafter:innen', 'Firmenname', 'Sitz', 'Unternehmensgegenstand', 'Stammkapital und Anteile', 'Geschäftsführung'],
    vorbereitung: 'Eine Checkliste mit allen Angaben, die der Notar braucht (Firma, Sitz, Unternehmensgegenstand als präzise Formulierung, Stammkapital, Anteile, Geschäftsführung), mit Formulierungsvorschlägen und [Platzhaltern].' },
  { id: 'stammkapital', titel: 'Stammkapital einzahlen', behoerde: 'Bank', tage: -10, kosten: 'UG ab 1 €, GmbH mind. 12.500 € bei Gründung', online: true, gilt: (s) => KAPITAL.includes(s.rechtsform),
    beschreibung: 'Nach dem Notartermin wird das Stammkapital auf das Geschäftskonto eingezahlt; der Nachweis geht an den Notar.', unterlagen: ['Kontoauszug als Einzahlungsnachweis'], vorbereitung: null },
  { id: 'handelsregister', titel: 'Eintragung ins Handelsregister', behoerde: 'Amtsgericht (über den Notar)', tage: -7, kosten: 'Gerichts- und Notarkosten', online: false, gilt: (s) => KAPITAL.includes(s.rechtsform),
    beschreibung: 'Der Notar meldet die Gesellschaft zum Handelsregister an. Erst mit der Eintragung entsteht die UG bzw. GmbH als solche.', unterlagen: ['Einzahlungsnachweis'], vorbereitung: null, link: 'https://www.handelsregister.de' },
  { id: 'gewerbe', titel: 'Gewerbe anmelden', behoerde: 'Gewerbeamt deiner Gemeinde', tage: -3, kosten: 'meist ca. 15–65 € (je nach Gemeinde)', online: true, gilt: (s) => GEWERBLICH.includes(s.rechtsform),
    beschreibung: 'Spätestens zum Start der Tätigkeit. Viele Gemeinden bieten die Anmeldung online an. Das Gewerbeamt informiert Finanzamt, IHK bzw. HWK und weitere Stellen.', unterlagen: ['Ausweis', 'ggf. Handelsregisterauszug', 'ggf. Erlaubnisse'],
    vorbereitung: 'Eine Ausfüllhilfe für die Gewerbeanmeldung: Feld für Feld, was einzutragen ist – vor allem eine präzise, aber ausreichend weite Tätigkeitsbeschreibung (2–3 Varianten) – persönliche Daten als [Platzhalter].', link: 'https://www.existenzgruender.de' },
  { id: 'versicherung', titel: 'Betriebliche Versicherungen prüfen', behoerde: 'Versicherer, ggf. Verbraucherzentrale', tage: -3, kosten: 'je nach Risiko', online: false, gilt: () => true,
    beschreibung: 'Z. B. Betriebs- oder Berufshaftpflicht, bei Bedarf Inhalts- oder Rechtsschutzversicherung.', unterlagen: [], vorbereitung: 'Eine Checkliste, welche Versicherungen für diese Tätigkeit wichtig, sinnvoll oder meist unnötig sind – mit Fragen, die man Anbietern stellen sollte.' },
  { id: 'rechnung', titel: 'Rechnungsvorlage mit Pflichtangaben', behoerde: 'Du', tage: 0, kosten: 'kostenlos', online: false, gilt: () => true,
    beschreibung: 'Vor der ersten Rechnung: Vorlage mit allen Pflichtangaben (Name und Anschrift, Steuernummer oder USt-ID, Rechnungsnummer, Datum, Leistung, Entgelt, Steuersatz bzw. Hinweis auf die Kleinunternehmerregelung).', unterlagen: ['Steuernummer (kommt vom Finanzamt)'],
    vorbereitung: 'Eine fertige Rechnungsvorlage in Markdown mit allen Pflichtangaben als [Platzhalter], passend zur Rechtsform und zur Umsatzsteuer-Frage (Kleinunternehmerregelung ja/nein).' },
  { id: 'impressum', titel: 'Impressum und Datenschutzerklärung', behoerde: 'Du (Website, Social Media)', tage: 0, kosten: 'kostenlos (Generatoren) bis Anwalt', online: false, gilt: (s) => s.website,
    beschreibung: 'Geschäftliche Websites und Profile brauchen ein Impressum; sobald Daten verarbeitet werden, eine Datenschutzerklärung.', unterlagen: [],
    vorbereitung: 'Einen Impressum-Entwurf passend zur Rechtsform mit [Platzhaltern] und eine Liste, was die Datenschutzerklärung abdecken muss (keine vollständige Rechtsberatung).' },
  { id: 'kleinunternehmer', titel: 'Kleinunternehmerregelung entscheiden', behoerde: 'Finanzamt (im Fragebogen)', tage: 20, kosten: 'kostenlos', online: true, gilt: () => true,
    beschreibung: 'Bei geringem Umsatz kann man auf die Umsatzsteuer verzichten (§ 19 UStG) – dann aber auch keine Vorsteuer ziehen. Die Entscheidung trifft man im Fragebogen zur steuerlichen Erfassung; die aktuellen Umsatzgrenzen beim Finanzamt prüfen.', unterlagen: ['Umsatzschätzung für dieses und nächstes Jahr'],
    vorbereitung: 'Eine Entscheidungshilfe zur Kleinunternehmerregelung für diesen Fall: Vor- und Nachteile, Rechenbeispiel mit der Umsatzschätzung, Hinweis, die aktuellen Grenzen zu prüfen.' },
  { id: 'finanzamt', titel: 'Fragebogen zur steuerlichen Erfassung (ELSTER)', behoerde: 'Finanzamt (online über ELSTER)', tage: 28, kosten: 'kostenlos', online: true, gilt: () => true,
    beschreibung: 'Innerhalb eines Monats nach Beginn der Tätigkeit online über „Mein ELSTER“ abgeben. Danach kommt die Steuernummer. Für ELSTER braucht es ein Benutzerkonto (Aktivierung per Brief dauert einige Tage).', unterlagen: ['ELSTER-Zugang', 'Steuer-ID', 'Bankverbindung', 'Umsatz- und Gewinnschätzung', 'Start-Datum'],
    vorbereitung: 'Eine Ausfüllhilfe für den Fragebogen zur steuerlichen Erfassung: Abschnitt für Abschnitt, was einzutragen ist und welche Wahl hier passt (Gewinnermittlung, Umsatz- und Gewinnschätzung, Kleinunternehmerregelung, Voranmeldungszeitraum) – persönliche Daten als [Platzhalter].', link: 'https://www.elster.de' },
  { id: 'ihk', titel: 'IHK bzw. Handwerkskammer', behoerde: 'IHK oder HWK', tage: 30, kosten: 'Mitgliedsbeitrag je nach Gewinn (oft gering am Anfang)', online: false, gilt: (s) => GEWERBLICH.includes(s.rechtsform),
    beschreibung: 'Gewerbetreibende werden mit der Gewerbeanmeldung automatisch Mitglied der IHK (Handwerk: Handwerkskammer, dort ggf. Eintragung in die Handwerksrolle vor dem Start). Meist kommt ein Schreiben – reagieren und Angaben prüfen.', unterlagen: [], vorbereitung: null, link: 'https://www.ihk.de' },
  { id: 'bg', titel: 'Bei der Berufsgenossenschaft melden', behoerde: 'Zuständige Berufsgenossenschaft', tage: 7, kosten: 'Beitrag je nach Branche und Lohnsumme', online: true, gilt: (s) => s.rechtsform !== 'freiberuf' || s.mitarbeiter,
    beschreibung: 'Unternehmen müssen sich innerhalb einer Woche bei der zuständigen Berufsgenossenschaft (gesetzliche Unfallversicherung) melden; mit Mitarbeitenden ist sie immer Pflicht.', unterlagen: ['Gewerbeanmeldung', 'Angaben zu Tätigkeit und Mitarbeitenden'],
    vorbereitung: 'Ein kurzes Anschreiben zur Anmeldung bei der Berufsgenossenschaft mit allen nötigen Angaben als [Platzhalter] und dem Hinweis, wie man die zuständige BG findet.', link: 'https://www.dguv.de' },
  { id: 'betriebsnummer', titel: 'Betriebsnummer beantragen', behoerde: 'Bundesagentur für Arbeit (Betriebsnummern-Service)', tage: 0, kosten: 'kostenlos', online: true, gilt: (s) => s.mitarbeiter,
    beschreibung: 'Vor der ersten Anmeldung von Mitarbeitenden bei der Sozialversicherung.', unterlagen: ['Angaben zum Betrieb'], vorbereitung: null, link: 'https://www.arbeitsagentur.de/unternehmen/betriebsnummern-service' },
  { id: 'kv', titel: 'Kranken- und Pflegeversicherung klären', behoerde: 'Deine Krankenkasse', tage: 14, kosten: 'je nach Einkommen', online: false, gilt: (s) => !s.nebenberuflich,
    beschreibung: 'Hauptberuflich Selbstständige müssen sich selbst versichern – die Krankenkasse über die Selbstständigkeit informieren und den Beitrag festlegen lassen.', unterlagen: ['Einkommensschätzung'],
    vorbereitung: 'Eine Nachricht an die Krankenkasse, die die Selbstständigkeit meldet, und eine Liste der Fragen, die geklärt werden sollten.' },
  { id: 'rv', titel: 'Rentenversicherungspflicht prüfen', behoerde: 'Deutsche Rentenversicherung', tage: 60, kosten: 'kostenlos (Prüfung)', online: true, gilt: () => true,
    beschreibung: 'Manche Selbstständige sind rentenversicherungspflichtig (z. B. Lehrende, Pflege, Handwerk, Selbstständige mit einem Auftraggeber) und müssen sich dann innerhalb von drei Monaten melden.', unterlagen: [],
    vorbereitung: 'Eine Prüfliste, ob diese Tätigkeit rentenversicherungspflichtig sein könnte, und was dann zu tun ist.', link: 'https://www.deutsche-rentenversicherung.de' },
  { id: 'transparenz', titel: 'Transparenzregister prüfen', behoerde: 'Transparenzregister', tage: 30, kosten: 'kostenlos bis geringe Gebühr', online: true, gilt: (s) => KAPITAL.includes(s.rechtsform) || s.rechtsform === 'gbr',
    beschreibung: 'Gesellschaften müssen ihre wirtschaftlich Berechtigten unter Umständen ins Transparenzregister eintragen – beim Notar bzw. auf der Website nachfragen, ob das nötig ist.', unterlagen: ['Gesellschafterliste'], vorbereitung: null, link: 'https://www.transparenzregister.de' },
  { id: 'buchhaltung', titel: 'Buchhaltung einrichten', behoerde: 'Du (ggf. Steuerberater:in)', tage: 14, kosten: 'Software oder Steuerberatung', online: false, gilt: () => true,
    beschreibung: 'Belege sammeln und aufbewahren; Gewinnermittlung meist per Einnahmen-Überschuss-Rechnung (UG/GmbH: Bilanz). Bei Umsatzsteuerpflicht: Voranmeldungen über ELSTER.', unterlagen: [],
    vorbereitung: 'Eine Checkliste für die Buchhaltung dieser Rechtsform: Belege, Fristen, Aufbewahrung, Werkzeuge – und eine einfache Einnahmen-Ausgaben-Tabelle als CSV-Vorlage im Text.' },
];

/** Geprüfte Grundfakten je Schritt – die KI darf sich bei Rechtlichem und Steuerlichem nur darauf stützen. */
const FAKTEN = {
  rechtsform: 'Einzelunternehmen und Freiberuf: keine Mindesteinlage, volle persönliche Haftung, wenig Aufwand. GbR: zwei oder mehr Personen, alle haften persönlich. UG (haftungsbeschränkt): ab 1 € Stammkapital, Haftung auf das Gesellschaftsvermögen beschränkt, Notar nötig, 25 % des Jahresüberschusses müssen als Rücklage bleiben, Bilanzierung. GmbH: 25.000 € Stammkapital (mindestens 12.500 € bei Gründung eingezahlt), Notar, Bilanzierung.',
  finanzamt: 'Abgabe online über „Mein ELSTER“ innerhalb eines Monats nach Beginn der Tätigkeit; für ELSTER braucht es ein Benutzerkonto, dessen Aktivierung per Brief einige Tage dauert. Freiberufler:innen und kleine Gewerbetreibende ermitteln den Gewinn in der Regel per Einnahmen-Überschuss-Rechnung (EÜR); UG und GmbH bilanzieren. Im Fragebogen werden Umsatz und Gewinn für das Gründungs- und das Folgejahr geschätzt (danach richten sich Vorauszahlungen – realistisch schätzen). Ebenfalls im Fragebogen wird entschieden, ob die Kleinunternehmerregelung (§ 19 UStG) genutzt wird; für Neugründungen ist sie grundsätzlich möglich, wenn der Umsatz unter den aktuellen Grenzen bleibt – die Grenzen beim Finanzamt prüfen. Danach teilt das Finanzamt die Steuernummer mit.',
  kleinunternehmer: 'Kleinunternehmer:innen weisen keine Umsatzsteuer aus und können keine Vorsteuer abziehen; auf Rechnungen steht ein Hinweis auf die Steuerbefreiung nach § 19 UStG. Die Umsatzgrenzen wurden zuletzt geändert – die aktuellen Werte beim Finanzamt oder beim Bundesfinanzministerium prüfen. Wer vor allem an Unternehmen verkauft oder hohe Anfangsinvestitionen hat, kann von der Regelbesteuerung profitieren; an den Verzicht auf die Kleinunternehmerregelung ist man mehrere (in der Regel fünf) Jahre gebunden.',
  gewerbe: 'Freiberufler:innen melden kein Gewerbe an. Die Anmeldung erfolgt beim Gewerbeamt der Gemeinde des Betriebssitzes, spätestens mit Beginn der Tätigkeit; viele Gemeinden bieten sie online an. Die Tätigkeitsbeschreibung sollte präzise sein und absehbare Erweiterungen mit abdecken. Das Gewerbeamt informiert Finanzamt und Kammer.',
  rechnung: 'Pflichtangaben einer Rechnung: vollständiger Name und Anschrift von Leistendem und Empfänger, Steuernummer oder USt-IdNr., Ausstellungsdatum, fortlaufende Rechnungsnummer, Menge und Art der Leistung, Zeitpunkt der Leistung, Nettoentgelt, Steuersatz und Steuerbetrag – oder ein Hinweis auf die Steuerbefreiung (z. B. § 19 UStG). Für Rechnungen an Unternehmen gelten schrittweise Pflichten zur elektronischen Rechnung (E-Rechnung) – aktuellen Stand prüfen.',
  impressum: 'Impressum nach § 5 Digitale-Dienste-Gesetz (DDG): Name und ladungsfähige Anschrift (kein Postfach), E-Mail und eine weitere schnelle Kontaktmöglichkeit, ggf. USt-IdNr.; bei Gesellschaften zusätzlich Rechtsform, Vertretungsberechtigte, Registergericht und Registernummer; bei reglementierten Berufen Kammer und Berufsbezeichnung. Eine Datenschutzerklärung ist nötig, sobald personenbezogene Daten verarbeitet werden (z. B. Kontaktformular, Hosting-Logs, Analyse).',
  bg: 'Unternehmen melden sich innerhalb einer Woche nach Eröffnung bei der zuständigen Berufsgenossenschaft (gesetzliche Unfallversicherung). Für Mitarbeitende besteht Versicherungsschutz und Beitragspflicht; ob Unternehmer:innen selbst pflicht- oder freiwillig versichert sind, hängt von der Berufsgenossenschaft ab.',
  rv: 'Bestimmte Selbstständige sind rentenversicherungspflichtig, u. a. Lehrende und Erziehende ohne versicherungspflichtige Angestellte, Pflegepersonen, Hebammen, in der Handwerksrolle eingetragene Handwerker:innen und Selbstständige mit im Wesentlichen nur einem Auftraggeber. Sie müssen sich innerhalb von drei Monaten nach Beginn bei der Deutschen Rentenversicherung melden. Alle anderen können sich freiwillig versichern.',
  foerderung: 'Der Gründungszuschuss der Agentur für Arbeit muss vor dem Start der Selbstständigkeit beantragt werden und setzt u. a. einen Anspruch auf Arbeitslosengeld voraus; es besteht kein Rechtsanspruch. Weitere Quellen: KfW-Programme, Förderbanken der Länder, Gründerstipendien von Hochschulen und Ländern; die Förderdatenbank des Bundes listet Programme.',
  nebenberuf: 'Eine Nebentätigkeit muss man dem Arbeitgeber in der Regel anzeigen, wenn der Arbeitsvertrag das verlangt; verbieten darf er sie nur bei berechtigtem Interesse. Beim BAföG wird Einkommen angerechnet, bei der Familienversicherung gelten Einkommensgrenzen – jeweils bei der zuständigen Stelle prüfen.',
};

z.gSteckbriefOffen = false;
z.gOffen = null;

function gruendungAktiv(p) { return !!(p && p.gruendung); }
const gStart = (g) => (isoGueltig(g.steckbrief.start) ? g.steckbrief.start : heuteIso());
function gDatum(g, s) {
  const d = new Date(gStart(g) + 'T12:00:00');
  d.setDate(d.getDate() + (s.tage || 0));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Vor dem Start ist nichts „überfällig“ – was eigentlich schon früher dran gewesen wäre, ist jetzt einfach sofort dran
  return iso < heuteIso() && gStart(g) > heuteIso() ? heuteIso() : iso;
}
const gSofort = (g, s) => gStart(g) > heuteIso() && gDatum(g, s) === heuteIso() && (s.tage || 0) < 0;

function fahrplanBauen(steckbrief, alt = []) {
  return KATALOG.filter((k) => k.gilt(steckbrief)).map((k) => {
    const vorher = alt.find((x) => x.id === k.id) || {};
    return { id: k.id, titel: k.titel, behoerde: k.behoerde, beschreibung: k.beschreibung, tage: k.tage, kosten: k.kosten, online: k.online, link: vorher.link || k.link || '', unterlagen: k.unterlagen.map((u) => ({ text: u, da: !!(vorher.unterlagen || []).find((x) => x.text === u && x.da) })),
      vorbereitung: k.vorbereitung || '', status: vorher.status || 'offen', datei: vorher.datei || '', hinweis: vorher.hinweis || '', zusatz: false };
  }).concat(alt.filter((x) => x.zusatz));
}

async function gruendungStarten() {
  const p = z.p;
  p.gruendung = p.gruendung || { steckbrief: { rechtsform: 'unsicher', bundesland: '', ort: '', taetigkeit: p.idee || '', start: '', nebenberuflich: false, mitarbeiter: false, website: true, gruender: 1 }, schritte: [], quellen: [], erstellt: lyra.jetzt() };
  z.gSteckbriefOffen = true;
  z.reiter = 'gruendung';
  await sichern(p);
  zeichnen();
}

async function steckbriefSichern(sb) {
  const p = z.p;
  p.gruendung.steckbrief = sb;
  p.gruendung.schritte = fahrplanBauen(sb, p.gruendung.schritte);
  z.gSteckbriefOffen = false;
  protokollieren('nutzer', 'Gründungs-Steckbrief gesichert', `${RECHTSFORMEN[sb.rechtsform][0]} · ${sb.ort || sb.bundesland || 'Ort offen'} · Start ${sb.start || 'offen'} · ${p.gruendung.schritte.length} Schritte im Fahrplan`);
  await sichern(p);
  if (p.erinnern) erinnerungenSetzen();
  zeichnen();
}

const G_ANPASSEN_SCHEMA = {
  type: 'object',
  properties: {
    hinweise: { type: 'array', items: { type: 'object', properties: { hinweis: { type: 'string' }, id: { type: 'string' }, link: { type: 'string' } }, required: ['hinweis', 'id', 'link'] } },
    zusaetzlich: { type: 'array', items: { type: 'object', properties: { behoerde: { type: 'string' }, beschreibung: { type: 'string' }, link: { type: 'string' }, tage: { type: 'integer' }, titel: { type: 'string' } }, required: ['behoerde', 'beschreibung', 'link', 'tage', 'titel'] } },
  },
  required: ['hinweise', 'zusaetzlich'],
};

/** Fahrplan auf den Fall zuschneiden: Hinweise je Schritt (z. B. Online-Portal der Stadt) und branchenspezifische Schritte. */
async function fahrplanAnpassen() {
  const p = z.p;
  const g = p.gruendung;
  if (z.laeuft) return;
  const sb = g.steckbrief;
  const web = lehrerInfo(z.lehrer).web === true && p.einstellungen.web;
  z.laeuft = { art: 'gruendung' };
  z.fehler = null;
  status(web ? 'Recherchiert die Behördengänge für deinen Fall …' : 'Passt den Fahrplan an deinen Fall an …');
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM, schema: G_ANPASSEN_SCHEMA, web,
      prompt: `Gründung in Deutschland – Steckbrief:\n- Vorhaben/Tätigkeit: ${sb.taetigkeit}\n- Rechtsform: ${RECHTSFORMEN[sb.rechtsform][0]}\n- Ort: ${[sb.ort, sb.bundesland].filter(Boolean).join(', ') || 'offen'}\n- Start: ${sb.start || 'offen'}\n- ${sb.nebenberuflich ? 'nebenberuflich' : 'hauptberuflich'}, ${sb.mitarbeiter ? 'mit' : 'ohne'} Mitarbeitende, ${sb.gruender || 1} Gründer:in(nen)\n\n\
Fahrplan (ids): ${g.schritte.filter((s) => !s.zusatz).map((s) => `${s.id} = ${s.titel}`).join('; ')}\n\n\
1. "hinweise": Für die Schritte, wo es für diesen Fall etwas Konkretes zu sagen gibt (z. B. wo ${sb.ort || 'die Gemeinde'} die Gewerbeanmeldung online anbietet, welche Kammer zuständig ist, welche Berufsgenossenschaft passt), je "id", ein kurzer "hinweis" (1–2 Sätze) und "link" (offizielle Seite – nur wenn du sie ${web ? 'gefunden hast' : 'sicher kennst'}, sonst "").\n\
2. "zusaetzlich": Bis zu 3 weitere Schritte, die speziell für diese Tätigkeit nötig sind (z. B. Gaststättenerlaubnis, Eintragung in die Handwerksrolle, Erlaubnis nach § 34 GewO) – nur, wenn sie wirklich zutreffen. "tage" = Tage relativ zum Start (negativ = vorher).\n\
Nichts erfinden: lieber weglassen. Das ist keine Rechtsberatung.\n\nAntwort als JSON: {"hinweise": [{"hinweis": "", "id": "gewerbe", "link": ""}], "zusaetzlich": [{"behoerde": "", "beschreibung": "", "link": "", "tage": -14, "titel": ""}]}`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    const j = (r && r.json) || {};
    const urlOk = (u) => (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(text(u)) ? text(u) : '');
    let n = 0;
    (j.hinweise || []).forEach((x) => {
      const s = g.schritte.find((y) => y.id === text(x.id));
      if (!s || !text(x.hinweis)) return;
      s.hinweis = text(x.hinweis).slice(0, 500);
      if (urlOk(x.link)) s.link = urlOk(x.link);
      n++;
    });
    g.schritte = g.schritte.filter((s) => !s.zusatz || s.status !== 'offen');
    (j.zusaetzlich || []).filter((x) => text(x.titel)).slice(0, 3).forEach((x) => {
      g.schritte.push({ id: 'zusatz-' + slug(x.titel), titel: text(x.titel).slice(0, 120), behoerde: text(x.behoerde), beschreibung: text(x.beschreibung).slice(0, 600), tage: Math.max(-120, Math.min(180, Math.round(Number(x.tage) || -14))), kosten: 'je nach Fall', online: false, link: urlOk(x.link), unterlagen: [], vorbereitung: `Eine Checkliste für „${text(x.titel)}“: Voraussetzungen, Unterlagen, zuständige Stelle und Ablauf.`, status: 'offen', datei: '', hinweis: '', zusatz: true });
    });
    g.angepasst = lyra.jetzt();
    protokollieren('recherche', `Gründungs-Fahrplan angepasst${web ? ' (mit Websuche)' : ''}`, `${n} Hinweise, ${(j.zusaetzlich || []).length} zusätzliche Schritte`);
    await sichern(p);
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

/** Einen Behördengang vorbereiten: Ausfüllhilfe, Entwurf oder Anschreiben als Datei im Arbeitsbereich. Eingereicht wird von dir. */
async function schrittVorbereiten(id) {
  const p = z.p;
  const g = p.gruendung;
  const s = g.schritte.find((x) => x.id === id);
  if (!s || !s.vorbereitung || z.laeuft) return;
  const sb = g.steckbrief;
  z.laeuft = { art: 'gruendung', schritt: id };
  z.fehler = null;
  z.gOffen = id;
  status(`Bereitet „${s.titel}“ vor …`);
  zeichnen();
  try {
    const r = await lyra.ki({
      lehrer: z.lehrer, system: SYSTEM,
      prompt: `Gründung – Steckbrief: ${sb.taetigkeit} · ${RECHTSFORMEN[sb.rechtsform][0]} · ${[sb.ort, sb.bundesland].filter(Boolean).join(', ') || 'Ort offen'} · Start ${sb.start || 'offen'} · ${sb.nebenberuflich ? 'nebenberuflich' : 'hauptberuflich'} · ${sb.mitarbeiter ? 'mit' : 'ohne'} Mitarbeitende\n\n\
Behördengang: ${s.titel} (${s.behoerde})\n${s.beschreibung}${s.hinweis ? `\nHinweis: ${s.hinweis}` : ''}\n${FAKTEN[s.id] ? `\nGeprüfte Fakten (nur darauf stützen):\n${FAKTEN[s.id]}\n` : ''}\nErstelle: ${s.vorbereitung}\n\n\
Strenge Regeln: Nenne keine Beträge, Umsatzgrenzen, Fristen oder Paragraphen, die nicht oben stehen – wo eine aktuelle Zahl nötig ist, \
schreib „[aktuellen Wert beim Finanzamt bzw. bei der zuständigen Stelle prüfen]“. Triff keine Entscheidungen für mich (z. B. \
Kleinunternehmerregelung ja/nein, Rechtsform) – stell die Optionen mit Vor- und Nachteilen dar und markiere, was ich entscheiden muss.\n\n\
Format: Markdown, sofort verwendbar. Persönliche Daten (Name, Anschrift, Geburtsdatum, Steuer-ID, Bankdaten …) NIE erfinden, sondern als [Platzhalter]. \
Ende mit „## Vor dem Einreichen prüfen“ (3–6 Punkte) und dem Satz: „Hinweis: Das ist eine Ausfüllhilfe, keine Rechts- oder Steuerberatung – im Zweifel bei der zuständigen Stelle, IHK oder Steuerberatung nachfragen.“`,
    }, (x) => { if (x.art === 'hinweis') status(x.text); });
    let md = text(r && r.text);
    if (!md) throw new Error('Es kam kein Entwurf zurück.');
    // Paragraphen, die nicht in den geprüften Fakten stehen, sichtbar markieren – Modelle erfinden gern Normen
    const erlaubt = new Set(((FAKTEN[s.id] || '') + ' ' + s.beschreibung).match(/§\s*\d+[a-z]?/g) || []).map((x) => x.replace(/\s+/g, ''));
    let markiert = 0;
    md = md.replace(/§\s*\d+[a-z]?(?:\s*Abs\.\s*\d+)?(?:\s+[A-ZÄÖÜ][\wÄÖÜäöü-]*)?/g, (m) => {
      if (erlaubt.has((m.match(/§\s*\d+[a-z]?/) || [''])[0].replace(/\s+/g, ''))) return m;
      markiert++;
      return `${m} ⚠︎ *nicht geprüft*`;
    });
    const lokal = !lehrerInfo(z.lehrer).online;
    const warnung = lokal || markiert
      ? `> ⚠︎ ${lokal ? 'Erstellt mit Lyra lokal – das kleine Modell kann bei Steuer- und Rechtsfragen Fehler machen. ' : ''}${markiert ? `${markiert} Rechtsverweis${markiert === 1 ? '' : 'e'} ist nicht durch die geprüften Fakten gedeckt (markiert). ` : ''}Prüfe die Angaben bei der zuständigen Stelle${lokal ? ' oder lass die Ausfüllhilfe mit Claude oder ChatGPT neu erstellen' : ''}.\n\n`
      : '';
    const pfad = `gruendung/${slug(s.titel)}.md`;
    dateiSetzen(pfad, `# ${s.titel}\n\n_${s.behoerde} · vorbereitet von Launchpad am ${new Date().toLocaleDateString('de-DE')}_\n\n${warnung}${md}\n`);
    await dateienSichern();
    s.datei = pfad;
    if (s.status === 'offen') s.status = 'vorbereitet';
    protokollieren('datei', `Behördengang vorbereitet: ${s.titel}`, `→ ${pfad}`);
    await sichern(p);
  } catch (e) { if (!abgebrochen(e)) z.fehler = meldung(e); }
  z.laeuft = null;
  zeichnen();
}

async function gStatusSetzen(id, st) {
  const s = z.p.gruendung.schritte.find((x) => x.id === id);
  if (!s) return;
  s.status = st;
  if (st === 'eingereicht') s.eingereichtAm = lyra.jetzt();
  protokollieren('nutzer', `Gründung: ${s.titel} → ${G_STATUS[st][0]}`, '');
  await sichern();
  if (z.p.erinnern) erinnerungenSetzen();
  zeichnen();
}

function gruendungMarkdown(p) {
  const g = p.gruendung;
  const sb = g.steckbrief;
  const liste = g.schritte.slice().sort((a, b) => a.tage - b.tage);
  return [`# Gründungsfahrplan: ${p.name}`, '', `**${RECHTSFORMEN[sb.rechtsform][0]}** · ${[sb.ort, sb.bundesland].filter(Boolean).join(', ') || 'Ort offen'} · Start: ${sb.start ? deDatum(sb.start) : 'offen'}`, '',
    ...liste.flatMap((s) => [`## ${s.status === 'erledigt' ? '✅' : s.status === 'entfaellt' ? '➖' : '⬜️'} ${s.titel}`, `_${s.behoerde} · fällig ${deDatum(gDatum(g, s))} · ${s.kosten}${s.online ? ' · online möglich' : ''}_`, '', s.beschreibung, s.hinweis ? `\n> ${s.hinweis}` : '',
      s.unterlagen.length ? `\n**Unterlagen:**\n${s.unterlagen.map((u) => `- [${u.da ? 'x' : ' '}] ${u.text}`).join('\n')}` : '', s.link ? `\n${s.link}` : '', s.datei ? `\nVorbereitet: \`${s.datei}\`` : '', '']),
    '---', '_Ausfüllhilfe von Launchpad – keine Rechts- oder Steuerberatung. Einreichen musst du selbst._'].join('\n');
}

// ================================================================== Ansicht

function gruendungsHinweis(p) {
  if (gruendungAktiv(p) || !/(gründ|startup|start-up|selbstst|selbständ|firma|unternehmen|gewerbe|freiberuf|freelanc|businessplan|geschäft)/i.test(`${p.idee} ${p.name} ${p.ziel}`)) return null;
  return h('div', { class: 'lp-karte lp-g-angebot' },
    h('div', { class: 'lp-g-symbol' }, ic('behoerde', 20)),
    h('div', { class: 'wachsen' }, h('div', { class: 'fett' }, 'Gründest du? Der Gründungs-Lotse nimmt dir den Papierkram ab'),
      h('div', { class: 'lp-mini' }, 'Fahrplan aller Behördengänge mit Fristen, Kosten und Portalen – Ausfüllhilfen und Entwürfe macht Launchpad, einreichen tust du.')),
    h('button', { class: 'knopf klein', onclick: gruendungStarten }, 'Lotse starten'));
}

function steckbriefForm(p) {
  const sb = { ...p.gruendung.steckbrief };
  const zeile = (name, el) => h('label', { class: 'lp-feld' }, h('span', {}, name), el);
  const feld = (wert, ph, bei, typ) => { const f = h('input', { class: 'eingabe', placeholder: ph, type: typ || 'text' }); f.value = wert || ''; f.addEventListener('input', () => bei(f.value)); return f; };
  const wahl = (werte, aktuell, bei) => { const s = h('select', { class: 'eingabe' }, werte.map(([w, n]) => h('option', { value: w }, n))); s.value = aktuell; s.addEventListener('change', () => bei(s.value)); return s; };
  const taetigkeit = h('textarea', { class: 'eingabe', rows: 2, placeholder: 'Was genau wirst du anbieten? z. B. „Webdesign für kleine Unternehmen“' });
  taetigkeit.value = sb.taetigkeit || '';
  taetigkeit.addEventListener('input', () => { sb.taetigkeit = taetigkeit.value; });
  return h('div', { class: 'lp-karte lp-g-steckbrief' },
    h('div', { class: 'lp-karte-kopf' }, ic('behoerde', 16), h('h3', { class: 'wachsen' }, 'Steckbrief deiner Gründung'), h('span', { class: 'lp-mini' }, '🔒 bleibt in Lyra auf deinem Mac')),
    h('div', { class: 'lp-formular' },
      zeile('Tätigkeit', taetigkeit),
      h('div', { class: 'lp-formular-raster' },
        zeile('Rechtsform', wahl(Object.entries(RECHTSFORMEN).map(([k, v]) => [k, `${v[0]} – ${v[1]}`]), sb.rechtsform, (v) => { sb.rechtsform = v; })),
        zeile('Geplanter Start', feld(sb.start, '', (v) => { sb.start = v; }, 'date'))),
      h('div', { class: 'lp-formular-raster' },
        zeile('Bundesland', wahl([['', '—'], ...BUNDESLAENDER.map((b) => [b, b])], sb.bundesland, (v) => { sb.bundesland = v; })),
        zeile('Stadt/Gemeinde (für Gewerbeamt und Portale)', feld(sb.ort, 'z. B. Köln', (v) => { sb.ort = v; }))),
      h('div', { class: 'lp-formular-raster' },
        zeile('Gründer:innen', wahl([[1, '1'], [2, '2'], [3, '3 oder mehr']], sb.gruender || 1, (v) => { sb.gruender = +v; })),
        h('div', {})),
      lyra.schalter({ wert: sb.nebenberuflich, text: 'Nebenberuflich (neben Job oder Studium)', beiWahl: (w) => { sb.nebenberuflich = w; } }),
      lyra.schalter({ wert: sb.mitarbeiter, text: 'Mitarbeitende geplant (auch Minijob)', beiWahl: (w) => { sb.mitarbeiter = w; } }),
      lyra.schalter({ wert: sb.website, text: 'Website oder geschäftliche Social-Media-Profile', beiWahl: (w) => { sb.website = w; } })),
    h('div', { class: 'zeile', style: { justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
      p.gruendung.schritte.length ? h('button', { class: 'knopf text', onclick: () => { z.gSteckbriefOffen = false; zeichnen(); } }, 'Abbrechen') : null,
      h('button', { class: 'knopf', onclick: () => steckbriefSichern(sb) }, p.gruendung.schritte.length ? 'Fahrplan aktualisieren' : 'Fahrplan erstellen')));
}

function gruendungReiter(p) {
  const g = p.gruendung;
  if (!g) return h('div', {}, gruendungsHinweis({ ...p, idee: 'gründen' }));
  if (z.gSteckbriefOffen || !g.schritte.length) return h('div', {}, steckbriefForm(p), h('div', { class: 'lp-mini lp-g-hinweis' }, ic('warnung', 13), 'Launchpad bereitet vor, du reichst ein: Behörden verlangen deine Identität (ELSTER-Zertifikat, Unterschrift, Notar) – und Lyras Plugins haben bewusst keinen Internetzugang. Keine Rechts- oder Steuerberatung.'));
  const sb = g.steckbrief;
  const liste = g.schritte.slice().sort((a, b) => a.tage - b.tage);
  const relevant = liste.filter((s) => s.status !== 'entfaellt');
  const fertig = relevant.filter((s) => s.status === 'erledigt').length;
  const heute = heuteIso();
  const naechster = relevant.find((s) => s.status === 'offen' || s.status === 'vorbereitet');
  const gruppen = [['Vor dem Start', (s) => s.tage < 0], ['Zum Start', (s) => s.tage >= 0 && s.tage <= 7], ['Nach dem Start', (s) => s.tage > 7]];
  return h('div', {},
    h('div', { class: 'lp-g-kopf' },
      h('div', { class: 'wachsen' },
        h('div', { class: 'lp-eyebrow' }, 'Gründungs-Lotse'),
        h('div', { class: 'fett', style: { fontSize: '16px' } }, `${RECHTSFORMEN[sb.rechtsform][0]} · ${[sb.ort, sb.bundesland].filter(Boolean).join(', ') || 'Ort offen'} · Start ${sb.start ? deDatum(sb.start) : 'offen'}`),
        h('div', { class: 'lp-mini' }, `${fertig} von ${relevant.length} Schritten erledigt${naechster ? ` · als Nächstes: ${naechster.titel} (${deDatum(gDatum(g, naechster), true)})` : ''}${g.angepasst ? ` · angepasst ${lyra.zeitText(g.angepasst)}` : ''}`)),
      h('button', { class: 'knopf rand klein', onclick: () => { z.gSteckbriefOffen = true; zeichnen(); } }, ic('stift', 13), 'Steckbrief'),
      h('button', { class: 'knopf rand klein', disabled: !!z.laeuft, onclick: fahrplanAnpassen }, ic('suche', 13), lehrerInfo(z.lehrer).web ? 'Für meinen Ort recherchieren' : 'An meinen Fall anpassen'),
      h('button', { class: 'knopf rand klein', onclick: async () => { try { if (await lyra.speichern(`Gruendungsfahrplan-${dateiname(p.name)}.md`, gruendungMarkdown(p))) lyra.toast('Gesichert', 'ok'); } catch (e) { lyra.toast(meldung(e), 'fehler'); } } }, ic('sichern', 13), 'Fahrplan sichern')),
    h('div', { class: 'lp-fortschritt-balken lp-g-balken' }, h('span', { style: { width: `${relevant.length ? Math.round((fertig / relevant.length) * 100) : 0}%` } })),
    !lehrerInfo(z.lehrer).online ? h('div', { class: 'lp-mini lp-g-hinweis', style: { marginTop: 0, marginBottom: '14px' } }, ic('ki', 13), 'Fahrplan, Fristen und Grundfakten sind geprüft hinterlegt. Für Ausfüllhilfen und die Recherche zu deinem Ort sind Claude oder ChatGPT (mit Websuche) deutlich genauer als Lyra lokal – das kleine Modell kann bei Steuer- und Rechtsfragen Fehler machen. Wählen kannst du links unten.') : null,
    z.laeuft && z.laeuft.art === 'gruendung' && !z.laeuft.schritt ? h('div', { style: { margin: '12px 0' } }, lyra.arbeit(z.status)) : null,
    z.fehler ? h('div', { style: { margin: '12px 0' } }, lyra.fehlerBox(z.fehler, null, () => { z.fehler = null; zeichnen(); })) : null,
    gruppen.map(([name, filter]) => {
      const teil = liste.filter(filter);
      if (!teil.length) return null;
      return h('section', { class: 'lp-g-gruppe' }, h('div', { class: 'lp-label' }, name), teil.map((s) => schrittKarte(g, s, heute)));
    }),
    h('div', { class: 'lp-mini lp-g-hinweis' }, ic('warnung', 13), 'Launchpad bereitet vor, einreichen tust du selbst (ELSTER-Zertifikat, Unterschrift, Notar). Fristen und Kosten sind Richtwerte – im Zweifel bei der zuständigen Stelle, IHK oder Steuerberatung nachfragen. Keine Rechts- oder Steuerberatung.'));
}

function schrittKarte(g, s, heute) {
  const offen = z.gOffen === s.id;
  const datum = gDatum(g, s);
  const t = tageBis(datum);
  const erledigt = s.status === 'erledigt' || s.status === 'entfaellt';
  const laeuft = z.laeuft && z.laeuft.schritt === s.id;
  return h('div', { class: 'lp-g-schritt ' + s.status },
    h('div', { class: 'lp-g-schritt-kopf', onclick: () => { z.gOffen = offen ? null : s.id; zeichnen(); } },
      h('span', { class: 'lp-g-haken' }, erledigt ? ic('check', 13) : s.status === 'eingereicht' ? ic('flagge', 13) : ''),
      h('div', { class: 'wachsen' },
        h('div', { class: 'fett' }, s.titel, s.zusatz ? h('span', { class: 'lp-art', style: { marginLeft: '6px' } }, 'für deine Tätigkeit') : null),
        h('div', { class: 'lp-mini' }, [s.behoerde, s.kosten, s.online ? 'online möglich' : ''].filter(Boolean).join(' · '))),
      h('span', { class: 'lp-status lp-s-' + G_STATUS[s.status][1] }, G_STATUS[s.status][0]),
      h('span', { class: 'lp-termin' + (!erledigt && t !== null && t < 0 ? ' spaet' : !erledigt && t !== null && t <= 7 ? ' bald' : '') }, !erledigt && gSofort(g, s) ? 'so bald wie möglich' : `${deDatum(datum, true)}${!erledigt && t !== null ? (t < 0 ? ' · überfällig' : t === 0 ? ' · heute' : ` · in ${t} T.`) : ''}`)),
    offen ? h('div', { class: 'lp-g-details' },
      h('div', { class: 'lp-text' }, s.beschreibung),
      s.hinweis ? h('div', { class: 'lp-g-tipp' }, ic('suche', 13), h('span', {}, s.hinweis)) : null,
      s.unterlagen.length ? h('div', {}, h('div', { class: 'lp-label', style: { margin: '8px 0 4px' } }, 'Unterlagen'),
        s.unterlagen.map((u) => h('label', { class: 'lp-g-unterlage' }, h('input', { type: 'checkbox', checked: u.da, onchange: async (e) => { u.da = e.target.checked; await sichern(); } }), u.text))) : null,
      laeuft ? lyra.arbeit(z.status) : null,
      h('div', { class: 'lp-g-aktionen' },
        s.vorbereitung ? (s.datei && z.dateien[s.datei] !== undefined
          ? h('button', { class: 'knopf tonal klein', onclick: () => { z.reiter = 'dateien'; z.datei = s.datei; zeichnen(); } }, ic('datei', 13), 'Vorbereitung öffnen')
          : h('button', { class: 'knopf klein', disabled: !!z.laeuft, onclick: () => schrittVorbereiten(s.id) }, ic('ki', 13), 'Vorbereiten lassen')) : null,
        s.datei && s.vorbereitung ? h('button', { class: 'knopf text klein', disabled: !!z.laeuft, onclick: () => schrittVorbereiten(s.id) }, 'Neu vorbereiten') : null,
        s.link ? h('button', { class: 'knopf rand klein', title: s.link, onclick: () => lyra.link(s.link) }, ic('link', 13), 'Zum Portal') : null,
        h('span', { class: 'wachsen' }),
        lyra.auswahl({ titel: 'Status', optionen: Object.entries(G_STATUS).map(([k, v]) => [k, v[0]]), wert: s.status, beiWahl: (w) => gStatusSetzen(s.id, w) })))
      : null);
}

/** Fristen der Gründung für die Erinnerungen (am Vortag, 9 Uhr). */
function gruendungErinnerungen(p) {
  const g = p && p.gruendung;
  if (!g || !g.steckbrief || !isoGueltig(g.steckbrief.start)) return [];
  return g.schritte.filter((s) => s.status === 'offen' || s.status === 'vorbereitet').map((s) => {
    const d = new Date(gDatum(g, s) + 'T09:00:00');
    d.setDate(d.getDate() - 1);
    return { id: `${p.id}-g-${s.id}`, titel: `Morgen fällig: ${s.titel}`.slice(0, 120), text: `${p.name} · ${s.behoerde}`, zeit: Math.round(d.getTime() / 1000) };
  }).filter((x) => x.zeit * 1000 > Date.now());
}
