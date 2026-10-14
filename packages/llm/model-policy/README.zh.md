---
description: "部署允许哪些模型：这条接缝、运营方书写的 provider，以及拒绝其余一切的 waterfall。"
kind: "package-reference"
---

# @lyness/lyn-model-policy

[English](README.md) | 中文

## 概述

用 `lyn-model-policy` 把「允许的模型列表」变成部署方的决定，而不是用户的。这条接缝回答「正在解析的这次请求可以用哪些模型、以及是哪一方决定的」；`./static` 提供一份由运营方书写的列表；`./enforce` 挂在 `llm/stream` waterfall 上，拒绝策略没有点名的任何路由。不挂载任何 provider 则该部署不受限制——这正是单租户开发者安装想要的。

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

一个只有一份列表的安装——也就是独立部署形态——把静态 provider 与强制执行一起挂上：

```yaml
- id: model-policy
  name: '@lyness/lyn-model-policy/static'
  config:
    authority: your IT administrator
    allowed:
      - provider: deepseek-official
        model: deepseek-flash
- id: model-policy-enforce
  name: '@lyness/lyn-model-policy/enforce'
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `allowed` | 必填，且不可为空 | 被授权用户可以使用的模型 |
| `authority` | `this deployment` | 拒绝时点名的那一方 |

`allowed` 是必填的，且为空时被拒绝：一个什么都不允许的安装不服务任何人，而一个空列表远更可能是一次没写完的编辑、而不是一个意图——所以它在加载时失败，而不是对每一次请求都拒绝。

托管部署挂载的是一个按租户解析的 provider，而不是 `./static`，因为它的允许集合逐请求不同。

-----

<a id="understand-the-implementation"></a>
## 理解实现

强制执行坐在 `llm/stream` waterfall 上，而每一次流式调用都要经过它——循环构建的、手工构建的、重试、replay。这个落点正是本包的要点。一个被过滤过的模型选择器只是展示；一个 preset 行、一份 profile 补丁、一次直接 RPC，各自都能在不经过任何界面的情况下到达运行时，所以「做出该决定的那个操作」就是「强制执行它的那个操作」。

被拒绝的调用抛出 `LlmError`，code 为 `MODEL_NOT_ALLOWED`，与「路由不存在」区分开；它不携带任何 provider 事实，因为这次拒绝发生在 provider 边界之前。

拒绝点名权威方是刻意的。「这是本服务提供的范围」与「去找你的管理员」通往不同的下一步动作，而一条两者都不说的拒绝产生的是工单，不是修复。

`allowance()` 按请求调用而不是被使用方缓存，因为托管部署逐请求解析不同的租户，而管理员的改动应当在下一次请求就生效。

这条接缝之所以存在、而不是直接读租户配置，是因为两种出厂形态不同：独立部署根本没有租户，所以一个绑定租户的策略无法服务它。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-llm`](../llm/README.zh.md) —— 本强制执行所加入的那个运行时与 `llm/stream` waterfall。
- [`lyn-model-required`](../model-required/README.zh.md) —— 针对「完全到达不了模型的部署」的那个配套门禁。
- [`tenant-config`](../../tenant/tenant-config/README.zh.md) —— 托管 provider 会读取的那份按租户名册。
- [模型是部署方的决定](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.zh.md) —— 为什么强制执行在这里、而不在某个界面里。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它只拒绝部署方不允许的调用。

#### KV Cache effect

没有任何请求前缀发生变化：一次被允许的调用发出的东西与此前完全一致，而一次被拒绝的调用什么都不发，所以既没有前缀被构建、也没有前缀被失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **拒绝到达于调用时，而不是于选择时** —— 一个在界面里挑了不被允许模型的用户，会在那一回合失败时才知道。过滤选择器仍然值得做；它是建立在这条规则之上的展示，永远不是它的替代。
- **静态 provider 对每一次请求都提供同一份列表** —— 对一个只有一位管理员的安装而言这是对的，而这也正是托管部署需要它自己那个 provider 的原因。
- **尚无模态维度** —— `tenant-config` 是按模态建模允许集合的，而这条接缝不是。一个「允许某模型用于文本但不用于视觉」的部署，在这里无法表达。

**Runtime invariant:** 不发布任何 companion。这条接缝除了运营方那份被冻结的列表之外不持有状态，而它那一个 waterfall 监听器由 effect 持有。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

本包里的每一个测试都直接到达运行时、中间不经过任何界面，因为那正是要证明的主张。一个去驱动模型选择器的测试会在规则可被绕过的情况下照样通过。

</details>
