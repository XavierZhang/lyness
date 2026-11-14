---
description: "语言服务器导航模块独立成一个 bundle，出厂是惰性的，因为服务器命令由部署自行提供。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-module-lsp

[English](README.md) | 中文

## 概述

本 bundle 就是代码导航这个默认模块：来自本地语言服务器的定义、引用、实现与悬浮文档。这条接缝与它的 stdio provider 是宿主行——一个工作区一个服务器，由在其中工作的每个 agent 共享——而查询工具是按 agent 的，经由[preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md)接缝到达。

每一行出厂都是**停用**的，而这是结构性的，不是分阶段推进：`lsp-stdio` 需要本 harness 并不安装的服务器命令，所以不存在任何能在任意机器上生效的出厂值。

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

`web` profile 模板选择了它，所以新建的 profile 自带它可用。在本 bundle 存在之前创建的 profile 会在下次启动时被规范化到当前模板，因为它此前那组确切的 bundle 元组被记录为安装方所有。

选择这个 bundle 并不会把模块打开。要把三行一起启用，并给出服务器：

```yaml
- id: lsp
  disabled: false
- id: lsp-stdio
  disabled: false
  config:
    servers:
      typescript:
        command: typescript-language-server
        args: ['--stdio']
        extensionToLanguage:
          .ts: typescript
          .tsx: typescriptreact
- id: lsp-preset-contribution
  disabled: false
```

要成套启用。只留贡献行，会发布一个背后没有 provider 的工具，于是失败发生在调用它的那个会话里，而不是在组合它的那次启动里。启用 `lsp-stdio` 而不给 `servers` 表会在加载时大声失败，而这正是预期结果：那张表没有默认值，因为没有哪个默认值会是对的。

结果上限设在贡献行上，因为被贡献的行没有任何后续补丁层能定位到的 id：

```yaml
- id: lsp-preset-contribution
  disabled: false
  config:
    maxLocations: 50
    maxResultChars: 8000
    timeoutMs: 30000
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

| 行 | 模块 | 平面 | 角色 |
|---|---|---|---|
| `lsp` | `@deepseek-ai/dsh-lsp` | 宿主 | 接缝：按扩展名选择 provider，并归一化结果 |
| `lsp-stdio` | `@deepseek-ai/dsh-lsp-stdio` | 宿主 | 把配置好的 stdio 服务器命令驱动为 provider |
| `lsp-preset-contribution` | `@deepseek-ai/dsh-lsp/preset-contribution` | 贡献 | 把 `lsp` 工具行交给每个接受贡献的 preset |

贡献插件放在接缝旁边而不是本 bundle 里，是为了让那个插件名在接缝被解析到的地方同样被解析到。一个把自己当插件来命名的 bundle，必须能从 Loader 读取它的地方被当作模块解析到，而一个只承载补丁的 bundle 本来从不需要这个性质。

平面的拆分跟随所有权：一个语言服务器按工作区启动，由在其中工作的每个 agent 共享，所以接缝与 provider 由一个进程持有。只有工具是按 agent 的，因为一次工具调用属于发出它的那个 agent。这与 [`dsh-module-memory`](../module-memory/README.zh.md) 的拆分相同，而与 [`dsh-module-terminal`](../module-terminal/README.zh.md) 相反——后者的会话各自属于一个 agent。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的三行，以及一份可照抄的启用示例 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lsp/`](../../lsp/README.zh.md) —— 接缝、stdio provider 与那个工具。
- [preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md) —— 为什么一个模块贡献一行，而不是去改 preset。
- [`dsh-module-schedule`](../module-schedule/README.zh.md) —— 另一个出厂可用但未激活的模块。
- [默认模块与两个视图](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 为什么每个默认模块各自一个 bundle。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那些行：`dsh-tool-lsp` 拥有 `lsp` 工具的 schema、提示词指引与渲染后的结果，而本 bundle 只决定某个 preset 是否携带它们。

#### KV Cache effect

在这些行保持停用时——也就是它们的出厂状态——没有任何模型请求发生变化，所以选择本 bundle 会让请求前缀逐字节不变。启用它会为该 profile 上每个会话的前缀增加一个工具 schema 及其指引，这是启用那一刻的一次性变化，而不是每次请求的变化；而贡献会让已挂载的那一代 preset 退休，所以工具目录一次性定下来，不会在会话中途变动。导航结果只作为工具结果到达模型——它位于前缀之后，不会让它前面的任何内容失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **它出厂是惰性的，而且没法不是** —— 服务器命令属于部署自己提供，本 bundle 一个也不安装。这正是该模块「被选中但关着」的原因，不是一个将来要回头推进的分阶段决定。
- **三行可以各自独立启用** —— 没有任何东西会拒绝「有贡献行而没有接缝」。只启用那一行，会留下一个调用时才失败的工具。
- **本 bundle 不为服务器做沙箱** —— 语言服务器进程与源码读取共享已挂载的文件系统与子进程环境，所以约束由部署自行添加。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过。
- **贡献次序由中央分配** —— 本 bundle 那一行处在注册表所有的一个固定位置上，所以部署无法把它相对于另一个模块贡献的行重新排序。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而 LSP 接缝发布它自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

这是第一个「惰性是结构性的、而不是选择出来的」模块 bundle，这也是它的补丁里带一份可照抄的启用示例、而不只是一个 disabled 标记的原因。一个把这些停用行当成分阶段决定来读的人，会试着把它们默认打开，然后发现没有任何命令可以写。

</details>
