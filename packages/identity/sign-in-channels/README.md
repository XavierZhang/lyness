---
description: "The configured sign-in channels a deployment serves, mounted from what its administrators stored."
kind: "package-reference"
---

# @lyness/lyn-sign-in-channels

English | [中文](README.zh.md)

## Summary

`lyn-sign-in-channels` is where a deployment's sign-in channels come from when nobody is editing a composition file. An administrator names a kind, fills in what that directory needs, and submits its application secret; the record is stored, the secret goes to the credential store under a reference nobody else can name, and a channel is mounted. A platform administrator configures the deployment's own channels; a tenant administrator configures their organization's and nobody else's, and each organization's sign-in page offers only its own. Composition rows still work beside this: both register into the same registry.

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

Beside the registries and the kinds a deployment admits:

```yaml
- id: sign-in-kinds
  name: '@lyness/lyn-sign-in/kinds'
- id: sign-in-channels
  name: '@lyness/lyn-sign-in-channels'
- id: sign-in-kind-wecom
  name: '@lyness/lyn-wecom/kind'
```

A kind row configures nothing by itself — it says what that directory needs. An administrator adds the instances:

```ts
import type { Context } from '@lyness/cordis'
import type {} from '@lyness/lyn-sign-in-channels'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.signInChannels.save({
  kind: 'wecom',
  displayName: 'Acme 企业微信',
  organization: 'acme',
  settings: { corpId: 'ww-acme', agentId: '1000002' },
  secret: 'the application secret',
}, by)
```

Replacing one keeps its id, so the admission bindings written against it still match. Omitting `secret` on a replacement leaves the stored one alone, which is how a channel is renamed without retyping a secret nobody can read back.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**A kind is a shape; an instance is a decision.** The package that speaks a directory's protocol knows what one needs and how to build it. It never knows how many a deployment has or whose they are, so adding a customer is a record rather than a redeploy.

**Authority is the directory's own rule.** `administers` decides: a platform administrator reaches everything including the deployment's own channels, and a tenant administrator reaches only their organization's. A replacement is authorized against what is **stored** as well as what was submitted, or one tenant's administrator could claim another's channel by naming its id with their own organization.

**The secret's reference is derived, never supplied.** It comes from the channel's own generated id. An administrator who could name the reference could point a new channel at the deployment's existing credential, or overwrite it.

**A record outlives the plugin that builds it.** A kind nothing offers, or settings that kind refuses, leaves the record stored and unmounted. Deleting it because a plugin left the composition would lose the configuration a deployment needs back when it returns, and a surface showing `mounted: false` is the honest report.

**Another organization's channel is not listed, not refused.** Listing it and refusing the sign-in would tell one customer who the others are.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-sign-in`](../sign-in/README.md) — the registry these mount into, and the kinds registry.
- [`lyn-wecom`](../../vendor/wecom/README.md), [`lyn-dingtalk`](../../vendor/dingtalk/README.md) and [`lyn-feishu`](../../vendor/feishu/README.md) — the kinds a deployment can be configured with.
- [`lyn-credentials`](../../credentials/credentials/README.md) — where each instance's secret lives.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it configures how people sign in, and nothing it stores reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Nothing says why a record will not mount** — `mounted: false` reports that the kind refused its settings or that no plugin offers it, without saying which or what was wrong.
- **One organization per channel** — a channel belongs to the deployment or to exactly one organization; a platform offering one directory to a named subset of its customers has no way to say so.
- **The admission bindings are still composition** — an administrator can add a channel at runtime and cannot yet say who it admits, so a new channel signs nobody in until the roster is edited.
- **No audit of its own** — a record names who configured it and when, and a replacement overwrites both; the history of who changed what is not kept.
- **Removing a channel leaves its bindings** — the roster entries that named it stay, matching nothing, until somebody removes them.

**Runtime invariant:** No companion is published. The mounted channels are derived from the stored records by this service alone, and `mounted` is read from the same map that holds their disposers.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The service mounts what it stored as soon as its domain opens rather than on first read, so a deployment's channels are serving before anybody signs in; a teardown that lands first closes the domain under that work, which is the shutdown rather than a failure.

</details>
