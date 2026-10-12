---
description: "持久记忆模块独立成一个 bundle，其写入工具经由贡献接缝到达每个接受贡献的 preset。"
kind: "package-bundle"
---

# @lyness/lyn-module-memory

[English](README.md) | 中文

## 概述

本 bundle 就是持久记忆这个默认模块：宿主[记忆服务](../../memory/memory/README.zh.md)，加上把它的写入工具带进 agent 工具目录的那条 preset 贡献，作为 profile 选择的一个整体。它是[preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md)接缝的第一个使用方，因此也是"添加工具而不必重述 preset 行列表"的样例。

与 [`lyn-module-schedule`](../module-schedule/README.zh.md) 不同，它出厂就是**开着的**：一个空的存储对请求不贡献任何内容，所以在有人写下第一条事实之前就选上它，提示词代价是零字节。

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

两行都是开的。从 **Plugins** 页，或在更靠后的补丁层里把这个模块关掉：

```yaml
- id: memory
  disabled: true
- id: memory-preset-contribution
  disabled: true
```

要成对关掉。只留贡献行，会让工具留在目录里而背后没有服务，于是失败发生在调用它的那个会话里，而不是在组合它的那次启动里。

保留条数与提示词位置属于该服务的配置，不属于本 bundle；本 bundle 只插入这两行，不设置任何值。

-----

<a id="understand-the-implementation"></a>
## 理解实现

本 bundle 就是它那份补丁文档。`src/index.ts` 什么都不导出，它存在是因为构建流程要为每个包解析一个入口。

补丁插入两行，而两行都指向 `@lyness/lyn-memory`：

| 行 | 模块 | 角色 |
|---|---|---|
| `memory` | `@lyness/lyn-memory` | 宿主服务：一份持久存储，一个域的所有者 |
| `memory-preset-contribution` | `@lyness/lyn-memory/preset-contribution` | 向每个接受贡献的 preset 贡献那条 `memory_*` 工具行 |

两行都没有指向本 bundle 自己。一个把自己当插件来命名的 bundle，必须能从 Loader 读取它的地方被当作模块解析到，而一个只承载补丁的 bundle 本来从不需要这个性质；改为指向服务包，就让这条贡献恰好在服务已经解析得到的地方被解析到。

这两行之所以分开，是因为服务与它的工具处在不同的平面。服务是宿主平面的，于是一个进程持有一份存储、一个域的所有者。工具是按 agent 的，因为一次工具调用属于发出它的那个 agent。一个 preset 作用域的服务会让每个 agent 各自持有同一个存储域的句柄，而这正是这次拆分要防止的状态。

贡献在各 preset 挂载之后才到达——模块 bundle 在界面 bundle 之后加载——所以它让已挂载的那一代退休，而不是去给它打补丁。这个次序是该接缝自身被写明的行为，不是本 bundle 的性质。

| 文件 | 角色 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 该模块的两行 |
| [`locale/en.json`](locale/en.json) | Plugins 页读取的展示元数据 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-memory`](../../memory/memory/README.zh.md) —— 该服务、它的存储域，以及它的工具。
- [preset 行贡献](../../../.agents/notes/proposed/architecture/2026-10-10-preset-row-contributions.zh.md) —— 为什么一个模块贡献一行，而不是去改 preset。
- [记忆、检索与提示词组装](../../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.zh.md) —— 记忆是做什么的，以及不是做什么的。
- [默认模块与两个视图](../../../.agents/notes/proposed/architecture/2026-10-08-default-modules-and-views.zh.md) —— 为什么每个默认模块各自一个 bundle。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由它插入的那些行：记忆服务拥有那三个 `memory_*` 工具 schema 与"已记住"上下文块，并且只在选择了本 bundle 的 profile 上贡献它们。

#### KV Cache effect

选择本 bundle，会为该 profile 上每个会话的请求前缀增加三个工具 schema，这是选择那一刻的一次性变化，而不是每次请求的变化。那个"已记住"的块是运行时上下文，在每次组装时重新求值，并且位于稳定段落之后：空存储什么都不渲染，所以一个从未写下过事实的 profile，其前缀与没有本 bundle 的 profile 逐字节相同，而每次写入都会让从该块往后的上下文尾部失效——这正是该块被限定为最新若干条、并说明自己还有多少条没有展示、而不是随存储一起增长的原因。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了本 bundle 何时需要特别留意。它们是当前的约束，不是一份任务清单。

- **两行可以各自独立停用** —— 没有任何东西会拒绝"有贡献行而没有服务"。只关掉其中一行，会留下一批调用时才失败的工具，失败发生在会话里而不是启动时。
- **迁移只覆盖被记录的那些此前元组** —— 一个 bundle 列表被手工编辑过的 profile 会按设计被放过，所以手工编辑过的 profile 也要手工加上本 bundle。
- **只有 `web` 模板选择了它** —— 自定义 profile 要把它加进自己的 `lyn.profile.bundles`。
- **贡献次序由中央分配** —— 本 bundle 那一行处在注册表所有的一个固定位置上，所以部署无法把它相对于另一个模块贡献的行重新排序。

**Runtime invariant:** 不发布任何 companion。本 bundle 不拥有运行时状态；它插入的那些行由 Loader 观察，而记忆服务发布它自己的那份。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

这是 preset 贡献接缝的第一个使用方。贡献如何合并、如何排序、如何让一代退休，这些一变就先在这里显现出来，所以那个接缝一动，要读的就是本 bundle 的 web 快照。

</details>
