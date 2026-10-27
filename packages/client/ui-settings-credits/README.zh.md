---
description: "设置里的积分分区：余额、账目，以及管理员要作的两个决定。"
kind: "package-reference"
---

# @lyness/lyn-client-ui-settings-credits

[English](README.md) | 中文

## 概述

`lyn-client-ui-settings-credits` 是一个人读自己积分的那个设置分区：这个账户能花多少，发放给它与它花掉的全部记录，以及——对一个管得着人的身份——一个发放表单和一个周期额度表单。所有内容都来自客户端连上的那套部署，经 `remote.credits` 读取，于是桌面安装与浏览器各自展示自己服务器的账目。管理员表单依账户自带的 `administrable` 字段渲染，于是界面绝不会提供下一次调用会拒绝的控件。

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

Web bundle 同时挂载两侧；宿主侧自己什么都不贡献：

```yaml
- id: credits-controller
  name: '@lyness/lyn-api-credits-controller'
- id: ui-settings-credits
  name: '@lyness/lyn-client-ui-settings-credits'
```

别的都不用配。两行挂上之后分区就出现在设置里，并在导航中自称「积分」。

`@lyness/lyn-client-ui-settings-credits/client` 的 `createCreditsOperations(calls, sink)` 从一个 `CreditsCalls` 与一个 `CreditsSink` 构建出那次读取与那两次改动，于是它们不经过槽位注册也能到达——测试正是这样进行的，另一个界面也可以据此驱动同样的调用。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**读取在分区打开时才开始。** 不是在插件加载时：一个从不打开设置的人，不该让部署付出一次请求。同一时刻只有一次在途读取被共享，所以打开两次不会问两次。

**不计量积分的部署是它自己的状态，不是失败。** `credits/unavailable` 直说这件事，并且不提供重试，因为没有可重试进去的东西。其余任何拒绝、以及抛出的调用，都读作带重试的失败——反正读者只能重试。

**重试展示的是它的尝试。** 先丢掉上一次失败，于是读者看到的是正在读取，而不是一个可能已经不成立的失败。

**发放给别人不会替换屏幕上的余额。** 调用答复的是被发放人的账户，只有管理员发放给自己时它才是本账户；否则就会把另一个人的余额挂在本账户名下。

**组织的上限和账户一起读出来，而且只给管理员读。** 一次读同时答出两者，所以这个区块不需要自己串两次；只有在账户说「这个调用方管理着某个人」时才去问，因为一个组织买了多少、花了多少是它的管理员该看的。读不出来的上限会让账户留在屏幕上、只是没有上限，而不是把整次读变成一次失败；这个区块不论什么身份都是只读的：改上限是平台的事，而这个区块属于那个正在读自己积分的人。

**表单拒绝服务器也会拒绝的东西。** 空的人与非正数的额度不会离开浏览器。其余规则都是服务器的，它的拒绝按服务器给出的消息展示。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-api-credits-controller`](../../api/credits-controller/README.zh.md) —— 本分区读写的那个命名空间。
- [`lyn-credits`](../../credits/credits/README.zh.md) —— 它背后的账本与额度算术。
- [`lyn-client-ui-settings`](../ui-settings/README.zh.md) —— 它注册进去的那个分区槽位。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它是一个人读的页面，而账本对一个回合的影响，是 `lyn-credits` 在 `llm/stream` 里抛出的那次拒绝。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **管理员要手打人的标识** —— 目录不提供列举，所以表单无法呈现一个身份管得着哪些人。
- **额度表单先写后读** —— 它只在本次会话保存过之后才显示是谁设的覆盖，因为分区读的是调用者自己的账户，而不是任意某人的额度。
- **覆盖无法删除** —— 服务器只替换行、从不删除，所以表单无法提供「恢复为继承」。
- **没有购买通路** —— 账本认得 `purchase` 这个理由，而本分区不产出它。
- **账目整个铺开** —— 每一笔发放与花费都会渲染，没有分页，所以长期账户会把页面撑长。
- **上限只展示，不设置** —— 平台管理员在这里和别人一样只是读一个组织的上限，设它要通过 Remote 调用；这个区块没有那个表单，也没有办法读另一个组织的。

**运行时不变量：** 不发布伴生检查。渲染出来的一切都由同一个 Remote 答案投影而来，不存在第二份余额与它发散。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`SectionBinding` 在框架烘出 store 之前发布给谁都不发布，这正是 `apply` 得以在任何渲染之前就构建好 operations 的原因；先落定的读取会丢掉自己的结果，而不是失败。

</details>
