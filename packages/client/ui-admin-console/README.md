---
description: "The administration console: its own page, its own shell, and every administration page inside it."
kind: "package-reference"
---

# @lyness/lyn-client-ui-admin-console

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-admin-console` is the administration console: a page of its own, at a path the Host answers with the application document, holding every page an administrator maintains. It takes the built-in `root` seat on that page and nothing anywhere else, so a person using the product never loads the console's chrome, and an administrator opens a URL rather than a panel inside the workbench. The pages themselves belong to their own packages and register into `admin.section`; this one owns the navigation, the header, its own sign-in page, and what the console says when a deployment composed no administration page at all.

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

Two rows: the Host answers the console's path with the document, and the console takes that page.

```yaml
- id: frontend-static
  name: '@lyness/lyn-host-frontend-static'
  config:
    documentPaths:
      - /admin
- id: ui-admin-console
  name: '@lyness/lyn-client-ui-admin-console'
  config:
    path: /admin
```

The two paths are one decision stated twice: the Host decides which paths serve a page, and `path` decides which of them is the console. A mismatch leaves the console unreachable — its page 404s, or the document renders the workbench.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It takes the page, not a panel.** `root` is a single slot: a second entry shadows the frame rather than sitting beside it. On the console's path that is the intent — the console replaces the workbench frame outright — and on every other path this plugin registers nothing, so the workbench is untouched.

**The path comes from the document.** `location.pathname` is read once, because the Host served this document at a path it chose; asking the location is reading what the Host answered, and it is also what makes the console reachable by typing its URL.

**Which pages exist is the deployment's answer.** The nav is the `admin.section` ledger, localized by each page's own registration. The console places known ids into three groups and puts anything it has never heard of in a trailing group, because a module this shell does not know is still a page an administrator must reach.

**A member is told, not shown.** The viewer service answers whether this viewer administers anything; a member who reaches the console's URL gets a line saying the page is for administrators instead of a nav whose every call would be refused. The refusals themselves stay with the calls: this decides what is offered and never what is permitted.

**Somebody holding two standings is asked, not guessed at.** A sign-in puts a single standing in force; a person who holds several starts in none, because which organization they are acting for is their decision. The console asks that question on a page of its own — every page behind it would refuse a call acting in no standing — and once one is in force the column offers the others, so switching is one click rather than a sign-out.

**It has a sign-in page of its own.** A deployment with accounts and nobody signed in gets that page and nothing behind it, with one link per channel a browser can begin — a self-driven channel completes in the process that owns the browser, so a page cannot offer it. The workbench's covering overlay is not reused: `shell.overlay` is declared by the frame this console shadows, and a second declaration fails that frame's activation.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-host-frontend-static`](../../host/frontend-static/README.md) — answers the console's path with the document.
- [`lyn-client-ui-settings`](../ui-settings/README.md) — types `admin.section` and the owner share a page receives.
- [`lyn-client-ui-viewer`](../ui-viewer/README.md) — the one read answering who is viewing.
- [`lyn-client-ui-layout`](../ui-layout/README.md) — the workbench frame this console shadows on its own page.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a browser surface over Remote namespaces other packages own.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One graph, two pages** — the browser loads the same client plugin set on both pages, so the console's code reaches a person who never opens it. Scoping the boot graph per page is the next step; the authority checks are server-side and unaffected.
- **No deep links into a page** — the console keeps the selected page per browser rather than in the URL, so an administrator cannot send a colleague a link to one page.
- **The groups are this shell's** — a module whose page id this package does not list appears in a trailing group rather than where its author would put it.
- **No console navigation on a phone** — the column stacks above the content, which is readable but is not a navigation pattern designed for a small screen.
- **No toasts on the console** — a page that reports through `shell.overlay` has nowhere to report here, because that seat belongs to the workbench frame. A console-owned overlay is the fix when a page needs one.

**Runtime invariant:** the console registers nothing at all unless the document was served at its configured path.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The viewer service is read with `ctx.get` rather than declared in `inject`, so a single-operator composition — no accounts, no viewer service — still opens the console and names nobody.

</details>
