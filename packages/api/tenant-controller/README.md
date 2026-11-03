---
description: "Remote owner of the tenant-configuration surface: the calling tenant reads and saves its own models, providers, features, identity, and copy."
kind: "package-reference"
---

# @lyness/lyn-api-tenant-controller

English | [中文](README.zh.md)

## Summary

This controller registers the `tenant` Remote namespace: `describe` answers the calling tenant's own configuration plus whether this deployment accepts saves, and `save` replaces it. Both act for the tenant the call arrived for and refuse a call that named none — a tenant is never a method parameter, because a caller that names its own tenant names any tenant. A save is validated twice, on the wire fields and against the seam's own rules, so a form learns every problem at once.

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

It takes no configuration, and it needs the request scope to know who is calling:

```yaml
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
- id: tenant-config
  name: '@lyness/lyn-tenant-config-store'
- id: tenant-request
  name: '@lyness/lyn-tenant-request'
- id: tenant-controller
  name: '@lyness/lyn-api-tenant-controller'
```

A browser calls `ctx.remote.tenant.describe()` and `ctx.remote.tenant.save(input)` the way it calls any namespace, and reads the answer as the view this package declares:

```ts
import type { TenantConfigView } from '@lyness/lyn-api-tenant-controller/types'

/**
 * Whether a settings page may offer saving for this answer.
 * @param view - what `tenant/describe` answered.
 * @returns true when this deployment stores the configuration itself.
 */
export function mayOfferSaving(view: TenantConfigView): boolean {
  return view.writable
}
```

`writable` is the field a page reads before it renders a save button; a read-only deployment keeps its configuration in a patch layer, and saving there is a file edit and a restart. `configured` distinguishes a tenant that has saved nothing from one that saved everything empty — both may use nothing, but only the first has never been set up.

### What it refuses

| Code | When |
|---|---|
| `tenant/unresolved` | The call named no tenant: no header, hostname, or subdomain resolved one |
| `gateway/bad-request` | A wire field is malformed — a blank id, a credential that is not a reference, a missing modality |
| `gateway/internal` | This deployment mounts no tenant-configuration store at all |
| `tenant/read-only` | The mounted store does not accept saves |
| `tenant/rejected` | A seam rule refuses the configuration; `problems` lists every one |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The views are projected field by field rather than passed through, for two reasons: a grant's credential is a branded reference in the Host and a plain string on the wire, and the read adds facts the seam does not carry — who the caller is, and whether the backend accepts saves. Absent optionals are dropped rather than serialized as `undefined`.

A save parses the wire fields with zod, builds the seam's configuration with the tenant id from the request, runs the seam's own `validateTenantConfig` so the caller gets the whole problem list, and only then asks the backend. The answer is read back from the store rather than echoed from the input, because the store is the authority on what it kept.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant-config](../../tenant/tenant-config/README.md) — the seam this namespace projects, and the rules a save is validated against.
- [tenant-request](../../tenant/tenant-request/README.md) — how the calling tenant reaches this namespace.
- [tenant-config-store](../../tenant/tenant-config-store/README.md) — the writable backend a save lands in.
- [api-gateway](../gateway/README.md) — the Remote dispatch and failure vocabulary.

-----

<a id="model-experience"></a>
## Model Experience

None, as the namespace serves an administration surface; it registers no prompt, tool, or session event.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **No member authorization** — the only rule enforced is that a caller configures its own organization. Restricting saves to administrators needs user records, which this deployment does not have.
- **Whole-configuration saves** — a page that edits one field reads, changes, and saves all of it; there is no field-level write.
- **No credential writing** — a save names credential references; storing the key behind a reference is the credential store's own surface.
- **Not mounted in a shipped profile** — the namespace is composition, because it is only reachable in a deployment that also mounts a directory and a configuration store.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Every answer is projected from one read of the configuration store, and the store is the authority on its own records, so there is no second observation that could diverge from it.
