# Agent Note: The deployment's brand is composition config, served per response

Status: implemented

English | [中文](2026-09-13-deployment-brand-as-composition-config.zh.md)

## Problem

A deployment needs its own visual identity, and two of the obvious places to put it are wrong for the reason the same fact is decided twice.

The first is user settings. `settings.yaml` layers **above** composition, so anything a plugin exposes through the settings seam can be rewritten by the person using the deployment. A deployment's identity is exactly the fact that must hold against that person.

The second is the build. Upstream brands itself through the `LYNESS_CLIENT_*` prefix, which is embedded into the browser artifacts at build time — `LYNESS_CLIENT_TITLE` is read straight out of `process.env` in the client bundle. That works for a product shipping one brand and turns every rebrand into a frontend rebuild, which a deployment script cannot do.

## Decision

Brand values are **composition config** on a host plugin that registers no settings section, and they are **applied to each index response** rather than compiled in.

`@lyness/lyn-host-brand-deployment` carries the product name, brand colour, and the three asset file names, validates all of it at load, serves the assets, and writes the brand into every index render. `lyn-web-app` mounts the row with nothing set, so a deployment brands itself by filling that row from its profile's patch layer and restarting.

Registering no settings section is the mechanism, not an omission: the settings seam layers a user's section over a plugin's entry config, and a plugin that contributes no section has no layer above its composition value.

The split between the two index mechanisms follows what each can express. The brand object and the theme colour are structured injection rows, because rows feed both the served HTML and a static worker's boot payload. The title and the icon link are `tapIndex` transforms, because both **replace** markup the shipped index already declares and a row can only append — a second `<title>` is ignored and a second icon link is resolved by the browser rather than by the deployment.

## Alternatives considered

**Put the brand in `settings.yaml`.** It is the repository's user-facing configuration file and needs no new package. It also sits above composition, so the person using a deployment could rename the product and replace its icon. For a multi-tenant deployment that is the whole property being bought.

**Extend the build-time `LYNESS_CLIENT_*` path.** It is the mechanism upstream already uses, and the client reads those values with no server involvement. Every brand then needs its own frontend build, so a deployment script cannot change a title, and a hosted deployment serving several brands would need several artifact sets.

**Accept uploads and store assets per tenant.** It is what the requirements document asks for, and it is the only thing that gives a tenant a self-service logo. It also creates the intake route, the server-side format checks, and the cross-tenant execution surface that placing files as an operator removes entirely; the [two-tier split](../../../../.fork/BRAND-CONFIG.md) records why that trade lands where it does.

**Do the whole head through `tapIndex`.** One mechanism instead of two, and every value would then reach the served page uniformly. It also puts the brand object and the colour out of reach of the static worker form, which consumes only the structured rows — a row that can be a row should be one.

## Consequences

Assets are addressed by role, not by file name: a favicon named `logo.svg` is served as `/brand/favicon.svg`. The request therefore contributes no path segment to a filesystem read, the traversal fence has nothing to fence, and a role nothing configured is a 404 rather than a probe.

Every config error fails the load — a named asset with no directory, a relative directory, an absent file, an unserveable extension, a colour that is neither a hex triplet nor a keyword. A deployment that got its brand wrong does not start, instead of serving a page whose brand silently fell back.

Two facts still have a second home. `AppFrame` reads its in-app product title from the build-time value, so the served title and the in-app title can disagree until a client occupant reads the published brand instead. And a static worker deployment loses the title and the icon, because those are the taps.

The mark and wordmark URLs are published but nothing draws them yet; the client slot occupants are separate work, and they are what the fork's remaining brand asset task needs.
