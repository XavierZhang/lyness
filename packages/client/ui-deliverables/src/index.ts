/**
 * Deliverables plugin, node half. Serves authenticated native opens of declared files. The browser
 * half ships via exports["./client"], discovered through the package.json
 * lyn.client declaration.
 */

import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-workspace-changes/types'
import { registerPresentOpen } from './present-open.ts'

/** Services required for change summaries and authenticated native opens. */
export const inject = ['connection', 'sessionQuery', 'sessionController', 'workspaceFiles', 'fs', 'sandboxPolicy', 'workspaceChanges']

/**
 * Register native opens for declared files.
 * @param ctx - host context carrying file and connection services.
 */
export function apply(ctx: Context): void {
  registerPresentOpen(ctx)
}
