---
description: "企业微信作为登录渠道：企业签入此刻在浏览器前的那位成员。"
kind: "package-reference"
---

# @lyness/lyn-wecom

[English](README.md) | 中文

## 概述

`lyn-wecom` 把企业微信作为一个重定向登录渠道提供出来。它把浏览器送到企业自己的扫码页，在回来的路上读出企业报告的那位成员，并把这个身份交给部署的准入规则——由它决定这位成员可以是谁，或者谁都不是。它什么都不留：不留令牌、不留目录副本、不留自己的会话。应用密钥以凭据引用的方式点名，而不写进组合文件，于是 cordis.yml 永远不会携带那个能签入整个企业的值。

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
- id: wecom
  name: '@lyness/lyn-wecom'
  config:
    corpId: ww-your-corporation
    agentId: '1000002'
    secret: WECOM_APP_SECRET
- id: sign-in-admission
  name: '@lyness/lyn-sign-in/admission-roster'
  config:
    bindings:
      - channel: wecom
        issuer: ww-your-corporation
        subject: ada
        person: ada
```

`secret` 点名一个凭据，而不是那个密钥本身：把 `WECOM_APP_SECRET` 设进部署的凭据存储。`issuer` 是企业 ID，`subject` 是成员的 `userid`，因为这是改名不会改变的两个值。

读取成员的姓名与办公邮箱默认关闭。应用持有「私密信息」权限的部署用 `readDetail: true` 打开它，于此之后 subject 会带上界面可以展示的显示名与地址。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**走扫码页，不走客户端内那条。** 企业微信有两个授权端点：一个只能在企业微信客户端内完成，另一个浏览器可达。以 HTTP 对外服务的部署能服务的是后者，所以这个渠道把人送到那里。

**失败是以 HTTP 200 到达的。** 每个企业微信回复都带 `errcode`，而一次拒绝就是一个带非零码的成功 HTTP 响应。于是每个回复先校验再检查，企业自己的码随错误一起上行，让部署可以据此处置。

**要么是企业的成员，要么谁都不是。** 只带 `openid` 的回复，是一个通过微信认证、但不在这个企业目录里的人。他们没有企业内的身份，所以没有任何绑定能点名他们；这次登录完成的是「谁都不是」，而不是发明一个 subject。

**一次回调只花一次。** 在用掉 code 之前就把 attempt 删掉，于是被重放的回调链接找不到任何在等的东西。attempt 的 state 同时就是它的 id：企业只回传一个不透明值，第二个 id 就必须被携带在某个可能与它分离的地方。

**令牌每次登录现取。** 应用令牌有数小时有效期，缓存它就是在开始做一个凭据存储；而登录足够稀少，多一次请求不值得为它留下状态。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-sign-in`](../../identity/sign-in/README.zh.md) —— 渠道能力缝与准入规则。
- [`lyn-sign-in-http`](../../identity/sign-in-http/README.zh.md) —— 把浏览器送出去、以及接住回调的那些路由。
- [`lyn-microsoft-entra`](../microsoft-entra/README.zh.md) —— 另一个重定向渠道，本渠道沿用它的流程。
- [`lyn-credentials`](../../credentials/credentials/README.zh.md) —— 应用密钥放在哪里。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它在任何会话存在之前回答一次浏览器往返，而它读到的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **协议依企业微信公开接口写成，未对真实企业验证过** —— 端点、参数与回复字段由本包自己的测试钉住，所以一处偏差会表现为一次点出企业错误码的拒绝，而不是一个静默的错答案。主机名可配置，于是纠正它不需要改代码。
- **attempt 活在进程里** —— 未完成的登录记在内存，所以部署在两个 Host 实例之后时，必须把浏览器送回发起它的那一个。
- **一行只对一个企业** —— 渠道 id 是固定的，所以服务两个企业的部署挂不了两份；要服务多个，需要让渠道 id 由配置派生。
- **没有客户端内流程** —— 在企业微信客户端里打开部署的人，仍然会被送到扫码页，而不是静默签入。
- **没有刷新** —— 渠道不保留成员令牌，所以没有东西可刷新，也无法在之后再读一次目录。

**运行时不变量：** 不发布伴生检查。它持有的唯一关系是在途 attempt 的集合，而它的单一观察者就是完成其中一个的那次回调。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`protocol.ts` 刻意不含 I/O：企业接口变化会破坏的正是请求形状与回复 schema，而它们不需要网络就能检查。新端点放那里，`index.ts` 只留往返。

</details>
