# Agent Note: The tenant of a request, and the hook that carries it

Status: implemented

English | [中文](2026-09-21-the-tenant-of-a-request.zh.md)

## Problem

A Remote method receives its endpoint, its payload, and the caller's cancellation. It does not receive the request it arrived on, which is right for a namespace answering about what the caller asked for and leaves nowhere for the calling organization to live.

Two consequences followed. The session stamp named its tenant from its own configuration — one value for the whole process, so correct only for a deployment serving one organization, and the reason the record it writes carried a footnote saying so. And a configuration surface had no honest way to know whose configuration it was being asked about: a tenant cannot be a method parameter, because a caller that names its own tenant names any tenant.

## Decision

The Connection gained one extension point: `ctx.connection.rpc.scope(scope)` wraps every decoded call on every channel, receives the HTTP request, and must call and return `run()` unchanged. `@lyness/lyn-tenant-request` registers one, resolves the tenant the same way the HTTP route does — header, then hostname, then subdomain — and publishes it with that tenant's configuration as `ctx.requestTenant` for the duration of the call.

Four rulings shape it.

**A scope decides context, never outcome.** It may not answer a different result, and it may not skip the dispatch. A hook that could do either would turn every endpoint on every channel into something its owner did not write, which is a far larger change than the one needed.

**The configuration is resolved in the same step as the tenant.** The consumer that needs it most is the `session/created` listener, which is synchronous and cannot await a store. Resolving both while the call is still async is what makes a synchronous read possible; both shipped backends answer from memory, so the cost is a map lookup per call.

**An unresolved call is not refused here.** Which calls may proceed without a tenant is the answering surface's decision — a namespace touching one organization's data refuses, a call touching none does not need to know. Refusing in the scope would make every endpoint tenant-only, which is not what mounting a directory says.

**The reader is typed by a module that does not import the Connection.** `ctx.requestTenant` is the interface in `./types`, so the session stamp — which also runs headless — reads the calling tenant without compiling against the web transport.

## Alternatives considered

**Pass the request into `ConnectionRpcHandler`.** One parameter instead of a registry, and no nesting to reason about. It changes the signature every channel owner implements, and it hands transport facts to every namespace rather than to the one plugin whose job is transport policy.

**Key per-call state by the `AbortSignal` the handler receives.** No upstream change at all. The Gateway derives signals, so the identity a handler sees is not reliably the one the transport created; a lookup that silently misses would attribute a session to no tenant, or to the wrong one, with nothing to read afterwards.

**Register a second `/api` route in front of the Gateway's.** Also no upstream change. The web server selects one route per path; there is no place to stand between a route and its handler, and the shared channel holds exactly one interceptor, which the Gateway owns.

**Make the tenant a parameter of every tenant-scoped Remote method.** No scope, no async-local state, and an explicit contract. A caller would then name the tenant it acts for, which is the authorization hole the whole seam exists to close.

**Keep the configured tenant and stamp sessions from it.** No new package. It cannot be right for a deployment serving several organizations, which is the deployment this work is for.

## Consequences

The session record now names the tenant of the call that created the session, and the configured tenant only when there is no call — a CLI run, a resumed session, a subagent. `tenantId` stays required on `lyn-tenant-session` for exactly those cases.

The scope covers unary RPC. A Remote stream and an exact Fetch route below `/api` are dispatched on other paths and see no tenant; a surface on those paths that needs one has to resolve it itself, the way the HTTP route does.

`x-tenant-id` is believed, as it already was on the HTTP route. A deployment exposing `/api` to callers it does not control must terminate that header at its own edge.

Upstream's `rpc.ts` and `rpc-host.ts` carry the hook, recorded in `CUSTOM.md`. Nothing else in the tree registers a scope, so a deployment that mounts no tenant rows runs the same dispatch it ran before, through one extra function call that iterates an empty set.
