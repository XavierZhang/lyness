---
kind: upgrade-guide
description: "agentCapabilities/describe 的工具按注册它的插件分组，不再逐个工具给出说明。"
---

# `agentCapabilities/describe` 的工具按插件分组

[English](guide.md) | 中文

## 变更

`agentCapabilities/describe` 回复里的 `tools` 成员从「一行一个工具」变为「一行一个注册它的插件」，并且每个工具自己的说明被去掉：

| 变更前（`ToolAvailabilityView`） | 变更后（`ToolPluginView`） |
|---|---|
| `name` —— 工具面向模型的名字 | `plugin` —— 注册它的插件的显示名 |
| `description` —— 面向模型的说明 | `meta?` —— 那个包自己的 `PluginLocalizedMeta`（标题、说明、图标） |
| `source` | `tools` —— 它注册的那些模型侧名字，按名称排序 |
| | `source` |

`connections` 与 `skills` 不变。`ToolAvailabilityView` 不再导出，由 `ToolPluginView` 取代。

受影响的是任何读 `describe().tools` 的客户端插件、SDK 消费方或 JSON-RPC 调用方。说明是被删掉而不是搬走：它是为模型写的，给人看的界面把它渲染出来，就是无论读者用哪种语言都只有一段关于参数与退出码的英文散文。

Host 侧的注册表新增了 `ctx.tools.registered(scope?)`，把每个可见定义与注册它的 Fiber 配成一对。`ctx.tools.definitions(scope?, toolSet?)` 不变。

## 迁移

1. 读分组而不是读工具：`view.tools.flatMap(group => group.tools)` 就是原来的名字清单，而 `view.tools.length` 现在数的是插件数，不是工具数。
2. 用插件自己的文案替换逐工具说明：按读者语言解析 `group.meta?.title` 与 `group.meta?.description`（客户端用 `ctx.locale.resolveText`），包没声明标题时回退到 `group.plugin`。
3. 把从 `@deepseek-ai/dsh-api-agent-capabilities-controller/types` 导入的类型名 `ToolAvailabilityView` 改为 `ToolPluginView`。
4. Host 侧需要知道「谁注册了这个工具」的消费方，改读 `ctx.tools.registered()`，不要再靠比较名字。
5. 验证：`pnpm run test -- packages/api/agent-capabilities-controller` 通过，其中的 composition 用例断言包自己的标题确实进入了回复。
