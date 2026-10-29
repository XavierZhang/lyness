/**
 * Deleting one conversation against the shipped stack: the JSONL backend, the
 * SQLite query backend, and the projection cache. What is asserted is what a
 * person is promised — the logs are gone from disk, the corpus no longer
 * lists them, the search index stops answering for them, and an open
 * conversation is refused.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import { createUserMessage } from '@lyness/lyn-llm'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionLogOffset, SessionSeq } from '@lyness/lyn-session'
import type { SessionHeader } from '@lyness/lyn-session'
import SessionProjectionRegistry from '@lyness/lyn-session-projection'
import * as JsonlSessionPersistence from '@lyness/lyn-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@lyness/lyn-session-query-sqlite'
import Storage from '@lyness/lyn-storage'
import {
  apply as storageJsonApply, Config as storageJsonConfig, inject as storageJsonInject, name as storageJsonName,
} from '@lyness/lyn-storage-json'
import {
  apply as storageDomainApply, Config as storageDomainConfig, inject as storageDomainInject, name as storageDomainName,
} from '@lyness/lyn-storage-domain'
import SessionProjectionCache from '@lyness/lyn-session-projection-cache'
import SessionDeletion, { SessionDeletionLiveError } from '../src/index.ts'

const contexts: Context[] = []
const roots: string[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** One stored header. */
const headerOf = (id: string, parent?: string): SessionHeader => ({
  version: SESSION_FORMAT_VERSION,
  id: SessionId(id),
  createdAt: 1,
  cwd: '/work',
  isSeeded: false,
  ...parent === undefined ? {} : { parentSession: SessionId(parent), origin: 'subagent' as const, delegationDepth: 1 },
})

/** Mount the shipped stack over a temporary root. */
async function harness(options: { cache?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lyn-session-deletion-'))
  roots.push(root)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  if (options.cache === true) {
    await ctx.plugin(Storage)
    await ctx.plugin({ name: storageJsonName, inject: storageJsonInject, apply: storageJsonApply, Config: storageJsonConfig }, { root: join(root, 'storage') })
    await ctx.plugin({ name: storageDomainName, inject: storageDomainInject, apply: storageDomainApply, Config: storageDomainConfig }, { backend: 'json' })
    await ctx.plugin(SessionProjectionCache, { writeEveryEvents: 1, writeIntervalMs: 60_000 })
  }
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions'), compression: 'none' })
  await ctx.plugin(SqliteSessionQueryEngine, { path: join(root, 'session-query.db') })
  await ctx.plugin(SessionDeletion)
  return { ctx, root }
}

/** Resolve after this conversation's next durable checkpoint write. */
function whenCached(ctx: Context, id: SessionId): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('domain/changed', (change) => {
      if (change.domain !== 'session_projcache' || change.key !== id || change.operation !== 'put') return
      dispose()
      resolve()
    })
  })
}

/** The sessions the search index answers for one query. */
async function hits(ctx: Context, query: string): Promise<readonly SessionId[]> {
  const page = await ctx.sessionQuery.searchSessions({ query })
  return page.items.map(item => item.header.id)
}

/** Store one cold conversation log carrying one message. */
async function store(ctx: Context, header: SessionHeader, text: string): Promise<void> {
  const handle = await ctx.sessionPersistence.create(header)
  await handle.append([{
    type: 'user/message',
    seq: SessionSeq(0),
    time: 2,
    data: createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }),
    surfaceOp: 'append',
  }])
  await handle.close()
}

describe('sessionDeletion.delete', () => {
  it('removes the conversation, its subagent logs, and their index rows', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    await store(ctx, headerOf('child', 'root'), 'what it delegated')
    await store(ctx, headerOf('kept'), 'somebody else entirely')
    expect(await hits(ctx, 'delegated')).toEqual([SessionId('child')])

    const result = await ctx.sessionDeletion.delete(SessionId('root'))

    // Deepest first, so a failure part way through leaves the tree walkable.
    expect(result.removed).toEqual([SessionId('child'), SessionId('root')])
    expect(await ctx.sessionPersistence.stat(SessionId('root'))).toBeUndefined()
    expect(await ctx.sessionPersistence.stat(SessionId('child'))).toBeUndefined()
    const listed = (await ctx.sessionQuery.listSessions()).map(row => row.header.id)
    expect(listed).toEqual([SessionId('kept')])
    // The index rebuilds from the backend's own listing, so nothing had to
    // tell it.
    expect(await hits(ctx, 'delegated')).toEqual([])
    expect(await hits(ctx, 'entirely')).toEqual([SessionId('kept')])
  })

  it('removes every stored artifact of the conversation from disk', { timeout: 20_000 }, async () => {
    const { ctx, root } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    const projects = join(root, 'sessions')
    const project = (await readdir(projects))[0]
    expect(project).toBeDefined()
    const sessions = join(projects, String(project))
    expect(await readdir(sessions)).toContain('root')
    // A file the backend does not own, in the same directory: deletion takes
    // the whole conversation directory rather than the generations it knows.
    await writeFile(join(sessions, 'root', 'stray.txt'), 'left behind by something else')

    await ctx.sessionDeletion.delete(SessionId('root'))

    expect(await readdir(sessions)).not.toContain('root')
  })

  it('refuses while the conversation is open and removes nothing', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    ctx.sessions.create(SessionId('root'), { meta: { createdAt: 1, cwd: '/work' } })

    await expect(ctx.sessionDeletion.delete(SessionId('root')))
      .rejects.toThrow(SessionDeletionLiveError)
    expect(await ctx.sessionPersistence.stat(SessionId('root'))).toBeDefined()
  })

  it('refuses while a subagent beneath it is open, and names that session', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    await store(ctx, headerOf('child', 'root'), 'what it delegated')
    ctx.sessions.create(SessionId('child'), {
      meta: { createdAt: 1, cwd: '/work', parentSession: SessionId('root'), origin: 'subagent', delegationDepth: 1 },
    })

    await expect(ctx.sessionDeletion.delete(SessionId('root')))
      .rejects.toThrow(/open subagent session "child"/u)
    expect(await ctx.sessionPersistence.stat(SessionId('root'))).toBeDefined()
    expect(await ctx.sessionPersistence.stat(SessionId('child'))).toBeDefined()
  })

  it('refuses a conversation that is not stored', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    await expect(ctx.sessionDeletion.delete(SessionId('never-existed'))).rejects.toThrow(/not found/u)
  })

  it('removes each member\'s cached projections with its log', { timeout: 20_000 }, async () => {
    const { ctx, root } = await harness({ cache: true })
    await store(ctx, headerOf('root'), 'the conversation itself')
    // A cold read writes the record back, which is the record a deletion has
    // to take: it holds every registered unit's state, attribution included.
    const written = whenCached(ctx, SessionId('root'))
    ctx.sessionProjectionCache.coldSnapshot(headerOf('root'), SessionLogOffset(0), [])
    await written
    const records = join(root, 'storage', 'session_projcache', 'sessions')
    expect(await readdir(records)).toContain('root.json')

    const result = await ctx.sessionDeletion.delete(SessionId('root'))

    expect(result.forgotten).toEqual([SessionId('root')])
    expect(await readdir(records)).not.toContain('root.json')
  })

  it('reports nothing forgotten for a conversation the cache never recorded', { timeout: 20_000 }, async () => {
    const { ctx } = await harness({ cache: true })
    await store(ctx, headerOf('root'), 'never live, never checkpointed')
    const result = await ctx.sessionDeletion.delete(SessionId('root'))
    expect(result).toEqual({ removed: [SessionId('root')], forgotten: [] })
  })

  it('carries a live signal to the backend without cancelling the removal', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    const controller = new AbortController()
    const result = await ctx.sessionDeletion.delete(SessionId('root'), controller.signal)
    expect(result.removed).toEqual([SessionId('root')])
  })

  it('observes cancellation before anything is removed', { timeout: 20_000 }, async () => {
    const { ctx } = await harness()
    await store(ctx, headerOf('root'), 'the conversation itself')
    await expect(ctx.sessionDeletion.delete(SessionId('root'), AbortSignal.abort()))
      .rejects.toThrow(/abort/iu)
    expect(await ctx.sessionPersistence.stat(SessionId('root'))).toBeDefined()
  })
})
