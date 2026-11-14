/**
 * WeCom offered as a configurable kind, so a corporation can be added at
 * runtime rather than written into composition.
 *
 * The same channel either way: this module only says what one instance needs
 * and how to build it from what an administrator filled in. Mounting it
 * configures nothing by itself — a deployment with this row and no configured
 * instance offers no WeCom sign-in at all.
 *
 * @module @deepseek-ai/dsh-wecom/kind
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ChannelKind, ConfiguredChannel } from '@deepseek-ai/dsh-sign-in/kinds'
import { chosen, identityOf, offering } from '@deepseek-ai/dsh-sign-in/kinds'
import type { SignInChannel } from '@deepseek-ai/dsh-sign-in'
import { DISPLAY_NAME, WecomChannel } from './index.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'wecom-channel-kind'

/** The registry this kind offers itself to. */
export const inject = ['signInKinds']

/** The kind id an administrator picks. */
export const KIND = 'wecom'

/** What one WeCom instance needs, beside its application secret. */
export const FIELDS = [
  { name: 'corpId', label: 'corpid', required: true },
  { name: 'agentId', label: 'agentid', required: true },
  { name: 'loginHost', label: 'login host', required: false },
  { name: 'apiOrigin', label: 'API origin', required: false },
] as const

/**
 * Build one configured WeCom channel.
 * @param instance - what the administrator configured.
 * @param ctx - the context the channel reads its secret through.
 * @returns the channel to register.
 * @throws {Error} when a required setting is missing.
 */
export function create(instance: ConfiguredChannel, ctx: Context): SignInChannel {
  const { corpId, agentId } = instance.settings
  if (corpId === undefined || agentId === undefined) {
    throw new Error('wecom: a configured channel needs corpId and agentId')
  }
  return new WecomChannel(ctx, {
    corpId,
    agentId,
    secret: instance.secret,
    ...chosen(instance.settings, ['loginHost', 'apiOrigin']),
  }, identityOf(instance))
}

/** WeCom, as a configuration surface offers it. */
export const kind: ChannelKind = { id: KIND, displayName: DISPLAY_NAME, fields: FIELDS, create }

/** Offer WeCom as a configurable kind. */
export const apply = offering(kind)
