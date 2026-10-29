---
description: "删除一段对话：它的存储日志、它下面每一份子会话日志，以及关于它们缓存的投影。"
kind: "package-reference"
---

# @lyness/lyn-session-deletion

[English](README.md) | 中文

## 概述

`lyn-session-deletion` 提供 `ctx.sessionDeletion`，它唯一的方法删除一段对话：被指名会话的存储日志、它下面每一份 subagent 日志，以及每个成员缓存的投影。它移除的范围与 ZIP 导出归档的范围完全一致，所以一个人先导出再删除，手里就握着被拿走的全部内容。删除之后无法恢复，也不留墓碑。还开着的对话会被拒绝，而不是在它脚下被移走。需要让一个人或一位操作者删除自己历史的部署挂上它；不挂它，部署就保留它存过的每一段对话。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与未竟事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

```yaml
- id: session-deletion
  name: '@lyness/lyn-session-deletion'
```

它不接受配置，需要持久化后端与查询服务。投影缓存一并挂着时，每个被删成员缓存的记录随它的日志一起消失。

```ts
import type { Context } from '@lyness/cordis'
import type { SessionId } from '@lyness/lyn-session'
import type {} from '@lyness/lyn-session-deletion'

declare const ctx: Context
declare const conversation: SessionId

const { removed } = await ctx.sessionDeletion.delete(conversation)
// removed names every stored session that went, subagents before their parent
```

### 它移除什么，不移除什么

它移除这段对话以及它下面每一个 subagent 会话的存储日志，包含每份日志的每一个格式世代，还有每个成员的投影缓存记录。它不移除上传文件的存储字节：文件对象按内容寻址，一个对象可以服务好几段对话，移除它就会把一个文件从没人问起的对话里抽走。提供这个删除的界面要把这件事说出来，而不是留给人去猜。

### 失败

| 失败 | 含义 |
|---|---|
| `SessionDeletionLiveError` | 这段对话，或它下面某个 subagent，还开着。什么都没被移除；等它结束之后再删。 |
| `SessionPersistenceNotFoundError` | 被指名的会话没有存储日志，或者某个成员在中途被别人移除了。 |
| `SessionAlreadyOwnedError` | 某个成员在取得谱系之后变成了活会话，或者另一个进程正在写它。 |

移除在成员之间不是原子的。中途失败会让它还没走到的每个成员继续留在存储里，同一次调用再跑一遍就删掉剩下的。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**一段对话不止一份存储会话。** subagent 各自留着自己的日志，所以「删掉这段对话」带着一个顺序和一条拒绝，这就是它是一个服务、而不是调用方里一行代码的原因。

**一份谱系答案，与导出共用。** 成员是被取谱系的那个会话，加上 `sessionQuery.traceSession` 报告的后代，走法与 ZIP 导出的走法相同。各自决定「一段对话」是什么，会让归档和删除对同一个词给出不同答案。

**最深的先走。** 谱系是从每份日志自己的父字段读出来的，所以先移除父会话会让子会话留在语料里、却没有任何东西能找到它们。前序遍历的逆序把每个成员的后代排在它前面，这让一次失败的删除仍然能作为同一段对话重试。

**日志先走，缓存记录后走。** 两者之间失败留下的是一份日志已消失的缓存记录，身份校验本来就会拒绝它；反过来则留下一份归属已被丢掉的日志。

**还开着的对话被拒绝两次。** 谱系会回答某个成员是否活着，这是读者能据以行动的那条拒绝。那个答案只是一次观测，所以之后才变活的成员由后端自己的写排他拦下——两种情况下都不会在写者脚下移走任何东西。

**没有东西需要被通知，索引自己会好。** 搜索索引从后端自己的列表重建，所以一个离开列表的会话会在下一次同步时离开索引；这个包不通知任何索引，自己也不保存清单。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`lyn-session-persistence`](../session-persistence/README.zh.md) —— 这个服务调用的 `delete` 操作，以及每个后端对它的承诺。
- [`lyn-session-projection-cache`](../session-projection-cache/README.zh.md) —— 随每份日志一起移除的缓存记录。
- [`lyn-session-log-export`](../../session-query/session-log-export/README.zh.md) —— 这次删除所对齐的那份归档。
- [`lyn-api-session-data-controller`](../../api/session-data-controller/README.zh.md) —— 一个人经由哪个 Remote 命名空间触达它。

-----

<a id="model-experience"></a>
## 模型体验

没有，因为这个包不注册工具也不注册提示词：删除一段对话是人对存储数据的动作，调用时没有任何模型请求发生变化。

#### KV 缓存影响

没有。被删掉的对话不会有下一次请求，别的对话的前缀也不是从它推导出来的。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **在成员之间不是原子的** —— 中途失败留下一段部分删除的对话，由调用方重试。一段对话是好几份存储日志，没有后端提供跨越它们的单一屏障。
- **上传的字节会留下** —— 文件对象按内容寻址且共用，没有引用计数能证明最后一个用户正在离开，所以它们的字节比引用它们的对话活得更久。
- **旧日志里的分叉随源一起走** —— 普通分叉是一段独立的对话，但历史日志可能把它的源记成了父会话，这样的子会话会随它挂着的那段对话一起被移除。这与导出归档的范围一致。
- **不可恢复、不留墓碑** —— 没有东西能把删掉的对话读回来，id 只是一个槽位，后来的会话可以占用同一个。

**运行时不变量：** 每个成员在开着的时候都会被拒绝，并且成员的日志先于关于它缓存的记录被移除。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文 —— 点击展开</summary>

留存策略——删除超过 N 天的、或超出配额的——会是这个服务的第二个消费者，而不是第二条删除路径。它需要先决定由谁设定那个界限，而个人界面有意把这件事留给部署。

</details>
