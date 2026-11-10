---
description: "An OpenID Provider as a sign-in channel: the standard protocol, so a deployment points it at its own directory."
kind: "package-reference"
---

# @lyness/lyn-oidc

English | [中文](README.zh.md)

## Summary

`lyn-oidc` offers any OpenID Provider as a redirect sign-in channel. It is the channel for people outside a corporate messenger: the three vendor channels each speak one directory's protocol, this one speaks the standard, so a deployment points it at the provider it runs and gets email self-registration, verification, password reset and multi-factor from software whose job that is. None of those flows are implemented here — a channel's whole job is to hand a verified subject to the deployment's admission rule. It holds nothing: no tokens, no directory copy, no session of its own.

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

Beside the sign-in registry and a credential store, with a binding for each person who may sign in:

```yaml
- name: '@lyness/lyn-sign-in'
- name: '@lyness/lyn-oidc'
  config:
    issuer: https://idp.example
    clientId: lyness-web
    secret: OIDC_CLIENT_SECRET
- name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: oidc
        issuer: https://idp.example
        subject: 2f1c9a7e-0b64-4a2f-9c3d-7e5b1a84d6f0
        person: ada
```

`issuer` is the provider's own identifier and the only address this package needs: every endpoint comes from the discovery document published under it. `secret` names a credential rather than carrying one. `subject` in a binding is the provider's `sub` claim, which is the one value a provider promises not to reuse — a binding written against an address would admit the wrong person after a rename.

A deployment serving several organizations names the claim its provider carries them in, and a channel instance may be scoped to one of them:

```yaml
- name: '@lyness/lyn-oidc'
  config:
    issuer: https://idp.example
    clientId: lyness-web
    secret: OIDC_CLIENT_SECRET
    organizationClaim: organization.id
    organization: acme
    organizationParameter: organization_id
```

`organizationClaim` is where a sign-in's organization is read from, `.` separating one level. `organization` scopes this instance to one of them, so a sign-in page serving another tenant does not offer it. `organizationParameter` is the authorization parameter that asks the provider for one organization's own sign-in page, where it offers one.

`@lyness/lyn-oidc/kind` offers the same channel as a configurable kind instead, so an administrator adds a provider at runtime through the sign-in channels Settings page. Mounting the kind configures nothing by itself.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Endpoints come from discovery, never from configuration.** The authorization, token and userinfo addresses are read from the provider's own `.well-known/openid-configuration`, and the document is believed only when the issuer it claims is the one that was asked. A deployment that wrote the endpoints itself could point the token exchange at one host and the authorization at another, which is the shape of a code-theft attack.

**Claims come from the userinfo endpoint, not from the ID token.** Reading an ID token means verifying its signature against the provider's keys, which is a JOSE implementation this package has no business carrying. Userinfo is read over TLS with the access token the exchange returned, so the answer is the provider's own and there is no signature to check. `sub` is the only claim required.

**A provider reached without TLS is refused at configuration.** The authorization code and the access token both cross that connection. Loopback is allowed, because that is where a provider runs while somebody develops against it.

**PKCE, with the verifier in the attempt rather than on the channel.** Each sign-in gets a fresh verifier, recorded with its own attempt beside the callback the authorization named; the exchange repeats both. This is why the channel implements the channel contract directly instead of extending `StatefulRedirectChannel`, whose attempt book models attempts with nothing to remember: a verifier kept on the instance would make two sign-ins in flight overwrite each other's.

**The attempt is spent before its code is**, so a replayed callback link finds nothing waiting.

**Discovery is read at mount and reused.** A misconfigured issuer is therefore a boot diagnostic rather than a refused sign-in, while a provider that is merely down is retried at the first sign-in instead of leaving the channel permanently broken.

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-sign-in`](../sign-in/README.md) — the channel seam and the admission rule.
- [`lyn-sign-in-http`](../sign-in-http/README.md) — the routes that send the browser out and take the callback.
- [`lyn-dingtalk`](../../vendor/dingtalk/README.md) and [`lyn-wecom`](../../vendor/wecom/README.md) — the vendor channels, which share this one's attempt book.
- [`lyn-credentials`](../../credentials/credentials/README.md) — where the client secret lives.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package registers no tool or prompt: it answers a browser round trip before any session exists, and nothing it reads reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No ID token is read, so no claim that only an ID token carries is available** — `amr`, `acr` and an authentication instant are all in the token this package does not verify. A deployment that needs them needs signature verification first.
- **Attempts live in the process** — an unfinished sign-in is remembered in memory, so a deployment behind two Host instances must send the browser back to the one that started it.
- **One provider per mounted row** — the channel id is fixed, so a deployment with two providers mounts the kind and configures instances instead.
- **Nothing refreshes** — the exchange's refresh token is not kept, so there is no way to read the directory again later.
- **No back-channel logout** — a session this channel established outlives a sign-out at the provider until its own lifetime expires.

**Runtime invariant:** No companion is published. The only relation it holds is the set of attempts in flight, and its single observer is the callback that completes one.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`protocol.ts` is I/O-free on purpose: the request shapes and the reply schemas are what a provider's divergence would break, and they are checkable without a network. Keep new endpoints there and leave `index.ts` to the round trip.

The one defensive guard with no test is `documentOrThrow`'s throw: `start` prepares before reading it and `complete` reaches it only for an attempt `start` opened, so the document is always held by then. It stays because the field's type permits absence.

</details>
