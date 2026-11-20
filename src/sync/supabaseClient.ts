import { supabase } from '../lib/supabase'
import type { SyncClient } from './engine'

function failure(e: unknown): { message: string } {
  return { message: e instanceof Error ? e.message : String(e) }
}

/** Verbindet die Sync-Engine mit Supabase. Spricht ausschließlich gym_-Tabellen an. */
export const supabaseSyncClient: SyncClient = {
  async upsert(remote, rows, onConflict) {
    try {
      const { error } = await supabase.from(remote).upsert(rows, { onConflict })
      return { error: error ? { message: error.message } : null }
    } catch (e) {
      return { error: failure(e) }
    }
  },

  async fetchSince(remote, since, limit) {
    try {
      const { data, error } = await supabase
        .from(remote)
        .select('*')
        .gte('server_updated_at', since)
        .order('server_updated_at', { ascending: true })
        .limit(limit)
      if (error) return { data: null, error: { message: error.message } }
      return { data: (data ?? []) as Record<string, unknown>[], error: null }
    } catch (e) {
      return { data: null, error: failure(e) }
    }
  },
}
