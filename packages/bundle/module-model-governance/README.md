---
description: "The deployment-owns-the-model module as its own bundle, failing closed so a misconfigured policy stops the startup instead of widening it."
kind: "package-bundle"
---

# @lyness/lyn-module-model-governance

English | [中文](README.zh.md)

## Summary

This bundle is what a shipped product selects to state that its models are a deployment decision rather than a user's. It carries the startup guard, the allowed-model policy, and the enforcement that refuses every route the policy does not name. Two of its three rows are shared by both shipped shapes; the policy provider is where they differ, and this bundle carries the static one for an installation with a single administrator-maintained list.

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

The `enterprise` profile template selects it. A developer profile does not, because an install that has not been given a key yet should still open its own Models page and add one.

An administrator's list is this bundle's `model-policy` row:

```yaml
- id: model-policy
  config:
    authority: your IT administrator
    allowed:
      - provider: deepseek-official
        model: deepseek-flash
```

`allowed` is required and rejected when empty, so a deployment that selects this bundle either states its models or fails at load. A hosted deployment disables this row and enables a tenant-resolving provider instead, because its allowance differs per request.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The bundle is its patch document. `src/index.ts` exports nothing and exists because the build pipeline resolves an entry for every package.

| Row | Module | Role |
|---|---|---|
| `model-required` | `@lyness/lyn-model-required` | Refuses to serve when the route registry is empty at startup |
| `model-policy` | `@lyness/lyn-model-policy/static` | The allowed list an administrator maintains |
| `model-policy-enforce` | `@lyness/lyn-model-policy/enforce` | Refuses disallowed routes on the `llm/stream` waterfall |

The property that matters most is that this fails **closed**, and it took a correction to get there. `model-policy` and `model-policy-enforce` are registered as required startup entries. Without that, a policy row that failed to activate left its enforcement waiting for a service that never arrived, and the deployment served *every* model instead of the ones it allowed — a misconfigured guard that widened access rather than stopping the startup. That was observed, not theorised: an empty `allowed` list produced a running server with no enforcement at all.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-model-policy`](../../llm/model-policy/README.md) — the seam, the static provider, and the enforcement.
- [`lyn-model-required`](../../llm/model-required/README.md) — the startup guard and the narrow case it covers.
- [The model is a deployment decision](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.md) — why the shapes differ by template rather than by a runtime flag.

-----

<a id="model-experience"></a>
## Model Experience

None, as this bundle contributes only composition rows; the packages it mounts register no tool, prompt, or Session event and only refuse calls.

#### KV Cache effect

No request prefix changes: a permitted call sends exactly what it sent before, a refused one sends nothing, and the startup guard either lets the deployment serve or stops it.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this bundle needs special care. They are current constraints, not a task backlog.

- **The static provider serves one list for every request** — correct for an installation with one administrator, and the reason a hosted deployment needs its own provider.
- **`model-required` covers a narrower case than its name suggests** — an adapter registers its route with or without a credential, so the real guarantee here is the required non-empty `allowed` list, which fails at load.
- **A refusal arrives at the call, not at selection** — filtering a model picker is still worth doing, as a presentation on top of this rule.

**Runtime invariant:** No companion is published. The bundle owns no runtime state; the rows it inserts are observed by the Loader, and the policy seam holds only the operator's frozen list.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

If either governance row ever leaves `requiredStartupEntryIds`, this bundle silently becomes fail-open: enforcement injects the policy, so an inactive policy means no enforcement rather than no service. That pairing is the whole safety property.

</details>
