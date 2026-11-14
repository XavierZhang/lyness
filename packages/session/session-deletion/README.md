---
description: "Delete one conversation: its stored log, every sub-session log beneath it, and the projections cached about them."
kind: "package-reference"
---

# @lyness/lyn-session-deletion

English | [中文](README.zh.md)

## Summary

`lyn-session-deletion` provides `ctx.sessionDeletion`, whose one method deletes a conversation: the named session's stored log, every subagent log beneath it, and each member's cached projections. What it removes is exactly what the ZIP export archives, so a person who exported a conversation before deleting it holds everything that was taken. Nothing is recoverable afterwards and no tombstone is kept. An open conversation is refused rather than removed underneath itself. Mount it where a person or an operator may delete their own history; leave it out and a deployment keeps every conversation it ever stored.

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
- id: session-deletion
  name: '@lyness/lyn-session-deletion'
```

It takes no configuration and needs the persistence backend and the query service. Where the projection cache is also mounted, each deleted member's cached record goes with its log.

```ts
import type { Context } from '@lyness/cordis'
import type { SessionId } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-deletion'

declare const ctx: Context
declare const conversation: SessionId

const { removed } = await ctx.sessionDeletion.delete(conversation)
// removed names every stored session that went, subagents before their parent
```

### What it removes, and what it does not

It removes the stored logs of the conversation and of every subagent session beneath it, with every format generation of each log, and the projection-cache record of each member. It does not remove an uploaded file's stored bytes: a file object is addressed by its content and one object can serve several conversations, so removing it would take a file out of a conversation nobody asked about. A surface that offers this deletion says so rather than leaving a person to assume either way.

### Failures

| Failure | Meaning |
|---|---|
| `SessionDeletionLiveError` | The conversation, or a subagent beneath it, is open. Nothing was removed; it is deleted after it ends. |
| `SessionPersistenceNotFoundError` | The named session has no stored log, or a member was removed by somebody else part way through. |
| `SessionAlreadyOwnedError` | A member went live after the trace, or another process is writing it. |

Removal is not atomic across members. A failure part way through leaves every member it has not reached stored, and the same call run again deletes what remains.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**A conversation is more than one stored session.** Subagents keep logs of their own, so "delete this conversation" has an order and a refusal, which is why it is a service rather than a line inside a caller.

**One lineage answer, shared with the export.** The members are the traced session plus the descendants `sessionQuery.traceSession` reports, walked the way the ZIP export walks them. Deciding separately what a conversation is would let the archive and the deletion disagree about the same word.

**Deepest first.** Lineage is read from each log's own parent field, so removing a parent before its children would leave them in the corpus with nothing to find them by. The reverse of the pre-order walk puts every member's descendants before it, which keeps a failed deletion retryable as the same conversation.

**The log goes before its cached record.** A failure between them leaves a cached record whose log is gone, which the identity guard already refuses; the other order would leave a log whose attribution had been dropped.

**An open conversation is refused twice.** The trace answers whether a member is live, which is the refusal a reader can act on. That answer is one observation, so a member that goes live afterwards is caught by the backend's own write exclusion instead — either way nothing is removed from under a writer.

**Nothing self-heals and nothing has to be told.** The search index rebuilds from the backend's own listing, so a session that leaves it leaves the index at the next sync; this package tells no index and keeps no list of its own.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-session-persistence`](../session-persistence/README.md) — the `delete` operation this service calls, and what each backend promises about it.
- [`lyn-session-projection-cache`](../session-projection-cache/README.md) — the cached record removed with each log.
- [`lyn-session-log-export`](../../session-query/session-log-export/README.md) — the archive whose contents this deletion matches.
- [`lyn-api-session-data-controller`](../../api/session-data-controller/README.md) — the Remote namespace a person reaches this through.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: deleting a conversation is a human act on stored data, and no model request changes at call time.

#### KV Cache effect

None. A deleted conversation has no next request, and no other conversation's prefix is derived from it.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Not atomic across members** — a mid-way failure leaves a partly deleted conversation, and the caller retries. A conversation is several stored logs and no backend offers one barrier over them.
- **Uploaded bytes stay** — file objects are content-addressed and shared, with no reference count to prove the last user is leaving, so their bytes survive the conversation that referred to them.
- **A legacy fork rides with its source** — an ordinary fork is an independent conversation, but a historical log may record its source as its parent, and such a child is removed with the conversation it hangs from. That is the same set the export archives.
- **No recovery and no tombstone** — nothing reads a deleted conversation back, and an id is a slot a later session may take.

**Runtime invariant:** every member is refused while it is open, and a member's log is removed before the record cached about it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

A retention policy — delete what is older than N days, or over a quota — would be a second consumer of this service rather than a second deletion path. It needs a decision about who sets the bound, which the personal surface deliberately leaves to a deployment.

</details>
