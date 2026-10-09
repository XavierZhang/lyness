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

**And the inbound direction has no owner.** The [default-modules note](2026-10-08-default-modules-and-views.md) gives the connector catalog to MCP servers — the agent reaching the customer's systems. The opposite direction, the customer's people and systems handing work to the agent, is not in that list. That omission is this note's reason to exist, and it is the direction customers ask for first: they want the agent reachable from the chat tool their company already uses, not only from this product's own page.

## Proposal

Name the plane, make every way in resolve a person first, and keep the arrival operations to three.

### Every inbound surface resolves an acting membership, then does one of three things

An inbound surface authenticates its caller, resolves the membership that caller acts in, and then either creates a root session, delivers a follow-up into an existing session, or streams a live conversation. There is no fourth operation and no inbound-only session kind.

Schedule and webhook already behave this way; stating it stops the next surface from inventing a fourth arrival.

### Adapters authenticate, the plane authorizes

Webhook's README already draws this line — "provider authentication belongs to adapter packages" — and it generalizes. The adapter proves which external account is calling, using whatever that provider requires. The plane decides what the resolved membership may do. An adapter never decides authority, and the plane never learns a provider's signature scheme.

### An external account binds to a membership, and the organization owns the binding

A DingTalk userid, a Feishu open_id, or a CRM user id maps to a membership through a binding an organization administrator creates. An external identity with no binding cannot start a session, and the refusal says so rather than silently dropping the event.

This is what lets attribution keep working: the session is owned by the person the work is for, in the membership they act in, exactly as it is when they open the product themselves.

### The inbound event runs under the acting membership's permissions

An arriving event carries the resolved membership's permission preset and plan, not the rule author's and not the adapter's. A webhook that creates a session gets the same sandbox mode and approval policy that person would get in the product, and an exhausted quota stops it the same way.

### Delivery reuses what schedule proved

Follow-up delivery into a cold session is solved: schedule restores the session and appends the occurrence. Inbound follow-ups use that same path rather than a second mechanism.

### First adapters

One messaging adapter ships to prove the seam end to end — DingTalk or Feishu, whichever the first customer uses — and `webhook-github` stays as the second shape, an event becoming a new session. Two adapters of different shapes is the smallest set that shows the seam is a seam and not one provider's special case.

### Inbound and outbound stay separate packages

The customer's own systems appear twice, in opposite directions, and the two are not one feature. An MCP server the agent calls has the agent's credentials, runs inside the agent's turn, and fails as a tool error. A channel that calls the agent carries an external person's identity, arrives unprompted, and fails as a delivery. Same systems, different authentication, different identity, different failure. They do not share a package and do not share a settings surface.

## Alternatives considered

**Leave each surface to handle sessions its own way.** No new concept, and the existing surfaces work. Rejected: it is today's state, and it is why schedule and webhook each had to arrive at the same session rule independently. The next surface would arrive at a different one.

**Put inbound channels in the connector catalog.** One place for "the customer's systems", which is how a customer might describe it. Rejected: it merges two directions with different authentication, different identity, and different failure modes, and the merged surface would have to explain which half of its fields apply.

**Let each person bind their own external account.** Self-service, no administrator step. Rejected: it lets anyone holding an account on an external platform claim a seat in an organization. The binding is an organization decision, like the membership it points at.

**Keep trusting the rule, as webhook does today.** Correct for a private deployment, where the rule's author runs the server. Rejected for hosted: the rule author and the person the work is for are no longer the same, and only the second one's plan and permissions are legitimate.

**Build a generic chat-protocol adapter covering every platform.** Fewer adapters to write. Rejected: the platforms disagree on identity, threading, attachments, and recall semantics, so the generic layer would be a union of special cases with no owner for any of them.

## Acceptance criteria

- Every inbound surface resolves an acting membership before it creates or touches a session, and an unbound external identity is refused with a stated reason.
- An inbound event runs under the resolved membership's permission preset, plan, and quota — not the rule author's or the adapter's.
- Creating a root session, delivering a follow-up, and streaming a live conversation are the only inbound operations, and no session kind exists only for inbound work.
- Follow-up delivery restores a cold session through the path schedule already uses.
- At least one messaging adapter and `webhook` are mounted in a profile that serves people.
- An external-account binding is created by an organization administrator and is visible to that organization.
- No inbound adapter appears in the connector catalog, and no MCP server appears in the inbound plane.

## Risks

**Adapter count grows with every customer.** Each platform is its own authentication, identity, and threading model, and a customer who uses a platform nobody built for will ask for it. The seam bounds the work per adapter but does not bound how many are wanted.

**The external-account binding is an account-takeover surface.** A wrong binding hands one person's sessions and quota to another. It needs the same care as adding a member, because that is what it is.

**A chat channel's turn model does not match a session's.** Concurrent messages, edits, recalls, and threads have no counterpart in one agent turn. Each adapter will be tempted to resolve that locally, and those local resolutions are how the plane stops being one plane.

**Hosted inbound is an internet endpoint.** Until an adapter proves its caller, the endpoint is reachable by anyone who finds it. The adapter is the only thing between the plane and the open internet, which puts weight on the least interesting code in the design.

**Three operations may prove to be too few.** A channel that wants to edit an earlier message, or cancel delivered work, fits none of them. Holding the line is the point, but the first real adapter is where that line gets tested.
