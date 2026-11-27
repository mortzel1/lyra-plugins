# Clavis 2.0.0

**Alle Räume zentral in Clavis.** Der Bankraub „Die Schwarze Reserve“ gehört jetzt vollständig zur gleichen Installation. Neu ist **NACHTAKTE**, ein eigener Spielbereich für nichtlineare Kriminalermittlungen.

## Spielen

Clavis im normalen Lyra-Plugin-Katalog auf **2.0.0** aktualisieren. Im Hauptmenü stehen zwei Bereiche bereit:

| Bereich | Enthaltene Abenteuer |
|---|---|
| Escape Rooms | Die Schwarze Reserve, NULLMEILE, Mercy Creek, Der Wald hört mit, acht Standardräume, eigene und KI-gebaute Räume |
| NACHTAKTE | Fall 01: Die Frau am Black Alder Trail — allein oder mit einem Ermittlungsteam von 2–8 Personen |

Ein separates **Clavis Noir ist nicht mehr erforderlich**. Falls es bereits installiert ist, kann es nach dem Clavis-Update entfernt werden. Für den Bankraum eine neue Einladung direkt aus Clavis verwenden.

## NACHTAKTE

Mara Vale ist nach einem Spaziergang nahe Los Angeles verschwunden. Eine alte Waldgeschichte liefert eine bedrohliche Erklärung. Das ist noch kein Beweis.

Ihr entscheidet selbst, was ihr als Nächstes tut: Recherche mit freien Suchbegriffen im fiktiven Fallnetz, Zeugenbefragung, Kamerasichtung, Ortsbesichtigung, Spurenlabor oder eine öffentliche Meldung. Ihr formuliert Hypothesen, ordnet Originalquellen zeitlich ein und verknüpft Belege. Weitere Nachforschungen können eine Annahme stützen, ihr widersprechen oder eine Sackgasse sichtbar machen.

Zwölf eigene Filmkulissen, sieben befragbare Personen, situationsabhängige Szenen, lokale Geräusche und eine Welt, die mit der Fallzeit und euren Entscheidungen reagiert. Aufenthaltsorte, Kooperation und mögliche Enden verändern sich. Mehrere Wege ermöglichen einen belastbaren Abschluss; ein verpasster Kontakt muss keine Sackgasse für den ganzen Fall sein.

Im Team hat jede Person ihren eigenen Standort und private Arbeitsnotizen. Quellen und Maßnahmenprotokoll gehören zur gemeinsamen Akte. Wichtige Schlussfolgerungen werden mit getrennten Stimmen beschlossen. In Lyra wird der Ermittlungsstand automatisch gesichert und kann später allein oder im Team fortgesetzt werden.

Die Anleitung enthält keine Fallauflösung: **[NACHTAKTE.md](NACHTAKTE.md)**.

## Die Schwarze Reserve

Die Gang „Die Nachtseite“ tritt gegen eine fiktive Staatliche Reservebank an. Zwölf asymmetrische Teamoperationen, neue Zweier- und Dreiergruppen, vier Live-Kontrollen und nur wenige erlaubte Fehler. Nach einem geschützten Salon zur Halbzeit können einzelne Personen dauerhaft gefasst werden. Die Restgang erhält neue Zuständigkeiten; unter zwei aktiven Personen scheitert der Raub. Ein vollständiger Zugriff kann alle treffen.

Gefasste Personen erhalten eine Zuschaueransicht und einen eigenen Funkkanal. Ihre Plätze bleiben für diesen Raub geschlossen. Ein Verbindungsabbruch einer aktiven Person pausiert dagegen den Raub und zählt nicht als Festnahme.

Anleitung: **[SCHWARZE-RESERVE.md](SCHWARZE-RESERVE.md)**.

## Lokal ausprobieren

Die Vorschauen verwenden dieselben Spielleitungen und Ansichten wie Clavis. Die Teamproben verbinden Fenster desselben Browsers auf diesem Mac; für mehrere Geräte wird die echte Lyra-Einladung verwendet.

```sh
zsh "/Users/moritzmacbook/Documents/ClavisGPT/Nachtakte-Probe-starten.command"
```

Bei NACHTAKTE genügt eine einzelne Perspektive zum Starten. Über die obere Leiste lassen sich weitere Spielerfenster öffnen. Die lokale Probe sichert den Hoststand nicht dauerhaft. Das Terminal geöffnet lassen; beenden mit **Strg+C**.

Weitere Startdateien:

- `Schwarze-Reserve-Teamprobe-starten.command` — Bankraum, mindestens zwei Perspektiven.
- `Nullmeile-Teamprobe-starten.command` — Arizona-Teamraum, mindestens zwei Perspektiven.
- `vorschau/Clavis-Vorschau.html` — vollständiges Menü und Solospiele einschließlich NACHTAKTE. Echte Einladungen und KI-Funktionen benötigen Lyra.

## Installation und Veröffentlichung

- `plugins/clavis/`: der vollständige gemeinsame Plugin-Quellcode.
- `veroeffentlichung/release/clavis-2.0.0.lyraplugin`: signiertes Installationspaket mit allen Räumen und NACHTAKTE.
- `veroeffentlichung/release/katalog.json`: normaler Katalog mit weiterhin 32 Plugins.
- `Clavis-2.0-auf-GitHub-hochladen.command`: vorbereitete Veröffentlichung der gemeinsamen Fassung. Ihre Vorprüfung vergleicht Git-Stand, Quellcode, Paketinhalt, Größen und Prüfsummen.

Das Vorbereiten dieser Dateien veröffentlicht sie noch nicht auf GitHub. Die alte separate Noir-Fassung ist unter `archiv` aufbewahrt und wird nicht mehr als eigenes Plugin veröffentlicht.

Ein späterer Aufpreis für einzelne Räume ist in `plugins/clavis/premium-zugang.json` als raumbezogene Produktstruktur vorgesehen. **Zahlungsabwicklung und Lizenzprüfung sind noch nicht angebunden.** Aktuell lassen sich die enthaltenen Räume direkt in Clavis starten.

## Prüfungen

```sh
python3 tests/pruefen.py
python3 tests/noir/pruefen.py
python3 tests/akte/pruefen.py
```

Die Prüfungen umfassen die bisherigen Räume, den Bankraum einschließlich Festnahmen sowie NACHTAKTE mit mehreren vollständigen Ermittlungswegen, falschen Fährten, Teamabstimmungen, Autosicherung, Zeitlinie und verschiedenen Schlussvarianten. UI-Abläufe bedienen die tatsächlichen Steuerelemente in getrennten simulierten Ansichten. Der Fenstertransport wird zusätzlich mit nativen BroadcastChannels zwischen getrennten JavaScript-Kontexten geprüft.

**Grenzen:** Keine echte Browser-Sichtprüfung, keine Prüfung der hörbaren Klangqualität auf den Zielgeräten und noch keine gemeinsame Mehrgeräte-Runde über Lyra. DOM und WebAudio sind simuliert. Ein vollständiger Spieltest mit Menschen steht aus.

Vorschauen neu bauen:

```sh
python3 vorschau/bauen.py
python3 vorschau/noir-bauen.py
python3 vorschau/nachtakte-bauen.py
```
