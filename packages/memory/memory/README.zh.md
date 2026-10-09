---
description: "带显式写入路径与提示词贡献的持久 agent 记忆，面向跨会话保留事实的使用者与接线该服务的维护者。"
kind: "package-reference"
---

# @lyness/lyn-memory

[English](README.md) | 中文

## 概述

`lyn-memory` 跨会话保留事实：约定、偏好，以及人或 agent 要求记住的其他长期细节。挂载服务入口，之后每个请求都把这些事实作为运行时上下文带上；再挂载 `./tools`，agent 就能在被要求时写入、列出、移除某一条。写入只能是显式的——这里没有任何东西去读会话记录并自行判断什么值得保留。每条最多 2048 个字符，保留策略先丢最旧的一条，而服务无法校验的存储会让读取失败，而不是报告"没有记忆"。

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

当 agent 应当在会话一开始就已经知道这个工作区怎么运转时，把服务入口挂在宿主平面。它拥有唯一一份持久存储，所以必须只有一个所有者：agent preset 不能挂载它，试图挂载的 preset 会因缺少 isolate 领域而被拒绝。preset 里只挂 `./tools`。它需要 `ctx.storageDomain` 提供持久性、`ctx.systemPrompt` 承载贡献；两者都没有的部署无法挂载它。当 agent 应当自己写入记忆时，再挂载 `@lyness/lyn-memory/tools`；省略它，则这些事实仍然可读，但只有宿主代码能写。

```yaml
- id: memory
  name: '@lyness/lyn-memory'
  config:
    maxEntries: 200
    contextOrder: 130
- id: memory-tools
  name: '@lyness/lyn-memory/tools'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxEntries` | `200` | 一次写入开始丢弃最旧条目之前保留的条数 |
| `contextOrder` | `130` | 运行时上下文的排序位置，在各策略条目之后 |

### 服务 API

| 成员 | 契约 |
|---|---|
| `remember(text, scope?)` | 存入一条事实。文本会被 trim；空白文本与超过 `MAX_ENTRY_CHARS` 的文本被拒绝。`scope` 取 `member`（默认）或 `shared`。返回带新 id 的已存记录。 |
| `list()` | 全部已存记录，最旧的在前。 |
| `forget(id)` | 移除一条记录；移除成功返回 `true`，没有记录持有该 id 时返回 `false`。 |

持久写入逐个进行，所以两次并发写入不会让各自的保留处理交错。

-----

<a id="understand-the-implementation"></a>
## 理解实现

服务只打开 `memory` 存储域一次，并为提示词 provider 保留一份条目快照；域始终是权威，每次写入都从域刷新快照。提示词贡献是一个 `ctx.systemPrompt.context()` 条目，其文本在每次组装时求值，所以一次写入会落在下一个请求里，而不必重建提示词中它之前的任何内容。

条目是在组装好的系统提示词里到达模型的，而会话日志本来就把那份提示词记为一条 `system/message`。这正是本包不新增自己的会话事件的原因：模型看到了什么，仍然可以通过既有的表层事件从日志重建。

保留处理在"添加该条目的那次持久写入"内部进行，先丢最旧的，所以最新的事实总能活过它自己的那次写入。

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、其解析后的配置，以及提示词贡献 |
| [`src/tools.ts`](src/tools.ts) | `memory_write` / `memory_list` / `memory_forget` 三个工具及其共享的呈现折叠 |
| [`src/storage.ts`](src/storage.ts) | 持久域与已存条目的 schema |
| [`src/types.ts`](src/types.ts) | 条目、其作用域，以及带品牌的身份 |

**Runtime invariant:** No companion is published. 已存条目是一张自有的表，在持久边界由其 schema 校验，而提示词快照在每次写入后都从该表刷新，因此对记忆的两次独立观察不可能分歧。

-----

<a id="further-exploration"></a>
## 进一步探索

- [`lyn-storage-domain`](../../storage/storage-domain/README.zh.md) —— 本服务打开的那个持久域。
- [`lyn-system-prompt`](../../core/system-prompt/README.zh.md) —— 运行时上下文的排序与组装。
- [记忆子系统](../../../docs/subsystems/memory.zh.md) —— 作用域、治理，以及记忆与知识库的区别。

-----

<a id="model-experience"></a>
## 模型体验

### 请求中已记住的事实

#### 模型看到什么

空存储完全不贡献文本。有条目时，运行时上下文承载一个块：

##### 已记住事实的那个块

```markdown
Remembered about this workspace and the people in it:
- <fact>
- <fact>
```

##### 工具的返回

```markdown
Remembered as <id>.
<id>	<fact>
Nothing is remembered yet.
Forgot <id>.
No remembered fact carries the id <id>.
```

#### Token 影响

该块在每个请求上按保留条数各占一行，上界是 `maxEntries` 与每条 2048 个字符。`memory_list` 会把同样的事实连同 id 重复一遍，所以只有在需要取 id 时才值得调用。

#### KV Cache 影响

该块位于系统提示词中，所以一次写入会改变可复用的请求前缀，并使该处之后的缓存条目失效。未变动的存储复现逐字节相同的文本，而从未写入过的存储不贡献任何内容，前缀保持不动。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明本包在什么情况下不合适或需要特别当心。它们是当前的包约束，不是任务清单。

- **一个部署一份存储** —— 条目带有 `scope` 字段，但这里没有任何东西解析"人"：服务多个人的部署共享同一份记忆。成员身份作用域随行事上下文那部分工作到来，届时读取既有的 `scope`，不需要改动已存格式。
- **没有面向人的界面** —— 只有宿主代码与这些工具能读取或移除条目。组织还无法从产品自己的设置里审阅所持有的内容。
- **保留策略只看条数，不做相关性判断** —— 最旧的条目会被丢掉，即便它恰好是最有用的那一条。
- **写下的事实从不被重新校验** —— 一条不再成立的约定会一直出现在每个请求里，直到有人移除它。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 —— 点击展开</summary>

无。

</details>
