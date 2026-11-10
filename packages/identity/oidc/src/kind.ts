/**
 * An OpenID Provider offered as a configurable kind, so an administrator adds
 * one at runtime rather than writing it into composition.
 *
 * The same channel either way: this module only says what one instance needs
 * and how to build it from what an administrator filled in. Mounting it
 * configures nothing by itself — a deployment with this row and no configured
 * instance offers no single sign-on at all.
 *
 * @module @lyness/lyn-oidc/kind
 */

import type { Context } from '@lyness/cordis'
import type { ChannelKind, ConfiguredChannel } from '@lyness/lyn-sign-in/kinds'
import { chosen, identityOf, offering } from '@lyness/lyn-sign-in/kinds'
import type { SignInChannel } from '@lyness/lyn-sign-in'
import { DISPLAY_NAME, OidcChannel } from './index.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'oidc-channel-kind'

/** The registry this kind offers itself to. */
export const inject = ['signInKinds']

/** The kind id an administrator picks. */
export const KIND = 'oidc'

/**
 * What one provider instance needs, beside its client secret.
 *
 * Only the issuer and the client id are required: every endpoint comes from
 * the provider's own discovery document, so there is nothing else an
 * administrator could get wrong. The organization fields are what a
 * deployment serving several tenants fills in.
 */
export const FIELDS = [
  { name: 'issuer', label: 'issuer URL', required: true },
  { name: 'clientId', label: 'client ID', required: true },
  { name: 'scope', label: 'scopes', required: false },
  { name: 'organization', label: 'organization', required: false },
  { name: 'organizationClaim', label: 'organization claim', required: false },
  { name: 'organizationParameter', label: 'organization parameter', required: false },
] as const

/**
 * Build one configured OIDC channel.
 * @param instance - what the administrator configured.
 * @param ctx - the context the channel reads its secret through.
 * @returns the channel to register.
 * @throws {Error} when a required setting is missing.
 */
export function create(instance: ConfiguredChannel, ctx: Context): SignInChannel {
  const { issuer, clientId } = instance.settings
  if (issuer === undefined || clientId === undefined) {
    throw new Error('oidc: a configured channel needs issuer and clientId')
  }
  return new OidcChannel(ctx, {
    issuer,
    clientId,
    secret: instance.secret,
    ...chosen(instance.settings, ['scope', 'organization', 'organizationClaim', 'organizationParameter']),
  }, identityOf(instance))
}

/** An OpenID Provider, as a configuration surface offers it. */
export const kind: ChannelKind = { id: KIND, displayName: DISPLAY_NAME, fields: FIELDS, create }

/** Offer an OpenID Provider as a configurable kind. */
export const apply = offering(kind)
