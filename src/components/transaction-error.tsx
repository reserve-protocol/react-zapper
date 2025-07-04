import React from 'react'
import { cn } from '../utils/cn'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  error?: Error | null
  withName?: boolean
}

const TransactionError = ({ error, withName = true, className, ...props }: Props) => {
  if (!error) {
    return null
  }
  let parsed = false

  const messageSplit = error.message.split('\n')
  let message =
    messageSplit.length > 1
      ? messageSplit[0] + ' ' + messageSplit[1]
      : (messageSplit[0] ?? '')

  if (message.includes('0x168cdd18')) {
    parsed = true
    message =
      'Proposal cannot be executed while another auction is currently running'
  }

  return (
    <div className={cn(className)} {...props}>
      <p
        className={cn(
          "text-red-500 text-sm whitespace-pre-wrap",
          parsed ? "break-words" : "break-all"
        )}
      >
        {withName && `${error.name}:`}
        {withName && <br />}
        {message}
      </p>
    </div>
  )
}

export default TransactionError