---
description: "Sign-in through an external directory, for deployments connecting SSO and maintainers adding a channel."
kind: "package-reference"
---

# @lyness/lyn-sign-in

English | [中文](README.zh.md)

## Summary

`lyn-sign-in` signs a person in through a directory they already belong to and hands back a session. A channel verifies who they are at that directory; the deployment's own admission rule says who that is here; a session is established for that person. Channels register rather than being configured here, so a deployment offering a Microsoft directory and a WeCom one mounts two channel plugins and nothing in this package or on a sign-in page knows which is which. Both halves are injected: without a session store or an admission rule there is no sign-in at all.

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

Mount the service, an admission rule, and at least one channel:

```yaml
- id: sign-in
  name: '@lyness/lyn-sign-in'
  config:
    lifetimeMs: 43200000
- id: sign-in-admission-roster
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: microsoft-entra
        issuer: contoso.onmicrosoft.com
        subject: 7a1f0e2c-0000-0000-0000-000000000000
        person: ada
```

| Field | Default | Meaning |
|---|---|---|
| `lifetimeMs` | `43200000` | How long a session a sign-in establishes lasts, in milliseconds |

The roster's `bindings` is required, and an empty list admits nobody.

### Add a channel

A channel plugin registers one object and owns the disposer:

```ts
import type { Context } from '@lyness/cordis'
import { channelId } from '@lyness/lyn-sign-in'

export const inject = ['signIn']

export function apply(ctx: Context): void {
  // `register` ties the disposer to this plugin's own fiber; the return value
  // is there for a channel that withdraws itself earlier than that.
  void ctx.signIn.register({
    id: channelId('wecom'),
    displayName: 'WeCom',
    authenticate: async () => undefined,
  })
}
```

`authenticate` returns the verified subject, or `undefined` when the person did not complete the sign-in. It never decides whether they may use the system.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Authentication and admission are two decisions.** A directory confirming that someone works at a company says nothing about whether this installation is for them. Conflating the two would admit the whole directory the moment it is connected, so `SignInAdmission` is a separate seam and the flow injects it: a deployment that mounts no rule signs nobody in. That is the fail-closed direction — an unanswered question about who may use the system has to keep people out.

**One refusal covers two causes.** `not-admitted` is the answer both for a directory this deployment does not accept and for a person who is not on the roster. Distinguishing them would let an unauthenticated caller enumerate which accounts exist here.

**The session is established last.** The directory and the admission rule both answer before anything is written, so a refused sign-in leaves no session behind to revoke.

**A binding is keyed by all three parts.** A subject is unique only within its directory, and one directory reached through two channels is two trust paths even though it is one directory. Two rows for one identity fails at load rather than resolving by precedence, because whichever won would silently decide who someone signs in as.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-auth-session`](../auth-session/README.md) — the sessions this flow establishes.
- [`lyn-people`](../people/README.md) — the roster an admission rule maps directory identities onto.
- [`lyn-request-principal`](../request-principal/README.md) — what reads the session back on each later call.
- [`lyn-microsoft-entra`](../../vendor/microsoft-entra) — a directory sign-in that can become a channel.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it establishes Host-side sessions.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No channel ships yet** — `lyn-microsoft-entra` verifies a subject already, and wiring it in as a channel is the next step; until then a deployment has nothing to register.
- **No hosted admission rule** — the roster is the installation shape's answer. A hosted deployment's people arrive by signing up, which needs a rule that provisions on first sign-in within a tenant's own directory.
- **Nothing issues the cookie** — `begin` returns the session identity; the surface that puts it in a response, and the attributes it sets, are not decided here.
- **A changed binding needs a restart** — the roster is read at load, so an administrator adding a person edits composition config rather than a surface.

**Runtime invariant:** No companion is published. Every relation this package holds — a channel's registration, a binding's person — has exactly one observer.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`bindingKey` uses `JSON.stringify` on the three parts rather than joining them with a separator, so a part containing the separator cannot be made to collide with a different identity. A test pins that.

</details>
