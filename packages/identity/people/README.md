---
description: "People and their standing in an organization: the directory seam, the three roles, and the operator-written roster."
kind: "package-reference"
---

# @deepseek-ai/dsh-people

English | [中文](README.zh.md)

## Summary

Use `dsh-people` to answer who a caller is and what their standing permits. A person holds one identity and a **membership** is their standing in one organization, carrying exactly one of three roles. `./static` serves a roster an operator writes, which is an enterprise installation's directory before SSO is connected. The directory reports a role and authorizes nothing: each operation decides for itself, against `administers`.

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

An installation whose administrator maintains the roster mounts the static provider:

```yaml
- id: people
  name: '@deepseek-ai/dsh-people/static'
  config:
    people:
      - id: root
        displayName: Platform Root
        role: platform-administrator
      - id: ada
        displayName: Ada
        role: tenant-administrator
        organization: acme
      - id: bob
        displayName: Bob
        role: member
        organization: acme
```

Only the people a roster names may use that installation, so an unknown identity holds no standing rather than a default one. `people` is required and rejected when empty, and a duplicate `id` is rejected at load.

An operation restricting itself to administrators asks the predicate rather than comparing roles:

```ts
import { administers } from '@deepseek-ai/dsh-people'
import type { Membership } from '@deepseek-ai/dsh-people'

declare const standing: Membership
declare const organization: string | undefined

if (!administers(standing, organization)) throw new Error('not permitted')
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The three roles are `platform-administrator`, `tenant-administrator`, and `member`. A read-only auditor was considered and deferred: it would add a role before anything asks for one.

`administers` exists so no call site has to remember that the platform role outranks the tenant one. A tenant administrator administers its own organization and no other; a platform administrator administers every organization including the platform's own context; a member administers nothing, including the organization it belongs to.

Two shapes are rejected at load rather than left to a surface. An unknown role would silently admit nobody, and a tenant administrator naming no organization would administer nothing while reading as an administrator — worse than being refused.

The directory decides nothing. Whether a standing may perform an operation is that operation's decision, made against the reported role, because a directory that also authorized would hold every rule in one place and none of them where it is enforced.

-----

<a id="further-exploration"></a>
## Further Exploration

- [People, memberships, and the acting context](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) — the decision this package implements, including the acting context a call states.
- [`tenant-config`](../../tenant/tenant-config/README.md) — the per-tenant configuration an administrator maintains.
- [`dsh-model-policy`](../../llm/model-policy/README.md) — the first operation that will restrict itself to administrators.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it answers directory questions for the Host.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The static roster gives each person exactly one standing** — correct for an installation serving one organization, and the reason a hosted deployment needs a store-backed directory where a person may hold several.
- **No acting context yet** — the decision defines a context a call states and the server checks; this package supplies the vocabulary and the directory, not the per-call plumbing.
- **No SSO binding yet** — an enterprise installation connecting AD, WeCom, DingTalk, or Feishu needs an external account to bind to a standing; the roster is the manual path that stays available regardless.

**Runtime invariant:** No companion is published. The static directory holds only the operator's frozen roster, and the seam owns no mutable state.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`administers` is the whole authorization surface of this package, so a change to it changes every operation that restricts itself to administrators at once. Adding a fourth role means revisiting it rather than extending a role comparison at each call site.

</details>
