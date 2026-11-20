import { createClient } from '@supabase/supabase-js'
import { isSecretKey } from './keyCheck'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** false, wenn VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY beim Build fehlen. */
export const supabaseKeyIsSecret = isSecretKey(key)
export const supabaseConfigured = Boolean(url && key) && !supabaseKeyIsSecret

/**
 * Supabase-Client. Es wird nur der öffentliche Publishable-/Anon-Key verwendet; der Schutz der
 * Daten liegt in der Row Level Security der gym_-Tabellen.
 *
 * - Eigener storageKey: Der Habit Tracker nutzt dasselbe Projekt und liegt auf GitHub Pages
 *   auf derselben Origin. So kommen sich die beiden Sitzungen nicht in die Quere.
 * - detectSessionInUrl aus: Die App nutzt HashRouter, Tokens im URL-Hash wären sonst ein Problem.
 */
export const supabase = createClient(url ?? 'http://localhost:54321', supabaseKeyIsSecret ? 'nicht-konfiguriert' : (key ?? 'nicht-konfiguriert'), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'trainingsapp-auth',
  },
})
