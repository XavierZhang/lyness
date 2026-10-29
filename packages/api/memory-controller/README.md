---
description: "What this deployment remembers about one person, read and removed by that person alone."
kind: "package-reference"
---

# @lyness/lyn-api-memory-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-memory-controller` owns the `memories` Remote namespace: two methods that read what this deployment remembers about the caller and remove one of those facts. Whose memories a call acts on is never a parameter — the store answers it from the principal the call published — so a caller holding somebody else's id removes nothing. The deployment's shared memories are not served here: they are not one person's to review, and a page that listed them beside somebody's own would invite a removal that takes a fact from everybody.

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

Mount it with the store it reads, which is what the memory module does:

```yaml
- id: memory
  name: '@lyness/lyn-memory'
- id: memory-controller
  name: '@lyness/lyn-api-memory-controller'
```

`list()` answers the caller's own entries, oldest first; `forget(id)` removes one and answers what remains. A deployment that selects no memory module serves no namespace, and the Settings page that injects it does not appear.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The namespace requires a caller the deployment knows.** `member` is the standing it declares, which admits anybody with an identity and demands no organization standing — what is remembered about a person belongs to that person, not to a member of something.

**No method takes a person.** Both derive the owner from the request principal, so there is nothing on the wire a caller could change to reach another person's records.

**A removal is checked against that owner by the store, not here.** `forgetOwnedBy` takes both the owner and the id, so an id belonging to somebody else matches no record. This namespace reports the outcome by reading back what remains rather than by trusting the removal.

**`list` tells a call that owns nothing from a person with nothing remembered.** `owned: false` is the deployment-with-accounts call that presented no identity; the page says so instead of an empty list that would read as "nothing is remembered about you".

**A deployment with no accounts owns nothing here.** It attributes no memory to anybody, so every entry it holds is the deployment's; this namespace serves none of them, and its single operator reviews them through the agent's own tools.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-memory`](../../memory/memory/README.md) — the store, the partition, and what an agent sees.
- [`lyn-client-ui-settings-memory`](../../client/ui-settings-memory/README.md) — the page that calls these two methods.
- [`lyn-api-remote-authority`](../remote-authority/README.md) — what enforces the standing this namespace declares.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it serves a person reading their own records, and `lyn-memory` owns how a remembered fact reaches a model request.

#### KV Cache effect

No request prefix changes at call time; removing a memory changes what that person's next assembly carries, which `lyn-memory` describes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No write** — a memory is written when a person asks their agent to remember something, which is where the sentence they meant belongs; this namespace offers no way to add one.
- **No shared entries** — what the deployment keeps for everyone is not listed, so a person cannot tell a shared fact about them from one nobody recorded.
- **No administrator view** — nobody reads another person's memories through this namespace, including an administrator, because the owner is derived rather than named.

**Runtime invariant:** every method acts on the principal's own owner key and on nothing a caller supplied.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`forget` answers the list rather than a boolean, so a page never has to decide whether a refused removal means "already gone" or "not yours": it renders what the deployment now holds either way.

</details>
