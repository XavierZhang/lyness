---
description: "通过外部目录签入，面向接入 SSO 的部署方与新增渠道的维护者。"
kind: "package-reference"
---

# @lyness/lyn-sign-in

[English](README.md) | 中文

## 概述

`lyn-sign-in` 让一个人通过他本来就属于的目录签入，并交回一个会话。渠道在那个目录上验证他是谁；部署自己的准入规则说他在这里是谁；然后为那个人建立会话。渠道是注册进来的，而不是在这里配置的，所以一个同时提供微软目录和企业微信的部署挂两个渠道插件，本包与签入页都不知道哪个是哪个。两半都是注入的：没有会话存储或没有准入规则，就根本没有签入。

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

挂上服务、一条准入规则，以及至少一个渠道：

```yaml
- id: sign-in
  name: '@lyness/lyn-sign-in'
  config:
    lifetimeMs: 43200000
- id: sign-in-admission-roster
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: microsoft-entra
        issuer: contoso.onmicrosoft.com
        subject: 7a1f0e2c-0000-0000-0000-000000000000
        person: ada
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `lifetimeMs` | `43200000` | 一次签入所建立的会话能持续多久，单位毫秒 |

名册的 `bindings` 是必填的，而空列表谁都不准入。

### 新增一个渠道

渠道插件注册一个对象，并持有它的 disposer：

```ts
import type { Context } from '@lyness/cordis'
import { channelId } from '@lyness/lyn-sign-in'

export const inject = ['signIn']

export function apply(ctx: Context): void {
  // `register` ties the disposer to this plugin's own fiber; the return value
  // is there for a channel that withdraws itself earlier than that.
  void ctx.signIn.register({
    id: channelId('wecom'),
    displayName: 'WeCom',
    authenticate: async () => undefined,
  })
}
```

`authenticate` 返回被验证的 subject，或在这个人没有完成签入时返回 `undefined`。它从不决定他是否可以使用这个系统。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**认证与准入是两个决定。** 一个目录确认某人在某公司工作，并不说明这套安装是给他用的。把两者混为一谈，会在目录一接上的瞬间就准入整个目录，所以 `SignInAdmission` 是一个单独的能力缝，而流程注入它：一个没有挂任何规则的部署谁都签不进来。这是失败即关闭的方向——「谁可以用这个系统」这个问题没有答案时，必须把人挡在外面。

**一个拒绝覆盖两种原因。** 对「这个目录我们不接受」与「这个人不在名册上」，`not-admitted` 都是同一个答案。区分它们，会让一个尚未认证的调用方把这里存在哪些账号枚举出来。

**会话最后才建立。** 目录与准入规则都先给出答案，然后才写任何东西，所以一次被拒绝的签入不会留下任何需要吊销的会话。

**一条绑定由三部分共同作键。** subject 只在它所属的目录内唯一，而同一个目录经由两个渠道到达，就是两条信任路径——哪怕它确实是一个目录。同一个身份出现两行会在加载时失败，而不是按优先级取其一，因为无论哪一行胜出，都会无声地决定某人以谁的身份签入。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-auth-session`](../auth-session/README.zh.md) —— 本流程所建立的那些会话。
- [`lyn-people`](../people/README.zh.md) —— 准入规则把目录身份映射到的那份名册。
- [`lyn-request-principal`](../request-principal/README.zh.md) —— 在其后每一次调用上把会话读回来的那一层。
- [`lyn-microsoft-entra`](../../vendor/microsoft-entra) —— 一个可以成为渠道的目录签入。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它建立的是宿主侧的会话。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **目前还没有任何渠道随包发布** —— `lyn-microsoft-entra` 已经能验证一个 subject，把它接成渠道是下一步；在那之前部署方没有东西可注册。
- **还没有托管形态的准入规则** —— 名册是「独立安装」形态的答案。托管部署的人是注册进来的，这需要一条「在租户自己的目录内首次签入时建档」的规则。
- **没有任何东西签发那个 cookie** —— `begin` 返回会话身份；把它放进响应的那个界面、以及它设置的属性，不在这里决定。
- **改绑定需要重启** —— 名册在加载时读取，所以管理员新增一个人是改组合配置，而不是在界面上操作。

**Runtime invariant:** 不发布任何 companion。本包持有的每一个关系——一个渠道的注册、一条绑定对应的人——都只有一个观察者。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`bindingKey` 对三个部分用 `JSON.stringify`，而不是用分隔符拼接，于是一个含有该分隔符的部分无法被构造成与另一个身份相撞。有一个测试把这一点钉住。

</details>
