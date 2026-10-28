/**
 * The General Settings row naming who is signed in, and the way out.
 *
 * It is a row rather than a page because there is one fact and one action:
 * a deployment that serves named people should say whose session this is
 * somewhere a person can find it, and let them end it.
 */

import { useEffect } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@lyness/lyn-client-ui-slots'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type { ViewerStandingView } from '@lyness/lyn-api-identity-controller/types'
import type { createViewerStore } from './store.ts'
import css from './AccountRow.module.css'

/** Injected business face: the read. */
export interface AccountRowInjected {
  /** Read who the viewer is, or join the read already running. */
  load: () => Promise<void>
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AccountRowProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createViewerStore>>
  & PropsLocale<'sign-in'> & AccountRowInjected

/** The translator this row's parts are handed. */
type Translate = PropsLocale<'sign-in'>['t']

/**
 * Name one standing the way a person reads it.
 * @param standing - the standing the viewer acts in, when they act in one.
 * @param t - the active translator.
 * @returns the text to show beside their name.
 */
export function standingLabel(standing: ViewerStandingView | undefined, t: Translate): string {
  if (standing === undefined) return t('rolePersonal')
  if (standing.role === 'platform-administrator') return t('rolePlatformAdministrator')
  const administrator = standing.role === 'tenant-administrator'
  const organization = standing.organization
  // A standing the directory holds without an organization names the role
  // alone: "of" nothing reads as a missing word rather than as a fact.
  if (organization === undefined) return administrator ? t('roleAdministratorPlain') : t('roleMemberPlain')
  return administrator
    ? t('roleTenantAdministrator', { organization })
    : t('roleMember', { organization })
}

/**
 * Render the row, or nothing on a deployment with no accounts.
 * @param props - composed slot props.
 * @returns the row element tree, or null.
 */
export function AccountRow({ t, useStore, load }: AccountRowProps) {
  const viewer = useStore(state => state.viewer)

  // The screen asks too, and one read is shared; asking here as well is what
  // keeps the row filled when Settings is opened before the screen ever was.
  useEffect(() => { void load() }, [load])

  if (viewer === undefined || !viewer.accounts) return null
  return (
    <div className={css.row}>
      <div className={css.who}>
        <span>{viewer.person === undefined ? t('anonymous') : viewer.person.displayName}</span>
        {viewer.person === undefined ? null : (
          <span className={css.standing}>{standingLabel(viewer.standing, t)}</span>
        )}
      </div>
      {viewer.person === undefined ? null : (
        <a className={css.signOut} href={viewer.signOutPath}>{t('signOut')}</a>
      )}
    </div>
  )
}
