---
description: "积分模块自成一个 bundle：一本账、一份周期额度，以及模型请求绕不过去的计量。"
kind: "package-bundle"
---

# @lyness/lyn-module-credits

[English](README.md) | 中文

## 概述

`lyn-module-credits` 是计量一套部署的人花了多少的那组编排：账本、周期额度、改动它的那些管理员决定，以及搭在 `llm/stream` 上的执行。它与 [`lyn-module-accounts`](../module-accounts/README.zh.md) 并列选中，而不是取而代之：一次请求记在谁头上，是从那次请求的主体读出来的，没有账户模块就没有主体可读。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

profile 把它与账户模块并列选上：

```yaml
bundles:
  - '@lyness/lyn-module-accounts'
  - '@lyness/lyn-module-credits'
```

随产品发布的 `hosted` 模板正是这么做的。`enterprise` 模板只选账户、不选这一个，因为在客户自己掏钱买的机器上，按额度计量客户自己的员工，等于向他们收自己机器的钱。

额度是一套安装最先会改的数字：

```yaml
- id: credits
  name: '@lyness/lyn-credits/store'
  config:
    periodicAmount: 1000
    period: daily
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**与账户分开，是因为问题本就分开。** 账户说的是谁存在、怎么登录；积分说的是每个人可以花多少。想要前者不要后者的部署选一个 bundle，而不是两个都选、再把其中半个关掉。

**是缺席，不是关掉。** 没选这个模块的部署根本没有账本：每个界面读到的都是 `credits/unavailable`，而这是「没有额度」唯一不会把余额漏进页面、日志或报错里的版本。

**计量搭在瀑布上。** `credits/enforce` 监听 `llm/stream`，于是预设行、profile 补丁或直接 RPC 都无法绕过计费抵达模型。改在某个界面上执行，就会放过其余所有调用方。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-credits`](../../credits/credits/README.zh.md) —— 账本、额度算术与授权规则。
- [`lyn-module-accounts`](../module-accounts/README.zh.md) —— 本模块所计量的那些人，以及读出他们的那个主体。
- [`lyn-api-credits-controller`](../../api/credits-controller/README.zh.md) —— 界面读余额所经的命名空间。

-----

<a id="model-experience"></a>
## 模型体验

间接存在，经由计量：账户付不起的那个回合会在 `llm/stream` 里被拒绝，模型根本看不到请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **账本的数字是一套部署的** —— `periodicAmount` 与 `credits/enforce` 里的定价适用于这套部署服务的每个人，按组织的覆盖经积分界面写入，而不写在这里。
- **只选它、不选账户，就谁也计量不到** —— 账本挂起来了，而没有任何请求解析得出计费对象，于是每次调用都读作未计量，而不是大声拒绝。只选这一个 bundle 的 profile 犯了一个目前还没有东西会点名的编排错误。

**运行时不变量：** 不发布伴生检查。bundle 贡献的是编排行；值得断言的关系属于这些行挂起来的那些包。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

这四行原本住在 `lyn-module-accounts` 里，直到 enterprise 模板需要「要账户、不要计量」；这次拆分正是让「没有额度」继续意味着缺席，而不是被配成零。

</details>
