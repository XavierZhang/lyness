/**
 * Wire vocabulary of the personal memory surface.
 * @module @lyness/lyn-api-memory-controller/types
 */

/** One remembered fact, as a person's own page shows it. */
export interface MemoryEntryView {
  /** The entry's opaque identity, which a removal names. */
  readonly id: string
  /** The remembered text, exactly as it was written. */
  readonly text: string
  /** When it was written, as a UTC instant. */
  readonly writtenAt: string
}

/** What one person's memory page reads. */
export interface MemoriesView {
  /**
   * Whether this caller has memories of their own to read.
   *
   * False is the call that speaks for nobody: a deployment with accounts
   * reached without an identity. The page says so instead of showing an
   * empty list that would read as "nothing is remembered about you".
   */
  readonly owned: boolean
  /** This caller's own entries, oldest first. */
  readonly entries: readonly MemoryEntryView[]
}
