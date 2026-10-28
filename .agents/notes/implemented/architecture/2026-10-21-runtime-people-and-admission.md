# Agent Note: Adding a colleague without editing a file on the server

Status: implemented

English | [中文](2026-10-21-runtime-people-and-admission.zh.md)
## Problem

A deployment with accounts read its people from composition: `people/static` held the roster and `admission-roster` held the directory identities admitted as them. Both are configuration, so adding a colleague meant editing a file on the server and restarting it — for a customer's own administrator, who has no shell there. The sign-in channels had already moved to runtime records under the [accounts module's own decision](../../proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.md), and said so: a channel could be added without a redeploy, and nobody could sign in through it until the roster was edited by hand.

## Decision

The people and the admission bindings become durable records an administrator maintains, beside the ones composition writes, and the written half wins.

`@lyness/lyn-managed-people` holds the stored half in its own domain and answers both seams from one place: `./directory` provides `ctx.people` and `./admission` provides `ctx.signInAdmission`, each reading the same `people` / `bindings` configuration its static counterpart did and forwarding every lookup to `ctx.managedPeople`. An installation that already wrote its roster keeps it verbatim; `module-accounts` only changes which plugin the two rows name.

Composition still names the first person, and the roster may not be empty: an empty system has no administrator to add the first administrator, and that written person is also the recovery path when the last stored administrator is removed. A change to a written person or binding is refused as `written` rather than accepted, because the next boot reads that file again and the surface would have reported something untrue.

The rules the service applies, each because something would otherwise be reachable:

- Granting a role grants what it may do, so a tenant administrator cannot make a platform administrator — that standing administers every organization, including the ones they do not.
- A change is authorized against the stored record as well as the submission, or one tenant's administrator could take another's person by naming their id with their own organization.
- A binding is authorized by the person **and** by the channel, read from the configured channels where a deployment stores them: a binding on another organization's directory lets that organization's people sign in here.
- A standing's id is derived from the person's id alone, so changing somebody's role does not move the membership id an open session already names.
- A removed person's id is retired with them, so the conversations they opened stay attributed to somebody who no longer signs in rather than to whoever is added next.

`@lyness/lyn-api-people-controller` projects it onto the `people` Remote namespace and decides nothing: it resolves the standing the call acts in, hands it to the service, and reports each refusal under its own code. `@lyness/lyn-client-ui-settings-people` is the Settings section, beside the sign-in channels one.

## Alternatives considered

**Seed the store from configuration on first boot.** One source of truth at runtime, and the file becomes a bootstrap. It also means an operator who edits that file later sees nothing happen, which is the silent-misconfiguration failure the repository rules exist to prevent. Layering keeps the file authoritative for what it names.

**Let the store shadow a written person.** Tempting for "fix the typo in the roster from the UI", and wrong: composition is re-read at every boot, so the stored row would be the configuration only until somebody restarted.

**Replace `people/static` and `admission-roster`.** Both are still the right answer for a deployment that wants no runtime management, and removing them would force a store on an installation that has one operator and one file.

**Put the management API on `PeopleDirectory`.** It would have given the surface a `list()` without a second service. The directory is a Service Definition with one abstract read per question, and a provider that cannot be written to — an SSO directory — would have to refuse three methods it should not have.

**Authorize a binding by the person alone.** Simpler, and it leaves a tenant administrator able to admit another organization's directory subject as their own user. The channel check costs one list call through the rule that already decides who administers which channel.

## Consequences

An administrator adds a colleague, admits their directory identity, and that person signs in — with no shell, no file, and no restart. A deployment whose channels come from composition rather than from records cannot delegate binding to a tenant administrator, because the channel check reads the store; that is fail-closed and named under the package's Known Limitations.

One person still holds one standing in one organization, as the written roster always had it. Removing somebody does not end the sessions they already have, and nothing stops the last stored administrator from being removed — the written roster is why that is recoverable.

`messageOf` moved to `lyn-client-store` while the second Settings section was built, because both sections reported a carrier rejection the same way. The rest of what the two sections share is shape rather than substance — their vocabularies are channels and people — and is marked as deliberately parallel instead of being pressed into one base that would have to name both.
