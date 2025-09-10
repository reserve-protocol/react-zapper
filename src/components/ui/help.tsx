import React, { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'
import { cn } from '../../utils/cn'

interface HelpProps {
  content: React.ReactNode
  size?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

const Help: React.FC<HelpProps> = ({
  content,
  size = 12,
  side = 'top',
  className,
}) => {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <span
            className={cn('cursor-pointer inline-flex', className)}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(!open)
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onTouchStart={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(!open)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setOpen(!open)
              }
            }}
          >
            <HelpCircle size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className={!content ? 'hidden' : ''}>
          <span className="inline-block max-w-xs">{content}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default Help