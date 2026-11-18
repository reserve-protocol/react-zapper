import { ChevronDown } from 'lucide-react'
import { ConnectButton as KitConnectButton } from 'solariskit'
import { Button } from './ui/button'

// The demo's own Button, so the wallet control matches its neighbours in size and hover.
const ConnectButton = ({ showBalance = true }: { showBalance?: boolean }) => (
  <KitConnectButton.Custom>
    {({ account, mounted, openAccountModal, openConnectModal }) => {
      if (!mounted) return null
      if (!account) {
        return <Button onClick={openConnectModal}>Connect Wallet</Button>
      }

      return (
        <Button variant="outline" className="gap-2" onClick={openAccountModal}>
          {showBalance && account.displayBalance && (
            <span className="text-muted-foreground">
              {account.displayBalance}
            </span>
          )}
          {account.ensAvatar && (
            <img
              src={account.ensAvatar}
              alt=""
              className="h-5 w-5 rounded-full"
            />
          )}
          {account.displayName}
          <ChevronDown className="h-4 w-4" />
        </Button>
      )
    }}
  </KitConnectButton.Custom>
)

export default ConnectButton
