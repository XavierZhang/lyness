---
description: "持久化的租户配置：每个租户在存储域中占一条记录，通过能力缝的可写能力保存。"
kind: "package-reference"
---

# @lyness/lyn-tenant-config-store

[English](README.md) | 中文

## 概述

本后端在存储域之上注册 `ctx.tenantConfig`：每个租户的模型、供应商、功能、身份与文案是一条记录，从内存读取、持久化写入。它报告 `writable` 能力，因此管理界面通过它保存，保存的内容也能跨重启存活。保存前会按能力缝自己的规则校验，不合规的配置在写入前就被拒绝。

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
- id: storage
  name: '@lyness/lyn-storage'
- id: storage-medium
  name: '@lyness/lyn-storage-sqlite'
  config:
    path: /var/lib/lyn/data.db
- id: storage-domain
  name: '@lyness/lyn-storage-domain'
  config:
    backend: sqlite
- id: tenant-config
  name: '@lyness/lyn-tenant-config-store'
```

它不接受配置：记录本身就是配置。请用它替代 `@lyness/lyn-tenant-config-static`，而不是与之并存——能力缝在一个 context 中只容纳一个存储，挂载第二个会抛错。

保存是一项能力而非方法，因此对两种后端都适用的消费方要先询问：

```ts
import type { TenantConfig, TenantConfigStore } from '@lyness/lyn-tenant-config'

/**
 * Save when the mounted backend accepts saves.
 * @param store - the mounted `ctx.tenantConfig`.
 * @param config - the tenant's complete configuration.
 * @returns whether the backend accepted it.
 */
export async function saveIfWritable(store: TenantConfigStore, config: TenantConfig): Promise<boolean> {
  const capability = store.capability()
  if (capability.kind !== 'writable') return false
  await capability.save(config)
  return true
}
```

一次保存替换该租户的整份配置，不做部分合并。配置违反规则时抛错——模型的供应商未获授权、默认模型不在可用清单内、模型／供应商／功能重复，或 id、约束、文案覆盖为空——错误信息一次列出全部问题，便于表单一并反馈，而不是每次只暴露一个。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

存储域名为 `tenant_config`，版本 1，布局 `per-record`：保存一个租户只重写该租户的记录，不触碰其他租户。`[Service.init]` 打开存储域，把关闭登记为 effect，并在服务的生命周期内持有该表，因此一次读取就是同步的内存访问，外面包一层已完成的 promise。

记录在读取时由存储域自己的 schema 校验。授权中的 `credential` 以引用名存储、读取时重新加标记，因此被手工改成非引用值的记录会在读取时失败，而不会当作密钥送到供应商。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant-config](../tenant-config/README.zh.md)——本后端注册的能力缝，以及保存时据以校验的规则。
- [tenant-config-static](../tenant-config-static/README.zh.md)——部署在补丁层中配置的只读后端。
- [storage-domain](../../storage/storage-domain/README.zh.md)——存储域如何声明、如何版本化、如何落地。

-----

<a id="model-experience"></a>
## 模型体验

无，因为这些记录是 host 侧配置；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **整条记录保存** —— 管理界面改一个字段时，要读出配置、修改后整份保存；本存储不提供字段级更新。
- **不写凭据** —— 记录只指明引用；创建并保存租户的密钥属于凭据库自己的界面。
- **不通知变更** —— 已读过配置的消费方不会在保存替换它时收到通知，需要再读一次才能看到新值。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。表是租户配置的唯一观察点——读取与保存走同一个句柄——因此不存在可能与之背离的第二处观察。
