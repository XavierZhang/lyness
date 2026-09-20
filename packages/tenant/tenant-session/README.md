---
description: "Stamps every session with the tenant it belongs to and the identity text that tenant contributed, as one durable log event."
kind: "package-reference"
---

# @lyness/lyn-tenant-session

English | [中文](README.zh.md)

## Summary

This plugin writes one durable event per session: which tenant the session belongs to, and the constraints and personality that tenant contributed, recorded verbatim. Attribution needs the tenant on every session long after it ends; reconstruction needs the identity text itself, because it reaches the model and a later edit to the tenant's configuration would otherwise make the session unreadable. A session that already carries the record — a fork, or one this process resumed — keeps the record it was created with.

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
- id: tenant-session
  name: '@lyness/lyn-tenant-session'
  config:
    tenantId: acme
```

`tenantId` names the tenant every session created on this deployment belongs to, and the directory must serve it — a malformed id, or one no tenant claims, refuses the mount. Composing [`tenant-config`](../tenant-config/README.md) as well adds that tenant's identity text to the record; without it the record carries the tenant alone.

### What lands in the log

```jsonc
{"type":"tenant/identity","data":{
  "version":1,"tenantId":"acme","slug":"acme",
  "constraints":["Never discuss unreleased figures."],"personality":"Answer briefly."
}}
```

The record is log-only: it never enters the model transcript. The identity text reaches the model through the assembled system prompt, which the log already records; this event is what lets a later reader attribute the session and reconstruct the text it ran under. Reading it back is the `tenant` session projection, so resume and fork see the record the session was created with.

### One tenant per deployment, for now

The tenant comes from configuration rather than from the request that created the session, because session creation does not carry one. A deployment serving several tenants needs that request's tenant to reach session creation, which is separate work.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The tenant and its identity are read once when the plugin starts, so the append on `session/created` stays synchronous and the record lands in a deterministic position in the log. The projection's state is also the idempotence guard: a session whose fold already holds a record is left alone, which is what makes a fork and a resumed session keep their original stamp. A record carries its own `version`, following the subagent descriptor: a later field set changes the version deliberately rather than silently widening what readers must accept.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the directory this plugin names its tenant in.
- [tenant-config](../tenant-config/README.md) — where the identity text comes from.
- [Persistence catalog](../../../docs/persistence-catalog.md#tenantidentity--log-only) — the generated entry for this event.
- [Multi-tenancy subsystem](../../../docs/subsystems/multi-tenancy.md) — the tenant vocabulary and how a request resolves to one.

-----

<a id="model-experience"></a>
## Model Experience

None, as the record is log-only; the identity text reaches a model request through the system prompt, which the log records separately.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **One tenant per deployment** — the record names the configured tenant, not the tenant of the request that created the session.
- **The identity is read once** — a configuration edited while the process runs reaches sessions created after the next restart; the read-only backend shipping today cannot change under a running process anyway.
- **Nothing composes the identity into a prompt** — the record says what a tenant contributes; the layer that assembles platform, organization, user, and agent identity into a request is separate work.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The projection state and the log are one observation folded from the other, not two sources that could diverge.
