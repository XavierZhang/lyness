/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@lyness/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('lyn-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      lyn?: { bundle?: { patch?: string } }
    }
    expect(manifest.lyn?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.lyn!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@lyness/sdk-app'],
      ['sdk-jsonrpc-server', '@lyness/sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@lyness/deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@lyness/session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@lyness/plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@lyness/llm-deepseek'],
      ['sandbox', '@lyness/sandbox-local'],
      ['session-projection', '@lyness/session-projection'],
      ['sandbox-policy', '@lyness/sandbox-policy'],
      ['subprocess', '@lyness/subprocess-local'],
      ['pty', '@lyness/terminal'],
      ['terminal-bash', '@lyness/terminal-bash'],
      ['terminal-pwsh', '@lyness/terminal-bash'],
      ['timer', '@lyness/cordis-plugin-timer'],
      ['llm', '@lyness/llm'],
      ['session', '@lyness/session'],
      ['session-title', '@lyness/session-title'],
      ['system-prompt', '@lyness/system-prompt'],
      ['tools', '@lyness/tools'],
      ['agent', '@lyness/agent'],
      ['llm-retry', '@lyness/llm-retry'],
      ['jobs', '@lyness/jobs-local'],
      ['invariants', '@lyness/invariants'],
      ['session-invariant', '@lyness/session/invariant'],
      ['agent-invariant', '@lyness/agent/invariant'],
      ['scope-invariant', '@lyness/scope/invariant'],
      ['agent-loop-invariant', '@lyness/agent-loop/invariant'],
      ['agent-loop', '@lyness/agent-loop'],
      ['persistent-bash', '@lyness/tool-bash-persistent'],
      ['persistent-pwsh', '@lyness/tool-pwsh-persistent'],
      ['sessions', '@lyness/session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.LYNESS_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.LYNESS_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
