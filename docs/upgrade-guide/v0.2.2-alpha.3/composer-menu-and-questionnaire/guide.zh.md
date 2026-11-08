---
kind: upgrade-guide
description: "composer 菜单可以由部署决定不列出哪些命令；意见反馈入口只在部署配置了自己的问卷时出现。"
---

# 由部署决定的 composer 菜单，以及不再有默认问卷

[English](guide.md) | 中文

## 变更

`@lyness/lyn-client-ui-commands` 接受 `menuHidden`：composer 菜单在空查询下不列出的命令名。被点名的命令仍可键入 `/<name>`、仍参与键入查询的排序、仍能执行——撤下的只是那一行，用于界面已经以别的方式提供该命令的场合。`@lyness/lyn-web-app` 隐藏了 `permission` 与 `model`，它们在本产品里是 composer 下方的座位。默认不隐藏任何一行。

`@lyness/lyn-client-ui-settings-account` 的 `contactFormUrl` 现在默认为空，而空值会撤下账号菜单里的「意见反馈」入口。它此前默认指向一份本项目并不拥有的问卷，而这个 URL 会把已登录账号、构建版本与设备描述交给问卷的拥有者。希望保留该入口的部署点名自己的 HTTPS 表单。

## 迁移

1. 希望保留「意见反馈」入口的部署，在自己的 `ui-settings-account` 行上把 `contactFormUrl` 设成自己的 `https://` 问卷。
2. 希望恢复全部命令行的部署，清空自己 `ui-commands` 行上的 `menuHidden`，或只列出确实想撤下的名字。
3. 打开 composer 菜单核对行；打开账号菜单，确认「意见反馈」入口与是否配置了表单一致。
