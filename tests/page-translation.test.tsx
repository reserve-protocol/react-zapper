/**
 * Browser page translation (Chrome/Google Translate) wraps text nodes in
 * <font> elements. If a later render removes a bare text node the translator
 * already moved, React throws "removeChild … not a child of this node" and the
 * widget crashes: the output price dropping its " + $x in dust" suffix (Sentry
 * REGISTER-19) and the disabled CTA leaving "Loading..." (REGISTER-1K).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  makeQuote,
  scenario,
  setQuoteBuilder,
  setup,
  waitForReadyCta,
} from './helpers/harness'

function translate(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const font = document.createElement('font')
    node.parentNode!.replaceChild(font, node)
    font.appendChild(node)
  }
}

describe('widget under page translation', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('survives a refreshed quote dropping the dust suffix', async () => {
    let dustValue = 5
    setQuoteBuilder(() => makeQuote({ dustValue }))
    await setup({ refreshRate: 2_000 })
    await waitForReadyCta()
    await waitFor(() => expect(screen.getByText(/in dust/)).toBeTruthy(), {
      timeout: 10_000,
    })

    translate(document.body)
    dustValue = 0

    await waitFor(() => expect(screen.queryByText(/in dust/)).toBeNull(), {
      timeout: 10_000,
    })
    await waitForReadyCta()
  }, 40_000)

  it('survives the CTA leaving "Loading..." for a failed quote', async () => {
    scenario.quoteDelayMs = 1_500
    setQuoteBuilder(() => ({ status: 'error', error: 'no route' }))
    await setup()
    await waitFor(() => expect(getCta().textContent).toMatch(/Loading/), {
      timeout: 10_000,
    })

    translate(document.body)

    await waitFor(() => expect(getCta().textContent).toMatch(/Market Buy/), {
      timeout: 10_000,
    })
  }, 40_000)
})
