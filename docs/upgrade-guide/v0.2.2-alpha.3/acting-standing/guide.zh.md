---
kind: upgrade-guide
description: "Principal 多带它所在的会话，viewer 的应答多带这个人持有的全部身份，而登录会把唯一的那个身份置为生效。"
---

# 会话说出自己以什么身份行事

[English](guide.md) | 中文

## 变更

三处接口，一处行为。

| 之前 | 之后 |
|---|---|
| `Principal` 是 `{ person, acting }` | 它还带 `session`——这次调用出示的那个身份 |
| `ViewerView` 有 `standing` | 它还有 `standings`——这个人持有的全部身份 |
| `identity` 命名空间只答 `viewer()` | 它还答 `act(standing)`，把调用方**自己的**某个身份置为生效 |

行为那一处：登录过去把每个会话都留在「个人上下文」里，而个人上下文对任何需要身份的事都不授权——于是管理员一登录，每一个管理调用都拒绝他。现在：这个人**恰好持有一个身份**时，登录就把它置为生效。持有多个的仍然留在个人上下文，因为「以哪个组织行事」是他的决定；管理端会经 `act` 问他。

受影响的是：自己构造 `Principal` 的人（自定义授权规则、测试替身）、自己构造 `ViewerView` 的人（替 identity 命名空间作答的界面），以及自己代码里假定「刚登录的会话以个人身份行事」的部署。

## 迁移

1. 凡是构造 `Principal` 的地方，补上 `session`。它就是这次调用出示的那个 `AuthSessionId`——`presentedSession(request)` 返回它，`requestPrincipal` 本来就解析出它：
   ```ts
   import type { Principal } from '@deepseek-ai/dsh-request-principal'
   import type { AuthSessionId } from '@deepseek-ai/dsh-auth-session'
   import type { PersonId } from '@deepseek-ai/dsh-people'

   declare const presented: AuthSessionId
   declare const person: PersonId

   const principal: Principal = { session: presented, person, acting: { person } }
   ```
   只用于被读取的替身可以用任意一个品牌化字符串；没有任何东西能经它指向别的会话。
2. 凡是构造 `ViewerView` 的地方，补上 `standings: []`，或者你的界面确实知道的那几个身份。`standing` 的含义不变：**正在生效**的那一个。
3. 如果你自己的代码在登录之后手动置入过身份，删掉它：`signIn` 会为「恰好持有一个」的人做这件事，做两遍等于互相覆写。
4. 确认它生效：以只持有一个身份的人登录，然后调任何需要身份的东西——它会作答，而不是以 `this call acts in no standing` 拒绝。`packages/identity/sign-in/tests/sign-in.spec.ts` 把四种情况都钉住了（一个、多个、没有、没有目录）。
