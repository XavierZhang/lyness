/**
 * The brand-setup invocation: what it publishes for the server row to bind,
 * and the four invocations that publish nothing — help, an unknown flag, a
 * non-numeric port, and a port above the range.
 *
 * Publishing nothing is the point of the module: the server row injects this
 * service, so an invocation that only asks for help never reaches a bind.
 */

import { Context } from '@lyness/cordis'
import { internals } from '@lyness/lyn-cmdline'
import { afterEach, describe, expect, it } from 'vitest'
import * as Startup from '../src/startup.ts'
import { BRAND_SETUP_STARTUP_SERVICE, type BrandSetupStartup } from '../src/startup.ts'

const original = { stdout: internals.stdout, stderr: internals.stderr }
const live: Context[] = []

afterEach(async () => {
  internals.stdout = original.stdout
  internals.stderr = original.stderr
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
})

/** One invocation, with whatever it published and wrote. */
interface Invocation {
  readonly bind: BrandSetupStartup | undefined
  readonly code: number | undefined
  readonly stdout: string
  readonly stderr: string
}

/**
 * Mount the provider over one command line and report what it published.
 * @param args - the arguments after `--profile brand-setup`.
 * @returns the published bind, the exit code it asked for, and its output.
 */
async function invoke(args: readonly string[]): Promise<Invocation> {
  const output = { stdout: '', stderr: '' }
  internals.stdout = { write: (chunk: string) => { output.stdout += chunk } }
  internals.stderr = { write: (chunk: string) => { output.stderr += chunk } }
  const ctx = new Context()
  live.push(ctx)
  let code: number | undefined
  ctx.provide('cmdlineArgs', { get: () => args })
  ctx.provide('appExit', (value: number) => { code = value })
  await ctx.plugin(Startup).await()
  return { bind: ctx.get(BRAND_SETUP_STARTUP_SERVICE), code, ...output }
}

describe('brand-setup command line', () => {
  it('declares the launcher service it parses', () => {
    expect(Startup.name).toBe('brand-setup-startup')
    expect(Startup.inject).toEqual(['cmdlineArgs'])
    expect(BRAND_SETUP_STARTUP_SERVICE).toBe('brandSetupStartup')
  })

  it('publishes an OS-assigned loopback port when no flag names one', async () => {
    const result = await invoke([])
    expect(result.bind).toEqual({ host: '127.0.0.1', port: 0 })
    expect(result.code).toBeUndefined()
    expect(result.stderr).toBe('')
  })

  it('publishes the port an operator names, on loopback only', async () => {
    const result = await invoke(['--port', '7345'])
    expect(result.bind).toEqual({ host: '127.0.0.1', port: 7345 })
    expect(result.code).toBeUndefined()
  })

  it('writes help and binds nothing', async () => {
    const result = await invoke(['--help'])
    expect(result.bind).toBeUndefined()
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('brand-setup')
    expect(result.stdout).toContain('--port <port>')
    expect(result.stdout).toContain('lyn --profile brand-setup --port 7345')
    expect(result.stdout).toContain('binds 127.0.0.1 only')
  })

  it('refuses a non-numeric port and binds nothing', async () => {
    const result = await invoke(['--port', 'eight'])
    expect(result.bind).toBeUndefined()
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('--port must be a number, got "eight"')
  })

  it('refuses a port above the range and binds nothing', async () => {
    const result = await invoke(['--port', '70000'])
    expect(result.bind).toBeUndefined()
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('--port 70000 is not a port number')
  })

  it('refuses an unknown flag and binds nothing', async () => {
    const result = await invoke(['--bind', '0.0.0.0'])
    expect(result.bind).toBeUndefined()
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('--bind')
  })
})
