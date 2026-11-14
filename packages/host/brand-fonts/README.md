---
description: "The platform's built-in wordmark fonts, Inter SemiBold and Noto Sans CJK SC Medium, in fallback order under the SIL Open Font License; for brand tooling callers and maintainers."
kind: "package-reference"
---

# @lyness/lyn-host-brand-fonts

English | [中文](README.zh.md)

## Summary

The fonts the platform typesets a wordmark in when a brand supplies none of its own. They serve the brand wordmark only: the files are read on the host, and the wordmark ships as outlines, so no font reaches a browser. `loadBrandFonts` returns Inter SemiBold and Noto Sans CJK SC Medium in fallback order, ready for `typesetWordmark`, which sets each character in the first font that draws it. Together they draw English and other Latin-script names, Greek, Cyrillic, Chinese, Japanese, and Korean. Both files ship unmodified under the SIL Open Font License 1.1, with their license texts beside them.

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

This is a library, not a plugin: it registers nothing and reads no configuration.

```ts
import { loadBrandFonts } from '@lyness/lyn-host-brand-fonts'
import { typesetWordmark } from '@lyness/lyn-host-brand-wordmark'

const mark = typesetWordmark('领驭 lyness', loadBrandFonts())
```

| Font | Scripts the platform relies on it for |
|---|---|
| Inter SemiBold 4.1 | Latin, including English and Vietnamese; Greek; Cyrillic |
| Noto Sans CJK SC Medium 2.004 | Chinese; Japanese kana and kanji; Korean Hangul |

Inter comes first, so Latin letters keep Inter's shapes although Noto Sans CJK also draws them. The two weights were chosen so their strokes look alike when a name mixes scripts.

SaaS tenants use these fonts only. A private deployment's brand owner may supply its own font instead, through `lyn --profile brand-studio --font`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`fonts/` holds the two font files and their license texts, taken unmodified from the upstream releases. [`third-party-assets.json`](third-party-assets.json) records each file's name, version, license, license file, source release, and SHA-256. `scripts/gen-third-party-notices.ts` reads every package's record, verifies each checksum and license, refuses a font file no record names, and lists the files in `THIRD_PARTY_NOTICES.md`. [`src/index.ts`](src/index.ts) exposes the files as `BRAND_FONTS` and reads them with `loadBrandFonts`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [brand-wordmark](../brand-wordmark/README.md) — typesets a name across these fonts.
- [brand-studio](../../bundle/brand-studio/README.md) — uses these fonts when the operator supplies none.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package ships font files for artwork and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints, not a task backlog.

- **One regional glyph style for Han characters** — kanji and traditional characters are drawn with Simplified Chinese shapes, which differ in details from Japanese, Traditional Chinese, and Korean conventions.
- **Right-to-left and complex scripts are not covered** — Arabic, Hebrew, Thai, and Devanagari names are refused until a font and typesetting for them are verified.
- **One weight** — every built-in wordmark is SemiBold Latin with Medium CJK.
- **Package size** — the Noto Sans CJK file is 16.5 MB.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Replace a font only with an unmodified upstream release, and update its version, source, and SHA-256 in `third-party-assets.json` in the same change.

</details>

**Runtime invariant:** No companion is published. The package holds no state and registers nothing, so there is no owned relationship an independent observation could contradict.
