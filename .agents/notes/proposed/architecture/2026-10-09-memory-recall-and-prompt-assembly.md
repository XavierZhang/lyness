# Agent Note: What the agent remembers, what it can look up, and how its prompt is assembled

Status: proposed

English | [中文](2026-10-09-memory-recall-and-prompt-assembly.zh.md)

## Problem

Three related things are wrong, and they are wrong in three different ways: one capability is absent, one is built and unreachable, and one is present but uninspected.

**Nothing remembers anything across sessions.** There is no memory package in the tree. [`goal`](../../../../packages/goal/goal/README.md), `todo` and `plan` hold state inside one session and end with it. Every conversation starts the agent over: how this organization names things, which repository matters, what was decided last week, all re-explained. For a product sold to an organization, that is the difference between a tool and a colleague.

**Recall is built, tested, and mounted nowhere.** [`lyn-tool-session-query`](../../../../packages/session-query/tool-session-query/README.md) gives a model five read-only tools to search earlier sessions, inspect matches, trace relationships, and read exact events, with cross-session access authorized only when the target session's `cwd` matches the caller's exactly. [`session-query-sqlite`](../../../../packages/session-query/session-query-sqlite/README.md) backs it. No shipped profile mounts the tool, and the Web patch pins the index at `openAt: never`. The capability exists and no customer can reach it — the same failure the [default-modules note](2026-10-08-default-modules-and-views.md) exists to fix.

**The prompt is composed but not tiered.** [`lyn-system-prompt`](../../../../packages/core/system-prompt/README.md) assembles one ordered prompt from sections, runtime facts and variables, and fails assembly rather than sending something malformed. What it does not carry is which parts are stable across requests and which change every turn. Cache behaviour is therefore incidental: a volatile fact and a fixed identity sit in the same ordered list, so anything that moves can invalidate everything before it.

**And workspace instruction files are read without inspection.** [`lyn-agent-instructions`](../../../../packages/context/agent-instructions/README.md) loads the applicable `AGENTS.md` chain into the prompt under a byte budget, dropping broader files before truncating the most specific one. It inspects the bytes for size and nothing else. On a developer's own machine that is the whole point — the file is their instruction to their agent. On hosted infrastructure, where a repository may have come from anywhere, it is an instruction channel into the model that the customer never authorized and cannot see.

## Proposal

Declare prompt tiers, give the agent a memory the organization can audit, make recall default-on, and treat instruction files as untrusted input.

### Every prompt section declares a tier

Three tiers, declared rather than inferred:

- **Stable** — harness identity, deployment persona, tool guidance, the skills index. Changes when the composition changes.
- **Context** — the workspace instruction chain and project files. Changes when the workspace does.
- **Volatile** — the memory snapshot, the acting membership, the time.

The assembler orders by tier and then by the existing section order, so the request layer knows which tier moved. A volatile-only change rebuilds only the volatile tail and leaves the stable prefix byte-identical, which is what makes a provider's prefix cache usable at all. Today that property is accidental; a declared tier makes it a property the assembler can keep.

### Memory belongs to a membership, and the organization can see it

Memory is scoped to the membership that wrote it, with an organization-scoped tier for facts an administrator publishes to everyone. It is written only by an explicit operation — the person or the agent saying "remember this" — never harvested from a transcript in the background.

An organization can list and delete everything held for its members. That is not a feature request; it is the condition for holding the data at all.

Memory reaches model requests, so the repository's rule applies without exception: **model-visible implies logged**. A memory that enters a request is reconstructable from the session log, which means a memory block is a session event, not an invisible side input.

### Recall becomes default-on, with its authorization unchanged

`tool-session-query` mounts in every profile that serves people. Its `cwd`-exact cross-session rule stays exactly as written — it is the only barrier between one session reading another, and widening it is not part of this change.

The content index stops being pinned. `openAt: never` in the Web patch becomes a deployment and plan decision, so a hosted organization can have full-text recall and a deployment that does not want the index can still decline it.

### Workspace instruction files are untrusted input

The instruction chain is inspected before it joins the context tier, and what was dropped is recorded where the person can see it. The honest limit comes with it: inspection is not a guarantee, and this note does not claim one.

The real boundary is structural, not textual: **an instruction file can phrase guidance and cannot grant capability.** It cannot enable a tool, raise a sandbox mode, change an approval policy, or alter a quota. Those are decisions their owning operations make, as [plugin trust](2026-10-08-plugin-compatibility-and-trust.md) and the permission presets already require. Inspection reduces how often a hostile file wastes a turn; the capability rule is what keeps it from doing damage.

### Memory and the knowledge base are different things

The [default-modules note](2026-10-08-default-modules-and-views.md) gives the product a knowledge module: the customer's documents, indexed, reachable as a tool. Memory is not that. Documents are authored elsewhere, reviewed, versioned, and large; memory is small, mutable, written during work, and about how this organization operates. They have different write paths, different lifetimes, and different review. No path writes one through the other.

## Alternatives considered

**Harvest memory automatically from transcripts.** The agent would learn without anyone doing extra work, and this is what "self-improving" usually means. Rejected: it writes facts the customer never approved and cannot audit, and it turns every conversation into a silent input to future ones. An organization cannot accept that about its own staff's conversations.

**One memory per organization.** Simpler to store and to show. Rejected: one member's half-formed draft becomes every colleague's context, and the first wrong memory misleads the whole organization instead of one person.

**Put memory in the knowledge base.** One retrieval surface, one index. Rejected: documents are reviewed and versioned and memory is neither, so the merged surface would have to carry both policies and would default to the weaker one.

**Keep recall opt-in.** It is a real cost — five tool schemas and fixed guidance on every request, as the package's own summary states. Rejected: it is built, tested, and unreachable, and a capability nobody can reach is worth less than its prompt cost is expensive.

**Widen the `cwd` rule so recall spans an organization's sessions.** More useful recall. Rejected here: it is a separate decision with its own blast radius, and bundling it into "mount the existing tool" would smuggle a permission change in behind a composition change.

**Skip inspection and rely on the sandbox.** The sandbox already bounds what a command may touch. Rejected: the sandbox bounds effects, not instructions. A file that convinces the agent to do something harmful within its permissions never trips it.

**Make instruction files a trusted layer.** They are, on a developer's machine. Rejected for hosted: the repository's author and the customer are not necessarily the same person, and the product cannot tell which case it is in from the file alone.

## Acceptance criteria

- Every prompt section declares a tier, and a volatile-only change leaves the stable prefix byte-identical.
- A memory is written only by an explicit operation, is scoped to the membership that wrote it unless an administrator published it to the organization, and the organization can list and delete all of it.
- A memory that reaches a model request is reconstructable from the session log.
- `tool-session-query` is mounted in every profile that serves people, and its `cwd`-exact cross-session authorization is unchanged by this work.
- The content index is a deployment and plan decision rather than a pinned value.
- The workspace instruction chain is inspected before it joins the prompt, and what was dropped is visible to the person.
- An instruction file cannot enable a tool, raise a sandbox mode, change an approval policy, or alter a quota, and each of those refusals is proven at the operation that makes the decision.
- No path writes memory through the knowledge base or knowledge through memory.

## Risks

**Tiering is a claim about someone else's cache.** Declaring a stable prefix does not make a provider honour it, and a provider that re-reads the whole prompt makes the tiering invisible work. The assembler-side property is still worth having, but the benefit is not ours to guarantee.

**Memory is the most sensitive thing the platform would hold.** It is small, quotable, about named people and their work, and it reaches model requests. A leak here is worse than a leak of documents the customer already has copies of elsewhere.

**Inspection produces false positives.** A legitimate instruction file written in forceful language looks like an attack. Silently dropping it weakens guidance the customer intended, which is why what was dropped has to be visible rather than merely logged.

**Default-on recall widens what a session can read.** Five more schemas on every request is the stated cost; the unstated one is that the `cwd` rule now carries real traffic. It was written as a guard on an opt-in tool and becomes a guard on a shipped default.

**Memory and knowledge will blur in the UI.** Customers will ask why there are two places to put what the agent should know. Keeping them separate in the packages does not keep them separate in a customer's head, and the two surfaces will need to explain each other.
