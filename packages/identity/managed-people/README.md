---
description: "The people and admission bindings a deployment's administrators maintain at runtime, over the roster composition wrote."
kind: "package-reference"
---

# @deepseek-ai/dsh-managed-people

English | [中文](README.zh.md)

## Summary

`dsh-managed-people` is where a deployment's people come from once it is running. Composition still names the first of them — an empty system has no administrator to add the first administrator — and every one after is added through a surface: a person, their standing, and the directory identities admitted as them. The written half wins every lookup and cannot be changed here, because the next boot reads the file again. It provides both halves of the question: `ctx.people` says who exists and what they may do, `ctx.signInAdmission` which verified subject is which of them.

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

Three rows, in place of the static roster and the roster admission rule:

```yaml
- id: managed-people
  name: '@deepseek-ai/dsh-managed-people'
- id: people
  name: '@deepseek-ai/dsh-managed-people/directory'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
- id: sign-in-admission
  name: '@deepseek-ai/dsh-managed-people/admission'
  config:
    bindings: []
```

The directory and admission rows read the same `people` and `bindings` configuration their static counterparts do, so an installation that already wrote its roster keeps it verbatim and gains the ability to add to it. The roster must still name at least one person: they are who adds the rest.

An administrator adds a person and the identity that signs in as them:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-managed-people'
import type { Membership } from '@deepseek-ai/dsh-people'

declare const ctx: Context
declare const by: Membership

const bea = await ctx.managedPeople.save({ displayName: 'Bea', role: 'member', organization: 'acme' }, by)
await ctx.managedPeople.bind({
  channel: 'b2f1c0de-0000-4000-8000-000000000000',
  issuer: 'ww-acme',
  subject: 'bea',
  person: bea.id,
}, by)
```

`list(by)` answers the people that standing administers, written and stored alike, each with the identities admitted as them and whether composition owns the entry. A refusal is a `PeopleRefusedError` carrying one of five reasons, so a surface marks the field or disables the row rather than matching prose.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Both halves coexist, and the written half wins.** Composition is re-read at every boot, so a stored entry that shadowed a written one would be the configuration for exactly as long as nobody restarted. A change to a written person or binding is refused as `written` rather than accepted and silently undone.

**Granting a role grants what it may do.** A tenant administrator cannot make a platform administrator, because that standing administers every organization including the ones they do not. A change is authorized against the **stored** record as well as the submission, or one tenant's administrator could take another's person by naming their id with their own organization.

**A binding is authorized by the person and by the channel.** A binding on another organization's directory lets that organization's people sign in here, so the channel must be one the standing administers, read from the configured channels where a deployment stores them. Where it stores none, the person is the whole authorization.

**A standing's identity never moves.** It is derived from the person's identity alone, so changing somebody's role does not change the membership id an open session already names — a session whose standing moved would act with no standing rather than with the new one.

**Every change is recorded elsewhere, before it is read back here.** The directory holds what is true now; [`dsh-admin-audit`](../admin-audit/README.md) holds who changed it and what the change replaced — a role, a name, or which person a directory identity signs in as. It is a hard injection, so a deployment that administers people without keeping their history fails to load rather than recording nothing in silence. Removing somebody records the bindings going with them, in the order the operation does it in.

**An identity is not reused.** A removed person's identity is retired with them, so the conversations they opened stay attributed to somebody who no longer signs in rather than to whoever is added next.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-admin-audit`](../admin-audit/README.md) — the trail every change here is recorded in.
- [`dsh-people`](../people/README.md) — the directory this provides, and the static roster it reads.
- [`dsh-sign-in`](../sign-in/README.md) — the admission rule this provides, and the roster rule it reads.
- [`dsh-sign-in-channels`](../sign-in-channels/README.md) — the channels a binding names.
- [`dsh-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it decides who may use a deployment, and nothing it stores reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One standing per person** — a person belongs to one organization in one role, as the written roster has always had it; somebody who works with two organizations needs two identities.
- **A composition channel cannot be bound by a tenant administrator** — the channel check reads the configured channels, and a channel that came from a composition row is in none of them, so only a deployment whose channels are stored can delegate binding.
- **The stored record keeps only the current values** — a replacement keeps who added the person and when, and overwrites their name and role in place, so what those used to be is read from the [trail](../admin-audit/README.md) rather than from the directory.
- **Removing a person does not end their sessions** — they stop signing in, and a session already established stays valid until it lapses.
- **Nothing stops the last administrator from being removed** — the written roster is the recovery path, which is another reason it cannot be emptied.

**Runtime invariant:** No companion is published. The written half is declared into this service by the rows that read the configuration, and every lookup answers from that one map and the one stored table, so no two observations of who exists can diverge.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The directory and admission rows hold no state: they resolve their configuration, declare it as effects so a reload withdraws exactly what that composition declared, and forward every lookup. Precedence lives in one place as a result, which is what keeps "written wins" from being two rules that could disagree.

</details>
