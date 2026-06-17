import type { LinguiConfig } from '@lingui/conf'

// The library owns its own catalogs. `pseudo` is a dev-only locale that mangles
// every wrapped string, making any unwrapped (untranslated) text obvious.
const config: LinguiConfig = {
  locales: ['en', 'es', 'ko', 'zh', 'pseudo'],
  pseudoLocale: 'pseudo',
  fallbackLocales: {
    default: 'en',
  },
  catalogs: [
    {
      path: 'src/locales/{locale}',
      include: ['src'],
    },
  ],
}

export default config
