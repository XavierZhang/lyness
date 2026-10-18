---
description: "账户模块自成一个 bundle：宁可拒绝启动，也不替部署发明谁是管理员。"
kind: "package-bundle"
---

# @lyness/lyn-module-accounts

[English](README.md) | 中文

## 概述

一个随包产品选中这个 bundle，就是在声明它服务的是有名有姓的人，而不是一个操作者。它携带目录、已签入会话、登录注册表连同渠道种类与浏览器路由、一次调用所代表的主体、那次调用可以行事的上下文，以及一次会话的归属人。这些人能花多少，是[积分模块](../module-credits/README.zh.md)的问题。其中两行刻意不带可用默认值：名册谁也不写并在加载时失败，准入名册谁也不绑，于是部署在服务任何人之前，先说出自己的人是谁。

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

`hosted` 与 `enterprise` profile 模板都选中它。开发者 profile 不选，因为键盘前只有一个人的安装用不着这些。

选中它的部署要写两样东西。它的人，写在 `people` 行的名册里：

```yaml
- id: people
  name: '@lyness/lyn-people/static'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
```

以及，在挂上某个登录 channel 之后，每一个被验证的 subject 可以是谁，写在 `sign-in-admission` 行的绑定里：

```yaml
- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: microsoft-entra
        issuer: 00000000-0000-0000-0000-000000000000
        subject: 11111111-1111-1111-1111-111111111111
        person: ada
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

**两行宁可拒绝也不放行。** 空名册在加载时失败，因为一个默认的人意味着这个 bundle 替别人的安装决定了谁是管理员。空绑定列表谁也不准入，因为一个已接上、却还没写任何绑定的目录绝不能签入任何人——否则就会出现一个「整个目录都能进来」的窗口。

**这里没有 channel。** 每个登录 channel 都携带某一个目录注册的凭据，那属于部署而不属于 bundle。部署在这些行旁边加上自己用的那个 channel。

**身份不是计量。** 客户自己的服务器要的是有名有姓的人、而不是额度，所以账本自成一个 bundle；只选账户，每个界面读到的是 `credits/unavailable`，而不是一个被配成零的余额。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-people`](../../identity/people/README.zh.md) —— 目录，以及每种角色能做什么。
- [`lyn-sign-in`](../../identity/sign-in/README.zh.md) —— channel 注册表与准入规则。
- [`lyn-module-credits`](../module-credits/README.zh.md) —— 在计量的部署上，这些人被记账的那本账。
- [离开单操作者 Host](../../../.agents/notes/proposed/architecture/2026-10-15-diverging-from-the-single-operator-host.zh.md) —— 托管形态为什么需要这些。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个 bundle 不注册任何工具或提示词：它的那些行决定一次调用代表谁，它们贡献的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何一行贡献指令。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **它不随带 channel** —— 在部署挂上一个之前没人能登录，准入绑定也没有东西可匹配。
- **名册是组合配置** —— 加一个人是改 cordis.yml 并重启，而不是一个界面，因为 `lyn-people` 只有静态目录。
- **没有注册** —— 托管部署的人是注册进来的，那需要一条「首次登录时在租户自己的目录里开户」的准入规则；本 bundle 携带的是名册规则。
- **租户不在这里选** —— 租户目录、它的配置与请求解析器各自成包，托管部署单独组合它们。
- **不与目录同步** —— 员工本就住在那个用来登录的目录里的部署，仍要手写名册；没有任何东西去读那个目录自己的成员名单。

**运行时不变量：** 不发布伴生检查。bundle 贡献的是组合行；它的行所持有的每个关系，都由拥有那个关系的包来检查。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

行的顺序是阅读顺序，不是依赖顺序：Cordis 按注入解析它们，所以挪动一行只改变后续补丁层能覆盖什么。

</details>
