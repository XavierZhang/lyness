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
import { parsePatch } from '@deepseek-ai/dsh-fs-patch'
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
async function joined(): Promise<{ fs: FileSystem; workspace: string; seen: string[]; desktop: Context }> {
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
  // `DesktopFileSystem` injects the projection registry, and reads the owner
  // through the service that registered the owner projection.
  server.provide('sessionProjections', { stateOf: () => ({ owner: ADA, version: 1, openedAt: 'now' }) })
  server.provide('sessionVisibility', { ownerOf: () => ({ owner: ADA, version: 1, openedAt: 'now' }) })
  server.provide('agents', { currentInitiator: () => ({ session: {} }) })
  await server.plugin(DesktopFileSystem)
  return { fs: server.fs, workspace, seen, desktop }
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
  // Unguarded, so the absent version travels as its own absent field.
  expect((await fs.editText(await fs.resolve('notes.md'), { oldString: 'two', newString: 'four', replaceAll: false })).after)
    .toBe('four\n')

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

/**
 * The hunks of a one-line replacement in `notes.md`, as the patch parser builds them.
 * @param old - the line to replace.
 * @param replacement - the line to write.
 * @param context - the `@@` anchor, when the hunk is to carry one.
 * @returns the parsed hunks of that one update.
 */
function hunks(old: string, replacement: string, context?: string) {
  const header = context === undefined ? '@@' : `@@ ${context}`
  const patch = `*** Begin Patch\n*** Update File: notes.md\n${header}\n-${old}\n+${replacement}\n*** End Patch`
  const [operation] = parsePatch(patch)
  if (operation?.kind !== 'update') throw new Error('expected an update operation')
  return operation.hunks
}

it('patches a file through the desktop, guarded by the version it reported', async () => {
  const { fs, workspace, seen } = await joined()
  const written = await fs.writeText(await fs.resolve('notes.md'), 'one\ntail\n')
  const patched = await fs.patchText(
    await fs.resolve('notes.md'),
    hunks('one', 'two'),
    { version: written.version },
    undefined,
    { mode: 'workspace-write', workspaceRoot: '/', sessionId: brandString<SessionId>('s1') },
  )
  expect(patched.before).toBe('one\ntail\n')
  expect(patched.after).toBe('two\ntail\n')
  expect(await readFile(join(workspace, 'notes.md'), 'utf8')).toBe('two\ntail\n')
  expect(seen).toContain('patchText')

  // Unguarded: the absent version travels as its own absent field.
  const unguarded = await fs.patchText(await fs.resolve('notes.md'), hunks('two', 'three'))
  expect(unguarded.after).toBe('three\ntail\n')

  await expect(fs.patchText(await fs.resolve('notes.md'), hunks('three', 'four'), { version: FsVersion('stale') }))
    .rejects.toMatchObject({ code: 'FS_STALE_VERSION' })
})

it('carries the `@@` anchor of a hunk that has one', async () => {
  // The anchor is the one hunk field that is absent rather than undefined when
  // the patch has none, so a hunk carrying one has to cross the link too.
  const { fs } = await joined()
  await fs.writeText(await fs.resolve('notes.md'), 'section\nold\n')
  const patched = await fs.patchText(await fs.resolve('notes.md'), hunks('old', 'new', 'section'))
  expect(patched.after).toBe('section\nnew\n')
})

it('deletes a file through the desktop and reports what it held', async () => {
  const { fs, workspace, seen } = await joined()
  const written = await fs.writeText(await fs.resolve('notes.md'), 'one\n')
  const deleted = await fs.deleteFile(
    await fs.resolve('notes.md'),
    { version: written.version },
    undefined,
    { mode: 'workspace-write', workspaceRoot: '/', sessionId: brandString<SessionId>('s1') },
  )
  expect(deleted.before).toBe('one\n')
  expect(seen).toContain('deleteFile')
  expect(await fs.lstat('notes.md')).toBeUndefined()

  // Unguarded: the absent version travels as its own absent field.
  await fs.writeText(await fs.resolve('other.md'), 'two\n')
  expect((await fs.deleteFile(await fs.resolve('other.md'))).before).toBe('two\n')
  void workspace
})

it('moves a file through the desktop, carrying both guards and the hunks to apply', async () => {
  const { fs, workspace, seen } = await joined()
  const written = await fs.writeText(await fs.resolve('notes.md'), 'one\ntail\n')
  const moved = await fs.moveFile(
    await fs.resolve('notes.md'),
    await fs.resolve('moved.md'),
    { hunks: hunks('one', 'two'), expectedSource: { version: written.version }, expectedDestination: { kind: 'createIfAbsent' } },
    undefined,
    { mode: 'workspace-write', workspaceRoot: '/', sessionId: brandString<SessionId>('s1') },
  )
  expect(moved.sourceDeleted).toBe(true)
  expect(moved.sourceBefore).toBe('one\ntail\n')
  expect(moved.destination.operation).toBe('create')
  expect(moved.destination.after).toBe('two\ntail\n')
  expect(seen).toContain('moveFile')
  expect(await readFile(join(workspace, 'moved.md'), 'utf8')).toBe('two\ntail\n')
  expect(await fs.lstat('notes.md')).toBeUndefined()
})

it('carries the failure of a move whose destination was written but whose source stayed', async () => {
  // The desktop reports a half-done move as an outcome, not as an error: the
  // destination exists and the source does too, and the Host must publish both
  // halves rather than claim the move completed.
  const { fs, desktop } = await joined()
  const written = await fs.writeText(await fs.resolve('notes.md'), 'one\n')
  vi.spyOn(desktop.fs, 'moveFile').mockResolvedValue({
    sourceBefore: 'one\n',
    destination: { operation: 'create', version: written.version, before: null, after: 'one\n' },
    sourceDeleted: false,
    sourceFailure: { code: 'FS_IO_ERROR', message: 'the source could not be removed' },
  })
  const moved = await fs.moveFile(await fs.resolve('notes.md'), await fs.resolve('moved.md'), {})
  expect(moved.sourceDeleted).toBe(false)
  expect(moved.sourceBefore).toBe('one\n')
  expect(moved.destination.after).toBe('one\n')
  if (moved.sourceDeleted) throw new Error('the spy reported a source that stayed')
  expect(moved.sourceFailure).toEqual({ code: 'FS_IO_ERROR', message: 'the source could not be removed' })
})
