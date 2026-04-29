import * as chrono from 'chrono-node'

// Supported chrono-node locales:
// de, en, es, fr, it, ja, nl, pt, ru, sv, uk, zh

export type { ParsedResult } from 'chrono-node'

type ChronoLocale = keyof typeof chrono

const SUPPORTED_LOCALES: Record<string, ChronoLocale> = {
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  nl: 'nl',
  pt: 'pt',
  ru: 'ru',
  sv: 'sv',
  uk: 'uk',
  zh: 'zh',
}

/**
 * Resolves the chrono-node locale from a language string.
 * Accepts formats such as "it", "it-IT", "en-US", and so on.
 * Fallback: navigator.language → 'en'.
 */
function resolveLocale(lang?: string | null): ChronoLocale {
  const raw = lang || navigator.language || 'en'
  // Take only the base language code (for example "it-IT" → "it")
  const base = raw.split('-')[0].toLowerCase()
  return SUPPORTED_LOCALES[base] ?? 'en'
}

function getLocaleChain(lang?: string | null): ChronoLocale[] {
  const primary = resolveLocale(lang)
  const fallbacks: ChronoLocale[] = ['en']
  return Array.from(new Set([primary, ...fallbacks]))
}

/**
 * Parses dates from text using the provided locale.
 * Priority: lang param > navigator.language > 'en'
 */
export function parseDates(text: string, ref?: Date, lang?: string | null) {
  for (const locale of getLocaleChain(lang)) {
    const parser = chrono[locale]

    // chrono[locale] is an object with .parse(), .parseDate(), and so on.
    if (parser && typeof parser === 'object' && 'parse' in parser) {
      const results = (parser as typeof chrono.en).parse(text, ref, { forwardDate: true })
      if (results.length > 0) {
        return results
      }
    }
  }

  // Safe fallback to English
  return chrono.en.parse(text, ref, { forwardDate: true })
}
