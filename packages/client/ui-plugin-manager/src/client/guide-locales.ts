/**
 * The plugin development manual, kept apart from the page's own controls.
 *
 * The same ground is covered for the agent by the shipped
 * `cordis-plugin-development` skill; this is the version a person reads, so
 * the two are written for different readers and neither derives from the other.
 */

/** Simplified Chinese dictionary and key source of truth. */
export const guideZh = {
  devGuideOpen: '插件开发手册',
  devGuideTitle: '开发一个插件',
  devGuideIntro: '插件就是一个声明了 bundle 的 npm 包。它可以给 agent 添加工具与服务、给界面添加组件，或者只是接上一个 MCP 服务器。',
  devGuideSections: '手册章节',
  devGuideCopy: '复制',
  devGuideCopied: '已复制',
  devGuideFootnotes: '脚注',

  devGuideOverviewTab: '从这里开始',
  devGuideOverview: [
    '### 插件是什么',
    '一个插件是一个普通的 npm 包，它的 `package.json` 声明了 `lyn.bundle.patch`。那份 YAML 补丁往组合里插入插件行；包本身提供这些行所命名的代码。没有专用的插件格式，也不需要构建工具。',
    '### 它装在哪里',
    '安装会把包加入当前 profile，并把它的补丁作为一层叠加在出厂各层之上。因此更改影响使用该 profile 的每一个会话，并在重启后仍然存在。开了热更新时立即生效，否则留到下次启动。',
    '### 两个面',
    '**宿主面**跑在 Harness 进程里：服务、工具、提示词、会话逻辑。**界面面**跑在浏览器里：组件、面板、装饰。一个包可以只有其中一面，也可以两面都有。',
    '### 三条最短路径',
    '只接一个 MCP 服务器 → 只需要清单与补丁，不需要任何代码。给 agent 加一个工具 → 宿主面。往页面上加点东西 → 界面面。',
    '### 先装上，再打磨',
    '把第一版做小，装上去看它真的在跑，再去改细节。已安装的插件本身就是最好的预览——不要先去做静态预览页或模拟外壳。',
  ].join('\n\n'),

  devGuideHostTab: '宿主插件',
  devGuideHost: [
    '### 清单',
    '只有宿主面的 bundle 不需要依赖、安装脚本或构建工具：',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### 补丁',
    '补丁插入以包命名的那一行。包名与行 id 都要唯一：',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### 入口',
    '`index.js` 导出一个函数插件：`name`、`inject`、`Config`、`apply`，没有默认导出；或者导出一个服务类作为默认导出。两种形式不要混用。',
    '**每一项贡献都是一个 effect**：工具、监听器、提示词段都经 `ctx.effect()` 或 `ctx.on()` 注册，并由它们的 disposer 收回。这是插件能被热更新与卸载的原因。',
    '### 启用一个出厂但默认关闭的插件',
    '出厂 bundle 可以把某一行留在 `disabled`。写一个你自己的 bundle，其补丁用 `disabled: false` 覆盖那一行，并插入它依赖的宿主行。随 {brandAbbr} 一同出厂的包从 {brandAbbr} 安装目录解析，所以你的 bundle 不用声明对它们的依赖。',
  ].join('\n\n'),

  devGuideUiTab: '界面插件',
  devGuideUi: [
    '### 清单多出一节',
    '界面面在清单里加一个 `lyn.client` 节和一个 `./client` 导出：',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### 选一个席位',
    '界面组件注册进**席位**。优先选一个本来就为你留了空间的席位，而不是围着宿主控件去规划一条浮动路径。只有在确实需要浮层且位置已确定时才用浮层席位。',
    '不要读另一个插件的 DOM、样式表或组件源码去推测位置；选一个已经分配了空间的席位。',
    '### 浏览器产物',
    '客户端模块注册一个懒加载工厂，其 id 等于包名。React 来自浏览器模块表——不需要重复安装 React、不需要 CDN 脚本、不需要找 UMD 包。',
    '**工厂里不要有副作用。** 样式、定时器、监听器都在 `apply` 里用 `ctx.effect`／`ctx.on` 注册并返回清理函数。容器与控件继承宿主主题；图形本身可以用自己的颜色。',
    '### 文案走本地化',
    '所有可见文本经客户端本地化服务，不要把中文或英文字面量写在组件里。',
  ].join('\n\n'),

  devGuideMcpTab: '接 MCP 服务器',
  devGuideMcp: [
    '### 不需要写代码',
    '只做配置的 bundle 只需要一个唯一的名字、一个版本、和 `lyn.bundle.patch`——没有宿主或界面入口文件。',
    '### 补丁',
    '补丁插入已经装好的 MCP 客户端，并填上你的服务器：',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'stdio 传输则用 `transport: stdio` 加 `command`，以及可选的 `args`、`env`、`cwd`。',
    '### 验证',
    '安装之后调用 `mcp__demo__ping` 或其他新出现的 `mcp__<serverName>__<工具>`。失败时修同一个 bundle，不要再建一个。',
    '### 凭据',
    '环境里的凭据会被清洗掉。用 Loader 的 `!!js` 去引用已有的凭据，不要把密钥抄进配置文本里。',
  ].join('\n\n'),

  devGuideInstallTab: '安装与验证',
  devGuideInstall: [
    '### 从本地目录安装',
    '在"添加插件"里填你的插件目录的绝对路径。开发中就用这条路径——不需要先发布。',
    '### 安装前会检查什么',
    '安装会先解析你的包所声明的 {brandAbbr} peer 版本范围，与正在运行的版本比对。**不兼容的插件在 pnpm 运行之前就被拒绝**，所以不会下载任何东西、也不会跑任何安装脚本。',
    '确实需要装一个不兼容的版本时，可以为精确的"包@版本 × 运行时版本"记录一条豁免。豁免不会被插件升级或 {brandAbbr} 升级继承——每一对都要单独授权。',
    '### 失败会回滚',
    '失败、取消，或者装上了一个不含 bundle 补丁的包，都会把 `package.json` 与 lockfile 还原成原样。',
    '### 验证到哪一步',
    '检查 JavaScript 语法与清单，装上去，然后用正在运行的插件本身作为预览。不要为了截一张图去启动另一个浏览器、改 `HOME`、翻个人浏览器配置或动钥匙串。模拟页面的截图不能算作对正在运行的插件的验证。',
    '### 安全',
    '只装你信任的插件：它们以你的权限运行，可以损坏数据或把数据带走。',
  ].join('\n\n'),
} satisfies Record<string, string>

/** Guide locale key. */
export type PluginDevGuideKey = keyof typeof guideZh

/** English dictionary. */
export const guideEn = {
  devGuideOpen: 'Plugin development manual',
  devGuideTitle: 'Develop a plugin',
  devGuideIntro: 'A plugin is an npm package that declares a bundle. It can add tools and services for the agent, add components to the interface, or just connect an MCP server.',
  devGuideSections: 'Manual sections',
  devGuideCopy: 'Copy',
  devGuideCopied: 'Copied',
  devGuideFootnotes: 'Footnotes',

  devGuideOverviewTab: 'Start here',
  devGuideOverview: [
    '### What a plugin is',
    'A plugin is an ordinary npm package whose `package.json` declares `lyn.bundle.patch`. That YAML patch inserts plugin rows into the composition; the package supplies the code those rows name. There is no special plugin format and no build tool is required.',
    '### Where it installs',
    'Installing adds the package to the current profile and applies its patch as a layer over the shipped ones. Changes therefore affect every session using that profile and survive restart. With hot reload on they apply immediately; otherwise they wait for the next start.',
    '### Two faces',
    'The **Host face** runs in the Harness process: services, tools, prompts, session logic. The **interface face** runs in the browser: components, panels, decorations. A package may have one face or both.',
    '### Three shortest paths',
    'Connect an MCP server — manifest and patch only, no code. Add a tool for the agent — the Host face. Put something on the page — the interface face.',
    '### Install first, refine after',
    'Keep the first version small, install it, see it actually running, then change details. The installed plugin is the best preview — do not build a static preview page or a mock shell first.',
  ].join('\n\n'),

  devGuideHostTab: 'Host plugin',
  devGuideHost: [
    '### The manifest',
    'A Host-only bundle needs no dependencies, install scripts, or build tool:',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### The patch',
    'The patch inserts a row named after the package. Both the package name and the row id must be unique:',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### The entry',
    '`index.js` exports either a function plugin — `name`, `inject`, `Config`, `apply`, with no default export — or a service class as the default export. Do not mix the two forms.',
    '**Every contribution is an effect**: tools, listeners, and prompt sections register through `ctx.effect()` or `ctx.on()` and are withdrawn by their disposers. That is what makes a plugin hot-reloadable and removable.',
    '### Enable a shipped plugin that is off',
    'A shipped bundle can leave a row `disabled`. Write your own bundle whose patch overrides that row with `disabled: false` and inserts the Host rows it depends on. Packages shipped with {brandAbbr} resolve from the {brandAbbr} installation, so your bundle declares no dependency on them.',
  ].join('\n\n'),

  devGuideUiTab: 'Interface plugin',
  devGuideUi: [
    '### One more manifest section',
    'The interface face adds a `lyn.client` section and a `./client` export:',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Choose a slot',
    'Interface components register into **slots**. Prefer a slot that already allocates space to you over planning a floating path around host controls. Use an overlay slot only when the result genuinely needs an overlay and its placement is known.',
    'Do not read another plugin\'s DOM, stylesheet, or component source to estimate placement; choose a slot that already allocates space.',
    '### The browser artifact',
    'The client module registers a lazy factory whose id equals the package name. React comes from the browser module table — no duplicate React installation, no CDN script, no UMD hunt.',
    '**Keep factories free of side effects.** Register styles, timers, and listeners inside `apply` with `ctx.effect`/`ctx.on` and return their cleanup. Containers and controls inherit the host theme; artwork may use its own colors.',
    '### Copy goes through locales',
    'Route every visible string through the Client locale service rather than writing it into the component.',
  ].join('\n\n'),

  devGuideMcpTab: 'Connect MCP',
  devGuideMcp: [
    '### No code needed',
    'A configuration-only bundle needs a unique name, a version, and `lyn.bundle.patch` — no Host or interface entry files.',
    '### The patch',
    'The patch inserts the already installed MCP client and names your server:',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'For stdio, use `transport: stdio` with `command`, plus optional `args`, `env`, and `cwd`.',
    '### Verify',
    'After installing, call `mcp__demo__ping` or another newly available `mcp__<serverName>__<tool>`. On failure repair the same bundle rather than creating a second one.',
    '### Credentials',
    'Ambient credentials are scrubbed. Reference existing credentials with the Loader\'s `!!js` rather than copying secrets into configuration text.',
  ].join('\n\n'),

  devGuideInstallTab: 'Install and verify',
  devGuideInstall: [
    '### Install from a local directory',
    'Give **Add plugin** the absolute path of your plugin directory. Use that path while developing — nothing has to be published first.',
    '### What is checked before installing',
    'Installation resolves the {brandAbbr} peer version range your package declares and compares it with the running version. **An incompatible plugin is refused before pnpm runs**, so nothing is downloaded and no install script executes.',
    'When an incompatible version really must be installed, an exemption can be recorded for an exact package-and-version against an exact runtime version. Exemptions are inherited by neither plugin upgrades nor {brandAbbr} upgrades — each pair is granted on its own.',
    '### Failure rolls back',
    'A failure, a cancellation, or a package that turns out to carry no bundle patch all restore `package.json` and the lockfile as they were.',
    '### How far to verify',
    'Check the JavaScript syntax and the manifest, install, then use the running plugin itself as the preview. Do not launch a separate browser, change `HOME`, inspect personal browser profiles, or touch keychains to obtain a screenshot. A screenshot of a mock page is not verification of the running plugin.',
    '### Safety',
    'Install only plugins you trust: they run with your permissions and can damage or leak your data.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>
