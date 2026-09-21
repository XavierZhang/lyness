/**
 * Host Remote owner of the `tenant` namespace: the calling tenant reads and
 * saves its own configuration.
 *
 * Both methods act for the tenant the call arrived for, never for a tenant the
 * caller names. That is the whole authorization story available today: a
 * deployment has organizations but no members, so "the caller may configure its
 * own organization" is the only rule there is anything to enforce it with.
 * Restricting saves to administrators waits for user records.
 *
 * A save replaces the tenant's whole configuration. It is checked here twice —
 * the wire fields, then the seam's own rules — so the caller receives every
 * problem in one answer and a form marks every field at once. The backend
 * checks the same rules again for every other caller it has.
 * @module @lyness/lyn-api-tenant-controller
 */

import { Context } from '@lyness/cordis'
import { credentialRef, isCredentialRefName } from '@lyness/lyn-credentials'
import type { TenantId } from '@lyness/lyn-tenant'
import { MODALITIES, validateTenantConfig } from '@lyness/lyn-tenant-config'
import type {
  Modality, ModalityModels, ModelChoice, ProviderGrant, TenantConfig,
} from '@lyness/lyn-tenant-config'
import type { RequestTenant } from '@lyness/lyn-tenant-request/types'
import { Remote, RemoteError, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import { z } from 'zod'
import type {
  TenantConfigInput, TenantConfigView, TenantIdentityView, TenantModalityView, TenantModelView, TenantProviderView,
} from './types.ts'

export type * from './types.ts'

const modelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1).optional(),
})

const modalitySchema = z.object({
  available: z.array(modelSchema),
  preferred: modelSchema.optional(),
})

const inputSchema = z.object({
  models: z.record(z.enum(MODALITIES), modalitySchema),
  providers: z.array(z.object({
    provider: z.string().min(1),
    credential: z.string().refine(isCredentialRefName, 'not a credential reference'),
    baseUrl: z.string().min(1).optional(),
  })),
  features: z.array(z.string().min(1)),
  identity: z.object({
    constraints: z.array(z.string().min(1)),
    personality: z.string().min(1).optional(),
  }).optional(),
  copy: z.record(z.string().min(1), z.string()).optional(),
})

declare module '@lyness/cordis' {
  interface Context {
    /** Host owner of the `tenant` Remote namespace. */
    tenantController: TenantController
  }
}

/**
 * Project one model onto its wire view, dropping an absent optional rather
 * than serializing it as `undefined`.
 * @param model - the configured model choice.
 * @returns the wire model.
 */
function modelView(model: ModelChoice): TenantModelView {
  return {
    provider: model.provider,
    model: model.model,
    ...model.reasoningEffort === undefined ? {} : { reasoningEffort: model.reasoningEffort },
  }
}

/**
 * Project one modality onto its wire view.
 * @param models - the configured modality, or undefined for an unconfigured tenant.
 * @returns the wire modality.
 */
function modalityView(models: ModalityModels | undefined): TenantModalityView {
  const preferred = models?.preferred
  return {
    available: (models?.available ?? []).map(modelView),
    ...preferred === undefined ? {} : { preferred: modelView(preferred) },
  }
}

/**
 * Project one grant onto its wire view. The reference name crosses; the value never does.
 * @param grant - the configured grant.
 * @returns the wire grant.
 */
function providerView(grant: ProviderGrant): TenantProviderView {
  return {
    provider: grant.provider,
    credential: grant.credential,
    ...grant.baseUrl === undefined ? {} : { baseUrl: grant.baseUrl },
  }
}

/**
 * Project the identity text onto its wire view.
 * @param identity - the configured identity, or undefined.
 * @returns the wire identity, or undefined when the tenant contributes none.
 */
function identityView(identity: TenantConfig['identity']): TenantIdentityView | undefined {
  if (identity === undefined) return undefined
  return {
    constraints: [...identity.constraints],
    ...identity.personality === undefined ? {} : { personality: identity.personality },
  }
}

/** Validated wire input, as the schema parses it. */
type ParsedInput = z.output<typeof inputSchema>

/**
 * Read one modality out of validated wire input.
 * @param models - the validated per-modality map.
 * @param modality - the modality to read.
 * @returns the seam's modality value.
 */
function modalityOf(models: ParsedInput['models'], modality: Modality): ModalityModels {
  const entry = models[modality]
  return {
    available: entry.available.map(model => ({ ...model })),
    ...entry.preferred === undefined ? {} : { preferred: { ...entry.preferred } },
  }
}

/**
 * Keep an identity only when it says something.
 * @param identity - the validated wire identity, or undefined.
 * @returns the seam's identity, or undefined when the tenant contributes none.
 */
function identityOf(identity: ParsedInput['identity']): TenantConfig['identity'] {
  if (identity === undefined) return undefined
  if (identity.constraints.length === 0 && identity.personality === undefined) return undefined
  return {
    constraints: [...identity.constraints],
    ...identity.personality === undefined ? {} : { personality: identity.personality },
  }
}

/**
 * Host service backing the generated `ctx.remote.tenant` namespace.
 *
 * Every method answers about the calling tenant and refuses a call that named
 * none, because there is no tenant whose configuration it could be shown.
 */
export default class TenantController extends TypertRemoteService {
  /**
   * Register the tenant namespace.
   * @param ctx - Host context where the request scope and a configuration backend may be mounted.
   */
  constructor(ctx: Context) {
    super(ctx, 'tenantController', { namespace: 'tenant' })
  }

  /**
   * Read the calling tenant's own configuration.
   * @returns who the caller is, whether this deployment accepts saves, and the configuration.
   * @throws {RemoteError} `tenant/unresolved` when the call named no tenant.
   */
  @Remote
  describe(): TenantConfigView {
    const current = this.calling()
    return this.view(current, current.config)
  }

  /**
   * Replace the calling tenant's whole configuration.
   * @param input - the complete configuration to store; it names no tenant, because the call already does.
   * @returns the configuration as the store now reads it.
   * @throws {RemoteError} `tenant/unresolved`, `gateway/bad-request` for invalid fields,
   * `gateway/internal` when no store is mounted, `tenant/read-only` when the store refuses saves,
   * or `tenant/rejected` when a seam rule refuses the configuration.
   */
  @Remote
  async save(input: TenantConfigInput): Promise<TenantConfigView> {
    const current = this.calling()
    const tenantId = current.tenant.id
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) {
      const problems = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
      throw new RemoteError(
        'gateway/bad-request',
        `tenant configuration is invalid: ${problems.join('; ')}`,
        { issues: [] },
      )
    }
    const store = this.ctx.get('tenantConfig')
    if (store === undefined) {
      throw new RemoteError('gateway/internal', 'this deployment mounts no tenant-configuration store', {})
    }
    const config = configOf(tenantId, parsed.data)
    // The seam's own rules, checked here so the caller gets the whole list at
    // once; the backend checks them again for every other caller it has.
    const problems = validateTenantConfig(config)
    if (problems.length > 0) {
      throw new RemoteError('tenant/rejected', `tenant configuration is unusable: ${problems.join('; ')}`, { tenantId, problems })
    }
    const capability = store.capability()
    if (capability.kind !== 'writable') {
      throw new RemoteError(
        'tenant/read-only',
        'this deployment stores tenant configuration outside the process',
        { tenantId },
      )
    }
    try {
      await capability.save(config)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new RemoteError('tenant/rejected', message, { tenantId, problems: [message] }, { cause: error })
    }
    // Read back rather than echoing the input: the store is the authority on
    // what it kept, and a caller that trusts the echo would show what it sent.
    return this.view(current, await store.get(tenantId))
  }

  /**
   * The tenant this call may act for.
   * @returns the resolved tenant and its configuration.
   * @throws {RemoteError} `tenant/unresolved` when the call named no tenant.
   */
  private calling(): RequestTenant {
    const current = this.ctx.get('requestTenant')?.current()
    if (current === undefined) {
      throw new RemoteError('tenant/unresolved', 'this request names no tenant', {})
    }
    return current
  }

  /**
   * Project one tenant and one configuration onto the wire view.
   * @param current - the calling tenant.
   * @param config - its configuration, or undefined when it has none.
   * @returns the view this namespace answers with.
   */
  private view(current: RequestTenant, config: TenantConfig | undefined): TenantConfigView {
    const identity = identityView(config?.identity)
    return {
      tenantId: current.tenant.id,
      slug: current.tenant.slug,
      displayName: current.tenant.displayName,
      writable: this.ctx.get('tenantConfig')?.capability().kind === 'writable',
      configured: config !== undefined,
      models: Object.fromEntries(MODALITIES.map(modality => [modality, modalityView(config?.models[modality])])),
      providers: (config?.providers ?? []).map(providerView),
      features: [...config?.features ?? []],
      ...identity === undefined ? {} : { identity },
      copy: { ...config?.copy },
    }
  }
}

/**
 * Build the seam's configuration from validated wire input.
 * @param tenantId - the calling tenant.
 * @param input - validated wire fields.
 * @returns the configuration to store.
 */
function configOf(tenantId: TenantId, input: ParsedInput): TenantConfig {
  const identity = identityOf(input.identity)
  const copy = input.copy ?? {}
  return {
    tenantId,
    models: Object.fromEntries(MODALITIES.map(modality =>
      [modality, modalityOf(input.models, modality)])) as Record<Modality, ModalityModels>,
    providers: input.providers.map((grant): ProviderGrant => ({
      provider: grant.provider,
      credential: credentialRef(grant.credential),
      ...grant.baseUrl === undefined ? {} : { baseUrl: grant.baseUrl },
    })),
    features: [...input.features],
    ...identity === undefined ? {} : { identity },
    ...Object.keys(copy).length === 0 ? {} : { copy: { ...copy } },
  }
}
