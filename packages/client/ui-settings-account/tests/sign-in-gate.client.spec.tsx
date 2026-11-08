// @vitest-environment jsdom
/**
 * What covers the product and what must never cover it.
 *
 * The gate's failure mode is a locked door: an installation that already
 * reaches a model would be shut out of the Settings page that configures it.
 * So every state that must stay uncovered has a case here, and the one that
 * matters most is the provider configured through an environment key, which
 * leaves the account signed out and no secret stored.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@lyness/lyn-client-store'
import { makeTranslate } from '@lyness/lyn-client-test-runtime'
import type { SettingsMirrorSnapshot } from '@lyness/lyn-client-ui-settings/client'
import type { AccountView } from '@lyness/lyn-deepseek-account/types'
import type { GlobalStandardProps } from '@lyness/lyn-client-ui-slots'
import type { ThemeSnapshot } from '@lyness/lyn-client-ui-theme/client'
import { SignInGate } from '../src/client/SignInGate.tsx'
import { modelProviderConfigured } from '../src/client/model-readiness.ts'
import type { AccountSnapshot } from '../src/client/AccountSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const SIGNED_OUT: AccountView = { status: 'signed-out', links: { usageUrl: '', topUpUrl: '' }, attempt: null }
const STORED: AccountView = { ...SIGNED_OUT, status: 'credential-stored' }

/** One settings namespace as the Host reports it. */
function namespace(ns: string, value: unknown, secrets: { path: string[]; set: boolean }[] = []) {
  return { ns, autoGenerate: false, schema: null, value, applies: 'live', secrets, revision: 0 } as never
}

/** A mirror snapshot holding the given namespaces, or no answer at all. */
function mirror(namespaces?: ReturnType<typeof namespace>[]): SettingsMirrorSnapshot {
  return namespaces === undefined
    ? { status: 'loading', view: undefined, error: null }
    : { status: 'ready', view: { namespaces, writable: true, hasDocument: true }, error: null }
}

function mount(view: AccountView | undefined, settings: SettingsMirrorSnapshot) {
  const account = createSnapshotStore<AccountSnapshot>({
    view, details: undefined, avatar: undefined, failed: false, loginVisible: false, desktopOnboardingVisible: false,
  })
  const start = vi.fn(async () => {})
  const load = vi.fn(async () => {})
  const theme = createSnapshotStore<ThemeSnapshot>({ active: { colorScheme: 'light' } } as ThemeSnapshot)
  const mirror = createSnapshotStore<SettingsMirrorSnapshot>(settings)
  render(<SignInGate {...({} as GlobalStandardProps)}
    t={makeTranslate(en)}
    useAccount={selector => selector(account.getSnapshot())}
    useTheme={selector => selector(theme.getSnapshot())}
    useSettings={selector => selector(mirror.getSnapshot())}
    load={load}
    start={start}
    cancel={vi.fn(async () => {})} />)
  return { start, load }
}

describe('what counts as a reachable model', () => {
  it('counts a provider named in a model namespace, however its key is supplied', () => {
    // This deployment's own shape: a provider whose key comes from the
    // environment, so nothing is stored and the account stays signed out.
    expect(modelProviderConfigured(mirror([
      namespace('llm-pi-ai', { providers: { zenlayer: { apiKeyEnv: 'ZENLAYER_API_KEY' } } }),
    ]).view)).toBe(true)
  })

  it('counts a stored secret on a model namespace', () => {
    expect(modelProviderConfigured(mirror([
      namespace('llm-deepseek', { providers: {} }, [{ path: ['apiKey'], set: true }]),
    ]).view)).toBe(true)
  })

  it('counts neither an empty provider map nor an unset secret nor another namespace', () => {
    expect(modelProviderConfigured(mirror([
      namespace('llm-deepseek', { providers: {} }, [{ path: ['apiKey'], set: false }]),
      namespace('llm-pi-ai', { providers: {} }),
      namespace('web-search-deepseek', { providers: { other: {} } }, [{ path: ['apiKey'], set: true }]),
    ]).view)).toBe(false)
  })

  it('treats an unread answer as reachable, so nothing is covered on the absence of a fact', () => {
    expect(modelProviderConfigured(undefined)).toBe(true)
  })
})

describe('the gate', () => {
  it('covers the product when nobody is signed in and no model is reachable', () => {
    mount(SIGNED_OUT, mirror([namespace('llm-deepseek', { providers: {} })]))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(en.loginTitle)).toBeTruthy()
    // No way to put it away: there is nothing usable behind it.
    expect(screen.queryByRole('button', { name: en.close })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it.each([
    ['a provider is configured', SIGNED_OUT, mirror([namespace('llm-pi-ai', { providers: { zenlayer: {} } })])],
    ['the account holds a credential', STORED, mirror([namespace('llm-deepseek', { providers: {} })])],
    ['the account state is not known yet', undefined, mirror([namespace('llm-deepseek', { providers: {} })])],
    ['the settings answer is not read yet', SIGNED_OUT, mirror()],
  ] as const)('covers nothing when %s', (_case, view, settings) => {
    mount(view, settings)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks for the settings answer itself rather than waiting on another plugin', () => {
    const gate = mount(SIGNED_OUT, mirror([namespace('llm-deepseek', { providers: {} })]))
    expect(gate.load).toHaveBeenCalledOnce()
  })

  it('lets a person through to the Settings page that takes an API key', () => {
    mount(SIGNED_OUT, mirror([namespace('llm-deepseek', { providers: {} })]))
    fireEvent.click(screen.getByRole('button', { name: en.addApiKeyInSettings }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
