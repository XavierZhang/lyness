---
description: "Credits a hosted deployment grants, spends, and refuses when exhausted: the ledger seam, its reset clock, and the stored provider."
kind: "package-reference"
---

# @lyness/lyn-credits

English | [中文](README.zh.md)

## Summary

Use `lyn-credits` to meter a hosted deployment's free allowance. A balance is a ledger rather than a counter: grants and debits are both recorded, every debit names the session that spent it, and the balance is what they add up to. `./store` persists it and grants each period's allowance on first use. A spend that the balance cannot cover is refused rather than overdrawn. This exists only on the hosted shape; an enterprise installation mounts none of it.

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
- id: credits
  name: '@lyness/lyn-credits/store'
  config:
    periodicAmount: 500
    period: daily
    offsetHours: 8
- id: credits-enforce
  name: '@lyness/lyn-credits/enforce'
  config:
    creditsPerMillion: 1000
    minimumDebit: 1
```

Enforcement also needs a `creditSubject` provider, which answers whose credits a request spends.

| Field | Default | Meaning |
|---|---|---|
| `periodicAmount` | `500` | Credits granted each period; `0` meters no allowance |
| `period` | `daily` | `daily`, `weekly`, or `monthly` |
| `offsetHours` | `8` | Clock offset from UTC the period is counted against |

`offsetHours` matters more than it looks: a daily allowance on a UTC+8 deployment resets at midnight in Beijing, not at 08:00, because that is what "daily" means to the people using it.

A refused spend throws `CreditsExhausted`, carrying what is available and when the next grant arrives.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The allowance arrives on use, not from a timer.** The first read or spend in a new period records that period's grant. A timer would have to fire for every person on the deployment at the same instant, and would miss anyone whose period rolled over while the process was down. Granting on use costs nothing for people who are not using it and cannot miss a period.

That is idempotent by construction rather than by a flag: a grant carries the instant it was made, so one already inside the current period means the period is covered. Concurrent calls cannot double-grant because every mutation is serialised.

**Grants expire individually, not as a balance.** A periodic allowance lapses at the next reset while purchased credits keep their own longer life. A balance that expired as a whole would take the bought ones with it.

**A refusal leaves the balance intact.** An overdraw is a cost the operator did not agree to, and a person who can exceed a balance has no balance — so the check precedes the debit and a refused spend records nothing.

**Enforcement is check, call, settle.** Checking before the call is what makes exhaustion stop a turn instead of reporting after the cost was incurred; settling after it is what makes the charge the real usage rather than an estimate. A call that reported no usage is not charged — the operator pays for a failed call either way, and charging a person for an answer they never got would be worse.

**A settlement clamps to the balance rather than failing.** The call already completed and the person already has the answer, so refusing the settlement would fail a turn that succeeded.

**Every debit names its session.** A refusal a customer cannot account for is a support case; a balance whose every debit names the session that caused it is answerable.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-people`](../../identity/people/README.md) — whose credits these are.
- [The model is a deployment decision](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.md) — why credits exist on the hosted shape and nowhere else, and why money and credits are separate boundaries.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it answers a metering question for the Host.

#### KV Cache effect

No request prefix changes. A permitted spend leaves the request untouched, and a refused one stops the request before it is built.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One request can cost more than the balance it had** — the model is check, call, settle, so a call that owes more than remains settles to zero rather than failing a turn that already produced an answer. The defence is the check before the *next* request; removing the overshoot entirely needs pre-authorisation rather than settlement.
- **Metering needs somebody to charge** — `./enforce` injects `creditSubject`, so a deployment without one leaves enforcement inactive, which a startup audit reports. The full chain is sign-in, an authenticated session, its acting context, and then that subject.
- **No per-person cap yet** — an organization capping one of its members below the deployment's allowance needs a stored cap and a second authority in the refusal, which this version does not carry.
- **The balance is recomputed from the whole ledger** — correct and auditable, but linear in a person's history, so a long-lived account will want a checkpoint.
- **Grants and debits are never pruned** — the ledger is the product, so retention is a deployment policy rather than a default this package picks.

**Runtime invariant:** No companion is published. Every balance is a function of the stored grants and debits, so there is no independent total that could disagree with them.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The lazy periodic grant is the subtle part: it is correct only because mutations are serialised and because the grant records its own instant. A future version that cached a balance, or that granted without re-reading the ledger inside the same serialised step, can double-grant on concurrent first use.

</details>
