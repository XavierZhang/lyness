---
description: "WeCom as a sign-in channel: a corporation signs in whichever of its members is at the browser."
kind: "package-reference"
---

# @lyness/lyn-wecom

English | [中文](README.zh.md)

## Summary

`lyn-wecom` offers WeCom as a redirect sign-in channel. It sends the browser to the corporation's own scan-code page, reads the member the corporation reports on the way back, and hands that identity to the deployment's admission rule — which decides who, if anyone, that member is allowed to be. It holds nothing: no tokens, no directory copy, no session of its own. The application secret is named as a credential reference rather than written into composition, so a cordis.yml never carries the one value that signs in a whole corporation.

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

Beside the sign-in registry and a credential store, with a binding for each member who may sign in:

```yaml
- id: wecom
  name: '@lyness/lyn-wecom'
  config:
    corpId: ww-your-corporation
    agentId: '1000002'
    secret: WECOM_APP_SECRET
- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: wecom
        issuer: ww-your-corporation
        subject: ada
        person: ada
```

`secret` names a credential, never the secret: set `WECOM_APP_SECRET` in the deployment's credential store. `issuer` is the corporation id and `subject` is the member's `userid`, because those are the two values a rename does not change.

Reading a member's name and work address is off by default. A deployment whose application holds the private-information scope turns it on with `readDetail: true`, and the subject then carries a display name and an address a surface can show.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The scan-code page, not the in-client one.** WeCom has two authorization endpoints: one that only completes inside the WeCom application, and one a browser can reach. A deployment served over HTTP can serve the second, so that is the one this channel sends people to.

**Failure arrives with HTTP 200.** Every WeCom reply carries `errcode`, and a refusal is a successful HTTP response with a non-zero code. Each reply is therefore validated and then checked, and the corporation's own code travels on the error so a deployment can act on it.

**A member of the corporation, or nobody.** A reply carrying only `openid` is somebody who authenticated through WeChat without being in this corporation's directory. They have no corporation identity, so no binding could name them, and the sign-in completes nobody rather than inventing a subject.

**One callback is spent once.** The attempt is removed before the code is exchanged, so a replayed callback link finds nothing waiting. The attempt's state is also its id: the corporation echoes exactly one opaque value, and a second id would have to be carried somewhere it could be separated from this one.

**The token is fetched per sign-in.** An application token lasts hours and caching one would be the beginning of a credential store; a sign-in is rare enough that the extra request costs nothing worth keeping state for.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-sign-in`](../../identity/sign-in/README.md) — the channel seam and the admission rule.
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.md) — the routes that send the browser out and take the callback.
- [`lyn-microsoft-entra`](../microsoft-entra/README.md) — the other redirect channel, whose flow this one follows.
- [`lyn-credentials`](../../credentials/credentials/README.md) — where the application secret lives.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a browser round trip before any session exists, and nothing it reads reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The protocol is written from WeCom's published interface, not verified against a live corporation** — the endpoints, parameters, and reply fields are pinned by this package's own tests, so a divergence shows up as a refusal naming the corporation's code rather than as a silent wrong answer. The hosts are configurable so a correction needs no code change.
- **Attempts live in the process** — an unfinished sign-in is remembered in memory, so a deployment behind two Host instances must send the browser back to the one that started it.
- **One corporation per mounted row** — the channel id is fixed, so a deployment serving two corporations cannot mount two of these; serving several needs a channel id derived from configuration.
- **No in-client flow** — somebody opening the deployment inside the WeCom application still goes out to the scan-code page rather than signing in silently.
- **Nothing refreshes** — the channel keeps no member token, so there is nothing to refresh and no way to read the directory again later.

**Runtime invariant:** No companion is published. The only relation it holds is the set of attempts in flight, and its single observer is the callback that completes one.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`protocol.ts` is I/O-free on purpose: the request shapes and the reply schemas are what a corporation's interface change would break, and they are checkable without a network. Keep new endpoints there and leave `index.ts` to the round trip.

</details>
