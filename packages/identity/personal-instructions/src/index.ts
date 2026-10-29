/**
 * What a person tells their own agents, kept for them and recorded on every
 * session they open.
 *
 * A deployment's persona and an organization's rules both have a place to
 * live; the person between them had none. On the desktop a workspace file
 * serves that purpose, but a hosted person has no file to edit, and the three
 * product shapes each have to be served — so the text is stored for the
 * person instead, and the file chain stays what it is for a workspace.
 *
 * The record is written into each session's own log at creation and composed
 * into the prompt from that record rather than from the store. Two halves of
 * one fact: anything that reaches a model request has to be reconstructable
 * from the session log, and reading the store at assembly time would mean a
 * person editing their instructions changed what a running conversation had
 * already said.
 *
 * Whose instructions a session carries comes from the principal that created
 * it. A deployment with no accounts mounts no principal and has one operator,
 * so its sessions carry that operator's; a deployment with accounts carries
 * the signed-in person's, and a session nobody opened — a CLI run, a
 * subagent, an inbound webhook — carries none rather than somebody else's.
 *
 * @module @lyness/lyn-personal-instructions
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import * as zod from 'zod'
import { brandString } from '@lyness/lyn-brand'
import { composePerAgent } from '@lyness/lyn-agent'
import type { Domain } from '@lyness/lyn-storage-domain'
import { storedId, storedInstant } from '@lyness/lyn-storage-domain'
import type { Session, SessionEvent } from '@lyness/lyn-session'
import type { ProjectionDefinition } from '@lyness/lyn-session-projection'
import type { PersonId } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-request-principal'
import type {} from '@lyness/lyn-system-prompt'
import { MAX_INSTRUCTIONS_CHARS, personalInstructionsDomain } from './storage.ts'
import { composeInstructions } from './prompt.ts'
import { PERSONAL_INSTRUCTIONS_RECORD_VERSION } from './types.ts'
import type { InstructionsEntry, InstructionsOwnerId, PersonalInstructionsRecord } from './types.ts'

export { MAX_INSTRUCTIONS_CHARS, instructionsEntrySchema, personalInstructionsDomain } from './storage.ts'
export { PERSON_INSTRUCTIONS_SECTION, composeInstructions, instructionsText } from './prompt.ts'
export { PERSONAL_INSTRUCTIONS_RECORD_VERSION } from './types.ts'
export type { InstructionsEntry, InstructionsOwnerId, PersonalInstructionsRecord } from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** What each person told their own agents, and the sessions it was recorded on. */
    personalInstructions: PersonalInstructions
  }
}

declare module '@lyness/lyn-session/types' {
  interface SessionEventMap {
    /**
     * Records the instructions this session's own person had written when it
     * was created, verbatim. Durable, log-only: the text reaches the model
     * through the assembled system prompt, and this record is what lets a
     * later reader reconstruct what that prompt said.
     *
     * @param version - format of the record.
     * @param owner - whose instructions these are.
     * @param text - the instructions, verbatim; empty when the person had written none.
     * @param writtenAt - when the recorded text was last saved; absent when there was none.
     * @lynScopeScan unsupported
     */
    'person/instructions': PersonalInstructionsRecord
  }
}

declare module '@lyness/lyn-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The instructions this session was created with, or null before the record is written. */
    personInstructions: PersonalInstructionsRecord | null
  }
}

/**
 * The owner key a deployment with no accounts stores under.
 *
 * It is reached only when no principal service is mounted at all, which is
 * the single-operator shape. A deployment that has accounts never writes or
 * reads it, so one installation's sole operator can never be confused with
 * another installation's signed-in person.
 */
export const SOLE_OPERATOR = brandString<InstructionsOwnerId>('sole-operator')

/** The projection's stored state, for a reader validating what it folds back. */
export const personalInstructionsRecordSchema: zod.ZodType<PersonalInstructionsRecord | null> = zod.object({
  version: zod.number(),
  owner: storedId<InstructionsOwnerId>(),
  text: zod.string(),
  writtenAt: storedInstant().optional(),
}).strict().nullable()

/**
 * Fold the instructions record out of a session's log.
 * @param state - the record folded so far.
 * @param event - the next event.
 * @returns the record this session was created with.
 */
export function applyInstructionsEvent(
  state: PersonalInstructionsRecord | null,
  event: SessionEvent,
): PersonalInstructionsRecord | null {
  return event.type === 'person/instructions' ? event.data : state
}

/** What a conversation's own person had told their agents, folded from its log. */
export const personalInstructionsProjectionDefinition = {
  key: 'personInstructions',
  stateVersion: 1,
  stateSchema: personalInstructionsRecordSchema,
  init: () => null,
  apply: applyInstructionsEvent,
} satisfies ProjectionDefinition<'personInstructions', PersonalInstructionsRecord | null>

/** Deployment-owned ceiling on what one person may store. */
export interface Config {
  /**
   * Largest text one person may save, in UTF-16 code units. Defaults to
   * {@link MAX_INSTRUCTIONS_CHARS}, which the store accepts at most.
   */
  maxChars?: number
}

export const Config: z<Config> = z.object({
  maxChars: z.number().step(1).min(1).max(MAX_INSTRUCTIONS_CHARS).default(MAX_INSTRUCTIONS_CHARS),
})

/** Resolved configuration, with every default already applied. */
export interface ResolvedConfig {
  /** Largest text one person may save, in UTF-16 code units. */
  readonly maxChars: number
}

/**
 * Apply the defaults for a config a caller supplied without the Loader's
 * schema validation.
 * @param config - validated or hand-built configuration.
 * @returns the values this plugin runs on.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return { maxChars: config.maxChars ?? MAX_INSTRUCTIONS_CHARS }
}

/** What each person told their own agents. */
export class PersonalInstructions extends Service {
  /** Largest text this deployment accepts, in UTF-16 code units. */
  readonly maxChars: number
  /**
   * Settles once the domain is open. The session stamp awaits it before it
   * subscribes, so every later read of a stored record is synchronous: the
   * stamp runs on the microtask after a creation announcement and has no tick
   * to spend on storage.
   */
  readonly ready: Promise<void>
  private domain: Domain<typeof personalInstructionsDomain> | undefined
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - the providing plugin's context, whose durable storage holds the domain.
   * @param maxChars - largest text this deployment accepts.
   */
  constructor(ctx: Context, maxChars: number) {
    super(ctx, 'personalInstructions')
    this.maxChars = maxChars
    const opened = ctx.storageDomain.open(personalInstructionsDomain)
    this.ready = opened.then((domain) => { this.domain = domain })
    ctx.effect(() => async () => {
      await this.chain // The chain carries failures back to their own callers.
      await (await opened).close()
    })
  }

  /** The open domain, or a loud failure naming the call that ran too early. */
  private opened(): Domain<typeof personalInstructionsDomain> {
    const domain = this.domain
    /* v8 ignore next -- every caller awaits `ready` first; this names a broken
       order rather than answering as though the store were empty. */
    if (domain === undefined) throw new Error('personal-instructions: the store is not open yet')
    return domain
  }

  /**
   * The owner key whose instructions this call acts on.
   *
   * A deployment that mounts no principal service has one operator and no
   * person to name, so it stores under {@link SOLE_OPERATOR}. One that mounts
   * the service names the signed-in person, and answers undefined for a call
   * that presented no identity rather than falling back to a shared record.
   * @returns the key, or undefined when this call speaks for nobody.
   */
  ownerOfCall(): InstructionsOwnerId | undefined {
    const principal = this.ctx.get('requestPrincipal')
    if (principal === undefined) return SOLE_OPERATOR
    const current = principal.current()
    return current === undefined ? undefined : ownerOfPerson(current.person)
  }

  /**
   * Read one owner's instructions.
   *
   * Synchronous, because the domain holds its records in memory once open and
   * the session stamp has no tick to wait: callers await {@link ready} once
   * and read directly afterwards.
   * @param owner - whose instructions to read.
   * @returns the stored entry, or undefined when that owner has written none.
   * @throws {Error} when called before {@link ready} has settled.
   */
  get(owner: InstructionsOwnerId): InstructionsEntry | undefined {
    return this.opened().table('instructions').get(owner)
  }

  /**
   * Replace one owner's instructions.
   *
   * Blank text removes the record rather than storing an empty one: a person
   * clearing what they wrote is asking for no instructions, and a stored
   * empty string would be a record saying they wrote nothing.
   * @param owner - whose instructions to write.
   * @param text - the new instructions; blank removes them.
   * @returns the stored entry, or undefined when the text was blank.
   * @throws {TypeError} when the text is longer than this deployment accepts.
   */
  async save(owner: InstructionsOwnerId, text: string): Promise<InstructionsEntry | undefined> {
    const trimmed = text.trim()
    if (trimmed.length > this.maxChars) {
      throw new TypeError(`personal-instructions: text must be at most ${String(this.maxChars)} characters`)
    }
    const result = this.ready.then(async () => {
      const table = this.opened().table('instructions')
      if (trimmed === '') {
        await table.delete(owner)
        return undefined
      }
      const entry: InstructionsEntry = { text: trimmed, writtenAt: new Date().toISOString() }
      await table.put(owner, entry)
      return entry
    })
    this.chain = result.catch(() => undefined)
    return result
  }
}

/**
 * The owner key one person stores under.
 * @param person - the person the directory knows.
 * @returns their owner key.
 */
export function ownerOfPerson(person: PersonId): InstructionsOwnerId {
  return brandString<InstructionsOwnerId>(`person:${String(person)}`)
}

/** Stable Cordis plugin name. */
export const name = 'personal-instructions'

/**
 * Durable storage, the sessions this plugin stamps, the agents and prompt
 * registry it composes through, and the fold that reads the stamp back.
 */
export const inject = ['agents', 'sessionProjections', 'sessions', 'storageDomain', 'systemPrompt']

/**
 * Provide the store, stamp every session with its person's instructions, and
 * compose each session's own record into its agents' prompts.
 * @param ctx - plugin context carrying storage, sessions, agents and the projection registry.
 * @param config - the validated plugin config.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const service = new PersonalInstructions(ctx, resolveConfig(config).maxChars)
  // Awaited before anything subscribes, so the stamp reads a stored record
  // without spending the tick it does not have.
  await service.ready
  const projection = await ctx.sessionProjections.register(personalInstructionsProjectionDefinition)

  const stamp = (session: Session): void => {
    if (projection.stateOf(session) !== null) return
    // Read at stamp time: whichever principal is published when the session
    // is created is the person whose instructions it runs under.
    const owner = service.ownerOfCall()
    // A session nobody opened carries no record rather than somebody else's
    // instructions; nothing is composed, and the log says so by holding no
    // event.
    if (owner === undefined) return
    const entry = service.get(owner)
    // Stamped even when they have written none: the record is what a later
    // reader checks to know the session ran with no instructions, rather than
    // that nothing was ever asked.
    session.append('person/instructions', {
      version: PERSONAL_INSTRUCTIONS_RECORD_VERSION,
      owner,
      text: entry?.text ?? '',
      ...entry === undefined ? {} : { writtenAt: entry.writtenAt },
    })
  }
  // `session/created` is a read-only announcement: an append inside it is
  // refused, and a synchronous throw there vetoes the creation outright. The
  // stamp therefore runs after it, the way session ownership's does.
  ctx.on('session/created', (session) => { queueMicrotask(() => { stamp(session) }) })
  for (const session of ctx.sessions.list()) stamp(session)

  // Composed on each agent's own context, which is what puts the section in
  // that agent's scope: one person's instructions are never assembled into
  // another's conversation. A session nobody opened carries no record, and
  // contributes nothing.
  composePerAgent(ctx, (agent) => {
    const record = projection.stateOf(agent.session)
    return record === null ? undefined : composeInstructions(agent.ctx, record)
  })
}
