# Agent Note: Per-tenant brand for the hosted product

Status: proposed

English | [中文](2026-10-07-per-tenant-brand.zh.md)

## Problem

A deployment's brand is composition config. `lyn-host-brand-deployment` reads one `productName`, one palette, and one asset directory from a profile's patch layer, and writes the result into `globalThis.lynDeploymentBrand` as every index renders. One process therefore serves exactly one brand, which is what a private deployment is: the operator who runs the server is the brand owner, and [configuration outranking user settings](../../implemented/architecture/2026-08-04-configuration-source-ownership.md) is what keeps their identity from being edited by the people using it.

The hosted product is not that. One process serves many customers, each resolved per request by [`lyn-tenant-request`](../../../../packages/tenant/tenant-request/README.md) from a header, a hostname, or a subdomain. A customer on a business plan expects the product to carry their mark, their name, and their colours; a customer on an individual plan expects nothing of the sort and must not be able to take the platform's attribution down. Today neither is expressible: `TenantConfig` already carries `displayName` and a `copy` override map, so a tenant can change words, but every visual — mark, wordmark, favicon, palette — comes from the one host row and is identical for every tenant the process serves.

The gap is not only missing fields. Three mechanisms assume a single brand: the index injection resolves before any tenant is known, the brand assets are served from one directory under one URL, and `showPoweredBy` is a plain boolean an operator sets. Adding per-tenant fields without changing those would serve one tenant's artwork to another.

## Proposal

Make the brand part of what a tenant configures about itself, resolved per request, and gate the ability to change it on the tenant's plan.

### The brand becomes tenant configuration

`TenantConfig` gains a `brand` member beside `copy`: the three product names, the palette tokens this tenant replaces, and a reference to each of the three assets. The rules are the ones that already exist — `isBrandName` for the names, `BRAND_COLOUR_TOKENS` and `isBrandColour` for the palette — stated once in `validateTenantConfig`, which a read-only store checks at load and a writable one checks before it saves. Nothing new decides what a usable brand is.

The names resolve as one set, the way they already do on the page: a tenant that names any of the three takes the others from the one it named, and a tenant that names none takes the platform's. The same rule applies one level up — a tenant brand overrides the deployment brand, which overrides the built-in lyness values — so a half-configured tenant never reads as a mixture of its own name and the platform's.

### The index injection resolves per request

`brand-deployment` keeps owning the injection but stops being its only source. When the request resolved a tenant and that tenant configured a brand, the injected object is the tenant's; otherwise it is the deployment's, as today. The client needs no change: it already reads one object from the page global, and [`brand-values.ts`](../../../../packages/client/locale/src/client/brand-values.ts) already treats every member as untrusted page data.

### Assets are addressed by tenant

Brand assets move from one directory served at `/brand/<file>` to per-tenant storage served at `/brand/<tenantId>/<file>`, with a content hash in the URL and a long-lived cache entry keyed by it. Without the tenant in the path, one customer's browser cache can answer another customer's request for `/brand/mark.svg`; without the hash, a replaced mark keeps serving from caches the server cannot reach.

### Changing the brand is a product surface, not a command

A tenant administrator changes the brand from the product's own settings, which calls `tenant.save()`. The `brand-setup` profile stays exactly what it is: a single-operator tool for a private deployment, reached from the server's own terminal.

### The plan decides, and the server enforces

Two entries in the tenant's existing `features` list carry the decision:

- `brand.customize` — the settings surface appears, and `brand` saves are accepted. An individual-plan tenant has neither.
- `brand.remove-attribution` — `showPoweredBy` may be turned off. Without it the attribution stays on whatever the tenant asks for, so an individual-plan tenant always shows `Powered by lyness` in the [`sidebar.attribution`](../../../../packages/client/ui-sidebar/README.md) seat.

Both are enforced inside `tenant.save()`. A settings page that hides a control is presentation; the decision belongs in the operation that makes it, because a direct Remote caller reaches the same save.

### Addressing: subdomains now, custom domains later

Tenants are reached at `<slug>.<base domain>`, which `tenant-request` already resolves. Custom domains such as `agent.acme.com` are deliberately out of scope: they resolve through the same seam, but they add certificate issuance, renewal, and ownership proof, which is a separate body of work with no bearing on how a brand is stored or resolved.

## Alternatives considered

**One process per tenant.** Each customer gets a deployment, and today's host-level brand works untouched. Rejected: the hosted product's economics assume shared processes, and it would make every other tenant-scoped feature — models, providers, features — pointless, since those exist precisely because one process serves many.

**Brand as `copy` entries.** The names are copy, so a tenant could override them through the existing map. Rejected: it covers no visual, gives the palette no validation, and would let any copy id masquerade as a brand field. The brand has its own rules and its own assets, so it gets its own member.

**A boolean `whiteLabel` on the tenant.** Simpler than two feature entries. Rejected: it conflates two decisions that are priced separately everywhere this pattern appears — carrying your own mark, and removing the platform's attribution — and the attribution is the one a customer will ask to drop first.

**Client-side brand fetch after boot.** The page could call `tenant.describe()` and apply the brand once it answers. Rejected: the brand would arrive after the first paint, so every load would flash the platform's identity before the customer's.

**Font upload for tenants.** The studio accepts a brand owner's font behind a licence confirmation. Rejected for the hosted product: the platform would distribute glyphs on an uploader's assurance. A curated set of licensed faces is the fallback if typography control is needed.

## Acceptance criteria

- `TenantConfig.brand` exists, `validateTenantConfig` refuses an unusable name, an unknown palette token, and an unusable colour, and the refusal names the field.
- A request that resolves a tenant with a brand gets that brand in its index injection; a request that resolves a tenant without one, or no tenant at all, gets the deployment brand; a deployment with no brand gets the built-in lyness values.
- Two tenants configured with different marks are served different asset bytes, and neither URL can answer for the other.
- `tenant.save()` refuses a `brand` change from a tenant without `brand.customize`, and refuses `showPoweredBy: false` from a tenant without `brand.remove-attribution`, in both cases through the Remote call rather than through the page.
- An individual-plan tenant renders the attribution line, whatever its stored configuration says.
- The `brand-setup` profile and the private-deployment path behave exactly as before.

## Risks

**A tenant's brand leaking into another's page.** The whole design turns on the request resolving the right tenant before the index renders. The mitigation is that resolution already exists and is tested; the new work must not add a cache in front of it. An index response must never be shared across tenants.

**Asset storage growth.** Three SVGs per tenant is small, but replaced assets accumulate if nothing removes them. Superseded assets need an owner at write time, not a sweep later.

**Validation drift between the two paths.** The private deployment validates at load and the hosted product validates at save. Both must call the same `validateTenantConfig`; a second copy of the rules is how one path starts accepting what the other refuses.

**Attribution enforcement reachable only through the page.** If any later surface writes the tenant configuration without going through `tenant.save()`, the plan gate stops applying. The save is the enforcement point and must stay the only writer.
