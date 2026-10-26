---
description: "只追加的管理变更记录：谁改了哪条记录、什么时候、从什么改成什么。"
kind: "package-reference"
---

# @lyness/lyn-admin-audit

[English](README.md) | 中文

## 概述

`lyn-admin-audit` 存的是名册不存的那一半。名册存的是现在什么是真的，这够用来服务一个请求，但不够用来为它负责：一个组织被问起某人上个月为什么持有某个角色、或者一个 bot 的性格原来写的是什么，如果唯一的记录就是当前这条，它无从可读。对人、目录绑定、bot 和团队的每一次更改都记在这里，带上是谁改的、他以什么身份改的，以及被替换掉的那个值。条目只会被追加；没有东西重写或删除某一条。

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

排在两个名册之前，因为它们都注入它：

```yaml
- id: admin-audit
  name: '@lyness/lyn-admin-audit'
  config:
    maxValueLength: 2000
    maxEntries: 200
```

然后，拥有可管理记录的一方记下自己的更改，界面把它们读回来：

```ts
import type { Context } from '@lyness/cordis'
import { fieldChanges } from '@lyness/lyn-admin-audit'
import type {} from '@lyness/lyn-admin-audit'
import type { Membership } from '@lyness/lyn-people'

declare const ctx: Context
declare const by: Membership

await ctx.adminAudit.record({
  kind: 'bot',
  subject: 'triage',
  subjectName: 'Triage',
  action: 'changed',
  organization: 'acme',
  changes: fieldChanges({ persona: 'Be brief.' }, { persona: 'Be thorough.' }),
}, by)

const history = await ctx.adminAudit.read({ organization: 'acme', subject: 'triage' }, by)
```

租户管理员读自己组织的那份记录。不点名组织就是要每一个组织的，这只有平台身份可以做。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**它有自己的域，和它所描述的那些记录分开放。**名册的表存的是现在什么是真的，并且原地被重写；这一张只会被追加。一份和它所审计的记录共用一个域的记录，会被那个让它变得值得保留的管理动作一起删掉。

**记录的时候不做任何授权。**做出这次更改的那个操作已经判定它被允许了，而一份能拒绝某个条目的记录，就是一份缺了某些更改的记录。权限出现在读那一侧，在那里一个判定服务两种读法：点名一个组织就是要那个组织的记录，不点名就是要每一个组织的。

**这是硬注入，不是可选读取。**两个名册各自声明 `adminAudit`，所以一个挂了名册却没挂它的部署加载不起来。另一条路——一个默默什么历史都不记的名册——正是 credits 的执行用同样方式避开的那类问题：明显地缺席胜过悄悄地失效。

**一次更改替换掉的那个值才是重点。**审计者问一段性格原来写的是什么，需要的是那段已经没有了的话，所以每个有差异的字段两边都记。新增只留 `after`、删除只留 `before`，因为记录存在与否本身就是那次更改。

**比较只在这里实现一次。**每一个拥有可管理记录的一方都需要同样的逐字段比较，而第二份拷贝会和这一份走偏。调用方把自己的记录摊平成一组有名字的字符串——把列表拼起来、不带它没有的字段——然后 `fieldChanges` 答出审计者会念出来的东西。

**被记下的值会被截断，并且说出它被截断了。**性格是管理员写的自由文本，所以一条记录能带的文字比一份记录该增长的多。截断标在那个字段上而不是藏起来，这样读的人知道自己读到的是一个值的一部分。

**什么都没改的那次更改不被记录。**两个名册都跳过没有差异字段的 `changed` 提交，因为那是管理员没编辑就按了保存，而那个条目是审计者得跳过去读的。

**条目的 id 以时刻开头。**存下来的键按时间排序，正是每次读想要的顺序；后缀把同一毫秒里的两次更改分开。一次读按键排序，而不是从记录里再推一个顺序出来。

**名字和身份一起留着。**一个条目带着那条记录当时用的名字，于是一个已被删除的 bot 的历史读起来仍然是一个名字，而不是一个什么也解析不出来的标识符。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-managed-people`](../managed-people/README.zh.md) — 它记录其更改的那些人和绑定。
- [`lyn-managed-bots`](../managed-bots/README.zh.md) — 它记录其更改的那些 bot 和团队。
- [`lyn-people`](../people/README.zh.md) — 一次读所凭的那些身份。
- [`lyn-module-accounts`](../../bundle/module-accounts/README.zh.md) — 把它和名册一起选上的那份组合。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个包不注册任何工具或提示词：它存的是管理员改了什么，它持有的东西不会进入任何模型请求。

#### KV Cache 影响

没有请求前缀发生变化，因为这里没有东西参与组装一个请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **打开时整份记录都被读进内存** — 这个域是一张读进内存的键值表，所以一个长期运行的部署的全部记录都被持有着，一次读会把它排序。长到超出这个做法的记录，想要的是对一个能答出时间范围查询的存储做这种查询。
- **条目永不裁剪** — 这份记录就是产品本身，所以保留多久是部署的政策，不是这个包挑的默认值。
- **没有界面读它** — 这个服务答复一个身份，但还没有任何 Remote 命名空间或设置页展示这份记录，所以今天它只能从代码读。
- **只有两个名册往里记** — 登录渠道的更改、设置、积分发放和模型选择也都是管理行为，它们都还没有记在这里。
- **一次读是一页，最新的在前** — 没有游标、没有范围，也不能按谁改的或改的是哪一类记录来筛。
- **记录说的是改了什么，不是尝试过什么** — 一次被拒绝的更改什么也不记，所以一个反复被拒的管理员在这里留不下痕迹。

**Runtime invariant:** 不发布伴生检查。这份记录是它自己内容的唯一记录，所以不存在能和它不一致的独立观察。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

这个服务把它的上界作为一份经过校验的 `Config` 取进来，由 Loader 从组合行里提供：一个不写 `config` 键的行会让这个插件挂不上，这就是账户模块把两个上界都显式写出来、而测试台传 `{}` 的原因。

</details>
