---
description: "The surface administrators configure sign-in channels through, at runtime."
kind: "package-reference"
---

# @lyness/lyn-api-sign-in-channel-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-sign-in-channel-controller` owns the `signInChannels` Remote namespace: the kinds of directory this deployment can be configured with, the channels already configured, and the calls that create, replace, and remove one. It decides nothing about who may change what — `lyn-sign-in-channels` holds that rule, and this namespace hands it the standing the call acts in. The application secret crosses inward only; no answer can carry one, because what is stored is the reference the credential store keeps it under.

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

The accounts module mounts it beside the store it speaks for:

```yaml
- id: sign-in-channel-controller
  name: '@lyness/lyn-api-sign-in-channel-controller'
```

A configuration surface asks what can be configured, then submits one of them:

```ts
import type {
  ChannelInput, ChannelKindView, ConfiguredChannelView,
} from '@lyness/lyn-api-sign-in-channel-controller/types'

/** The two calls one configuration form makes. */
interface ChannelsRemote {
  /** The kinds this deployment can be configured with. */
  kinds: () => Promise<readonly ChannelKindView[]>
  /** Create one channel, or replace one that exists. */
  save: (input: ChannelInput) => Promise<ConfiguredChannelView>
}

/**
 * Configure one tenant's own directory.
 * @param remote - the `signInChannels` namespace, as the client reaches it.
 * @param input - the kind, the name, the settings, and the application secret.
 * @returns the channel as the deployment now reads it.
 */
export async function configure(
  remote: ChannelsRemote,
  input: ChannelInput,
): Promise<ConfiguredChannelView> {
  const kinds = await remote.kinds()
  if (!kinds.some(kind => kind.id === input.kind)) throw new Error('no such kind')
  return remote.save(input)
}
```

A saved channel is serving when the answer says `mounted: true`. A stored one that reads `mounted: false` is a record whose kind is absent from this composition, or whose settings that kind refused: it keeps its configuration so an administrator can correct it rather than retype it.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The authorization rule is not here.** `administers(standing, organization)` lives with the records, so a direct caller, a future surface, and this namespace all meet the same rule. What this namespace adds is the standing: it resolves the caller's membership from the request principal and the directory, and refuses a call that establishes none rather than acting on nobody's authority.

**Refusals carry a reason, not a message.** The service raises `ChannelRefusedError` with one of four reasons, and each maps to its own wire code — a form marks the empty fields from `sign-in-channels/incomplete`, says which kind is missing from `sign-in-channels/unknown-kind`, and reports a standing problem as neither. Matching the prose would break the moment the prose changed.

**Anything that is not a refusal is reported as itself.** A credential store that could not keep the secret is not a decision about this submission: resending it changes nothing, and dressing it as a refusal would send an administrator to correct a field that is already right.

**The namespace requires `tenant-administrator`.** A platform administrator satisfies it, which is how one standing covers both the deployment's own channels and a tenant's. The organization on each record is what separates them, and that is checked per record rather than per call.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-sign-in-channels`](../../identity/sign-in-channels/README.md) — the records, the mounting, and the rule this namespace hands a standing to.
- [`lyn-sign-in`](../../identity/sign-in/README.md) — the registry a configured channel lands in, and the kinds that build one.
- [`lyn-api-remote-authority`](../remote-authority/README.md) — what `tenant-administrator` means on the wire.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a configuration surface, and nothing it reports reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A tenant's channels are not offered on the sign-in screen yet** — `identity/viewer` asks the registry for the deployment's own channels, because a browser that has not signed in has named no organization. Offering a tenant's own requires resolving which tenant the request is for first.
- **No test for the configuration** — a submission is accepted when its kind builds a channel from it, and a `corpId` that is syntactically fine but belongs to nobody is found out by the first person who tries to sign in.
- **One secret per channel, rotated by replacing it** — there is no second slot to put the new secret in while the old one is still accepted, so a rotation is a moment where one or the other is in force.

**Runtime invariant:** No companion is published. Every answer is projected from the store at the moment it is asked, so there is no second copy to disagree with it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`configured()` reads the store with `ctx.get` and answers `gateway/internal` when it is absent, because the namespace is mountable without it; the accounts module composes both, so the path is reachable only by a composition that takes one row and keeps the other.

</details>
