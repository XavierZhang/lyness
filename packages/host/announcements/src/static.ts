/**
 * Provider: the announcements an operator writes in composition config.
 *
 * This is the installation shape's source. The system runs on one customer's
 * own servers, so what their staff read is written where the rest of their
 * deployment is written, and nothing reaches them that their own implementer
 * did not put there.
 *
 * A hosted deployment mounts a store-backed source instead, because its
 * release notes change without anyone editing a customer's config.
 *
 * @module @lyness/lyn-announcements/static
 */

import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { AnnouncementSource, newestFirst } from './index.ts'
import type { Announcement } from './types.ts'

/** One announcement as an operator writes it. */
export interface AnnouncementEntry {
  /** Stable identity; an operator chooses it and never reuses it. */
  id: string
  /** When it was published, as a UTC instant. */
  publishedAt: string
  /** One line a list shows. */
  title: string
  /** The announcement itself, as Markdown. */
  body: string
  /** The release this describes; omitted for a notice that is not about one. */
  version?: string
  /** Fuller notes elsewhere; omitted when the body is all there is. */
  url?: string
}

/** Operator-written announcements for one deployment. */
export interface Config {
  /**
   * What this deployment has published.
   *
   * Defaults to none, because a deployment with nothing to say is the
   * ordinary case and an empty list is a complete answer — unlike a roster,
   * where emptiness would lock everyone out.
   */
  announcements?: AnnouncementEntry[]
}

const EntrySchema: z<AnnouncementEntry> = z.object({
  id: z.string().required(),
  publishedAt: z.string().required(),
  title: z.string().required(),
  body: z.string().required(),
  version: z.string(),
  url: z.string(),
})

export const Config: z<Config> = z.object({
  announcements: z.array(EntrySchema).default([]),
})

/** Message a malformed publication instant is refused with. */
export const BAD_INSTANT = 'announcements-static: publishedAt must be a UTC instant'

/** Message a repeated identity is refused with. */
export const REPEATED_ID = 'announcements-static: two announcements share one id'

/**
 * Resolve the written entries, rejecting what a surface cannot recover from.
 *
 * Both rejections happen at load because both would be silent otherwise: an
 * unparseable instant sorts as `NaN` and lands the announcement in an
 * arbitrary place, and two entries sharing an identity make "the one a reader
 * dismissed" ambiguous.
 * An absent list is the same as an empty one, so a hand-built config and the
 * Loader's own default reach this the same way.
 * @param entries - the operator-written announcements, or undefined when none were stated.
 * @returns the announcements, newest first.
 * @throws {Error} when an instant cannot be parsed, or two entries share an identity.
 */
export function resolveEntries(entries: readonly AnnouncementEntry[] | undefined): readonly Announcement[] {
  const seen = new Set<string>()
  const resolved: Announcement[] = []
  for (const entry of entries ?? []) {
    if (Number.isNaN(Date.parse(entry.publishedAt))) {
      throw new Error(`${BAD_INSTANT}: "${entry.id}" has "${entry.publishedAt}"`)
    }
    if (seen.has(entry.id)) throw new Error(`${REPEATED_ID}: "${entry.id}"`)
    seen.add(entry.id)
    resolved.push({
      id: entry.id,
      publishedAt: entry.publishedAt,
      title: entry.title,
      body: entry.body,
      ...entry.version === undefined ? {} : { version: entry.version },
      ...entry.url === undefined ? {} : { url: entry.url },
    })
  }
  return newestFirst(resolved)
}

/** Serves the announcements an operator wrote, in one fixed order. */
export class StaticAnnouncements extends AnnouncementSource {
  static readonly Config = Config

  private readonly value: readonly Announcement[]

  /**
   * @param ctx - the context this source serves.
   * @param config - validated operator-written announcements.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.value = Object.freeze(resolveEntries(config.announcements))
  }

  /**
   * The operator's list, identical for every reader.
   * @returns the announcements, newest first.
   */
  published(): Promise<readonly Announcement[]> {
    return Promise.resolve(this.value)
  }
}

export default StaticAnnouncements
