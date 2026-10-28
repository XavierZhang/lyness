/**
 * The one read both surfaces perform, and the sharing around it.
 *
 * It is its own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by the screen and the row, a
 * refused call and a thrown one reported the same way, and a retry that shows
 * the attempt rather than the failure it replaces.
 *
 * @module @deepseek-ai/dsh-client-ui-sign-in/client/read
 */

import type { Context } from '@deepseek-ai/cordis'
import { createOutcomeRead } from '@deepseek-ai/dsh-client-store'
import type { SharedRead } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-identity-controller/remote'
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'

/** What one Remote read answers: the viewer, or the reason it refused. */
export type ReadOutcome =
  | { readonly ok: true; readonly value: ViewerView }
  | { readonly ok: false }

/** Where a read's outcome is published. */
export interface ViewerSink {
  /** A read has started. */
  begin: () => void
  /** A read returned this viewer. */
  succeed: (viewer: ViewerView) => void
  /** A read did not return a viewer. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
}

/**
 * The deployment read, bound to one client context.
 *
 * Named rather than written inline where the reader is built, so the call it
 * makes is reachable on its own: a test can drive it against a Remote double
 * without standing up a slot registration.
 * @param ctx - the client context whose Remote reaches the deployment.
 * @returns the read the reader performs.
 */
export function viewerReadOf(ctx: Context): () => Promise<ReadOutcome> {
  return () => ctx.remote.identity.viewer()
}

/**
 * Build the reader.
 * @param read - performs one Remote read.
 * @param sink - where each outcome is published.
 * @returns the read both surfaces drive.
 */
export function createViewerReader(read: () => Promise<ReadOutcome>, sink: ViewerSink): SharedRead {
  return createOutcomeRead(read, sink)
}
