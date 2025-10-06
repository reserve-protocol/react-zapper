import { quoteIdAtom, retryIdAtom, sessionIdAtom } from '@/state/tracking-atoms'
import { useAtomValue } from 'jotai'
import Copy from './ui/copy'
import { useMemo } from 'react'

const CopyTraceId = ({ enabled }: { enabled: boolean }) => {
  const sessionId = useAtomValue(sessionIdAtom)
  const quoteId = useAtomValue(quoteIdAtom)
  const retryId = useAtomValue(retryIdAtom)

  const traceId = useMemo(
    () => `sessionId:${sessionId}-quoteId:${quoteId}-retryId:${retryId}`,
    [sessionId, quoteId, retryId]
  )

  if (!sessionId || !quoteId || !retryId || !enabled) {
    return null
  }

  return (
    <div className="flex items-center gap-1 text-xs font-light mx-auto">
      <div>Copy trace id to share with engineering team</div>
      <Copy value={traceId} />
    </div>
  )
}

export default CopyTraceId
