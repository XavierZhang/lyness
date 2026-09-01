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
| 启动/冒烟 | `pnpm dsh --profile headless "your prompt"` |

官方开发文档：CONTRIBUTING.md README.md docs/development.md

## 我改过的官方文件

改动官方文件会在每次合并时产生冲突成本，所以这张表越短越好。
能用新增文件、配置、插件解决的，就别改官方文件。

| 文件/目录 | 改了什么 | 为什么必须改官方文件 | 日期 |
|---|---|---|---|
| 全仓库 6000 个文件 | 品牌改名 | 改名本质上无法用新增文件表达 | 2026-08-31 |
| `scripts/verify-lyn-package-licenses.ts` | 按 `vendor/` 路径排除而非按名字前缀 | 去掉 `dsh-` 段后，`@lyness/agent` 与 vendored 的 `@lyness/cordis` 名字上无法区分 | 2026-08-31 |
| `scripts/package-graph.ts` | 同上 | 同上 | 2026-08-31 |
| `packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx` | 显示名不再剥离已不存在的前缀 | 同上 | 2026-08-31 |
| `packages/bundle/base/cordis.patch.yml` | 遥测默认 `DISABLED`、去掉厂商端点 | 上游默认把完整会话记录发往自家 collector；服务他人用户的部署不能默认转发 | 2026-09-01 |

## 我新增的文件/能力

| 能力 | 位置 | 说明 |
|---|---|---|
| 可重放的品牌改名 | `scripts/rebrand.ts` | 21 条有序规则 + 保护路径 + 后置断言 + `--check`。**每次 sync upstream 后必须重跑**，否则上游带回的旧名会残留。设计见 [Agent Note](.agents/notes/implemented/process/2026-08-31-lyness-rebrand-codemod.md) |
| 二开任务清单 | `.fork/TASKS.md` | 需求拆解、7 处冲突裁决与分阶段计划 |
| 二开手册 | `.fork/FORK-GUIDE.md` | 原在 `docs/` 下，因受上游双语门禁管辖而迁出 |

## 我故意删除或禁用的内容 ⚠️ 合并官方后必查

| 路径/配置 | 原因 | 上次确认仍被移除的日期 |
|---|---|---|
| | | |

## 品牌替换清单 ⚠️ 合并官方后必查

对外产品名：英文 **lyness**，中文 **领驭**。官方中文文档没有中文产品名，直接沿用英文 "DeepSeek Harness"，所以「领驭」是二开新增的，无官方对应值。

下表「我的值」为 `未决` 的行是尚未拍板的品牌面，不是遗漏。官方值一栏的出现次数为 2026-08-31 实测。

| 项 | 官方值 | 我的值 | 所在文件 |
|---|---|---|---|
| 产品名（英文） | `DeepSeek Harness`（360 处） | `lyness` | 未决 |
| 产品名（中文） | 无 | `领驭` | 未决 |
| 仓库/标识 slug | `deepseek-harness` | `lyness` | 已完成；归档笔记冻结不动 |
| CLI 命令名 | `dsh` | `lyn` | `apps/cli/package.json` bin |
| npm scope | `@deepseek-ai/dsh-<name>` | `@lyness/<name>` | 已完成，241 个包 |
| 用户数据目录 | `~/.dsh` / `$DSH_HOME` | `~/.lyn` / `$LYNESS_HOME` | `packages/util/home-paths`；目录名与环境变量前缀刻意不成对，用户 2026-08-31 定 |
| 系统提示词身份 ⚠️ | `You are an AI agent powered by DeepSeek Harness.` | `...powered by lyness.`（已完成） | `packages/core/system-prompt/src/index.ts:412`（模型可见，改动需更新 snapshot） |
| Web UI 品牌插槽 | `@deepseek-ai/dsh-client-ui-brand-official` | 新增 `ui-brand-lyness` | 插槽化，零官方文件改动 |
| 文档站 | `https://deepseek-harness.github.io` | 保留，是否公开后续定 | `website/` + `.github/workflows/docs-pages.yml` |
| Logo | `website/public/{wordmark,favicon}.svg`、`apps/web/public/favicon.svg` | **未做** | 图形资产需人工设计；仅 `apps/web/public/favicon.svg` 是产品本体 |
| API 端点 ⛔ | `https://api.deepseek.com` | 不改 | 供应商地址，非品牌 |
| 模型供应商 DeepSeek ⛔ | `packages/llm/llm-deepseek`、`DeepSeekOnboardingDialog.tsx`、`ui-settings-models` | 不改 | 指模型供应商，不是 harness 品牌；全局替换会误伤 |
| 遥测端点 ⚠️ | `https://harness-telemetry.deepseeksvc.com` | **已移除** | 默认 `DISABLED` 且无端点；启用需显式设两个环境变量 |

## 合并官方记录

| 日期 | 官方 commit | 冲突文件数 | 验证结果 | 备注 |
|---|---|---|---|---|
| 2026-08-29 | 初始化克隆 | - | - | fork-init 建立基线 |
