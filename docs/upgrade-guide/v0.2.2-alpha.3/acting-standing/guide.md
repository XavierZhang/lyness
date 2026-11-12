---
kind: upgrade-guide
description: "A Principal now carries its session, a viewer answer carries every standing its person holds, and a sign-in puts a single standing in force."
---

# A session says which standing it acts in

English | [中文](guide.zh.md)

## Change

Three surfaces change, and one behaviour.

| Before | After |
|---|---|
| `Principal` was `{ person, acting }` | it also carries `session`, the identity the call presented |
| `ViewerView` had `standing` | it also has `standings`, every standing its person holds |
| the `identity` namespace answered `viewer()` | it also answers `act(standing)`, which puts one of the caller's own standings in force |

The behaviour: a sign-in used to leave every session in its person's personal context, which authorizes nothing a standing is required for — an administrator who signed in was refused by every administration call. A sign-in now puts a standing in force when its person holds exactly one. Somebody holding several is still left personal, because which organization they act for is their decision; the administration console asks them, through `act`.

This affects anybody who builds a `Principal` (a custom authorization rule, a test double), anybody who builds a `ViewerView` (a surface standing in for the identity namespace), and any deployment whose own code assumed a freshly signed-in session acts personally.

## Migration

1. Add `session` wherever you build a `Principal`. It is the `AuthSessionId` the call presented, which `presentedSession(request)` returns and `requestPrincipal` already resolves:
   ```ts
   import type { Principal } from '@lyness/lyn-request-principal'
   import type { AuthSessionId } from '@lyness/lyn-auth-session'
   import type { PersonId } from '@lyness/lyn-people'

   declare const presented: AuthSessionId
   declare const person: PersonId

   const principal: Principal = { session: presented, person, acting: { person } }
   ```
   A double that only needs to be read can use any branded string; nothing addresses another session through it.
2. Add `standings: []` wherever you build a `ViewerView`, or the standings the person holds when your surface knows them. `standing` keeps its meaning: the one in force.
3. If your own code put a standing in force after a sign-in, drop it: `signIn` does it for a person who holds exactly one, and doing it twice is one write against the other.
4. Confirm it: sign in as somebody holding one standing and call anything that requires one — it answers instead of refusing with `this call acts in no standing`. `packages/identity/sign-in/tests/sign-in.spec.ts` pins all four cases (one standing, several, none, no directory).
