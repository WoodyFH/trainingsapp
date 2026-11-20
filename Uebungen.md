# Übungsbeschreibungen (Referenz für die Trainings-App)

Diese Datei beschreibt, wie Felix jede Übung tatsächlich ausführt. Sie ist die verbindliche Grundlage für App-Namen, Lasttyp, Einheiten und die Muskelzuordnung im Muskel-Männchen. Bei Widerspruch zum Haupt-Prompt gilt diese Datei.

**Muskel-IDs** wie im Haupt-Prompt (`shoulders`, `chest`, `biceps`, `triceps`, `abs`, `obliques`, `upper_back`, `lower_back`, `glutes`, `quads`, `hamstrings`, `adductors`, `calves`).

**Lasttypen.** `weight` = Gewicht, `assisted` = Gegengewicht am Unterstützungsgerät, `bodyweight` = Körpergewicht mit optionalem Zusatzgewicht, `time` = Haltezeit in Sekunden.

**Seiten.** `1` heißt beidseitig gleichzeitig mit Gesamtgewicht bzw. ohne Seitenbezug. `2` heißt Gewicht pro Hand oder Bein bzw. Wiederholungen oder Sekunden pro Seite. Das Volumen wird mit diesem Faktor multipliziert (z. B. Bizepscurls 3 Sätze × 10 Wdh × 18 kg × 2 Seiten = 1.080 kg).

Alle Übungen werden in 3 Sätzen protokolliert, pro Übung ein Eintrag (keine Einzelsätze).

---

## Training 1 „Oberkörper“

### Bizepscurls Kurzhantel, stehend alternierend
| | |
|---|---|
| Excel-Name | Biz. Curls |
| Ausrüstung | Zwei Kurzhanteln |
| Ausführung | Im Stehen, Arme abwechselnd. Start mit ausgestrecktem, hängendem Arm (seit 28.02.2025 bewusst aus voller Streckung). Beim Hochbeugen wird der Unterarm um eine Vierteldrehung nach außen gedreht (Supination), sodass die Handfläche oben zur Schulter zeigt, dann kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 2 |
| Seiten | 2 (kg pro Hand, Wiederholungen pro Arm, z. B. 10 × rechts und 10 × links mit je 18 kg pro Satz) |
| Primär | biceps |
| Sekundär | – |

### Dips am Barren
| | |
|---|---|
| Excel-Name | Dips (ab 17.11.2023) |
| Ausrüstung | V-förmiger Dip-Barren |
| Ausführung | Stütz am Barren, Körper absenken bis etwa 90 Grad im Ellbogen, wieder hochdrücken. Aktuell ohne Zusatzgewicht. |
| Lasttyp | assisted (kg = Gegengewicht der Unterstützung, aktuell 0) |
| Seiten | 1 |
| Primär | triceps, chest |
| Sekundär | shoulders |
| Hinweis | Die Werte von 25 kg sinkend auf 0 (Nov. 2023 bis Okt. 2024) waren das Gegengewicht am Unterstützungsgerät. Volumen = Sätze × Wdh × (Körpergewicht − Gegengewicht). |

### Schulterdrücken Kurzhantel, sitzend
| | |
|---|---|
| Excel-Name | Schultern 3 (ab 06.01.2025) |
| Ausrüstung | Zwei Kurzhanteln, Bank mit Rückenlehne |
| Ausführung | Sitzend, Rücken angelehnt, beide Hanteln gleichzeitig möglichst gerade nach oben drücken und kontrolliert zurück. Seit 06.01.2025 mit Kurzhanteln. Die Excel-Werte davor (bis 75 kg) stammen von Schultergeräten und laufen als eigene archivierte Übung „Schulterdrücken Maschine“. |
| Lasttyp | weight, kg-Schritt 2 |
| Seiten | 2 (kg pro Hand, beide Arme gleichzeitig) |
| Primär | shoulders |
| Sekundär | triceps, upper_back |

### Butterfly Maschine (Pec Deck)
| | |
|---|---|
| Excel-Name | Brust 2A |
| Ausrüstung | Butterfly-Maschine mit Unterarmpolstern |
| Ausführung | Sitzend, Unterarme liegen an den Polstern, Arme vor dem Körper zusammenführen und kontrolliert öffnen. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | chest |
| Sekundär | shoulders |

### Rudern sitzend Maschine
| | |
|---|---|
| Excel-Name | Rücken |
| Ausrüstung | Rudermaschine |
| Ausführung | Sitzend, Griffe nach hinten zum Körper ziehen, Schulterblätter zusammenführen, kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | upper_back |
| Sekundär | biceps, shoulders |

### Seitstütz
| | |
|---|---|
| Excel-Name | seitl.Plan. |
| Ausrüstung | keine |
| Ausführung | Seitlicher Unterarmstütz, Körper gerade, pro Seite gehalten. |
| Lasttyp | time, Schritt 15 s |
| Seiten | 2 (Sekunden pro Seite, z. B. 75 s links und 75 s rechts) |
| Primär | obliques |
| Sekundär | abs, shoulders |

### Goblet Squat
| | |
|---|---|
| Excel-Name | Kniebeugen |
| Ausrüstung | Ein Gewicht (Kurzhantel oder Kettlebell) vor der Brust |
| Ausführung | Gewicht mit beiden Händen vor der Brust halten, normale Kniebeuge, aufrechter Oberkörper. |
| Lasttyp | weight, kg-Schritt 2 |
| Seiten | 1 |
| Primär | quads, glutes |
| Sekundär | adductors, abs |

---

## Training 2 „Beine & Po“

### Bauchmaschine (Crunch sitzend)
| | |
|---|---|
| Excel-Name | Bauch A4 |
| Ausrüstung | Bauchmaschine mit Griffen hinter dem Kopf und Fußrolle |
| Ausführung | Sitzend, Hände greifen die Griffe hinter dem Kopf, Knöchel unter der Rolle eingehakt. Oberkörper aus dem Sitzen nach vorne einrollen (Crunch-Bewegung), kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | abs |
| Sekundär | obliques |

### Unterarmstütz (Plank)
| | |
|---|---|
| Excel-Name | Planken |
| Ausrüstung | keine |
| Ausführung | Klassischer Unterarmstütz, Körper in einer Linie. |
| Lasttyp | time, Schritt 15 s |
| Seiten | 1 |
| Primär | abs |
| Sekundär | obliques, shoulders |

### Beinbeuger sitzend
| | |
|---|---|
| Excel-Name | Beine 2A |
| Ausrüstung | Beinbeuger-Maschine (Einstellung 7 laut Bemerkung von 2023) |
| Ausführung | Sitzend, Beine starten gestreckt, Knie beugen und das Polster zum Körper ziehen, kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | hamstrings |
| Sekundär | calves |

### Beinpresse liegend
| | |
|---|---|
| Excel-Name | Beine 3C |
| Ausrüstung | Liegende Beinpresse mit einstellbarem Gewicht |
| Ausführung | Im Liegen, Füße gegen die Platte, Bewegung wie eine Kniebeuge im Liegen. Seit 16.04.2023 einbeinig. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 2 (einbeinig, kg und Wiederholungen pro Bein). Einträge vor dem 16.04.2023 waren beidbeinig, also 1. |
| Primär | quads, glutes |
| Sekundär | hamstrings, adductors |

### Seitliche Ausfallschritte mit Sandsack
| | |
|---|---|
| Excel-Name | O.Schenk. |
| Ausrüstung | Sandsack |
| Ausführung | Mit dem Sandsack seitliche Ausfallschritte zu beiden Seiten. |
| Lasttyp | weight, kg-Schritt 5 (kg = Gewicht des Sandsacks) |
| Seiten | 2 (Wiederholungen pro Seite) |
| Primär | adductors, quads, glutes |
| Sekundär | hamstrings |

### Abduktorenmaschine
| | |
|---|---|
| Excel-Name | Gesäss 1 |
| Ausrüstung | Abduktoren-Maschine |
| Ausführung | Sitzend mit geschlossenen Beinen starten und die Polster mit den Knien nach außen drücken, kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | glutes |
| Sekundär | – |

### Adduktorenmaschine
| | |
|---|---|
| Excel-Name | Gesäss 2 |
| Ausrüstung | Adduktoren-Maschine |
| Ausführung | Sitzend mit gespreizten Beinen starten und die Polster nach innen zusammendrücken, kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | adductors |
| Sekundär | – |
| Hinweis | Trotz des Excel-Namens „Gesäss 2“ ist das eine Innenschenkel-Übung. |

---

## Training 3 „Rücken & Core“

### Seitheben Kurzhantel
| | |
|---|---|
| Excel-Name | Seitheben |
| Ausrüstung | Zwei Kurzhanteln |
| Ausführung | Im Stehen, Hanteln seitlich anheben, als würde man über die Ellbogen nach oben ziehen, bis etwa Schulterhöhe, kontrolliert ab. |
| Lasttyp | weight, kg-Schritt 1 |
| Seiten | 2 (kg pro Hand, beide Arme gleichzeitig) |
| Primär | shoulders |
| Sekundär | upper_back |

### Beinheben am Beinhebegerät
| | |
|---|---|
| Excel-Name | Leg Raises |
| Ausrüstung | Beinhebegerät (Captain's Chair) mit Unterarmpolstern und Rückenpolster |
| Ausführung | Unterarme auf den Polstern abgestützt, Rücken am Rückenpolster, die Beine hängen frei. Gestreckte Beine aus der senkrechten Position bis etwa 90 Grad nach vorne heben, kontrolliert ab. Nur die Beine bewegen sich. |
| Lasttyp | bodyweight |
| Seiten | 1 |
| Primär | abs |
| Sekundär | obliques |

### Rotation kniend
| | |
|---|---|
| Excel-Name | seitl. Bauch |
| Ausrüstung | Rotationsgerät mit drehbarer Kniefläche |
| Ausführung | Auf der drehbaren Plattform knien und aus etwa 45 Grad seitlich rotieren, 12 Wiederholungen nach links und 12 nach rechts. Die frontale Variante wird nicht gemacht. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 2 (Wiederholungen pro Seite) |
| Primär | obliques |
| Sekundär | abs |

### Rückenstrecker Maschine
| | |
|---|---|
| Excel-Name | Unter. Rück. 2 |
| Ausrüstung | Rückenstrecker-Maschine mit Rolle |
| Ausführung | Sitzend, die Rolle am Rücken mit dem Oberkörper nach hinten drücken, kontrolliert zurück. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 1 |
| Primär | lower_back |
| Sekundär | glutes, hamstrings |

### Wadenheben stehend Maschine
| | |
|---|---|
| Excel-Name | Beine 4C |
| Ausrüstung | Wadenmaschine im Stehen |
| Ausführung | In der Maschine stehen und nur aus den Waden heraus eine kurze Bewegung von etwa 10 cm nach oben machen. Seit 25.02.2023 einbeinig. |
| Lasttyp | weight, kg-Schritt 5 |
| Seiten | 2 (einbeinig, kg und Wiederholungen pro Bein). Einträge vor dem 25.02.2023 waren beidbeinig, also 1. |
| Primär | calves |
| Sekundär | – |

### Klimmzüge breit
| | |
|---|---|
| Excel-Name | Klimmzug |
| Ausrüstung | Klimmzugstange |
| Ausführung | Normale Klimmzüge mit Obergriff, Griff knapp über schulterbreit. Aktuell ohne Unterstützung. |
| Lasttyp | assisted (kg = Gegengewicht der Unterstützung, aktuell 0) |
| Seiten | 1 |
| Primär | upper_back |
| Sekundär | biceps, shoulders |
| Hinweis | Die früheren kg-Werte (bis 35 kg) waren das Gegengewicht am Unterstützungsgerät. Volumen = Sätze × Wdh × (Körpergewicht − Gegengewicht), wie in der alten Excel mit 75 kg. |

---

## Archiviert (nur Historie aus dem Excel)

| Excel-Name | App-Name | Lasttyp | Seiten | Primär | Sekundär |
|---|---|---|---|---|---|
| Arme 1 | Bizepsmaschine | weight | 1 | biceps | – |
| Dips bis 16.11.2023 (Arme 3A) | Trizepsmaschine | weight | 1 | triceps | – |
| Schultern 3 bis 05.01.2025 | Schulterdrücken Maschine | weight | 1 | shoulders | triceps |
| Bauch 3 | Crunches | bodyweight | 1 | abs | – |
