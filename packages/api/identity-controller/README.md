---
description: "Who the caller is, and what this deployment would let them sign in with."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-identity-controller

English | [中文](README.zh.md)

## Summary

`dsh-api-identity-controller` owns the `identity` Remote namespace: one answer carrying whether this deployment has accounts, who the caller is, the standing they act in, and the channels a sign-in surface may offer. It is readable by anyone, because the caller who needs it most has presented no identity yet — a surface cannot render a sign-in screen without first asking whether there is one to render. Signing in and out are browser navigations `dsh-sign-in-http` owns; this namespace only says where they are.

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

The Web bundle mounts it on every deployment, with accounts or without:

```yaml
- id: identity-controller
  name: '@deepseek-ai/dsh-api-identity-controller'
```

A browser calls `ctx.remote.identity.viewer()` and reads the answer as the view this package declares:

```ts
import type { ViewerView } from '@deepseek-ai/dsh-api-identity-controller/types'

/**
 * Whether a surface should render a sign-in screen rather than the product.
 * @param view - what `identity/viewer` answered.
 * @returns true when this deployment has accounts and the viewer is not in one.
 */
export function mustSignIn(view: ViewerView): boolean {
  return view.accounts && view.person === undefined
}
```

A channel is offered by linking to `${signInPrefix}/${channel.id}`, and signing out by linking to `signOutPath`. Both are navigations rather than calls: one leaves for a directory's own page and the other clears a cookie, and neither can happen inside an RPC.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One answer, not two calls.** A surface deciding what to render needs the deployment's shape and the caller's identity at the same moment. Asking separately means rendering the product to somebody who must sign in, or a sign-in screen on an installation that has nobody to sign in.

**The request principal is what decides `accounts`.** A deployment that mounted the sign-in registry without the principal could never act on who signed in, so the principal — not the registry — is the fact that says accounts exist.

**A session that outlived its person reads as signed out.** The principal names somebody the directory no longer holds; answering with an id and no name would put a ghost in the corner of every page.

**`anyone` is the whole point.** Every other namespace classifies its callers; this one exists to be read before anybody is classified, so it declares the one standing that asks for no identity at all.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-sign-in`](../../identity/sign-in/README.md) — the channel registry this reports, and the admission rule behind it.
- [`dsh-sign-in-http`](../../identity/sign-in-http/README.md) — the routes the paths in this answer point at.
- [`dsh-api-remote-authority`](../remote-authority/README.md) — why `anyone` is a declaration rather than an absence.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a surface deciding what to render, and nothing it reports reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Nothing gates the product on it** — the answer says a viewer must sign in, and no surface yet refuses to render without one. A hosted deployment still serves its pages to a signed-out browser, which the Remote authority rule then refuses call by call.
- **One standing, not a choice of them** — a person holding standings in two organizations acts in whichever their session carries, and this namespace reports that one rather than offering the others.
- **No channel configuration** — the channels are the composition's; a deployment or a tenant administrator cannot add, remove, or reorder one from a surface.
- **The paths are this deployment's own** — a composition that mounts `dsh-sign-in-http` under different routes would report the default ones, because the constants are imported rather than asked for.

**Runtime invariant:** No companion is published. Every field is projected from the principal, the directory, and the registry at the moment it is asked, so there is no second copy to disagree with them.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Every service it reads is optional (`ctx.get`), because the namespace mounts on deployments that have none of them; adding a required injection here would stop a single-operator install from answering `accounts: false`.

</details>
