---
description: "把 OpenID 提供方作为登录渠道：说的是标准协议，所以部署把它指向自己的目录即可。"
kind: "package-reference"
---

# @deepseek-ai/dsh-oidc

[English](README.md) | 中文

## 概述

`dsh-oidc` 把任何 OpenID 提供方作为重定向登录渠道提供出来。它是服务于企业通讯软件之外的人的那个渠道：三个厂商渠道各说一种目录的协议，这一个说标准协议，所以部署把它指向自己运行的提供方，就得到邮箱自助注册、邮箱验证、密码重置与多因素——这些本来就是那类软件的职责。这里一个流程都不实现：渠道的全部职责是把一个已验证主体交给部署的放行规则。它什么都不持有：不存令牌、不复制目录、不建自己的会话。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

与登录注册表、凭据存储并列，并为每个可以登录的人写一条绑定：

```yaml
- name: '@deepseek-ai/dsh-sign-in'
- name: '@deepseek-ai/dsh-oidc'
  config:
    issuer: https://idp.example
    clientId: deepseek-harness-web
    secret: OIDC_CLIENT_SECRET
- name: '@deepseek-ai/dsh-sign-in/admission-roster'
  config:
    bindings:
      - channel: oidc
        issuer: https://idp.example
        subject: 2f1c9a7e-0b64-4a2f-9c3d-7e5b1a84d6f0
        person: ada
```

`issuer` 是提供方自己的标识符，也是本包需要的唯一地址：每个端点都来自它下面发布的 discovery 文档。`secret` 点名一个凭据，而不是携带它。绑定里的 `subject` 是提供方的 `sub` claim，那是提供方承诺不会复用的那一个值——写成地址的绑定会在改名之后放错人进来。

服务多个组织的部署点名自己提供方承载组织的那个 claim，渠道实例也可以限定到其中一个：

```yaml
- name: '@deepseek-ai/dsh-oidc'
  config:
    issuer: https://idp.example
    clientId: deepseek-harness-web
    secret: OIDC_CLIENT_SECRET
    organizationClaim: organization.id
    organization: acme
    organizationParameter: organization_id
```

`organizationClaim` 是一次登录的组织从哪里读出来，用 `.` 分隔一层。`organization` 把这个实例限定到其中一个组织，于是服务别的租户的登录页不会提供它。`organizationParameter` 是向提供方索要某一个组织自己的登录页的那个授权参数（在它提供这种页面时）。

`@deepseek-ai/dsh-oidc/kind` 把同一个渠道作为可配置 kind 提供，于是管理员在运行时通过登录渠道设置页添加一个提供方。只挂载 kind 本身不配置任何东西。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**端点来自 discovery，绝不来自配置。** 授权、令牌与 userinfo 三个地址都从提供方自己的 `.well-known/openid-configuration` 读出，而且只有当文档自称的 issuer 正是被询问的那一个时才采信。自己写端点的部署可能把令牌交换指向一台主机、把授权指向另一台——那正是窃取授权码的形状。

**claim 来自 userinfo 端点，不来自 ID token。** 读 ID token 意味着用提供方的密钥验签，那是一套本包没有理由承载的 JOSE 实现。userinfo 用交换得到的 access token 经 TLS 读取，所以答案就是提供方自己的答案，没有签名需要校验。`sub` 是唯一必需的 claim。

**没有 TLS 的提供方在配置阶段就被拒绝。** 授权码与 access token 都要穿过那条连接。回环地址例外，因为开发时提供方就跑在那里。

**PKCE 的 verifier 放在 attempt 里，而不是放在渠道上。** 每次登录生成新的 verifier，与它自己的 attempt、以及授权请求点名的回调地址一起记录；交换时两者都原样重复。这也是本渠道直接实现渠道契约、而不继承 `StatefulRedirectChannel` 的原因——那个基类的 attempt book 模型是「无需记住任何东西的 attempt」，而把 verifier 放在实例上会让两个在途登录互相覆盖。

**attempt 先于授权码被花掉**，所以被重放的回调链接找不到任何在等的东西。

**discovery 在挂载时读取并复用。** 于是写错的 issuer 是一条启动诊断、而不是一次被拒的登录；而仅仅是宕机的提供方会在第一次登录时重试，不会让渠道永久损坏。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-sign-in`](../sign-in/README.zh.md) —— 渠道接缝与放行规则。
- [`dsh-sign-in-http`](../sign-in-http/README.zh.md) —— 把浏览器送出去、接住回调的那些路由。
- [`dsh-dingtalk`](../../vendor/dingtalk/README.md) 与 [`dsh-wecom`](../../vendor/wecom/README.md) —— 厂商渠道，与本渠道共用同一套 attempt book（这两份文档只有英文）。
- [`dsh-credentials`](../../credentials/credentials/README.zh.md) —— client secret 存放的地方。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具或提示词：它在任何会话存在之前应答一次浏览器往返，它读到的东西都不会进入模型请求。

#### KV 缓存影响

请求前缀没有变化，因为这里没有任何东西参与组装请求。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- **不读 ID token，所以只有 ID token 承载的 claim 都拿不到** —— `amr`、`acr` 与认证时刻都在这个本包不验签的令牌里。需要它们的部署得先有验签。
- **attempt 活在进程里** —— 未完成的登录记在内存，所以部署在两个 Host 实例后面时必须把浏览器送回发起它的那一个。
- **一行只对应一个提供方** —— 渠道 id 是固定的，所以有两个提供方的部署改为挂载 kind 并配置实例。
- **不做刷新** —— 交换返回的 refresh token 不被保留，所以之后没有办法再读目录。
- **没有后端登出通道** —— 本渠道建立的会话在提供方登出之后仍然存活，直到它自己的有效期到。

**运行时不变量：** 不发布任何伴生对象。它持有的唯一关系是在途 attempt 的集合，其唯一观察者是完成其中一个的那次回调。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

`protocol.ts` 刻意不做 I/O：请求形状与应答 schema 正是提供方发生偏离时会被打破的东西，而它们不需要网络就能检查。新端点放那里，`index.ts` 只留往返流程。

唯一没有测试的防御性守卫是 `documentOrThrow` 的抛出：`start` 在读它之前先 prepare，而 `complete` 只会为 `start` 开过的 attempt 走到那里，所以那时文档一定已持有。它保留着，因为那个字段的类型允许缺席。

</details>
