# 记忆

[English](memory.md) | 中文

agent 在会话之间带着的持久事实，只由显式动作写入，并作为运行时上下文折进之后的每个请求。[记忆契约](../../packages/memory/memory)拥有已存条目、其保留上界、带品牌的身份，以及提示词贡献；决策记录是[记忆、检索与提示词组装](../../.agents/notes/proposed/architecture/2026-10-09-memory-recall-and-prompt-assembly.zh.md)。

Sources: [`packages/memory/memory/src/types.ts`](../../packages/memory/memory/src/types.ts) · [`packages/memory/memory/src/storage.ts`](../../packages/memory/memory/src/storage.ts)

## 一条记忆是什么

一条被记住的事实：一段文本、一个作用域，以及写下它的那一刻。事实指的是一条约定、一项偏好，或关于一个工作区及其中的人的长期细节——不是任务状态、不是密钥、也不是文档。每条的长度上界（2048 个字符）存在的意义，是让这个区分可被强制执行，而不只是一句建议。

身份是不透明且带品牌的。模型看到 id，只是为了能请求移除某一条事实。

## 写入是显式的

`remember()` 是唯一的写入路径。没有任何东西去观察会话记录并判断什么值得保留，因为客户从未批准的记忆，他也无法审计；而那还会把每一次对话变成之后对话的一份静默输入。agent 在人要求它记住时写入；宿主代码在产品界面要求时写入。

## 作用域

`member` 是默认：该事实属于写下它的那个人。`shared` 是向组织内所有人发布的事实。

今天没有任何东西解析"人"，所以一个部署持有一份存储，该字段记录的是意图，而不是在强制分隔。成员身份作用域随[行事上下文](../../.agents/notes/proposed/architecture/2026-10-08-people-memberships-and-acting-context.zh.md)那部分工作到来，届时读取同一个字段，不改动已存格式。

## 记忆如何到达模型

作为组装好的系统提示词中的运行时上下文，在每次组装时求值，所以一次写入会落在下一个请求里。空存储不贡献任何内容，这让从未写入过记忆的部署，其请求前缀保持逐字节相同。

会话日志本来就把组装好的提示词记为一条 `system/message`，所以模型看到了什么仍然可以重建，不需要一个记忆专属的会话事件。这正是本子系统不新增事件类型的全部理由：[模型可见的内容通过表层事件类型流动](../../.agents/notes/implemented/architecture/2026-08-10-session-log-version-mechanism.zh.md)，而系统提示词就是其中之一。

## 记忆不是知识库

| | 记忆 | 知识库 |
|---|---|---|
| 写成于 | 工作之中，一条一条 | 别处，以文档形式 |
| 经过审核 | 否 | 是 |
| 有版本 | 否 | 是 |
| 体量 | 每条有上界 | 整份文档 |
| 到达模型 | 每个请求都带 | 被检索到时 |

它们的写入路径不同、生命周期不同，且不存在任何路径经由其中一个写入另一个。并出来的界面得同时承载两套策略，而它会默认落到更弱的那一套。

## 治理

组织可以列出并删除为其成员持有的一切——这是能够持有这些数据的前提条件，不是以后再补的改进。服务无法校验的存储会让读取失败，而不是报告"没有记忆"，因为静默的空读与"客户的事实已被丢弃"无法区分。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmemory--memoryservice"></a>

### `ctx.memory` — `MemoryService`

Durable memory with an explicit write path and a prompt contribution.

```ts cordis-catalog
/**
 * Keep one fact. The only write path: there is no listener that stores
 * anything a caller did not ask for.
 * @param text - the fact to keep, trimmed and non-empty.
 * @param scope - reach of the entry; defaults to the writing member.
 * @returns the stored record, including its new identity.
 * @throws {TypeError} when the text is blank or longer than {@link MAX_ENTRY_CHARS}.
 */
async remember(text: string, scope: MemoryScope = 'member'): Promise<MemoryRecord>

/**
 * Read every kept fact, oldest first.
 * @returns the stored records in write order.
 */
async list(): Promise<readonly MemoryRecord[]>

/**
 * Remove one kept fact.
 * @param id - the record's identity.
 * @returns true when an entry was removed, false when none carried that id.
 */
async forget(id: MemoryId): Promise<boolean>
```

Source: [`packages/memory/memory/src/index.ts`](../../packages/memory/memory/src/index.ts)
<!-- END GENERATED cordis-surface -->
