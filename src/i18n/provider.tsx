import { type ReactNode, useEffect, useState } from 'react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { ALL_ZAPPER_MESSAGES } from './catalogs'

export type SupportedLocale = 'en' | 'es' | 'ko' | 'zh'

const DEFAULT_LOCALE: SupportedLocale = 'en'
const SUPPORTED_LOCALES: readonly string[] = ['en', 'es', 'ko', 'zh']

const normalize = (locale?: string): SupportedLocale =>
  locale && SUPPORTED_LOCALES.includes(locale)
    ? (locale as SupportedLocale)
    : DEFAULT_LOCALE

interface ZapperI18nProviderProps {
  /** UI language. Defaults to 'en'. Unknown values fall back to English. */
  locale?: string
  children: ReactNode
}

/**
 * Wraps the zapper UI in its own isolated Lingui instance, so localization is a
 * self-contained, optional feature: consumers pass a `locale` string (or
 * nothing, defaulting to English) and never need Lingui installed themselves.
 *
 * The instance is private to this subtree — it is created via `setupI18n()` and
 * never touches any global i18n the host application may own, so mounting the
 * zapper can't interfere with the host's own translations.
 */
export const ZapperI18nProvider = ({
  locale,
  children,
}: ZapperI18nProviderProps) => {
  const [i18n] = useState(() => {
    const instance = setupI18n()
    instance.load(ALL_ZAPPER_MESSAGES)
    instance.activate(normalize(locale))
    return instance
  })

  useEffect(() => {
    i18n.activate(normalize(locale))
  }, [locale, i18n])

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
