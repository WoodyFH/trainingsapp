import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppGate } from './auth/AppGate'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/layout/AppShell'
import { CardioPage } from './pages/CardioPage'
import { TrainingPage } from './pages/TrainingPage'
import { TrainingSessionPage } from './pages/TrainingSessionPage'

// Selten genutzte oder schwere Bereiche (Diagramme, Drag & Drop, Excel, Design-Demo) werden erst beim Öffnen geladen.
// Offline stehen sie trotzdem bereit, weil der Service Worker alle Teile beim Installieren zwischenspeichert.
const PlansPage = lazy(() => import('./pages/PlansPage').then((m) => ({ default: m.PlansPage })))
const ExerciseLibraryPage = lazy(() => import('./pages/ExerciseLibraryPage').then((m) => ({ default: m.ExerciseLibraryPage })))
const TemplateEditorPage = lazy(() => import('./pages/TemplateEditorPage').then((m) => ({ default: m.TemplateEditorPage })))
const ExerciseEditorPage = lazy(() => import('./pages/ExerciseEditorPage').then((m) => ({ default: m.ExerciseEditorPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })))
const DesignPage = lazy(() => import('./pages/DesignPage').then((m) => ({ default: m.DesignPage })))
const StatsOverviewPage = lazy(() => import('./pages/stats/StatsOverviewPage'))
const StatsExercisesPage = lazy(() => import('./pages/stats/StatsExercisesPage'))
const StatsExerciseDetailPage = lazy(() => import('./pages/stats/StatsExerciseDetailPage'))
const StatsCardioPage = lazy(() => import('./pages/stats/StatsCardioPage'))
const StatsHistoryPage = lazy(() => import('./pages/stats/StatsHistoryPage'))
const SessionDetailPage = lazy(() => import('./pages/stats/SessionDetailPage'))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="card h-48 animate-pulse" role="status" aria-label="Lädt" />}>{children}</Suspense>
}

export function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TrainingPage />} />
          <Route path="training/:templateId" element={<TrainingSessionPage mode="template" />} />
          <Route path="frei" element={<TrainingSessionPage mode="free" />} />
          <Route path="cardio" element={<CardioPage />} />
          <Route path="plaene" element={<Lazy><PlansPage /></Lazy>} />
          <Route path="plaene/uebungen" element={<Lazy><ExerciseLibraryPage /></Lazy>} />
          <Route path="plaene/training/:id" element={<Lazy><TemplateEditorPage /></Lazy>} />
          <Route path="plaene/uebung/:id" element={<Lazy><ExerciseEditorPage /></Lazy>} />
          <Route path="statistik" element={<Lazy><StatsOverviewPage /></Lazy>} />
          <Route path="statistik/uebungen" element={<Lazy><StatsExercisesPage /></Lazy>} />
          <Route path="statistik/uebung/:id" element={<Lazy><StatsExerciseDetailPage /></Lazy>} />
          <Route path="statistik/cardio" element={<Lazy><StatsCardioPage /></Lazy>} />
          <Route path="statistik/verlauf" element={<Lazy><StatsHistoryPage /></Lazy>} />
          <Route path="statistik/einheit/:id" element={<Lazy><SessionDetailPage /></Lazy>} />
          <Route path="einstellungen" element={<Lazy><SettingsPage /></Lazy>} />
          <Route path="einstellungen/import" element={<Lazy><ImportPage /></Lazy>} />
          <Route path="design" element={<Lazy><DesignPage /></Lazy>} />
          <Route path="*" element={<TrainingPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate>
        <AppRoutes />
      </AppGate>
    </AuthProvider>
  )
}
