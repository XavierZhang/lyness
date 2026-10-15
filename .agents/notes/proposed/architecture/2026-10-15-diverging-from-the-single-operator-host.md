# Agent Note: Leaving the single-operator Host, and what that obliges

Status: proposed

English | [中文](2026-10-15-diverging-from-the-single-operator-host.zh.md)

## Problem

Upstream's Web Host authenticates one operator and grants them everything. Two upstream decisions say so in as many words: [browser launch-token authentication](../../implemented/architecture/2026-08-24-browser-token-authentication.md) establishes that "the Web Host runs tool-capable Sessions with the current operating-system user's authority", that "possession of the browser cookie authorizes the complete tool-capable Host API", and that "endpoint ownership and method names do not alter authority"; it ships no logout, sets `SameSite=Strict`, deliberately omits `Secure` "because the shipped server uses loopback HTTP", and states that "authentication does not imply supported network deployment, TLS, forwarding-header interpretation, or proxy configuration". [The carrier-level trust fence](../../implemented/architecture/2026-07-28-api-browser-trust-boundary.md) adds that the shipped CLI rejects `--host 0.0.0.0` and that the fence "is a confused-deputy defense rather than identity". Upstream also considered and declined adding logout, TLS-proxy and forwarding-header configuration, on the grounds that nothing in a loopback Web application needs them.

That model is coherent and, for a local developer harness, stronger than what replaces it: the authority boundary is the operating-system account, and there is nothing to get wrong per method.

This product is a hosted service with many people on one deployment. It therefore needs the things upstream declined — people, roles, sessions that lapse and can be revoked, per-person metering, a sign-in channel, and an origin a browser reaches over the network — and several of them have already shipped here: `identity/people`, `identity/auth-session`, `identity/sign-in`, `identity/request-principal`, `credits/credits`, and `tenant/*`. None of that exists upstream, and upstream has no multi-user notion to extend.

The divergence is already real, and it is incomplete in a way worth stating plainly. The per-person rules that shipped are enforced on the `llm/stream` waterfall, so they cover model calls. The tool-capable surface is untouched: `api/settings-controller` and `api/session-controller` contain no authorization check, so any authenticated principal can still write settings and drive a Session — and upstream records what a Session does, "`session.prompt` drives an agent that runs bash". Credentials are one owner-scoped record set, and session persistence takes one `root` directory with one query index. [Agent isolation](2026-10-08-agent-isolation-and-teams.md) already names these as three separate missing boundaries and proposes that an organization gets a process; it is unbuilt.

So the open question is not whether to diverge. It is what the deployment may do while the divergence is partial.

## Proposal

Record the divergence as a deliberate, bounded decision, and bind the hosted product's first phase to the half of it that is safe today.

**The hosted server runs no user code in phase one.** A SaaS deployment mounts the control plane — identity, sign-in, credits, model policy, sessions, settings, announcements — and mounts no execution provider and no execution tool. Agent work that touches files, shells, terminals, language servers, a browser or a screen runs on the person's own machine: the capability-seam definitions and their tools stay on the server, while the provider half runs beside the person, reached the way `fs-ssh` and `subprocess-ssh` already reach another machine. Cloud execution waits for an organization to get a process. The per-package allocation that follows from this is its own record, written when that work starts.

This is the half that does not conflict with upstream. Upstream runs the agent with the authority of the machine the person is sitting at; a desktop executor does exactly that. What upstream never contemplated — one shared runtime executing several customers' agents — is the half we defer.

### The four points we leave upstream on, and why

| Upstream | Here | Why the product requires it |
|---|---|---|
| One cookie authorizes the complete API; method names do not alter authority | A request speaks for a person, and an operation authorizes itself against that person's role | A hosted deployment has members and administrators; "the operator" names nobody |
| No logout | Sessions carry an expiry and can be revoked | A shared machine, a lost laptop and a departing employee all need a session to end |
| `SameSite=Strict`, no `Secure`, loopback HTTP | `SameSite=Lax`, `Secure` is a required deployment field | A directory returns the browser by top-level navigation, which `Strict` would refuse, and a networked origin must not send the cookie in the clear |
| Authentication implies no network deployment | `publicOrigin` is a required field and the trust fence is configured | The browser reaches the deployment over a network by definition |

The trust fence itself is not changed. It stays a confused-deputy defence, and sign-in is layered after it exactly where upstream layers authentication.

### What the divergence does not buy

It does not make a shared runtime multi-tenant-safe. Metering a person's model calls is orthogonal to whether that person can read the deployment's credentials or another customer's conversations. Anyone reading the credits, roles or model-policy work as an isolation boundary is reading it wrong: those three constrain the model request, and nothing else.

## Alternatives considered

**Stay on upstream's single-operator model.** Rejected because it has no multi-user notion to extend, not because it is weak. One cookie meaning full authority is the right answer for a harness the operator runs on their own machine; it cannot express "this member may select a model but not change the list", which is a stated product requirement.

**Put the per-person checks in the surfaces.** Rejected on the repository's own rule: an authorization check in a surface or an RPC handler is bypassed by the next caller — a preset row, a profile patch, a maintenance task, a direct RPC. This is why the shipped checks sit on `llm/stream` and in `ModelPolicy.save`, and it is why extending them means extending the operations, not the surfaces.

**Ship hosted cloud execution now, isolating customers by query predicate.** Rejected. [Agent isolation](2026-10-08-agent-isolation-and-teams.md) already records why: a confined command still runs on the host, as the host's user, with the host's network. A predicate that has to be written correctly every time is not a boundary between customers.

**Build per-principal authority across the whole tool surface first, then ship.** Rejected for phase one, not on merit. It is the larger change — every controller, the credential store's scoping, and the session tree all move — and phase one does not need it, because a server that executes nothing has no tool surface to scope. It becomes required the moment cloud execution lands.

**Keep upstream's cookie attributes.** Rejected on mechanism: `SameSite=Strict` withholds the cookie on the directory's return navigation, so a redirect sign-in could never complete, and omitting `Secure` on a networked origin puts a bearer credential on the wire in plaintext.

## Acceptance criteria

- The shipped SaaS profile mounts no `fs`, `shell`, `subprocess`, `sandbox`, `terminal` or `lsp` provider, and none of `tool-fs`, `tool-fs-search`, `tool-str-replace-editor`, `tool-bash`, `tool-pwsh`, `tool-terminal` or `tool-lsp`. A gate reads the shipped profile and fails on any of them, so the phase-one boundary cannot be composed away by accident. Server-side persistence is unaffected: `session-persistence-jsonl`, `attachment-local`, `spill-local` and `storage-json` reach the disk directly rather than through `ctx.fs`.
- A prompt sent to a phase-one SaaS deployment cannot execute a command, and a test proves the refusal through the executor rather than through a surface.
- Each of the four divergence points is pinned by a test that fails if it silently returns to upstream's behaviour on a merge.

## Risks

**Phase one has no cloud execution.** "Close the laptop and the task keeps running" is not available until an organization gets a process, and `jobs-local` ends its jobs with the process. That is a product capability knowingly withheld, not an oversight.

**Upstream may move under these four points.** We now own authority, session lifetime, cookie attributes and network deployment in a layer upstream treats as settled. An upstream change to Connection's authentication is a hand-reviewed conflict from here on, and the tests above are what makes a silent revert visible.

**A composition can still create the unsafe shape.** Nothing in the runtime prevents an operator from mounting execution on a shared server before isolation exists; the gate above covers the shipped profile only. A custom composition that does it is outside what this decision supports.

**The untouched tool surface is a dated obligation.** `settings-controller` and `session-controller` having no authorization check is tolerable only while the server executes nothing. It becomes a defect the day server-side execution ships, and it should be read as owed work rather than as an accepted state.
