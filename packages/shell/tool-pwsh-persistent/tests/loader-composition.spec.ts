import { spawnSync } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import Loader from '@lyness/cordis-plugin-loader'
import Include from '@lyness/cordis-plugin-include'
import { ToolCallId } from '@lyness/lyn-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@lyness/lyn-session'
import AgentRegistry from '@lyness/lyn-agent'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import type { Agent } from '@lyness/lyn-agent'
import TerminalSessionService from '@lyness/lyn-terminal'
import * as TerminalBash from '@lyness/lyn-terminal-bash'
import SandboxProvider from '@lyness/lyn-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@lyness/lyn-sandbox'
import SandboxPolicyService from '@lyness/lyn-sandbox-policy'
import LocalSubprocessService from '@lyness/lyn-subprocess-local'
import { resolvePwshPath } from '@lyness/lyn-pwsh-local/src/resolve.ts'
import SystemPrompt from '@lyness/lyn-system-prompt'
import ToolRegistry from '@lyness/lyn-tools'
import * as ToolPwshPersistent from '@lyness/lyn-tool-pwsh-persistent'
import { unsupportedInbox } from '@lyness/lyn-agent-loop-testkit'

const hasPwsh = spawnSync(
  resolvePwshPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$true'],
  { encoding: 'utf8' },
).status === 0

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

function agent(ctx: Context, cwd: string): Agent {
  const id = SessionId('persistent-pwsh-loader-agent')
  const scope = ctx.plugin(() => {})
  const session = Session.create(id, [], {
    version: SESSION_FORMAT_VERSION, id, createdAt: 0, cwd, isSeeded: false,
  })
  const value: Agent = {
    id,
    options: {},
    session,
    inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

describe.skipIf(!hasPwsh)('persistent pwsh through a real cordis.yml Loader composition', () => {
  it('preserves cwd and environment across calls', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'lyn-persistent-pwsh-loader-')))
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
      '    shellDialect: pwsh',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 300',
      '    handoffGraceMs: 300',
      '    scrollbackLines: 20000',
      // The first call pays the full pwsh cold-start latency (spawn + .NET +
      // PSReadLine + Defender) inside the tool deadline; a 60s bound on the
      // fully loaded self-hosted Windows pool is exceeded often enough to
      // reset the session mid-test (2026-09-01, two runs ~62s each). 300s
      // matches the lyn-tool-pwsh-persistent product default; the
      // lyn-terminal-bash value bounds one send plus the complete startup
      // sequence, so it covers the same cold start (its 30s product default
      // would not).
      '    timeoutMs: 300000',
      '    disposeGraceMs: 500',
      "- name: '@lyness/lyn-tool-pwsh-persistent'",
      '  config:',
      '    timeoutMs: 300000',
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@lyness/lyn-agent', AgentRegistry],
      ['@lyness/lyn-system-prompt', SystemPrompt],
      ['@lyness/lyn-tools', ToolRegistry],
      ['@lyness/lyn-terminal', TerminalSessionService],
      ['@lyness/lyn-test-sandbox', PassthroughSandbox],
      ['@lyness/lyn-session-projection', SessionProjectionRegistry],
      ['@lyness/lyn-sandbox-policy', SandboxPolicyService],
      ['@lyness/lyn-subprocess-local', LocalSubprocessService],
      ['@lyness/lyn-terminal-bash', TerminalBash],
      ['@lyness/lyn-tool-pwsh-persistent', ToolPwshPersistent],
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

    const owner = agent(context, root)
    const signal = new AbortController().signal
    const execute = (id: string, command: string) => context!.tools.execute({
      signal,
      callId: ToolCallId(id),
      name: 'pwsh',
      arguments: { command },
      agent: owner,
    })

    expect(context.tools.schemas().map(schema => schema.name)).toEqual(['pwsh'])
    await execute('state', '$env:KEEP = "loader"; New-Item -ItemType Directory -Force -Path nested | Out-Null; Set-Location nested')
    const observed = text(await execute('observe', 'Write-Output "cwd=$PWD keep=$env:KEEP"'))
    expect(observed).toContain(`cwd=${join(root, 'nested')} keep=loader`)
    expect(observed).not.toContain('LYNESS_PERSISTENT_PWSH')

    const multiline = text(await execute(
      'multiline',
      '$value = "line one"\nWrite-Output "${value}:it\'s fine"',
    ))
    expect(multiline).toBe("line one:it's fine")
    expect(multiline).not.toContain('LYNESS_PERSISTENT_PWSH')

    const hereString = text(await execute(
      'here-string',
      "$h = @'\nalpha\nbeta\n'@\nWrite-Output $h",
    ))
    expect(hereString).toBe('alpha\nbeta')

    const large = text(await execute('large-output', '1..12050 | ForEach-Object { $_ }'))
    expect(large.startsWith('1\n2\n3\n')).toBe(true)
    expect(large).toContain('<response clipped>')
    expect(large).not.toContain('beginning of this command output was dropped')

    const exited = text(await execute('exit', 'exit'))
    expect(exited).toContain('next pwsh call starts from the workspace')
    expect(text(await execute('after-exit', 'Write-Output "$PWD"'))).toBe(root)
  }, 120_000)
})
