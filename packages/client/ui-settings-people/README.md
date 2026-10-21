---
description: "The Settings section where an administrator maintains who may use a deployment."
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-people

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-settings-people` adds one Settings section: who may use this deployment, what each of them may do, and which directory identity signs in as them. An administrator adds somebody, gives them a standing, and admits the identity that authenticates them; a person the installation's own files name is shown without an edit, because the next boot reads that file again. Adding somebody admits nobody until an identity is bound to them, and the section says so on the row.

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
- id: ui-settings-people
  name: '@lyness/lyn-client-ui-settings-people'
```

There is nothing else to configure. The section reads `remote.people` and `remote.signInChannels` when it opens, and renders one of four things: the roster and the forms, a notice that this deployment maintains no directory of its own, a notice that the caller may not change it, or a failure with a retry.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Three answers, one of which is worth a retry.** A deployment that maintains no directory will not grow one while the reader waits, and a caller without the standing will not gain it by asking again. Only a read that broke gets the button.

**A written person is shown, not offered.** The row says the installation's configuration owns them and carries no Edit, Remove, or Withdraw: a change accepted here would be undone at the next boot, and the surface would have reported something untrue.

**An identity change re-reads the people.** A binding belongs to a person, so what changed is whose identities they are; the server is asked again rather than the row patched locally. A change that landed and a re-read that did not is still reported as the change, because telling an administrator to admit somebody twice is worse than one stale row.

**Admitting is offered where somebody is being edited.** The identity form belongs to one person, and showing it beside the add form would leave it unclear who was about to be admitted.

**Removal asks first.** It ends every way in for that person and withdraws the identities admitted as them, so it goes through the shared risk confirmation rather than a single click. Their conversations stay attributed to them and are not deleted, which the confirmation says.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-people-controller`](../../api/people-controller/README.md) — the namespace this section calls, and what each refusal means.
- [`lyn-managed-people`](../../identity/managed-people/README.md) — the directory behind it, and the rules that decide who may change whom.
- [`lyn-client-ui-settings-sign-in-channels`](../ui-settings-sign-in-channels/README.md) — where the channels a binding names are configured.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it renders a configuration surface, and nothing it shows reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The section is offered to every reader** — a member who opens Settings sees it and reads the notice that they may not change who uses the deployment, rather than not being offered the section at all. Hiding it needs the navigation to know the caller's standing before the section's own read answers.
- **The directory identity is typed, not searched** — the issuer and the subject are entered by hand, because no channel kind offers a directory search; getting one wrong admits nobody rather than the wrong person.
- **Organization is typed, not picked** — the form takes an organization id as text, because no directory of organizations is readable from the client yet.
- **No invitation** — somebody is added by an administrator who already knows their directory identity; there is no flow where a person signs in and asks to be admitted.

**Runtime invariant:** No companion is published. The section renders from one read and the outcomes of its own calls; there is no second copy to disagree with the deployment.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The read lives in the plugin rather than in the component so one in-flight read is shared by every open surface; `SectionBinding` is what lets that read settle before the framework has baked a store. Both namespaces are injected, because a binding names a configured channel and the picker needs that list.

</details>
