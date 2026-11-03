/**
 * Wire vocabulary of the personal-instructions surface.
 * @module @lyness/lyn-api-personal-instructions-controller/types
 */

/** What one person's own instructions page reads. */
export interface InstructionsView {
  /**
   * Whether this caller has instructions of their own to read and write.
   *
   * False is the call that speaks for nobody: a deployment with accounts
   * reached without an identity. The page says so instead of offering an
   * editor whose save would be refused.
   */
  readonly owned: boolean
  /** The instructions this caller has saved; the empty string when they have none. */
  readonly text: string
  /** When they were last saved, as a UTC instant; absent when none are saved. */
  readonly writtenAt?: string
  /** Largest text this deployment accepts, in UTF-16 code units. */
  readonly maxChars: number
}
