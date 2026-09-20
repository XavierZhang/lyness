---
description: "The ctx.tenantConfig seam: the models, providers, features, identity, and copy one tenant configures for itself."
kind: "package-reference"
---

# @lyness/lyn-tenant-config

English | [中文](README.zh.md)

## Summary

`ctx.tenantConfig` reads what one tenant configures for itself: the models it may use in each modality, the providers it reaches them through, the features it may use, the identity text it contributes to its own model requests, and the interface copy it overrides. Keys never appear here — a provider grant carries a credential reference the credential store resolves. A backend states whether it can be saved to, so an administration surface shows or hides saving instead of discovering it by failing.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose a backend — [`lyn-tenant-config-static`](../tenant-config-static/README.md) reads rows from composition config — and read through `ctx.tenantConfig`:

```ts
import type { Context } from '@lyness/cordis'
import type { ModelChoice } from '@lyness/lyn-tenant-config'
import type { TenantId } from '@lyness/lyn-tenant'

export async function imageModelsOf(ctx: Context, tenantId: TenantId): Promise<readonly ModelChoice[]> {
  const config = await ctx.tenantConfig.get(tenantId)
  return config?.models.image.available ?? []
}
```

A tenant with no configuration reads as `undefined`, and an empty list means the tenant may use nothing of that kind. Neither is a fallback: a tenant that configured no image model has no image model, rather than borrowing the deployment's.

### What a tenant configures

| Field | Meaning |
|---|---|
| `models` | Per modality — `language`, `image`, `video`, `music` — the available models and the preferred one. |
| `providers` | Each provider the tenant may reach, its credential reference, and the endpoint for a model the tenant runs itself. |
| `features` | Features the tenant may use; a feature absent from the list is unavailable to it. |
| `identity` | Constraints and personality this tenant contributes to its own model requests. |
| `copy` | Interface copy the tenant overrides, by copy id. Never reaches a model request. |

### Identity composes in one direction

Identity reaches a model request in layers: the platform, then the organization, then the user, then the agent. The two fields compose differently, and the difference is the point:

- **`constraints` accumulate.** Every layer adds rules and no lower layer removes one, so an organization's compliance rule survives whatever an agent says about itself.
- **`personality` is replaced.** The organization states a voice; an agent that states its own replaces it.

This package owns the shape. Composing the layers into a prompt belongs with the session log, because anything that reaches a model request must be reconstructable from it.

### Keys

A grant carries a `CredentialRef` — a name the credential store resolves — so a configuration can be read, logged, and exported without carrying a secret. Two tenants are isolated by naming different references; one deployment that deliberately shares a platform key points both at the same reference.

### Rules

`validateTenantConfig` states every rule once, so a read-only backend checks at load and a writable one checks before it saves: a model's provider must be granted, a preferred model must be available, no model, provider, or feature may repeat, and no id, constraint, or copy override may be blank.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package is the abstract `TenantConfigStore` service, the vocabulary in [`src/types.ts`](src/types.ts) — types only, so a Client face reads exactly the signatures the Host emits — and the rules in [`src/validate.ts`](src/validate.ts), which return every problem rather than the first, because an operator fixing a row wants the whole list. `get` is asynchronous so a database-backed store fits the same seam.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the directory that resolves which tenant a request belongs to.
- [tenant-config-static](../tenant-config-static/README.md) — the composition-configured backend.
- [Multi-tenancy subsystem](../../../docs/subsystems/multi-tenancy.md) — the tenant vocabulary and the resolution order.
- [credentials](../../credentials/credentials/README.md) — what a credential reference is and how it resolves.

-----

<a id="model-experience"></a>
## Model Experience

None, as this seam only reads configuration; the identity text it carries reaches a model request through a consumer that also records it in the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **Identity is shape only** — nothing composes `constraints` and `personality` into a prompt yet; that arrives with the session event that records which identity a session ran under.
- **No user layer** — the layering above names a user between the organization and the agent, and this deployment has no user records to carry one.
- **Features are ids, not permissions** — the list says which features a tenant may use, not which member may use them; roles arrive with an administration surface that has members.
- **No usage limits** — quotas, budgets, and rate limits are not part of this configuration.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. This stateless Service Definition owns the configuration vocabulary and its rules, while a backend owns the rows and a consumer owns what it does with them.
