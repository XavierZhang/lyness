/**
 * Host Remote owner of the `memories` namespace: what this deployment
 * remembers about the caller, read and removed by that person alone.
 *
 * Whose memories a call acts on is never a parameter. The store answers it
 * from the principal the call published, and a removal is checked against
 * that same owner, so a caller holding somebody else's id removes nothing.
 *
 * The deployment's shared memories are not here. They are not one person's to
 * review, and a page that listed them beside somebody's own would invite a
 * removal that takes a fact away from everybody.
 *
 * @module @lyness/lyn-api-memory-controller
 */

import { Context } from '@lyness/cordis'
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { brandString } from '@lyness/lyn-brand'
import { memoryOwnerOfPerson } from '@lyness/lyn-memory'
import type { MemoryId, MemoryOwnerId } from '@lyness/lyn-memory'
import type {} from '@lyness/lyn-request-principal'
import type { MemoriesView, MemoryEntryView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `memories` Remote namespace. */
    memoryController: MemoryController
  }
}

/** Host service backing the generated `ctx.remote.memories` namespace. */
export default class MemoryController extends TypertRemoteService {
  static inject = ['memory']

  /**
   * Register the namespace.
   * @param ctx - Host context carrying the memory store.
   */
  constructor(ctx: Context) {
    super(ctx, 'memoryController', { namespace: 'memories', requires: 'member' })
  }

  /**
   * The owner whose memories this call acts on.
   *
   * A deployment that mounts no principal service has one operator and
   * attributes no memory to anybody, so it owns nothing here: its entries are
   * the deployment's, which this namespace deliberately does not serve.
   * @returns the owner, or undefined when the call speaks for nobody.
   */
  private owner(): MemoryOwnerId | undefined {
    const current = this.ctx.get('requestPrincipal')?.current()
    return current === undefined ? undefined : memoryOwnerOfPerson(current.person)
  }

  /**
   * Read what is remembered about this caller.
   * @returns their own entries, oldest first.
   */
  @Remote
  async list(): Promise<MemoriesView> {
    const owner = this.owner()
    if (owner === undefined) return { owned: false, entries: [] }
    const entries = await this.ctx.memory.listOwnedBy(owner)
    return {
      owned: true,
      entries: entries.map((entry): MemoryEntryView => ({
        id: String(entry.id),
        text: entry.text,
        writtenAt: entry.writtenAt,
      })),
    }
  }

  /**
   * Remove one of this caller's own memories.
   * @param id - the entry's identity, as a read reported it.
   * @returns what remains after the removal.
   * @throws {Error} when the call speaks for nobody.
   */
  @Remote
  async forget(id: string): Promise<MemoriesView> {
    const owner = this.owner()
    if (owner === undefined) throw new Error('memories: this call speaks for nobody')
    // The store checks the id against this owner, so an id belonging to
    // somebody else removes nothing and the read below says so.
    await this.ctx.memory.forgetOwnedBy(owner, brandString<MemoryId>(id))
    return this.list()
  }
}
