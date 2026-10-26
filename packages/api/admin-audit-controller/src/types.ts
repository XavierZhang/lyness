/**
 * Wire vocabulary of the administrative trail surface, and its failure codes.
 *
 * Views rather than the seam's own records: what crosses the wire is what an
 * auditor reads — when, who, which record, what happened to it, and the
 * fields that differ with both sides of each.
 * @module @lyness/lyn-api-admin-audit-controller/types
 */

declare module '@lyness/lyn-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The calling standing may not read that trail: it named an organization
     * it does not administer, or asked for every organization's without a
     * platform standing.
     */
    'audit/not-permitted': Record<string, never>
    /**
     * The call established no standing to act in. Unreachable where the
     * deployment mounts an authorization rule, which refuses such a call
     * before it arrives; reachable where it mounts none, and refused here
     * rather than answered on nobody's authority.
     */
    'audit/no-standing': Record<string, never>
  }
}

/** One field of one record, as it read before and after. */
export interface AuditChangeView {
  /** The field's name, as the record that holds it calls it. */
  readonly field: string
  /** What it read before; absent when the record did not exist. */
  readonly before?: string
  /** What it reads now; absent when the record was removed. */
  readonly after?: string
  /** Whether either value was cut to the recorded length. */
  readonly truncated?: boolean
  /**
   * Whether this field changed and the trail deliberately keeps no value for
   * it, as a rotated credential does. Such a change carries neither side.
   */
  readonly redacted?: boolean
}

/** One recorded change as the surface shows it. */
export interface AuditEntryView {
  /** This entry's identity, which sorts oldest-first as a string. */
  readonly id: string
  /** When it was recorded, as a UTC instant. */
  readonly at: string
  /** Who made the change. */
  readonly by: string
  /** The standing they made it in. */
  readonly standing: string
  /** What kind of record changed, as its owner names it. */
  readonly kind: string
  /** The changed record's own identity. */
  readonly subject: string
  /** The name it went by at the time. */
  readonly subjectName: string
  /** What happened to it. */
  readonly action: 'added' | 'changed' | 'removed'
  /** The organization it belongs to; absent for a record that belongs to none. */
  readonly organization?: string
  /** Every field that differs. */
  readonly changes: readonly AuditChangeView[]
}

/** What an auditor asks the trail for. */
export interface AuditQueryInput {
  /**
   * The organization whose trail to read.
   *
   * Absent takes the calling standing's own, so a tenant administrator reads
   * their organization's trail without naming it; a platform standing holds
   * no organization, so absent reads every organization's.
   */
  readonly organization?: string
  /** One record's identity, to read that record's history alone. */
  readonly subject?: string
  /** How many entries to answer with, newest first; clamped to what the deployment answers. */
  readonly limit?: number
}
