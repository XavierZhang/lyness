---
description: "签入面向浏览器的那一半，面向提供签入页的部署方与接 cookie 的维护者。"
kind: "package-reference"
---

# @lyness/lyn-sign-in-http

[English](README.md) | 中文

## 概述

`lyn-sign-in-http` 就是一次浏览器签入所需的四条路由：供页面渲染按钮的渠道列表、把浏览器送往目录的发起、目录返回时的回调，以及签出。它设置 `lyn-request-principal` 读回的那个会话 cookie，并把一次签入绑定到一个浏览器上，于是一条被转手给别人的回调链接无法让那个人以发起者的身份签入。`lyn-sign-in` 刻意止步于会话身份；目录返回到哪里、cookie 带什么属性、以及一次拒绝在人眼里是什么样，都是「被通过 HTTP 提供」这件事的属性。

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
- id: sign-in-http
  name: '@lyness/lyn-sign-in-http'
  config:
    publicOrigin: 'https://lyness.example'
    secureCookies: true
    landingPath: '/'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `publicOrigin` | 必填 | 浏览器访问这个部署所用的 origin，不带末尾斜杠 |
| `secureCookies` | 必填 | 那个 origin 是否通过 TLS 提供，它决定 cookie 的 `Secure` |
| `landingPath` | `/` | 一次完成的签入把浏览器送到哪里 |

两个必填项都是部署事实，而且没有安全的默认值。宿主无法推断 origin——在代理后面，请求自己的 `Host` 是代理的——而目录返回到的地址必须正是它应用注册里那一个。`secureCookies: true` 会无声地弄坏一个纯 HTTP 的开发安装，`false` 又会无声地让会话 cookie 明文上路，所以由部署方说明它是哪一种。

### 这些路由

| 路由 | 方法 | 回答 |
|---|---|---|
| `/auth/channels` | GET | `{ channels: [{ id, displayName, kind }] }` |
| `/auth/sign-in/<channel>` | GET | 302 到目录，并设置尝试 cookie |
| `/auth/callback/<channel>` | GET | 302 到落地路径，并设置会话 cookie |
| `/auth/sign-out` | POST | 204，并清除会话 cookie |

一次拒绝回答 JSON `{ error: <code> }`：未知渠道 404，被这个部署准入为「无人」的人 403，其余 400。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**一次签入被绑定到一个浏览器。** 发起时设置一个短效的尝试 cookie 来持有那个 state，回调只在它所携带的 state 正是这个浏览器持有的那一个时才完成。没有这一条，回调就会接受这个进程签发过的任何 state——包括攻击者通过发起自己的签入拿到、然后把链接转手出去的那一个，而那会让接手的人以攻击者的身份签入。

**绑定校验排在渠道查找之前。** 于是一个没有发起过签入的请求，无法得知这个部署提供了哪些目录。

**会话 cookie 的寿命就是那个会话自己的寿命。** 它是从已建立的会话里读回来的，而不是另算一遍，于是浏览器绝不会持有一个服务端已经让其失效的凭据。

**签出只接受 POST。** `SameSite=Lax` 会在跨站 POST 上扣下那个 cookie，所以别人贴出的链接无法把这个人签出。也正是同一个 `Lax` 解释了为什么它不是 `Strict`：回调是目录把浏览器送上的一次顶层导航，而 `Strict` 偏偏会在最需要的时候扣下尝试 cookie。

**自驱渠道在这里被拒绝。** 它在掌管浏览器的那个进程里完成，所以托管部署无处可送这个人；路由直说这一点，而不是看起来发起了什么。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-sign-in`](../sign-in/README.zh.md) —— 这些路由所驱动的那个流程。
- [`lyn-request-principal`](../request-principal/README.zh.md) —— 在其后每一次调用上把会话 cookie 读回来的那一层。
- [`lyn-auth-session`](../auth-session/README.zh.md) —— 签出所吊销的那些会话。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它提供的是 HTTP 路由。

#### KV Cache effect

没有任何请求前缀发生变化，因为这里没有任何东西到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **没有签入页** —— 这里是路由，不是界面。部署方从 `/auth/channels` 渲染自己的按钮。
- **拒绝是 JSON，不是页面** —— 一个被送往目录、回来时被拒的浏览器看到的是原始 JSON，而不是一个人能据以行动的东西。
- **一次签入只对应一个宿主实例** —— 尝试 cookie 指向的是某个渠道记在内存里的 state，所以一个跑在两个实例后面的部署必须把浏览器送回发起它的那一个。
- **没有「全部签出」** —— 结束一个浏览器的会话，不影响那个人其他仍在运行的会话。

**Runtime invariant:** 不发布任何 companion。这里的每个关系都只有一次观察：响应设置的那个 cookie，以及存储持有的那个会话。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

`setCookie` 会对值做转义，所以一个被精心构造的会话身份无法追加 `Domain=` 之类的属性。有一个测试把这一点钉住，而 `readCookie` 在读回时解码。

由 Loader 挂载的 Service 类都声明 `static Config`：Loader 会把一个包解包成它的默认导出，所以只在模块级导出的 schema 并不是一行配置被校验时所用的那个。

</details>
