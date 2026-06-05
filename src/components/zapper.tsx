import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ArrowLeft, Settings, X } from 'lucide-react'
import React, { useEffect } from 'react'
import useMediaQuery from '../hooks/useMediaQuery'
import { ZapperProps } from '../types'
import { useTrackIndexDTFZapClick } from '../utils/tracking'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import Updaters from './updaters'
import {
  defaultSelectedTokenAtom,
  openZapMintModalAtom,
  selectedTokenAtom,
  showContactInfoAtom,
  showZapSettingsAtom,
  tokenInAtom,
  tokenOutAtom,
  zapFetchingAtom,
  zapMintInputAtom,
  zapMintSuccessAtom,
  zapOngoingTxAtom,
  zapperCurrentTabAtom,
  zapRefetchAtom,
} from './zap-mint/atom'
import Buy from './zap-mint/buy'
import LowLiquidityWarning from './zap-mint/low-liquidity-warning'
import RefreshQuote from './zap-mint/refresh-quote'
import Sell from './zap-mint/sell'
import SubscribeUpdates from './zap-mint/subscribe-updates'
import ZapHealthcheck from './zap-mint/zap-healthcheck'
import ZapSettings from './zap-mint/zap-settings'

interface ZapperContentProps {
  mode: 'modal' | 'inline' | 'simple'
  sellOnly?: boolean
  disabled?: boolean
}

const ZapperContent: React.FC<ZapperContentProps> = ({
  mode,
  sellOnly,
  disabled,
}) => {
  const [open, setOpen] = useAtom(openZapMintModalAtom)
  const [currentTab, setCurrentTab] = useAtom(zapperCurrentTabAtom)
  const [showSettings, setShowSettings] = useAtom(showZapSettingsAtom)
  const defaultToken = useAtomValue(defaultSelectedTokenAtom)
  const setSelectedToken = useSetAtom(selectedTokenAtom)
  const zapRefetch = useAtomValue(zapRefetchAtom)
  const zapFetching = useAtomValue(zapFetchingAtom)
  const zapOngoingTx = useAtomValue(zapOngoingTxAtom)
  const input = useAtomValue(zapMintInputAtom)
  const invalidInput = isNaN(Number(input)) || Number(input) === 0

  const tokenIn = useAtomValue(tokenInAtom)
  const tokenOut = useAtomValue(tokenOutAtom)

  const showContactInfo = useAtomValue(showContactInfoAtom)
  const [mintSuccess, setMintSuccess] = useAtom(zapMintSuccessAtom)
  // Below 900px the side sheet would overflow the viewport, so fall back to the
  // stacked mobile card (rendered inside the modal by ZapSuccess).
  const isWideScreen = useMediaQuery('(min-width: 900px)')
  // Contact sheet peeks out from behind the modal on wider screens after a mint.
  // Inline mode never uses the sheet — it renders the stacked card via ZapSuccess.
  const showContactSheet =
    mintSuccess && showContactInfo && isWideScreen && mode !== 'inline'

  const { trackClick } = useTrackIndexDTFZapClick('overview')

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) setMintSuccess(false)
  }

  const contactSheet = showContactSheet ? (
    <div
      key="contact-sheet"
      className="absolute top-0 left-full -z-10 -ml-8 flex h-full w-[400px] flex-col overflow-y-auto rounded-r-2xl bg-secondary text-secondary-foreground pl-10 pr-2 pt-6 pb-2 shadow-lg animate-slide-in-right"
    >
      <SubscribeUpdates />
    </div>
  ) : null

  // The dialog is viewport-centered on the modal. When the sheet is open, shift
  // the whole unit left by half the sheet's visible width (400 - 32 overlap =
  // 368 → 184) so the modal+sheet pair ends up centered, and animate the shift
  // in sync with the sheet sliding out (both 500ms ease-out, so the modal
  // reaches its final position exactly when the sheet finishes opening).
  const dialogContentClass = `p-0 bg-transparent border-none shadow-none overflow-visible transition-[margin] duration-500 ease-out ${
    showContactSheet ? 'ml-[-184px]' : 'ml-0'
  }`

  const handleClose = () => {
    handleOpenChange(false)
  }

  useEffect(() => {
    setShowSettings(false)
    setSelectedToken(defaultToken)
    return () => {
      setShowSettings(false)
      setSelectedToken(defaultToken)
    }
  }, [defaultToken, setSelectedToken, setShowSettings])

  const handleSettingsClick = () => {
    setShowSettings(true)
    trackClick('zap_settings', tokenIn?.symbol || '', tokenOut?.symbol || '')
  }

  const handleRefreshClick = () => {
    zapRefetch.fn?.()
    trackClick('zap_refresh', tokenIn?.symbol || '', tokenOut?.symbol || '')
  }

  const effectiveTab = sellOnly ? 'sell' : currentTab

  const handleTabChange = (value: string) => {
    const newTab = value as 'buy' | 'sell'
    if (sellOnly && newTab === 'buy') return
    setCurrentTab(newTab)
  }

  if (mode === 'inline') {
    return (
      <Tabs
        value={effectiveTab}
        className="flex flex-col flex-grow"
        onValueChange={handleTabChange}
      >
        <div className="flex justify-between gap-2">
          {showSettings ? (
            <Button
              variant="outline"
              className="h-[34px] px-2 rounded-xl"
              onClick={() => setShowSettings(false)}
            >
              <ArrowLeft size={16} />
            </Button>
          ) : (
            <>
              <TabsList className="h-9 px-0.5">
                <TabsTrigger
                  value="buy"
                  disabled={sellOnly}
                  className={sellOnly ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Buy
                </TabsTrigger>
                <TabsTrigger value="sell">Sell</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-[34px] px-2 rounded-xl"
                  onClick={handleSettingsClick}
                >
                  <Settings size={16} />
                </Button>
                <RefreshQuote
                  small
                  onClick={handleRefreshClick}
                  loading={zapFetching}
                  disabled={zapFetching || zapOngoingTx || invalidInput}
                />
              </div>
            </>
          )}
        </div>
        {showSettings && (
          <div className="mt-2">
            <ZapSettings />
          </div>
        )}

        <div className={showSettings ? 'hidden' : 'opacity-100'}>
          <div className="flex flex-col">
            <LowLiquidityWarning className="mt-2" />
            <ZapHealthcheck className="mt-2" />
            <TabsContent value="buy">
              <Buy mode="inline" disabled={disabled} />
            </TabsContent>
            <TabsContent value="sell">
              <Sell mode="inline" sellOnly={sellOnly} disabled={disabled} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    )
  }

  // Simple mode: render input UI + modal dialog
  if (mode === 'simple') {
    return (
      <>
        <div className="flex flex-col">
          {effectiveTab === 'buy' ? (
            <Buy mode="simple" disabled={disabled} />
          ) : (
            <Sell mode="simple" sellOnly={sellOnly} disabled={disabled} />
          )}
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent showClose={false} className={dialogContentClass}>
            <div
              key="zap-modal-box"
              className="relative z-10 flex w-full flex-col gap-2 rounded-t-2xl sm:rounded-3xl bg-background p-2 shadow-lg"
            >
              <DialogTitle className="flex justify-between gap-2 sm:p-0">
                {showSettings ? (
                  <Button
                    variant="outline"
                    className="h-[34px] px-2 rounded-xl"
                    onClick={() => setShowSettings(false)}
                  >
                    <ArrowLeft size={16} />
                  </Button>
                ) : (
                  <div className="flex justify-between gap-1">
                    <Button
                      variant="outline"
                      className="h-[34px] px-2 rounded-xl"
                      onClick={handleSettingsClick}
                    >
                      <Settings size={16} />
                    </Button>
                    <RefreshQuote
                      small
                      onClick={handleRefreshClick}
                      loading={zapFetching}
                      disabled={zapFetching || zapOngoingTx || invalidInput}
                    />
                  </div>
                )}
                <Button
                  variant="outline"
                  className="h-[34px] px-2 rounded-xl"
                  onClick={handleClose}
                >
                  <X size={16} />
                </Button>
              </DialogTitle>

              {showSettings && <ZapSettings />}

              <div className={showSettings ? 'hidden' : 'opacity-100'}>
                <div className="flex flex-col gap-2">
                  <LowLiquidityWarning />
                  <ZapHealthcheck />
                  {effectiveTab === 'buy' ? (
                    <Buy disabled={disabled} />
                  ) : (
                    <Sell sellOnly={sellOnly} disabled={disabled} />
                  )}
                </div>
              </div>
            </div>
            {contactSheet}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Modal mode content
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false} className={dialogContentClass}>
        <div
          key="zap-modal-box"
          className="relative z-10 flex w-full flex-col gap-2 rounded-t-2xl sm:rounded-2xl bg-background p-2 shadow-lg"
        >
          <DialogTitle className="flex justify-between gap-2 sm:p-0">
            {showSettings ? (
              <Button
                variant="outline"
                className="h-[34px] px-2 rounded-xl"
                onClick={() => setShowSettings(false)}
              >
                <ArrowLeft size={16} />
              </Button>
            ) : (
              <div className="flex justify-between gap-1">
                <Button
                  variant="outline"
                  className="h-[34px] px-2 rounded-xl"
                  onClick={handleSettingsClick}
                >
                  <Settings size={16} />
                </Button>
                <RefreshQuote
                  small
                  onClick={handleRefreshClick}
                  loading={zapFetching}
                  disabled={zapFetching || zapOngoingTx || invalidInput}
                />
              </div>
            )}
            <Button
              variant="outline"
              className="h-[34px] px-2 rounded-xl"
              onClick={handleClose}
            >
              <X size={16} />
            </Button>
          </DialogTitle>

          {showSettings && <ZapSettings />}

          <div className={showSettings ? 'hidden' : 'opacity-100'}>
            <div className="flex flex-col gap-2">
              <LowLiquidityWarning />
              <ZapHealthcheck />
              {effectiveTab === 'buy' ? (
                <Buy disabled={disabled} />
              ) : (
                <Sell sellOnly={sellOnly} disabled={disabled} />
              )}
            </div>
          </div>
        </div>
        {contactSheet}
      </DialogContent>
    </Dialog>
  )
}

export const Zapper: React.FC<ZapperProps> = ({
  mode = 'modal',
  chain,
  dtfAddress,
  apiUrl,
  zapperApiUrl,
  connectWallet,
  defaultSource,
  debug,
  sellOnly,
  disabled,
  showContactInfo,
}) => {
  return (
    <>
      <Updaters
        dtfAddress={dtfAddress}
        chainId={chain}
        apiUrl={apiUrl}
        zapperApiUrl={zapperApiUrl}
        connectWallet={connectWallet}
        defaultSource={defaultSource}
        debug={debug}
        mode={mode}
        sellOnly={sellOnly}
        showContactInfo={showContactInfo}
      />
      <ZapperContent mode={mode} sellOnly={sellOnly} disabled={disabled} />
    </>
  )
}

// Export ZapperContent and Updaters for use without providers
export { Updaters, ZapperContent }

export default Zapper
