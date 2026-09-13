# Agent Note: Gates that read the developer's host

Status: implemented

English | [中文](2026-09-13-gates-that-read-the-developer-host.zh.md)

## Problem

Four checks failed on a development machine and passed in CI. None was a product defect and none came from this fork's changes: each read a fact about the host it never declared.

Two read the process environment. The Windows executable resolver's test inherits `process.env` for the search semantics it asserts, so a host that exports `NoDefaultCurrentDirectoryInExePath` drops the target-cwd probes the expectation lists — the implementation was right and the test was measuring the developer's shell. The Python runtime's environment-isolation test asserts the child sees no `PATH`, which holds for an interpreter binary and not for a version-manager shim: pyenv's `python3` is a shell script that exports its own `PATH` before exec'ing the real interpreter, so the assertion measured the wrapper rather than the environment the runtime builds.

One read the filesystem. A vite fixture addresses its build input by absolute path while vite resolves its own root through realpath; the macOS platform temp directory is a symlink, so the two disagree and the emitted asset name becomes a path that escapes the root, which rolldown rejects.

One read the build output. The corpus import gate exempts the dockkit bundle only for a failure naming dockkit's own stylesheet. The built bundle externalizes its primitives dependency and imports it first, that package is exempt for the same reason, and the loader therefore names ITS stylesheet — so the condition could never hold. It stayed hidden because the suite skips a tree with no build output, and a default test run does not build the host libraries first.

## Decision

Each check declares what it needs instead of inheriting it. The two environment readers pass an explicit environment: the resolver test pins an empty one for every bare command, and the Python test pins the interpreter that `sys.executable` reports. The fixture canonicalizes its root. The corpus gate accepts a refused stylesheet from dockkit itself **or** from another package whose own bundle is exempt for a stylesheet, which is derived from the exemption table rather than pinned as a second path.

No implementation changed. Three of the four were correct already, and the fourth is a gate.

## Alternatives considered

**Loosen the corpus exemption to any refused stylesheet.** One line, and it makes the real corpus pass. It also deletes the guard: the suite has a negative control asserting that a stylesheet dockkit itself introduces, other than the one named, is still reported, and that control fails. The narrowing is deliberate and worth keeping.

**Pin the dependency's stylesheet as a second expected path.** Matches the file's stated philosophy of a pinned list over a count. It pins whichever stylesheet the dependency imports first, which is neither dockkit's concern nor stable, and it differs between launchers because a paths-aware loader resolves the dependency to source and a bare one to the build output.

**Normalize the host instead: unset the variable, point `python3` at a binary, move the temp directory.** No repository change at all. It makes a green run a property of one machine's setup, which is the failure being fixed; every later contributor rediscovers the same four findings.

**Leave them failing and record them as known-host noise.** Cheapest, and it was the state these arrived in. A suite with permanently red members stops being read, and two of these four are portability defects a Windows or macOS contributor would hit as product behavior rather than as test noise.

## Consequences

The four changes live in upstream files, so they are logged in the fork ledger and will meet upstream's own fix as a conflict if it lands. They are not fork-specific and are candidates to send upstream: nothing in them depends on the rename or on this fork's configuration.

The corpus gate now derives its inherited-stylesheet allowance from `BASELINE_EXEMPT`, so removing a package from that table narrows the dockkit allowance with it, and the table stays the one place the exemptions live.
