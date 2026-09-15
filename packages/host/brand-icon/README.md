---
description: "Turns a brand icon PNG into the single-colour SVG icon and square favicon a deployment serves, and checks brand SVGs against the form this toolchain writes."
kind: "package-reference"
---

# @lyness/lyn-host-brand-icon

English | [中文](README.zh.md)

## Summary

Turn an icon PNG, uploaded by an operator or drawn by an image model, into the icon and favicon a deployment serves. `vectorizeIcon` flattens the PNG onto white, separates ink from background by brightness, crops to the ink, and traces it into paths. It returns a tight `currentColor` icon and a square favicon that turns white under a dark colour scheme. `isBrandSvg` confirms a document is exactly the form this toolchain writes. An image that cannot make a usable icon is refused with a stable code.

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

This is a library, not a plugin: it registers nothing and reads no configuration. A private deployment's brand tooling calls it and writes the two documents as the `mark` and `favicon` files that [`brand-deployment`](../brand-deployment/README.md) serves.

### Minimal use

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { isBrandSvg, vectorizeIcon } from '@lyness/lyn-host-brand-icon'

const traced = vectorizeIcon(new Uint8Array(await readFile('/srv/acme/upload/icon.png')))
for (const [name, svg] of [['mark.svg', traced.icon], ['favicon.svg', traced.favicon]] as const) {
  if (!isBrandSvg(svg)) throw new Error(`${name} is not a brand SVG`)
  await writeFile(`/srv/acme/brand/${name}`, svg)
}
```

### What the input must be

- A PNG between 1024 and 4096 pixels on each side. The size is read from the header, so an oversized file is refused before any pixel is decoded.
- A dark mark on a white or transparent background. After flattening onto white, a pixel darker than mid-grey is ink; colour is discarded.
- Ink between 1:1 and 1.4:1, width over height, measured without the blank space around it.

### What the documents guarantee

- The icon holds only `<path>` elements filled with `currentColor`, in a box exactly the ink's width and height in source pixels, with no margin.
- The favicon is square. The mark is centred, its longer edge spans 96% of the side as in the Web shell's own favicon, and it is black, turning white under `prefers-color-scheme: dark` because a browser tab strip follows the browser theme.
- Coordinates have at most two decimals, and the same PNG always produces the same documents. Both documents pass `isBrandSvg`.

### `isBrandSvg`

It accepts exactly the documents the icon and wordmark packages write: an `<svg>` whose `width` and `height` match its `viewBox`, filled with `currentColor` or black, an optional fixed dark-scheme rule, and one or more paths whose data holds only move, line, curve, and close commands. Any other element, attribute, comment, XML declaration, entity, or reference fails. A wordmark from [`brand-wordmark`](../brand-wordmark/README.md) passes as well.

### Refusals

Every refusal is an `IconError` whose `code` a caller can branch on:

| `code` | Cause |
|---|---|
| `NOT_PNG` | The bytes do not open with a PNG signature and header. |
| `TOO_SMALL` | A side is under 1024 pixels. |
| `TOO_LARGE` | A side is over 4096 pixels. |
| `UNREADABLE_PNG` | The pixel data cannot be decoded. |
| `NO_INK` | Nothing is dark enough to be ink, or the ink is too small to trace. |
| `DARK_BACKGROUND` | All four corners are dark. |
| `TOO_TALL` | The ink is taller than it is wide. |
| `TOO_WIDE` | The ink is wider than 1.4:1. |
| `TOO_COMPLEX` | The ink traces to more than 64 separate shapes. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

`vectorizeIcon` reads the width and height from the PNG header, decodes the pixels with `@neplex/vectorizer`, and builds an ink mask by flattening each pixel onto white and comparing its brightness with mid-grey. It copies the ink onto a white canvas with a 16-pixel margin, traces that canvas with the tracer's black-and-white preset, and moves each shape's traced offset into its coordinates. The icon places the shapes at the ink's corner; the favicon offsets them to the centre of its square. Both documents are checked with `isBrandSvg` before they are returned.

### Why this tracer

It decodes PNG and traces raw pixels in one MIT-licensed dependency, with prebuilt binaries for macOS, Linux, and Windows. The alternatives weighed are recorded in the [decision note](../../../.agents/notes/implemented/architecture/2026-09-15-brand-icon-from-png.md).

### Source map

- `src/index.ts` — the whole library: bounds, the error type, header reading, ink detection, tracing, and the brand SVG check.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these for where the documents go and why the icon enters as a PNG.

- [brand-deployment](../brand-deployment/README.md) — serves the icon and favicon files.
- [brand-wordmark](../brand-wordmark/README.md) — writes the wordmark that `isBrandSvg` also accepts.
- [Brand icon decision](../../../.agents/notes/implemented/architecture/2026-09-15-brand-icon-from-png.md) — why every brand SVG is written by this toolchain.

-----

<a id="model-experience"></a>
## Model Experience

None, as this library turns an image into artwork and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **One colour only** — a multi-colour logo becomes a single colour, and a light-coloured mark on white is refused as having no ink.
- **Vector originals are re-traced** — an operator who has an SVG exports a PNG first, and the traced paths are less precise than the original.
- **Corners decide the background** — a mark that fills all four corners is refused as a dark background.
- **Native module** — tracing runs in a prebuilt native addon, so a platform without a published binary cannot load this package.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The library holds no state and registers nothing, so there is no owned relationship an independent observation could contradict.
