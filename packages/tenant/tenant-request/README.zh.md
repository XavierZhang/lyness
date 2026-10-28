---
description: "一次 RPC 调用所属的租户：调用到达时解析一次，调用途经的一切都能无参读取。"
kind: "package-reference"
---

# @lyness/lyn-tenant-request

[English](README.md) | 中文

## 概述

本插件在 Connection 上注册一个每请求作用域，按请求头 → 主机名 → 子域名（与 HTTP 路由同一顺序）解析出这次调用所属的租户，并在调用期间以 `ctx.requestTenant` 发布它。租户的配置在同一步一并解析，因此像会话创建监听器这样的同步消费方无需等待存储即可读取。命名不到租户的调用照常进行；拒绝属于需要租户的那一端。

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

挂在 Connection 与租户目录之后、任何读取调用方租户的插件之前：

```yaml
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
- id: tenant-request
  name: '@lyness/lyn-tenant-request'
  config:
    baseDomain: example.com
```

`baseDomain` 是让 `acme.example.com` 指向 `acme` 租户的那一项；不配它，就只有 `x-tenant-id` 请求头与租户自己配置的主机名能解析出租户。

在服务这次调用的地方读取：

```ts
import { RemoteError } from '@lyness/lyn-typert-protocol'
import type { Context } from '@lyness/cordis'
import type { RequestTenant } from '@lyness/lyn-tenant-request/types'

/**
 * The tenant this call is allowed to act for.
 * @param ctx - context of the call being served.
 * @returns the resolved tenant.
 * @throws {RemoteError} when the call named no tenant.
 */
export function callingTenant(ctx: Context): RequestTenant {
  const current = ctx.requestTenant.current()
  if (current === undefined) {
    throw new RemoteError('gateway/bad-request', 'this request names no tenant', {})
  }
  return current
}
```

在调用之外读取会得到 `undefined`——加载时、定时器里、本进程恢复的会话里都是如此。这是诚实的答案，而不是上一次调用的租户：需要租户的消费方会因此拒绝，而不是替最后一个调用方行事。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

该作用域是一个 `node:async_hooks` 的 `AsyncLocalStorage` 存储，围绕通道持有方的分发进入，因此调用中的每一次 `await` 仍能看到它。解析复用 [tenant-http](../tenant-http/README.zh.md) 的 `resolveTenant`，这正是 RPC 路径与 HTTP 路由不会走偏的原因。Fetch 的 `Headers` 会把重复的同名头合并成一个逗号分隔的值，解析器随后将其读作格式不合法的 id 并拒绝——这正是租户边界想要的答案。

`ctx.requestTenant` 的类型是 `./types` 中声明的只读接口，该模块不导入任何 Connection 模块：消费方只需按读取面编译，无需连带承担作用域所注册的那套 web 传输。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——解析所依据的目录。
- [tenant-http](../tenant-http/README.zh.md)——解析顺序，以及据此答复的不鉴权路由。
- [tenant-session](../tenant-session/README.zh.md)——用调用方租户给新建会话打戳的消费方。
- [api-gateway](../../api/gateway/README.zh.md)——本作用域所包裹的 Remote 分发。

-----

<a id="model-experience"></a>
## 模型体验

间接影响，经由读取调用方租户的消费方，例如记录该租户身份文本的会话戳记。

#### KV Cache 影响

没有直接失效；上述消费方拥有对请求前缀的任何改动。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **只覆盖一元调用** —— 作用域包裹的是已解码的 RPC 调用。Remote 流与 `/api` 下的精确 Fetch 路由走另外的分发路径，看不到租户。
- **只到租户，不到人** —— 一次调用解析出的是组织，不是组织里的某个人。谁调用的、他能做什么，要等有用户记录之后。
- **`x-tenant-id` 是被信任的** —— 把 `/api` 暴露给不受控调用方的部署，必须在自己的边缘终结这个请求头，与 HTTP 路由的要求完全一致。
- **每次调用读一次配置** —— 两个已发布的后端都从内存作答；读取较慢的后端会在每次调用上付这份代价，无论该调用是否需要配置。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

它注册的钩子是 `ctx.connection.rpc.scope`，正是为此在 Connection 上新增的（[决策](../../../.agents/notes/implemented/architecture/2026-09-21-the-tenant-of-a-request.zh.md)）。

</details>

**运行时不变式：** 不发布伴生入口。该存储是调用方租户的唯一观察点，且由读取它的同一段代码在每次调用中写入一次，因此不存在可能与之背离的第二处观察。
