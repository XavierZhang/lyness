---
kind: upgrade-guide
description: "The `invitations` namespace gains `accept`, which a member may call, and the join page no longer turns away somebody already signed in."
---

# Accepting an invitation as somebody already here

English | [中文](guide.zh.md)

## Change

`ctx.invitations` gains `accept(code, person)`, and the `invitations` Remote namespace gains `accept(code)`. Until now a code reached only a subject the roster had never seen: somebody already bound signed in as themselves and the code changed nothing. It still changes nothing during a sign-in — a forwarded link must not add authority to an account its holder was not asking to change — but the person may now present it themselves and gain the standing it carries alongside what they already hold.

Three surfaces move with it:

- `invitations/accept` is the first method in that namespace a `member` may reach; every other one still requires `tenant-administrator`. It takes only the code: the account it adds to comes from the call's own session.
- Its answer is `AcceptanceView` — `accepted`, and the `role` and `organization` granted. Every refusal reads as `accepted: false`.
- `@lyness/lyn-client-ui-join` now injects `remote` and `remote.invitations`, and its `blockedBy` no longer answers `'signedIn'`. A composition that mounts the page without the Client remote assembly parks it.

## Migration

1. A deployment that mounts `@lyness/lyn-client-ui-join` through `@lyness/lyn-web-app` needs no change: the Client assembly mounts every namespace. One that composes the page by hand must have `@lyness/lyn-api-remotes/client` in the graph, or the page never appears.
2. Code reading `blockedBy` from `@lyness/lyn-client-ui-join/client` drops the `'signedIn'` case; the signed-in visit now renders the acceptance.
3. Copy keys `signedInTitle` and `signedInHint` are gone from the `join` locale namespace. A deployment overriding them removes those entries and may override `acceptTitle`, `acceptHint`, `acceptSubmit`, `acceptWorking`, `acceptNote`, `acceptedTitle`, `acceptedHint`, `nothingTitle`, `nothingHint`, `failedHint` and `retry` instead.
4. Nothing persisted changes: the invitation record, its hash and its use count are as they were.

Confirm it by opening an invitation link while signed in: the page offers one button, and pressing it answers either the standing you now hold or that the code granted you nothing.
