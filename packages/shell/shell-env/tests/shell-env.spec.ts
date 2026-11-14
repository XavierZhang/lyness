/**
 * Registry tests for `@lyness/lyn-shell-env`: built-in facts, contributor
 * ownership and validation, collection ordering, effect-scoped disposal, and
 * the explicit disposer contract.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@lyness/cordis'
import type { ToolCallId } from '@lyness/lyn-llm'
import type { Agent } from '@lyness/lyn-agent'
import { SESSION_FORMAT_VERSION } from '@lyness/lyn-session'
import type { ToolExecution } from '@lyness/lyn-tools'
import { ShellEnvRegistry } from '@lyness/lyn-shell-env'
import * as BashEnvPlugin from '@lyness/lyn-shell-env'
import { brandString } from '@lyness/lyn-brand'

const testToolSignal = new AbortController().signal

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

function execution(sessionId?: string): ToolExecution {
  return {
    signal: testToolSignal,
    token: Symbol('bash-env-test') as ToolExecution['token'],
    callId: brandString<ToolCallId>('bash-env-call'),
    rootCallId: brandString<ToolCallId>('bash-env-call'),
    name: 'bash',
    arguments: { command: 'true' },
    ...(sessionId === undefined
      ? {}
      : {
        agent: {
          session: {
            header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false },
          },
        } as unknown as Agent,
      }),
  }
}

describe('ShellEnvRegistry', () => {
  it('collects unconditional shell facts and the current agent session id', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })

    expect(registry.collect(execution())).toEqual({
      LYNESS_HOME: resolve('./test-lyn-home'),
      LYNESS_NODE_EXECUTABLE: process.execPath,
      LYNESS_SHELL: '1',
    })
    expect(registry.collect(execution('session-a'))).toEqual({
      LYNESS_HOME: resolve('./test-lyn-home'),
      LYNESS_NODE_EXECUTABLE: process.execPath,
      LYNESS_SESSION_ID: 'session-a',
      LYNESS_SHELL: '1',
    })
  })

  it('omits the Node executable inside a single-executable application', () => {
    vi.spyOn(process, 'getBuiltinModule').mockReturnValue({ isSea: () => true })
    expect(new ShellEnvRegistry(new Context()).collect(execution())).not.toHaveProperty('LYNESS_NODE_EXECUTABLE')
  })

  it('keeps the Node executable where the runtime answers no single-executable module', () => {
    vi.spyOn(process, 'getBuiltinModule').mockReturnValue(undefined)
    expect(new ShellEnvRegistry(new Context()).collect(execution()).LYNESS_NODE_EXECUTABLE).toBe(process.execPath)
  })

  it('collects the launcher-provided profile name, directory, and installation directory when a profile context exists', () => {
    const ctx = new Context()
    ctx.provide('profileContext', {
      name: 'web', dir: '/profiles/web', patchPath: '/profiles/web/cordis.patch.yml', installAnchor: '/lyn/package.json',
      cwd: '/work', home: '/home', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })
    expect(registry.collect(execution())).toMatchObject({
      LYNESS_INSTALL_DIR: '/lyn', LYNESS_PROFILE: 'web', LYNESS_PROFILE_DIR: '/profiles/web',
    })
    for (const key of ['LYNESS_PROFILE', 'LYNESS_INSTALL_DIR', 'LYNESS_NODE_EXECUTABLE']) {
      expect(() => registry.register({
        name: `${key}-claimer`,
        variables: { [key]: { description: 'Reserved key.' } },
        resolve: () => ({}),
      })).toThrow(new RegExp(`reserved key "${key}"`))
    }
  })

  it('resolves LYNESS_HOME from the ambient override or the user-home default', () => {
    vi.stubEnv('LYNESS_HOME', './ambient-lyn-home')
    const fromEnvironment = new ShellEnvRegistry(new Context())
    expect(fromEnvironment.collect(execution()).LYNESS_HOME).toBe(resolve('./ambient-lyn-home'))

    vi.stubEnv('LYNESS_HOME', undefined)
    const fromDefault = new ShellEnvRegistry(new Context())
    expect(fromDefault.collect(execution()).LYNESS_HOME).toBe(join(homedir(), '.lyn'))
  })

  it('collects declared contributor variables and omits unavailable values', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })
    registry.register({
      name: 'optional-session-fact',
      variables: {
        LYNESS_SESSION_OPTIONAL: { description: 'Optional session-scoped test fact.' },
      },
      resolve: exec => exec.agent === undefined ? {} : { LYNESS_SESSION_OPTIONAL: exec.agent.session.header.id },
    })
    registry.register({
      name: 'always-available-fact',
      variables: {
        LYNESS_ALWAYS_AVAILABLE: { description: 'Always-available test fact.' },
      },
      resolve: () => ({ LYNESS_ALWAYS_AVAILABLE: 'yes' }),
    })

    expect(registry.collect(execution())).not.toHaveProperty('LYNESS_SESSION_OPTIONAL')
    expect(registry.collect(execution()).LYNESS_ALWAYS_AVAILABLE).toBe('yes')
    expect(registry.collect(execution('session-b')).LYNESS_SESSION_OPTIONAL).toBe('session-b')
    expect(registry.list()).toEqual([
      {
        contributor: 'always-available-fact',
        description: 'Always-available test fact.',
        key: 'LYNESS_ALWAYS_AVAILABLE',
      },
      {
        contributor: 'optional-session-fact',
        description: 'Optional session-scoped test fact.',
        key: 'LYNESS_SESSION_OPTIONAL',
      },
    ])
  })

  it('rejects duplicate variable ownership at registration time', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })
    registry.register({
      name: 'first',
      variables: { LYNESS_SHARED: { description: 'First owner.' } },
      resolve: () => ({ LYNESS_SHARED: 'first' }),
    })

    expect(() => registry.register({
      name: 'second',
      variables: { LYNESS_SHARED: { description: 'Second owner.' } },
      resolve: () => ({ LYNESS_SHARED: 'second' }),
    })).toThrow(/LYNESS_SHARED.*first.*second|LYNESS_SHARED.*second.*first/)
  })

  it('rejects duplicate contributor names and malformed declarations', () => {
    const registry = new ShellEnvRegistry(new Context(), { lynHome: './test-lyn-home' })
    registry.register({
      name: 'declared',
      variables: { LYNESS_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({}),
    })

    expect(() => registry.register({
      name: 'declared',
      variables: { LYNESS_ANOTHER: { description: 'Another fact.' } },
      resolve: () => ({}),
    })).toThrow(/already registered/)
    expect(() => registry.register({
      name: ' ',
      variables: { LYNESS_BLANK_NAME: { description: 'Blank owner.' } },
      resolve: () => ({}),
    })).toThrow(/name must be non-empty/)
    expect(() => registry.register({
      name: 'invalid-key',
      variables: { lyn_invalid: { description: 'Invalid key.' } } as unknown as Record<'LYNESS_INVALID', { description: string }>,
      resolve: () => ({}),
    })).toThrow(/invalid key/)
    expect(() => registry.register({
      name: 'reserved-key',
      variables: { LYNESS_HOME: { description: 'Reserved key.' } },
      resolve: () => ({}),
    })).toThrow(/reserved key/)
    expect(() => registry.register({
      name: 'blank-description',
      variables: { LYNESS_BLANK_DESCRIPTION: { description: ' ' } },
      resolve: () => ({}),
    })).toThrow(/must describe/)
  })

  it('rejects undeclared variables returned by a contributor', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })
    registry.register({
      name: 'drifted-provider',
      variables: { LYNESS_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({ LYNESS_UNDECLARED: 'bad' }),
    })

    expect(() => registry.collect(execution())).toThrow(/drifted-provider.*LYNESS_UNDECLARED/)
    expect(() => registry.collect(execution())).toThrow(expect.objectContaining({ name: 'ShellEnvError', code: 'SHELL_ENV_CONTRIBUTION_INVALID' }))
  })

  it('rejects non-string values returned by a contributor', () => {
    const registry = new ShellEnvRegistry(new Context(), { lynHome: './test-lyn-home' })
    registry.register({
      name: 'wrong-value-type',
      variables: { LYNESS_STRING: { description: 'String fact.' } },
      resolve: () => ({ LYNESS_STRING: 42 }) as unknown as Record<'LYNESS_STRING', string>,
    })

    expect(() => registry.collect(execution())).toThrow(/wrong-value-type.*non-string.*LYNESS_STRING/)
    expect(() => registry.collect(execution())).toThrow(expect.objectContaining({ name: 'ShellEnvError', code: 'SHELL_ENV_CONTRIBUTION_INVALID' }))
  })

  it('removes an effect-scoped contributor when its plugin is disposed', async () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { lynHome: './test-lyn-home' })
    const fiber = await ctx.plugin({
      inject: ['shellEnv'],
      apply(inner: Context) {
        inner.shellEnv.register({
          name: 'temporary',
          variables: { LYNESS_TEMPORARY: { description: 'Temporary fact.' } },
          resolve: () => ({ LYNESS_TEMPORARY: 'present' }),
        })
      },
    })

    expect(registry.collect(execution()).LYNESS_TEMPORARY).toBe('present')
    await fiber.dispose()
    expect(registry.collect(execution())).not.toHaveProperty('LYNESS_TEMPORARY')
  })

  it('returns an explicit contributor disposer', () => {
    const registry = new ShellEnvRegistry(new Context(), { lynHome: './test-lyn-home' })
    const dispose = registry.register({
      name: 'explicit-disposal',
      variables: { LYNESS_EXPLICIT_DISPOSAL: { description: 'Explicitly disposed fact.' } },
      resolve: () => ({ LYNESS_EXPLICIT_DISPOSAL: 'present' }),
    })

    expect(registry.collect(execution()).LYNESS_EXPLICIT_DISPOSAL).toBe('present')
    dispose()
    expect(registry.collect(execution())).not.toHaveProperty('LYNESS_EXPLICIT_DISPOSAL')
  })

  it('the plugin registers the service with no contributors on load', async () => {
    const ctx = new Context()
    await ctx.plugin(BashEnvPlugin)
    expect(ctx.shellEnv).toBeInstanceOf(ShellEnvRegistry)
    expect(ctx.shellEnv.list()).toEqual([])
  })
})
