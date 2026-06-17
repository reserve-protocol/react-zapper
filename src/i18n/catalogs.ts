import { messages as en } from '../locales/en.po'
import { messages as es } from '../locales/es.po'
import { messages as ko } from '../locales/ko.po'
import { messages as zh } from '../locales/zh.po'

// All catalogs are bundled into the published library and loaded into the
// internal Lingui instance up front (they are small). The `@lingui/vite-plugin`
// compiles the `.po` imports to plain message objects at build time, so the
// published bundle is framework-agnostic JS.
export const ALL_ZAPPER_MESSAGES = { en, es, ko, zh }
