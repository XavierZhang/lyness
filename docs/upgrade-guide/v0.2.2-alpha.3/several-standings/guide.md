---
kind: upgrade-guide
description: "A person may hold several standings: the roster stores a list, a written entry may list them, and DeclaredPerson takes memberships."
---

# A person holds standings, not a standing

English | [中文](guide.zh.md)

## Change

The roster used to give each person exactly one standing. It now holds a list, which is what a person belonging to two organizations needs.

| Before | After |
|---|---|
| `DeclaredPerson.membership` | `DeclaredPerson.memberships`, a non-empty list |
| `PersonView` carried `role` and `organization` | it also carries `standings`; `role` and `organization` repeat the first of them |
| a written `people:` entry wrote `role` | it writes `role` **or** `standings`, never both and never neither |
| `managedPeople` had `save` and `remove` | it also has `grantStanding` and `revokeStanding` |
| `PeopleRefusal` had six reasons | it has nine: `already-held`, `last-standing`, `unknown-standing` |
| the `managed_people` store was version 1 | it is version 2, and still reads version 1 |

Two rules follow. Everything that changes a person — renaming, removing, admitting a directory identity as them, revoking a standing — now requires administering **every** standing they hold, because a binding admits one identity as the whole person. Reading is the exception: a list shows only the standings the caller administers.

No standing identity moves: a stored person's first keeps the identity derived from theirs, and a one-standing written entry keeps `<person>:<role>`, so sessions and invitations still name a standing that exists. A listed standing carries its organization too, as `<person>:<organization>:<role>`.

This affects anybody declaring people into the roster, anything switching exhaustively on `PeopleRefusal`, and anything reading `PersonView.role` as somebody's only standing.

## Migration

1. Nothing to do for an existing store: version 1 records read as one standing, and the next write replaces each with a one-entry list.
2. Rename `membership` to `memberships` wherever you declare a person, wrapping the standing in an array:
   ```ts
   import type { Context } from '@lyness/cordis'
   import type {} from '@lyness/lyn-managed-people'
   import type { Membership, Person } from '@lyness/lyn-people'

   declare const ctx: Context
   declare const person: Person
   declare const membership: Membership

   ctx.managedPeople.declarePerson({ person, memberships: [membership], kind: 'bot' })
   ```
3. Add the three new reasons to any exhaustive `switch` over `PeopleRefusal`. A wire surface that has no method for granting a standing can report them as it reports `not-permitted`.
4. Read `PersonView.standings` wherever you decide what somebody may do. `role` still answers their first standing, which does not describe somebody holding several.
5. To write several standings for one person, replace that entry's `role` with `standings`; see [standalone administration](../../../user/guide/standalone-administration.md). Note that this changes that person's standing identity, so a session they have open loses its standing and asks them to choose again.
6. Confirm it: `pnpm exec vitest run packages/identity/managed-people/tests packages/identity/people/tests` covers the version-1 fold, both written forms, and the two new operations.
