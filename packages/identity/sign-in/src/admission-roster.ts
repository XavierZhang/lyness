/**
 * Provider: admit only the directory identities an operator wrote down.
 *
 * This is the installation shape's answer. The system runs on one customer's
 * own servers for their own staff, and their administrator decides who those
 * are, so admission is a written list of directory identities mapped to the
 * people in the roster `people/static` already holds. Connecting a directory
 * must not, by itself, admit everyone in it.
 *
 * A hosted deployment mounts a different rule, because its people arrive by
 * signing up rather than by an administrator's edit.
 *
 * @module @deepseek-ai/dsh-sign-in/admission-roster
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { PersonId } from '@deepseek-ai/dsh-people'
import { SignInAdmission } from './admission.ts'
import type { ExternalSubject } from './types.ts'

/** One directory identity an operator admits, and who it is here. */
export interface BindingEntry {
  /** The channel that authenticates them. */
  channel: string
  /** The directory that channel reports, as it names it. */
  issuer: string
  /** Their stable identity within that directory. */
  subject: string
  /** The person in the roster they sign in as. */
  person: string
}

/** Operator-written admission list for an installation. */
export interface Config {
  /**
   * The directory identities this installation admits.
   *
   * Required, and an empty list admits nobody. That is the intended reading:
   * a connected directory with no bindings written yet must not sign anyone
   * in, because the alternative is a window in which the whole directory can.
   */
  bindings: BindingEntry[]
}

const BindingSchema: z<BindingEntry> = z.object({
  channel: z.string().required(),
  issuer: z.string().required(),
  subject: z.string().required(),
  person: z.string().required(),
})

export const Config: z<Config> = z.object({
  bindings: z.array(BindingSchema).required(),
})

/**
 * The key one binding is found by.
 *
 * All three parts, because each can repeat on its own: a subject is unique
 * only within its directory, and one directory reached through two channels is
 * two different trust paths even though it is one directory.
 * @param channel - the channel that authenticated them.
 * @param issuer - the directory that channel reported.
 * @param subject - their identity within it.
 * @returns the lookup key.
 */
export function bindingKey(channel: string, issuer: string, subject: string): string {
  return JSON.stringify([channel, issuer, subject])
}

/**
 * Index the written bindings, rejecting a directory identity written twice.
 *
 * Two rows for one identity is a composition mistake, not a precedence
 * question: whichever won would decide who someone signs in as, and an
 * operator reading their own file would have no way to tell which.
 * @param bindings - the operator-written rows.
 * @returns each identity's person, by lookup key.
 * @throws {Error} when two rows name the same directory identity.
 */
export function indexBindings(bindings: readonly BindingEntry[]): ReadonlyMap<string, PersonId> {
  const index = new Map<string, PersonId>()
  for (const entry of bindings) {
    const key = bindingKey(entry.channel, entry.issuer, entry.subject)
    if (index.has(key)) {
      throw new Error(`sign-in-admission-roster: "${entry.subject}" at "${entry.issuer}" is bound twice`)
    }
    index.set(key, brandString<PersonId>(entry.person))
  }
  return index
}

/** Admits the directory identities an operator wrote down, and no others. */
export class RosterAdmission extends SignInAdmission {
  static readonly Config = Config

  private readonly bound: ReadonlyMap<string, PersonId>

  /**
   * @param ctx - the context this rule serves.
   * @param config - the operator-written bindings.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.bound = indexBindings(config.bindings)
  }

  /**
   * The person a written binding names for this subject.
   * @param subject - the subject a channel verified.
   * @returns that person, or undefined when no binding names this identity.
   */
  admit(subject: ExternalSubject): Promise<PersonId | undefined> {
    const key = bindingKey(subject.channel, subject.issuer, subject.subject)
    return Promise.resolve(this.bound.get(key))
  }
}

export default RosterAdmission
