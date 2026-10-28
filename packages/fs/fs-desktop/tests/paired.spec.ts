/**
 * REAL-composition coverage for both halves at once: a server booted through
 * the vendored Loader holds a desktop link, a second process-local context
 * holds the person's own filesystem, and the two are joined by the link the
 * product uses. The assertions are what reaches the disk on the desktop side
 * and what the server's `ctx.fs` hands its consumers back.
 */

import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { DesktopExecutor } from '@deepseek-ai/dsh-desktop-link/executor'
import type { DesktopReply } from '@deepseek-ai/dsh-desktop-link'
import DesktopLink from '@deepseek-ai/dsh-desktop-link'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StoredAuthSessions from '@deepseek-ai/dsh-auth-session/store'
import * as RequestPrincipal from '@deepseek-ai/dsh-request-principal'
import { IDENTITY_COOKIE } from '@deepseek-ai/dsh-request-principal'
import * as SessionOwnership from '@deepseek-ai/dsh-session-ownership'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import DesktopFileSystem from '../src/index.ts'
import { desktopFsHandler } from '../src/handler.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined
let cut: (() => void) | undefined

afterEach(async () => {
  cut?.()
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  cut = undefined
})

/** One registered request scope, captured from the connection double. */
type Scope = (request: Request, run: () => Promise<unknown>) => Promise<unknown>

/** A queue the desktop pushes replies onto and the link reads them from. */
class Uplink implements AsyncIterable<DesktopReply> {
  private readonly queued: DesktopReply[] = []
  private wake: (() => void) | undefined
  private ended = false

  /** Hand one reply to the link. */
  push(reply: DesktopReply): void {
    this.queued.push(reply)
    const wake = this.wake
    this.wake = undefined
    wake?.()
  }

  /** Close the uplink, which ends the link. */
  end(): void {
    this.ended = true
    const wake = this.wake
    this.wake = undefined
    wake?.()
  }

  async *[Symbol.asyncIterator](): AsyncIterator<DesktopReply> {
    for (;;) {
      const next = this.queued.shift()
      if (next !== undefined) { yield next; continue }
      if (this.ended) return
      await new Promise<void>((resolve) => { this.wake = resolve })
    }
  }
}

/** Boot the server, the desktop, and the link between them. */
async function pair(): Promise<{ server: Context; scopes: Scope[]; workspace: string }> {
  root = await mkdtemp(join(tmpdir(), 'dsh-fs-desktop-'))
  await mkdir(join(root, 'workspace'), { recursive: true })
  // macOS puts the temp root behind a symlink; the desktop reports realpaths,
  // so the test compares against the same resolution its backend performs.
  const workspace = await realpath(join(root, 'workspace'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-storage'",
    "- name: '@deepseek-ai/dsh-storage-json'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'state'))}`,
    "- name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    "- name: '@deepseek-ai/dsh-auth-session/store'",
    "- name: '@deepseek-ai/dsh-request-principal'",
    "- name: '@deepseek-ai/dsh-session-ownership'",
    "- name: '@deepseek-ai/dsh-desktop-link'",
    "- name: '@deepseek-ai/dsh-fs-desktop'",
    '',
  ].join('\n'))

  const server = new Context()
  live.push(server)
  const scopes: Scope[] = []
  server.provide('connection', {
    rpc: { scope: (scope: Scope) => { scopes.push(scope); return () => Promise.resolve() } },
  })
  server.baseUrl = `${pathToFileURL(root).href}/`
  await server.plugin(Loader)
  server.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-storage', Storage],
    ['@deepseek-ai/dsh-storage-json', StorageJson],
    ['@deepseek-ai/dsh-storage-domain', StorageDomain],
    ['@deepseek-ai/dsh-auth-session/store', StoredAuthSessions],
    ['@deepseek-ai/dsh-request-principal', RequestPrincipal],
    ['@deepseek-ai/dsh-session-ownership', SessionOwnership],
    ['@deepseek-ai/dsh-desktop-link', DesktopLink],
    ['@deepseek-ai/dsh-fs-desktop', DesktopFileSystem],
  ])
  const base = server.loader.internal
  if (base === undefined) throw new Error('this Node build exposes no internal module loader')
  server.loader.internal = {
    ...base,
    import: (specifier: string) => {
      const found = modules.get(specifier)
      if (found === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return Promise.resolve(found)
    },
  }
  await server.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await server.loader.await()

  // The desktop: its own context, its own real filesystem, its own executor.
  const desktop = new Context()
  live.push(desktop)
  await desktop.plugin(LocalFileSystem, { cwd: workspace })
  const executor = new DesktopExecutor()
  executor.register('fs', desktopFsHandler(desktop.fs))

  const uplink = new Uplink()
  const carrier = new AbortController()
  cut = () => { carrier.abort(); uplink.end() }
  const served = executor.serve(server.desktopLink.serve(ADA, uplink, carrier.signal), (reply) => { uplink.push(reply) })
  void served.catch(() => undefined)
  return { server, scopes, workspace }
}

/** Run one body as Ada, signed in, the way an API call reaches the server. */
async function asAda(server: Context, scopes: Scope[], body: () => Promise<void>): Promise<void> {
  const established = await server.authSessions.establish({ person: ADA, method: 'test' })
  const request = new Request('http://127.0.0.1/api', { headers: { cookie: `${IDENTITY_COOKIE}=${established.id}` } })
  for (const scope of scopes) await scope(request, body)
}

it('reads, writes, and edits the files on the person’s own machine', async () => {
  const { server, scopes, workspace } = await pair()
  await asAda(server, scopes, async () => {
    const target = await server.fs.resolve('notes.md')
    const created = await server.fs.writeText(target, 'first\n')
    expect(created.operation).toBe('create')
    expect(await readFile(join(workspace, 'notes.md'), 'utf8')).toBe('first\n')

    expect(await server.fs.readText(await server.fs.resolve('notes.md'))).toBe('first\n')

    const edited = await server.fs.editText(
      await server.fs.resolve('notes.md'),
      { oldString: 'first', newString: 'second', replaceAll: false },
    )
    expect(edited.after).toBe('second\n')
    expect(await readFile(join(workspace, 'notes.md'), 'utf8')).toBe('second\n')
  })
})

it('answers the synchronous members from what the desktop sent with the target', async () => {
  const { server, scopes, workspace } = await pair()
  await asAda(server, scopes, async () => {
    await server.fs.writeText(await server.fs.resolve('notes.md'), 'x\n')
    const file = await server.fs.resolve('notes.md')
    const directory = await server.fs.resolve('.')
    expect(server.fs.processPath(file)).toBe(join(workspace, 'notes.md'))
    expect(server.fs.fileUrl(file)).toBe(pathToFileURL(join(workspace, 'notes.md')).href)
    expect(server.fs.contains(directory, file)).toBe(true)
    expect(server.fs.contains(file, directory)).toBe(false)
  })
})

it('reports metadata, listings, and byte reads from the desktop', async () => {
  const { server, scopes } = await pair()
  await asAda(server, scopes, async () => {
    await server.fs.writeText(await server.fs.resolve('notes.md'), 'hello\n')
    const file = await server.fs.resolve('notes.md')

    const info = await server.fs.stat(file)
    expect(info?.type).toBe('file')
    expect(info?.size).toBe(6)
    expect(await server.fs.stat(await server.fs.resolve('missing.md'))).toBeUndefined()

    expect((await server.fs.lstat('notes.md'))?.type).toBe('file')
    expect(await server.fs.lstat('missing.md')).toBeUndefined()

    const entries = await server.fs.listDir(await server.fs.resolve('.'))
    expect(entries.map(entry => entry.name)).toEqual(['notes.md'])
    expect(entries[0]?.type).toBe('file')

    expect(Buffer.from(await server.fs.readBytes(file, undefined, 64)).toString()).toBe('hello\n')
    expect(Buffer.from(await server.fs.readByteRange(file, { offset: 1, length: 3 })).toString()).toBe('ell')

    const chunks: string[] = []
    for await (const chunk of await server.fs.streamText(file)) chunks.push(chunk)
    expect(chunks.join('')).toBe('hello\n')
  })
})

it('raises the desktop’s own failure code, not a transport error', async () => {
  const { server, scopes } = await pair()
  await asAda(server, scopes, async () => {
    await expect(server.fs.readText(await server.fs.resolve('missing.md')))
      .rejects.toMatchObject({ code: 'FS_NOT_FOUND' })
  })
})

it('refuses a call that belongs to nobody, because no machine is addressed', async () => {
  const { server } = await pair()
  await expect(server.fs.resolve('notes.md')).rejects.toMatchObject({ code: 'FS_IO_ERROR' })
})
