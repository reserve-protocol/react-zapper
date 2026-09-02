import { createContext, useContext, type ReactNode } from 'react'
import type { ZapperTransactionConfirmed } from '../types'

type ZapperEvents = {
  onTransactionConfirmed?: (event: ZapperTransactionConfirmed) => void
}

const ZapperEventsContext = createContext<ZapperEvents>({})

export const ZapperEventsProvider = ({
  events,
  children,
}: {
  events: ZapperEvents
  children: ReactNode
}) => (
  <ZapperEventsContext.Provider value={events}>
    {children}
  </ZapperEventsContext.Provider>
)

export const useZapperEvents = () => useContext(ZapperEventsContext)
