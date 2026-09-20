---
description: "ctx.tenantConfig 能力缝：一个租户为自己配置的模型、供应商、功能、身份与文案。"
kind: "package-reference"
---

# @lyness/lyn-tenant-config

[English](README.md) | 中文

## 概述

`ctx.tenantConfig` 读取一个租户为自己配置的内容：各模态下可用的模型、通过哪些供应商使用它们、可用的功能、它为自己的模型请求贡献的身份文本，以及它覆盖的界面文案。密钥从不出现在这里——供应商授权携带的是凭据引用，由凭据库解析。后端会说明自己能否被写入，这样管理界面据此显示或隐藏保存，而不是靠失败去发现。

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

组合一个后端——[`lyn-tenant-config-static`](../tenant-config-static/README.zh.md) 从组合配置读取行——然后通过 `ctx.tenantConfig` 读取：

```ts
import type { Context } from '@lyness/cordis'
import type { ModelChoice } from '@lyness/lyn-tenant-config'
import type { TenantId } from '@lyness/lyn-tenant'

export async function imageModelsOf(ctx: Context, tenantId: TenantId): Promise<readonly ModelChoice[]> {
  const config = await ctx.tenantConfig.get(tenantId)
  return config?.models.image.available ?? []
}
```

没有配置的租户读作 `undefined`，空清单表示该租户不能使用这一类。两者都不是回退：没有配置图片模型的租户就是没有图片模型，而不是借用部署方的。

### 租户配置什么

| 字段 | 含义 |
|---|---|
| `models` | 按模态——`language`、`image`、`video`、`music`——列出可用模型与默认项。 |
| `providers` | 租户可触达的每家供应商、其凭据引用，以及自建模型的端点。 |
| `features` | 租户可用的功能；不在清单里的功能对它不可用。 |
| `identity` | 该租户为自己的模型请求贡献的约束与个性。 |
| `copy` | 租户覆盖的界面文案，按文案 id。不会进入模型请求。 |

### 身份的合成方向是单向的

身份分层进入模型请求：平台、组织、用户、Agent。两个字段的合成方式不同，而这个差别正是重点：

- **`constraints` 叠加。** 每一层只增不减，下层删不掉上层，因此组织的合规规则不会被 Agent 自述覆盖。
- **`personality` 被替换。** 组织声明一种语气；声明了自己语气的 Agent 取而代之。

本包拥有这个形状。把各层合成进提示词属于会话日志那一侧，因为进入模型请求的内容必须能从会话日志重建。

### 密钥

授权携带 `CredentialRef`——一个由凭据库解析的名字——因此配置可以被读取、记录与导出而不携带任何密文。两个租户靠指向不同引用实现隔离；有意共用一个平台密钥的部署，让两者指向同一个引用即可。

### 规则

`validateTenantConfig` 把规则写在一处，只读后端在加载时检查、可写后端在保存前检查：模型的供应商必须已授权、默认模型必须在可用清单内、模型／供应商／功能不得重复，id、约束与文案覆盖不得为空。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本包是抽象的 `TenantConfigStore` 服务、[`src/types.ts`](src/types.ts) 中的词汇（只有类型，因此 Client 面读到的正是 Host 发出的签名），以及 [`src/validate.ts`](src/validate.ts) 中的规则——它返回全部问题而不是第一个，因为修配置的运营方想一次看到整张清单。`get` 是异步的，因此数据库支撑的存储可以接进同一个能力缝。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——解析请求属于哪个租户的目录。
- [tenant-config-static](../tenant-config-static/README.zh.md)——从组合配置读取的后端。
- [多租户子系统](../../../docs/subsystems/multi-tenancy.zh.md)——租户词汇与解析顺序。
- [credentials](../../credentials/credentials/README.zh.md)——凭据引用是什么、如何解析。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本能力缝只读取配置；它携带的身份文本经由同时把它记入会话日志的调用方才进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **身份只有形状** —— 目前没有任何东西把 `constraints` 与 `personality` 合成进提示词；那要等记录会话身份的会话事件到位。
- **没有用户层** —— 上述分层在组织与 Agent 之间还有一层用户，而本部署尚无用户记录可承载它。
- **功能是 id，不是权限** —— 清单说明租户可用哪些功能，而不是哪位成员可用；角色要等有成员体系的管理界面。
- **没有用量限制** —— 配额、预算与限流不属于这份配置。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。这个无状态的服务定义拥有配置词汇与规则，而后端拥有行、调用方拥有对它们的使用。
