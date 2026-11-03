/**
 * Which partition one memory belongs to, and how a key names it.
 *
 * Its own unit because two different callers must agree: an agent that
 * remembers something inside somebody's conversation, and that same person
 * reading the page afterwards. One function builds the owner key and one
 * builds the stored key, so the two paths cannot disagree about where a
 * memory lives.
 *
 * @module @lyness/lyn-memory/partition
 */

import { brandString } from '@lyness/lyn-brand'
import type { PersonId } from '@lyness/lyn-people'
import type { MemoryId, MemoryOwnerId, MemoryPartitionKey } from './types.ts'

/** Separator between the owner and the entry id inside a personal key. */
const SEPARATOR = '/'

/**
 * The partition one person's memories live in.
 * @param person - the person the directory knows.
 * @returns their owner key.
 */
export function memoryOwnerOfPerson(person: PersonId): MemoryOwnerId {
  return brandString<MemoryOwnerId>(`person:${String(person)}`)
}

/**
 * The stored key of one person's entry.
 * @param owner - whose entry it is.
 * @param id - the entry's own identity, which is what a reader is shown.
 * @returns the key inside the personal table.
 */
export function personalKey(owner: MemoryOwnerId, id: MemoryId): MemoryPartitionKey {
  return brandString<MemoryPartitionKey>(`${String(owner)}${SEPARATOR}${String(id)}`)
}

/**
 * Read one personal key back.
 *
 * A key that does not split into exactly an owner and an id is not one this
 * package wrote; the caller skips it rather than guessing an owner, because a
 * guessed owner would show one person another's memory.
 * @param key - the stored key.
 * @returns the owner and the entry id, or undefined when the key is not one of ours.
 */
export function readPersonalKey(key: MemoryPartitionKey): { owner: MemoryOwnerId; id: MemoryId } | undefined {
  const at = String(key).indexOf(SEPARATOR)
  if (at <= 0 || at === String(key).length - 1) return undefined
  return {
    owner: brandString<MemoryOwnerId>(String(key).slice(0, at)),
    id: brandString<MemoryId>(String(key).slice(at + 1)),
  }
}
