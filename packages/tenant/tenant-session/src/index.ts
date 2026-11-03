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
 * The same plugin composes that text into each agent's system prompt, from
 * the session's own record rather than from the configuration. Two halves of
 * one fact: a record saying the identity reached the model while nothing
 * composed it would be a log that claims what did not happen, and reading the
 * configuration instead would mean a tenant editing its identity changed what
 * a running conversation had already said.
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
import { composePerAgent } from '@lyness/lyn-agent'
import type {} from '@lyness/lyn-system-prompt'
import { TenantId } from '@lyness/lyn-tenant'
import type { Tenant } from '@lyness/lyn-tenant'
import type { Session, SessionEvent } from '@lyness/lyn-session'
import type { ProjectionDefinition } from '@lyness/lyn-session-projection'
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

/** The tenant projection's stored state, for a reader validating what it folds back. */
export const tenantSessionRecordSchema: zod.ZodType<TenantSessionRecord | null> = zod.object({
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

/** Prompt section carrying the voice one tenant asked for. */
export const TENANT_PERSONALITY_SECTION = 'tenant:personality'

/** Prompt section carrying the rules one tenant requires. */
export const TENANT_CONSTRAINTS_SECTION = 'tenant:constraints'

/**
 * The rules one tenant requires, as the model reads them.
 *
 * Named as the organization's requirement rather than as a tenant's
 * configuration: a prompt carries task-relevant concepts, and \"tenant\" is
 * this deployment's word for its customers, not a word the model needs.
 * @param constraints - the rules this tenant contributed, verbatim.
 * @returns the section text, or the empty string when it contributed none.
 */
export function constraintsText(constraints: readonly string[]): string {
  const stated = constraints.filter(rule => rule !== '')
  if (stated.length === 0) return ''
  return `The organization this conversation belongs to requires:\n\n${
    stated.map(rule => `- ${rule}`).join('\n')}`
}

/**
 * Compose one session's recorded tenant identity into its agent's prompt.
 *
 * Composed on the agent's own context, so it lasts exactly as long as that
 * agent and cannot reach another tenant's conversation. Appended after the
 * deployment's own persona and before its policy sections, which is what
 * keeps text a customer wrote from widening what the agent may do.
 * @param agentCtx - the agent scope to register the sections on.
 * @param record - the tenant identity this session was created with.
 * @returns the disposer that withdraws both sections.
 */
export function composeTenantIdentity(agentCtx: Context, record: TenantSessionRecord): () => void {
  const withdrawals = [
    agentCtx.systemPrompt.section({
      name: TENANT_PERSONALITY_SECTION,
      order: agentCtx.systemPrompt.getSectionOrder('TENANT_PERSONALITY'),
      text: record.personality ?? '',
    }),
    agentCtx.systemPrompt.section({
      name: TENANT_CONSTRAINTS_SECTION,
      order: agentCtx.systemPrompt.getSectionOrder('TENANT_CONSTRAINTS'),
      text: constraintsText(record.constraints),
    }),
  ]
  return (): void => { for (const withdraw of withdrawals) withdraw() }
}

/** Which organization a conversation belongs to, folded from its own log. */
export const tenantSessionProjectionDefinition = {
  key: 'tenant',
  stateVersion: 1,
  stateSchema: tenantSessionRecordSchema,
  init: () => null,
  apply: applyTenantEvent,
} satisfies ProjectionDefinition<'tenant', TenantSessionRecord | null>

/** Stable Cordis plugin name. */
export const name = 'tenant-session'

/**
 * The directory this plugin names its tenant in, the sessions it stamps, the
 * agents and prompt registry it composes the identity through, and the fold
 * that reads the stamp back.
 */
export const inject = ['agents', 'sessionProjections', 'sessions', 'systemPrompt', 'tenants']

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

  const tenantProjection = await ctx.sessionProjections.register(tenantSessionProjectionDefinition)

  const stamp = (session: Session): void => {
    if (tenantProjection.stateOf(session) !== null) return
    // Read at stamp time, not at load: whichever scope is mounted when the
    // session is created is the one that knows who created it.
    const requested = ctx.get('requestTenant')?.current()
    session.append('tenant/identity', requested === undefined
      ? fallback
      : recordOf(requested.tenant, requested.config))
  }
  // Deferred for the reason `session-ownership` defers its own stamp: the
  // creation announcement is read-only, so the event is written on the
  // microtask that follows it rather than inside the listener.
  ctx.on('session/created', (session) => { queueMicrotask(() => { stamp(session) }) })
  for (const session of ctx.sessions.list()) stamp(session)

  // Composed on each agent's own context, which is what puts the sections in
  // that agent's scope: the loop assembles its prompt with the agent as the
  // scope, so one conversation's identity is never assembled into another's.
  composePerAgent(ctx, (agent) => {
    const record = tenantProjection.stateOf(agent.session)
    /* v8 ignore next -- `session/created` has stamped the session before
       `agent/created` fires for it, so this names a broken order rather than
       composing text the log does not hold. */
    if (record === null) return undefined
    return composeTenantIdentity(agent.ctx, record)
  })
}
