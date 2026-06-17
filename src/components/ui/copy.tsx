import { CopyIcon } from 'lucide-react'
import React, { useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

interface CopyProps {
  value: string
  size?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  outline?: boolean
  className?: string
}

const Copy: React.FC<CopyProps> = ({
  value,
  size = 12,
  side = 'top',
  outline = false,
  className,
}) => {
  const { t } = useLingui()
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const displayText = copied ? t`Copied to clipboard!` : t`Copy to clipboard`

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setIsOpen(true)
    setTimeout(() => {
      setCopied(false)
      setIsOpen(false)
    }, 2000) // Reset after 2 seconds
  }

  return (
    <TooltipProvider>
      <Tooltip open={isOpen ? true : undefined} delayDuration={0}>
        <TooltipTrigger
          onClick={handleCopy}
          className={
            outline
              ? 'flex items-center p-2 rounded-full border border-border'
              : ''
          }
        >
          <CopyIcon size={size} className={className} />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {displayText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default Copy
