---
description: "The deployment's own brand over the webserver index render: browser title, favicon, theme colour, and the asset files an operator places."
kind: "package-reference"
---

# @lyness/lyn-host-brand-deployment

English | [中文](README.zh.md)

## Summary

Give one deployment its own visual identity without rebuilding the frontend. Configured values reach every index response: the product name replaces the browser title, a configured favicon replaces the shipped icon link, a brand colour becomes the browser-chrome theme colour, and the whole brand is published to the page as one `globalThis` value for in-app presentation. Asset files are placed by the operator and served from a fixed table, so no request contributes a path segment to a filesystem read and there is no upload route. A row mounted with nothing set changes no byte of the shipped index.

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

[`lyn-web-app`](../../bundle/web-app/README.md) already mounts this row with nothing set, so a deployment brands itself by filling that row from a patch layer.

### Minimal configuration

```yaml
- id: brand-deployment
  name: '@lyness/lyn-host-brand-deployment'
  config:
    productName: Acme Agent
    themeColor: '#1f6feb'
    assetDirectory: /srv/acme/brand
    favicon: favicon.svg
    mark: mark.svg
    wordmark: wordmark.svg
    showPoweredBy: false
```

`assetDirectory` is absolute and holds the three named files; the deployment script writes them there. Each file is addressed by its role, not its name: `favicon.svg` above is served as `/brand/favicon.svg`, and a wordmark named `wordmark.png` is served as `/brand/wordmark.png`. Serveable types are SVG, PNG, WebP, ICO, and JPEG.

### Why config and not user settings

Configuration resolves settings above composition ([ordering](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.md)), so a value a user can store in `settings.yaml` outranks one a profile sets. A deployment's identity must hold against the people using it, so these fields are composition config and this package registers no settings section — nothing below the composing application can reach them.

### What a browser receives

The product name replaces the first `<title>`, or adds one when the head declares none. A configured favicon replaces the first `rel="icon"` link rather than adding a second, because a browser resolves competing icon links itself. The theme colour arrives as a `<meta name="theme-color">` row. The brand object arrives as `globalThis.lynDeploymentBrand`, carrying the product name, colour, mark and wordmark URLs, and the attribution flag — absent members mean the deployment configured nothing and the page keeps its built-in presentation.

Asset responses carry their image type and `cache-control: no-cache`. The URL is stable across deployments, so a redeploy that replaces the bytes must not keep serving the old ones.

### Observable failures

Every check runs at load, so a deployment that got something wrong does not start. A named asset without `assetDirectory`, a relative `assetDirectory`, a path that is not a directory, a file that is absent or not a regular file, a file name that leaves the directory, an extension with no image type, and a `themeColor` that is neither a hex triplet nor a colour keyword each fail the row. On the route, a role nothing configured is 404 and a non-GET/HEAD request is 405.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

`apply` validates the colour, resolves the asset table once, and registers three things under effect scope: a prefix route over the asset table, a `webserver/index-inject` listener, and one `tapIndex` transform. Disposing the fiber releases all three, so the shipped index returns unchanged.

### Rows where a row suffices, a tap where it cannot

The structured injection table feeds two renderers — the served HTML and a static worker's boot payload — while `tapIndex` reaches only the first. The brand global and the theme colour are therefore rows. The title and the icon link are replacements of markup the shipped index already declares, which no row can express, so they are the tap.

### The asset table is the fence

A request never contributes a path segment to a filesystem read. `resolveAssets` builds a `role → {file, url, mime}` table at load, the handler looks the request pathname up in it, and a miss is 404. Traversal has nothing to traverse: `/brand/../logo.svg` is a pathname that names no role.

### Source map

- `src/index.ts` — the whole plugin: config schema, asset resolution, the route handler, the injection rows, and the index transform.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these when the brand contract is not enough: the render surface it writes to, then the configuration ordering that decides where these fields live.

- [Webserver](../webserver/README.md) — the injection table and index taps this plugin registers against.
- [lyn-web-app bundle](../../bundle/web-app/README.md) — the application that mounts this row.
- [Configuration source ownership](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.md) — why these fields are composition config rather than user settings.
- [Generated configuration catalog](../../../docs/config-catalog.md#lynesslyn-host-brand-deployment) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package writes browser presentation and registers nothing model-facing; no configured value reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **A static worker deployment loses the title and icon** — both are `tapIndex` replacements, and the worker form consumes only the structured rows. The brand global and the theme colour reach it.
- **No tenant layer** — one brand per deployment. Per-tenant branding would need an asset intake path and the cross-tenant checks that come with it.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. Every relation this package owns is decided at load from its own config and re-read from one table per response, so there is no second, independently observable source that could diverge from it. The register/release symmetry of the route and the tap is covered by the package's disposal test instead.
