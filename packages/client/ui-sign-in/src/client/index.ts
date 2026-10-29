/**
 * Register the sign-in screen and the row that names who is signed in.
 *
 * Two surfaces, one read, and neither owns it: who the viewer is is also what
 * the Settings navigation groups its planes by, so the read lives in the
 * `uiViewer` service and both surfaces render from its snapshot.
 *
 * @module @lyness/lyn-client-ui-sign-in/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-layout/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-client-ui-viewer/client'
import { AccountRow } from './AccountRow.tsx'
import type { AccountRowInjected } from './AccountRow.tsx'
import { SignInScreen } from './SignInScreen.tsx'
import type { SignInScreenInjected } from './SignInScreen.tsx'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { SignInKey } from './locales.ts'

export type { SignInKey } from './locales.ts'
export type { SignInScreenInjected, SignInScreenProps } from './SignInScreen.tsx'
export { signInHref } from './SignInScreen.tsx'
export type { AccountRowInjected, AccountRowProps } from './AccountRow.tsx'
export { standingLabel } from './AccountRow.tsx'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'sign-in': SignInKey }
}

/** The locale namespace this surface's copy lives in. */
export const NS = 'sign-in'

/** Services required by the sign-in surface. */
export const inject = ['slots', 'locale', 'uiViewer']

/**
 * Register both surfaces.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'sign-in: dictionaries')

  const screenInjected = (): SignInScreenInjected => ({
    load: () => ctx.uiViewer.load(),
    retry: () => ctx.uiViewer.retry(),
    hooks: { viewer: ctx.uiViewer.state },
  })
  // The row has no retry of its own: a failure covers the product, and the
  // screen is where somebody tries again.
  const rowInjected = (): AccountRowInjected => ({
    load: () => ctx.uiViewer.load(),
    hooks: { viewer: ctx.uiViewer.state },
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'sign-in',
    locale: NS,
    inject: screenInjected,
  }, SignInScreen))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'sign-in',
    // Before the announcements row and the version it sits beside: whose
    // session this is comes before what the deployment has announced.
    order: 20,
    locale: NS,
    inject: rowInjected,
  }, AccountRow))
}
