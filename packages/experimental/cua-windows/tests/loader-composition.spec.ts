/** Windows provider registration through the Loader without an interactive desktop. */
import { Context } from '@lyness/cordis'
import Include from '@lyness/cordis-plugin-include'
import Loader from '@lyness/cordis-plugin-loader'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@lyness/lyn-agent-loop-testkit'
import ComputerUseRegistry from '@lyness/lyn-computer-use'
import type { ToolCallId } from '@lyness/lyn-llm'
import type { SessionId } from '@lyness/lyn-session'
import SubprocessLocal from '@lyness/lyn-subprocess-local'
import { expect, it, onTestFinished } from 'vitest'
import * as WindowsProvider from '../src/index.ts'
import { brandString } from '@lyness/lyn-brand'

it.skipIf(process.platform !== 'win32')('loads the Windows provider and rejects a numeric window ID before native dispatch', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await mountAgentLoopTestHarness(ctx)
  await ctx.plugin(ComputerUseRegistry)
  await ctx.plugin(SubprocessLocal)
  ctx.baseUrl = import.meta.url
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, 'windows-provider': WindowsProvider })
  await ctx.loader.create({ name: 'cordis:include', config: { path: new URL('./fixtures/provider.yml', import.meta.url).href } })
  await ctx.loader.await()
  const entry = [...ctx.loader.entries()].find(entry => entry.options.id === 'windows-provider')
  if (!entry?.fiber) throw new Error('Loader did not activate the Windows provider')
  await entry.fiber.await()
  const { agent } = await ctx.agents.create({ sessionId: brandString<SessionId>('cua-windows-loader') })
  expect(ctx.tools.get('cua', agent)).toBeDefined()
  const prompt = await ctx.systemPrompt.assemble({ scope: agent })
  expect(prompt.sections.find(section => section.name === 'computer-use:lyn-cua')?.text).toContain('Windows:')
  expect(prompt.sections.find(section => section.name === 'computer-use:lyn-cua')?.text).not.toContain('useSystemPointer')
  expect(JSON.stringify(ctx.tools.get('cua', agent)!.parameters)).not.toContain('useSystemPointer')
  const batch = await ctx.tools.execute({ agent, signal: new AbortController().signal, calls: [{
    type: 'tool-call', id: brandString<ToolCallId>('invalid-window'), name: 'cua',
    arguments: JSON.stringify({ method: 'screenshot', params: { appHandle: 'app', windowId: 7 } }),
  }, {
    type: 'tool-call', id: brandString<ToolCallId>('unsupported-pointer'), name: 'cua',
    arguments: JSON.stringify({ method: 'drag', params: { appHandle: 'app', windowId: '7', fromX: 1, fromY: 1,
      toX: 2, toY: 2, useSystemPointer: true } }),
  }] })
  expect(batch.results[1]?.result.isError).toBe(true)
  expect(JSON.stringify(batch.results[1]?.result.content)).toContain('useSystemPointer')
  expect(batch.results[0]?.result.isError).toBe(true)
  expect(JSON.stringify(batch.results[0]?.result.content)).toContain('string')
  await entry.fiber.dispose()
  expect(ctx.tools.get('cua', agent)).toBeUndefined()
})
