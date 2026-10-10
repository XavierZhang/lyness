---
description: "Microsoft Entra ID sign-in through the browser, for deployments connecting a directory and maintainers wiring the identity face."
kind: "package-reference"
---

# @lyness/lyn-microsoft-entra

English | [中文](README.zh.md)

## Summary

`lyn-microsoft-entra` signs a person in through their own Microsoft Entra directory and holds the verified subject for them. It registers one authorization flow: the person opens the directory's page in a browser, returns to a loopback callback, and the redeemed access token is used once to ask Microsoft Graph who signed in. The subject comes from that authenticated call rather than from id-token claims, so this package verifies no token signature and holds no key material. Configure the directory and the application id; a deployment that configures neither cannot mount it.

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

Mount it when people should sign in with their work account. It needs `ctx.authorization` for the attempt, `ctx.credentials` for the grant, and `ctx.webServer` for the loopback callback.

```yaml
- id: microsoft-entra
  name: '@lyness/lyn-microsoft-entra'
  config:
    directory: contoso.onmicrosoft.com
    clientId: 00000000-0000-0000-0000-000000000000
```

| Field | Default | Meaning |
|---|---|---|
| `directory` | required | Tenant id, verified domain, or an Entra audience (`organizations`, `common`, `consumers`) |
| `clientId` | required | Application (client) id of the Entra app registration |
| `authorityHost` | `login.microsoftonline.com` | Authority host; a sovereign cloud names its own |
| `graphOrigin` | `https://graph.microsoft.com` | Graph origin; a sovereign cloud names its own |
| `scopes` | `openid profile User.Read offline_access` | Requested scopes; `User.Read` is required |
| `redirectPath` | `/oauth/callback/microsoft-entra` | Loopback path the browser returns to |
| `attemptTimeoutMs` | `300000` | Bound on one browser round trip |
| `requestTimeoutMs` | `20000` | Bound on one token or Graph request |

### Register the application

The Entra app registration must be a public client with the loopback redirect URI `http://127.0.0.1:<port>/oauth/callback/microsoft-entra`. The port is the one the deployment's web server listens on, so a fixed port belongs in the registration.

### Read the signed-in person

`ctx.microsoftEntra.subject()` answers the stored subject, or `undefined` while nobody has signed in. `objectId` paired with `directoryId` is the identity to bind to: a display name and an address both change, the object id does not.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

One attempt generates a PKCE verifier, its S256 challenge, a `state`, and a `nonce`. The authorization request carries the challenge, the state, and `response_mode=query`, because a fragment never reaches a server. The verifier is sent to the token endpoint and nowhere else, which is what proves this process started the attempt whose challenge the directory recorded.

The callback accepts exactly one `state` and one `code`, compares the state in constant time, and answers `400` to anything else without saying why. Whichever side ends the attempt — the callback, the timeout, or a withdrawal — releases the route and the timer through one path.

### Why no token signature is verified

The subject is read from an authenticated Graph `/me` call over TLS, so the directory, not the client, decides what it says. Nothing here parses or trusts the id token, which is why this package depends on no JWT or JWKS code. A future consumer that must accept an id token issued elsewhere — a channel face receiving a token it did not redeem itself — would need that verification; redeeming a code directly does not.

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The service, the authorization flow, and the loopback callback |
| [`src/protocol.ts`](src/protocol.ts) | The request shapes and the accepted answers, as pure functions |
| [`src/types.ts`](src/types.ts) | The authenticated subject and its branded identities |

-----

<a id="further-exploration"></a>
## Further Exploration

- [`lyn-authorization`](../../credentials/authorization/README.md) — the flow seam this package registers with.
- [`lyn-credentials`](../../credentials/credentials/README.md) — where the grant is stored.
- [Vendor integrations](../../../docs/subsystems/vendor-integrations.md) — the identity and channel faces, and what they share.

-----

<a id="model-experience"></a>
## Model Experience

None, as directory sign-in never enters model prompts, Session logs, or tool results; a consumer that puts the subject in a request owns that exposure and its logging.

#### KV Cache effect

No model request prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this package is a poor fit or needs special care. They are current package constraints, not a task backlog.

- **No refresh yet** — the refresh token is stored when the directory grants one, and nothing redeems it. An expired access token means signing in again.
- **No channel face** — Teams is not here. When it arrives it shares this application registration rather than registering a second credential.
- **No directory read beyond the signed-in person** — group and membership queries are absent, so nothing here can populate a membership binding on its own.
- **One signed-in person per deployment** — the grant is one credential record, so this package cannot hold two people at once.
- **The loopback port must match the registration** — a deployment on an ephemeral port cannot complete a sign-in, because the redirect URI would not be the registered one.

**Runtime invariant:** No companion is published. The grant is one credential record this package writes through the authorization seam, which confirms the commit itself, so no two independent observations of the sign-in can diverge.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
