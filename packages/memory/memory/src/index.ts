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
import { MAX_ENTRY_CHARS, PERSONAL_TABLE, SHARED_TABLE, memoryDomain } from './storage.ts'
import { memoryOwnerOfPerson, personalKey, readPersonalKey } from './partition.ts'
import type { MemoryEntry, MemoryId, MemoryOwnerId, MemoryRecord, MemoryScope } from './types.ts'
import { ownerProjectionDefinition } from '@lyness/lyn-session-ownership/projection'
import type { SessionOwnerRecord } from '@lyness/lyn-session-ownership/types'
import type { ProjectionHandle } from '@lyness/lyn-session-projection'
import type { Agent } from '@lyness/lyn-agent'
import type { AssembleContext } from '@lyness/lyn-system-prompt'

export { MAX_ENTRY_CHARS, PERSONAL_TABLE, SHARED_TABLE, memoryDomain } from './storage.ts'
export { memoryOwnerOfPerson, personalKey, readPersonalKey } from './partition.ts'
export type {
  MemoryEntry, MemoryId, MemoryOwnerId, MemoryPartitionKey, MemoryRecord, MemoryScope,
} from './types.ts'

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

/**
 * Entries the prompt carries by default.
 *
 * Every retained entry in every request is what makes a memory store a token
 * cost that grows without a ceiling. The prompt carries the newest few and
 * says how many more exist; `memory_list` reads the rest when the agent needs
 * them. Recency is the right axis because retention already drops the oldest.
 */
const DEFAULT_PROMPT_ENTRIES = 12

/** Resolved retention and placement, with every default already applied. */
export interface ResolvedConfig {
  /** Entries retained before the oldest is dropped on write. */
  readonly maxEntries: number
  /** Runtime-context sort position. */
  readonly contextOrder: number
  /** Newest entries the prompt carries. */
  readonly promptEntries: number
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
    promptEntries: config.promptEntries ?? DEFAULT_PROMPT_ENTRIES,
  }
}

/** Deployment-owned retention and prompt placement. Invalid values fail plugin load. */
export interface Config {
  /** Entries retained before the oldest is dropped on write. Defaults to 200. */
  maxEntries?: number
  /** Runtime-context sort position. Defaults to 130, after the policy entries. */
  contextOrder?: number
  /** Newest entries the prompt carries; the rest are reachable through the tools. Defaults to 12. */
  promptEntries?: number
}

/** Durable memory with an explicit write path and a prompt contribution. */
export class MemoryService extends Service {
  /**
   * The projection registry and the agent registry join the storage and the
   * prompt because a memory now has an owner: which person an agent is
   * remembering for, and which person's entries one assembly may carry, both
   * come from the session's own ownership record.
   */
  static inject = ['agents', 'sessionProjections', 'storageDomain', 'systemPrompt']

  static Config: z<Config> = z.object({
    maxEntries: z.number().step(1).min(1).max(10_000).default(DEFAULT_MAX_ENTRIES),
    contextOrder: z.number().default(DEFAULT_CONTEXT_ORDER),
    promptEntries: z.number().step(1).min(1).max(1000).default(DEFAULT_PROMPT_ENTRIES),
  })

  private readonly maxEntries: number
  private readonly ready: Promise<Domain<typeof memoryDomain>>
  /** Snapshot the prompt provider reads; the domain remains the authority. */
  private entries: readonly MemoryRecord[] = []
  private chain: Promise<unknown> = Promise.resolve()
  /** Whose conversation one session is; absent until the registration settles. */
  private owners: ProjectionHandle<SessionOwnerRecord | null> | undefined

  /**
   * @param ctx - Host services owning durable storage and prompt assembly.
   * @param config - Validated retention and placement.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'memory')
    const resolved = resolveConfig(config)
    this.maxEntries = resolved.maxEntries
    this.ready = Promise.all([
      ctx.storageDomain.open(memoryDomain),
      // The same unit `session-ownership` registers: registrants share one
      // projection and are counted, so reading it here neither duplicates the
      // fold nor takes it away from the plugin that writes the record.
      ctx.sessionProjections.register(ownerProjectionDefinition),
    ]).then(([domain, owners]) => {
      this.owners = owners
      this.entries = readEntries(domain)
      return domain
    })
    ctx.effect(() => {
      const dispose = ctx.systemPrompt.context({
        name: MEMORY_CONTEXT_NAME,
        order: resolved.contextOrder,
        // Evaluated at every assembly, so a write lands in the next request
        // without rebuilding anything ahead of it in the prompt. The assembly
        // names its agent, so the entries it carries are that conversation's
        // own person's and the deployment's shared ones — never a third
        // person's.
        text: (assembling: AssembleContext) =>
          renderEntries(this.visibleTo(this.ownerOfAgent(assembling.agent)), resolved.promptEntries),
      })
      return async () => {
        dispose()
        await this.chain // The chain carries failures back to their own callers.
        await (await this.ready).close()
      }
    })
  }

  /**
   * Finish mounting only once the store is open and the ownership projection
   * is registered.
   *
   * Without it the first assembly of a process could precede the load and
   * contribute no memories at all — a prompt that silently omitted every
   * remembered fact rather than failing.
   * @returns when this service can answer a read.
   */
  protected async [Service.init](): Promise<void> {
    await this.ready
  }

  /**
   * Whose memories one agent's conversation may carry.
   *
   * The session's own ownership record answers it. A session nobody opened —
   * a CLI run, a subagent, an inbound webhook, or any session of a
   * deployment that mounts no accounts — has no owner, and its agent carries
   * the deployment's shared entries alone.
   * @param agent - the agent assembling a prompt, when the assembly names one.
   * @returns the owner partition to read, or undefined for a conversation with no owner.
   */
  private ownerOfAgent(agent: Agent | undefined): MemoryOwnerId | undefined {
    if (agent === undefined) return undefined
    const record = this.owners?.stateOf(agent.session)
    return record === null || record === undefined ? undefined : memoryOwnerOfPerson(record.owner)
  }

  /**
   * The entries one reader may see, oldest first.
   *
   * Shared entries, plus that owner's own. An entry written before this
   * deployment recorded owners is in the shared table and stays visible to
   * everybody, which is what it has always been.
   * @param owner - whose personal entries to include, when there is an owner.
   * @returns the visible records in write order.
   */
  private visibleTo(owner: MemoryOwnerId | undefined): readonly MemoryRecord[] {
    if (owner === undefined) return this.entries.filter(entry => entry.owner === undefined)
    return this.entries.filter(entry => entry.owner === undefined || entry.owner === owner)
  }

  /**
   * The partition the agent remembering something writes into.
   *
   * `shared` is the deployment's, so it needs no owner. A `member` write
   * belongs to the person whose conversation asked for it; a conversation
   * with no owner writes to the shared table, which is what a
   * single-operator deployment has always done.
   * @param scope - the reach the caller asked for.
   * @returns the owner partition, or undefined for the shared table.
   */
  private writeOwner(scope: MemoryScope): MemoryOwnerId | undefined {
    if (scope === 'shared') return undefined
    return this.ownerOfAgent(this.ctx.agents.currentInitiator())
  }

  /**
   * Keep one fact. The only write path: there is no listener that stores
   * anything a caller did not ask for.
   *
   * `supersedes` is how a remembered fact is corrected rather than
   * contradicted. A store that can only append ends up holding both halves of
   * a changed convention, and nothing in the text says which one is current;
   * replacing the superseded entry in the same durable write leaves exactly
   * one answer. An id that no longer exists is not an error — the fact it
   * named is already gone, which is the outcome the caller wanted.
   * @param text - the fact to keep, trimmed and non-empty.
   * @param scope - reach of the entry; defaults to the writing member.
   * @param supersedes - an entry this one replaces, removed in the same write.
   * @returns the stored record, including its new identity.
   * @throws {TypeError} when the text is blank or longer than {@link MAX_ENTRY_CHARS}.
   */
  async remember(text: string, scope: MemoryScope = 'member', supersedes?: MemoryId): Promise<MemoryRecord> {
    const trimmed = text.trim()
    if (trimmed === '') throw new TypeError('memory: text must not be blank')
    if (trimmed.length > MAX_ENTRY_CHARS) {
      throw new TypeError(`memory: text must be at most ${String(MAX_ENTRY_CHARS)} characters`)
    }
    return this.serialise(async (domain) => {
      // Read after the store is open, because the owner comes from the
      // ownership projection this service registers with it.
      const owner = this.writeOwner(scope)
      const id = brandString<MemoryId>(randomUUID())
      const entry: MemoryEntry = { text: trimmed, scope, writtenAt: new Date().toISOString() }
      if (supersedes !== undefined) await removeEntry(domain, this.entries, supersedes)
      await writeEntry(domain, owner, id, entry)
      // Retention drops the oldest first, so the newest fact always survives
      // its own write; the table's insertion order is the write order.
      for (const stale of readEntries(domain).slice(0, -this.maxEntries)) {
        await removeEntry(domain, readEntries(domain), stale.id)
      }
      this.entries = readEntries(domain)
      return { id, ...entry, ...owner === undefined ? {} : { owner } }
    })
  }

  /**
   * Read every fact this reader may see, oldest first.
   *
   * What the current conversation's agent may see, which is the deployment's
   * shared entries plus its own person's. The model-facing `memory_list` is
   * the caller this matters for: it must report exactly the facts the prompt
   * already carries, or an agent would be told about a fact it cannot act on.
   * @returns the visible records in write order.
   */
  async list(): Promise<readonly MemoryRecord[]> {
    await this.ready
    return this.visibleTo(this.ownerOfAgent(this.ctx.agents.currentInitiator()))
  }

  /**
   * Read one person's own facts, oldest first.
   *
   * Separate from {@link list} because the caller is different: a person
   * reading their own page is not inside a conversation, and the shared
   * entries are not theirs to review here.
   * @param owner - whose entries to read.
   * @returns that owner's records in write order.
   */
  async listOwnedBy(owner: MemoryOwnerId): Promise<readonly MemoryRecord[]> {
    await this.ready
    return this.entries.filter(entry => entry.owner === owner)
  }

  /**
   * Remove one of a person's own facts.
   *
   * The owner is a parameter here and the id is checked against it, so a
   * caller holding somebody else's id removes nothing.
   * @param owner - whose entry is being removed.
   * @param id - the entry's identity.
   * @returns true when that owner held an entry with that id.
   */
  async forgetOwnedBy(owner: MemoryOwnerId, id: MemoryId): Promise<boolean> {
    return this.serialise(async (domain) => {
      const key = personalKey(owner, id)
      const table = domain.table(PERSONAL_TABLE)
      if (table.get(key) === undefined) return false
      await table.delete(key)
      this.entries = readEntries(domain)
      return true
    })
  }

  /**
   * Remove one kept fact.
   * @param id - the record's identity.
   * @returns true when an entry was removed, false when none carried that id.
   */
  async forget(id: MemoryId): Promise<boolean> {
    const visible = this.visibleTo(this.ownerOfAgent(this.ctx.agents.currentInitiator()))
    return this.serialise(async (domain) => {
      const removed = await removeEntry(domain, visible, id)
      if (removed) this.entries = readEntries(domain)
      return removed
    })
  }

  /** Run one durable mutation after the previous one settles. */
  private serialise<T>(work: (domain: Domain<typeof memoryDomain>) => Promise<T>): Promise<T> {
    const result = this.ready.then(work)
    this.chain = result.catch(() => undefined)
    return result
  }
}

/**
 * Read both tables' entries in write order.
 *
 * The shared table first, so a deployment that never had owners keeps the
 * order it always had and its retention drops the same entry it used to.
 * @param domain - the open domain.
 * @returns every stored record, with the owner its key named.
 */
function readEntries(domain: Domain<typeof memoryDomain>): readonly MemoryRecord[] {
  const shared = [...domain.table(SHARED_TABLE).entries()]
    .map(([id, entry]): MemoryRecord => ({ id, ...entry }))
  const personal = [...domain.table(PERSONAL_TABLE).entries()].flatMap(([key, entry]): MemoryRecord[] => {
    const read = readPersonalKey(key)
    /* v8 ignore next -- only this package writes the personal table, and
       `personalKey` always produces a key `readPersonalKey` reads back. */
    if (read === undefined) return []
    return [{ id: read.id, owner: read.owner, ...entry }]
  })
  return [...shared, ...personal]
}

/**
 * Store one entry in the table its owner names.
 * @param domain - the open domain.
 * @param owner - whose entry it is; undefined writes the shared table.
 * @param id - the entry's identity.
 * @param entry - the record to store.
 */
async function writeEntry(
  domain: Domain<typeof memoryDomain>,
  owner: MemoryOwnerId | undefined,
  id: MemoryId,
  entry: MemoryEntry,
): Promise<void> {
  if (owner === undefined) await domain.table(SHARED_TABLE).put(id, entry)
  else await domain.table(PERSONAL_TABLE).put(personalKey(owner, id), entry)
}

/**
 * Remove one entry a reader may see, from whichever table holds it.
 *
 * The visible records decide which table to reach, so an id the reader may
 * not see removes nothing: in a deployment serving several people, one
 * person's agent cannot forget another person's fact by naming its id.
 * @param domain - the open domain.
 * @param visible - the records this caller may act on.
 * @param id - the entry's identity.
 * @returns true when an entry was removed.
 */
async function removeEntry(
  domain: Domain<typeof memoryDomain>,
  visible: readonly MemoryRecord[],
  id: MemoryId,
): Promise<boolean> {
  const found = visible.find(entry => entry.id === id)
  if (found === undefined) return false
  if (found.owner === undefined) await domain.table(SHARED_TABLE).delete(id)
  else await domain.table(PERSONAL_TABLE).delete(personalKey(found.owner, id))
  return true
}

/**
 * Render the remembered facts as runtime context, newest first and bounded.
 *
 * Carrying every retained entry in every request makes the store a token cost
 * with no ceiling, so the block holds `budget` of the newest and states how
 * many it withheld. The statement matters: without it the agent has no reason
 * to call `memory_list`, and a withheld fact reads as a fact that was never
 * written. An empty store contributes nothing, which keeps the prompt
 * byte-identical for a deployment that has never written a memory.
 * @param entries - stored records in write order.
 * @param budget - newest entries to include; at least one.
 * @returns the context text, or an empty string when nothing is kept.
 */
export function renderEntries(entries: readonly MemoryRecord[], budget: number): string {
  if (entries.length === 0) return ''
  const shown = entries.slice(-budget).reverse()
  const withheld = entries.length - shown.length
  const lines = shown.map(entry => `- ${entry.text}`)
  const tail = withheld === 0
    ? ''
    : `\n(${String(withheld)} older remembered ${withheld === 1 ? 'fact is' : 'facts are'} not shown here; `
      + 'read them with memory_list.)'
  return `Remembered about this workspace and the people in it, newest first:\n${lines.join('\n')}${tail}`
}

export default MemoryService
