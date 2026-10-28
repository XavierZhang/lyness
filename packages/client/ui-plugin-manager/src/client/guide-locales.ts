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

/**
 * Japanese dictionary. Code blocks, manifest field names and option values are
 * the English ones verbatim: they are the API, not copy.
 */
export const guideJa = {
  devGuideOpen: 'プラグイン開発マニュアル',
  devGuideTitle: 'プラグインを開発する',
  devGuideIntro: 'プラグインとは bundle を宣言した npm パッケージです。エージェントにツールやサービスを足し、画面にコンポーネントを足し、あるいは MCP サーバーをつなぐだけのこともできます。',
  devGuideSections: 'マニュアルの章',
  devGuideCopy: 'コピー',
  devGuideCopied: 'コピーしました',
  devGuideFootnotes: '脚注',

  devGuideOverviewTab: 'ここから',
  devGuideOverview: [
    '### プラグインとは',
    'プラグインは、`package.json` が `lyn.bundle.patch` を宣言したごく普通の npm パッケージです。その YAML パッチが組み合わせにプラグイン行を挿入し、パッケージ側がその行の名づけるコードを提供します。専用のプラグイン形式はなく、ビルドツールも不要です。',
    '### どこに入るか',
    'インストールはパッケージを現在のプロファイルに加え、そのパッチを出荷時の各層の上に一層として重ねます。したがって変更はそのプロファイルを使うすべてのセッションに及び、再起動後も残ります。ホットリロードが有効なら即座に、そうでなければ次回起動時に効きます。',
    '### 二つの面',
    '**ホスト面**は Harness プロセスの中で動きます——サービス、ツール、プロンプト、セッションのロジック。**画面面**はブラウザの中で動きます——コンポーネント、パネル、装飾。パッケージはどちらか一方でも、両方でもかまいません。',
    '### 最短の三経路',
    'MCP サーバーをつなぐだけ — 清単とパッチのみ、コード不要。エージェントにツールを足す — ホスト面。ページに何かを置く — 画面面。',
    '### まず入れて、あとで磨く',
    '最初の版は小さく保ち、入れて、実際に動くのを見てから細部を変えます。入れたプラグインそのものが最良のプレビューです——静的なプレビューページやモックの外枠を先に作らないでください。',
  ].join('\n\n'),

  devGuideHostTab: 'ホストプラグイン',
  devGuideHost: [
    '### 清単',
    'ホスト面だけの bundle には依存、インストールスクリプト、ビルドツールのいずれも不要です：',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### パッチ',
    'パッチはパッケージの名を冠した一行を挿入します。パッケージ名と行 id はどちらも一意でなければなりません：',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### 入口',
    '`index.js` は関数プラグイン（`name`、`inject`、`Config`、`apply`。デフォルトエクスポートなし）か、サービスクラスをデフォルトエクスポートするかのいずれかを公開します。二つの形式を混ぜないでください。',
    '**すべての貢献は effect です**：ツール、リスナー、プロンプト段は `ctx.effect()` または `ctx.on()` 経由で登録され、その disposer によって取り下げられます。これがプラグインをホットリロード可能かつ取り外し可能にしているものです。',
    '### 出荷済みだが無効なプラグインを有効にする',
    '出荷 bundle は行を `disabled` のまま置けます。自分の bundle を書き、そのパッチでその行を `disabled: false` で上書きし、依存するホスト行を挿入します。{brandAbbr} と共に出荷されるパッケージは {brandAbbr} のインストール先から解決されるため、あなたの bundle はそれらへの依存を宣言しません。',
  ].join('\n\n'),

  devGuideUiTab: '画面プラグイン',
  devGuideUi: [
    '### 清単にもう一節',
    '画面面は清単に `lyn.client` の節と `./client` エクスポートを加えます：',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### 席を選ぶ',
    '画面コンポーネントは**席**に登録します。ホスト側の操作部を避けて浮かせる経路を設計するより、すでに場所を割り当ててくれる席を選んでください。本当に浮層が必要で、その位置が決まっているときにだけ浮層の席を使います。',
    '他のプラグインの DOM、スタイルシート、コンポーネントのソースを読んで位置を推し量らないでください。すでに場所を割り当てている席を選びます。',
    '### ブラウザ側の成果物',
    'クライアントモジュールは、id がパッケージ名と等しい遅延ファクトリを登録します。React はブラウザのモジュール表から来ます——React の重複インストール、CDN スクリプト、UMD 探しはいずれも不要です。',
    '**ファクトリに副作用を置かないでください。** スタイル、タイマー、リスナーは `apply` の中で `ctx.effect`／`ctx.on` を使って登録し、その後片付けを返します。容器と操作部はホストのテーマを継ぎます。図形そのものは独自の色を使ってかまいません。',
    '### 文案はロケール経由で',
    '見えるすべての文字列を、コンポーネントに書き込むのではなくクライアントのロケールサービス経由にしてください。',
  ].join('\n\n'),

  devGuideMcpTab: 'MCP をつなぐ',
  devGuideMcp: [
    '### コードは不要',
    '設定だけの bundle には一意の名前、バージョン、`lyn.bundle.patch` が必要です——ホストや画面の入口ファイルはありません。',
    '### パッチ',
    'パッチはすでに入っている MCP クライアントを挿入し、あなたのサーバーを指定します：',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'stdio の場合は `transport: stdio` と `command`、任意で `args`、`env`、`cwd` を使います。',
    '### 検証',
    'インストール後に `mcp__demo__ping`、または新たに現れた別の `mcp__<serverName>__<tool>` を呼びます。失敗したら、二つ目を作るのではなく同じ bundle を直します。',
    '### 資格情報',
    '環境中の資格情報は洗い落とされます。秘密を設定テキストに写すのではなく、Loader の `!!js` で既存の資格情報を参照してください。',
  ].join('\n\n'),

  devGuideInstallTab: 'インストールと検証',
  devGuideInstall: [
    '### ローカルディレクトリからインストールする',
    '「プラグインを追加」にプラグインディレクトリの絶対パスを渡します。開発中はそのパスを使ってください——先に公開する必要はありません。',
    '### インストール前に何が検査されるか',
    'インストールはパッケージが宣言する {brandAbbr} の peer バージョン範囲を解決し、動作中のバージョンと比べます。**互換でないプラグインは pnpm が走る前に拒否される**ため、何もダウンロードされず、インストールスクリプトも実行されません。',
    '互換でないバージョンをどうしても入れる必要があるときは、厳密な「パッケージ＠バージョン × 実行時バージョン」の組に対して免除を記録できます。免除はプラグインのアップグレードにも {brandAbbr} のアップグレードにも継承されません——組ごとに個別の許可が必要です。',
    '### 失敗は巻き戻る',
    '失敗、取り消し、あるいは bundle パッチを持たないパッケージだったという結果は、いずれも `package.json` と lockfile を元のとおりに戻します。',
    '### どこまで検証するか',
    'JavaScript の構文と清単を確かめ、インストールし、そのうえで動作中のプラグイン自身をプレビューとして使います。スクリーンショットを得るために別のブラウザを起動したり、`HOME` を変えたり、個人のブラウザプロファイルを覗いたり、キーチェーンに触れたりしないでください。モックページのスクリーンショットは、動作中のプラグインの検証にはなりません。',
    '### 安全',
    '信頼できるプラグインだけを入れてください：それらはあなたの権限で動き、データを壊したり外に持ち出したりできます。',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>

/**
 * Spanish dictionary. Code blocks, manifest field names and option values are
 * the English ones verbatim: they are the API, not copy.
 */
export const guideEs = {
  devGuideOpen: 'Manual de desarrollo de complementos',
  devGuideTitle: 'Desarrollar un complemento',
  devGuideIntro: 'Un complemento es un paquete npm que declara un bundle. Puede añadir herramientas y servicios para el agente, añadir componentes a la interfaz, o solo conectar un servidor MCP.',
  devGuideSections: 'Secciones del manual',
  devGuideCopy: 'Copiar',
  devGuideCopied: 'Copiado',
  devGuideFootnotes: 'Notas al pie',

  devGuideOverviewTab: 'Empiece aquí',
  devGuideOverview: [
    '### Qué es un complemento',
    'Un complemento es un paquete npm corriente cuyo `package.json` declara `lyn.bundle.patch`. Ese parche YAML inserta filas de complemento en la composición; el paquete aporta el código que esas filas nombran. No hay un formato especial de complemento y no se requiere ninguna herramienta de compilación.',
    '### Dónde se instala',
    'Instalar añade el paquete al perfil actual y aplica su parche como una capa sobre las de fábrica. Los cambios afectan por tanto a cada sesión que use ese perfil y sobreviven al reinicio. Con la recarga en caliente activa se aplican de inmediato; si no, esperan al siguiente arranque.',
    '### Dos caras',
    'La **cara anfitriona** corre en el proceso de Harness: servicios, herramientas, prompts, lógica de sesión. La **cara de interfaz** corre en el navegador: componentes, paneles, decoraciones. Un paquete puede tener una cara o las dos.',
    '### Los tres caminos más cortos',
    'Conectar un servidor MCP — solo manifiesto y parche, sin código. Añadir una herramienta para el agente — la cara anfitriona. Poner algo en la página — la cara de interfaz.',
    '### Instale primero, refine después',
    'Mantenga pequeña la primera versión, instálela, véala correr de verdad y luego cambie detalles. El complemento instalado es la mejor vista previa: no construya antes una página de vista previa estática ni un armazón simulado.',
  ].join('\n\n'),

  devGuideHostTab: 'Complemento anfitrión',
  devGuideHost: [
    '### El manifiesto',
    'Un bundle solo anfitrión no necesita dependencias, scripts de instalación ni herramienta de compilación:',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### El parche',
    'El parche inserta una fila con el nombre del paquete. Tanto el nombre del paquete como el id de la fila deben ser únicos:',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### La entrada',
    '`index.js` exporta o un complemento de función — `name`, `inject`, `Config`, `apply`, sin exportación por defecto — o una clase de servicio como exportación por defecto. No mezcle las dos formas.',
    '**Cada contribución es un effect**: herramientas, escuchadores y secciones de prompt se registran mediante `ctx.effect()` o `ctx.on()` y se retiran con sus disposers. Eso es lo que hace a un complemento recargable en caliente y desmontable.',
    '### Activar un complemento de fábrica que está apagado',
    'Un bundle de fábrica puede dejar una fila en `disabled`. Escriba su propio bundle cuyo parche sobrescriba esa fila con `disabled: false` e inserte las filas anfitrionas de las que depende. Los paquetes que vienen con {brandAbbr} se resuelven desde la instalación de {brandAbbr}, así que su bundle no declara ninguna dependencia de ellos.',
  ].join('\n\n'),

  devGuideUiTab: 'Complemento de interfaz',
  devGuideUi: [
    '### Una sección más del manifiesto',
    'La cara de interfaz añade una sección `lyn.client` y una exportación `./client`:',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Elija un hueco',
    'Los componentes de interfaz se registran en **huecos**. Prefiera un hueco que ya le asigne espacio antes que planear una ruta flotante alrededor de los controles del anfitrión. Use un hueco superpuesto solo cuando el resultado necesite de verdad una superposición y su colocación sea conocida.',
    'No lea el DOM, la hoja de estilos ni el código de otro complemento para estimar la colocación; elija un hueco que ya asigne espacio.',
    '### El artefacto del navegador',
    'El módulo cliente registra una fábrica diferida cuyo id es igual al nombre del paquete. React viene de la tabla de módulos del navegador: sin instalación duplicada de React, sin script de CDN, sin buscar un UMD.',
    '**Mantenga las fábricas libres de efectos secundarios.** Registre estilos, temporizadores y escuchadores dentro de `apply` con `ctx.effect`/`ctx.on` y devuelva su limpieza. Los contenedores y controles heredan el tema del anfitrión; el dibujo puede usar sus propios colores.',
    '### El texto va por los locales',
    'Lleve cada cadena visible por el servicio de locales del cliente en vez de escribirla en el componente.',
  ].join('\n\n'),

  devGuideMcpTab: 'Conectar MCP',
  devGuideMcp: [
    '### Sin código',
    'Un bundle solo de configuración necesita un nombre único, una versión y `lyn.bundle.patch`: ningún archivo de entrada anfitrión ni de interfaz.',
    '### El parche',
    'El parche inserta el cliente MCP ya instalado y nombra su servidor:',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'Para stdio use `transport: stdio` con `command`, y opcionalmente `args`, `env` y `cwd`.',
    '### Verificar',
    'Tras instalar, llame a `mcp__demo__ping` u otra `mcp__<serverName>__<tool>` recién disponible. Si falla, repare el mismo bundle en vez de crear un segundo.',
    '### Credenciales',
    'Las credenciales del entorno se eliminan. Referencie credenciales existentes con el `!!js` del Loader en vez de copiar secretos al texto de configuración.',
  ].join('\n\n'),

  devGuideInstallTab: 'Instalar y verificar',
  devGuideInstall: [
    '### Instalar desde un directorio local',
    'Dé a **Añadir complemento** la ruta absoluta de su directorio de complemento. Use esa ruta mientras desarrolla: no hace falta publicar nada antes.',
    '### Qué se comprueba antes de instalar',
    'La instalación resuelve el rango de versiones peer de {brandAbbr} que declara su paquete y lo compara con la versión en ejecución. **Un complemento incompatible se rechaza antes de que corra pnpm**, así que no se descarga nada y no se ejecuta ningún script de instalación.',
    'Cuando de verdad haya que instalar una versión incompatible, puede registrarse una exención para un paquete y versión exactos frente a una versión de ejecución exacta. Las exenciones no las heredan ni las actualizaciones del complemento ni las de {brandAbbr}: cada par se concede por separado.',
    '### El fallo se revierte',
    'Un fallo, una cancelación, o un paquete que resulta no llevar parche de bundle, todos restauran `package.json` y el lockfile tal como estaban.',
    '### Hasta dónde verificar',
    'Compruebe la sintaxis de JavaScript y el manifiesto, instale, y luego use el propio complemento en ejecución como vista previa. No lance otro navegador, no cambie `HOME`, no inspeccione perfiles personales de navegador ni toque llaveros para obtener una captura. Una captura de una página simulada no es verificación del complemento en ejecución.',
    '### Seguridad',
    'Instale solo complementos en los que confíe: corren con sus permisos y pueden dañar o filtrar sus datos.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>

/**
 * French dictionary. Code blocks, manifest field names and option values are
 * the English ones verbatim: they are the API, not copy.
 */
export const guideFr = {
  devGuideOpen: 'Manuel de développement de plug-ins',
  devGuideTitle: 'Développer un plug-in',
  devGuideIntro: 'Un plug-in est un paquet npm qui déclare un bundle. Il peut ajouter des outils et des services pour l\'agent, ajouter des composants à l\'interface, ou simplement connecter un serveur MCP.',
  devGuideSections: 'Sections du manuel',
  devGuideCopy: 'Copier',
  devGuideCopied: 'Copié',
  devGuideFootnotes: 'Notes de bas de page',

  devGuideOverviewTab: 'Commencez ici',
  devGuideOverview: [
    '### Ce qu\'est un plug-in',
    'Un plug-in est un paquet npm ordinaire dont le `package.json` déclare `lyn.bundle.patch`. Ce correctif YAML insère des lignes de plug-in dans la composition ; le paquet fournit le code que ces lignes nomment. Il n\'existe pas de format de plug-in particulier et aucun outil de compilation n\'est requis.',
    '### Où il s\'installe',
    'L\'installation ajoute le paquet au profil courant et applique son correctif comme une couche par-dessus celles d\'usine. Les changements touchent donc chaque session utilisant ce profil et survivent au redémarrage. Avec le rechargement à chaud activé ils s\'appliquent aussitôt ; sinon ils attendent le prochain démarrage.',
    '### Deux faces',
    'La **face hôte** tourne dans le processus Harness : services, outils, prompts, logique de session. La **face interface** tourne dans le navigateur : composants, panneaux, décorations. Un paquet peut avoir une face ou les deux.',
    '### Les trois chemins les plus courts',
    'Connecter un serveur MCP — manifeste et correctif seulement, sans code. Ajouter un outil pour l\'agent — la face hôte. Mettre quelque chose sur la page — la face interface.',
    '### Installez d\'abord, affinez ensuite',
    'Gardez la première version petite, installez-la, voyez-la tourner réellement, puis changez les détails. Le plug-in installé est le meilleur aperçu : ne construisez pas d\'abord une page d\'aperçu statique ni une coquille simulée.',
  ].join('\n\n'),

  devGuideHostTab: 'Plug-in hôte',
  devGuideHost: [
    '### Le manifeste',
    'Un bundle uniquement hôte n\'a besoin ni de dépendances, ni de scripts d\'installation, ni d\'outil de compilation :',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### Le correctif',
    'Le correctif insère une ligne nommée d\'après le paquet. Le nom du paquet et l\'id de la ligne doivent tous deux être uniques :',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### Le point d\'entrée',
    '`index.js` exporte soit un plug-in fonction — `name`, `inject`, `Config`, `apply`, sans export par défaut — soit une classe de service en export par défaut. Ne mélangez pas les deux formes.',
    '**Chaque contribution est un effect** : outils, écouteurs et sections de prompt s\'enregistrent via `ctx.effect()` ou `ctx.on()` et sont retirés par leurs disposers. C\'est ce qui rend un plug-in rechargeable à chaud et démontable.',
    '### Activer un plug-in livré mais éteint',
    'Un bundle livré peut laisser une ligne en `disabled`. Écrivez votre propre bundle dont le correctif remplace cette ligne par `disabled: false` et insère les lignes hôtes dont elle dépend. Les paquets livrés avec {brandAbbr} se résolvent depuis l\'installation {brandAbbr} ; votre bundle ne déclare donc aucune dépendance envers eux.',
  ].join('\n\n'),

  devGuideUiTab: 'Plug-in d\'interface',
  devGuideUi: [
    '### Une section de manifeste en plus',
    'La face interface ajoute une section `lyn.client` et un export `./client` :',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Choisissez un emplacement',
    'Les composants d\'interface s\'enregistrent dans des **emplacements**. Préférez un emplacement qui vous réserve déjà de la place plutôt que de planifier une trajectoire flottante autour des contrôles de l\'hôte. N\'utilisez un emplacement en surimpression que lorsque le résultat l\'exige vraiment et que sa position est connue.',
    'Ne lisez pas le DOM, la feuille de style ou le code d\'un autre plug-in pour estimer la position ; choisissez un emplacement qui réserve déjà de la place.',
    '### L\'artefact navigateur',
    'Le module client enregistre une fabrique différée dont l\'id égale le nom du paquet. React vient de la table de modules du navigateur : pas de seconde installation de React, pas de script CDN, pas de chasse à l\'UMD.',
    '**Gardez les fabriques exemptes d\'effets de bord.** Enregistrez styles, minuteurs et écouteurs dans `apply` avec `ctx.effect`/`ctx.on` et renvoyez leur nettoyage. Conteneurs et contrôles héritent du thème de l\'hôte ; le dessin peut utiliser ses propres couleurs.',
    '### Le texte passe par les locales',
    'Faites passer chaque chaîne visible par le service de locales du client plutôt que de l\'écrire dans le composant.',
  ].join('\n\n'),

  devGuideMcpTab: 'Connecter MCP',
  devGuideMcp: [
    '### Aucun code nécessaire',
    'Un bundle de configuration seule a besoin d\'un nom unique, d\'une version et de `lyn.bundle.patch` — aucun fichier d\'entrée hôte ou interface.',
    '### Le correctif',
    'Le correctif insère le client MCP déjà installé et nomme votre serveur :',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'Pour stdio, utilisez `transport: stdio` avec `command`, plus éventuellement `args`, `env` et `cwd`.',
    '### Vérifier',
    'Après l\'installation, appelez `mcp__demo__ping` ou une autre `mcp__<serverName>__<tool>` nouvellement disponible. En cas d\'échec, réparez le même bundle au lieu d\'en créer un second.',
    '### Identifiants',
    'Les identifiants d\'ambiance sont effacés. Référencez les identifiants existants avec le `!!js` du Loader plutôt que de copier des secrets dans le texte de configuration.',
  ].join('\n\n'),

  devGuideInstallTab: 'Installer et vérifier',
  devGuideInstall: [
    '### Installer depuis un dossier local',
    'Donnez à **Ajouter un plug-in** le chemin absolu de votre dossier de plug-in. Utilisez ce chemin pendant le développement : rien n\'a besoin d\'être publié d\'abord.',
    '### Ce qui est vérifié avant l\'installation',
    'L\'installation résout la plage de versions peer {brandAbbr} déclarée par votre paquet et la compare à la version en cours. **Un plug-in incompatible est refusé avant l\'exécution de pnpm**, donc rien n\'est téléchargé et aucun script d\'installation ne tourne.',
    'Lorsqu\'une version incompatible doit vraiment être installée, une dérogation peut être enregistrée pour un paquet et une version exacts face à une version d\'exécution exacte. Les dérogations ne sont héritées ni par les mises à jour du plug-in ni par celles de {brandAbbr} — chaque paire s\'accorde séparément.',
    '### L\'échec revient en arrière',
    'Un échec, une annulation, ou un paquet qui s\'avère ne porter aucun correctif de bundle, tous restaurent `package.json` et le lockfile tels qu\'ils étaient.',
    '### Jusqu\'où vérifier',
    'Vérifiez la syntaxe JavaScript et le manifeste, installez, puis servez-vous du plug-in en cours d\'exécution comme aperçu. Ne lancez pas un autre navigateur, ne changez pas `HOME`, n\'inspectez pas de profils de navigateur personnels et ne touchez pas aux porte-clés pour obtenir une capture. Une capture d\'une page simulée ne vérifie pas le plug-in en cours d\'exécution.',
    '### Sécurité',
    'N\'installez que des plug-ins de confiance : ils tournent avec vos permissions et peuvent endommager ou divulguer vos données.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>

/**
 * German dictionary. Code blocks, manifest field names and option values are
 * the English ones verbatim: they are the API, not copy.
 */
export const guideDe = {
  devGuideOpen: 'Handbuch zur Plug-in-Entwicklung',
  devGuideTitle: 'Ein Plug-in entwickeln',
  devGuideIntro: 'Ein Plug-in ist ein npm-Paket, das ein Bundle deklariert. Es kann Werkzeuge und Dienste für den Agenten hinzufügen, Komponenten zur Oberfläche hinzufügen oder einfach einen MCP-Server anbinden.',
  devGuideSections: 'Abschnitte des Handbuchs',
  devGuideCopy: 'Kopieren',
  devGuideCopied: 'Kopiert',
  devGuideFootnotes: 'Fußnoten',

  devGuideOverviewTab: 'Hier beginnen',
  devGuideOverview: [
    '### Was ein Plug-in ist',
    'Ein Plug-in ist ein gewöhnliches npm-Paket, dessen `package.json` `lyn.bundle.patch` deklariert. Dieser YAML-Patch fügt Plug-in-Zeilen in die Komposition ein; das Paket liefert den Code, den diese Zeilen nennen. Es gibt kein besonderes Plug-in-Format, und ein Build-Werkzeug ist nicht erforderlich.',
    '### Wohin es installiert wird',
    'Die Installation fügt das Paket dem aktuellen Profil hinzu und legt seinen Patch als Ebene über die ausgelieferten. Änderungen betreffen daher jede Sitzung, die dieses Profil nutzt, und überleben einen Neustart. Mit aktivem Hot Reload gelten sie sofort, sonst beim nächsten Start.',
    '### Zwei Seiten',
    'Die **Host-Seite** läuft im Harness-Prozess: Dienste, Werkzeuge, Prompts, Sitzungslogik. Die **Oberflächenseite** läuft im Browser: Komponenten, Panels, Verzierungen. Ein Paket kann eine Seite haben oder beide.',
    '### Die drei kürzesten Wege',
    'Einen MCP-Server anbinden — nur Manifest und Patch, kein Code. Ein Werkzeug für den Agenten hinzufügen — die Host-Seite. Etwas auf die Seite bringen — die Oberflächenseite.',
    '### Erst installieren, dann verfeinern',
    'Halten Sie die erste Fassung klein, installieren Sie sie, sehen Sie sie wirklich laufen und ändern Sie dann Einzelheiten. Das installierte Plug-in ist die beste Vorschau — bauen Sie nicht vorher eine statische Vorschauseite oder eine nachgebildete Hülle.',
  ].join('\n\n'),

  devGuideHostTab: 'Host-Plug-in',
  devGuideHost: [
    '### Das Manifest',
    'Ein reines Host-Bundle braucht keine Abhängigkeiten, keine Installationsskripte und kein Build-Werkzeug:',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### Der Patch',
    'Der Patch fügt eine nach dem Paket benannte Zeile ein. Paketname und Zeilen-Id müssen beide eindeutig sein:',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### Der Einstieg',
    '`index.js` exportiert entweder ein Funktions-Plug-in — `name`, `inject`, `Config`, `apply`, ohne Default-Export — oder eine Dienstklasse als Default-Export. Mischen Sie die beiden Formen nicht.',
    '**Jeder Beitrag ist ein Effect**: Werkzeuge, Listener und Promptabschnitte registrieren sich über `ctx.effect()` oder `ctx.on()` und werden von ihren Disposern zurückgenommen. Genau das macht ein Plug-in hot-reload-fähig und entfernbar.',
    '### Ein ausgeliefertes, aber ausgeschaltetes Plug-in einschalten',
    'Ein ausgeliefertes Bundle kann eine Zeile auf `disabled` lassen. Schreiben Sie ein eigenes Bundle, dessen Patch diese Zeile mit `disabled: false` überschreibt und die Host-Zeilen einfügt, von denen sie abhängt. Mit {brandAbbr} ausgelieferte Pakete werden aus der {brandAbbr}-Installation aufgelöst, Ihr Bundle deklariert also keine Abhängigkeit auf sie.',
  ].join('\n\n'),

  devGuideUiTab: 'Oberflächen-Plug-in',
  devGuideUi: [
    '### Ein weiterer Manifestabschnitt',
    'Die Oberflächenseite fügt einen `lyn.client`-Abschnitt und einen `./client`-Export hinzu:',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Wählen Sie einen Platz',
    'Oberflächenkomponenten registrieren sich in **Plätzen**. Bevorzugen Sie einen Platz, der Ihnen schon Raum zuweist, gegenüber einer schwebenden Bahn um die Steuerelemente des Hosts herum. Nutzen Sie einen Overlay-Platz nur, wenn das Ergebnis wirklich ein Overlay braucht und seine Lage bekannt ist.',
    'Lesen Sie nicht das DOM, das Stylesheet oder den Quelltext eines anderen Plug-ins, um die Lage zu schätzen; wählen Sie einen Platz, der schon Raum zuweist.',
    '### Das Browser-Artefakt',
    'Das Client-Modul registriert eine verzögerte Factory, deren Id dem Paketnamen gleicht. React kommt aus der Modultabelle des Browsers — keine zweite React-Installation, kein CDN-Skript, keine UMD-Suche.',
    '**Halten Sie Factories frei von Nebenwirkungen.** Registrieren Sie Stile, Timer und Listener in `apply` mit `ctx.effect`/`ctx.on` und geben Sie deren Aufräumfunktion zurück. Container und Steuerelemente erben das Thema des Hosts; die Zeichnung darf eigene Farben verwenden.',
    '### Text läuft über die Locales',
    'Führen Sie jede sichtbare Zeichenfolge über den Locale-Dienst des Clients, statt sie in die Komponente zu schreiben.',
  ].join('\n\n'),

  devGuideMcpTab: 'MCP anbinden',
  devGuideMcp: [
    '### Kein Code nötig',
    'Ein Bundle, das nur konfiguriert, braucht einen eindeutigen Namen, eine Version und `lyn.bundle.patch` — keine Host- oder Oberflächen-Einstiegsdateien.',
    '### Der Patch',
    'Der Patch fügt den bereits installierten MCP-Client ein und nennt Ihren Server:',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'Für stdio verwenden Sie `transport: stdio` mit `command` sowie optional `args`, `env` und `cwd`.',
    '### Prüfen',
    'Rufen Sie nach der Installation `mcp__demo__ping` oder ein anderes neu verfügbares `mcp__<serverName>__<tool>` auf. Bei einem Fehlschlag reparieren Sie dasselbe Bundle, statt ein zweites anzulegen.',
    '### Zugangsdaten',
    'Umgebungs-Zugangsdaten werden entfernt. Verweisen Sie mit dem `!!js` des Loaders auf vorhandene Zugangsdaten, statt Geheimnisse in den Konfigurationstext zu kopieren.',
  ].join('\n\n'),

  devGuideInstallTab: 'Installieren und prüfen',
  devGuideInstall: [
    '### Aus einem lokalen Verzeichnis installieren',
    'Geben Sie **Plug-in hinzufügen** den absoluten Pfad Ihres Plug-in-Verzeichnisses. Nutzen Sie diesen Pfad während der Entwicklung — nichts muss vorher veröffentlicht werden.',
    '### Was vor dem Installieren geprüft wird',
    'Die Installation löst den von Ihrem Paket deklarierten {brandAbbr}-Peer-Versionsbereich auf und vergleicht ihn mit der laufenden Version. **Ein unverträgliches Plug-in wird abgelehnt, bevor pnpm läuft**, es wird also nichts heruntergeladen und kein Installationsskript ausgeführt.',
    'Wenn eine unverträgliche Version wirklich installiert werden muss, kann eine Ausnahme für ein genaues Paket mit Version gegen eine genaue Laufzeitversion vermerkt werden. Ausnahmen werden weder von Plug-in-Aktualisierungen noch von {brandAbbr}-Aktualisierungen übernommen — jedes Paar wird einzeln gewährt.',
    '### Ein Fehlschlag wird zurückgenommen',
    'Ein Fehlschlag, ein Abbruch oder ein Paket, das doch keinen Bundle-Patch trägt, stellen `package.json` und die Lockfile alle wieder so her, wie sie waren.',
    '### Wie weit zu prüfen ist',
    'Prüfen Sie die JavaScript-Syntax und das Manifest, installieren Sie, und nutzen Sie dann das laufende Plug-in selbst als Vorschau. Starten Sie keinen zweiten Browser, ändern Sie nicht `HOME`, sehen Sie nicht in persönliche Browserprofile und berühren Sie keine Schlüsselbunde, um einen Screenshot zu bekommen. Ein Screenshot einer nachgebildeten Seite prüft das laufende Plug-in nicht.',
    '### Sicherheit',
    'Installieren Sie nur Plug-ins, denen Sie vertrauen: sie laufen mit Ihren Rechten und können Ihre Daten beschädigen oder nach außen tragen.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>

/**
 * Russian dictionary. Code blocks, manifest field names and option values are
 * the English ones verbatim: they are the API, not copy.
 */
export const guideRu = {
  devGuideOpen: 'Руководство по разработке плагинов',
  devGuideTitle: 'Разработать плагин',
  devGuideIntro: 'Плагин — это npm-пакет, объявляющий bundle. Он может добавить агенту инструменты и службы, добавить интерфейсу компоненты или просто подключить MCP-сервер.',
  devGuideSections: 'Разделы руководства',
  devGuideCopy: 'Копировать',
  devGuideCopied: 'Скопировано',
  devGuideFootnotes: 'Сноски',

  devGuideOverviewTab: 'Начните отсюда',
  devGuideOverview: [
    '### Что такое плагин',
    'Плагин — это обычный npm-пакет, чей `package.json` объявляет `lyn.bundle.patch`. Этот YAML-патч вставляет строки плагина в композицию; пакет поставляет код, который эти строки называют. Особого формата плагина нет, и инструмент сборки не требуется.',
    '### Куда он устанавливается',
    'Установка добавляет пакет в текущий профиль и накладывает его патч слоем поверх заводских. Поэтому изменения касаются каждого сеанса, использующего этот профиль, и сохраняются после перезапуска. При включённой горячей перезагрузке они применяются сразу, иначе ждут следующего запуска.',
    '### Две стороны',
    '**Узловая сторона** работает в процессе Harness: службы, инструменты, промпты, логика сеанса. **Интерфейсная сторона** работает в браузере: компоненты, панели, оформление. У пакета может быть одна сторона или обе.',
    '### Три самых коротких пути',
    'Подключить MCP-сервер — только манифест и патч, без кода. Добавить инструмент агенту — узловая сторона. Разместить что-то на странице — интерфейсная сторона.',
    '### Сначала установите, потом доводите',
    'Держите первую версию маленькой, установите её, посмотрите, как она действительно работает, и только потом меняйте детали. Установленный плагин — лучший предпросмотр: не делайте сначала статическую страницу предпросмотра или подставную оболочку.',
  ].join('\n\n'),

  devGuideHostTab: 'Узловой плагин',
  devGuideHost: [
    '### Манифест',
    'Bundle только для узловой стороны не нуждается ни в зависимостях, ни в установочных скриптах, ни в инструменте сборки:',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### Патч',
    'Патч вставляет строку, названную по пакету. И имя пакета, и id строки должны быть уникальными:',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### Точка входа',
    '`index.js` экспортирует либо функциональный плагин — `name`, `inject`, `Config`, `apply`, без экспорта по умолчанию — либо класс службы как экспорт по умолчанию. Не смешивайте эти две формы.',
    '**Каждый вклад — это effect**: инструменты, слушатели и разделы промпта регистрируются через `ctx.effect()` или `ctx.on()` и отзываются своими disposer-ами. Именно это делает плагин пригодным к горячей перезагрузке и снятию.',
    '### Включить поставляемый, но выключенный плагин',
    'Поставляемый bundle может оставить строку в `disabled`. Напишите свой bundle, чей патч перекрывает эту строку значением `disabled: false` и вставляет узловые строки, от которых она зависит. Пакеты, поставляемые вместе с {brandAbbr}, разрешаются из установки {brandAbbr}, поэтому ваш bundle не объявляет зависимости от них.',
  ].join('\n\n'),

  devGuideUiTab: 'Интерфейсный плагин',
  devGuideUi: [
    '### Ещё один раздел манифеста',
    'Интерфейсная сторона добавляет раздел `lyn.client` и экспорт `./client`:',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Выберите место',
    'Интерфейсные компоненты регистрируются в **местах**. Предпочитайте место, которое уже отводит вам пространство, вместо планирования плавающего пути вокруг элементов управления узла. Используйте накладное место только тогда, когда результату действительно нужна накладка и её положение известно.',
    'Не читайте DOM, таблицу стилей или исходники другого плагина, чтобы угадать положение; выберите место, которое уже отводит пространство.',
    '### Браузерный артефакт',
    'Клиентский модуль регистрирует отложенную фабрику, чей id равен имени пакета. React приходит из таблицы модулей браузера — ни второй установки React, ни CDN-скрипта, ни поиска UMD.',
    '**Держите фабрики свободными от побочных эффектов.** Регистрируйте стили, таймеры и слушателей внутри `apply` через `ctx.effect`/`ctx.on` и возвращайте их очистку. Контейнеры и элементы управления наследуют тему узла; сама графика может использовать свои цвета.',
    '### Текст идёт через локали',
    'Проводите каждую видимую строку через службу локалей клиента, а не вписывайте её в компонент.',
  ].join('\n\n'),

  devGuideMcpTab: 'Подключить MCP',
  devGuideMcp: [
    '### Код не нужен',
    'Bundle, который только настраивает, нуждается в уникальном имени, версии и `lyn.bundle.patch` — никаких узловых или интерфейсных файлов входа.',
    '### Патч',
    'Патч вставляет уже установленный MCP-клиент и называет ваш сервер:',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'Для stdio используйте `transport: stdio` с `command`, а также при необходимости `args`, `env` и `cwd`.',
    '### Проверка',
    'После установки вызовите `mcp__demo__ping` или другой только что появившийся `mcp__<serverName>__<tool>`. При неудаче исправляйте тот же bundle, а не создавайте второй.',
    '### Учётные данные',
    'Учётные данные окружения вычищаются. Ссылайтесь на существующие учётные данные через `!!js` Loader-а, а не копируйте секреты в текст конфигурации.',
  ].join('\n\n'),

  devGuideInstallTab: 'Установка и проверка',
  devGuideInstall: [
    '### Установить из локального каталога',
    'Передайте в **Добавить плагин** абсолютный путь каталога вашего плагина. Пользуйтесь этим путём во время разработки — публиковать что-либо заранее не нужно.',
    '### Что проверяется перед установкой',
    'Установка разрешает объявленный вашим пакетом диапазон peer-версий {brandAbbr} и сравнивает его с работающей версией. **Несовместимый плагин отклоняется до запуска pnpm**, поэтому ничего не скачивается и установочные скрипты не выполняются.',
    'Когда несовместимую версию действительно нужно установить, можно записать исключение для точной пары «пакет и версия» против точной версии среды. Исключения не наследуются ни обновлениями плагина, ни обновлениями {brandAbbr} — каждая пара разрешается отдельно.',
    '### Неудача откатывается',
    'Неудача, отмена или пакет, у которого всё же нет патча bundle, — всё это возвращает `package.json` и lockfile в прежний вид.',
    '### Насколько глубоко проверять',
    'Проверьте синтаксис JavaScript и манифест, установите, а затем используйте сам работающий плагин как предпросмотр. Не запускайте отдельный браузер, не меняйте `HOME`, не заглядывайте в личные профили браузера и не трогайте связки ключей ради снимка экрана. Снимок подставной страницы не является проверкой работающего плагина.',
    '### Безопасность',
    'Устанавливайте только те плагины, которым доверяете: они работают с вашими правами и могут повредить или вынести ваши данные.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>

/**
 * Portuguese dictionary. Code blocks, manifest field names and option values
 * are the English ones verbatim: they are the API, not copy.
 */
export const guidePt = {
  devGuideOpen: 'Manual de desenvolvimento de plug-ins',
  devGuideTitle: 'Desenvolver um plug-in',
  devGuideIntro: 'Um plug-in é um pacote npm que declara um bundle. Pode acrescentar ferramentas e serviços para o agente, acrescentar componentes à interface, ou apenas ligar um servidor MCP.',
  devGuideSections: 'Secções do manual',
  devGuideCopy: 'Copiar',
  devGuideCopied: 'Copiado',
  devGuideFootnotes: 'Notas de rodapé',

  devGuideOverviewTab: 'Comece aqui',
  devGuideOverview: [
    '### O que é um plug-in',
    'Um plug-in é um pacote npm comum cujo `package.json` declara `lyn.bundle.patch`. Esse patch YAML insere linhas de plug-in na composição; o pacote fornece o código que essas linhas nomeiam. Não há um formato especial de plug-in e nenhuma ferramenta de compilação é necessária.',
    '### Onde se instala',
    'Instalar acrescenta o pacote ao perfil atual e aplica o seu patch como uma camada sobre as de origem. As alterações afetam, portanto, cada sessão que use esse perfil e sobrevivem ao reinício. Com recarga a quente ativa aplicam-se de imediato; caso contrário, esperam pelo arranque seguinte.',
    '### Duas faces',
    'A **face anfitriã** corre no processo do Harness: serviços, ferramentas, prompts, lógica de sessão. A **face de interface** corre no navegador: componentes, painéis, ornamentos. Um pacote pode ter uma face ou ambas.',
    '### Os três caminhos mais curtos',
    'Ligar um servidor MCP — apenas manifesto e patch, sem código. Acrescentar uma ferramenta ao agente — a face anfitriã. Colocar algo na página — a face de interface.',
    '### Instale primeiro, apure depois',
    'Mantenha a primeira versão pequena, instale-a, veja-a a correr de verdade e só então mude pormenores. O plug-in instalado é a melhor pré-visualização — não construa antes uma página estática de pré-visualização nem uma casca simulada.',
  ].join('\n\n'),

  devGuideHostTab: 'Plug-in anfitrião',
  devGuideHost: [
    '### O manifesto',
    'Um bundle apenas anfitrião não precisa de dependências, scripts de instalação nem ferramenta de compilação:',
    '```json\n{\n  "name": "@local/my-plugin",\n  "version": "1.0.0",\n  "private": true,\n  "type": "module",\n  "exports": { ".": "./index.js" },\n  "lyn": { "bundle": { "patch": "./cordis.patch.yml" } }\n}\n```',
    '### O patch',
    'O patch insere uma linha com o nome do pacote. Tanto o nome do pacote como o id da linha têm de ser únicos:',
    '```yaml\n- insert:\n    - id: my-plugin\n      name: \'@local/my-plugin\'\n      config: {}\n```',
    '### A entrada',
    '`index.js` exporta ou um plug-in de função — `name`, `inject`, `Config`, `apply`, sem exportação predefinida — ou uma classe de serviço como exportação predefinida. Não misture as duas formas.',
    '**Cada contribuição é um effect**: ferramentas, escutas e secções de prompt registam-se através de `ctx.effect()` ou `ctx.on()` e são retiradas pelos seus disposers. É isso que torna um plug-in recarregável a quente e removível.',
    '### Ativar um plug-in de origem que está desligado',
    'Um bundle de origem pode deixar uma linha em `disabled`. Escreva o seu próprio bundle cujo patch sobreponha essa linha com `disabled: false` e insira as linhas anfitriãs de que ela depende. Os pacotes que vêm com o {brandAbbr} resolvem-se a partir da instalação do {brandAbbr}, pelo que o seu bundle não declara qualquer dependência deles.',
  ].join('\n\n'),

  devGuideUiTab: 'Plug-in de interface',
  devGuideUi: [
    '### Mais uma secção do manifesto',
    'A face de interface acrescenta uma secção `lyn.client` e uma exportação `./client`:',
    '```json\n{\n  "exports": { ".": "./index.js", "./client": "./client.js" },\n  "lyn": {\n    "bundle": { "patch": "./cordis.patch.yml" },\n    "client": {\n      "platform": "web",\n      "immediately": true,\n      "inject": ["@lyness/lyn-client-ui-conversation"]\n    }\n  }\n}\n```',
    '### Escolha um lugar',
    'Os componentes de interface registam-se em **lugares**. Prefira um lugar que já lhe reserve espaço em vez de planear um trajeto flutuante em torno dos controlos do anfitrião. Use um lugar sobreposto só quando o resultado realmente precise de uma sobreposição e a sua colocação seja conhecida.',
    'Não leia o DOM, a folha de estilos ou o código de outro plug-in para estimar a colocação; escolha um lugar que já reserve espaço.',
    '### O artefacto do navegador',
    'O módulo cliente registra uma fábrica diferida cujo id é igual ao nome do pacote. O React vem da tabela de módulos do navegador — sem instalação duplicada do React, sem script de CDN, sem caça ao UMD.',
    '**Mantenha as fábricas livres de efeitos secundários.** Registe estilos, temporizadores e escutas dentro de `apply` com `ctx.effect`/`ctx.on` e devolva a respetiva limpeza. Contentores e controlos herdam o tema do anfitrião; o desenho pode usar as suas próprias cores.',
    '### O texto passa pelos locais',
    'Encaminhe cada cadeia visível pelo serviço de locais do cliente em vez de a escrever no componente.',
  ].join('\n\n'),

  devGuideMcpTab: 'Ligar MCP',
  devGuideMcp: [
    '### Sem código',
    'Um bundle só de configuração precisa de um nome único, uma versão e `lyn.bundle.patch` — nenhum ficheiro de entrada anfitrião ou de interface.',
    '### O patch',
    'O patch insere o cliente MCP já instalado e nomeia o seu servidor:',
    '```yaml\n- insert:\n    - id: my-mcp\n      name: \'@lyness/lyn-mcp-client\'\n      config:\n        serverName: demo\n        transport: streamable-http\n        url: https://mcp.example.com/\n        failOnStartupError: true\n```',
    'Para stdio, use `transport: stdio` com `command`, mais opcionalmente `args`, `env` e `cwd`.',
    '### Verificar',
    'Depois de instalar, chame `mcp__demo__ping` ou outro `mcp__<serverName>__<tool>` recém-disponível. Em caso de falha, repare o mesmo bundle em vez de criar um segundo.',
    '### Credenciais',
    'As credenciais do ambiente são removidas. Referencie credenciais existentes com o `!!js` do Loader em vez de copiar segredos para o texto de configuração.',
  ].join('\n\n'),

  devGuideInstallTab: 'Instalar e verificar',
  devGuideInstall: [
    '### Instalar a partir de uma pasta local',
    'Dê a **Acrescentar plug-in** o caminho absoluto da pasta do seu plug-in. Use esse caminho durante o desenvolvimento — não é preciso publicar nada primeiro.',
    '### O que é verificado antes de instalar',
    'A instalação resolve o intervalo de versões peer do {brandAbbr} que o seu pacote declara e compara-o com a versão em execução. **Um plug-in incompatível é recusado antes de o pnpm correr**, pelo que nada é descarregado e nenhum script de instalação é executado.',
    'Quando uma versão incompatível tiver realmente de ser instalada, pode registar-se uma dispensa para um pacote e versão exatos face a uma versão de execução exata. As dispensas não são herdadas nem pelas atualizações do plug-in nem pelas do {brandAbbr} — cada par é concedido por si.',
    '### A falha reverte',
    'Uma falha, um cancelamento, ou um pacote que acaba por não trazer patch de bundle, todos restauram o `package.json` e o lockfile tal como estavam.',
    '### Até onde verificar',
    'Verifique a sintaxe do JavaScript e o manifesto, instale, e depois use o próprio plug-in em execução como pré-visualização. Não lance outro navegador, não altere o `HOME`, não inspecione perfis pessoais de navegador nem toque em porta-chaves para obter uma captura. Uma captura de uma página simulada não é verificação do plug-in em execução.',
    '### Segurança',
    'Instale apenas plug-ins em que confie: correm com as suas permissões e podem danificar ou divulgar os seus dados.',
  ].join('\n\n'),
} satisfies Record<PluginDevGuideKey, string>
