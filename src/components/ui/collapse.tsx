import { ReactNode, useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

/**
 * Height-collapse via the CSS grid trick (0fr ⇄ 1fr): animates children in
 * and out without measuring them, so late-arriving content still enters
 * smoothly. Children must stay rendered while `open` is false for the exit
 * animation to have something to collapse.
 *
 * A newly mounted instance always paints one closed frame first (double rAF)
 * so content that mounts already-open slides in instead of popping.
 */
const Collapse = ({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) => {
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPainted(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  const effectiveOpen = open && painted

  return (
    <div
      aria-hidden={!effectiveOpen}
      className={cn(
        'grid transition-all duration-200 ease-out',
        effectiveOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

export default Collapse
