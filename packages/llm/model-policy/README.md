---
description: "The models a deployment allows: the seam, the operator-written provider, and the waterfall that refuses everything else."
kind: "package-reference"
---

# @lyness/lyn-model-policy

English | [中文](README.zh.md)

## Summary

Use `lyn-model-policy` to make the allowed model list a deployment's decision rather than a user's. The seam answers which models the request being resolved may use and which authority decided that; `./static` serves one operator-written list; `./enforce` sits on the `llm/stream` waterfall and refuses any route the policy does not name. Mounting no provider leaves a deployment unrestricted, which is what a single-tenant developer install wants.

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

An installation with one list — the enterprise shape — mounts the static provider and the enforcement together:

```yaml
- id: model-policy
  name: '@lyness/lyn-model-policy/static'
  config:
    authority: your IT administrator
    allowed:
      - provider: deepseek-official
        model: deepseek-flash
- id: model-policy-enforce
  name: '@lyness/lyn-model-policy/enforce'
```

| Field | Default | Meaning |
|---|---|---|
| `allowed` | required, non-empty | Models an authorized user may use |
| `authority` | `this deployment` | Who a refusal names |

`allowed` is required and rejected when empty: an installation that allows nothing serves no one, and an empty list is far likelier an unfinished edit than an intention, so it fails at load instead of refusing every request.

An installation whose administrator changes models at runtime mounts `./store` instead, which persists what they save:

```yaml
- id: model-policy
  name: '@lyness/lyn-model-policy/store'
  config:
    organization: acme
    initial:
      - provider: deepseek-official
        model: deepseek-flash
```

Omit `organization` where only a platform administrator may save — the enterprise shape, which has no tenants. Name it on a hosted deployment so that tenant's administrator saves for its own organization and no other.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

Enforcement sits on the `llm/stream` waterfall, which every streaming call passes — loop-built, hand-built, retry, replay. That placement is the point of this package. A filtered model picker is a presentation; a preset row, a profile patch, and a direct RPC each reach the runtime without passing one, so the operation that makes the decision is the operation that enforces it.

A refused call throws `LlmError` with code `MODEL_NOT_ALLOWED`, distinct from a route that does not exist, and carries no provider facts because the refusal happens before the provider boundary.

The refusal names the authority deliberately. "This is what the service offers" and "ask your administrator" lead to different next actions, and a refusal naming neither produces a support case rather than a fix.

`allowance()` is called per request rather than cached, because a hosted deployment resolves a different tenant per request and an administrator's change should reach the next one.

A save takes the requesting standing as a parameter, and the backend checks it. That placement is deliberate for the same reason the refusal sits on the waterfall: an authorization check in a page or an RPC handler is bypassed by the next caller — a maintenance task, a CLI, a setup wizard — while one in the write cannot be. `administers` decides it, so a tenant administrator saves for its own organization, a platform administrator for any, and a member never.

A backend states whether it is writable rather than letting a surface discover it by failing, and the read-only default means a backend opts into writing instead of inheriting it. A save that would empty the list is refused for the same reason the operator-written one refuses an empty config.

The seam exists instead of reading tenant configuration directly because the two shipped shapes differ: an enterprise install has no tenants at all, so a policy bound to tenants could not serve it.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-llm`](../llm/README.md) — the runtime and the `llm/stream` waterfall this enforcement joins.
- [`lyn-model-required`](../model-required/README.md) — the companion guard for a deployment that reaches no model at all.
- [`tenant-config`](../../tenant/tenant-config/README.md) — the per-tenant roster a hosted provider reads.
- [The model is a deployment decision](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.md) — why enforcement is here and not in a surface.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it only refuses calls the deployment does not allow.

#### KV Cache effect

No request prefix changes: a permitted call sends exactly what it sent before, and a refused one sends nothing, so no prefix is built and none is invalidated.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A refusal arrives at the call, not at selection** — a user who picks a disallowed model in a surface learns it when the turn fails. Filtering the picker is still worth doing; it is a presentation on top of this rule, never a replacement.
- **The static provider serves one list for every request** — correct for an installation with one administrator, and the reason a hosted deployment needs its own provider.
- **A saved allowance is one list per backend** — a hosted deployment therefore mounts one backend per tenant rather than one backend holding every tenant's list.
- **No modality dimension yet** — `tenant-config` models allowance per modality, and this seam does not. A deployment allowing a model for text but not vision cannot express that here.

**Runtime invariant:** No companion is published. The seam holds no state beyond the operator's frozen list, and its one waterfall listener is effect-owned.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Every test in this package reaches the runtime directly, with no surface in between, because that is the claim being proven. A test that drove a model picker would pass while the rule was bypassable.

</details>
