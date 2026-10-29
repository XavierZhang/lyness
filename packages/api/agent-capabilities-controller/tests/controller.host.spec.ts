/**
 * What the namespace answers: the registries projected at the moment the
 * question is asked, with the preset's own scope acquired for the read and
 * released after it.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime, { defineTool } from '@lyness/lyn-tools'
import type { SkillSummary } from '@lyness/lyn-skill'
import AgentCapabilitiesController from '../src/index.ts'

const live: Context[] = []
afterEach(async () => { for (const ctx of live.splice(0)) await ctx.fiber.dispose() })

/** Every tool in this spec returns plain text; the registry requires an output. */
const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

/** Register one tool on the given context. */
function register(ctx: Context, name: string, description: string) {
  return ctx.tools.register(defineTool({
    name, description, parameters: {}, output: TEXT_OUTPUT, execute: () => Promise.resolve('ok'),
  }))
}

/** One discovered skill, with only the fields this projection reads. */
function skill(name: string, source: string, provider: string): SkillSummary {
  return {
    name,
    description: `Does ${name}.`,
    source,
    provider,
    invocation: { modelInvocable: true, userInvocable: true },
  }
}

/**
 * Mount the controller over the real tool registry, and optionally over
 * preset and skill doubles.
 * @param options - whether a preset scope and a skill registry are mounted.
 * @returns the controller and what the doubles recorded.
 */
async function harness(options: { preset?: boolean; skills?: readonly SkillSummary[] } = {}) {
  const ctx = new Context()
  live.push(ctx)
  // The tool registry injects the prompt surface, so a composition without
  // it never activates and `ctx.tools` stays absent.
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, {}).await()
  const released: string[] = []
  if (options.preset === true) {
    ctx.provide('agentPresets', {
      defaultId: 'coder',
      // The real registry hands back a revision lease; the double records
      // that the read released it.
      acquireScope: () => Promise.resolve({
        key: undefined,
        [Symbol.asyncDispose]: () => { released.push('coder'); return Promise.resolve() },
      }),
    })
  }
  if (options.skills !== undefined) {
    ctx.provide('skills', { list: () => Promise.resolve([...options.skills ?? []]) })
  }
  await ctx.plugin(AgentCapabilitiesController)
  return { ctx, controller: ctx.agentCapabilitiesController, released }
}

describe('which scope the read uses', () => {
  it('reads the preset scope it acquired, in both registries', async () => {
    const ctx = new Context()
    live.push(ctx)
    const scopes: unknown[] = []
    const viewed: unknown[] = []
    // Doubles here rather than the real registries: what this case pins is
    // that the acquired scope is the one both registries are asked about,
    // which the real registry would hide behind an opaque key.
    ctx.provide('tools', {
      definitions: (scope?: unknown) => { viewed.push(scope); return [] },
    })
    ctx.provide('agentPresets', {
      defaultId: 'coder',
      acquireScope: () => Promise.resolve({
        key: 'preset:coder',
        [Symbol.asyncDispose]: () => Promise.resolve(),
      }),
    })
    ctx.provide('skills', {
      list: (options?: unknown) => { scopes.push(options); return Promise.resolve([]) },
    })
    await ctx.plugin(AgentCapabilitiesController)
    await ctx.agentCapabilitiesController.describe()
    // The deployment view first, then the preset's: the comparison between
    // the two is what decides who gave each capability.
    expect(viewed).toEqual([undefined, 'preset:coder'])
    expect(scopes).toEqual([{ scope: 'preset:coder' }])
  })
})

describe('agentCapabilities.describe', () => {
  it('reports the deployment tools, in name order, as the deployment', async () => {
    const { ctx, controller } = await harness()
    register(ctx, 'write', 'Write a file.')
    register(ctx, 'bash', 'Run a command.')
    const view = await controller.describe()
    expect(view.tools).toEqual([
      { name: 'bash', description: 'Run a command.', source: 'deployment' },
      { name: 'write', description: 'Write a file.', source: 'deployment' },
    ])
    expect(view.connections).toEqual([])
  })

  it('reports an MCP server as one connection rather than as its tools', async () => {
    const { ctx, controller } = await harness()
    register(ctx, 'mcp__acme__search', 'Search Acme.')
    register(ctx, 'mcp__acme__create', 'Create in Acme.')
    const view = await controller.describe()
    expect(view.connections).toEqual([{ server: 'acme', tools: 2, source: 'deployment' }])
    expect(view.tools).toEqual([])
  })

  it('names the preset it read, and releases the lease it took', async () => {
    const { ctx, controller, released } = await harness({ preset: true })
    register(ctx, 'bash', 'Run a command.')
    const view = await controller.describe()
    expect(view.preset).toBe('coder')
    expect(released).toEqual(['coder'])
  })

  it('reports no preset when this deployment mounts no preset registry', async () => {
    const { controller } = await harness()
    expect((await controller.describe()).preset).toBeUndefined()
  })

  it('reports the skills the registry discovers, each naming its origin', async () => {
    const { controller } = await harness({ skills: [skill('badge', 'bundled', 'filesystem')] })
    expect((await controller.describe()).skills).toEqual([
      { name: 'badge', description: 'Does badge.', origin: 'bundled', provider: 'filesystem' },
    ])
  })

  it('reports no skills member at all when no registry is mounted', async () => {
    const { controller } = await harness()
    // Absent is not the same as discovering none: a surface reads it as "this
    // installation has no skills" rather than as an empty catalogue.
    expect(await controller.describe()).not.toHaveProperty('skills')
  })

  it('reports an empty list when a mounted registry discovers nothing', async () => {
    const { controller } = await harness({ skills: [] })
    expect((await controller.describe()).skills).toEqual([])
  })

  it('answers what the registry holds at the moment it is asked', async () => {
    const { ctx, controller } = await harness()
    const dispose = register(ctx, 'bash', 'Run a command.')
    expect((await controller.describe()).tools).toHaveLength(1)
    dispose()
    // No list of its own: a tool withdrawn after the first read is gone from
    // the second, the way it is gone from the agent.
    expect((await controller.describe()).tools).toEqual([])
  })
})
