---
kind: upgrade-guide
description: "The composer menu can leave named commands out, and the Feedback entry appears only where a deployment configured its own questionnaire."
---

# A composer menu a deployment chooses, and no default questionnaire

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-client-ui-commands` accepts `menuHidden`: command names the composer menu leaves out when it opens with no query. A hidden name is still typed as `/<name>`, still ranked for a typed query, and still executes — only the row is withdrawn, for a surface that already offers the command another way. `@deepseek-ai/dsh-web-app` hides `permission` and `model`, which are seats under the composer in this product. The default hides nothing.

`contactFormUrl` on `@deepseek-ai/dsh-client-ui-settings-account` now defaults to empty, and an empty value withdraws the account menu's Feedback entry. It previously defaulted to a questionnaire this project does not own, and the URL carries the signed-in account, the build and the device description to whoever does. A deployment that wants the entry names its own HTTPS form.

## Migration

1. A deployment that wants the Feedback entry sets `contactFormUrl` on its `ui-settings-account` row to its own `https://` questionnaire.
2. A deployment that wants every command row back clears `menuHidden` on its `ui-commands` row, or lists only the names it does want withdrawn.
3. Open the composer menu and confirm the rows; open the account menu and confirm the Feedback entry matches whether a form is configured.
