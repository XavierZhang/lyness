---
description: "租户配置界面的 Remote 持有方：调用方租户读取并保存自己的模型、供应商、功能、身份与文案。"
kind: "package-reference"
---

# @lyness/lyn-api-tenant-controller

[English](README.md) | 中文

## 概述

本控制器注册 `tenant` Remote 命名空间：`describe` 答复调用方租户自己的配置，外加本部署是否接受保存；`save` 整份替换它。两者都代表这次调用所属的租户行事，并拒绝没有命名租户的调用——租户永远不是方法参数，因为能指名自己租户的调用方也就能指名任何租户。一次保存会被校验两遍：先是 wire 字段，再是能力缝自己的规则，因此表单一次就能拿到全部问题。

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

它不接受配置；它需要每请求作用域才能知道是谁在调用：

```yaml
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
- id: tenant-config
  name: '@lyness/lyn-tenant-config-store'
- id: tenant-request
  name: '@lyness/lyn-tenant-request'
- id: tenant-controller
  name: '@lyness/lyn-api-tenant-controller'
```

浏览器像调用任何命名空间一样调用 `ctx.remote.tenant.describe()` 与 `ctx.remote.tenant.save(input)`，并按本包声明的视图读取答复：

```ts
import type { TenantConfigView } from '@lyness/lyn-api-tenant-controller/types'

/**
 * Whether a settings page may offer saving for this answer.
 * @param view - what `tenant/describe` answered.
 * @returns true when this deployment stores the configuration itself.
 */
export function mayOfferSaving(view: TenantConfigView): boolean {
  return view.writable
}
```

`writable` 是页面在渲染保存按钮前要读的那个字段；只读部署把配置放在补丁层里，在那里保存意味着改文件加重启。`configured` 用来区分「什么都没保存过的租户」与「把一切都保存为空的租户」——两者都什么也不能用，但只有前者从未被设置过。

### 它会拒绝什么

| 错误码 | 何时 |
|---|---|
| `tenant/unresolved` | 调用没有命名租户：请求头、主机名、子域名都解析不出 |
| `gateway/bad-request` | wire 字段不合法——空 id、不是引用的凭据、缺失的模态 |
| `gateway/internal` | 本部署根本没有挂载租户配置存储 |
| `tenant/read-only` | 已挂载的存储不接受保存 |
| `tenant/rejected` | 能力缝的规则拒绝该配置；`problems` 列出全部问题 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

视图是逐字段投影出来的，而不是直接透传，原因有二：授权中的凭据在 Host 侧是带标记的引用、在 wire 上是普通字符串；而读取还要补上能力缝本身不携带的事实——调用方是谁，以及后端是否接受保存。缺席的可选字段被丢弃，而不是序列化成 `undefined`。

一次保存先用 zod 解析 wire 字段，再用请求里的租户 id 构造能力缝的配置，然后运行能力缝自己的 `validateTenantConfig`，让调用方拿到完整问题清单，最后才去问后端。答复是从存储回读的，而不是拿输入回声——存储才是「自己留下了什么」的权威。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant-config](../../tenant/tenant-config/README.zh.md)——本命名空间投影的能力缝，以及保存时据以校验的规则。
- [tenant-request](../../tenant/tenant-request/README.zh.md)——调用方租户如何到达本命名空间。
- [tenant-config-store](../../tenant/tenant-config-store/README.zh.md)——保存最终落到的可写后端。
- [api-gateway](../gateway/README.zh.md)——Remote 分发与错误词汇。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本命名空间服务的是管理界面；它不注册任何提示词、工具或会话事件。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **没有成员级授权** —— 目前唯一被强制的规则是：调用方只能配置自己的组织。把保存限制给管理员需要用户记录，而本部署还没有。
- **整份配置保存** —— 改一个字段的页面要读出、修改、整份保存；没有字段级写入。
- **不写凭据** —— 保存里只有凭据引用；保存引用背后的密钥属于凭据库自己的界面。
- **未进任何已发布 profile** —— 本命名空间属于组合层，因为它只有在同时挂载了目录与配置存储的部署里才可达。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。每一次答复都由对配置存储的一次读取投影而来，而存储是自己记录的权威，因此不存在可能与之背离的第二处观察。
