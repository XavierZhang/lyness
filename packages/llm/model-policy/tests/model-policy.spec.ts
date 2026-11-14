/**
 * The allowance is enforced where the call is made.
 *
 * Every test here reaches the runtime directly, with no surface in between,
 * because that is the claim: a preset row, a profile patch, and a direct RPC
 * all arrive this way, and a filtered model picker would stop none of them.
 */

import { Context } from '@lyness/cordis'
import LlmRuntime, { LlmAdapter, LlmError } from '@lyness/lyn-llm'
import type {
  GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk,
} from '@lyness/lyn-llm'
import { expect, it } from 'vitest'
import { ModelPolicy } from '../src/index.ts'
import type { ModelAllowance, ModelPolicyCapability } from '../src/types.ts'
import * as Enforce from '../src/enforce.ts'
import StaticModelPolicy, { resolveAuthority } from '../src/static.ts'

/** An adapter that records whether a permitted call actually reached it. */
class RecordingAdapter extends LlmAdapter {
  reached = false

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([{ provider, id: 'ok', name: 'ok' }])
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  override async *stream(): AsyncIterable<StreamChunk> {
    this.reached = true
    await Promise.resolve()
  }
}

/** A policy that answers with whatever the test fixed. */
class FixedPolicy extends ModelPolicy {
  constructor(ctx: Context, private readonly value: ModelAllowance) {
    super(ctx)
  }

  override allowance(): Promise<ModelAllowance> {
    return Promise.resolve(this.value)
  }

  override capability(): ModelPolicyCapability {
    return { writable: false }
  }
}

/** One request against the runtime, bypassing every surface. */
function call(provider: string, model: string): GenerateOptions {
  return { provider, model, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }
}

/** Drain a stream so a refusal surfaces and a permitted call completes. */
async function drain(stream: AsyncIterable<StreamChunk>): Promise<void> {
  for await (const _chunk of stream) { /* chunk shape is not what these tests assert */ }
}

/** A runtime with one route and a policy fixed to `allowance`. */
async function harness(allowance: ModelAllowance): Promise<{ ctx: Context; adapter: RecordingAdapter }> {
  const ctx = new Context()
  const adapter = new RecordingAdapter()
  await ctx.plugin(LlmRuntime)
  ctx.effect(() => ctx.llm.registerAdapter(['gw'], adapter))
  await ctx.plugin({
    name: 'fixed-policy',
    apply: (child: Context) => void child.plugin(class extends FixedPolicy {
      constructor(inner: Context) { super(inner, allowance) }
    }),
  }).await()
  await ctx.plugin(Enforce).await()
  return { ctx, adapter }
}

it('reaches the adapter for a route the policy allows', async () => {
  const { ctx, adapter } = await harness({
    allowed: [{ provider: 'gw', model: 'ok' }], authority: 'this deployment',
  })

  await drain(ctx.llm.stream(call('gw', 'ok')))

  expect(adapter.reached).toBe(true)
})

it('refuses a route the policy does not allow, without reaching the adapter', async () => {
  const { ctx, adapter } = await harness({
    allowed: [{ provider: 'gw', model: 'ok' }], authority: 'your administrator',
  })

  await expect(drain(ctx.llm.stream(call('gw', 'forbidden')))).rejects.toThrow(LlmError)
  // The refusal has to precede the adapter, not merely report after it.
  expect(adapter.reached).toBe(false)
})

it('names the authority in the refusal, because it decides whom to ask', async () => {
  const { ctx } = await harness({ allowed: [], authority: 'your organization administrator' })

  // "out of scope" and "ask your administrator" are different next actions;
  // a refusal naming neither produces a support case instead of a fix.
  await expect(drain(ctx.llm.stream(call('gw', 'ok'))))
    .rejects.toThrow(/your organization administrator/)
})

it('refuses the same provider under a model the policy did not name', async () => {
  const { ctx } = await harness({
    allowed: [{ provider: 'gw', model: 'ok' }], authority: 'this deployment',
  })

  // Allowing a provider is not allowing everything it serves.
  await expect(drain(ctx.llm.stream(call('gw', 'ok-2')))).rejects.toThrow(/not allowed/)
})

it('matches an exact provider and model pair only', () => {
  const allowed = [{ provider: 'gw', model: 'ok' }]

  expect(Enforce.permits(allowed, 'gw', 'ok')).toBe(true)
  expect(Enforce.permits(allowed, 'gw', 'other')).toBe(false)
  expect(Enforce.permits(allowed, 'other', 'ok')).toBe(false)
  expect(Enforce.permits([], 'gw', 'ok')).toBe(false)
})

it('serves the operator list unchanged and names the deployment by default', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticModelPolicy, { allowed: [{ provider: 'gw', model: 'ok' }] }).await()

  const allowance = await ctx.modelPolicy.allowance()
  expect(allowance.allowed).toEqual([{ provider: 'gw', model: 'ok' }])
  expect(allowance.authority).toBe('this deployment')
})

it('carries an operator-named authority through to the allowance', async () => {
  const ctx = new Context()
  await ctx.plugin(StaticModelPolicy, {
    allowed: [{ provider: 'gw', model: 'ok' }], authority: 'your IT administrator',
  }).await()

  expect((await ctx.modelPolicy.allowance()).authority).toBe('your IT administrator')
})

it('defaults the authority for a config built without schema validation', () => {
  // Through the Loader the schema supplies it; the resolve step owns it for a
  // caller that builds the config by hand.
  expect(resolveAuthority({ allowed: [{ provider: 'gw', model: 'ok' }] })).toBe('this deployment')
  expect(resolveAuthority({ allowed: [], authority: 'ops' })).toBe('ops')
})

it('refuses an empty operator list at load rather than refusing every request', async () => {
  const ctx = new Context()

  // An install that allows nothing serves no one, and an empty list is far
  // more likely an unfinished edit than an intention.
  await expect(ctx.plugin(StaticModelPolicy, { allowed: [] }).await())
    .rejects.toThrow(/at least one model/)
})
