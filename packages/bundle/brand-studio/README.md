---
description: "The brand-studio profile: generate a deployment brand from an icon PNG and a font and apply it to a profile; for operators of private deployments and the maintainers of the brand toolchain."
kind: "package-bundle"
---

# `@lyness/lyn-brand-studio`

English | [中文](README.zh.md)

## Summary

This bundle is `lyn --profile brand-studio`, a one-shot command a private deployment's operator runs on the server. It traces an icon PNG into the mark and favicon SVGs, typesets the product name in a font the operator supplies, writes the three files, and points the `brand-deployment` row of a profile's patch layer at them. Choose it to brand a deployment without hand-writing SVG or patch YAML. It mounts nothing that reaches a model.

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

```sh
lyn --profile brand-studio --name Acme --icon ./acme.png --font ./Inter-SemiBold.ttf \
  --theme-color '#1a73e8' --accept-trademark --accept-font-license
```

`--name`, `--icon`, `--font`, `--accept-trademark`, and `--accept-font-license` are required. The icon is a PNG at least 1024 pixels a side with a dark mark on a light or transparent background; `lyn-host-brand-icon` refuses anything else and names the reason. The font is a TTF, OTF, WOFF, or WOFF2 file that covers every character of the name, and the operator's license for it must permit using its glyphs in a logo. The studio reads the font on the operator's server but neither copies nor distributes it, and the wordmark it writes is outline artwork, not font software. `--theme-color` takes a hex colour or a colour keyword; without it, a colour the row already names stays.

### What it writes

The three SVGs go to `--asset-dir`, which defaults to `$LYNESS_HOME/brand`, as `mark.svg`, `wordmark.svg`, and `favicon.svg`. The brand row goes to the patch layer of `--target`, which defaults to `web`: `$LYNESS_HOME/profiles/web/cordis.patch.yml`. A shipped profile that has never launched is initialized first, exactly as its first launch would. The row sets `productName`, `themeColor`, `assetDirectory`, and the three file names; other config keys such as `showPoweredBy`, other rows, comments, and `!!js` values stay as written.

Every input is checked, and the new layer is composed, before anything is written. The SVGs are written before the layer, so `lyn web`, which reloads its patch layer on change, applies the brand immediately and never reads a row naming a missing file. Another profile applies it on its next start.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The bundle's patch inserts one row and does not layer over `lyn-base`, so the tree loads no model, session, or Web plugin. [`src/index.ts`](src/index.ts) parses the launcher's arguments with commander through `parseCmdline`, runs once, and requests exit through `ctx.appExit`: 0 after a report on stdout, 1 after the error on stderr. [`src/studio.ts`](src/studio.ts) holds the run. Each generated SVG must pass `isBrandSvg` before it is written. The layer is edited through the `yaml` document model, which keeps comments and unresolved `!!js` tags that a plain parse and dump would lose, and each file is replaced with `writeFileAtomic`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages to follow a brand from this command to the browser.

- [brand-icon](../../host/brand-icon/README.md) — traces the PNG and defines the brand SVG grammar.
- [brand-wordmark](../../host/brand-wordmark/README.md) — typesets the name and refuses fonts and names it cannot set.
- [brand-deployment](../../host/brand-deployment/README.md) — serves the written files and injects the brand into the page.
- [ui-brand-lyness](../../client/ui-brand-lyness/README.md) — draws the deployment brand in the Web client.

-----

<a id="model-experience"></a>
## Model Experience

None, as the bundle is an operator command whose tree mounts no model-facing plugin; nothing here reaches a model request.

#### KV Cache effect

None; this bundle neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These are current constraints, not a task backlog.

- **Flags only** — every input is a command-line flag; the command does not prompt for a missing one.
- **Upload path only** — generating the icon with an image model needs an image-generation capability the repository does not have yet.
- **No built-in font yet** — the operator must supply a font; the platform's built-in multilingual fonts, which would make `--font` optional, are not bundled yet.
- **One brand per profile** — the row is deployment-wide; there is no tenant layer.
- **The layer is re-serialized** — comments and `!!js` values survive, but quoting and blank lines in other rows may be normalized.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The plugin runs once and requests exit; it retains no state that an independent observation could contradict.
