---
description: "Invitations: the bounded code an administrator sends so somebody nobody has heard of can join."
kind: "package-reference"
---

# @deepseek-ai/dsh-invitations

English | [中文](README.zh.md)

## Summary

`dsh-invitations` is how a stranger becomes a member, and how somebody already here gains a second standing. An administrator issues a code carrying one standing — a role and its organization — and sends it. A stranger presents it at a sign-in and becomes a roster entry with that standing; somebody the roster already holds accepts it themselves. The code is the authority, bounded on every side: it grants no more than its issuer could, it expires, it allows a counted number of redemptions, it can be withdrawn, and it dies with the issuing standing. Only its hash is stored.

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

Two rows: the invitations themselves, and the admission rule that honours them **instead of** `dsh-managed-people/admission`.

```yaml
- id: invitations
  name: '@deepseek-ai/dsh-invitations'
  config:
    defaultLifetimeMs: 604800000
    defaultMaxUses: 1
- id: sign-in-admission
  name: '@deepseek-ai/dsh-invitations/admission'
  config:
    bindings: []
```

A deployment mounts exactly one admission rule. The managed rule admits only what an administrator bound; this one also admits whoever they invited. `bindings` is the same operator-written half both rules read, so swapping the row keeps what an installation wrote.

The browser half carries the code: `/auth/sign-in/<channel>?invite=<code>` keeps it in a short-lived cookie and presents it when the directory returns. A code never travels to the directory.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The store holds no redeemable secret.** The code is returned once, by the call that issued it, and kept as a SHA-256. An administrator who loses it issues another one; nothing can read it back, including a stolen store.

**It grants what its issuer holds, twice over.** The three rules the roster applies to adding somebody directly are applied again at issue time: a tenant administrator's standing names an organization, only a platform administrator makes another one, and nobody reaches outside the organization they administer. Then redemption asks the directory for the issuing standing again — a code issued by an administrator who has since been removed, demoted, or moved admits nobody.

**The roster answers before the invitation.** A subject a binding already names signs in as that person, and a code they happen to hold changes nothing. That order is what stops a forwarded link from adding a second entry for somebody already here — and from adding authority to their account during a sign-in they made for another reason.

**Somebody already here accepts for themselves.** `accept` is the other half, and deliberately not the same half: the person is signed in, the code is theirs to present, and the standing arrives because they asked for it. It grants no more than the issuing standing could grant directly, because the write goes through the roster as that standing — including the roster's rule that changing somebody requires administering every standing they already hold.

**A refused acceptance costs the invitation nothing.** The use is claimed before the write and released when the roster refuses it, because nothing else was written. A redemption cannot do that — it leaves a person behind if the binding fails — but an acceptance that was refused leaves the deployment exactly as it was, and burning an administrator's invitation on an answer of "no" would be a worse trade.

**A use is claimed before the roster is written.** Two redemptions racing cannot exceed the count; a claim whose write then fails burns a use, which is the safe direction — an extra member is not recoverable, and a burned use is one more invitation.

**A roster it cannot finish writing is rolled back.** The person is written before the identity that signs in as them, so a refused binding removes that person again: a row nobody can be is one an administrator did not ask for and cannot explain. The failure is raised rather than answered as "not admitted" — whoever presented the code did nothing wrong, and a deployment that cannot admit anybody should say so.

**Every refusal is the same answer.** A wrong code, a spent one, an expired one and an uninvited subject all read as `undefined`, which the sign-in reports as `not-admitted`. A page that told them apart would report, to whoever asked, which codes exist.

**A withdrawal keeps the record.** Revoking sets `revokedAt` rather than deleting the row: the trail of who invited whom is the point of keeping it, and a deleted row answers nothing when somebody asks how that person got in.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-managed-people`](../managed-people/README.md) — the roster a redemption writes, and the rules it restates.
- [`dsh-sign-in`](../sign-in/README.md) — the flow that presents the code, and the admission seam it reaches.
- [`dsh-sign-in-http`](../sign-in-http/README.md) — the cookie that carries a code across the browser round trip.
- [`dsh-admin-audit`](../admin-audit/README.md) — where issuing, withdrawing and redeeming are recorded.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers who may join before any session exists.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **An acceptance tells its holder nothing about the code** — a wrong code, a spent one, one whose issuer is gone and one granting a standing they already hold all answer the same, because anybody signed in could otherwise learn which codes exist.
- **A redemption is not transactional** — the use is claimed first and the roster written after, so a failure between them burns a use without admitting anybody. A refused binding takes its own half back: the person is removed again, and the burned use is the only trace.
- **One standing per code** — an invitation carries one role in one organization, so inviting somebody to two organizations is two codes.
- **No email** — the deployment produces the code; sending it is the administrator's own business, by whatever channel they already use.
- **A revoked invitation keeps its label** — which is the name the administrator typed, so a label holding an address keeps that address in the trail.

**Runtime invariant:** no invitation grants more than its issuer still holds, and no code is readable after the call that issued it.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`redeem` writes through `ctx.managedPeople` with the issuing standing as the actor, so the roster's own authorization and the administration trail both see the change as that administrator's — which is whose authority it is.

</details>
