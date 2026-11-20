# Trainings-App

Private Trainings-App (PWA) für Krafttraining, Cardio und freie Einheiten. Läuft auf iPhone, Android und am Windows-Laptop, speichert zuerst auf dem Gerät und gleicht sich mit Supabase ab. Die App ist nur für eine Person gedacht und kostenlos betreibbar.

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, PWA (Service Worker, installierbar)
- **Lokale Daten:** Dexie (IndexedDB), alles funktioniert auch ohne Netz
- **Server:** Supabase (Anmeldung mit E-Mail und Passwort, Tabellen mit Präfix `gym_`, Row Level Security)
- **Veröffentlichung:** GitHub Pages über GitHub Actions

Der Code darf öffentlich sein, deine Trainingsdaten sind es nie: Sie liegen nur in deiner Supabase-Datenbank und sind dort durch Row Level Security geschützt. Im Repository stehen keine Zugangsdaten. Der öffentliche Anon-Key landet absichtlich im Browser-Paket, er allein gibt ohne Anmeldung keinen Zugriff.

## 1. Einrichtung in Supabase

Die App nutzt das bestehende Supabase-Projekt des Habit Trackers mit. Tabellen ohne Präfix `gym_` gehören dem Habit Tracker und werden nie gelesen oder verändert.

1. Öffne im Supabase-Dashboard den **SQL-Editor**.
2. Führe den Inhalt von [`supabase/migrations/001_gym_schema.sql`](supabase/migrations/001_gym_schema.sql) aus. Das legt die acht `gym_`-Tabellen mit Row Level Security, Rechten und dem Trigger für „letzte Änderung gewinnt“ an. Das Skript ist wiederholbar.
3. Falls die App beim ersten Start „permission denied for table gym_…“ meldet (Projekte, die Tabellenrechte nicht automatisch vergeben), führe zusätzlich [`supabase/migrations/002_gym_grants.sql`](supabase/migrations/002_gym_grants.sql) aus. Frische Installationen bekommen die Rechte schon aus 001.
4. Melde dich in der App mit dem Konto an, das auch der Habit Tracker verwendet (**Authentication > Users**). Es gibt bewusst kein Registrierungsformular.

Die Auth-Einstellungen des Projekts musst du für die App nicht ändern. Die Anmeldung läuft mit E-Mail und Passwort, es werden keine Weiterleitungs-URLs gebraucht. Brauchst du für den Habit Tracker die neue Seite doch einmal als Redirect-URL, ergänze sie nur und entferne nichts.

## 2. Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```powershell
npm install
copy .env.example .env
```

Trage in der Datei `.env` die **Project URL** und den **Publishable- bzw. Anon-Key** ein (Supabase: **Project Settings > API**). Niemals den Service-Role-Key verwenden. Die Datei `.env` steht in der `.gitignore` und wird nicht committet.

```powershell
npm run dev
```

Die App läuft dann unter `http://localhost:5173/trainingsapp/`.

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm run check` | Typen, Lint, Tests und Build in einem Lauf |
| `npm test` | Unit-Tests (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Produktions-Build in `dist/` |
| `npm run icons` | PWA-Icons neu aus `public/icon.svg` erzeugen |

## 3. Auf GitHub Pages veröffentlichen

1. Lege auf GitHub ein **öffentliches** Repository mit dem Namen `trainingsapp` an. Der Name steckt im Pfad der Seite (`base` in `vite.config.ts`). Nutzt du einen anderen Namen, ändere dort `base` entsprechend.
2. Lade den Code hoch:

   ```powershell
   git init
   git add .
   git commit -m "Trainings-App"
   git branch -M main
   git remote add origin https://github.com/<dein-benutzername>/trainingsapp.git
   git push -u origin main
   ```

   Vorher prüfen: `git status` darf weder `.env`, den Ordner `private/` noch eine `.xlsx`-Datei auflisten. Sie sind in der `.gitignore` ausgenommen.
3. Öffne im Repository **Settings > Secrets and variables > Actions > Variables** und lege zwei **Repository-Variablen** an:
   - `VITE_SUPABASE_URL` mit der Project URL
   - `VITE_SUPABASE_ANON_KEY` mit dem Publishable- bzw. Anon-Key
4. Öffne **Settings > Pages** und wähle bei **Source** den Eintrag **GitHub Actions**.
5. Der Workflow [`deploy.yml`](.github/workflows/deploy.yml) läuft bei jedem Push auf `main`: Er prüft Typen, Lint und Tests, baut die App und veröffentlicht sie. Den Stand siehst du im Reiter **Actions**.
6. Die App erreichst du danach unter `https://<dein-benutzername>.github.io/trainingsapp/`.

## 4. Installieren

Öffne die Adresse aus Schritt 3 einmal mit Netz, melde dich an und warte kurz, bis die erste Synchronisation durch ist. Danach startet die App auch ohne Netz.

- **iPhone (Safari):** Teilen-Symbol, dann **Zum Home-Bildschirm**. Die App muss aus Safari installiert werden, nicht aus einem anderen Browser.
- **Android (Chrome):** Menü (drei Punkte), dann **App installieren** bzw. **Zum Startbildschirm hinzufügen**.
- **Windows (Edge oder Chrome):** In der Adresszeile auf das Installieren-Symbol klicken oder im Menü **Installieren**. Alle Funktionen, auch Export und Import, gehen ebenso im normalen Browser ohne Installation.

Updates kommen automatisch: Nach einem neuen Deployment lädt die App die neue Version im Hintergrund und nutzt sie beim nächsten Start.

## 5. Daten übernehmen und sichern

Alles unter **Einstellungen > Daten**:

- **Altes Excel importieren:** Wähle deine bisherige Liste (Blatt „Eingabe“). Die Datei wird nur im Browser gelesen, nicht hochgeladen. Eine Vorschau zeigt Einheiten, Zeitraum, Zuordnung, Prüfwerte und Warnungen. Erst nach „Importieren“ wird gespeichert. Ein zweiter Import erzeugt keine Dubletten, „Alle importierten Daten löschen“ macht ihn rückgängig. Die Excel-Datei gehört nie ins Repository.
- **Excel exportieren:** `Training_Export_JJJJ-MM-TT.xlsx` mit den Blättern Krafttraining, Matrix, Cardio, Übungen und Pläne.
- **Vollständiges Backup (JSON):** Sichert alle Daten in eine Datei und spielt sie wieder ein.

## 6. Wichtige Regeln im Alltag

- **Zuerst lokal:** Jede Eingabe landet sofort auf dem Gerät und wird bei Netz im Hintergrund hochgeladen. Die Wolke oben rechts zeigt den Stand (synchron, ausstehend mit Anzahl, offline, Fehler).
- **Letzte Änderung gewinnt:** Wurde dieselbe Zeile auf zwei Geräten geändert, gilt die jüngere Änderung.
- **Abmelden** löscht die lokalen Daten dieses Geräts. Sind noch nicht hochgeladene Änderungen vorhanden, warnt die App vorher.
- **Volumen:** Sätze × Wiederholungen × kg, bei Übungen „pro Seite“ mit 2 multipliziert, bei Gegengewicht-Übungen mit (Körpergewicht − Gegengewicht). Das Körpergewicht stellst du in den Einstellungen ein.

## 7. Aufbau des Projekts

```text
src/
  auth/        Anmeldung und Start (Login-Sperre, erster Abgleich)
  backup/      JSON-Backup und Wiederherstellung
  components/  Oberfläche (Layout, Männchen, Training, Statistik, Bausteine)
  data/        Abfragen und Schreibzugriffe (Einheiten, Pläne, Einstellungen)
  db/          Dexie-Schema und lokal-zuerst-Schreiben mit Outbox
  export/      Excel-Export
  import/      Excel-Import (Lesen, Parsen, Zuordnung, Schreiben)
  lib/         Hilfen (Datum, Volumen, Rotation, Farben)
  pages/       Seiten
  seed/        Startdaten aus Uebungen.md
  stats/       Berechnungen der Statistik
  sync/        Synchronisation mit Supabase
supabase/migrations/   SQL, das du im SQL-Editor ausführst
Prompt_Trainings-App.md, Uebungen.md   Auftrag und Übungsbeschreibungen
```
