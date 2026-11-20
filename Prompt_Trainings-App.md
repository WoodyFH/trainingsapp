# Auftrag für Claude Code: Private Trainings-App (PWA)

Du baust für mich (Felix) eine private Progressive Web App, mit der ich mein Krafttraining, Cardio und freie Trainings protokolliere. Ich nutze sie auf iPhone, Android und am Windows-Laptop. Die App ist nur für mich, muss kostenlos laufen und soll sich am Handy wie eine native App anfühlen. Arbeite in Phasen (Abschnitt 12), zeig mir nach jeder Phase den Stand und frag nach, wenn etwas unklar ist, statt zu raten.

---

## 1. Rahmenbedingungen

- **Hosting.** Öffentliches GitHub-Repo, Deployment über GitHub Pages per GitHub Actions. Der Code darf öffentlich sein, meine Trainingsdaten nie.
- **Backend.** Supabase im Gratisplan. Ich habe dort bereits ein Projekt für meinen Habit Tracker, das wir **mitbenutzen** (der Gratisplan erlaubt nur zwei aktive Projekte). Alle Tabellen dieser App beginnen mit dem Präfix `gym_`. Tabellen ohne dieses Präfix gehören dem Habit Tracker und werden **niemals** gelesen, verändert, umbenannt oder gelöscht. Auth-Einstellungen des Projekts änderst du nicht ohne Rückfrage.
- **Bevor du loslegst**, frag mich nach der Supabase-URL und dem Anon- bzw. Publishable-Key des bestehenden Projekts und danach, wie der Habit Tracker sich anmeldet. Wenn dort schon ein Benutzerkonto mit E-Mail und Passwort existiert, verwenden wir dasselbe Konto.
- **Datenbankänderungen** lieferst du als SQL-Dateien unter `supabase/migrations/` (z. B. `001_gym_schema.sql`), die ich im SQL-Editor von Supabase ausführe. Kein `db reset` und keine Befehle gegen die Remote-Datenbank, die fremde Tabellen betreffen könnten.
- **Geheimnisse.** Der Service-Role-Key kommt nie ins Repo und wird nicht gebraucht. `.env`, `private/` und alle `*.xlsx` stehen in `.gitignore`. Meine Excel-Datei wird nie committet.
- **App-Name.** Die App heißt ausschließlich **„Trainings-App“**, überall: Titel, Manifest, Home-Bildschirm, Login, README, Code-Bezeichner. „Rad“ ist kein App-Name und darf nirgends so verwendet werden. Mit „Rad“ ist in diesem Dokument nur die Rotation der drei Haupt-Trainings gemeint; in der Oberfläche heißt das „Rotation“.
- **Sprache der App** ist Deutsch, Einheiten metrisch (kg, km, m, min), Datumsformat TT.MM.JJJJ, Woche beginnt am Montag.

## 2. Tech-Stack

- React + TypeScript + Vite, Tailwind CSS
- `vite-plugin-pwa` (Manifest, Service Worker, `registerType: 'autoUpdate'`), App-Icons inkl. `apple-touch-icon`, `display: standalone`
- `@supabase/supabase-js` für Auth und Daten
- **Dexie** (IndexedDB) als lokale Datenbank für Offline-Betrieb
- **Recharts** für Diagramme
- **ExcelJS** für Excel-Import und -Export (alternativ SheetJS, dann aber aus der offiziellen CDN-Quelle von SheetJS und nicht das veraltete npm-Paket `xlsx`)
- `lucide-react` für Icons
- Routing mit `HashRouter` (vermeidet 404-Fehler bei GitHub Pages), `base` in `vite.config.ts` auf den Repo-Namen setzen
- Schriften Inter oder Plus Jakarta Sans, lokal eingebunden

## 3. Anmeldung und Sicherheit

- Anmeldung mit **E-Mail und Passwort** über Supabase Auth, Sitzung dauerhaft gespeichert. Keine Magic Links, weil die sich auf dem iPhone im Browser statt in der installierten PWA öffnen.
- Row Level Security auf **allen** `gym_`-Tabellen. Jede Zeile hat `user_id uuid not null default auth.uid()`, Policies für select, insert, update, delete jeweils mit `user_id = auth.uid()`.
- Kein Registrierungsformular in der App.

## 4. Offline-First und Synchronisation

Im Gym gibt es meistens Internet, trotzdem muss alles auch offline eingegeben werden können und sich später synchronisieren.

- Die App liest und schreibt **immer zuerst lokal** in Dexie. Jede Änderung landet zusätzlich in einer Outbox.
- Synchronisation beim App-Start, beim Wechsel zurück in die App (`visibilitychange`), beim `online`-Event und alle 60 Sekunden, solange die App offen ist.
- IDs sind clientseitig erzeugte UUIDs. Jede Tabelle hat `created_at`, `updated_at` und `deleted_at` (Soft Delete). Konflikte löst „letzte Änderung gewinnt“ anhand von `updated_at`.
- Ein kleines Wolken-Symbol im Header zeigt den Sync-Status (synchron, ausstehend mit Anzahl, offline, Fehler).
- Der Service Worker cached die App-Shell, sodass die App auch ohne Netz startet.

## 5. Datenmodell (Präfix `gym_`)

```
gym_settings          user_id (PK), bodyweight_kg numeric default 75, updated_at
gym_exercises         id, user_id, name, short_name (Gerätebezeichnung, z. B. "Beine 4C"),
                      load_type ('weight' | 'assisted' | 'bodyweight' | 'time'),
                      primary_muscles text[], secondary_muscles text[],
                      weight_step numeric default 5, notes (Ausführung, Geräteeinstellung),
                      sides smallint default 1 check (sides in (1,2)),
                      archived bool default false, Zeitstempel
gym_templates         id, user_id, name, color (Hex), icon (lucide-Name),
                      in_rotation bool, rotation_order int, sort int, archived, Zeitstempel
gym_template_exercises id, user_id, template_id, exercise_id, sort int, Zeitstempel
gym_sessions          id, user_id, kind ('strength' | 'free' | 'cardio'),
                      template_id (nullable), date date, started_at, finished_at,
                      note, source ('app' | 'import'), Zeitstempel
gym_exercise_logs     id, user_id, session_id, exercise_id, sets int, reps int,
                      weight_kg numeric (bei 'assisted' das Gegengewicht, bei 'bodyweight' Zusatzgewicht),
                      seconds int (nur bei 'time'), sides smallint not null default 1
                      (beim Loggen aus der Übung übernommen, damit die Historie abweichen kann),
                      increase_next bool default false,
                      note, sort int, Zeitstempel
gym_cardio_types      id, user_id, name, icon, distance_unit ('km' | 'm'), sort, archived, Zeitstempel
gym_cardio_logs       id, user_id, session_id, cardio_type_id, duration_min numeric,
                      kcal int, avg_hr int, distance numeric, note, Zeitstempel
                      CHECK: mindestens eines von duration_min, kcal, avg_hr, distance ist nicht null
```

**Wichtig zur Protokollierung.** Ich protokolliere **pro Übung und nicht pro Satz**. Ein Eintrag ist z. B. „3 Sätze × 11 Wiederholungen × 85 kg“. Meine Regel ist, dass ein Gewicht zählt, wenn ich es in mindestens zwei von drei Sätzen geschafft habe. Baue also kein satzweises Logging.

### Volumenberechnung (zentrale Kennzahl der Statistik)

**Seiten-Faktor.** `sides = 1` heißt beidseitig gleichzeitig mit Gesamtgewicht bzw. ohne Seitenbezug. `sides = 2` heißt kg pro Hand oder Bein bzw. Wiederholungen oder Sekunden pro Seite (Kurzhantelübungen, einbeinige Maschinen, seitliche Übungen). Alle Formeln unten werden zusätzlich mit `sides` des Eintrags multipliziert. Beispiel Bizepscurls 3 × 10 × 18 kg mit `sides = 2` ergibt 1.080 kg.

- `weight` → Sätze × Wdh × kg
- `assisted` (Gegengewicht, z. B. Klimmzüge und Dips am Unterstützungsgerät) → Sätze × Wdh × max(0, Körpergewicht − Gegengewicht). Körpergewicht kommt aus `gym_settings` (Standard 75 kg, in den Einstellungen änderbar). Kein Körpergewicht-Tracking, nur dieser eine Wert.
- `bodyweight` → Sätze × Wdh × Zusatzgewicht (meist 0). In Diagrammen für solche Übungen stattdessen die Wiederholungen zeigen.
- `time` → kein kg-Volumen, eigene Kennzahl „Haltezeit“ = Sätze × Sekunden × Seiten.

Volumen pro Muskelgruppe: primäre Muskeln zählen 100 %, sekundäre 50 %.

## 6. Design

Stil wie HabitKit. Ultra-clean, viel Weißraum, weiche Karten, Pastellflächen kombiniert mit kräftigen Akzentfarben. Mobile First, aber auch am Laptop angenehm nutzbar (siehe Abschnitt 6.4).

### 6.1 Design-System

- **Hintergrund** sehr helles Warmgrau `#F6F6F8`, **Karten** reines Weiß `#FFFFFF`, stark abgerundet (`rounded-3xl`), sehr dezenter Schatten (`shadow-sm`), feine Trennlinien `#EFEFF2`.
- **Typografie** geometrische Sans-Serif. Fette dunkle Titel `#18181B`, dezente Labels in Großbuchstaben (`text-xs uppercase tracking-wider text-zinc-400`).
- **Farben pro Trainingsart**, jeweils mit heller Pastellvariante (ca. 12–15 % Deckkraft) für Icon-Hintergründe und sekundär trainierte Muskeln.
  - Training 1 Koralle `#F04E5E`
  - Training 2 Kobaltblau `#3B82F6`
  - Training 3 Limettengrün `#84CC16`
  - Cardio Violett `#8B5CF6`
  - Freitraining Bernstein `#F59E0B`
  - Farben sind pro Training in den Einstellungen des Trainings änderbar.
- **Stepper** für Sätze, Wiederholungen und Gewicht mit großen `−`- und `+`-Buttons (`rounded-2xl bg-zinc-100`), Mindestgröße 44 × 44 px, Zahl dazwischen groß und antippbar für direkte Eingabe.
- **Heatmaps** aus abgerundeten Quadraten (`rounded-md`), ähnlich GitHub Contribution Grid.
- **Navigation** als schwebende, abgerundete Pill am unteren Bildschirmrand mit drei Reitern **Training**, **Pläne**, **Statistik**. Einstellungen über ein Zahnrad-Icon im Header.
- Dezente Übergänge, Haptik-Feedback (`navigator.vibrate`, wo verfügbar) beim Abhaken.

### 6.2 Komponente `<MuscleBodySVG />` (Kernfeature)

Wiederverwendbare React-Komponente als sauberes Inline-SVG. Ich reiche eventuell noch Beispielbilder als Stilvorlage nach.

- **Äußere Silhouette.** Glatte, schlichte, durchgängige Außenkontur im Stil eines modernen Piktogramms, ohne einzelne Muskelwölbungen nachzuzeichnen. Ein zusammenhängender `<path>` mit `stroke="#27272A"`, `strokeWidth="2.5"`, `strokeLinejoin="round"`, Füllung `#F8F8FA`.
- **Innere Muskelzonen.** Grob vereinfachte, abgerundete Formen innerhalb der Silhouette, mit etwas Abstand zur Kontur und zueinander.
- **Ansichten.** Vorder- und Rückansicht nebeneinander, dezente Labels `VORNE` und `HINTEN`. Prop `size` (`sm` für Übungskarten, ca. 56 px hoch, `md` für Vorschauen, `lg` für Statistik).
- **Muskel-IDs** (zentral als Konstante mit deutschen Labels definieren)

| ID | Label | Ansicht |
|---|---|---|
| `shoulders` | Schultern | vorne und hinten |
| `chest` | Brust | vorne |
| `biceps` | Bizeps | vorne |
| `abs` | Bauch | vorne |
| `obliques` | Seitliche Bauchmuskeln | vorne |
| `quads` | Oberschenkel vorne | vorne |
| `adductors` | Oberschenkel innen | vorne |
| `upper_back` | Oberer Rücken & Latissimus | hinten |
| `triceps` | Trizeps | hinten |
| `lower_back` | Unterer Rücken | hinten |
| `glutes` | Gesäß | hinten |
| `hamstrings` | Beinbeuger | hinten |
| `calves` | Waden | hinten |

- **Props** `primaryMuscles`, `secondaryMuscles`, `accentColor`, optional `intensity` (Map Muskel → 0…1 für Heatmaps), optional `onMuscleClick` (Filter und Auswahl im Übungseditor), optional `selectable`.
- **Farblogik.** Inaktiv `#E5E5EA`, primär `accentColor`, sekundär Pastellton der `accentColor`. Bei `intensity` wird zwischen Grau und Akzentfarbe interpoliert.
- Zonen sind per Tastatur erreichbar und haben `aria-label`.

### 6.3 Screens

**A) Startseite „Training“**

- Header mit Titel, Sync-Symbol und Zahnrad.
- **Erste Reihe** drei große, gleich breite Buttons für die drei Trainings im Rad. Jeder zeigt Farbe, Namen, Icon und klein das Datum des letzten Mals. Das **als Nächstes fällige Training** ist deutlich hervorgehoben (kräftig gefüllte Akzentfarbe, dickerer Rahmen und kleines Label „ALS NÄCHSTES“), die anderen sind in Pastell dargestellt und trotzdem normal auswählbar.
- Das nächste Training ergibt sich aus der Rotation. Es ist das Training nach dem zuletzt absolvierten Rad-Training (1 → 2 → 3 → 1). Nach dem Import ist das letzte Training vom 19.11.2026 Training 3, also ist Training 1 als Nächstes dran.
- **Darunter** ein Button über die volle Breite für **Cardio** und darunter einer für **Freitraining**.
- Darunter eine Karte „DIESE WOCHE“ mit dem Muskel-Männchen (Intensität aus den letzten 7 Tagen) und einer Mini-Heatmap der letzten Wochen, farbig nach Trainingsart.
- Läuft heute schon ein unfertiges Training, erscheint oben ein Banner „Training fortsetzen“.

**B) Trainingsansicht (nach Tipp auf Training 1, 2 oder 3)**

- Oben Name, Farbe und eine Vorschau `<MuscleBodySVG size="md">`, die alle Übungen des Trainings zusammenfasst (Intensität nach Häufigkeit als primärer bzw. sekundärer Muskel).
- Datum der Einheit ist standardmäßig heute und antippbar, um nachzutragen.
- Liste aller Übungen als Karten in beliebiger Reihenfolge abarbeitbar (ich mache sie je nachdem, welche Geräte frei sind). Jede Karte zeigt
  - Name, darunter klein die Gerätebezeichnung (z. B. „Beine 4C“)
  - Mini-Männchen `size="sm"` mit primären und sekundären Muskeln
  - Werte vom letzten Mal, z. B. „3 × 12 × 130 kg · 19.11.“. Bei `sides = 2` mit dem Zusatz „pro Seite“ bzw. „pro Hand“ oder „pro Bein“
  - rechts einen großen runden Haken-Button **„wie letztes Mal“**. Ein Tipp speichert sofort die Werte vom letzten Mal.
- Tipp auf die Karte klappt sie auf. Dort gibt es drei Stepper (Sätze, Wdh, kg bzw. Sekunden bei Zeitübungen), vorbelegt mit den Werten vom letzten Mal, sodass ich nur den einen Parameter ändere, der sich geändert hat. Der kg-Schritt kommt aus `weight_step` der Übung. Bei Gegengewicht-Übungen heißt das Feld „Unterstützung kg“, bei `sides = 2` „kg pro Seite“.
- Im aufgeklappten Zustand außerdem ein kleiner Schalter „↑ Nächstes Mal steigern“ und ein optionales Notizfeld.
- Erledigte Übungen werden abgehakt dargestellt (Häkchen, gedämpft) und rutschen ans Ende der Liste. Erneutes Antippen erlaubt Korrektur oder Rückgängig.
- **Steigerungshinweis.** Wurde beim letzten Mal „Nächstes Mal steigern“ gesetzt, zeigt die Karte einen kleinen Chip „↑ steigern“ neben den letzten Werten. Er soll kaum Platz brauchen und nicht aufdringlich sein.
- Jeder Eintrag wird sofort lokal gespeichert (kein Datenverlust beim Schließen). Die Einheit wird beim ersten Abhaken angelegt. Unten ein Button „Training beenden“, der `finished_at` setzt und eine kurze Zusammenfassung (Übungen, Volumen, Vergleich zum letzten Mal dieses Trainings) zeigt.
- Über „+ Übung“ kann ich spontan eine Übung aus der Bibliothek ergänzen oder eine Übung für heute auslassen, ohne den Plan zu ändern.

**C) Freitraining**

Leere Einheit, Übungen kommen über eine durchsuchbare Bibliothek dazu (Filter per Antippen eines Muskels am Männchen). Danach gleiche Karten und Logik wie in B.

**D) Cardio**

- Auswahl der Cardio-Art als Kachel-Grid. Vorbelegt sind **Stairmaster**, **Laufband**, **Rudergerät**, **Crosstrainer**, **Ergometer**, **Schwimmen** (Distanz in m) und **Wandern**. Über „+ Eigene Art“ kann ich weitere anlegen (Name, Icon, Distanzeinheit).
- Eingabe von Dauer (min), Kalorien, Ø Puls und Distanz. Alle Felder sind optional, aber mindestens eines muss ausgefüllt sein. Optional Notiz.
- Mehrere Cardio-Einträge an einem Tag und Cardio zusätzlich zu einem Krafttraining sind möglich.

**E) Reiter „Pläne“**

- Liste der Trainings (Rad-Trainings oben mit Reihenfolge, weitere darunter). Trainings anlegen, umbenennen, Farbe und Icon wählen, archivieren, Rotation ein- und ausschalten sowie die Reihenfolge im Rad ändern.
- Im Training Übungen hinzufügen (aus der Bibliothek), entfernen und per Drag & Drop für die Anzeige sortieren. Die Vorschau mit dem Männchen aktualisiert sich live.
- **Übungsbibliothek** als eigener Bereich in diesem Reiter. Übungen anlegen und bearbeiten mit Name, Gerätebezeichnung, Lasttyp, Seiten (beidseitig oder pro Seite), kg-Schritt, Notiz (Ausführung, Geräteeinstellung wie „Einstellung 7“) und Muskeln. Primäre und sekundäre Muskeln wähle ich durch Antippen am großen Männchen (einmal Tippen primär, zweimal sekundär, dreimal aus). Übungen mit Historie werden archiviert statt gelöscht.

**F) Reiter „Statistik“**

Zeitraumfilter oben (4 Wochen, 3 Monate, 12 Monate, alles). Wichtigste Kennzahl ist das **Gesamtvolumen**.

1. **Volumen** pro Einheit als Balken, gefärbt nach Training, plus Wochen- bzw. Monatssummen umschaltbar. Vergleich zum vorherigen Zeitraum in Prozent.
2. **Trainingstage** als Kalender-Heatmap (Squircles, Farbe nach Trainingsart), Trainings pro Woche, aktuelle Serie an Wochen mit mindestens zwei Einheiten.
3. **Muskelgruppen** als großes Männchen mit Intensität nach Volumen im Zeitraum plus sortierte Balkenliste je Muskelgruppe. Tipp auf einen Muskel zeigt die beteiligten Übungen.
4. **Pro Übung** eine Detailansicht mit Verlauf von Gewicht und Volumen (Linien), Bestwert, erstem und letztem Eintrag und allen Einträgen als Liste.
5. **Cardio** mit Minuten, Kalorien und Distanz pro Woche, aufteilbar nach Art.
6. **Verlauf** als chronologische Liste aller Einheiten. Jede Einheit lässt sich öffnen, bearbeiten (Werte, Datum, Notiz) und löschen.

**G) Einstellungen (Zahnrad)**

Körpergewicht für die Volumenberechnung, Excel-Export, Excel-Import, Sync jetzt auslösen, Abmelden, App-Version.

### 6.4 Laptop und Desktop

Ab ca. 1024 px Breite wird die Bottom-Pill zu einer schmalen Seitenleiste, Inhalte bekommen eine maximale Breite und nutzen zwei Spalten (z. B. Übungsliste links, Detail oder Vorschau rechts, Statistik als Raster). Alle Funktionen inklusive Export und Import funktionieren auch im normalen Browser ohne Installation.

## 7. Excel-Export

Button in den Einstellungen, funktioniert am Handy und am Laptop. Dateiname `Training_Export_JJJJ-MM-TT.xlsx`. Blätter

1. **Krafttraining** im Langformat. Datum, Art (Training 1/2/3, Frei), Trainingsname, Übung, Gerätebezeichnung, Lasttyp, Seiten, Sätze, Wdh, kg, Sekunden, Volumen, Steigern vorgemerkt, Notiz.
2. **Matrix** im Format meiner alten Liste. Eine Zeile pro Datum, pro Übung drei Spalten (Set., Whg., kg), zweizeiliger Kopf mit verbundenen Zellen für den Übungsnamen. So kann ich notfalls in meinem alten Excel weiterarbeiten.
3. **Cardio**. Datum, Art, Dauer, kcal, Ø Puls, Distanz, Einheit, Notiz.
4. **Übungen**. Alle Übungen mit Muskeln, Lasttyp, Notizen.
5. **Pläne**. Trainings mit ihren Übungen und der Rotationsreihenfolge.

Zusätzlich ein Button „Vollständiges Backup (JSON)“, das alle `gym_`-Daten als Datei exportiert und wieder einspielen kann.

## 8. Import meiner bisherigen Excel-Liste

Einmaliger Import über die Einstellungen („Altes Excel importieren“). Die Datei wird im Browser geparst, nicht hochgeladen und nicht ins Repo gelegt. Vor dem Speichern zeigt eine **Vorschau** die erkannten Einheiten, Übungen, den Zeitraum und Warnungen. Erst nach Bestätigung wird geschrieben. Importierte Einheiten bekommen `source = 'import'`, sodass ein Import auch rückgängig gemacht werden kann („Alle importierten Daten löschen“).

### 8.1 Aufbau der Datei

- Relevant ist nur das Blatt **„Eingabe“**. Alle anderen Blätter (Diagrammblätter und „Gewicht“) ignorieren.
- Zeile 1 enthält die Übungsnamen (über die zugehörigen Spalten verbunden), Zeile 2 die Unterköpfe, Daten ab Zeile 3.
- Spalte A Datum, Spalte B „Phys.“ (Physiotherapie, **ignorieren**), Spalte BN „Bemerkung“.
- Spaltengruppen (Kopfzeilen dynamisch lesen, diese Tabelle als Referenz und Fallback)

| Spalten | Excel-Name | Unterköpfe |
|---|---|---|
| C–E | Arme 1 | Set., Whg., kg |
| F–H | Biz. Curls | Set., Whg., kg |
| I–K | Dips | Set., Whg., kg |
| L–N | Seitheben | Set., Whg., kg |
| O–Q | Schultern 3 | Set., Whg., kg |
| R–T | Brust 2A | Set., Whg., kg |
| U–W | Rücken | Set., Whg., kg |
| X–Y | Bauch 3 | Set., Whg. |
| Z–AB | Bauch A4 | Set., Whg., kg |
| AC–AE | Leg Raises | Set., Whg., kg |
| AF–AH | seitl. Bauch | Set., Whg., kg |
| AI–AK | Unter. Rück. 2 | Set., Whg., kg |
| AL–AM | Planken | Set., sek. |
| AN–AO | seitl.Plan. | Set., sek. |
| AP–AR | Kniebeugen | Set., Whg., kg |
| AS–AU | Beine 2A | Set., Whg., kg |
| AV–AX | Beine 3C | Set., Whg., kg |
| AY–BA | Beine 4C | Set., Whg., kg |
| BB–BD | O.Schenk. | (BB ohne Kopf, ist aber Set.), Whg., kg |
| BE–BG | Gesäss 1 | Set., Whg., kg |
| BH–BJ | Gesäss 2 | Set., Whg., kg |
| BK–BM | Klimmzug | Set., Whg., kg |

### 8.2 Parsing-Regeln

- Zeilen ohne Datum und Datumszeilen ohne eine einzige Übung überspringen.
- Eine Übung zählt für ein Datum, sobald eine ihrer Zellen gefüllt ist. Fehlende Sätze sinnvoll mit 3 auffüllen und als Warnung in der Vorschau listen.
- Zahlen können als Text mit Punkt am Ende vorliegen (z. B. `"55."`, `"60."`), diese als Zahl parsen.
- Bei Planken und seitlichem Planken ist der zweite Wert Sekunden (`seconds`).
- **Dips aufteilen.** Bis einschließlich 16.11.2023 war die Spalte „Dips“ die Trizepsmaschine (steigendes Gewicht), ab 17.11.2023 Dips am Unterstützungsgerät (kg = Gegengewicht, sinkend bis 0). Import daher in zwei Übungen „Trizepsmaschine“ (archiviert, `weight`) und „Dips“ (`assisted`).
- **Klimmzug** ist durchgehend `assisted` (kg = Gegengewicht der Unterstützung, bestätigt). In meiner Excel war das Volumen Sätze × Wdh × (75 − kg). Dasselbe gilt für Dips ab 17.11.2023.
- **Schulterdrücken aufteilen.** Bis einschließlich 05.01.2025 war „Schultern 3“ ein Schultergerät (Werte bis 75 kg), ab 06.01.2025 Kurzhanteln (kg pro Hand, ab 14 kg). Import daher in „Schulterdrücken Maschine“ (archiviert, `weight`, `sides = 1`) und „Schulterdrücken Kurzhantel sitzend“ (`sides = 2`).
- **Seiten beim Import.** `sides` kommt aus der Übung laut `Uebungen.md`, mit zwei Ausnahmen für die Zeit vor der Umstellung auf einbeinig. „Beine 4C“ vor dem 25.02.2023 und „Beine 3C“ vor dem 16.04.2023 bekommen `sides = 1`.
- Durch den Seiten-Faktor liegt das Volumen der App bei diesen Übungen bewusst über den Werten der alten Excel. Das ist gewollt und soll in der Import-Vorschau kurz erwähnt werden.
- Bemerkungen werden zur Notiz der Einheit dieses Tages.
- Pro Datum eine Einheit anlegen. **Zuordnung zum Training.** Pro Einheit zählen, wie viele Übungen zu Training 1, 2 bzw. 3 gehören (Tabelle 9). Zuordnung zum Training mit den meisten Treffern, wenn mindestens 2 Übungen und mindestens 60 % der Übungen des Tages dazu passen. Sonst `kind = 'free'` mit Notiz „Import, keinem Training zugeordnet“.
- **Erwartete Prüfwerte** (in der Vorschau anzeigen und mit diesen Zahlen abgleichen). 699 Trainingstage vom 10.10.2022 bis 19.11.2026, 36 Bemerkungen. Die letzten drei Tage sind 16.11.2026 (Training 1), 17.11.2026 (Training 2) und 19.11.2026 (Training 3).

## 9. Startdaten (Übungen und Trainings)

Lege diese Übungen und die drei Rad-Trainings beim ersten Start an (bzw. beim Import, falls noch nicht vorhanden). **Ausführung, Lasttyp und Muskelzuordnung jeder Übung stehen verbindlich in der beiliegenden Datei `Uebungen.md`.** Übernimm die Ausführungsbeschreibung von dort in das Feld `notes` der Übung. Die Gerätebezeichnung (`short_name`) ist jeweils der Excel-Name. Alles ist später in der App änderbar.

**Training 1 „Oberkörper“** (Koralle, Icon `Dumbbell`)

| Excel-Name | App-Name | Lasttyp | Seiten | Primär | Sekundär |
|---|---|---|---|---|---|
| Biz. Curls | Bizepscurls Kurzhantel | weight | 2 | biceps | |
| Dips | Dips am Barren | assisted | 1 | triceps, chest | shoulders |
| Schultern 3 | Schulterdrücken Kurzhantel sitzend | weight | 2 | shoulders | triceps, upper_back |
| Brust 2A | Butterfly Maschine | weight | 1 | chest | shoulders |
| Rücken | Rudern sitzend Maschine | weight | 1 | upper_back | biceps, shoulders |
| seitl.Plan. | Seitstütz | time | 2 | obliques | abs, shoulders |
| Kniebeugen | Goblet Squat | weight | 1 | quads, glutes | adductors, abs |

**Training 2 „Beine & Po“** (Kobaltblau, Icon `Footprints`)

| Excel-Name | App-Name | Lasttyp | Seiten | Primär | Sekundär |
|---|---|---|---|---|---|
| Bauch A4 | Bauchmaschine | weight | 1 | abs | obliques |
| Planken | Unterarmstütz | time | 1 | abs | obliques, shoulders |
| Beine 2A | Beinbeuger sitzend | weight | 1 | hamstrings | calves |
| Beine 3C | Beinpresse liegend, einbeinig | weight | 2 | quads, glutes | hamstrings, adductors |
| O.Schenk. | Seitliche Ausfallschritte Sandsack | weight | 2 | adductors, quads, glutes | hamstrings |
| Gesäss 1 | Abduktorenmaschine | weight | 1 | glutes | |
| Gesäss 2 | Adduktorenmaschine | weight | 1 | adductors | |

**Training 3 „Rücken & Core“** (Limettengrün, Icon `Activity`)

| Excel-Name | App-Name | Lasttyp | Seiten | Primär | Sekundär |
|---|---|---|---|---|---|
| Seitheben | Seitheben Kurzhantel | weight | 2 | shoulders | upper_back |
| Leg Raises | Beinheben am Beinhebegerät | bodyweight | 1 | abs | obliques |
| seitl. Bauch | Rotation kniend | weight | 2 | obliques | abs |
| Unter. Rück. 2 | Rückenstrecker Maschine | weight | 1 | lower_back | glutes, hamstrings |
| Beine 4C | Wadenheben stehend Maschine, einbeinig | weight | 2 | calves | |
| Klimmzug | Klimmzüge breit | assisted | 1 | upper_back | biceps, shoulders |

**Archiviert** (nur für die Historie)

| Excel-Name | App-Name | Lasttyp | Seiten | Primär |
|---|---|---|---|---|
| Arme 1 | Bizepsmaschine | weight | 1 | biceps |
| Dips bis 16.11.2023 | Trizepsmaschine | weight | 1 | triceps |
| Schultern 3 bis 05.01.2025 | Schulterdrücken Maschine | weight | 1 | shoulders |
| Bauch 3 | Crunches | bodyweight | 1 | abs |

kg-Schritte stehen in `Uebungen.md` (Kurzhanteln 1 bis 2 kg, Maschinen 5 kg, Zeitübungen 15 s).

## 10. Qualität und Details

- Lighthouse PWA installierbar, App startet offline, keine Konsolenfehler.
- Safe-Area-Insets für iPhone (Notch, Home-Indicator), keine horizontale Scrollbar, Eingaben ohne Zoom auf iOS (Schriftgröße ≥ 16 px in Inputs).
- Ladezustände und leere Zustände gestalten (z. B. „Noch keine Einheit in diesem Zeitraum“).
- Unit-Tests (Vitest) für Volumenberechnung inkl. Seiten-Faktor und Gegengewicht, Rotation („als Nächstes“), Import-Parser inkl. Dips- und Schulter-Aufteilung, Seiten-Ausnahmen für 3C und 4C und Trainingszuordnung, Sync-Konfliktlogik.
- Saubere Ordnerstruktur, TypeScript strikt, Supabase-Typen generiert oder handgeschrieben in `src/types/db.ts`.

## 11. Deployment

- GitHub-Actions-Workflow, der bei Push auf `main` baut und auf GitHub Pages deployt.
- `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` als Repository-Variablen bzw. Secrets (der Anon-Key ist durch RLS abgesichert und landet ohnehin im Bundle).
- Beschreib mir in der README in wenigen Schritten, wie ich die Migration ausführe, die Variablen setze, Pages aktiviere und die App auf iPhone (Safari, „Zum Home-Bildschirm“), Android (Chrome, „App installieren“) und Windows (Edge oder Chrome, „Installieren“) installiere.
- Falls der Habit Tracker Redirect-URLs in Supabase Auth benötigt, die neue Pages-URL nur **ergänzen**, nichts entfernen. Frag mich vorher.

## 12. Vorgehen in Phasen

1. **Setup und Design-System.** Projekt, Tailwind-Tokens, Grundlayout mit Navigation, `<MuscleBodySVG />` mit Demo-Seite aller Zustände. Danach Screenshot oder Vorschau an mich.
2. **Datenbasis.** SQL-Migration, Auth-Screen, Dexie-Schema, Sync-Engine mit Outbox, Seed-Daten aus Abschnitt 9.
3. **Training loggen.** Startseite mit Rad-Hervorhebung, Trainingsansicht mit „wie letztes Mal“, Steppern und Steigerungshinweis, Freitraining, Cardio.
4. **Pläne und Bibliothek.** Trainings und Übungen verwalten, Muskelauswahl am Männchen.
5. **Import und Export.** Import mit Vorschau und Prüfwerten, Excel-Export mit allen Blättern, JSON-Backup.
6. **Statistik.** Alle Ansichten aus 6.3 F.
7. **Feinschliff und Deployment.** Desktop-Layout, PWA-Prüfung, Tests, GitHub Pages, README.

Halte nach jeder Phase kurz fest, was fertig ist und was offen bleibt, und warte auf mein Okay, bevor du die nächste Phase beginnst.
