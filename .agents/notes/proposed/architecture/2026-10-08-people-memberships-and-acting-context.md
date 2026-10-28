# Agent Note: People, memberships, and the context a call acts in

Status: proposed

English | [中文](2026-10-08-people-memberships-and-acting-context.zh.md)

## Problem

Nothing in this tree knows a person. [`lyn-tenant-request`](../../../../packages/tenant/tenant-request/README.md) resolves a call to an organization — by the `x-tenant-id` header a gateway sets, by the hostname, or by a subdomain label — and stops there. The only user-shaped identifier is [`anonymous-user-id`](../../../../packages/identity/anonymous-user-id/README.md), which exists to correlate telemetry *without* identifying anyone. `TenantConfig` names an organization's models, providers, features and copy, and its own README records the gap: there is no user layer between the organization and the agent.

Two proposals already depend on that missing layer. [Session ownership](2026-10-07-session-ownership.md) requires every call to state which person opened a conversation and which membership they were acting in. [Per-tenant brand](2026-10-07-per-tenant-brand.md) requires a tenant administrator who may change the brand, and a plan gate enforced where the change is saved. Neither can be built first.

Resolving the organization is also not enough on its own, for a reason the address cannot fix. One person holds one identity and may hold several memberships at once — their own, and one in each organization they belong to. An organization that has not taken a subdomain is reached at the platform's own address, where the hostname names no organization at all. So "which organization is this call for" cannot be answered by the address in general, and cannot be answered by the person's memberships either, because there may be several.

## Proposal

A person is one identity. What varies is the context they act in, and every call states it.

### One identity, several memberships

A person signs in once and holds one identity. A **membership** is that person's standing in one organization, and carries exactly one role. A person may hold their own personal context plus a membership in each organization they belong to; nothing about the person says which one is in force.

Roles are three, and no more for now:

- **platform administrator** — belongs to the platform, not to any organization;
- **tenant administrator** — administers one organization;
- **member** — works in one organization.

A read-only auditor was considered and deferred: it adds a role before anything asks for one.

### The acting context lives in the authenticated session

Signing in produces a session for the person, not for a membership. That session carries the context currently in force — personal, or one membership — as server-side state, changed only by an explicit switch. It is never inferred from what the person happens to belong to.

Every call states its context, and the server checks that the context belongs to the caller. A call that states none is refused rather than defaulted: a person with two memberships makes a default a guess, and a guess here misattributes a conversation to the wrong organization.

### The address constrains the context; it does not choose it

Address resolution keeps doing what it does, and gains one rule over the result:

- On an address that resolves to an organization — that organization's own hostname, or its subdomain under the platform's base domain — the acting context **must** be a membership of that organization. Any other context is refused, not silently switched. The organization gets a space where its people act only as its people, and the brand that space shows is unambiguous.
- On the platform's own address, where no organization is resolved, any context the person holds is permitted. The context opens on the personal one, and the last context used at that address is remembered.

This answers the organization that has taken a subdomain and the organization that has not, with one rule rather than two mechanisms.

### `x-tenant-id` stays infrastructure

The header is what a gateway in front of the deployment sets, and it outranks the hostname. A hosted deployment must strip the header from client requests at its edge. Without that, any signed-in person could name any organization and the whole boundary is decoration. This is a deployment requirement of the hosted product, not an option.

### A new organization receives its first administrator from the platform

An organization cannot bootstrap its own administrator. When onboarding completes, a platform administrator assigns the organization's first tenant administrator; only then can the organization configure or manage anything itself, including inviting members and ending their standing. That rule is recorded in [session ownership](2026-10-07-session-ownership.md) for the operations that depend on it, and this note owns it.

### Ending a standing ends the membership, not the identity

Removing a person from an organization, or reclaiming the seat they held, ends that membership. The person keeps their identity, their personal context, and everything they own outside that organization. Their conversations in that organization stay where they are, attributed as before, and read as archived — which [session ownership](2026-10-07-session-ownership.md) specifies.

### What the platform administrator may not do

A platform administrator creates organizations, assigns the first tenant administrator, and manages what an organization has bought. Assigning an administrator is not membership, and none of those powers includes reading an organization's conversations. A B2B customer's first question about a hosted agent platform is who can see their work, and the answer must be a property of the design rather than a promise.

## Alternatives considered

**One account per organization.** The person signs in separately for each. Rejected: it multiplies credentials for one human, makes switching a sign-out, and leaves the platform unable to say that two accounts are the same person — which matters the moment an organization reclaims a seat.

**The address alone carries the context.** Elegant where an organization has a subdomain. Rejected: an organization that has not taken one is reached at the platform's address, which names no organization, so the rule has no answer for the common case.

**The context is inferred from the person's memberships.** Convenient when a person belongs to exactly one organization. Rejected: it is a guess as soon as they belong to two, and the cost of guessing is a conversation attributed to the wrong organization — in a record that is never rewritten.

**A client-side context selector with no server state.** The client sends the context and the server trusts it. Rejected in that form: the server must check the context against the caller's memberships anyway, so the state belongs where the check is. The client may still show a selector; it just does not own the answer.

**A fourth role for read-only audit.** Useful later. Deferred: no surface asks for it, and a role added before its consumer tends to be enforced nowhere.

## Acceptance criteria

- A person holds one identity and any number of memberships; each membership carries exactly one of the three roles.
- A call that states no context is refused; a call that states a context the caller does not hold is refused.
- On an address resolving to an organization, a call acting in any other context is refused rather than switched.
- On the platform's address, a person may act in any context they hold, and the personal context is what a fresh session opens in.
- A client-supplied `x-tenant-id` never reaches tenant resolution in the hosted deployment.
- A newly onboarded organization can do nothing itself until a platform administrator assigns its first tenant administrator.
- Ending a membership leaves the person's identity and personal context intact.
- No platform-administrator operation reads an organization's conversations.

## Risks

**One sign-in across several addresses.** A person signing in at the platform address and then opening an organization's subdomain must not have to sign in again, and the credential must not become usable at an address the organization never authorised. Cookie scope and a central sign-in are their own work, and this note does not design them.

**The edge becomes security-critical.** Stripping `x-tenant-id` is a deployment step, which means the boundary depends on something outside this repository. A deployment that forgets it has no error to see — the system works, for the wrong tenant.

**Switching is a state change that clients cache.** A client holding data fetched in one context and then switching has a window where it can show one organization's data under another's name. Clients must discard context-scoped state on switch, which is a client rule that no server check can enforce.

**Roles will be asked to grow.** Three roles are enough for what exists; the first real customer with a compliance team will ask for the fourth. The shape must make adding one a matter of naming a role, not of re-deciding where enforcement happens.
