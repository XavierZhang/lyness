---
kind: upgrade-guide
description: "The Session-log upload ships off and its Settings row is not mounted; a deployment that wants it turns the field on."
---

# Session-log upload off by default

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-base` sets `enabled: false` on the `session-log-deepseek` row, and `@deepseek-ai/dsh-web-app` no longer mounts `@deepseek-ai/dsh-client-ui-settings-session-log`. Nothing uploads, and Settings offers no preference for it.

The upload is not a separate request: the log rides the model request as the `dsh_session_log` field, so it reaches whoever serves the official model API rather than this project. A product shipped under its own brand does not send its users' sessions to an upstream vendor by default, and a preference that says "help improve" without naming the recipient does not make that choice informed.

The uploader stays composed, so turning it back on is one field. The Settings row stays published, so a deployment that turns the upload on can mount the row and let its people opt out.

## Migration

1. A deployment that wants the upload sets `enabled: true` on the `session-log-deepseek` row in its own patch layer.
2. A deployment that wants its people to control it also inserts the `ui-settings-session-log` client row, which publishes the Settings preference; the row appears only while the Host serves that namespace.
3. Start the app and confirm the General Settings page offers no Session-log row, and that `settings/describe` reports `session-log-deepseek` with `enabled: false`.
