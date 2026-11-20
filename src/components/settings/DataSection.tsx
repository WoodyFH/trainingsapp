import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, ChevronRight, DatabaseBackup, FileDown, FileSpreadsheet, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackupError, createBackup, parseBackup, restoreBackup, type BackupFile } from '../../backup/backup'
import { createExcelExport } from '../../export/exportExcel'
import { countImportedSessions, deleteImportedData } from '../../import/importWriter'
import { downloadBlob, downloadText } from '../../lib/download'
import { formatNumber, todayIso } from '../../lib/date'

interface DataSectionProps {
  userId: string | null
}

interface Message {
  kind: 'ok' | 'error'
  text: string
}

function Row({
  icon,
  title,
  hint,
  onClick,
  busy,
  danger,
}: {
  icon: ReactNode
  title: string
  hint: string
  onClick: () => void
  busy?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 disabled:opacity-60"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 ${danger ? 'text-red-600' : 'text-zinc-500'}`}>
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`font-semibold ${danger ? 'text-red-600' : 'text-ink'}`}>{title}</span>
        <span className="text-xs text-zinc-500">{hint}</span>
      </span>
    </button>
  )
}

/** Export, Backup, Import und das Löschen importierter Daten (Einstellungen). */
export function DataSection({ userId }: DataSectionProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [restorePending, setRestorePending] = useState<{ backup: BackupFile; fileName: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importedCount = useLiveQuery(() => countImportedSessions(), [], 0) ?? 0

  const run = async (name: string, action: () => Promise<Message | null>) => {
    setBusy(name)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const exportExcel = () =>
    run('excel', async () => {
      const { blob, filename } = await createExcelExport(userId ?? undefined)
      downloadBlob(blob, filename)
      return { kind: 'ok', text: `„${filename}“ wurde erstellt.` }
    })

  const exportBackup = () =>
    run('backup', async () => {
      const backup = await createBackup()
      const filename = `Trainings-App_Backup_${todayIso()}.json`
      downloadText(JSON.stringify(backup), filename)
      const rows = Object.values(backup.tables).reduce((sum, t) => sum + t.length, 0)
      return { kind: 'ok', text: `„${filename}“ mit ${formatNumber(rows, 0)} Datensätzen wurde erstellt.` }
    })

  const readBackup = (file: File) =>
    run('read', async () => {
      try {
        const backup = parseBackup(await file.text())
        setRestorePending({ backup, fileName: file.name })
        return null
      } catch (e) {
        if (e instanceof BackupError) return { kind: 'error', text: e.message }
        throw e
      }
    })

  const doRestore = () =>
    run('restore', async () => {
      if (!restorePending || !userId) return null
      const result = await restoreBackup(restorePending.backup, userId)
      setRestorePending(null)
      return { kind: 'ok', text: `${formatNumber(result.rows, 0)} Datensätze wurden eingespielt und werden synchronisiert.` }
    })

  const doDelete = () =>
    run('delete', async () => {
      const result = await deleteImportedData()
      setConfirmDelete(false)
      return {
        kind: 'ok',
        text: `${result.sessions} importierte Einheiten mit ${formatNumber(result.logs, 0)} Einträgen wurden gelöscht.`,
      }
    })

  const restoreRows = restorePending
    ? Object.values(restorePending.backup.tables).reduce((sum, t) => sum + t.length, 0)
    : 0

  return (
    <section className="card divide-y divide-line overflow-hidden" aria-label="Daten">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Backup-Datei auswählen"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void readBackup(file)
        }}
      />

      <Row
        icon={<FileDown className="size-5" aria-hidden />}
        title="Excel exportieren"
        hint="Krafttraining, Matrix, Cardio, Übungen und Pläne als .xlsx"
        onClick={() => void exportExcel()}
        busy={busy === 'excel'}
      />
      <Row
        icon={<DatabaseBackup className="size-5" aria-hidden />}
        title="Vollständiges Backup (JSON)"
        hint="Alle Daten als Datei sichern"
        onClick={() => void exportBackup()}
        busy={busy === 'backup'}
      />
      <Row
        icon={<ArchiveRestore className="size-5" aria-hidden />}
        title="Backup einspielen"
        hint="Daten aus einer Backup-Datei wiederherstellen"
        onClick={() => fileRef.current?.click()}
        busy={busy === 'read'}
      />

      {restorePending && (
        <div className="flex flex-col gap-3 bg-amber-50/60 px-5 py-4 text-sm text-zinc-700">
          <p className="m-0">
            „{restorePending.fileName}“ enthält {formatNumber(restoreRows, 0)} Datensätze (Stand{' '}
            {restorePending.backup.exportedAt ? restorePending.backup.exportedAt.slice(0, 10) : 'unbekannt'}). Einträge mit
            derselben ID werden durch den Stand aus dem Backup ersetzt, alles andere bleibt unverändert.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void doRestore()}
              disabled={busy === 'restore'}
              className="h-11 rounded-2xl bg-zinc-900 px-5 font-semibold text-white disabled:opacity-60"
            >
              {busy === 'restore' ? 'Wird eingespielt …' : 'Einspielen'}
            </button>
            <button
              type="button"
              onClick={() => setRestorePending(null)}
              className="h-11 rounded-2xl bg-white px-5 font-semibold text-zinc-600 shadow-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <Link to="/einstellungen/import" className="flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-ink">Altes Excel importieren</span>
          <span className="text-xs text-zinc-500">Mit Vorschau, bevor etwas gespeichert wird</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-zinc-300" aria-hidden />
      </Link>

      {importedCount > 0 && (
        <>
          <Row
            icon={<Trash2 className="size-5" aria-hidden />}
            title="Alle importierten Daten löschen"
            hint={`${formatNumber(importedCount, 0)} importierte Einheiten`}
            onClick={() => setConfirmDelete(true)}
            danger
          />
          {confirmDelete && (
            <div className="flex flex-col gap-3 bg-red-50/60 px-5 py-4 text-sm text-zinc-700">
              <p className="m-0">
                Alle {formatNumber(importedCount, 0)} importierten Einheiten mit ihren Einträgen werden gelöscht, auch auf
                deinen anderen Geräten. Selbst erfasste Einheiten bleiben. Du kannst die Datei danach erneut importieren.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void doDelete()}
                  disabled={busy === 'delete'}
                  className="h-11 rounded-2xl bg-red-600 px-5 font-semibold text-white disabled:opacity-60"
                >
                  {busy === 'delete' ? 'Wird gelöscht …' : 'Endgültig löschen'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-11 rounded-2xl bg-white px-5 font-semibold text-zinc-600 shadow-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`m-0 px-5 py-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
