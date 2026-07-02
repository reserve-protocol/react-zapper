import type { Palette } from './palette'

type Ctx = CanvasRenderingContext2D

export type Viz = {
  name: string
  make: (ctx: Ctx, w: number, h: number, P: Palette) => { frame: (t: number) => void }
}

const TAU = Math.PI * 2
const rand = (a = 1, b?: number): number =>
  b === undefined ? Math.random() * a : a + Math.random() * (b - a)
const pick = <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

function noise(x: number, y: number, t: number): number {
  return (
    (Math.sin(x * 1.3 + t * 0.7) +
      Math.sin(y * 1.7 - t * 0.5) +
      Math.sin((x + y) * 0.8 + t * 0.9) +
      Math.sin((x - y) * 1.1 - t * 0.3)) /
    4
  )
}

function clearBg(ctx: Ctx, P: Palette, w: number, h: number): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = P.bg
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = P.blend
}

function fadeBg(ctx: Ctx, P: Palette, w: number, h: number, a: number): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = P.bgRGBA(a)
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = P.blend
}

export const VIZ: Viz[] = [
  {
    name: 'Flow Field',
    make(ctx, w, h, P) {
      const ps = Array.from({ length: 120 }, () => ({
        x: rand(w),
        y: rand(h),
        c: pick(P.colors),
        s: rand(0.4, 1.2),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame(t) {
          fadeBg(ctx, P, w, h, 0.06)
          for (const p of ps) {
            const a = noise(p.x / 90, p.y / 90, t * 0.25) * TAU * 1.5
            p.x += Math.cos(a) * p.s
            p.y += Math.sin(a) * p.s
            if (p.x < 0) p.x += w
            if (p.x > w) p.x -= w
            if (p.y < 0) p.y += h
            if (p.y > h) p.y -= h
            ctx.fillStyle = p.c
            ctx.globalAlpha = 0.5
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.s * 1.4, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Drifting Orbs',
    make(ctx, w, h, P) {
      const orbs = Array.from({ length: 6 }, () => ({
        x: rand(w),
        y: rand(h),
        r: rand(h * 0.5, h * 1.1),
        dx: rand(-0.3, 0.3),
        dy: rand(-0.2, 0.2),
        c: pick(P.colors),
        ph: rand(TAU),
      }))
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const o of orbs) {
            o.x += o.dx
            o.y += o.dy
            if (o.x < -o.r) o.x = w + o.r
            if (o.x > w + o.r) o.x = -o.r
            if (o.y < -o.r) o.y = h + o.r
            if (o.y > h + o.r) o.y = -o.r
            const r = o.r * (1 + Math.sin(t * 0.6 + o.ph) * 0.12)
            const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r)
            g.addColorStop(0, o.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = 0.85
            ctx.beginPath()
            ctx.arc(o.x, o.y, r, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Aurora',
    make(ctx, w, h, P) {
      const bands = Array.from({ length: 5 }, (_, i) => ({
        y: h * (0.2 + i * 0.16),
        amp: rand(h * 0.12, h * 0.3),
        len: rand(0.006, 0.014),
        sp: rand(0.2, 0.5),
        c: P.colors[i % P.colors.length],
        ph: rand(TAU),
      }))
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const b of bands) {
            ctx.beginPath()
            ctx.moveTo(0, h)
            for (let x = 0; x <= w; x += 6) {
              const y =
                b.y +
                Math.sin(x * b.len + t * b.sp + b.ph) * b.amp +
                Math.sin(x * b.len * 2.3 - t * b.sp) * b.amp * 0.4
              ctx.lineTo(x, y)
            }
            ctx.lineTo(w, h)
            ctx.closePath()
            const g = ctx.createLinearGradient(0, b.y - b.amp, 0, h)
            g.addColorStop(0, b.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = 0.5
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Starfield',
    make(ctx, w, h, P) {
      const stars = Array.from({ length: 150 }, () => ({
        x: rand(w),
        y: rand(h),
        r: rand(0.4, 1.8),
        tw: rand(TAU),
        sp: rand(0.05, 0.25),
        c: pick(P.colors),
      }))
      const dir = rand(TAU)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const s of stars) {
            s.x += Math.cos(dir) * s.sp
            s.y += Math.sin(dir) * s.sp
            if (s.x < 0) s.x += w
            if (s.x > w) s.x -= w
            if (s.y < 0) s.y += h
            if (s.y > h) s.y -= h
            ctx.globalAlpha = 0.35 + 0.5 * (Math.sin(t * 1.5 + s.tw) * 0.5 + 0.5)
            ctx.fillStyle = s.c
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Plasma',
    make(ctx, w, h, P) {
      const SW = 96
      const SH = 28
      const off = document.createElement('canvas')
      off.width = SW
      off.height = SH
      const octx = off.getContext('2d')!
      const img = octx.createImageData(SW, SH)
      const k1 = rand(0.1, 0.25)
      const k2 = rand(0.1, 0.25)
      const ramp = P.ramp
      const seg = ramp.length - 1
      return {
        frame(t) {
          let i = 0
          for (let y = 0; y < SH; y++)
            for (let x = 0; x < SW; x++) {
              const v =
                Math.sin(x * k1 + t) +
                Math.sin(y * k2 - t * 0.8) +
                Math.sin((x + y) * 0.12 + t * 0.5) +
                Math.sin(Math.hypot(x - SW / 2, y - SH / 2) * 0.18 - t)
              let vn = (v + 4) / 8
              if (vn < 0) vn = 0
              if (vn > 1) vn = 1
              const pos = vn * seg
              let idx = Math.floor(pos)
              if (idx >= seg) idx = seg - 1
              const f = pos - idx
              const a = ramp[idx]
              const b = ramp[idx + 1]
              img.data[i++] = a[0] + (b[0] - a[0]) * f
              img.data[i++] = a[1] + (b[1] - a[1]) * f
              img.data[i++] = a[2] + (b[2] - a[2]) * f
              img.data[i++] = 255
            }
          octx.putImageData(img, 0, 0)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          ctx.imageSmoothingEnabled = true
          ctx.drawImage(off, 0, 0, w, h)
        },
      }
    },
  },

  {
    name: 'Breathing Orb',
    make(ctx, w, h, P) {
      const cx = w / 2
      const cy = h / 2
      const R = h * 0.62
      const motes = Array.from({ length: 46 }, () => ({
        a: rand(TAU),
        d: rand(R * 0.6, w * 0.5),
        sp: rand(0.1, 0.4),
        c: pick(P.colors),
      }))
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          const breathe = 0.78 + Math.sin(t * 0.7) * 0.22
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * breathe * 1.7)
          g.addColorStop(0, P.colors[0])
          g.addColorStop(0.5, P.colors[1])
          g.addColorStop(1, 'transparent')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(cx, cy, R * breathe * 1.7, 0, TAU)
          ctx.fill()
          for (const m of motes) {
            m.a += m.sp * 0.01
            const x = cx + Math.cos(m.a) * m.d * breathe
            const y = cy + Math.sin(m.a) * m.d * 0.5 * breathe
            ctx.fillStyle = m.c
            ctx.globalAlpha = 0.6
            ctx.beginPath()
            ctx.arc(x, y, 1.8, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Silk',
    make(ctx, w, h, P) {
      const lines = 30
      const c1 = P.colors[0]
      const c2 = P.colors[1]
      const f1 = rand(0.01, 0.02)
      const f2 = rand(0.01, 0.02)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let i = 0; i < lines; i++) {
            const yy = (i / (lines - 1)) * h
            ctx.beginPath()
            for (let x = 0; x <= w; x += 5) {
              const y =
                yy +
                Math.sin(x * f1 + t * 0.5 + i * 0.2) * 14 +
                Math.sin(x * f2 - t * 0.3 + yy * 0.02) * 9
              if (x) ctx.lineTo(x, y)
              else ctx.moveTo(x, y)
            }
            ctx.strokeStyle = i % 2 ? c1 : c2
            ctx.globalAlpha = 0.35
            ctx.lineWidth = 1
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Smoke',
    make(ctx, w, h, P) {
      const ps = Array.from({ length: 60 }, () => ({
        x: rand(w),
        y: rand(h),
        c: pick(P.colors),
        r: rand(10, 28),
        life: rand(1),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame(t) {
          fadeBg(ctx, P, w, h, 0.05)
          for (const p of ps) {
            const a = noise(p.x / 110, p.y / 110, t * 0.2) * TAU
            p.x += Math.cos(a) * 0.6
            p.y += Math.sin(a) * 0.6 - 0.35
            p.life -= 0.004
            if (p.life <= 0 || p.y < -p.r) {
              p.x = rand(w)
              p.y = h + p.r
              p.life = 1
            }
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
            g.addColorStop(0, p.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = p.life * 0.2
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.r, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Shimmer Grid',
    make(ctx, w, h, P) {
      const gap = Math.max(14, w / 30)
      const cols = Math.ceil(w / gap)
      const rows = Math.ceil(h / gap)
      const c = P.colors
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let j = 0; j <= rows; j++)
            for (let i = 0; i <= cols; i++) {
              const v =
                Math.sin(i * 0.5 + t) +
                Math.sin(j * 0.5 - t * 0.8) +
                Math.sin((i + j) * 0.4 + t * 0.5)
              const a = (v + 3) / 6
              ctx.fillStyle = c[(i + j) % c.length]
              ctx.globalAlpha = 0.15 + a * 0.7
              ctx.beginPath()
              ctx.arc(i * gap, j * gap, 1.2 + a * 2.4, 0, TAU)
              ctx.fill()
            }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Contour Lines',
    make(ctx, w, h, P) {
      const lines = 18
      const f = rand(0.006, 0.012)
      const amp = rand(7, 14)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let i = 0; i < lines; i++) {
            const yy = (i / (lines - 1)) * h
            ctx.beginPath()
            for (let x = 0; x <= w; x += 6) {
              const y =
                yy +
                noise(x * f, yy * 0.03, t * 0.3) * amp * 2 +
                Math.sin(x * f * 1.6 + t * 0.4) * amp
              if (x) ctx.lineTo(x, y)
              else ctx.moveTo(x, y)
            }
            ctx.strokeStyle = P.colors[i % P.colors.length]
            ctx.globalAlpha = 0.45
            ctx.lineWidth = 1
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Bokeh',
    make(ctx, w, h, P) {
      const mk = () => ({
        x: rand(w),
        y: rand(h),
        r: rand(8, 40),
        c: pick(P.colors),
        dx: rand(-0.15, 0.15),
        dy: rand(-0.22, 0.05),
        a: rand(0.12, 0.3),
      })
      const bs = Array.from({ length: 24 }, mk)
      return {
        frame() {
          clearBg(ctx, P, w, h)
          for (const b of bs) {
            b.x += b.dx
            b.y += b.dy
            if (b.x < -b.r) b.x = w + b.r
            if (b.x > w + b.r) b.x = -b.r
            if (b.y < -b.r) b.y = h + b.r
            if (b.y > h + b.r) b.y = -b.r
            const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
            g.addColorStop(0, b.c)
            g.addColorStop(0.7, b.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = b.a
            ctx.beginPath()
            ctx.arc(b.x, b.y, b.r, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Sine Ribbon',
    make(ctx, w, h, P) {
      const ribs = Array.from({ length: 3 }, (_, i) => ({
        yy: h * (0.3 + i * 0.2),
        amp: rand(8, 18),
        f: rand(0.01, 0.02),
        sp: rand(0.3, 0.6),
        th: rand(10, 20),
        c1: pick(P.colors),
        c2: pick(P.colors),
        ph: rand(TAU),
      }))
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const r of ribs) {
            ctx.beginPath()
            for (let x = 0; x <= w; x += 6) {
              const y = r.yy + Math.sin(x * r.f + t * r.sp + r.ph) * r.amp
              if (x) ctx.lineTo(x, y)
              else ctx.moveTo(x, y)
            }
            for (let x = w; x >= 0; x -= 6) {
              const y = r.yy + r.th + Math.sin(x * r.f + t * r.sp + r.ph) * r.amp
              ctx.lineTo(x, y)
            }
            ctx.closePath()
            const g = ctx.createLinearGradient(0, 0, w, 0)
            g.addColorStop(0, r.c1)
            g.addColorStop(1, r.c2)
            ctx.fillStyle = g
            ctx.globalAlpha = 0.4
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Wave Field',
    make(ctx, w, h, P) {
      const gap = Math.max(13, w / 34)
      const cols = Math.ceil(w / gap)
      const rows = Math.ceil(h / gap)
      const kx = rand(0.2, 0.5)
      const ky = rand(0.2, 0.5)
      const ang = rand(TAU)
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let j = 0; j <= rows; j++)
            for (let i = 0; i <= cols; i++) {
              const v = Math.sin(i * kx * ca + j * ky * sa - t * 1.2)
              const a = (v + 1) / 2
              ctx.fillStyle = P.colors[(i + j) % P.colors.length]
              ctx.globalAlpha = 0.18 + a * 0.62
              ctx.beginPath()
              ctx.arc(i * gap, j * gap, 1 + a * 2.4, 0, TAU)
              ctx.fill()
            }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Streamlines',
    make(ctx, w, h, P) {
      const ps = Array.from({ length: 70 }, () => ({
        x: rand(w),
        y: rand(h),
        c: pick(P.colors),
        age: rand(160),
        life: rand(60, 170),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame(t) {
          fadeBg(ctx, P, w, h, 0.05)
          for (const p of ps) {
            p.age++
            const a = noise(p.x / 120, p.y / 120, t * 0.15) * TAU * 1.5
            const nx = p.x + Math.cos(a) * 1.4
            const ny = p.y + Math.sin(a) * 1.4
            ctx.strokeStyle = p.c
            ctx.globalAlpha = 0.5
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(nx, ny)
            ctx.stroke()
            p.x = nx
            p.y = ny
            if (p.age > p.life || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
              p.x = rand(w)
              p.y = rand(h)
              p.age = 0
            }
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Drifting Dust',
    make(ctx, w, h, P) {
      const ps: {
        x: number
        y: number
        r: number
        sp: number
        c: string
        tw: number
      }[] = []
      for (let l = 0; l < 3; l++)
        for (let i = 0; i < 42; i++)
          ps.push({
            x: rand(w),
            y: rand(h),
            r: 0.5 + l * 0.7,
            sp: 0.08 + l * 0.16,
            c: pick(P.colors),
            tw: rand(TAU),
          })
      const dir = rand(TAU)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const p of ps) {
            p.x += Math.cos(dir) * p.sp
            p.y += Math.sin(dir) * p.sp * 0.5
            if (p.x < 0) p.x += w
            if (p.x > w) p.x -= w
            if (p.y < 0) p.y += h
            if (p.y > h) p.y -= h
            ctx.fillStyle = p.c
            ctx.globalAlpha = 0.3 + 0.4 * (Math.sin(t + p.tw) * 0.5 + 0.5)
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.r, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Interference',
    make(ctx, w, h, P) {
      const step = 9
      const srcs = Array.from({ length: 3 }, () => ({
        x: rand(w),
        y: rand(h),
        k: rand(0.06, 0.12),
        sp: rand(0.8, 1.6),
        ph: rand(TAU),
      }))
      const c = pick(P.colors)
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let y = 0; y <= h; y += step)
            for (let x = 0; x <= w; x += step) {
              let v = 0
              for (const s of srcs)
                v += Math.sin(Math.hypot(x - s.x, y - s.y) * s.k - t * s.sp + s.ph)
              const a = (v / srcs.length + 1) / 2
              if (a < 0.5) continue
              ctx.fillStyle = c
              ctx.globalAlpha = (a - 0.5) * 1.1
              ctx.beginPath()
              ctx.arc(x, y, 2.2, 0, TAU)
              ctx.fill()
            }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Gradient Mesh',
    make(ctx, w, h, P) {
      const anchors = Array.from({ length: 4 }, () => ({
        bx: rand(),
        by: rand(),
        sp: rand(0.2, 0.5),
        ph: rand(TAU),
        amp: rand(0.15, 0.3),
        c: pick(P.colors),
      }))
      const R = Math.max(w, h) * 0.75
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (const an of anchors) {
            const x = (an.bx + Math.sin(t * an.sp + an.ph) * an.amp) * w
            const y = (an.by + Math.cos(t * an.sp * 0.8 + an.ph) * an.amp) * h
            const g = ctx.createRadialGradient(x, y, 0, x, y, R)
            g.addColorStop(0, an.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = 0.6
            ctx.fillRect(0, 0, w, h)
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Gentle Rain',
    make(ctx, w, h, P) {
      const skew = rand(-0.4, 0.4)
      const ds = Array.from({ length: 44 }, () => ({
        x: rand(w),
        y: rand(h),
        len: rand(8, 20),
        sp: rand(0.6, 1.6),
        c: pick(P.colors),
        a: rand(0.2, 0.5),
      }))
      return {
        frame() {
          clearBg(ctx, P, w, h)
          for (const d of ds) {
            d.y += d.sp
            if (d.y > h + d.len) {
              d.y = -d.len
              d.x = rand(w)
            }
            ctx.strokeStyle = d.c
            ctx.globalAlpha = d.a
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(d.x, d.y)
            ctx.lineTo(d.x + skew * d.len, d.y + d.len)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Marbling',
    make(ctx, w, h, P) {
      const ps = Array.from({ length: 90 }, () => ({
        x: rand(w),
        y: rand(h),
        c: pick(P.colors),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame(t) {
          fadeBg(ctx, P, w, h, 0.035)
          for (const p of ps) {
            const a = noise(p.x / 100, p.y / 100, t * 0.1) * TAU * 2
            p.x += Math.cos(a) * 0.9
            p.y += Math.sin(a) * 0.9
            if (p.x < 0) p.x += w
            if (p.x > w) p.x -= w
            if (p.y < 0) p.y += h
            if (p.y > h) p.y -= h
            ctx.fillStyle = p.c
            ctx.globalAlpha = 0.4
            ctx.beginPath()
            ctx.arc(p.x, p.y, 1.6, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Orbiting Motes',
    make(ctx, w, h, P) {
      const cs = Array.from({ length: 2 }, () => ({
        x: rand(w * 0.2, w * 0.8),
        y: rand(h),
      }))
      const ms = Array.from({ length: 44 }, () => ({
        c: pick(cs),
        r: rand(18, 90),
        a: rand(TAU),
        sp: rand(0.2, 0.6) * (Math.random() < 0.5 ? -1 : 1),
        col: pick(P.colors),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame() {
          fadeBg(ctx, P, w, h, 0.08)
          for (const m of ms) {
            m.a += m.sp * 0.01
            const x = m.c.x + Math.cos(m.a) * m.r
            const y = m.c.y + Math.sin(m.a) * m.r * 0.7
            ctx.fillStyle = m.col
            ctx.globalAlpha = 0.7
            ctx.beginPath()
            ctx.arc(x, y, 1.8, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Wandering Path',
    make(ctx, w, h, P) {
      let x = w / 2
      let y = h / 2
      let px = x
      let py = y
      const c = pick(P.colors)
      clearBg(ctx, P, w, h)
      return {
        frame(t) {
          fadeBg(ctx, P, w, h, 0.02)
          const a = noise(x / 90, y / 90, t * 0.2) * TAU * 2
          x += Math.cos(a) * 1.6
          y += Math.sin(a) * 1.6
          if (x < 4 || x > w - 4 || y < 4 || y > h - 4) {
            x = Math.max(4, Math.min(w - 4, x))
            y = Math.max(4, Math.min(h - 4, y))
            px = x
            py = y
          }
          ctx.strokeStyle = c
          ctx.globalAlpha = 0.85
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(x, y)
          ctx.stroke()
          px = x
          py = y
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Nebula',
    make(ctx, w, h, P) {
      const cx = w / 2
      const cy = h / 2
      const ps = Array.from({ length: 110 }, () => ({
        a: rand(TAU),
        r: rand(0, w * 0.5),
        sp: rand(0.05, 0.2),
        c: pick(P.colors),
        sz: rand(6, 18),
        al: rand(0.04, 0.12),
      }))
      return {
        frame() {
          clearBg(ctx, P, w, h)
          for (const p of ps) {
            p.a += p.sp * 0.005
            const x = cx + Math.cos(p.a) * p.r
            const y = cy + Math.sin(p.a) * p.r * 0.45
            const g = ctx.createRadialGradient(x, y, 0, x, y, p.sz)
            g.addColorStop(0, p.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = p.al
            ctx.beginPath()
            ctx.arc(x, y, p.sz, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Comet Trails',
    make(ctx, w, h, P) {
      const cs = Array.from({ length: 6 }, () => ({
        x: rand(w),
        y: rand(h),
        dx: rand(-0.8, 0.8),
        dy: rand(-0.8, 0.8),
        c: pick(P.colors),
      }))
      clearBg(ctx, P, w, h)
      return {
        frame() {
          fadeBg(ctx, P, w, h, 0.1)
          for (const c of cs) {
            c.x += c.dx
            c.y += c.dy
            if (c.x < 0 || c.x > w) c.dx *= -1
            if (c.y < 0 || c.y > h) c.dy *= -1
            ctx.fillStyle = c.c
            ctx.globalAlpha = 0.9
            ctx.beginPath()
            ctx.arc(c.x, c.y, 2.2, 0, TAU)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Woven Lines',
    make(ctx, w, h, P) {
      const f1 = rand(0.01, 0.02)
      const f2 = rand(0.01, 0.02)
      const c1 = P.colors[0]
      const c2 = P.colors[1]
      const N = 12
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let i = 0; i < N; i++) {
            const yy = (i / (N - 1)) * h
            ctx.beginPath()
            for (let x = 0; x <= w; x += 8) {
              const y = yy + Math.sin(x * f1 + t * 0.4 + i) * 6
              if (x) ctx.lineTo(x, y)
              else ctx.moveTo(x, y)
            }
            ctx.strokeStyle = c1
            ctx.globalAlpha = 0.3
            ctx.lineWidth = 1
            ctx.stroke()
          }
          for (let i = 0; i < N * 3; i++) {
            const xx = (i / (N * 3 - 1)) * w
            ctx.beginPath()
            for (let y = 0; y <= h; y += 8) {
              const x = xx + Math.sin(y * f2 + t * 0.3 + i) * 6
              if (y) ctx.lineTo(x, y)
              else ctx.moveTo(x, y)
            }
            ctx.strokeStyle = c2
            ctx.globalAlpha = 0.3
            ctx.lineWidth = 1
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },

  {
    name: 'Spectrum Glow',
    make(ctx, w, h, P) {
      const bars = 26
      const bw = w / bars
      const st = Array.from({ length: bars }, () => ({
        c: pick(P.colors),
        ph: rand(TAU),
        sp: rand(0.4, 0.9),
      }))
      return {
        frame(t) {
          clearBg(ctx, P, w, h)
          for (let i = 0; i < bars; i++) {
            const s = st[i]
            const val = (Math.sin(t * s.sp + s.ph) * 0.5 + 0.5) * 0.78 + 0.1
            const bh = val * h
            const x = i * bw
            const g = ctx.createLinearGradient(0, h, 0, h - bh)
            g.addColorStop(0, s.c)
            g.addColorStop(1, 'transparent')
            ctx.fillStyle = g
            ctx.globalAlpha = 0.6
            ctx.fillRect(x + bw * 0.15, h - bh, bw * 0.7, bh)
          }
          ctx.globalAlpha = 1
        },
      }
    },
  },
]
