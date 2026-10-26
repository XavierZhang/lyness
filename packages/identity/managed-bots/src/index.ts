/**
 * The bots a deployment's administrators maintain at runtime.
 *
 * A bot is an entry in the organization's roster rather than an object inside
 * a process: it belongs to one organization, holds a standing, and owns the
 * conversations it opens, so attribution, visibility and metering reach it
 * without a second mechanism. What it is not is a subject any directory can
 * authenticate, which is why the roster registers it and the admission table
 * refuses it.
 *
 * Both halves coexist as they do for people, and the written half wins: a bot
 * composition wrote cannot be changed here, because the next boot would bring
 * the written one back and the surface would have lied.
 *
 * @module @lyness/lyn-managed-bots
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import { brandString } from '@lyness/lyn-brand'
import { administers } from '@lyness/lyn-people'
import type { Membership, PersonId, Role } from '@lyness/lyn-people'
import { standingOf } from '@lyness/lyn-managed-people'
import type {} from '@lyness/lyn-agent-preset-registry'
import { randomUUID } from '@lyness/lyn-util-crypto'
import type { Domain } from '@lyness/lyn-storage-domain'
import { managedBotsDomain } from './storage.ts'
import { botProjectionDefinition, composeBotPersona } from './session.ts'
import type { EngagedBot } from './session.ts'
import type {
  BotRecord, BotSubmission, BotView, DeclaredBot, DeclaredTeam, PresetOption,
  TeammateView, TeamRecord, TeamSubmission, TeamView,
} from './types.ts'

export type * from './types.ts'
export { managedBotsDomain, botSchema, teamSchema } from './storage.ts'
export { BOT_PERSONA_SECTION, botProjectionDefinition, composeBotPersona } from './session.ts'
export type { EngagedBot } from './session.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** The bots administrators maintain at runtime; absent where a deployment maintains none. */
    managedBots: ManagedBots
  }
}

/**
 * The standing every bot holds.
 *
 * Fixed rather than chosen. A bot's persona is free text written by a tenant
 * administrator, and a bot that administered anything would be a bot that
 * could be talked into adding a person or changing a standing. Nothing a
 * deployment gains from an administrator bot is worth that.
 */
export const BOT_ROLE: Role = 'member'

/** Message an unauthorized administrator attempt is refused with. */
export const NOT_PERMITTED = 'managed-bots: this standing may not make that change'

/** Message a change to a composition-written bot is refused with. */
export const WRITTEN = 'managed-bots: the installation\'s configuration owns that bot'

/** Message a bot naming a preset this deployment does not offer is refused with. */
export const UNKNOWN_PRESET = 'managed-bots: this deployment offers no such agent preset'

/** Message a bot naming no organization is refused with. */
export const ORGANIZATION_REQUIRED = 'managed-bots: a bot belongs to exactly one organization'

/** Message an attempt to speak as a bot from another organization is refused with. */
export const NOT_YOURS = 'managed-bots: that bot belongs to another organization'

/** Message a team naming a bot its organization does not hold is refused with. */
export const UNKNOWN_BOT = 'managed-bots: a team holds only its own organization\'s bots'

/**
 * Why one bot change was refused.
 *
 * A closed set rather than a message to read: the surface reporting it marks
 * one field, disables one row, or says the standing is wrong, and deciding
 * which by matching prose would break the moment the prose changed.
 */
export type BotRefusal =
  | 'not-permitted'
  | 'written'
  | 'unknown-preset'
  | 'organization-required'
  | 'unknown-bot'
  | 'not-yours'

/** A bot change this service refused, carrying the reason it refused. */
export class BotsRefusedError extends Error {
  /** Which rule refused it. */
  readonly reason: BotRefusal

  /**
   * @param reason - which rule refused it.
   * @param message - what went wrong, in words an administrator can act on.
   */
  constructor(reason: BotRefusal, message: string) {
    super(message)
    this.name = 'BotsRefusedError'
    this.reason = reason
  }
}

/** The bots this deployment stores, and the written ones they may not shadow. */
export class ManagedBots extends Service {
  static inject = ['storageDomain', 'managedPeople', 'agentPresets', 'sessionProjections']

  private readonly ready: Promise<Domain<typeof managedBotsDomain>>

  private readonly written = new Map<PersonId, DeclaredBot>()

  private readonly writtenTeams = new Map<string, DeclaredTeam>()

  /** Roster registrations this service holds, one per bot it answers for. */
  private readonly rostered = new Map<PersonId, () => void>()

  /**
   * @param ctx - context providing durable storage and the roster.
   */
  constructor(ctx: Context) {
    super(ctx, 'managedBots')
    this.ready = ctx.storageDomain.open(managedBotsDomain)
    ctx.sessionProjections.register(botProjectionDefinition)
    ctx.effect(() => async () => {
      for (const withdraw of this.rostered.values()) withdraw()
      this.rostered.clear()
      await (await this.ready).close()
    })
  }

  /**
   * Put the stored bots in the roster before this service is usable.
   *
   * In the init hook rather than left running from the constructor because a
   * caller that has the service must be able to resolve the owner of a
   * conversation a bot opened; a roster filling in the background would
   * answer `undefined` for the first readers after every restart.
   * @returns once every stored bot is in the roster.
   */
  async [Service.init](): Promise<void> {
    const domain = await this.ready
    for (const [, record] of domain.table('bots').entries()) this.enrol(record)
  }

  /**
   * Declare one bot composition wrote.
   *
   * The provider that read the roster registers it, so this service can
   * refuse to shadow it and a surface can show it as the operator's.
   * @param entry - the bot, as composition names it.
   * @returns the disposer that withdraws it.
   */
  declareBot(entry: DeclaredBot): () => void {
    this.written.set(entry.id, entry)
    const withdraw = this.enrol(entry)
    return () => {
      this.written.delete(entry.id)
      withdraw()
      this.rostered.delete(entry.id)
    }
  }

  /**
   * Declare one team composition wrote.
   * @param entry - the team, as composition names it.
   * @returns the disposer that withdraws it.
   */
  declareTeam(entry: DeclaredTeam): () => void {
    this.writtenTeams.set(entry.id, entry)
    return () => { this.writtenTeams.delete(entry.id) }
  }

  /**
   * The teams one standing administers, written and stored alike.
   * @param by - the standing asking.
   * @returns the teams it administers, written ones first, then oldest stored first.
   */
  async teams(by: Membership): Promise<readonly TeamView[]> {
    const domain = await this.ready
    const views: TeamView[] = []
    for (const entry of this.writtenTeams.values()) {
      if (administers(by, entry.organization)) views.push({ ...entry, written: true })
    }
    for (const [, record] of domain.table('teams').entries()) {
      if (administers(by, record.organization)) {
        views.push({
          id: record.id,
          displayName: record.displayName,
          organization: record.organization,
          members: record.members,
          written: false,
        })
      }
    }
    return views
  }

  /**
   * Add one team, or change one this service holds.
   * @param submission - what the administrator filled in.
   * @param by - the standing making the change.
   * @returns the team as it now reads.
   * @throws {BotsRefusedError} when the standing may not make the change,
   * composition owns the team, or a member is not its organization's bot.
   */
  async saveTeam(submission: TeamSubmission, by: Membership): Promise<TeamView> {
    if (submission.organization.length === 0) {
      throw new BotsRefusedError('organization-required', ORGANIZATION_REQUIRED)
    }
    if (!administers(by, submission.organization)) throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    if (submission.id !== undefined && this.writtenTeams.has(submission.id)) {
      throw new BotsRefusedError('written', WRITTEN)
    }
    const domain = await this.ready
    const existing = submission.id === undefined ? undefined : domain.table('teams').get(submission.id)
    if (existing !== undefined && !administers(by, existing.organization)) {
      throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    }
    // Membership is what grants one bot the right to ask another, so a team
    // holding a bot from elsewhere would hand that right across an
    // organization boundary. Every member is checked against the team's own
    // organization, not the caller's.
    for (const member of submission.members) {
      const bot = this.written.get(member) ?? domain.table('bots').get(member)
      if (bot === undefined || bot.organization !== submission.organization) {
        throw new BotsRefusedError('unknown-bot', UNKNOWN_BOT)
      }
    }
    const record: TeamRecord = {
      id: existing?.id ?? randomUUID(),
      displayName: submission.displayName,
      organization: submission.organization,
      members: [...submission.members],
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      addedBy: existing?.addedBy ?? by.person,
    }
    await domain.table('teams').put(record.id, record)
    return {
      id: record.id,
      displayName: record.displayName,
      organization: record.organization,
      members: record.members,
      written: false,
    }
  }

  /**
   * Remove one team this service holds.
   *
   * The bots stay; what goes is the relation that let them ask each other.
   * @param id - the team to remove.
   * @param by - the standing making the change.
   * @throws {BotsRefusedError} when the standing may not remove it, or composition owns it.
   */
  async removeTeam(id: string, by: Membership): Promise<void> {
    if (this.writtenTeams.has(id)) throw new BotsRefusedError('written', WRITTEN)
    const domain = await this.ready
    const existing = domain.table('teams').get(id)
    if (existing === undefined) return
    if (!administers(by, existing.organization)) throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    await domain.table('teams').delete(id)
  }

  /**
   * The teammates one bot may ask.
   *
   * Shared team membership and nothing else: two bots in one organization
   * that share no team are not teammates, because the relation an
   * administrator wrote is the only thing that grants the right to ask.
   *
   * A bot in two teams with the same colleague reads that colleague once. The
   * job and character come from the colleague's own record rather than from
   * the team, so what a bot is for does not change with the company it is in.
   * @param bot - the bot asking.
   * @returns its teammates, each once, in team order then member order.
   */
  async teammates(bot: PersonId): Promise<readonly TeammateView[]> {
    const domain = await this.ready
    const teams = [
      ...[...this.writtenTeams.values()].map(entry => entry.members),
      ...[...domain.table('teams').entries()].map(([, record]) => record.members),
    ]
    const seen = new Set<PersonId>([bot])
    const views: TeammateView[] = []
    for (const members of teams) {
      if (!members.includes(bot)) continue
      for (const member of members) {
        if (seen.has(member)) continue
        seen.add(member)
        const entry = this.written.get(member) ?? domain.table('bots').get(member)
        // A team outlives a bot an administrator removed; a member nothing
        // answers for is not a teammate anybody can ask.
        if (entry === undefined) continue
        views.push({
          id: entry.id,
          displayName: entry.displayName,
          job: entry.job,
          persona: entry.persona,
          preset: entry.preset,
        })
      }
    }
    return views
  }

  /**
   * The bots one standing administers, written and stored alike.
   * @param by - the standing asking.
   * @returns the bots it administers, written ones first, then oldest stored first.
   */
  async list(by: Membership): Promise<readonly BotView[]> {
    const domain = await this.ready
    const offered = await this.presets()
    const views: BotView[] = []
    for (const entry of this.written.values()) {
      if (administers(by, entry.organization)) views.push(view(entry, true, offered))
    }
    for (const [, record] of domain.table('bots').entries()) {
      if (administers(by, record.organization)) views.push(view(record, false, offered))
    }
    return views
  }

  /**
   * The agent presets a bot may be given.
   *
   * Answered here rather than read from the preset registry by each caller,
   * because this is the list {@link save} validates against: a surface
   * offering one list while the service checked another would refuse a
   * choice it had just presented.
   * @returns the presets on offer, in the registry's own order; a preset that
   *   cannot compose a session is left out.
   */
  async offers(): Promise<readonly PresetOption[]> {
    return (await this.ctx.agentPresets.list())
      .filter(preset => preset.broken === undefined)
      .map(preset => ({
        id: preset.id,
        ...preset.name === undefined ? {} : { displayName: preset.name },
        ...preset.description === undefined ? {} : { description: preset.description },
      }))
  }

  /**
   * What one bot runs as, for a session about to speak as it.
   *
   * The character is read here and written into the session's own log by the
   * caller, never looked up again on resume: an administrator who rewrites a
   * bot's character changes what it says next, and must not change what it
   * already said.
   *
   * A bot belongs to one organization, and speaking as it is reaching that
   * organization's work. The standing asking has to hold a place in that
   * organization — knowing a bot's id is not permission to be it.
   * @param id - the bot to engage.
   * @param by - the standing the call acts in.
   * @returns the preset it runs with and the character to record, or undefined when no such bot exists.
   * @throws {BotsRefusedError} when that standing belongs to another organization.
   */
  async engage(id: PersonId, by: Membership): Promise<{ preset: string; engaged: EngagedBot } | undefined> {
    const entry = this.written.get(id) ?? (await this.ready).table('bots').get(id)
    if (entry === undefined) return undefined
    // Not `administers`: an ordinary member of that organization may talk to
    // its bots, and a platform standing reaches every organization.
    const inside = by.role === 'platform-administrator' || by.organization === entry.organization
    if (!inside) throw new BotsRefusedError('not-yours', NOT_YOURS)
    return {
      preset: entry.preset,
      engaged: { bot: entry.id, displayName: entry.displayName, persona: entry.persona },
    }
  }

  /**
   * Put one bot's character into an agent's prompt.
   *
   * Offered on the service so a caller composing a session reaches it
   * through the roster rather than importing this package: a deployment
   * without bots has no roster, and nothing on the session path should have
   * to carry code for one.
   * @param agentCtx - the agent scope the bot runs in, after its preset mounted.
   * @param engaged - the bot and the character its own log records.
   * @returns the disposer that withdraws the section.
   */
  compose(agentCtx: Context, engaged: EngagedBot): () => void {
    return composeBotPersona(agentCtx, engaged)
  }

  /**
   * Add one bot, or change one this service holds.
   * @param submission - what the administrator filled in.
   * @param by - the standing making the change.
   * @returns the bot as it now reads.
   * @throws {BotsRefusedError} when the standing may not make the change, composition owns the bot, or no such preset is offered.
   */
  async save(submission: BotSubmission, by: Membership): Promise<BotView> {
    if (submission.organization.length === 0) {
      throw new BotsRefusedError('organization-required', ORGANIZATION_REQUIRED)
    }
    if (!administers(by, submission.organization)) throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    if (submission.id !== undefined && this.written.has(submission.id)) {
      throw new BotsRefusedError('written', WRITTEN)
    }
    const domain = await this.ready
    const existing = submission.id === undefined ? undefined : domain.table('bots').get(submission.id)
    // A change is authorized against what is stored as well as against what
    // was submitted: otherwise one tenant's administrator could take another
    // tenant's bot by naming its id with their own organization.
    if (existing !== undefined && !administers(by, existing.organization)) {
      throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    }
    const offered = await this.presets()
    // Selected, never written: a preset name this deployment does not offer
    // is a bot that cannot run, and accepting it would report a character
    // nobody can talk to.
    if (!offered.has(submission.preset)) throw new BotsRefusedError('unknown-preset', UNKNOWN_PRESET)
    const record: BotRecord = {
      id: existing?.id ?? brandString<PersonId>(randomUUID()),
      displayName: submission.displayName,
      organization: submission.organization,
      persona: submission.persona,
      job: submission.job,
      preset: submission.preset,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      addedBy: existing?.addedBy ?? by.person,
    }
    await domain.table('bots').put(record.id, record)
    this.rostered.get(record.id)?.()
    this.enrol(record)
    return view(record, false, offered)
  }

  /**
   * Remove one bot this service holds.
   *
   * Its identity is not reused, so the conversations it opened stay
   * attributed to a bot that no longer runs rather than to whichever one is
   * added next.
   * @param id - the bot to remove.
   * @param by - the standing making the change.
   * @throws {BotsRefusedError} when the standing may not remove it, or composition owns it.
   */
  async remove(id: PersonId, by: Membership): Promise<void> {
    if (this.written.has(id)) throw new BotsRefusedError('written', WRITTEN)
    const domain = await this.ready
    const existing = domain.table('bots').get(id)
    if (existing === undefined) return
    if (!administers(by, existing.organization)) throw new BotsRefusedError('not-permitted', NOT_PERMITTED)
    await domain.table('bots').delete(id)
    this.rostered.get(id)?.()
    this.rostered.delete(id)
  }

  /**
   * Put one bot in the roster, so every lookup answers it as a person.
   *
   * Registered here rather than stored as a person because the admission
   * table reads stored people: a bot the roster answers and the table cannot
   * reach is a bot that owns conversations and signs in nowhere.
   */
  private enrol(entry: DeclaredBot): () => void {
    const withdraw = this.ctx.managedPeople.declarePerson({
      person: { id: entry.id, displayName: entry.displayName },
      membership: { id: standingOf(entry.id), person: entry.id, organization: entry.organization, role: BOT_ROLE },
      kind: 'bot',
    })
    this.rostered.set(entry.id, withdraw)
    return withdraw
  }

  /**
   * The preset ids a bot may name, as a lookup.
   *
   * The registry is a required injection rather than an optional lookup: a
   * bot's capabilities are the preset it runs with, so a deployment
   * registering no presets has nothing to give one and this service has no
   * business mounting there.
   */
  private async presets(): Promise<ReadonlySet<string>> {
    return new Set((await this.offers()).map(preset => preset.id))
  }
}

/** One bot as a surface shows it. */
function view(entry: DeclaredBot, written: boolean, offered: ReadonlySet<string>): BotView {
  return {
    id: entry.id,
    displayName: entry.displayName,
    organization: entry.organization,
    persona: entry.persona,
    job: entry.job,
    preset: entry.preset,
    written,
    available: offered.has(entry.preset),
  }
}

export default ManagedBots
