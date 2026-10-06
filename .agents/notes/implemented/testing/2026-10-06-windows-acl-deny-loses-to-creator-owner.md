# Agent Note: a CREATOR OWNER allow defeats the Windows sandbox's container deny

Status: implemented

English | [中文](2026-10-06-windows-acl-deny-loses-to-creator-owner.zh.md)

## Problem

`packages/sandbox/sandbox-windows-acl` confines a workspace by adding a deny ACE to the granted root that inherits to containers only. `runner.spec.ts` pins the documented cost of that deny: a `FullControl` open succeeds for files inside the root and fails for a directory, because `FILE_DELETE_CHILD` is evaluated on the container. On this fork's hosted `windows-2025` runner the directory open succeeded, so the test failed on every run while passing on the upstream Windows pool.

Two readings were wrong before the evidence came in. The first blamed backup semantics: the probe opens the directory with `FILE_FLAG_BACKUP_SEMANTICS`, which bypasses the ACL when `SeBackupPrivilege` is enabled, and the runner is an Administrator at High Mandatory Level. Printing the token disproved it — `SeBackupPrivilege`, `SeRestorePrivilege`, and `SeTakeOwnershipPrivilege` are all **Disabled**, and a disabled privilege takes no part in an access check. The second blamed ReFS, whose inheritance differs from NTFS. The temp volume is NTFS.

## Decision

Reproducing the sequence without the product code settled it. A root and a child directory are created, then a container-inheriting deny is added to the root:

```text
root : runneradmin:(CI)(DENY)(DE)

child: NT AUTHORITY\SYSTEM:(OI)(CI)(F)
       runneradmin:(OI)(CI)(F)
       runneradmin:(I)(CI)(DENY)(DE)
       runneradmin:(I)(OI)(CI)(F)
```

The second row is explicit; the third is the deny, inherited. So the deny does propagate. It loses. The runner's `%TEMP%` carries a `CREATOR OWNER` inheritable ACE, so every directory created under it receives a **non-inherited** `FullControl` allow for its creator. Windows evaluates a DACL in canonical order — explicit denies, explicit allows, inherited denies, inherited allows — so the explicit allow is reached before the inherited deny and grants the open. The test's precondition is absent on this runner; its assertion is not wrong.

The Windows coverage job therefore points `TMP` and `TEMP` at a scratch root created with `icacls /inheritance:r` and granted inheritable full control for SYSTEM and the runner account. A child of that root inherits allows and denies alike, and their canonical order decides. The product sandbox is untouched, and the assertion keeps its force: it still fails if the deny stops propagating.

## What this says about the sandbox

The confinement rests on a precondition the sandbox does not establish and does not check: that directories inside a granted root carry no explicit allow. `CREATOR OWNER` inheritable ACEs are ordinary under `C:\Users\<account>\`, which is where a workspace usually lives, so a real deployment can reach the same state the runner is in — the container deny propagates and is then outranked. The seam would have to read the effective DACL of each container it means to deny, or place an explicit deny rather than an inherited one, to close that gap.

This is upstream's design, reached here only because a hosted runner happens to expose it. The fork owns the question rather than reporting it upstream, and the sandbox code is unchanged for now, for a reason that is about evidence rather than ownership.

The probe that produced `DIRECTORY: OK` runs under `spawnSync('pwsh', ...)`, which is the runner's ordinary token. The deny it defeats names the world SID, so the assertion it breaks — that even an unrestricted process cannot open the container — is real and is the stronger of the two claims the suite makes. What the probe does **not** establish is the one that decides severity: whether a sandboxed process, whose token is write-restricted, also reaches that `CREATOR OWNER` allow. It is the same account, so it plausibly does; nothing here measures it.

Closing the gap means either placing an explicit deny on every container inside a granted root, which then has to cover directories created after the grant, or reading each container's effective DACL before trusting an inherited deny. Both are edits to a security seam, both need a Windows host to validate against a restricted token, and this fork reaches Windows only through a CI round trip. Changing the seam from that position would be guessing. The measurement comes first.

## Consequences

The Windows coverage job now owns a scratch root and the two environment variables that point at it, so a change to that step changes what the sandbox suite sees. Any future suite that assumes the default `%TEMP%` on this job inherits the reset root instead; that root grants SYSTEM and the runner account inheritable full control, which is what the default offered minus the `CREATOR OWNER` entry.

The assertion keeps its force. If the product stops propagating the deny, or propagates it in a form that loses to an inherited allow, the test fails again. What it no longer reports is the runner's own profile ACL.

The gap named above stays open in the product. A deployment on Windows should not treat directory containment as proven by this suite alone until a restricted-token measurement settles whether a sandboxed process reaches the `CREATOR OWNER` allow; that measurement is the next step, and it belongs on a Windows host rather than in a CI log.

## Alternatives considered

### Why not skip the test on this runner

The repository forbids bypassing a sandbox failure, and this assertion carries a real security property. Skipping it would also have buried the finding above, which only surfaced because the failure was pursued rather than silenced.

### Why not widen the assertion to accept either outcome

An assertion that passes whether or not the deny applies pins nothing. The precondition is cheap to restore; the coverage is not worth trading for it.

### Why not run the Windows coverage job on a self-hosted pool

It would hide the difference rather than explain it, and the fork has no such pool. The scratch root is three lines and states its reason.
