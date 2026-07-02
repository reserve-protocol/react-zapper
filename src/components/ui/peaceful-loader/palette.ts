export type RGB = [number, number, number]

export type Palette = {
  isDark: boolean
  blend: GlobalCompositeOperation
  colors: string[]
  bg: string
  glow: string
  ramp: RGB[]
  bgRGBA: (a: number) => string
}

const BRAND_SECONDARIES = {
  gold: '#F0A617',
  defi: '#4489DA',
  estatePink: '#E59393',
  lightPink: '#F3BDBD',
  darkGreen: '#657D32',
  securityGreen: '#819D44',
  lightGreen: '#A2B86E',
}

const FALLBACK = { background: '#FEFCFB', primary: '#0151AF', foreground: '#FEFCFB' }

const hexToRgb = (h: string): RGB => {
  const s = h.replace('#', '')
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ]
}

const rgbToHex = (rgb: RGB): string =>
  '#' +
  rgb
    .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0'))
    .join('')

const rgba = (rgb: RGB, a: number): string => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`

const hslTripletToRgb = (triplet: string, fallback: string): RGB => {
  const parts = triplet.trim().split(/\s+/)
  const h = parseFloat(parts[0])
  const s = parseFloat(parts[1]) / 100
  const l = parseFloat(parts[2]) / 100
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) {
    return hexToRgb(fallback)
  }
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

const lightnessOf = (triplet: string): number => {
  const l = parseFloat(triplet.trim().split(/\s+/)[2])
  return Number.isFinite(l) ? l : 100
}

const sampleK = (arr: string[], k: number): string[] => {
  const a = arr.slice()
  const out: string[] = []
  for (let i = 0; i < k && a.length; i++) {
    out.push(a.splice((Math.random() * a.length) | 0, 1)[0])
  }
  return out
}

export function buildPalette(el: Element): Palette {
  const cs = getComputedStyle(el)
  const bgTriplet = cs.getPropertyValue('--background')
  const primaryTriplet = cs.getPropertyValue('--primary')
  const foregroundTriplet = cs.getPropertyValue('--foreground')

  const isDark = lightnessOf(bgTriplet) < 40

  const background = hslTripletToRgb(bgTriplet, FALLBACK.background)
  const primary = hslTripletToRgb(primaryTriplet, FALLBACK.primary)
  const foreground = hslTripletToRgb(foregroundTriplet, FALLBACK.foreground)

  const bg = rgbToHex(isDark ? primary : background)
  const dom = rgbToHex(isDark ? foreground : primary)

  const pool = isDark
    ? [
        BRAND_SECONDARIES.gold,
        BRAND_SECONDARIES.lightGreen,
        BRAND_SECONDARIES.securityGreen,
        BRAND_SECONDARIES.lightPink,
        BRAND_SECONDARIES.estatePink,
        BRAND_SECONDARIES.defi,
      ]
    : [
        BRAND_SECONDARIES.gold,
        BRAND_SECONDARIES.defi,
        BRAND_SECONDARIES.securityGreen,
        BRAND_SECONDARIES.darkGreen,
        BRAND_SECONDARIES.lightGreen,
        BRAND_SECONDARIES.estatePink,
        BRAND_SECONDARIES.lightPink,
      ]

  const r = Math.random()
  const k = r < 0.12 ? 0 : r < 0.55 ? 1 : 2 + ((Math.random() * 2) | 0)
  const secs = sampleK(pool, k)

  const colors = k === 0 ? [dom, dom] : [dom].concat(secs.flatMap((c) => [c, c]))
  const ramp: RGB[] = [hexToRgb(bg), ...[...new Set(colors)].map(hexToRgb)]

  return {
    isDark,
    blend: isDark ? 'screen' : 'multiply',
    colors,
    bg,
    glow: dom,
    ramp,
    bgRGBA: (a: number) => rgba(hexToRgb(bg), a),
  }
}
