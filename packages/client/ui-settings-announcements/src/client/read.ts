/**
 * The one read the announcements row performs, and the sharing around it.
 *
 * It is its own unit because the behaviour worth pinning is not the slot
 * registration: one in-flight read shared by every caller, a refused call and
 * a thrown one reported the same way, and a retry that shows the attempt
 * rather than the failure it replaces.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-announcements/client/read
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-announcement-controller/remote'
import { createOutcomeRead } from '@deepseek-ai/dsh-client-store'
import type { Announcement } from '@deepseek-ai/dsh-announcements/types'

/** What one Remote read answers: the list, or the reason it refused. */
export type ReadOutcome =
  | { readonly ok: true; readonly value: readonly Announcement[] }
  | { readonly ok: false }

/** Where a read's outcome is published. */
export interface ReaderSink {
  /** A read has started. */
  begin: () => void
  /** A read returned this list. */
  succeed: (announcements: readonly Announcement[]) => void
  /** A read did not return a list. */
  fail: () => void
  /** Drop the previous outcome before another attempt. */
  reset: () => void
}

/** The two things the row asks for. */
export interface AnnouncementsReader {
  /** Read the announcements, or join the read already running. */
  load: () => Promise<void>
  /** Read again after a failure, or join the read already running. */
  retry: () => Promise<void>
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
export function announcementsReadOf(ctx: Context): () => Promise<ReadOutcome> {
  return () => ctx.remote.announcements.published()
}

/**
 * Build the reader.
 * @param read - performs one Remote read.
 * @param sink - where each outcome is published.
 * @returns the reader the row's injected face hands over.
 */
export function createAnnouncementsReader(
  read: () => Promise<ReadOutcome>,
  sink: ReaderSink,
): AnnouncementsReader {
  return createOutcomeRead(read, sink)
}
