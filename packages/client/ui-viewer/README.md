---
description: "The shared viewer read: who is signed in, and which Settings planes that standing is offered."
kind: "package-reference"
---

# @lyness/lyn-client-ui-viewer

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-viewer` owns the browser's one answer to who is viewing. It reads `remote.identity`'s viewer once, shares that read with every surface that asks, and publishes a snapshot carrying the read's state, the viewer, and whether the administration plane belongs to them. It renders nothing of its own: the sign-in screen, the account row, and the Settings navigation's plane split all read this snapshot, so they cannot ask the deployment three times or show three different answers.

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

Mount it beside the namespace it reads, before the surfaces that consume it:

```yaml
- id: identity-controller
  name: '@lyness/lyn-api-identity-controller'
- id: ui-viewer
  name: '@lyness/lyn-client-ui-viewer'
```

A surface declares `uiViewer` in its `inject`, hands `ctx.uiViewer.state` to its slot registration's `hooks` compartment as `viewer`, and calls `ctx.uiViewer.load()` when it mounts; its component then selects from the snapshot through the generated `useViewer` hook. A surface that may run in a composition without a directory reads the service through `ctx.get('uiViewer')` and decides what its absence means — the Settings shell offers every plane when nothing answers.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One read, however many surfaces.** Callers arriving while a read is in flight join it; a caller arriving after it settled starts a new one. A surface that wants a fresh answer after a failure calls `retry`, which drops the previous outcome first so a reader sees the attempt rather than the failure it replaces.

**The plane is derived where the answer lands, not at each reader.** `administers` is computed once from the viewer the read returned and published in the same snapshot, so two surfaces cannot disagree about which planes a standing is offered.

**Each product shape answers the question its own way.** A deployment with no accounts administers — nobody signs in and nobody is refused, so withholding those pages would hide the operator's own from the only person who has them. A standing above `member` administers. A member, and a personal context that holds no standing at all, do not.

**A failed read withholds the plane again.** The previous viewer is dropped with the failure, because a plane rendered from an answer nothing currently supports is a plane the next call may refuse.

**The split is navigation, never authority.** Every administrative call keeps its own check, so a wrong read here changes what a person is offered and nothing about what they may do.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-identity-controller`](../../api/identity-controller/README.md) — the namespace this service reads.
- [`lyn-client-ui-sign-in`](../ui-sign-in/README.md) — the screen and row that render this snapshot.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — where the two section-plane slots are declared.
- [`lyn-api-remote-authority`](../../api/remote-authority/README.md) — what actually refuses a call the standing does not carry.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers who is at the browser, and nothing it publishes reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **It does not refresh on its own** — the answer is read when a surface asks, so a session that lapses in another tab reads as current until something asks again.
- **No standing to choose from** — a person holding standings in two organizations is reported in whichever their session carries, and the plane split follows that one.
- **Nothing is cached across a reload** — each page load reads again, because a stored standing read after a directory change would decide a plane from a fact nobody currently holds.

**Runtime invariant:** one service instance per client context, and one in-flight read at a time; every surface reads the same snapshot object.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The service takes its read as a constructor argument rather than calling `ctx.remote` itself, so a test drives the full service — states, sharing, derived plane — without a transport.

</details>
