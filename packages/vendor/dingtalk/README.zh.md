---
description: "钉钉作为登录渠道：组织签入此刻在浏览器前的那个人。"
kind: "package-reference"
---

# @lyness/lyn-dingtalk

[English](README.md) | 中文

## 概述

`lyn-dingtalk` 把钉钉作为一个重定向登录渠道提供出来。它把浏览器送到钉钉自己的登录页，用 code 换到那个人自己的令牌，读出这个令牌属于谁，并把这个身份交给部署的准入规则——由它决定这个人可以是谁，或者谁都不是。它什么都不留：不留令牌、不留目录副本、不留自己的会话。应用密钥以凭据引用的方式点名，而不写进组合文件，于是 cordis.yml 永远不会携带那个能签入所有安装了该应用的组织的值。

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

与登录注册表、一个凭据存储并列，并为每位可以登录的成员写一条绑定：

```yaml
- id: dingtalk
  name: '@lyness/lyn-dingtalk'
  config:
    appKey: your-app-key
    secret: DINGTALK_APP_SECRET
- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: dingtalk
        issuer: your-corp-id
        subject: the-union-id
        person: ada
```

`secret` 点名一个凭据，而不是那个密钥本身：把 `DINGTALK_APP_SECRET` 设进部署的凭据存储。`issuer` 是令牌交换报告出的组织 `corpId`，`subject` 是那个人的 `unionId`——既经得住改名，也经得住再注册一个应用。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**用 unionId，不用 openId。** openId 是按应用隔离的，所以写在它上面的绑定，会在部署为同一个组织再注册一个应用的那一刻失配。unionId 在同一个开发者账号看得见的范围内都稳定。

**失败是以 HTTP 状态到达的。** 钉钉以非 2xx 响应表示拒绝，响应体里点出错误码；所以是状态码决定这次调用是否失败，响应体只决定该怎么说它。组织自己的码随错误一起上行。

**要么在某个组织的目录里，要么谁都不是。** 令牌交换没有报告 `corpId`，说明这是一个个人钉钉账号在登录。没有组织持有他们，所以没有任何绑定能点名他们；这次登录完成的是「谁都不是」——甚至不会再去问他们是谁。

**一次回调只花一次。** 在用掉 code 之前就把 attempt 删掉，于是被重放的回调链接找不到任何在等的东西。记录在途 attempt 的那本账是 `lyn-sign-in` 的，与其余每个重定向渠道共用。

**code 两个名字都读。** 钉钉的回调在它自己的几次修订里，分别用过 `authCode` 与 `code`；只读一个的渠道会干脆停止签入任何人。两个都读，`authCode` 优先。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-sign-in`](../../identity/sign-in/README.zh.md) —— 渠道能力缝与准入规则。
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.zh.md) —— 把浏览器送出去、以及接住回调的那些路由。
- [`lyn-wecom`](../wecom/README.zh.md) 与 [`lyn-microsoft-entra`](../microsoft-entra/README.zh.md) —— 另外两个重定向渠道，与本渠道共用同一本 attempt 账。
- [`lyn-credentials`](../../credentials/credentials/README.zh.md) —— 应用密钥放在哪里。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它在任何会话存在之前回答一次浏览器往返，而它读到的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **协议依钉钉公开接口写成，未对真实组织验证过** —— 端点、参数与回复字段由本包自己的测试钉住，所以一处偏差会表现为一次点出钉钉错误码的拒绝，而不是一个静默的错答案。主机名可配置，于是纠正它不需要改代码。
- **attempt 活在进程里** —— 未完成的登录记在内存，所以部署在两个 Host 实例之后时，必须把浏览器送回发起它的那一个。
- **一行只对一个应用** —— 渠道 id 是固定的，所以有两个钉钉应用的部署挂不了两份；要服务多个，需要让渠道 id 由配置派生。
- **没有客户端内流程** —— 在钉钉里打开部署的人，仍然会被送到登录页，而不是静默签入。
- **没有刷新** —— 交换会返回一个 refresh token，而本渠道既不留它也不留访问令牌，所以之后无法再读一次目录。

**运行时不变量：** 不发布伴生检查。它持有的唯一关系是在途 attempt 的集合，而它的单一观察者就是完成其中一个的那次回调。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`protocol.ts` 刻意不含 I/O：钉钉接口变化会破坏的正是请求形状与回复 schema，而它们不需要网络就能检查。新端点放那里，`index.ts` 只留往返。

</details>
