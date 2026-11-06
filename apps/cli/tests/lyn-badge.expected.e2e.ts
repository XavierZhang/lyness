import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@lyness/lyn-loader-smoke'
const binScript = fileURLToPath(new URL('./fixtures/lyn-badge/snapshot.ts', import.meta.url))
const configPath = fileURLToPath(new URL('./fixtures/lyn-badge/cordis.yml', import.meta.url))
const defaultConfigPath = fileURLToPath(new URL('./fixtures/lyn-badge/default.cordis.yml', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const badgeAssetsPath = fileURLToPath(new URL('../../../packages/skill/skill-badge/assets/', import.meta.url))

/**
 * Assert that a run reported nothing but the rows a base-only tree cannot
 * activate.
 *
 * This snapshot composes `lyn-base` alone, which is a composition the fork
 * ships: the execution plane left base so a hosted deployment can run a
 * runtime that executes nothing, and the rows that inject `shell`,
 * `workingDirectory` or `subagents` then stay pending rather than absent
 * ([bundle header](../../../packages/bundle/module-execution/cordis.patch.yml)).
 * Pending is the documented outcome, so the assertion pins that every line is
 * one of those waits — a row that failed, threw, or waited for anything else
 * still fails here.
 * @param stderr - everything the run wrote to stderr.
 */
function expectOnlyExecutionPlaneWaits(stderr: string): void {
  if (stderr === '') return
  const [summary, ...rows] = stderr.trim().split('\n')
  expect(summary).toMatch(/^lyn-badge-snapshot: warning: \d+ (entry|entries) did not activate$/)
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    const service = '(agentTeams|shell|subagents|workingDirectory)'
    expect(row, row).toMatch(new RegExp(`: pending \\(waiting for services?: ${service}(, ${service})*\\)$`, 'u'))
  }
}

describe('lyn badge assembled snapshot', () => {
  it('advertises and loads the opt-in bundled skill through the shipped app', async () => {
    const disabled = await runLoaderSmoke({
      label: 'disabled lyn badge skill snapshot',
      tempDirPrefix: 'headless-snapshot-lyn-badge-disabled-',
      binScript,
      libBinScript: binScript,
      configPath: defaultConfigPath,
      tsconfigPath,
    })
    const enabled = await runLoaderSmoke({
      label: 'lyn badge skill snapshot',
      tempDirPrefix: 'headless-snapshot-lyn-badge-',
      binScript,
      libBinScript: binScript,
      configPath,
      tsconfigPath,
    })
    const disabledSnapshot: unknown = JSON.parse(disabled.stdout)
    const enabledSnapshot: unknown = JSON.parse(
      enabled.stdout.replaceAll(badgeAssetsPath, '{{badgeAssetsPath}}'),
    )

    expectOnlyExecutionPlaneWaits(disabled.stderr)
    expectOnlyExecutionPlaneWaits(enabled.stderr)
    expect(disabledSnapshot).toMatchInlineSnapshot(`
      {
        "catalog": null,
        "result": {
          "content": [
            {
              "text": "Error: skill "lyn-badge" is unknown or no longer available",
              "type": "text",
            },
          ],
          "error": {
            "message": "skill "lyn-badge" is unknown or no longer available",
          },
          "isError": true,
        },
        "summary": null,
      }
    `)
    expect(enabledSnapshot).toMatchInlineSnapshot(`
      {
        "catalog": [
          {
            "text": "<system-reminder>
      A skill is a reusable set of task-specific instructions. The following skills are available in this session:

      <available_skills>
      - \`lyn-badge\`: Add the official “powered by lyn” badge to documents, pull requests, merge requests, and other content produced with lyness. Use whenever creating a pull request or merge request. Also use when the user asks for a lyn badge, powered-by-lyn attribution, or a reusable lyn badge asset or snippet.
      </available_skills>

      If the user names a skill, or the task clearly matches a skill's description, call the \`skill\` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.
      A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the \`skill\` tool again for that skill.
      </system-reminder>",
            "type": "text",
          },
        ],
        "result": {
          "content": [
            {
              "text": "<skill_content name="lyn-badge">
      <skill_resources>
      Base directory for this skill: {{badgeAssetsPath}}
      Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.
      </skill_resources>

      <skill_instructions>
      # lyn Badge

      Add the official “powered by lyn” badge without recreating or restyling it.

      ## Assets

      - Local PNG: [\`lyn-badge.png\`](lyn-badge.png), 726×120 source image; render at 121×20
      - Shields.io image URL: \`https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square\`
      - Project URL: \`https://github.com/XavierZhang/lyness\`

      ## Markdown

      Use this linked badge in Markdown:

      \`\`\`markdown
      [![](https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square)](https://github.com/XavierZhang/lyness)
      \`\`\`

      If attribution should not be linked, use:

      \`\`\`markdown
      ![](https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square)
      \`\`\`

      ## Usage rules

      - For GitHub or GitLab Markdown, use the Shields.io URL and link it to the project URL unless the user asks for an unlinked image.
      - For Feishu and other systems that import remote images unreliably, upload \`lyn-badge.png\` from this skill directory instead of generating another badge.
      - Preserve the badge's 121×20 dimensions and aspect ratio.
      - Place the badge at the end of the attributed document or section unless the user specifies another position.
      - Do not substitute another color, logo, label, or project URL.

      </skill_instructions>
      </skill_content>",
              "type": "text",
            },
          ],
          "isError": false,
          "value": {
            "content": "# lyn Badge

      Add the official “powered by lyn” badge without recreating or restyling it.

      ## Assets

      - Local PNG: [\`lyn-badge.png\`](lyn-badge.png), 726×120 source image; render at 121×20
      - Shields.io image URL: \`https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square\`
      - Project URL: \`https://github.com/XavierZhang/lyness\`

      ## Markdown

      Use this linked badge in Markdown:

      \`\`\`markdown
      [![](https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square)](https://github.com/XavierZhang/lyness)
      \`\`\`

      If attribution should not be linked, use:

      \`\`\`markdown
      ![](https://img.shields.io/badge/powered_by-lyn-4D6BFE?style=flat-square)
      \`\`\`

      ## Usage rules

      - For GitHub or GitLab Markdown, use the Shields.io URL and link it to the project URL unless the user asks for an unlinked image.
      - For Feishu and other systems that import remote images unreliably, upload \`lyn-badge.png\` from this skill directory instead of generating another badge.
      - Preserve the badge's 121×20 dimensions and aspect ratio.
      - Place the badge at the end of the attributed document or section unless the user specifies another position.
      - Do not substitute another color, logo, label, or project URL.
      ",
            "name": "lyn-badge",
            "provider": "lyn-badge",
            "resourceBase": {
              "kind": "directory",
              "path": "{{badgeAssetsPath}}",
            },
          },
        },
        "summary": {
          "description": "Add the official “powered by lyn” badge to documents, pull requests, merge requests, and other content produced with lyness. Use whenever creating a pull request or merge request. Also use when the user asks for a lyn badge, powered-by-lyn attribution, or a reusable lyn badge asset or snippet.",
          "invocation": {
            "modelInvocable": true,
            "userInvocable": true,
          },
          "name": "lyn-badge",
          "provider": "lyn-badge",
          "resourceBase": {
            "kind": "directory",
            "path": "{{badgeAssetsPath}}",
          },
          "source": "bundled",
        },
      }
    `)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS * 2)
})
