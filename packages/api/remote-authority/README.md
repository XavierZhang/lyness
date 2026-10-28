---
description: "Whether one Remote call may be served, decided once where every wire call passes through."
kind: "package-reference"
---

# @lyness/lyn-api-remote-authority

English | [中文](README.zh.md)

## Summary

`lyn-api-remote-authority` is the rule that refuses a Remote call the caller's standing does not reach. It listens on the Gateway's authority point, which every wire call passes through, and compares the standing the request acts in against what the endpoint declared — its method's requirement, else its namespace's. An endpoint nobody classified is refused rather than admitted. Whether any of this applies is a composition choice: an installation with one person at the keyboard mounts no accounts and no rule, and nothing refuses them their own machine.

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

`@lyness/lyn-module-accounts` selects it beside the directory and the request principal; a composition that writes its own rows adds it the same way:

```yaml
- id: remote-authority
  name: '@lyness/lyn-api-remote-authority'
```

It takes no configuration. What each endpoint requires is declared where that endpoint lives — a namespace states its default, and a method raises or lowers it:

```ts
import { Remote, TypertRemoteService } from '@lyness/lyn-typert-protocol'
import type { Context } from '@lyness/cordis'

declare const nothing: unique symbol

export class LedgerController extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'ledgerController', { namespace: 'ledger', requires: 'member' })
  }

  @Remote
  read(): string {
    return 'what a member may read'
  }

  @Remote({ requires: 'platform-administrator' })
  write(): string {
    return 'what only the deployment may change'
  }
}
```

`verify-remote-authority` fails the build when a namespace declares none, so a new controller cannot ship unclassified.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One point, because one check is the only kind that holds.** A namespace has as many entry points as it has methods, and a check written in each is a check forgotten in the next. The Gateway resolves every call — from a browser, from a desktop client, from a direct RPC — through one place, so the rule sits there and nothing reaches around it.

**The rule is a plugin, the point is not.** Whether a deployment authorizes at all depends on whether it has standings to compare. The Gateway therefore asks, and this package answers; a composition with no accounts mounts no answer and the Gateway serves as before.

**Fail closed.** An endpoint whose namespace and method both declared nothing is refused. Admitting it would make every new method public by default, which is the failure this package exists to end. The gate keeps that refusal out of production by making the omission a build failure instead.

**`anyone` is answered first.** A sign-in route is reached by somebody who is, by definition, not signed in yet, so that requirement is satisfied before any identity is resolved.

**A standing, not a person.** `member` asks only that the call be signed in — a personal context satisfies it. The administrator requirements ask for a standing the directory knows, so a call acting in a personal context is refused even when the person holds an administrator standing elsewhere: the context is the claim, and the claim is what was authorized.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-api-gateway`](../gateway/README.md) — the authority point this rides, and the `gateway/forbidden` refusal it produces.
- [`lyn-people`](../../identity/people/README.md) — the standings and what each role may do.
- [`lyn-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects it.
- [Diverging from the single-operator Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md) — why a shared runtime needs it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a wire call before any method runs, and a refused call never reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Roles, not rows** — it answers whether a standing may call an operation, never whether it may touch a particular session, workspace, or job. One member reading another's conversation is an ownership question, and the owner is recorded but nothing filters by it yet.
- **One organization is as good as another** — a tenant administrator of one organization satisfies a `tenant-administrator` endpoint whatever organization the call is about. Each namespace that acts on an organization still has to check which one, the way `lyn-credits` does.
- **A declaration is per namespace, not per deployment** — a deployment that wants its members to configure something this repository classified as the platform's cannot lower it from composition.
- **The refusal text reaches the caller** — it names the standing required and the one held, which tells an unauthorized caller that the endpoint exists. That is the same thing the endpoint list already tells them.
- **Nothing is logged** — a refusal is answered, not recorded, so a deployment cannot yet review who was turned away.

**Runtime invariant:** No companion is published. The rule holds no state: every answer is computed from the request principal and the directory at the moment it is asked.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The typert analyzer validates `requires` and keeps nothing: the value reaches the Gateway through the runtime marker, so adding a standing means updating `RemoteAuthority`, the analyzer's `REMOTE_AUTHORITIES`, this package's `SATISFIES`, and `verify-remote-authority` together.

</details>
