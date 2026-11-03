---
description: "飞书作为登录渠道：租户签入此刻在浏览器前的那个人。"
kind: "package-reference"
---

# @deepseek-ai/dsh-feishu

[English](README.md) | 中文

## 概述

`dsh-feishu` 把飞书作为一个重定向登录渠道提供出来。它把浏览器送到飞书自己的登录页，用应用自己的令牌买到那个人的令牌，读出这个令牌属于谁，并把这个身份交给部署的准入规则——由它决定这个人可以是谁，或者谁都不是。它什么都不留：不留令牌、不留目录副本、不留自己的会话。应用密钥以凭据引用的方式点名，而不写进组合文件，于是 cordis.yml 永远不会携带那个能签入所有安装了该应用的租户的值。

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
- id: feishu
  name: '@deepseek-ai/dsh-feishu'
  config:
    appId: your-app-id
    secret: FEISHU_APP_SECRET
- id: sign-in-admission
  name: '@deepseek-ai/dsh-sign-in/admission-roster'
  config:
    bindings:
      - channel: feishu
        issuer: your-tenant-key
        subject: the-union-id
        person: ada
```

`secret` 点名一个凭据，而不是那个密钥本身：把 `FEISHU_APP_SECRET` 设进部署的凭据存储。`issuer` 是目录报告出的租户 `tenant_key`，`subject` 是那个人的 `union_id`——既经得住改名，也经得住再注册一个应用。

面向国际的部署把 `apiOrigin` 指向 Lark 自己的 origin，它以另一个名字提供同一套接口。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**两段，因为这次交换是应用的。** 飞书用应用、而不是只用 code 来授权这次交换：应用的令牌买到那个人的令牌，那个人的令牌读出那个人。一次登录三个请求，而其中没有一个留下任何东西。

**用 union_id，不用 open_id。** open_id 是按应用隔离的，所以写在它上面的绑定，会在部署为同一个租户再注册一个应用的那一刻失配。union_id 在同一个应用看得见的范围内都稳定。

**失败是以 HTTP 200 到达的。** 飞书把拒绝报在响应体的 `code` 里，所以每个回复先校验再检查，租户自己的码随错误一起上行。有负载的那两个端点把它嵌在 `data` 下，所以每个回复按那个端点实际发送的形状来读，而不是按一个通用信封。

**要么在某个租户里，要么谁都不是。** 目录报告出的人没有 `tenant_key`，说明这是一个个人飞书账号在登录。没有租户持有他们，所以没有任何绑定能点名他们；这次登录完成的是「谁都不是」。

**一次回调只花一次。** 在用掉 code 之前就把 attempt 删掉，于是被重放的回调链接找不到任何在等的东西。记录在途 attempt 的那本账是 `dsh-sign-in` 的，与其余每个重定向渠道共用。

**租户发的地址优先。** 飞书同时公开个人地址与租户签发的地址；部署展示一个人的地址时指的是工作地址，所以优先 `enterprise_email`，个人地址作为兜底。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-sign-in`](../../identity/sign-in/README.zh.md) —— 渠道能力缝与准入规则。
- [`dsh-sign-in-http`](../../identity/sign-in-http/README.zh.md) —— 把浏览器送出去、以及接住回调的那些路由。
- [`dsh-wecom`](../wecom/README.zh.md) 与 [`dsh-dingtalk`](../dingtalk/README.zh.md) —— 另外两个中国目录渠道，与本渠道共用同一个基类。
- [`dsh-microsoft-entra`](../microsoft-entra/README.zh.md) —— 第一个重定向渠道，与本渠道共用那本 attempt 账。
- [`dsh-credentials`](../../credentials/credentials/README.zh.md) —— 应用密钥放在哪里。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为本包不注册任何工具或提示词：它在任何会话存在之前回答一次浏览器往返，而它读到的东西都到不了模型请求。

#### KV 缓存影响

请求前缀不变，因为这里没有任何东西进入被组装的请求。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **协议依飞书公开接口写成，未对真实租户验证过** —— 端点、参数与回复字段由本包自己的测试钉住，所以一处偏差会表现为一次点出飞书错误码的拒绝，而不是一个静默的错答案。origin 可配置，于是纠正它不需要改代码。
- **attempt 活在进程里** —— 未完成的登录记在内存，所以部署在两个 Host 实例之后时，必须把浏览器送回发起它的那一个。
- **一行只对一个应用** —— 渠道 id 是固定的，所以有两个飞书应用的部署挂不了两份；要服务多个，需要让渠道 id 由配置派生。
- **没有客户端内流程** —— 在飞书里打开部署的人，仍然会被送到登录页，而不是静默签入。
- **应用令牌每次登录现取** —— 它有两小时有效期，缓存它就是在开始做一个凭据存储；而登录足够稀少，多一次请求不值得为它留下状态。
- **只支持企业自建应用形式** —— 商店应用用一张本渠道从不接收的租户 ticket 来登录。

**运行时不变量：** 不发布伴生检查。它持有的唯一关系是在途 attempt 的集合，而它的单一观察者就是完成其中一个的那次回调。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`protocol.ts` 刻意不含 I/O：飞书接口变化会破坏的正是请求形状与回复 schema，而它们不需要网络就能检查。新端点放那里，`index.ts` 只留往返。

</details>
