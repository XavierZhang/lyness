---
description: "Whose conversation a session is, for hosted deployments answering for what their people did."
kind: "package-reference"
---

# @lyness/lyn-session-ownership

English | [中文](README.zh.md)

## Summary

`lyn-session-ownership` records whose conversation a session is: the person who opened it, and the standing they held it open under. It is written once, at creation, from the principal the call published, and never rewritten. A private deployment never needed it — there is one person — while a hosted process serves many organizations, and a conversation nobody is attributed to is one its organization cannot answer for. A session opened by nobody, such as a CLI run or an inbound webhook, carries no owner rather than an invented one.

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
- id: session-ownership
  name: '@lyness/lyn-session-ownership'
```

It takes no configuration and needs the sessions, the projection registry, and the request principal. A reader asks the session:

```ts
import type { Context } from '@lyness/cordis'
import type { Session } from '@lyness/lyn-session'
import { ownerOf } from '@lyness/lyn-session-ownership'

declare const ctx: Context
declare const session: Session

const owner = ownerOf(ctx, session)
if (owner !== undefined) {
  // owner.owner is the person; owner.membership is the standing, when there was one
  void owner
}
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Two fields, because a person is not an organization.** One person holds one identity and may hold several standings at once, so "which organization" is a property of the act rather than of the person: a conversation opened while acting for one organization belongs to it, whatever else its owner belongs to.

**The standing is recorded, not derived.** Both sides of it move. Someone who leaves one organization and joins another must not drag their old conversations into the new account, and an organization reading its own history has to see what was true when each conversation happened.

**Written once, never rewritten.** A session log is released data: attribution recorded wrongly would stay wrong, and attribution added in two steps would cost two format changes instead of one. The projection is what makes "once" enforceable — a session that already carries the record is left alone, so a restart adds nothing.

**No owner is a real answer.** A CLI run, a subagent and an inbound webhook all create sessions no request principal opened. They carry no owner, because attribution invented here would be permanent.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Session ownership](../../../.agents/notes/proposed/architecture/2026-10-07-session-ownership.md) — the decision, including what removing a member does and does not change.
- [`lyn-request-principal`](../request-principal/README.md) — where the opening person comes from.
- [`lyn-tenant-session`](../../tenant/tenant-session/README.md) — the deployment-wide tenant stamp this one does not replace.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: `session/owner` is log-only attribution and stays out of the model transcript. The model is answering a person, not reading their account.

#### KV Cache effect

No request prefix changes, because the event never enters the assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Nothing filters by owner yet** — the record exists; the session list, the query backends and the export surface still show every session a reader can reach.
- **Archived-on-removal is not implemented** — the decision derives an archived state from the owner's standing; nothing reads it that way today.
- **An unowned session is indistinguishable from a pre-attribution one** — both read as no owner, so a deployment that mounted this plugin late cannot tell which of its old sessions simply predate it.
- **A hosted deployment can still create unowned sessions** — webhook and subagent sessions legitimately have no principal, so absence cannot be made an error here.

**Runtime invariant:** No companion is published. The record has one writer and one reader, both inside the session's own log, so no two observations of it can diverge.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`session/owner` is required-on-read like every other `SessionEventMap` member: a build that does not know it refuses the log rather than serving someone else's conversation without their attribution.

</details>
