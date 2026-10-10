# Vendor integrations

English | [中文](vendor-integrations.zh.md)

One package per external vendor a deployment connects to, contributing an identity face, a channel face, or both. The [Microsoft Entra contract](../../packages/vendor/microsoft-entra) owns the first identity face; the decision record is [inbound interfaces and the one session plane](../../.agents/notes/proposed/architecture/2026-10-09-inbound-interfaces-and-the-session-plane.md).

Sources: [`packages/vendor/microsoft-entra/src/types.ts`](../../packages/vendor/microsoft-entra/src/types.ts) · [`packages/vendor/microsoft-entra/src/protocol.ts`](../../packages/vendor/microsoft-entra/src/protocol.ts)

## Two faces, one package

The **identity face** signs a person in and answers who they are. The **channel face** receives that vendor's events and delivers replies.

They live in one package per vendor because they share what a vendor issues once: an application registration, its secret or public-client identity, and the token-refresh path that keeps both working. Splitting them by face would give that credential two owners. For Microsoft the split would not even be possible: Teams bot tokens are issued by Entra, so the channel face cannot be built independently of the identity one.

A vendor contributing only one face is ordinary. Entra ships alone today; the channel face arrives when a customer needs it.

## What an identity face establishes

A verified subject: a stable directory object id, the directory that authenticated it, and whatever display name and address that directory publishes. The object id paired with the directory id is the identity other work binds to, because a name and an address both change and the object id does not.

It is not a membership. [The acting context](../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.md) decides what a person may act as; an identity face only says which person signed in. Binding an external account to a membership is an organization's act, and a directory that can create a binding will eventually remove a person, which [session ownership](../../.agents/notes/proposed/architecture/2026-10-07-session-ownership.md) answers for.

## Where the subject comes from

From an authenticated call to the vendor's own directory API, not from the claims of a token the client received. Redeeming an authorization code directly over TLS means the answer is as trustworthy as that connection and the vendor, not the client, decides what it says — so an identity face that redeems its own code verifies no token signature and holds no key material.

A face that must accept a token it did not redeem itself — a channel receiving a bot token minted elsewhere — does need that verification. That is a property of how the token arrived, not of the vendor.

## Credentials and the hosted boundary

A vendor application credential belongs to the organization that registered it. On shared hosted infrastructure the agent must not be able to read it, and [`credentials-local`](../../packages/credentials/credentials-local/README.md) states plainly that it cannot provide that: its file is readable by the OS user the agent's own tools run as.

So a vendor integration ships to desktop and private deployments, where the operator and the credential owner are the same person, until a credential store the agent cannot reach exists. That is the same boundary as [the command container](../../.agents/notes/proposed/architecture/2026-10-08-agent-isolation-and-teams.md), and it is a precondition rather than a later refinement.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmicrosoftentra--microsoftentra"></a>

### `ctx.microsoftEntra` — `MicrosoftEntra`

Microsoft Entra sign-in.

```ts cordis-catalog
/**
 * The person this deployment signed in.
 * @returns the stored subject, or undefined while nobody has signed in.
 */
async subject(): Promise<EntraSubject | undefined>
```

Source: [`packages/vendor/microsoft-entra/src/index.ts`](../../packages/vendor/microsoft-entra/src/index.ts)
<!-- END GENERATED cordis-surface -->
