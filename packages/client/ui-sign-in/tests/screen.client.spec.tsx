// @vitest-environment jsdom

/**
 * What the screen covers the product for, and what it leaves alone: a
 * deployment with no accounts, a viewer already in one, a read that has not
 * answered, and one that broke.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'
import { SignInScreen, signInHref } from '../src/client/SignInScreen.tsx'
import type { SignInScreenProps } from '../src/client/SignInScreen.tsx'
import type { ViewerState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SIGNED_OUT: ViewerView = {
  accounts: true,
  channels: [
    { id: 'wecom', displayName: '企业微信', redirect: true },
    { id: 'local', displayName: 'This machine', redirect: false },
  ],
  signInPrefix: '/auth/sign-in',
  signOutPath: '/auth/sign-out',
}

/** The shipped Chinese copy, so the test reads what a user reads. */
const t = ((key: keyof typeof zh, values?: Record<string, string>) => {
  const text = zh[key]
  return values === undefined
    ? text
    : text.replace(/\{(\w+)\}/gu, (_, name: string) => values[name] ?? '')
}) as SignInScreenProps['t']

/** One rendered screen over a fixed state. */
function renderScreen(state: ViewerState, over: Partial<SignInScreenProps> = {}) {
  const load = vi.fn(() => Promise.resolve())
  const retry = vi.fn(() => Promise.resolve())
  const useStore = (<T,>(select: (value: ViewerState) => T) => select(state)) as SignInScreenProps['useStore']
  const props = { t, useStore, load, retry, ...over } as SignInScreenProps
  return { ...render(<SignInScreen {...props} />), load, retry }
}

/** A ready state carrying one viewer. */
function ready(viewer: ViewerView): ViewerState {
  return { status: 'ready', viewer }
}

describe('SignInScreen', () => {
  it('asks who the viewer is as soon as the frame is up', () => {
    const { load } = renderScreen({ status: 'idle', viewer: undefined })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows nothing while the read has not answered', () => {
    const { container } = renderScreen({ status: 'loading', viewer: undefined })
    expect(container.textContent).toBe('')
  })

  it('covers the product for a viewer who must sign in', () => {
    renderScreen(ready(SIGNED_OUT))
    expect(screen.getByText(zh.title)).toBeDefined()
    expect(screen.getByText('使用企业微信继续')).toBeDefined()
  })

  it('offers only the channels a browser can be sent to', () => {
    renderScreen(ready(SIGNED_OUT))
    expect(screen.queryByText('使用This machine继续')).toBeNull()
  })

  it('links each channel at the path the deployment reported', () => {
    renderScreen(ready(SIGNED_OUT))
    const link = screen.getByText('使用企业微信继续').closest('a')
    expect(link?.getAttribute('href')).toBe('/auth/sign-in/wecom')
  })

  it('says so when a deployment has accounts but no way into them', () => {
    renderScreen(ready({ ...SIGNED_OUT, channels: [] }))
    expect(screen.getByText(zh.noChannels)).toBeDefined()
  })

  it('leaves a deployment with no accounts alone', () => {
    const { container } = renderScreen(ready({ ...SIGNED_OUT, accounts: false }))
    expect(container.textContent).toBe('')
  })

  it('leaves a viewer who is already signed in alone', () => {
    const signedIn = { ...SIGNED_OUT, person: { id: 'ada', displayName: 'Ada' } }
    const { container } = renderScreen(ready(signedIn))
    expect(container.textContent).toBe('')
  })

  it('offers a retry when the deployment could not be reached', () => {
    const { retry } = renderScreen({ status: 'failed', viewer: undefined })
    expect(screen.getByText(zh.failed)).toBeDefined()
    fireEvent.click(screen.getByText(zh.retry))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('signInHref', () => {
  it('appends the channel to the prefix, escaped', () => {
    expect(signInHref('/auth/sign-in', { id: 'we com', displayName: 'x', redirect: true }))
      .toBe('/auth/sign-in/we%20com')
  })
})
