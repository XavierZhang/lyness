# Role & Task Definition
你是一名精通 TypeScript、Node.js 架构、Cordis 元框架以及 Vue 3 生态的资深全栈架构师。
你的任务是在**绝对不破坏 DeepSeek Harness (`dsh`) 核心 Harness 调度架构与原生能力**的前提下，将其二次开发（Enterprise Refactoring）升级为包含多租户 OEM 贴牌、可视化管理后台、Agent Team 编排、全链路可观测性与动态 UI 的 **B2B SaaS Agent PaaS 平台**。

---

# Non-Negotiable Architecture Constraints (架构红线)

1. **零侵入核心 Loop (Zero-Touch Core Loop)**：禁止修改 `dsh` 原生的单 Agent Loop 执行引擎、推理/CoT 调度逻辑及上下文拼接算法。
2. **完整保留轨迹引擎 (Preserve Trajectory Engine)**：保持 Append-only 事件流机制，所有系统日志与预警必须通过订阅 `dsh` 原生的 Trajectory Event 扩展，禁止改写底层事件格式。
3. **严格遵从 Cordis 插件模式 (Strict Plugin Architecture)**：所有后端新功能（多租户、鉴权、团队编排、日志审计、预警）必须通过独立的 Cordis 插件或网关服务实现。

---

# Core Refactoring Goals & Scenarios

1. **多租户与 OEM 贴牌定制 (Multi-Tenancy & Branding Customization)**：
   - 数据与资源按 `tenant_id` 严格隔离。
   - 支持多租户独立配置品牌标识（Logo、平台名称、域名、主题色、UI 布局样式）。
2. **Vue 3 企业级管理后台 (Enterprise Admin Portal)**：
   - 技术栈：`Vite + Vue 3 (<script setup lang="ts">) + TypeScript + Element Plus + vue-router + pinia + axios`。
   - 功能覆盖：租户管理、RBAC 权限管理、Agent/Skill/MCP 授权发布、Agent Team 拓扑可视化、数据看板（调用量、Token 消耗、成功率、延迟等）及系统预警日志查询。
3. **企业级鉴权与 RBAC (Auth & Access Control)**：
   - 结合身份上下文进行 API 与 Tool 调用级的拦截；区分“开发态”与“运行态”。
4. **Agent Team 自由组合 (Multi-Agent Orchestration)**：
   - 支持将多个独立 Agent 组合为 Agent Team，定义节点间 I/O Mapping 与数据流转。
5. **系统级日志与异常预警 (Observability & Alerting)**：
   - 记录全平台每个 Agent/Step 的执行状态与 Trace；发生异常时触发 Hook 推进预警管道（钉钉/企业微信/Webhook）。

---

# Implementation Steps for Code Agent

### Step 1: 多租户与品牌配置扩展 (`packages/plugin-multi-tenancy`)
1. 创建 `multi-tenancy` 插件，在全局 API 请求处理链中通过 Domain / Subdomain 或 Header (`X-Tenant-ID`) 解析租户身份。
2. 设计 `TenantConfig` 存储结构（包含 `logoUrl`, `appName`, `themeColor`, `customCss`, `allowedFeatures`）。
3. 提供 `/api/v1/tenant/config` 接口，供前端（管理后台及 Agent 渲染端）动态获取品牌样式与授权模块。

### Step 2: 系统可观测性与预警插件 (`packages/plugin-observability`)
1. 创建 `observability` 插件，订阅 `dsh` 的原生 Trajectory 事件（如 `step/start`、`step/finish`、`step/error`）。
2. 将 Step 粒度的调用日志落盘，并汇总出聚合指标（为管理后台数据看板提供数据源）。
3. 捕获 `step/error` 或异常超时，触发预警管道推送到对应租户配置的 Webhook。

### Step 3: Agent Team 编排引擎 (`packages/plugin-orchestrator`)
1. 编写编排插件，定义 `AgentTeam` 拓扑配置 Schema（Nodes 与 Directed Edges）。
2. 保持各 Agent 独立 Harness 实例运行，通过 Message Bus 传递上游节点输出至下游节点输入。

### Step 4: Vue 3 企业管理后台项目搭建 (`apps/admin-portal`)
1. 在 Monaco/Turborepo 项目的 `apps/admin-portal` 下使用 Vite 初始化 Vue 3 + TS 项目。
2. 配置 Vue Router 动态路由（基于 Pinia 中的 RBAC 权限过滤菜单）。
3. 使用 Element Plus 开发以下核心页面：
   - **数据看板 (Dashboard)**：展示全平台/当前租户的 Agent 调用趋势、Token 消耗、错误率图表。
   - **租户/品牌设置 (Tenant & OEM Settings)**：支持实时预览和修改 Logo、系统名称、主题色（动态注入 CSS Variables）。
   - **Agent & 团队管理 (Agent & Team Management)**：支持给指定角色授权 Agent/Skill/MCP，以及 Agent Team 的可视拓扑搭建。
   - **日志与预警 (Logs & Alerts)**：查询每个 Agent 执行步骤的状态 Trace、错误 Stack 详情与预警规则配置。

---

# Verification Criteria

- [ ] 原生 `dsh` 核心 Trace 格式与 Loop 算法保持 100% 兼容。
- [ ] 请求不同租户域名时，`/api/v1/tenant/config` 能返回对应的 Logo、名称与 UI 配置。
- [ ] 管理后台能成功运行，且基于 Vue 3 + TS + Element Plus 实现，所有组件采用 `<script setup lang="ts">` 语法。
- [ ] 数据看板能准确反映 `observability` 插件记录的 Agent 调用指标与 Trace 日志。