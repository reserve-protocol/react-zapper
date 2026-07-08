import { useEffect, useRef, useState } from 'react'

/**
 * Presentation debounce for loading states: turns on only after the activity
 * has lasted `delay` ms, and once shown stays on for at least `minDuration`
 * ms — so sub-perceptual fetches never blink the UI and the state is
 * readable when it does show.
 */
const useDeferredLoading = (
  active: boolean,
  { delay = 300, minDuration = 400 } = {}
): boolean => {
  const [shown, setShown] = useState(false)
  const shownAtRef = useRef(0)

  useEffect(() => {
    if (active) {
      if (shown) return
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setShown(true)
      }, delay)
      return () => clearTimeout(timer)
    }
    if (!shown) return
    const elapsed = Date.now() - shownAtRef.current
    if (elapsed >= minDuration) {
      setShown(false)
      return
    }
    const timer = setTimeout(() => setShown(false), minDuration - elapsed)
    return () => clearTimeout(timer)
  }, [active, shown, delay, minDuration])

  return shown
}

export default useDeferredLoading
