# Multi-Tenancy

English | [中文](multi-tenancy.zh.md)

Which tenants a deployment serves, and which one a request belongs to. A tenant is an organization whose data, configuration, and credentials stay separate from every other tenant's; this subsystem owns only its identity and the lookup that finds it. `ctx.tenants` is a directory of three lookups, provided by [dsh-tenant](../../packages/tenant/tenant), backed by a roster in composition config ([dsh-tenant-static](../../packages/tenant/tenant-static)), and consumed over HTTP by [dsh-tenant-http](../../packages/tenant/tenant-http). A deployment that mounts none of them is single-tenant, and nothing else changes.

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

`ctx.tenantConfig` reads what one tenant configures for itself, provided by [dsh-tenant-config](../../packages/tenant/tenant-config) and backed either by rows in composition config ([dsh-tenant-config-static](../../packages/tenant/tenant-config-static)) or by records in the storage domain ([dsh-tenant-config-store](../../packages/tenant/tenant-config-store)). A private deployment configures the same way a SaaS tenant does; it simply has one tenant. What a tenant does not configure here is its brand — mark, wordmark, favicon, product name — which belongs to the deployment.

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

`ctx.remote.tenant` is how an administration surface reads and writes a tenant's configuration ([dsh-api-tenant-controller](../../packages/api/tenant-controller)). `describe` answers the calling tenant's own configuration — models, grants as credential references, features, identity, copy — plus `writable`, which says whether this deployment's backend accepts a save, and `configured`, which distinguishes a tenant that has saved nothing from one that saved everything empty. `save` replaces the whole configuration; `TenantConfigInput` carries no tenant id, because the tenant is the one the call arrived for.

The tenant is never a method parameter. A caller that could name its own tenant could name any tenant, so both methods read `ctx.requestTenant` and refuse a call that named none with `tenant/unresolved`. The other refusals are `gateway/bad-request` for a malformed wire field, `gateway/internal` when no store is mounted, `tenant/read-only` when the store does not accept saves, and `tenant/rejected` when a seam rule refuses the configuration, listing every problem at once.

What this does not yet enforce is who inside an organization may save. The only rule available is that a caller configures its own organization; restricting saves to administrators needs user records.

## In the session log

A session records which tenant it belongs to and the identity text that tenant contributed, as the log-only `tenant/identity` event written once at creation ([dsh-tenant-session](../../packages/tenant/tenant-session), catalog entry in [persistence-catalog](../persistence-catalog.md#tenantidentity--log-only)). Attribution needs the tenant long after a session ends; reconstruction needs the text itself, because it reaches the model and a later edit to the tenant's configuration would otherwise leave the session unreadable. A fork or a resumed session keeps the record it was created with, and the `tenant` session projection folds it back.

The tenant comes from the request that created the session when [dsh-tenant-request](../../packages/tenant/tenant-request) is mounted, and otherwise from the plugin's configuration. Remote methods do not carry the request they arrived on, so that plugin registers a Connection request scope, resolves the tenant and its configuration once when the call arrives, and publishes both as `ctx.requestTenant` for the duration of the call — which is what lets the synchronous session-creation listener read them. The configured tenant stays the answer for every session created outside a call: a CLI run, a resumed session, a subagent.

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

<a id="ctxadminaudit--adminaudit"></a>

### `ctx.adminAudit` — `AdminAudit`

The append-only trail of administrative changes.

```ts cordis-catalog
/**
 * Record one change.
 *
 * Nothing is authorized here. The operation that made the change already
 * decided it was permitted, and a trail that could refuse an entry would be
 * a trail with changes missing from it.
 * @param submission - what changed, and how it read before and after.
 * @param by - the standing that made the change.
 * @returns the entry as the trail now holds it.
 */
async record(submission: AuditSubmission, by: Membership): Promise<AuditEntry>

/**
 * Read the trail, newest first.
 * @param query - whose trail, which record, and how many entries.
 * @param by - the standing asking for it.
 * @returns the matching entries, newest first.
 * @throws {AuditRefusedError} when this standing may not read that trail.
 */
async read(query: AuditQuery, by: Membership): Promise<readonly AuditEntry[]>
```

Source: [`packages/identity/admin-audit/src/index.ts`](../../packages/identity/admin-audit/src/index.ts)

<a id="ctxadminauditcontroller--adminauditcontroller"></a>

### `ctx.adminAuditController` — `AdminAuditController`

Host service backing the generated `ctx.remote.audit` namespace.

```ts cordis-catalog
/**
 * The recorded changes the calling standing may read, newest first.
 * @param query - whose trail, which record, and how many entries.
 * @returns the matching entries, newest first.
 * @throws {RemoteError} `audit/not-permitted` when the standing may not read
 * that trail, `audit/no-standing` when the call establishes none, or
 * `gateway/internal` when this deployment keeps no trail.
 */
@Remote async read(query: AuditQueryInput): Promise<readonly AuditEntryView[]>
```

Source: [`packages/api/admin-audit-controller/src/index.ts`](../../packages/api/admin-audit-controller/src/index.ts)

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

<a id="ctxbotask--botask"></a>

### `ctx.botAsk` — `BotAsk`

One bot asking a teammate a question.

```ts cordis-catalog
/**
 * Ask one teammate a question, and answer with what it said.
 *
 * The asking agent's own session decides who is asking: a session that
 * speaks as nobody has no teammates, so a person's own conversation cannot
 * reach another bot this way.
 * @param asker - the agent asking, whose session names the asking bot.
 * @param teammate - the bot to ask.
 * @param question - what to ask it, sent verbatim as the answering turn's user message.
 * @param signal - cancellation from the asking turn.
 * @returns what the teammate answered.
 * @throws {AskRefusedError} when the asking session speaks as no bot, the
 * target is not a teammate, or the answering turn did not complete.
 */
async ask(asker: Agent, teammate: PersonId, question: string, signal: AbortSignal): Promise<Answer>
```

Types: [Agent](core.md)

Source: [`packages/identity/bot-ask/src/index.ts`](../../packages/identity/bot-ask/src/index.ts)

<a id="ctxbotroom--botroom"></a>

### `ctx.botRoom` — `BotRoom`

Several bots discussing one question.

```ts cordis-catalog
/**
 * Hold one discussion and answer with what was said and concluded.
 * @param opener - the agent opening it, whose session names the opening bot.
 * @param request - who to invite, what to discuss, and for how many rounds.
 * @param signal - cancellation from the opening turn.
 * @returns the room session, every remark, and the chair's conclusion.
 * @throws {RoomRefusedError} when the opening session speaks as no bot, a
 * participant is not a teammate, or nobody else was named.
 */
async hold(opener: Agent, request: RoomRequest, signal: AbortSignal): Promise<RoomResult>
```

Types: [Agent](core.md)

Source: [`packages/identity/bot-ask/src/room.ts`](../../packages/identity/bot-ask/src/room.ts)

<a id="ctxbotscontroller--botscontroller"></a>

### `ctx.botsController` — `BotsController`

Host service backing the generated `ctx.remote.bots` namespace.

```ts cordis-catalog
/**
 * The bots the calling standing may change.
 * @returns the bots it administers, written ones first.
 * @throws {RemoteError} `bots/no-standing` when the call establishes none,
 * or `gateway/internal` when this deployment maintains no bots.
 */
@Remote async list(): Promise<readonly BotRowView[]>

/**
 * The agent presets a bot may be given.
 *
 * Answered by the roster rather than read from the preset registry here,
 * because that is the list a save is validated against: a form offering
 * one list while the roster checked another would refuse a choice it had
 * just presented.
 * @returns the presets on offer, in the registry's own order.
 * @throws {RemoteError} `bots/no-standing` when the call establishes none,
 * or `gateway/internal` when this deployment maintains no bots.
 */
@Remote async presets(): Promise<readonly PresetOptionView[]>

/**
 * Add one bot, or change one this deployment maintains.
 * @param input - what the administrator filled in.
 * @returns the bot as the deployment now reads it.
 * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/unknown-preset`,
 * `bots/incomplete`, `bots/no-standing`, or `gateway/internal`.
 */
@Remote async save(input: BotInput): Promise<BotRowView>

/**
 * Remove one bot this deployment maintains.
 * @param id - the bot to remove.
 * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/no-standing`,
 * or `gateway/internal`.
 */
@Remote async remove(id: string): Promise<void>

/**
 * The teams the calling standing may change.
 * @returns the teams it administers, written ones first.
 * @throws {RemoteError} `bots/no-standing` when the call establishes none,
 * or `gateway/internal` when this deployment maintains no bots.
 */
@Remote async teams(): Promise<readonly TeamRowView[]>

/**
 * Add one team, or change one this deployment maintains.
 * @param input - what the administrator filled in.
 * @returns the team as the deployment now reads it.
 * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/unknown-bot`,
 * `bots/incomplete`, `bots/no-standing`, or `gateway/internal`.
 */
@Remote async saveTeam(input: TeamInput): Promise<TeamRowView>

/**
 * Remove one team this deployment maintains.
 *
 * The bots stay; what goes is the relation that let them ask each other.
 * @param id - the team to remove.
 * @throws {RemoteError} `bots/not-permitted`, `bots/written`, `bots/no-standing`,
 * or `gateway/internal`.
 */
@Remote async removeTeam(id: string): Promise<void>
```

Source: [`packages/api/bots-controller/src/index.ts`](../../packages/api/bots-controller/src/index.ts)

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
 * Set or replace what one organization may spend in total, on behalf of one
 * standing.
 *
 * Authorized against the platform rather than against the organization: a
 * ceiling an organization can raise is not a ceiling. This is the one credit
 * decision `administers` does not answer, because that predicate is true for
 * a tenant administrator of the organization named.
 * @param change - the organization, the ceiling, and the period it applies to.
 * @param by - the standing making the change.
 * @returns the stored ceiling.
 * @throws {Error} when the ceiling is negative or not whole, or that standing is not a platform one.
 */
async setBudget(change: BudgetChange, by: Membership): Promise<OrganizationBudget>

/**
 * What one organization bought, and what is left of it, on behalf of one
 * standing.
 *
 * Authorized against the organization rather than the platform: an
 * organization may see its own ceiling and what it has spent against it —
 * that is its own money and its own usage — while only a platform standing
 * changes the ceiling.
 * @param organization - whose ceiling to read.
 * @param by - the standing asking.
 * @returns the ceiling and what is left, or undefined where nobody set one.
 * @throws {Error} when that standing may not administer that organization.
 */
async budgetFor(organization: string, by: Membership): Promise<BudgetState | undefined>

/**
 * Whether one standing may change what an organization bought.
 *
 * Public because a surface that offers the control answers the same
 * question the change does, and two copies of this rule would be one rule
 * too many.
 * @param by - the standing asking.
 * @returns true when it may set an organization's ceiling.
 */
maySetBudget(by: Membership): boolean

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

/**
 * What one organization bought, and what is left of it this period.
 *
 * Read rather than drawn down from a stored total: a period that has turned
 * starts at the ceiling again without anything having to run at the turn.
 * @param organization - whose ceiling to read.
 * @returns the ceiling and what is left, or undefined for an organization nobody set one for.
 */
abstract budget(organization: string): Promise<BudgetState | undefined>

/**
 * Set or replace one organization's ceiling.
 *
 * Nothing is authorized here. What an organization bought is a platform
 * decision, and {@link CreditAdministration} is where that standing is
 * judged — this records what it decided.
 * @param change - the organization, the ceiling, and the period it applies to.
 * @param by - who set it, recorded on the record.
 * @returns the stored ceiling.
 */
abstract setBudget(change: BudgetChange, by: PersonId): Promise<OrganizationBudget>
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

/**
 * Read what the calling person's own organization bought, and what is left.
 *
 * The organization is resolved from the standing this call acts in rather
 * than named by the caller, for the reason `mine` does not take a person:
 * the one organization somebody holds standing in is not a parameter.
 * @returns their organization's ceiling, or undefined when they hold standing in none.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or
 * `credits/not-permitted` for a standing that may not administer its own
 * organization — what it bought and has spent is its administrators' to see.
 */
@Remote async myBudget(): Promise<BudgetView | undefined>

/**
 * Read what one organization bought, and what is left of it this period.
 * @param organization - whose ceiling to read.
 * @returns the ceiling, what is left, and whether this caller may change it.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`, or
 * `credits/not-permitted` when the calling standing may not administer that organization.
 */
@Remote async budget(organization: string): Promise<BudgetView>

/**
 * Set or replace what one organization may spend in total.
 * @param input - the organization, the ceiling, and the period it applies to.
 * @returns the ceiling as it now reads, with what has already been spent against it.
 * @throws {RemoteError} `credits/anonymous`, `credits/unavailable`,
 * `gateway/bad-request` for invalid fields, or `credits/rejected` when the
 * calling standing is not a platform one.
 */
@Remote async setBudget(input: BudgetInput): Promise<BudgetView>
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
 * @returns the person to charge and the organization they act for, or undefined when the request belongs to nobody.
 */
abstract current(): Promise<CreditSubjectIdentity | undefined>
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

<a id="ctxidentitycontroller--identitycontroller"></a>

### `ctx.identityController` — `IdentityController`

Host service backing the generated `ctx.remote.identity` namespace.

```ts cordis-catalog
/**
 * Describe the caller and what they may sign in with.
 * @returns whether this deployment has accounts, who the caller is, and the channels it offers.
 */
@Remote async viewer(): Promise<ViewerView>
```

Source: [`packages/api/identity-controller/src/index.ts`](../../packages/api/identity-controller/src/index.ts)

<a id="ctxmanagedbots--managedbots"></a>

### `ctx.managedBots` — `ManagedBots`

The bots this deployment stores, and the written ones they may not shadow.

```ts cordis-catalog
/**
 * Declare one bot composition wrote.
 *
 * The provider that read the roster registers it, so this service can
 * refuse to shadow it and a surface can show it as the operator's.
 * @param entry - the bot, as composition names it.
 * @returns the disposer that withdraws it.
 */
declareBot(entry: DeclaredBot): () => void

/**
 * Declare one team composition wrote.
 * @param entry - the team, as composition names it.
 * @returns the disposer that withdraws it.
 */
declareTeam(entry: DeclaredTeam): () => void

/**
 * The teams one standing administers, written and stored alike.
 * @param by - the standing asking.
 * @returns the teams it administers, written ones first, then oldest stored first.
 */
async teams(by: Membership): Promise<readonly TeamView[]>

/**
 * Add one team, or change one this service holds.
 * @param submission - what the administrator filled in.
 * @param by - the standing making the change.
 * @returns the team as it now reads.
 * @throws {BotsRefusedError} when the standing may not make the change,
 * composition owns the team, or a member is not its organization's bot.
 */
async saveTeam(submission: TeamSubmission, by: Membership): Promise<TeamView>

/**
 * Remove one team this service holds.
 *
 * The bots stay; what goes is the relation that let them ask each other.
 * @param id - the team to remove.
 * @param by - the standing making the change.
 * @throws {BotsRefusedError} when the standing may not remove it, or composition owns it.
 */
async removeTeam(id: string, by: Membership): Promise<void>

/**
 * The teammates one bot may ask.
 *
 * Shared team membership and nothing else: two bots in one organization
 * that share no team are not teammates, because the relation an
 * administrator wrote is the only thing that grants the right to ask.
 *
 * A bot in two teams with the same colleague reads that colleague once. The
 * job and character come from the colleague's own record rather than from
 * the team, so what a bot is for does not change with the company it is in.
 * @param bot - the bot asking.
 * @returns its teammates, each once, in team order then member order.
 */
async teammates(bot: PersonId): Promise<readonly TeammateView[]>

/**
 * The bots one standing administers, written and stored alike.
 * @param by - the standing asking.
 * @returns the bots it administers, written ones first, then oldest stored first.
 */
async list(by: Membership): Promise<readonly BotView[]>

/**
 * The agent presets a bot may be given.
 *
 * Answered here rather than read from the preset registry by each caller,
 * because this is the list {@link save} validates against: a surface
 * offering one list while the service checked another would refuse a
 * choice it had just presented.
 * @returns the presets on offer, in the registry's own order; a preset that
 *   cannot compose a session is left out.
 */
async offers(): Promise<readonly PresetOption[]>

/**
 * What one bot runs as, for a session about to speak as it.
 *
 * The character is read here and written into the session's own log by the
 * caller, never looked up again on resume: an administrator who rewrites a
 * bot's character changes what it says next, and must not change what it
 * already said.
 *
 * A bot belongs to one organization, and speaking as it is reaching that
 * organization's work. The standing asking has to hold a place in that
 * organization — knowing a bot's id is not permission to be it.
 * @param id - the bot to engage.
 * @param by - the standing the call acts in.
 * @returns the preset it runs with and the character to record, or undefined when no such bot exists.
 * @throws {BotsRefusedError} when that standing belongs to another organization.
 */
async engage(id: PersonId, by: Membership): Promise<{ preset: string; engaged: EngagedBot } | undefined>

/**
 * Put one bot's character into an agent's prompt.
 *
 * Offered on the service so a caller composing a session reaches it
 * through the roster rather than importing this package: a deployment
 * without bots has no roster, and nothing on the session path should have
 * to carry code for one.
 * @param agentCtx - the agent scope the bot runs in, after its preset mounted.
 * @param engaged - the bot and the character its own log records.
 * @returns the disposer that withdraws the section.
 */
compose(agentCtx: Context, engaged: EngagedBot): () => void

/**
 * Add one bot, or change one this service holds.
 * @param submission - what the administrator filled in.
 * @param by - the standing making the change.
 * @returns the bot as it now reads.
 * @throws {BotsRefusedError} when the standing may not make the change, composition owns the bot, or no such preset is offered.
 */
async save(submission: BotSubmission, by: Membership): Promise<BotView>

/**
 * Remove one bot this service holds.
 *
 * Its identity is not reused, so the conversations it opened stay
 * attributed to a bot that no longer runs rather than to whichever one is
 * added next.
 * @param id - the bot to remove.
 * @param by - the standing making the change.
 * @throws {BotsRefusedError} when the standing may not remove it, or composition owns it.
 */
async remove(id: PersonId, by: Membership): Promise<void>
```

Types: [PresetOption](permission-presets.md)

Source: [`packages/identity/managed-bots/src/index.ts`](../../packages/identity/managed-bots/src/index.ts)

<a id="ctxmanagedpeople--managedpeople"></a>

### `ctx.managedPeople` — `ManagedPeople`

The people and bindings this deployment stores, and the written ones they may not shadow.

```ts cordis-catalog
/**
 * Declare one person another owner holds.
 *
 * The provider that read the roster registers what composition wrote, and
 * the bot roster registers its own entries, so this service can refuse to
 * shadow either and a surface can show who holds them. A declared entry is
 * answered by every lookup and is never stored here.
 * @param entry - the person, the standing they hold, and which kind they are.
 * @returns the disposer that withdraws them.
 */
declarePerson(entry: DeclaredPerson): () => void

/**
 * Declare one admission binding composition wrote.
 * @param entry - the directory identity and who it signs in as.
 * @returns the disposer that withdraws it.
 */
declareBinding(entry: BindingSubmission): () => void

/**
 * One person by identity, written or stored.
 * @param id - the person's stable identity.
 * @returns the person, or undefined when neither half names them.
 */
async person(id: PersonId): Promise<Person | undefined>

/**
 * One standing by identity, written or stored.
 * @param id - the standing's stable identity.
 * @returns the standing, or undefined when neither half holds it.
 */
async membership(id: MembershipId): Promise<Membership | undefined>

/**
 * Every standing one person holds.
 * @param person - the person whose standings to list.
 * @returns their standings; one, or none when nobody holds that identity.
 */
async memberships(person: PersonId): Promise<readonly Membership[]>

/**
 * The person one admitted directory identity signs in as.
 * @param key - the binding's lookup key, from {@link bindingKey}.
 * @returns that person, or undefined when neither half admits the identity.
 */
async admit(key: string): Promise<PersonId | undefined>

/**
 * The people one standing administers, written and stored alike.
 * @param by - the standing asking.
 * @returns the people it administers, written ones first, then oldest stored first.
 */
async list(by: Membership): Promise<readonly PersonView[]>

/**
 * Add one person, or change one this service holds.
 * @param submission - what the administrator filled in.
 * @param by - the standing making the change.
 * @returns the person as they now read.
 * @throws {PeopleRefusedError} when the standing may not make the change, or composition owns the person.
 */
async save(submission: PersonSubmission, by: Membership): Promise<PersonView>

/**
 * Remove one person this service holds, and every binding that admitted them.
 *
 * Their identity is not reused, so the conversations they opened stay
 * attributed to somebody who no longer signs in rather than to whoever is
 * added next.
 * @param id - the person to remove.
 * @param by - the standing making the change.
 * @throws {PeopleRefusedError} when the standing may not remove them, or composition owns them.
 */
async remove(id: PersonId, by: Membership): Promise<void>

/**
 * Admit one directory identity as one person.
 * @param submission - the identity and who it signs in as.
 * @param by - the standing making the change.
 * @returns the binding as a surface shows it.
 * @throws {PeopleRefusedError} when the standing may not make the change, nobody holds that identity, or it is already admitted.
 */
async bind(submission: BindingSubmission, by: Membership): Promise<BindingView>

/**
 * Stop admitting one directory identity.
 * @param submission - the identity to stop admitting; its person is not read.
 * @param by - the standing making the change.
 * @throws {PeopleRefusedError} when the standing may not make the change, or composition owns the binding.
 */
async unbind(submission: Omit<BindingSubmission, 'person'>, by: Membership): Promise<void>
```

Source: [`packages/identity/managed-people/src/index.ts`](../../packages/identity/managed-people/src/index.ts)

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

<a id="ctxpeoplecontroller--peoplecontroller"></a>

### `ctx.peopleController` — `PeopleController`

Host service backing the generated `ctx.remote.people` namespace.

```ts cordis-catalog
/**
 * The people the calling standing may change.
 *
 * People only. The roster also answers the deployment's bots, because a
 * bot owns the conversations it opens, and this surface is about who signs
 * in: a bot listed here would be a row an administrator could neither
 * change nor admit an identity as.
 * @returns the people it administers, written ones first.
 * @throws {RemoteError} `people/no-standing` when the call establishes none,
 * or `gateway/internal` when this deployment maintains no directory.
 */
@Remote async list(): Promise<readonly PersonRowView[]>

/**
 * Add one person, or change one this deployment maintains.
 * @param input - what the administrator filled in.
 * @returns the person as the deployment now reads them.
 * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/incomplete`,
 * `people/no-standing`, or `gateway/internal`.
 */
@Remote async save(input: PersonInput): Promise<PersonRowView>

/**
 * Remove one person, and every identity admitted as them.
 * @param id - the person to remove.
 * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/no-standing`,
 * or `gateway/internal`.
 */
@Remote async remove(id: string): Promise<void>

/**
 * Admit one directory identity as one person.
 * @param input - the identity and who it signs in as.
 * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/unknown-person`,
 * `people/already-bound`, `people/not-a-person`, `people/no-standing`, or `gateway/internal`.
 */
@Remote async bind(input: BindingInput): Promise<void>

/**
 * Stop admitting one directory identity.
 * @param input - the identity to stop admitting.
 * @throws {RemoteError} `people/not-permitted`, `people/written`, `people/no-standing`,
 * or `gateway/internal`.
 */
@Remote async unbind(input: IdentityInput): Promise<void>
```

Source: [`packages/api/people-controller/src/index.ts`](../../packages/api/people-controller/src/index.ts)

<a id="ctxrequestprincipal--requestprincipal"></a>

### `ctx.requestPrincipal` — `RequestPrincipal`

Resolves and publishes the principal of the call in progress.

```ts cordis-catalog
/**
 * Who the call in progress is.
 * @returns the principal, or undefined outside a call and for a call presenting no live session.
 */
current(): Principal | undefined

/**
 * Run one continuation as a principal this call already resolved.
 *
 * A stream outlives the request that opened it: its later frames are
 * produced by the transport's pump rather than by a call, so `current()`
 * is empty there, and whatever request happens to share that task would
 * otherwise answer for them. A generation captures its principal at the
 * open and re-enters it per frame.
 *
 * This resolves nobody and widens nothing: the only sound argument is a
 * principal {@link current} returned, and an absent one is entered as
 * absent so a re-entry can never inherit another call's identity.
 * @param principal - the principal captured while the call was in progress.
 * @param run - the work to run as that principal.
 * @returns whatever the work returned.
 */
as<T>(principal: Principal | undefined, run: () => T): T
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

<a id="ctxsessionvisibility--sessionvisibility"></a>

### `ctx.sessionVisibility` — `SessionVisibility`

Decide whether one call may see one conversation.

```ts cordis-catalog
/**
 * Whether the call in progress may see one live conversation.
 *
 * Authoritative: the owner comes from the session's own log rather than
 * from a cache, so this is the answer an operation on one named session
 * acts on.
 * @param session - the session the call named.
 * @returns true when the call may see it.
 */
mayRead(session: Session): Promise<boolean>

/**
 * Whether the call in progress may see the conversation one observed cut
 * belongs to.
 *
 * Authoritative, for a read that never resumes an Agent: a live session
 * answers from its own projection, and a cold one from the events the
 * observation already holds, so the hot path never materializes a log to
 * find out who opened it.
 * @param observation - the cut a page, a follow, or a projection read holds.
 * @returns true when the call may see it.
 */
mayReadObservation(observation: ObservedCut): Promise<boolean>

/**
 * Whether the call in progress may see one listed conversation.
 *
 * Cheap: the owner comes from the durable projection cache, because a
 * listing reads no logs. A row whose owner is not cached reads as
 * unattributed, which keeps a listing from leaking one and leaves the
 * authoritative answer to {@link mayRead} when somebody opens it.
 * @param header - the listed session's header.
 * @returns true when the call may see it.
 */
mayList(header: SessionHeader): Promise<boolean>

/**
 * Whether the conversation one Agent runs in may read another.
 *
 * A tool call carries no request principal — an Agent is not a browser —
 * so what bounds it is the conversation it is running in: it reaches what
 * the person who opened that conversation could reach, and nothing else.
 * An Agent in a conversation nobody opened is the deployment's own and is
 * bounded by nothing here; an unattributed target is not the deployment
 * answering for itself, so no Agent reads one it does not descend from.
 * @param reader - the session the Agent is running in.
 * @param target - the session it wants to read.
 * @returns true when that conversation may read this one.
 */
async mayReadFrom(reader: Session, target: SessionHeader): Promise<boolean>

/**
 * Keep only the conversations the call in progress may see.
 *
 * Every corpus-wide read filters through here, so a row one face hides is
 * hidden by all of them. A live session answers authoritatively from its
 * own projection and a cold one from the durable cache, which is the only
 * owner a listing can read without opening a log: a session opened moments
 * ago has no cached owner yet, and answering it from the cache would hide
 * it from the very person who opened it.
 * @param items - the rows to filter.
 * @param headerOf - the header each row is about.
 * @returns the rows this call may see, in their original order.
 */
async listable<Row>(items: readonly Row[], headerOf: (row: Row) => SessionHeader): Promise<Row[]>
```

Types: [Session](session.md) · [SessionHeader](persistence.md)

Source: [`packages/identity/session-ownership/src/visibility.ts`](../../packages/identity/session-ownership/src/visibility.ts)

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
 * The channels a surface may offer one caller, in registration order.
 * @param scope - the organization this request is for; absent asks for the deployment's own.
 * @returns each channel that caller may be offered.
 */
available(scope: ChannelScope = {}): readonly ChannelDescription[]

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

<a id="ctxsigninchannelcontroller--signinchannelcontroller"></a>

### `ctx.signInChannelController` — `SignInChannelController`

Host service backing the generated `ctx.remote.signInChannels` namespace.

```ts cordis-catalog
/**
 * The kinds of directory this deployment can configure a channel of.
 * @returns each mounted kind and the settings it needs.
 */
@Remote kinds(): readonly ChannelKindView[]

/**
 * The configured channels the calling standing may change.
 * @returns the channels it administers, oldest first.
 * @throws {RemoteError} `sign-in-channels/no-standing` when the call establishes none,
 * or `gateway/internal` when this deployment stores no configured channels.
 */
@Remote async list(): Promise<readonly ConfiguredChannelView[]>

/**
 * Create one channel, or replace one that exists.
 * @param input - what the administrator filled in.
 * @returns the channel as the deployment now reads it.
 * @throws {RemoteError} `sign-in-channels/not-permitted`, `sign-in-channels/unknown-kind`,
 * `sign-in-channels/incomplete`, `sign-in-channels/no-standing`, or `gateway/internal`.
 */
@Remote async save(input: ChannelInput): Promise<ConfiguredChannelView>

/**
 * Remove one channel, its secret with it.
 * @param id - the channel to remove.
 * @throws {RemoteError} `sign-in-channels/not-permitted`, `sign-in-channels/no-standing`,
 * or `gateway/internal`.
 */
@Remote async remove(id: string): Promise<void>
```

Source: [`packages/api/sign-in-channel-controller/src/index.ts`](../../packages/api/sign-in-channel-controller/src/index.ts)

<a id="ctxsigninchannels--configuredchannels"></a>

### `ctx.signInChannels` — `ConfiguredChannels`

Configured sign-in channels, mounted from what a deployment stored.

```ts cordis-catalog
/**
 * The channels one standing may configure.
 *
 * A platform administrator sees every channel, including each tenant's; a
 * tenant administrator sees only their own organization's. Nobody sees a
 * secret, because nobody stores one here to see.
 * @param by - the standing asking.
 * @returns the channels it may configure, oldest first.
 */
async list(by: Membership): Promise<readonly ChannelView[]>

/**
 * Create one channel, or replace one that exists.
 * @param submission - what the administrator filled in.
 * @param by - the standing making the change.
 * @returns the channel as it now reads.
 * @throws {ChannelRefusedError} when the standing may not configure it, the kind is unknown, or a setting is missing.
 */
async save(submission: ChannelSubmission, by: Membership): Promise<ChannelView>

/**
 * Remove one channel, its secret with it.
 * @param id - the channel to remove.
 * @param by - the standing making the change.
 * @throws {ChannelRefusedError} when the standing may not configure it.
 */
async remove(id: string, by: Membership): Promise<void>
```

Source: [`packages/identity/sign-in-channels/src/index.ts`](../../packages/identity/sign-in-channels/src/index.ts)

<a id="ctxsigninkinds--channelkindregistry"></a>

### `ctx.signInKinds` — `ChannelKindRegistry`

The kinds a deployment can be configured with.

```ts cordis-catalog
/**
 * Offer one kind.
 *
 * Two packages offering one kind id is a composition mistake rather than a
 * runtime condition — a configured instance would reach whichever won, and
 * an administrator reading their own configuration could not tell which —
 * so it fails here.
 * @param kind - the kind to offer.
 * @returns the disposer; the registering plugin owns it.
 * @throws {Error} when that kind is already offered.
 */
register(kind: ChannelKind): () => Promise<void>

/**
 * The kind of that id, when one is offered.
 * @param id - the kind a configured instance names.
 * @returns the kind, or undefined when nothing offers it.
 */
get(id: string): ChannelKind | undefined

/**
 * The kinds a configuration surface may offer, in registration order.
 * @returns each kind's id, name, and the settings it needs.
 */
available(): readonly ChannelKindDescription[]
```

Source: [`packages/identity/sign-in/src/kinds.ts`](../../packages/identity/sign-in/src/kinds.ts)

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
