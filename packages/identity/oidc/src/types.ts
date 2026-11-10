/**
 * Vocabulary of one OpenID Provider, kept apart from the request shapes.
 *
 * @module @lyness/lyn-oidc/types
 */

import type { Branded } from '@lyness/lyn-brand'

/** The issuer identifier an OpenID Provider publishes for itself. */
export type OidcIssuer = Branded<'OidcIssuer'>

/** Stable identity of one person within one issuer; never a name or an address. */
export type OidcSubject = Branded<'OidcSubject'>

/** One person as an OpenID Provider's userinfo endpoint reports them. */
export interface OidcPerson {
  /** The issuer that authenticated them, as discovery publishes it. */
  readonly issuer: OidcIssuer
  /** The `sub` claim: stable within that issuer. */
  readonly subject: OidcSubject
  /** The `name` claim, when the provider publishes one. */
  readonly name?: string | undefined
  /** The `email` claim, when the provider publishes one. */
  readonly email?: string | undefined
  /**
   * The organization this sign-in belongs to, read from the claim a
   * deployment names.
   *
   * A provider that models tenants carries them as a claim rather than as a
   * separate issuer, so one instance serves every tenant and a sign-in says
   * which one it was for.
   */
  readonly organization?: string | undefined
}
