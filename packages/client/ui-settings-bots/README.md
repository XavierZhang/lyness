---
description: "The Settings section where an administrator maintains the bots an organization runs."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-bots

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-bots` adds one Settings section: which bots this organization runs, what each one is for, and what it runs with. An administrator names a bot, writes its character and its job, and picks one of the agent presets the deployment offers; a bot the installation's own files name is shown without an edit, because the next boot reads that file again. A bot whose preset the deployment no longer offers is shown and marked rather than hidden, since the character somebody wrote outlives the row that ran it.

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

The Web bundle mounts it beside the other Settings sections:

```yaml
- id: ui-settings-bots
  name: '@lyness/lyn-client-ui-settings-bots'
```

There is nothing else to configure. The section reads `remote.bots` when it opens, and renders one of four things: the bots and the form, a notice that this deployment maintains no bots of its own, a notice that the caller may not change them, or a failure with a retry.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Three answers, one of which is worth a retry.** A deployment that maintains no bots will not grow any while the reader waits, and a caller without the standing will not gain it by asking again. Only a read that broke gets the button.

**Capabilities are picked, never typed.** The preset control offers exactly what `remote.bots.presets` answered, which is the same list the deployment validates a save against. A free-text field here would let an administrator name a composition nobody audited, and would refuse choices the form had just presented.

**A written bot is shown, not offered.** The row says the installation's configuration owns it and carries no Edit or Remove: a change accepted here would be undone at the next boot, and the surface would have reported something untrue.

**A bot that will not run is marked rather than hidden.** Its preset left the profile, so it cannot start a conversation; removing the row would lose the character an administrator wrote, and hiding it would leave them looking for a bot that still exists.

**Removal asks first.** The bot stops running and leaves the roster, and the conversations it owns stay attributed to it with nobody to answer in them, so it goes through the shared risk confirmation rather than a single click.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-bots-controller`](../../api/bots-controller/README.md) — the namespace this section calls, and what each refusal means.
- [`lyn-managed-bots`](../../identity/managed-bots/README.md) — the roster behind it, and the rules that decide who may change what.
- [`lyn-client-ui-settings-people`](../ui-settings-people/README.md) — the sibling section for the people who sign in.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it renders a configuration surface, and nothing it shows reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Nothing here opens a conversation with a bot** — the section maintains the records, and talking to one is the next part of the design.
- **The section is offered to every reader** — a member who opens Settings sees it and reads the notice that they may not change the organization's bots, rather than not being offered the section at all. Hiding it needs the navigation to know the caller's standing before the section's own read answers.
- **Organization is typed, not picked** — the form takes an organization id as text, because no directory of organizations is readable from the client yet.
- **The character is a plain box** — there is no preview of the system prompt a bot would run with, and no way to try one before saving it.
- **No pagination and no search** — every bot the caller administers is listed in one go.

**Runtime invariant:** No companion is published. The section renders from one read and the outcomes of its own calls; there is no second copy to disagree with the deployment.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The read lives in the plugin rather than in the component so one in-flight read is shared by every open surface; `SectionBinding` is what lets that read settle before the framework has baked a store. One namespace is injected rather than two, because the presets a bot may be given are answered by the same roster that validates the save.

</details>
