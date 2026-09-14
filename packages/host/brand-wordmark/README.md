---
description: "Typesets a brand name in a supplied font into a single-colour SVG wordmark sized for the Web shell's sidebar brand row."
kind: "package-reference"
---

# @lyness/lyn-host-brand-wordmark

English | [中文](README.zh.md)

## Summary

Turn a brand name and a font file into the wordmark the Web shell draws beside its mark. `typesetWordmark` shapes the name with the font's kerning and substitutions, converts the glyphs into one path filled with `currentColor`, and sizes the result for the 24px sidebar brand row. The document holds no text element and no font reference, so it renders identically wherever it is served. A name or font that cannot produce a usable wordmark is refused with a stable code.

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

const font = new Uint8Array(await readFile('/srv/acme/fonts/Inter-SemiBold.woff2'))
const mark = typesetWordmark('acme', font)
await writeFile('/srv/acme/brand/wordmark.svg', mark.svg)
```

The font is one OpenType file: TTF, OTF, WOFF, or WOFF2. Supply a font whose license permits converting its glyphs into artwork; SIL OFL fonts do.

### What the document guarantees

- One `<svg>` element holding one `<path>` filled with `currentColor`, so the embedding surface chooses the colour and a light or dark theme follows it.
- A coordinate box exactly `WORDMARK_HEIGHT` (24) high, whose `width`, `height`, and `viewBox` agree, so the document displays at its intrinsic size without CSS.
- Coordinates with at most two decimals; the same name and font always produce the same document.

The box height is the font's line box — ascent to descent, widened to any ink that overflows it — so every name set in one font shows letters of the same size whether or not it has ascenders or descenders. The width is the ink of the shaped run.

### Refusals

Every refusal is a `WordmarkError` whose `code` a caller can branch on:

| `code` | Cause |
|---|---|
| `CONTROL_CHARACTER` | The name holds a line break or control character. |
| `UNREADABLE_FONT` | The bytes are not a font file fontkit can read. |
| `FONT_COLLECTION` | The file holds several fonts; supply one. |
| `MISSING_GLYPH` | The font lacks a glyph for a character; the message names each one. |
| `NO_VISIBLE_GLYPH` | The name is empty, or only spaces and invisible characters. |
| `TOO_WIDE` | The wordmark is wider than `WORDMARK_MAX_ASPECT` (7:1), which the narrowest sidebar clips. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Design concept

`typesetWordmark` rejects a name holding a control character, opens the font, checks that every character has a glyph, and lays out the run with fontkit. It derives one scale from the line box, transforms each glyph outline by that scale and its run position with the y axis flipped, joins the outlines into one path, and rounds every number.

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

- **No font ships with the package** — Chinese fonts run to megabytes per weight, so every caller supplies its font file, Latin or Chinese.
- **One font per wordmark** — a name whose characters are not all in one font, such as Chinese characters set in a Latin font, is refused rather than mixed.
- **Variable font axes are not selected** — a variable font lays out at its default instance.
- **Single colour only** — the document has one path in `currentColor`; a two-tone wordmark is outside what it produces.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The library holds no state and registers nothing, so there is no owned relationship an independent observation could contradict.
