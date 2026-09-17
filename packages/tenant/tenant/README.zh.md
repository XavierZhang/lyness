---
description: "ctx.tenants 目录能力缝：部署服务哪些租户，以及请求据以解析的三种查法。"
kind: "package-reference"
---

# @lyness/lyn-tenant

[English](README.md) | 中文

## 概述

`ctx.tenants` 说明部署服务哪些租户，并回答请求可据以解析的三种查法：调用方声明的不可变 id、请求到达的主机名，以及子域名携带的标识。它是目录而不是策略：部署信任请求的哪一部分，由调用方决定。不挂载目录的部署即单租户；挂载了的部署会拒绝解析不到的请求，因为租户是隔离边界。

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

组合一个后端——[`lyn-tenant-static`](../tenant-static/README.zh.md) 从组合配置读取租户清单——然后通过 `ctx.tenants` 读取目录：

```ts
import type { Context } from '@lyness/cordis'
import { TenantError } from '@lyness/lyn-tenant'
import type { Tenant } from '@lyness/lyn-tenant'

export async function tenantOf(ctx: Context, hostname: string): Promise<Tenant> {
  const tenant = await ctx.tenants.byHost(hostname)
  if (tenant === undefined) throw new TenantError('unknown-tenant', `no tenant serves ${hostname}`)
  return tenant
}
```

### 租户是什么

| 字段 | 含义 |
|---|---|
| `id` | 不可变身份。持久记录与线上载荷携带这个值，因此改名或换域名后它依然有效。 |
| `slug` | 一个小写 DNS 标签：面向运营方的标识，也是请求可能到达的子域名。 |
| `displayName` | 该租户自己的用户看到的名称。 |

`TenantId(value)` 把字符串标记为 id，并拒绝任何在请求头、路径段或存储键中需要转义的值。`isTenantSlug(value)` 只接受一个小写 DNS 标签。

### 本能力缝不决定什么

每种查法对不认识的对象答复 `undefined`，因为解析任意请求时查不到是足够常见的普通结果。拒绝是调用方的措辞：它知道自己的传输欠调用者哪一种失败。同样，本能力缝不表态请求头是否可以指定租户——在设置该头的网关之后它是权威的，在网关之前它可被伪造——这项策略由调用方为自己的部署说明。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本包是抽象的 `TenantDirectory` 服务，加上各面共享的词汇。[`src/types.ts`](src/types.ts) 只有类型，因此 Client 面读到的正是 Host 发出的签名；[`src/brand.ts`](src/brand.ts) 承载 id 标记与两条语法，因为带校验的构造函数是运行时代码，类型模块不能携带。查法是异步的，因此数据库支撑的目录可以接进同一个能力缝而不改变任何调用方。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant-static](../tenant-static/README.zh.md)——从组合配置读取的后端。
- [tenant-http](../tenant-http/README.zh.md)——解析请求并应用部署策略的调用方。
- [能力缝](../../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.zh.md)——本包所在分组据以拆分的角色。

-----

<a id="model-experience"></a>
## 模型体验

无，因为该目录是 host 侧的路由身份；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **只有身份** —— 这里的租户只有 id、标识与显示名；按租户的配置、凭据与存储是分开的层，它们以 id 指向租户。
- **没有环境态的当前租户** —— 没有任何机制为请求的后续环节携带已解析的租户；每个调用方自行解析并显式传递。
- **一个上下文一个目录** —— 挂载第二个目录会抛错，因此要合并两份清单的部署需要一个自己做合并的后端。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。这个无状态的服务定义拥有租户词汇，而后端拥有清单、调用方拥有拒绝的形态。
