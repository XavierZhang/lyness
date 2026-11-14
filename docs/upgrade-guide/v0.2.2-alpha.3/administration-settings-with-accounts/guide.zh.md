---
kind: upgrade-guide
description: "登录渠道、成员、机器人与历史四个设置页随 dsh-module-accounts 出货，不再随 dsh-web-app。"
---

# 管理类设置页跟随账户平面

[English](guide.md) | 中文

## 变更

四个设置页从 `@deepseek-ai/dsh-web-app` 移到 `@deepseek-ai/dsh-module-accounts`：登录渠道、成员、机器人与历史。它们读的是账户平面——`remote.signInChannels`、`remote.people`、`remote.bots` 与 `remote.audit`——而只有那个模块的 controller 提供这些命名空间。

列了 `@deepseek-ai/dsh-module-accounts` 的 profile（包括出货的 `enterprise` 与 `hosted` 模板）没有变化：这些页面随模块一起到来，与应答它们的 controller 在一起。没有列它的 profile（包括出货的 `web` 模板）不再承载这四个页面。它本来也没有真正提供过：这些页面注入了无人挂载的命名空间，于是 Cordis 把它们停泊，内置插件页报出一条重试永远不会成功的同步失败。

`@deepseek-ai/dsh-api-remotes` 现在挂载 `announcements`、`credits`、`identity`、`people`、`bots`、`audit` 与 `signInChannels` 七个命名空间，所以注入它们的页面在各自 controller 被组合进来的地方都能激活。

## 迁移

1. 想要这四个页面的部署，在自己 profile 的 bundle 清单里列上 `@deepseek-ai/dsh-module-accounts`，它同时带来这些页面读的 controller。
2. 在补丁层里按 id 点名过这四行之一的组成，把那条补丁改为指向 `module-accounts` 里的那一行，行 id 没有变（`ui-settings-sign-in-channels`、`ui-settings-people`、`ui-settings-bots`、`ui-settings-history`）。
3. 打开设置，确认这四个页面在组合了账户平面的地方出现，并确认内置插件页不再报同步失败。
