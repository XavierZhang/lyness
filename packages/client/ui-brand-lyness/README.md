---
description: "lyness brand occupants for the sidebar and conversation hero, replaced member by member by a deployment brand; for users and maintainers choosing or replacing brand presentation."
kind: "package-reference"
---

# @lyness/lyn-client-ui-brand-lyness

English | [中文](README.zh.md)

## Summary

This package fills the sidebar mark, the sidebar name, and the conversation hero mark with the lyness artwork in every client build. When the served page carries a deployment brand from `lyn-brand-deployment`, that brand's mark, wordmark, and product name replace the matching lyness artwork, so one client build serves differently branded deployments. Choose it for lyness deployments, including private deployments branded through composition config. It has no runtime state and does not affect model requests.

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

Mount this plugin in the browser roster. The Web application bundle mounts it in place of `lyn-client-ui-brand-official`, so a deployment composed from that bundle needs no further step.

### Deployment brand

Each occupant reads `globalThis.lynDeploymentBrand`, which `lyn-brand-deployment` assigns before the client boots, every time it renders. Both marks show the deployment mark when one is configured. The name shows the deployment wordmark when one is configured, otherwise the deployment product name as text, otherwise the lyness wordmark. A member that is not a non-empty string, and a URL that is not a path on the page's own origin, read as absent, so the lyness artwork stays in place rather than a broken image. A deployment that sets a product name without a mark shows that name beside the lyness mark.

### Replacing the brand

A deployment that only changes its brand configures `lyn-brand-deployment` and keeps this package; that change needs a host restart but no client rebuild. A deployment that needs different built-in artwork composes another package occupying the same three slots instead of this one.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The two sidebar occupants install as one declaration-aware registration set: nested `ctx.slots.inject()` calls wait on both sidebar declarations and withdraw both occupants together, so HMR never leaves a partial brand mix. The hero occupant waits on its own declaration, which `lyn-client-ui-conversation` makes independently of the sidebar. The artwork is path data in [`src/client/artwork.ts`](src/client/artwork.ts): `lyn-brand-icon` traced the mark from the lyness icon PNG and `lyn-brand-wordmark` typeset the wordmark in Inter SemiBold; both fill with `currentColor`. The page-global reader is [`src/client/deployment-brand.ts`](src/client/deployment-brand.ts); the node half is an empty Loader seat.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the brand surface is not enough. They move from the brand source to the shells that render the slots.

- [brand-deployment](../../host/brand-deployment/README.md) — serves a deployment's brand assets and injects the brand this package reads.
- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark` in the hero.
- [Web client architecture](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define how brand presentation is supplied. They are current package constraints, not a brand-design comparison or a task backlog.

- **The local-build label is hidden** — the sidebar's fallback name shows the build version in development builds; this package occupies the name slot in every build, so the version does not appear there.
- **The hero mark does not morph** — the fallback fish changes its outline on hover; the lyness mark and a deployment mark keep only the hero's sway animation.
- **Built-in artwork needs a rebuild** — the lyness paths compile into the client bundle; only the deployment brand changes without one.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The package retains no mutable state; its sidebar occupants install and leave through one transactional effect and its hero occupant through another.
