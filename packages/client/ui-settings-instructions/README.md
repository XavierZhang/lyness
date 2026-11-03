---
description: "The instructions section in Settings: what a person tells their own agents."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-instructions

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-instructions` is the personal plane's instructions page: an editor for what a person tells their own agents, the count against what this deployment accepts, and one line saying a conversation already open keeps what it started with. It is a personal page rather than an administration one because the control is the person's own — nobody else sets this, and nothing here reports a decision somebody made for them.

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

The Web bundle mounts it beside the namespace it reads:

```yaml
- id: personal-instructions-controller
  name: '@lyness/lyn-api-personal-instructions-controller'
- id: ui-settings-instructions
  name: '@lyness/lyn-client-ui-settings-instructions'
```

Nothing else needs configuring. The section registers into `settings.section`, which is the personal plane, and appears for every reader.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The draft is the component's and the saved text is the store's.** They answer different questions — what the person is typing, and what their next conversation will carry — so the page says which of the two is in force rather than letting an unsaved draft read as a setting.

**The draft follows the deployment's answer until the person types.** Resetting it on every answer would discard what they were writing while a save landed; never following it would hide what the deployment now holds.

**The read starts when the section opens, not at plugin load.** A person who never opens this costs the deployment no request.

**Clearing is a blank save, not a second call.** The namespace treats blank text as "no instructions", so the button has nothing of its own to get wrong.

**A call that owns nothing is told apart from a read that broke.** The first has nothing to retry and nothing to edit, so it says so; only the second offers the retry.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-personal-instructions-controller`](../../api/personal-instructions-controller/README.md) — the namespace this page reads and writes.
- [`lyn-personal-instructions`](../../identity/personal-instructions/README.md) — what the saved text then does.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — where the two section-plane slots are declared.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is an editor over a stored text, and `lyn-personal-instructions` owns how that text reaches a model request.

#### KV Cache effect

No request prefix changes from this page; saving changes what the person's next session records, which that package's own Model Experience describes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No preview of the assembled prompt** — the page shows the text the person wrote, not the section the model will read; the two differ by one introducing line.
- **No formatting help** — the field is plain text, because the stored record is plain text and a rich editor would promise structure the prompt does not keep.
- **The draft lives in the open panel only** — closing Settings with unsaved changes discards them, and nothing warns first.

**Runtime invariant:** the editor sends exactly what the field holds, and shows exactly what the deployment answered.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The Save button is disabled while the draft equals the saved text, which is also what keeps the "Saved." notice from sitting under a field the person has since edited.

</details>
