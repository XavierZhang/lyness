/**
 * Feishu offered as a configurable kind, so an application can be added at
 * runtime rather than written into composition.
 *
 * The same channel either way: this module only says what one instance needs
 * and how to build it from what an administrator filled in. Mounting it
 * configures nothing by itself — a deployment with this row and no configured
 * instance offers no Feishu sign-in at all.
 *
 * @module @lyness/lyn-feishu/kind
 */

import type { Context } from '@lyness/cordis'
import type { ChannelKind, ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import { chosen, identityOf, offering } from '@lyness/lyn-sign-in/kinds'
import type { SignInChannel } from '@lyness/lyn-sign-in'
import { DISPLAY_NAME, FeishuChannel } from './index.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'feishu-channel-kind'

/** The registry this kind offers itself to. */
export const inject = ['signInKinds']

/** The kind id an administrator picks. */
export const KIND = 'feishu'

/** What one Feishu instance needs, beside its application secret. */
export const FIELDS = [
  { name: 'appId', label: 'App ID', required: true },
  { name: 'apiOrigin', label: 'API origin', required: false },
] as const

/**
 * Build one configured Feishu channel.
 * @param instance - what the administrator configured.
 * @param ctx - the context the channel reads its secret through.
 * @returns the channel to register.
 * @throws {Error} when a required setting is missing.
 */
export function create(instance: ConfiguredChannel, ctx: Context): SignInChannel {
  const { appId } = instance.settings
  if (appId === undefined) throw new Error('feishu: a configured channel needs appId')
  return new FeishuChannel(ctx, {
    appId,
    secret: instance.secret,
    ...chosen(instance.settings, ['apiOrigin']),
  }, identityOf(instance))
}

/** Feishu, as a configuration surface offers it. */
export const kind: ChannelKind = { id: KIND, displayName: DISPLAY_NAME, fields: FIELDS, create }

/** Offer Feishu as a configurable kind. */
export const apply = offering(kind)
