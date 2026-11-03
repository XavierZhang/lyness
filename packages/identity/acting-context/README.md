---
description: "Resolve and check the context one call acts in: stated by the call, held by the caller, and permitted by the address."
kind: "package-reference"
---

# @deepseek-ai/dsh-acting-context

English | [中文](README.zh.md)

## Summary

Use `dsh-acting-context` to decide whether the context a call declares is permitted. Signing in produces a session for a person, not for a standing, so which standing is in force is per call. Three rules apply, each with a code a surface maps to its own message: a call states its context or is refused, the stated standing belongs to the caller, and an address resolving to an organization admits only that organization's standings.

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

Mount it beside a people directory:

```yaml
- id: acting-context
  name: '@deepseek-ai/dsh-acting-context'
```

A transport resolves each call's claim before the operation runs:

```ts
import type { ActingContextResolver } from '@deepseek-ai/dsh-acting-context'
import type { PersonId } from '@deepseek-ai/dsh-people'

declare const resolver: ActingContextResolver
declare const signedInPerson: PersonId
declare const addressOrganization: string | undefined

const acting = await resolver.resolve({
  person: signedInPerson,
  declared: { kind: 'personal' },
  organization: addressOrganization,
})
```

A refusal is an `ActingContextRefused` carrying one of four codes: `context-absent`, `membership-unknown`, `membership-not-held`, `context-outside-address`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

`DeclaredContext` makes the personal context a value rather than an absence, so "stated nothing" and "stated the personal context" are different inputs. That is the whole reason the absent case cannot be reached by forgetting a field: a person holding two standings makes a default a guess, and a guess here attributes a conversation to the wrong organization.

The address constrains the context and never chooses it. An address belonging to an organization refuses any other context rather than silently switching into that organization, so a person always knows which organization their work was attributed to.

A standing held by somebody else is reported as `membership-not-held` rather than `membership-unknown`, because the caller may not learn whether another person's standing exists.

The check lives here and nowhere else. A check in a transport or a surface is bypassed by the next caller, and a check repeated in several places is a check that eventually disagrees with itself.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-people`](../people/README.md) — the directory this resolver asks, and the three roles.
- [People, memberships, and the acting context](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) — the decision this package implements.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it answers an authorization question for the Host.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **It checks a claim and stores nothing** — the session-side state that remembers the context in force, and the explicit switch that changes it, belong to the authenticated session rather than here.
- **The address organization is an input, not a lookup** — whatever resolves a hostname or a gateway header to an organization passes the result in; this package never resolves it and so cannot be fooled into trusting a header it read itself.
- **No audit of refusals** — a refused context leaves an error and no record, so a deployment investigating repeated refusals has nothing to read yet.

**Runtime invariant:** No companion is published. The resolver holds no state; every answer is a function of the claim and the directory.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The deliberate asymmetry is that `organization` arrives as a parameter. A future version that resolved the hostname itself would have to decide whether to trust `x-tenant-id`, which the decision assigns to the deployment's edge; keeping it a parameter keeps that decision out of this package.

</details>
