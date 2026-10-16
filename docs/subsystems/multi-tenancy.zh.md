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

`ctx.tenantConfig` 读取一个租户为自己配置的内容，由 [lyn-tenant-config](../../packages/tenant/tenant-config) 定义，其支撑要么是组合配置中的行（[lyn-tenant-config-static](../../packages/tenant/tenant-config-static)），要么是存储域中的记录（[lyn-tenant-config-store](../../packages/tenant/tenant-config-store)）。私有化部署与 SaaS 租户的配置方式完全相同，只是它只有一个租户。租户在此不配置的是品牌——标志、字标、favicon、产品名——那属于部署。

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

两种后端是二选一，而不是分层：一个 context 只挂载一个存储。持久化的那个把一个租户的整份配置存成 `tenant_config` 存储域里的一条记录，因此保存一个租户只重写该租户；修改配置是一次保存，而不是改补丁层再重启。

## 通过 RPC 配置租户

`ctx.remote.tenant` 是管理界面读写租户配置的入口（[lyn-api-tenant-controller](../../packages/api/tenant-controller)）。`describe` 答复调用方租户自己的配置——模型、以凭据引用形式出现的授权、功能、身份、文案——外加 `writable`（本部署的后端是否接受保存）与 `configured`（区分「什么都没保存过的租户」与「把一切都保存为空的租户」）。`save` 整份替换配置；`TenantConfigInput` 不携带租户 id，因为租户就是这次调用所属的那个。

租户永远不是方法参数。能指名自己租户的调用方也就能指名任何租户，因此两个方法都读 `ctx.requestTenant`，并以 `tenant/unresolved` 拒绝没有命名租户的调用。其余拒绝是：wire 字段不合法为 `gateway/bad-request`，未挂载存储为 `gateway/internal`，存储不接受保存为 `tenant/read-only`，能力缝规则拒绝该配置为 `tenant/rejected`（一次列出全部问题）。

它目前还管不到的是：组织内部谁有权保存。现有的唯一规则是调用方只能配置自己的组织；把保存限制给管理员需要用户记录。

## 在会话日志里

会话会记录它属于哪个租户，以及该租户贡献的身份文本——这是在创建时写入一次的仅日志事件 `tenant/identity`（[lyn-tenant-session](../../packages/tenant/tenant-session)，生成条目见[持久化目录](../persistence-catalog.zh.md#tenantidentity--log-only)）。归属要求会话结束很久之后仍能说清租户；重建要求记录文本本身，因为它会进入模型请求，而租户之后修改配置会让这个会话无法还原。fork 出来的会话与被恢复的会话保留其创建时的记录，`tenant` 会话投影把它折叠回来。

挂载了 [lyn-tenant-request](../../packages/tenant/tenant-request) 时，租户来自创建该会话的那个请求；否则来自插件配置。Remote 方法不携带自己到达时的请求，因此该插件在 Connection 上注册一个每请求作用域，在调用到达时一次性解析出租户与其配置，并在调用期间以 `ctx.requestTenant` 发布二者——这正是同步的会话创建监听器能读到它们的原因。在调用之外创建的会话仍以配置的租户为准：CLI 运行、恢复的会话、子 Agent。

## 租户清单

从组合配置读取的后端在加载时建立索引：id、标识、显示名，以及该租户被服务的主机名。它会拒绝没有任何租户的清单、格式不合法的行，以及两行争用同一个 id、标识或主机名，并按位置点名是哪一行——有歧义的清单会把请求解析到最后建索引的那一行。数据库支撑的目录可以替换这一行，而无需改动能力缝。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxactingcontext--actingcontextresolver"></a>

### `ctx.actingContext` — `ActingContextResolver`

Resolves a declared context against the directory, or refuses it.

```ts cordis-catalog
/**
 * Check one call's claim and return the context it acts in.
 * @param claim - who the caller is, what they declared, and what the address resolved to.
 * @returns the permitted acting context.
 * @throws {ActingContextRefused} when any of the three rules refuses it.
 */
async resolve(claim: ActingContextClaim): Promise<ActingContext>
```

Source: [`packages/identity/acting-context/src/index.ts`](../../packages/identity/acting-context/src/index.ts)

<a id="ctxauthsessions--authsessionstore-abstract-seam"></a>

### `ctx.authSessions` — `AuthSessionStore` (abstract seam)

Abstract store of signed-in sessions. Subclass and implement the four operations for one source of truth; a deployment mounts exactly one.

```ts cordis-catalog
/**
 * Establish a session for a person who has just proved who they are.
 *
 * The session opens on that person's personal context rather than on a
 * membership, because opening on a standing would be the guess this design
 * exists to avoid — even when the person holds exactly one.
 * @param request - who signed in, how, and for how long.
 * @returns the established session.
 */
abstract establish(request: EstablishRequest): Promise<SignedInSession>

/**
 * Read one session by its bearer identity.
 * @param id - the bearer identity presented by a caller.
 * @returns the session.
 * @throws {SessionUnavailable} when no session carries that identity, or it has lapsed.
 */
abstract read(id: AuthSessionId): Promise<SignedInSession>

/**
 * Change the context one session acts in.
 *
 * The new context is checked before it is stored, so a session can never
 * hold a context its person may not act in — which would turn one bad
 * switch into every later call being wrong.
 * @param id - the session to change.
 * @param acting - the context to put in force, already checked.
 * @returns the session with its new context.
 * @throws {SessionUnavailable} when no session carries that identity, or it has lapsed.
 */
abstract switchContext(id: AuthSessionId, acting: ActingContext): Promise<SignedInSession>

/**
 * End one session.
 *
 * Ending a session ends the bearer credential, not the identity: the person
 * still exists and still holds every standing they held.
 * @param id - the session to end.
 * @returns true when a session was ended, false when none carried that identity.
 */
abstract revoke(id: AuthSessionId): Promise<boolean>
```

Source: [`packages/identity/auth-session/src/index.ts`](../../packages/identity/auth-session/src/index.ts)

<a id="ctxcreditadministration--creditadministration"></a>

### `ctx.creditAdministration` — `CreditAdministration`

Administrator credit decisions, authorized against the standing making them.

```ts cordis-catalog
/**
 * Add credits to one person, on behalf of one standing.
 * @param request - who receives them, how many, and when they lapse.
 * @param by - the standing making the grant.
 * @returns the recorded grant.
 * @throws {Error} when the amount is not positive, or that standing may not administer that person.
 */
async grant(request: AdministratorGrant, by: Membership): Promise<CreditGrant>

/**
 * Set or replace one allowance override, on behalf of one standing.
 *
 * An override for a whole organization is a decision about that
 * organization, so it is authorized against the organization itself; one for
 * a person is authorized against that person's standings.
 * @param change - what to change, and whose allowance it applies to.
 * @param by - the standing making the change.
 * @throws {Error} when the change names neither an organization nor a person, or that standing may not administer it.
 */
async setAllowance(change: AllowanceChange, by: Membership): Promise<void>

/**
 * The overrides that reach one person.
 *
 * Read without an authority check because this is what the ledger itself
 * calls to work out a periodic grant; the decision it reports was already
 * authorized when it was made.
 * @param person - whose allowance to resolve.
 * @returns the organization-wide and person-specific overrides, where they exist.
 */
async overridesFor(person: PersonId): Promise<PersonOverrides>

/**
 * Whether one standing may act on one person's credits.
 *
 * A tenant administrator reaches a person only through a standing they share
 * an organization with. Resolving that through the directory rather than
 * trusting a caller-supplied organization is the point: the caller names who
 * to act on, never the authority to do it.
 *
 * Public because a surface that shows one person's ledger to another answers
 * the same question a grant does, and two copies of this rule would be one
 * rule too many.
 * @param by - the standing asking.
 * @param person - the person it would affect.
 * @returns true when that standing may administer that person.
 */
async mayAdminister(by: Membership, person: PersonId): Promise<boolean>
```

Source: [`packages/credits/credits/src/administration.ts`](../../packages/credits/credits/src/administration.ts)

<a id="ctxcredits--creditledger-abstract-seam"></a>

### `ctx.credits` — `CreditLedger` (abstract seam)

Abstract credit ledger. Subclass and implement the four operations for one source of truth; a hosted deployment mounts exactly one.

```ts cordis-catalog
/**
 * What one person may spend now.
 * @param person - whose balance to read.
 * @returns the balance, including what it is made of.
 */
abstract balance(person: PersonId): Promise<CreditBalance>

/**
 * Spend credits, or refuse when the balance cannot cover it.
 *
 * Refusing rather than overdrawing is the whole point: an overdraw is a cost
 * the operator did not agree to, and a person who can exceed a balance has
 * no balance.
 * @param request - whose credits, how many, and which session.
 * @returns the recorded debit.
 * @throws {CreditsExhausted} when the available balance cannot cover the amount.
 */
abstract spend(request: SpendRequest): Promise<CreditDebit>

/**
 * Add credits to one person.
 * @param request - who receives them, how many, why, and when they lapse.
 * @returns the recorded grant.
 */
abstract grant(request: GrantRequest): Promise<CreditGrant>

/**
 * Everything granted to and spent by one person, newest first.
 *
 * The ledger is the product rather than an implementation detail: a
 * customer reviewing a refusal reads this, and a balance they cannot
 * account for is a support case.
 * @param person - whose history to read.
 * @returns the grants and debits recorded for them.
 */
abstract history(person: PersonId): Promise<{ readonly grants: readonly CreditGrant[] readonly debits: readonly CreditDebit[] }>
```

Source: [`packages/credits/credits/src/index.ts`](../../packages/credits/credits/src/index.ts)

<a id="ctxcreditscontroller--creditscontroller"></a>

### `ctx.creditsController` — `CreditsController`

Host service backing the generated `ctx.remote.credits` namespace.

```ts cordis-catalog
/**
 * Read the calling person's own account.
 * @returns their balance and ledger, and whether they may administer anyone.
 * @throws {RemoteError} `credits/anonymous` when the call presented no identity,
 * or `credits/unavailable` when this deployment mounts no ledger.
 */
@Remote async mine(): Promise<CreditAccountView>

/**
 * Read one person's account as an administrator.
 * @param person - whose account to read.
 * @returns their balance and ledger.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or
 * `credits/not-permitted` when the calling standing may not act on that person.
 */
@Remote async account(person: string): Promise<CreditAccountView>

/**
 * Add credits to one person.
 * @param input - who receives them, how many, and when they lapse.
 * @returns that person's account as the ledger now reads it.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`,
 * `gateway/bad-request` for invalid fields, `credits/not-permitted`, or
 * `credits/rejected` when the administration seam refuses the grant.
 */
@Remote async grant(input: CreditGrantInput): Promise<CreditAccountView>

/**
 * Set or replace one recurring-allowance override.
 * @param input - what to change, and whose allowance it applies to.
 * @returns the overrides now reaching the named person, or the setter when the change was organization-wide.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`,
 * `gateway/bad-request` for invalid fields, `credits/not-permitted`, or
 * `credits/rejected` when the change names neither an organization nor a person.
 */
@Remote async setAllowance(input: AllowanceInput): Promise<AllowanceView>

/**
 * Read the overrides reaching one person.
 * @param person - whose allowance to resolve.
 * @returns the organization-wide and person-specific overrides, and the periods a form may offer.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or `credits/not-permitted`.
 */
@Remote async allowance(person: string): Promise<AllowanceView>
```

Source: [`packages/api/credits-controller/src/index.ts`](../../packages/api/credits-controller/src/index.ts)

<a id="ctxcreditsubject--creditsubject-abstract-seam"></a>

### `ctx.creditSubject` — `CreditSubject` (abstract seam)

Resolves the person a request is charged to.

```ts cordis-catalog
/**
 * The person the request being served is charged to.
 *
 * Undefined is a real answer, not a failure: a deployment's own maintenance
 * work, a replay in a test, and a seeded session all issue requests that
 * belong to nobody. Charging them to whoever happens to be signed in would
 * be worse than not charging them.
 * @returns the person to charge, or undefined when the request belongs to none.
 */
abstract current(): Promise<PersonId | undefined>
```

Source: [`packages/credits/credits/src/subject.ts`](../../packages/credits/credits/src/subject.ts)

<a id="ctxdesktoplink--desktoplink"></a>

### `ctx.desktopLink` — `DesktopLink`

Links to signed-in people's own machines.

```ts cordis-catalog
/**
 * Whether this person currently has a desktop connected.
 * @param person - whose machine to ask about.
 * @returns true while a desktop is attached for them.
 */
reachable(person: PersonId): boolean

/**
 * Serve one desktop: yield the work asked of it until its stream ends.
 *
 * One link per person, and a second connection replaces the first rather
 * than joining it. Two machines answering for one person would make "run
 * this command on my laptop" ambiguous, and the newest connection is the
 * one the person is sitting at.
 * @param person - the signed-in person this desktop belongs to.
 * @param replies - the uplink the desktop answers on.
 * @param signal - ends the link when the carrier does.
 * @returns the requests this desktop should perform.
 */
async *serve( person: PersonId, replies: AsyncIterable<DesktopReply>, signal: AbortSignal, ): AsyncIterable<DesktopRequest>

/**
 * Ask one person's desktop to perform an operation.
 *
 * The result is an iterable because a call may produce many items before it
 * finishes — a command's output arrives as it is produced, not after. A
 * caller that wants only the final value iterates to the end.
 * @param person - whose machine to reach.
 * @param capability - the capability the call belongs to.
 * @param operation - the operation within it.
 * @param payload - the operation's arguments.
 * @param signal - cancels the call on the desktop.
 * @returns each item the desktop sent, then its final value.
 * @throws {DesktopUnavailable} when no desktop is connected, the desktop is lost, or the call fails there.
 */
async *call( person: PersonId, capability: string, operation: string, payload: JsonValue, signal?: AbortSignal, ): AsyncIterable<JsonValue>
```

Source: [`packages/api/desktop-link/src/index.ts`](../../packages/api/desktop-link/src/index.ts)

<a id="ctxpeople--peopledirectory-abstract-seam"></a>

### `ctx.people` — `PeopleDirectory` (abstract seam)

Abstract people directory. Subclass and implement the three lookups for one source of truth; a deployment mounts exactly one.

A deployment that mounts none has no identities, which is what a single-operator developer install is: it is its own administrator.

```ts cordis-catalog
/**
 * One person by identity.
 * @param id - the person's stable identity.
 * @returns the person, or undefined when no such identity exists.
 */
abstract person(id: PersonId): Promise<Person | undefined>

/**
 * One standing by identity.
 * @param id - the membership's stable identity.
 * @returns the standing, or undefined when no such standing exists.
 */
abstract membership(id: MembershipId): Promise<Membership | undefined>

/**
 * Every standing one person holds.
 *
 * Returned rather than filtered by organization because a surface offering a
 * context switch needs all of them, and an authorization check needs the one
 * the call named — neither is served by a per-organization query.
 * @param person - the person whose standings to list.
 * @returns their standings, in a stable order.
 */
abstract memberships(person: PersonId): Promise<readonly Membership[]>
```

Source: [`packages/identity/people/src/index.ts`](../../packages/identity/people/src/index.ts)

<a id="ctxrequestprincipal--requestprincipal"></a>

### `ctx.requestPrincipal` — `RequestPrincipal`

Resolves and publishes the principal of the call in progress.

```ts cordis-catalog
/**
 * Who the call in progress is.
 * @returns the principal, or undefined outside a call and for a call presenting no live session.
 */
current(): Principal | undefined
```

Source: [`packages/identity/request-principal/src/index.ts`](../../packages/identity/request-principal/src/index.ts)

<a id="ctxrequesttenant--requesttenantreader"></a>

### `ctx.requestTenant` — `RequestTenantReader`

What a consumer may do with the tenant of the call in progress.

```ts cordis-catalog
/**
 * The tenant of the call in progress.
 * @returns the resolved tenant, or undefined outside a call and for a call that named none.
 */
current(): RequestTenant | undefined
```

Source: [`packages/tenant/tenant-request/src/types.ts`](../../packages/tenant/tenant-request/src/types.ts)

<a id="ctxsignin--signin"></a>

### `ctx.signIn` — `SignIn`

The channels a deployment offers, and the sign-in they perform.

Sessions and the admission rule are injected rather than read optionally: without either, a sign-in has nowhere to put its result or no rule for who may have one, and in both cases the right behaviour is to offer no sign-in at all rather than one that admits everybody.

```ts cordis-catalog
/**
 * Offer one channel as a sign-in option.
 *
 * Two channels of one id is a composition mistake rather than a runtime
 * condition — a sign-in page would show two identical buttons leading to
 * different directories — so it fails at registration.
 * @param channel - the channel to offer.
 * @returns the disposer; the registering plugin owns it.
 * @throws {Error} when a channel of that id is already registered.
 */
register(channel: SignInChannel): () => Promise<void>

/**
 * The channels a surface may offer, in registration order.
 * @returns each mounted channel's id and display name.
 */
available(): readonly ChannelDescription[]

/**
 * Begin a sign-in through one channel.
 *
 * A self-driven channel has a session by the time this returns; a redirect
 * channel has only said where to send the browser, and {@link resume}
 * finishes it. Both shapes reach the same admission and the same session,
 * because the decision about who may use this deployment must not depend on
 * which kind of client someone signed in from.
 * @param channel - the channel the person chose.
 * @param returnTo - the deployment's own callback address; a self-driven channel ignores it.
 * @returns their new session, or where to send the browser.
 * @throws {SignInRefused} when the channel is unknown, the directory did not
 * complete, or this deployment admits them as nobody.
 */
async begin(channel: ChannelId, returnTo: string): Promise<SignInOutcome>

/**
 * Finish the sign-in a redirect channel's directory is returning from.
 * @param channel - the channel that started it.
 * @param parameters - the query the directory came back with.
 * @returns the bearer identity of their new session.
 * @throws {SignInRefused} when the channel is unknown or self-driven, the return
 * completes no sign-in, or this deployment admits them as nobody.
 */
async resume(channel: ChannelId, parameters: URLSearchParams): Promise<AuthSessionId>
```

Source: [`packages/identity/sign-in/src/index.ts`](../../packages/identity/sign-in/src/index.ts)

<a id="ctxsigninadmission--signinadmission-abstract-seam"></a>

### `ctx.signInAdmission` — `SignInAdmission` (abstract seam)

Abstract admission rule. Subclass and implement the one decision; a deployment mounts exactly one.

```ts cordis-catalog
/**
 * The person an authenticated subject is, if this deployment admits them.
 *
 * Undefined refuses the sign-in. It is deliberately the same answer for
 * "this directory is not one we accept" and "this person is not on the
 * roster": a sign-in page that distinguished them would report, to whoever
 * asked, which addresses exist here.
 * @param subject - the subject a channel verified.
 * @returns the person they are here, or undefined when this deployment admits them as nobody.
 */
abstract admit(subject: ExternalSubject): Promise<PersonId | undefined>
```

Source: [`packages/identity/sign-in/src/admission.ts`](../../packages/identity/sign-in/src/admission.ts)

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

<a id="ctxtenantcontroller--tenantcontroller"></a>

### `ctx.tenantController` — `TenantController`

Host service backing the generated `ctx.remote.tenant` namespace.

Every method answers about the calling tenant and refuses a call that named none, because there is no tenant whose configuration it could be shown.

```ts cordis-catalog
/**
 * Read the calling tenant's own configuration.
 * @returns who the caller is, whether this deployment accepts saves, and the configuration.
 * @throws {RemoteError} `tenant/unresolved` when the call named no tenant.
 */
@Remote describe(): TenantConfigView

/**
 * Replace the calling tenant's whole configuration.
 * @param input - the complete configuration to store; it names no tenant, because the call already does.
 * @returns the configuration as the store now reads it.
 * @throws {RemoteError} `tenant/unresolved`, `gateway/bad-request` for invalid fields,
 * `gateway/internal` when no store is mounted, `tenant/read-only` when the store refuses saves,
 * or `tenant/rejected` when a seam rule refuses the configuration.
 */
@Remote async save(input: TenantConfigInput): Promise<TenantConfigView>
```

Source: [`packages/api/tenant-controller/src/index.ts`](../../packages/api/tenant-controller/src/index.ts)

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
