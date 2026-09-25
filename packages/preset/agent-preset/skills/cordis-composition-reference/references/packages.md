# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-acp` | yes | Automation-only Agent Client Protocol server for driving lyness agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@lyness/lyn-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@lyness/lyn-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@lyness/lyn-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@lyness/lyn-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@lyness/lyn-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@lyness/lyn-api-tenant-controller` | no | Remote owner of the tenant-configuration surface: the calling tenant reads and saves its own configuration |
| `@lyness/lyn-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@lyness/lyn-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@lyness/lyn-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-attachment-local` | yes | Private content-addressed LYNESS_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@lyness/lyn-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@lyness/lyn-plugin-manager` | yes | Current-profile plugin and bundle management shared by lyn CLI, Web and agent tools |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-acp-app` | no | The lyn ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over lyn-base |
| `@lyness/lyn-brand-studio` | no | The lyn brand-studio profile bundle: generate a deployment brand from an icon PNG and a font, and apply it to a profile |
| `@lyness/lyn-headless` | yes | The lyn one-shot bundle: a direct core Agent/Session runner over lyn-base with no Host, HTTP, or browser layer |
| `@lyness/lyn-sdk-app` | yes | The lyn SDK profile bundle: stdio JSON-RPC serving and process lifecycle over lyn-base |
| `@lyness/lyn-web-app` | yes | The lyn browser-surface bundle: the web patch layer over lyn-base plus the runtime glue plugin (frontend dist serving, web-surface prompt, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@lyness/lyn-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@lyness/lyn-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@lyness/lyn-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@lyness/lyn-client-modules` | no | Client module system, dual-face: node half composes the __LYNESS_BOOT__ entry graph (incremental lyn.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@lyness/lyn-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@lyness/lyn-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@lyness/lyn-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@lyness/lyn-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@lyness/lyn-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@lyness/lyn-client-ui-brand-lyness` | no | lyness brand occupants for the Web client's sidebar and conversation hero slots |
| `@lyness/lyn-client-ui-brand-official` | no | Official lyness brand occupants for the Web client's sidebar slots |
| `@lyness/lyn-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@lyness/lyn-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@lyness/lyn-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@lyness/lyn-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@lyness/lyn-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@lyness/lyn-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@lyness/lyn-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@lyness/lyn-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@lyness/lyn-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@lyness/lyn-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@lyness/lyn-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@lyness/lyn-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@lyness/lyn-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@lyness/lyn-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@lyness/lyn-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@lyness/lyn-client-ui-plugin-manager` | yes | Plugin management for the lyn web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@lyness/lyn-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@lyness/lyn-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@lyness/lyn-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@lyness/lyn-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@lyness/lyn-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@lyness/lyn-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@lyness/lyn-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the lyn web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@lyness/lyn-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@lyness/lyn-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@lyness/lyn-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@lyness/lyn-client-ui-settings-plugins` | no | Built-in plugins settings section for the lyn web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@lyness/lyn-client-ui-settings-shell` | no | Settings page of the shell executor on the lyn web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@lyness/lyn-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the lyn web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@lyness/lyn-client-ui-settings-web-search` | no | Settings page of the DeepSeek web-search provider on the lyn web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@lyness/lyn-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@lyness/lyn-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@lyness/lyn-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@lyness/lyn-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@lyness/lyn-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@lyness/lyn-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@lyness/lyn-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@lyness/lyn-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@lyness/lyn-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@lyness/lyn-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@lyness/lyn-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@lyness/lyn-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@lyness/lyn-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@lyness/lyn-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for lyn web |
| `@lyness/lyn-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@lyness/lyn-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the lyness |
| `@lyness/lyn-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@lyness/lyn-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@lyness/lyn-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@lyness/lyn-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@lyness/lyn-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@lyness/lyn-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the lyness |
| `@lyness/lyn-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@lyness/lyn-agent-loop` | yes | The concrete agent loop plugin for the lyness |
| `@lyness/lyn-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode, native, or both |
| `@lyness/lyn-session` | no | Event-sourced session store for the lyness |
| `@lyness/lyn-system-prompt` | yes | System prompt assembly registry for the lyness |
| `@lyness/lyn-tools` | yes | Tool registry and execution pipeline for the lyness |

## credentials

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@lyness/lyn-credentials-local` | yes | File-backed credentials provider ($LYNESS_HOME/.env under the live process environment) for the lyness |
| `@lyness/lyn-deepseek-account-platform` | yes | Authorize DeepSeek accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-tool-present` | yes | Explicit workspace file delivery declarations for the lyness |
| `@lyness/lyn-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the lyness |

## document

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-experimental-agent-team` | yes | Implicit-root Agent Teams roster, durable peer mailbox, and shared task DAG |
| `@lyness/lyn-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@lyness/lyn-experimental-auto-review` | no | Per-tool LLM authorization review for the lyness Auto permission preset |
| `@lyness/lyn-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@lyness/lyn-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@lyness/lyn-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@lyness/lyn-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@lyness/lyn-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@lyness/lyn-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@lyness/lyn-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@lyness/lyn-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@lyness/lyn-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the lyness PTC execution seam |
| `@lyness/lyn-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@lyness/lyn-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@lyness/lyn-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |

## extensions

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@lyness/lyn-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@lyness/lyn-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@lyness/lyn-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@lyness/lyn-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-fs-local` | yes | Local-filesystem implementation of the lyness filesystem seam (ctx.fs) |
| `@lyness/lyn-fs-observation-policy` | no | File-context policy plugin for the lyness — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@lyness/lyn-fs-sandbox` | yes | Sandbox-enforcing implementation of the lyness filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@lyness/lyn-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the lyness filesystem seam (ctx.fs) |
| `@lyness/lyn-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@lyness/lyn-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@lyness/lyn-goal` | yes | Event-sourced same-session goal state and lifecycle service for the lyness |
| `@lyness/lyn-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@lyness/lyn-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@lyness/lyn-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## hooks

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the lyness interception seams |
| `@lyness/lyn-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the lyness interception seams |

## host

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-host-brand-deployment` | yes | The deployment's own brand over the webserver index render: title, favicon, theme colour, and the asset files an operator places |
| `@lyness/lyn-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the lyness web GUI host |
| `@lyness/lyn-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@lyness/lyn-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the lyness web GUI host |
| `@lyness/lyn-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@lyness/lyn-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@lyness/lyn-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@lyness/lyn-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@lyness/lyn-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-commands` | no | Plugin-owned human command registry for lyness UIs |
| `@lyness/lyn-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the lyness: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@lyness/lyn-tool-ask-user` | no | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@lyness/lyn-user-approval` | yes | User-approval seam (ctx.approval) for the lyness: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@lyness/lyn-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-jobs-local` | yes | Process-local implementation of the lyness background job registry seam |
| `@lyness/lyn-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@lyness/lyn-llm` | no | Provider-neutral LLM service interface for the lyness |
| `@lyness/lyn-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@lyness/lyn-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@lyness/lyn-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the lyness LLM seam (design-verification twin of lyn-llm-deepseek) |
| `@lyness/lyn-llm-retry` | yes | Provider-routed LLM request retry policy for the lyness |
| `@lyness/lyn-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@lyness/lyn-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the lyness |

## lsp

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the lyness — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@lyness/lyn-lsp-stdio` | yes | Generic stdio language-server provider for the lyness LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@lyness/lyn-tool-lsp` | yes | Model-facing lsp tool over the lyness LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@lyness/lyn-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@lyness/lyn-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@lyness/lyn-persona` | yes | Composition-authored deployment persona section for the lyness |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-ptc-runtime-node` | yes | Sandboxed Node process implementation of the lyness PTC execution capability |

## runtime-diagnostics

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-invariants` | yes | Registry service for package-owned lyness runtime invariants |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-sandbox-local` | yes | Local process-sandbox backends for the lyness sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@lyness/lyn-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |

## sdk

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process lyness SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@lyness/lyn-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@lyness/lyn-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the lyness |
| `@lyness/lyn-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@lyness/lyn-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@lyness/lyn-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the lyness |
| `@lyness/lyn-session-telemetry-otel` | yes | OpenTelemetry backend for the lyness telemetry seam: hands captured session records to the OTel JS SDK's log pipeline |
| `@lyness/lyn-session-title` | yes | Log-backed session title service and provider registry for the lyness |
| `@lyness/lyn-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for lyness session titles |
| `@lyness/lyn-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for lyness session titles |
| `@lyness/lyn-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the lyness |

## session-query

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@lyness/lyn-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |
| `@lyness/lyn-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |

## settings

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-settings` | no | Abstract user-settings seam (ctx.settings) for the lyness |

## shell

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-bash-local` | yes | Local-subprocess implementation of the lyness bash executor seam |
| `@lyness/lyn-bash-sandbox` | yes | Sandbox-consuming implementation of the lyness bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@lyness/lyn-pwsh-local` | yes | Local PowerShell implementation of the lyness bash executor seam |
| `@lyness/lyn-pwsh-sandbox` | yes | Sandbox-consuming implementation of the lyness PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@lyness/lyn-shell-env` | yes | Tool-independent managed LYNESS_* shell environment registry |
| `@lyness/lyn-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@lyness/lyn-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@lyness/lyn-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@lyness/lyn-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-skill` | yes | Agent skill provider registry for the lyness |
| `@lyness/lyn-skill-badge` | no | Bundled lyn badge skill provider for lyness |
| `@lyness/lyn-skill-filesystem` | yes | Local filesystem skill provider for the lyness |
| `@lyness/lyn-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and structural checks |
| `@lyness/lyn-tool-skill` | yes | Model-facing skill loading tool for the lyness |
| `@lyness/lyn-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-spill-local` | yes | Local-filesystem implementation of the lyness spill storage seam (private session-scoped files) |
| `@lyness/lyn-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@lyness/lyn-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@lyness/lyn-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@lyness/lyn-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the lyness |
| `@lyness/lyn-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the lyness |
| `@lyness/lyn-storage-json` | yes | JSON file KV storage backend for the lyness storage hub |
| `@lyness/lyn-storage-sqlite` | yes | SQLite storage backend (kv facet) for the lyness storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@lyness/lyn-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@lyness/lyn-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@lyness/lyn-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@lyness/lyn-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@lyness/lyn-subagent-lyn-sdk` | yes | Out-of-process SDK subagent backend: drives a child lyness runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@lyness/lyn-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@lyness/lyn-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@lyness/lyn-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-subprocess-local` | no | Local-subprocess implementation of the lyness subprocess seam |

## tenant

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-tenant-config-static` | yes | Tenant configuration backed by the deployment's composition config: models, providers, features, identity, and copy as patch-layer rows |
| `@lyness/lyn-tenant-config-store` | no | Durable tenant configuration: one record per tenant in the storage domain, writable by an administration surface |
| `@lyness/lyn-tenant-http` | yes | Resolves the tenant an HTTP request belongs to, from the tenant header, the hostname, or a subdomain slug |
| `@lyness/lyn-tenant-request` | yes | The tenant one RPC request belongs to: resolved once per call and readable by everything the call reaches |
| `@lyness/lyn-tenant-session` | yes | Records the tenant a session belongs to, and the identity text that tenant contributed, as one durable session event |
| `@lyness/lyn-tenant-static` | yes | Tenant directory backed by the deployment's composition config: the roster is patch-layer rows |

## terminal

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-terminal` | no | Persistent PTY session seam for the lyness — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@lyness/lyn-terminal-bash` | yes | Persistent shell PTY backend over the lyness subprocess terminal primitive |
| `@lyness/lyn-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |

## test-support

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-tool-todo` | yes | Model-facing todo_write tool over the lyness event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the lyness web capability seam (ctx.web) |
| `@lyness/lyn-web` | yes | Abstract web access capability seam (ctx.web) for the lyness — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@lyness/lyn-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the lyness web capability seam (ctx.web) |
| `@lyness/lyn-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the lyness web capability seam (ctx.web) |
| `@lyness/lyn-web-search-exa` | yes | Exa-backed search provider for the lyness web capability seam (ctx.web) |
| `@lyness/lyn-web-search-perplexity` | yes | Perplexity-backed search provider for the lyness web capability seam (ctx.web) |

## webhook

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed lyness Sessions |
| `@lyness/lyn-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the lyness webhook runtime |

## workflow

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@lyness/lyn-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@lyness/lyn-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@lyness/lyn-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the lyness |
