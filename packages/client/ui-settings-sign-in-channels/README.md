---
description: "The Settings section where an administrator configures the directories people sign in through."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-sign-in-channels

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-sign-in-channels` adds one Settings section: the channels this deployment signs people in through, and the form that adds, edits, and removes one. Its fields come from the kind the administrator picked, so it never asks for a setting a directory does not take. The application secret goes in and never comes back — nothing the section reads can produce one.

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
- id: ui-settings-sign-in-channels
  name: '@lyness/lyn-client-ui-settings-sign-in-channels'
```

There is nothing else to configure. The section reads `remote.signInChannels` when it opens, and renders one of four things: the channels and the form, a notice that this deployment configures none, a notice that the caller may not configure them, or a failure with a retry.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Three answers, one of which is worth a retry.** A deployment that mounts no store will not grow one while the reader waits, and a caller without the standing will not gain it by asking again. Only a read that broke gets the button.

**The form is built from the kind.** Each kind declares its own settings, and the form renders exactly those — labelled as that directory names them, marked required where the kind says so. Picking another kind clears what was typed, because a corpid is not an app id.

**A refusal marks the fields it named.** `sign-in-channels/incomplete` carries the settings that were empty; the form marks those and no others, so a refusal about a standing never points at a field that is already right.

**Removal asks first.** Taking a channel away ends the way in for everybody who used it and deletes its secret, so it goes through the shared risk confirmation rather than a single click.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-sign-in-channel-controller`](../../api/sign-in-channel-controller/README.md) — the namespace this section calls, and what each refusal means.
- [`lyn-sign-in-channels`](../../identity/sign-in-channels/README.md) — the records behind it, and the one rule that decides who may change what.
- [`lyn-client-ui-sign-in`](../ui-sign-in/README.md) — the screen the configured channels appear on.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it renders a configuration surface, and nothing it shows reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The section is offered to every reader** — a member who opens Settings sees it and reads the notice that they may not configure channels, rather than not being offered the section at all. Hiding it needs the navigation to know the caller's standing before the section's own read answers.
- **No test button** — a saved channel reads as serving when its kind accepted the settings, which is not the same as a directory that answers; the first person to try signing in is what finds out.
- **Organization is typed, not picked** — the form takes an organization id as text, because no directory of organizations is readable from the client yet.

**Runtime invariant:** No companion is published. The section renders from one read and the outcomes of its own calls; there is no second copy to disagree with the deployment.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The read lives in the plugin rather than in the component so one in-flight read is shared by every open surface; `SectionBinding` is what lets that read settle before the framework has baked a store.

</details>
