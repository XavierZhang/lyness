---
description: "Signed-in sessions: established on sign-in, holding the context in force, and refused the moment they lapse."
kind: "package-reference"
---

# @deepseek-ai/dsh-auth-session

English | [中文](README.zh.md)

## Summary

Use `dsh-auth-session` to hold what signing in produced. A session belongs to a person, not to a standing: the context in force is server-side state on the session, changed only by an explicit switch. `./store` persists sessions so a redeploy does not sign everybody out, and refuses a lapsed one the moment it is presented rather than waiting for a sweep. A session identity is a bearer credential, so reading one is the only way to learn who a caller is and revoking it the only way to stop them.

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

```yaml
- id: auth-sessions
  name: '@deepseek-ai/dsh-auth-session/store'
  config:
    lifetimeMs: 1209600000
```

| Field | Default | Meaning |
|---|---|---|
| `lifetimeMs` | 14 days | How long a session lasts; `0` issues one that does not lapse |

A sign-in flow establishes a session once it has proved who the person is, recording how:

```ts
import type { AuthSessionStore } from '@deepseek-ai/dsh-auth-session'
import type { PersonId } from '@deepseek-ai/dsh-people'

declare const sessions: AuthSessionStore
declare const provenPerson: PersonId

const session = await sessions.establish({ person: provenPerson, method: 'sso:entra' })
```

Switching context goes through [`dsh-acting-context`](../acting-context/README.md) first: that resolver decides whether the context is permitted, and this store only puts a checked one in force.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**A session opens on the personal context, never on a membership** — even for a person who holds exactly one. Opening on a standing would be the guess the acting-context decision exists to avoid.

**A switch cannot change whose session it is.** A context naming another person is refused, because storing it would make every later call from that session act as somebody else: one bad switch would become many wrong calls.

**Expiry is checked on read, not swept by a timer.** A lapsed session must be refused the moment it is presented, and a sweep that has not run yet would let it through.

**Sessions are persisted.** A bearer credential that stops working when the server is redeployed is one people learn to distrust.

A switch changes the context in force and nothing else — an established instant and an absent expiry both survive it.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-acting-context`](../acting-context/README.md) — decides whether a context may be put in force.
- [`dsh-people`](../people/README.md) — the identities a session belongs to.
- [People, memberships, and the acting context](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) — the decision this package implements.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it holds Host-side authentication state.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No sign-in flow yet** — this package holds what a flow produced. Proving who somebody is, whether by password, by a platform account, or by an SSO issuer, belongs to the flows that call `establish`.
- **Nothing publishes the current session per request** — a transport that turns a presented bearer identity into "who this call is" is the next piece, and it is what makes credit metering and a read-only Models page possible.
- **Revocation is per session, not per person** — ending every session a person holds means revoking each, which a surface listing them can do but this store does not offer in one call.
- **Expired rows are never pruned** — correct for reads, which refuse them, but a long-lived deployment accumulates them until something sweeps.

**Runtime invariant:** No companion is published. Every answer is a function of the stored rows and the clock, so there is no cached view that could disagree.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`switchContext` deliberately rebuilds the record field by field rather than spreading the old one. That is what keeps a switch from carrying over something it should not, and what made the non-lapsing case a test rather than an accident.

</details>
