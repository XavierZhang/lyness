/**
 * Records which tenant a session belongs to, and the identity text that tenant
 * contributed to its model requests, as one durable session event.
 *
 * Two different needs meet in one record. Attribution wants the tenant id on
 * every session, because a deployment serving several organizations has to be
 * able to say whose session this was long after it ended. Reconstruction wants
 * the identity text itself: a tenant's constraints and personality reach the
 * model, and anything that reaches a model request must be reconstructable
 * from the session log. An id alone would not survive the tenant editing its
 * own identity, so the text is recorded verbatim, the way the auxiliary
 * title request records the exact prompt it sent.
 *
 * The record is written once per session, on creation, and a session that
 * already carries one — a fork, or a session this process resumed — keeps the
 * record it was created with rather than being re-stamped with today's.
 *
 * Which tenant a session belongs to comes from the request that created it when
 * `ctx.requestTenant` is mounted, and otherwise from this plugin's config. A
 * deployment serving several organizations needs the former: the configured
 * tenant is one value for the whole process, so it can only be right when the
 * process serves one organization. The configured tenant stays the answer for
 * every session created outside a request — a CLI run, a resumed session, a
 * subagent — because those name no request to read.
 * @module @lyness/lyn-tenant-session
 */

import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { z as zod } from 'zod'
import { TenantId } from '@lyness/lyn-tenant'
import type { Tenant } from '@lyness/lyn-tenant'
import type { Session, SessionEvent } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-projection'
import type { TenantConfig } from '@lyness/lyn-tenant-config'
import type {} from '@lyness/lyn-tenant-request/types'

/** Shape version of {@link TenantSessionRecord}; a later field set changes it deliberately. */
export const TENANT_SESSION_RECORD_VERSION = 1

/** The tenant one session belongs to, and the identity text it ran under. */
export interface TenantSessionRecord {
  /** Shape version of this record. */
  readonly version: number
  /** The tenant this session belongs to. */
  readonly tenantId: string
  /** The tenant's slug when the session was created, for reading a log without the directory. */
  readonly slug: string
  /** Rules this tenant contributed, verbatim; empty when it contributed none. */
  readonly constraints: readonly string[]
  /** Voice this tenant asked for, verbatim; absent when it asked for none. */
  readonly personality?: string
}

declare module '@lyness/lyn-session/types' {
  interface SessionEventMap {
    /**
     * Records the tenant this session belongs to and the identity text that
     * tenant contributed, as durable, log-only attribution. It stays out of
     * the model transcript: the identity itself reaches the model through the
     * assembled system prompt, and this record is what lets a later reader
     * attribute the session and reconstruct the text it ran under.
     */
    'tenant/identity': TenantSessionRecord
  }
}

declare module '@lyness/lyn-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The tenant record this session was created with, or null before it is written. */
    tenant: TenantSessionRecord | null
  }
}

const recordSchema: zod.ZodType<TenantSessionRecord | null> = zod.object({
  version: zod.number(),
  tenantId: zod.string().min(1),
  slug: zod.string().min(1),
  constraints: zod.array(zod.string()).readonly(),
  personality: zod.string().optional(),
}).nullable() as unknown as zod.ZodType<TenantSessionRecord | null>

/**
 * Fold the tenant record out of a session's log.
 * @param state - the record folded so far.
 * @param event - the next event.
 * @returns the record this session was created with.
 */
function applyTenantEvent(state: TenantSessionRecord | null, event: SessionEvent): TenantSessionRecord | null {
  return event.type === 'tenant/identity' ? event.data : state
}

/**
 * Build the record for one tenant and the identity it configured.
 * @param tenant - the tenant the session belongs to.
 * @param config - that tenant's configuration, when it has one.
 * @returns the record to append.
 */
function recordOf(tenant: Tenant, config: TenantConfig | undefined): TenantSessionRecord {
  const identity = config?.identity
  return {
    version: TENANT_SESSION_RECORD_VERSION,
    tenantId: tenant.id,
    slug: tenant.slug,
    constraints: identity?.constraints ?? [],
    ...identity?.personality === undefined ? {} : { personality: identity.personality },
  }
}

/** Stable Cordis plugin name. */
export const name = 'tenant-session'

/** The directory this plugin names its tenant in, the sessions it stamps, and the fold that reads the stamp back. */
export const inject = ['sessionProjections', 'sessions', 'tenants']

/** Plugin config: which tenant this deployment's sessions belong to. */
export interface Config {
  /**
   * The tenant a session belongs to when the request that created it named
   * none — a CLI run, a resumed session, a subagent, or a deployment that
   * mounts no `ctx.requestTenant`.
   */
  tenantId: string
}

export const Config: z<Config> = z.object({
  tenantId: z.string().required(),
})

/**
 * Stamp every session of this deployment with its tenant and identity.
 * @param ctx - plugin context carrying the directory, the sessions, and the projection registry.
 * @param config - the validated plugin config.
 * @throws {TypeError} when the configured tenant id is malformed.
 * @throws {Error} when the directory serves no such tenant.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const tenantId = TenantId(config.tenantId)
  const tenant = await ctx.tenants.get(tenantId)
  if (tenant === undefined) {
    throw new Error(`tenant-session: the directory serves no tenant ${JSON.stringify(config.tenantId)}`)
  }
  // Optional service: a deployment may name its tenant without configuring it.
  const configured = await ctx.get('tenantConfig')?.get(tenantId)
  const fallback = recordOf(tenant, configured)

  ctx.sessionProjections.register({
    key: 'tenant',
    stateVersion: 1,
    stateSchema: recordSchema,
    init: () => null,
    apply: applyTenantEvent,
  })

  const stamp = (session: Session): void => {
    const state = ctx.sessionProjections.stateOf(session, 'tenant')
    /* v8 ignore next -- the projection is registered above; stateOf answers undefined only for an unregistered key. */
    if (state === undefined) throw new Error('tenant-session: the tenant session projection is not registered')
    if (state !== null) return
    // Read at stamp time, not at load: whichever scope is mounted when the
    // session is created is the one that knows who created it.
    const requested = ctx.get('requestTenant')?.current()
    session.append('tenant/identity', requested === undefined
      ? fallback
      : recordOf(requested.tenant, requested.config))
  }
  ctx.on('session/created', stamp)
  for (const session of ctx.sessions.list()) stamp(session)
}
