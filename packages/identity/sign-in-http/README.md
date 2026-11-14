---
description: "The browser-facing half of signing in, for deployments serving a sign-in page and maintainers wiring the cookie."
kind: "package-reference"
---

# @deepseek-ai/dsh-sign-in-http

English | [中文](README.zh.md)

## Summary

`dsh-sign-in-http` is the four routes a browser sign-in needs: the channel list a page renders buttons from, the start that sends the browser to a directory, the callback the directory returns to, and the sign-out. It sets the session cookie `dsh-request-principal` reads back, and it binds one sign-in to one browser so a callback link handed to someone else cannot sign them in as whoever started it. `dsh-sign-in` stops at the session identity on purpose; where the directory returns, what the cookie's attributes are, and what a refusal looks like to a person are properties of being served over HTTP.

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

```yaml
- id: sign-in-http
  name: '@deepseek-ai/dsh-sign-in-http'
  config:
    publicOrigin: 'https://DeepSeek Harness.example'
    secureCookies: true
    landingPath: '/'
```

| Field | Default | Meaning |
|---|---|---|
| `publicOrigin` | required | The origin a browser reaches this deployment at, no trailing slash |
| `secureCookies` | required | Whether that origin is served over TLS, which decides the cookies' `Secure` |
| `landingPath` | `/` | Where a completed sign-in sends the browser |

Both required fields are deployment facts with no safe default. The Host cannot infer the origin — behind a proxy the request's `Host` is the proxy's — and the address a directory returns to has to be the one in its app registration. `secureCookies: true` silently breaks a plain-HTTP development install while `false` silently ships a session cookie that travels in the clear, so a deployment states which it is.

### The routes

| Route | Method | Answers |
|---|---|---|
| `/auth/channels` | GET | `{ channels: [{ id, displayName, kind }] }` |
| `/auth/sign-in/<channel>` | GET | 302 to the directory, setting the attempt cookie |
| `/auth/callback/<channel>` | GET | 302 to the landing path, setting the session cookie |
| `/auth/sign-out` | POST | 204, clearing the session cookie |

A refusal answers JSON `{ error: <code> }` with 404 for an unknown channel, 403 for a person this deployment admits as nobody, and 400 for the rest.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**One sign-in is bound to one browser.** The start sets a short-lived attempt cookie holding the state, and the callback completes only when the state it carries is the one that browser holds. Without this the callback would accept any state this process had issued — including one an attacker obtained by starting their own sign-in and then handing the link over, which signs the recipient in as the attacker.

**The binding is checked before the channel is looked up.** A request that started no sign-in therefore learns nothing about which directories this deployment offers.

**The session cookie's lifetime is the session's own.** It is read back from the established session rather than recomputed, so a browser never holds a credential the server has already let lapse.

**Sign-out is POST only.** `SameSite=Lax` withholds the cookie from a cross-site POST, so a link someone else posted cannot sign this person out. The same `Lax` is why it is not `Strict`: the callback is a top-level navigation the directory sends the browser on, and `Strict` would withhold the attempt cookie exactly when it is needed.

**A self-driven channel is refused here.** It completes in the process that owns the browser, so a hosted deployment has nowhere to send the person; the route says so rather than appearing to start something.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-sign-in`](../sign-in/README.md) — the flow these routes drive.
- [`dsh-request-principal`](../request-principal/README.md) — what reads the session cookie back on each later call.
- [`dsh-auth-session`](../auth-session/README.md) — the sessions signing out revokes.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool, prompt, or Session event; it serves HTTP routes.

#### KV Cache effect

No request prefix changes, because nothing here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No sign-in page** — these are the routes, not the screen. A deployment renders its own buttons from `/auth/channels`.
- **A refusal is JSON, not a page** — a browser sent to a directory and refused on the way back sees raw JSON rather than something a person can act on.
- **One Host instance per sign-in** — the attempt cookie names a state a channel is holding in memory, so a deployment behind two instances must send the browser back to the one that started it.
- **No sign-out everywhere** — ending one browser's session leaves that person's other sessions running.

**Runtime invariant:** No companion is published. Every relation here is a single observation: the cookie a response sets, and the session the store holds.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`setCookie` escapes the value, so a crafted session identity cannot append attributes such as `Domain=`. A test pins that, and `readCookie` decodes on the way back in.

Service classes mounted by the Loader declare `static Config`: the Loader unwraps a package to its default export, so a schema exported only at module level is not the one a row is validated against.

</details>
