# Trainings-App

Private Trainings-PWA von Felix (React, TypeScript, Vite, Tailwind, Dexie, Supabase). Der Auftrag steht in `Prompt_Trainings-App.md`, die Übungen in `Uebungen.md` (bei Widerspruch gilt `Uebungen.md`).

## Regeln

- **App-Name: immer „Trainings-App“.** Niemals „Rad“ als Name der App verwenden (nicht in Titel, Manifest, Login, README, Dateinamen, Datenbanknamen oder Code-Bezeichnern). „Rotation“ ist der Begriff für die drei Haupt-Trainings, die der Reihe nach drankommen.
- Nach jeder Phase (Abschnitt 12 im Prompt) kurz Stand und Offenes berichten und auf das Okay warten.
- Supabase-Projekt wird mit dem Habit Tracker geteilt: nur Tabellen mit Präfix `gym_` anfassen, Auth-Einstellungen nie ohne Rückfrage ändern. Datenbankänderungen nur als SQL-Datei unter `supabase/migrations/`, die Felix selbst ausführt.
- Geheimnisse (`.env`, `private/`, `*.xlsx`) nie committen. Kein Service-Role-Key.
- Sprache der Oberfläche Deutsch, Einheiten metrisch, Datum TT.MM.JJJJ, Woche ab Montag.
- Nichts committen oder pushen ohne Aufforderung.

## Aufbau und Einrichtung

Verzeichnisstruktur, Supabase-Einrichtung, Veröffentlichung auf GitHub Pages und Installation stehen in `README.md`. Alle Daten werden lokal zuerst in Dexie geschrieben und über eine Outbox synchronisiert (`src/db/repo.ts`, `src/sync/`). Der Ordner `design/` enthält nur Entwürfe des Muskel-Männchens.

## Befehle

- `npm run check` führt Typen, Lint, Tests und Build in einem Lauf aus

- `npm run dev` startet die App unter `http://localhost:5173/trainingsapp/`
- `npm test`, `npm run lint`, `npm run build`
- `npm run icons` erzeugt die PWA-Icons aus `public/icon.svg`
