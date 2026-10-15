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

`ctx.tenantConfig` reads what one tenant configures for itself, provided by [lyn-tenant-config](../../packages/tenant/tenant-config) and backed either by rows in composition config ([lyn-tenant-config-static](../../packages/tenant/tenant-config-static)) or by records in the storage domain ([lyn-tenant-config-store](../../packages/tenant/tenant-config-store)). A private deployment configures the same way a SaaS tenant does; it simply has one tenant. What a tenant does not configure here is its brand — mark, wordmark, favicon, product name — which belongs to the deployment.

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

The two backends are alternatives, not layers: one store is mounted per context. The durable one keeps a tenant's whole configuration as one record in the `tenant_config` domain, so saving one tenant rewrites that tenant alone, and changing a configuration is a save rather than a patch-layer edit and a restart.

## Configuring a tenant over RPC

`ctx.remote.tenant` is how an administration surface reads and writes a tenant's configuration ([lyn-api-tenant-controller](../../packages/api/tenant-controller)). `describe` answers the calling tenant's own configuration — models, grants as credential references, features, identity, copy — plus `writable`, which says whether this deployment's backend accepts a save, and `configured`, which distinguishes a tenant that has saved nothing from one that saved everything empty. `save` replaces the whole configuration; `TenantConfigInput` carries no tenant id, because the tenant is the one the call arrived for.

The tenant is never a method parameter. A caller that could name its own tenant could name any tenant, so both methods read `ctx.requestTenant` and refuse a call that named none with `tenant/unresolved`. The other refusals are `gateway/bad-request` for a malformed wire field, `gateway/internal` when no store is mounted, `tenant/read-only` when the store does not accept saves, and `tenant/rejected` when a seam rule refuses the configuration, listing every problem at once.

What this does not yet enforce is who inside an organization may save. The only rule available is that a caller configures its own organization; restricting saves to administrators needs user records.

## In the session log

A session records which tenant it belongs to and the identity text that tenant contributed, as the log-only `tenant/identity` event written once at creation ([lyn-tenant-session](../../packages/tenant/tenant-session), catalog entry in [persistence-catalog](../persistence-catalog.md#tenantidentity--log-only)). Attribution needs the tenant long after a session ends; reconstruction needs the text itself, because it reaches the model and a later edit to the tenant's configuration would otherwise leave the session unreadable. A fork or a resumed session keeps the record it was created with, and the `tenant` session projection folds it back.

The tenant comes from the request that created the session when [lyn-tenant-request](../../packages/tenant/tenant-request) is mounted, and otherwise from the plugin's configuration. Remote methods do not carry the request they arrived on, so that plugin registers a Connection request scope, resolves the tenant and its configuration once when the call arrives, and publishes both as `ctx.requestTenant` for the duration of the call — which is what lets the synchronous session-creation listener read them. The configured tenant stays the answer for every session created outside a call: a CLI run, a resumed session, a subagent.

## The roster

The composition-configured backend indexes rows at load: id, slug, display name, and the hostnames the tenant is served on. It refuses a roster that names no tenant, a malformed row, and two rows claiming one id, slug, or hostname, naming the row by position — an ambiguous roster would resolve a request to whichever row was indexed last. A database-backed directory replaces this row without changing the seam.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
 * Sign a person in through one channel.
 *
 * The session is established last, after both the directory and the
 * admission rule have answered, so a refused sign-in leaves no session
 * behind to be revoked.
 * @param channel - the channel the person chose.
 * @returns the bearer identity of their new session.
 * @throws {SignInRefused} when the channel is unknown, the directory did not complete, or this deployment admits them as nobody.
 */
async begin(channel: ChannelId): Promise<AuthSessionId>
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
