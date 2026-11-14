---
description: "The surface administrators issue, read and withdraw invitation codes through, and anybody signed in accepts one through."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-invitations-controller

English | [中文](README.zh.md)

## Summary

`dsh-api-invitations-controller` owns the `invitations` Remote namespace: the invitations a standing administers, the call that issues one, the call that withdraws one, and the call anybody signed in accepts one with. It decides nothing about who may issue what — `dsh-invitations` holds those rules, and this namespace hands it the standing the call acts in and reports what it answered. The code crosses the wire once, in the answer to `issue`, because the deployment keeps only its hash. Every other answer carries what an invitation grants, when it lapses, and how much of it is left.

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

The accounts module mounts it beside the invitations it speaks for:

```yaml
- id: invitations-controller
  name: '@deepseek-ai/dsh-api-invitations-controller'
```

An administration page issues one, shows the code once, and builds the link that carries it:

```ts
import type { InvitationInput, InvitationRowView } from '@deepseek-ai/dsh-api-invitations-controller/types'

/** The one call an invitation form makes. */
interface InvitationsRemote {
  /** Issue one invitation, and answer the code once. */
  issue: (input: InvitationInput) => Promise<InvitationRowView>
}

/**
 * Issue one invitation and build the link to send.
 * @param remote - the `invitations` namespace, as the client reaches it.
 * @param input - the label, the standing, and the organization.
 * @param channel - the configured sign-in channel the person will use.
 * @returns the invitation, and the link that presents its code.
 * @throws {Error} when the answer carries no code, which no issue does.
 */
export async function invite(
  remote: InvitationsRemote,
  input: InvitationInput,
  channel: string,
): Promise<{ readonly invitation: InvitationRowView, readonly link: string }> {
  const invitation = await remote.issue(input)
  if (invitation.code === undefined) throw new Error('this issue answered no code')
  // The code is in this answer and nowhere else: show it now, or issue
  // another invitation later.
  const link = `/auth/sign-in/${encodeURIComponent(channel)}?invite=${encodeURIComponent(invitation.code)}`
  return { invitation, link }
}
```

The channel the link names is one of the configured channels the `signInChannels` namespace lists, so a surface offers that list rather than a free-text field.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The standing is resolved, not assumed.** A call reaches a namespace method only after the authority rule admits it, and a deployment that mounts no such rule admits every call. Resolving the standing here and refusing `invitations/no-standing` keeps a code that admits a member from being issued on nobody's authority.

**The code is answered once and never read back.** `issue` carries it; `list` never does, because the store holds only its hash. A surface that loses it issues another invitation rather than asking for this one again.

**Every refusal has its own code.** `not-permitted`, `incomplete`, `out-of-bounds` and `unknown` each cross as themselves, so a form marks the organization field, reports the deployment's bounds, or explains the standing without matching prose.

**`accept` is the one method a member may reach.** Every other method here is an administrator's; this one exists so that the person gaining the standing is the person asking for it. The account it adds to comes from the call's own session and is not a parameter, because an acceptance that named its own person would let anybody signed in add a standing to somebody else.

**`accept` has one answer for every refusal.** A wrong code, a spent one, one whose issuer no longer holds the standing and one granting what the caller already holds all read as `accepted: false`. The other methods report their refusals apart because an administrator can act on them; here, telling them apart would let anybody signed in learn which codes exist and what authority they carry.

**`revoke` is not a delete.** It withdraws the code and keeps the row, because who invited whom is why the record is kept; the namespace therefore has no `delete`.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-invitations`](../../identity/invitations/README.md) — the seam this speaks for, and every bound it applies.
- [`dsh-api-people-controller`](../people-controller/README.md) — the roster a redemption writes into.
- [`dsh-api-sign-in-channel-controller`](../sign-in-channel-controller/README.md) — the channels an invitation link names.
- [`dsh-module-accounts`](../../bundle/module-accounts/README.md) — the composition that selects all of it.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a configuration surface for who may join a deployment, and nothing it answers reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **An acceptance cannot say why it granted nothing** — which is the point, and leaves the holder to ask whoever sent the code.
- **Nothing sends the invitation** — the namespace answers a code; delivering it is the administrator's own business, by whatever channel they already use.
- **No paging** — `list` answers everything the standing administers, which suits an installation's staff and not a platform issuing thousands per tenant.
- **A redemption is not reported here** — the use count moves, but who redeemed which code is read from the administration trail, not from this namespace.

**Runtime invariant:** No companion is published. The namespace holds no state of its own: every answer is projected from the invitations seam on the call that asked.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`requires: 'tenant-administrator'` on the namespace is the Gateway's coarse gate; the per-organization decision is the seam's and is applied again there, because the Gateway knows the standing but not which organization a submission names.

</details>
