export * from './cn'
export * from './format'
export * from './constants'
export * from './tracking'

export const minBigInt = (...args: bigint[]) =>
  args.reduce((m, e) => (e < m ? e : m))
