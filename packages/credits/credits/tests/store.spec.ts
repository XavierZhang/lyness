/**
 * The ledger: what a balance is made of, and that a spend refuses rather than
 * overdraws.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { afterEach, expect, it } from 'vitest'
import { CreditsExhausted } from '../src/index.ts'
import StoredCreditLedger, { resolveConfig } from '../src/store.ts'

const ADA = brandString<PersonId>('ada')
const BOB = brandString<PersonId>('bob')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** A ledger over durable JSON storage. */
async function harness(config: Parameters<typeof resolveConfig>[0] = {},
  root = mkdtempSync(join(tmpdir(), 'lyn-credits-'))): Promise<{ ctx: Context; root: string }> {
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredCreditLedger, config).await()
  return { ctx, root }
}

it('grants the periodic allowance on first use rather than from a timer', async () => {
  const { ctx } = await harness()

  // A timer would have to fire for everyone at once and would miss anyone
  // whose period rolled over while the process was down.
  expect((await ctx.credits.balance(ADA)).available).toBe(500)
})

it('does not grant the same period twice', async () => {
  const { ctx } = await harness()

  await ctx.credits.balance(ADA)
  await ctx.credits.balance(ADA)
  await ctx.credits.spend({ person: ADA, amount: 1, session: 's' })

  expect((await ctx.credits.balance(ADA)).available).toBe(499)
  expect((await ctx.credits.history(ADA)).grants).toHaveLength(1)
})

it('keeps one person balance separate from another', async () => {
  const { ctx } = await harness()

  await ctx.credits.spend({ person: ADA, amount: 100, session: 's' })

  expect((await ctx.credits.balance(ADA)).available).toBe(400)
  expect((await ctx.credits.balance(BOB)).available).toBe(500)
})

it('refuses rather than overdraws, and records nothing when it refuses', async () => {
  const { ctx } = await harness({ periodicAmount: 10 })

  await expect(ctx.credits.spend({ person: ADA, amount: 11, session: 's' }))
    .rejects.toBeInstanceOf(CreditsExhausted)
  // An overdraw is a cost the operator did not agree to; the refusal must
  // leave the balance intact rather than merely report.
  expect((await ctx.credits.balance(ADA)).available).toBe(10)
  expect((await ctx.credits.history(ADA)).debits).toEqual([])
})

it('tells a refused caller what is available and when more arrives', async () => {
  const { ctx } = await harness({ periodicAmount: 5 })

  await ctx.credits.spend({ person: ADA, amount: 5, session: 's' })
  const refusal = await ctx.credits.spend({ person: ADA, amount: 1, session: 's' })
    .catch((error: unknown) => error)

  expect(refusal).toBeInstanceOf(CreditsExhausted)
  expect((refusal as CreditsExhausted).available).toBe(0)
  expect((refusal as CreditsExhausted).nextGrantAt).toEqual(expect.any(String))
})

it('names the session on every debit, so a refusal is answerable', async () => {
  const { ctx } = await harness()

  await ctx.credits.spend({ person: ADA, amount: 3, session: 'session-7' })

  const { debits } = await ctx.credits.history(ADA)
  expect(debits).toHaveLength(1)
  expect(debits[0]).toMatchObject({ amount: 3, session: 'session-7' })
})

it('counts an administrator grant on top of the allowance', async () => {
  const { ctx } = await harness()

  await ctx.credits.balance(ADA)
  await ctx.credits.grant({ person: ADA, amount: 250, reason: 'administrator', grantedBy: BOB })

  expect((await ctx.credits.balance(ADA)).available).toBe(750)
  expect((await ctx.credits.history(ADA)).grants[0]).toMatchObject({
    reason: 'administrator', grantedBy: BOB,
  })
})

it('stops counting a grant once it has expired', async () => {
  const { ctx } = await harness({ periodicAmount: 0 })

  await ctx.credits.grant({
    person: ADA, amount: 100, reason: 'purchase',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  })

  // Grants expire individually, so a lapsed one cannot take a live one with it.
  expect((await ctx.credits.balance(ADA)).available).toBe(0)
  expect((await ctx.credits.balance(ADA)).granted).toBe(0)
})

it('serves the same ledger after a restart', async () => {
  const first = await harness()
  await first.ctx.credits.spend({ person: ADA, amount: 40, session: 's' })
  await first.ctx.fiber.dispose()

  const second = await harness({}, first.root)

  expect((await second.ctx.credits.balance(ADA)).available).toBe(460)
})

it('meters nothing when the deployment grants nothing periodically', async () => {
  const { ctx } = await harness({ periodicAmount: 0 })

  const balance = await ctx.credits.balance(ADA)
  expect(balance.available).toBe(0)
  // No periodic grant means no next grant to promise.
  expect(balance.nextGrantAt).toBeUndefined()
})

it('omits the next-grant promise when no periodic grant is coming', async () => {
  const { ctx } = await harness({ periodicAmount: 0 })

  const refusal = await ctx.credits.spend({ person: ADA, amount: 1, session: 's' })
    .catch((error: unknown) => error)

  // Promising a next grant that never arrives would be worse than saying
  // nothing, so the message omits it rather than naming a date.
  expect((refusal as CreditsExhausted).nextGrantAt).toBeUndefined()
  expect((refusal as CreditsExhausted).message).not.toContain('next grant')
  expect((refusal as CreditsExhausted).message).toContain('out of credits')
})

it('refuses a non-positive spend or grant', async () => {
  const { ctx } = await harness()

  await expect(ctx.credits.spend({ person: ADA, amount: 0, session: 's' })).rejects.toThrow(TypeError)
  await expect(ctx.credits.grant({ person: ADA, amount: -1, reason: 'purchase' })).rejects.toThrow(TypeError)
})

it('applies the documented defaults for a hand-built config', () => {
  expect(resolveConfig({})).toEqual({ periodicAmount: 500, period: 'daily', offsetHours: 8 })
  expect(resolveConfig({ periodicAmount: 1, period: 'weekly', offsetHours: 0 }))
    .toEqual({ periodicAmount: 1, period: 'weekly', offsetHours: 0 })
})
