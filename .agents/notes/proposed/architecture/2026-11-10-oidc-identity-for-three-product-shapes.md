# Agent Note: OIDC identity for the three product shapes

Status: proposed

English | [中文](2026-11-10-oidc-identity-for-three-product-shapes.zh.md)

## Problem

This product ships in three shapes — SaaS personal, SaaS tenant, standalone — and all three need people to sign in before the product is usable. None of them can today.

What exists is an account plane without a way in for anybody outside a corporate directory:

- `dsh-sign-in` holds a channel registry and three kinds, all corporate directories: `dsh-wecom/kind`, `dsh-dingtalk/kind`, `dsh-feishu/kind`. There is no email channel, so nobody can self-register.
- `dsh-managed-people/directory` requires a non-empty roster at load, and `dsh-managed-people/admission` admits nobody until a binding is written. Both refuse rather than admit, deliberately.
- `dsh-auth-session/store` holds signed-in sessions durably, so a restart does not sign everyone out.
- `dsh-client-ui-sign-in` already covers the product while nobody is signed in — it renders nothing where `uiViewer` reports `accounts: false`, which is every profile that does not select `dsh-module-accounts`.
- `dsh-tenant` and `dsh-tenant-config` are a tenant-directory seam with static and HTTP providers; `dsh-module-credits` already meters per subject with allowances and budgets.

So the gate, the session store, the roster, the tenancy seam and the metering all exist. What is missing is the authenticator a person outside a corporate directory uses, and the product rules layered on it: self-registration, email activation, user levels with different token quotas, and one person holding both a personal and an organization account under one email.

The requirements that shape the answer:

| Shape | Who creates accounts | What an administrator sets |
|---|---|---|
| SaaS personal | the person, by email | the platform administrator sets each person's default model, usage, reset period, and which modules they may use |
| SaaS tenant | the tenant's administrator adds seats and users; the user activates by email and is linked to the organization | user levels, each with its own token quota |
| Standalone | only the deployment's administrator | users, seats, models, token usage |

And one cross-shape rule: one email may hold both a personal and an organization account, and that person switches between them on web and on desktop.

## Proposal

Add one channel kind — OIDC — and let an identity provider own authentication. DeepSeek Harness keeps owning authorization, rosters, quotas and tenancy, which is where its own rules live.

Why not own authentication: a self-registration channel means password storage, activation and reset mail, brute-force and enumeration defence, and session fixation — security-sensitive code with no product value of its own, against the repository's own rule to [prefer maintained dependencies](../../implemented/process/2026-07-26-dependencies-over-hand-rolling.md) when they genuinely delete owned code.

The shapes then map onto the provider's own tenancy:

- **SaaS personal** — people self-register against the deployment's own provider instance; a person with no organization is the personal shape.
- **SaaS tenant** — one provider organization per customer. The tenant administrator invites by email; the provider sends and verifies the activation; DeepSeek Harness receives a verified subject already carrying its organization, and `dsh-managed-people/admission` binds it to a roster entry.
- **Standalone** — the customer points the channel at their own provider instance, or at the directory they already run. Nothing about the composition changes.
- **Both accounts under one email** — one identity in two organizations. The provider authenticates once and the session carries which organization is active; switching is a re-authorization against the other organization rather than a second sign-in. This is the requirement that most constrains the choice, because a provider whose tenancy is one-user-per-realm cannot express it without brokering between realms.

User levels and quotas stay on this side: a level is a roster fact, and the quota it carries is a `dsh-credits` allowance. Neither belongs in the provider, which should hold identity and nothing else — a quota in two places is a quota two surfaces will disagree about.

### Staged delivery

1. **The channel.** An `oidc` kind beside the three directory kinds: discovery, authorization-code with PKCE, the verified subject, and the organization claim. The Settings page that configures channels already exists and takes a new kind without change. Landed as `@deepseek-ai/dsh-oidc`, selected by `dsh-module-accounts` as the `sign-in-kind-oidc` row.
2. **The gate, in all three shapes.** `dsh-module-accounts` in the SaaS profiles, and `dsh-client-ui-sign-in` already covers the product; the work is the desktop half and the session lifetime (how long a valid session skips the login screen).
3. **Self-registration and admission.** An admission rule that accepts a verified subject the provider created, so a personal-shape person becomes a roster entry on first sign-in instead of needing an administrator.
4. **Levels and quotas.** A level on the roster entry, resolved to a `dsh-credits` allowance; the tenant administration page gains the level column.
5. **Account switching.** The active organization in the auth session, an organization picker in the client, and the switch as a re-authorization.

Each stage is independently shippable, and only stage 1 is new security-sensitive surface — all of it configuration of a provider rather than an algorithm of ours.

### Choosing the provider

Searched 2026-11-10, and each licence below was then read from the project's own licence file rather than from a comparison, because the published comparisons contradict one another on exactly this point:

| Candidate | Tenancy model | Licence as reported | Fit for this requirement set |
|---|---|---|---|
| ZITADEL | organizations, first-class | AGPL-3.0-only, with Apache-2.0 for `proto/` and the docs app and MIT for `apps/login`, `packages/zitadel-client` and `packages/zitadel-proto` (`LICENSING.md`) | Best fit: organizations express the tenant shape and one identity in two organizations directly |
| Keycloak | realms | Apache-2.0 | Mature and licence-clean, but a realm is a closed user set: one email in both a personal and a tenant account needs identity brokering between realms |
| Logto | organizations | MPL-2.0; reports disagree on what the self-hosted edition gates | Good customer-facing login; the gating question decides whether it is usable self-hosted |
| Authentik | weak or absent multi-tenancy | open-core, disputed | Not a fit for the tenant shape |

**Recommendation: ZITADEL.** It is the only candidate whose tenancy model states this product's requirement without a workaround, and its licence is now read rather than reported: AGPL-3.0-only for the server. That reaches the server alone. DeepSeek Harness stays MIT and speaks OIDC to it over the network, so running an unmodified ZITADEL beside this repository copies none of its code into it; the obligations begin if the server itself is modified and then conveyed, which no stage of this plan does. The client and protocol packages a deployment might actually import are MIT, so even a client-side integration stays outside the AGPL. Keycloak remains the fallback if a customer refuses an AGPL component outright, at the cost of brokering account switching ourselves.

## Alternatives considered

- **An email channel of our own.** Rejected for stage 1: it is an authentication provider, and the three shapes need activation mail, reset, lockout and MFA before any of them is shippable — all of it work a provider has already done, and all of it ours to get wrong.
- **Keep the corporate-directory channels only.** Rejected: it cannot serve the personal shape at all, and it makes every standalone customer configure a WeCom, DingTalk or Feishu app before anyone can sign in.
- **One provider instance per tenant.** Rejected: the operational cost scales with customers, and the cross-shape requirement needs one identity visible in two organizations, which separate instances cannot express.
- **Put quotas in the provider.** Rejected: metering already lives in `dsh-credits` against the request's own subject, and a second home for a quota is two answers that drift.

## Acceptance criteria

- A person who has never used the deployment registers by email, verifies it, signs in, and reaches the product; no administrator acted.
- A tenant administrator invites an address; that person activates and lands in the tenant's organization with the level they were given, and their token quota is the level's.
- A standalone deployment points the channel at its own provider and admits its first administrator from the composition file, as the [standalone guide](../../../../docs/user/guide/standalone-administration.md) already describes.
- One email holding a personal and an organization account switches between them on web and on desktop, without signing in twice.
- A valid session reaches the product without a login screen; an expired one does not.
- Every shape shows the login screen and nothing else while nobody is signed in.

## Risks

- **The provider becomes a hard dependency of signing in.** Its outage is a total outage. The standalone shape mitigates this by pointing at infrastructure the customer already runs.
- **Jurisdiction, and a customer's licence policy.** A China-deployed SaaS may need the provider inside the same jurisdiction, so a hosted foreign provider may not be an option. The AGPL server is a separate network service here rather than a dependency of this repository, but a customer whose policy bars AGPL components anywhere in a deployment is the case Keycloak exists for.
- **Quotas and identity drift apart.** Levels live here and identity lives there, so a person deleted in the provider still holds a roster entry. Reconciliation is part of stage 4, not an afterthought.
- **What this gives up.** DeepSeek Harness stops being able to sign anybody in on its own: a deployment without a provider has no way in, where today a single-operator profile needs no identity at all. The standalone shape keeps that escape only while it keeps the single-operator composition.
