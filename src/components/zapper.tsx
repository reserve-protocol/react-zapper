import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Trans } from '@lingui/react/macro'
import { ArrowLeft, Settings, X } from 'lucide-react'
import React, { useEffect } from 'react'
import { ZapperProps } from '../types'
import { ZapperI18nProvider } from '../i18n/provider'
import { useTrackIndexDTFZapClick } from '../utils/tracking'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import Updaters from './updaters'
import {
  defaultSelectedTokenAtom,
  openZapMintModalAtom,
  selectedTokenAtom,
  showZapSettingsAtom,
  tokenInAtom,
  tokenOutAtom,
  zapFetchingAtom,
  zapMintInputAtom,
  zapOngoingTxAtom,
  zapSuccessAtom,
  zapperCurrentTabAtom,
  zapRefetchAtom,
} from './zap-mint/atom'
import Buy from './zap-mint/buy'
import LowLiquidityWarning from './zap-mint/low-liquidity-warning'
import RefreshQuote from './zap-mint/refresh-quote'
import Sell from './zap-mint/sell'
import ZapHealthcheck from './zap-mint/zap-healthcheck'
import ZapSettings from './zap-mint/zap-settings'
import ZapSuccessView from './zap-mint/zap-success-view'

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

  const [zapSuccess, setZapSuccess] = useAtom(zapSuccessAtom)

  const { trackClick } = useTrackIndexDTFZapClick('overview')

  const handleClose = () => {
    setOpen(false)
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

  // Nav header (settings / refresh + close) shown above the Buy/Sell form.
  const navHeader = (
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
  )

  if (mode === 'inline') {
    if (zapSuccess) {
      return <ZapSuccessView onClose={() => setZapSuccess(undefined)} />
    }
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
                  <Trans>Buy</Trans>
                </TabsTrigger>
                <TabsTrigger value="sell">
                  <Trans>Sell</Trans>
                </TabsTrigger>
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

  // Shared dialog body for modal & simple modes.
  const dialogBody = zapSuccess ? (
    <>
      <DialogTitle className="sr-only">
        <Trans>Transaction successful</Trans>
      </DialogTitle>
      <ZapSuccessView onClose={handleClose} />
    </>
  ) : (
    <>
      {navHeader}
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
    </>
  )

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showClose={false}
        className="max-h-[90dvh] overflow-y-auto p-2 rounded-t-2xl sm:rounded-[20px] border-none"
      >
        {dialogBody}
      </DialogContent>
    </Dialog>
  )

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
        {dialog}
      </>
    )
  }

  // Modal mode content
  return dialog
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
  scheduleCall,
  locale,
  refreshRate,
}) => {
  return (
    <ZapperI18nProvider locale={locale}>
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
        scheduleCall={scheduleCall}
        refreshRate={refreshRate}
      />
      <ZapperContent mode={mode} sellOnly={sellOnly} disabled={disabled} />
    </ZapperI18nProvider>
  )
}

// Export ZapperContent and Updaters for use without providers
export { Updaters, ZapperContent }

export default Zapper
