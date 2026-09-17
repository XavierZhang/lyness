# 多租户

[English](multi-tenancy.md) | 中文

部署服务哪些租户，以及一个请求属于哪一个。租户是一个组织，其数据、配置与凭据与其他所有租户彼此分开；本子系统只拥有租户的身份与找到它的查找。`ctx.tenants` 是提供三种查法的目录，由 [lyn-tenant](../../packages/tenant/tenant) 定义，由组合配置中的清单支撑（[lyn-tenant-static](../../packages/tenant/tenant-static)），并由 [lyn-tenant-http](../../packages/tenant/tenant-http) 在 HTTP 上消费。三者都不挂载的部署即单租户，其余部分毫无变化。

来源：[`packages/tenant/tenant/src/index.ts`](../../packages/tenant/tenant/src/index.ts)

## 租户

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

`TenantId(value)` 把字符串标记为 id，并拒绝任何在请求头、路径段或存储键中需要转义的值：1～64 个字母、数字、`-` 或 `_`。`isTenantSlug(value)` 只接受一个小写 DNS 标签，因此标识也可以作子域名。

## 解析请求

目录对不认识的对象答复 `undefined`，且从不决定信任请求的哪一部分——那是调用方拥有的传输层知识，因为 `X-Tenant-ID` 在设置它的网关之后是权威的，在网关之前可被伪造。HTTP 调用方应用如下顺序：

| 顺序 | 来源 | 规则 |
|---|---|---|
| 1 | `X-Tenant-ID` | 声明的 id 优先。未知或格式不合法的 id 解析为无，而不继续回落，因为声明了租户的调用方不能被静默地服务成另一个租户。 |
| 2 | `Host` | 去掉端口并小写后的主机名，按某个租户声明的归属匹配。 |
| 3 | 子域名 | 所配置基础域名正下方的一个标签，与租户标识匹配。 |

解析不到的请求会被拒绝。没有兜底租户：租户是隔离边界，提供另一个组织的数据比什么都不提供更糟。`resolveTenant(directory, headers, baseDomain)` 已导出，因此第二个调用方无需路由即可应用同一顺序。

## 租户清单

从组合配置读取的后端在加载时建立索引：id、标识、显示名，以及该租户被服务的主机名。它会拒绝没有任何租户的清单、格式不合法的行，以及两行争用同一个 id、标识或主机名，并按位置点名是哪一行——有歧义的清单会把请求解析到最后建索引的那一行。数据库支撑的目录可以替换这一行，而无需改动能力缝。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
