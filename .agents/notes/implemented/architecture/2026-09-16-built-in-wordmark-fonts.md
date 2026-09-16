# Agent Note: The platform ships the fonts its wordmarks are set in

Status: implemented

English | [中文](2026-09-16-built-in-wordmark-fonts.zh.md)

## Problem

Typesetting a wordmark needed a font file from the caller, so brand-studio could not run without one and a SaaS tenant, which uploads no files, could never have a wordmark at all. A name also has to set whole in whatever language a customer brands in: no single font covers Latin, Greek, Cyrillic, and CJK, and the typesetter refused a name whose characters were not all in one font.

Bundling fonts ran into the repository's license policy. `scripts/gen-third-party-notices.ts` admits no non-permissive runtime npm dependency, and the SIL Open Font License is not in its permissive set. It also had no place at all for a third-party file committed inside a package: it discloses npm dependencies, vendored packages, Python requirements, and pnpm patches, and a font file is none of those.

## Decision

`@lyness/lyn-host-brand-fonts` ships two font files unmodified under OFL-1.1 — Inter SemiBold 4.1 and Noto Sans CJK SC Medium 2.004 — with their license texts beside them, and exposes them in fallback order. They serve the brand wordmark only: the files are read on the host, and a wordmark ships as outlines, so no font reaches a browser and the platform distributes no font as a web asset.

`typesetWordmark` now takes a list of fonts. It assigns each grapheme cluster to the first font that draws it, keeps whitespace in the run before it, and computes geometry in ems so fonts with different units per em share one scale. Inter comes first, so Latin letters keep Inter's shapes although Noto Sans CJK draws them too. `brand-studio` uses the built-in fonts when the operator passes no `--font`.

Disclosure runs on a new mechanism rather than an exception to the npm one: a package records each committed third-party file in `third-party-assets.json`, and the generator verifies every record — the file and its license text exist, the file still matches its SHA-256, and its license is permissive or OFL-1.1 for a font — refuses any font file no record names, and lists them in `THIRD_PARTY_NOTICES.md`.

## Alternatives considered

**Depend on the `@fontsource` packages.** They are npm packages, so the existing disclosure and an exact-identity license authorization would cover them. Their CJK packages unpack to 75–80MB each and slice every weight into about a hundred unicode-range files; Simplified and Traditional Chinese, Japanese, and Korean together exceed 270MB, against 16.5MB for one Noto Sans CJK file that draws all of them.

**Subset the CJK font to the characters brands are likely to use.** The file would shrink by an order of magnitude. A subset is a modified font: it must be renamed if the license reserves the name, and it would refuse a customer whose name happens to use a character outside the subset — the failure this change exists to remove.

**Set Latin in Noto Sans CJK as well, and ship one file.** No second font, no fallback. Its Latin is a different typeface from Inter, which the lyness wordmark and the shell's own type already use, so every Latin wordmark would change shape.

**Ship a regional CJK font per language.** Japanese kanji and Traditional Chinese would carry their own glyph conventions. That is four files of about 16MB for a difference in the shapes of some characters, which a brand that needs it can supply with `--font`.

**Add OFL-1.1 to the permissive license set.** One line in the generator. It would relabel a license the upstream policy deliberately excludes, for every dependency rather than for the files we actually ship, and the fonts here are not npm dependencies at all.

## Consequences

The repository carries 17MB of font files, and every published copy of `lyn-host-brand-fonts` carries them too.

Han characters are drawn in Simplified Chinese shapes, so a Japanese or Traditional Chinese name is legible but not in its own regional convention. Arabic, Hebrew, Thai, and Devanagari names are still refused; they need a font and verified right-to-left or complex-script typesetting.

Kerning stops at a font change, and a wordmark mixing scripts takes the tallest line box among the fonts it uses, so its Latin letters sit slightly smaller than in an all-Latin wordmark.

`scripts/gen-third-party-notices.ts` and the pre-commit glob in `lefthook.yml` are upstream files this fork now changes; `CUSTOM.md` records them. Replacing a font means recording a new version, source, and checksum in the same change.
