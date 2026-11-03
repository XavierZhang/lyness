---
description: "The data section in Settings: a person's own conversations, with the export and the deletion they own."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-data

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-data` is the personal plane's data page: one row per conversation the person reading it can open, with the two things they own over each — a downloaded copy, and its deletion. The rows are the session catalog's own rows, so this page and the sidebar can never disagree about what exists. Deleting asks once on the row itself, is permanent, and the page states what it does not take: an uploaded file's bytes are stored by their contents and may belong to another conversation too.

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

The Web bundle mounts it beside the deletion service and its namespace:

```yaml
- id: ui-settings-data
  name: '@lyness/lyn-client-ui-settings-data'
```

Nothing else needs configuring. The page mounts the `sessionData` namespace itself and registers the section while that namespace is there, so a deployment without the deletion rows shows no data page rather than one whose buttons refuse.

The download is another plugin's. Where `lyn-session-log-export` is mounted, each row offers it and the ZIP is the same archive the Session header's own action downloads; where it is not, the page says so and the deletion still works.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The rows are the catalog's rows.** They are projected from `ctx.sessions.list` — the source the sidebar reads — and cached until that snapshot moves, which is what a `useSyncExternalStore` reader requires of a derived source. A listing of its own would be the one place this page could disagree with what the client holds.

**Blank and subagent rows are not conversations.** A blank row is the unused session a new-conversation gesture holds open. A subagent row belongs to the conversation that delegated to it: the export archives it there and the deletion removes it there, so offering it separately would be two controls over one thing.

**The confirmation is a state on the row, not a dialog.** The thing being confirmed is the conversation the reader is looking at, so the second click lands on the same line as the first. Asking about another row drops the first question, so a confirmation can never be answered for a row the reader has moved away from.

**The row leaves because the Host stopped listing it.** A deletion refreshes the catalog rather than splicing the row out locally. A refresh that fails leaves a row naming a conversation that is already gone, which the next listing corrects — reporting the deletion as refused would be worse, because it happened.

**The download control and the sentence about it ride one answer.** Both follow the download service's presence, so the page never offers a button it cannot use or claims an absence that is not true.

**The namespace is mounted here.** This package is its only consumer, so the page and the call it makes arrive and leave together instead of being wired into the client's core Remote assembly.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-session-data-controller`](../../api/session-data-controller/README.md) — the namespace this page calls and the refusals it renders.
- [`lyn-session-deletion`](../../session/session-deletion/README.md) — what a deletion removes and what it leaves.
- [`lyn-session-log-export`](../../session-query/session-log-export/README.md) — the download each row offers.
- [A personal plane](../../../.agents/notes/proposed/architecture/2026-10-28-the-personal-plane.md) — why this page is personal and what else belongs there.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a human surface over stored conversations.

#### KV Cache effect

None. No request prefix changes when a person reads, downloads, or deletes here.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One conversation at a time** — there is no select-all and no "delete everything", so a long history is cleared row by row.
- **An open conversation refuses** — the page does not disable the control for it, because whether a conversation is open is the Host's answer; the refusal names it and a reader closes it first.
- **No search or paging** — the page lists what the catalog holds, in the catalog's order by recency. A deployment with a very long history offers no way to narrow it here.
- **The download leaves the page** — the browser owns the destination and the progress, so a failure after the download starts is reported by the browser rather than on this page.

**Runtime invariant:** the page renders the session catalog's own rows and asks for confirmation on the row before any deletion is sent.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

If a retention policy ever lands, this page is where it would be stated rather than set: the person reads what a deployment decided, as the capabilities page does for everything else somebody else chose.

</details>
