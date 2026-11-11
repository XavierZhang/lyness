---
description: "The admin-setup profile: one command that writes a deployment's first platform administrator, their provider and their binding into a profile; for whoever installs the deployment."
kind: "package-bundle"
---

# `@lyness/lyn-admin-setup`

English | [中文](README.zh.md)

## Summary

This bundle is `lyn --profile admin-setup`, the command run once on a new deployment before it first starts. It writes three things into the target profile's patch layer: the roster entry of the one platform administrator, the OpenID provider they sign in through, and the single admission binding that admits them. That layer is read again at every boot, so the console can neither change nor remove what it names — which is what makes this administrator impossible to lock out, and the way back in when anybody else is. It mounts nothing that reaches a model.

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
lyn --profile admin-setup --target acme --person ada --name Ada \
  --issuer https://id.acme.example --client-id 298412... --subject 298430...
```

It reports what it wrote and the two steps left:

```text
admin-setup: "Ada" administers the "acme" deployment
  person    ada
  provider  https://id.acme.example (channel oidc, client 298412...)
  subject   298430...
  patch     /home/acme/.lyn/profiles/acme/cordis.patch.yml

Two things left, in this order:
  1. give the deployment the client secret: OIDC_CLIENT_SECRET=… lyn --profile acme
  2. register the provider's redirect URI as <your public origin>/auth/callback/oidc
```

Running it twice with the same values changes nothing. Running it for somebody else is refused, because a deployment has one written administrator: `--replace` writes the new one in the old one's place, and every further administrator is added from the console.

### Where each value comes from

| Flag | Where to read it |
|---|---|
| `--person` | your own choice, and permanent: sessions, grants and bindings are written against it |
| `--issuer` | the provider's own issuer URL; discovery is read from it |
| `--client-id` | the application you registered for this deployment with the provider |
| `--subject` | the id the provider keeps that person under, from its own console — never their address, because an address can be reassigned and this binding must not follow it |
| `--secret-name` | the credential reference the client secret is read under; the default is `OIDC_CLIENT_SECRET` |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

**Standing where the files are is the authorization.** There is no token, no page and no login: the command writes a profile's patch layer, which outranks every runtime surface, so the only way to run it is to be where the deployment's files are.

**The provider is inserted; the roster and the admission are patched.** The accounts module composes a roster row and an admission row and no provider at all, so the provider arrives as an `insert` entry while the other two are id-targeted overrides. An override naming a package is skipped when the composed row loads another one, so neither patch names one — the admission row has already changed hands once, from the managed rule to the inviting rule.

**One binding for one person on one channel.** Running it again with another subject replaces that binding rather than adding a second: a provider that reissued somebody's id must not leave the old one admitting anybody.

**It writes the three things it owns, and reads nothing else.** Comments, other rows, other people, other bindings and `!!js` values survive verbatim, because the layer is edited as a YAML document rather than regenerated.

-----

<a id="further-exploration"></a>
## Further Exploration

- [standalone administration](../../../docs/user/guide/standalone-administration.md) — the whole install, of which this command is one step.
- [`lyn-oidc`](../../identity/oidc/README.md) — the provider row this writes, and every setting it accepts.
- [`lyn-managed-people`](../../identity/managed-people/README.md) — why a written entry cannot be changed from the console.
- [`lyn-brand-studio`](../brand-studio/README.md) — the other operator command that edits a profile's patch layer.

-----

<a id="model-experience"></a>
## Model Experience

None, as this bundle registers no tool or prompt: it is one operator command that writes a file and exits, and nothing it does reaches a model request.

#### KV Cache effect

No request prefix changes, because nothing here contributes to an assembled request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **OpenID providers only** — the three enterprise directory kinds are still written by hand, as the standalone guide shows; this command knows the one kind every shape uses.
- **It does not reach the provider** — the issuer, the client and the subject are taken as given, so a typo reads as "nobody can sign in" at the first attempt rather than as a refusal here.
- **No client secret** — the secret is a credential reference this writes, and the value arrives from the environment at start; writing it into the layer would put a live secret in a file the product reads at every boot.
- **One administrator** — which is the point, and the reason a second run is refused rather than merged.

**Runtime invariant:** the command writes one profile's patch layer and nothing else; no credential value, no state and no network call.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`upsertFirstAdministrator` is pure text in, text out, so every rule it applies is pinned against layer fixtures rather than against a filesystem; `runSetup` adds only the read and the atomic replacement.

</details>
