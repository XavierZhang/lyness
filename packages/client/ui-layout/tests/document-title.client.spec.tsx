// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/client/DocumentTitle.tsx'

afterEach(() => {
  cleanup()
  document.title = ''
  vi.unstubAllEnvs()
})

describe('DocumentTitle', () => {
  it('projects a durable title and restores the product title', () => {
    vi.stubEnv('LYNESS_CLIENT_TITLE', 'lyness')
    document.title = 'stale title'
    const mounted = render(<DocumentTitle productTitle="lyness" />)
    expect(document.title).toBe('lyness')
    mounted.rerender(<DocumentTitle title="First title" productTitle="lyness" />)
    expect(document.title).toBe('First title — lyness')
    mounted.rerender(<DocumentTitle title="Revised title" productTitle="lyness" />)
    expect(document.title).toBe('Revised title — lyness')
    mounted.rerender(<DocumentTitle productTitle="lyness" />)
    expect(document.title).toBe('lyness')
    mounted.unmount()
    expect(document.title).toBe('lyness')
  })

  it('uses the generic title when the build provides no title', () => {
    vi.stubEnv('LYNESS_CLIENT_TITLE', '')
    delete process.env.LYNESS_CLIENT_TITLE
    const mounted = render(<DocumentTitle title="First title" productTitle="LYN Local Build" />)
    expect(document.title).toBe('First title — LYN Local Build')
    mounted.unmount()
    expect(document.title).toBe('LYN Local Build')
  })
})
