---
description: "A person reads their own balance; an administrator grants credits and sets allowances."
kind: "package-reference"
---

# @lyness/lyn-api-credits-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-credits-controller` owns the `credits` Remote namespace: the calling person reads their own balance and ledger, and an administrator grants credits, sets recurring allowances, and reads the accounts of people they administer. Every call acts for the standing the request arrived in, never for one the caller names, and the authority rule itself stays in `lyn-credits` so a read and a grant cannot disagree about who may act. A read answers with `administrable`, so a surface renders its administrator controls from the same answer that fills them.

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

It takes no configuration and needs the ledger, the administration seam, the directory, and the request principal:

```yaml
- id: credits-controller
  name: '@lyness/lyn-api-credits-controller'
```

A browser calls `ctx.remote.credits.mine()`, `grant(input)`, `setAllowance(input)`, `account(person)` and `allowance(person)` the way it calls any namespace, and reads each answer as the view this package declares:

```ts
import type { CreditAccountView } from '@lyness/lyn-api-credits-controller/types'

/**
 * Whether a credits page may offer granting on this answer.
 * @param view - what `credits/mine` answered.
 * @returns true when the calling standing administers somebody.
 */
export function mayOfferGranting(view: CreditAccountView): boolean {
  return view.administrable
}
```

`administrable` is the field a page reads before it renders the grant form. It comes with the account rather than from a second call, so a surface never offers a control the next call would refuse.

### What it refuses

| Code | When |
|---|---|
| `credits/anonymous` | The call presented no identity, and credits belong to a person |
| `credits/not-permitted` | The calling standing may not act on that person — including a call acting in a personal context |
| `gateway/bad-request` | A wire field is malformed — a blank person, a non-positive amount, an unknown period |
| `credits/unavailable` | This deployment mounts no ledger or no administration seam |
| `credits/rejected` | The administration seam's own rule refuses the change; `reason` is its message |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The caller names who, never the authority.** A grant carries the person it affects; the standing making it comes from the request principal and is resolved through the directory. A caller that could send its own authority would be its own administrator.

**Identity, then authority, then capability.** An anonymous call hears that it presented no identity before it learns what this deployment mounts, and a standing that administers nobody is refused before the ledger is consulted. The order is what keeps a deployment's composition from leaking to callers who cannot act on it.

**One authority rule, in the package that owns it.** `CreditAdministration.mayAdminister` answers both questions a surface asks — may this standing grant to that person, and may it see their ledger — because a read that disagreed with the grant beside it would show an account the next call refuses to touch.

**A refusal carries its own code.** `credits/not-permitted` is a different answer from `credits/rejected`: the first says the same arguments would be accepted from another standing, the second says the seam's own rule refuses them. The seam is resolved before the wrapper that maps its refusals, so a deployment missing a ledger is never reported as a rejected request.

**An account carries the limit, not only the balance.** `periodicAmount`, `period`, `periodStartedAt` and `spentThisPeriod` go to every reader, including one who administers nobody: their own limit and what this period has cost are the numbers a person is always entitled to, and the alternative is a surface that cannot tell them why a turn stopped.

**A ceiling is read by the organization and changed by the platform.** `budget` and `myBudget` authorize against the organization, so its administrators see what it bought and what is left; `setBudget` is refused to anyone but a platform standing, and the view says so in `settable` — a surface renders its control from the same answer that fills it rather than offering one the next call would refuse. `myBudget` resolves the organization from the standing for the reason `mine` takes no person: the one organization somebody holds standing in is not a parameter.

**Views, not the ledger's types.** Ids are branded in the Host and plain strings on the wire, and the account adds one fact the ledger does not carry: whether the caller may administer here.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-credits`](../../credits/credits/README.md) — the ledger, the allowance arithmetic, and the authority rule.
- [`lyn-people`](../../identity/people/README.md) — where a standing and its role come from.
- [`lyn-request-principal`](../../identity/request-principal/README.md) — how a call learns who it is.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a person reading or changing an account, and the ledger's effect on a turn is the refusal `lyn-credits` raises inside `llm/stream`.

#### KV Cache effect

No request prefix changes, because nothing here reaches an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No bundle composes it** — like the rest of the identity and credits packages, nothing selects this row yet, so no shipped profile serves the namespace.
- **An administrator must already know the person id** — the directory offers no listing, so a surface cannot present the people a standing administers and has to be given an id.
- **Allowance overrides cannot be removed** — a row can be replaced but not deleted, so an override set by mistake has to be set back to the inherited numbers by hand.
- **An organization-wide change reads back through the setter** — `setAllowance` for a whole organization answers with the setter's own resolved allowance, because the change names no one person to report.
- **No purchase path** — `purchase` is a grant reason the ledger knows and nothing here produces; buying credits is a payment surface this package does not have.

**Runtime invariant:** No companion is published. Every answer is projected from the ledger and the directory at the moment it is asked, so there is no second copy of a balance or a standing to disagree with them.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`refusals` matches the administration seam's authority message by its tail, because `lyn-credits` exports that message as `NOT_PERMITTED` rather than a typed error; if that seam gains a typed refusal, branch on it here instead.

</details>
