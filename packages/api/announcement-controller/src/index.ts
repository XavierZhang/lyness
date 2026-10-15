/**
 * Authenticated Remote read of what this deployment has announced.
 *
 * It is a controller rather than something the client builds in, because the
 * answer belongs to the server a client connected to. A desktop install and a
 * browser reach their own deployment, so what they should read is whatever
 * that deployment publishes — not whatever was baked into the client bundle.
 *
 * Read-only: an announcement is written where the deployment is configured, so
 * there is nothing here for a reader to change.
 *
 * @module @lyness/lyn-api-announcement-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type {} from '@lyness/lyn-announcements'
import type { Announcement } from './types.ts'

/** The deployment's announcements, as a client reads them. */
export class AnnouncementController extends TypertRemoteService {
  static inject = ['announcements']

  /** @param ctx - Host with an announcement source mounted. */
  constructor(ctx: Context) { super(ctx, 'announcementController', { namespace: 'announcements' }) }

  /**
   * Everything this deployment has published.
   * @returns the announcements, newest first.
   */
  @Remote
  published(): Promise<readonly Announcement[]> { return this.ctx.announcements.published() }
}

export default AnnouncementController
