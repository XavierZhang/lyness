/**
 * Wire vocabulary of the tenant-configuration surface, and its failure codes.
 *
 * Views rather than the seam's own types, for two reasons. A grant's credential
 * is a branded reference in the Host and a plain string on the wire, and the
 * read adds facts the seam does not carry — who the calling tenant is, and
 * whether this deployment's backend accepts a save.
 * @module @lyness/lyn-api-tenant-controller/types
 */

declare module '@lyness/lyn-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The call named no tenant: no directory resolved its header, hostname, or
     * subdomain. Not a validation failure — the caller cannot fix it by sending
     * different arguments, and there is no tenant whose data it may be shown.
     */
    'tenant/unresolved': Record<string, never>
    /**
     * This deployment's configuration backend does not accept saves. Its own
     * outcome rather than an invalid request: the same arguments would be
     * accepted against a writable backend.
     */
    'tenant/read-only': { readonly tenantId: string }
    /**
     * The configuration breaks a rule the seam states. `problems` lists every
     * one, so a form reports them together rather than one per attempt.
     */
    'tenant/rejected': { readonly tenantId: string; readonly problems: readonly string[] }
  }
}

/** One model a tenant may use. */
export interface TenantModelView {
  /** Provider id, which must also appear in this tenant's grants. */
  readonly provider: string
  /** Model id as that provider names it. */
  readonly model: string
  /** Provider-specific reasoning effort, when the provider takes one. */
  readonly reasoningEffort?: string
}

/** What one modality offers this tenant. */
export interface TenantModalityView {
  /** Models this tenant may use; empty means the modality is unavailable to it. */
  readonly available: readonly TenantModelView[]
  /** The model chosen when a caller names none; absent when the tenant set none. */
  readonly preferred?: TenantModelView
}

/** One provider this tenant may reach. */
export interface TenantProviderView {
  /** Provider id this tenant's models name. */
  readonly provider: string
  /** Credential reference naming the tenant's key; the value never crosses the wire. */
  readonly credential: string
  /** Endpoint to reach the provider at, for a tenant running the model itself. */
  readonly baseUrl?: string
}

/** Identity text this tenant contributes to its own model requests. */
export interface TenantIdentityView {
  /** Rules every request from this tenant carries. */
  readonly constraints: readonly string[]
  /** Voice this tenant asks for. */
  readonly personality?: string
}

/** Everything the calling tenant may see about itself. */
export interface TenantConfigView {
  /** The calling tenant's immutable id. */
  readonly tenantId: string
  /** Its slug, for a surface that addresses it by name. */
  readonly slug: string
  /** Its display name. */
  readonly displayName: string
  /** Whether this deployment's backend accepts a save; a surface shows or hides saving on it. */
  readonly writable: boolean
  /** Whether this tenant has a stored configuration at all; false means everything below is empty. */
  readonly configured: boolean
  /** Models by modality, every modality present. */
  readonly models: Readonly<Record<string, TenantModalityView>>
  /** Providers this tenant may reach, each naming a credential reference. */
  readonly providers: readonly TenantProviderView[]
  /** Features this tenant may use. */
  readonly features: readonly string[]
  /** Identity text, absent when the tenant contributes none. */
  readonly identity?: TenantIdentityView
  /** Interface copy this tenant overrides, by copy id. */
  readonly copy: Readonly<Record<string, string>>
}

/**
 * A complete configuration to store for the calling tenant.
 *
 * It carries no tenant id on purpose: the tenant is the one the call arrived
 * for. A caller that could name its tenant could name any tenant.
 */
export interface TenantConfigInput {
  /** Models by modality; every modality the deployment knows must be present. */
  readonly models: Readonly<Record<string, TenantModalityView>>
  /** Providers this tenant may reach, each naming a credential reference. */
  readonly providers: readonly TenantProviderView[]
  /** Features this tenant may use. */
  readonly features: readonly string[]
  /** Identity text; omit to contribute none. */
  readonly identity?: TenantIdentityView | undefined
  /** Interface copy overrides; omit to override none. */
  readonly copy?: Readonly<Record<string, string>> | undefined
}
