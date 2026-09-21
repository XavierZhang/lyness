/**
 * The stored shape of one tenant's configuration: the seam's own vocabulary,
 * expressed as the schemas the storage domain validates every read against.
 */

import { z } from 'zod'
import type { ZodType } from 'zod'
import { credentialRef, isCredentialRefName } from '@lyness/lyn-credentials'
import { defineDomain, domainTable } from '@lyness/lyn-storage-domain'
import type { TenantId } from '@lyness/lyn-tenant'
import type { TenantConfig } from '@lyness/lyn-tenant-config'

const modelChoice = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().optional(),
})

const modality = z.object({
  available: z.array(modelChoice).default([]),
  preferred: modelChoice.optional(),
})

const providerGrant = z.object({
  provider: z.string().min(1),
  // Stored as the reference name; reading brands it back, so a record edited
  // by hand into something that is not a reference fails its read rather than
  // reaching a provider as a key.
  credential: z.string().refine(isCredentialRefName).transform(credentialRef),
  baseUrl: z.string().optional(),
})

const tenantIdentity = z.object({
  constraints: z.array(z.string()).default([]),
  personality: z.string().optional(),
})

/** One stored tenant configuration. */
export const tenantConfigRecord = z.object({
  tenantId: z.string().min(1),
  models: z.object({
    language: modality,
    image: modality,
    video: modality,
    music: modality,
  }),
  providers: z.array(providerGrant).default([]),
  features: z.array(z.string()).default([]),
  identity: tenantIdentity.optional(),
  copy: z.record(z.string(), z.string()).optional(),
})

/**
 * The tenant-configuration domain: one record per tenant, keyed by tenant id.
 *
 * `per-record` because a deployment's tenants are individually written and
 * individually disposable: saving one tenant's configuration must not rewrite
 * every other tenant's document.
 */
export const tenantConfigDomainSpec = defineDomain({
  name: 'tenant_config',
  version: 1,
  layout: 'per-record',
  tables: {
    tenants: domainTable<TenantId, TenantConfig>(tenantConfigRecord as unknown as ZodType<TenantConfig>),
  },
})
