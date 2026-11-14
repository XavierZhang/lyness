---
kind: upgrade-guide
description: "Session Log 上传默认关闭，其设置行也不再挂载；想要的部署把那个字段打开。"
---

# Session Log 上传默认关闭

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-base` 给 `session-log-deepseek` 行写了 `enabled: false`，`@deepseek-ai/dsh-web-app` 不再挂载 `@deepseek-ai/dsh-client-ui-settings-session-log`。没有任何上传，设置里也不再提供这个选项。

这项上传不是单独的请求：日志作为 `dsh_session_log` 字段挂在模型请求里，因此它到达的是**提供官方模型 API 的那一方**，而不是本项目。以自己品牌出货的产品不应默认把用户的会话送给上游厂商，而一句不点名接收方的「帮助改进」也不构成知情选择。

上传插件仍然组合在内，所以重新打开只是一个字段。设置行也仍然发布，所以打开上传的部署可以把那一行挂上，让自己的使用者有地方关掉它。

## 迁移

1. 想要这项上传的部署，在自己的补丁层给 `session-log-deepseek` 行写 `enabled: true`。
2. 想让使用者自己控制的部署，再插入 `ui-settings-session-log` 客户端行，它发布设置里的那个选项；该行只在 Host 服务这个命名空间时出现。
3. 启动应用，确认通用设置里没有 Session Log 那一行，并确认 `settings/describe` 报告 `session-log-deepseek` 的 `enabled: false`。
