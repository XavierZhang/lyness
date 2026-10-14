# Agent Note: The model is a deployment decision, and a free allowance is what a user gets instead

Status: proposed

English | [中文](2026-10-14-the-model-is-a-deployment-decision.zh.md)

## Problem

Today the model is whatever the person in front of the product says it is, and three consequences of that are wrong for both products this harness ships.

**A deployment can finish with no model at all.** `lyn-base` mounts the DeepSeek adapter without a key and the pi-ai router with zero routes, so a boot with nothing configured succeeds, serves its interface, and creates sessions that cannot answer. The failure arrives at the first prompt, in front of a user, instead of at the deployment that caused it.

**Every user can rewrite the model configuration.** The Models page writes provider routes and credential references for whoever opens it. For a hosted product that is a user editing the operator's cost base; for an enterprise install it is a user leaving the models their organization approved. The restriction that would prevent it is explicitly absent: the tenant configuration controller records that "restricting saves to administrators waits for user records", and this harness has no user records — `identity` holds an anonymous id and nothing else.

**A hosted user with no model of their own has no way to start.** The product's answer today is the onboarding dialog asking for a DeepSeek key, which is the right answer for a developer running it locally and the wrong one for a customer who came to use a service. There is no metered allowance anywhere: `token-meter` measures a request's cost and states that it "makes no loop decisions", and no credit, balance, grant, or refusal exists in the tree.

What already exists is the shape of the answer. [`tenant-config`](../../../../packages/tenant/tenant-config/README.md) defines the models a tenant may use per modality, the preferred one, the provider grants that reach them, and the features it may use — with keys held as credential references rather than values. It is mounted by no shipped bundle, and its only consumers are a catalog listing and its own RPC surface, so nothing enforces a word of it.

## Proposal

The model becomes a deployment decision. A user receives a choice among what the deployment allows, and — on a hosted deployment — a free allowance when they bring nothing of their own.

### A deployment states its models, and boot fails when it does not

A deployment declares the models it serves before it serves anything. A composition that declares none fails at load with that as the reason, rather than starting and failing per session.

This is the existing `tenant-config` roster, mounted rather than invented: `models.available` per modality, `models.preferred` as the default, and a `ProviderGrant` per provider carrying a credential reference. Declaring it is what completes a deployment.

The failure belongs at load because that is where it is self-contained and where the operator is present. A session-time failure reaches a user who cannot fix it.

### The allowed set is enforced where the model is chosen

Enforcement lives in the operation that resolves a route for a request, not in the surface that displays choices. A surface that filters a list is a presentation; a resolver that refuses an unlisted model is the rule. Anything else is bypassed by the next caller — an RPC, a preset, a profile patch.

A request naming a model outside the tenant's `available` set is refused with that as its reason. A request naming none takes `preferred`.

### Model configuration is read-only to a user, and the surface says so

The Models page becomes read-only wherever the deployment owns the configuration, and says which authority owns it. `tenant-config` already carries the fact a surface needs: a backend states whether it can be saved to, so the page shows or hides saving instead of discovering it by failing.

Read-only is not the same as hidden. A user still sees which models they may use and which is default, and still chooses among them per session; what they cannot do is add a provider, change an endpoint, or write a credential.

A single-tenant developer install keeps today's behaviour, because a deployment that mounts no tenant backend is its own operator. That is the existing single-tenant rule, not a new exception.

### A hosted user without their own model gets a daily allowance of credits

The unit is **credits**, shown as 积分 in Chinese. A hosted deployment grants each user a daily allowance of them, spent by model requests, and refuses service when the balance reaches zero.

The allowance is a balance with a ledger, not a counter. A refusal a customer cannot account for is a support case; a balance whose every debit names the session that caused it is answerable. This is the same reasoning the derived-memory note applied to invalidation: the record is the product, not an implementation detail.

Spending is measured by the existing `token-meter`, which already prices a request deterministically from the session log and makes no loop decisions. Metering stays measurement; the allowance owns the decision to refuse.

### Exhaustion stops the turn, says so, and blocks the next one

A turn that exhausts its balance stops rather than overdrawing. It says why, it does not start another, and it points at the top-up path. Partial work already done stays in the session, because discarding it loses what the credits already paid for.

Stopping is chosen over completing-and-overdrawing because an overdraw is a cost the operator did not agree to, and because a user who can exceed a balance has no balance. The stop is therefore enforced where a request is issued, not advertised in a surface.

### Credits are per user, and a tenant caps its own users

A balance belongs to a user, because a grant arrives per login. A tenant additionally sets the allowance available to each of its users, so an organization controls its own consumption without lyness setting a per-member limit on its behalf.

Two authorities therefore bound one balance: the deployment's grant policy, and the tenant's per-user cap. The lower of the two applies, and a refusal names which one it hit — a user told only "out of credits" cannot tell whether to wait for tomorrow or ask their administrator.

### Who takes the money is a boundary, not a setting

A tenant's users top up into **the tenant's own corporate bank account**. lyness charges the tenant a platform fee and nothing else. An administration surface therefore maintains a tenant's corporate account details, because the tenant is the party its own users pay.

A user who belongs to no tenant is an ordinary user of the lyness service and follows lyness's own rules, including its own top-up path.

This is a liability boundary rather than a configuration choice, and it decides what the harness must never do: for a tenant's users, lyness does not hold funds, does not settle, and is not the merchant of record. The ledger records credits, which are a service unit; money moves between a tenant and its own users, on a path lyness provides the details for and does not stand in.

It follows that the two populations cannot share one top-up implementation. A tenant user's purchase is the tenant's transaction; a direct user's purchase is lyness's. The credit ledger is common; the payment path is not, and a design that merges them makes lyness the processor for every tenant by accident.

### Onboarding asks nothing a deployment has already decided

The first-run credential dialog already resolves itself: `onboardingReadiness` reports `provider-ready` when any provider is usable, and the dialog renders nothing. A deployment that declares its models satisfies that condition, so this half needs no change.

The internal-testing notice is unconditional and should not be. It is a statement about a pre-release build shown to its developers, not something a customer of a hosted deployment should meet on first login. It becomes a deployment choice, off where the deployment states its own copy.

## Alternatives considered

**Leave the model with the user and document that operators should not expose the Models page.** No code changes. Rejected: a documented convention is not an authority boundary, and the page is reachable by RPC regardless of what the interface shows.

**Enforce the allowed set in the Models page and the model picker.** The user never sees a model they may not use, which is most of the value for least work. Rejected as sufficient: a preset row, a profile patch, and a direct RPC each reach the resolver without passing a surface, which is the repo's own rule that a decision is enforced in the operation that makes it.

**Meter in money rather than a product unit.** A balance in currency needs no translation at purchase time. Rejected as the primary unit: the price of a request depends on a provider's rates, which the operator may change and may not wish to disclose per request, and a user comparing a balance against a task cannot reason in a unit that moves. A product unit priced from tokens keeps the user's view stable while the operator's cost varies.

**Grant the allowance per session rather than per day.** Simpler, and needs no clock. Rejected: it rewards opening sessions, which is the opposite of the intended shape, and gives a heavy user the same total as a light one.

**Let a hosted user configure their own model freely.** It costs the operator nothing and removes the allowance question. Rejected as the default: a user's key reaching the operator's process is the operator's liability, and the deployment is the party that decides whether to accept it. It stays available where a deployment permits it.

## Still to settle

The decisions above fix the shape. Two values remain, and neither blocks building it.

**The grant size and its clock.** A daily grant needs an amount and a timezone to be daily against. A deployment serving one region differs from one serving several, so this is a validated configuration field rather than a constant.

**The platform fee's own shape.** What lyness charges a tenant is a commercial decision that this note only constrains in one way: it is charged to the tenant, never to the tenant's users.

## Acceptance criteria

- A composition declaring no model fails at load, naming the absence as the reason.
- A request naming a model outside the tenant's available set is refused in the route resolver, and a request naming none resolves to `preferred`.
- The refusal holds for a request that reaches the resolver without passing a surface, proven through the resolver rather than the interface.
- The Models page is read-only where the deployment owns configuration, states which authority owns it, and still shows the models a user may use.
- A deployment that mounts no tenant backend keeps single-tenant behaviour unchanged.
- A hosted user's credit debits name the session that spent them, and an exhausted balance refuses with a reason a user can act on.
- A turn that exhausts its balance stops without overdrawing, keeps the work already done, and starts no further request.
- A refusal names whether the deployment's grant or the tenant's per-user cap was the limit reached.
- A tenant's corporate account details are maintained through an administration surface, and no code path makes lyness the receiving party for a tenant user's top-up.
- The internal-testing notice is a deployment choice, and a deployment that states its own copy does not show it.

## Risks

**Enforcement in the resolver reaches every caller, including the ones that should bypass it.** A deployment's own maintenance task, a replay in a test, and a seeded session all resolve routes. A rule written without an authority exemption will refuse work the operator intended, and an exemption written loosely is the bypass the rule exists to prevent.

**An allowance makes refusal a normal outcome of a model request.** Every surface that assumes a request either succeeds or fails technically acquires a third case that is neither, and the compaction, retry, and queue paths each decide what to do with it. Missing one leaves a user with a turn that neither completes nor explains itself.

**A read-only Models page is a worse experience than no Models page for a single-tenant user.** The developer install keeps write access, so the two modes diverge, and a bug in the authority check is most likely to appear as a developer unable to configure their own model.

**The credit ledger is a per-user record of usage.** It is less sensitive than memory but still describes what a named person did and when, and a hosted deployment holding it inherits the retention question that comes with it.

**Two payment paths invite one implementation.** The ledger is shared and the top-up buttons look alike, so the cheapest next change is always to route a tenant user's payment through the same code as a direct user's. That single change makes lyness the merchant of record for every tenant's users, which is the one outcome this note forbids. The separation needs to be visible in the code, not only in this file.

**A tenant cap and a deployment grant can disagree silently.** Two authorities bounding one balance means a user can be stopped by a limit their administrator did not set, or keep working past one the administrator thought they had set. Naming the binding limit in the refusal is what makes that debuggable; omitting it produces support cases neither party can resolve.
