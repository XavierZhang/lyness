---
description: "Feishu as a sign-in channel: a tenant signs in whichever of its people is at the browser."
kind: "package-reference"
---

# @deepseek-ai/dsh-feishu

English | [中文](README.zh.md)

## Summary

`dsh-feishu` offers Feishu as a redirect sign-in channel. It sends the browser to Feishu's own sign-in page, buys the person's token with the application's own, reads who that token belongs to, and hands that identity to the deployment's admission rule — which decides who, if anyone, that person is allowed to be. It holds nothing: no tokens, no directory copy, no session of its own. The application secret is named as a credential reference rather than written into composition, so a cordis.yml never carries the one value that signs in every tenant the application is installed in.

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
- id: feishu
  name: '@deepseek-ai/dsh-feishu'
  config:
    appId: your-app-id
    secret: FEISHU_APP_SECRET
- id: sign-in-admission
  name: '@deepseek-ai/dsh-sign-in/admission-roster'
  config:
    bindings:
      - channel: feishu
        issuer: your-tenant-key
        subject: the-union-id
        person: ada
```

`secret` names a credential, never the secret: set `FEISHU_APP_SECRET` in the deployment's credential store. `issuer` is the tenant's `tenant_key` as the directory reports it, and `subject` is the person's `union_id` — the id that survives both a rename and a second application registration.

An international deployment points `apiOrigin` at Lark's own origin, which serves the same interface under a different name.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Two legs, because the exchange is the application's.** Feishu authorizes the code exchange with the application rather than with the code alone: the application's token buys the person's token, and the person's token reads the person. Three requests per sign-in, and none of them keeps anything.

**The union id, not the open id.** An open id is per application, so a binding written against one stops matching the moment a deployment registers a second application for the same tenant. The union id is stable across everything one application can see.

**Failure arrives with HTTP 200.** Feishu reports a refusal in the body's `code`, so each reply is validated and then checked, and the tenant's own code travels on the error. The payload is nested under `data` on the two endpoints that have one, so each reply is read against the shape that endpoint actually sends rather than against one envelope for all three.

**A person in somebody's tenant, or nobody.** A person the directory reports without a `tenant_key` is signing in with a personal Feishu account. No tenant holds them, so no binding could name them, and the sign-in completes nobody.

**One callback is spent once.** The attempt is removed before the code is exchanged, so a replayed callback link finds nothing waiting. The book that holds attempts in flight is `dsh-sign-in`'s, shared with every other redirect channel.

**The tenant's own address wins.** Feishu publishes a personal address and one the tenant issued; a deployment showing a person's address means the work one, so `enterprise_email` is preferred and the personal address is the fallback.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-sign-in`](../../identity/sign-in/README.md) — the channel seam and the admission rule.
- [`dsh-sign-in-http`](../../identity/sign-in-http/README.md) — the routes that send the browser out and take the callback.
- [`dsh-wecom`](../wecom/README.md) and [`dsh-dingtalk`](../dingtalk/README.md) — the other Chinese-directory channels, which share this one's base class.
- [`dsh-microsoft-entra`](../microsoft-entra/README.md) — the first redirect channel, which shares the attempt book.
- [`dsh-credentials`](../../credentials/credentials/README.md) — where the application secret lives.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a browser round trip before any session exists, and nothing it reads reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The protocol is written from Feishu's published interface, not verified against a live tenant** — the endpoints, parameters, and reply fields are pinned by this package's own tests, so a divergence shows up as a refusal naming Feishu's code rather than as a silent wrong answer. The origin is configurable so a correction needs no code change.
- **Attempts live in the process** — an unfinished sign-in is remembered in memory, so a deployment behind two Host instances must send the browser back to the one that started it.
- **One application per mounted row** — the channel id is fixed, so a deployment with two Feishu applications cannot mount two of these; serving several needs a channel id derived from configuration.
- **No in-client flow** — somebody opening the deployment inside Feishu still goes out to the sign-in page rather than signing in silently.
- **The application token is fetched per sign-in** — it lasts two hours and caching it would be the beginning of a credential store; a sign-in is rare enough that the extra request costs nothing worth keeping state for.
- **Only the internal application form** — a marketplace application signs in with a tenant ticket this channel never receives.

**Runtime invariant:** No companion is published. The only relation it holds is the set of attempts in flight, and its single observer is the callback that completes one.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`protocol.ts` is I/O-free on purpose: the request shapes and the reply schemas are what a Feishu interface change would break, and they are checkable without a network. Keep new endpoints there and leave `index.ts` to the round trip.

</details>
