/**
 * The identity, timestamp, link, mutation, and durability-sink guarantees
 * MemoryVfs owes its consumers, asserted directly rather than through the
 * `node:fs` bridge.
 *
 * `lyn-fs-local` builds a version token from `dev:ino:size:mtimeNs:ctimeNs` and
 * refuses a write whose token moved since it read. Two properties carry that:
 * `ino` identifies the entry at a path, and `mtimeMs` moves on every write. The
 * timestamp cases freeze the clock, because these writes are in memory and two
 * revisions routinely land in the same millisecond — a real-clock test passes
 * whether or not the strict increment exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryVfs } from '../../src/storage/memory.ts'
import type { VfsBigIntStats, VfsMutation, VfsMutationSink, VfsStats } from '../../src/storage/types.ts'

const identity = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).ino

const linkCount = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).nlink

const modified = (vfs: MemoryVfs, path: string): number => (vfs.statSync(path) as VfsStats).mtimeMs

afterEach(() => { vi.restoreAllMocks() })

describe('entry identity', () => {
  it('distinguishes paths and holds each identity across repeated stats', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/one.txt', 'one')
    vfs.seed('/lyn/two.txt', 'two')
    const first = identity(vfs, '/lyn/one.txt')
    expect(identity(vfs, '/lyn/two.txt')).not.toBe(first)
    expect(identity(vfs, '/lyn/one.txt')).toBe(first)
  })

  it('forgets the identities under a directory removed as a subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/skills/git/SKILL.md', '# git\n')
    const before = identity(vfs, '/lyn/skills/git/SKILL.md')
    vfs.rmSync('/lyn/skills', { recursive: true })
    vfs.seed('/lyn/skills/git/SKILL.md', '# git rebuilt\n')
    expect(identity(vfs, '/lyn/skills/git/SKILL.md')).not.toBe(before)
  })

  it('moves the source identity when a file replaces another path', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/from.txt', 'moved')
    vfs.seed('/lyn/to.txt', 'replaced')
    const [source, destination] = [identity(vfs, '/lyn/from.txt'), identity(vfs, '/lyn/to.txt')]
    vfs.renameSync('/lyn/from.txt', '/lyn/to.txt')
    const renamed = identity(vfs, '/lyn/to.txt')
    expect(vfs.readFileSync('/lyn/to.txt', 'utf8')).toBe('moved')
    expect([renamed === source, renamed === destination]).toEqual([true, false])
  })
})

describe('modification time', () => {
  it('hydrates explicit metadata without confusing timestamps with permission bits', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/restored', 'value', { mode: 0o600, mtimeMs: 1_600_000_000_000 })
    vfs.seedDirectory('/lyn/restored-directory', { mode: 0o700, mtimeMs: 1_600_000_000_001 })
    const stats = vfs.statSync('/lyn/restored') as VfsStats
    const directory = vfs.statSync('/lyn/restored-directory') as VfsStats
    expect([stats.mode & 0o777, stats.mtimeMs]).toEqual([0o600, 1_600_000_000_000])
    expect([directory.mode & 0o777, directory.mtimeMs]).toEqual([0o700, 1_600_000_000_001])
  })

  it('advances on every write even while the clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/log.jsonl', 'first\n')
    const seeded = modified(vfs, '/lyn/log.jsonl')
    vfs.writeFileSync('/lyn/log.jsonl', 'second\n')
    const written = modified(vfs, '/lyn/log.jsonl')
    vfs.appendFileSync('/lyn/log.jsonl', 'third\n')
    const appended = modified(vfs, '/lyn/log.jsonl')
    vfs.truncateSync('/lyn/log.jsonl', 6)
    const truncated = modified(vfs, '/lyn/log.jsonl')
    expect([written > seeded, appended > written, truncated > appended]).toEqual([true, true, true])
    // One millisecond per revision: the increment is the minimum that separates
    // two tokens, not a coarser bump that would skew a real timestamp.
    expect(truncated - seeded).toBe(3)
  })

  it('takes the clock once the clock has passed the entry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/log.jsonl', 'first\n')
    clock.mockReturnValue(1_700_000_005_000)
    vfs.writeFileSync('/lyn/log.jsonl', 'second\n')
    expect(modified(vfs, '/lyn/log.jsonl')).toBe(1_700_000_005_000)
  })

  it('extends truncation with zero bytes', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/file', new Uint8Array([1, 2]))
    vfs.truncateSync('/lyn/file', 5)
    expect([...vfs.readFileSync('/lyn/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0])
    const handle = vfs.open('/lyn/file', 'r+')
    await handle.truncate(7)
    expect([...vfs.readFileSync('/lyn/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0, 0, 0])
  })

  it('advances a directory only when its immediate entry set changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/lyn/workspace')
    const empty = modified(vfs, '/lyn/workspace')
    vfs.writeFileSync('/lyn/workspace/file.txt', 'one')
    const created = modified(vfs, '/lyn/workspace')
    vfs.writeFileSync('/lyn/workspace/file.txt', 'two')
    const rewritten = modified(vfs, '/lyn/workspace')
    vfs.rmSync('/lyn/workspace/file.txt')
    const removed = modified(vfs, '/lyn/workspace')
    expect([created > empty, rewritten === created, removed > rewritten]).toEqual([true, true, true])
  })
})

describe('mutation publication', () => {
  it('publishes only committed runtime changes and keeps image seeding silent', () => {
    const vfs = new MemoryVfs()
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.seed('/lyn/seeded.txt', 'seeded')
    expect(mutations).toEqual([])
    vfs.writeFileSync('/lyn/seeded.txt', 'changed')
    vfs.mkdirSync('/lyn/created')
    vfs.chmodSync('/lyn/created', 0o700)
    vfs.renameSync('/lyn/seeded.txt', '/lyn/renamed.txt')
    vfs.rmSync('/lyn/created', { recursive: true })
    expect(mutations.map(mutation => ({
      kind: mutation.kind,
      path: mutation.path,
      ...mutation.kind === 'write' ? { entryChanged: mutation.entryChanged } : {},
      ...mutation.kind === 'chmod' ? { mode: mutation.mode } : {},
    }))).toEqual([
      { kind: 'write', path: '/lyn/seeded.txt', entryChanged: false },
      { kind: 'mkdir', path: '/lyn/created' },
      { kind: 'chmod', path: '/lyn/created', mode: 0o700 },
      { kind: 'remove', path: '/lyn/seeded.txt' },
      { kind: 'write', path: '/lyn/renamed.txt', entryChanged: true },
      { kind: 'remove', path: '/lyn/created' },
    ])
    const renamed = mutations[4]
    expect(renamed?.kind === 'write' && new TextDecoder().decode(renamed.bytes)).toBe('changed')
    expect(() => { vfs.writeFileSync('/missing/file', 'no') }).toThrow(/ENOENT/)
    expect(mutations).toHaveLength(6)
  })

  it('contains a faulty observer and lets disposal stop later notifications', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/lyn')
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vfs.subscribe(() => { throw new Error('observer failed') })
    const seen: string[] = []
    const second = vfs.subscribe((mutation) => { seen.push(mutation.path) })
    vfs.writeFileSync('/lyn/one', '1')
    first()
    second()
    vfs.writeFileSync('/lyn/two', '2')
    expect(seen).toEqual(['/lyn/one'])
    expect(reported).toHaveBeenCalledOnce()
  })

  it('feeds the same complete mutations to a durable sink and live subscribers', async () => {
    const recorded: VfsMutation[] = []
    let flushes = 0
    const sink: VfsMutationSink = {
      record: (mutation) => { recorded.push(mutation) },
      flush: async () => { flushes += 1 },
    }
    const vfs = new MemoryVfs({ sink })
    vfs.seedDirectory('/lyn')
    const observed: VfsMutation[] = []
    vfs.subscribe((mutation) => { observed.push(mutation) })
    vfs.writeFileSync('/lyn/log', 'a')
    vfs.appendFileSync('/lyn/log', 'bc')
    await vfs.flush()
    expect(observed).toEqual(recorded)
    expect(observed[0]).toBe(recorded[0])
    expect(recorded[0]).toMatchObject({ kind: 'write', path: '/lyn/log', mode: 0o644, entryChanged: true })
    expect(recorded[1]).toMatchObject({ kind: 'write', path: '/lyn/log', mode: 0o644, entryChanged: false, appendedFrom: 1 })
    expect(recorded[1]?.kind === 'write' && new TextDecoder().decode(recorded[1].bytes)).toBe('abc')
    expect(flushes).toBe(1)
  })

  it('publishes descriptor writes at the file identity current path', () => {
    const mutations: VfsMutation[] = []
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/source', 'old')
    const descriptor = vfs.openFileSync('/lyn/source', 'r+')
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.renameSync('/lyn/source', '/lyn/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('new'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/lyn/destination'])
    expect(vfs.readFileSync('/lyn/destination', 'utf8')).toBe('new')
    vfs.unlinkSync('/lyn/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('detached'))
    expect(mutations).toEqual([])
    expect(new TextDecoder().decode(descriptor.read(0, descriptor.stat().size))).toBe('detached')
  })

  it('decomposes a directory rename into replayable destination state', () => {
    const recorded: VfsMutation[] = []
    const vfs = new MemoryVfs({
      sink: { record: (mutation) => { recorded.push(mutation) }, flush: () => Promise.resolve() },
    })
    vfs.seedDirectory('/lyn/staging/nested', { mode: 0o700 })
    vfs.seed('/lyn/staging/nested/file', 'value', { mode: 0o600 })
    vfs.renameSync('/lyn/staging', '/lyn/published')

    expect(recorded.map(mutation => [mutation.kind, mutation.path])).toEqual([
      ['remove', '/lyn/staging'],
      ['mkdir', '/lyn/published'],
      ['mkdir', '/lyn/published/nested'],
      ['write', '/lyn/published/nested/file'],
    ])
    expect(recorded[3]).toMatchObject({ kind: 'write', mode: 0o600, entryChanged: true })
    expect(recorded[3]?.kind === 'write' && new TextDecoder().decode(recorded[3].bytes)).toBe('value')
  })
})

describe('directory rename', () => {
  it('rejects file, non-empty directory, and missing-parent destinations before mutation', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/source/nested/file', 'source')
    vfs.seed('/lyn/file', 'destination')
    vfs.seed('/lyn/non-empty/child', 'destination')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    expect(() => { vfs.renameSync('/lyn/source', '/lyn/file') })
      .toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
    expect(() => { vfs.renameSync('/lyn/source', '/lyn/non-empty') })
      .toThrow(expect.objectContaining({ code: 'ENOTEMPTY' }))
    expect(() => { vfs.renameSync('/lyn/source', '/missing/destination') })
      .toThrow(expect.objectContaining({ code: 'ENOENT' }))

    expect(vfs.readFileSync('/lyn/source/nested/file', 'utf8')).toBe('source')
    expect(vfs.readFileSync('/lyn/file', 'utf8')).toBe('destination')
    expect(vfs.readFileSync('/lyn/non-empty/child', 'utf8')).toBe('destination')
    expect(mutations).toEqual([])
  })

  it('replaces an empty directory with the source subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/lyn/source/nested', { mode: 0o700 })
    vfs.seed('/lyn/source/nested/file', 'source')
    vfs.seedDirectory('/lyn/destination', { mode: 0o711 })

    vfs.renameSync('/lyn/source', '/lyn/destination')

    expect(vfs.existsSync('/lyn/source')).toBe(false)
    expect(vfs.readFileSync('/lyn/destination/nested/file', 'utf8')).toBe('source')
    expect((vfs.statSync('/lyn/destination') as VfsStats).mode & 0o777).toBe(0o755)
    expect((vfs.statSync('/lyn/destination/nested') as VfsStats).mode & 0o777).toBe(0o700)
  })
})

describe('hard links', () => {
  it('shares identity, bytes, and mode until one name is removed', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/session.jsonl', 'committed\n')
    vfs.linkSync('/lyn/session.jsonl', '/lyn/session-latest.jsonl')
    vfs.linkSync('/lyn/session-latest.jsonl', '/lyn/session-archive.jsonl')
    expect(identity(vfs, '/lyn/session-latest.jsonl')).toBe(identity(vfs, '/lyn/session.jsonl'))
    expect(linkCount(vfs, '/lyn/session.jsonl')).toBe(3n)
    expect(vfs.readFileSync('/lyn/session-latest.jsonl', 'utf8')).toBe('committed\n')
    const changedPaths: string[] = []
    vfs.subscribe((mutation) => { changedPaths.push(mutation.path) })
    vfs.appendFileSync('/lyn/session.jsonl', 'appended\n')
    expect(changedPaths).toEqual([
      '/lyn/session.jsonl',
      '/lyn/session-latest.jsonl',
      '/lyn/session-archive.jsonl',
    ])
    expect(vfs.readFileSync('/lyn/session.jsonl', 'utf8')).toBe('committed\nappended\n')
    expect(vfs.readFileSync('/lyn/session-latest.jsonl', 'utf8')).toBe('committed\nappended\n')
    vfs.chmodSync('/lyn/session-latest.jsonl', 0o600)
    expect((vfs.statSync('/lyn/session.jsonl') as VfsStats).mode & 0o777).toBe(0o600)
    vfs.unlinkSync('/lyn/session-latest.jsonl')
    expect(linkCount(vfs, '/lyn/session.jsonl')).toBe(2n)
    vfs.unlinkSync('/lyn/session-archive.jsonl')
    expect(linkCount(vfs, '/lyn/session.jsonl')).toBe(1n)
    expect(vfs.readFileSync('/lyn/session.jsonl', 'utf8')).toBe('committed\nappended\n')
  })

  it('treats rename between names of the same node as a no-op', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/source', 'value')
    vfs.linkSync('/lyn/source', '/lyn/alias')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    vfs.renameSync('/lyn/source', '/lyn/alias')

    expect(vfs.readFileSync('/lyn/source', 'utf8')).toBe('value')
    expect(vfs.readFileSync('/lyn/alias', 'utf8')).toBe('value')
    expect(linkCount(vfs, '/lyn/source')).toBe(2n)
    expect(mutations).toEqual([])
  })

  it('retargets linked names through file replacement and directory moves', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/replacement', 'replacement')
    vfs.seed('/lyn/target', 'old')
    vfs.linkSync('/lyn/target', '/lyn/target-alias')
    const replaced = vfs.openFileSync('/lyn/target', 'r+')
    vfs.renameSync('/lyn/replacement', '/lyn/target')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    replaced.write(0, new TextEncoder().encode('changed'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/lyn/target-alias'])
    expect(vfs.readFileSync('/lyn/target', 'utf8')).toBe('replacement')
    expect(vfs.readFileSync('/lyn/target-alias', 'utf8')).toBe('changed')
    expect(linkCount(vfs, '/lyn/target-alias')).toBe(1n)

    vfs.seed('/lyn/tree/file', 'tree')
    vfs.linkSync('/lyn/tree/file', '/lyn/outside')
    const moved = vfs.openFileSync('/lyn/tree/file', 'r+')
    vfs.renameSync('/lyn/tree', '/lyn/moved')
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('moved'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/lyn/outside', '/lyn/moved/file'])
    expect(linkCount(vfs, '/lyn/moved/file')).toBe(2n)

    vfs.rmSync('/lyn/moved', { recursive: true })
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('kept!'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/lyn/outside'])
    expect(vfs.readFileSync('/lyn/outside', 'utf8')).toBe('kept!')
    expect(linkCount(vfs, '/lyn/outside')).toBe(1n)
  })

  it('rejects renaming a file over an existing directory', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/lyn/file', 'value')
    vfs.seedDirectory('/lyn/directory')
    expect(() => { vfs.renameSync('/lyn/file', '/lyn/directory') }).toThrow(expect.objectContaining({ code: 'EISDIR' }))
    expect(vfs.readFileSync('/lyn/file', 'utf8')).toBe('value')
    expect(vfs.statSync('/lyn/directory').isDirectory()).toBe(true)
  })
})
