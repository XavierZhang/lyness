/**
 * The command line an operator types: a run that writes the layer, a run that
 * refuses, the profile it initializes, and the exit code each one requests.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { internals } from '@deepseek-ai/dsh-cmdline'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import * as AdminSetup from '../src/index.ts'

const original = { stdout: internals.stdout, stderr: internals.stderr }
const directories: string[] = []

const FLAGS = [
  '--person', 'ada', '--name', 'Ada',
  '--issuer', 'https://id.acme.example', '--client-id', 'client-1', '--subject', 'sub-ada',
  '--public-origin', 'https://agent.acme.example',
] as const

afterEach(async () => {
  internals.stdout = original.stdout
  internals.stderr = original.stderr
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map(async (dir) => { await rm(dir, { recursive: true, force: true }) }))
})

/**
 * Mount the plugin over one invocation and wait for the exit it requests.
 * @param args - the arguments after `--profile admin-setup`.
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
    void ctx.plugin(AdminSetup)
  })
  return { code, ...output }
}

/** One dsh home this case owns. */
async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'admin-setup-home-'))
  directories.push(dir)
  vi.stubEnv('DSH_HOME', dir)
  return dir
}

describe('admin-setup command line', () => {
  it('declares the launcher service it parses', () => {
    expect(AdminSetup.name).toBe('admin-setup')
    expect(AdminSetup.inject).toEqual(['cmdlineArgs'])
  })

  it('refuses to mount without the exit request the launcher provides', async () => {
    const ctx = new Context()
    ctx.provide('cmdlineArgs', { get: () => [] })
    await expect(ctx.plugin(AdminSetup).await()).rejects.toThrow(/appExit/u)
  })

  it('writes the administrator into a shipped profile it initializes', async () => {
    const dir = await home()
    const run = await invoke(['--target', 'enterprise', ...FLAGS])
    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)

    const layer = await readFile(join(dir, 'profiles', 'enterprise', 'cordis.patch.yml'), 'utf8')
    const written = parse(layer) as readonly { id?: string; config?: { people?: unknown[] } }[]
    expect(written.find(row => row.id === 'people')?.config?.people)
      .toEqual([{ id: 'ada', displayName: 'Ada', role: 'platform-administrator' }])
    // The report is the operator's next two steps, in order: the provider
    // first, because starting without it registered admits nobody.
    expect(run.stdout).toContain('https://agent.acme.example/auth/callback/oidc')
    expect(run.stdout).toContain('OIDC_CLIENT_SECRET=… dsh --profile enterprise')
    expect(run.stdout.indexOf('/auth/callback/oidc')).toBeLessThan(run.stdout.indexOf('OIDC_CLIENT_SECRET=…'))
  })

  it('says plainly when the browser reaches it over plain HTTP', async () => {
    await home()
    const run = await invoke(['--target', 'enterprise', '--person', 'ada', '--name', 'Ada',
      '--issuer', 'http://localhost:8080', '--client-id', 'client-1', '--subject', 'sub-ada',
      '--public-origin', 'http://127.0.0.1:7788'])
    expect(run.code).toBe(0)
    // A development install, and the report says so rather than leaving the
    // operator to notice that the cookies carry no Secure.
    expect(run.stdout).toContain('cookies not secure, which is plain HTTP')
  })

  it('takes the credential reference the operator names', async () => {
    const dir = await home()
    const run = await invoke(['--target', 'enterprise', ...FLAGS, '--secret-name', 'ACME_SSO_SECRET'])
    expect(run.code).toBe(0)
    const layer = await readFile(join(dir, 'profiles', 'enterprise', 'cordis.patch.yml'), 'utf8')
    expect(layer).toContain('secret: ACME_SSO_SECRET')
  })

  it('refuses a profile that neither exists nor ships, and writes nothing', async () => {
    await home()
    const run = await invoke(['--target', 'not-a-profile', ...FLAGS])
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/does not exist/u)
    expect(run.stdout).toBe('')
  })

  it('reports a refused input on stderr and asks for exit code 1', async () => {
    await home()
    const run = await invoke(['--target', 'enterprise', ...FLAGS, '--subject', 'has space'])
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/admin-setup: SetupError: the subject must be/u)
  })

  it('refuses a second administrator, and takes one with --replace', async () => {
    const dir = await home()
    expect((await invoke(['--target', 'enterprise', ...FLAGS])).code).toBe(0)

    const second = await invoke(['--target', 'enterprise', '--person', 'bea', '--name', 'Bea',
      '--issuer', 'https://id.acme.example', '--client-id', 'client-1', '--subject', 'sub-bea',
      '--public-origin', 'https://agent.acme.example'])
    expect(second.code).toBe(1)
    expect(second.stderr).toMatch(/already has a written administrator/u)

    const replaced = await invoke(['--target', 'enterprise', '--person', 'bea', '--name', 'Bea',
      '--issuer', 'https://id.acme.example', '--client-id', 'client-1', '--subject', 'sub-bea',
      '--public-origin', 'https://agent.acme.example', '--replace'])
    expect(replaced.code).toBe(0)
    const layer = await readFile(join(dir, 'profiles', 'enterprise', 'cordis.patch.yml'), 'utf8')
    expect(layer).toContain('id: bea')
    expect(layer).not.toContain('id: ada')
  })

  it('prints its own help, naming where the subject comes from', async () => {
    await home()
    const run = await invoke(['--help'])
    expect(run.code).toBe(0)
    expect(run.stdout).toContain('--subject <sub>')
    expect(run.stdout).toContain('never their address')
  })
})
