---
description: "Typesets a brand name across supplied fonts into a single-colour SVG wordmark sized for the Web shell's sidebar brand row."
kind: "package-reference"
---

# @lyness/lyn-host-brand-wordmark

English | [中文](README.zh.md)

## Summary

Turn a brand name and a list of font files into the wordmark the Web shell draws beside its mark. `typesetWordmark` sets each character in the first font that draws it, shapes each run with that font's kerning and substitutions, converts the glyphs into one path filled with `currentColor`, and sizes the result for the 24px sidebar brand row. The document holds no text element and no font reference, so it renders identically wherever it is served. A name or font that cannot produce a usable wordmark is refused with a stable code.

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

This is a library, not a plugin: it registers nothing and reads no configuration. A private deployment's brand tooling calls it and writes the returned document as the `wordmark` file that [`brand-deployment`](../brand-deployment/README.md) serves.

### Minimal use

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { typesetWordmark } from '@lyness/lyn-host-brand-wordmark'

const font = new Uint8Array(await readFile('/srv/acme/fonts/AcmeSans-Bold.otf'))
const mark = typesetWordmark('acme', [font])
await writeFile('/srv/acme/brand/wordmark.svg', mark.svg)
```

Each font is one OpenType file: TTF, OTF, WOFF, or WOFF2. The list is a preference order, so a Latin font before a CJK font sets a name mixing both scripts whole; [`brand-fonts`](../brand-fonts/README.md) holds the platform's built-in pair. Supply fonts whose licenses permit converting their glyphs into artwork; SIL OFL fonts do. Nothing here reaches a browser: the fonts are read on the host and the wordmark ships as outlines.

### What the document guarantees

- One `<svg>` element holding one `<path>` filled with `currentColor`, so the embedding surface chooses the colour and a light or dark theme follows it.
- A coordinate box exactly `WORDMARK_HEIGHT` (24) high, whose `width`, `height`, and `viewBox` agree, so the document displays at its intrinsic size without CSS.
- Coordinates with at most two decimals; the same name and font always produce the same document.

The box height is the line box of the fonts the name uses — the highest ascent to the lowest descent, widened to any ink that overflows it — so every name set in the same fonts shows letters of the same size whether or not it has ascenders or descenders. The width is the ink of the shaped runs.

### Refusals

Every refusal is a `WordmarkError` whose `code` a caller can branch on:

| `code` | Cause |
|---|---|
| `CONTROL_CHARACTER` | The name holds a line break or control character. |
| `UNREADABLE_FONT` | The bytes are not a font file fontkit can read; the message names which font. |
| `FONT_COLLECTION` | One file holds several fonts; supply single fonts. |
| `MISSING_GLYPH` | No font in the list draws some character; the message names each one. |
| `NO_VISIBLE_GLYPH` | The name is empty, or only spaces and invisible characters. |
| `TOO_WIDE` | The wordmark is wider than `WORDMARK_MAX_ASPECT` (7:1), which the narrowest sidebar clips. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

`typesetWordmark` rejects a name holding a control character, opens each font, assigns every grapheme cluster to the first font that draws it — whitespace stays in the run before it — and lays out each run with fontkit. Geometry is computed in ems so fonts with different units per em share one scale, which comes from the line box of the fonts the name uses. It transforms each glyph outline by that scale and its position with the y axis flipped, joins the outlines into one path, and rounds every number.

### Why fontkit

The engine has to read the formats open fonts are distributed in and apply the font's substitution tables. fontkit reads TTF, OTF, WOFF, and WOFF2 and lays out with kerning and substitution. The alternatives measured against the same font are recorded in the [decision note](../../../.agents/notes/implemented/architecture/2026-09-15-wordmark-typesetting-with-fontkit.md).

### Source map

- `src/index.ts` — the whole library: constants, the error type, font opening, and typesetting.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these for where a wordmark goes and why it is typeset rather than generated.

- [brand-deployment](../brand-deployment/README.md) — serves the wordmark file and publishes its URL to the page.
- [Wordmark typesetting decision](../../../.agents/notes/implemented/architecture/2026-09-15-wordmark-typesetting-with-fontkit.md) — the engine choice and the alternatives measured.

-----

<a id="model-experience"></a>
## Model Experience

None, as this library turns a name and a font into artwork and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **No font ships with the package** — fonts run to megabytes per weight, so the caller supplies them; [`brand-fonts`](../brand-fonts/README.md) is where the platform's own live.
- **Kerning stops at a font change** — each run is shaped by its own font, so a pair of letters split across two fonts is set without kerning between them.
- **One line, one direction** — the runs are placed left to right; a right-to-left or vertically set name is outside what this produces.
- **Variable font axes are not selected** — a variable font lays out at its default instance.
- **Single colour only** — the document has one path in `currentColor`; a two-tone wordmark is outside what it produces.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The library holds no state and registers nothing, so there is no owned relationship an independent observation could contradict.
