import {
  openZapMintModalAtom,
  zapperCurrentTabAtom,
} from '../components/zap-mint/atom'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { UseZapperModalReturn } from '../types'

export function useZapperModal(): UseZapperModalReturn {
  const [isOpen, setOpen] = useAtom(openZapMintModalAtom)
  const [currentTab, setZapperTab] = useAtom(zapperCurrentTabAtom)

  const open = useCallback(() => setOpen(true), [setOpen])
  const close = useCallback(() => setOpen(false), [setOpen])
  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen])

  const setTab = useCallback(
    (tab: 'buy' | 'sell') => {
      setZapperTab(tab)
    },
    [setZapperTab]
  )

  return {
    isOpen,
    open,
    close,
    toggle,
    setTab,
    currentTab,
  }
}
