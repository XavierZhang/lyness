---
description: "执行模块 bundle，面向要决定「这个 agent 在哪台机器上工作」的部署方。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-execution

[English](README.md) | 中文

## 概述

`dsh-module-execution` 是触及一台机器的那一面：被沙箱约束的文件系统提供者、子进程与沙箱提供者、shell 与文件工具，以及代码与工作流运行时。凡是在自己所运行的那台机器上工作的随包 profile 都选上它；它为部署方回答一个问题——这个 agent 在哪台机器上工作——而不是十几个分散的问题。一个不选它的 profile 没有 `ctx.fs`、`ctx.shell`、`ctx.subprocess`、`ctx.sandbox` 与 `ctx.ptcRuntime`，于是注入它们的那些工具永不激活。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

它是一个 bundle，不是插件：profile 在 `dsh.profile.bundles` 里选上它，位置排在 `@deepseek-ai/dsh-base` 之后。

```json
{ "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", "@deepseek-ai/dsh-module-execution"] } } }
```

`web`、`enterprise`、`headless`、`acp` 与 `sdk` 五个模板都选它。`sdk-minimal` 不选：它是一个自带执行行的独立 bundle。

| 行 | 提供 |
|---|---|
| `subprocess` · `sandbox` · `sandbox-policy` | `ctx.subprocess`、`ctx.sandbox`、`ctx.sandboxPolicy` |
| `bash-sandbox` · `pwsh-sandbox` · `shell-env` | 在有它的那个平台上提供 `ctx.shell`，以及它的环境 |
| `fs-sandbox` · `fs-observation-policy` | `ctx.fs`，由沙箱策略约束 |
| `tool-bash` · `tool-pwsh` · `tool-fs` · `tool-fs-search` | 模型用来读取与改动一台机器的那些工具 |
| `ptc-runtime` · `workflow-ptc` · `tool-workflow` · `tool-ralph` | `ctx.ptcRuntime` 以及建立其上的工作流引擎 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它离开 `dsh-base`，是为了让一个运行时可以什么都不执行。** 一个用一个进程服务好几家客户的托管部署，客户之间没有边界：积分、角色与模型策略约束的是模型请求、别的什么都不约束，而一个被约束的命令仍然跑在 host 上、以 host 的用户、带 host 的网络。在一个组织拿到一个进程之前，唯一成立的边界就是这些行的缺席——而缺席是「不能执行」唯一一种后续补丁层开不回来的形式。

**是缺席，不是禁用。** 一个被禁用的行是一个会被覆盖层重新启用的行；一个没被选上的 bundle 根本不在这份组合里。这个差别正是把它做成 bundle、而不是在 `dsh-base` 里写一段 `disabled: true` 的全部理由。

**`approval` 与 `permission-presets` 留在原处。** 它们是每个工具都读的审批词汇，不是执行行。一个不选本 bundle 的 profile 仍然有它们，而它的权限预设仍然点名那些沙箱模式——只是没有东西去施加，因为沙箱不在。

**行的顺序不要紧。** `fs-sandbox` 注入 `sandboxPolicy`，`ptc-runtime` 注入四个服务；Cordis 在被注入的服务出现时才激活一个插件，所以把这些行追加在 base 层之后，与原先挂在它里面解析得完全一样。

-----

<a id="further-exploration"></a>
## 进一步探索

- [离开单操作者 Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.zh.md) —— 为什么「一份什么都不执行的组合」必须是可能的。
- [agent 隔离与团队](../../../.agents/notes/proposed/architecture/2026-10-08-agent-isolation-and-teams.zh.md) —— 这个 bundle 的缺席所代替的那条边界。
- [`dsh-base`](../base/README.zh.md) —— 它离开的那一层。

-----

<a id="model-experience"></a>
## 模型体验

Indirectly, through the rows it inserts：`dsh-tool-bash`、`dsh-tool-pwsh`、`dsh-tool-fs`、`dsh-tool-fs-search`、`dsh-tool-workflow` 与 `dsh-tool-ralph` 各自拥有它们的 schema 与结果，本 bundle 只决定一个 profile 是否携带它们。组装出来的 schema 文本按工具名排序，所以把这些行移出 `dsh-base`，对一个仍然选上它的 profile 来说没有改变任何模型可见文本。

#### KV Cache effect

对选上它的 profile 没有影响：同样的工具以同样的顺序进入同一份组装。不选它的 profile 工具段更短，而这个前缀变化发生在组合的那一刻，不是每次请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **不选它时权限预设悬空** —— 一个不选本 bundle 的 profile 仍然提供 `read-only`、`workspace-write` 与 `danger-full-access`，而它们什么也不做，因为它们点名的那个沙箱不在。
- **它是整取整舍的** —— 一个想要文件、不想要 shell 的部署自己挑那些行，而不是选本 bundle；本 bundle 为它所回答的那一个问题而存在，不是一份菜单。
- **还没有远端提供者** —— 这里的提供者都是本机的。到达一台不是运行 Host 的那台机器，今天是 `fs-ssh` 与 `subprocess-ssh`，将来是桌面执行器。

**Runtime invariant:** 不发布任何 companion。一个 bundle 是一份补丁文档；它不持有状态，也不拥有任何可能被两个观察者读出分歧的关系。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

每一个在这次抽取之前选用 `dsh-base` 的 profile 模板，其抽取前的 bundle 元组都记录在 `INSTALLATION_OWNED_PROFILE_TUPLES` 里，于是一个已安装的 profile 会被改写到当前列表，而不是无声地丢掉它的工具。

</details>
