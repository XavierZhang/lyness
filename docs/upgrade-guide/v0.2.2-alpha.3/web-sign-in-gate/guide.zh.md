---
kind: upgrade-guide
description: "Web 客户端在这个安装能够接到模型之前用登录弹窗盖住产品；额度设置页随额度模块出货。"
---

# 先登录再进产品，额度页跟随它的账本

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-client-ui-settings-account` 接受 `requireSignIn`，`@deepseek-ai/dsh-web-app` 打开了它。开启后，登录弹窗盖住产品、而不是与它并列——但只在**两件事同时成立**时：没有人登录，并且没有可用模型。任何 `llm-*` 设置命名空间里点名的提供商都算「可用」，包括密钥来自环境变量、因此没有存下任何密钥的那种，所以已经能跑任务的安装绝不会被盖住。覆盖态弹窗的次要按钮放这个人进去一次，让他们能到设置里添加密钥；什么都不写入，下次加载仍会再问，直到存在凭据为止。该字段默认关闭，其他 profile 行为不变。

`credits` 设置分区从 `@deepseek-ai/dsh-web-app` 移到 `@deepseek-ai/dsh-module-credits`。没有账本时这个命名空间回答 `credits/anonymous`，于是不计量的部署看到的是一个只装着这条拒绝的分区。`credits` Remote 命名空间仍然在每个部署上挂载，与此前一致。

## 迁移

1. 希望没有任何凭据时产品也可用的部署，在自己的补丁层给 `ui-settings-account` 行写 `requireSignIn: false`。
2. 希望保留额度分区的部署，在自己 profile 的 bundle 清单里列上 `@deepseek-ai/dsh-module-credits`；出货的 `hosted` 模板已经列了。
3. 在没有配置任何凭据的情况下启动 Web 客户端，确认登录页盖在产品之上；配置一个提供商后，确认它不再出现。
