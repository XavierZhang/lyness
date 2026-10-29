---
description: "What one person told their own agents, read and written by that person alone."
kind: "package-reference"
---

# @lyness/lyn-api-personal-instructions-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-personal-instructions-controller` owns the `personalInstructions` Remote namespace: two methods that read and replace the caller's own instructions, plus the ceiling this deployment accepts. Whose instructions a call acts on is never a parameter — the store answers it from the principal the call published — so a caller cannot reach somebody else's record by asking for it.

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

Mount it beside the store it reads:

```yaml
- id: personal-instructions
  name: '@lyness/lyn-personal-instructions'
- id: personal-instructions-controller
  name: '@lyness/lyn-api-personal-instructions-controller'
```

`describe()` answers the caller's saved text, when it was saved, and `maxChars`; `save(text)` replaces it and answers the stored state read back from the store. A blank text clears the record.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The namespace requires a caller the deployment knows.** `member` is the standing it declares, which admits anybody with an identity and demands no organization standing — a personal page belongs to a person, not to a member of something. A deployment with no accounts enforces no standing at all, which is the right answer for its one operator.

**No method takes a person.** Both read the owner from the store, which reads it from the request principal. There is nothing on the wire a caller could change to act on another record, so the privacy of one person's instructions does not depend on a check somebody has to remember to write.

**`describe` tells a call that owns nothing from one whose instructions are empty.** `owned: false` is the deployment-with-accounts call that presented no identity; the page says so instead of offering an editor whose save would be refused.

**A save answers what was kept.** The view is read back from the store rather than echoed from the argument, so a page never shows a text the deployment did not store.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-personal-instructions`](../../identity/personal-instructions/README.md) — the store and the session record behind these two methods.
- [`lyn-client-ui-settings-instructions`](../../client/ui-settings-instructions/README.md) — the page that calls them.
- [`lyn-api-remote-authority`](../remote-authority/README.md) — what enforces the standing this namespace declares.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it transports what a person wrote, and `lyn-personal-instructions` owns how that text reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No history** — a save replaces what was there, and nothing keeps the previous text; a person who wants a version they overwrote reads it from the log of a session that ran under it.
- **No administrator view** — nobody can read another person's instructions through this namespace, including an administrator, because the owner is derived rather than named.
- **One text per call** — a deployment that wanted per-workspace instructions would need a second key on the wire, which this namespace deliberately does not take.

**Runtime invariant:** every method acts on `ownerOfCall()` and on nothing a caller supplied.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`save` refuses a call that owns nothing rather than writing under a shared key, so a deployment that mounts the principal but is reached without one fails loudly instead of collecting everybody's instructions in one record.

</details>
