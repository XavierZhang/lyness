# What changed in each release

English | [中文](changelog.zh.md)

One entry per released version, newest first. Each entry says what a reader of this product gains, loses, or has to do, in that order; the per-change migration steps live in [the upgrade guides](../../upgrade-guide), which this page links rather than restates.

A version appears here once it has a tag. An entry is written when the change lands, not when the version ships, so an unreleased section accumulates until it is tagged.

## Unreleased

### Added

- **Your conversations are yours to take and to delete.** A personal page lists every conversation a person can open, downloads any of them as the same archive the conversation's own menu offers, and deletes one for good. A deletion removes the conversation's stored log and the logs of any work it delegated, and it removes nothing else: it asks on the row first, it cannot be undone, and the page states that an uploaded file's bytes are stored by their contents and stay. A conversation that is still open is refused with that reason rather than removed underneath itself, and nobody reaches another person's conversation — one that belongs to somebody else answers exactly as one that never existed.
- **A page saying what you may use.** One personal page lists the models, connections, skills and tools a person's conversations actually have, each naming whether this deployment or their agent preset made it available. Every row is projected from the registries an agent itself reads, at the moment the page is opened, so it cannot disagree with what the agents have. Nothing on it is the person's to change, and it says so — it is the one answer to the question four administration pages used to answer with a refusal notice.
- **A memory page, and memories that belong to somebody.** A person reads what their agents kept about them and forgets any of it, on a personal Settings page. Underneath, a remembered fact now belongs to the person whose conversation asked for it: their own facts reach their own requests and nobody else's, and `memory_list` and `memory_forget` reach exactly what that conversation may see. Facts the deployment keeps for everyone stay shared, and so does everything written before this release, which no reader loses.
- **Your own instructions.** A person writes what their own agents should keep in mind, on a personal Settings page. Every conversation they start afterwards carries that text in its own log and composes it into the prompt between the organization's rules and the agent's persona; a conversation already open keeps the instructions it started with. The deployment with no accounts has one operator, who has instructions of their own like anybody else.
- **Personal plane in Settings.** A person reads and changes what is theirs — their own instructions, their memories, what they may use, and their own conversation data — separately from what an administrator maintains. The navigation now groups its sections into a personal plane and an administration plane, and offers the administration plane only to a standing that administers something: a deployment with no accounts, or a role above `member`. The split is navigation, not authority — every administrative call keeps its own check.
- **Japanese, Spanish, French, German, Russian and Portuguese** across the browser and desktop clients, alongside English and Chinese. Every shipped plugin now carries its name and description in all eight.
- **Brand setup from a loopback page.** `lyn --profile brand-setup` prints a one-time token and serves a page that writes a deployment's own brand — name, icon, theme colour — into a profile's patch layer. It binds `127.0.0.1` only and ends with the process.

### Changed

- **Terminals, the `ralph` tool, session search, the badge skill and webhook ingress stay in the default product.** Upstream moved these to its experimental group; this installation keeps them where an enterprise deployment finds them already on.
- **Telemetry stays off and now proves it.** Session upload ships `DISABLED` with no endpoint, and a behaviour test asserts that giving feedback under the default environment produces no outbound request at all. Desktop product analytics reach only the collector an operator names through `LYNESS_PRODUCT_ANALYTICS_OTLP_URL`; there is no vendor default.
- **Every Remote namespace declares the standing it requires.** A call that does not hold it is refused at the one point every wire call passes through, rather than inside each method.

### Fixed

- **`lyn --profile brand-setup --help` prints help and exits.** It previously started the server, bound a port and never returned.
- **The hosted and enterprise profiles carry accounts and credits.** Both selected those modules, but the installation did not depend on them, so the launcher skipped them with a warning and the deployment ran without either.
- **Session attribution is recorded again.** Mounting session ownership had begun to fail session creation outright; the owner and tenant records are now written at the first point a new session accepts an event.

-----

<a id="how-to-read-an-entry"></a>
## How to read an entry

**Added** is a capability that was not there. **Changed** is one that behaves differently, including a default a deployment may have relied on. **Fixed** is a defect a reader could have hit. A change that needs steps on upgrade carries a link to its guide; one that needs none says so by having no link.

Entries name what a person or an operator sees. A refactor nobody can observe does not appear here — [the Agent Notes](../../../.agents/notes/README.md) carry that history.
