import { usePrice } from '@/hooks/usePrice'
import { quoteIdAtom, retryIdAtom, sessionIdAtom } from '@/state/tracking-atoms'
import zapper, { ReportPayload } from '@/types/api'
import { formatCurrency, formatToSignificantDigits } from '@/utils'
import { useAtomValue } from 'jotai'
import { ReactNode, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  apiUrlAtom,
  chainIdAtom,
  indexDTFAtom,
  indexDTFPriceAtom,
} from '../../state/atoms'
import { Button } from '../ui/button'
import Copy from '../ui/copy'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import {
  selectedTokenOrDefaultAtom,
  tokenInAtom,
  tokenOutAtom,
  zapMintInputAtom,
  zapperCurrentTabAtom,
  zapSwapEndpointAtom,
} from './atom'

const SWAP_ERROR_MSG =
  'Sorry, we’re having a hard time finding a route that makes sense for you. Please try again in a bit.'
const ERROR_MAP = {
  '404': SWAP_ERROR_MSG,
  '500': SWAP_ERROR_MSG,
  '504': SWAP_ERROR_MSG,
  'failed to construct swap': SWAP_ERROR_MSG,
  INSUFFICIENT_OUT:
    'Sorry, the market is volatile right now. Please increase slippage in your settings.',
}

const ReportButton = ({ error }: { error?: string }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [hasReported, setHasReported] = useState(false)

  const chainId = useAtomValue(chainIdAtom)
  const apiUrl = useAtomValue(apiUrlAtom)
  const operation = useAtomValue(zapperCurrentTabAtom)
  const tokenIn = useAtomValue(tokenInAtom)
  const tokenOut = useAtomValue(tokenOutAtom)
  const amount = useAtomValue(zapMintInputAtom)
  const sessionId = useAtomValue(sessionIdAtom)
  const quoteId = useAtomValue(quoteIdAtom)
  const retryId = useAtomValue(retryIdAtom)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const selectedTokenPrice = usePrice(chainId, selectedToken.address)
  const indexDTFPrice = useAtomValue(indexDTFPriceAtom)

  const tokenInPrice = operation === 'buy' ? selectedTokenPrice : indexDTFPrice
  const inputPrice = (tokenInPrice || 0) * Number(amount)

  const handleReport = async () => {
    if (hasReported || !error || !sessionId || !quoteId || !retryId) return

    setIsLoading(true)

    try {
      const payload: ReportPayload = {
        sessionId,
        quoteId,
        retryId,
        error,
        tokenIn: {
          address: tokenIn?.address || '',
          symbol: tokenIn?.symbol || '',
        },
        tokenOut: {
          address: tokenOut?.address || '',
          symbol: tokenOut?.symbol || '',
        },
        amount: formatToSignificantDigits(Number(amount) || 0),
        value: formatCurrency(inputPrice || 0, 0),
      }

      const response = await fetch(zapper.report(apiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setHasReported(true)
        toast.success(
          'Report sent successfully. Thank you for helping us improve!'
        )
      } else {
        toast.error('Failed to send report. Please try again.')
      }
    } catch (err) {
      console.error('Error sending report:', err)
      toast.error('Failed to send report. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      className="rounded-full h-8 px-3"
      onClick={handleReport}
      disabled={isLoading || hasReported || !sessionId || !quoteId || !retryId}
    >
      {isLoading ? 'Sending...' : hasReported ? 'Reported' : 'Report'}
    </Button>
  )
}

const CopySwapButton = ({
  errorMsg,
  errorMsgDisplayed,
}: {
  errorMsg?: string
  errorMsgDisplayed?: string
}) => {
  const endpoint = useAtomValue(zapSwapEndpointAtom)
  const sessionId = useAtomValue(sessionIdAtom)
  const quoteId = useAtomValue(quoteIdAtom)
  const retryId = useAtomValue(retryIdAtom)

  const copyText = useMemo(() => {
    return `
    Session ID: ${sessionId}\n
    Quote ID: ${quoteId}\n
    Retry ID: ${retryId}\n
    Endpoint: ${endpoint}\n
    Original error: ${errorMsg}\n
    Displayed error: ${errorMsgDisplayed}
  `
  }, [endpoint, errorMsg, errorMsgDisplayed, sessionId, quoteId, retryId])

  return (
    <div className="flex items-center gap-1.5 text-xs mx-auto">
      <Copy value={copyText} size={14} outline />
      <ReportButton error={errorMsg} />
    </div>
  )
}

const GoToManualRedeem = () => {
  const indexDTF = useAtomValue(indexDTFAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const isRedeem = currentTab === 'sell'

  if (!isRedeem || !indexDTF) return null

  return (
    <div className="mt-2 hidden sm:block p-3 rounded-3xl text-center text-sm">
      <span className="font-semibold block">
        Having issues minting? (Zaps are in beta)
      </span>
      <span className="text-legend">
        Wait and try again or consider using manual mode
      </span>
    </div>
  )
}

const ErrorMessage = ({
  error,
  displayedError,
  errorTooltip = displayedError,
}: {
  error?: string
  displayedError?: string
  errorTooltip?: ReactNode
}) => {
  if (!error || !displayedError) return null

  return (
    <div className="p-1 py-2 sm:p-4 sm:py-2">
      <div className="grid grid-cols-[1fr,auto] gap-0 items-start justify-start font-light">
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-red-500 text-xs text-start truncate w-[180px] sm:w-[280px] cursor-help">
                  <span className="block sm:hidden">
                    {displayedError.substring(0, 32)}...
                  </span>
                  <span className="hidden sm:block">
                    {displayedError.substring(0, 50)}...
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs break-words">
                {errorTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="text-muted-foreground text-xs text-start">
            Please report this to help us improve
          </div>
        </div>
        <div>
          <CopySwapButton errorMsg={error} errorMsgDisplayed={displayedError} />
        </div>
      </div>
      <GoToManualRedeem />
    </div>
  )
}

const ZapErrorMsg = ({ error }: { error?: string }) => {
  if (!error) return null

  const errorMsgDisplayed =
    Object.entries(ERROR_MAP).find(([key]) =>
      error.toLowerCase().includes(key.toLowerCase())
    )?.[1] || error

  return <ErrorMessage error={error} displayedError={errorMsgDisplayed} />
}

export const ZapTxErrorMsg = ({ error }: { error?: Error | null }) => {
  if (!error) return null

  const errorMsg = error?.message

  return (
    <ErrorMessage
      error={errorMsg}
      displayedError={errorMsg}
      errorTooltip={errorMsg}
    />
  )
}

export default ZapErrorMsg
