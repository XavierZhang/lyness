---
description: "Resolves the tenant an HTTP request belongs to — from the tenant header, the hostname, or a subdomain slug — and answers which it is."
kind: "package-reference"
---

# @lyness/lyn-tenant-http

English | [中文](README.zh.md)

## Summary

This plugin applies one deployment's tenant-resolution policy: the `X-Tenant-ID` header a gateway sets, then the hostname a request arrived on, then the slug carried by a direct subdomain of a configured base domain. It registers one route that answers which tenant the asking request belongs to, and refuses a request that resolves to none. It never lists the roster, so a caller learns nothing beyond what its own request already names. `resolveTenant` is exported for other consumers.

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

```yaml
- id: tenant-http
  name: '@lyness/lyn-tenant-http'
  config:
    path: /tenant
    baseDomain: tenants.example.com
```

`path` defaults to `/tenant`, outside `/api`, which the browser connection owns whole. `baseDomain` is optional: without it, no subdomain resolves.

```console
$ curl -s -H 'Host: acme.example.com' localhost:8080/tenant
{"id":"acme","slug":"acme","displayName":"Acme","source":"host"}
```

### Resolution order

| Order | Source | Rule |
|---|---|---|
| 1 | `X-Tenant-ID` | The stated id wins. An unknown or malformed id resolves to nothing — it never falls through to the hostname, because a caller that stated a tenant must not silently be served another. A blank or repeated header states nothing. |
| 2 | `Host` | The hostname, without its port and lowercased, as a tenant claims it. |
| 3 | Subdomain | One label directly under `baseDomain`, matched against tenant slugs. `a.b.example.com` under `example.com` names no tenant. |

A request that resolves to none is answered `404` with `{"error":"unknown-tenant"}`. There is no fallback tenant: a tenant is an isolation boundary, so serving a different one is worse than serving nothing.

### Trusting the header

`X-Tenant-ID` is authoritative only when something in front of this deployment sets it and strips an inbound copy. A deployment reachable directly must not compose this plugin with a header-trusting gateway assumption; the hostname is the trustworthy source there.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`src/resolve.ts`](src/resolve.ts) is pure over a directory and a header table — the order above, plus hostname and subdomain parsing — so another consumer (an RPC face, a session tagger) applies the same policy without a route. [`src/index.ts`](src/index.ts) owns the transport: one exact route through `ctx.webServer.register` inside `ctx.effect`, JSON answers, `405` for a write, and no cached response.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the directory this consumer reads.
- [tenant-static](../tenant-static/README.md) — the roster a hostname or slug is matched against.
- [webserver](../../host/webserver/README.md) — the carrier the route registers on.

-----

<a id="model-experience"></a>
## Model Experience

None, as resolution is host-side routing identity; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **The route is unauthenticated** — it answers only about the asking request, and the answer is what that request's own hostname or header already names, but it applies no session or token check of its own.
- **Resolution stops at the answer** — nothing carries the resolved tenant into the RPC gateway or the session log; those consumers call `resolveTenant` themselves once they exist.
- **One base domain** — a deployment serving tenants under several domains claims each hostname in the roster instead.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The plugin holds one route registration owned by its fiber, and each answer is derived from one request and the directory at that moment.
