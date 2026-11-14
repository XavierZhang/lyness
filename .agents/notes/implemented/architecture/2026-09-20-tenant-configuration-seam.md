# Agent Note: A tenant configures its own models, and never borrows the deployment's

Status: implemented

English | [中文](2026-09-20-tenant-configuration-seam.zh.md)

## Problem

Resolving which tenant a request belongs to answered nothing about what that tenant may do. Upstream stores model settings per deployment — a settings section per provider, keys in the operating-system user's credential store — which is correct for one organization per installation and unusable for several: two organizations on one deployment would share one model roster and one key, and their usage would be one bill nobody can split.

Identity had the same gap in the other direction. An organization wants its own rules and voice in every request its people make, a person wants their own, and an agent its own — three layers, none of which had anywhere to live.

## Decision

`ctx.tenantConfig` reads what one tenant configures for itself: models per modality (language, image, video, music), the providers it reaches them through, the features it may use, the identity text it contributes, and the interface copy it overrides. `@lyness/lyn-tenant-config-static` provides it from composition config, and `@lyness/lyn-tenant-http` consumes it, adding the requesting tenant's features and copy to the answer it already gave.

Four rulings shape it.

**Nothing falls back to the deployment.** A tenant with no configuration reads as `undefined`, and an empty model list means that modality is unavailable. A fallback would let a tenant spend an account it never chose, and put two organizations' usage on one bill.

**A grant carries a credential reference, never a key.** The value stays in the credential store, so a configuration can be read, logged, and exported without carrying a secret; two tenants are isolated by naming different references. A grant may also carry its own `baseUrl`, which is how a tenant reaches a model it runs itself — the same path a hosted provider takes.

**Constraints accumulate; personality is replaced.** Identity is two fields, not one, because they compose in opposite directions. Rules add down the layers — platform, organization, user, agent — and no lower layer removes one, so an organization's compliance rule survives an agent that says "ignore the above". The voice is the opposite: an agent that states its own replaces the organization's.

**A backend states whether it can be saved to.** `capability()` returns `read-only` or `writable`, so an administration surface shows or hides saving rather than discovering it by failing. The backend shipping now is read-only; the writable one arrives with durable storage.

## Alternatives considered

**Reuse the upstream per-deployment settings sections.** No new seam, and the existing model-settings surface would work unchanged. Those sections are keyed by provider, not by tenant, and their keys are the operating-system user's — there is no key to hang a second organization on.

**Put provider keys in the configuration.** One place to read a tenant's whole setup. A configuration is read, logged, diffed, and exported; a key in it is a key in all of those.

**Hold configuration in the tenant directory.** One service instead of two, and a request resolves to a tenant with its configuration already attached. The directory answers per request and a configuration is edited by an administrator; they have different lifetimes, different backends, and — once storage lands — different write paths.

**Make identity one text field.** Simpler to store and to edit. A single field means the agent layer rewrites whatever the organization wrote, which is exactly the compliance failure the two-field split exists to prevent.

**Ship the writable backend now.** The administration surface could save immediately. Writing needs durable per-tenant storage, which is its own decision; declaring the capability now lets that surface be written once, against a seam that already says which backends accept a save.

## Consequences

Identity is shape only. Nothing composes the layers into a prompt yet, because anything that reaches a model request must be reconstructable from the session log, and the session event that records which identity a session ran under is separate work. The user layer between organization and agent waits for user records, which this deployment does not have.

Features are ids a tenant may use, not permissions a member holds. Roles need members, and this deployment has none.

The unauthenticated tenant route now answers with the requesting tenant's features and copy. Models, grants, and credential references stay out of it; a surface that needs them must authenticate.

`ctx.tenantConfig` is registered by hand in the same generator tables `ctx.tenants` needed — the subsystem page, the type pages, the capability-seam roles, the type-equivalence manifest — and `CUSTOM.md` records them.
