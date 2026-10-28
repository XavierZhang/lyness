---
description: "The accounts module as its own bundle, refusing to boot rather than inventing who administers a deployment."
kind: "package-bundle"
---

# @lyness/lyn-module-accounts

English | [中文](README.zh.md)

## Summary

This bundle is what a shipped product selects to state that it serves named people rather than one operator. It carries the directory, signed-in sessions, the sign-in registry with its kinds and routes, the principal one call speaks for, the context it may act in, a conversation's owner, and the rule keeping one person's conversations out of another's list. What they may spend is the [credits module](../module-credits/README.md)'s question. Two rows ship no usable default on purpose: the roster names nobody and fails at load, and the admission roster binds nobody, so a deployment states who its people are first.

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

The `hosted` and `enterprise` profile templates select it. A developer profile does not, because an install with one person at the keyboard needs none of it.

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

**Identity is not metering.** A customer's own servers want named people and no quota, so the ledger is its own bundle; selecting accounts alone leaves every surface reading `credits/unavailable` rather than a balance configured to zero.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-people`](../../identity/people/README.md) — the directory and what each role may do.
- [`lyn-sign-in`](../../identity/sign-in/README.md) — the channel registry and the admission rule.
- [`lyn-module-credits`](../module-credits/README.md) — the ledger these people are charged against, where a deployment meters.
- [Diverging from the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why the hosted shape needs any of this.

-----

<a id="model-experience"></a>
## Model Experience

None, as this bundle registers no tool or prompt: its rows decide who a call speaks for, and nothing they contribute reaches a model request.

#### KV Cache effect

No request prefix changes, because no row here contributes instructions.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No channel ships with it** — until a deployment mounts one, nobody can sign in, and the admission bindings have nothing to match.
- **The roster is composition config** — adding a person is an edit to cordis.yml and a restart, not a surface, because `lyn-people` has only a static directory.
- **No sign-up** — a hosted deployment's people arrive by signing up, which needs an admission rule that provisions on first sign-in within a tenant's own directory; this bundle carries the roster rule instead.
- **Tenancy is not selected here** — the tenant directory, its configuration, and the request resolver are their own packages, and a hosted deployment composes them separately.
- **No directory sync** — a deployment whose staff live in the directory it signs them in through still re-writes the roster by hand; nothing reads that directory's own member list.

**Runtime invariant:** No companion is published. A bundle contributes composition rows; every relation its rows hold is checked by the package that owns it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The row order is the reading order, not a dependency order: Cordis resolves these by injection, so moving a row changes only what a later patch layer can override.

</details>
