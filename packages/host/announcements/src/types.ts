/**
 * Vocabulary for what a deployment tells the people using it.
 *
 * @module @lyness/lyn-announcements/types
 */

/** Opaque, operator-chosen identity of one announcement. */
export type AnnouncementId = string

/**
 * One thing a deployment has to say.
 *
 * The version is the release this announcement describes, and it is the
 * announcement's own field rather than a deployment-wide one: a deployment
 * has many releases behind it and one announcement per release, while a
 * notice that is not about a release carries none at all.
 */
export interface Announcement {
  /** Stable identity; an operator chooses it and never reuses it. */
  readonly id: AnnouncementId
  /** The release this describes, as the deployment names it; absent for a notice. */
  readonly version?: string | undefined
  /** When it was published, as a UTC instant. */
  readonly publishedAt: string
  /** One line a list shows. */
  readonly title: string
  /** The announcement itself, as Markdown. */
  readonly body: string
  /** Fuller notes elsewhere; absent when the body is all there is. */
  readonly url?: string | undefined
}
