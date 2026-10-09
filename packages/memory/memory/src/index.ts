/**
 * Durable agent memory: facts a person or an agent explicitly asked to keep,
 * folded into every later request as runtime context.
 *
 * Writes are explicit only. Nothing here observes a transcript and decides
 * what is worth keeping, because a memory the customer never approved is one
 * they cannot audit. Stored text reaches the model through the system prompt,
 * so what the model saw stays reconstructable from the logged `system/message`
 * without a bespoke session event.
 *
 * @module @lyness/lyn-memory
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { brandString } from '@lyness/lyn-brand'
import { randomUUID } from '@lyness/lyn-util-crypto'
import type { Domain } from '@lyness/lyn-storage-domain'
import type {} from '@lyness/lyn-system-prompt'
import { MAX_ENTRY_CHARS, memoryDomain } from './storage.ts'
import type { MemoryEntry, MemoryId, MemoryRecord, MemoryScope } from './types.ts'

export { MAX_ENTRY_CHARS, memoryDomain } from './storage.ts'
export type { MemoryEntry, MemoryId, MemoryRecord, MemoryScope } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Durable facts kept across sessions, written only by an explicit call. */
    memory: MemoryService
  }
}

/** Name of the runtime-context entry this service contributes. */
export const MEMORY_CONTEXT_NAME = 'memory:remembered'

/** Default entries retained before the oldest is dropped. */
const DEFAULT_MAX_ENTRIES = 200

/** Default runtime-context position, after the centrally allocated policy entries. */
const DEFAULT_CONTEXT_ORDER = 130

/** Resolved retention and placement, with every default already applied. */
export interface ResolvedConfig {
  /** Entries retained before the oldest is dropped on write. */
  readonly maxEntries: number
  /** Runtime-context sort position. */
  readonly contextOrder: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the resolved values this service runs on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
    contextOrder: config.contextOrder ?? DEFAULT_CONTEXT_ORDER,
  }
}

/** Deployment-owned retention and prompt placement. Invalid values fail plugin load. */
export interface Config {
  /** Entries retained before the oldest is dropped on write. Defaults to 200. */
  maxEntries?: number
  /** Runtime-context sort position. Defaults to 130, after the policy entries. */
  contextOrder?: number
}

/** Durable memory with an explicit write path and a prompt contribution. */
export class MemoryService extends Service {
  static inject = ['storageDomain', 'systemPrompt']

  static Config: z<Config> = z.object({
    maxEntries: z.number().step(1).min(1).max(10_000).default(DEFAULT_MAX_ENTRIES),
    contextOrder: z.number().default(DEFAULT_CONTEXT_ORDER),
  })

  private readonly maxEntries: number
  private readonly ready: Promise<Domain<typeof memoryDomain>>
  /** Snapshot the prompt provider reads; the domain remains the authority. */
  private entries: readonly MemoryRecord[] = []
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - Host services owning durable storage and prompt assembly.
   * @param config - Validated retention and placement.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'memory')
    const resolved = resolveConfig(config)
    this.maxEntries = resolved.maxEntries
    this.ready = ctx.storageDomain.open(memoryDomain).then((domain) => {
      this.entries = readEntries(domain)
      return domain
    })
    ctx.effect(() => {
      const dispose = ctx.systemPrompt.context({
        name: MEMORY_CONTEXT_NAME,
        order: resolved.contextOrder,
        // Evaluated at every assembly, so a write lands in the next request
        // without rebuilding anything ahead of it in the prompt.
        text: () => renderEntries(this.entries),
      })
      return async () => {
        dispose()
        await this.chain // The chain carries failures back to their own callers.
        await (await this.ready).close()
      }
    })
  }

  /**
   * Keep one fact. The only write path: there is no listener that stores
   * anything a caller did not ask for.
   * @param text - the fact to keep, trimmed and non-empty.
   * @param scope - reach of the entry; defaults to the writing member.
   * @returns the stored record, including its new identity.
   * @throws {TypeError} when the text is blank or longer than {@link MAX_ENTRY_CHARS}.
   */
  async remember(text: string, scope: MemoryScope = 'member'): Promise<MemoryRecord> {
    const trimmed = text.trim()
    if (trimmed === '') throw new TypeError('memory: text must not be blank')
    if (trimmed.length > MAX_ENTRY_CHARS) {
      throw new TypeError(`memory: text must be at most ${String(MAX_ENTRY_CHARS)} characters`)
    }
    return this.serialise(async (domain) => {
      const id = brandString<MemoryId>(randomUUID())
      const entry: MemoryEntry = { text: trimmed, scope, writtenAt: new Date().toISOString() }
      const table = domain.table('entries')
      await table.put(id, entry)
      // Retention drops the oldest first, so the newest fact always survives
      // its own write; the table's insertion order is the write order.
      for (const stale of readEntries(domain).slice(0, -this.maxEntries)) await table.delete(stale.id)
      this.entries = readEntries(domain)
      return { id, ...entry }
    })
  }

  /**
   * Read every kept fact, oldest first.
   * @returns the stored records in write order.
   */
  async list(): Promise<readonly MemoryRecord[]> {
    await this.ready
    return this.entries
  }

  /**
   * Remove one kept fact.
   * @param id - the record's identity.
   * @returns true when an entry was removed, false when none carried that id.
   */
  async forget(id: MemoryId): Promise<boolean> {
    return this.serialise(async (domain) => {
      const table = domain.table('entries')
      if (table.get(id) === undefined) return false
      await table.delete(id)
      this.entries = readEntries(domain)
      return true
    })
  }

  /** Run one durable mutation after the previous one settles. */
  private serialise<T>(work: (domain: Domain<typeof memoryDomain>) => Promise<T>): Promise<T> {
    const result = this.ready.then(work)
    this.chain = result.catch(() => undefined)
    return result
  }
}

/** Read the domain's entries in write order. */
function readEntries(domain: Domain<typeof memoryDomain>): readonly MemoryRecord[] {
  return [...domain.table('entries').entries()].map(([id, entry]) => ({ id, ...entry }))
}

/**
 * Render the remembered facts as runtime context. An empty store contributes
 * nothing, which keeps the prompt byte-identical for a deployment that has
 * never written a memory.
 * @param entries - stored records in write order.
 * @returns the context text, or an empty string when nothing is kept.
 */
export function renderEntries(entries: readonly MemoryRecord[]): string {
  if (entries.length === 0) return ''
  const lines = entries.map(entry => `- ${entry.text}`)
  return `Remembered about this workspace and the people in it:\n${lines.join('\n')}`
}

export default MemoryService
