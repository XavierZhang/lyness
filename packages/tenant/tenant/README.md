---
description: "The ctx.tenants directory seam: which tenants a deployment serves, and the three lookups a request resolves by."
kind: "package-reference"
---

# @lyness/lyn-tenant

English | [中文](README.zh.md)

## Summary

`ctx.tenants` names which tenants a deployment serves and answers three lookups a request can be resolved by: the immutable id a caller states, the hostname a request arrived on, and the slug a subdomain carries. It is a directory, not a policy: which part of a request a deployment trusts is the consumer's decision. A deployment that mounts no directory is single-tenant. One that mounts one refuses what it cannot resolve, because a tenant is an isolation boundary.

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

Compose a backend — [`lyn-tenant-static`](../tenant-static/README.md) reads the roster from composition config — and read the directory through `ctx.tenants`:

```ts
import type { Context } from '@lyness/cordis'
import { TenantError } from '@lyness/lyn-tenant'
import type { Tenant } from '@lyness/lyn-tenant'

export async function tenantOf(ctx: Context, hostname: string): Promise<Tenant> {
  const tenant = await ctx.tenants.byHost(hostname)
  if (tenant === undefined) throw new TenantError('unknown-tenant', `no tenant serves ${hostname}`)
  return tenant
}
```

### What a tenant is

| Field | Meaning |
|---|---|
| `id` | Immutable identity. Durable records and wire payloads carry this value, so it survives a rename or a domain change. |
| `slug` | One lowercase DNS label: the operator-facing handle, and the subdomain a request can arrive on. |
| `displayName` | The name that tenant's own users see. |

`TenantId(value)` brands a string as an id and refuses anything that would need escaping in a header, a path segment, or a storage key. `isTenantSlug(value)` accepts one lowercase DNS label.

### What the seam does not decide

Each lookup answers `undefined` for a subject it does not know, because resolving an arbitrary request finds nothing often enough to be ordinary. Refusing is the consumer's word: it knows which failure its transport owes the caller. The seam likewise takes no position on whether a header may name a tenant — authoritative behind a gateway that sets it, forgeable in front of one — so a consumer states that policy for its deployment.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package is the abstract `TenantDirectory` service plus the vocabulary its faces share. [`src/types.ts`](src/types.ts) is types only, so a Client face reads exactly the signatures the Host emits; [`src/brand.ts`](src/brand.ts) holds the id brand and the two syntaxes, because a validating constructor is runtime code a types module may not carry. Lookups are asynchronous so a database-backed directory fits the same seam without changing a caller.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant-static](../tenant-static/README.md) — the composition-configured backend.
- [tenant-http](../tenant-http/README.md) — the consumer that resolves a request and applies a deployment's policy.
- [Capability seams](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md) — the roles this package's group is split along.

-----

<a id="model-experience"></a>
## Model Experience

None, as the directory is host-side routing identity; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **Identity only** — a tenant is an id, a slug, and a display name here; per-tenant configuration, credentials, and storage are separate layers that will name a tenant by its id.
- **No tenant is ambient** — nothing carries the resolved tenant for the rest of a request; each consumer resolves and passes it explicitly.
- **One directory per context** — a second mounted directory throws, so a deployment merging two rosters needs a backend that does the merging.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. This stateless Service Definition owns the tenant vocabulary, while a backend owns the roster and a consumer owns what refusing looks like.
