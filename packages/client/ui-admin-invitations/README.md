---
description: "The invitations page of the administration console: issue a code, read what still stands, withdraw one."
kind: "package-reference"
---

# @lyness/lyn-client-ui-admin-invitations

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-admin-invitations` is the page an administrator issues invitations on. It registers into `admin.section`, reads `remote.invitations`, and offers one form: what to call the invitation, the standing it grants, the organization that standing is in, how many redemptions to allow, and how long it lasts. A new code is shown once, with the redemption link built from this deployment's own origin, because the answer that issued it is the only place it exists. Withdrawing one is a confirmed step, and the row stays, closed.

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

The accounts module mounts it beside the namespace it reads:

```yaml
- id: invitations-controller
  name: '@lyness/lyn-api-invitations-controller'
- id: ui-admin-invitations
  name: '@lyness/lyn-client-ui-admin-invitations'
  config:
    joinPath: /join
```

`joinPath` is where the copied link sends somebody, and it must match the path the redemption page is served at: the link is built as `<origin><joinPath>?invite=<code>`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The code lives in one place for as long as the administrator stays.** It arrives in the answer to `issue`, is published as that change's outcome, and is dropped from the row that goes into the list. The next read carries no code at all, because the deployment keeps only a hash — so the page never shows one it could not have just been handed.

**The link is built from the page's own origin.** An administrator sends the address they are looking at; composing it from configuration would let a deployment hand out a link to a host it does not serve.

**Three reasons a read answers nothing, one of them worth a button.** A deployment that issues no invitations and a caller without the standing both say so and offer no retry; only a read that broke does.

**A refusal names its own fields.** `invitations/incomplete` marks the organization field; every other refusal is reported as prose, because there is no field for an administrator to correct.

**Withdrawing is confirmed and not a delete.** The confirmation says the code stops working for anybody who already has it, and the row afterwards is closed rather than gone, which is what the deployment itself answers.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-invitations-controller`](../../api/invitations-controller/README.md) — the namespace this page reads, and every refusal it can report.
- [`lyn-invitations`](../../identity/invitations/README.md) — the bounds a submission is checked against.
- [`lyn-client-ui-admin-console`](../ui-admin-console/README.md) — the page this one renders inside.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a browser surface over a Remote namespace, and nothing it renders reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The code is gone when the page is left** — it is held in the page's store and nowhere else, so a reload after issuing one shows the row without the code.
- **Nothing sends the invitation** — the page answers a code and a link; delivering it is the administrator's own business.
- **The lifetime is three choices** — a day, a week, a month, which a deployment's own bounds may still refuse; naming an arbitrary one is not offered.
- **No paging** — the page renders everything the standing administers.
- **Who redeemed which code is not shown here** — the use count moves, and the administration history is where a redemption is read.

**Runtime invariant:** no code reaches the page except in the answer that issued it, and no code is written anywhere the next read could show it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The row pushed onto the list on a successful issue is the answered view with its `code` dropped, so the list's own shape matches what a later read answers and no component has to decide whether the code it holds is stale.

</details>
