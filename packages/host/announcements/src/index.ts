/**
 * Service Definition for what a deployment tells the people using it.
 *
 * It is a seam rather than a constant because the two shapes answer it from
 * different places. An installation runs on one customer's own servers, and
 * what their staff should read is their implementer's decision, written where
 * the rest of the deployment is written. A hosted deployment publishes its own
 * release notes, and they change without anyone editing a customer's config.
 *
 * Each announcement carries the version it describes rather than the service
 * reporting one current version. The Host cannot derive a release version it
 * can stand behind — a source launch, a partial build, and a packaged install
 * disagree — and the newest announcement's version is the one a deployment has
 * actually claimed.
 *
 * @module @lyness/lyn-announcements
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import type { Announcement } from './types.ts'

export type { Announcement, AnnouncementId } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** What this deployment tells the people using it; absent on a deployment that says nothing. */
    announcements: AnnouncementSource
  }
}

/**
 * Abstract announcement source. Subclass and implement the one read; a
 * deployment mounts exactly one.
 *
 * A deployment that mounts none has nothing to announce, which is what a
 * single-operator developer install is.
 */
export abstract class AnnouncementSource extends Service {
  /**
   * @param ctx - the context this source serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'announcements')
  }

  /**
   * Everything this deployment has published, newest first.
   *
   * Ordered here rather than by the surface so every surface agrees on what
   * "latest" is; a list a reader has to sort themselves is a list two
   * surfaces will sort differently.
   * @returns the announcements, newest first.
   */
  abstract published(): Promise<readonly Announcement[]>
}

/**
 * Order announcements the way every surface reads them.
 *
 * Newest first by publication instant, and an identical instant falls back to
 * the identity so two announcements published together keep a fixed order
 * instead of swapping between reads.
 * @param announcements - the announcements to order.
 * @returns a new array, newest first.
 */
export function newestFirst(announcements: readonly Announcement[]): readonly Announcement[] {
  return [...announcements].sort((left, right) => {
    const difference = Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
    return difference !== 0 ? difference : left.id.localeCompare(right.id)
  })
}

export default AnnouncementSource
