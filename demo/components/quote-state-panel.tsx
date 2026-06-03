import { useQuote } from '@reserve-protocol/react-zapper'
import React from 'react'

// Demonstrates the public `useQuote` hook: it reads the live quote state of the
// rendered Zapper, so consumers can show data / loading / error and build their
// own UI around the Zapper. Works anywhere a <Zapper /> is mounted.
const QuoteStatePanel = () => {
  const { data, loading, error } = useQuote()

  return (
    <div className="mt-6 rounded-2xl border border-border-secondary bg-secondary/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">useQuote() state</h3>
      <p className="text-xs text-muted-foreground">
        Live <code>data</code>, <code>loading</code> and <code>error</code> from
        the rendered Zapper
      </p>

      <div className="mt-4 space-y-2 text-xs">
        <div>
          <span className="font-medium text-foreground">loading:</span>{' '}
          <span className="font-mono">{String(loading)}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">error:</span>{' '}
          <span className="font-mono">{error ?? 'null'}</span>
        </div>
        <div>
          <span className="font-medium text-foreground">data:</span>
          <pre className="mt-1 max-h-96 overflow-auto rounded-lg bg-background p-3 text-[11px] leading-relaxed">
            {JSON.stringify(data, null, 2) ?? 'undefined'}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default QuoteStatePanel
