---
description: "租户目录，其清单即组合配置：运营方可以在部署启动前读到并 diff 的行。"
kind: "package-reference"
---

# @lyness/lyn-tenant-static

[English](README.md) | 中文

## 概述

本后端用部署补丁层里写的清单注册 `ctx.tenants`。每行写明一个租户的不可变 id、标识、显示名，以及它被服务的主机名；索引在加载时建立，清单若有错误或歧义则拒绝挂载，而不是把请求解析到任意租户。私有化部署（只有一个租户）与早期 SaaS 部署都适用；数据库支撑的目录可以替换这一行，而无需改动能力缝。

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
- id: tenants
  name: '@lyness/lyn-tenant-static'
  config:
    tenants:
      - id: acme
        slug: acme
        displayName: Acme
        hosts:
          - acme.example.com
```

| 字段 | 规则 |
|---|---|
| `id` | 1～64 个字母、数字、`-` 或 `_`。不可变：持久记录携带它。 |
| `slug` | 一个小写 DNS 标签，因此也可以作子域名。 |
| `displayName` | 任意非空名称。 |
| `hosts` | 不含协议与端口的主机名，按小写比较。可选。 |

### 清单会拒绝什么

出现以下情况时，加载即失败：清单没有任何租户；某行的 id、标识、显示名或主机名格式不合法；两行争用同一个 id、标识或主机名。错误信息按位置点名是哪一行。有歧义的清单会把请求解析到最后建索引的那一行，而那是另一个组织的数据。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

构造函数校验每一行并建立三张映射——按 id、按主机名、按标识——因此每次查找都是一次映射读取，服务不持有其他状态。查法返回已解决的 promise，因为能力缝对并非异步的后端也保持异步签名。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant](../tenant/README.zh.md)——本后端注册的能力缝。
- [tenant-http](../tenant-http/README.zh.md)——对着清单解析请求的调用方。

-----

<a id="model-experience"></a>
## 模型体验

无，因为该清单是 host 侧的路由身份；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **清单在加载时固定** —— 增加租户要改补丁层；会重载补丁层的 profile 会重新挂载目录，其他 profile 需要重启。
- **这里不创建租户** —— 本包只为运营方写下的行建索引；生成 id 并持久化属于数据库支撑的目录。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。索引在加载时由一份配置推导得出，之后不再变化，因此不存在可能与之背离的第二处观察。
