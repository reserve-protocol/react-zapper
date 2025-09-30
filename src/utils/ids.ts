import { v4 as uuidv4, v5 as uuidv5, v7 as uuidv7 } from 'uuid'

export type Source = 'Zapper' | 'Odos'

export const generateSessionId = (): string => {
  return uuidv4()
}

export const generateQuoteId = (url: string): string => {
  return uuidv5(url, uuidv5.URL)
}

export const generateSourceId = (source: Source): string => {
  return uuidv5(source, uuidv5.URL)
}

export const generateRetryId = (): string => {
  return uuidv7()
}
