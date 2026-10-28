# Agent Note: A tenant is a directory lookup, and the transport decides what to trust

Status: implemented

English | [中文](2026-09-17-tenant-directory-seam.zh.md)

## Problem

Multi-tenancy starts with one question the harness could not answer: which tenants does this deployment serve, and which one is this request for. Nothing in the tree named a tenant, so every later layer — per-tenant configuration, per-tenant credentials, a tenant column in durable records — had nothing to key on.

The answer has to survive three constraints the repository already sets. A capability seam is complete or it is not a seam, so a definition without a provider and a consumer is not deliverable. Routing identity may not come from model-visible input: the initiator-scope note already rejects letting a model or a tool argument select a Session, a tenant, or a sandbox. And hosting concerns may not spread through provider-neutral APIs, so no existing capability may grow a `tenantId` parameter.

## Decision

`ctx.tenants` is a directory with three lookups — the immutable id a caller states, the hostname a request arrived on, and the slug a direct subdomain carries — and each answers `undefined` for a subject it does not know. `@lyness/lyn-tenant-static` provides the roster from composition config, validating every row at load and refusing two rows that claim one id, slug, or hostname. `@lyness/lyn-tenant-http` consumes the directory: it applies the resolution order (header, then hostname, then subdomain), answers which tenant the asking request belongs to on its own route, and refuses what it cannot resolve.

A tenant id is opaque and immutable, and it is neither the slug nor a hostname, because both are presentation an operator changes while durable records that name a tenant must keep resolving.

Resolution policy lives in the consumer, not the seam. Which part of a request a deployment trusts is transport knowledge: `X-Tenant-ID` is authoritative behind a gateway that sets it and forgeable in front of one. The seam therefore takes no position, and a second consumer — an RPC face, a session tagger — calls the same exported `resolveTenant` with its own policy.

An unresolved request is refused. There is no fallback tenant, because serving a different organization's data is worse than serving none.

## Alternatives considered

**Resolve inside the RPC gateway.** Every Remote call would arrive already scoped. The gateway is headerless by construction — it dispatches an endpoint and a payload — so the tenant would have to be resolved in the browser-connection route that still holds `req.headers`, which is an upstream file this fork would then carry through every merge. Deferred until an RPC face actually needs the tenant.

**Make the subdomain the tenant id.** One fewer mapping, and a human-readable id in every record. Renaming a tenant or moving it to another domain would then invalidate every durable record that named it, which is the failure the workspace id already avoids by not being a path.

**Fall back to a configured default tenant when nothing resolves.** A private deployment would need no hostname configuration at all. Under SaaS the same rule turns one misconfigured domain into a request silently served from another tenant's data.

**Put the resolution order in the Service Definition.** Every consumer would resolve identically without repeating the policy. The order is transport knowledge, and a provider-neutral API that encodes it forces one deployment's trust model on every future consumer.

**Serve `/api/v1/tenant/config` as the requirements document specifies.** It is the acceptance criterion written there. Conflict #2 already ruled that tenant configuration travels over Typert RPC rather than REST; this route answers identity only — id, slug, display name — and configuration will follow the RPC ruling.

## Consequences

A deployment that mounts nothing from this group is single-tenant and unchanged; the seam is opt-in and no shipped bundle composes it.

Nothing carries the resolved tenant beyond the answer. The RPC gateway and the session log will each call `resolveTenant` when they need it, which keeps the tenant out of ambient state that a remote boundary cannot see anyway.

The roster is fixed at load, so adding a tenant is a patch-layer edit and a restart, until a database-backed directory replaces the static row.

A new `ctx` service is registered by hand in several generator tables — the subsystem page it belongs to, the pages its types are documented on, its capability-seam roles, and the type-equivalence manifest. None of them has an extension point, so each is an upstream file this fork now edits; `CUSTOM.md` records them, and [docs/subsystems/multi-tenancy.md](../../../../docs/subsystems/multi-tenancy.md) is the page they point at.
