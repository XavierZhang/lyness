/**
 * The command line an operator types: the trademark confirmation, a run that
 * succeeds, a run that fails, and the exit code each one requests.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import { internals } from '@lyness/lyn-cmdline'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as BrandStudio from '../src/index.ts'

const require = createRequire(import.meta.url)
const FONT = require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff2')
const ICON = join(import.meta.dirname, 'fixtures', 'icon.png')

const CONFIRMED = ['--accept-trademark', '--accept-font-license']

const original = { stdout: internals.stdout, stderr: internals.stderr }
const directories: string[] = []

afterEach(async () => {
  internals.stdout = original.stdout
  internals.stderr = original.stderr
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map(async (dir) => { await rm(dir, { recursive: true, force: true }) }))
})

/**
 * Mount the plugin over one invocation and wait for the exit it requests.
 * @param args - the arguments after `--profile brand-studio`.
 * @returns the exit code and everything written to stdout and stderr.
 */
async function invoke(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const output = { stdout: '', stderr: '' }
  internals.stdout = { write: (chunk: string) => { output.stdout += chunk } }
  internals.stderr = { write: (chunk: string) => { output.stderr += chunk } }
  const ctx = new Context()
  const code = await new Promise<number>((resolve) => {
    ctx.provide('cmdlineArgs', { get: () => args })
    ctx.provide('appExit', resolve)
    void ctx.plugin(BrandStudio)
  })
  return { code, ...output }
}

async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'brand-studio-home-'))
  directories.push(dir)
  vi.stubEnv('LYNESS_HOME', dir)
  return dir
}

describe('brand-studio command line', () => {
  it('declares the launcher service it parses', () => {
    expect(BrandStudio.name).toBe('brand-studio')
    expect(BrandStudio.inject).toEqual(['cmdlineArgs'])
  })

  it('refuses to run without the trademark confirmation', async () => {
    const result = await invoke(['--name', 'Acme', '--icon', ICON, '--font', FONT])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('pass --accept-trademark')
  })

  it('refuses to run without the font license confirmation', async () => {
    const result = await invoke(['--name', 'Acme', '--icon', ICON, '--font', FONT, '--accept-trademark'])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('pass --accept-font-license')
  })

  it('applies the brand to the web profile and reports what it wrote', async () => {
    const dir = await home()
    const result = await invoke(['--name', 'lyness', '--icon', ICON, '--font', FONT, ...CONFIRMED])
    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(result.stdout).toContain('brand-studio: wrote the brand for "lyness"')
    expect(result.stdout).toContain(join(dir, 'brand', 'mark.svg'))
    expect(result.stdout).toContain(join(dir, 'profiles', 'web', 'cordis.patch.yml'))
    expect(result.stdout).toContain('`lyn --profile web`')
  })

  it('reports a refused run and requests a failing exit', async () => {
    await home()
    const result = await invoke(['--name', 'Acme', '--icon', ICON, '--font', FONT, '--theme-color', 'rgb(1,2,3)', ...CONFIRMED])
    expect(result).toMatchObject({ code: 1, stdout: '' })
    expect(result.stderr).toBe('brand-studio: StudioError: theme colour must be a hex colour or a colour keyword; got "rgb(1,2,3)"\n')
  })

  it('needs the launcher exit request', () => {
    const ctx = new Context()
    ctx.provide('cmdlineArgs', { get: () => [] })
    expect(() => { BrandStudio.apply(ctx) }).toThrow('the launcher must provide ctx.appExit')
  })
})
