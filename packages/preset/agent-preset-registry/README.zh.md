---
description: "通过声明式 preset 选择 Agent 的工具、提示词和技能。同一进程可以运行多种组合。配置失败会显示在列表中；现有 Agent 保留已经使用的组合。"
kind: "package-reference"
---

# @lyness/lyn-agent-preset-registry

[English](README.md) | 中文

## 概述

通过声明式 preset 选择 Agent 的工具、提示词和技能。同一进程可以运行多种组合。配置失败会显示在列表中；现有 Agent 保留已经使用的组合。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

### 最小配置

```yaml
- id: agent-preset-registry
  name: '@lyness/lyn-agent-preset-registry'
  config:
    default: standard
- id: preset-standard
  name: '@lyness/lyn-agent-preset'
  config:
    id: standard
    plugins: []
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `default` | 必填 | 未显式指定时使用的 preset ID |

声明还可以写 `offered: false`。该 preset 仍然注册、仍然可解析、仍然可挂载——日志里记着它的会话必须能原样恢复——但给人用的选择器不再列出它，而管理界面照旧列出。把多套组合包装成少数几个视图的部署用这个标记，而不是撤掉它们。

Web 内置定义来自 `lyn-web-app` bundle。定义使用普通插件行；注册表不扫描目录，也不接受 preset 路径。`agent-preset-registry` 条目的 volatile 字段 `selectedDefault` 保留用户默认值，新会话优先使用它而不是部署 `default`。profile patch 仍可能带有已废弃的 `modeSelectionEnabled` 字段；注册表未声明该字段，既不读取也不重写它。

注册表不写入任何声明。`read` Remote 把一条声明的子插件列表按 entry-list YAML 方言（含 `!!js` 条件）渲染回来，供客户端展示 preset 的组成；没有任何接口接受 YAML 写回。新建 preset 或覆盖内置 preset 都是 bundle 补丁：插入一行 `@lyness/lyn-agent-preset`，或按该行 id 写覆盖补丁，再用 `plugin_manager` 安装到 profile；创造模式在对话中编写这类 bundle。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

每个声明在启动时创建注册表拥有的 scope 和内存 Loader 树。更新或移除声明会让旧代际退役；Agent、子 Agent 和临时历史读取各自持有引用，最后一个引用释放后才销毁插件树。插件注册继承 preset scope，Agent scope 的父链接决定可见性；Agent loop 仍由宿主共享。

preset 的服务提供方及其消费方必须共享同一个 `cordis:group` 隔离 realm。条目局部隔离不会沿 Agent 注册 scope 传播：组外的普通 Context 查找（包括 `agent.ctx`）仍选择 Host realm。`agentPresets.serviceFor()` 显式检查保留的组合，不改变普通服务查找。

激活审计检查导入失败、缺失服务和向全局泄漏的服务。导入失败、激活失败和泄漏会拒绝挂载。等待 Host 服务的行保持挂载，每次读取和绑定都在 Host Loader 树结算后重新审计，因此启动顺序不决定结果。失败只禁用该定义的新绑定。`presetForSession(session)` 同步读取最新记录的预设 ID，未记录时返回 null。会话日志保存 preset ID 和空白会话的切换记录；重启恢复使用该 ID 的当前定义，缺失时拒绝恢复。若空白会话已记录所请求的 preset 且正运行其当前版本，`select` 不做任何改动，也不追加切换记录或触发 `tools/change`。

`inspectCompositions()` 读取本注册表仍保留的全部代际；传入 Agent 上下文时只选择它绑定的精确代际，在此没有绑定时返回空列表。每个 `AgentPresetInspection` 包含 preset ID、纯数据形式的活动模块引用及解析基址，以及泄漏的服务名。检查器查询运行中的服务，而不是模块级挂载表；结果不包含 Loader 树或 fiber。这些记录定义在 [composition-inventory.ts](src/composition-inventory.ts) 中。

| 文件 | 职责 |
|---|---|
| [index.ts](src/index.ts) | 注册、代际与 Agent 绑定 |
| [mount.ts](src/mount.ts) | 隔离插件树与激活审计 |

</details>

### 继承另一个 preset

一个声明可以在 `extends` 里点名另一个 preset，此时 `plugins` 只持有差异：行 id 与基底某一行相同的替换它、位置不变，其余每一行排在基底清单之后。继承链一路走到根再自上而下套用，所以 preset 继承 preset 读起来就是它本来的那一层叠加。

这就是一个部署能在自己发布的 preset 之上包装出几个命名视图、而不必复制它们的原因。复制保留的是复制那天的提示词、工具集和嵌套 group 配置，原件往前走时什么都不会失败；继承的 preset 挂载的是基底当下的行。

一个 preset 可以先于它继承的那个被声明，两者中任何一个也可以在另一个还在时被撤回。基底缺席时继承它的 preset 以一条点名它的诊断留在损坏状态，而注册表在任何基底注册或撤回时重建每个继承它的 preset，所以声明顺序不属于约定。成环的链以同样方式报告，链上每个 preset 都报。

`read` 与组成清单报告的是继承后的行、而不是声明的差异，因为两者回答的都是这个 preset 实际挂载了什么。贡献在继承解析之后合并，所以被贡献的行排在继承清单之后。

### 被贡献的行

模块 bundle 无法靠打补丁给某个 preset 加一个工具：preset 是一个行，它的 `config.plugins` 持有整份清单，而补丁替换目标行的整个 config。它改为调用 `contribute()`，由注册表把这一行合并进每个声明了 `acceptsContributions: true` 的 preset——那些视图默认，绝不包括官方四种模式所用的那四个 id。

preset 的行里已经点名了同一个插件时，这条贡献被丢掉，继承来的行也算。模块贡献的是那些缺这项能力的 preset 需要的东西，而把它和已声明同一插件的行一起挂载会让同一个工具名注册两次，整个 preset 失败。

被贡献的行 id 必须在 `CONTRIBUTION_ORDERS` 里有中央分配，因为工具目录的顺序是请求前缀的一部分：开着同样模块的两个部署必须产出同样顺序的同一份目录，而到达顺序保证不了这件事。贡献排在 preset 自己声明的行之后，按该分配排序。

启动顺序把模块 bundle 排在声明 preset 的界面 bundle 之后，所以贡献通常在它们挂载之后才到。于是它让每个接收贡献的 preset 的那一代退休并激活新的一代，走的是一个声明自己被撤回时同样的路。已经绑定的 agent 保留退休那一代直到结束；下一个 agent 拿到这一行。会话中途打开一个模块改变的是下一个 agent，不是正在运行的那个。

两个模块争夺同一个行 id，或者行 id 与 preset 已声明的行相撞，都会让重建失败并点名两边。

<a id="further-exploration"></a>
## 延伸阅读

- [Scope](../../core/scope/README.zh.md) — 注册隔离。
- [Agent](../../core/agent/README.zh.md) — 会话运行时。
- [Cordis](../../../docs/cordis-primer.zh.md) — 插件配置与生命周期。

<a id="model-experience"></a>
## 模型体验

### Preset 选择

#### 模型看到的内容

没有直接内容：所选 preset 的 `plugins` 拥有模型可见的工具和提示词片段。

#### Token 影响

本包自身没有；每个挂载的 `plugins` 行声明自己的工具和片段。

#### KV Cache effect

已有 Agent 保留插件和提示词。新 Agent 从当前定义构建前缀。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- preset 不是安全沙箱：YAML 及插件可以执行 Host 代码。用户覆盖替换完整子插件列表，不自动合并内置列表的未来更新。进程退出后不保存旧代际的插件实现。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
