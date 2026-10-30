# lyness 二次开发台账

> 这份文件是二开的记忆。合并官方更新后，逐条复查这里记录的定制点是否被覆盖 ——
> 官方一次重构就可能把你删掉的功能带回来、把你改的品牌名改回去，而 git 不会提醒你。
> 生成于 2026-08-29，由 fork-init 初始化，之后请手工维护。

## 基本信息

| 项 | 值 |
|---|---|
| 官方仓库 | https://github.com/deepseek-ai/deepseek-harness.git |
| 官方主分支 | master |
| 我的仓库 | git@github.com:XavierZhang/lyness.git |
| 二开主分支 | custom/main |
| 产品名 | lyness（中文：领驭） |
| 官方许可证 | MIT |
| 主技术栈 | node / pnpm |
| 是否对外分发 | 开发阶段暂不发布 npm；品牌先全量替换，发布与否开发完成后再定（2026-08-31） |

## 源项目的开发方式（探测自源项目，不是我定的）

| 用途 | 命令 |
|---|---|
| 安装依赖 | `pnpm install` |
| 构建 | `pnpm run build` |
| 测试 | `pnpm run test` |
| 代码检查 | `pnpm run lint` |
| 启动/冒烟 | `pnpm lyn --profile headless "your prompt"` |

官方开发文档：CONTRIBUTING.md README.md docs/development.md

## 我改过的官方文件

改动官方文件会在每次合并时产生冲突成本，所以这张表越短越好。
能用新增文件、配置、插件解决的，就别改官方文件。

| 文件/目录 | 改了什么 | 为什么必须改官方文件 | 日期 |
|---|---|---|---|
| 全仓库 6000 个文件 | 品牌改名 | 改名本质上无法用新增文件表达 | 2026-08-31 |
| `packages/bundle/brand-setup/{src/startup.ts,cordis.patch.yml,package.json}` | 新增 startup provider 接管命令行；服务行改为注入它，行 id 从全局必需的 `webserver` 改为 `brand-setup-webserver` | `brand-setup --help` 原本会真的起服务并绑端口、永不退出，`gen-cli-help` 因此一直挂住。`web-app` 同形只是靠「退出赢过必需项审计」这个时序侥幸，不能照抄 | 2026-10-28 |
| `packages/bundle/brand-studio/src/index.ts` | `--asset-dir` 的默认值不再在构建命令时求值 | `lynHomePath('brand')` 把**本机临时目录的绝对路径**印进帮助文本，`gen-cli-help` 每次生成结果都不同 | 2026-10-28 |
| `apps/cli/package.json` | 补 `module-accounts`、`module-credits`、`web-execution` 三个依赖；`hooks-claude-code`／`hooks-codex` 从 `dependencies` 移回 `devDependencies` | `hosted` 与 `enterprise` 模板选中那三个 bundle，但安装依赖里没有，启动器只是**警告跳过**——于是 hosted 形态实际上没有账户与积分 | 2026-10-28 |
| `packages/credits/credits/src/store.ts` | 两个 readiness promise 在创建处就被观察 | `--help` 退出时若 storage open 还在飞行中，其拒绝会先触发 Node 的未处理拒绝，被 boot 守卫报成 `fatal load failure`。上游 7 个同形插件未改，只改实际会触发的这一个 | 2026-10-28 |
| `scripts/verify-repository-references.ts` | 排除 lock 文件 | wheel 记录的字节数恰好是 7 位十六进制、又恰好缩写成本仓库某个 commit，纯随机碰撞 | 2026-10-28 |
| `scripts/{gen-cordis-catalog,gen-doc-graphs,verify-product-use,product-package-policy,verify-brand-placeholders,doc-budgets.manifest}.ts` 等 | 登记 `brandSetupStartup`／`SessionOwnerRecord`；布尔字面量读取；15 条产品包分类；署名行 7 语言豁免；预算清单去重 | 新增 `ctx` 服务与新增包都要逐表登记，这些表都是写死的映射 | 2026-10-28 |
| `scripts/verify-public-repository-links.spec.ts` | 失效仓库名改为片段拼接 | 整串字面量被 `slug` 规则改写，门禁会去查一个从未被链接过的仓库 | 2026-09-12 |
| `scripts/lint-rule-fingerprint.spec.ts` | 三条 sha256 指纹 | `.oxlintrc.json` 有一句规则提示文案含包名，被改名后哈希变化；规则数 89/88/84 与上游一致，可证规则集未变 | 2026-09-12 |
| `packages/bundle/base/tests/base.spec.ts` | 遥测默认值断言改为 `DISABLED` + 空端点 | 上游 0.1.5 新增此测试钉住自己的默认值；改为钉住本 fork 的，它就成了遥测守卫 | 2026-09-12 |
| `packages/bundle/base/cordis.patch.yml` | 遥测默认 `DISABLED`、去掉厂商端点 | 上游默认把完整会话记录发往自家 collector；服务他人用户的部署不能默认转发 | 2026-09-01 |
| `packages/client/ui-layout/src/client/AppFrame.tsx`（+ `tests/app-frame.client.spec.tsx`） | 浏览器标题优先读部署品牌的 `productName` | `DocumentTitle` 在客户端覆盖 `document.title`，服务端替换过的 `<title>` 会被冲掉；标题不走 slot，没有插件接缝 | 2026-09-15 |
| `packages/bundle/web-app/cordis.patch.yml`、`package.json`、`apps/web/tests/built-boot.expected.e2e.ts` | `ui-brand-official` 行换成 `ui-brand-lyness`；built-boot 冒烟里钉死的两个 viewBox 随之改为 lyness 的字标 `0 0 60.53 24` 与标记 `0 0 717 619`（原值出自 ui-primitives 的 `BrandWordmark` 与 `FishLogo`） | 浏览器插件名单只在 bundle patch 里；换了插件，钉死官方图形尺寸的断言就必然过期。2026-09-24 才暴露——`test:web` 这道门禁在 fork CI 里此前从未跑到过 | 2026-09-15 |
| `apps/web/public/favicon.svg`、`website/public/{favicon,wordmark}.svg`、`packages/skill/skill-badge/assets/lyn-badge.png`（+ `tests/skill-badge.spec.ts` 的哈希） | 换成 lyness 图形 | 图片资产，codemod 表达不了。⚠️ **合并时 `read-tree` 会把它们重置为上游版本，必须从本 fork 恢复** | 2026-09-15 |
| `website/.vitepress/config.ts` | 两处 "DeepSeek wordmark" 注释 | 注释描述的文件已换 | 2026-09-15 |
| `packages/llm/llm-deepseek/src/index.ts`（+ `tests/{adapter,dynamic-config}.spec.ts`、README） | 新增 `DEEPSEEK_MODELS`：与 `DEEPSEEK_BASE_URL` 同一组受信任环境层读取的逗号分隔模型目录，替换组合配置的 `models`（用户在设置里保存的目录仍优先）；以及 `DEEPSEEK_MAX_TOKENS`：只有 id 的目录不带容量，会让第三方模型套用官方的 `DEFAULT_MAX_TOKENS = 256000`，网关对这种 agent 规模的请求既不回答也不拒绝；导出 `MODELS_ENV`、`MAX_TOKENS_ENV`、`parseModelIds`、`parseMaxTokens`、`withEnvironmentCatalog` | 内置目录只有官方模型名，第三方兼容端点的模型名不同；web/profile e2e 自己启动 `lyn`，只有经环境变量才能不改测试就切换平台 | 2026-09-22 |
| 约 20 个上游 e2e 文件（`apps/cli/tests/**`、`apps/web/tests/shipped-composition.e2e.ts` 及各包 `tests/*.e2e.ts`）、`apps/cli/tests/profiles/{acp/cordis.yml,headless/real-model.patch.yml}`、`docs/testing{,.zh}.md` | 写死的 `'deepseek-v4-flash'` 改为 `E2E_TARGET.model`；两个 YAML fixture 改为 `!!js` 读 `DEEPSEEK_MODELS`；请求缓存、Claude Code 子代理、llm-pi-ai 适配器三个测试在非官方目标上跳过（第二个原先直接抛错；第三个因 pi-ai 按自带模型目录路由，第三方平台的模型 id 在目录里没有路由） | e2e 调用哪个平台要由配置决定而不是写死；每处都是一行替换，合并冲突好解 | 2026-09-22 |
| `packages/client/connection/src/{rpc,rpc-host}.ts`（+ `tests/request-scope.host.spec.ts`） | 新增 `ctx.connection.rpc.scope(scope)`：每请求作用域，按注册顺序嵌套包裹所有通道上的每次已解码调用，作用域必须调用并原样返回 `run()` | Remote 方法不携带自己到达时的请求，共享 `/api` 通道只容纳一个 interceptor（属 Gateway），web server 每路径只选一条路由——路由与 handler 之间没有可站的位置。不改则调用方租户无处安放 | 2026-09-21 |
| `scripts/gen-cordis-catalog.ts`、`scripts/gen-doc-graphs.ts`、`scripts/verify-package-readme-model-experience.ts` | 登记 `ctx.requestTenant`、`ctx.tenantController` 与 `RequestTenant`／`TenantConfigView`／`TenantConfigInput`：服务→子系统页、类型→文档页、服务角色、Model Experience | 同上一行的理由：新增 `ctx` 服务必须逐表登记 | 2026-09-21 |
| `scripts/gen-cordis-catalog.ts`、`scripts/gen-doc-graphs.ts`、`scripts/type-equiv.manifest.json`、`scripts/verify-package-readme-model-experience.ts`、`docs/subsystems/README.md`、`packages/README.md` | 登记 `ctx.tenants` 与 `ctx.tenantConfig`：服务→子系统页、类型→文档页、能力缝角色、类型等价清单、Model Experience、两处索引 | 新增 `ctx` 服务必须逐表登记，这些表都是写死的映射，没有扩展点；不登记则生成器直接报错 | 2026-09-17 |
| `scripts/gen-third-party-notices.ts`、`lefthook.yml`、`scripts/check-workspace-constraints.ts` | 新增「内置第三方文件」段落；brand-fonts 的 `fonts/` 与清单加入可发布文件白名单：读各包 `third-party-assets.json`，校验 sha256、许可证（宽松或 OFL-1.1 字体）、未登记字体文件即报错 | 上游只声明 npm 依赖与 vendored 包，仓库内随附的字体文件没有声明入口；OFL 字体要合规分发必须被声明 | 2026-09-16 |
| `packages/boot/app-boot/src/profile.ts`（+ `tests/profile.spec.ts`）、`apps/cli/package.json`、`docs/architecture{,.zh}.md` | `PROFILE_TEMPLATES` 新增 `brand-studio`；CLI 依赖该 bundle；应用清单加一项 | 随附 profile 名单是写死的表，没有注册接缝；不登记则 `lyn --profile brand-studio` 报 "does not exist" | 2026-09-15 |
| `packages/util/official-bundles/src/bundles.ts` | `ProfileTemplate` 加 `hosted?: boolean`；`PROFILE_TEMPLATES` 换成本 fork 的 module-bundle 组成（14 个 `module-*` 与 `web-execution` 都是本 fork 新增的包）并加 enterprise／hosted／brand-studio／brand-setup 四个形态；`INSTALLATION_OWNED_PROFILE_TUPLES` 改成「每 profile 一组历史元组」，`app-boot/src/profile.ts` 的匹配器与 `rescopedBundleName` 随之带回 | 上游 0.2.1 把这些定义从 `app-boot/src/profile.ts` 搬进了这个新包。三种产品形态靠这张表选择模块，表不在我方手里就没有形态 | 2026-10-28 |
| `packages/typert/protocol/src/index.ts` | `RemoteAuthority` 与 `requires` 重新挂到上游重写后的选项机制上（`RemoteMarkerOptions`、`markerOptions()`、`REMOTE_*_OPTION_KEYS`、marker 等值比较、命名空间绑定） | 上游把 `exportName` 改名 `name` 并引入 `resources` 读取器。两者互补：`resources` 说一次调用碰到哪些记录，`requires` 说这次调用要什么身份，都挂 Gateway | 2026-10-28 |
| `packages/api/session-controller/src/{agent,commands}.ts` | bot engagement 重新挂到上游的 `createSession({...})`：`ApiSessionCreateRequest.engagement`、`composeAgent(presetId, engagement)`、`engageBot`、`botForObservation`；并让 `reusable` 在指定了 bot 时一律返回 false | 上游把会话创建改成「可复用空会话 + createSession」，`ensureSession` 不再存在。空会话以无人身份说话，而一个会话代表哪个 bot 是创建时写进它自己日志的 | 2026-10-28 |
| `packages/client/ui-workspace/src/client/navigation.ts` | `StartSessionOptions` 加 `bot?: string` 并穿过 `connectBlank`／`openWorkspaceSession`／`createInWorkspace`／`createNamed`；带 bot 时不复用空会话、不并入同工作区的在途请求 | 上游重写了这里（草稿初始化 + `StartSessionOptions`），我方原先的 `StartOptions` 已不存在 | 2026-10-28 |
| `packages/client/connection/src/rpc-host.ts` | 每请求作用域保留并与上游新增的 exact-route owner 校验并存：先校验 owner，再在作用域内调用路由；`rpcFetchHandler` 去掉我方的 `peer` 工厂参数（上游改为逐调用传入） | 上游给 exact route 加了 owner 校验，位置正好是我方作用域包裹的那一处 | 2026-10-28 |
| `packages/client/ui-theme/src/styles/design-platform.css` | 标签色继续取品牌调色板，另采纳上游新增的 `--dsw-alias-label-shimmer` | 上游把中性色改成了 `--dsw-static-neutral-bluish-*` 体系 | 2026-10-28 |
| `apps/desktop/src/locale.ts` | 品牌占位符与 `brandedMessages()` 保留，并穿过上游新的多语言 `dictionaries` 查找；更新文案采纳上游措辞但产品名走 `{brandName}` | 上游把 locale 解析从 zh/en 二选一改成多语言字典 | 2026-10-28 |
| `apps/cli/tests/web-browser-open.expected.e2e.ts` | 四处写死的 `timeout: 30_000` 提为常量 `WEB_BOOT_TIMEOUT_MS = 90_000` | 上游在 16 核 runner 上标定这个预算，同文件兄弟用例已耗时 27.6s；4 核托管 runner 上启动 Web 树约 28s，30s 让门禁判的是机器速度而不是被测的浏览器交接 | 2026-09-23 |

## 上游可移植性缺陷（已在本地修复，**可反馈给上游**）

这六处不是二开需要，是上游代码在开发机或托管 runner 上的缺陷。上游 CI 之所以是绿的各有原因，
但在本机会稳定失败。改动都在上游文件里，因此登记在册；如果上游自己修了，
合并时冲突会很小。

| 文件 | 缺陷 | 上游为何是绿的 | 修法 |
|---|---|---|---|
| `packages/subprocess/subprocess-local/tests/spawn-runner.spec.ts` | `resolveWindowsExecutable` 的测试继承 `process.env`。本机导出了 `NoDefaultCurrentDirectoryInExePath=1`，实现**正确地**跳过了 cwd 探测，测试却期望它存在 | CI 环境不设该变量 | 7 处裸命令调用显式传入空的 `currentEnv`。实现未改——它本来就是对的 |
| `packages/experimental/code-runtime-python/tests/runtime.spec.ts` | 断言子进程看不到 `PATH`。本机 `python3` 解析到 pyenv **shim**（shell 脚本），它自己 `export PATH` 后再 exec 真解释器 | CI 用真解释器，无版本管理器 shim | 测试改用 `sys.executable` 拿到的真解释器。已实测：真解释器在空环境下 `PATH` 是 `None`，运行时的 env 构造是对的 |
| `scripts/browser-bundled-externals.spec.ts` | vite 配置用绝对路径指定 input，而 vite 会对自己的 root 做 realpath。macOS 的 `$TMPDIR` 是符号链接，两边不一致导致产物名变成逃出 root 的相对路径，rolldown 拒绝 | Linux 的 `/tmp` 不是符号链接 | fixture 根目录改用 `realpathSync` |
| `packages/experimental/webworker-runtime/tests/compile/transform-corpus-check.ts` | dockkit 的豁免要求失败信息指向它**自己的** css，但产物先 import 外部化的 `ui-primitives`（同样因 css 被豁免），于是 loader 报的是那个包的 css——该条件永远为假 | 该 spec 在无构建产物时会 skip；上游 `pnpm run test` 不先跑 `build:lib:host` | 豁免条件改为「自己的 css，**或**来自同样因 css 被豁免的其他包」。`other-css` 负例仍然报告，契约未放宽 |
| `apps/cli/tests/profiles/headless/tests/fixtures/deepseek-defaults.patch.yml` | `streamIdleTimeoutMs: 150`，而这些用例所用的 mock server 每 60ms 才发一次 keep-alive，只剩 90ms 余量。定时器一滑就触发流空闲超时并重试，请求计数断言随即看到多出来的那次（`toHaveLength(2)` 实得 3） | 上游 16 核 runner 上定时器不滑 | 改为 1000，与姊妹 fixture `pi-ai-defaults.patch.yml` 一致。超时行为本身由 `llm-retry/tests/transport-recovery.spec.ts` 与 pi-ai 单测覆盖，这里没有断言依赖它触发 |
| `packages/subprocess/subprocess-local/tests/spawn.spec.ts` | `waitGone` 在 `process.kill(pid,0)` 与读 `/proc/<pid>/stat` 之间存在竞态：进程恰在其间被回收时内核给 `ESRCH`，而它只处理了 `ENOENT`，于是把「进程已消失」这个**它正在等的结果**当成异常抛出 | 上游 runner 上这个窗口几乎不命中 | `ESRCH` 与 `ENOENT` 同等对待，都表示进程已不在。仅测试辅助函数，实现未改 |


## 跑完 `rebrand --apply` 之后的收尾清单

codemod 只改文本和路径。下面这些是它改完之后必然过期、必须重跑或手工修的东西，
按顺序做（2026-09-12 实测得出，`--check` 通过**不代表**这些已经做完）：

| # | 动作 | 为什么 |
|---|---|---|
| 1 | `pnpm install` | 包名变了，lockfile 要重算 |
| 2 | `pnpm run clean`；再删 `git mv` 留下的空目录 | 空目录不含文件，但按目录枚举的门禁（如 snapshot corpus）会把它当成缺文件 |
| 3 | `gen-third-party-notices`、`gen-cordis-catalog`、`gen-config-catalog`、`gen-tsconfig-paths`、`gen-doc-graphs`、`gen-module-graph`、`gen-client-catalog` | 生成物里含包名。`gen-module-graph` 与 `gen-doc-graphs` 是两个脚本，2026-09-15 发现前三个 host 品牌包因只跑了后者而一直没进 `docs/module-graph.md` |
| 3.5 | `uv lock --project python/sdk` | uv.lock 被 codemod 保护（由 uv 生成），改名后它仍钉着旧发行名，`pnpm install` 不会重算。2026-09-17 实测：pyproject 早已是 `lyness-sdk`，锁文件却还写着 `deepseek-harness-sdk` |
| 4 | `verify-translation-pairing --write --all` | 配对记录存的是两侧内容哈希；改名同时改了两侧，哈希全部过期（本次 648 条） |
| 5 | **手工**对齐生成文档的中文侧顺序 | 生成器只写英文侧。改名后包名字典序变了，中文侧会保留旧顺序（本次：`config-catalog.zh.md` 两节、`capability-seams.zh.md` 两条图边） |
| 6 | 重排按名字排序的期望文件（**已有门禁**：`scripts/rename-order-and-wrapping.spec.ts`） | 同上。2026-09-12：`tool-schemas.expected.json` 的工具顺序、`web-browser-open.expected.e2e.ts` 的内联快照键序、desktop 的三个夹具。2026-09-28 同一条又漏做，撞出两处：`subagent_dsh_sdk` < `subagent_fork`（d<f）改名后变成 `subagent_lyn_sdk` > `subagent_fork`，工具清单断了字典序；`installed-update-bootstrap.spec.ts` 的 `readdir().sort()` 期望值同理 |
| 6.5 | 重算按宽度折行的期望文本（**已有门禁**：同上） | 改名改的是**长度**，不只是顺序。commander 在运行时按终端宽度折行，`lyn: boot a lyness profile` 比上游同一句短九个字符，折行点左移一个词，而夹具被逐字改写、保留了旧折行。2026-09-28：`apps/cli/tests/expected/launcher-help.txt`。2026-10-07 做成门禁：快照工具清单的字典序、`.sort()).toEqual([…])` 字面量自身有序、以及 launcher help 在 80 列下的贪心折行，三条都带反例证明能拒绝 |
| 7 | 重算 `scripts/lint-rule-fingerprint.spec.ts` 的三条 sha256 | `.oxlintrc.json` 有一句规则提示含包名 |

## 两条证据面的坑（2026-10-06 各踩一次）

**加一条 workspace 依赖，要核锁文件里无关的版本有没有动。** 为给一个包加 devDependency 跑的 `pnpm install` 会把无关子图一起重解析：本次 `micromark-core-commonmark` 2.0.3→2.0.4、`micromark-factory-space` 2.0.1→2.0.4 之外还新增了 `micromark-util-types` 2.0.3，于是两份类型并存，`ui-primitives/src/markdown/parse.ts` 的 unified 重载编译不过，CI 里六个带 build 的 job 一起红。本地看不出来——增量构建复用 tsbuildinfo，只有冷构建会重新检查那个文件。修法：从上一个绿提交取回锁文件，只手工补上 importers 里那条 `link:`（workspace 链接不经过注册表），然后删掉 `node_modules/.pnpm` 与 `node_modules/.pnpm-workspace-state-v1.json` 重装——`--force` 和删 `.modules.yaml` 都不会让 pnpm 重排布局。

**证据面要对准改的东西，`test:docs` 不等于 `doc-sync`。** 改了 Config 字段却只跑 `pnpm run test:docs`（doc-quick 聚合），而 `verify-config-catalog` 只在 `doc-sync` 里：catalog 过期让 static job 失败并 fail-fast 带掉其后全部静态门禁。同理，改 `scripts/run-gates.ts` 的门禁注册要跑 `scripts/run-gates.spec.ts`——hygiene 聚合的 id 清单钉在那里，漏改会让两个覆盖率 job 红。

### 新增包之后同样要做的一件事

生成文档只写英文侧，而配对门禁只比**代码块与链接目标**——表格单元格的缺失它查不出来。
新增一个包后，除了重跑生成器，还要手工核对中文侧的表格行。2026-09-13 实测漏掉过
`docs/event-producer-consumer.zh.md` 的事件消费方一行，门禁全绿。
核对方法：`grep -c <包名> docs/<文件>.md docs/<文件>.zh.md` 两侧计数必须相等。

第 5、6 项没有门禁能自动修，只能靠失败信息定位。它们全都源于同一件事：
**`@lyness/*` 的字典序与 `@deepseek-ai/dsh-*` 不同。**

## 包名判别符（已解决）

上游用包名中的 `dsh-` 段区分两类包。改名最初去掉了这一段，导致所有「按名字前缀识别自家包」的门禁失效，
且有两种失效方式——其中一种是**静默**的：用常量拼出的前缀（`` `${LYNESS_PACKAGE}-` `` → `@lyness/lyn-`）
不匹配任何包，检查通过却什么都没验证。累计 6 处门禁需要手工排除，一次上游同步就新带来 3 处。

2026-09-12 改为**保留产品段**：

| | 上游 | 本 fork |
|---|---|---|
| harness 包 | `@deepseek-ai/dsh-agent` | `@lyness/lyn-agent` |
| vendored 包 | `@deepseek-ai/cordis` | `@lyness/cordis` |

结构与上游同形，只换了名字。收益：

- 6 处门禁排除**全部回退**，上游检查逐字生效，`hygiene` 对它们零改动通过
- codemod 从 21 条规则减到 18 条——被删的三条只为掩盖去掉产品段的后果而存在
- desktop 的 package-set 夹具排序回退（`lyn` < `lyn-base` < `lyn-desktop-host`，与 `dsh` 时一致）

代价：包名变长，`@lyness/lyn-agent` 读起来冗余——而门禁依赖的正是这份冗余。
理由与被否方案见 [Agent Note](.agents/notes/implemented/process/2026-09-12-restoring-the-product-name-segment.md)。

## 我新增的文件/能力

| 能力 | 位置 | 说明 |
|---|---|---|
| 租户配置 RPC | `packages/api/tenant-controller` | `ctx.remote.tenant`：`describe`（配置 + `writable` + `configured`）与 `save`（整份替换，输入不带租户 id）。租户只来自请求；wire 字段与能力缝规则各校验一遍，问题一次列全；答复从存储回读。**冲突 #2 按「用已有 Remote、不做 REST」裁定。**[决策](.agents/notes/implemented/architecture/2026-09-21-tenant-configuration-over-rpc.md) |
| 请求级租户 | `packages/tenant/tenant-request` | `ctx.requestTenant`：在 Connection 上注册每请求作用域（`rpc.scope`），按请求头→主机名→子域名解析调用方租户，并连同其配置在调用期间发布（AsyncLocalStorage）。解析不到不拒绝，由应答方决定。只覆盖一元 RPC。[决策](.agents/notes/implemented/architecture/2026-09-21-the-tenant-of-a-request.md) |
| 会话租户戳记 | `packages/tenant/tenant-session` | 会话创建时写一条仅日志事件 `tenant/identity`：租户 id、标识，以及该租户的约束与个性**原文**（配置可改，只记 id 事后还原不出当时文本）。投影兼作幂等守卫，fork 与恢复保留原戳记。新增事件类型不升会话格式版本。[决策](.agents/notes/implemented/architecture/2026-09-20-tenant-in-the-session-log.md) |
| 租户配置入库 | `packages/tenant/tenant-config-store` | `ctx.tenantConfig` 的持久化后端：`tenant_config` 存储域、版本 1、`per-record`（保存一个租户不重写其他租户）；自报 `writable`，写入前跑 `validateTenantConfig`，自身不接受配置。与只读后端二选一，不叠加。[决策](.agents/notes/implemented/architecture/2026-09-21-durable-tenant-configuration.md) |
| 租户配置 | `packages/tenant/{tenant-config,tenant-config-static}` | `ctx.tenantConfig`：按模态的模型（语言／图片／视频／音乐）、供应商授权（带凭据引用与自建端点，密钥不入配置）、功能开关、身份（约束叠加／个性替换）、界面文案覆盖。不回落部署级模型；后端自报只读或可写。[决策](.agents/notes/implemented/architecture/2026-09-20-tenant-configuration-seam.md) |
| 租户能力缝 | `packages/tenant/{tenant,tenant-static,tenant-http}` | `ctx.tenants` 目录（按不可变 id／主机名／子域名标识三种查法）+ 组合配置清单提供方 + HTTP 调用方（请求头 → 主机名 → 子域名，解析不到即拒绝，无兜底租户）。不挂载即单租户。[决策](.agents/notes/implemented/architecture/2026-09-17-tenant-directory-seam.md)、[子系统页](docs/subsystems/multi-tenancy.md) |
| 会话删除 + 数据页 | `packages/session/session-deletion` + `packages/api/session-data-controller` + `packages/client/ui-settings-data`（并给 `SessionPersistence` 新增 `delete`、给 `SessionProjectionCache` 新增 `forget`） | **裁定（2026-10-30，由 fork 所有者裁定）**：删除做硬删除，不做墓碑、不做「只隐藏」。仓库原本没有任何删除会话的能力——`SessionPersistence` 只有 create/open/flush/stat/list——所以这一步在一个已发布的 Service Definition 上新增了破坏性操作。**范围与 ZIP 导出归档的范围完全一致**：用 `sessionQuery.traceSession` 的同一份谱系答案，目标连同每个 subagent 后代，按前序遍历的逆序（最深的先走）删除，日志先走、缓存记录后走。开着的对话被拒绝（后端的写排他是兜底），搜索索引不被通知（它从后端列表自愈）。**保留项**：附件对象按内容寻址且共享、没有引用计数，所以字节留下，页面如实写明。`sessionData` 命名空间 `requires: 'member'`，在移除任何东西之前从对话自己的日志决定可见性，别人的对话与从未存在过的对话得到同一个回答。导出复用既有的 `sessionLogDownload`，不新增第二条导出路径。个人平面第 5 步，[设计](.agents/notes/proposed/architecture/2026-10-30-deleting-a-conversation.md) |
| 「你可以用什么」只读页 | `packages/api/agent-capabilities-controller` + `packages/client/ui-settings-capabilities` | 设计笔记的风险条要求这页**当场投影 agent 真正读的那些注册表**，不许自己维护清单——实现照此：每次调用重读 `ctx.tools.definitions()` 与 `ctx.skills.list()`，不存任何状态（有一条测试在两次读取之间撤掉工具来钉住这点）。归属是算出来的而不是存下来的：工具注册不带注册方，所以用 `agentPresets.acquireScope()` 取得预设自己的作用域视图，与部署全局视图相比——两者都有即部署，只有作用域里有即预设；租约在抛错时也释放。MCP 服务器按 `mcp__<server>__<raw>` 命名规则从工具名里读出来，报成一个连接而不是四个工具。模型不重复实现，直接复用既有的 `session.modelCatalog`；模型清单单独失败不拖垮整页。缺失的注册表如实报成缺失（没有 `skills` 成员 ≠ 空数组）。个人平面第 4 步 |
| 有主的记忆 + 记忆页 | `packages/memory/memory`（分区）+ `packages/api/memory-controller` + `packages/client/ui-settings-memory` | **先用探针证实的事实**：改之前 memory 是进程级的——任何一条 member 条目都进入进程内每一次提示词组装，`memory_list` 也把它返回给每个 agent；而 `module-memory` 确实被 hosted 与 enterprise 两个多人形态选中，所以这是真实的跨人可见，不是理论问题。**路线以官方为准**：memory 的 README 写明「reads the existing scope without a stored-format change」，于是按人分区存储、不给记录加 owner 字段——域里多一张 `personal` 表，键为 `owner/id`，记录格式一字未动，无需持久化类型确认。归属来自会话自己的 `session/owner` 投影（投影拆到 `@lyness/lyn-session-ownership/projection` 子路径，免得 memory 被 request-principal 拖进客户端传输的依赖图）。**裁定（2026-10-29，由 fork 所有者裁定）**：改之前写下的 member 条目当作共享、保持现状可见——静默让已记住的事实从提示词里消失，比保持现状更危险。`ctx.memory.list`／`forget` 现在只覆盖当前对话看得见的范围；`listOwnedBy`／`forgetOwnedBy` 是页面用的按人读写。`memories` 命名空间 `requires: 'member'`，且不接受「人」参数。个人平面第 3 步 |
| 个人指令（提示词的用户层） | `packages/identity/personal-instructions` + `packages/api/personal-instructions-controller` + `packages/client/ui-settings-instructions` | `ctx.personalInstructions`：按人保存他对自己 agent 说的话，在他开的每一段会话里写一条仅日志事件 `person/instructions`（原文），并从那条记录把文本组装进每个 agent 的提示词——新分区位 `PERSON_INSTRUCTIONS: 70`，夹在 `TENANT_CONSTRAINTS`(60) 与 `BOT_PERSONA`(100) 之间。**权威是记录不是存储**：改指令不会改变一段正在进行的对话此前说过的话。owner 由形态决定：不挂 `requestPrincipal` 的部署用 `SOLE_OPERATOR`（单操作者），挂了的用登录者，没出示身份的调用不作用于任何记录。Remote 命名空间 `requires: 'member'`（任何部署认识的人，不要求组织身份），**且没有任何方法接受「人」这个参数**——owner 一律从身份推出，所以一个人读不到另一个人的指令不依赖于谁记得写检查。个人平面第 2 步，[设计](.agents/notes/proposed/architecture/2026-10-28-the-personal-plane.md) |
| 每个 agent 一份贡献 | `packages/core/agent` 的 `composePerAgent` | `tenant-session` 与 `personal-instructions` 都要「给每个 agent（含已在跑的）挂一份东西，随 agent 作用域撤回，再随自己卸载撤回剩下的」，jscpd 把这段 31 行判为克隆。抽进 `lyn-agent`（它本就拥有 `agent/created`／`agent/disposed` 与 `agent.ctx`）。副作用：`docs/event-producer-consumer.md` 现在把这两个事件的消费方记成 `agent` 而不是那两个包——这是事实，不是漂移 |
| 共享的 viewer 读取 | `packages/client/ui-viewer` | `ctx.uiViewer`：浏览器端唯一一次 `identity.viewer()` 读取，并由同一个答案推出「这个身份是否属于管理方」。登录屏、账户行、设置导航三处共享它，不再各问一次。无账号体系的部署判为管理方（没有人会被拒绝），高于 `member` 的身份判为管理方，member 与无身份的个人上下文不是。[个人平面设计](.agents/notes/proposed/architecture/2026-10-28-the-personal-plane.md) |
| 设置的两个平面 | `packages/client/ui-settings` 的 `settings.administration.section` 槽位 | 分区按平面分成两个列表槽位：个人平面留在 `settings.section`，管理平面注册到新槽位（models、plugins、credits、agent-presets、sign-in-channels、people、bots、history 八个已迁入）。平面是注册方选哪个槽位，不是传一个标记，于是不渲染管理平面的组合根本不会加载那些页面。外壳只在 `uiViewer` 判为管理方时提供这一组；**这是导航，不是授权**——每个管理类调用仍各自检查自己的身份。组合里没有 `uiViewer` 时提供全部平面（没有目录可问，也就没有人要隐藏） |
| 内置字标字体 | `packages/host/brand-fonts` | Inter SemiBold + Noto Sans CJK SC Medium（均 OFL-1.1，原样随附），覆盖拉丁／希腊／西里尔／中日韩；**只用于品牌字标**，不下发浏览器。声明走 `third-party-assets.json`（校验和 + 许可证 + 未登记字体文件即报错） |
| 品牌引导命令 | `packages/bundle/brand-studio` | `lyn --profile brand-studio`：图标 PNG + 字体文件 → 三个 SVG，写入目标 profile（默认 `web`）补丁层的 `brand-deployment` 行。仅参数、仅上传路径；品牌方自带字体，须 `--accept-trademark` 与 `--accept-font-license` 确认（SaaS 只用平台内置字体，见 `.fork/BRAND-CONFIG.md` 字体一节）。[决策](.agents/notes/implemented/architecture/2026-09-15-brand-studio-profile.md) |
| Web UI 品牌 | `packages/client/ui-brand-lyness` | 所有构建中填三个品牌 slot（lyness 图标 + inter-600 字标），页面带部署品牌时逐项让位。[决策](.agents/notes/implemented/architecture/2026-09-15-lyness-brand-in-the-web-client.md) |
| 可重放的品牌改名 | `scripts/rebrand.ts` | 41 条有序规则（含 Python 包名规则 `python-package`、删除型规则 `shields-logo`，`--reverse` 跳过它）+ 保护路径 + 后置断言 + `--check`。**每次 sync upstream 后必须重跑**，否则上游带回的旧名会残留。设计见 [Agent Note](.agents/notes/implemented/process/2026-08-31-lyness-rebrand-codemod.md) |
| 改名的往返门禁 | `scripts/rebrand-round-trip.spec.ts` | 钉住 `forward(backward(x)) === x`（文本与路径），确认反向不留哨兵、不产生带空格的路径（扫描全部受跟踪路径）。整条同步流程立足于这条性质，而它此前不成立——详见「反向改名的还原能力」一节 |
| 可配置的 e2e 目标 | `packages/test-support/e2e-target` | `@lyness/lyn-e2e-target`：从产品同样读取的 `DEEPSEEK_BASE_URL`／`DEEPSEEK_MODELS` 解析 e2e 调用的平台与模型，未设置即官方；`official` 标志让官方独有功能的测试在别处跳过。[决策](.agents/notes/implemented/testing/2026-09-22-configurable-e2e-platform.md) |
| fork 自己的 CI | `.github/workflows/fork-ci.yml` | push 到 `custom/main`（或手动触发）时在 GitHub 托管 runner 上照搬上游 `ci.yml` 的有用任务：static、Linux 覆盖率、benchmarks、snapshots and artifacts、Node 22.19/24.9/26 兼容、Python keyless SDK，以及 Windows 的 build／coverage／native tests／observational（observational 不阻断）。上游这些任务只在 PR 上、只在上游企业 runner 上跑，本 fork 两者都没有——Dependabot PR 的覆盖率任务曾空等 24 小时。并发参数按托管 4 核调小。`python-runtime` 需要 `DEEPSEEK_API_KEY_EXTERNAL` 密钥，只在仓库变量 `LYNESS_FORK_REAL_API` 为 `true` 时运行。真实 API 的 e2e 同样在 `LYNESS_FORK_REAL_API` 为 `true` 时运行，平台由仓库变量 `DEEPSEEK_BASE_URL`／`DEEPSEEK_MODELS` 决定；`python-runtime` 因上游文件钉死官方端点，只在未设置 `DEEPSEEK_BASE_URL` 时运行。未照搬：发布、上游 PR 治理、文档部署。Windows 分钟数按 Linux 的 2 倍计费。`fork-` 前缀让它永不与上游合并冲突 |
| 二开任务清单 | `.fork/TASKS.md` | 需求拆解、7 处冲突裁决与分阶段计划 |
| 二开手册 | `.fork/FORK-GUIDE.md` | 原在 `docs/` 下，因受上游双语门禁管辖而迁出 |
| 部署层品牌 | `packages/host/brand-deployment` | 组合层 `Config` + 资产按角色提供 + `renderIndex` 注入。改 patch 层并重启即换品牌，不重建前端。[决策](.agents/notes/implemented/architecture/2026-09-13-deployment-brand-as-composition-config.md) |
| 字标排版 | `packages/host/brand-wordmark` | fontkit 把品牌名排版成单色 SVG 字标（高 24，按字体行框定字号，宽于 7:1 拒绝）；字体由调用方提供。[决策](.agents/notes/implemented/architecture/2026-09-15-wordmark-typesetting-with-fontkit.md) |
| 图标描边 | `packages/host/brand-icon` | 图标 PNG 铺白底、按亮度区分图形、裁到图形、描成单色 SVG 图标并派生 favicon；另提供品牌 SVG 语法检查 `isBrandSvg`。[决策](.agents/notes/implemented/architecture/2026-09-15-brand-icon-from-png.md) |

## 我故意删除或禁用的内容 ⚠️ 合并官方后必查

| 路径/配置 | 原因 | 上次确认仍被移除的日期 |
|---|---|---|
| `session-telemetry-otel` 的默认外发（`mode` + `exporter.url`） | 服务他人用户的部署不能默认把会话记录转发给厂商 | 2026-10-28 |
| 内测／预览版声明弹窗（`ui-settings-models` 的 `WelcomeNotice.tsx`、`welcome-store.ts`、`onboarding-copy.ts` 及两个测试，以及 `welcome*` 语言键） | 这个弹窗声明的是「DeepSeek Harness 面向 Harness 开发者内测」，它说的不是本产品的状态，首次访问的人第一眼不该看到它 | 2026-10-28：上游把它重写并扩充成 0.2 预览版弹窗（新版本号 `2026-09-28.1`、独立设置命名空间与确认字段），删除决定不变，已在 `scaffold.ts`、`onboarding-deepseek-config.e2e.ts`、`apply.client.spec.ts`、`src/client/index.ts` 四处一致移除；同处新增的 sign-in 步骤保留 |

> 这张表靠人复查，人会忘。**待办**：为遥测项补一条行为测试（断言默认组合下不产生外发请求），
> 把「每次合并后人工复查」变成 CI 自动拦截。测试检查行为而非文件路径，上游换实现也拦得住。

## `rebrand:check` 的表达力（2026-09-28 修复）

`--check` 曾报 35 处 residue，全部是刻意保留的名字。它没法区分「codemod 漏改」和「刻意保留」，
于是这条收尾命令不再是信号——报出来的都要人工逐条回忆为什么。基线 22 处是既有缺陷，另 13 处是
还原服务端 wire 字段和 office 作用域时新撞出来的。

按名字的**边界**分两种修法，不是二选一：

- **一个稳定标识符 → 屏蔽规则。** `dsh-session-title-llm` 是 `RESERVED_SOURCE_KINDS` 里的冻结
  改名目标，散在 23 个文件（含 15 个活的源码/测试）。对这些文件整体豁免 `dsh-token`，下次同步
  它们新增的 `dsh` 会被静默跳过——正是要消灭的失效模式。改用 `released-title-producer-shield-*`，
  排在作用域规则**之后**、`dsh-token` 之前：那时 `@deepseek-ai/dsh-session-title-llm` 这个同名
  包已改成 `@lyness/lyn-session-title-llm`。护的是名字，不是文件。2026-10-28 进一步收窄为
  **带引号**的两种写法（`'…'` 与 `"…"`）：冻结标识进入持久化数据时总是字符串字面量或 JSON
  串值，而包名出现在作用域形式或文档代码跨距里；原先的裸写法把包名在自己 README 里的出现也
  一起护住了，10 个文件的散文因此改不动。
- **拼写无界 → `PROTECTED` 路径豁免。** office 引擎的寻址有 `@deepseek-ai/libreoffice-kit`、
  `'@deepseek-ai', 'libreoffice-kit'`、`@deepseek-ai\/libreoffice-kit-(?:darwin|win32|linux)`、
  `f"{office_modules}/@deepseek-ai"` 至少四种写法，按拼写补规则永远收敛不了（上一轮反复六轮的
  教训）。这 10 个文件改为只豁免四条作用域规则，其余重命名照旧生效。同理还有
  `session-format-v3-to-v4/src/sources.ts`（已发布 V3 生产者表，每个左值都是某个真实 generation
  记过的字符串）和 `deepseek-llm-api-wire-extensions.i18n.yaml`（标题锚点的连字符形）。

验证方式不是「不报错」，而是在上游树（`477b4f4205`）跑一次 `--apply`：21 处包名照改、裸冻结标识
保留、102 处 `dsh_session_log` 与 191 处 `@deepseek-ai/libreoffice-kit` 未动。现在 `--check` 报
`post-state verified — no residue`，报出来就是真漏改。

## 反向改名的还原能力（2026-10-28 修复）

同步的流程是「反向改名 → 合并上游 → 正向改名」，所以 `forward(backward(x)) === x` 是整条流程
的立足点，而它此前不成立。正向把 `DeepSeek Harness`、`deepseek-harness`、`deepseek_harness`
三种写法都归到同一个分叉名，反向读 `to` 因此有歧义：排在最前的规则吃掉全部 `lyness`，其余
一无所获。`ui-brand-lyness` 被还原成带空格的 `ui-brand-DeepSeek Harness`——这类路径对不上它
来自的上游文件，同步时上游改动会被当作无关新增而静默丢弃。实测污染 501 个文件、8008 处文本、
27 条路径（含 `python/sdk/src/`、`ui-brand-*` 两个整包目录）。

哨兵对是同一个病的另一形态：shield 与 restore 合起来让被保护的名字原样不动，这对规则在反向
本就无事可做；按正向顺序反向迭代时，restore 的逆会把哨兵盖到每一处残留的分叉 token 上，
`lyn_home` 因此退化成 `dsh_home`。

修法三项：碰撞规则各自声明带分隔符的反向拼写（`lyness-`／`-lyness`／`lyness_`／`src/lyness`）
并排在规范规则之前；哨兵对在反向整体跳过；两个过度匹配的哨兵改为逐个点名。门禁是新增的
[`scripts/rebrand-round-trip.spec.ts`](scripts/rebrand-round-trip.spec.ts)，它只写分叉侧字面量、
上游侧由规则推导——直接写上游字面量的测试会被正向改名改成分叉名，两边读起来一样，测试就自我
失效了。它还扫描全部受跟踪路径，确认反向不产生任何带空格的路径。

全树实测残差从 88 个文件降到 3 个：`docs/persistence-catalog.{md,zh.md,i18n.yaml}`。它们是持久化
目录的生成产物——第 1 列渲染裸标识符、第 4 列渲染带引号形式，收窄后的哨兵只护后者——由改名后
清单里的重新生成负责，不属于分叉内容。

## 已知残留（codemod 未覆盖，非本次合并引入）

| 残留 | 位置 | 影响 | 处理 |
|---|---|---|---|
| 归档 Agent Note 中的 `dsh`（104 处） | `.agents/notes/archived/` | 无 | **刻意保留**：归档笔记冻结，是官方历史记录 |

## 品牌替换清单 ⚠️ 合并官方后必查

对外产品名：英文 **lyness**，中文 **领驭**。官方中文文档没有中文产品名，直接沿用英文 "DeepSeek Harness"，所以「领驭」是二开新增的，无官方对应值。

下表「我的值」为 `未决` 的行是尚未拍板的品牌面，不是遗漏。官方值一栏的出现次数为 2026-08-31 实测。

| 项 | 官方值 | 我的值 | 所在文件 |
|---|---|---|---|
| 产品名（英文，小写） | `DeepSeek Harness`（360 处） | `lyness` | 已定 2026-10-06 |
| 产品名（英文，全大写） | `DEEPSEEK HARNESS` | `LYNESS` | 已定 2026-10-06 |
| 产品名（中文） | 无 | `领驭` | 已定 2026-10-06 |
| 缩写 | `DSH` | `LYN` | 已定 2026-10-06：上游用缩写的位置照用 `LYN`，不改成全名 |
| 仓库/标识 slug | `deepseek-harness` | `lyness` | 已完成；归档笔记冻结不动 |
| CLI 命令名 | `dsh` | `lyn` | `apps/cli/package.json` bin |
| npm scope | `@deepseek-ai/dsh-<name>` | `@lyness/lyn-<name>`（harness）／`@lyness/<name>`（vendored） | 已完成。产品段**保留**——上游靠它区分两类包，去掉后 6 处门禁失效且其中一处静默失效（[记录](.agents/notes/implemented/process/2026-09-12-restoring-the-product-name-segment.md)） |
| 用户数据目录 | `~/.dsh` / `$DSH_HOME` | `~/.lyn` / `$LYNESS_HOME` | `packages/util/home-paths`；目录名与环境变量前缀刻意不成对，用户 2026-08-31 定 |
| 系统提示词身份 ⚠️ | `You are an AI agent powered by DeepSeek Harness.` | `...powered by lyness.`（已完成） | `packages/core/system-prompt/src/index.ts:412`（模型可见，改动需更新 snapshot） |
| Web UI 品牌插槽 | `@deepseek-ai/dsh-client-ui-brand-official`（鲸鱼） | `ui-brand-lyness`（已完成） | `packages/client/ui-brand-lyness`；web-app 已摘下官方包 |
| 文档站 | `https://deepseek-harness.github.io` | 保留，是否公开后续定 | `website/` + `.github/workflows/docs-pages.yml` |
| Logo | `website/public/{wordmark,favicon}.svg`、`apps/web/public/favicon.svg`（鲸鱼） | lyness 图标 + inter-600 字标（已完成） | 源文件在 `.fork/brand-output/`（git 忽略）；⚠️ 合并后必须恢复 |
| 徽章 | `lyn-badge.png`（鲸鱼 + powered by dsh）、shields `logo=deepseek` | lyness 图标 PNG；shields 去掉 logo（已完成） | `packages/skill/skill-badge/assets/`；shields 由 codemod 规则 `shields-logo` 重放，PNG ⚠️ 合并后必须恢复 |
| API 端点 ⛔ | `https://api.deepseek.com` | 不改 | 供应商地址，非品牌 |
| 裸词 `Harness` ⛔ | `Harness`（注释与 JSDoc 共 79 处，另有若干代码内） | 不改 | **类别名词**，读作 `agent harness` 的那个义项，不是品牌面；codemod 每条规则都刻意要求 `DeepSeek Harness`／`-harness`／scope 才匹配（理由写在 `scripts/rebrand.ts` 顶部）。其中 `session/src/repair.ts` 那句更不能动：它是写进会话日志的模型可见文本，两个格式迁移器按它逐字匹配 |
| 请求扩展字段名 ⛔ | `dsh_session_log`、`dsh_plugin_packages`、`dsh_otel_report`、`dsh_feedback`、`dsh_login_bonus`、`dsh_bonus_notice_test` | 不改 | **官方服务端拥有的字段名**，不是品牌。服务端逐字匹配，改名后字段被静默丢弃——会话日志上传、插件清单、OTel 上报对真实端点失效，而所有 mock server 测试照样全绿。codemod 已加 `deepseek-request-field-shield-*` 六条屏蔽 + 一条还原 |
| 小写环境前缀 ⚠️ | `dsh_desktop_*`、`dsh_scrub_probe_lower` | `lyness_desktop_*`、`lyness_scrub_probe_lower` | 环境变量前缀的小写形，用于证明清理器大小写不敏感。通用 `dsh`→`lyn` 规则会写成 `lyn_desktop_*`，清理器认不出，断言变成永真。codemod 规则 `lowercase-desktop-env-prefix-probe`、`lowercase-env-prefix-probe` |
| 模型供应商 DeepSeek ⛔ | `packages/llm/llm-deepseek`、`DeepSeekOnboardingDialog.tsx`、`ui-settings-models` | 不改 | 指模型供应商，不是 harness 品牌；全局替换会误伤 |
| 遥测端点 ⚠️ | `https://harness-telemetry.deepseeksvc.com` | **已移除** | 默认 `DISABLED` 且无端点；启用需显式设两个环境变量。上游 0.1.5 的 `9ffe85a512` 把遥测**扩到了所有用户**（原先按 provider 区分），本二开的覆盖因此更重要，每次合并必查 |

## 品牌命名的四个面（2026-10-06 定）

官方 SaaS 版本按下表取值，四个面各有其位，不互相替代：

| 场合 | 取值 |
|---|---|
| 上游用缩写处 | `LYN` |
| 中文 | `领驭` |
| 英文小写 | `lyness` |
| 英文全大写 | `LYNESS` |

因此 UI 文案里的 `LYN`（「另一个正在运行的 LYN 实例」「与 LYN {runtime} 不兼容」等）**仍取缩写**，它不是漏改；中文名只出现在中文产品标签（侧栏的「领驭本地构建」），诊断类句子不换。

**独立部署默认沿用上表**；品牌方提供自己的缩写、中文名或英文全名时按其要求替换。实现是：`brand-deployment` 的 `productName`／`productAbbreviation`／`productNameZh` 三者各自可配，经页面全局交给客户端 locale；产品文案不再写死名字，而是写 `{brandName}`／`{brandAbbr}`／`{brandNameZh}` 占位，由 `packages/client/locale/src/client/brand-values.ts` 填充。三者**作为一组解析**：部署只给了其中一个，另两个取它，而不是回落到 lyness 的内置取值——否则 Acme 的界面里会混进 `LYN` 和「领驭」。包名（`@lyness/lyn-*`）与命令名（`lyn web`）是外部标识符，不参与替换。

## 合并官方记录

| 日期 | 官方 commit | 冲突文件数 | 验证结果 | 备注 |
|---|---|---|---|---|
| 2026-08-29 | 初始化克隆 | - | - | fork-init 建立基线 |
| 2026-09-10 | `aa8262ec09`（0.1.2-alpha.1 → 0.1.5-rc.1，2151 个提交） | 0 | typecheck ✅ build ✅ install ✅ | 未走逐行合并：品牌替换是**再生成**的，不是可合并的。做法见下节 |
| 2026-10-28 | `22ddee3792`（0.1.7-rc.2 → 0.2.1-rc.3，3912 个提交） | 1119（其中 944 为派生产物） | 见本节末 | 改用**真实三方合并**：先修好 `--reverse`，把全树还原为官方拼写再合并。做法见下节 |

### 2026-10-28 合并方法（反向改名 → 真实合并 → 正向改名）

上一轮用的是 `read-tree` 整树替换，因为那时 `--reverse` 不可用。这一轮先把 `--reverse`
修成可还原的（见「反向改名的还原能力」一节），于是可以走**真实的三方合并**，保留真正的
祖先关系与上游每个文件的改动，而不是整树替换后重打补丁。

1. `rebrand --reverse --apply`，提交。改名造成的 3343 处冲突因此不进入三方合并。
2. `git merge upstream/master` —— 实际冲突 1119 个。
3. 按类别分流：960 个派生产物（双语配对哈希、生成目录、锁文件、expected 产物）取上游；
   83 个清单／README／小改动走并集；26 个「我方小改动 + 上游大改写」取上游后补回我方增量；
   31 个手工解。
4. `rebrand --apply`，再按上面的收尾清单重录。

**整树替换 vs 真实合并**：前者不需要 `--reverse` 正确，但会丢掉上游的逐文件历史，
而且每次都要重新辨认「哪些补丁要重打」；后者把这件事交给 git，代价是 `--reverse`
必须真的能还原——这也是这一轮先去修它的原因。

**并集 JSON 要当心**：并集按冲突块保留两侧，接缝处会丢逗号、并产生重复键。本轮 9 个
`package.json` 因此语法失效（`pnpm install` 报 `ERR_PNPM_JSON_PARSE`），`terminal` 的
`version` 还重了两份（上游 `0.2.1-rc.3` 在前、我方 `0.1.7-rc.2` 在后，而 JSON 解析器取
**最后**一个——照装会装回旧版本号）。处理：补逗号，再按「首个优先」合并重复键并重排依赖段。

**并集还会留下指向已删包的依赖**。上游删掉一个包时，并集保留的我方那一侧仍然引用它，
`pnpm install` 到那一行才报错，一次只报一个。别逐个试：把全部 manifest 的 `name` 收集成
集合，再扫一遍所有 `workspace:` 依赖，一次列全（本轮两处）。同理要扫「有受跟踪文件但没有
`package.json`」的残片目录——上游整包删除时，我方新增的文件（如一条 `README.i18n.yaml`）
没有上游对应物，合并会把它留下来，变成一个没有 manifest 的空壳包。

### 最隐蔽的一类：**没有冲突**的文件丢掉了 fork 的新增

上游重写某个文件的一整段时，git 常常判为「一侧改动」而干净合并，于是 fork 加在那一段里的
东西无声消失——**没有冲突标记，没有告警**。本轮五处都是这样丢的，全部靠「re-export 指向
目标模块没有的名字」这条线索揪出来：

| 丢掉的 | 在哪 | 怎么修 |
|---|---|---|
| `requires: RemoteAuthority` 的分析器支持 | `typert/generator/src/analyzer.ts` 的 `gatewayBindingArguments` 与 `remoteOptions`，以及 `REMOTE_AUTHORITIES` | 重新挂到上游重写后的两个校验器上。缺它时 `bindTypertRemote({ requires })` 直接被判为非法选项，授权机制整条失效 |
| `MODELS_ENV`／`MAX_TOKENS_ENV`／`parseModelIds`／`parseMaxTokens` 与环境目录解析 | `llm/llm-deepseek/src/config.ts` | 重新挂到上游的 `resolveAdapterOptions`，默认目录判定改用上游的 `isBuiltInCatalog` |
| `followShippedTemplate` | `boot/app-boot/src/profile.ts` | 恢复。桌面端的插件 profile 靠它跟随 `web` 模板 |
| `SessionProjectionStateMap`（及 `checkpointState` 对它的引用） | `session/session-projection/src/types.ts` | 恢复类型与 index 的 import／export，并在 `gen-cordis-catalog.ts` 的 `linkedTypePages` 重新登记 |
| `StartOptions` 的 re-export | `client/ui-workspace/src/client/index.ts` | 上游已用 `StartSessionOptions` 取代，改为导出它 |
| `web-app/cordis.patch.yml` 里 fork 的 **12 行组装** | 公告／公告 RPC／积分 RPC／身份 RPC／部署品牌，以及 7 个客户端 UI 行（公告・积分・登录渠道・人员・机器人・历史・登录屏） | 整份文件被上游版本取代。按上游新结构逐块放回；依赖本来就都在 `web-app/package.json` 里，**所以只丢了行、没丢依赖，`pnpm install` 一声不响** |
| `base/cordis.patch.yml` 的 `api-remote-access` 行 | 上游注释写着「Gateway requires it」 | 补回。fork 的 `workspace-controller` 与 `session-controller` 都 `inject: ['remoteAccess']`，缺它则**整个 API 控制面挂不起来**，包括所有者裁定的双过滤取交集 |
| `base/cordis.patch.yml` 的 `otel` 行 | 上游 0.2.1 新拆出的传输提供者 | 补回（见下「遥测」一节）。`session-telemetry-otel` 声明 `inject: ['sessions','otel']`，缺它时 fork 那条遥测守卫钉在一条**永不激活**的行上 |
| `base/cordis.patch.yml` 的 `web-deepseek-api` 行 | 上游在 `web-search-deepseek` 之后挂它 | 补回。缺它时 `verify-product-use` 报该包「无产品运行时使用」 |
| `no-unknown-casts.baseline.json` 里上游的 **19 条指纹** | 13 个文件 | 基线是清单不是代码，取两代并集后再 `--prune` 到树里实际内容（518 文件／1061 指纹） |

**并集对代码是错的工具，只对清单管用。** 并集按冲突块保留两侧，于是同一个函数会出现两份
签名、同一个作用域的 `}` 会丢掉。本轮 14 个 `.ts`／`.tsx` 因此**连语法都不成立**，而
`pnpm install`、生成器、typecheck 全都只能一次报一个，顺着报错爬了很久。正确做法：
清单（`package.json`、`tsconfig`、`cordis.patch.yml`、语言字典）用并集；**代码一律回到
真正的三方**——

```sh
git show $BASE:$up > base; git show $OURS:$up > ours; git show $THEIRS:$up > theirs
git merge-file -p --diff3 ours base theirs > merged     # --diff3 把 base 也显示出来
# 解完冲突后，单独给这个文件跑一遍改名（codemod 导出了 rewrite/renamePath）
```

`--diff3` 是关键：没有 base 那一列，看不出「上游是删掉了这段，还是改写了这段」——本轮
`ui-settings-models` 的一个用例就是上游删除、我方恰好改过它，只看两侧会误判成两边都要留。
文件在当前树里是分叉命名、三个 blob 是官方命名，所以解完要单独改名；`renamePath(f, RULES, true)`
能把分叉路径换算回官方路径去取 blob。

**第四类：同一个段落的两代被并排留下。** Markdown 里没有冲突标记，读起来像两句话。
`verify-md-wrap`（它要求一个段落占一个物理行）会把它报成「折行」，所以报错措辞指向的不是真问题。
本轮 22 处（11 对中英），分布在 8 个文档。**两代常常各对一半**，不能二选一：
`web-app/README` 一行说默认 preset 是 `standard`、另一行说是 `work`，而
`cordis.patch.yml` 写的是 `default: standard`，`session_*` 工具却确实只在 `work`／`build` 里——
只能按代码事实重写。判定哪一行属哪一代，用 `difflib` 对两个父提交的同名文件各算一次相似度即可
（本轮 9 处判定全部一致：第一行是上游、第二行是 fork）。
同一批报错里还混着**丢了段间空行的两个不同段落**（3 处），那是补空行，不是合并残留——先分类再动手。

**第五类：JSON 对象里同一个键留了两代，解析器取后者。** `scripts/doc-budgets.manifest.json`
同时带着两代的 `AGENTS.md`／`docs/AGENTS.md`／`docs/architecture.md`，于是上游调高的
`docs/AGENTS.md` 上限与调低的 `architecture` 上限被静默吃掉，fork 自己的
`docs/defensive-patterns.md` 那条则随上游拆成目录而丢失。扫法：对每个 JSON 按对象深度统计键名，
3770 个文件里就这一处。

**第二类无声损坏：同一条语句的两代被并排插入。** 并集在语句级也会出事，而且语法合法、
typecheck 也过，只在运行时炸。本轮两处构造函数各被插入了**两次 `super(...)`**——上游那行带
`namespace`，fork 那行带 `requires`——第二次调用在运行时抛
`Super constructor may only be called once`，于是 `ScheduleService` 与 `WorkspaceController`
根本构造不出来。查法是一次 AST 扫描（找构造函数里 `super()` 调用数 > 1），6660 个文件里就这两处。

**第三类：同一个数组字面量里被串接了两代清单。** 也是语法合法。`run-gates.spec.ts` 的 hygiene
期望清单、`gen-tool-catalog.spec.ts` 的工具名清单都被串成了「上游那代 + fork 那代」。查法：
扫描所有元素全为字符串字面量的数组，找其中**重复出现的连续片段**（长度 ≥ 4）——6660 个文件
3 处命中、1 处是真问题，误报是「两轮 × 四节点」这类本就重复的用例。改之前先把两代清单与
代码的真实输出做差集，确认并集没有丢项（工具集 73 = 68 ∪ 70，一个没少）。

**语法扫描当门禁**：合并后先用 TypeScript 的 `createSourceFile` 把全树 parse 一遍
（6660 个文件几秒钟），一次列全被拼坏的文件，不要让 install／生成器逐个暴露。

**查法**（下次同步照做）：装依赖前先跑这三条扫描，它们各自一次就能列全，不必靠
`pnpm install`／生成器逐个报错试出来——

1. 所有 `workspace:` 依赖里指向不存在包的（上游删包 + 并集保留我方那侧）；
2. 有受跟踪文件但没有 `package.json` 的残片目录（上游整包删除 + 我方新增文件被留下）；
3. `export { X } from './y.ts'` 里 `./y.ts` 并不导出 `X` 的（上游重写模块 + 我方新增被吃掉）。
   第 3 条误报较多（多行 `export type {}`、`export *` 转发都会误判），但真问题一定在里面。

### 冲突裁决：Workspace follow 流上的两套过滤（2026-10-28，由 fork 所有者裁定）

上游 0.2.1 在 `api/workspace-controller/src/index.ts` 里新增了一套访问过滤：
`ctx.remoteAccess.allows({ kind: 'workspace' | 'session', id })`，不admitted 时发 `replace` 帧。
本 fork 早先在同一条 follow 流的 `feed.ts` 里实现了另一套：`ctx.sessionVisibility`。

**两者不是同一件事**，和 `requires`／`resources` 那一对同理：

| | 问的问题 | 依据 |
|---|---|---|
| 上游 `remoteAccess` | 这个调用方被**授权**看这个资源吗 | 共享／协作授予 |
| 本 fork `sessionVisibility` | 这段会话**是谁的**、这个人可读吗 | 账号归属（SaaS 租户与个人形态） |

**裁定：两者都生效，取交集。** 一行会话只有同时通过「我有权看这个资源」和「这是我的／我可读的
会话」才投递。实现上 `index.ts` 的 `follow` 每代解析一次归属可见集并传给 `baseline(owned)`，
与 `access.allows` 组合；`feed.ts` 保留对增量的归属收窄。两套都不删。

顺带把帧联合的口径理清：feed 既不产生 `baseline`（它开启一代）也不产生 `replace`（只有这两层
过滤会发），所以内部类型是 `WorkspaceFeedIncrement = Exclude<WorkspaceFollowIncrement, {type:'replace'}>`。

### 本轮的 API 漂移适配

| 上游改了什么 | 分叉侧怎么跟 |
|---|---|
| `sessionProjections.stateOf(session, key)` 标为废弃并返回 `unknown`，新做法是「拥有该投影的领域服务暴露类型化读取」（上游自己的 `agents.turnBoundaryOf` 就是这样） | `managedBots` 按新做法改：保留 `register()` 返回的 handle，init 里 await，新增 `botOf(session)`；`bot-ask` 三处读取改走它。`session-ownership` 与 `tenant-session` 暂时仍用带 key 的读法，但用该投影自己的 schema 解析回来（与注册表重载 checkpoint 时做的校验相同，不引入 `as unknown`），各留一条 `TODO(session-projection)` 指向迁移 skill |
| `workspaceView(workspace)` 回到单参数 | 恢复分叉的第二个参数与 `keepVisible` 过滤——Workspace 是共享的、它名下的会话不是，投影必须回答「这次调用能看见哪些」 |
| `Remote()` 选项 `exportName` 改名 `name` | `llm/llm` 的 `discoverModels` 装饰器跟着改；`requires` 不受影响 |
| `escapeInstructionFrameBody` 周边：上游把 `heading` 提成了文件而非渲染后的字符串 | 保留分叉返回 `{text, neutralized}` 的版本（标记要报告被中和的分隔符），按上游的形状在需要字符串处渲染 |
| `PROFILE_TEMPLATES`／`ProfileTemplate` 迁入 `lyn-official-bundles` | `brand-studio` 与 `apps/desktop` 改从新包导入，并补上 workspace 依赖与 tsconfig references |

### 已解决：`session/created` 监听器里不能再 append（上游 0.2.1 新约束）

上游给 Session 加了一条前置条件：`announcement` 未到 `complete` 之前 append 直接抛
`session "<id>" cannot append before session/created completes`（fork 那一代没有这条）。
而 `complete` 是在**所有 `session/created` 监听器返回之后**才置位的。

**这不是测试问题。** 直接跑产品代码即可看到后果：挂上 `session-ownership` 之后

```
CREATE FAILED: session "session-1" cannot append before session/created completes
```

事件契约写明监听器里的同步抛出「vetoes creation and rolls back with a paired disposal」，
所以**会话根本创建不出来**——坏在会话归属上，而那正是 `sessionVisibility` 读的东西。

两处 fork 插件在那个只读宣告里同步写：`identity/session-ownership`（`session/owner`）与
`tenant/tenant-session`（`tenant/identity`）。上游无一例如此。

**修法（已实测确认）**：契约说「New events reject until every synchronous listener has
returned successfully」，所以宣告之后的那个微任务就是最早可写的时点——

| 时点 | append |
|---|---|
| `session/created` 监听器内 | 被拒 |
| 宣告之后的微任务 | 成功 |
| `create()` 同步返回后 | 成功 |

两处都改成 `ctx.on('session/created', session => { queueMicrotask(() => stamp(session)) })`。
每条生产路径在宣告与把会话交给调用方之间都有 `await`（`agent-loop` 里 `announce` 紧跟
`await raceAbort(setup?.(...))`），所以读到归属之前记录已经落地。

**代价要记住**：`ctx.sessions.create()` **同步返回后的那一瞬**归属尚未写入。测试里凡
「创建后立刻读」都要等一个 `await Promise.resolve()`；若将来有同步读归属的生产路径，
它会读到「无主」——那种路径必须自己等这一个 turn。

同一轮里另外两类相关失败也已修：
- `apps/desktop/tests/locale.spec.ts` 钉的是「解析结果 == 原始字典」，而
  `resolveDesktopLocale` 会先填充品牌占位符。改为与「读者看到的那份」比较后，反而暴露出
  真问题：`welcomeKeyDescription` 有 7 种语言把 `{brandName}` 丢了或译成了「Harness」这个
  普通名词；同文件还有一条 fork 自己写反的断言（断言英文 == 法文，本意是不等）。
- `packages/api/gateway/tests/authorize.host.spec.ts` 没挂 `remoteAccess`，而 Gateway
  `inject: ['typert','remoteAccess']`，于是服务永远挂不起来（`ctx.typertGateway` 为
  undefined）。这是我把 `remoteAccess` 行补回 base 之后暴露的测试缺依赖。

### 本轮跟随上游退役的机制

| 退役的 | 上游怎么做的 | 我们怎么做的 |
|---|---|---|
| `packages/runtime-diagnostics/invariants`（`./invariant` 机制） | 0.2.1 整体移除：包、`packages/AGENTS.md` 里的规则、`verify-package-invariants` 门禁，三者一起 | 跟随移除。合并只留下 2 个孤立 i18n 记录和 3 行 manifest 依赖，一并清掉；没有悬挂引用 |
| `packages/subagent/subagent-in-process-driver` | 删除该包，自己的 `subagent-spawn-in-process` manifest 也不再列它 | 跟随移除 |

### 裁定：六个包的默认开关（2026-10-28，由 fork 所有者裁定）

上游 0.2.1 把 `tool-ralph`、`tool-terminal`、`tool-session-query`、`skill-badge`、`webhook`、
`webhook-github` 六个包移进 `packages/experimental/`，并在自己**所有** bundle 里一处都不再引用——
它们整体退出了上游的默认产品，改由 `OPTIONAL_BUNDLES` 里默认关闭的 experimental bundle 承载。
本 fork 的 `web`／`enterprise`／`hosted` profile 仍默认带着它们，于是 `constraints` 与
`verify-default-product-isolation` 同时报错（实验包不得进入默认产品）。

**裁定：把这六个包移出 `packages/experimental/`，留在默认产品里。** 理由是 lyness 既要兼容
「一切皆插件」，也要让企业**拿来就用**——其中几项是对标竞品后加进默认能力的，默认界面也依赖它们。
落点回到 fork 原来的产品目录：

| 包 | 从 | 到 |
|---|---|---|
| `tool-ralph` | `packages/experimental/` | `packages/workflow/` |
| `tool-terminal` | 同上 | `packages/terminal/` |
| `tool-session-query` | 同上 | `packages/session-query/` |
| `webhook`、`webhook-github` | 同上 | `packages/webhook/`（组 README 一并从 fork 原状恢复） |
| `skill-badge` | 同上 | `packages/skill/` |

**代价要记住：这六个包此后每次同步都会冲突**（上游的目录布局与我们相反）。连带要改的声明：
`experimental-package-policy.ts` 的 6 条保名例外要删、`tsconfig.base.json` 与 `tsconfig.host.json`
的 paths、`no-unknown-casts.baseline.json`、`gen-tool-catalog.ts`、
`verify-package-readme-model-experience.ts`、`docs/persistence-schema.json`、
`.github/workflows/ci-windows.yml` 与两个 e2e 的路径（本轮共 56 处）。

`webhook` 与 `webhook-github` 虽在默认产品目录里，但 `module-webhook` 的两行**出厂即关闭**
（GitHub 适配器有四个必填字段，其一是共享密钥的凭据引用；启用即是会创建根会话的公开 HTTP 入站），
所以它们在 `PRODUCT_PACKAGE_POLICY` 里登记为 `optional` 并写明这个理由。

### 裁定：遥测提供者 `otel`（2026-10-28，由 fork 所有者裁定）

上游 0.2.1 把 OTLP 传输拆成独立的 `packages/telemetry/otel`（服务自述「挂载不创建队列、身份或
网络连接」），两个消费者都 `inject` 它：

- `session-telemetry-otel` —— 上传**对话本身**，仅在用户显式给出反馈时触发，带匿名用户 id。
  这一条是本 fork 刻意关掉的（`mode: DISABLED` + 空端点，见「品牌替换清单」与「故意删除」两表）。
- `host-product-telemetry-otel` + `client-product-analytics` —— 上传**使用事件**（事件名、环境
  元数据、`device_id`／`user_id`／`app_version`），**不含对话内容**，仅桌面 profile，端点只来自
  `LYNESS_PRODUCT_ANALYTICS_OTLP_URL`，**无出厂默认值**。

`base/cordis.patch.yml` 里 `otel` 那一行在合并中丢了，于是两条链路都不激活：会话上传本来就关着
没差别，但 fork 自己写了 `enabled: true` 的桌面产品分析**静默失效**，而守卫测试钉在一条永不运行
的行上。

**裁定：补回 `otel` 行，并把守卫从「盯配置值」升级为「盯行为」。** 新增
`packages/bundle/base/tests/telemetry-silence.spec.ts`：读出厂行的配置、按 Loader 的方式求值
`!!js`、接上真实的 `node:http` collector、走一遍 `recordFeedback`，断言**零外发**；同一文件里
另有一条反向用例（显式 `FEEDBACK_ONLY` + 本地端点）证明这个守卫确实会红——否则它对一个「从不
导出」的后端也会通过，什么都证明不了。第三条用例断言桌面产品分析行的 `endpoint` 在默认环境下
为 `undefined`，上游若回填厂商默认值即失败。

### 裁定：11 个 Remote 命名空间的 `requires`（2026-10-28，由 fork 所有者裁定）

合并带进来 11 个未声明 `requires` 的命名空间（fork 自有门禁 `verify-remote-authority` 要求每个
都声明）。**裁定：10 个 `member`，`remoteAccess` 用 `anyone`。**

`schedule`、`userQuestions`、`pluginRecommendations`、`cuaAccess`、`cotTranslation`、
`claudeCodeMods`、`actionCards`、`productAnalytics`、`pluginMarket`、`workspaceController`
都是「已登录的人为自己行事」→ `member`。`remoteAccess` 是访问控制服务本身，要向尚未确认身份的
peer 回答「你能做什么」，和早已声明 `anyone` 的 `identityController` 同理 → `anyone`。
现在 46 个命名空间全部声明了所需身份。

### 本轮的新门禁适配（上游 0.2.1 新增，fork 侧首次面对）

| 上游新门禁 | fork 侧要做什么 |
|---|---|
| `verify-product-use`（每个非实验包都要有产品运行时挂载，或显式分类） | 15 条 `PRODUCT_PACKAGE_POLICY`：整个 tenant 缝 9 条（台账「租户能力缝」一行写着**不挂载即单租户**，正对应 `optional`）、`microsoft-entra`／`desktop-link`／`fs-desktop`／`ui-brand-official` 各 1 条、`e2e-target` 归 `test`。另外删掉上游对 `agent-tool-presentation` 的 `optional` 声明——fork 的 `work`／`build` preset 真的挂了它。该门禁的字面量读取器不认布尔，给它补了 `TrueKeyword`／`FalseKeyword` 分支（fork 的 `ProfileTemplate` 有 `hosted` 字段） |
| `verify-locale-metadata`（每个声明 Cordis 插件的包都要有 `locale/*.json`，八种出厂语言齐备） | 44 个 fork 包补全 8 种、12 个 module bundle 补 6 种，共 **424 个文件**。约定：插件包 `en.json` 只带目录名作标题，说明从 `zh.json` 出并译成其余 6 种；bundle 的 `en` 自带标题与说明 |
| 出厂语言从 2 种增到 8 种（`SHIPPED_LOCALE_IDS` 加了 ja/es/fr/de/ru/pt） | 8 个 fork 客户端包的 `locales.ts` 各补 6 份词典并改注册；插件开发手册 `guide-locales.ts` 也补齐 6 份，并让 `locales.ts` 按语言取对应那一份（原先 6 种统一铺 `guideEn`） |
| `verify-brand-placeholders`（fork 自有，但合并带进大量新文案） | 388 处字面品牌名改为占位符（`LYN`→`{brandAbbr}`、`lyness`→`{brandName}`、`领驭`→`{brandNameZh}`），用门禁自己的 AST 判据改写以免误伤包名。署名行 `poweredBy` 刻意保留字面名，7 种语言全部登记进 `DELIBERATE` |

另有两处与门禁无关、但属同类的修复：`ui-shortcuts` 的 6 个语言把 `{brandName}` 译成了
「harness」这个普通名词（el arnés／le harnais／chicote），改回占位符；`ui-plugin-manager` 的
`reasonIncompatibleVersion` 在 6 个语言里仍用上游改名前的 `{requirements}`，统一为 `{peers}`
并补回上游新增的末句。

### 上游把笔记移进 archive 时，改名的旧账会变成「被改动的冻结件」

codemod 的 `PROTECTED` 已经冻结 `.agents/notes/archived/`，但那只保护**当时已在**归档里的文件。
上游若把一条笔记从 `implemented/` 移进 `archived/`，而本 fork 早先在它还可改时已经改过名，
移动之后它就成了一件「内容与封印不符」的冻结件，`verify-archived-agent-notes` 报
`sealed content hash changed`，而 `--write` 只增不改、修不了它。

本轮两条：`architecture/2026-06-21-mandatory-app-attribution-headers` 与
`feature/2026-09-23-language-neutral-default-workspace-naming`。处理办法是**还原成上游原文**
（`git show <upstream>:<path> > <path>`），因为归档笔记记的是写下时为真的事，不随改名走。

顺带看清了一处改名的语义误伤：那条笔记写的是 `User-Agent` 里的**线上标识** `deepseek-harness`，
codemod 把它当产品名改成了 `DeepSeek Harness`——标识与产品名是两回事，改了意思就变了。
归档树以外若还有同类线上标识，属于「请求扩展字段名 ⛔」那一类，应进屏蔽规则而不是改名。

### 我自己引入的缺陷：`const` 不提升（记下来免得重犯）

把 `LISTING_BUFFER_BYTES` 追加在文件末尾——`const` 不提升，`main()` 在它之前调用，
于是 `rescope-vendor` 报 `ReferenceError: Cannot access 'LISTING_BUFFER_BYTES' before initialization`。
五个脚本同一个写法，全部移到 import 之后。

### 遗留债：`test:snapshot` 的 headless 组合（本轮确认，非本轮引入）

`pnpm run test:snapshot` 现在 3 个文件失败（194 条）。`lyn --profile headless` 启动时
报 `15 entries did not activate`——`workingDirectory` 与工具执行器没挂上，于是
`The selected tool executor is unavailable`。**已用 `git stash` 在 HEAD（efbdcefa4b）上复现**，
与个人平面五步的改动无关，是 0.2.1 合并留下的组合债。修它要补 headless profile 的
`working-directory` 与执行器行，属于单独一次变更。

### 我自己引入的缺陷：页面不挂自己的 Remote 命名空间（记下来免得重犯）

客户端页面注入 `remote.<ns>` 却没有人挂那个命名空间，插件会永远 park 在缺失服务上，
页面根本不出现。`packages/api/remotes` 的客户端装配只挂一份手写的核心清单，新增
`packages/api/*-controller` 不会进去——拥有命名空间的那个页面要自己
`await ctx.remote.$mount(contribution)`（`@lyness/lyn-api-*-controller/remote` 的默认导出）。
个人平面第 2、3、4 步的三张页面都是这样写错的，到第 5 步才发现；现在四张页面各有一条
`expect(remote.mounted).toHaveLength(1)` 把它钉住（`TestRemote.mounted` 为此新增）。

### 2026-09-10 合并方法（2151 个提交的处理方式）

逐行合并不可行：官方动了 8274 个文件（含 806 处改名），我们动了 6015 个，
两边改名叠加会产生成千上万处冲突和重复目录。

改用**「上游树 + 重打补丁 + 重跑 codemod」**：

1. 先量化真实语义差异——把 merge-base 的树跑一遍 `rebrand --apply`，
   再与 `custom/main` 对比。差异只有 27 个文件，其中 20 个还是可再生成的（docs、lockfile、snapshot）。
   **不可再生成的只有 5 个**：`.gitignore`、`package.json`、`cordis.patch.yml`、
   `scripts/package-graph.ts`、`scripts/verify-lyn-package-licenses.ts`。
2. `git merge -s ours --no-commit` 建立正确的祖先关系（保证下次合并的 merge-base 正确）。
3. `git read-tree -u --reset upstream/master` 把树整体换成上游。
4. 恢复 fork 独有文件，重打那 5 个补丁。
5. `pnpm run rebrand -- --apply` 重新生成全部改名。

这条路成立的前提是 `scripts/rebrand.ts` 可重放且幂等——**它是这个二开能长期跟上游的根本原因**。
反向回退（`--reverse`）不能用于合并：规则不是双射（`@deepseek-ai/dsh-`、`@deepseek-ai/`、
`@deepseek-ai` 三个源都映射到 `@lyness`），转义类规则反向还会把 `(?:-|$)` 当字面量插回源码。

备份分支：`backup/before-merge-20260910-170839`。

## 分支清理与 dependabot 分支的裁定（2026-10-30）

清理前除主线外有 3 个本地分支、9 个 `origin` 上的 dependabot 分支，**没有任何未关闭的 PR**。

| 分支 | 处理 | 依据 |
|---|---|---|
| `backup/before-merge-20261028-100501`（`bdf2151c6b`） | 删除 | 已是 `custom/main` 的祖先，`git rev-list --count custom/main..` 为 0，没有可合并的内容 |
| `backup/before-merge-20261028-113038`（`20667301d3`） | 删除 | 同上 |
| `wip/merge-attempt-1`（`4986803846`） | `-s ours` 并入主线后删除 | 它的两个提交此前只靠分支指针存活；但内容是把改名整树还原成官方拼写的那次失败尝试，树不能取。`-s ours` 让提交永久可达、祖先关系记下它被否决，而树与 `921c77e014` 逐字节相同 |

dependabot 每天 04:00（Asia/Shanghai）在 fork 上跑 npm／uv／github-actions 三个生态，
所以**删掉分支不会丢信号**——依赖仍然落后时次日会重新建出来。九个分支逐个核过：

| dependabot 分支 | 裁定 | 依据 |
|---|---|---|
| `npm_and_yarn/acorn-8.18.0`（`15cbb1066c`） | 废弃 | 主线已是 `^8.18.0`，0.2.1 合并带入 |
| `npm_and_yarn/lightningcss-1.33.0`（`1152358c8c`） | 废弃 | 主线已是 `^1.33.0` |
| `npm_and_yarn/noble/hashes-2.4.0`（`3b9b6135aa`） | 废弃 | 主线已是 `^2.4.0` |
| `npm_and_yarn/vitest/spy-4.1.11`（`b7a4cdc8bf`） | 废弃 | 主线已是 `^4.1.11` |
| `uv/python/sdk/pydantic-2.13.5`（`e10e07d405`） | 废弃，且并进来有害 | 主线 `uv.lock` 已是 2.13.5；三方合并的净效果只剩**删掉** `exceptiongroup` 对 `typing-extensions` 的 `python_full_version < '3.13'` 标记 |
| `npm_and_yarn/koffi-3.1.6`（`c90e18642e`） | 暂不取，跟随上游 | 上游在 8 个包里把 koffi **精确钉在 `3.1.1`**；且该分支的 `pnpm-lock.yaml` 基点是 09-25（0.2.1 之前），并进来会把锁文件整体拖回旧版 |
| `uv/python/sdk/hatchling-1.32.4`（`eec3265172`） | 暂不取，跟随上游 | 上游 `python/sdk` 与 `python/sdk-runtime` **两处**都钉 `hatchling==1.32.0`，dependabot 只改了一处，取了就是不对称 |
| `github_actions/actions/cache-6`（`e9fac525f2`） | 暂不取，跟随上游 | 上游自己是 `@v4`×1 + `@v6`×2 的混用；主线剩下的 `@v4` 全在 fork 自己的 `build-exe-for-ssh-helper`／`fork-ci`／`publish-ssh-helper` 三个工作流里 |
| `github_actions/pnpm/action-setup-6`（`fe82e587c7`） | 暂不取，跟随上游 | 上游是 `@v4`×2 + `@v5`×36，没有往 v6 走 |

后四条是**与上游取向冲突的待办**，不是遗漏：上游没有动，fork 单方面跟 dependabot 走，
下次同步时每条各制造一处冲突。要推进就单独一次变更，并且 koffi 那条必须先手插锁文件块
（`koffi@3.1.6` 的 integrity 为
`sha512-ln60chEb3o7Du1ayjwl6BFiNN1wZK+3cTM2wWGiHLEzCY/FdTIN1ER5VWDwHq7J/j4tSnnrHaH5ABS1EO6+6ag==`）
再跑 `pnpm install --frozen-lockfile`，不能跑裸 `pnpm install`。
