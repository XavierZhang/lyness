---
description: "credits 组的地图：托管部署所计量的那份额度，供使用者与维护者在组内导航。"
kind: "package-group"
---

# credits/ —— 托管部署所计量的那份额度

[English](README.md) | 中文

## 概述

credits 组为托管部署给每个人的免费额度计量：赠送了什么、花掉了什么、还剩什么，以及什么都不剩时的那次拒绝。余额是一本账而不是一个计数器，因为一次客户无法对账的拒绝是一个工单。本组只存在于托管形态——独立部署安装一个都不挂载，所以积分在那里是不存在，而不是被关掉。本页是该组的地图；逐包的契约由各自的包 README 拥有。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 角色 | ctx key |
|---|---|---|
| [`credits/`](credits/README.zh.md) | 账本接缝、它的重置时钟，以及在每周期首次使用时赠送该周期额度的持久化 provider | `ctx.credits` |

-----

<a id="related-documentation"></a>
## 相关文档

- [多租户子系统](../../docs/subsystems/multi-tenancy.zh.md) —— 一份余额所属的租户与人。
- [模型是部署方的决定](../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.zh.md) —— 为什么积分只存在于一种形态，以及为什么钱与积分是两条分开的边界。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
