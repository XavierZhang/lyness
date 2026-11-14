---
description: "The configured sign-in channels a deployment serves, mounted from what its administrators stored."
kind: "package-reference"
---

# @deepseek-ai/dsh-sign-in-channels

English | [中文](README.zh.md)

## Summary

`dsh-sign-in-channels` is where a deployment's sign-in channels come from when nobody is editing a composition file. An administrator names a kind, fills in what that directory needs, and submits its application secret; the record is stored, the secret goes to the credential store under a reference nobody else can name, and a channel is mounted. A platform administrator configures the deployment's own channels; a tenant administrator configures their organization's and nobody else's, and each organization's sign-in page offers only its own. Composition rows still work beside this: both register into the same registry.

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
  name: '@deepseek-ai/dsh-sign-in/kinds'
- id: sign-in-channels
  name: '@deepseek-ai/dsh-sign-in-channels'
- id: sign-in-kind-wecom
  name: '@deepseek-ai/dsh-wecom/kind'
```

A kind row configures nothing by itself — it says what that directory needs. An administrator adds the instances:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-sign-in-channels'
import type { Membership } from '@deepseek-ai/dsh-people'

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

**Every change is recorded, and the secret is not.** [`dsh-admin-audit`](../admin-audit/README.md) holds who configured what and which setting changed, each setting named one by one so an auditor reads which one moved rather than that something in a blob did. A replaced credential is recorded as a change with neither side: an auditor must be able to see that a directory's secret was rotated, and the trail must not be where that secret is readable from. A save that altered no setting and rotated nothing records nothing.

**Another organization's channel is not listed, not refused.** Listing it and refusing the sign-in would tell one customer who the others are.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-sign-in`](../sign-in/README.md) — the registry these mount into, and the kinds registry.
- [`dsh-wecom`](../../vendor/wecom/README.md), [`dsh-dingtalk`](../../vendor/dingtalk/README.md) and [`dsh-feishu`](../../vendor/feishu/README.md) — the kinds a deployment can be configured with.
- [`dsh-credentials`](../../credentials/credentials/README.md) — where each instance's secret lives.
- [`dsh-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

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
- **Removing a channel leaves the bindings that named it** — the admission bindings are maintained at runtime by [`dsh-managed-people`](../managed-people/README.md), and the ones naming a removed channel stay, matching nothing, until somebody withdraws them.
- **No audit of its own** — a record names who configured it and when, and a replacement overwrites both; the history of who changed what is not kept.

**Runtime invariant:** No companion is published. The mounted channels are derived from the stored records by this service alone, and `mounted` is read from the same map that holds their disposers.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The service mounts what it stored as soon as its domain opens rather than on first read, so a deployment's channels are serving before anybody signs in; a teardown that lands first closes the domain under that work, which is the shutdown rather than a failure.

</details>
