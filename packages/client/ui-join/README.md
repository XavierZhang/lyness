---
description: "The page an invitation link opens: what it admits somebody to, and the directories that redeem it."
kind: "package-reference"
---

# @lyness/lyn-client-ui-join

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-join` is the page an invitation link opens. It takes the built-in `root` seat on its own path and nothing anywhere else, because whoever follows such a link has no account here yet and the workbench would be a product they cannot use. It reads the code from its own query string, offers one link per directory a browser can begin — each already carrying the code — and asks the deployment nothing about the code itself. Three visits get a message instead: a link with no code, a deployment with no accounts, and somebody already signed in.

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

Two rows, and a third that must agree with them:

```yaml
- id: web-runtime
  name: '@lyness/lyn-web-app'
  config:
    documentPaths:
      - /join
- id: ui-join
  name: '@lyness/lyn-client-ui-join'
  config:
    path: /join
- id: ui-admin-invitations
  name: '@lyness/lyn-client-ui-admin-invitations'
  config:
    joinPath: /join
```

One decision stated three times: the Host decides which paths serve a page, `path` decides which of them carries an invitation, and `joinPath` is what the administration page builds its links with. A mismatch leaves the link at a path that 404s or renders the workbench.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**It asks nothing about the code.** The page never calls the deployment, so there is no answer here to the question "does this code exist" — a page anybody can open must not answer it. The sign-in it sends the browser to is where the code is presented, and a refusal there reads as every unadmitted subject does.

**The code reaches only the links.** It is read from `location.search` once and encoded into each channel's href; nothing writes it anywhere, and the sign-in route is what puts it in a short-lived cookie for the round trip to the directory.

**Only the directories a browser can begin.** A self-driven channel completes in the process that owns the browser, so a page cannot start it; offering it would be a link that does nothing.

**Three visits have nothing to redeem.** A link with no code, a deployment with no accounts — which serves the person at its keyboard and has nobody to admit — and somebody already signed in, whom the roster already knows. Each gets its own message rather than a page of links that cannot work.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-client-ui-admin-invitations`](../ui-admin-invitations/README.md) — where the link this page answers is built.
- [`lyn-invitations`](../../identity/invitations/README.md) — the bounds a redemption is checked against.
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.md) — the route that carries the code across the directory round trip.
- [`lyn-host-frontend-static`](../../host/frontend-static/README.md) — what makes this path serve a page at all.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it is a browser page shown before anybody has an account, and nothing it renders reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **It cannot say the code is expired** — a page that told a good code from a spent one would answer that to anybody, so a refused redemption reads as an ordinary refusal at the sign-in.
- **It does not say who invited them, or to what** — the code carries a standing, and showing it would mean reading the invitation on a page anybody can open.
- **No self-driven directory** — a channel the browser cannot begin is not offered, so an invitation for such a deployment has to be redeemed another way.
- **One code per visit** — the page reads one query parameter; somebody holding two invitations opens two links.

**Runtime invariant:** the page makes no call to the deployment, and the code it read appears only in the hrefs it renders.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The viewer read is what tells accounts from the single-operator shape, and it is the only read this page performs: without `uiViewer` the page reports no accounts rather than guessing, because a composition without that service has no roster for an invitation to write into.

</details>
