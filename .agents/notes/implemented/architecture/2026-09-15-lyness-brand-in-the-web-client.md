# Agent Note: The Web client draws the lyness brand and yields it to a deployment brand

Status: implemented

English | [中文](2026-09-15-lyness-brand-in-the-web-client.zh.md)

## Problem

The Web client still drew the DeepSeek whale. The sidebar mark and the conversation hero fall back to the whale when no package occupies their slots, and the only occupant, `@lyness/lyn-client-ui-brand-official`, registers only in `official` builds and draws the whale too. A private deployment that configured its own brand through `@lyness/lyn-host-brand-deployment` got its title and favicon replaced in the served HTML, but the client then drew the whale in the sidebar, and `AppFrame` overwrote the browser title with the build-time `LYNESS_CLIENT_TITLE`. The favicons, the documentation site's wordmark, and the powered-by badge also carried the whale.

## Decision

`@lyness/lyn-client-ui-brand-lyness` occupies `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` in every build, and the Web application bundle mounts it in place of `ui-brand-official`. Its artwork is path data produced by this fork's own toolchain: `lyn-brand-icon` traced the mark from the lyness icon PNG, and `lyn-brand-wordmark` typeset the wordmark in Inter SemiBold. Both fill with `currentColor`.

Each occupant reads `globalThis.lynDeploymentBrand` when it renders and lets the deployment replace the lyness artwork member by member: a mark URL replaces both marks, and the name shows a wordmark URL, else the product name as text, else the lyness wordmark. The global is script-assigned page data, so each member is checked: a non-string or empty member, and a URL that is not a path on the page's own origin, read as absent. `AppFrame` prefers the deployment product name over `LYNESS_CLIENT_TITLE` under the same check.

The favicons, the documentation site's lockup, and the badge PNG are replaced in place. The Shields.io badge drops its logo parameters through a new rebrand rule, `shields-logo`, because Simple Icons has no lyness logo.

## Alternatives considered

**Redraw the whale components in `lyn-client-ui-primitives`.** Every fallback would change with no new package. Those components are upstream files, so each upstream sync would conflict on them, and the official package would keep drawing whatever upstream ships next.

**Gate the occupants on the build profile, as `ui-brand-official` does.** Development builds would keep the sidebar's build-version label. They would also keep the whale, which is the artwork this change removes, and a deployment brand would not reach a development build.

**Fetch the deployment brand over RPC.** The client would not depend on a page global. The brand is already in the page before the client boots, so a request would add a loading state and a failure path for data the page carries.

**Keep `ui-brand-official` mounted beside the new package.** The official package would still serve `official` builds. The brand slots are single-occupant, so two packages would race and the later registration would win.

## Consequences

The sidebar no longer shows the build-version label in development builds, because the name slot is occupied in every build.

`ui-brand-official` stays in the tree, unmounted, so upstream changes to it still merge cleanly.

Four kinds of upstream files now differ from upstream: `AppFrame.tsx` and its test, the Web application bundle's roster, the replaced image files, and the badge test's pinned hash. The merge method resets the tree to upstream before restoring fork files, so the image files and the hash must be restored after each sync; `CUSTOM.md` lists them.

A rebrand rule can now delete text. `--reverse` skips such a rule, because an empty search string would match between every character.
