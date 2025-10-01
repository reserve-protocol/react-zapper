import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef, useCallback } from 'react'
import { openZapMintModalAtom } from '@/components/zap-mint/atom'
import { walletAtom } from '@/state/atoms'
import { sessionIdAtom } from '@/state/tracking-atoms'
import { generateSessionId } from '@/utils/ids'
import { mixpanelRegister } from '@/utils/tracking'

interface SessionTrackerProps {
  mode: 'modal' | 'inline'
}

const SessionTracker: React.FC<SessionTrackerProps> = ({ mode }) => {
  const [sessionId, setSessionId] = useAtom(sessionIdAtom)
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

  // Handle component mount (inline mode) or modal open (modal mode)
  useEffect(() => {
    if (mode === 'inline' && !hasInitializedRef.current) {
      // Inline mode: generate session on mount
      createNewSession()
      hasInitializedRef.current = true
    } else if (mode === 'modal' && isModalOpen && !sessionId) {
      // Modal mode: generate session when modal opens
      createNewSession()
    }
  }, [mode, isModalOpen, sessionId, createNewSession])

  // Handle wallet address changes
  useEffect(() => {
    // Only generate new session if wallet actually changed (not on initial mount)
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
