---
description: "The page an invitation link opens: the directories that redeem it, and the acceptance it offers somebody already signed in."
kind: "package-reference"
---

# @lyness/lyn-client-ui-join

English | [中文](README.zh.md)

## Summary

`lyn-client-ui-join` is the page an invitation link opens. It takes the built-in `root` seat on its own path and nothing anywhere else, because whoever follows such a link may have no account here and the workbench would be unusable to them. It reads the code from its own query string and offers one link per directory a browser can begin, each carrying it. Somebody already signed in gets one button instead: pressing it adds the standing the code carries to their account. Two visits get a message instead: a link with no code, and a deployment with no accounts.

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

**Two visits have nothing to redeem.** A link with no code, and a deployment with no accounts — which serves the person at its keyboard and has nobody to admit. Each gets its own message rather than a page of links that cannot work.

**Somebody already signed in presses a button, and nothing happens before they do.** Opening the link changes nothing: it is the press that asks the deployment, which is what makes the standing theirs to accept rather than something a forwarded link did to their account. The sign-in route still ignores a code for somebody the roster already holds, so this page is the only way one reaches an account that exists.

**The acceptance names no standing until it has one.** The page has not read the invitation and must not, so the button says only that there is one; what the code carried is in the answer, and only the person who accepted it sees it.

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

- **An existing person who follows the link signed out signs in first, then opens it again** — the sign-in clears the code on its way back, so the acceptance is a second visit. A link opened while already signed in needs one press.
- **It cannot say the code is expired** — a page that told a good code from a spent one would answer that to anybody, so a refused redemption reads as an ordinary refusal at the sign-in.
- **It does not say who invited them, or to what** — the code carries a standing, and showing it would mean reading the invitation on a page anybody can open.
- **No self-driven directory** — a channel the browser cannot begin is not offered, so an invitation for such a deployment has to be redeemed another way.
- **One code per visit** — the page reads one query parameter; somebody holding two invitations opens two links.

**Runtime invariant:** the page makes no call to the deployment until somebody presses accept, and the code it read appears only in the hrefs it renders and in that one call.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The viewer read is what tells accounts from the single-operator shape, and it is the only read this page performs: without `uiViewer` the page reports no accounts rather than guessing, because a composition without that service has no roster for an invitation to write into.

</details>
