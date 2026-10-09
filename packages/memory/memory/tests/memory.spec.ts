/**
 * Durable memory behavior: explicit writes only, retention that keeps the
 * newest fact, prompt contribution, and the model-facing tools.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@lyness/cordis'
import Storage from '@lyness/lyn-storage'
import * as StorageDomain from '@lyness/lyn-storage-domain'
import * as StorageJson from '@lyness/lyn-storage-json'
import SystemPrompt from '@lyness/lyn-system-prompt'
import Tools from '@lyness/lyn-tools'
import { brandString } from '@lyness/lyn-brand'
import { afterEach, describe, expect, it } from 'vitest'
import MemoryService, { MEMORY_CONTEXT_NAME, renderEntries, resolveConfig } from '../src/index.ts'
import * as MemoryTools from '../src/tools.ts'
import { MAX_ENTRY_CHARS } from '../src/storage.ts'
import { memoryCallCard, renderRecords } from '../src/tools.ts'
import type { MemoryId, MemoryRecord } from '../src/types.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Boot a context with durable JSON storage, the prompt surface, and memory. */
async function harness(config: { maxEntries?: number } = {}): Promise<Context> {
  const root = mkdtempSync(join(tmpdir(), 'lyn-memory-'))
  roots.push(root)
  return boot(root, config)
}

/** Boot one context over an existing storage root. */
async function boot(root: string, config: { maxEntries?: number } = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SystemPrompt).await()
  await ctx.plugin(Tools).await()
  await ctx.plugin(MemoryService, config).await()
  return ctx
}

/** The memory service on a booted context. */
function memoryOf(ctx: Context): MemoryService {
  return ctx.get('memory') as MemoryService
}

describe('the memory service', () => {
  it('keeps an explicitly written fact and reports it in write order', async () => {
    const ctx = await harness()
    const first = await memoryOf(ctx).remember('Deploys happen on Fridays')
    const second = await memoryOf(ctx).remember('The web app lives in apps/web')

    expect((await memoryOf(ctx).list()).map(record => record.text))
      .toEqual(['Deploys happen on Fridays', 'The web app lives in apps/web'])
    expect(first.scope).toBe('member')
    expect(second.id).not.toBe(first.id)
    expect(Date.parse(first.writtenAt)).not.toBeNaN()
    await ctx.fiber.dispose()
  })

  it('stores a shared entry when the caller publishes one', async () => {
    const ctx = await harness()
    const record = await memoryOf(ctx).remember('Invoices go to finance@example.com', 'shared')
    expect(record.scope).toBe('shared')
    await ctx.fiber.dispose()
  })

  it('trims the written text and refuses a blank or oversized fact', async () => {
    const ctx = await harness()
    expect((await memoryOf(ctx).remember('  padded  ')).text).toBe('padded')
    await expect(memoryOf(ctx).remember('   ')).rejects.toThrow('must not be blank')
    await expect(memoryOf(ctx).remember('x'.repeat(MAX_ENTRY_CHARS + 1)))
      .rejects.toThrow(`at most ${String(MAX_ENTRY_CHARS)} characters`)
    await ctx.fiber.dispose()
  })

  it('drops the oldest entry on write and keeps the newest', async () => {
    const ctx = await harness({ maxEntries: 2 })
    await memoryOf(ctx).remember('one')
    await memoryOf(ctx).remember('two')
    await memoryOf(ctx).remember('three')

    expect((await memoryOf(ctx).list()).map(record => record.text)).toEqual(['two', 'three'])
    await ctx.fiber.dispose()
  })

  it('forgets a stored entry and reports an unknown id', async () => {
    const ctx = await harness()
    const record = await memoryOf(ctx).remember('temporary')

    expect(await memoryOf(ctx).forget(record.id)).toBe(true)
    expect(await memoryOf(ctx).list()).toEqual([])
    expect(await memoryOf(ctx).forget(record.id)).toBe(false)
    await ctx.fiber.dispose()
  })

  it('survives a restart over the same storage root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-memory-restart-'))
    roots.push(root)
    const first = await boot(root)
    await memoryOf(first).remember('persisted across restarts')
    await first.fiber.dispose()

    const second = await boot(root)
    expect((await memoryOf(second).list()).map(record => record.text)).toEqual(['persisted across restarts'])
    await second.fiber.dispose()
  })

  it('fails loudly on a corrupt store instead of reading it as empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lyn-memory-corrupt-'))
    roots.push(root)
    // A blank text is exactly what a silent read would turn into "no memories".
    writeFileSync(join(root, 'memory.json'), `${JSON.stringify({
      unit: { name: 'memory', version: 1 },
      global: null,
      tables: { entries: { bad: { text: '', scope: 'member', writtenAt: '2026-10-09T00:00:00.000Z' } } },
    }, null, 2)}\n`, 'utf8')

    const ctx = new Context()
    await ctx.plugin(Storage)
    await ctx.plugin(StorageJson, { root })
    await ctx.plugin(StorageDomain, { backend: 'json' })
    await ctx.plugin(SystemPrompt).await()
    await ctx.plugin(MemoryService, {}).await()
    await expect(memoryOf(ctx).list()).rejects.toThrow()
    // A write over the same corrupt store settles the serialisation chain
    // through its rejection path instead of leaving it pending at teardown.
    await expect(memoryOf(ctx).remember('ignored')).rejects.toThrow()
    await ctx.fiber.dispose()
  })
})

describe('the prompt contribution', () => {
  it('contributes nothing until a fact is written, then names each one', async () => {
    const ctx = await harness()
    const empty = await (ctx.get('systemPrompt') as SystemPrompt).assemble({})
    expect(JSON.stringify(empty)).not.toContain('Remembered about this workspace')

    await memoryOf(ctx).remember('Staging is rebuilt nightly')
    const filled = await (ctx.get('systemPrompt') as SystemPrompt).assemble({})
    expect(JSON.stringify(filled)).toContain('Staging is rebuilt nightly')
    await ctx.fiber.dispose()
  })

  it('renders an empty store as no text at all', () => {
    expect(renderEntries([])).toBe('')
  })

  it('renders one line per remembered fact', () => {
    const entries: readonly MemoryRecord[] = [
      { id: brandString<MemoryId>('a'), text: 'first', scope: 'member', writtenAt: '2026-10-09T00:00:00.000Z' },
      { id: brandString<MemoryId>('b'), text: 'second', scope: 'shared', writtenAt: '2026-10-09T00:00:01.000Z' },
    ]
    expect(renderEntries(entries)).toBe(
      'Remembered about this workspace and the people in it:\n- first\n- second',
    )
  })

  it('registers under one stable context name', async () => {
    const ctx = await harness()
    expect(MEMORY_CONTEXT_NAME).toBe('memory:remembered')
    await ctx.fiber.dispose()
  })
})

describe('the memory tools', () => {
  it('writes, lists, and forgets through the registered tools', async () => {
    const ctx = await harness()
    await ctx.plugin(MemoryTools)
    const run = async (name: string, args: Record<string, unknown>): Promise<string> => {
      const result = await (ctx.get('tools') as Tools).execute({
        signal: new AbortController().signal,
        callId: brandString<never>(`memory-${name}`),
        name,
        arguments: args,
      })
      return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
    }

    const written = await run('memory_write', { text: 'Release notes live in docs/' })
    expect(written).toMatch(/^Remembered as /)
    const listed = await run('memory_list', {})
    expect(listed).toContain('Release notes live in docs/')

    const id = (await memoryOf(ctx).list())[0]?.id ?? brandString<MemoryId>('missing')
    expect(await run('memory_forget', { id })).toBe(`Forgot ${id}.`)
    expect(await run('memory_forget', { id })).toBe(`No remembered fact carries the id ${id}.`)
    expect(await run('memory_list', {})).toBe('Nothing is remembered yet.')
    await ctx.fiber.dispose()
  })

  it('presents each registered call through the shared fold', async () => {
    const ctx = await harness()
    await ctx.plugin(MemoryTools)
    const tools = ctx.get('tools') as Tools

    expect(tools.get('memory_write')?.presentCall?.({ text: 'a fact' }))
      .toEqual({ card: 'generic', title: 'Remember a fact', kind: 'execute' })
    expect(tools.get('memory_list')?.presentCall?.({}))
      .toEqual({ card: 'generic', title: 'List remembered facts', kind: 'read' })
    expect(tools.get('memory_forget')?.presentCall?.({ id: 'abc' }))
      .toEqual({ card: 'generic', title: 'Forget abc', kind: 'execute' })
    await ctx.fiber.dispose()
  })

  it('renders an empty list as a statement rather than blank output', () => {
    expect(renderRecords([])).toBe('Nothing is remembered yet.')
  })

  it('renders each record as an id and its text', () => {
    const records: readonly MemoryRecord[] = [
      { id: brandString<MemoryId>('x'), text: 'kept', scope: 'member', writtenAt: '2026-10-09T00:00:00.000Z' },
    ]
    expect(renderRecords(records)).toBe('x\tkept')
  })
})

describe('the resolved configuration', () => {
  it('applies both defaults for a config that names neither', () => {
    expect(resolveConfig({})).toEqual({ maxEntries: 200, contextOrder: 130 })
  })

  it('keeps every value a caller named', () => {
    expect(resolveConfig({ maxEntries: 7, contextOrder: 42 })).toEqual({ maxEntries: 7, contextOrder: 42 })
  })
})

describe('the call presentation', () => {
  it('titles a write by the remembered text and a forget by the id', () => {
    expect(memoryCallCard('memory_write', { text: 'a fact' }))
      .toEqual({ card: 'generic', title: 'Remember a fact', kind: 'execute' })
    expect(memoryCallCard('memory_forget', { id: 'abc' }))
      .toEqual({ card: 'generic', title: 'Forget abc', kind: 'execute' })
  })

  it('titles a list as a read and tolerates absent arguments', () => {
    expect(memoryCallCard('memory_list', {}))
      .toEqual({ card: 'generic', title: 'List remembered facts', kind: 'read' })
    expect(memoryCallCard('memory_write', {}).title).toBe('Remember ')
    expect(memoryCallCard('memory_forget', {}).title).toBe('Forget ')
  })
})
