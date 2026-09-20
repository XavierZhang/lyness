# Multi-Tenancy

English | [中文](multi-tenancy.zh.md)

Which tenants a deployment serves, and which one a request belongs to. A tenant is an organization whose data, configuration, and credentials stay separate from every other tenant's; this subsystem owns only its identity and the lookup that finds it. `ctx.tenants` is a directory of three lookups, provided by [lyn-tenant](../../packages/tenant/tenant), backed by a roster in composition config ([lyn-tenant-static](../../packages/tenant/tenant-static)), and consumed over HTTP by [lyn-tenant-http](../../packages/tenant/tenant-http). A deployment that mounts none of them is single-tenant, and nothing else changes.

Source: [`packages/tenant/tenant/src/index.ts`](../../packages/tenant/tenant/src/index.ts)

## The tenant

```ts type-equiv
/**
 * Identifies one tenant of this deployment.
 *
 * The id is opaque and immutable: it is neither the slug nor a hostname,
 * because both are presentation an operator may change, while every durable
 * record that names a tenant must keep resolving after such a change.
 */
type TenantId = Branded<'TenantId'>
```

```ts type-equiv
/** One tenant: an organization whose data, configuration, and credentials are separate from every other tenant's. */
interface Tenant {
  /** Immutable identity, the value durable records and wire payloads carry. */
  readonly id: TenantId
  /** Operator-facing handle, unique in the deployment; also the subdomain label a request can arrive on. */
  readonly slug: string
  /** Name shown to that tenant's users. */
  readonly displayName: string
}
```

`TenantId(value)` brands a string and refuses anything that would need escaping in a header, a path segment, or a storage key: 1–64 characters of letters, digits, `-`, or `_`. `isTenantSlug(value)` accepts one lowercase DNS label, so a slug can also be a subdomain.

## Resolving a request

The directory answers `undefined` for a subject it does not know, and never decides which part of a request to trust — that is transport knowledge a consumer owns, because `X-Tenant-ID` is authoritative behind a gateway that sets it and forgeable in front of one. The HTTP consumer applies this order:

| Order | Source | Rule |
|---|---|---|
| 1 | `X-Tenant-ID` | The stated id wins. An unknown or malformed id resolves to nothing rather than falling through, because a caller that stated a tenant must not silently be served another. |
| 2 | `Host` | The hostname without its port, lowercased, as a tenant claims it. |
| 3 | Subdomain | One label directly under a configured base domain, matched against tenant slugs. |

An unresolved request is refused. There is no fallback tenant: a tenant is an isolation boundary, so serving a different organization's data is worse than serving none. `resolveTenant(directory, headers, baseDomain)` is exported, so a second consumer applies the same order without a route.

## Tenant configuration

`ctx.tenantConfig` reads what one tenant configures for itself, provided by [lyn-tenant-config](../../packages/tenant/tenant-config) and backed by rows in composition config ([lyn-tenant-config-static](../../packages/tenant/tenant-config-static)). A private deployment configures the same way a SaaS tenant does; it simply has one tenant. What a tenant does not configure here is its brand — mark, wordmark, favicon, product name — which belongs to the deployment.

```ts type-equiv
/** Everything one tenant configures for itself. */
interface TenantConfig {
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
```

A grant carries a `CredentialRef`, never a key, so a configuration can be read, logged, and exported without carrying a secret; two tenants are isolated by naming different references. A grant may carry its own `baseUrl`, which is how a tenant reaches a model it runs itself. A tenant with no configuration reads as `undefined`, and an empty model list means that modality is unavailable — neither borrows the deployment's models, because a tenant that did would spend an account it never chose.

```ts type-equiv
/**
 * Identity text one tenant contributes to its own model requests.
 *
 * The two fields compose differently on purpose. Constraints accumulate down
 * the layers — platform, organization, user, agent — and no lower layer
 * removes one, so an organization's compliance rule survives whatever an agent
 * says about itself. Personality is the voice, which a lower layer replaces.
 */
interface TenantIdentity {
  /** Rules every request from this tenant carries; lower layers add to them and remove none. */
  readonly constraints: readonly string[]
  /** Voice this organization asks for, which an agent may replace with its own. */
  readonly personality?: string | undefined
}
```

Identity is shape here and nothing more: composing the layers into a prompt belongs with the session log, because anything that reaches a model request must be reconstructable from it. The layer between organization and agent is the user, which arrives when this deployment has user records.

Every backend validates against one rule set — a model's provider must be granted, a preferred model must be available, nothing repeats, and no id, constraint, or copy override is blank — so a read-only backend checks at load and a writable one checks before it saves. A backend states which it is through `capability()`, so an administration surface shows or hides saving rather than discovering it by failing.

## In the session log

A session records which tenant it belongs to and the identity text that tenant contributed, as the log-only `tenant/identity` event written once at creation ([lyn-tenant-session](../../packages/tenant/tenant-session), catalog entry in [persistence-catalog](../persistence-catalog.md#tenantidentity--log-only)). Attribution needs the tenant long after a session ends; reconstruction needs the text itself, because it reaches the model and a later edit to the tenant's configuration would otherwise leave the session unreadable. A fork or a resumed session keeps the record it was created with, and the `tenant` session projection folds it back.

The tenant comes from the plugin's configuration rather than from the request that created the session: session creation carries no tenant today, and the request-scoped path is separate work.

## The roster

The composition-configured backend indexes rows at load: id, slug, display name, and the hostnames the tenant is served on. It refuses a roster that names no tenant, a malformed row, and two rows claiming one id, slug, or hostname, naming the row by position — an ambiguous roster would resolve a request to whichever row was indexed last. A database-backed directory replaces this row without changing the seam.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxtenantconfig--tenantconfigstore-abstract-seam"></a>

### `ctx.tenantConfig` — `TenantConfigStore` (abstract seam)

Abstract tenant-configuration store. Subclass, implement the read and the capability, and load the subclass as a plugin — it registers as `ctx.tenantConfig` (one store per context; loading a second throws, cordis' standard duplicate-service behavior).

A tenant with no configuration reads as `undefined` rather than as an empty configuration: nothing configured and everything configured empty are the same answer to a consumer, and both mean the tenant may use nothing.

```ts cordis-catalog
/**
 * Read one tenant's configuration.
 * @param tenantId - the tenant.
 * @returns the configuration, or undefined when the tenant has none.
 */
abstract get(tenantId: TenantId): Promise<TenantConfig | undefined>

/**
 * Whether this backend can be saved to.
 * @returns the discriminated capability consumers switch on.
 */
abstract capability(): TenantConfigCapability
```

Source: [`packages/tenant/tenant-config/src/index.ts`](../../packages/tenant/tenant-config/src/index.ts)

<a id="ctxtenants--tenantdirectory-abstract-seam"></a>

### `ctx.tenants` — `TenantDirectory` (abstract seam)

Abstract tenant directory. Subclass, implement the three lookups, and load the subclass as a plugin — it registers as `ctx.tenants` (one directory per context; loading a second throws, cordis' standard duplicate-service behavior).

Every lookup answers `undefined` for an unknown subject rather than throwing: not finding a tenant is an ordinary outcome of resolving an arbitrary request, and the Consumer decides what refusing looks like on its transport. Lookups are asynchronous because a directory may be a database.

```ts cordis-catalog
/**
 * Look one tenant up by its immutable id.
 * @param id - the tenant id.
 * @returns the tenant, or undefined when this deployment serves no such tenant.
 */
abstract get(id: TenantId): Promise<Tenant | undefined>

/**
 * Look one tenant up by a hostname it is served on.
 * @param hostname - lowercase hostname without port.
 * @returns the tenant, or undefined when no tenant claims that hostname.
 */
abstract byHost(hostname: string): Promise<Tenant | undefined>

/**
 * Look one tenant up by its slug.
 * @param slug - the operator-facing handle, also the subdomain label.
 * @returns the tenant, or undefined when no tenant carries that slug.
 */
abstract bySlug(slug: string): Promise<Tenant | undefined>
```

Source: [`packages/tenant/tenant/src/index.ts`](../../packages/tenant/tenant/src/index.ts)
<!-- END GENERATED cordis-surface -->
