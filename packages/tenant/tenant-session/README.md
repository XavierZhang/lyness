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

The tenant and its identity are read once when the plugin starts, so the append on `session/created` stays synchronous and the record lands in a deterministic position in the log. The prompt sections are registered on each agent's own context through `agent.ctx.inject`, so they go when the agent does; the plugin keeps the fibers only to withdraw them if it is unmounted first, which its own teardown would not reach. The projection's state is also the idempotence guard: a session whose fold already holds a record is left alone, which is what makes a fork and a resumed session keep their original stamp. A record carries its own `version`, following the subagent descriptor: a later field set changes the version deliberately rather than silently widening what readers must accept.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tenant](../tenant/README.md) — the directory this plugin names its tenant in.
- [tenant-config](../tenant-config/README.md) — where the identity text comes from.
- [system-prompt](../../core/system-prompt/README.md) — the registry the two sections are ordered in.
- [Persistence catalog](../../../docs/persistence-catalog.md#tenantidentity--log-only) — the generated entry for this event.
- [Multi-tenancy subsystem](../../../docs/subsystems/multi-tenancy.md) — the tenant vocabulary and how a request resolves to one.

-----

<a id="model-experience"></a>
## Model Experience

### The organization's identity

#### What the model sees

Two sections of each agent's own prompt, appended after the deployment's persona and before its policy. The voice the tenant asked for is its prose verbatim. Its rules read as `The organization this conversation belongs to requires:` followed by one line per rule — the organization, not this deployment's word for its customers, because a prompt carries task-relevant concepts and nothing else. A tenant that asked for neither contributes neither section.

#### Token effect

Fixed per request, for the length of what that tenant wrote. It is part of the prefix, so it is paid once per cached prefix rather than per turn.

#### KV Cache effect

Stable for the life of one conversation: the text comes from that session's own record, so a tenant editing its identity changes what later conversations assemble and never invalidates a running one's prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **The identity is read once per session** — the record is written at creation and the prompt is composed from it, so a configuration edited while a conversation runs reaches the conversations created after the edit, not that one. That is the intended reading, and it is also the only one the log supports.
- **Two layers of four** — platform and organization identity reach a request; the user and agent layers the design names have no records to carry them here.
- **Rules are prose, not policy** — a constraint reaches the model as a sentence it is asked to follow, and nothing enforces it. A tenant that needs a rule enforced needs a permission preset, not a constraint.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The projection state and the log are one observation folded from the other, not two sources that could diverge.
