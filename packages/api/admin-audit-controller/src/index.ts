/**
 * Host Remote owner of the `audit` namespace: an administrator reads the
 * trail of changes made to the records they administer.
 *
 * Who may read what is not decided here. The trail holds that rule — naming
 * an organization asks for that organization's trail, naming none asks for
 * every organization's — and this namespace hands it the caller's standing
 * and reports what it answered. A second rule written here would be one to
 * keep in step with the first, and the one a direct caller bypasses.
 *
 * What this namespace does resolve is which organization an unnamed read
 * means: the calling standing's own. A tenant administrator reading their
 * organization's trail should not have to name the one organization they
 * administer, and a platform standing holds none, so an unnamed read stays
 * the every-organization read the trail already refuses to anyone else.
 *
 * @module @lyness/lyn-api-admin-audit-controller
 */

import { Context } from '@lyness/cordis'
import { AuditRefusedError } from '@lyness/lyn-admin-audit'
import type { AuditEntry, AuditQuery, AuditRefusal } from '@lyness/lyn-admin-audit'
import type { Membership } from '@lyness/lyn-people'
import { callingStanding } from '@lyness/lyn-request-principal'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type { AuditEntryView, AuditQueryInput } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `audit` Remote namespace. */
    adminAuditController: AdminAuditController
  }
}

/** Host service backing the generated `ctx.remote.audit` namespace. */
export default class AdminAuditController extends TypertRemoteService {
  /**
   * Register the audit namespace.
   * @param ctx - Host context where the trail and the principal are mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'adminAuditController', { namespace: 'audit', requires: 'tenant-administrator' })
  }

  /**
   * The recorded changes the calling standing may read, newest first.
   * @param query - whose trail, which record, and how many entries.
   * @returns the matching entries, newest first.
   * @throws {RemoteError} `audit/not-permitted` when the standing may not read
   * that trail, `audit/no-standing` when the call establishes none, or
   * `gateway/internal` when this deployment keeps no trail.
   */
  @Remote
  async read(query: AuditQueryInput): Promise<readonly AuditEntryView[]> {
    const trail = this.trail()
    const by = await this.calling()
    const asked: AuditQuery = {
      ...organizationOf(query, by) === undefined ? {} : { organization: organizationOf(query, by) },
      ...query.subject === undefined ? {} : { subject: query.subject },
      ...query.limit === undefined ? {} : { limit: query.limit },
    }
    try {
      return (await trail.read(asked, by)).map(view)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /** The trail, where this deployment keeps one. */
  private trail(): Context['adminAudit'] {
    const held = this.ctx.get('adminAudit')
    if (held === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment keeps no administrative trail', {
        endpoint: 'audit',
      })
    }
    return held
  }

  /**
   * The standing this call acts in.
   *
   * Resolved rather than assumed: where a deployment mounts no authorization
   * rule, every call reaches here, and a trail read on no standing would be
   * one nobody is answerable for.
   */
  private async calling(): Promise<Membership> {
    const held = await callingStanding(this.ctx)
    if (held === undefined) throw new RemoteError('audit/no-standing', 'this call acts in no standing', {})
    return held
  }
}

/**
 * The organization one read means.
 *
 * The caller's own when they named none, so the one organization a tenant
 * administrator administers does not have to be typed into every read.
 * @param query - what the auditor asked for.
 * @param by - the standing asking.
 * @returns the organization to read, or undefined for every organization's.
 */
export function organizationOf(query: AuditQueryInput, by: Membership): string | undefined {
  return query.organization ?? by.organization
}

/**
 * Project one entry onto its wire view.
 * @param entry - the entry as the trail holds it.
 * @returns the view this namespace answers with.
 */
function view(entry: AuditEntry): AuditEntryView {
  return {
    id: entry.id,
    at: entry.at,
    by: entry.by,
    standing: entry.standing,
    kind: entry.kind,
    subject: entry.subject,
    subjectName: entry.subjectName,
    action: entry.action,
    ...entry.organization === undefined ? {} : { organization: entry.organization },
    changes: entry.changes.map(change => ({
      field: change.field,
      ...change.before === undefined ? {} : { before: change.before },
      ...change.after === undefined ? {} : { after: change.after },
      ...change.truncated === undefined ? {} : { truncated: change.truncated },
      ...change.redacted === undefined ? {} : { redacted: change.redacted },
    })),
  }
}

/**
 * The code each refusal the trail can make is reported under.
 *
 * A total map rather than a switch: the reason is a closed set of one, so a
 * second one added upstream is a compile error here rather than a branch
 * nothing reaches.
 */
const REFUSAL_CODES: Readonly<Record<AuditRefusal, 'audit/not-permitted'>> = {
  'not-permitted': 'audit/not-permitted',
}

/**
 * Report one refusal the trail made under this namespace's own code.
 *
 * Only the trail's own reason is mapped; anything else reaches the caller as
 * itself, so a storage failure is not dressed up as an authorization one.
 * @param refused - what the trail threw.
 * @returns the error to answer the call with.
 */
function refusal(refused: unknown): unknown {
  if (!(refused instanceof AuditRefusedError)) return refused
  return new RemoteError(REFUSAL_CODES[refused.reason], refused.message, {})
}
