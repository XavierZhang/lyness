---
description: "Tenant configuration read from composition config: each tenant's models, providers, features, identity, and copy as patch-layer rows."
kind: "package-reference"
---

# @lyness/lyn-tenant-config-static

English | [中文](README.zh.md)

## Summary

This backend registers `ctx.tenantConfig` from rows in the deployment's patch layer: one row per tenant, naming the models it may use, the providers it reaches them through, the features it may use, the identity text it contributes, and the copy it overrides. Rows are validated and indexed at load, and a row that breaks a rule refuses the mount. It is read-only; an administration surface that saves changes needs a store this process writes.

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
- id: tenant-config
  name: '@lyness/lyn-tenant-config-static'
  config:
    tenants:
      - tenantId: acme
        providers:
          - provider: deepseek-official
            credential: ACME_DEEPSEEK_API_KEY
          - provider: self-hosted
            credential: ACME_SELF_HOSTED_KEY
            baseUrl: https://models.acme.internal/v1
        models:
          language:
            available:
              - { provider: deepseek-official, model: deepseek-v4-flash }
              - { provider: self-hosted, model: qwen3-32b }
            preferred: { provider: deepseek-official, model: deepseek-v4-flash }
          image:
            available:
              - { provider: self-hosted, model: sdxl }
        features:
          - workflow
        identity:
          constraints:
            - Never discuss unreleased financial figures.
          personality: Answer briefly, in the customer's language.
        copy:
          session.new.label: New ticket
```

A tenant runs a model itself by granting a provider with its own `baseUrl` and naming that provider's models — the same path a hosted provider takes. `credential` is a reference the credential store resolves, never the key: two tenants are isolated by naming different references.

An omitted modality is unavailable to that tenant, and a row that names only `tenantId` configures a tenant that may use nothing yet.

### What the rows refuse

The mount fails at load when the roster configures no tenant, when a `tenantId` is malformed or configured twice, when a `credential` is not a reference, and when a row breaks a configuration rule — a model whose provider the tenant has no grant for, a preferred model that is not available, a repeated model, provider, or feature, or a blank id, constraint, or copy override. The message names the row by position and lists every problem in it.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The schema materializes absent lists, dictionaries, and nested defaults, so an optional nested object — `preferred`, `identity` — carries a null arm rather than relying on absence. The constructor reads each row into the seam's shape, runs the seam's own `validateTenantConfig`, and indexes by tenant id; an identity with neither constraints nor a personality, and an empty copy dictionary, are omitted rather than stored empty, because those say the same thing.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant-config](../tenant-config/README.md) — the seam this backend registers, and the rules it validates against.
- [tenant-static](../tenant-static/README.md) — the tenant roster these rows configure.
- [credentials](../../credentials/credentials/README.md) — what a credential reference is and how it resolves.

-----

<a id="model-experience"></a>
## Model Experience

None, as the rows are host-side configuration; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **Read-only** — changing a tenant's configuration is a patch-layer edit; a profile that reloads its layer re-mounts the store, and every other profile needs a restart.
- **No credential writing** — the rows name references; creating and storing a tenant's key is the credential store's own surface.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The index is derived from one config at load and never changes afterwards, so there is no second observation that could diverge from it.
