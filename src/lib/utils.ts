/** Formatta una data ISO in formato italiano breve (es. "27 feb 2026") */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
