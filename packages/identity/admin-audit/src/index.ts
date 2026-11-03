/**
 * The trail of administrative changes: who changed which record, when, and
 * from what to what.
 *
 * A roster holds what is true now. That is enough to serve a request and not
 * enough to answer for one: an organization asked why somebody held a role
 * last month, or what a bot's character used to say, has nothing to read if
 * the only record is the current one. This service keeps the other half, and
 * keeps it append-only — an entry is never rewritten and never removed,
 * because a trail an administrator can edit is a trail that proves nothing.
 *
 * It is a hard injection of every owner of administrable records, not an
 * optional one. A deployment that mounts a roster without this service fails
 * to load, which is the intended reading: a roster that silently records no
 * history is worse than one visibly missing its trail.
 *
 * @module @deepseek-ai/dsh-admin-audit
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { administers } from '@deepseek-ai/dsh-people'
import type { Membership } from '@deepseek-ai/dsh-people'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { adminAuditDomain } from './storage.ts'
import type { AuditEntry, AuditEntryId, AuditFieldChange, AuditQuery, AuditSubmission } from './types.ts'

export type * from './types.ts'
export { adminAuditDomain, changeSchema, entrySchema } from './storage.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The trail of administrative changes; absent where a deployment administers no roster. */
    adminAudit: AdminAudit
  }
}

/** Message a read of a trail this standing may not see is refused with. */
export const NOT_PERMITTED = 'admin-audit: this standing may not read that trail'

/**
 * Why one read was refused.
 *
 * A closed set rather than a message to read: a surface reporting it hides a
 * page or says the standing is wrong, and deciding which by matching prose
 * would break the moment the prose changed.
 */
export type AuditRefusal = 'not-permitted'

/** A read this service refused, carrying the reason it refused. */
export class AuditRefusedError extends Error {
  /** Which rule refused it. */
  readonly reason: AuditRefusal

  /**
   * @param reason - which rule refused it.
   * @param message - what went wrong, in words a surface can show.
   */
  constructor(reason: AuditRefusal, message: string) {
    super(message)
    this.name = 'AuditRefusedError'
    this.reason = reason
  }
}

/** Characters of one recorded value kept when a deployment sets no length. */
export const DEFAULT_MAX_VALUE_LENGTH = 2000

/** Entries one read answers with when a deployment sets no maximum. */
export const DEFAULT_MAX_ENTRIES = 200

/** Deployment-owned bounds on what the trail keeps and answers. */
export interface Config {
  /**
   * Characters of each recorded value to keep. Defaults to 2000.
   *
   * A persona is free text an administrator wrote, so one record can carry
   * more prose than a trail should grow by. The cut is recorded on the field
   * rather than hidden, so a reader knows it is reading part of a value.
   */
  maxValueLength?: number
  /** Entries one read answers with, newest first. Defaults to 200. */
  maxEntries?: number
}

export const Config: z<Config> = z.object({
  maxValueLength: z.number().step(1).min(1).max(1_000_000).default(DEFAULT_MAX_VALUE_LENGTH),
  maxEntries: z.number().step(1).min(1).max(10_000).default(DEFAULT_MAX_ENTRIES),
})

/** Resolved bounds, with every default applied. */
export interface ResolvedConfig {
  /** Characters of each recorded value to keep. */
  readonly maxValueLength: number
  /** Entries one read answers with. */
  readonly maxEntries: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the bounds this trail runs under.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    maxValueLength: config.maxValueLength ?? DEFAULT_MAX_VALUE_LENGTH,
    maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
  }
}

/**
 * One field that changed and whose value the trail deliberately keeps none of.
 *
 * Separate from {@link fieldChanges} because it is not a comparison: the
 * caller knows a credential was replaced and must not hand over either side.
 * @param field - the field's name, as the record that holds it calls it.
 * @returns the change to record.
 */
export function redactedChange(field: string): AuditFieldChange {
  return { field, redacted: true }
}

/**
 * Every field two states of one record disagree about.
 *
 * Here rather than in each owner of administrable records, because every one
 * of them needs the same comparison and a second copy would drift from this
 * one. A caller flattens its record into named strings — joining a list,
 * omitting a field the record does not carry — and this answers with what an
 * auditor would read out.
 * @param before - the record's fields as they read before; absent for an addition.
 * @param after - the record's fields as they read after; absent for a removal.
 * @returns one change per differing field, in the order the fields are named.
 * @example fieldChanges({ role: 'member' }, { role: 'tenant-administrator' })
 */
export function fieldChanges(
  before: Readonly<Record<string, string>> | undefined,
  after: Readonly<Record<string, string>> | undefined,
): AuditFieldChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  const changes: AuditFieldChange[] = []
  for (const field of fields) {
    const was = before?.[field]
    const now = after?.[field]
    if (was === now) continue
    changes.push({
      field,
      ...was === undefined ? {} : { before: was },
      ...now === undefined ? {} : { after: now },
    })
  }
  return changes
}

/** The append-only trail of administrative changes. */
export class AdminAudit extends Service {
  static inject = ['storageDomain']

  static readonly Config = Config

  private readonly ready: Promise<Domain<typeof adminAuditDomain>>

  private readonly bounds: ResolvedConfig

  /**
   * @param ctx - context providing durable storage.
   * @param config - validated bounds on what the trail keeps and answers.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'adminAudit')
    this.bounds = resolveConfig(config)
    this.ready = ctx.storageDomain.open(adminAuditDomain)
    ctx.effect(() => async () => { await (await this.ready).close() })
  }

  /**
   * Record one change.
   *
   * Nothing is authorized here. The operation that made the change already
   * decided it was permitted, and a trail that could refuse an entry would be
   * a trail with changes missing from it.
   * @param submission - what changed, and how it read before and after.
   * @param by - the standing that made the change.
   * @returns the entry as the trail now holds it.
   */
  async record(submission: AuditSubmission, by: Membership): Promise<AuditEntry> {
    const at = new Date().toISOString()
    const entry: AuditEntry = {
      // The instant leads the identity so the stored key sorts by time, which
      // is the order every read wants; the suffix separates two changes made
      // in the same millisecond.
      id: brandString<AuditEntryId>(`${at}:${randomUUID()}`),
      at,
      by: by.person,
      standing: by.id,
      kind: submission.kind,
      subject: submission.subject,
      subjectName: submission.subjectName,
      action: submission.action,
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      changes: submission.changes.map(change => this.bounded(change)),
    }
    const domain = await this.ready
    await domain.table('entries').put(entry.id, entry)
    return entry
  }

  /**
   * Read the trail, newest first.
   * @param query - whose trail, which record, and how many entries.
   * @param by - the standing asking for it.
   * @returns the matching entries, newest first.
   * @throws {AuditRefusedError} when this standing may not read that trail.
   */
  async read(query: AuditQuery, by: Membership): Promise<readonly AuditEntry[]> {
    // One predicate for both readings: naming an organization asks for that
    // organization's trail, and naming none asks for every organization's,
    // which only a platform standing administers.
    if (!administers(by, query.organization)) throw new AuditRefusedError('not-permitted', NOT_PERMITTED)
    const domain = await this.ready
    const matching = [...domain.table('entries').entries()].map(([, row]) => row).filter(entry =>
      (query.organization === undefined || entry.organization === query.organization)
      && (query.subject === undefined || entry.subject === query.subject)
      && (query.before === undefined || entry.id < query.before))
    matching.sort((left, right) => right.id.localeCompare(left.id))
    return matching.slice(0, this.limit(query.limit))
  }

  /** One recorded field, cut to the configured length. */
  private bounded(change: AuditFieldChange): AuditFieldChange {
    const before = cut(change.before, this.bounds.maxValueLength)
    const after = cut(change.after, this.bounds.maxValueLength)
    const truncated = before?.length !== change.before?.length || after?.length !== change.after?.length
    return {
      field: change.field,
      ...before === undefined ? {} : { before },
      ...after === undefined ? {} : { after },
      ...truncated ? { truncated: true } : {},
      ...change.redacted === true ? { redacted: true } : {},
    }
  }

  /**
   * The entries one read answers with.
   *
   * Clamped rather than validated, because the maximum is the deployment's
   * and not the reader's: asking for more than it answers is a shorter page,
   * not a refusal.
   */
  private limit(requested: number | undefined): number {
    if (requested === undefined || !Number.isFinite(requested)) return this.bounds.maxEntries
    return Math.min(this.bounds.maxEntries, Math.max(1, Math.trunc(requested)))
  }
}

/** One value cut to a length, leaving an absent value absent. */
function cut(value: string | undefined, length: number): string | undefined {
  return value === undefined ? undefined : value.slice(0, length)
}

export default AdminAudit
