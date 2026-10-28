/**
 * Register the sign-in screen and the row that names who is signed in.
 *
 * Two surfaces, one read: the screen covers the product while a deployment
 * with accounts has nobody in one, and the row says whose session this is and
 * offers the way out. Both answer the same question, so asking twice would
 * ask the deployment twice.
 *
 * @module @lyness/lyn-client-ui-sign-in/client
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-client-locale/client'
import type {} from '@lyness/lyn-client-ui-layout/client'
import type {} from '@lyness/lyn-client-ui-settings/client'
import type {} from '@lyness/lyn-client-ui-renderer/client'
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-identity-controller/remote'
import { AccountRow } from './AccountRow.tsx'
import { SignInScreen } from './SignInScreen.tsx'
import { ViewerBinding, rowFace, screenFace } from './binding.ts'
import { createViewerReader, viewerReadOf } from './read.ts'
import { createViewerStore } from './store.ts'
import { de, en, es, fr, ja, pt, ru, zh } from './locales.ts'
import type { SignInKey } from './locales.ts'

export type { SignInKey } from './locales.ts'
export type { SignInScreenInjected, SignInScreenProps } from './SignInScreen.tsx'
export { signInHref } from './SignInScreen.tsx'
export type { AccountRowInjected, AccountRowProps } from './AccountRow.tsx'
export { standingLabel } from './AccountRow.tsx'
export { createViewerStore } from './store.ts'
export type { ViewerState } from './store.ts'
export { createViewerReader, viewerReadOf } from './read.ts'
export type { ReadOutcome, ViewerSink } from './read.ts'
export { ViewerBinding, rowFace, screenFace } from './binding.ts'
export type { ViewerActions } from './binding.ts'

declare module '@lyness/lyn-client-ui-slots' {
  interface LocaleNamespaceMap { 'sign-in': SignInKey }
}

/** The locale namespace this surface's copy lives in. */
export const NS = 'sign-in'

/** Services required by the sign-in surface. */
export const inject = ['slots', 'locale', 'remote', 'remote.identity']

/**
 * Register both surfaces.
 * @param ctx - client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'sign-in: dictionaries')
  const binding = new ViewerBinding()
  const reader = createViewerReader(viewerReadOf(ctx), binding)

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'sign-in',
    store: createViewerStore(),
    locale: NS,
    inject: screenFace(binding, reader),
  }, SignInScreen))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'sign-in',
    // Before the announcements row and the version it sits beside: whose
    // session this is comes before what the deployment has announced.
    order: 20,
    store: createViewerStore(),
    locale: NS,
    inject: rowFace(binding, reader),
  }, AccountRow))
}
