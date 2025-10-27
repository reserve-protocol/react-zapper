import { openZapMintModalAtom } from '@/components/zap-mint/atom'
import { walletAtom } from '@/state/atoms'
import { sessionIdAtom } from '@/state/tracking-atoms'
import { generateSessionId } from '@/utils/ids'
import { mixpanelRegister } from '@/utils/tracking'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'

interface SessionTrackerProps {
  mode?: 'modal' | 'inline' | 'simple'
}

const SessionTracker: React.FC<SessionTrackerProps> = ({ mode = 'modal' }) => {
  const setSessionId = useSetAtom(sessionIdAtom)
  const wallet = useAtomValue(walletAtom)
  const isModalOpen = useAtomValue(openZapMintModalAtom)
  const prevWalletRef = useRef<string | undefined>()
  const hasInitializedRef = useRef(false)

  // Generate and register new session ID
  const createNewSession = useCallback(() => {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    mixpanelRegister('sessionId', newSessionId)
  }, [setSessionId])

  useEffect(() => {
    if ((mode === 'inline' || mode === 'simple') && !hasInitializedRef.current) {
      // Inline/Simple mode: generate session on mount
      createNewSession()
      hasInitializedRef.current = true
    } else if (mode === 'modal' && isModalOpen) {
      // Modal mode: generate session when modal opens
      createNewSession()
    }
  }, [mode, isModalOpen, createNewSession])

  // Handle wallet address changes
  useEffect(() => {
    if (
      prevWalletRef.current !== undefined &&
      prevWalletRef.current !== wallet
    ) {
      createNewSession()
    }
    prevWalletRef.current = wallet
  }, [createNewSession, wallet])

  return null
}

export default SessionTracker
