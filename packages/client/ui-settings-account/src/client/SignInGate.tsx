/**
 * The screen an installation with no model and nobody signed in shows first.
 *
 * It covers the product rather than sitting beside it: with no account and no
 * configured provider there is no model to run a task on, so every surface
 * under it is about to refuse. The two ways out are the two the dialog already
 * offers — sign in, or go add an API key — and the second one has to let the
 * person through, because the Settings page that takes the key is under this
 * cover. Letting through is a page-load decision and nothing is written, so
 * the next load asks again until a credential exists.
 */

import { useEffect, useState } from 'react'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@lyness/lyn-client-ui-slots'
import type { SettingsMirrorSnapshot } from '@lyness/lyn-client-ui-settings/client'
import type { SignInAttemptId } from '@lyness/lyn-deepseek-account/types'
import type { ThemeSnapshot } from '@lyness/lyn-client-ui-theme/client'
import type { AccountSnapshot } from './AccountSection.tsx'
import { SignInDialog } from './SignInDialog.tsx'
import { modelProviderConfigured } from './model-readiness.ts'

/** What the gate reads and the two operations it offers. */
export interface SignInGateInjected {
  hooks: {
    /** The shared account snapshot. */
    account: HostObservable<AccountSnapshot>
    /** The active theme, for the authorization link the dialog copies. */
    theme: HostObservable<ThemeSnapshot>
    /** The settings description, which says whether a provider is configured. */
    settings: HostObservable<SettingsMirrorSnapshot>
  }
  /**
   * Read the settings description if nobody has yet.
   *
   * The gate asks for itself rather than relying on another plugin's read:
   * without an answer it covers nothing, so a page where this plugin is the
   * only settings consumer would never gate at all.
   */
  load: () => Promise<void>
  /** Begin an authorization attempt. */
  start: () => Promise<void>
  /** Abandon the active attempt. */
  cancel: (id: SignInAttemptId) => Promise<void>
}

/** Full component props: runtime share + locale seat + injected face. */
export type SignInGateProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'settings.account'> & InjectFace<SignInGateInjected>

/**
 * Render the gate, or nothing once this installation can run a task.
 * @param props - composed slot props.
 * @returns the covering dialog, or null.
 */
export function SignInGate({ t, useAccount, useTheme, useSettings, load, start, cancel }: SignInGateProps) {
  const [admitted, setAdmitted] = useState(false)
  useEffect(() => { void load() }, [load])
  const account = useAccount(state => state)
  const colorScheme = useTheme(state => state.active.colorScheme)
  const reachable = useSettings(state => modelProviderConfigured(state.view))
  // Signed in, a provider configured, or let through for this load: no cover.
  // An unknown account state is not a signed-out one, so the first frame of
  // the account stream decides rather than the absence of one.
  if (admitted || reachable || account.view?.status !== 'signed-out') return null
  return <SignInDialog
    account={account} colorScheme={colorScheme} start={start} cancel={cancel} dismissible={false}
    close={() => undefined} useApiKey={() => { setAdmitted(true) }} t={t} />
}
