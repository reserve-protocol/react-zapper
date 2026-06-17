// `.po` catalogs are compiled to message objects by `@lingui/vite-plugin` at
// build time. This ambient declaration is build-only and not part of the
// published public API.
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
