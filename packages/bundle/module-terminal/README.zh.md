---
description: "持久终端模块独立成一个 bundle，向每个接受贡献的 preset 贡献一个按 agent 隔离的 shell 组。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-terminal

[English](README.md) | 中文

## 概述

本 bundle 就是持久终端这个默认模块：跨工具调用保持工作目录、环境变量与运行中子进程的交互式 shell。这项能力的每一行都是按 agent 的，所以与 [`dsh-module-memory`](../module-memory/README.zh.md) 不同，它不插入任何宿主行——它贡献一个隔离组，而这正是[preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md)接缝所承载的东西。它出厂就是开着的；此前两个视图默认各自内联声明了这个组，把它搬到这里，正是让平台能把它与产品分开版本化的原因。

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

`web` profile 模板选择了它，所以新建的 profile 自带它。在本 bundle 存在之前创建的 profile 会在下次启动时被规范化到当前模板，因为它此前那组确切的 bundle 元组被记录为安装方所有——这次重新打包不会丢掉该能力。

从 **Plugins** 页，或在更靠后的补丁层里把这个模块关掉：

```yaml
- id: terminal-preset-contribution
  disabled: true
```

一行就关掉整项能力，因为它挂载的本来就只有一行。

命令超时是一个部署值，不是常量。补丁会替换该行的完整 config，所以要整份给出：

```yaml
- id: terminal-preset-contribution
  config:
    timeoutMs: 900000
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

补丁插入一行 `@deepseek-ai/dsh-terminal/preset-contribution`，它在终端服务被解析到的地方同样被解析到。一个把自己当插件来命名的 bundle，必须能从 Loader 读取它的地方被当作模块解析到，而一个只承载补丁的 bundle 本来从不需要这个性质；改为指向服务包，就让这条贡献恰好在服务已经解析得到的地方被解析到。

被贡献的那一行是一个带 `isolate: { terminals: true }` 的 `cordis:group`，有四个子行：

| 子行 | 模块 | 角色 |
|---|---|---|
| `pty` | `@deepseek-ai/dsh-terminal` | 按所有者划分作用域的会话服务 |
| `terminal-bash` | `@deepseek-ai/dsh-terminal-bash` | 交互式 bash；在 Windows 上停用 |
| `terminal-pwsh` | `@deepseek-ai/dsh-terminal-bash` | 同一个插件的 pwsh 方言；在非 Windows 上停用 |
| `tool-terminal` | `@deepseek-ai/dsh-tool-terminal` | 六个 `terminal_*` 工具 |

两个 shell 行都保留，而不是在这里把平台解析成一行，这样部署就能从更靠后的补丁层按 id 覆盖其中任一行。同时只有一个是启用的，因为两个会为一个 agent 开出两个 shell。

整个组之所以是按 agent 的，是因为一个终端属于开启它的那个 agent，而那个隔离正是阻止一个 agent 读到另一个 agent 屏幕的东西。这与记忆的拆分恰好相反：记忆的存储只有一个所有者，所以它留在宿主平面。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的那一行及其部署值 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`terminal/`](../../terminal/README.zh.md) —— 会话服务、shell 后端与那些工具。
- [preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md) —— 为什么一个模块贡献一行，而不是去改 preset。
- [`dsh-module-memory`](../module-memory/README.zh.md) —— 宿主平面的那一半，用来对照平面拆分。
- [默认模块与两个视图](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 为什么每个默认模块各自一个 bundle。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那一行：`dsh-tool-terminal` 拥有那六个 `terminal_*` schema 与它们的结果，而本 bundle 只决定某个 preset 是否携带它们。

#### KV Cache effect

选择本 bundle，会为该 profile 上每个会话的请求前缀增加六个工具 schema，这是选择那一刻的一次性变化，而不是每次请求的变化；贡献在各 preset 挂载之后才到达并让已挂载的那一代退休，所以工具目录在启动时一次性定下来，不会在会话中途变动。组里没有任何东西贡献运行时上下文，所以一个没有打开过终端的会话，其前缀与没有本 bundle 的会话相同，而屏幕内容只作为工具结果到达模型——它位于前缀之后，不会让它前面的任何内容失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **会话不跨重启存活** —— 它们局限于一个 harness 进程，所以 profile 重启会丢掉每一个打开的 shell。这是该服务的性质，不是本 bundle 的。
- **一个超时同时服务两种方言** —— 这个 config 字段同时到达 bash 与 pwsh；需要不同上限的部署改为按 id 覆盖某个 shell 行。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过，所以手工编辑过的 profile 也要手工加上本 bundle。
- **只有 `web` 模板选择了它** —— 自定义 profile 要把它加进自己的 `dsh.profile.bundles`。
- **贡献次序由中央分配** —— 本 bundle 那一行处在注册表所有的一个固定位置上，所以部署无法把它相对于另一个模块贡献的行重新排序。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那一行由 Loader 观察，而终端服务发布它自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

这是第一条承载「组」而不是单行的贡献，它正是「`ContributedRow` 是完整的 preset 行类型，而不是一个扁平的插件引用」的证据。被贡献的组如何隔离、如何给子行排序，这些一变就先在这里显现出来。

</details>
