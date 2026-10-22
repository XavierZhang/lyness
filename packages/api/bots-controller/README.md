---
description: "The surface administrators maintain their organization's bots through, at runtime."
kind: "package-reference"
---

# @lyness/lyn-api-bots-controller

English | [中文](README.zh.md)

## Summary

`lyn-api-bots-controller` owns the `bots` Remote namespace: the bots a standing administers, the agent presets one may be given, and the calls that add, change and remove them. It decides nothing about who may change what — `lyn-managed-bots` holds those rules, and this namespace hands it the standing the call acts in and reports what it answered. Each row says whether composition owns it and whether its preset is still offered, so a surface disables what it cannot change and marks a bot that will not run.

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

The accounts module mounts it beside the roster it speaks for:

```yaml
- id: bots-controller
  name: '@lyness/lyn-api-bots-controller'
```

A configuration surface reads what a bot may be given, then adds one:

```ts
import type { BotInput, BotRowView, PresetOptionView } from '@lyness/lyn-api-bots-controller/types'

/** The two reads one bot form makes, and the call that saves it. */
export interface BotForm {
  readonly presets: () => Promise<readonly PresetOptionView[]>
  readonly list: () => Promise<readonly BotRowView[]>
  readonly save: (input: BotInput) => Promise<BotRowView>
}
```

Each refusal arrives under its own code — `bots/not-permitted`, `bots/written`, `bots/unknown-preset`, `bots/incomplete` with the field to mark, and `bots/no-standing` — so a form disables one row or marks one field rather than matching prose.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The rules are the roster's.** A standing administers its own organization, a bot's standing is fixed rather than submitted, and its preset must be one the deployment offers. A second copy of any of those written here would be one to keep in step with the first, and the one a direct caller bypasses.

**The preset list comes from the roster too.** `presets` asks `ctx.managedBots.offers()` rather than reading the registry itself, because that is the list a save is validated against: a form offering one list while the roster checked another would refuse a choice it had just presented.

**A refused call names the rule, not the prose.** Each reason maps to one code, and `bots/incomplete` carries the field so the form marks it.

**A call acts in a standing or it does not happen.** Where a deployment mounts no authorization rule every call reaches here, and a bot added on no standing would be one nobody is answerable for.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-managed-bots`](../../identity/managed-bots/README.md) — the roster this namespace speaks for, and every rule it enforces.
- [`lyn-api-people-controller`](../people-controller/README.md) — the sibling surface for the people who sign in.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects both.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a configuration surface, and nothing it carries reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A conversation with a bot is opened elsewhere** — this surface maintains the records; naming the bot a session is with belongs to `session.create`.
- **No pagination** — `list` answers every bot the standing administers in one reply, which an organization with hundreds of them would feel.
- **Nothing says why a preset is not offered** — a preset that cannot compose a session is simply absent from `presets`, without saying which row failed.
- **No audit of its own** — the roster records who added a bot and when; this namespace adds nothing, so who changed a persona and when is not kept.

**Runtime invariant:** No companion is published. This namespace owns no state: it projects what the roster answers, and the roster's own invariant covers the records.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
