import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import { parseDates, type ParsedResult } from '../lib/chrono-it'

export interface DetectedDate {
  iso: string
  raw: string
}

export interface DateDetectionOptions {
  onDateDetected?: (date: DetectedDate | null) => void
  /** Se fornito, al caricamento viene evidenziata solo questa data (il testo raw salvato nelle API) */
  preferredRaw?: string
  /** Lingua per il parsing delle date (es. "it", "en", "fr"). Fallback: navigator.language */
  lang?: string | null
}

interface TextSegment {
  text: string
  from: number
}

const dateDetectionKey = new PluginKey('dateDetection')

/**
 * Extracts text segments from a ProseMirror document, tracking each text
 * node's absolute position so we can map chrono-node string indices back
 * to document positions.
 */
function extractTextSegments(doc: PmNode): TextSegment[] {
  const segments: TextSegment[] = []

  doc.descendants((node: { isText: boolean; text?: string }, pos: number) => {
    if (node.isText && node.text) {
      segments.push({ text: node.text, from: pos })
    }
  })

  return segments
}

/**
 * Maps a chrono-node match (index + length in plain text) back to
 * ProseMirror document positions.
 *
 * We concatenate all text segments into a flat string, then use offsets
 * to find the corresponding document range.
 */
function mapToDocPositions(
  segments: TextSegment[],
  matchIndex: number,
  matchLength: number,
): { from: number; to: number } | null {
  let offset = 0

  for (const segment of segments) {
    const segEnd = offset + segment.text.length

    if (matchIndex >= offset && matchIndex < segEnd) {
      const startInSeg = matchIndex - offset
      const docFrom = segment.from + startInSeg

      // The match might span multiple segments, but for typical short date
      // expressions it usually fits in one. We clamp to be safe.
      let remaining = matchLength
      let docTo = docFrom

      for (let i = segments.indexOf(segment); i < segments.length && remaining > 0; i++) {
        const seg = segments[i]
        const segStart = i === segments.indexOf(segment) ? startInSeg : 0
        const available = seg.text.length - segStart
        const take = Math.min(remaining, available)
        docTo = seg.from + segStart + take
        remaining -= take
      }

      return { from: docFrom, to: docTo }
    }

    offset = segEnd
  }

  return null
}

function buildDecorations(
  doc: PmNode,
  dismissed: Set<string>,
  onDateDetected?: (date: DetectedDate | null) => void,
  preferredRaw?: string,
  lang?: string | null,
): { decorations: DecorationSet; detectedDate: DetectedDate | null } {
  const segments = extractTextSegments(doc)
  if (segments.length === 0) {
    onDateDetected?.(null)
    return { decorations: DecorationSet.empty, detectedDate: null }
  }

  // Build a flat string from all segments for chrono-node
  const fullText = segments.map((s) => s.text).join('')
  const results: ParsedResult[] = parseDates(fullText, undefined, lang)

  // Se c'è un preferredRaw, evidenzia solo quello (ignora gli altri)
  // Altrimenti prendi il primo non-dismissed
  const match = preferredRaw
    ? results.find((r) => !dismissed.has(r.text) && r.text === preferredRaw)
        ?? results.find((r) => !dismissed.has(r.text))
    : results.find((r) => !dismissed.has(r.text))

  if (!match) {
    onDateDetected?.(null)
    return { decorations: DecorationSet.empty, detectedDate: null }
  }

  const pos = mapToDocPositions(segments, match.index, match.text.length)
  if (!pos) {
    onDateDetected?.(null)
    return { decorations: DecorationSet.empty, detectedDate: null }
  }

  const detectedDate: DetectedDate = {
    iso: match.date().toISOString(),
    raw: match.text,
  }

  onDateDetected?.(detectedDate)

  const decorations: Decoration[] = []

  // Inline decoration — pill cliccabile, nessun widget separato
  decorations.push(
    Decoration.inline(pos.from, pos.to, {
      class: 'inline-block bg-amber-100 border border-amber-200 text-amber-800 rounded-full px-2 py-[1px] text-[0.8rem] font-medium cursor-pointer transition-colors duration-150 hover:bg-amber-200 hover:border-amber-300 hover:line-through hover:decoration-amber-700 date-detected-badge',
      'data-raw': match.text,
    }),
  )

  return {
    decorations: DecorationSet.create(doc, decorations),
    detectedDate,
  }
}

interface PluginState {
  decorations: DecorationSet
  dismissed: Set<string>
  detectedDate: DetectedDate | null
}

export const DateDetectionExtension = Extension.create<DateDetectionOptions>({
  name: 'dateDetection',

  addOptions() {
    return {
      onDateDetected: undefined,
    }
  },

  addProseMirrorPlugins() {
    const { onDateDetected, preferredRaw, lang } = this.options

    return [
      new Plugin<PluginState>({
        key: dateDetectionKey,

        state: {
          init(_, { doc }) {
            // Al caricamento pre-dismissiamo tutti i match che NON sono preferredRaw
            const allResults: ParsedResult[] = parseDates(
              extractTextSegments(doc).map((s) => s.text).join(''),
              undefined,
              lang,
            )
            const initialDismissed = new Set<string>(
              preferredRaw
                ? allResults.filter((r) => r.text !== preferredRaw).map((r) => r.text)
                : [],
            )
            const result = buildDecorations(doc, initialDismissed, onDateDetected, preferredRaw, lang)
            return {
              decorations: result.decorations,
              dismissed: initialDismissed,
              detectedDate: result.detectedDate,
            }
          },

          apply(tr, prev) {
            const meta = tr.getMeta(dateDetectionKey)

            if (meta?.type === 'dismiss') {
              const newDismissed = new Set(prev.dismissed)
              newDismissed.add(meta.raw)
              const result = buildDecorations(tr.doc, newDismissed, onDateDetected, undefined, lang)
              return {
                decorations: result.decorations,
                dismissed: newDismissed,
                detectedDate: result.detectedDate,
              }
            }

            if (tr.docChanged) {
              const result = buildDecorations(tr.doc, prev.dismissed, onDateDetected, undefined, lang)
              return {
                ...prev,
                decorations: result.decorations,
                detectedDate: result.detectedDate,
              }
            }

            return prev
          },
        },

        props: {
          decorations(state) {
            return dateDetectionKey.getState(state)?.decorations ?? DecorationSet.empty
          },
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement
              const badge = target.closest('.date-detected-badge') as HTMLElement | null
              if (!badge) return false
              const raw = badge.getAttribute('data-raw')
              if (!raw) return false
              event.preventDefault()
              event.stopPropagation()
              const tr = view.state.tr.setMeta(dateDetectionKey, { type: 'dismiss', raw })
              view.dispatch(tr)
              return true
            },
          },
        },
      }),
    ]
  },
})
