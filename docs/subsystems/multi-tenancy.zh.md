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

## 租户配置

`ctx.tenantConfig` 读取一个租户为自己配置的内容，由 [lyn-tenant-config](../../packages/tenant/tenant-config) 定义，并由组合配置中的行支撑（[lyn-tenant-config-static](../../packages/tenant/tenant-config-static)）。私有化部署与 SaaS 租户的配置方式完全相同，只是它只有一个租户。租户在此不配置的是品牌——标志、字标、favicon、产品名——那属于部署。

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

授权携带的是 `CredentialRef` 而不是密钥，因此配置可以被读取、记录与导出而不携带任何密文；两个租户通过指向不同引用实现隔离。授权可以带自己的 `baseUrl`，租户接入自建模型走的就是这条路。没有配置的租户读作 `undefined`，空的模型清单表示该模态不可用——两者都不会借用部署方的模型，否则租户会花掉一个自己从未选择的账号。

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

身份在这里只有形状：把各层合成进提示词属于会话日志那一侧，因为进入模型请求的内容必须能从会话日志重建。组织与 Agent 之间的那一层是用户，它要等本部署具备用户记录后才出现。

每个后端都据同一套规则校验——模型的供应商必须已授权、默认模型必须在可用清单内、不得重复，且 id、约束与文案覆盖不得为空——因此只读后端在加载时检查，可写后端在保存前检查。后端通过 `capability()` 说明自己属于哪一种，管理界面据此显示或隐藏保存，而不是靠失败去发现。

## 租户清单

从组合配置读取的后端在加载时建立索引：id、标识、显示名，以及该租户被服务的主机名。它会拒绝没有任何租户的清单、格式不合法的行，以及两行争用同一个 id、标识或主机名，并按位置点名是哪一行——有歧义的清单会把请求解析到最后建索引的那一行。数据库支撑的目录可以替换这一行，而无需改动能力缝。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
