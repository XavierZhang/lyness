/**
 * Composition-configured backend of the tenant-configuration seam: each
 * tenant's models, providers, features, identity, and copy are rows in the
 * deployment's patch layer, read once at load.
 *
 * It is read-only on purpose. A roster an operator can read and diff before a
 * deployment starts is what a private deployment and an early SaaS deployment
 * both need; an administration surface that saves changes wants a store this
 * process writes, which is a different backend behind the same seam.
 *
 * Every row is validated at load, and a row that breaks a rule refuses the
 * mount rather than answering requests with a configuration nobody wrote —
 * a model whose provider the tenant has no key for would fail at the provider,
 * far from the line that caused it.
 * @module @lyness/lyn-tenant-config-static
 */

import { Context } from '@lyness/cordis'
import z from '@lyness/schemastery'
import { credentialRef, isCredentialRefName } from '@lyness/lyn-credentials'
import { TENANT_ID_SYNTAX, TenantId } from '@lyness/lyn-tenant'
import { MODALITIES, TenantConfigStore, validateTenantConfig } from '@lyness/lyn-tenant-config'
import type {
  Modality, ModalityModels, ModelChoice, ProviderGrant, TenantConfig, TenantConfigCapability,
} from '@lyness/lyn-tenant-config'

/** One configured model. */
export interface ModelEntry {
  /** Provider id, which must also appear in this tenant's provider grants. */
  provider: string
  /** Model id as that provider names it. */
  model: string
  /** Provider-specific reasoning effort, when the provider takes one. */
  reasoningEffort?: string
}

/** One configured modality. */
export interface ModalityEntry {
  /** Models this tenant may use; omitted or empty means the modality is unavailable to it. */
  available?: ModelEntry[]
  /** The model chosen when a caller names none; must be one of `available`. */
  preferred?: ModelEntry | null
}

/** One configured provider grant. */
export interface ProviderEntry {
  /** Provider id this tenant's models name. */
  provider: string
  /** Credential reference naming the tenant's key; the value lives in the credential store. */
  credential: string
  /** Endpoint to reach the provider at, for a tenant running the model itself. */
  baseUrl?: string
}

/** One configured tenant identity. */
export interface IdentityEntry {
  /** Rules every request from this tenant carries. */
  constraints?: string[]
  /** Voice this organization asks for. */
  personality?: string
}

/** One configured tenant. */
export interface TenantConfigEntry {
  /** The tenant this row configures. */
  tenantId: string
  /** Providers this tenant may reach. */
  providers?: ProviderEntry[]
  /** Models by modality; an absent modality is unavailable to this tenant. */
  models?: Partial<Record<Modality, ModalityEntry>>
  /** Features this tenant may use. */
  features?: string[]
  /** Identity text this tenant contributes to its model requests. */
  identity?: IdentityEntry | null
  /** Interface copy this tenant overrides, by copy id. */
  copy?: Record<string, string>
}

/** Plugin config: one row per configured tenant. */
export interface Config {
  /** Every tenant this deployment configures; at least one. */
  tenants: TenantConfigEntry[]
}

const modelEntry: z<ModelEntry> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  reasoningEffort: z.string(),
})

// An optional nested object needs the null arm: a plain object schema
// materializes `{}` for an absent field, and that `{}` then fails the required
// members inside it.
const modalityEntry: z<ModalityEntry> = z.object({
  available: z.array(modelEntry).default([]),
  preferred: z.union([modelEntry, z.const(null)]),
})

/** One configured row after the schema has applied its defaults. */
interface ResolvedEntry extends TenantConfigEntry {
  providers: ProviderEntry[]
  models: Record<Modality, ModalityEntry & { available: ModelEntry[] }>
  features: string[]
  copy: Record<string, string>
}

/**
 * Refuse a configured row, naming its position.
 * @param index - position of the row in the roster.
 * @param message - what is wrong with it.
 * @throws {Error} always.
 */
function refuse(index: number, message: string): never {
  throw new Error(`tenant-config-static: tenants[${String(index)}] ${message}`)
}

/**
 * Read one model entry as the seam's model choice.
 * @param entry - the configured model.
 * @returns the choice, carrying an effort only when one was configured.
 */
function choiceOf(entry: ModelEntry): ModelChoice {
  return {
    provider: entry.provider,
    model: entry.model,
    ...entry.reasoningEffort === undefined ? {} : { reasoningEffort: entry.reasoningEffort },
  }
}

/**
 * Read one modality as the seam's model set.
 * @param entry - the configured modality.
 * @returns the available models and the preferred one, if any.
 */
function modalityOf(entry: ModalityEntry & { available: ModelEntry[] }): ModalityModels {
  const available = entry.available.map(choiceOf)
  const preferred = entry.preferred
  return { available, ...preferred === undefined || preferred === null ? {} : { preferred: choiceOf(preferred) } }
}

/**
 * Read one row's provider grants.
 * @param entries - the configured grants.
 * @param index - position of the row, for refusals.
 * @returns the grants with branded credential references.
 * @throws {Error} when a grant names something that is not a credential reference.
 */
function grantsOf(entries: ProviderEntry[], index: number): ProviderGrant[] {
  return entries.map((entry) => {
    if (!isCredentialRefName(entry.credential)) {
      refuse(index, `provider ${JSON.stringify(entry.provider)} names ${JSON.stringify(entry.credential)}, which is not a credential reference`)
    }
    return {
      provider: entry.provider,
      credential: credentialRef(entry.credential),
      ...entry.baseUrl === undefined ? {} : { baseUrl: entry.baseUrl },
    }
  })
}

/**
 * Read one row as a complete tenant configuration.
 * @param entry - the configured row.
 * @param index - position of the row, for refusals.
 * @returns the configuration, with every modality present.
 * @throws {Error} when the row's tenant id or a credential reference is malformed.
 */
function configOf(entry: ResolvedEntry, index: number): TenantConfig {
  if (!TENANT_ID_SYNTAX.test(entry.tenantId)) {
    refuse(index, `tenantId ${JSON.stringify(entry.tenantId)} is not 1-64 characters of letters, digits, "-", or "_"`)
  }
  const models = Object.fromEntries(
    MODALITIES.map(modality => [modality, modalityOf(entry.models[modality])]),
  ) as Record<Modality, ModalityModels>
  // The schema materializes an absent identity and copy as empty, which says
  // the same thing as omitting them: this tenant contributes no identity text
  // and overrides no copy.
  const constraints = entry.identity?.constraints ?? []
  const personality = entry.identity?.personality
  const copy = entry.copy
  return {
    tenantId: TenantId(entry.tenantId),
    models,
    providers: grantsOf(entry.providers, index),
    features: entry.features,
    ...constraints.length === 0 && personality === undefined ? {} : {
      identity: { constraints, ...personality === undefined ? {} : { personality } },
    },
    ...Object.keys(copy).length === 0 ? {} : { copy },
  }
}

/** The `ctx.tenantConfig` implementation reading its rows from composition config. */
export default class StaticTenantConfigStore extends TenantConfigStore {
  static Config: z<Config> = z.object({
    tenants: z.array(z.object({
      tenantId: z.string().required(),
      providers: z.array(z.object({
        provider: z.string().required(),
        credential: z.string().role('credential-ref').required(),
        baseUrl: z.string(),
      })).default([]),
      models: z.object({
        language: modalityEntry,
        image: modalityEntry,
        video: modalityEntry,
        music: modalityEntry,
      }),
      features: z.array(z.string()).default([]),
      identity: z.union([z.object({
        constraints: z.array(z.string()).default([]),
        personality: z.string(),
      }), z.const(null)]),
      copy: z.dict(z.string()),
    })).required(),
  })

  private readonly byTenant = new Map<string, TenantConfig>()

  /**
   * @param ctx - the host context.
   * @param config - the validated rows.
   * @throws {Error} when the roster is empty, a row is malformed, a tenant is configured twice,
   * or a row breaks a rule `validateTenantConfig` states.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    if (config.tenants.length === 0) {
      throw new Error('tenant-config-static: the roster configures no tenant; a mounted store configures at least one')
    }
    // The schema applied its defaults before the constructor ran; the cast
    // records that once rather than defaulting a second time behind its back.
    for (const [index, entry] of (config.tenants as ResolvedEntry[]).entries()) {
      if (this.byTenant.has(entry.tenantId)) refuse(index, `configures tenant ${JSON.stringify(entry.tenantId)} a second time`)
      const tenant = configOf(entry, index)
      const problems = validateTenantConfig(tenant)
      if (problems.length > 0) refuse(index, `is unusable: ${problems.join('; ')}`)
      this.byTenant.set(entry.tenantId, tenant)
    }
  }

  /**
   * Read one tenant's configuration.
   * @param tenantId - the tenant.
   * @returns the configuration, or undefined when no row configures that tenant.
   */
  get(tenantId: TenantConfig['tenantId']): Promise<TenantConfig | undefined> {
    return Promise.resolve(this.byTenant.get(tenantId))
  }

  /**
   * This backend reads composition config, which this process does not write.
   * @returns the read-only capability.
   */
  capability(): TenantConfigCapability {
    return { kind: 'read-only' }
  }
}
