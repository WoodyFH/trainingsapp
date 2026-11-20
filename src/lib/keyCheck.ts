/**
 * Schutz vor einem häufigen Fehler: Ein geheimer Supabase-Schlüssel (`sb_secret_…` bzw. der alte `service_role`-Schlüssel)
 * darf nie in den Browser. Er umgeht die Row Level Security und würde im öffentlichen Paket für alle lesbar sein.
 */
export function isSecretKey(key: string | undefined): boolean {
  if (!key) return false
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json) as { role?: string }).role === 'service_role'
  } catch {
    return false
  }
}
