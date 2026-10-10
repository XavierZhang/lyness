---
description: "经浏览器完成的 Microsoft Entra ID 登录，面向接入目录的部署与接线身份面的维护者。"
kind: "package-reference"
---

# @lyness/lyn-microsoft-entra

[English](README.md) | 中文

## 概述

`lyn-microsoft-entra` 让人通过自己所在的 Microsoft Entra 目录登录，并为其持有经过验证的主体。它注册一个授权流程：人在浏览器里打开目录的页面，返回到一个 loopback 回调，而兑换到的访问令牌被用一次，去问 Microsoft Graph 是谁登录了。主体来自那次**已认证的调用**而不是 id token 的声明，所以本包不验证任何令牌签名、也不持有任何密钥材料。配置目录与应用 id；两者都没配的部署无法挂载它。

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

当人应当用自己的工作账号登录时挂载它。它需要 `ctx.authorization` 承载这次尝试、`ctx.credentials` 存放授权、`ctx.webServer` 承载 loopback 回调。

```yaml
- id: microsoft-entra
  name: '@lyness/lyn-microsoft-entra'
  config:
    directory: contoso.onmicrosoft.com
    clientId: 00000000-0000-0000-0000-000000000000
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `directory` | 必填 | 租户 id、已验证域名，或 Entra 的受众（`organizations`、`common`、`consumers`） |
| `clientId` | 必填 | Entra 应用注册的应用（客户端）id |
| `authorityHost` | `login.microsoftonline.com` | 授权主机；主权云各有其值 |
| `graphOrigin` | `https://graph.microsoft.com` | Graph 源；主权云各有其值 |
| `scopes` | `openid profile User.Read offline_access` | 请求的 scope；`User.Read` 必需 |
| `redirectPath` | `/oauth/callback/microsoft-entra` | 浏览器返回的 loopback 路径 |
| `attemptTimeoutMs` | `300000` | 一次浏览器往返的上界 |
| `requestTimeoutMs` | `20000` | 一次 token 或 Graph 请求的上界 |

### 注册应用

Entra 应用注册必须是公共客户端，并带 loopback 重定向 URI `http://127.0.0.1:<端口>/oauth/callback/microsoft-entra`。端口就是该部署 web 服务器监听的端口，所以注册里应当写一个固定端口。

### 读取已登录的人

`ctx.microsoftEntra.subject()` 回答已存的主体，无人登录时回答 `undefined`。`objectId` 配上 `directoryId` 才是应当绑定的身份：显示名与地址都会变，对象 id 不会。

-----

<a id="understand-the-implementation"></a>
## 理解实现

一次尝试生成一个 PKCE verifier、它的 S256 challenge、一个 `state` 与一个 `nonce`。授权请求带上 challenge、state 与 `response_mode=query`——因为 fragment 永远到不了服务器。verifier 只发往 token 端点、不发往别处，正是这一点证明"是本进程发起了目录所记录下那个 challenge 的那次尝试"。

回调只接受恰好一个 `state` 与一个 `code`，以常量时间比较 state，对其他任何请求答 `400` 且不说明原因。无论是哪一侧结束这次尝试——回调、超时，或撤回——都经由同一条路径释放路由与定时器。

### 为什么不验证令牌签名

主体是经 TLS 从一次已认证的 Graph `/me` 调用读到的，所以决定它说什么的是目录而不是客户端。这里没有任何东西解析或信任 id token，这正是本包不依赖任何 JWT 或 JWKS 代码的原因。将来若有消费方必须接受别处签发的 id token——例如一个收到自己并未兑换过的令牌的渠道面——那就需要那套验证；而直接兑换授权码不需要。

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、授权流程与 loopback 回调 |
| [`src/protocol.ts`](src/protocol.ts) | 请求形状与可接受的答复，纯函数 |
| [`src/types.ts`](src/types.ts) | 已认证的主体及其带品牌的身份 |

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-authorization`](../../credentials/authorization/README.zh.md) —— 本包注册进去的那个流程接缝。
- [`lyn-credentials`](../../credentials/credentials/README.zh.md) —— 授权存放之处。
- [厂商集成](../../../docs/subsystems/vendor-integrations.zh.md) —— 身份面与渠道面，以及它们共享什么。

-----

<a id="model-experience"></a>
## 模型体验

None, as directory sign-in never enters model prompts, Session logs, or tool results; a consumer that puts the subject in a request owns that exposure and its logging.

#### KV Cache effect

模型请求前缀不发生变化。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明本包在什么情况下不合适或需要特别当心。它们是当前的包约束，不是任务清单。

- **尚无刷新** —— 目录授予刷新令牌时会存下来，但没有任何东西去兑换它。访问令牌过期就意味着重新登录一次。
- **没有渠道面** —— Teams 不在这里。它到来时将共享本包的应用注册，而不是再注册一份凭据。
- **除已登录的人之外不读目录** —— 没有组与成员关系的查询，所以这里没有任何东西能独自填充成员身份绑定。
- **一个部署一位已登录的人** —— 授权是一条凭据记录，所以本包无法同时持有两个人。
- **loopback 端口必须与注册一致** —— 跑在临时端口上的部署无法完成登录，因为重定向 URI 不会是注册过的那一个。

**Runtime invariant:** No companion is published. 授权是本包经授权接缝写入的一条凭据记录，而该接缝自己确认这次提交，因此对这次登录的两次独立观察不可能分歧。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
