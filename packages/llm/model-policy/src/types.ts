/**
 * Vocabulary for the models a deployment allows.
 *
 * @module @lyness/lyn-model-policy/types
 */

/** One model a policy allows, named the way a request names it. */
export interface AllowedModel {
  /** Registered provider route. */
  readonly provider: string
  /** Model id as that provider names it. */
  readonly model: string
}

/** What a deployment allows for the request being resolved. */
export interface ModelAllowance {
  /** Models this request may use; an empty list allows none. */
  readonly allowed: readonly AllowedModel[]
  /**
   * Which authority decided it, named in a refusal.
   *
   * A user refused a model needs to know whom to ask. "The deployment" and
   * "your organization's administrator" lead to different next actions, and a
   * refusal that says neither produces a support case instead of a fix.
   */
  readonly authority: string
}
