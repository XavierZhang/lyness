/**
 * Host Remote owner of the `signInChannels` namespace: administrators
 * configure the directories this deployment signs people in with.
 *
 * Who may change what is not decided here. The service holds one rule —
 * a standing administers the organization a channel belongs to — and this
 * namespace hands it the caller's standing and reports what it answered. A
 * second rule written here would be a second rule to keep in step with the
 * first, and the one a direct caller bypasses.
 *
 * The application secret crosses inward only. A submission may carry one; no
 * answer ever does, because nothing stored here can produce one: the record
 * holds the reference the credential store keeps it under.
 *
 * @module @lyness/lyn-api-sign-in-channel-controller
 */

import { Context } from '@lyness/cordis'
import type { Membership } from '@lyness/lyn-people'
import type {} from '@lyness/lyn-request-principal'
import { ChannelRefusedError } from '@lyness/lyn-sign-in-channels'
import type { ChannelRefusal, ChannelSubmission, ChannelView } from '@lyness/lyn-sign-in-channels'
import type {} from '@lyness/lyn-sign-in/kinds'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { assertNever } from '@lyness/lyn-util-values'
import type { ChannelInput, ChannelKindView, ConfiguredChannelView } from './types.ts'

export type * from './types.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `signInChannels` Remote namespace. */
    signInChannelController: SignInChannelController
  }
}

/** Host service backing the generated `ctx.remote.signInChannels` namespace. */
export default class SignInChannelController extends TypertRemoteService {
  /**
   * Register the sign-in channel namespace.
   * @param ctx - Host context where the configured channels, the kinds, the directory and the principal are mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'signInChannelController', { namespace: 'signInChannels', requires: 'tenant-administrator' })
  }

  /**
   * The kinds of directory this deployment can configure a channel of.
   * @returns each mounted kind and the settings it needs.
   */
  @Remote
  kinds(): readonly ChannelKindView[] {
    return (this.ctx.get('signInKinds')?.available() ?? []).map(kind => ({
      id: kind.id,
      displayName: kind.displayName,
      fields: kind.fields.map(field => ({ name: field.name, label: field.label, required: field.required })),
    }))
  }

  /**
   * The configured channels the calling standing may change.
   * @returns the channels it administers, oldest first.
   * @throws {RemoteError} `sign-in-channels/no-standing` when the call establishes none,
   * or `gateway/internal` when this deployment stores no configured channels.
   */
  @Remote
  async list(): Promise<readonly ConfiguredChannelView[]> {
    const channels = this.configured()
    return (await channels.list(await this.calling())).map(view)
  }

  /**
   * Create one channel, or replace one that exists.
   * @param input - what the administrator filled in.
   * @returns the channel as the deployment now reads it.
   * @throws {RemoteError} `sign-in-channels/not-permitted`, `sign-in-channels/unknown-kind`,
   * `sign-in-channels/incomplete`, `sign-in-channels/no-standing`, or `gateway/internal`.
   */
  @Remote
  async save(input: ChannelInput): Promise<ConfiguredChannelView> {
    const channels = this.configured()
    const by = await this.calling()
    const submission: ChannelSubmission = {
      ...input.id === undefined ? {} : { id: input.id },
      kind: input.kind,
      displayName: input.displayName,
      ...input.organization === undefined ? {} : { organization: input.organization },
      settings: { ...input.settings },
      ...input.secret === undefined ? {} : { secret: input.secret },
    }
    try {
      return view(await channels.save(submission, by))
    } catch (refused: unknown) {
      throw this.refusal(refused, input.kind)
    }
  }

  /**
   * Remove one channel, its secret with it.
   * @param id - the channel to remove.
   * @throws {RemoteError} `sign-in-channels/not-permitted`, `sign-in-channels/no-standing`,
   * or `gateway/internal`.
   */
  @Remote
  async remove(id: string): Promise<void> {
    const channels = this.configured()
    const by = await this.calling()
    try {
      await channels.remove(id, by)
    } catch (refused: unknown) {
      throw this.refusal(refused)
    }
  }

  /** The configured channels, where this deployment stores any. */
  private configured(): Context['signInChannels'] {
    const channels = this.ctx.get('signInChannels')
    if (channels === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment stores no configured sign-in channels', {
        endpoint: 'signInChannels',
      })
    }
    return channels
  }

  /**
   * The standing this call acts in.
   *
   * Resolved rather than assumed: where a deployment mounts no authorization
   * rule, every call reaches here, and a configuration change made on no
   * standing would be one nobody is answerable for.
   */
  private async calling(): Promise<Membership> {
    const acting = this.ctx.get('requestPrincipal')?.current()?.acting.membership
    const held = acting === undefined ? undefined : await this.ctx.get('people')?.membership(acting)
    if (held === undefined) {
      throw new RemoteError('sign-in-channels/no-standing', 'this call acts in no standing', {})
    }
    return held
  }

  /** One refusal from the service, as the wire reports it; anything else as itself. */
  private refusal(refused: unknown, kind = ''): unknown {
    if (!(refused instanceof ChannelRefusedError)) return refused
    return reported(refused.reason, refused.message, kind, refused.fields)
  }
}

/**
 * Project one record onto its wire view.
 * @param channel - the configured channel.
 * @returns the view this namespace answers with.
 */
function view(channel: ChannelView): ConfiguredChannelView {
  return {
    id: channel.id,
    kind: channel.kind,
    displayName: channel.displayName,
    ...channel.organization === undefined ? {} : { organization: channel.organization },
    settings: { ...channel.settings },
    configuredAt: channel.configuredAt,
    configuredBy: channel.configuredBy,
    mounted: channel.mounted,
  }
}

/**
 * The failure one refusal is reported as.
 * @param reason - which rule refused the change.
 * @param message - the service's own words.
 * @param kind - the kind the submission named, for an unknown one.
 * @param fields - the settings that were missing, when that is the reason.
 * @returns the error to throw.
 */
function reported(
  reason: ChannelRefusal,
  message: string,
  kind: string,
  fields: readonly string[],
): RemoteError {
  switch (reason) {
    case 'not-permitted': return new RemoteError('sign-in-channels/not-permitted', message, {})
    case 'unknown-kind': return new RemoteError('sign-in-channels/unknown-kind', message, { kind })
    case 'secret-required': return new RemoteError('sign-in-channels/incomplete', message, { fields: [] })
    case 'settings-required': return new RemoteError('sign-in-channels/incomplete', message, { fields })
    /* v8 ignore next -- closed-union exhaustiveness guard; the service names one of the four above. */
    default: return assertNever(reason, 'sign-in channel refusal')
  }
}
