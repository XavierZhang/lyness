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

## The roster

The composition-configured backend indexes rows at load: id, slug, display name, and the hostnames the tenant is served on. It refuses a roster that names no tenant, a malformed row, and two rows claiming one id, slug, or hostname, naming the row by position — an ambiguous roster would resolve a request to whichever row was indexed last. A database-backed directory replaces this row without changing the seam.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
