# Agent Note: A personal plane, and what belongs to the person

Status: proposed

English | [中文](2026-10-28-the-personal-plane.zh.md)

## Problem

Settings is one list, and it mixes two different questions. `general`, `models`, `credits` and `plugins` are about what this reader works with; `people`, `bots`, `sign-in-channels` and `history` are about what an organization or the deployment maintains. A member who opens Settings is offered all of them and reads a refusal notice inside four, and every one of those sections records the same limitation in its own README: the section is offered to every reader because the navigation cannot know the caller's standing before the section's own read answers.

The mixing hides a second gap. Three things a person is entitled to have no home at all.

Their own limit is one. Until this week an account answered a balance and nothing else, so a person could not tell a quiet day from a lowered allowance; the balance now carries the effective allowance, the period, when it began and what it has cost, and the credits section shows it to every reader. That is the pattern the rest should follow, not an exception.

Their own instructions are the second. The recorded prompt layering is platform, organization, user, agent, and three of the four now exist: the deployment persona, the tenant identity composed from a session's own record, and the agent's own persona or a bot's. The user layer has never had a record to carry it. `lyn-agent-instructions` reads `AGENTS.md` from disk, which is the right answer for somebody sitting at their own machine and no answer at all for somebody using a browser against a hosted deployment.

What is remembered about them is the third. `lyn-memory` already separates `member` from `shared` scope, so the facts a person asked to remember are distinguishable from the ones a workspace shares — and nothing shows a person either set, or lets them remove one.

## Proposal

Split Settings into two planes, and let the personal plane be the place a person reads and changes what is theirs.

**Two planes, one read.** `identity.viewer()` already answers the caller's standing with its role and organization. Promote that read from `ui-sign-in`'s own store to a client service every surface may read, and let the Settings navigation group sections by plane: the personal plane always, the administration plane only for a standing whose role is not `member`. One read decides it, so the navigation and the account row share one answer rather than each asking.

**The personal plane offers only what the person can change, and names what they cannot.** This is the tradeoff that separates this design from a copy of a competitor's settings list. In a product where models, presets, skills, plugins and MCP servers are composed by a deployment, most of what ChatGPT, Claude and Cursor put under personal settings is not the person's to set here. A plane that offered those controls would promise what the next call refuses, which the repo already forbids for one section at a time. So each entry either carries a control the person owns, or reads as what they may use and who decided it.

### Where each concept lands, and who decides

| Concept competitors offer | Plane here | Who decides | State today |
|---|---|---|---|
| Name, sign-in identity, standing, sign out | Personal | the directory; the person signs out | `identity.viewer()` answers it; only the sidebar row shows it |
| Usage, limit, reset, remaining | Personal | an administrator sets the limit | shipped |
| The organization's budget and spend | Administration | the platform sets it, the organization reads it | shipped |
| Custom instructions, rules, "what to call me" | Personal | the person | **missing**: the user layer of the prompt has no record |
| Memory: what is remembered about me | Personal | the person and their agents | stored with `member` scope; no surface |
| Appearance, text size, language | Personal | the person | shipped, inside `general` |
| Keyboard shortcuts | Personal | the person | shipped, inside `general` |
| Connections and MCP servers | Administration, read-only in Personal | the deployment composes them | `mcp-client` is configured per entry in composition |
| Skills | read-only in Personal | the preset the person's agents run | `ui-skill` invokes them; nothing lists what a person may use |
| Plugins and extensions | Administration, read-only in Personal | the deployment | the Plugins page already exists |
| Models | Administration, read-only in Personal | the deployment and the tenant's model list | the Models page already exists |
| Agent presets | Administration | the deployment | shipped |
| Data: export, delete my conversations | Personal | the person | `session-query` exports; no personal surface |

Two rows in that table are the whole design, and the rest is placement. **Instructions** needs a record, because a hosted person has no file. **Memory** needs a surface, because the record already exists.

**The user layer composes the way the organization layer does.** A personal instruction is stored for the person, written into a session's own log when that session is created, and composed into the prompt from the log rather than from the stored record — for the reason the tenant identity is: a person editing their instructions must not change what a running conversation already said, and anything that reaches a model request has to be reconstructable from the session log. The section order sits between the organization's and the agent's, which is what the recorded layering means by no lower layer removing a higher one.

**A read-only entry says who decided.** "What you may use" lists the skills, tools, connections and models this reader's agents actually have, each naming the preset or the deployment that gave it. It is one answer to the question every one of those pages currently answers with a refusal notice, and it costs no new authority.

## Alternatives considered

**Keep one flat list and let each section report its own refusal.** This is today. It costs a member four dead ends, and the fix has to be written once per section rather than once; four READMEs already carry the limitation as evidence that the shape is wrong rather than the sections.

**Give the personal plane its own route instead of a plane inside Settings.** The shell, the slot kinds, the locale namespaces and the store machinery all exist for sections, and a second route would duplicate them for no behaviour the reader can name. Worth revisiting when the personal plane grows a surface that is not a settings page.

**Copy a competitor's section list.** Rejected because the composition model is different, not because the lists are bad. A page offering a person their own MCP server list, when servers come from composition, would be a control the product refuses — and the repo's own rule is that a surface renders its control from the same answer that fills it.

**Make instructions a file, as `AGENTS.md` already is.** This keeps one mechanism and serves the desktop shape well. It serves the hosted shape not at all: there is no user-global file a browser can edit, and the three product shapes each have to be served or named. A stored record serves all three, and the file chain stays what it is for a workspace.

## Acceptance criteria

- The Settings navigation shows the administration plane only to a standing whose role is not `member`, decided by one viewer read that the account row shares.
- A member opening Settings reaches no section whose own read answers a refusal.
- A person reads and edits their own instructions, and a session created afterwards carries them in its own log and composes them into its prompt between the organization's layer and the agent's.
- A person reads the `member`-scoped memories recorded for them and removes one.
- A person reads what their agents may use — skills, tools, connections, models — each naming what gave it.
- Every personal entry either carries a control the person owns or says who decided what it reports.

## Risks

**The plane split is a visibility decision, and a wrong read of a standing hides the wrong thing.** Hiding the administration plane is navigation, not authority: every administrative call keeps its own check, so a viewer read that answered wrongly would show or hide a page without granting anything. That is the property to keep — the split must never become the only thing standing between a member and an administrative operation.

**A personal instruction is text a person writes that reaches their own model requests.** It is appended after the deployment's and the organization's sections for the same reason a tenant's is, so it cannot widen what an agent may do; and it is recorded in the session log, so what reached the model is readable afterwards. A deployment that wants to forbid it needs a composition row it can leave out, not a setting inside the plane.

**"What you may use" can grow into a second answer about capabilities.** It must project the same registries the agent reads, at the moment it is asked, rather than keep a list of its own — otherwise it becomes a page that disagrees with what the agent actually has.
