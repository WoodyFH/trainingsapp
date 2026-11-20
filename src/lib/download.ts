/** Startet den Download einer Datei im Browser (funktioniert am Handy und am Laptop). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Kurz warten, damit mobile Browser den Download starten können.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}
