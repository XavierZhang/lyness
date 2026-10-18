/**
 * DingTalk offered as a configurable kind, so an application can be added at
 * runtime rather than written into composition.
 *
 * The same channel either way: this module only says what one instance needs
 * and how to build it from what an administrator filled in. Mounting it
 * configures nothing by itself — a deployment with this row and no configured
 * instance offers no DingTalk sign-in at all.
 *
 * @module @lyness/lyn-dingtalk/kind
 */

import type { Context } from '@lyness/cordis'
import type { ChannelKind, ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import { chosen, identityOf, offering } from '@lyness/lyn-sign-in/kinds'
import type { SignInChannel } from '@lyness/lyn-sign-in'
import { DISPLAY_NAME, DingtalkChannel } from './index.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dingtalk-channel-kind'

/** The registry this kind offers itself to. */
export const inject = ['signInKinds']

/** The kind id an administrator picks. */
export const KIND = 'dingtalk'

/** What one DingTalk instance needs, beside its application secret. */
export const FIELDS = [
  { name: 'appKey', label: 'AppKey', required: true },
  { name: 'loginHost', label: 'sign-in host', required: false },
  { name: 'apiOrigin', label: 'API origin', required: false },
  { name: 'scope', label: 'scope', required: false },
] as const

/**
 * Build one configured DingTalk channel.
 * @param instance - what the administrator configured.
 * @param ctx - the context the channel reads its secret through.
 * @returns the channel to register.
 * @throws {Error} when a required setting is missing.
 */
export function create(instance: ConfiguredChannel, ctx: Context): SignInChannel {
  const { appKey } = instance.settings
  if (appKey === undefined) throw new Error('dingtalk: a configured channel needs appKey')
  return new DingtalkChannel(ctx, {
    appKey,
    secret: instance.secret,
    ...chosen(instance.settings, ['loginHost', 'apiOrigin', 'scope']),
  }, identityOf(instance))
}

/** DingTalk, as a configuration surface offers it. */
export const kind: ChannelKind = { id: KIND, displayName: DISPLAY_NAME, fields: FIELDS, create }

/** Offer DingTalk as a configurable kind. */
export const apply = offering(kind)
