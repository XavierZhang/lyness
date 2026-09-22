---
description: "真实 API e2e 测试调用哪个兼容 DeepSeek 的平台，由产品本身已在读取的变量决定。"
kind: "package-reference"
---

# @lyness/lyn-e2e-target

[English](README.md) | 中文

## 概述

在真实 API 的 e2e 测试里用 `lyn-e2e-target`，而不要写死模型名。它根据产品本身读取的变量——端点用 `DEEPSEEK_BASE_URL`，该端点提供的模型用 `DEEPSEEK_MODELS`——解析出这次运行调用的平台，因此产品与测试总是指向同一个地方。两者都未设置时，目标是官方 API 及其默认模型，也就是可配置之前每个测试调用的对象。它还会说明目标是否为官方 API，让需要官方独有功能的测试在别处跳过。

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

用产品自己的变量把一次运行指向其他平台：

```sh
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://gateway.example/v1
DEEPSEEK_MODELS=deepseek-ai/DeepSeek-V4-Flash
pnpm run test:e2e
```

测试从目标读取模型，并据此给官方独有功能加门槛：

```ts
import { E2E_TARGET } from '@lyness/lyn-e2e-target'

/** The agent options a real-API suite creates its agent with. */
export const agentOptions = { provider: 'deepseek-official', model: E2E_TARGET.model }

/**
 * Whether a suite that reads prompt-cache accounting can run on this target.
 * @returns true only on the official API, which reports that accounting.
 */
export function cacheAccountingAvailable(): boolean {
  return E2E_TARGET.official
}
```

模型取 `DEEPSEEK_MODELS` 列出的第一个 id。产品会拒绝的值——空值或含空条目——在这里导入时同样会失败。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`resolveE2eTarget(env)` 负责解析；`E2E_TARGET` 在导入时对 `process.env` 应用一次。它用提供方自己的 `parseModelIds` 解析 `DEEPSEEK_MODELS`，并在去掉末尾斜杠后把端点与提供方的 `PUBLIC_BASE_URL` 比较，因此测试与产品对同一个值的理解不会不一致。

提供方自己的 e2e 直接用 `parseModelIds` 读取该变量，而不导入本包，因为本包依赖该提供方。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [llm-deepseek](../../llm/llm-deepseek/README.zh.md)——读取同一组变量的提供方，以及 `DEEPSEEK_MODELS` 如何替换它的目录。
- [测试策略](../../../docs/testing.zh.md)——测试何时调用真实模型，以及调用哪个平台。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只决定测试访问哪个模型；它不注册任何提示词、工具或会话事件。

#### KV Cache 影响

无；本包既不组装也不发送供应商请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下是当前的约束，不是任务清单。

- **每次运行一个模型** —— 所有测试都用配置的第一个模型；需要在其他平台上比较两个模型的测试，拿不到第二个 id。
- **仅限兼容 DeepSeek 的平台** —— 目标总是经由 DeepSeek 提供方路由访问；讲其他 API 的平台属于另一个提供方，要通过 `llm-pi-ai` 配置。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。目标是环境的纯函数，只计算一次，因此不存在可能与之背离的第二处观察。
