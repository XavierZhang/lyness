---
description: "Durable tenant configuration: one record per tenant in the storage domain, saved through the seam's writable capability."
kind: "package-reference"
---

# @lyness/lyn-tenant-config-store

English | [中文](README.zh.md)

## Summary

This backend registers `ctx.tenantConfig` over the storage domain: each tenant's models, providers, features, identity, and copy are one record, read from memory and written durably. It reports a `writable` capability, so an administration surface saves through it, and what it saved survives a restart. A save is validated against the seam's own rules and refused before it is written.

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
- id: storage
  name: '@lyness/lyn-storage'
- id: storage-medium
  name: '@lyness/lyn-storage-sqlite'
  config:
    path: /var/lib/lyn/data.db
- id: storage-domain
  name: '@lyness/lyn-storage-domain'
  config:
    backend: sqlite
- id: tenant-config
  name: '@lyness/lyn-tenant-config-store'
```

It takes no configuration: the records are the configuration. Mount it instead of `@lyness/lyn-tenant-config-static`, never alongside it — the seam holds one store per context, and a second mount throws.

Saving is the capability, not a method, so a consumer that works against either backend asks first:

```ts
import type { TenantConfig, TenantConfigStore } from '@lyness/lyn-tenant-config'

/**
 * Save when the mounted backend accepts saves.
 * @param store - the mounted `ctx.tenantConfig`.
 * @param config - the tenant's complete configuration.
 * @returns whether the backend accepted it.
 */
export async function saveIfWritable(store: TenantConfigStore, config: TenantConfig): Promise<boolean> {
  const capability = store.capability()
  if (capability.kind !== 'writable') return false
  await capability.save(config)
  return true
}
```

A save replaces the tenant's whole configuration; there is no partial merge. It throws when the configuration breaks a rule — a model whose provider the tenant has no grant for, a preferred model that is not available, a repeated model, provider, or feature, or a blank id, constraint, or copy override — and the message lists every problem at once, so a form reports them together rather than one per attempt.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The domain is `tenant_config` version 1, `per-record`: saving one tenant rewrites that tenant's record and touches no other. `[Service.init]` opens the domain, registers its close as an effect, and holds the table for the service's lifetime, so a read is synchronous memory access wrapped in a resolved promise.

Records are validated on read by the domain's own schema. A grant's `credential` is stored as its reference name and branded back on read, so a record edited by hand into something that is not a reference fails its read rather than reaching a provider as a key.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant-config](../tenant-config/README.md) — the seam this backend registers, and the rules a save is validated against.
- [tenant-config-static](../tenant-config-static/README.md) — the read-only backend a deployment configures in its patch layer.
- [storage-domain](../../storage/storage-domain/README.md) — how a domain is declared, versioned, and backed.

-----

<a id="model-experience"></a>
## Model Experience

None, as the records are host-side configuration; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **Whole-record saves** — an administration surface that edits one field reads the configuration, changes it, and saves all of it; the store offers no field-level update.
- **No credential writing** — a record names references; creating and storing a tenant's key is the credential store's own surface.
- **No change notification** — a consumer that read a configuration is not told when a save replaces it, and reads again to see the new one.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The table is the only observation of a tenant's configuration — reads and saves go through the same handle — so there is no second observation that could diverge from it.
