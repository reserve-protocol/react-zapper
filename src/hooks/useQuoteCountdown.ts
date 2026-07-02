import { useEffect, useState } from 'react'

/**
 * Seconds remaining until a quote expires, ticking while `active`.
 * Returns null when inactive or when the quote has no expiration.
 */
const useQuoteCountdown = (
  validUntil: number | null | undefined,
  active: boolean
): number | null => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!active || validUntil == null) {
      setSecondsLeft(null)
      return
    }

    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((validUntil - Date.now()) / 1000)))

    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [validUntil, active])

  return secondsLeft
}

export default useQuoteCountdown
