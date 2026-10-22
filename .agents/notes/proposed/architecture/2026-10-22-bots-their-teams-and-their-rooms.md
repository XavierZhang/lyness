# Agent Note: A bot, the team it works in, and the room it talks in

Status: proposed

English | [中文](2026-10-22-bots-their-teams-and-their-rooms.zh.md)

## Problem

A customer asks for "our own bots", and means three things this tree cannot do yet.

**A bot's character and its capabilities are deployment-time text.** [`persona`](../../../../packages/preset/persona/README.md) gives one agent its own system prompt, and the row is mounted inside a preset composition. [`agent-preset`](../../../../packages/preset/agent-preset/README.md) declares which tools, prompt sections and skills that agent sees, as a list of child plugin rows. [`mcp-client`](../../../../packages/mcp/mcp-client/README.md) takes one entry per external server. [`skill-filesystem`](../../../../packages/skill/skill-filesystem/README.md) discovers skills from directories. Every one of them is a row in a composition file, and [`agent-preset-registry`](../../../../packages/preset/agent-preset-registry/README.md) states the consequence plainly: "The registry writes no declarations", and a new preset "is a bundle patch". So a tenant administrator who wants a second bot files a request with whoever edits the profile. That is the same position adding a colleague was in before [runtime people and admission](../../implemented/architecture/2026-10-21-runtime-people-and-admission.md), and the same answer applies.

**Agents reach each other along one edge: parent to child.** [`tool-subagent-control`](../../../../packages/subagent/tool-subagent-control/README.md) lets "any exact live Agent target its direct continuable child, while a resident continuable child may also target its direct parent", and `list_agents` lists a parent's own children. That is delegation, and it is correct for delegation. It is not two bots that belong to one organization, were configured by different administrators, and need to ask each other something. Those two have no edge at all, because neither created the other.

**And several participants cannot discuss anything.** A session has one agent and one human. There is no session in which three bots and a person take turns, and no operation that ends such a discussion with a recorded conclusion.

The frameworks customers compare us to answer the second and third points and skip what this tree spent the last month building. CrewAI gives each agent a role, a goal and a backstory and runs crews sequentially or hierarchically; AutoGen runs a group chat where a manager picks the next speaker; MetaGPT assigns a software company's roles and passes documents between them. In all of them a bot is a Python object inside one process: it has no standing, owns nothing, is visible to whoever holds the process, and asks nobody for permission. This tree has people with standings, [sessions owned by the person who opened them](2026-10-07-session-ownership.md), [a rule about who may read one](../../implemented/architecture/2026-10-19-session-visibility.md), and [a human approval gate recorded in the session's audit log](../../../../packages/interaction/user-approval/README.md). A bot modelled as an object in a process would be the one actor in the product with no standing and no attribution — and the one way to read a conversation the visibility rule refuses.

## Proposal

A bot is an entry in the organization's roster. Everything else follows from that.

### A bot is a person of a different kind

[`managed-people`](../../../../packages/identity/managed-people/README.md) already stores who exists, which organization they belong to and what standing they hold. A bot is stored the same way and marked as one: it belongs to exactly one organization, it holds a standing, and [`session-ownership`](2026-10-07-session-ownership.md) records it as the owner of the sessions it opens. A tenant administrator maintains bots exactly where they maintain people, under the same authorization rules, including the one that stops a tenant administrator from creating a platform administrator.

What a bot does not get is a sign-in binding. A person is admitted through a directory identity; a bot is never a verified subject and no channel may present one. Keeping bots in the same roster and out of the admission table is what prevents "add a bot" from becoming a way to mint an identity that signs in.

### Its character and its capabilities are stored, and the stored half wins

One bot record holds the persona text and the capability selections a deployment permits: which skills, which MCP servers, which tools, which model, which permission preset. Mounting is derived from the record the way a configured sign-in channel is derived from its own: the deployment states the kinds, the administrator states the instances. A row the composition writes stays the operator's and cannot be edited from the surface, because the composition file is read again at every boot — the same split [runtime people](../../implemented/architecture/2026-10-21-runtime-people-and-admission.md) settled.

### A bot is selected from, never written

The capability fields name entries a deployment already mounted. An administrator picks a skill from the catalog, an MCP server from the connectors the organization configured, a tool from the preset's contributed rows. Free text is the persona and the job description, and nothing else.

Arbitrary capability text would mean an administrator could name a plugin the deployment never audited, and a connector string is a URL with credentials attached. The reason is the same one the sign-in kinds row exists for: the deployment says what shapes exist, the tenant fills them in.

### A bot may not be given more than its author holds

A bot acts under its own standing, and that standing is bounded by the standing of whoever saved it. A tenant administrator cannot create a bot that reaches another organization, and cannot give a bot a permission preset they could not select themselves. The check is made against the **stored** record on every change, not only against the submission, for the reason the channel service already records: otherwise one administrator claims another's bot by naming its id.

### A team is who may ask whom

A team is a stored relation between bots in one organization: a name, the bots in it, and for each a job description in the author's own words. Membership is what grants the edge. Two bots in one team may ask each other; two bots that share only an organization may not.

A bot reads its teammates' names, personas, declared capabilities and job descriptions. That is what makes "ask the one who knows" possible without a central dispatcher, and it is information the administrator wrote on purpose.

### Asking is not reading

A bot may ask a teammate a question. It may not read the teammate's sessions, list them, or learn that a particular one exists.

The asked bot answers in its own session, under its own standing, with its own tools, and decides what to say. What comes back is an answer composed for the question, never a transcript. This is the only safe reading: the asked bot's sessions belong to the people who opened them, and [the visibility rule](../../implemented/architecture/2026-10-19-session-visibility.md) refuses those people's colleagues. A bot that could read them would be a way around a rule the product enforces everywhere else.

An answer is still a disclosure, so the question and the answer are both recorded in both sessions, and the asked bot's owner can see what was asked of it.

### What crosses a line is approved by a person

Three things are not a bot's to decide: reaching outside the organization, spending beyond what the asking person's quota allows, and acting under a permission preset stronger than the one the current session runs with. Each goes to [`user-approval`](../../../../packages/interaction/user-approval/README.md), which already sends a one-shot decision to the deployment's answerers, fails closed when none answer, and records the request and the outcome in the session's audit log.

The approval is asked of the person the work is for, not of the bot's author, because that person is the one whose quota and whose data are at stake.

### A room is one session with several participants and one conclusion

A room is an ordinary session whose participants are several bots and the people invited. It is owned by the person who opened it, stored and read like every other session, and its transcript is the record.

Three things make it a room rather than a group of agents. A **chair** decides who speaks next and when the discussion ends; it is a deployment-selected rule, not a bot's own judgement, because a participant that chose its own turn would be a participant that could never be stopped. A **bound** — turns, tokens, wall clock — ends it whatever the chair thinks. And a **conclusion** is written when it ends: a named result in the session log, produced by the chair from what was said, which is what a human asked for when they opened the room.

A bot in a room sees the room's transcript, because it is speaking in it. That is not a hole in the rule above: the room is one session, the participants were invited to it, and what they see is what they are part of.

## Sequence

**First, the bot itself.** The roster entry, the stored persona and capability selections, the controller, and the Settings page beside People. One bot in one organization, opened and talked to like any agent. Nothing here needs a new protocol, and it is the half customers can use on its own.

**Then the team and the ask.** The stored team relation, the teammate catalog a bot can read, the ask operation, and the approval gate on what crosses a line. This is where the security decisions above are either right or expensive.

**Then the room.** The multi-participant session, the chair, the bound and the conclusion. Last because it is the one that needs the other two to exist, and the one whose cost per answer is highest.

## Alternatives considered

**A bot is a preset, and presets become runtime-editable.** Smaller: the preset registry already composes capabilities, so adding a write path to it would cover "custom bot". Rejected: a preset has no organization, no standing and no owner, so every question below it — whose bot is this, whose quota does it spend, who may change it, who owns what it writes — would need a second answer beside the roster's. The roster already answers all of them for people.

**A bot is a kind of person, with no new record at all.** Tempting after the previous point: store the persona in the person record and be done. Rejected: a person record is reached by the admission table, and a row that can hold a persona is a row an administrator could attach one to for a human. Keeping the bot record separate and un-bindable is what keeps those two apart.

**Let a bot read its teammates' sessions when they share a team.** What every multi-agent framework does, and much simpler than an ask. Rejected: team membership is a relation between bots, and the sessions are owned by people who never agreed to it. This would make "add a bot to a team" a way to read conversations the visibility rule refuses.

**Let the asked bot's answer be its transcript.** Cheaper and more faithful than composing an answer. Rejected for the same reason, one step weaker: a transcript the asking bot can quote is the conversation, whatever the operation is called.

**Let the room's participants decide who speaks next.** This is AutoGen's group chat, and it produces better discussions. Deferred: a discussion that decides its own length has no bound a deployment can set, and the first customer bill is where that is discovered. A chair with a bound can be made smarter later; a room with no bound cannot be made safe later.

**Adopt A2A for bot-to-bot asking.** It is the protocol built for this question. Deferred for the reason [agent isolation and teams](2026-10-08-agent-isolation-and-teams.md) already recorded: within one organization's runtime the ask does not cross a process, and adopting a negotiation protocol with no counterpart adds a surface with no correspondent. A customer whose bot must reach another vendor's agent is the reason to revisit, and the subagent seam is where it attaches.

## Acceptance criteria

- A tenant administrator adds a bot, gives it a persona and capabilities, and talks to it, without any file on the server being edited and without a restart.
- A bot written by the composition is listed and cannot be changed from the surface.
- A bot's capability selections name only entries the deployment mounted; a submission naming anything else is refused and says so.
- A bot saved by a tenant administrator holds no standing and reaches no organization that administrator could not select themselves, checked against the stored record on every change.
- No sign-in binding can name a bot, and no channel can present one as a verified subject.
- A bot may ask a teammate and may not list, read or detect the teammate's sessions; a question and its answer are recorded in both sessions.
- Reaching outside the organization, exceeding the asking person's quota, or acting under a stronger permission preset each requires a human decision, fails closed when no answerer responds, and is recorded in the audit log.
- A room ends on its bound whatever its participants are doing, and writes one named conclusion into the session log.
- Every one of the above holds on the browser and the desktop client, in all three product shapes.

## Risks

**A bot with a standing is an account nobody signs in as.** Everything that assumes an actor is a human — attribution surfaces, quota pages, the audit log's reader — now has rows for actors that never sign in. Each of those surfaces has to say which it is showing, or an administrator reading usage will not know whose it is.

**The ask is a disclosure channel, and recording it is not the same as bounding it.** A bot that answers every question honestly leaks whatever it knows to whoever may ask. Team membership is the bound, and it is only as good as the administrator who wrote it.

**A room's cost is the product of its participants and its turns.** Four bots and twenty turns is eighty model requests for one conclusion, and the person who opened the room will not have estimated that. The bound is what makes the room affordable, and showing its remaining budget during the discussion is part of the feature rather than a refinement.

**The capability catalog is a deployment's responsibility and will look like a product gap.** An administrator who cannot find the skill they want will read it as missing from the product, when it is missing from their deployment's composition. The page has to say where the list comes from.

**Prompt text written by a tenant administrator reaches the model under a standing.** A persona is free text, and a bot runs with real capabilities. The permission preset and the approval gate are what hold; the persona must never be able to widen either, and the one thing that must not be configurable is that rule.
