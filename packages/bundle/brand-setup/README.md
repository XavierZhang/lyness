---
description: "The brand-setup profile: a loopback page one operator brands a deployment from, reached only through the token the command prints; for operators of private deployments and the maintainers of the brand toolchain."
kind: "package-bundle"
---

# `@lyness/lyn-brand-setup`

English | [中文](README.zh.md)

## Summary

This bundle is `lyn --profile brand-setup`, a command a private deployment's operator runs on the server to brand it from a page instead of from flags. It opens a loopback HTTP server, prints one address carrying a token, and serves a form for the product's names, its palette, and its icon; applying runs the same generation [`brand-studio`](../brand-studio/README.md) does and writes the same `brand-deployment` row. Choose it over the studio when the operator would rather see the current brand and change part of it than restate every flag. It mounts nothing that reaches a model.

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
lyn --profile brand-setup
```

The command prints the one address that reaches the page:

```text
brand-setup: open this address on this machine; it is the only way in and it ends with this process.
  http://127.0.0.1:52341/?token=M5t0_…
  writes   /home/acme/.lyn/profiles/web/cordis.patch.yml
  assets   /home/acme/.lyn/brand
```

Open it on the server, or forward the port over SSH and open it locally. The page opens on the brand the row already names, so changing one colour means changing one field. Applying writes the three SVGs and the row; a running `lyn web`, which reloads its patch layer on change, shows the new brand at once, and any other profile applies it on its next start. The process keeps serving until you stop it, and the token dies with it.

### Why a token rather than a login

The page writes a profile's patch layer, which outranks every user setting ([ordering](../../../.agents/notes/implemented/architecture/2026-08-04-configuration-source-ownership.md)), so reaching it has to mean standing where the server runs. Two things say that together: the server binds the loopback interface, and every route requires the token this process printed to its own terminal and holds only in memory. There is no stored credential, no second address, and nothing to revoke afterwards — stopping the command closes the only door. The page takes the token out of the address bar as soon as it has read it, so it reaches neither a `Referer` header nor a history entry past the address you pasted.

### Configuration

| Key | Default | Meaning |
|---|---|---|
| `target` | `web` | Profile whose patch layer receives the brand row. |
| `assetDirectory` | `$LYNESS_HOME/brand` | Absolute directory receiving the generated SVGs. |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The bundle's patch inserts [`lyn-host-webserver`](../../host/webserver/README.md) on `127.0.0.1` with port `0`, so the OS picks a free port and nothing but this machine can connect, then this plugin on top of it. Three exact routes: `/` serves the document, `/state` answers the row's current names and palette tokens, and `/apply` takes one submission. The token comparison is constant-time and length-checked first. `/apply` caps the body at the largest icon the page accepts plus its fields, parses the submission in [`src/brand-request.ts`](src/brand-request.ts), writes the uploaded PNG into a private temporary directory, and hands it to `runStudio`, which owns every brand rule; the temporary directory goes whether the run succeeded or not. A refusal the operator can act on answers 400 with its message, and anything else answers 500 and goes to the log instead, because its text is this server's business rather than the operator's.

The document in [`src/page.ts`](src/page.ts) is one self-contained string: no bundler, no client plugin roster, and no origin but its own. It carries both shipped languages inline and picks one from the browser, because an operator tool reached from a terminal cannot reach the product's locale service.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the page is not the right surface. They move from the generation it drives to the row it writes.

- [brand-studio](../brand-studio/README.md) — the same generation as one command, for scripted branding.
- [brand-deployment](../../host/brand-deployment/README.md) — the row this page writes and what a served page does with it.
- [webserver](../../host/webserver/README.md) — the loopback server this bundle mounts.
- [app-boot](../../boot/app-boot/README.md) — how `--profile` resolves the patch layer this page writes.

-----

<a id="model-experience"></a>
## Model Experience

None, as this profile mounts no model, session, or tool row; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define what the page can brand today. They are current package constraints, not a comparison with the studio or a task backlog.

- **No font upload** — the wordmark is set in the built-in fonts; a brand owner's own font file still needs `lyn --profile brand-studio --font`, which carries the licence confirmation that choice requires.
- **No preview before applying** — the page shows the written files after a run, not the artwork before one; checking the mark means opening the written SVG.
- **One operator at a time** — the token admits anyone who has it, and the page neither locks the row nor notices a second writer; two people applying at once leave whichever wrote last.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The server owns no state beyond the token it minted and the routes it registered, and both leave with the fiber.
