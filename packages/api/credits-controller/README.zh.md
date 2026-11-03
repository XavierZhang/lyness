---
description: "本人读自己的余额；管理员发放积分、设定额度。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-credits-controller

[English](README.md) | 中文

## 概述

`dsh-api-credits-controller` 拥有 `credits` 这个 Remote 命名空间：调用者读自己的余额与账目，管理员发放积分、设定周期额度、查看自己所管理之人的账户。每次调用都以请求抵达时所处的身份行事，而非调用方自己点名的身份；授权规则本身留在 `dsh-credits`，于是「能读」与「能发」不会各说各话。读取会一并回答 `administrable`，让界面用填充控件的同一个答案来决定是否渲染这些控件。

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

无需配置，依赖账本、管理 seam、目录与请求主体：

```yaml
- id: credits-controller
  name: '@deepseek-ai/dsh-api-credits-controller'
```

浏览器像调用任何命名空间那样调用 `ctx.remote.credits.mine()`、`grant(input)`、`setAllowance(input)`、`account(person)` 与 `allowance(person)`，并把每个答案读作本包声明的视图：

```ts
import type { CreditAccountView } from '@deepseek-ai/dsh-api-credits-controller/types'

/**
 * Whether a credits page may offer granting on this answer.
 * @param view - what `credits/mine` answered.
 * @returns true when the calling standing administers somebody.
 */
export function mayOfferGranting(view: CreditAccountView): boolean {
  return view.administrable
}
```

`administrable` 是页面在渲染发放表单前读的那个字段。它随账户一起到来，而不是来自第二次调用，于是界面绝不会提供下一次调用会拒绝的控件。

### 它拒绝什么

| 编码 | 何时 |
|---|---|
| `credits/anonymous` | 调用没有出示身份，而积分属于某个人 |
| `credits/not-permitted` | 调用方所处的身份不能对那个人行事——包括以个人身份发起的调用 |
| `gateway/bad-request` | 线上字段不合法——空的人、非正数的额度、未知的周期 |
| `credits/unavailable` | 这套部署没挂账本，或没挂管理 seam |
| `credits/rejected` | 管理 seam 自己的规则拒绝这次改动；`reason` 是它的消息 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

**调用方点名「对谁」，从不点名「凭什么」。** 一次发放携带它影响的人；作出这次发放的身份来自请求主体，并经目录解析。一个能自带授权的调用方，就是自己的管理员。

**先身份，再权限，最后能力。** 匿名调用先听到「你没有出示身份」，然后才可能知道这套部署挂了什么；一个谁都管不着的身份，在账本被问到之前就被拒绝。这个顺序让部署的组合不会泄露给无法对它行事的调用方。

**一条授权规则，放在拥有它的包里。** `CreditAdministration.mayAdminister` 回答界面要问的两个问题——这个身份能否给那个人发放，能否看他的账目——因为与旁边那次发放各说各话的读取，会展示出下一次调用拒绝触碰的账户。

**拒绝自带编码。** `credits/not-permitted` 与 `credits/rejected` 是两个不同的答案：前者说同样的参数换一个身份就会被接受，后者说 seam 自己的规则不接受它们。seam 在「映射其拒绝」的包装之外解析，所以一套没挂账本的部署，永远不会被报成一次被拒绝的请求。

**账户带着限额，不只带着余额。**`periodicAmount`、`period`、`periodStartedAt` 和 `spentThisPeriod` 发给每一个读者，包括一个谁也不管理的人：他自己的限额、以及这个周期花掉了多少，是一个人永远有权知道的那两个数；否则界面就没法告诉他一个回合为什么停了。

**上限由组织读，由平台改。** `budget` 和 `myBudget` 按组织授权，于是它的管理员看得到它买了多少、还剩多少；`setBudget` 对除平台身份之外的任何人都拒绝，而视图用 `settable` 把这件事说出来——界面从「填充它的那个答案」里渲染自己的控件，而不是提供一个下一次调用会拒绝的控件。`myBudget` 从身份里解析出组织，理由和 `mine` 不取 person 一样：一个人持有身份的那唯一一个组织不是参数。

**视图，而非账本自己的类型。** 标识在宿主侧是带品牌的，在线上是朴素字符串；账户视图还多出账本不携带的一个事实：调用者在这里能否管理。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-credits`](../../credits/credits/README.zh.md) —— 账本、额度算术与授权规则。
- [`dsh-people`](../../identity/people/README.zh.md) —— 一个身份与它的角色从哪里来。
- [`dsh-request-principal`](../../identity/request-principal/README.zh.md) —— 一次调用如何得知自己是谁。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它回应的是一个人在读或改一个账户，而账本对一个回合的影响，是 `dsh-credits` 在 `llm/stream` 里抛出的那次拒绝。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **没有 bundle 组合它** —— 与其余身份与积分包一样，还没有任何组合选中这一行，所以随包 profile 都不提供这个命名空间。
- **管理员必须先知道人的标识** —— 目录不提供列举，所以界面无法呈现「这个身份管得着哪些人」，只能被喂一个标识。
- **额度覆盖无法删除** —— 行可以被替换但不能被删掉，所以设错的覆盖只能手工改回继承来的数字。
- **组织级改动经设定者读回** —— 面向整个组织的 `setAllowance` 回答的是设定者自己解析后的额度，因为这次改动没有点名任何一个人可供汇报。
- **没有购买通路** —— `purchase` 是账本认得、而这里不产出的发放理由；购买积分需要一个本包没有的支付界面。

**运行时不变量：** 不发布伴生检查。每个答案都在被问到的那一刻从账本与目录投影而来，不存在第二份余额或身份与它们发散。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`refusals` 以尾部匹配识别管理 seam 的授权消息，因为 `dsh-credits` 把那条消息导出为 `NOT_PERMITTED` 而非一个带类型的错误；若那个 seam 将来有了带类型的拒绝，这里应改为对它分支。

</details>
