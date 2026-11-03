---
description: "The surface administrators maintain who may use a deployment through, at runtime."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-people-controller

English | [中文](README.zh.md)

## Summary

`dsh-api-people-controller` owns the `people` Remote namespace: the people a standing administers, and the calls that add one, change one, remove one, and admit or withdraw the directory identities that sign in as them. It decides nothing about who may change what — `dsh-managed-people` holds those rules, and this namespace hands it the standing the call acts in and reports what it answered. Each row says whether composition owns it, so a surface disables what it cannot change rather than offering an edit the next boot would undo.

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

The accounts module mounts it beside the directory it speaks for:

```yaml
- id: people-controller
  name: '@deepseek-ai/dsh-api-people-controller'
```

A configuration surface lists who it may change, then adds somebody and says which directory identity they are:

```ts
import type { BindingInput, PersonInput, PersonRowView } from '@deepseek-ai/dsh-api-people-controller/types'

/** The two calls one person form makes. */
interface PeopleRemote {
  /** Add one person, or change one this deployment maintains. */
  save: (input: PersonInput) => Promise<PersonRowView>
  /** Admit one directory identity as one person. */
  bind: (input: BindingInput) => Promise<void>
}

/**
 * Add one colleague and say which directory identity they are.
 * @param remote - the `people` namespace, as the client reaches it.
 * @param input - the name, the standing, and the organization.
 * @param identity - the channel, issuer and subject that authenticate them.
 * @returns the person as the deployment now reads them.
 */
export async function admit(
  remote: PeopleRemote,
  input: PersonInput,
  identity: Omit<BindingInput, 'person'>,
): Promise<PersonRowView> {
  const added = await remote.save(input)
  // Adding somebody admits nobody: until an identity is bound to them, the
  // sign-in page refuses them.
  await remote.bind({ ...identity, person: added.id })
  return added
}
```

The channel a binding names is one of the configured channels the `signInChannels` namespace lists, so a surface offers that list rather than a free-text field.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The standing is resolved, not assumed.** A call reaches a namespace method only after the authority rule admits it, and a deployment that mounts no such rule admits every call. Resolving the standing here and refusing `people/no-standing` keeps a change to who may use the system from being made on nobody's authority.

**Every refusal has its own code.** `written`, `not-permitted`, `unknown-person`, `already-bound` and `incomplete` each cross as themselves, so a form disables a row, marks a field, or explains the standing without matching prose.

**Bindings answer nothing on their own.** `bind` and `unbind` return no value: what a surface renders is the person's row, which `list` and `save` carry with their bindings, and a single source of that one fact is what keeps a surface from showing two of them.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-managed-people`](../../identity/managed-people/README.md) — the directory this speaks for, and every rule it applies.
- [`dsh-api-sign-in-channel-controller`](../sign-in-channel-controller/README.md) — the channels a binding names.
- [`dsh-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a configuration surface for who may use a deployment, and nothing it answers reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **A directory identity is typed, not discovered** — the issuer and subject are entered by hand, because no channel kind offers a directory search; getting one wrong admits nobody rather than the wrong person.
- **No paging** — `list` answers everything the standing administers, which suits an installation's staff and not a platform with thousands of people per tenant.
- **Nothing reports why a person cannot sign in** — a person with no binding and a person whose binding names a removed channel read alike here.

**Runtime invariant:** No companion is published. The namespace holds no state of its own: every answer is projected from the managed directory on the call that asked.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`requires: 'tenant-administrator'` on the namespace is the Gateway's coarse gate; the per-organization decision is the directory's and is applied again there, because the Gateway knows the standing but not which person a call names.

</details>
