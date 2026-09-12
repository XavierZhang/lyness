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
| `scripts/verify-public-repository-links.spec.ts` | 失效仓库名改为片段拼接 | 整串字面量被 `slug` 规则改写，门禁会去查一个从未被链接过的仓库 | 2026-09-12 |
| `scripts/lint-rule-fingerprint.spec.ts` | 三条 sha256 指纹 | `.oxlintrc.json` 有一句规则提示文案含包名，被改名后哈希变化；规则数 89/88/84 与上游一致，可证规则集未变 | 2026-09-12 |
| `packages/bundle/base/tests/base.spec.ts` | 遥测默认值断言改为 `DISABLED` + 空端点 | 上游 0.1.5 新增此测试钉住自己的默认值；改为钉住本 fork 的，它就成了遥测守卫 | 2026-09-12 |
| `packages/bundle/base/cordis.patch.yml` | 遥测默认 `DISABLED`、去掉厂商端点 | 上游默认把完整会话记录发往自家 collector；服务他人用户的部署不能默认转发 | 2026-09-01 |

## 跑完 `rebrand --apply` 之后的收尾清单

codemod 只改文本和路径。下面这些是它改完之后必然过期、必须重跑或手工修的东西，
按顺序做（2026-09-12 实测得出，`--check` 通过**不代表**这些已经做完）：

| # | 动作 | 为什么 |
|---|---|---|
| 1 | `pnpm install` | 包名变了，lockfile 要重算 |
| 2 | `pnpm run clean`；再删 `git mv` 留下的空目录 | 空目录不含文件，但按目录枚举的门禁（如 snapshot corpus）会把它当成缺文件 |
| 3 | `gen-third-party-notices`、`gen-cordis-catalog`、`gen-config-catalog`、`gen-tsconfig-paths`、`gen-doc-graphs` | 生成物里含包名 |
| 4 | `verify-translation-pairing --write --all` | 配对记录存的是两侧内容哈希；改名同时改了两侧，哈希全部过期（本次 648 条） |
| 5 | **手工**对齐生成文档的中文侧顺序 | 生成器只写英文侧。改名后包名字典序变了，中文侧会保留旧顺序（本次：`config-catalog.zh.md` 两节、`capability-seams.zh.md` 两条图边） |
| 6 | **手工**重排按名字排序的期望文件 | 同上。本次：`tool-schemas.expected.json` 的工具顺序、`web-browser-open.expected.e2e.ts` 的内联快照键序、desktop 的三个夹具 |
| 7 | 重算 `scripts/lint-rule-fingerprint.spec.ts` 的三条 sha256 | `.oxlintrc.json` 有一句规则提示含包名 |

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
| 可重放的品牌改名 | `scripts/rebrand.ts` | 21 条有序规则 + 保护路径 + 后置断言 + `--check`。**每次 sync upstream 后必须重跑**，否则上游带回的旧名会残留。设计见 [Agent Note](.agents/notes/implemented/process/2026-08-31-lyness-rebrand-codemod.md) |
| 二开任务清单 | `.fork/TASKS.md` | 需求拆解、7 处冲突裁决与分阶段计划 |
| 二开手册 | `.fork/FORK-GUIDE.md` | 原在 `docs/` 下，因受上游双语门禁管辖而迁出 |

## 我故意删除或禁用的内容 ⚠️ 合并官方后必查

| 路径/配置 | 原因 | 上次确认仍被移除的日期 |
|---|---|---|
| `session-telemetry-otel` 的默认外发（`mode` + `exporter.url`） | 服务他人用户的部署不能默认把会话记录转发给厂商 | 2026-09-10 |

> 这张表靠人复查，人会忘。**待办**：为遥测项补一条行为测试（断言默认组合下不产生外发请求），
> 把「每次合并后人工复查」变成 CI 自动拦截。测试检查行为而非文件路径，上游换实现也拦得住。

## 已知残留（codemod 未覆盖，非本次合并引入）

| 残留 | 位置 | 影响 | 处理 |
|---|---|---|---|
| Python 包名 `deepseek_harness` | `python/sdk/src/deepseek_harness/`、`python/sdk-runtime/src/deepseek_harness_runtime/`、`pyproject.toml` | 对外发布 Python SDK 时会暴露官方名 | 下划线变体不在 21 条规则内。需新增规则 + 目录改名 + `pyproject.toml`/CI 工作流同步，独立任务 |
| 归档 Agent Note 中的 `dsh`（104 处） | `.agents/notes/archived/` | 无 | **刻意保留**：归档笔记冻结，是官方历史记录 |

## 品牌替换清单 ⚠️ 合并官方后必查

对外产品名：英文 **lyness**，中文 **领驭**。官方中文文档没有中文产品名，直接沿用英文 "DeepSeek Harness"，所以「领驭」是二开新增的，无官方对应值。

下表「我的值」为 `未决` 的行是尚未拍板的品牌面，不是遗漏。官方值一栏的出现次数为 2026-08-31 实测。

| 项 | 官方值 | 我的值 | 所在文件 |
|---|---|---|---|
| 产品名（英文） | `DeepSeek Harness`（360 处） | `lyness` | 未决 |
| 产品名（中文） | 无 | `领驭` | 未决 |
| 仓库/标识 slug | `deepseek-harness` | `lyness` | 已完成；归档笔记冻结不动 |
| CLI 命令名 | `dsh` | `lyn` | `apps/cli/package.json` bin |
| npm scope | `@deepseek-ai/dsh-<name>` | `@lyness/lyn-<name>`（harness）／`@lyness/<name>`（vendored） | 已完成。产品段**保留**——上游靠它区分两类包，去掉后 6 处门禁失效且其中一处静默失效（[记录](.agents/notes/implemented/process/2026-09-12-restoring-the-product-name-segment.md)） |
| 用户数据目录 | `~/.dsh` / `$DSH_HOME` | `~/.lyn` / `$LYNESS_HOME` | `packages/util/home-paths`；目录名与环境变量前缀刻意不成对，用户 2026-08-31 定 |
| 系统提示词身份 ⚠️ | `You are an AI agent powered by DeepSeek Harness.` | `...powered by lyness.`（已完成） | `packages/core/system-prompt/src/index.ts:412`（模型可见，改动需更新 snapshot） |
| Web UI 品牌插槽 | `@deepseek-ai/dsh-client-ui-brand-official` | 新增 `ui-brand-lyness` | 插槽化，零官方文件改动 |
| 文档站 | `https://deepseek-harness.github.io` | 保留，是否公开后续定 | `website/` + `.github/workflows/docs-pages.yml` |
| Logo | `website/public/{wordmark,favicon}.svg`、`apps/web/public/favicon.svg` | **未做** | 图形资产需人工设计；仅 `apps/web/public/favicon.svg` 是产品本体 |
| API 端点 ⛔ | `https://api.deepseek.com` | 不改 | 供应商地址，非品牌 |
| 模型供应商 DeepSeek ⛔ | `packages/llm/llm-deepseek`、`DeepSeekOnboardingDialog.tsx`、`ui-settings-models` | 不改 | 指模型供应商，不是 harness 品牌；全局替换会误伤 |
| 遥测端点 ⚠️ | `https://harness-telemetry.deepseeksvc.com` | **已移除** | 默认 `DISABLED` 且无端点；启用需显式设两个环境变量。上游 0.1.5 的 `9ffe85a512` 把遥测**扩到了所有用户**（原先按 provider 区分），本二开的覆盖因此更重要，每次合并必查 |

## 合并官方记录

| 日期 | 官方 commit | 冲突文件数 | 验证结果 | 备注 |
|---|---|---|---|---|
| 2026-08-29 | 初始化克隆 | - | - | fork-init 建立基线 |
| 2026-09-10 | `aa8262ec09`（0.1.2-alpha.1 → 0.1.5-rc.1，2151 个提交） | 0 | typecheck ✅ build ✅ install ✅ | 未走逐行合并：品牌替换是**再生成**的，不是可合并的。做法见下节 |

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
