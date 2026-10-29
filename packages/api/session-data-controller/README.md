---
description: "A person's own conversations: the deletion they can ask for, bounded by what they may see."
kind: "package-reference"
---

# @lyness/lyn-api-session-data-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-session-data-controller` owns the `sessionData` Remote namespace: one method, which deletes one of the caller's own conversations and answers which stored sessions went. Which conversation it may act on is never a parameter a caller can widen — the ownership rule answers it from the conversation's own log — so somebody else's id is answered exactly as an id that never existed. The namespace reads no list: `session.list` already answers which conversations a caller may see, and a second listing would be the one place a page and the thing it acts on could disagree.

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

Mount it with the service it calls:

```yaml
- id: session-deletion
  name: '@lyness/lyn-session-deletion'
- id: session-data-controller
  name: '@lyness/lyn-api-session-data-controller'
```

`delete(sessionId)` removes that conversation and every subagent session beneath it, then answers their ids. A deployment that selects neither row serves no namespace, and the Settings page that mounts it does not appear.

### Refusals

| Code | Meaning |
|---|---|
| `session-data/not-found` | This caller has no such conversation: it is absent, or it is somebody else's. |
| `session-data/open` | The conversation is open. Nothing was deleted; closing it and asking again succeeds. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One code for absent and for another person's.** A separate refusal for the second would tell one person that another's conversation exists, which is the same reason the export route answers a session it may not see exactly as one that is not there.

**The authoritative read, not the cheap one.** Visibility is decided from an observation of the conversation — a live one answers from its own projection, a cold one from its log — rather than from the listing cache, because this call acts on one named conversation rather than filtering a page of them.

**A deployment with no ownership rule has one operator.** It may delete what it asked to delete; there is nobody else for the answer to be about.

**`member` is the standing it declares.** It admits anybody the deployment knows and demands no organization standing: a conversation belongs to whoever opened it, not to a member of something.

**A conversation that went live between the two steps gets the same answer as one another process is writing.** Both come back as `session-data/open`, because closing it is what makes the deletion succeed either way.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-session-deletion`](../../session/session-deletion/README.md) — what the deletion removes, in what order, and what it leaves.
- [`lyn-session-ownership`](../../identity/session-ownership/README.md) — the rule that decides whose conversation this is.
- [`lyn-client-ui-settings-data`](../../client/ui-settings-data/README.md) — the page that calls this method.
- [`lyn-api-remote-authority`](../remote-authority/README.md) — what enforces the standing this namespace declares.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it serves a person acting on their own stored conversations.

#### KV Cache effect

None at call time. A deleted conversation has no next request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No bulk deletion** — one conversation per call, so a person clearing a long history asks once per row. A page that offered "delete everything" would need a bound nobody has decided.
- **No export method** — the ZIP and Markdown exports are authenticated Host routes that `lyn-session-log-export` owns; this namespace adds no second way to read a conversation out.
- **An open conversation cannot be deleted** — the refusal names it, and a reader closes it first. Ending somebody's conversation to delete it would be a second decision this call does not make.

**Runtime invariant:** every call decides visibility from the conversation's own log before anything is removed.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`delete` answers the removed ids rather than a boolean so a page can say how many stored sessions went: a conversation that delegated work was more than one log, and a person deleting it is entitled to know that.

</details>
