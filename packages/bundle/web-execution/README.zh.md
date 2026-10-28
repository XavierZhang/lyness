---
description: "Web 执行面自成一个 bundle：执行模块插入的宿主面工具行，移到每会话预设背后。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-web-execution

[English](README.md) | 中文

## 概述

`dsh-web-execution` 把执行模块插入的宿主面 shell、文件系统、workflow 与 ralph 行禁用掉，因为 Web profile 的预设会按会话、按 agent 重新加上它们。它自成一个 bundle，是因为这次搬移需要两半都在：只有 Web 界面、没有执行模块的 profile，既没有那些行、也没有那些预设，而一份点名不存在的行的补丁，每次开机都会按行报出缺席。

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

profile 在两半之后选上它：

```yaml
bundles:
  - '@deepseek-ai/dsh-module-execution'
  - '@deepseek-ai/dsh-web-app'
  - '@deepseek-ai/dsh-web-execution'
```

随产品发布的 `web` 与 `enterprise` 模板正是这么做的。`hosted` 模板不选执行模块，也就不选这一个。

-----

<a id="understand-the-implementation"></a>
## 理解实现

**补丁层说不出「存在才禁用」。** 点名一行不存在的行会被报出来，而不是被跳过——这是对的默认：否则 id 里的一个笔误就会无声无息。所以「两个 bundle 同时选中才成立」的那些行，就与两者一起被选中，而不是去教组合器忽略它找不到的东西。

**是禁用，不是删除。** 基础组合是共享的；被某个界面覆盖层删掉的行，会在有人重排层序的那一天悄悄回来。

**`shell-env` 留在宿主面。** Web 应用注入它来发布 `DSH_WEB_URL` 与 `DSH_WEB_MODE`，而注入服务的行在任何会话存在之前就已解析，没有 agent 可供归属。放进预设 realm 之后，这些变量根本到不了模型的 shell。

-----

<a id="further-exploration"></a>
## 延伸阅读

- [`dsh-module-execution`](../module-execution/README.zh.md) —— 本 bundle 所搬移的那些行。
- [`dsh-web-app`](../web-app/README.zh.md) —— 按会话重新加上它们的那些预设。

-----

<a id="model-experience"></a>
## 模型体验

间接存在，经由编排：到达模型的还是同样那些工具，只不过由它所在会话选中的预设挂载，而不再由宿主面挂载，所以它们的 schema 与结果都不变。

#### KV 缓存影响

请求前缀不变，因为本 bundle 禁用的那些行本身不贡献任何指令。

## 已知限制与未竟事项

<a id="known-limitations-and-deferred-work"></a>

- **靠手选，而不是推导出来的** —— 没有任何东西检查「两半都有的 profile 也选了这个 bundle」；漏选的那个会把 shell 与文件系统工具跑在宿主面上，而那正是本 bundle 要防的形态。

**运行时不变量：** 不发布伴生检查。bundle 贡献的是编排行；值得断言的关系属于这些行挂起来的那些包。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 —— 点击展开</summary>

这些行原本住在 `dsh-web-app` 里，直到 hosted 模板——有 Web 界面、没有执行模块——让它们每次开机都点名七行并不存在的行。

</details>
