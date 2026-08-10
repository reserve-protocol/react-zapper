import TokenLogo from '../token-logo'
import { Button } from './button'
import { PeacefulLoader } from './peaceful-loader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { NumericalInput } from './input'
import useMediaQuery from '../../hooks/useMediaQuery'
import { cn } from '../../utils/cn'
import { chainIdAtom, indexDTFAtom, indexDTFBrandAtom } from '../../state/atoms'
import { Token } from '../../types'
import { formatCurrency, formatElapsedTime } from '../../utils'
import { useAtomValue } from 'jotai'
import {
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Loader,
} from 'lucide-react'
import React, {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Trans } from '@lingui/react/macro'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion'
import Help from './help'
import { Separator } from './separator'
import { Skeleton } from './skeleton'

type TokenWithBalance = Token & { balance?: string }

type SwapItem = {
  title?: string
  price?: ReactNode
  address?: string
  symbol?: string
  balance?: string
  onMax?: () => void
  value?: string
  onChange?: (value: string) => void
  tokens?: TokenWithBalance[]
  onTokenSelect?: (token: Token) => void
  tokensLoading?: boolean
  disabled?: boolean
  className?: string
}

type SwapProps = {
  from: SwapItem
  to: SwapItem
  onSwap?: () => void
  loading?: boolean
  disabled?: boolean
}

const TokenInput = ({
  value = '',
  onChange = () => {},
  disabled = false,
}: Pick<SwapItem, 'value' | 'onChange'> & { disabled?: boolean }) => {
  const ref = useRef<HTMLInputElement>(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useLayoutEffect(() => {
    if (isDesktop && ref.current) {
      // Need to wait a tick for the input to be properly mounted
      setTimeout(() => {
        ref.current?.focus()
      }, 0)
    }
  }, [isDesktop])

  return (
    <NumericalInput
      value={value}
      variant="transparent"
      placeholder="0"
      onChange={onChange}
      className="placeholder:text-primary/70 text-primary"
      ref={ref}
      autoFocus={isDesktop}
      disabled={disabled}
    />
  )
}

const TokenSelector = ({
  address = '',
  symbol = '',
  tokens,
  onTokenSelect,
  tokensLoading = false,
  disabled = false,
}: Pick<
  SwapItem,
  'address' | 'symbol' | 'tokens' | 'onTokenSelect' | 'tokensLoading'
> & {
  disabled?: boolean
}) => {
  const chainId = useAtomValue(chainIdAtom)
  const brand = useAtomValue(indexDTFBrandAtom)
  const dtf = useAtomValue(indexDTFAtom)
  const src =
    brand?.dtf?.icon && address.toLowerCase() === dtf?.id.toLowerCase()
      ? brand?.dtf?.icon
      : undefined
  const [open, setOpen] = React.useState(false)

  if (tokensLoading) {
    return (
      <div className="flex flex-col gap-1 justify-center items-end min-w-fit mt-1">
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
    )
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex flex-col gap-1 justify-between items-end min-w-fit">
        <div className="flex items-center gap-1.5 text-2xl font-normal">
          <TokenLogo
            size="lg"
            src={src}
            symbol={symbol}
            address={address}
            chain={chainId}
          />
          <span>{symbol}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-between gap-1 mt-1 items-end min-w-fit -mr-1.5">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="ghost"
            disabled={disabled}
            className="flex items-center rounded-full text-2xl gap-2 h-auto hover:bg-accent px-1.5 justify-between"
            size="lg"
          >
            <div className="flex font-normal items-center gap-1.5">
              <TokenLogo
                size="lg"
                symbol={symbol}
                address={address}
                chain={chainId}
              />
              <span>{symbol}</span>
            </div>
            <div className="flex items-center rounded-full bg-white dark:bg-primary/20 dark:text-white  p-0.5">
              {open ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[200px] max-h-[300px] overflow-y-auto"
        >
          {tokens.map((token) => (
            <DropdownMenuItem
              key={token.address}
              onClick={() => onTokenSelect?.(token)}
              className="flex items-center justify-between gap-2 pr-2"
            >
              <div className="flex items-center gap-2">
                <TokenLogo
                  size="md"
                  symbol={token.symbol}
                  address={token.address}
                  chain={chainId}
                />
                <span className="text-lg">{token.symbol}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {token?.balance
                  ? `${formatCurrency(Number(token.balance), 4)}`
                  : 0}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const PriceValue = ({ price }: Pick<SwapItem, 'price'>) => (
  <div className="overflow-hidden">
    <span className="text-legend block truncate">{price || '$0.00'}</span>
  </div>
)

const MaxButton = ({
  balance,
  onMax,
  loading = false,
  disabled,
}: Pick<SwapItem, 'balance' | 'onMax'> & {
  loading?: boolean
  disabled?: boolean
}) => (
  <div className="flex items-center gap-1 text-base">
    <span className="text-legend">
      <Trans>Balance</Trans>
    </span>
    {loading ? (
      <Skeleton className="h-4 w-14" />
    ) : (
      <span className="font-bold">{balance}</span>
    )}
    <Button
      variant="ghost"
      className="h-6 rounded-full ml-1 bg-primary/15 text-primary/80 hover:bg-primary/15 hover:text-primary/80 font-semibold"
      size="xs"
      onClick={onMax}
      disabled={disabled || loading}
    >
      <Trans>Max</Trans>
    </Button>
  </div>
)

export const TokenInputBox = ({
  from,
  disabled,
}: Pick<SwapProps, 'from' | 'disabled'>) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-4 bg-muted rounded-xl',
        from.className
      )}
    >
      <div>
        <h3 className="text-primary">
          {from?.title || <Trans>Order size</Trans>}
        </h3>
        <div className="flex gap-1">
          <TokenInput {...from} disabled={disabled || from.disabled} />
          <TokenSelector {...from} disabled={disabled || from.disabled} />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 justify-between">
          <div className="max-w-[220px]">
            <PriceValue price={from.price} />
          </div>
          <MaxButton
            balance={from.balance}
            onMax={from.onMax}
            loading={from.tokensLoading}
            disabled={disabled || from.disabled}
          />
        </div>
      </div>
    </div>
  )
}

const SlowLoading = ({ enabled }: { enabled: boolean }) => {
  const [elapsed, setElapsed] = useState(1)

  useEffect(() => {
    if (!enabled) {
      setElapsed(1)
      return
    }

    const elapsedInterval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(elapsedInterval)
    }
  }, [enabled])

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center w-full h-full rounded-xl overflow-hidden opacity-0',
        enabled ? 'animate-fade-in z-10' : '-z-10'
      )}
    >
      {enabled && <PeacefulLoader />}
      <div className="relative flex items-center gap-1 justify-between bg-card rounded-full px-3 py-2 text-sm text-primary border border-primary">
        <div className="flex items-center gap-1">
          <Loader size={16} className="animate-spin-slow" />
          <Trans>Sourcing liquidity</Trans>
        </div>
        <div className="text-muted-foreground min-w-4">
          {formatElapsedTime(elapsed)}
        </div>
      </div>
    </div>
  )
}

export const TokenOutputBox = ({
  to,
  loading,
}: Pick<SwapProps, 'to' | 'loading'>) => {
  const [slowLoading, setSlowLoading] = useState(false)

  useEffect(() => {
    let slowLoadingTimeout: ReturnType<typeof setTimeout> | undefined
    let minimumDisplayTimeout: ReturnType<typeof setTimeout> | undefined

    if (loading) {
      slowLoadingTimeout = setTimeout(() => {
        setSlowLoading(true)
        minimumDisplayTimeout = setTimeout(() => {
          if (!loading) {
            setSlowLoading(false)
          }
        }, 3000)
      }, 3000)
    } else {
      clearTimeout(slowLoadingTimeout)
      clearTimeout(minimumDisplayTimeout)
      setSlowLoading(false)
    }

    return () => {
      clearTimeout(slowLoadingTimeout)
      clearTimeout(minimumDisplayTimeout)
    }
  }, [loading])

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 p-4 bg-card rounded-xl border-border border',
        to.className
      )}
    >
      <SlowLoading enabled={slowLoading} />
      <div>
        <h3>{to.title || <Trans>Projected proceeds</Trans>}</h3>
        <div className="flex items-center gap-2 justify-between">
          {loading ? (
            <Skeleton className="w-full h-[40px]" />
          ) : (
            <NumericalInput
              value={to.value || '0'}
              variant="transparent"
              placeholder="0"
              onChange={() => {}}
              autoFocus
              disabled
              className="disabled:cursor-auto disabled:opacity-100"
            />
          )}
          <TokenSelector {...to} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="w-[60%] h-[24px]" />
      ) : (
        <div className="max-w-[350px]">
          <PriceValue price={to.price} />
        </div>
      )}
    </div>
  )
}

export const ArrowSeparator = ({
  onSwap,
  className,
}: Pick<SwapProps, 'onSwap'> & { className?: string }) => {
  if (onSwap) {
    return (
      <Button
        className={cn(
          'h-8 px-[6px] rounded-xl w-max mx-auto border-card border-2 -mt-4 -mb-4 z-20 text-foreground bg-muted hover:bg-border',
          className
        )}
        onClick={onSwap}
      >
        <ArrowUpDown size={16} />
      </Button>
    )
  }
  return (
    <div
      className={cn(
        'rounded-xl bg-muted w-max p-2 mx-auto border-white border-2 -mt-4 -mb-4 z-20 flex items-center justify-center',
        className
      )}
    >
      <ArrowDown size={16} />
    </div>
  )
}

type SwapDetailItem = {
  left: ReactNode
  right?: ReactNode
  help?: ReactNode
  className?: string
}

const SwapDetailItem = ({ left, right, help, className }: SwapDetailItem) => {
  return (
    <div
      className={cn(
        'flex gap-1 items-center justify-between flex-1 px-1',
        className
      )}
    >
      <div className="flex gap-1 items-center">
        <div>{left}</div>
        {!!help && <Help content={help} className="text-muted-foreground" />}
      </div>
      {!!right && <div className="animate-fade-in">{right}</div>}
    </div>
  )
}

type SwapDetailsProps = {
  visible: SwapDetailItem
  details: SwapDetailItem[]
  /** Rendered inside the expanded content, above the detail rows. */
  children?: ReactNode
}

export const SwapDetails = ({
  visible,
  details,
  children,
}: SwapDetailsProps) => {
  const [open, setOpen] = useState(false)
  return (
    <Accordion
      type="single"
      collapsible
      value={String(open)}
      onValueChange={(value) => setOpen(Boolean(value))}
    >
      <AccordionItem value="true" className="border-b-0">
        {/* px-0 on the inner item so the row's effective inset (trigger px-3)
            matches the slippage row above the accordion */}
        <AccordionTrigger className="px-3 py-2 font-light hover:border-transparent focus:outline-none">
          <SwapDetailItem
            left={visible.left}
            right={visible.right}
            className="px-0"
          />
        </AccordionTrigger>
        <AccordionContent>
          <Separator className="mt-2" />
          {children && <div className="px-1 pt-3">{children}</div>}
          <div className="px-2 pt-4 pb-2 flex flex-col gap-2">
            {details.map((detail, index) => (
              <SwapDetailItem {...detail} key={`swap-detail-${index}`} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

const Swap = (props: SwapProps) => {
  return (
    <div className={cn('flex flex-col', props.onSwap ? 'gap-0.5' : 'gap-0')}>
      <TokenInputBox {...props} />
      <ArrowSeparator {...props} />
      <TokenOutputBox {...props} />
    </div>
  )
}

export default Swap
