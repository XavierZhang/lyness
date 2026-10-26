---
description: "托管部署赠送、消耗并在耗尽时拒绝的积分：账本接缝、它的重置时钟，以及持久化的 provider。"
kind: "package-reference"
---

# @lyness/lyn-credits

[English](README.md) | 中文

## 概述

用 `lyn-credits` 为托管部署的免费额度计量。余额是一本账，而不是一个计数器：赠送与扣减都被记录，每一笔扣减都点名花掉它的那个会话，而余额就是它们相加的结果。`./store` 持久化它，并在每个周期首次使用时赠送该周期的额度。余额覆盖不了的一次消耗会被拒绝，而不是透支。这一切只存在于托管形态；独立部署安装一个都不挂载。

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
- id: credits
  name: '@lyness/lyn-credits/store'
  config:
    periodicAmount: 500
    period: daily
    offsetHours: 8
- id: credits-enforce
  name: '@lyness/lyn-credits/enforce'
  config:
    creditsPerMillion: 1000
    minimumDebit: 1
```

强制执行还需要一个 `creditSubject` provider，由它回答「这次请求花的是谁的积分」。

| 字段 | 默认 | 含义 |
|---|---|---|
| `periodicAmount` | `500` | 每个周期赠送的积分；`0` 表示不计量额度 |
| `period` | `daily` | `daily`、`weekly` 或 `monthly` |
| `offsetHours` | `8` | 周期所依据的、相对 UTC 的时钟偏移 |

`offsetHours` 比它看起来更要紧：UTC+8 部署上的每日额度在北京的午夜重置，而不是在 08:00——因为那才是「每日」对使用它的人的含义。

一次被拒绝的消耗抛出 `CreditsExhausted`，携带当前可用量以及下一次赠送何时到达。

### 让管理员改动它

```yaml
- id: credits-administration
  name: '@lyness/lyn-credits/administration'
```

它不接受任何配置，需要账本、人员目录与存储。两个操作，都把「作出它的那个身份」作为参数：

```ts
import type { CreditAdministration } from '@lyness/lyn-credits/administration'
import type { Membership, PersonId } from '@lyness/lyn-people'

declare const administration: CreditAdministration
declare const by: Membership
declare const person: PersonId

await administration.grant({ person, amount: 2000, expiresAt: '2026-12-31T16:00:00.000Z' }, by)
await administration.setAllowance({ person, periodicAmount: 1500, period: 'weekly' }, by)
```

平台管理员管得了任何人；租户管理员管得了在自己组织里持有身份的那些人；成员谁都管不了，包括他自己。一条覆盖也可以指向一个组织而不是一个人，那会改变那个组织里每一个人的额度。


-----

<a id="understand-the-implementation"></a>
## 理解实现

**额度在使用时到达，而不是来自定时器。** 新周期内的第一次读取或消耗会记录该周期的赠送。定时器必须为部署上的每一个人在同一瞬间触发，而且会漏掉任何在进程停机期间跨过周期的人。按使用赠送对没在用的人零成本，而且不可能漏掉一个周期。

它的幂等是由构造保证的、而不是靠一个标志位：一次赠送携带它被做出的那个瞬间，所以只要当前周期内已经有一次，这个周期就被覆盖了。并发调用无法重复赠送，因为每一次改写都被串行化。

**赠送是逐笔过期的，不是整份余额过期。** 周期额度在下次重置时失效，而购买的积分保有它自己更长的寿命。一份整体过期的余额会把买来的那些一起带走。

**一次拒绝让余额原样不动。** 透支是运营方没有同意过的成本，而一个能超出余额的人等于没有余额——所以检查先于扣减，一次被拒绝的消耗什么都不记录。

**强制执行是「检查、调用、结算」。** 在调用之前检查，才使得耗尽能停下一个回合、而不是在成本已经产生之后才报告；在调用之后结算，才使得这笔账是真实用量、而不是一个估算。一次没有报告 usage 的调用不计费——运营方无论如何都要为一次失败的调用付钱，而为一个用户根本没拿到的回答向他收费会更糟。

**结算会被夹到余额，而不是失败。** 调用已经完成、用户已经拿到答案，所以拒绝这次结算等于让一个成功的回合失败。

**管理员的决定在它被作出的地方被授权。** 两个操作都把那个身份作为参数，理由与模型策略为自己的写所给的相同：界面或 RPC 处理器里的校验会被下一个调用方绕开，而这里的绕不开。租户管理员能管到哪些人，是通过目录解析出来的，绝不取自调用方自己给出的组织。

**一条覆盖只声明它所改变的那部分。** 一个租户把每日额度提高、却对周期不置一词，那么周期仍停在部署放它的地方，于是日后对部署默认值的改动依然能到达他们。零是一个决定，不是缺席：管理员把 `periodicAmount` 设为 0 就把那个人封到零，并且不报告下一次赠予，因为确实没有可等的。

**覆盖与账本是分开的记录。** 一个长期决定不是一笔交易：改下个月的额度不能改写上个月的授予，而读一次余额不能重放历史上生效过的每一次策略变更。

**账本以可选的方式读取管理服务。** 单操作者安装一个都不挂，于是部署自己的数字就是全部答案；注入它会让账本在那里根本用不上。

**覆盖记进那份记录，授予不记。** 一个覆盖是原地被替换的，所以它原来允许多少只能从 [`lyn-admin-audit`](../../identity/admin-audit/README.zh.md) 读到。一次授予本来就是一条不会被重写、并且点名了谁把多少给了谁的行，再记一次就是对一个问题给出第二个答案。一个覆盖条目归属于设下它的那个身份的组织，于是租户管理员读得回自己的那些决定。

**每一笔扣减都点名它的会话。** 一次客户无法对账的拒绝是一个工单；而一份「每笔扣减都点名造成它的那个会话」的余额是可以回答的。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-people`](../../identity/people/README.zh.md) —— 这些积分属于谁。
- [模型是部署方的决定](../../../.agents/notes/proposed/architecture/2026-10-14-the-model-is-a-deployment-decision.zh.md) —— 为什么积分只存在于托管形态，以及为什么钱与积分是两条分开的边界。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包不注册任何工具、提示词或会话事件；它为宿主回答一个计量问题。

#### KV Cache effect

没有任何请求前缀发生变化。一次被允许的消耗让请求原样不动，而一次被拒绝的消耗在请求被构建之前就停下了它。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **单次请求可能花掉比它当时余额更多的量** —— 模型是「检查、调用、结算」，所以一次欠得比剩余更多的调用会结算到零，而不是让一个已经产出答案的回合失败。防线是**下一次**请求之前的那次检查；要彻底消掉这段超出，需要请求前预授权而不是事后结算。
- **计量需要一个可计费的对象** —— `./enforce` 注入 `creditSubject`，所以没有它的部署会让强制执行保持未激活，而启动审计会报告这一点。完整链路是签入、认证会话、它所持的 acting context，然后才是那个计费对象。
- **尚无按人上限** —— 一个组织要把自己某位成员压到低于部署额度，需要一份存储的上限、以及拒绝里的第二个权威方，而这一版还没有携带它们。
- **余额是从整本账重算的** —— 正确且可审计，但对一个人的历史是线性的，所以一个长期账户将来会需要一个检查点。
- **赠送与扣减从不裁剪** —— 账本本身就是产品，所以保留期是部署的策略，而不是本包替它挑的默认值。

**Runtime invariant:** 不发布任何 companion。每一个余额都是「已存储的赠送与扣减」的函数，所以不存在一个可能与它们不一致的独立总数。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

惰性周期赠送是微妙的那一处：它之所以正确，只因为改写被串行化、并且赠送记录了它自己的那个瞬间。一个将来缓存余额、或者在同一个串行步骤内不重读账本就赠送的版本，会在并发的首次使用上重复赠送。

</details>
