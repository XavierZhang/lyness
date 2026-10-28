---
description: "运行时自我修改模块独立成一个 bundle，其工具行仍由 preset 声明，以保持该能力只属于开发视图。"
kind: "package-bundle"
---

# @lyness/lyn-module-extensions

[English](README.md) | 中文

## 概述

本 bundle 就是运行时自我修改这个默认模块：agent 读取并编辑它正在运行的那个组合。它携带宿主 runner、进程级全局的 inspect provider、浏览器 runner 与那个视图。在所有默认模块里只有它不贡献任何 preset 行——它的 `tool-cordis` 行仍由应当携带它的那些 preset 声明，因为一条贡献会到达每个接受贡献的 preset，那样会把自我修改一并交给业务视图。

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

`web` profile 模板选择了它，所以新建的 profile 自带它。在本 bundle 存在之前创建的 profile 会在下次启动时被规范化到当前模板，因为它此前那组确切的 bundle 元组被记录为安装方所有。

从 **Plugins** 页，或在更靠后的补丁层里把这个模块关掉：

```yaml
- id: cordis-host-runner
  disabled: true
- id: cordis-inspect-providers
  disabled: true
- id: cordis-client-runner
  disabled: true
- id: ui-cordis
  disabled: true
```

要成套停用这些行，并连那个工具一起停用。声明 `tool-cordis` 的那些 preset 不在本 bundle 的补丁覆盖范围内，所以只关掉这些行，会留下一个「已声明但宿主 runner 已不在」的工具——于是失败发生在会话里，而不是在组合它的那次启动里。要改的是开发视图与上游的 `cordis` 模式。

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

| 行 | 模块 | 平面 | 角色 |
|---|---|---|---|
| `cordis-host-runner` | `@lyness/lyn-cordis-host-runner` | 宿主 | 执行组合的读取与编辑 |
| `cordis-inspect-providers` | `@lyness/lyn-tool-cordis/host` | 宿主 | 各个工具行读取的 inspect provider |
| `cordis-client-runner` | `@lyness/lyn-cordis-client-runner` | 浏览器 | runner 的浏览器那一半 |
| `ui-cordis` | `@lyness/lyn-client-ui-cordis` | 浏览器 | 组合视图 |

那些 inspect provider 是进程级全局的：注册表会拒绝重复 id，所以它们在这里注册一次，而每个 preset 的 `tool-cordis` 行都读取它们。这正是它们是宿主行、而不是按 agent 的那个工具的一部分的原因。

真正值得注意的是那条缺席的贡献。其他每个默认模块都把自己的工具行交给贡献接缝，而接缝会到达每个接受贡献的 preset。自我修改的范围只到开发视图，所以一条一刀切的贡献会是一次能力变更，而不是一次重新打包。在某个 preset 能够「只接受某一类贡献而不接受全部」之前，那个工具行就留在能力边界本来所在的地方。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的四行 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`extensions/`](../../extensions/README.zh.md) —— 那些 runner、那个工具与那个视图。
- [默认模块与两个视图](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 哪个视图携带哪项能力。
- [preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md) —— 本模块刻意不使用的那条接缝。
- [`lyn-module-deliverables`](../module-deliverables/README.zh.md) —— 被贡献的行与 preset 声明行并存的那个模块。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那些行：`lyn-tool-cordis` 拥有组合工具的 schema 与结果，而本 bundle 提供那些调用所依赖的宿主 runner 与 inspect provider。

#### KV Cache effect

选择本 bundle 不改变任何请求前缀，因为那个工具 schema 来自某个 preset 自己的声明行、而不是来自本补丁；一个选择了本 bundle、但使用的 preset 没有那一行的 profile，发出的工具目录与此前完全一致。组合的读取与编辑作为工具结果到达模型，而工具结果位于前缀之后，不会让它前面的任何内容失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **那个工具行不在本 bundle 里** —— 停用这些行而不去改那些 preset，会留下一个没有宿主 runner 的已声明工具，于是在调用时失败、而不是在启动时。
- **一条贡献会放大该能力** —— 接缝会到达每个接受贡献的 preset，所以本模块不能在「不把自我修改给业务视图」的前提下使用它。preset 一侧的按类选择性接受会消除这个例外。
- **那些 inspect provider 是进程级全局的** —— 同 id 的第二行会被拒绝，所以要挂载自己那一份的部署得先停用这一行。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而那些 runner 发布它们自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

本模块是给贡献接缝划界的那个反例：它表明接缝对每个 preset 的触达是全有或全无的——对每个视图都该有的工具这没问题，而对只有开发视图才该有的工具就是错的。如果将来加入按类选择性接受，本 bundle 应当是第一个使用它的。

</details>
