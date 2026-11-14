---
kind: upgrade-guide
description: "一个人可以持有多个身份：名册存一张表、写定的条目可以列出它们，而 DeclaredPerson 收的是 memberships。"
---

# 一个人持有的是「多个身份」，不是「一个身份」

[English](guide.md) | 中文

## 变更

名册过去给每个人恰好一个身份。现在它存一张表——归属于两个组织的人需要的正是这个。

| 之前 | 之后 |
|---|---|
| `DeclaredPerson.membership` | `DeclaredPerson.memberships`，一张非空的表 |
| `PersonView` 带 `role` 与 `organization` | 它还带 `standings`；`role` 与 `organization` 重复其中第一个 |
| 写定的 `people:` 条目写 `role` | 它写 `role` **或** `standings`，不能都写也不能都不写 |
| `managedPeople` 有 `save` 与 `remove` | 它还有 `grantStanding` 与 `revokeStanding`，`people` 命名空间也一样 |
| `PeopleRefusal` 有六个原因 | 它有九个：`already-held`、`last-standing`、`unknown-standing` |
| `managed_people` 存储是第 1 版 | 它是第 2 版，并且仍然读得了第 1 版 |

有两条规则跟着来。任何改动一个人的操作——改名、删除、把某个目录身份准入为他、撤掉一个身份——现在都要求调用方管理着他持有的**每一个**身份，因为一条绑定准入的是「整个人」。读是例外：列表只显示调用方管理着的那些身份。

没有任何身份标识会移动：存储里一个人的第一个身份保留由他的 id 推出的那个标识，只写一个 `role` 的写定条目保留 `<person>:<role>`，于是会话与邀请码点名的都还是确实存在的身份。列表里的身份会把组织也带上，形如 `<person>:<organization>:<role>`。

受影响的是：向名册声明人员的代码、对 `PeopleRefusal` 做穷尽 `switch` 的代码，以及把 `PersonView.role` 当作「他唯一的身份」来读的代码。

## 迁移

1. 已有存储什么都不用做：第 1 版的记录读出来就是一个身份，下一次写入会把它换成一张单元素表。
2. 凡是声明人员的地方，把 `membership` 改成 `memberships`，并把那个身份放进数组：
   ```ts
   import type { Context } from '@deepseek-ai/cordis'
   import type {} from '@deepseek-ai/dsh-managed-people'
   import type { Membership, Person } from '@deepseek-ai/dsh-people'

   declare const ctx: Context
   declare const person: Person
   declare const membership: Membership

   ctx.managedPeople.declarePerson({ person, memberships: [membership], kind: 'bot' })
   ```
3. 对 `PeopleRefusal` 做穷尽 `switch` 的地方补上那三个新原因。还没有「授予身份」方法的线上界面，可以把它们按 `not-permitted` 的方式汇报。
4. 凡是要判断「这个人能做什么」的地方，读 `PersonView.standings`。`role` 仍然答出他的第一个身份，而那描述不了持有多个身份的人。
5. 想给某个人写下多个身份，就把那条条目的 `role` 换成 `standings`，见[独立部署的安装与管理](../../../user/guide/standalone-administration.zh.md)。注意这会改变那个人的身份标识，所以他已打开的会话会失去身份、需要重新选一次。
6. 确认它生效：`pnpm exec vitest run packages/identity/managed-people/tests packages/identity/people/tests` 覆盖了第 1 版记录的折叠、两种写定形式，以及那两个新操作。
