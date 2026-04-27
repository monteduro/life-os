import * as chrono from 'chrono-node'

// chrono-node locali supportati:
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
 * Risolve il locale chrono-node dalla stringa lingua.
 * Accetta formati tipo "it", "it-IT", "en-US", ecc.
 * Fallback: navigator.language → 'en'.
 */
function resolveLocale(lang?: string | null): ChronoLocale {
  const raw = lang || navigator.language || 'en'
  // Prendi solo il codice lingua base (es. "it-IT" → "it")
  const base = raw.split('-')[0].toLowerCase()
  return SUPPORTED_LOCALES[base] ?? 'en'
}

/**
 * Parsa le date da un testo usando il locale specificato.
 * Priorità: lang param > navigator.language > 'en'
 */
export function parseDates(text: string, ref?: Date, lang?: string | null) {
  const locale = resolveLocale(lang)
  const parser = chrono[locale]

  // chrono[locale] è un oggetto con .parse(), .parseDate(), ecc.
  if (parser && typeof parser === 'object' && 'parse' in parser) {
    return (parser as typeof chrono.en).parse(text, ref, { forwardDate: true })
  }

  // Fallback sicuro a inglese
  return chrono.en.parse(text, ref, { forwardDate: true })
}
