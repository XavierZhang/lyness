---
description: "Teammates working together: one bot asking another, and several of them discussing one question."
kind: "package-reference"
---

# @lyness/lyn-bot-ask

English | [中文](README.zh.md)

## Summary

`lyn-bot-ask` is how teammates work together. One bot asks another a question and waits for the answer; several of them discuss one question in a room a chair runs. Every turn happens in a conversation of its own bot, under that bot's character and preset, and what comes back is prose written for the question — never a transcript of anybody's conversation. Team membership is the whole authorization, and each side keeps its own record.

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

The accounts module mounts both services beside the roster, and contributes the tools into every preset that accepts rows:

```yaml
- id: bot-ask
  name: '@lyness/lyn-bot-ask'
- id: bot-room
  name: '@lyness/lyn-bot-ask/room'
- id: bot-ask-tools
  name: '@lyness/lyn-bot-ask/preset-contribution'
```

There is nothing to configure. A bot's own conversation then carries `list_teammates`, `ask_teammate` and `hold_discussion`; a conversation a person opened carries them too and reads an empty team, because it speaks as no bot.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Asking is not reading.** The asked bot's conversations belong to the people who opened them, and [session visibility](../session-ownership/README.md) refuses those people's own colleagues. A bot that could read them would be a way around a rule the product enforces everywhere else, so an ask produces a composed answer and never a transcript.

**The answering turn is its own session, not a child of the asker's.** A child agent is as privileged as its parent and would answer under the parent's character, which is neither bot's. A session of the teammate's own carries the teammate's preset, the teammate's character, and the teammate's name.

**Team membership is the whole authorization.** The catalog this reads is the relation an administrator wrote. It carries everything the answering turn runs with, so there is no second read of the roster to disagree with it.

**An answer is a disclosure, so both sides record it.** The asking session records what it learned and from whom; the answering session records who asked it what, before the turn runs, so a session that failed to answer still says what it was asked. Neither event carries the other side's conversation.

**A room's chair is code, not a participant.** It decides who speaks next and when the discussion ends, because a participant that chose its own turn would be one nobody could stop. The rule is round-robin: every participant speaks once per round, in the order the opener named them, the opener first. A smarter chair can replace it; a room with no bound could not be made safe later.

**The bound is the deployment's, and clamps rather than refuses.** A request for more rounds than a deployment chairs runs fewer, because a shorter discussion is the honest answer and a refusal would be one more failure for the model to recover from.

**The conclusion is the chair's own request, under a fixed prompt.** Written from what was said, in no participant's voice: a conclusion in one bot's voice would be that bot's position, which is the one thing a chair must not add. A chair whose own request produced nothing still ends the room and says so — the remarks are the record, and a missing summary is not a reason to lose them.

**A participant reads the room, and only the room.** The transcript it is sent is the discussion it was invited to. That is not a hole in the rule above: nothing of any other conversation reaches it.

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

### Discussion

#### What the model sees

Every remark as `<name>: <said>`, in order, then `Conclusion:` and the chair's prose. Each participant is sent the question, the transcript so far, and whose turn it is; the first speaker reads `Nobody has spoken yet.` A refusal names which rule stopped it: the conversation speaks as no bot, a participant is not a teammate, or nobody else was named.

#### Token effect

The calling turn receives every remark plus the conclusion, once. The participants' own turns and the chair's summarising request are spent in their own sessions and do not reach this request. A discussion of n participants over r rounds costs n×r speaking turns plus one chair request, which is why the bound exists.

#### KV Cache effect

Append-only in the calling session; each participant's turn is a fresh session with no shared prefix to reuse.

### Answer

#### What the model sees

`<name> answered:` followed by the prose that teammate's own session recorded. Never its conversation. A refusal names which rule stopped the ask: the conversation speaks as no bot, the target is not a teammate, or the answering turn produced nothing.

#### Token effect

The teammate's complete answer, once, in the asking turn. The answering turn's own tokens are spent in the teammate's session and do not reach this request.

#### KV Cache effect

Append-only; each answer follows the reusable request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A room is a transcript, not a conversation anybody can join** — the room session holds what was said and the conclusion, and nothing appends to it afterwards. A person cannot speak in it, and no participant can be added once it has started.
- **The chair cannot stop early** — round-robin runs every round the bound allows even when the participants have agreed, so a settled question still costs its remaining turns.
- **A discussion is opened by a bot, not by a person** — the opener has to be a bot with teammates. There is no surface where a person convenes several bots.
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
