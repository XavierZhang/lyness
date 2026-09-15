# Agent Note: brand-studio is a standalone profile that edits a patch layer

Status: implemented

English | [中文](2026-09-15-brand-studio-profile.zh.md)

## Problem

A private deployment brands itself through the `brand-deployment` row: an asset directory holding a mark, a wordmark, and a favicon, and a patch layer that names them. Producing those inputs by hand means writing SVG that passes the brand grammar and YAML that the Loader accepts. The tracer and the typesetter already exist as libraries, but nothing an operator can run connects them to the row. The repository admits Node applications only as `lyn` profiles, so a standalone script or package bin is not an option.

## Decision

`@lyness/lyn-brand-studio` is a bundle, launched as `lyn --profile brand-studio`, whose patch inserts one row and does not layer over `lyn-base`. The row parses the launcher's arguments with commander, runs once, and requests exit through `ctx.appExit`. It takes the product name, the icon PNG, the font file, an optional theme colour, an asset directory, and a target profile as flags, and it refuses to run without `--accept-trademark`.

A run validates the colour, traces the icon, typesets the name, checks each SVG with `isBrandSvg`, and composes the new patch layer before it writes anything. It then writes the three SVGs, and only then the layer, so `lyn web`, which reloads its layer on change, never reads a row that names a missing file. The layer it edits is the target profile's own, `web` by default; a shipped profile that has never launched is initialized first, as its first launch would do. The layer is edited through the `yaml` document model, setting the keys the studio owns on every `brand-deployment` row and leaving other keys, rows, comments, and `!!js` values in place.

The operator supplies the font. The typesetting decision already required a caller-supplied font, and shipping one would conflict with the repository's runtime license gate, which admits no SIL OFL font.

## Alternatives considered

**Write the row to the home patch layer.** One file would brand every profile. It also patches `brand-studio` itself and every profile without a `brand-deployment` row, and each of those logs that the target row is missing on every start.

**Parse and dump the layer with js-yaml.** The Loader already reads layers with it, and it keeps `!!js` tags. It drops comments, so an operator's notes in the layer would disappear on the first run.

**Prompt for missing inputs.** A guided prompt is friendlier on first use. The repository has no terminal prompt code, and flags alone keep the command scriptable and testable through a real launch.

**Ship Inter as a runtime dependency for a preset font list.** An operator would not need a font file. `scripts/gen-third-party-notices.ts` refuses a non-permissive runtime license, and adding OFL to its list or a named exception changes a repository-wide distribution policy rather than this package.

**A settings page in the Web application.** It would need no server access. A deployment's identity is not something the application's users may change, which is the same reason the brand is not in `settings.yaml`.

## Consequences

`PROFILE_TEMPLATES` in `lyn-app-boot` gains a `brand-studio` entry and `apps/cli` depends on the bundle, so the shipped-profile tests and the application list in `docs/architecture.md` name it too.

`lyn-host-brand-deployment` exports `isBrandColour`, so the studio refuses a colour the deployment would refuse at load, before any file is written.

Re-serializing a layer can normalize the quoting and blank lines of rows the studio does not touch.

The AI-generation path, interactive prompts, and a preset font list remain open; the first needs an image-generation capability.
