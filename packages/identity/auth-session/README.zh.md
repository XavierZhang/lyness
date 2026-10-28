---
description: "签入会话：在签入时建立、持有当前生效的上下文，并在失效的那一刻就被拒绝。"
kind: "package-reference"
---

# @deepseek-ai/dsh-auth-session

[English](README.md) | 中文

## 概述

用 `dsh-auth-session` 持有「签入」所产生的东西。一个会话属于一个人、而不属于某个身份：当前生效的上下文是这个会话上的服务端状态，只能由一次显式切换改变。`./store` 持久化会话，于是一次重新部署不会把所有人签出；而一个已失效的会话在被出示的那一刻就被拒绝，而不是等某次清扫。会话标识是一张持有即生效的凭据，所以读取它是得知调用方身份的唯一途径，而吊销它是让其停止的唯一途径。

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

```yaml
- id: auth-sessions
  name: '@deepseek-ai/dsh-auth-session/store'
  config:
    lifetimeMs: 1209600000
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `lifetimeMs` | 14 天 | 一个会话持续多久；`0` 表示签发一个不失效的会话 |

一个签入流程在证明了此人身份之后建立会话，并记录它是怎么证明的：

```ts
import type { AuthSessionStore } from '@deepseek-ai/dsh-auth-session'
import type { PersonId } from '@deepseek-ai/dsh-people'

declare const sessions: AuthSessionStore
declare const provenPerson: PersonId

const session = await sessions.establish({ person: provenPerson, method: 'sso:entra' })
```

切换上下文要先经过 [`dsh-acting-context`](../acting-context/README.zh.md)：那个解析器决定该上下文是否被允许，而本存储只把一个已被校验过的上下文置为生效。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**会话开在个人上下文上，而从不开在某个成员身份上**——即使这个人恰好只持有一个。开在某个身份上，正是 acting-context 那个决定要避免的那次猜测。

**一次切换不能改变「这是谁的会话」。** 点名另一个人的上下文会被拒绝，因为存下它会让此后这个会话的每一次调用都以别人的身份行事：一次糟糕的切换会变成许多次错误的调用。

**失效在读取时检查，而不是由定时器清扫。** 一个已失效的会话必须在被出示的那一刻就被拒绝，而一次还没跑的清扫会把它放过去。

**会话是持久化的。** 一张「服务器一重新部署就不好使」的持有凭据，会让人学会不信任它。

一次切换只改变当前生效的上下文、别的都不改——建立时刻与「没有过期时间」这两件事都原样存活。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-acting-context`](../acting-context/README.zh.md) —— 决定一个上下文是否可以被置为生效。
- [`dsh-people`](../people/README.zh.md) —— 一个会话所属的那些身份。
- [人、成员关系与调用所处的上下文](../../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md) —— 本包所实现的那个决定。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它持有宿主侧的认证状态。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **尚无签入流程** —— 本包持有的是「某个流程所产生的东西」。证明某人身份——无论凭密码、凭平台账号、还是凭某个 SSO 签发方——属于那些调用 `establish` 的流程。
- **尚无「按请求发布当前会话」** —— 把一张被出示的持有凭据变成「这次调用是谁」的那个传输层是下一块，而它正是让积分计量与只读 Models 页面成为可能的那一块。
- **吊销是按会话、而不是按人** —— 要结束某人持有的每一个会话，意味着逐个吊销；一个把它们列出来的界面可以做到，但本存储不提供一次调用完成它。
- **过期的行从不被裁剪** —— 对读取是正确的（读取会拒绝它们），但一个长期运行的部署会不断累积，直到有什么东西来清扫。

**Runtime invariant:** 不发布任何 companion。每个答案都是「已存储的行」与「时钟」的函数，所以不存在一个可能与之不一致的缓存视图。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`switchContext` 刻意逐字段重建那条记录，而不是展开旧的那条。正是这一点让一次切换不会把它不该带的东西带过去，也正是这一点让「不失效的会话」成为一个测试、而不是一次偶然。

</details>
