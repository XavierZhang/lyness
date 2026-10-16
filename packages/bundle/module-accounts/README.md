---
description: "The accounts module as its own bundle, refusing to boot rather than inventing who administers a deployment."
kind: "package-bundle"
---

# @lyness/lyn-module-accounts

English | [中文](README.zh.md)

## Summary

This bundle is what a shipped product selects to state that it serves named people rather than one operator. It carries the directory, signed-in sessions, the sign-in registry and its browser routes, the principal one call speaks for, the context that call may act in, the owner a conversation is opened under, and the ledger with its grants, allowances, and metering. Two of its rows ship no usable default on purpose: the roster names nobody and fails at load, and the admission roster binds nobody, so a deployment states who its people are before it serves any of them.

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

The `hosted` profile template selects it. A developer profile does not, because an install with one person at the keyboard needs none of it.

A deployment that selects it writes two things. Its people, as the `people` row's roster:

```yaml
- id: people
  name: '@lyness/lyn-people/static'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
```

And, once a sign-in channel is mounted, who each verified subject is allowed to be, as the `sign-in-admission` row's bindings:

```yaml
- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: microsoft-entra
        issuer: 00000000-0000-0000-0000-000000000000
        subject: 11111111-1111-1111-1111-111111111111
        person: ada
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Two rows refuse rather than admit.** An empty roster fails at load, because a default person would be this bundle deciding who administers somebody else's installation. An empty binding list admits nobody, because a connected directory with no bindings written yet must not sign anyone in — the alternative is a window in which the whole directory can.

**No channel is here.** Every sign-in channel carries the credentials of one directory registration, which belong to the deployment rather than to a bundle. A deployment adds the channel it uses beside these rows.

**Metering rides the waterfall.** `credits/enforce` listens on `llm/stream`, so a preset row, a profile patch, or a direct RPC cannot reach a model without being charged. Enforcing at a surface instead would leave every other caller unmetered.

**The allowance is the row an installation changes first.** The ledger's recurring grant is a deployment decision, so it is written here as a visible number rather than left to a constant.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-people`](../../identity/people/README.md) — the directory and what each role may do.
- [`lyn-sign-in`](../../identity/sign-in/README.md) — the channel registry and the admission rule.
- [`lyn-credits`](../../credits/credits/README.md) — the ledger, the allowance arithmetic, and the authority rule.
- [Diverging from the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why the hosted shape needs any of this.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through metering: a turn whose account cannot cover it is refused inside `llm/stream`, and the model sees no request at all. No tool, prompt, or schema changes.

#### KV Cache effect

No request prefix changes, because no row here contributes instructions; a refused turn makes no request to cache against.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No channel ships with it** — until a deployment mounts one, nobody can sign in, and the admission bindings have nothing to match.
- **The roster is composition config** — adding a person is an edit to cordis.yml and a restart, not a surface, because `lyn-people` has only a static directory.
- **No sign-up** — a hosted deployment's people arrive by signing up, which needs an admission rule that provisions on first sign-in within a tenant's own directory; this bundle carries the roster rule instead.
- **Tenancy is not selected here** — the tenant directory, its configuration, and the request resolver are their own packages, and a hosted deployment composes them separately.
- **The ledger's numbers are one deployment's** — `periodicAmount` and the pricing in `credits/enforce` apply to everyone the deployment serves, with per-organization overrides written through the credits surface rather than here.

**Runtime invariant:** No companion is published. A bundle contributes composition rows; every relation its rows hold is checked by the package that owns it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The row order is the reading order, not a dependency order: Cordis resolves these by injection, so moving a row changes only what a later patch layer can override.

</details>
