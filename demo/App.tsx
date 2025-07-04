import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useZapperModal, Zapper } from '@reserve-protocol/react-zapper'
import { Toaster } from '@reserve-protocol/react-zapper'
import React, { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { DTF_BY_CHAIN } from './dtf-config'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { Button } from './components/ui/button'

function App() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const availableDTFs = DTF_BY_CHAIN[chainId] || []
  const [selectedDTF, setSelectedDTF] = useState(availableDTFs[0])
  const { open } = useZapperModal()

  // Update selected DTF when chain changes
  React.useEffect(() => {
    const newDTFs = DTF_BY_CHAIN[chainId] || []
    if (newDTFs.length > 0) {
      setSelectedDTF(newDTFs[0])
    }
  }, [chainId])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              React Zapper Demo
            </h1>
            <p className="text-muted-foreground mt-1">
              Test the zapper component with different DTFs and modes
            </p>
          </div>
          <ConnectButton />
        </div>

        {/* DTF Selector */}
        {availableDTFs.length > 0 && (
          <Card className="mb-6 bg-secondary/30 border-border-secondary">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Select DTF
              </CardTitle>
              <CardDescription>
                Choose a DTF token to interact with on the current network
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedDTF?.address}
                onValueChange={(value) => {
                  const dtf = availableDTFs.find((d) => d.address === value)
                  if (dtf) setSelectedDTF(dtf)
                }}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Select a DTF" />
                </SelectTrigger>
                <SelectContent>
                  {availableDTFs.map((dtf) => (
                    <SelectItem key={dtf.address} value={dtf.address}>
                      {dtf.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {!isConnected ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg text-muted-foreground mb-4">
                Please connect your wallet to use the Zapper
              </p>
              <ConnectButton />
            </CardContent>
          </Card>
        ) : !selectedDTF ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg text-muted-foreground">
                No DTFs available on this network
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Modal Mode */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-success rounded-full" />
                  Modal Mode
                </CardTitle>
                <CardDescription>
                  Opens the zapper in a modal dialog
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Zapper
                  chain={chainId}
                  dtfAddress={selectedDTF.address}
                  mode="modal"
                />
                <Button onClick={open} className="w-full" size="lg">
                  Open Zapper Modal
                </Button>
              </CardContent>
            </Card>

            {/* Inline Mode */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Inline Mode
                </CardTitle>
                <CardDescription>Embedded zapper component</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-t border-muted">
                  <Zapper
                    chain={chainId}
                    dtfAddress={selectedDTF.address}
                    mode="inline"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
