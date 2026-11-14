# Agent Note: Wordmarks are typeset with fontkit

Status: implemented

English | [中文](2026-09-15-wordmark-typesetting-with-fontkit.zh.md)

## Problem

A private deployment's wordmark is its product name in a typeface. An image model cannot produce one reliably: it misspells letters, does worse with Chinese, and gives a different result on every run, so each generated wordmark needs a person to check every character. Setting the name in a font renders exactly the characters it is given, every time.

That needs an engine that reads the formats open fonts are distributed in — WOFF and WOFF2 as well as TTF and OTF — and applies the font's substitution and kerning tables, because a name set without them is visibly worse than the typeface it came from.

## Decision

`@lyness/lyn-host-brand-wordmark` typesets a name with fontkit into one `currentColor` path inside a box as high as the sidebar brand row, and refuses a name or font that cannot produce a usable wordmark with a stable code. It is a library: the brand tooling calls it, and its result is the `wordmark` file that brand-deployment serves.

The box height is the font's line box rather than the name's ink, so names set in one font show letters of the same size whether or not they have ascenders or descenders. The width limit is the sidebar's: at its narrowest the brand row leaves room for 7:1.

No font ships with the package. The caller supplies a list of font files in preference order, and each character is set in the first font that draws it, so one name can mix scripts no single font covers. The platform's own pair lives in [`lyn-host-brand-fonts`](2026-09-16-built-in-wordmark-fonts.md); a deployment that wants another typeface passes its own file instead.

## Alternatives considered

**opentype.js.** MIT, actively published, and the most familiar JavaScript font library. Version 2.0.0 fails to parse Inter from `@fontsource/inter`: the WOFF file stops at an unsupported chained-context substitution (lookup type 6, format 2), and WOFF2 requires a separate decompressor. Modern open fonts commonly carry those tables, so the failure would recur with the typefaces a deployment is most likely to choose.

**harfbuzzjs.** HarfBuzz is the reference shaping engine, and the package is actively maintained with bundled types. Given the same WOFF and WOFF2 files it loaded no font — every glyph id was zero and the face reported the default 1000 units per em rather than Inter's 2048 — because it reads raw TTF and OTF only. Using it would mean decompressing web fonts ourselves or limiting deployments to desktop font files.

**Generate the wordmark with the image model the brand tooling already calls.** One pipeline for the mark and the wordmark. It keeps the misspelling this package exists to remove, and every generated wordmark would need the same character-by-character review.

**Bundle a Chinese font in this package.** A deployment would need no font of its own for a Chinese name. Font files belong to a package that ships files, not to the typesetter; `lyn-host-brand-fonts` holds them, and this package stays a library over whatever fonts a caller passes.

## Consequences

fontkit has had no commit since August 2024. It is widely depended on — about 9.7 million downloads a week in September 2026 — and `@types/fontkit` was updated in 2026, but a parser defect in some font would have no upstream fix. Replacing the engine means rewriting `openFont` and the glyph loop, which is most of the module.

The tests depend on `@fontsource/inter` (SIL OFL) as a fixture, so the behaviour they assert is measured against a real modern font rather than a synthetic one. A font collection is refused before layout; the test builds a collection header instead of shipping a collection file.

Coordinates are rounded to two decimals, which keeps documents small and makes the output byte-identical for the same input; in a 24-unit box that is far below a device pixel.
