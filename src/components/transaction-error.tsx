import React from 'react'
import { cn } from '../utils/cn'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  error?: Error | null
  withName?: boolean
}

const TransactionError = ({
  error,
  withName = true,
  className,
  ...props
}: Props) => {
  if (!error) {
    return null
  }
  const messageSplit = error.message.split('\n')
  const message =
    messageSplit.length > 1
      ? messageSplit[0] + ' ' + messageSplit[1]
      : messageSplit[0] ?? ''

  return (
    <div className={cn(className)} {...props}>
      <p className={cn('text-red-500 text-sm whitespace-pre-wrap break-all')}>
        {withName && `${error.name}:`}
        {withName && <br />}
        {message}
      </p>
    </div>
  )
}

export default TransactionError
