/**
 * Provide the shared viewer service, browser half.
 *
 * The plugin registers no surface of its own. It owns one question — who is
 * viewing, and which Settings planes that standing is offered — so that the
 * account row, the sign-in screen and the Settings navigation answer it from
 * one read instead of three.
 *
 * @module @lyness/lyn-client-ui-viewer/client
 */

import type { Context } from '@lyness/cordis'
// Type-only: pulls the ctx.remote merge and the identity namespace it carries.
import type {} from '@lyness/lyn-api-remotes/client'
import type {} from '@lyness/lyn-api-identity-controller/remote'
import { UiViewer } from './viewer.ts'

export { UiViewer } from './viewer.ts'
export type { ViewerRead, ViewerSnapshot } from './viewer.ts'
export { administers } from './plane.ts'
export type { SettingsPlane } from './plane.ts'

/** Services required to read the viewer. */
export const inject = ['remote', 'remote.identity']

/**
 * Provide `ctx.uiViewer`, bound to this deployment's identity namespace.
 * @param ctx - client provider context.
 */
export function apply(ctx: Context): void {
  new UiViewer(ctx, () => ctx.remote.identity.viewer())
}
