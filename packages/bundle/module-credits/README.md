---
description: "The credits module as its own bundle: a ledger, a recurring allowance, and metering a model request cannot go around."
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-credits

English | [中文](README.zh.md)

## Summary

`dsh-module-credits` is the composition that meters what a deployment's people spend: the ledger, the recurring allowance, the administrator decisions that change it, and the enforcement that rides `llm/stream`. It is selected beside [`dsh-module-accounts`](../module-accounts/README.md), never instead of it: who a request charges is read from that request's principal, and without accounts there is no principal to read.

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

A profile selects it beside the accounts module:

```yaml
bundles:
  - '@deepseek-ai/dsh-module-accounts'
  - '@deepseek-ai/dsh-module-credits'
```

The shipped `hosted` template does exactly that. The `enterprise` template selects accounts and not this one, because metering a customer's own staff on the customer's own hardware would be charging them for their own machine.

The allowance is the number an installation changes first:

```yaml
- id: credits
  name: '@deepseek-ai/dsh-credits/store'
  config:
    periodicAmount: 1000
    period: daily
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Separate from accounts because the questions are separate.** Accounts says who exists and how they sign in; credits says what each of them may spend. A deployment that wants the first and not the second selects one bundle, rather than selecting both and then disabling half of one.

**Absent rather than disabled.** A deployment that does not select this module has no ledger at all: `credits/unavailable` is what every surface reads, which is the only version of "no quota" that cannot leak a balance into a page, a log, or an error message.

**Metering rides the waterfall.** `credits/enforce` listens on `llm/stream`, so a preset row, a profile patch, or a direct RPC cannot reach a model without being charged. Enforcing at a surface instead would leave every other caller unmetered.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-credits`](../../credits/credits/README.md) — the ledger, the allowance arithmetic, and the authority rule.
- [`dsh-module-accounts`](../module-accounts/README.md) — the people this module charges, and the principal it reads them from.
- [`dsh-api-credits-controller`](../../api/credits-controller/README.md) — the namespace a surface reads a balance through.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through metering: a turn whose account cannot cover it is refused inside `llm/stream`, and the model sees no request at all.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The ledger's numbers are one deployment's** — `periodicAmount` and the pricing in `credits/enforce` apply to everyone the deployment serves, with per-organization overrides written through the credits surface rather than here.
- **Selecting it without accounts meters nobody** — the ledger mounts and no request resolves a subject, so every call reads as unmetered rather than refusing loudly. A profile that selects this bundle alone has made a composition mistake nothing yet names.

**Runtime invariant:** No companion is published. A bundle contributes composition rows; the relations worth asserting belong to the packages those rows mount.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

These four rows lived in `dsh-module-accounts` until the enterprise template needed accounts without metering; the split is what keeps "no quota" meaning absent rather than configured to zero.

</details>
