/**
 * Host Remote owner of the `bots` namespace: administrators maintain which
 * bots their organization runs, what each is for, and what it runs with.
 *
 * Who may change what is not decided here. The bot roster holds those rules —
 * a standing administers its own organization, a bot's standing is fixed
 * rather than submitted, and its preset must be one the deployment offers —
 * and this namespace hands it the caller's standing and reports what it
 * answered. A second rule written here would be one to keep in step with the
 * first, and the one a direct caller bypasses.
 *
 * @module @lyness/lyn-api-bots-controller
 */

import { Context } from '@lyness/cordis'
import { BotsRefusedError } from '@lyness/lyn-managed-bots'
import type { BotRefusal, BotSubmission, BotView, TeamSubmission, TeamView } from '@lyness/lyn-managed-bots'
import { brandString } from '@lyness/lyn-brand'
import type { Membership, PersonId } from '@lyness/lyn-people'
import { callingStanding } from '@lyness/lyn-request-principal'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { assertNever } from '@lyness/lyn-util-values'
import type { BotInput, BotRowView, PresetOptionView, TeamInput, TeamRowView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `bots` Remote namespace. */
    botsController: BotsController
  }
}

/** Host service backing the generated `ctx.remote.bots` namespace. */
export default class BotsController extends TypertRemoteService {
  /**
   * Register the bots namespace.
   * @param ctx - Host context where the bot roster, the preset registry and the principal are mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'botsController', { namespace: 'bots', requires: 'tenant-administrator' })
  }

  /**
   * The bots the calling standing may change.
   * @returns the bots it administers, written ones first.
   * @throws {RemoteError} `bots/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment maintains no bots.
   */
  @Remote
  async list(): Promise<readonly BotRowView[]> {
    const roster = this.managed()
    return (await roster.list(await this.calling())).map(view)
  }

  /**
   * The agent presets a bot may be given.
   *
   * Answered by the roster rather than read from the preset registry here,
   * because that is the list a save is validated against: a form offering
   * one list while the roster checked another would refuse a choice it had
   * just presented.
   * @returns the presets on offer, in the registry's own order.
   * @throws {RemoteError} `bots/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment maintains no bots.
   */
  @Remote
  async presets(): Promise<readonly PresetOptionView[]> {
    const roster = this.managed()
    await this.calling()
    return (await roster.offers()).map(preset => ({
      id: preset.id,
      ...preset.displayName === undefined ? {} : { displayName: preset.displayName },
      ...preset.description === undefined ? {} : { description: preset.description },
    }))
  }

  /**
   * Add one bot, or change one this deployment maintains.
   * @param input - what the administrator filled in.
   * @returns the bot as the deployment now reads it.
   * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/unknown-preset`,
   * `bots/incomplete`, `bots/no-standing`, or `gateway/internal`.
   */
  @Remote
  async save(input: BotInput): Promise<BotRowView> {
    const roster = this.managed()
    const by = await this.calling()
    const submission: BotSubmission = {
      ...input.id === undefined ? {} : { id: brandString<PersonId>(input.id) },
      displayName: input.displayName,
      organization: input.organization,
      persona: input.persona,
      job: input.job,
      preset: input.preset,
    }
    try {
      return view(await roster.save(submission, by))
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Remove one bot this deployment maintains.
   * @param id - the bot to remove.
   * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/no-standing`,
   * or `gateway/internal`.
   */
  @Remote
  async remove(id: string): Promise<void> {
    const roster = this.managed()
    const by = await this.calling()
    try {
      await roster.remove(brandString<PersonId>(id), by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * The teams the calling standing may change.
   * @returns the teams it administers, written ones first.
   * @throws {RemoteError} `bots/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment maintains no bots.
   */
  @Remote
  async teams(): Promise<readonly TeamRowView[]> {
    const roster = this.managed()
    return (await roster.teams(await this.calling())).map(teamView)
  }

  /**
   * Add one team, or change one this deployment maintains.
   * @param input - what the administrator filled in.
   * @returns the team as the deployment now reads it.
   * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/unknown-bot`,
   * `bots/incomplete`, `bots/no-standing`, or `gateway/internal`.
   */
  @Remote
  async saveTeam(input: TeamInput): Promise<TeamRowView> {
    const roster = this.managed()
    const by = await this.calling()
    const submission: TeamSubmission = {
      ...input.id === undefined ? {} : { id: input.id },
      displayName: input.displayName,
      organization: input.organization,
      members: input.members.map(member => brandString<PersonId>(member)),
    }
    try {
      return teamView(await roster.saveTeam(submission, by))
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /**
   * Remove one team this deployment maintains.
   *
   * The bots stay; what goes is the relation that let them ask each other.
   * @param id - the team to remove.
   * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/no-standing`,
   * or `gateway/internal`.
   */
  @Remote
  async removeTeam(id: string): Promise<void> {
    const roster = this.managed()
    const by = await this.calling()
    try {
      await roster.removeTeam(id, by)
    } catch (refused: unknown) {
      throw refusal(refused)
    }
  }

  /** The bot roster, where this deployment maintains one. */
  private managed(): Context['managedBots'] {
    const roster = this.ctx.get('managedBots')
    if (roster === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment maintains no bots of its own', {
        endpoint: 'bots',
      })
    }
    return roster
  }

  /**
   * The standing this call acts in.
   *
   * Resolved rather than assumed: where a deployment mounts no authorization
   * rule, every call reaches here, and a bot added on no standing would be
   * one nobody is answerable for.
   */
  private async calling(): Promise<Membership> {
    const held = await callingStanding(this.ctx)
    if (held === undefined) throw new RemoteError('bots/no-standing', 'this call acts in no standing', {})
    return held
  }
}

/**
 * Project one bot onto its wire view.
 * @param bot - the bot as the roster holds it.
 * @returns the view this namespace answers with.
 */
function view(bot: BotView): BotRowView {
  return {
    id: bot.id,
    displayName: bot.displayName,
    organization: bot.organization,
    persona: bot.persona,
    job: bot.job,
    preset: bot.preset,
    written: bot.written,
    available: bot.available,
  }
}

/**
 * Project one team onto its wire view.
 * @param team - the team as the roster holds it.
 * @returns the view this namespace answers with.
 */
function teamView(team: TeamView): TeamRowView {
  return {
    id: team.id,
    displayName: team.displayName,
    organization: team.organization,
    members: [...team.members],
    written: team.written,
  }
}

/**
 * One refusal from the roster, as the wire reports it; anything else as itself.
 * @param refused - what the roster threw.
 * @returns the error to throw.
 */
function refusal(refused: unknown): unknown {
  if (!(refused instanceof BotsRefusedError)) return refused
  return reported(refused.reason, refused.message)
}

/**
 * The failure one refusal is reported as.
 * @param reason - which rule refused the change.
 * @param message - the roster's own words.
 * @returns the error to throw.
 */
function reported(reason: BotRefusal, message: string): RemoteError {
  switch (reason) {
    case 'not-permitted': return new RemoteError('bots/not-permitted', message, {})
    case 'written': return new RemoteError('bots/written', message, {})
    case 'unknown-preset': return new RemoteError('bots/unknown-preset', message, {})
    case 'unknown-bot': return new RemoteError('bots/unknown-bot', message, {})
    /* v8 ignore next -- no method here engages a bot; `session.create` owns that refusal. */
    case 'not-yours': return new RemoteError('bots/not-yours', message, {})
    case 'organization-required': return new RemoteError('bots/incomplete', message, { fields: ['organization'] })
    /* v8 ignore next -- closed-union exhaustiveness guard; the roster names one of the six above. */
    default: return assertNever(reason, 'managed bots refusal')
  }
}
