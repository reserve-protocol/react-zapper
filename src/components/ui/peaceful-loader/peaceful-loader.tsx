import { useEffect, useRef } from 'react'
import { cn } from '../../../utils/cn'
import { buildPalette } from './palette'
import { VIZ } from './visualizations'

export function PeacefulLoader({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5)
    const viz = VIZ[(Math.random() * VIZ.length) | 0]

    const setup = () => {
      const rect = container.getBoundingClientRect()
      const w = rect.width || 432
      const h = rect.height || 126
      canvas.width = Math.max(1, Math.round(w * DPR))
      canvas.height = Math.max(1, Math.round(h * DPR))
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      return viz.make(ctx, w, h, buildPalette(container))
    }
    let run = setup()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      run.frame(0)
      return
    }

    let visible = true
    let hidden = document.hidden
    let raf = 0
    let start: number | null = null

    const loop = (now: number) => {
      if (start === null) start = now
      if (visible && !hidden) {
        try {
          run.frame((now - start) / 1000)
        } catch {
          // a failing frame must not tear down the loop
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    let resizeTimer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        run = setup()
      }, 150)
    })
    ro.observe(container)

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { rootMargin: '150px' }
    )
    io.observe(container)

    const onVisibility = () => {
      hidden = document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('absolute inset-0 overflow-hidden', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
