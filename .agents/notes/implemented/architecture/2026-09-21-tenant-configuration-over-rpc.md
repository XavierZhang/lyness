# Agent Note: A tenant configures itself over the Remote namespace it already has

Status: implemented

English | [中文](2026-09-21-tenant-configuration-over-rpc.zh.md)

## Problem

The tenant-configuration seam could be read and written in process, and a durable backend accepted saves, but nothing exposed either to a browser. The requirements document proposed a REST surface for it, which would have been a second transport beside the Typert Remote namespaces this deployment already serves — a second authentication path, a second failure vocabulary, and a second thing to keep in step with the seam.

The harder half was authorization. A configuration surface must know whose configuration it is being asked about, and the obvious answer — a tenant id parameter — is not an answer at all: a caller that names its own tenant names any tenant.

## Decision

`@lyness/lyn-api-tenant-controller` registers the `tenant` Remote namespace with two methods. `describe` answers the calling tenant's own configuration plus two facts the seam does not carry: `writable`, whether this deployment's backend accepts a save, and `configured`, whether the tenant has ever saved anything. `save` replaces the whole configuration, and its input carries no tenant id.

Four rulings shape it.

**Remote, not REST.** The conflict with the requirements document is resolved in favor of the transport that already exists: one authentication fence, one generated client, one failure vocabulary, and a contract the compiler checks against the seam. A REST surface would have had to restate all of it.

**The tenant comes from the request, never from the arguments.** Both methods read `ctx.requestTenant` and refuse `tenant/unresolved` when the call named none. That is also the whole authorization story available today: a deployment has organizations but no members, so "a caller configures its own organization" is the only rule there is anything to enforce it with.

**Validated twice, on purpose.** The wire fields are parsed here, then the seam's own `validateTenantConfig` runs here as well, so the caller receives every problem in one answer and a form can mark every field at once. The backend validates again for every other caller it has; that duplication is the point of putting the rules in the seam.

**The answer is read back from the store, not echoed from the input.** The store is the authority on what it kept. A surface that trusted the echo would display what it sent, which is indistinguishable from a successful save right up until the next reload.

## Alternatives considered

**A REST surface, as the requirements document proposed.** Familiar to a web team, and callable with curl. It duplicates authentication, error mapping, and the request/response types the Remote generator derives from the Host signature, and nothing in this product calls it that could not call a namespace.

**Take the tenant id as a parameter and authorize it against the request.** One method usable by an operator acting for another tenant. It puts a check on every method that a missing check silently turns into cross-tenant access, and there is no operator role yet for it to authorize against.

**Per-field mutations, like the settings namespace's `mutate`.** A page could save one checkbox. The seam's rules are whole-configuration rules — a preferred model must be in its available list, a model's provider must be granted — so a field write validates against a configuration it cannot see.

**Return the seam's `TenantConfig` directly instead of a view.** Less projection code. A grant's credential is a branded reference in the Host, and the read needs facts the seam does not carry; a pass-through would either leak branded types onto the wire or answer without `writable`, which is the field a page needs most.

**Also expose the roster, so a surface can list tenants.** An administration portal will want it. Listing tenants is a different authority — one that spans organizations — and the directory deliberately answers only about a named subject.

## Consequences

An administration surface can now read and save a tenant's configuration. What it still cannot do is create a tenant, list tenants, or store the key behind a credential reference; those are the directory's and the credential store's own surfaces.

Who inside an organization may save is unenforced. Every authenticated caller that resolves to a tenant may save that tenant's configuration. This is stated in the package README as a limitation rather than hidden, and the check lands with user records.

The namespace is not in a shipped profile. It is only reachable in a deployment that also mounts a directory, a configuration store, and the request scope; mounting it in `web-app` would advertise a namespace that always refuses and would change the client's generated surface before a page exists to use it.

`ctx.tenantController` is registered by hand in the same generator tables the other tenant services needed, and `CUSTOM.md` records them.
