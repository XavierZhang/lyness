---
description: "Refuse to serve a deployment that reaches no model, checked at the earliest point an empty registry is conclusive."
kind: "package-reference"
---

# @lyness/lyn-model-required

English | [中文](README.zh.md)

## Summary

Mount `lyn-model-required` to make a deployment that reaches no model fail at startup instead of serving. Without it, a deployment whose declared default model has no reachable adapter starts, serves its interface, and creates sessions that fail at their first prompt — in front of a user who cannot fix it. The check runs when startup commits, writes an operator-facing diagnostic naming the three things that could be missing, and asks the launcher to exit.

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

Mounting it is how a deployment shape states the requirement:

```yaml
- id: model-required
  name: '@lyness/lyn-model-required'
```

A hosted or enterprise template selects it, because neither product should open without a model. A developer profile does not, because an install that has not been given a key yet should still be able to open its own Models page and add one.

The plugin takes no configuration. It injects `llm` and `appReady`, so a launcher that provides no startup signal leaves it inactive rather than checking nothing.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The check runs at successful startup, and that is the earliest point it can run rather than a convenience. A route registers when its own row applies, and [`lyn-llm-pi-ai`](../llm-pi-ai/README.md) registers its routes from the user settings document, so at load time an empty registry is indistinguishable from one whose rows have not applied yet. Failing at load would be a false alarm; this is the earliest resolvable point the repository's misconfiguration rule asks for.

The consequence worth knowing is that the process does start before it exits. An operator sees a short-lived start followed by a non-zero exit and a diagnostic, not a refusal to launch.

The diagnostic names three possible omissions — an undeclared default model, a disabled adapter, an unresolved credential — because an empty registry does not say which one happened. Exit code 78 follows the conventional "configuration error" meaning.

The exit is requested through the launcher's `appExit` rather than thrown. A throw inside a readiness listener is swallowed and leaves the process serving, which is the exact outcome this package exists to prevent.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-llm`](../llm/README.md) — the registry this package queries.
- [`lyn-llm-pi-ai`](../llm-pi-ai/README.md) — the router whose routes arrive from settings, and the reason this check is not at load.
- [The model is a deployment decision](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.md) — why a deployment, not a user, states the model.

-----

<a id="model-experience"></a>
## Model Experience

None, as this plugin registers no tool, prompt, or Session event and only observes the route registry.

#### KV Cache effect

No request prefix changes, because a deployment that passes the check sends exactly what it sent before and one that fails it sends nothing at all.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The process starts before it exits** — the check cannot be earlier without false alarms, so an operator sees a brief start rather than a refused launch.
- **It checks reachability, not usability** — a registered route with an invalid key passes this check and fails at the first request. Proving a key works means spending one model call at startup, which this package does not do.
- **A route registered after startup commits is not rechecked** — a deployment whose settings empty out later keeps serving until its next start.

**Runtime invariant:** No companion is published. The plugin owns no runtime state; its one listener is effect-owned and the registry it reads publishes its own.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The `appReady` narrowing in `apply` is a type narrowing, not a guard: `inject` is what keeps the plugin inactive without a launcher signal. If that narrowing ever grows a diagnostic, it will fire in tests that construct the state artificially and never in a product.

</details>
