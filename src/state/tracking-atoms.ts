import { atom } from 'jotai'

// Tracking IDs atoms
export const sessionIdAtom = atom<string>('')
export const quoteIdAtom = atom<string>('')
export const sourceIdAtom = atom<string>('')
export const retryIdAtom = atom<string>('')
