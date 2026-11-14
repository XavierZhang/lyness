---
description: "What a person tells their own agents, kept for them and recorded on every session they open."
kind: "package-reference"
---

# @lyness/lyn-personal-instructions

English | [中文](README.zh.md)

## Summary

`lyn-personal-instructions` is the user layer of the prompt. A deployment's persona and an organization's rules both have a place to live; the person between them had none, because a hosted person has no file to edit. This plugin stores what each person tells their own agents, writes that text into every session they open as one durable log event, and composes it into each agent's prompt from that record — between the organization's rules and the agent's own persona.

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

Mount it where sessions, agents and the prompt registry are:

```yaml
- id: personal-instructions
  name: '@lyness/lyn-personal-instructions'
  config:
    maxChars: 4000
```

`maxChars` is the ceiling one person may save; it defaults to what the store accepts, and a deployment that wants a tighter token budget sets a smaller one. Nothing else needs configuring: which person a session's instructions come from follows from the principal that created it.

The Settings page reads and writes through `lyn-api-personal-instructions-controller`. A Host-side caller uses the service directly: `ctx.personalInstructions.ownerOfCall()` answers whose instructions this call acts on, and `get` and `save` take that owner.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The record is the authority, not the store.** The text is copied into the session log at creation and composed from there. Anything that reaches a model request has to be reconstructable from the session log, and reading the store at assembly time would mean a person editing their instructions changed what a running conversation had already said.

**Every session with an owner carries a record, even an empty one.** A record saying the text was empty is what lets a later reader tell "this conversation ran with no instructions" from "nobody ever asked". A session nobody opened — a CLI run, a subagent, an inbound webhook — carries none rather than somebody else's.

**Each product shape answers the owner question its own way.** A deployment that mounts no request principal has one operator and stores under one well-known key. One that mounts the principal stores under the signed-in person, and a call that presented no identity acts on nothing.

**The section is appended, never prepended.** It takes the position between the organization's rules and the agent's persona, so text a person writes cannot widen what the layers above it set, and every policy section still comes after it.

**Reads are synchronous.** The stamp runs on the microtask after a creation announcement and has no tick to spend on storage, so the plugin awaits the domain once at mount and reads the in-memory records directly afterwards.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-personal-instructions-controller`](../../api/personal-instructions-controller/README.md) — the Remote namespace a surface reads this through.
- [`lyn-client-ui-settings-instructions`](../../client/ui-settings-instructions/README.md) — the Settings page a person edits them on.
- [`lyn-tenant-session`](../../tenant/tenant-session/README.md) — the organization layer this one sits after, built the same way.
- [`lyn-session-ownership`](../session-ownership/README.md) — whose conversation a session is, which this plugin's owner question follows.

-----

<a id="model-experience"></a>
## Model Experience

### The person's own instructions

#### What the model sees

One section of each agent's own prompt, placed after the organization's rules and before the agent's persona. It reads as `The person in this conversation has written these instructions for you:` followed by the person's prose verbatim — the person, not this deployment's word for an account, because a prompt carries task-relevant concepts and nothing else. A person who has written none contributes an empty section, so the assembled prompt is byte-identical to a deployment that never mounted this plugin.

#### Token effect

Fixed per request, for the length of what that person wrote, bounded by `maxChars`. It is part of the prefix, so it is paid once per cached prefix rather than per turn.

#### KV Cache effect

Stable for the life of one conversation: the text comes from that session's own record, so a person editing their instructions changes what later conversations assemble and never invalidates a running one's prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A conversation already open keeps what it started with** — by design, and the page says so; a person who wants the new text in force starts a new conversation.
- **One text per person, not one per workspace** — a person who wants different instructions for different projects uses the workspace file chain, which this plugin does not touch.
- **No deployment-side review** — a deployment that must forbid personal instructions leaves this composition row out; there is no setting inside the plane that disables it, because a control that reported somebody else's decision would not belong on a personal page.
- **The ceiling is a token budget, not a validation** — the text is carried verbatim, so a deployment paying per token sets `maxChars` rather than relying on people to be brief.

**Runtime invariant:** one record per session, written once; the composed section always comes from that record.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The single-operator key is reached only when no principal service is mounted at all, rather than when a call happens to carry no principal. The difference matters on a deployment with accounts: a session created outside a request would otherwise be stamped with one shared record that nobody owns.

</details>
