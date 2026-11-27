# Lyra-Plugins

Plugins für **Lyra**, den lokalen Lernbegleiter für den Mac. Lyra lädt ein Plugin erst, wenn du es im Plugin-Menü
installierst – von hier, aus dem neuesten Release:

`https://github.com/mortzel1/lyra-plugins/releases/latest/download/katalog.json`

| Plugin | Version | Was es tut |
|---|---|---|
| **Arena** | 1.0.1 | Probeklausur unter echten Bedingungen |
| **Argus** | 1.0.0 | Vertrags-Check mit belegten Zitaten |
| **Byte** | 1.0.1 | Programmieraufgaben mit Tests – Python & Java |
| **Clavis** | 2.0.0 | Vier Premium-Escape-Rooms einschließlich Bankraub; neu: NACHTAKTE mit freien Ermittlungswegen, allein oder im Team |
| **Crux** | 1.1.0 | Kreuzworträtsel aus deinem Lernstoff |
| **Deep Dive** | 2.1.0 | Dein persönlicher Professor – lückenlos durch jedes Thema bis zur Prüfung |
| **Delta** | 1.0.1 | DEAs und NEAs entwerfen, simulieren und erzeugen |
| **Echo** | 1.1.0 | Vorlesungen aufnehmen und mitschreiben – auf deinem Mac |
| **Essenz** | 1.1.0 | Formelblatt aus deinen Unterlagen |
| **Flip** | 1.3.0 | Karteikarten, die sitzen |
| **Flow** | 1.0.1 | Fokus-Timer mit Statistik |
| **Graphit** | 1.1.0 | Schaubilder zeichnen – direkt in der Eingabezeile |
| **Justitia** | 1.0.0 | Gutachtenstil-Trainer für Jura |
| **Kompass** | 1.0.1 | Lernzeit rückwärts von deinen Fristen planen |
| **Launchpad** | 2.1.0 | Dein KI-Mitarbeiter: plant Projekte und erledigt die Aufgaben – mit Code, Tests und Daten |
| **Lemma** | 1.0.1 | Beweise selbst führen – Schritt für Schritt |
| **Mindmap** | 1.0.1 | Begriffe und Querbezüge deiner Fächer |
| **Oase** | 1.0.1 | Dein Ruhepol – Stress, Kopf und Motivation |
| **Omega** | 1.0.1 | Kellerautomaten, Turingmaschinen, Grammatiken & CYK |
| **Prisma** | 1.0.0 | Datenanalyse für CSV und Excel |
| **Puls** | 1.0.1 | Live-Umfragen und Fragenwand – alle machen auf dem Handy mit |
| **Quizzard** | 1.4.0 | Das Quiz zu jedem Thema – schnell, bunt, mit Punkten |
| **Quizzard Online** | 1.3.0 | Das Live-Quiz für alle gleichzeitig – wer schneller richtig liegt, gewinnt |
| **Recap** | 1.1.0 | Besprechungen → Entscheidungen & To-dos |
| **Regie** | 1.0.1 | Vom Thema zum Erklärvideo |
| **Scout** | 1.1.0 | Recherchiert im Netz und schreibt dir ein Skript |
| **Sokrates** | 1.0.0 | Nachhilfe, die dich selbst draufkommen lässt |
| **Sprungbrett** | 1.0.0 | Dein Bewerbungscoach |
| **Tinte** | 1.1.0 | Briefe & E-Mails, die sitzen |
| **Veritas** | 1.1.0 | Faktencheck mit Quellen und Prozent-Einschätzung |
| **Vertex** | 1.1.0 | Grafikrechner – Funktionen zeichnen, untersuchen, modellieren |
| **Zaster** | 1.0.0 | Haushaltsbuch mit Abo-Radar |

## Sicherheit

- Jedes Paket ist mit Ed25519 signiert. Lyra prüft vor dem Installieren Größe, SHA-256 und Signatur gegen den
  eingebauten öffentlichen Schlüssel – ein verändertes Paket wird abgelehnt.
- Öffentlicher Schlüssel (hex): `515ef0e1bd86dfb25d0103a0b07a5fe26497768bf355edbe0e2ce3858c5beccc`
- Plugins laufen in Lyra abgeschottet: ohne eigenen Internetzugang, nur mit den Rechten aus ihrem `manifest.json`.
  Fragt ein Plugin Claude, ChatGPT oder Gemini, fragt Lyra dich vorher. Recherche im Netz geht nur über Lyra und nur mit
  dem Recht „internet“: die Websuche von Claude/ChatGPT oder Lyras Nachschlagen in Wikipedia & Co. (dabei geht nur eine
  kurze Suchanfrage hinaus).

## Aufbau

- `plugins/<kennung>/` – Quelltext je Plugin (`manifest.json`, `index.html`, `app.js`, `stil.css`)
- Releases – die signierten Pakete (`<kennung>-<version>.lyraplugin`) und `katalog.json`

Clavis 2.0: [Anleitung und Übersicht](dokumentation/clavis/README.md) · [NACHTAKTE](dokumentation/clavis/NACHTAKTE.md) · [Die Schwarze Reserve](dokumentation/clavis/SCHWARZE-RESERVE.md). Alle Räume gehören zur zentralen Clavis-Installation.
