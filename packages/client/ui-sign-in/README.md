---
description: "The sign-in screen a deployment with accounts shows, and the row naming who is signed in."
kind: "package-reference"
---

# @lyness/lyn-client-ui-sign-in

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-sign-in` is how a person gets into a deployment that serves named people: a screen that covers the product while nobody is signed in, offering one button per channel the deployment mounts, and a General Settings row naming whose session this is with the way out. Both read one answer from `remote.identity`, so opening Settings and loading the frame do not ask the deployment twice. On a deployment with no accounts both render nothing, and the single-operator shape sees no change.

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

The Web bundle mounts both halves beside the namespace they read:

```yaml
- id: identity-controller
  name: '@lyness/lyn-api-identity-controller'
- id: ui-sign-in
  name: '@lyness/lyn-client-ui-sign-in'
```

Nothing else needs configuring. What appears follows from the answer: no accounts renders nothing, accounts with nobody signed in covers the product, and a signed-in viewer sees only the Settings row.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The screen covers the product rather than sitting beside it.** Every other surface on the page is about to be refused — the Remote authority rule turns away an unidentified call — and a product rendered under that is a page of error states.

**It asks as soon as the frame is up.** Every other surface's calls depend on the answer, so waiting for an interaction would mean waiting through a page of refusals.

**Nothing shows until the answer arrives.** A screen that flashed before every load would be worse than one that arrives a moment late, so an unanswered read renders nothing rather than a guess.

**A channel is a link, not a call.** Signing in leaves for the directory's own page and signing out clears a cookie; neither can happen inside an RPC, so both are navigations to the paths the deployment reported.

**One read, two surfaces.** The screen and the row answer the same question, and the binding publishes one outcome to every store the framework has baked. A viewer who signs in sees the screen go away and the row fill in from the same answer.

**A failed refresh keeps what it already read.** Blanking the viewer on a failure would cover a signed-in person's product with a sign-in screen because the network blinked.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-identity-controller`](../../api/identity-controller/README.md) — the namespace both surfaces read.
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.md) — the routes the links point at.
- [`lyn-api-remote-authority`](../../api/remote-authority/README.md) — what actually refuses an unidentified caller.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is what a person sees before a session exists, and nothing it renders reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The cover is an affordance, not the enforcement** — the server refuses an unidentified call either way, and a viewer who dismissed this screen from a console would see a page of refusals rather than anybody's data.
- **No self-driven channel** — only channels the browser can be sent to are offered; a channel that completes in the process owning the browser is left out, because a server has nowhere to send that person.
- **No standing to choose from** — a person holding standings in two organizations acts in whichever their session carries, and the row names that one without offering the others.
- **Nothing says why a sign-in failed** — the callback route reports its own refusal, and the screen a person returns to just shows the channels again.
- **It does not refresh on its own** — the answer is read when a surface mounts, so a session that lapses in another tab shows as signed in until something asks again.

**Runtime invariant:** No companion is published. Both surfaces render one read's outcome, and the binding is its only publisher.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The binding holds a set rather than one slot, unlike the single-surface packages it is modelled on: two surfaces register, so two stores are baked, and a read that reached only the last one bound would leave the other blank.

</details>
