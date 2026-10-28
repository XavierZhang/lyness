/**
 * Who may change the allowed models.
 *
 * Every save here goes straight to the backend, with no administration page
 * in between, because that is the claim: the authority check lives in the
 * write, so an RPC, a maintenance task, or a setup wizard meets the same rule.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Membership, MembershipId, PersonId } from '@deepseek-ai/dsh-people'
import { afterEach, expect, it } from 'vitest'
import { NOT_PERMITTED, READ_ONLY_POLICY } from '../src/index.ts'
import StoredModelPolicy, { resolveInitial } from '../src/store.ts'
import StaticModelPolicy from '../src/static.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** A standing, built without a directory. */
function standing(role: Membership['role'], organization?: string): Membership {
  return {
    id: brandString<MembershipId>(`m:${role}`),
    person: brandString<PersonId>('p'),
    role,
    ...organization === undefined ? {} : { organization },
  }
}

/** A context with durable JSON storage and a store-backed policy. */
async function harness(config: { organization?: string; initial?: { provider: string; model: string }[] } = {},
  root = mkdtempSync(join(tmpdir(), 'dsh-policy-'))): Promise<{ ctx: Context; root: string }> {
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredModelPolicy, config).await()
  return { ctx, root }
}

it('lets the administrator of its organization save', async () => {
  const { ctx } = await harness({ organization: 'acme' })

  await ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'ok' }], authority: 'your IT administrator' },
    standing('tenant-administrator', 'acme'),
  )

  expect(await ctx.modelPolicy.allowance())
    .toEqual({ allowed: [{ provider: 'gw', model: 'ok' }], authority: 'your IT administrator' })
})

it('refuses a member, which is the whole point of the rule', async () => {
  const { ctx } = await harness({ organization: 'acme', initial: [{ provider: 'gw', model: 'ok' }] })

  await expect(ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'sneaky' }] },
    standing('member', 'acme'),
  )).rejects.toThrow(NOT_PERMITTED)
  // The refusal must leave the served list untouched, not merely report.
  expect((await ctx.modelPolicy.allowance()).allowed).toEqual([{ provider: 'gw', model: 'ok' }])
})

it('refuses an administrator of a different organization', async () => {
  const { ctx } = await harness({ organization: 'acme' })

  await expect(ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'ok' }] },
    standing('tenant-administrator', 'other'),
  )).rejects.toThrow(NOT_PERMITTED)
})

it('lets a platform administrator save for any organization', async () => {
  const { ctx } = await harness({ organization: 'acme' })

  await ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'ok' }] },
    standing('platform-administrator'),
  )

  expect((await ctx.modelPolicy.allowance()).allowed).toEqual([{ provider: 'gw', model: 'ok' }])
})

it('serves what an administrator saved after a restart', async () => {
  const first = await harness({ organization: 'acme' })
  await first.ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'kept' }], authority: 'ops' },
    standing('platform-administrator'),
  )
  await first.ctx.fiber.dispose()

  const second = await harness({ organization: 'acme' }, first.root)

  expect(await second.ctx.modelPolicy.allowance())
    .toEqual({ allowed: [{ provider: 'gw', model: 'kept' }], authority: 'ops' })
})

it('refuses a save that would empty the list', async () => {
  const { ctx } = await harness({ organization: 'acme', initial: [{ provider: 'gw', model: 'ok' }] })

  // An installation allowing nothing serves no one, and a save that empties
  // the list is far likelier a mistake than an intention.
  await expect(ctx.modelPolicy.save({ allowed: [] }, standing('platform-administrator')))
    .rejects.toThrow(/at least one model/)
})

it('reports the organization whose administrators may save', async () => {
  const { ctx } = await harness({ organization: 'acme' })

  // Stated rather than discovered by failing, so a page shows or hides saving.
  expect(ctx.modelPolicy.capability()).toEqual({ writable: true, organization: 'acme' })
})

it('refuses every save against the operator-written backend', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticModelPolicy, { allowed: [{ provider: 'gw', model: 'ok' }] }).await()

  expect(ctx.modelPolicy.capability()).toEqual({ writable: false })
  await expect(ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'other' }] },
    standing('platform-administrator'),
  )).rejects.toThrow(READ_ONLY_POLICY)
})

it('names no organization on an installation where only the platform administers', async () => {
  const { ctx } = await harness()

  // The enterprise shape: one customer, no tenants, so a tenant
  // administrator has no organization to match and only the platform saves.
  expect(ctx.modelPolicy.capability()).toEqual({ writable: true })
  await expect(ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'ok' }] },
    standing('tenant-administrator', 'acme'),
  )).rejects.toThrow(NOT_PERMITTED)
  await ctx.modelPolicy.save(
    { allowed: [{ provider: 'gw', model: 'ok' }] },
    standing('platform-administrator'),
  )
  expect((await ctx.modelPolicy.allowance()).allowed).toEqual([{ provider: 'gw', model: 'ok' }])
})

it('serves nothing before a first save when the operator named no initial list', () => {
  // Through the Loader the schema supplies the empty default; the resolve step
  // owns it for a caller that builds the config by hand.
  expect(resolveInitial({})).toEqual([])
  expect(resolveInitial({ initial: [{ provider: 'gw', model: 'ok' }] }))
    .toEqual([{ provider: 'gw', model: 'ok' }])
})
