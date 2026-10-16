/**
 * What each half does when the other one misbehaves: a link that breaks
 * mid-call, a desktop that answers with something unrecognizable, and a
 * local backend that fails in a way the filesystem taxonomy has no code for.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@lyness/cordis'
import LocalFileSystem from '@lyness/lyn-fs-local'
import { FsTargetKey } from '@lyness/lyn-fs'
import type { FileSystem, FsDirEntry, FsTarget } from '@lyness/lyn-fs'
import type { JsonValue } from '@lyness/lyn-util-values'
import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import DesktopFileSystem from '../src/index.ts'
import { desktopFsHandler } from '../src/handler.ts'
import { encodeTarget } from '../src/targets.ts'
import type { DesktopTarget } from '../src/protocol.ts'

const ADA = brandString<PersonId>('ada')

const HERE: FsTarget = encodeTarget({
  key: '/w/notes.md',
  displayPath: '/w/notes.md',
  processPath: '/w/notes.md',
  fileUrl: 'file:///w/notes.md',
  platform: 'posix',
})

const live: Context[] = []
let root: string | undefined

afterEach(async () => {
  for (const ctx of live.splice(0)) await ctx.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** What one scripted link does with a call. */
type Script = (signal: AbortSignal | undefined) => AsyncIterable<JsonValue>

/** A Host filesystem whose desktop answers exactly what the script says. */
async function scripted(script: Script): Promise<FileSystem> {
  const server = new Context()
  live.push(server)
  server.provide('desktopLink', {
    call: (_person: PersonId, _capability: string, _operation: string, _payload: JsonValue, signal?: AbortSignal) =>
      script(signal),
  })
  server.provide('sessionProjections', { stateOf: () => null })
  server.provide('requestPrincipal', { current: () => ({ person: ADA, acting: {} }) })
  await server.plugin(DesktopFileSystem)
  return server.fs
}

/** One reply, as the desktop would send it. */
function replying(...values: JsonValue[]): Script {
  return async function* () { for (const value of values) yield value }
}

it('reports a broken link as an I/O failure, whatever it broke with', async () => {
  const fs = await scripted(() => { throw new Error('the carrier went away') })
  await expect(fs.readText(HERE)).rejects.toMatchObject({ code: 'FS_IO_ERROR', message: 'the carrier went away' })
})

it('reports a link that threw a non-error by what it threw', async () => {
  const fs = await scripted(() => { throw 'no desktop' })
  await expect(fs.readText(HERE)).rejects.toMatchObject({ code: 'FS_IO_ERROR', message: 'no desktop' })
})

it('reports a cancelled call as aborted rather than as a transport failure', async () => {
  const controller = new AbortController()
  const fs = await scripted((signal) => {
    controller.abort()
    void signal
    throw new Error('cancelled')
  })
  await expect(fs.readText(HERE, controller.signal)).rejects.toMatchObject({ code: 'FS_ABORTED' })
})

it('refuses a reply it cannot read', async () => {
  const fs = await scripted(replying({ nope: 1 }))
  await expect(fs.readText(HERE)).rejects.toMatchObject({ code: 'FS_IO_ERROR' })
})

it('refuses an unreadable reply to a cancelled call as aborted', async () => {
  const controller = new AbortController()
  const fs = await scripted(replying({ nope: 1 }))
  controller.abort()
  await expect(fs.readText(HERE, controller.signal)).rejects.toMatchObject({ code: 'FS_ABORTED' })
})

it('passes on metadata the desktop could not report', async () => {
  const fs = await scripted(replying({ ok: true, value: { version: 'v1', type: 'directory' } }))
  expect(await fs.stat(HERE)).toEqual({ version: 'v1', type: 'directory' })
})

it('passes on a path entry the desktop could not size', async () => {
  const fs = await scripted(replying({ ok: true, value: { version: 'v1', type: 'symlink' } }))
  expect(await fs.lstat('/w/link')).toEqual({ version: 'v1', type: 'symlink' })
})

it('passes on a listed child the desktop could not size or version', async () => {
  const child: DesktopTarget = {
    key: '/w/sub', displayPath: '/w/sub', processPath: '/w/sub', fileUrl: 'file:///w/sub', platform: 'posix',
  }
  const fs = await scripted(replying({ ok: true, value: [{ name: 'sub', type: 'directory', target: child }] }))
  const entries = await fs.listDir(HERE)
  expect(entries).toEqual([{ name: 'sub', type: 'directory', target: encodeTarget(child) }])
})

it('raises a stream that fails after its first chunks are already out', async () => {
  const fs = await scripted(replying(
    { ok: true, value: 'half ' },
    { ok: false, code: 'FS_IO_ERROR', message: 'the disk went away mid-read' },
  ))
  const seen: string[] = []
  await expect((async () => {
    for await (const chunk of await fs.streamText(HERE)) seen.push(chunk)
  })()).rejects.toMatchObject({ message: 'the disk went away mid-read' })
  expect(seen).toEqual(['half '])
})

it('refuses a stream that ended without saying how it ended', async () => {
  const fs = await scripted(replying())
  await expect((async () => {
    for await (const chunk of await fs.streamText(HERE)) void chunk
  })()).rejects.toMatchObject({ code: 'FS_IO_ERROR' })
})

/** The desktop's own filesystem, with one method replaced for the test. */
async function desktopWith(overrides: Partial<FileSystem>): Promise<FileSystem> {
  root = await mkdtemp(join(tmpdir(), 'lyn-fs-desktop-fail-'))
  const desktop = new Context()
  live.push(desktop)
  await desktop.plugin(LocalFileSystem, { cwd: root })
  return Object.assign(desktop.fs, overrides)
}

/** Everything the handler produced for one call. */
async function performed(fs: FileSystem, operation: string, payload: JsonValue): Promise<JsonValue[]> {
  const items: JsonValue[] = []
  for await (const item of desktopFsHandler(fs).perform(operation, payload, new AbortController().signal)) {
    items.push(item)
  }
  return items
}

it('omits from a listing what the local backend did not report', async () => {
  const entry: FsDirEntry = {
    name: 'sub',
    type: 'directory',
    target: { targetKey: FsTargetKey(join(root ?? '', 'sub')), displayPath: 'sub' },
  }
  const fs = await desktopWith({ listDir: () => Promise.resolve([entry]) })
  const items = await performed(fs, 'listDir', { target: {
    key: root ?? '', displayPath: '.', processPath: root ?? '', fileUrl: 'file:///', platform: 'posix',
  } })
  expect(items).toMatchObject([{ ok: true, value: [{ name: 'sub', type: 'directory' }] }])
  expect(Object.keys((items[0] as { value: Record<string, unknown>[] }).value[0]!)).toEqual(['name', 'type', 'target'])
})

it('gives an untyped local failure the general I/O code', async () => {
  const fs = await desktopWith({ readText: () => Promise.reject(new Error('the drive is asleep')) })
  const items = await performed(fs, 'readText', { target: {
    key: root ?? '', displayPath: 'x', processPath: root ?? '', fileUrl: 'file:///', platform: 'posix',
  } })
  expect(items).toEqual([{ ok: false, code: 'FS_IO_ERROR', message: 'the drive is asleep' }])
})

it('renders a local failure that is not an error at all', async () => {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  const fs = await desktopWith({ readText: () => Promise.reject('the drive is gone') })
  const items = await performed(fs, 'readText', { target: {
    key: root ?? '', displayPath: 'x', processPath: root ?? '', fileUrl: 'file:///', platform: 'posix',
  } })
  expect(items).toEqual([{ ok: false, code: 'FS_IO_ERROR', message: 'the drive is gone' }])
})
