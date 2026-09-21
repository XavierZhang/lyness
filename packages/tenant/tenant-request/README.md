---
description: "The tenant one RPC call belongs to: resolved when the call arrives and readable, without a parameter, by everything it reaches."
kind: "package-reference"
---

# @lyness/lyn-tenant-request

English | [中文](README.zh.md)

## Summary

This plugin registers a Connection request scope, resolves the tenant the call arrived for — header, then hostname, then subdomain, the same order the HTTP route uses — and publishes it for the duration of the call as `ctx.requestTenant`. The tenant's configuration is resolved in the same step, so a synchronous consumer such as the session-creation listener can read it without awaiting a store. A call that names no tenant proceeds without one; refusing belongs to the surface that needs it.

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

Mount it after the Connection and the tenant directory, and before anything that reads the calling tenant:

```yaml
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
- id: tenant-request
  name: '@lyness/lyn-tenant-request'
  config:
    baseDomain: example.com
```

`baseDomain` is what makes `acme.example.com` name the `acme` tenant; omit it and only the `x-tenant-id` header and the tenant's own configured hostnames resolve.

Read it where the call is being served:

```ts
import { RemoteError } from '@lyness/lyn-typert-protocol'
import type { Context } from '@lyness/cordis'
import type { RequestTenant } from '@lyness/lyn-tenant-request/types'

/**
 * The tenant this call is allowed to act for.
 * @param ctx - context of the call being served.
 * @returns the resolved tenant.
 * @throws {RemoteError} when the call named no tenant.
 */
export function callingTenant(ctx: Context): RequestTenant {
  const current = ctx.requestTenant.current()
  if (current === undefined) {
    throw new RemoteError('gateway/bad-request', 'this request names no tenant', {})
  }
  return current
}
```

A read outside a call answers `undefined` — at load, on a timer, in a session this process resumed. That is the honest answer rather than the last call's tenant, so a consumer that needs one refuses instead of acting for whoever called last.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The scope is a `node:async_hooks` `AsyncLocalStorage` store entered around the channel owner's dispatch, so every `await` the call makes still sees it. Resolution reuses `resolveTenant` from [tenant-http](../tenant-http/README.md), which is why the RPC path and the HTTP route cannot drift apart. Fetch `Headers` join a repeated name into one comma-separated value, which the resolver then reads as a malformed id and refuses — the answer a tenant boundary wants.

`ctx.requestTenant` is typed as the reader interface declared in `./types`, which imports no Connection module: a consumer compiles against the read alone without taking on the web transport the scope is registered on.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the directory the resolution runs against.
- [tenant-http](../tenant-http/README.md) — the resolution order, and the unauthenticated route that answers with it.
- [tenant-session](../tenant-session/README.md) — the consumer that stamps a created session with the calling tenant.
- [api-gateway](../../api/gateway/README.md) — the Remote dispatch this scope wraps.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the consumers that read the calling tenant, such as the session stamp that records that tenant's identity text.

#### KV Cache effect

No direct invalidation; the named consumers own any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **Unary calls only** — the scope wraps decoded RPC calls. A Remote stream and an exact Fetch route below `/api` are dispatched on other paths and see no tenant.
- **No identity beyond the tenant** — a call resolves to an organization, not to a person in it. Which member called, and what they may do, waits for user records.
- **A trusted header** — `x-tenant-id` is believed. A deployment that exposes `/api` to callers it does not control must terminate that header at its own edge, exactly as the HTTP route requires.
- **One configuration read per call** — both shipped backends answer from memory; a backend whose read is slow pays it on every call, whether or not the call needs the configuration.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The scope hook it registers is `ctx.connection.rpc.scope`, added to the Connection for this purpose ([decision](../../../.agents/notes/implemented/architecture/2026-09-21-the-tenant-of-a-request.md)).

</details>

**Runtime invariant:** No companion is published. The store is the only observation of the calling tenant, and it is written once per call by the same code that reads it, so there is no second observation that could diverge from it.
