# Lyra-Plugins

Plugins für **Lyra**, den lokalen Lernbegleiter für den Mac. Lyra lädt ein Plugin erst, wenn du es im Plugin-Menü
installierst – von hier, aus dem neuesten Release:

`https://github.com/mortzel1/lyra-plugins/releases/latest/download/katalog.json`

| Plugin | Version | Was es tut |
|---|---|---|
| **Deep Dive** | 1.0.1 | Ein Thema in kleinen Schritten meistern |
| **Delta** | 1.0.0 | DEAs und NEAs entwerfen, simulieren und erzeugen |
| **Flip** | 1.1.0 | Karteikarten, die sitzen |
| **Graphit** | 1.0.1 | Schaubilder zeichnen – direkt in der Eingabezeile |
| **Mindmap** | 1.0.0 | Begriffe und Querbezüge deiner Fächer |
| **Oase** | 1.0.0 | Dein Ruhepol – Stress, Kopf und Motivation |
| **Quizzard** | 1.1.0 | Das Quiz zu jedem Thema – schnell, bunt, mit Punkten |

## Sicherheit

- Jedes Paket ist mit Ed25519 signiert. Lyra prüft vor dem Installieren Größe, SHA-256 und Signatur gegen den
  eingebauten öffentlichen Schlüssel – ein verändertes Paket wird abgelehnt.
- Öffentlicher Schlüssel (hex): `515ef0e1bd86dfb25d0103a0b07a5fe26497768bf355edbe0e2ce3858c5beccc`
- Plugins laufen in Lyra abgeschottet: ohne Internetzugang, nur mit den Rechten aus ihrem `manifest.json`.
  Fragt ein Plugin Claude, ChatGPT oder Gemini, fragt Lyra dich vorher.

## Aufbau

- `plugins/<kennung>/` – Quelltext je Plugin (`manifest.json`, `index.html`, `app.js`, `stil.css`)
- Releases – die signierten Pakete (`<kennung>-<version>.lyraplugin`) und `katalog.json`
