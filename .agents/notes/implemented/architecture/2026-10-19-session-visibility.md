# Agent Note: Whose conversations one call may see

Status: implemented

English | [中文](2026-10-19-session-visibility.zh.md)
## Problem

[Session ownership](../../proposed/architecture/2026-10-07-session-ownership.md) records who opened a conversation. Nothing read it back. A deployment that serves named people therefore attributed every session correctly and still let each of those people list, open, search, page, follow and read the projections of everybody else's — the record existed, and the product behaved exactly as it had when one operator sat at the keyboard.

## Decision

`ctx.sessionVisibility`, the `./visibility` half of `lyn-session-ownership`, answers whether the call in progress may see one conversation, and the Remote session surface asks it at four places: the corpus read behind `session/list` and `session/search`, the resolution every Agent-backed endpoint goes through, the history's observation, and the projection read.

The rule is one function over whatever attribution was read:

- A call with no principal sees everything. The CLI, a subagent, a scheduled follow-up and an inbound webhook are the deployment acting on itself; filtering them would hide a deployment's work from itself.
- A conversation belongs to the person who opened it, and to nobody else. An administrator administers a deployment without reading its people's conversations, so no role widens this.
- An unattributed conversation whose parent is open belongs to that parent's owner. A subagent child is opened by the loop rather than by a request, so it carries no owner; the walk is bounded at eight links, and a parent that is not open is not resumed to answer the question.
- Any other unattributed conversation is the deployment's own, and only a platform administrator sees it. That is the one standing that can answer for what the deployment did on its own, and it keeps scheduled and webhook work reachable.

A refused session answers `session/not-found` rather than a distinct refusal, so one person cannot enumerate another's conversations by id.

Reads stay cheap. A live session answers from its own projection; a cold page or follow answers from the events the observation already holds; a listing answers from the durable projection cache, which required two new Host-only faces — `sessionProjections.checkpointState(checkpoint, key)` and `sessionProjectionCache.cachedCheckpoint(meta)` — because the cache's existing read served only client-visible units and the owner is deliberately not one. A listed row whose owner is not cached reads as unattributed: it stays out of a member's list rather than leaking, and opening it by id still asks the session's own log.

The rule is a composition row. `module-accounts` selects it beside the stamp; a deployment with no accounts mounts neither, and nothing is filtered.

## Alternatives considered

**Filter in each endpoint.** Thirteen checks in one controller and a forgotten one in the next. The two resolve faces, the corpus read, the history's `sourceFor` and the projection read are the funnels every endpoint already passes through, so the rule is applied where the Session is resolved rather than where it is requested.

**Enforce in the Gateway, as the authority rule does.** The Gateway authorizes an endpoint by its declared standing; it does not know which argument names a session, and a list has no single subject at all. A declaration naming the subject field would work for the per-session endpoints and still leave the list and the search to a filter — two mechanisms where there is now one.

**Publish the owner as a wire projection.** It would have made the listing read trivial, because the projection cache serves client-visible units. It also puts attribution on the wire for a client that has no use for it, to be read back by the Host that wrote it. The Host-only cache faces cost two small methods and keep the attribution where it is decided.

**Let a platform administrator read everything.** Tempting for support, and the wrong default: a deployment's administrator is usually its customer's own staff, and "the administrator can read your conversations" is a property that has to be chosen deliberately rather than inherited from being able to configure sign-in. An administrator still sees what the deployment itself did.

**Refuse with a forbidden code.** It tells the caller the id exists. Not-found is both true for this caller and silent.

## Consequences

A deployment with accounts now separates its people's conversations on every Remote read, and a single-operator install is unchanged because the rule is not mounted there. The session list costs one cache read per cold row.

Two readers remain outside the rule, both named in the package's Known Limitations: the `/export` ZIP route is a plain authenticated HTTP route that no request principal enters, and the `session_query` tool runs inside an Agent, which by design has no principal — so on a deployment with accounts both still reach every session the deployment holds. Closing them needs a principal on plain fetch routes and a subject for a tool call, which are their own decisions.

A subagent child whose parent is closed is invisible to its owner until the parent is open again. The alternative is resuming a parent to decide whether to show a child, which turns a read into an activation.
