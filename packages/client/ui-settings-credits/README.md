---
description: "The credits section in Settings: a balance, a ledger, and the two decisions an administrator makes."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-credits

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-credits` is the Settings section a person reads their credits in: what this account may spend, everything granted to and spent by it, and — for a standing that administers somebody — a grant form and a recurring-allowance form. Everything comes from the deployment the client connected to, read through `remote.credits`, so a desktop install and a browser each show their own server's ledger. The administrator forms are rendered from the account's own `administrable` field, so the surface never offers a control the next call would refuse.

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

The Web bundle mounts both halves; the Host half contributes nothing of its own:

```yaml
- id: credits-controller
  name: '@lyness/lyn-api-credits-controller'
- id: ui-settings-credits
  name: '@lyness/lyn-client-ui-settings-credits'
```

Nothing else needs configuring. The section appears in Settings as soon as both rows are mounted, and names itself `Credits` in the navigation.

`createCreditsOperations(calls, sink)` from `@lyness/lyn-client-ui-settings-credits/client` builds the read and the two changes from a `CreditsCalls` and a `CreditsSink`, so they are reachable without the slot registration — which is how they are tested, and how another surface could drive the same calls.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The read starts when the section opens.** Not at plugin load: a person who never opens Settings should not cost the deployment a request. One in-flight read is shared, so opening the section twice does not ask twice.

**A deployment that meters nothing is its own state, not a failure.** `credits/unavailable` says so plainly and offers no retry, because there is nothing to retry into. Every other refusal, and a thrown call, read as a failure with a retry — all a reader can do either way.

**A retry shows its attempt.** The previous failure is dropped first, so a reader sees the read happening rather than a failure that may no longer hold.

**A grant to somebody else does not replace the balance on screen.** The call answers with the granted person's account, which is this account only when an administrator granted to themselves; showing it otherwise would put another person's balance under this account's name.

**The forms refuse what the server would refuse.** A blank person and a non-positive amount never leave the browser. Every other rule is the server's, and its refusal is shown with the message the server gave.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-credits-controller`](../../api/credits-controller/README.md) — the namespace this section reads and writes.
- [`lyn-credits`](../../credits/credits/README.md) — the ledger and the allowance arithmetic behind it.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — the section slot this registers into.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a page a person reads, and the ledger's effect on a turn is the refusal `lyn-credits` raises inside `llm/stream`.

#### KV Cache effect

No request prefix changes, because nothing here reaches an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **An administrator types the person id** — the directory offers no listing, so the forms cannot present the people a standing administers.
- **The allowance form does not read before it writes** — it shows who set an override only after a save in this session, because the section reads the caller's own account and not an arbitrary person's allowance.
- **An override cannot be removed** — the server replaces a row but never deletes one, so the form cannot offer "back to inherited".
- **No purchase path** — the ledger knows a `purchase` reason that nothing in this section produces.
- **The ledger is shown whole** — every grant and debit is rendered, with no paging, so a long-lived account grows the page.

**Runtime invariant:** No companion is published. Everything rendered is projected from one Remote answer, so there is no second copy of a balance to disagree with it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`SectionBinding` publishes to nobody until the framework bakes the store, which is what lets `apply` build the operations before anything renders; a read that settles first drops its outcome rather than failing.

</details>
