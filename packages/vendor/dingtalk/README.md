---
description: "DingTalk as a sign-in channel: an organization signs in whichever of its people is at the browser."
kind: "package-reference"
---

# @deepseek-ai/dsh-dingtalk

English | [中文](README.zh.md)

## Summary

`dsh-dingtalk` offers DingTalk as a redirect sign-in channel. It sends the browser to DingTalk's own sign-in page, exchanges the code for the person's own token, reads who that token belongs to, and hands that identity to the deployment's admission rule — which decides who, if anyone, that person is allowed to be. It holds nothing: no tokens, no directory copy, no session of its own. The application secret is named as a credential reference rather than written into composition, so a cordis.yml never carries the one value that signs in every organization the application is installed in.

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
- id: dingtalk
  name: '@deepseek-ai/dsh-dingtalk'
  config:
    appKey: your-app-key
    secret: DINGTALK_APP_SECRET
- id: sign-in-admission
  name: '@deepseek-ai/dsh-sign-in/admission-roster'
  config:
    bindings:
      - channel: dingtalk
        issuer: your-corp-id
        subject: the-union-id
        person: ada
```

`secret` names a credential, never the secret: set `DINGTALK_APP_SECRET` in the deployment's credential store. `issuer` is the organization's `corpId` as the token exchange reports it, and `subject` is the person's `unionId` — the id that survives both a rename and a second application registration.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**The union id, not the open id.** An open id is per application, so a binding written against one stops matching the moment a deployment registers a second application for the same organization. The union id is stable across everything one developer account can see.

**Failure arrives with an HTTP status.** DingTalk refuses with a non-2xx response whose body names the code, so the status decides whether the call failed and the body only decides what to say about it. The organization's own code travels on the error.

**A person in somebody's directory, or nobody.** A token exchange that reports no `corpId` is a personal DingTalk account signing in. No organization holds them, so no binding could name them, and the sign-in completes nobody — without even asking who they are.

**One callback is spent once.** The attempt is removed before the code is exchanged, so a replayed callback link finds nothing waiting. The book that holds attempts in flight is `dsh-sign-in`'s, shared with every other redirect channel.

**The code arrives under either name.** DingTalk's callback has carried it as `authCode` and as `code` across its own revisions, and a channel that read only one would simply stop signing people in. Both are read, `authCode` first.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-sign-in`](../../identity/sign-in/README.md) — the channel seam and the admission rule.
- [`dsh-sign-in-http`](../../identity/sign-in-http/README.md) — the routes that send the browser out and take the callback.
- [`dsh-wecom`](../wecom/README.md) and [`dsh-microsoft-entra`](../microsoft-entra/README.md) — the other redirect channels, which share this one's attempt book.
- [`dsh-credentials`](../../credentials/credentials/README.md) — where the application secret lives.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a browser round trip before any session exists, and nothing it reads reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The protocol is written from DingTalk's published interface, not verified against a live organization** — the endpoints, parameters, and reply fields are pinned by this package's own tests, so a divergence shows up as a refusal naming DingTalk's code rather than as a silent wrong answer. The hosts are configurable so a correction needs no code change.
- **Attempts live in the process** — an unfinished sign-in is remembered in memory, so a deployment behind two Host instances must send the browser back to the one that started it.
- **One application per mounted row** — the channel id is fixed, so a deployment with two DingTalk applications cannot mount two of these; serving several needs a channel id derived from configuration.
- **No in-client flow** — somebody opening the deployment inside DingTalk still goes out to the sign-in page rather than signing in silently.
- **Nothing refreshes** — the exchange returns a refresh token and this channel keeps neither it nor the access token, so there is no way to read the directory again later.

**Runtime invariant:** No companion is published. The only relation it holds is the set of attempts in flight, and its single observer is the callback that completes one.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`protocol.ts` is I/O-free on purpose: the request shapes and the reply schemas are what a DingTalk interface change would break, and they are checkable without a network. Keep new endpoints there and leave `index.ts` to the round trip.

</details>
