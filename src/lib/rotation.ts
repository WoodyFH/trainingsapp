/** Rotation der Haupt-Trainings: 1 → 2 → 3 → 1 … */

export interface RotationTemplate {
  id: string
  rotation_order: number | null
}

export interface RotationSession {
  template_id: string | null
  date: string
  created_at: string
}

/** Die Trainings der Rotation in Reihenfolge (Einträge ohne Position ans Ende). */
export function sortRotation<T extends RotationTemplate>(templates: readonly T[]): T[] {
  return [...templates].sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
}

/** Das zuletzt absolvierte Training der Rotation (jüngstes Datum, bei Gleichstand die später angelegte Einheit). */
export function lastRotationSession<S extends RotationSession>(
  sessions: readonly S[],
  rotationIds: ReadonlySet<string>,
): S | null {
  let best: S | null = null
  for (const s of sessions) {
    if (!s.template_id || !rotationIds.has(s.template_id)) continue
    if (!best || s.date > best.date || (s.date === best.date && s.created_at > best.created_at)) best = s
  }
  return best
}

/**
 * ID des als Nächstes fälligen Trainings: das Training nach dem zuletzt absolvierten.
 * Ohne Historie (oder wenn das letzte Training nicht mehr zur Rotation gehört) ist es das erste.
 */
export function nextTemplateId(
  templates: readonly RotationTemplate[],
  lastTemplateId: string | null,
): string | null {
  const ordered = sortRotation(templates)
  if (ordered.length === 0) return null
  const index = ordered.findIndex((t) => t.id === lastTemplateId)
  if (index === -1) return ordered[0]?.id ?? null
  return ordered[(index + 1) % ordered.length]?.id ?? null
}
