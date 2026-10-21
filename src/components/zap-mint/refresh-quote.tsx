import { useLingui } from '@lingui/react/macro'
import { Loader, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'

const REFRESH_COOLDOWN_MS = 5_000

const RefreshQuote = ({
  onClick,
  loading,
  disabled,
}: {
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
}) => {
  const { t } = useLingui()
  const cooldownUntil = useRef(0)
  const [seconds, setSeconds] = useState(0)
  const coolingDown = seconds > 0

  useEffect(() => {
    if (!coolingDown) return
    const timer = setInterval(() => {
      setSeconds(
        Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000))
      )
    }, 250)
    return () => clearInterval(timer)
  }, [coolingDown])

  const handleClick = () => {
    if (disabled || loading || !onClick || Date.now() < cooldownUntil.current)
      return
    cooldownUntil.current = Date.now() + REFRESH_COOLDOWN_MS
    setSeconds(REFRESH_COOLDOWN_MS / 1000)
    onClick()
  }

  return (
    <Button
      type="button"
      size="sm"
      className="h-11 gap-2 text-legend rounded-xl disabled:pointer-events-auto disabled:cursor-not-allowed"
      variant="outline"
      onClick={handleClick}
      disabled={disabled || loading || coolingDown || !onClick}
      aria-label={t`Refresh quote`}
      aria-busy={!!loading}
    >
      {loading ? (
        <Loader
          size={16}
          className="motion-safe:animate-spin-slow"
          aria-hidden="true"
        />
      ) : (
        <RefreshCw size={16} aria-hidden="true" />
      )}
      <span>{coolingDown ? t`Refresh in ${seconds}s` : t`Refresh quote`}</span>
    </Button>
  )
}

export default RefreshQuote
