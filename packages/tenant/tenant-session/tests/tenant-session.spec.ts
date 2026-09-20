/** What a session carries afterwards: the tenant stamp, the identity text verbatim, and the refusals a misconfiguration causes. */

import { describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import SessionStore from '@lyness/lyn-session'
import type { Session } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import StaticTenantDirectory from '@lyness/lyn-tenant-static'
import StaticTenantConfigStore from '@lyness/lyn-tenant-config-static'
import * as TenantSession from '../src/index.ts'
import type { TenantSessionRecord } from '../src/index.ts'

const ROSTER = { tenants: [{ id: 'acme', slug: 'acme', displayName: 'Acme' }] }
const CONFIGURED = {
  tenants: [{
    tenantId: 'acme',
    identity: { constraints: ['Never discuss unreleased figures.'], personality: 'Answer briefly.' },
  }],
}

/**
 * A deployment with a directory, sessions, and optionally tenant configuration.
 * @param options - whether the tenant is configured, and sessions created before the plugin mounts.
 * @returns the context with the plugin mounted.
 */
async function bench(options: { configured?: boolean; before?: boolean } = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(StaticTenantDirectory, ROSTER)
  if (options.configured === true) await ctx.plugin(StaticTenantConfigStore, CONFIGURED)
  if (options.before === true) ctx.sessions.create()
  await ctx.plugin(TenantSession, { tenantId: 'acme' }).await()
  return ctx
}

/**
 * The tenant records a session carries.
 * @param session - the session to read.
 * @returns every tenant record in its own log.
 */
function records(session: Session): TenantSessionRecord[] {
  return session.ownEvents()
    .filter(event => event.type === 'tenant/identity')
    .map(event => event.data)
}

describe('tenant session stamp', () => {
  it('records the tenant and its identity text on a new session', async () => {
    const ctx = await bench({ configured: true })
    const session = ctx.sessions.create()
    expect(records(session)).toEqual([{
      version: 1,
      tenantId: 'acme',
      slug: 'acme',
      constraints: ['Never discuss unreleased figures.'],
      personality: 'Answer briefly.',
    }])
  })

  it('records the tenant alone when the deployment configures no identity', async () => {
    const ctx = await bench()
    expect(records(ctx.sessions.create())).toEqual([{ version: 1, tenantId: 'acme', slug: 'acme', constraints: [] }])
  })

  it('stamps a session that already existed when the plugin mounted', async () => {
    const ctx = await bench({ before: true })
    const [existing] = ctx.sessions.list()
    expect(records(existing!)).toHaveLength(1)
  })

  it('reads the record back through the tenant projection, and stamps a session only once', async () => {
    const ctx = await bench({ configured: true })
    const session = ctx.sessions.create()
    expect(ctx.sessionProjections.stateOf(session, 'tenant')).toMatchObject({ tenantId: 'acme' })

    // Every other event leaves the record alone.
    session.append('turn/start', { turn: 1 })
    expect(ctx.sessionProjections.stateOf(session, 'tenant')).toMatchObject({ tenantId: 'acme' })

    // A second mount is a restart: the session keeps the record it was created with.
    await ctx.plugin(TenantSession, { tenantId: 'acme' }).await()
    expect(records(session)).toHaveLength(1)
  })

  it('refuses a malformed tenant id and a tenant the directory does not serve', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(StaticTenantDirectory, ROSTER)
    await expect(ctx.plugin(TenantSession, { tenantId: 'acme corp' }).then(() => undefined)).rejects.toThrow(TypeError)
    await expect(ctx.plugin(TenantSession, { tenantId: 'globex' }).then(() => undefined))
      .rejects.toThrow(/the directory serves no tenant "globex"/u)
  })
})
