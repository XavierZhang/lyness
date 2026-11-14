---
description: "The memory section in Settings: what a deployment remembers about one person."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-memory

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-memory` is the personal plane's memory page: one row per fact this deployment remembers about the person reading it, when it was remembered, and a button that forgets it. It is read-and-remove with no writing, because a memory is written when a person asks their agent to remember something — that is where the sentence they meant belongs. The deployment's shared memories are an administrator's and are not listed.

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

The Web bundle mounts it; the namespace it reads comes with the memory module:

```yaml
- id: ui-settings-memory
  name: '@lyness/lyn-client-ui-settings-memory'
```

Nothing else needs configuring. The section injects `remote.memories`, so a deployment that selects no memory module shows no memory page at all rather than an empty one.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Read and remove, and no writing.** A text field here would invite a fact nobody said in a conversation, and the session log could not explain where it came from.

**What remains comes from the answer, not from the row that was clicked.** The removal reports the whole remaining list, so a row that was already gone disappears instead of lingering, and the page never shows a list the deployment does not hold.

**One removal at a time.** While one is in flight every button is disabled and only its own row says so, which is what keeps a second click from removing the row that moved under it.

**The read starts when the section opens, not at plugin load.** A person who never opens this costs the deployment no request.

**A call that owns nothing is told apart from a person with nothing remembered.** The first has nothing to read and says so; the second is the ordinary empty state, which invites the person to ask an agent to remember something.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-memory-controller`](../../api/memory-controller/README.md) — the namespace this page reads and writes.
- [`lyn-memory`](../../memory/memory/README.md) — the store behind it, and what an agent sees.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — where the two section-plane slots are declared.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it lists stored records for a person, and `lyn-memory` owns how a remembered fact reaches a model request.

#### KV Cache effect

No request prefix changes from this page; forgetting a fact changes what that person's next assembly carries, which `lyn-memory` describes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No confirmation step** — forgetting is one click and cannot be undone; the facts are short and re-remembering one is a sentence in a conversation.
- **No search or paging** — every entry is listed, which is bounded by the store's own retention rather than by this page.
- **Nothing says which conversation wrote a fact** — the store keeps when, not where, so a person cannot trace a memory back to the exchange that produced it.

**Runtime invariant:** the page renders exactly the entries the deployment answered, and sends only an id it rendered.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The removal state is one id rather than a boolean, so the row being removed can say so while the rest only go quiet; a boolean would have put the same label on every row.

</details>
