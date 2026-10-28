/**
 * The two halves joined directly, so each operation's arguments can be driven
 * from the test: the Host's provider calls a link that hands the payload
 * straight to the desktop handler over a real local filesystem.
 */

import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { FsVersion } from '@deepseek-ai/dsh-fs'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import type { SessionId } from '@deepseek-ai/dsh-session'
import DesktopFileSystem from '../src/index.ts'
import { desktopFsHandler } from '../src/handler.ts'

const ADA = brandString<PersonId>('ada')

const live: Context[] = []
let root: string | undefined

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** The Host's filesystem, wired to a desktop handler over a real local one. */
async function joined(): Promise<{ fs: FileSystem; workspace: string; seen: string[] }> {
  root = await mkdtemp(join(tmpdir(), 'dsh-fs-desktop-rt-'))
  await mkdir(join(root, 'workspace'), { recursive: true })
  const workspace = await realpath(join(root, 'workspace'))

  const desktop = new Context()
  live.push(desktop)
  await desktop.plugin(LocalFileSystem, { cwd: workspace })
  const handler = desktopFsHandler(desktop.fs)

  const seen: string[] = []
  const server = new Context()
  live.push(server)
  server.provide('desktopLink', {
    call: (person: PersonId, capability: string, operation: string, payload: JsonValue, signal?: AbortSignal) => {
      expect(person).toBe(ADA)
      expect(capability).toBe('fs')
      seen.push(operation)
      return handler.perform(operation, payload, signal ?? new AbortController().signal)
    },
  })
  server.provide('sessionProjections', { stateOf: () => ({ owner: ADA, version: 1, openedAt: 'now' }) })
  server.provide('agents', { currentInitiator: () => ({ session: {} }) })
  await server.plugin(DesktopFileSystem)
  return { fs: server.fs, workspace, seen }
}

it('resolves against a caller-supplied working directory', async () => {
  const { fs, workspace } = await joined()
  await mkdir(join(workspace, 'inner'), { recursive: true })
  const target = await fs.resolve('leaf.md', { cwd: join(workspace, 'inner') })
  expect(fs.processPath(target)).toBe(join(workspace, 'inner', 'leaf.md'))
  expect((await fs.lstat('leaf.md', { cwd: join(workspace, 'inner') }))).toBeUndefined()
})

it('guards a create and a replacement by the version the desktop reported', async () => {
  const { fs } = await joined()
  const target = await fs.resolve('notes.md')
  const created = await fs.writeText(target, 'one\n', { kind: 'createIfAbsent' })
  expect(created.operation).toBe('create')

  const replaced = await fs.writeText(
    await fs.resolve('notes.md'),
    'two\n',
    { kind: 'replaceIfVersion', version: created.version },
    undefined,
    { mode: 'workspace-write', workspaceRoot: '/', sessionId: brandString<SessionId>('s1') },
  )
  expect(replaced.operation).toBe('update')
  expect(replaced.before).toBe('one\n')

  await expect(fs.writeText(await fs.resolve('notes.md'), 'three\n', { kind: 'createIfAbsent' }))
    .rejects.toMatchObject({ code: 'FS_NOT_OBSERVED' })
})

it('guards an edit by version and reports a stale one', async () => {
  const { fs } = await joined()
  const written = await fs.writeText(await fs.resolve('notes.md'), 'one\n')
  const edited = await fs.editText(
    await fs.resolve('notes.md'),
    { oldString: 'one', newString: 'two', replaceAll: true },
    { version: written.version },
    undefined,
    { mode: 'read-only', workspaceRoot: '/' },
  )
  expect(edited.after).toBe('two\n')

  await expect(fs.editText(
    await fs.resolve('notes.md'),
    { oldString: 'two', newString: 'three', replaceAll: false },
    { version: FsVersion('stale') },
  )).rejects.toMatchObject({ code: 'FS_STALE_VERSION' })
})

it('carries each listed child’s own metadata and target', async () => {
  const { fs, workspace } = await joined()
  await writeFile(join(workspace, 'a.md'), 'a\n')
  await mkdir(join(workspace, 'b'), { recursive: true })
  const entries = await fs.listDir(await fs.resolve('.'))
  expect(entries.map(entry => [entry.name, entry.type])).toEqual([['a.md', 'file'], ['b', 'directory']])
  expect(entries[0]?.size).toBe(2)
  expect(entries[0]?.version).toBeDefined()
  expect(fs.processPath(entries[0]!.target)).toBe(join(workspace, 'a.md'))
  expect(fs.fileUrl(entries[1]!.target)).toBe(pathToFileURL(join(workspace, 'b')).href)
  expect(await readFile(join(workspace, 'a.md'), 'utf8')).toBe('a\n')
})

it('refuses an operation this desktop does not serve', async () => {
  const { fs } = await joined()
  const desktop = new Context()
  live.push(desktop)
  await desktop.plugin(LocalFileSystem, { cwd: '.' })
  const items: JsonValue[] = []
  for await (const item of desktopFsHandler(desktop.fs).perform('chmod', null, new AbortController().signal)) {
    items.push(item)
  }
  expect(items).toEqual([{ ok: false, code: 'FS_IO_ERROR', message: 'this desktop\'s filesystem serves no "chmod" operation' }])
  void fs
})

it('reports the path flavour of a Windows desktop', async () => {
  vi.resetModules()
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
  try {
    const { desktopFsHandler: windows } = await import('../src/handler.ts')
    const desktop = new Context()
    live.push(desktop)
    await desktop.plugin(LocalFileSystem, { cwd: process.cwd() })
    const items: JsonValue[] = []
    for await (const item of windows(desktop.fs).perform('resolve', { path: '.', cwd: null }, new AbortController().signal)) {
      items.push(item)
    }
    expect(items).toMatchObject([{ ok: true, value: { platform: 'win32' } }])
  } finally {
    if (platform !== undefined) Object.defineProperty(process, 'platform', platform)
  }
})
