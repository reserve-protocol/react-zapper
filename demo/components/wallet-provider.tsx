import type { ReactNode } from 'react'
import { SolarisEthereumProvider, lightTheme, type Theme } from 'solariskit'

const kitTheme = lightTheme()

// Built on the demo's own tokens, so the kit's modals follow the page in both color modes.
const THEME: Theme = {
  ...kitTheme,
  colors: {
    ...kitTheme.colors,
    accentColor: 'hsl(var(--primary))',
    accentColorForeground: 'hsl(var(--primary-foreground))',
    actionButtonSecondaryBackground: 'hsl(var(--accent))',
    closeButton: 'hsl(var(--muted-foreground))',
    closeButtonBackground: 'hsl(var(--accent))',
    generalBorder: 'hsl(var(--border))',
    menuItemBackground: 'hsl(var(--accent))',
    modalBackground: 'hsl(var(--card))',
    modalBorder: 'hsl(var(--border))',
    modalText: 'hsl(var(--card-foreground))',
    modalTextDim: 'hsl(var(--muted-foreground))',
    modalTextSecondary: 'hsl(var(--muted-foreground))',
    profileAction: 'hsl(var(--accent))',
    profileActionHover: 'hsl(var(--accent) / 0.8)',
    profileForeground: 'hsl(var(--background))',
  },
  radii: {
    ...kitTheme.radii,
    actionButton: 'calc(var(--radius) - 2px)',
    menuButton: 'calc(var(--radius) - 2px)',
    modal: 'calc(var(--radius) + 4px)',
  },
}

const WalletProvider = ({ children }: { children: ReactNode }) => (
  <SolarisEthereumProvider theme={THEME}>{children}</SolarisEthereumProvider>
)

export default WalletProvider
