/**
 * The deployment guard: a startup that reaches no model exits instead of
 * serving, and one that reaches a model is left alone.
 */

import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, expect, it, vi } from 'vitest'
import * as ModelRequired from '../src/index.ts'

/** An adapter that answers route queries and never streams. */
class RouteAdapter extends LlmAdapter {
  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([{ provider, id: 'm', name: 'M' }])
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  override async *stream(): AsyncIterable<StreamChunk> {
    throw new Error('not used')
  }
}

/** A launcher double that records the exit and releases the startup signal on demand. */
function launcher(): { ctx: Context; commitStartup: () => void; exits: number[]; written: string[] } {
  const listeners: (() => void)[] = []
  const exits: number[] = []
  const written: string[] = []
  const ctx = new Context()
  ctx.provide('appReady', {
    onReady: (listener: () => void) => {
      listeners.push(listener)
      return () => void listeners.splice(listeners.indexOf(listener), 1)
    },
  })
  ctx.provide('appExit', (code: number) => void exits.push(code))
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    written.push(String(chunk))
    return true
  })
  return { ctx, commitStartup: () => { for (const listener of [...listeners]) listener() }, exits, written }
}

afterEach(() => { vi.restoreAllMocks() })

it('exits with a diagnostic when startup commits and no provider is registered', async () => {
  const { ctx, commitStartup, exits, written } = launcher()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(ModelRequired).await()

  commitStartup()

  expect(exits).toEqual([ModelRequired.NO_MODEL_EXIT_CODE])
  // The registry being empty does not say which of the three was omitted, so
  // the diagnostic names all of them.
  expect(written.join('')).toContain('reaches no model')
  expect(written.join('')).toContain('agent-default-model')
})

it('leaves a startup alone when a provider is registered', async () => {
  const { ctx, commitStartup, exits, written } = launcher()
  await ctx.plugin(LlmRuntime)
  ctx.effect(() => ctx.llm.registerAdapter(['deepseek-official'], new RouteAdapter()))
  await ctx.plugin(ModelRequired).await()

  commitStartup()

  expect(exits).toEqual([])
  expect(written).toEqual([])
})

it('checks at startup rather than at mount, because a route registers later', async () => {
  const { ctx, commitStartup, exits } = launcher()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(ModelRequired).await()

  // A row that registers its route after this plugin mounted — which is what
  // dsh-llm-pi-ai does when it reads the settings document — must not be
  // reported as an absent model.
  ctx.effect(() => ctx.llm.registerAdapter(['late-route'], new RouteAdapter()))
  commitStartup()

  expect(exits).toEqual([])
})

it('stops checking once its own fiber is disposed', async () => {
  const { ctx, commitStartup, exits } = launcher()
  await ctx.plugin(LlmRuntime)
  const fiber = await ctx.plugin(ModelRequired).await()

  await fiber.dispose()
  commitStartup()

  expect(exits).toEqual([])
})

it('stays inactive rather than checking when no launcher startup signal exists', async () => {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  ctx.provide('appReady', undefined)

  // `inject` is the real guarantee: a launcher that provides no startup signal
  // leaves this plugin inactive. Reaching apply with it absent is a test-only
  // state, and the narrowing must not pretend to have checked anything.
  await ctx.plugin(ModelRequired).await()

  expect(ctx.llm.listProviders()).toEqual([])
})
