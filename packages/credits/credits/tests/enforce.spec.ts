/**
 * Metering a model request: check, call, charge — in that order.
 *
 * Every case drives the runtime directly, because the waterfall is where this
 * is decided and a surface showing a balance is passed by none of these calls.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import LlmRuntime, { LlmAdapter } from '@lyness/lyn-llm'
import type {
  GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk, TokenUsage,
} from '@lyness/lyn-llm'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import { afterEach, expect, it } from 'vitest'
import { CreditsExhausted } from '../src/index.ts'
import StoredCreditLedger from '../src/store.ts'
import { CreditSubject } from '../src/subject.ts'
import type { CreditSubjectIdentity } from '../src/subject.ts'
import * as Enforce from '../src/enforce.ts'
import { billableTokens, creditsFor } from '../src/pricing.ts'

const ADA = brandString<PersonId>('ada')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

/** An adapter that reports usage and records whether it was reached. */
class MeteredAdapter extends LlmAdapter {
  reached = 0

  constructor(private readonly usage: TokenUsage | undefined) {
    super()
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([{ provider, id: 'm', name: 'm' }])
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  override async *stream(): AsyncIterable<StreamChunk> {
    this.reached += 1
    await Promise.resolve()
    // A real stream carries content before usage, so metering must pass
    // non-usage chunks through untouched.
    yield { type: 'text-delta', index: 0, text: 'hi' }
    if (this.usage !== undefined) yield { type: 'usage', usage: this.usage }
  }
}

/** A runtime with a ledger, a fixed subject, and metering installed. */
async function harness(options: {
  usage?: TokenUsage | undefined
  person?: PersonId | undefined
  organization?: string | undefined
  periodicAmount?: number
  creditsPerMillion?: number
  minimumDebit?: number
} = {}): Promise<{ ctx: Context; adapter: MeteredAdapter }> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-meter-'))
  roots.push(root)
  const adapter = new MeteredAdapter(options.usage)
  const subject: CreditSubjectIdentity | undefined = options.person === undefined
    ? undefined
    : {
      person: options.person,
      ...options.organization === undefined ? {} : { organization: options.organization },
    }
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(StoredCreditLedger, { periodicAmount: options.periodicAmount ?? 500 }).await()
  await ctx.plugin(class extends CreditSubject {
    override current(): Promise<CreditSubjectIdentity | undefined> {
      return Promise.resolve(subject)
    }
  }).await()
  ctx.effect(() => ctx.llm.registerAdapter(['gw'], adapter))
  await ctx.plugin(Enforce, {
    creditsPerMillion: options.creditsPerMillion ?? 1000,
    ...options.minimumDebit === undefined ? {} : { minimumDebit: options.minimumDebit },
  }).await()
  return { ctx, adapter }
}

/** One request against the runtime. */
function call(): GenerateOptions {
  return { provider: 'gw', model: 'm', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }
}

/** Drain a stream so a refusal surfaces and a charge settles. */
async function drain(ctx: Context): Promise<void> {
  for await (const _chunk of ctx.llm.stream(call())) { /* chunk shape is not asserted here */ }
}

it('charges the reported usage after the call', async () => {
  const { ctx } = await harness({ person: ADA, usage: { inputTokens: 400_000, outputTokens: 100_000 } })

  await drain(ctx)

  // 500k tokens at 1000 credits per million.
  expect((await ctx.credits.balance(ADA)).spent).toBe(500)
})

it('stops before the call when the balance is empty', async () => {
  const { ctx, adapter } = await harness({
    person: ADA, periodicAmount: 1, usage: { inputTokens: 10_000_000, outputTokens: 0 },
  })
  await drain(ctx)

  // The first call owed far more than one credit and settled to zero; the
  // second must not reach the provider at all.
  expect((await ctx.credits.balance(ADA)).available).toBe(0)
  await expect(drain(ctx)).rejects.toBeInstanceOf(CreditsExhausted)
  expect(adapter.reached).toBe(1)
})

it('settles a call that owed more than the balance instead of failing it', async () => {
  const { ctx } = await harness({
    person: ADA, periodicAmount: 10, usage: { inputTokens: 10_000_000, outputTokens: 0 },
  })

  // The call completed and the person has the answer, so failing the
  // settlement would fail a turn that succeeded.
  await drain(ctx)

  const balance = await ctx.credits.balance(ADA)
  expect(balance.available).toBe(0)
  expect(balance.spent).toBe(10)
})

it('does not charge a request that reported no usage', async () => {
  const { ctx } = await harness({ person: ADA, usage: undefined })

  await drain(ctx)

  // The operator pays for a failed call either way; charging a person for one
  // they cannot use would be worse.
  expect((await ctx.credits.balance(ADA)).spent).toBe(0)
})

it('meters nothing when the request belongs to nobody', async () => {
  const { ctx, adapter } = await harness({ person: undefined, usage: { inputTokens: 1_000_000, outputTokens: 0 } })

  await drain(ctx)

  // A deployment's own work, a replay, a seeded session: charging these to
  // whoever happens to be signed in would be worse than not charging them.
  expect(adapter.reached).toBe(1)
  expect((await ctx.credits.balance(ADA)).spent).toBe(0)
})

it('names a session on the debit even when the request carries none', async () => {
  const { ctx } = await harness({ person: ADA, usage: { inputTokens: 1000, outputTokens: 0 } })

  await drain(ctx)

  const { debits } = await ctx.credits.history(ADA)
  expect(debits[0]?.session).toBe('unattributed')
})

it('prefers a provider total over the sum when one is reported', () => {
  expect(billableTokens({ inputTokens: 10, outputTokens: 5 })).toBe(15)
  expect(billableTokens({ inputTokens: 10, outputTokens: 5, totalTokens: 12 })).toBe(12)
})

it('never charges zero for a request that reached a provider', () => {
  // Rounding a tiny request down to zero would meter nothing while costing
  // the operator every time.
  expect(creditsFor({ inputTokens: 1, outputTokens: 0 }, 1000, 1)).toBe(1)
  expect(creditsFor({ inputTokens: 1_500_000, outputTokens: 0 }, 1000, 1)).toBe(1500)
})

it('applies the documented pricing defaults for a hand-built config', () => {
  expect(Enforce.resolveConfig({})).toEqual({ creditsPerMillion: 1000, minimumDebit: 1 })
  expect(Enforce.resolveConfig({ creditsPerMillion: 5, minimumDebit: 0 }))
    .toEqual({ creditsPerMillion: 5, minimumDebit: 0 })
})

it('uses a named session identifier when the request carries one', () => {
  expect(Enforce.sessionOf({ ...call(), sessionId: 'session-9' } as GenerateOptions)).toBe('session-9')
  expect(Enforce.sessionOf(call())).toBe('unattributed')
})

it('records no debit when a deployment prices a request at nothing', async () => {
  const { ctx } = await harness({
    person: ADA, minimumDebit: 0, creditsPerMillion: 0,
    usage: { inputTokens: 1000, outputTokens: 0 },
  })

  await drain(ctx)

  // A deployment may price some traffic at zero; that must leave no debit
  // rather than a zero-amount one, which the ledger refuses anyway.
  expect((await ctx.credits.balance(ADA)).spent).toBe(0)
  expect((await ctx.credits.history(ADA)).debits).toEqual([])
})

it('charges nothing more once the balance is already spent to zero', async () => {
  const { ctx, adapter } = await harness({
    person: ADA, periodicAmount: 2, usage: { inputTokens: 10_000_000, outputTokens: 0 },
  })

  await drain(ctx)
  expect((await ctx.credits.balance(ADA)).available).toBe(0)

  // The next call is refused before reaching the provider, so there is no
  // second settlement to clamp.
  await expect(drain(ctx)).rejects.toBeInstanceOf(CreditsExhausted)
  expect(adapter.reached).toBe(1)
  expect((await ctx.credits.history(ADA)).debits).toHaveLength(1)
})

it('stops before the call when the organization spent its whole budget', async () => {
  const { ctx, adapter } = await harness({
    person: ADA,
    organization: 'acme',
    usage: { inputTokens: 1000, outputTokens: 0 },
  })
  await ctx.credits.setBudget({ organization: 'acme', periodicAmount: 1, period: 'monthly' }, ADA)
  // One call to use the ceiling up, then the next one is stopped before it
  // reaches a provider.
  await drain(ctx)
  const reached = adapter.reached

  await expect(drain(ctx)).rejects.toMatchObject({ reason: 'organization-exhausted' })
  expect(adapter.reached).toBe(reached)
})

it('leaves a person acting for no organization under their own balance alone', async () => {
  const { ctx } = await harness({ person: ADA, usage: { inputTokens: 1000, outputTokens: 0 } })
  // Nobody set a ceiling for nobody: a spend that belongs to no organization
  // is counted against no budget.
  await ctx.credits.setBudget({ organization: 'acme', periodicAmount: 0, period: 'monthly' }, ADA)

  await drain(ctx)

  expect((await ctx.credits.balance(ADA)).spent).toBeGreaterThan(0)
})

it('records the organization on the debit it charged', async () => {
  const { ctx } = await harness({
    person: ADA,
    organization: 'acme',
    usage: { inputTokens: 1000, outputTokens: 0 },
  })

  await drain(ctx)

  const { debits } = await ctx.credits.history(ADA)
  expect(debits[0]?.organization).toBe('acme')
  // Which is what makes the organization's spending for the period readable
  // without asking where that person works today.
  expect((await ctx.credits.budget('acme'))).toBeUndefined()
})

it('counts what an organization spent this period against what it bought', async () => {
  // The person's own allowance is raised out of the way, so what this pins is
  // the organization's sum rather than the clamp on one balance.
  const { ctx } = await harness({
    person: ADA,
    organization: 'acme',
    periodicAmount: 10_000,
    usage: { inputTokens: 1_000_000, outputTokens: 0 },
  })
  await ctx.credits.setBudget({ organization: 'acme', periodicAmount: 5000, period: 'monthly' }, ADA)

  await drain(ctx)

  expect(await ctx.credits.budget('acme')).toMatchObject({
    organization: 'acme',
    periodicAmount: 5000,
    period: 'monthly',
    spent: 1000,
    remaining: 4000,
  })
})
