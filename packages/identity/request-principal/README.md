---
description: "Publish who the call in progress is, resolved from the bearer identity it presents, without refusing anything."
kind: "package-reference"
---

# @lyness/lyn-request-principal

English | [中文](README.zh.md)

## Summary

Mount `lyn-request-principal` so anything needing to know whose call it is reads one place instead of re-parsing a header. It registers a Connection request scope, resolves the presented bearer identity into the signed-in person and the context their session has in force, and publishes that for the duration of the call. It resolves and never refuses: a call presenting no session, or a lapsed one, proceeds with no principal, and the operation that requires one refuses it where the reason can be explained.

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
- id: request-principal
  name: '@lyness/lyn-request-principal'
```

It takes no configuration and needs a session store plus the Host connection. An operation reads the principal of the call it is serving:

```ts
import type { RequestPrincipal } from '@lyness/lyn-request-principal'

declare const principals: RequestPrincipal

const principal = principals.current()
if (principal === undefined) throw new Error('this operation requires a signed-in caller')
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Both credential forms are read**, because both callers exist: a browser holds the `lyn_identity` cookie while a desktop client or a script sends `Authorization: Bearer`. Reading only one would silently leave the other anonymous. The header wins when both are present, so an explicit credential beats an ambient one.

**It resolves and never refuses.** The request scope runs after authentication, host trust, and envelope decoding have all accepted the call, so by contract it is not a place to reject one. Unknown and lapsed sessions are therefore the same answer — this call speaks for nobody — and the refusal belongs to the operation that requires a principal, which is also where the reason can be given.

**The standing is one read further out.** A principal names the standing its session has in force; what that standing *is* belongs to the directory. `callingStanding(ctx)` does both reads for an operation that authorizes against a role, and answers undefined for a call that speaks for nobody, declared no standing, or declared one the directory does not hold — one answer for three causes, because the refusal belongs to the operation that requires a standing.

**The context comes from the session, not from the request.** A call does not say which standing it acts in; its session holds that, changed only by an explicit switch. That is what keeps one person's two memberships from ever being guessed at per call.

**Work that outlives its call re-enters the principal.** A stream's later frames are pulled by the transport rather than by a call of their own, so `current()` is empty there and whatever request shares that task would otherwise answer for them. `as(principal, run)` runs one continuation as a principal `current()` already returned; it resolves nobody and widens nothing, and an absent principal is entered as absent so a re-entry can never inherit another call's identity.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-auth-session`](../auth-session/README.md) — the sessions this scope reads.
- [`lyn-credits`](../../credits/credits/README.md) — the first consumer: `./subject-request` charges a call to the person it speaks for.
- [People, memberships, and the acting context](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) — why a context is session state rather than a request field.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it publishes Host-side request state.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Only RPC calls carry a principal** — the scope is registered on the shared RPC channel, so work started outside a call, including a background job that outlives its request, has none.
- **Nothing sets the cookie yet** — a sign-in flow issues the session and decides the cookie's attributes; this package only reads what is presented.
- **No audit of anonymous calls** — a call presenting a lapsed session is indistinguishable afterwards from one presenting nothing, which a deployment investigating sign-out loops would want to tell apart.

**Runtime invariant:** No companion is published. The published principal is a function of the presented identity and the session store, held only for the duration of one call.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The swallowed error in `read` is deliberate and narrow: it turns an unavailable session into an anonymous call. If it ever grows to swallow a storage failure as well, every call would silently become anonymous when the store is broken, which is a far worse outcome than failing.

</details>
