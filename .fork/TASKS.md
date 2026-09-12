# lyness 二开任务清单

需求源：[`lyness-requirements.md`](../lyness-requirements.md)（根目录，二开新增）
台账：[`CUSTOM.md`](../CUSTOM.md) — 每完成一项定制点在此登记
冲突裁决规则：**技术路线与官方冲突时以官方为准**，但每处冲突必须在本文件留痕并提醒。

状态：`todo` / `doing` / `done` / `blocked`

---

## 需求文档与仓库实际的 10 处冲突（9 已裁决，1 待决策）

| # | 文档假设 | 仓库实际 | 裁决 |
|---|---|---|---|
| 1 | 事件 `step/finish`、`step/error` | 实际为 `step/end`；`step/error` 不存在。`step/end` 载荷仅 `{turn, step}`，无错误字段。错误表达为 `tool/result.isError` | 采官方事件名；错误从 `tool/result.isError` + `llm/retry` 推导 |
| 2 | REST `/api/v1/tenant/config` | `packages/api/gateway` 为两端 Typert RPC（Host `ctx.typertGateway` / Client `ctx.remote`） | 采官方：租户配置走 Typert RPC |
| 3 | 「Monaco/Turborepo」 | 无 `turbo.json`，为 pnpm workspaces（`pnpm@11.7.0`） | 采官方：pnpm workspaces |
| 4 | `packages/plugin-multi-tenancy` | 布局为 `packages/<组>/<包>/`，无 `packages/plugin-*` 形态 | 采官方布局与命名 |
| 5 | 自定义 Agent Team 拓扑 + Message Bus | 官方已有 `packages/workflow`（含 worker-thread provider）与 `packages/subagent`（11 包） | 采官方：在 workflow/subagent seam 上做拓扑层 |
| 6 | 自行落盘 Step 日志汇总指标 | 官方已有 `packages/session/session-stats` projection（turn/step 计数、LLM/tool/首 token/解码耗时，从完整持久日志折叠） | 采官方：复用 `sessionStats`，仅补充其未覆盖的维度 |
| 8 | 多租户可配 Logo／域名等品牌标识 | 与私有化／SaaS 两层划分冲突：SaaS 下租户不改品牌资产（[理由](BRAND-CONFIG.md)） | **采两层划分**，SaaS 的 OEM 收窄为文案与身份 |
| 9 | 用户登录时不默认 DeepSeek，供应商由用户选 | 上游 0.1.5 的 `bc5fd3b8dc` 把 Chat Completions **默认路由**设为 DeepSeek V41 Flash（`441385fe38` 保留 V4 系列，`0729dbec66` 恢复 Vision Exp 目录项） | 采官方默认路由（那是模型能力选择，不是登录流程）；**登录时的供应商选择仍按需求文档做**，在 1.3 的供应商白名单上实现。两者不在同一层，可共存 |
| 10 | （无对应假设；改名决策的后果） | 上游用包名中的 `dsh-` 段区分 harness 包与 vendored 包，本 fork 的 `@lyness/<name>` 去掉了该段 | **待你决策**，见任务 0.13。当前按选项 A 逐个门禁打补丁 |
| 7 | Vue 3 + Element Plus 管理后台 | 仓库前端为 React 18（284 `.tsx` / 0 `.vue`） | **例外：采需求文档**。官方无管理后台，不存在官方路线；Vue 3 写在验收标准中。代价：admin-portal 不复用 `packages/client/*`，自建 RPC 封装与 i18n |

### 需求文档未提、但仓库规则强制的约束

- **Model-visible ⟺ logged**：进入模型请求的输入必须能从 session log 重建，并有对应 `SessionEventMap` 事件（成员 required-on-read）。租户配置若影响模型行为（租户级 persona、工具授权），`tenant_id` 必须进 session log —— 须在 Phase 1 设计对，事后补代价极大。
- **能力缝三角**：Service Definition / Service Provider / Consumer 三角完整，不可只实现其一。
- **注册即 effect**：所有贡献走 `ctx.effect()` / `ctx.on()`。
- **非平凡改动须附 Agent Note**（`.agents/notes/`）。
- **每包 100% 覆盖率**（`pnpm run test:coverage` 是 CI 门禁）。

---

## Phase 0 — 品牌全量替换

先于功能开发，避免新代码带上旧名。做法照搬官方 `scripts/rescope-vendor.ts` 范式：脚本化改名 + `--check` gate + 每次 sync upstream 后重跑。

| # | 任务 | 状态 |
|---|---|---|
| 0.1 | `scripts/rebrand.ts`：21 条有序规则 + 保护路径 + 后置断言 + `--apply/--check/--reverse/--only` | done |
| 0.2 | ⛔ 保护名单：DeepSeek 作为**模型供应商**的一切（`packages/llm/llm-deepseek`、`DeepSeekOnboardingDialog.tsx`、`ui-settings-models`、`api.deepseek.com`）不得改名 | done |
| 0.3 | npm scope `@deepseek-ai/dsh-<name>` → `@lyness/<name>`（241 个待发布包） | done |
| 0.4 | CLI `dsh` → `lyn`；`~/.dsh` → `~/.lyn`；`DSH_*` → `LYNESS_*` | done |
| 0.5 | ⚠️ 系统提示词身份 `packages/core/system-prompt/src/index.ts:412` —— 模型可见，须同步更新 snapshot | done |
| 0.6 | Web UI 品牌：新增 `ui-brand-lyness` 填 `sidebar.brand.mark` / `sidebar.brand.name` / `conversation.hero.brand.mark`，零官方文件改动。模板为 `packages/client/ui-brand-official`；插槽消费方在 0.1.5 已迁到新包 `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` | todo |
| 0.7 | Logo：`apps/web/public/favicon.svg`（产品本体）、`website/public/{wordmark,favicon}.svg` | todo |
| 0.8 | 仓库 URL → `https://github.com/XavierZhang/lyness`（仅 URL 类；`.agents/notes/` 官方历史笔记不动） | done |
| 0.9 | 遥测：默认改为 `DISABLED` 且不带端点；启用需同时设 `LYNESS_TELEMETRY_MODE` 与 `LYNESS_TELEMETRY_OTLP_URL` | done |
| 0.10 | 验证：`typecheck` + `build` + `test` + `test:snapshot` + `hygiene` | done |
| 0.11 | Python 包名残留 `deepseek_harness` → 新增下划线规则 + 目录改名 + `pyproject.toml` 与 CI 工作流同步（[残留表](../CUSTOM.md#已知残留codemod-未覆盖非本次合并引入)） | todo |
| 0.12 | 遥测守卫测试 | done（长在上游自己的 `packages/bundle/base/tests/base.spec.ts` 里：上游 0.1.5 新增该测试钉住自家默认值，改为钉住本 fork 的 `DISABLED` + 空端点。上游将来改默认值会在此直接冲突） |
| 0.13 | **⚠️ 待你决策**：`@lyness/<name>` 丢掉了 scope 判别符，已累计 6 处门禁手工改写且每次合并可能新增（[分析与两个选项](../CUSTOM.md)） | 待决策 |

## Phase 1 — 多租户与品牌配置（需求 Step 1）

| # | 任务 | 状态 |
|---|---|---|
| 1.0 | 部署层品牌配置：配置文件格式 + 读取插件 + `renderIndex` 注入（[划分](BRAND-CONFIG.md)） | todo |
| 1.1 | 租户能力缝：Service Definition + Provider + Consumer 三角 | todo |
| 1.2 | 租户解析：Domain / Subdomain / `X-Tenant-ID` header | todo |
| 1.3 | `TenantConfig`：供应商白名单、功能授权、Agent 身份、文案覆盖（**不含资产与产品名**，那些在部署层） | todo |
| 1.4 | 租户配置 Typert RPC（替代文档的 REST 方案，冲突 #2） | todo |
| 1.5 | ⚠️ `tenant_id` 进 session log：新增 `SessionEventMap` 成员 | todo |
| 1.6 | 数据隔离：租户层配置入库；backend 走 `storage` 缝（既有 sqlite 实现，或新增 MySQL provider） | todo |

## Phase 2 — 可观测性与预警（需求 Step 2）

| # | 任务 | 状态 |
|---|---|---|
| 2.1 | 订阅 `step/start` / `step/end`（冲突 #1 已裁决的真实事件名） | todo |
| 2.2 | 错误检测：`tool/result.isError` + `llm/retry` + 超时 | todo |
| 2.3 | 指标聚合：复用 `sessionStats`，仅补租户维度与错误率（冲突 #6） | todo |
| 2.4 | 预警管道：钉钉 / 企业微信 / 通用 Webhook，按租户配置路由 | todo |

## Phase 3 — Agent Team 编排（需求 Step 3）

| # | 任务 | 状态 |
|---|---|---|
| 3.1 | `AgentTeam` 拓扑 Schema（Nodes + Directed Edges） | todo |
| 3.2 | 执行层建在 `workflowEngine` + subagent 之上（冲突 #5） | todo |
| 3.3 | 节点间 I/O Mapping | todo |

## Phase 4 — Vue 3 管理后台（需求 Step 4）

| # | 任务 | 状态 |
|---|---|---|
| 4.1 | `apps/admin-portal`：Vite + Vue 3 + TS + Element Plus + pinia + vue-router | todo |
| 4.2 | Typert `InvocationDescriptor` → Vue 可用的类型化 RPC 客户端 | todo |
| 4.3 | RBAC 动态路由（基于 pinia 权限过滤菜单） | todo |
| 4.4 | 数据看板：调用趋势、Token 消耗、错误率 | todo |
| 4.5 | 租户/OEM 设置：Logo、名称、主题色实时预览（CSS Variables 动态注入） | todo |
| 4.6 | Agent & 团队管理：授权 + 拓扑可视化搭建 | todo |
| 4.7 | 日志与预警：Trace 查询、错误栈、预警规则配置 | todo |
| 4.8 | 品牌资产上传与校验（见下节）。上游 0.1.5 新增的 `@lyness/client-file-upload` 是**会话级**上传（受票据换取后续 prompt），不适用于租户级资产存储，只能借鉴其流式与取消设计 | todo |

### 4.8 品牌资产（已随部署／租户两层划分收缩）

划分见 [BRAND-CONFIG.md](BRAND-CONFIG.md)。二进制资产上移到**部署层**：由部署脚本以文件形式投放，运营方改，租户不改。

这消掉了原设计的大部分：SaaS 不需要上传接口，私有化的资产写入者是运营方本人（与写 nginx 配置同级）。原本必须解决的租户上传 SVG 跨租户执行脚本的问题，随之不存在。

管理后台在此项上只剩**只读展示**：显示当前部署的品牌资产与产品名，供租户管理员确认自己所在部署的身份，不提供编辑。

资产规格（部署文档需要，取自代码实测）：

| 资产 | 画布依据 | 宽高比 |
|---|---|---|
| 图标 | `FishLogo` `viewBox="0 0 23.16 17.04"`，首屏 `size=34` | 约 1.36:1 |
| 字标 | `BrandWordmark` `viewBox="26 0 156 24"` | 约 6.5:1 |
| favicon | `apps/web/public/favicon.svg` `viewBox="0 0 50 50"` | 1:1 |

投递机制：webserver 的 `renderIndex` 支持结构化注入行写入 `<head>`，因此 favicon 链接、标题与主题色变量在服务端注入，**改配置不需重新构建前端**。产品内 Logo 走官方三个插槽，零官方文件改动。

## 验收标准（源自需求文档）

- [ ] 原生核心 Trace 格式与 Loop 算法 100% 兼容
- [ ] 不同租户域名 → 返回对应 Logo、名称与 UI 配置
- [ ] 管理后台基于 Vue 3 + TS + Element Plus，组件全用 `<script setup lang="ts">`
- [ ] 数据看板准确反映 observability 记录的指标与 Trace
