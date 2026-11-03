/**
 * Wire and storage vocabulary of a person's own instructions.
 * @module @lyness/lyn-personal-instructions/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** Whose instructions one stored record holds. */
export type InstructionsOwnerId = Branded<'InstructionsOwnerId'>

/** One person's instructions, as the store holds them. */
export interface InstructionsEntry {
  /** The instructions, verbatim as the person wrote them. */
  readonly text: string
  /** When they were last saved, as a UTC instant. */
  readonly writtenAt: string
}

/** Shape version of {@link PersonalInstructionsRecord}; a later field set changes it deliberately. */
export const PERSONAL_INSTRUCTIONS_RECORD_VERSION = 1

/** The instructions one session ran under, recorded in its own log. */
export interface PersonalInstructionsRecord {
  /** Shape version of this record. */
  readonly version: number
  /** Whose instructions these are. */
  readonly owner: InstructionsOwnerId
  /**
   * The instructions this session was created with, verbatim; the empty
   * string when the person had written none. Recorded rather than read from
   * the store at assembly time, so editing them never changes what a running
   * conversation already said.
   */
  readonly text: string
  /** When the recorded text was last saved; absent when there was none to record. */
  readonly writtenAt?: string | undefined
}
