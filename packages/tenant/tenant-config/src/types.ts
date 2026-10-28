/**
 * What one tenant configures for itself, shared by every face that reads it.
 *
 * Types only — no runtime code, and nothing here reaches a Host-only symbol,
 * so a Client compilation face reads exactly the signatures the Host emits.
 * @module @lyness/lyn-tenant-config/types
 */

import type { CredentialRef } from '@lyness/lyn-credentials/types'
import type { TenantId } from '@lyness/lyn-tenant'

/** A kind of model a tenant grants itself: text, or one of the three media kinds. */
export type Modality = 'language' | 'image' | 'video' | 'music'

/** One model a tenant may use, in the shape a Session selection already carries. */
export interface ModelChoice {
  /** Provider id, which must also appear in the tenant's provider grants. */
  readonly provider: string
  /** Model id as that provider names it, including a self-hosted model's own name. */
  readonly model: string
  /** Provider-specific reasoning effort, when the provider takes one. */
  readonly reasoningEffort?: string | undefined
}

/** What one modality offers a tenant. */
export interface ModalityModels {
  /** Models this tenant may use; empty means the modality is unavailable to it. */
  readonly available: readonly ModelChoice[]
  /** The model chosen when a caller names none; must be one of {@link available}. */
  readonly preferred?: ModelChoice | undefined
}

/** One provider a tenant may reach, and how it reaches it. */
export interface ProviderGrant {
  /** Provider id the tenant's models name. */
  readonly provider: string
  /** Reference to the tenant's key; the value lives in the credential store, never here. */
  readonly credential: CredentialRef
  /** Endpoint to reach the provider at, for a tenant running the model itself. */
  readonly baseUrl?: string | undefined
}

/**
 * Identity text one tenant contributes to its own model requests.
 *
 * The two fields compose differently on purpose. Constraints accumulate down
 * the layers — platform, organization, user, agent — and no lower layer
 * removes one, so an organization's compliance rule survives whatever an agent
 * says about itself. Personality is the voice, which a lower layer replaces.
 */
export interface TenantIdentity {
  /** Rules every request from this tenant carries; lower layers add to them and remove none. */
  readonly constraints: readonly string[]
  /** Voice this organization asks for, which an agent may replace with its own. */
  readonly personality?: string | undefined
}

/** Everything one tenant configures for itself. */
export interface TenantConfig {
  /** The tenant this configuration belongs to. */
  readonly tenantId: TenantId
  /** Models by modality; every modality is present, and an empty list means unavailable. */
  readonly models: Readonly<Record<Modality, ModalityModels>>
  /** Providers this tenant may reach, each with its own key reference. */
  readonly providers: readonly ProviderGrant[]
  /** Features this tenant may use; a feature absent from the list is unavailable to it. */
  readonly features: readonly string[]
  /** Identity text this tenant contributes to its model requests. */
  readonly identity?: TenantIdentity | undefined
  /** Interface copy this tenant overrides, by copy id; never reaches a model request. */
  readonly copy?: Readonly<Record<string, string>> | undefined
}
