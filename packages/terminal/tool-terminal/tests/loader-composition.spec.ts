import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { ToolCallId } from '@lyness/lyn-llm'
import { Session, SessionId } from '@lyness/lyn-session'
import AgentRegistry from '@lyness/lyn-agent'
import type { Agent } from '@lyness/lyn-agent'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRuntime from '@lyness/lyn-tools'
import TerminalSessionService from '@lyness/lyn-terminal'
import SandboxProvider from '@lyness/lyn-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@lyness/lyn-sandbox'
import SandboxPolicyService from '@lyness/lyn-sandbox-policy'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import LocalSubprocessRuntime from '@lyness/lyn-subprocess-local'
import * as TerminalLocal from '@lyness/lyn-terminal-bash'
import * as ToolPty from '@lyness/lyn-tool-terminal'
import { unsupportedInbox } from '@lyness/lyn-agent-loop-testkit'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('pty-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

const suite = process.platform === 'linux' || process.platform === 'darwin' ? describe : describe.skip

suite('terminal real Loader composition through cordis.yml', () => {
  it('boots cordis.yml and preserves shell state across real tool calls', async () => {
    root = await mkdtemp(join(tmpdir(), 'lyn-pty-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@lyness/lyn-agent'",
      "- name: '@lyness/lyn-system-prompt'",
      "- name: '@lyness/lyn-tools'",
      "- name: '@lyness/lyn-terminal'",
      "- name: '@lyness/lyn-test-sandbox'",
      "- name: '@lyness/lyn-session-projection'",
      "- name: '@lyness/lyn-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@lyness/lyn-subprocess-local'",
      "- name: '@lyness/lyn-terminal-bash'",
      '  config:',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@lyness/lyn-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@lyness/lyn-agent', AgentRegistry],
      ['@lyness/lyn-system-prompt', SystemPrompt],
      ['@lyness/lyn-tools', ToolRuntime],
      ['@lyness/lyn-terminal', TerminalSessionService],
      ['@lyness/lyn-test-sandbox', PassthroughSandbox],
      ['@lyness/lyn-session-projection', SessionProjectionRegistry],
      ['@lyness/lyn-sandbox-policy', SandboxPolicyService],
      ['@lyness/lyn-subprocess-local', LocalSubprocessRuntime],
      ['@lyness/lyn-terminal-bash', TerminalLocal],
      ['@lyness/lyn-tool-terminal', ToolPty],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const owner = agent(context)
    const signal = new AbortController().signal
    const spawn = await context.tools.execute({
      signal, callId: ToolCallId('spawn'), name: 'terminal_open', arguments: { type: 'shell', name: 'main', cwd: root }, agent: owner,
    })
    expect(resultText(spawn)).toContain('started terminal session pty-1 (main)')

    await context.tools.execute({
      signal, callId: ToolCallId('state'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'export KEEP=loader; cd /' }, agent: owner,
    })
    const read = await context.tools.execute({
      signal, callId: ToolCallId('read'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'printf "cwd=%s keep=%s\\n" "$PWD" "$KEEP"' }, agent: owner,
    })
    expect(resultText(read)).toContain('cwd=/ keep=loader')
    expect(context.terminals.list(owner)).toHaveLength(1)
  }, 15_000)
})
