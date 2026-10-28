# Agent Note: How work reaches an agent, and the one session plane it lands on

Status: proposed

English | [中文](2026-10-09-inbound-interfaces-and-the-session-plane.zh.md)

## Problem

Several ways in already exist, and each one invented its own arrival.

[`api/gateway`](../../../../packages/api/gateway/README.md) is the Typert RPC endpoint the Web and Desktop clients speak. [`sdk`](../../../../packages/sdk/README.md) is JSON-RPC for a program. [`acp`](../../../../packages/acp/README.md) is another agent driving a session. [`webhook`](../../../../packages/webhook/README.md) turns an external event into a root session inside a Web workspace. [`schedule`](../../../../packages/schedule/schedule/README.md) restores a cold session and delivers a due occurrence as a follow-up in that session. The [hook bridges](../../../../packages/hooks/hook-protocol/README.md) let an external harness block a prompt or attach context.

Two of those already do the right thing. Schedule delivers into the **original** session and restores it when it is cold; webhook creates an ordinary root session rather than a special kind. So "everything lands on one session plane" is a rule this tree half-follows and never states — which is why the half that follows it had to discover it twice.

What is missing is the part a hosted customer needs.

**There is one adapter and no shipped mounting.** `webhook-github` is the only provider adapter, and `webhook` appears in a CLI example and a test fixture, in no profile that serves people. A customer who wants work to arrive from somewhere else has nowhere to plug in.

**Nothing maps an external account to a person.** [The acting context](2026-10-08-people-memberships-and-acting-context.md) says a request acts in a membership, and [attribution records that membership](2026-10-07-session-ownership.md). An inbound event has no such membership: webhook's own rules are "trusted programmatic", so the rule's author decides what happens, not the person the work is for. On shared hosted infrastructure that is the wrong authority.

**And no person is authenticated anywhere.** [`packages/identity`](../../../../packages/identity/anonymous-user-id/README.md) holds one anonymous installation id for telemetry correlation, which "contains no machine or account data" by design. Nothing in the tree establishes who a human is. That is why the binding below has to start as a manual act: there is no directory to read it from.

The mechanism to fix that is already built, for one provider. [`lyn-authorization`](../../../../packages/credentials/authorization/README.md) is deliberately provider-agnostic — "the package provides no provider-specific methods itself" — and [`deepseek-account-platform`](../../../../packages/credentials/deepseek-account-platform/README.md) is its one integration, running a full OAuth 2.0 authorization-code flow with S256 PKCE: it registers `/oauth/callback` on the existing Host web server, validates `state`, exchanges the code once, and commits a grant. Every vendor sign-in this note needs is that same flow against a different issuer.

**And the inbound direction has no owner.** The [default-modules note](2026-10-08-default-modules-and-views.md) gives the connector catalog to MCP servers — the agent reaching the customer's systems. The opposite direction, the customer's people and systems handing work to the agent, is not in that list. That omission is this note's reason to exist, and it is the direction customers ask for first: they want the agent reachable from the chat tool their company already uses, not only from this product's own page.

## Proposal

Name the plane, make every way in resolve a person first, and keep the arrival operations to three.

### Every inbound surface resolves an acting membership, then does one of three things

An inbound surface authenticates its caller, resolves the membership that caller acts in, and then either creates a root session, delivers a follow-up into an existing session, or streams a live conversation. There is no fourth operation and no inbound-only session kind.

Schedule and webhook already behave this way; stating it stops the next surface from inventing a fourth arrival.

### Adapters authenticate, the plane authorizes

Webhook's README already draws this line — "provider authentication belongs to adapter packages" — and it generalizes. The adapter proves which external account is calling, using whatever that provider requires. The plane decides what the resolved membership may do. An adapter never decides authority, and the plane never learns a provider's signature scheme.

### An external account binds to a membership, and the organization owns the binding

A DingTalk userid, a Feishu open_id, or a CRM user id maps to a membership through a binding the organization owns. An external identity with no binding cannot start a session, and the refusal says so rather than silently dropping the event.

An administrator may create a binding by hand, and where the organization has connected that vendor's identity face the binding comes from the directory instead: the person signs in once through the vendor, and the account that signed in is the account that is bound. Manual binding stays available for systems with no identity face, such as a CRM, but it stops being the only way in.

This is what lets attribution keep working: the session is owned by the person the work is for, in the membership they act in, exactly as it is when they open the product themselves.

### The inbound event runs under the acting membership's permissions

An arriving event carries the resolved membership's permission preset and plan, not the rule author's and not the adapter's. A webhook that creates a session gets the same sandbox mode and approval policy that person would get in the product, and an exhausted quota stops it the same way.

### Delivery reuses what schedule proved

Follow-up delivery into a cold session is solved: schedule restores the session and appends the occurrence. Inbound follow-ups use that same path rather than a second mechanism.

### A vendor integration contributes identity, a channel, or both

One vendor is one package, and it may contribute two faces. The **identity face** signs a person in and answers which memberships they hold, through the OAuth flow `deepseek-account-platform` already proves. The **channel face** receives that vendor's events and delivers replies. A vendor with both shares one application credential and one token-refresh path.

Sharing them is the reason the package is per vendor rather than per face. DingTalk, Feishu and WeCom each issue one enterprise application credential that both faces use; splitting them into a channel package and an identity package would copy that credential and its refresh into two owners. Microsoft is the same relationship across two product names: Entra ID is the identity face, Teams is the channel face, and Teams' own bot tokens are issued by Entra, so the channel face cannot be built independently of the identity one anyway.

All four vendors — DingTalk, Feishu, WeCom, Microsoft — are in scope for both faces. The identity face is worth having even for an organization that never connects the channel, because the same sign-in serves the product's own web surface and populates the bindings above.

### Tenant credentials live where the agent cannot read them

A vendor application credential belongs to the organization, and on hosted infrastructure the agent must not be able to read it. [`credentials-local`](../../../../packages/credentials/credentials-local/README.md) states plainly that it cannot provide this: its file is readable by the OS user, and "agent tool processes run as that same user, so this store cannot isolate secrets from the agent". That is correct for a developer's own machine, where the secret is theirs. It is not correct for a customer's enterprise application secret on shared infrastructure, where a single `bash` call would read it.

A credential store the agent cannot reach is therefore a **precondition** for hosted inbound, not a later refinement. It is the same boundary as [the command container](2026-10-08-agent-isolation-and-teams.md): the agent runs where the credential is not. Until that holds, inbound adapters ship to desktop and private deployments only, where the operator and the credential owner are the same person.

### Sequence by shape, not by vendor

The first two integrations are chosen for shape rather than brand: one identity-led vendor and one channel-led vendor, so both faces and both failure modes are exercised before the remaining two are built. `webhook-github` stays as a third shape — an event with no human behind it becoming a new session.

Which vendor goes first is a customer question, not an architecture question, and this note deliberately does not answer it. Building all four before any of them has a real user would put the same seam mistake in four places at once.

### Inbound and outbound stay separate packages

The customer's own systems appear twice, in opposite directions, and the two are not one feature. An MCP server the agent calls has the agent's credentials, runs inside the agent's turn, and fails as a tool error. A channel that calls the agent carries an external person's identity, arrives unprompted, and fails as a delivery. Same systems, different authentication, different identity, different failure. They do not share a package and do not share a settings surface.

## Alternatives considered

**Leave each surface to handle sessions its own way.** No new concept, and the existing surfaces work. Rejected: it is today's state, and it is why schedule and webhook each had to arrive at the same session rule independently. The next surface would arrive at a different one.

**Put inbound channels in the connector catalog.** One place for "the customer's systems", which is how a customer might describe it. Rejected: it merges two directions with different authentication, different identity, and different failure modes, and the merged surface would have to explain which half of its fields apply.

**Let each person bind their own external account.** Self-service, no administrator step. Rejected: it lets anyone holding an account on an external platform claim a seat in an organization. The binding is an organization decision, like the membership it points at.

**Keep trusting the rule, as webhook does today.** Correct for a private deployment, where the rule's author runs the server. Rejected for hosted: the rule author and the person the work is for are no longer the same, and only the second one's plan and permissions are legitimate.

**Split each vendor into a channel package and an identity package.** Cleaner by face, and a customer wanting only one face would install only one package. Rejected: the two faces of one vendor share an application credential and its refresh path, so splitting gives that credential two owners — and for Microsoft the channel's own tokens are issued by the identity face, so the split would not even be possible.

**Treat the identity face as optional, since channels carry their own user ids.** A channel event already names its sender, so bindings could stay manual forever. Rejected: manual binding does not scale past a pilot, it has no deprovisioning story when someone leaves, and the same identity face also gives the product its own sign-in — three reasons to build it once rather than defer it.

**Ship hosted inbound on the existing credential store.** It works today and the gap is documented. Rejected: it hands a customer's enterprise application secret to the agent's own shell. The documented limitation is a statement of what that store is for, not a risk to accept.

**Build a generic chat-protocol adapter covering every platform.** Fewer adapters to write. Rejected: the platforms disagree on identity, threading, attachments, and recall semantics, so the generic layer would be a union of special cases with no owner for any of them.

## Acceptance criteria

- Every inbound surface resolves an acting membership before it creates or touches a session, and an unbound external identity is refused with a stated reason.
- An inbound event runs under the resolved membership's permission preset, plan, and quota — not the rule author's or the adapter's.
- Creating a root session, delivering a follow-up, and streaming a live conversation are the only inbound operations, and no session kind exists only for inbound work.
- Follow-up delivery restores a cold session through the path schedule already uses.
- At least one messaging adapter and `webhook` are mounted in a profile that serves people.
- An external-account binding is owned by the organization and visible to it, whether an administrator created it by hand or the vendor's identity face established it at sign-in.
- One vendor is one package contributing an identity face, a channel face, or both, and a vendor with both uses one application credential and one token-refresh path.
- A hosted deployment resolves a vendor application credential from a store the agent cannot read; until such a store exists, inbound adapters are available only where the operator owns the credential.
- No inbound adapter appears in the connector catalog, and no MCP server appears in the inbound plane.

## Risks

**Adapter count grows with every customer.** Each platform is its own authentication, identity, and threading model, and a customer who uses a platform nobody built for will ask for it. The seam bounds the work per adapter but does not bound how many are wanted.

**Four vendors with two faces each is eight faces of work.** The seam bounds what one face costs and bounds nothing about the total. Each identity face is an issuer's own quirks and each channel face is its own signature scheme, event envelope, token lifecycle, threading model, attachment fetch, and rate limits.

**Directory-driven binding needs a deprovisioning answer.** A directory that can create a binding will eventually remove a person, and nothing here says what happens to their sessions and their running work at that moment. [Session ownership](2026-10-07-session-ownership.md) decides archival for a removed member; the directory is the trigger that makes it a routine event rather than an administrator's action.

**The external-account binding is an account-takeover surface.** A wrong binding hands one person's sessions and quota to another. It needs the same care as adding a member, because that is what it is.

**A chat channel's turn model does not match a session's.** Concurrent messages, edits, recalls, and threads have no counterpart in one agent turn. Each adapter will be tempted to resolve that locally, and those local resolutions are how the plane stops being one plane.

**Hosted inbound is an internet endpoint.** Until an adapter proves its caller, the endpoint is reachable by anyone who finds it. The adapter is the only thing between the plane and the open internet, which puts weight on the least interesting code in the design.

**Three operations may prove to be too few.** A channel that wants to edit an earlier message, or cancel delivered work, fits none of them. Holding the line is the point, but the first real adapter is where that line gets tested.
