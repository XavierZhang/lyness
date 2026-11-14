---
kind: upgrade-guide
description: "Web 组成对外提供两个 agent 视图 work 与 build，官方四个模式 id 仍注册但不再对外提供。"
---

# 对外提供两个 agent 视图

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-web-app` 向开始任务的人提供两个 preset：日常办公用 `work`，开发用 `build`。`standard`、`ptc`、`minimal` 与 `cordis` 四个 id 现在声明 `offered: false`。它们仍然注册、仍然可解析、仍然可挂载——以它们之一记录的会话照旧重开，`agentPresets.resolve('ptc')` 照旧应答——但人用的界面一个都不列出它们：选择芯片、agent 预设设置页与内置插件页读的是同一份已过滤的名册，因为 `AgentPresetRegistry.remoteExportList` 在生产者一侧就过滤掉了。

注册表默认值从 `standard` 移到 `work`。保存成那四个不提供 id 之一的个人默认值被忽略、改用部署默认值，所以带着 `selectedDefault: ptc` 的 profile 不会再把每个新任务开在自己菜单里没有的模式上。没有任何声明承载的保存值照旧生效，与此前一致。

`work` 与 `build` 不再复述自己的行。`work` 声明 `extends: standard`、`build` 声明 `extends: cordis`，各自只带差异：行 id 与基底某一行相同的原地替换它，其余每一行排在基底清单之后。于是两个视图挂载的是基底模式当下的行，升级给基底加的行也包含在内。

`PresetDefinition` 新增 `extends` 与 `offered`；`@deepseek-ai/dsh-agent-preset` 的 config 接受这两个字段。preset 的行里已经点名了同一插件的贡献被丢掉，所以继承了声明 `@deepseek-ai/dsh-tool-present` 的模式的视图不会再同时拿到 deliverables 模块那一份。

## 迁移

1. 想把那四个 id 之一放到人面前的部署，在自己的补丁层给那个 `@deepseek-ai/dsh-agent-preset` 行写 `offered: true`。
2. 注册表行还写着 `default: standard` 的部署改成 `default: work`，或任何它对外提供的 id；不提供的默认值会把一个未列出的模式放在每个新会话前面。
3. 复制过 `work` 或 `build` 再改某一行的组成，把这份副本换成 `extends` 加上自己改的那几行，其余删掉。
4. 启动 Web 应用读名册：`agentPresets/list` 只应答 `work`（默认）与 `build`，两者都不带 `broken`。
