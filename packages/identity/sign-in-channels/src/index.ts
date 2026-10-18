/**
 * The configured sign-in channels a deployment serves, and the administrator
 * decisions that change them.
 *
 * A channel written into composition is one directory decided when the
 * deployment was assembled. That is right for an installation whose operator
 * writes its configuration, and wrong for one whose customers each bring their
 * own: a tenant administrator cannot edit a composition file, and a platform
 * that shipped one row per customer would redeploy to add a customer.
 *
 * So the records live here, the kinds that build them live in their own
 * packages, and this service is what turns one into the other — mounting a
 * channel per record and remounting it when the record changes. Both shapes
 * coexist: a composition row and a configured record register into the same
 * registry, and a deployment may use either or both.
 *
 * @module @lyness/lyn-sign-in-channels
 */

import { Service } from '@lyness/cordis'
import type { Context } from '@lyness/cordis'
import { credentialRef } from '@lyness/lyn-credentials'
import type {} from '@lyness/lyn-credentials'
import { administers } from '@lyness/lyn-people'
import type { Membership } from '@lyness/lyn-people'
import { channelId } from '@lyness/lyn-sign-in'
import type { SignInChannel } from '@lyness/lyn-sign-in'
import type { ChannelKind } from '@lyness/lyn-sign-in/kinds'
import { randomUUID } from '@lyness/lyn-util-crypto'
import type { Domain } from '@lyness/lyn-storage-domain'
import { channelDomain } from './storage.ts'
import type { ChannelRecord, ChannelSubmission, ChannelView } from './types.ts'

export type * from './types.ts'
export { channelDomain, channelSchema } from './storage.ts'

declare module '@lyness/cordis' {
  interface Context {
    /** The configured sign-in channels; absent where a deployment configures none. */
    signInChannels: ConfiguredChannels
  }
}

/** Message an unauthorized administrator attempt is refused with. */
export const NOT_PERMITTED = 'sign-in-channels: this standing may not configure that channel'

/** Message a submission naming a kind nothing offers is refused with. */
export const KIND_UNKNOWN = 'sign-in-channels: no plugin offers that channel kind'

/** Message a creation without a secret is refused with. */
export const SECRET_REQUIRED = 'sign-in-channels: a new channel needs its application secret'

/** Message a submission missing a required setting is refused with. */
export const SETTING_REQUIRED = 'sign-in-channels: this kind needs'

/**
 * The credential reference one channel's secret is stored under.
 *
 * Derived from the channel's own generated id rather than from anything an
 * administrator supplies: a tenant administrator naming their own reference
 * could otherwise overwrite the deployment's, or another tenant's.
 * @param id - the channel's stable id.
 * @returns the reference to store its secret under.
 */
export function secretRefOf(id: string): string {
  return `SIGN_IN_CHANNEL_${id.replaceAll('-', '_').toUpperCase()}`
}

/** Configured sign-in channels, mounted from what a deployment stored. */
export class ConfiguredChannels extends Service {
  static inject = ['storageDomain', 'signIn', 'signInKinds', 'credentials']

  private readonly ready: Promise<Domain<typeof channelDomain>>

  private readonly mounted = new Map<string, () => Promise<void>>()

  /**
   * @param ctx - context providing storage, the registries, and the credential store.
   */
  constructor(ctx: Context) {
    super(ctx, 'signInChannels')
    this.ready = ctx.storageDomain.open(channelDomain)
    ctx.effect(() => async () => {
      await this.unmountAll()
      await (await this.ready).close()
    })
    // Mounted once the store is open: a deployment's channels are serving
    // before anybody signs in, not when somebody first asks for the list. A
    // teardown that lands first closes the domain under it, and that is the
    // shutdown rather than a failure.
    void this.mountAll().catch(() => undefined)
  }

  /**
   * The channels one standing may configure.
   *
   * A platform administrator sees every channel, including each tenant's; a
   * tenant administrator sees only their own organization's. Nobody sees a
   * secret, because nobody stores one here to see.
   * @param by - the standing asking.
   * @returns the channels it may configure, oldest first.
   */
  async list(by: Membership): Promise<readonly ChannelView[]> {
    const domain = await this.ready
    return [...domain.table('channels').entries()].map(([, record]) => record)
      .filter(record => administers(by, record.organization))
      .map(record => this.view(record))
  }

  /**
   * Create one channel, or replace one that exists.
   * @param submission - what the administrator filled in.
   * @param by - the standing making the change.
   * @returns the channel as it now reads.
   * @throws {Error} when the standing may not configure it, the kind is unknown, or a setting is missing.
   */
  async save(submission: ChannelSubmission, by: Membership): Promise<ChannelView> {
    if (!administers(by, submission.organization)) throw new Error(NOT_PERMITTED)
    const kind = this.ctx.signInKinds.get(submission.kind)
    if (kind === undefined) throw new Error(KIND_UNKNOWN)
    const missing = kind.fields
      .filter(field => field.required && (submission.settings[field.name] ?? '') === '')
      .map(field => field.name)
    if (missing.length > 0) throw new Error(`${SETTING_REQUIRED} ${missing.join(', ')}`)

    const domain = await this.ready
    const existing = submission.id === undefined ? undefined : domain.table('channels').get(submission.id)
    // A replacement is authorized against what is stored as well as against
    // what was submitted: otherwise one tenant's administrator could claim
    // another's channel by naming its id with their own organization.
    if (existing !== undefined && !administers(by, existing.organization)) throw new Error(NOT_PERMITTED)
    if (existing === undefined && submission.secret === undefined) throw new Error(SECRET_REQUIRED)

    const id = existing?.id ?? randomUUID()
    const secret = secretRefOf(id)
    if (submission.secret !== undefined) {
      await this.ctx.credentials.set(credentialRef(secret), submission.secret)
    }
    const record: ChannelRecord = {
      id,
      kind: submission.kind,
      displayName: submission.displayName,
      ...submission.organization === undefined ? {} : { organization: submission.organization },
      settings: { ...submission.settings },
      secret,
      configuredAt: new Date().toISOString(),
      configuredBy: by.person,
    }
    await domain.table('channels').put(id, record)
    await this.remount(record)
    return this.view(record)
  }

  /**
   * Remove one channel, its secret with it.
   * @param id - the channel to remove.
   * @param by - the standing making the change.
   * @throws {Error} when the standing may not configure it.
   */
  async remove(id: string, by: Membership): Promise<void> {
    const domain = await this.ready
    const existing = domain.table('channels').get(id)
    if (existing === undefined) return
    if (!administers(by, existing.organization)) throw new Error(NOT_PERMITTED)
    await this.unmount(id)
    await domain.table('channels').delete(id)
    // The secret goes with the record: leaving it behind would keep a
    // directory's credential in the store with nothing naming it.
    await this.ctx.credentials.unset(credentialRef(existing.secret))
  }

  /** Mount every stored channel whose kind is offered. */
  private async mountAll(): Promise<void> {
    const domain = await this.ready
    for (const [, record] of domain.table('channels').entries()) await this.remount(record)
  }

  /**
   * Mount one record, replacing the channel it already had.
   *
   * A record whose kind nothing offers, or whose settings that kind refuses,
   * stays stored and unmounted: a deployment that removed a plugin keeps the
   * configuration it will need back, and a surface shows the record as not
   * mounted rather than losing it.
   */
  private async remount(record: ChannelRecord): Promise<void> {
    await this.unmount(record.id)
    const kind = this.ctx.signInKinds.get(record.kind)
    if (kind === undefined) return
    const channel = this.build(kind, record)
    if (channel !== undefined) this.mounted.set(record.id, this.ctx.signIn.register(channel))
  }

  /**
   * Build one channel from its record, or nothing when its kind refuses it.
   *
   * A kind refusing its own settings — a corpid that is not one, a host that
   * is not a host — leaves the record stored so an administrator can correct
   * it, and `mounted` says it is not serving in the meantime.
   */
  private build(kind: ChannelKind, record: ChannelRecord): SignInChannel | undefined {
    try {
      return kind.create({
        id: channelId(record.id),
        displayName: record.displayName,
        ...record.organization === undefined ? {} : { organization: record.organization },
        settings: record.settings,
        secret: record.secret,
      }, this.ctx)
    } catch (refused: unknown) {
      // `refused` is the kind's own complaint about settings an administrator
      // typed; it is answered by correcting the record, not by failing here.
      void refused
      return undefined
    }
  }

  /** Take one channel out of the registry, if it is in it. */
  private async unmount(id: string): Promise<void> {
    const dispose = this.mounted.get(id)
    this.mounted.delete(id)
    await dispose?.()
  }

  /** Take every mounted channel out of the registry. */
  private async unmountAll(): Promise<void> {
    for (const id of [...this.mounted.keys()]) await this.unmount(id)
  }

  /** One record as a surface shows it. */
  private view(record: ChannelRecord): ChannelView {
    return {
      id: record.id,
      kind: record.kind,
      displayName: record.displayName,
      ...record.organization === undefined ? {} : { organization: record.organization },
      settings: record.settings,
      configuredAt: record.configuredAt,
      configuredBy: String(record.configuredBy),
      mounted: this.mounted.has(record.id),
    }
  }
}

export default ConfiguredChannels
