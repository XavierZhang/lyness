/**
 * The kinds of sign-in channel a deployment can be configured with.
 *
 * A channel mounted from composition is one directory decided when the
 * deployment was assembled. That is the right shape for an installation whose
 * operator writes its configuration, and the wrong one for a deployment whose
 * customers each bring their own directory: a tenant administrator cannot edit
 * a composition file, and a platform that shipped one row per customer would
 * redeploy to add a customer.
 *
 * So a package offers a *kind* — "I can be a WeCom channel, and here is what
 * one needs" — and something else holds the configured instances. The kind
 * knows how to build one; it never knows how many there are or whose they are.
 *
 * @module @deepseek-ai/dsh-sign-in/kinds
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { ChannelId } from './types.ts'
import type { SignInChannel } from './index.ts'
import type { ChannelIdentity } from './redirect.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The channel kinds this deployment can be configured with; absent where none is mounted. */
    signInKinds: ChannelKindRegistry
  }
}

/** One setting an administrator fills in to configure a channel of one kind. */
export interface ChannelKindField {
  /** The settings key this field writes. */
  readonly name: string
  /** What a form calls it, in the kind's own vocabulary — `corpid`, `AppKey`. */
  readonly label: string
  /** Whether an instance without it is refused. */
  readonly required: boolean
}

/** One configured channel, as the kind that builds it receives it. */
export interface ConfiguredChannel {
  /** The channel id a binding names and a sign-in path carries. */
  readonly id: ChannelId
  /** Name a sign-in page shows on the button. */
  readonly displayName: string
  /** The organization it belongs to; absent means the deployment's own. */
  readonly organization?: string | undefined
  /** What the administrator filled in, by field name. */
  readonly settings: Readonly<Record<string, string>>
  /**
   * Credential reference holding this instance's application secret.
   *
   * A reference rather than the secret: the record is read by everything that
   * lists channels, and an application secret signs in everybody the
   * application can reach.
   */
  readonly secret: string
}

/** What a package offers: one directory's shape, and how to build an instance of it. */
export interface ChannelKind {
  /** The kind an administrator picks, such as `wecom`. */
  readonly id: string
  /** Name a configuration surface shows for it. */
  readonly displayName: string
  /** The settings one instance needs, beside its secret. */
  readonly fields: readonly ChannelKindField[]
  /**
   * Build one configured channel.
   * @param instance - what the administrator configured.
   * @param ctx - the context the channel reads its secret through.
   * @returns the channel to register.
   * @throws {Error} when the settings do not describe a usable directory.
   */
  create(instance: ConfiguredChannel, ctx: Context): SignInChannel
}

/** What a configuration surface needs to offer one kind. */
export interface ChannelKindDescription {
  /** The kind to name when configuring an instance. */
  readonly id: string
  /** Name to show for it. */
  readonly displayName: string
  /** The settings one instance needs, beside its secret. */
  readonly fields: readonly ChannelKindField[]
}

/** The kinds a deployment can be configured with. */
export class ChannelKindRegistry extends Service {
  private readonly kinds = new Map<string, ChannelKind>()

  /**
   * @param ctx - the context this registry serves.
   */
  constructor(ctx: Context) {
    super(ctx, 'signInKinds')
  }

  /**
   * Offer one kind.
   *
   * Two packages offering one kind id is a composition mistake rather than a
   * runtime condition — a configured instance would reach whichever won, and
   * an administrator reading their own configuration could not tell which —
   * so it fails here.
   * @param kind - the kind to offer.
   * @returns the disposer; the registering plugin owns it.
   * @throws {Error} when that kind is already offered.
   */
  register(kind: ChannelKind): () => Promise<void> {
    if (this.kinds.has(kind.id)) {
      throw new Error(`sign-in: channel kind "${kind.id}" is already registered`)
    }
    return this.ctx.effect(() => {
      this.kinds.set(kind.id, kind)
      return () => { this.kinds.delete(kind.id) }
    }, 'signInKinds.register()')
  }

  /**
   * The kind of that id, when one is offered.
   * @param id - the kind a configured instance names.
   * @returns the kind, or undefined when nothing offers it.
   */
  get(id: string): ChannelKind | undefined {
    return this.kinds.get(id)
  }

  /**
   * The kinds a configuration surface may offer, in registration order.
   * @returns each kind's id, name, and the settings it needs.
   */
  available(): readonly ChannelKindDescription[] {
    return [...this.kinds.values()].map(({ id, displayName, fields }) => ({ id, displayName, fields }))
  }
}

/**
 * Who one configured instance is, as the channel it builds needs it.
 * @param instance - what the administrator configured.
 * @returns the identity to hand the channel's constructor.
 */
export function identityOf(instance: ConfiguredChannel): ChannelIdentity {
  return {
    id: instance.id,
    displayName: instance.displayName,
    ...instance.organization === undefined ? {} : { organization: instance.organization },
  }
}

/**
 * The settings one kind accepts beyond its required ones, as its channel's
 * configuration takes them.
 *
 * Absent and empty are the same answer: a form submits an untouched field as
 * an empty string, and a configuration that passed it on would override the
 * channel's own default with nothing.
 * @param settings - what the administrator filled in.
 * @param names - the optional settings this kind reads.
 * @returns only the ones that were filled in.
 */
export function chosen<Name extends string>(
  settings: Readonly<Record<string, string>>,
  names: readonly Name[],
): Partial<Record<Name, string>> {
  const picked: Partial<Record<Name, string>> = {}
  for (const name of names) {
    const value = settings[name]
    if (value !== undefined && value !== '') picked[name] = value
  }
  return picked
}

/**
 * Build the apply function a kind package exports.
 *
 * A named helper rather than the same three lines in every package: offering
 * a kind is registration and nothing else, and a package that wrote it itself
 * would be writing the registry's own contract down again.
 * @param kind - the kind to offer.
 * @returns the plugin's apply.
 */
export function offering(kind: ChannelKind): (ctx: Context) => void {
  return (ctx: Context): void => { ctx.effect(() => ctx.signInKinds.register(kind)) }
}

export default ChannelKindRegistry
