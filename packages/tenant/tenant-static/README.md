---
description: "Tenant directory whose roster is composition config: rows an operator can read and diff before the deployment starts."
kind: "package-reference"
---

# @lyness/lyn-tenant-static

English | [中文](README.zh.md)

## Summary

This backend registers `ctx.tenants` from a roster written in the deployment's patch layer. Each row names one tenant's immutable id, its slug, its display name, and the hostnames it is served on; the index is built at load, and a malformed or ambiguous roster refuses the mount rather than resolving requests to arbitrary tenants. Choose it for a private deployment with one tenant and for an early SaaS deployment; a database-backed directory replaces this row without changing the seam.

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
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
        hosts:
          - acme.example.com
```

| Field | Rule |
|---|---|
| `id` | 1–64 characters of letters, digits, `-`, or `_`. Immutable: durable records carry it. |
| `slug` | One lowercase DNS label, so it can also be a subdomain. |
| `displayName` | Any non-blank name. |
| `hosts` | Hostnames without scheme or port, compared lowercase. Optional. |

### What the roster refuses

The mount fails at load when the roster names no tenant, when a row's id, slug, display name, or hostname is malformed, and when two rows claim one id, slug, or hostname. The message names the row by position. An ambiguous roster would resolve a request to whichever row was indexed last, and that is another organization's data.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The constructor validates every row and builds three maps — by id, by hostname, by slug — so each lookup is a map read and the service holds no other state. Lookups return resolved promises because the seam is asynchronous for backends that are not.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the seam this backend registers.
- [tenant-http](../tenant-http/README.md) — the consumer that resolves a request against the roster.

-----

<a id="model-experience"></a>
## Model Experience

None, as the roster is host-side routing identity; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **The roster is fixed at load** — adding a tenant is a patch-layer edit; a profile that reloads its layer re-mounts the directory, and every other profile needs a restart.
- **No tenant is created here** — the package indexes rows an operator wrote; minting ids and persisting them belongs to a database-backed directory.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The index is derived from one config at load and never changes afterwards, so there is no second observation that could diverge from it.
