# Agent Note: What an agent runs inside, and how agents work together

Status: proposed

English | [中文](2026-10-08-agent-isolation-and-teams.zh.md)

## Problem

"Each agent runs in its own sandbox" is not what this tree does, and the gap between the phrase and the mechanism matters once customers share infrastructure.

What exists is a file-effect policy. The [`sandbox/`](../../../../packages/sandbox/README.md) group confines **subprocess execution**: commands run `read-only`, write only under the session workspace, or run unrestricted, and `lyn-base` pins `workspace-write` by default. That confines what a command may touch on the filesystem. It is not a boundary between one agent and another, and it is not a boundary between one customer and another: a confined command still runs on the host, as the host's user, with the host's network.

Agents are not separated either. A delegated child from [`subagent-fork-in-process`](../../../../packages/subagent/subagent-fork-in-process/README.md) runs in the parent's process by design, seeded with the parent's completed turns — which is what makes delegation cheap and lets a child see the work it is continuing.

And conversations are stored together. [`session-persistence-jsonl`](../../../../packages/session/session-persistence-jsonl/README.md) takes one required `root` directory for all session files, and the SQLite query backend one database. One runtime serving several organizations puts every customer's conversations under one tree and in one index, where the only thing between them is a query that has to be written correctly every time.

So the hosted product has three different boundaries that are all missing, and naming them all "sandbox" hides that they need different mechanisms.

## Proposal

Three boundaries, each at the level that can actually hold it.

### An organization gets a process

A runtime serves one organization. Its sessions, its storage, its workspaces and its credentials are that organization's and no one else's, and the separation is the operating system's rather than a query predicate's. Two organizations that share nothing share no process.

This is what makes the per-organization Creator runtime in [plugin trust](2026-10-08-plugin-compatibility-and-trust.md) possible rather than a second mechanism: an organization that buys Creator mode is an organization whose runtime also accepts its own plugins.

### A team gets a process too

The unit below the organization is the **team**: one main agent and the children it creates. A team runs in one process, which is what lets a child be seeded with the parent's completed turns and lets the parent collect results directly. Children are not isolated from their parent — that is the point of delegation, not an oversight.

So "one process per agent" means one process per team. An agent that creates no children is a team of one.

### Commands get a container

A process boundary is not an operating-system boundary for what a command may do: a confined command still has the host's network and the host's kernel. Command execution moves into a container whose filesystem is the session workspace and whose network is what the organization permits. The existing file-effect policy keeps working inside it — it answers "what may this command touch", while the container answers "what is reachable at all".

This is the boundary that makes `tool-bash` safe to offer to a hosted customer. Without it, confinement is a policy the command's own process is asked to respect.

### Agents work together over protocols that already exist

Three questions are often run together and have three different answers here:

- **An agent reaching a tool or a data source** is MCP. The repository already mounts `mcp-resources`, and connectors to a customer's own systems are MCP servers rather than plugins.
- **One agent driving another agent's session** is ACP. [`packages/acp`](../../../../packages/acp/README.md) is the server — a program creates, resumes and closes lyness sessions over the standard protocol — and [`subagent-acp`](../../../../packages/subagent/subagent-acp/README.md) is the client, delegating to an ACP agent in its own subprocess with its own runtime, session, model and tools.
- **Inside one team**, nothing: the subagent seam is direct, in-process delegation.

A team collaborates in-process. Teams collaborate over ACP, which is also how a lyness agent reaches an agent that is not lyness at all. The protocol boundary and the process boundary therefore agree: anything that crosses a process crosses ACP.

**A2A is deliberately not adopted.** It answers a different question — how agents from different vendors discover each other and negotiate a task — and adopting it before there is a counterpart to negotiate with would add a protocol with no correspondent. ACP already carries delegation, including to other vendors' agents, and the ACP seam is built. This stays open: a customer who needs to reach an A2A agent is the reason to revisit, and the subagent seam is where it would attach.

### Metering follows the person

Usage is attributed to the member who acted, not only to the organization, so an organization can see which of its people and which of its departments spent what. Where the platform supplies the model, that attribution also enforces: a quota belongs to a membership and a plan, and work stops when it is exhausted.

Where an organization brings its own model credentials, usage is recorded for reporting and nothing is enforced. The platform does not hold that account, cannot see its balance, and must not pretend to a limit it has no way to apply. Showing a quota that does not bind would be worse than showing none.

## Alternatives considered

**One process per agent, children included.** The literal reading of per-agent isolation. Rejected: a child seeded with the parent's completed turns is the delegation model this product has, and moving every child to its own process would replace a direct call with a protocol for the case that needs it least.

**Confine commands with the file-effect policy alone.** It already exists and costs nothing more. Rejected: it governs file effects inside a process that keeps the host's network and kernel. It is a good policy and a poor boundary.

**Separate organizations by query predicate in a shared store.** Cheapest by far, and common. Rejected: it makes every query a security control, and the first query written without the predicate is a cross-customer leak with no other barrier behind it.

**One container per agent.** Stronger than one per team. Rejected: it breaks in-process delegation for a boundary nobody asked for, since a team is work the same customer authorised.

**Adopt A2A now.** It is where multi-vendor agent interoperation is heading. Deferred: no counterpart yet, and ACP already covers delegation including across vendors.

**Meter per organization only.** Simpler, and matches how the organization is billed. Rejected: an organization cannot manage seats or departments it cannot measure, and per-member attribution is what makes a seat meaningful.

## Acceptance criteria

- A runtime serves exactly one organization; its session root, its storage and its workspaces are not shared with another organization's runtime.
- A main agent and the children it creates run in one process, and a child is seeded with the parent's completed turns as it is today.
- A command runs inside a container whose filesystem is the session workspace and whose network reachability is what the organization permits; the file-effect policy still applies inside it.
- Delegation across processes, including to a non-lyness agent, goes over ACP; no new agent-to-agent protocol is introduced.
- Usage records the acting membership, not only the organization.
- With a platform-supplied model, an exhausted quota stops further work; with an organization's own credentials, usage is recorded and no limit is claimed.

## Risks

**Per-organization processes change density and cost.** A runtime per customer is the dominant infrastructure decision in this design, and it sets the floor under every price. Small organizations are the hard case.

**Containers add a layer to operate.** Image lifecycle, start latency on a cold conversation, and what happens when the container dies mid-command are all new operational surface. A command that fails because its container vanished must not read to the agent as a command that failed.

**The in-process team is a trust unit.** Within a team there is no boundary, so a child agent is as privileged as its parent. That is correct for delegation the customer asked for, and it means a prompt that convinces a parent to delegate also inherits the parent's reach.

**Unenforceable quotas invite misreading.** A customer bringing their own model will see usage numbers and may assume a limit exists behind them. The surface has to say plainly that it reports and does not restrict, or the first surprise bill becomes the platform's fault.
