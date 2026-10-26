---
description: "One bot asking a teammate a question, answered in a conversation of the teammate's own."
kind: "package-reference"
---

# @lyness/lyn-bot-ask

English | [中文](README.zh.md)

## Summary

`lyn-bot-ask` lets one bot ask a teammate a question and wait for the answer. The teammate answers in a conversation of its own, under its own character and its own preset, and decides what to say; what comes back is prose written for that question. The asking bot never reaches the teammate's conversations, cannot list them, and cannot learn that a particular one exists. Team membership is the whole authorization — two bots that share only an organization are not teammates — and both sides record the exchange in their own logs.

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

The accounts module mounts the service beside the roster, and contributes the tools into every preset that accepts rows:

```yaml
- id: bot-ask
  name: '@lyness/lyn-bot-ask'
- id: bot-ask-tools
  name: '@lyness/lyn-bot-ask/preset-contribution'
```

There is nothing to configure. A bot's own conversation then carries `list_teammates` and `ask_teammate`; a conversation a person opened carries them too and reads an empty team, because it speaks as no bot.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Asking is not reading.** The asked bot's conversations belong to the people who opened them, and [session visibility](../session-ownership/README.md) refuses those people's own colleagues. A bot that could read them would be a way around a rule the product enforces everywhere else, so an ask produces a composed answer and never a transcript.

**The answering turn is its own session, not a child of the asker's.** A child agent is as privileged as its parent and would answer under the parent's character, which is neither bot's. A session of the teammate's own carries the teammate's preset, the teammate's character, and the teammate's name.

**Team membership is the whole authorization.** The catalog this reads is the relation an administrator wrote. It carries everything the answering turn runs with, so there is no second read of the roster to disagree with it.

**An answer is a disclosure, so both sides record it.** The asking session records what it learned and from whom; the answering session records who asked it what, before the turn runs, so a session that failed to answer still says what it was asked. Neither event carries the other side's conversation.

**The answering turn runs in the asker's directory.** Two bots a team puts together share the work the asker is doing, and an answering turn with no directory has nothing its file tools could read.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-managed-bots`](../managed-bots/README.md) — the roster, the team relation, and the teammate catalog this reads.
- [`lyn-session-ownership`](../session-ownership/README.md) — the rule an ask must not become a way around.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects both halves.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schema

#### What the model sees

The generated [schemas](../../../docs/tool-catalog.md#lynesslyn-bot-ask): `list_teammates` takes no arguments; `ask_teammate` takes `teammate` and `question`. The `ask_teammate` description states what it will not return — the teammate's conversations — and that the question must carry its own context, because the teammate cannot see the asking conversation.

#### Token effect

Fixed schema cost on every agent whose preset accepts contributed rows.

#### KV Cache effect

Prefix-stable; neither schema changes at runtime. Switching the accounts module on or off changes the prefix once.

### Teammate catalog

#### What the model sees

One line per teammate: `<name> (<id>) — <job>`. A conversation that speaks as no bot reads `you are in no team, so there is nobody to ask`, which says so without naming anybody's bots.

#### Token effect

One short line per teammate, read when the model asks for the list rather than carried in every request.

#### KV Cache effect

Append-only; the result follows the reusable request prefix.

### Answer

#### What the model sees

`<name> answered:` followed by the prose that teammate's own session recorded. Never its conversation. A refusal names which rule stopped the ask: the conversation speaks as no bot, the target is not a teammate, or the answering turn produced nothing.

#### Token effect

The teammate's complete answer, once, in the asking turn. The answering turn's own tokens are spent in the teammate's session and do not reach this request.

#### KV Cache effect

Append-only; each answer follows the reusable request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Every ask opens a session** — the answering turn is a new conversation each time, which is what makes it auditable and what makes a busy team accumulate sessions. Nothing reuses or prunes them.
- **The answering turn runs on the deployment's default permissions** — not the asking session's. A conversation somebody tightened can still ask a teammate that answers under the deployment default, which is the baseline rather than an escalation; carrying the asking session's policy across is deferred.
- **No human approval gate** — the design reserves one for reaching outside the organization, exceeding the asker's quota, and acting under a stronger permission preset. None of the three is reachable yet: a teammate is same-organization by construction, no metering is mounted, and the answering turn does not inherit a stronger policy.
- **No model choice per bot** — the answering turn uses the deployment's default model, because a bot record names none.
- **The asking bot waits** — an ask blocks the asking turn until the teammate answers. There is no way to ask several teammates at once, or to ask and collect later.
- **The asker's directory is shared** — a teammate with file tools reads what the asking bot's workspace holds. That is the asker's own work and the ask is its own doing, but it is a disclosure an administrator should know about when putting a file-capable bot in a team.

**Runtime invariant:** No companion is published. This service owns no state: the authorization is the roster's, and the two records are the sessions' own logs.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The answering agent is disposed in a `finally`, so a refused or aborted ask does not leave a registered agent behind. The answer is read from the durable log rather than from the stream, so what the asking bot is told is exactly what the answering session recorded.

</details>
