---
description: "Which DeepSeek-compatible platform the real-API e2e suites call, resolved from the variables the product already reads."
kind: "package-reference"
---

# @lyness/lyn-e2e-target

English | [中文](README.zh.md)

## Summary

Use `lyn-e2e-target` in a real-API e2e suite instead of naming a model. It resolves the platform a run calls from the variables the product itself reads — `DEEPSEEK_BASE_URL` for the endpoint and `DEEPSEEK_MODELS` for the models it serves — so the product and the suite always point at the same place. With neither set, the target is the official API and its default model. It also says whether the target is the official API, so a suite can skip elsewhere when it needs an official-only feature or when its adapter routes only official model ids.

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

Point a run at another platform with the product's own variables:

```sh
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://gateway.example/v1
DEEPSEEK_MODELS=deepseek-ai/DeepSeek-V4-Flash
pnpm run test:e2e
```

A suite reads the model from the target and gates official-only features on it:

```ts
import { E2E_TARGET } from '@lyness/lyn-e2e-target'

/** The agent options a real-API suite creates its agent with. */
export const agentOptions = { provider: 'deepseek-official', model: E2E_TARGET.model }

/**
 * Whether a suite that reads prompt-cache accounting can run on this target.
 * @returns true only on the official API, which reports that accounting.
 */
export function cacheAccountingAvailable(): boolean {
  return E2E_TARGET.official
}
```

The model is the first id `DEEPSEEK_MODELS` names. A value the product would refuse — empty, or with a blank entry — fails here too, at import.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`resolveE2eTarget(env)` is the resolution; `E2E_TARGET` applies it to `process.env` once, at import. It parses `DEEPSEEK_MODELS` with the provider's own `parseModelIds`, and compares the endpoint to the provider's `PUBLIC_BASE_URL` after trimming trailing slashes, so the suites and the product cannot disagree about what a value means.

The provider's own e2e reads the variable through `parseModelIds` directly rather than importing this package, because this package depends on the provider.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [llm-deepseek](../../llm/llm-deepseek/README.md) — the provider that reads the same variables, and how `DEEPSEEK_MODELS` replaces its catalog.
- [Testing policy](../../../docs/testing.md) — when a suite calls a real model, and which platform it calls.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package only chooses which model a test addresses; it registers no prompt, tool, or session event.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **One model per run** — every suite uses the first configured model; a suite that compares two models on another platform has no second id to take.
- **DeepSeek-compatible platforms only** — the target is always reached through the DeepSeek provider route; a platform that speaks another API is a different provider, configured through `llm-pi-ai`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The target is a pure function of the environment evaluated once, so there is no second observation that could diverge from it.
