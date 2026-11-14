---
kind: upgrade-guide
description: "The accounts module mounts a new admission rule that honours invitation codes, and admission takes an offer."
---

# Admission honours an invitation code

English | [中文](guide.zh.md)

## Change

A deployment mounts exactly one admission rule, and `@deepseek-ai/dsh-module-accounts` now mounts a different one. `@deepseek-ai/dsh-managed-people/admission` admitted only a subject an administrator had bound; `@deepseek-ai/dsh-invitations/admission` admits that subject, and also whoever presents a code `ctx.invitations` issued. Both read the same `bindings` configuration, so an installation that wrote its operator's identity keeps it. The module gains an `invitations` row, which the rule requires.

Three surfaces change with it:

| Before | After |
|---|---|
| `SignInAdmission.admit(subject)` | `admit(subject, offer?: AdmissionOffer)` |
| `signIn.begin(channel, returnTo)`, `resume(channel, parameters)` | both take an optional trailing `offer` |
| `/auth/sign-in/<channel>` ignored the query | `?invite=<code>` is kept in a `dsh_signin_invite` cookie for 600 seconds and presented at the callback |

The offer is optional on every one of them, so a caller that passes nothing behaves as before, and a rule that ignores the second parameter still compiles. A person without a code sees no difference. An administrator can now issue one through `ctx.invitations.issue`, which is a service call until the console's page lands.

## Migration

1. Nothing to do if you compose `@deepseek-ai/dsh-module-accounts`: the module carries both rows.
2. If your own composition mounts `@deepseek-ai/dsh-managed-people/admission` and you want invitations, replace that row and add the service it needs:
   ```yaml
   - id: invitations
     name: '@deepseek-ai/dsh-invitations'
   - id: sign-in-admission
     name: '@deepseek-ai/dsh-invitations/admission'
     config:
       bindings: []
   ```
   Keep the managed row instead to keep admission closed to codes; nothing else changed about it.
3. If you implement `SignInAdmission` yourself, decide what the second parameter means for your rule. Ignoring it keeps today's behavior; document that, as `dsh-managed-people/admission` does.
4. If you call `signIn.begin` or `signIn.resume` from your own surface and want a code honoured, forward it: `begin(channel, returnTo, { invitation })`. Never put the code in a URL you hand to a directory.
5. Confirm it: issue a code with `ctx.invitations.issue({ label, role, organization }, by)`, then open `/auth/sign-in/<channel>?invite=<code>` in a browser that has never signed in. The person arrives with the standing the code carried, and `ctx.invitations.list(by)` reports one use. `packages/identity/invitations/tests/composition.spec.ts` asserts that path through the real Loader.
