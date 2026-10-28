/** Built bridge imports and retained objects from a project outside the Harness installation. */
import { executeToolFixture } from '@lyness/lyn-tool-testkit'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@lyness/lyn-agent-loop-testkit'
import LocalAttachmentStore from '@lyness/lyn-attachment-local'
import ComputerUseRegistry from '@lyness/lyn-computer-use'
import FileSystem from '@lyness/lyn-fs-local'
import { LlmAdapter, ToolCallId, type LlmResolvedModelInfo, type StreamChunk } from '@lyness/lyn-llm'
import NodeRuntime from '@lyness/lyn-ptc-runtime-node'
import Sandbox from '@lyness/lyn-sandbox-local'
import SandboxPolicy from '@lyness/lyn-sandbox-policy'
import { SessionId } from '@lyness/lyn-session'
import Subprocess from '@lyness/lyn-subprocess-local'
import { expect, it } from 'vitest'
import * as Cua from '../src/index.ts'
import { installNativeFixture, startFixtureHost } from './native-fixture.ts'
import { Request } from '@lyness/lyn-cua/protocol'

const bridge = fileURLToPath(new URL('../../cua/lib/bridge.js', import.meta.url))
const bootstrap = join(dirname(fileURLToPath(import.meta.resolve('@lyness/lyn-ptc-runtime-node/package.json'))), 'lib/persistent-process.js')

class VisualAdapter extends LlmAdapter {
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text', 'image'] })
  }
  stream(): AsyncIterable<StreamChunk> { throw new Error('This bridge integration does not request model generation') }
}

// This lane runs after build; the fixture helper uses a POSIX shebang and never accesses the desktop.
it.skipIf(process.platform === 'win32' || !existsSync(bridge) || !existsSync(bootstrap))(
  'imports the installation-owned bridge outside the repository and retains objects with current bindings', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lyn-cua-external-project-'))
    const ctx = new Context()
    let closeFixture: (() => Promise<void>) | undefined
    try {
      const helperPath = await installNativeFixture(cwd)
      closeFixture = await startFixtureHost(helperPath)
      await mountAgentLoopTestDependencies(ctx)
      await ctx.plugin(FileSystem)
      await ctx.plugin(Subprocess)
      await ctx.plugin(LocalAttachmentStore, { lynHome: join(cwd, 'home') })
      await ctx.plugin(ComputerUseRegistry)
      await ctx.plugin(Sandbox)
      await ctx.plugin(SandboxPolicy)
      await ctx.plugin(NodeRuntime, { executionMode: 'persistent-in-memory', launch: { kind: 'node-script', executable: process.execPath, bootstrapPath: bootstrap } })
      await ctx.plugin(Loader)
      ctx.loader.builtins.cua = Cua
      const entry = await ctx.loader.create({ name: 'cordis:cua', config: { agentPreset: false, helperPath, allowedApps: [{ 'id': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'name': 'Fixture', 'executablePath': '/fixture/app' }] } })
      await ctx.loader.resolve(entry).fiber!.await()
      await mountAgentLoopTestHarness(ctx)
      ctx.llm.registerAdapter(['bridge-fixture'], new VisualAdapter())
      const handle = await ctx.agents.create({ sessionId: SessionId('external-cua-project'), agentOptions: { provider: 'bridge-fixture', model: 'vision' } })
      let count = 0
      let images = 0
      const calls: Array<{ phase: string; method: string }> = []
      const run = (program: string, phase: string) => ctx.ptcRuntime.run(ctx.ptcRuntime.resolve({
        cwd, program, stateOwner: handle.agent,
        bindings: [{ global: 'tools', functions: { cua: async (args) => {
          const operation = Request.parse(args)
          calls.push({ phase, method: operation.method })
          const result = await executeToolFixture(ctx, { agent: handle.agent, signal: new AbortController().signal,
            callId: ToolCallId(`external-cua-${++count}`), name: 'cua', arguments: operation })
          images += result.content.filter(block => block.type === 'image').length
          return result.value ?? null
        } } }],
      }))
      expect((await run('await import("@lyness/lyn-cua/bridge")', 'unresolved')).error?.message).toContain('Cannot find package')
      const section = (await ctx.systemPrompt.assemble()).sections.find(value => value.name === 'computer-use:lyn-cua')
      const initialization = section?.text.split('Persistent PTC initialization:\n')[1]
      expect(initialization).toContain('/lib/bridge.js')
      const first = await run(`${initialization}\nvar app = await cua.getApp("test.fixture"); var win = await app.getWindow(7); await win.click(0); var shot = await win.getScreenshot(); ({ mimeType: shot.mimeType, pixelWidth: shot.pixelWidth, pixelHeight: shot.pixelHeight, windowId: shot.windowId, byteLength: shot.bytes.length });`, 'first')
      expect(first.error).toBeUndefined()
      expect(first.value).toEqual({ mimeType: 'image/png', pixelWidth: 1, pixelHeight: 1, windowId: 7, byteLength: 90 })
      expect(images).toBe(1)
      expect(JSON.stringify(first)).not.toContain('iVBORw0KGgo')
      const invalid = await run('await cua.findApps("");', 'invalid')
      expect(invalid.error?.message).toContain('findApps query: Expected a non-empty search string')
      expect(invalid.error?.message).not.toContain('ZodError')
      expect(invalid.error?.message).not.toContain('"origin"')
      expect(calls.filter(call => call.phase === 'invalid')).toEqual([])
      const second = await run('await win.getAXState({emit:false}); await win.click(0); await win.getAXState({emit:false});', 'second')
      expect(second.error).toBeUndefined()
      expect(second.value).toContain('Count: 2')
      expect(calls.filter(call => call.phase === 'second').map(call => call.method)).toEqual(['getState', 'click', 'getState'])
    } finally {
      try { await ctx.fiber.dispose() } finally {
        try { await closeFixture?.() } finally { await rm(cwd, { recursive: true, force: true }) }
      }
    }
  },
)
