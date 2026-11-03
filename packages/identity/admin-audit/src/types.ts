/**
 * Vocabulary of the administrative trail: what one recorded change says, what
 * a caller submits for it, and what a reader asks for.
 *
 * @module @lyness/lyn-admin-audit/types
 */

import type { Branded } from '@lyness/lyn-brand'
import type { MembershipId, PersonId } from '@lyness/lyn-people'

/** One entry's stable identity, which sorts newest-last as a string. */
export type AuditEntryId = Branded<'audit-entry-id'>

/** What happened to one record. */
export type AuditAction = 'added' | 'changed' | 'removed'

/**
 * One field of one record, as it read before and after.
 *
 * Both sides are present for a change, only `after` for an addition, and only
 * `before` for a removal: an auditor asking what a persona used to say needs
 * the value that was replaced, not the fact that something was.
 */
export interface AuditFieldChange {
  /** The field's name, as the record that holds it calls it. */
  readonly field: string
  /** What it read before; absent when the record did not exist. */
  readonly before?: string | undefined
  /** What it reads now; absent when the record was removed. */
  readonly after?: string | undefined
  /** Whether either value was cut to the recorded length; absent when neither was. */
  readonly truncated?: boolean | undefined
  /**
   * Whether this field changed and the trail deliberately keeps no value for
   * it.
   *
   * A rotated credential is the case this exists for: an auditor has to be
   * able to see that a directory's secret was replaced, and the trail must
   * not be the place that secret is readable from. Such a change carries
   * neither side.
   */
  readonly redacted?: boolean | undefined
}

/** What one caller submits to be recorded. */
export interface AuditSubmission {
  /**
   * What kind of record changed, as its owner names it.
   *
   * Open rather than a closed union: the rosters record `person`, `binding`,
   * `bot` and `team`, and a later owner of administrable records adds its own
   * without a change here. A reader that does not know a kind shows it as it
   * reads.
   */
  readonly kind: string
  /** The changed record's own identity. */
  readonly subject: string
  /** The name it went by at the time, so a reader of a removed record still has one. */
  readonly subjectName: string
  /** What happened to it. */
  readonly action: AuditAction
  /** The organization it belongs to; absent for a record that belongs to none. */
  readonly organization?: string | undefined
  /** Every field that differs, which is empty for a change that altered nothing. */
  readonly changes: readonly AuditFieldChange[]
}

/** One recorded change, as the trail holds it. */
export interface AuditEntry extends AuditSubmission {
  /** This entry's identity. */
  readonly id: AuditEntryId
  /** When it was recorded, as a UTC instant. */
  readonly at: string
  /** Who made the change. */
  readonly by: PersonId
  /** The standing they made it in. */
  readonly standing: MembershipId
}

/** What one reader asks the trail for. */
export interface AuditQuery {
  /**
   * The organization whose trail to read; absent reads every organization's,
   * which only a platform standing may do.
   */
  readonly organization?: string | undefined
  /** One record's identity, to read that record's history alone. */
  readonly subject?: string | undefined
  /** How many entries to answer with, newest first; clamped to the configured maximum. */
  readonly limit?: number | undefined
  /**
   * Read only entries older than this one, by its id.
   *
   * A cursor rather than an offset: the trail is append-only and ids sort by
   * time, so the entry after a given one is the same entry however much was
   * added since. An offset would move under a reader paging through while
   * administrators work.
   */
  readonly before?: AuditEntryId | undefined
}
