---
description: "从组合配置读取的租户配置：每个租户的模型、供应商、功能、身份与文案都是补丁层里的行。"
kind: "package-reference"
---

# @lyness/lyn-tenant-config-static

[English](README.md) | 中文

## 概述

本后端用部署补丁层里的行注册 `ctx.tenantConfig`：每个租户一行，写明它可用的模型、通过哪些供应商使用、可用的功能、它贡献的身份文本，以及它覆盖的文案。行在加载时被校验并建索引，违反规则的行会拒绝挂载。它是只读的；要保存修改的管理界面，需要一个由本进程写入的存储。

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
- id: tenant-config
  name: '@lyness/lyn-tenant-config-static'
  config:
    tenants:
      - tenantId: acme
        providers:
          - provider: deepseek-official
            credential: ACME_DEEPSEEK_API_KEY
          - provider: self-hosted
            credential: ACME_SELF_HOSTED_KEY
            baseUrl: https://models.acme.internal/v1
        models:
          language:
            available:
              - { provider: deepseek-official, model: deepseek-v4-flash }
              - { provider: self-hosted, model: qwen3-32b }
            preferred: { provider: deepseek-official, model: deepseek-v4-flash }
          image:
            available:
              - { provider: self-hosted, model: sdxl }
        features:
          - workflow
        identity:
          constraints:
            - Never discuss unreleased financial figures.
          personality: Answer briefly, in the customer's language.
        copy:
          session.new.label: New ticket
```

租户要接入自己部署的模型，就授权一个带自有 `baseUrl` 的供应商，并写出该供应商下的模型——与使用托管供应商是同一条路径。`credential` 是由凭据库解析的引用，不是密钥本身：两个租户通过指向不同引用实现隔离。

省略的模态对该租户不可用；只写 `tenantId` 的行配置出一个暂时什么都不能用的租户。

### 这些行会拒绝什么

出现以下情况时加载失败：清单没有配置任何租户；`tenantId` 格式不合法或被配置两次；`credential` 不是引用；或某行违反配置规则——模型的供应商未获授权、默认模型不在可用清单内、模型／供应商／功能重复，或 id、约束、文案覆盖为空。错误信息按位置点名该行，并列出其中的全部问题。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

schema 会把缺席的列表、字典与嵌套默认值都填出来，因此可选的嵌套对象——`preferred`、`identity`——用与 null 的联合表达，而不依赖"缺席"。构造函数把每一行读成能力缝的形状，运行能力缝自己的 `validateTenantConfig`，并按租户 id 建索引；既无约束也无个性的身份，以及空的文案字典，会被省略而不是存成空值，因为两者说的是同一件事。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [tenant-config](../tenant-config/README.zh.md)——本后端注册的能力缝，以及它据以校验的规则。
- [tenant-static](../tenant-static/README.zh.md)——这些行所配置的租户清单。
- [credentials](../../credentials/credentials/README.zh.md)——凭据引用是什么、如何解析。

-----

<a id="model-experience"></a>
## 模型体验

无，因为这些行是 host 侧配置；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **只读** —— 修改租户配置要改补丁层；会重载补丁层的 profile 会重新挂载存储，其他 profile 需要重启。
- **不写凭据** —— 这些行只指明引用；创建并保存租户的密钥属于凭据库自己的界面。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。索引在加载时由一份配置推导得出，之后不再变化，因此不存在可能与之背离的第二处观察。
