import { TRAINING_COLORS } from '../lib/trainingColors'
import type { LoadType, Sides } from '../types/db'
import type { MuscleId } from '../types/muscles'

/**
 * Startdaten (Prompt Abschnitt 9, verbindlich: Uebungen.md).
 * `key` ist ein stabiler Bezeichner: Er bestimmt die ID der Übung und wird vom späteren
 * Excel-Import verwendet, damit importierte Einträge an den Startübungen landen.
 */

export interface SeedExercise {
  key: string
  name: string
  /** Gerätebezeichnung = Excel-Name. */
  shortName: string
  loadType: LoadType
  sides: Sides
  weightStep: number
  primary: MuscleId[]
  secondary: MuscleId[]
  equipment: string
  execution: string
  hint?: string
  archived?: boolean
}

export const SEED_EXERCISES: readonly SeedExercise[] = [
  // ---- Training 1 „Oberkörper“ ----
  {
    key: 'biz_curls',
    name: 'Bizepscurls Kurzhantel, stehend alternierend',
    shortName: 'Biz. Curls',
    loadType: 'weight',
    sides: 2,
    weightStep: 2,
    primary: ['biceps'],
    secondary: [],
    equipment: 'Zwei Kurzhanteln',
    execution:
      'Im Stehen, Arme abwechselnd. Start mit ausgestrecktem, hängendem Arm (seit 28.02.2025 bewusst aus voller Streckung). Beim Hochbeugen wird der Unterarm um eine Vierteldrehung nach außen gedreht (Supination), sodass die Handfläche oben zur Schulter zeigt, dann kontrolliert zurück.',
    hint: 'kg pro Hand, Wiederholungen pro Arm.',
  },
  {
    key: 'dips',
    name: 'Dips am Barren',
    shortName: 'Dips',
    loadType: 'assisted',
    sides: 1,
    weightStep: 5,
    primary: ['triceps', 'chest'],
    secondary: ['shoulders'],
    equipment: 'V-förmiger Dip-Barren',
    execution:
      'Stütz am Barren, Körper absenken bis etwa 90 Grad im Ellbogen, wieder hochdrücken. Aktuell ohne Zusatzgewicht.',
    hint: 'Gegengewicht der Unterstützung (aktuell 0). Volumen = Sätze × Wdh × (Körpergewicht − Gegengewicht).',
  },
  {
    key: 'schulterdruecken_kh',
    name: 'Schulterdrücken Kurzhantel sitzend',
    shortName: 'Schultern 3',
    loadType: 'weight',
    sides: 2,
    weightStep: 2,
    primary: ['shoulders'],
    secondary: ['triceps', 'upper_back'],
    equipment: 'Zwei Kurzhanteln, Bank mit Rückenlehne',
    execution:
      'Sitzend, Rücken angelehnt, beide Hanteln gleichzeitig möglichst gerade nach oben drücken und kontrolliert zurück. Seit 06.01.2025 mit Kurzhanteln.',
    hint: 'kg pro Hand, beide Arme gleichzeitig.',
  },
  {
    key: 'butterfly',
    name: 'Butterfly Maschine',
    shortName: 'Brust 2A',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['chest'],
    secondary: ['shoulders'],
    equipment: 'Butterfly-Maschine mit Unterarmpolstern',
    execution: 'Sitzend, Unterarme liegen an den Polstern, Arme vor dem Körper zusammenführen und kontrolliert öffnen.',
  },
  {
    key: 'rudern_maschine',
    name: 'Rudern sitzend Maschine',
    shortName: 'Rücken',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['upper_back'],
    secondary: ['biceps', 'shoulders'],
    equipment: 'Rudermaschine',
    execution: 'Sitzend, Griffe nach hinten zum Körper ziehen, Schulterblätter zusammenführen, kontrolliert zurück.',
  },
  {
    key: 'seitstuetz',
    name: 'Seitstütz',
    shortName: 'seitl.Plan.',
    loadType: 'time',
    sides: 2,
    weightStep: 15,
    primary: ['obliques'],
    secondary: ['abs', 'shoulders'],
    equipment: 'keine',
    execution: 'Seitlicher Unterarmstütz, Körper gerade, pro Seite gehalten.',
    hint: 'Sekunden pro Seite.',
  },
  {
    key: 'goblet_squat',
    name: 'Goblet Squat',
    shortName: 'Kniebeugen',
    loadType: 'weight',
    sides: 1,
    weightStep: 2,
    primary: ['quads', 'glutes'],
    secondary: ['adductors', 'abs'],
    equipment: 'Ein Gewicht (Kurzhantel oder Kettlebell) vor der Brust',
    execution: 'Gewicht mit beiden Händen vor der Brust halten, normale Kniebeuge, aufrechter Oberkörper.',
  },

  // ---- Training 2 „Beine & Po“ ----
  {
    key: 'bauchmaschine',
    name: 'Bauchmaschine (Crunch sitzend)',
    shortName: 'Bauch A4',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['abs'],
    secondary: ['obliques'],
    equipment: 'Bauchmaschine mit Griffen hinter dem Kopf und Fußrolle',
    execution:
      'Sitzend, Hände greifen die Griffe hinter dem Kopf, Knöchel unter der Rolle eingehakt. Oberkörper aus dem Sitzen nach vorne einrollen (Crunch-Bewegung), kontrolliert zurück.',
  },
  {
    key: 'unterarmstuetz',
    name: 'Unterarmstütz (Plank)',
    shortName: 'Planken',
    loadType: 'time',
    sides: 1,
    weightStep: 15,
    primary: ['abs'],
    secondary: ['obliques', 'shoulders'],
    equipment: 'keine',
    execution: 'Klassischer Unterarmstütz, Körper in einer Linie.',
  },
  {
    key: 'beinbeuger',
    name: 'Beinbeuger sitzend',
    shortName: 'Beine 2A',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['hamstrings'],
    secondary: ['calves'],
    equipment: 'Beinbeuger-Maschine (Einstellung 7 laut Bemerkung von 2023)',
    execution: 'Sitzend, Beine starten gestreckt, Knie beugen und das Polster zum Körper ziehen, kontrolliert zurück.',
  },
  {
    key: 'beinpresse_liegend',
    name: 'Beinpresse liegend, einbeinig',
    shortName: 'Beine 3C',
    loadType: 'weight',
    sides: 2,
    weightStep: 5,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors'],
    equipment: 'Liegende Beinpresse mit einstellbarem Gewicht',
    execution:
      'Im Liegen, Füße gegen die Platte, Bewegung wie eine Kniebeuge im Liegen. Seit 16.04.2023 einbeinig.',
    hint: 'kg und Wiederholungen pro Bein. Einträge vor dem 16.04.2023 waren beidbeinig.',
  },
  {
    key: 'ausfallschritte_sandsack',
    name: 'Seitliche Ausfallschritte Sandsack',
    shortName: 'O.Schenk.',
    loadType: 'weight',
    sides: 2,
    weightStep: 5,
    primary: ['adductors', 'quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: 'Sandsack',
    execution: 'Mit dem Sandsack seitliche Ausfallschritte zu beiden Seiten.',
    hint: 'kg = Gewicht des Sandsacks, Wiederholungen pro Seite.',
  },
  {
    key: 'abduktoren',
    name: 'Abduktorenmaschine',
    shortName: 'Gesäss 1',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['glutes'],
    secondary: [],
    equipment: 'Abduktoren-Maschine',
    execution: 'Sitzend mit geschlossenen Beinen starten und die Polster mit den Knien nach außen drücken, kontrolliert zurück.',
  },
  {
    key: 'adduktoren',
    name: 'Adduktorenmaschine',
    shortName: 'Gesäss 2',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['adductors'],
    secondary: [],
    equipment: 'Adduktoren-Maschine',
    execution: 'Sitzend mit gespreizten Beinen starten und die Polster nach innen zusammendrücken, kontrolliert zurück.',
    hint: 'Trotz des Excel-Namens „Gesäss 2“ eine Innenschenkel-Übung.',
  },

  // ---- Training 3 „Rücken & Core“ ----
  {
    key: 'seitheben',
    name: 'Seitheben Kurzhantel',
    shortName: 'Seitheben',
    loadType: 'weight',
    sides: 2,
    weightStep: 1,
    primary: ['shoulders'],
    secondary: ['upper_back'],
    equipment: 'Zwei Kurzhanteln',
    execution:
      'Im Stehen, Hanteln seitlich anheben, als würde man über die Ellbogen nach oben ziehen, bis etwa Schulterhöhe, kontrolliert ab.',
    hint: 'kg pro Hand, beide Arme gleichzeitig.',
  },
  {
    key: 'beinheben',
    name: 'Beinheben am Beinhebegerät',
    shortName: 'Leg Raises',
    loadType: 'bodyweight',
    sides: 1,
    weightStep: 5,
    primary: ['abs'],
    secondary: ['obliques'],
    equipment: "Beinhebegerät (Captain's Chair) mit Unterarmpolstern und Rückenpolster",
    execution:
      'Unterarme auf den Polstern abgestützt, Rücken am Rückenpolster, die Beine hängen frei. Gestreckte Beine aus der senkrechten Position bis etwa 90 Grad nach vorne heben, kontrolliert ab. Nur die Beine bewegen sich.',
  },
  {
    key: 'rotation_kniend',
    name: 'Rotation kniend',
    shortName: 'seitl. Bauch',
    loadType: 'weight',
    sides: 2,
    weightStep: 5,
    primary: ['obliques'],
    secondary: ['abs'],
    equipment: 'Rotationsgerät mit drehbarer Kniefläche',
    execution:
      'Auf der drehbaren Plattform knien und aus etwa 45 Grad seitlich rotieren, 12 Wiederholungen nach links und 12 nach rechts. Die frontale Variante wird nicht gemacht.',
    hint: 'Wiederholungen pro Seite.',
  },
  {
    key: 'rueckenstrecker',
    name: 'Rückenstrecker Maschine',
    shortName: 'Unter. Rück. 2',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['lower_back'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'Rückenstrecker-Maschine mit Rolle',
    execution: 'Sitzend, die Rolle am Rücken mit dem Oberkörper nach hinten drücken, kontrolliert zurück.',
  },
  {
    key: 'wadenheben',
    name: 'Wadenheben stehend Maschine, einbeinig',
    shortName: 'Beine 4C',
    loadType: 'weight',
    sides: 2,
    weightStep: 5,
    primary: ['calves'],
    secondary: [],
    equipment: 'Wadenmaschine im Stehen',
    execution:
      'In der Maschine stehen und nur aus den Waden heraus eine kurze Bewegung von etwa 10 cm nach oben machen. Seit 25.02.2023 einbeinig.',
    hint: 'kg und Wiederholungen pro Bein. Einträge vor dem 25.02.2023 waren beidbeinig.',
  },
  {
    key: 'klimmzuege',
    name: 'Klimmzüge breit',
    shortName: 'Klimmzug',
    loadType: 'assisted',
    sides: 1,
    weightStep: 5,
    primary: ['upper_back'],
    secondary: ['biceps', 'shoulders'],
    equipment: 'Klimmzugstange',
    execution: 'Normale Klimmzüge mit Obergriff, Griff knapp über schulterbreit. Aktuell ohne Unterstützung.',
    hint: 'Gegengewicht der Unterstützung (aktuell 0). Volumen = Sätze × Wdh × (Körpergewicht − Gegengewicht).',
  },

  // ---- Archiviert (nur Historie aus dem Excel) ----
  {
    key: 'bizepsmaschine',
    name: 'Bizepsmaschine',
    shortName: 'Arme 1',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['biceps'],
    secondary: [],
    equipment: 'Bizepsmaschine',
    execution: 'Nur noch als Historie aus dem alten Excel vorhanden.',
    archived: true,
  },
  {
    key: 'trizepsmaschine',
    name: 'Trizepsmaschine',
    shortName: 'Dips bis 16.11.2023 (Arme 3A)',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['triceps'],
    secondary: [],
    equipment: 'Trizepsmaschine',
    execution: 'Nur noch als Historie aus dem alten Excel vorhanden (Spalte „Dips“ bis 16.11.2023).',
    archived: true,
  },
  {
    key: 'schulterdruecken_maschine',
    name: 'Schulterdrücken Maschine',
    shortName: 'Schultern 3 bis 05.01.2025',
    loadType: 'weight',
    sides: 1,
    weightStep: 5,
    primary: ['shoulders'],
    secondary: ['triceps'],
    equipment: 'Schultergerät',
    execution: 'Nur noch als Historie aus dem alten Excel vorhanden (Werte bis 05.01.2025, bis 75 kg).',
    archived: true,
  },
  {
    key: 'crunches',
    name: 'Crunches',
    shortName: 'Bauch 3',
    loadType: 'bodyweight',
    sides: 1,
    weightStep: 5,
    primary: ['abs'],
    secondary: [],
    equipment: 'keine',
    execution: 'Nur noch als Historie aus dem alten Excel vorhanden.',
    archived: true,
  },
]

export interface SeedTemplate {
  key: string
  name: string
  color: string
  icon: string
  /** Übungs-Keys in der Reihenfolge der Anzeige. */
  exercises: string[]
}

export const SEED_TEMPLATES: readonly SeedTemplate[] = [
  {
    key: 'training1',
    name: 'Oberkörper',
    color: TRAINING_COLORS.training1,
    icon: 'Dumbbell',
    exercises: ['biz_curls', 'dips', 'schulterdruecken_kh', 'butterfly', 'rudern_maschine', 'seitstuetz', 'goblet_squat'],
  },
  {
    key: 'training2',
    name: 'Beine & Po',
    color: TRAINING_COLORS.training2,
    icon: 'Footprints',
    exercises: [
      'bauchmaschine',
      'unterarmstuetz',
      'beinbeuger',
      'beinpresse_liegend',
      'ausfallschritte_sandsack',
      'abduktoren',
      'adduktoren',
    ],
  },
  {
    key: 'training3',
    name: 'Rücken & Core',
    color: TRAINING_COLORS.training3,
    icon: 'Activity',
    exercises: ['seitheben', 'beinheben', 'rotation_kniend', 'rueckenstrecker', 'wadenheben', 'klimmzuege'],
  },
]

export interface SeedCardioType {
  key: string
  name: string
  icon: string
  distanceUnit: 'km' | 'm'
}

export const SEED_CARDIO_TYPES: readonly SeedCardioType[] = [
  { key: 'stairmaster', name: 'Stairmaster', icon: 'TrendingUp', distanceUnit: 'km' },
  { key: 'laufband', name: 'Laufband', icon: 'Footprints', distanceUnit: 'km' },
  { key: 'rudergeraet', name: 'Rudergerät', icon: 'Ship', distanceUnit: 'km' },
  { key: 'crosstrainer', name: 'Crosstrainer', icon: 'Activity', distanceUnit: 'km' },
  { key: 'ergometer', name: 'Ergometer', icon: 'Bike', distanceUnit: 'km' },
  { key: 'schwimmen', name: 'Schwimmen', icon: 'Waves', distanceUnit: 'm' },
  { key: 'wandern', name: 'Wandern', icon: 'Mountain', distanceUnit: 'km' },
]

export const DEFAULT_BODYWEIGHT_KG = 75
