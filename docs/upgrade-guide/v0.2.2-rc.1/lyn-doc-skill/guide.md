---
kind: upgrade-guide
description: "Creator mode replaces its four skills with one `lyn-doc` skill, and the repository documentation skill becomes `lyn-doc-writing`."
---

# `lyn-doc` replaces the Creator mode skills

English | [中文](guide.zh.md)

## Change

Creator mode offered four skills from `@lyness/lyn-agent-preset`: `cordis-plugin-development`, `editing-cordis-compositions`, `cordis-composition-reference`, and `agent-experience`. It now offers one skill, `lyn-doc`. Its former content is in files that `lyn-doc` reads on demand, under `skills/lyn-doc/references/` and `skills/lyn-doc/templates/` of that package. The old skill names no longer appear in the skill catalog, and loading one by name fails.

In a LYN source checkout, the documentation-writing skill `.agents/skills/lyn-doc` is now `.agents/skills/lyn-doc-writing`, named `lyn-doc-writing`.

This affects Creator mode users whose prompts, saved instructions, or own skills name an old skill, and compositions or scripts that read files at the old paths.

## Migration

1. Replace each old skill name in prompts, instructions, and skills with `lyn-doc`; for the source checkout documentation skill, use `lyn-doc-writing`.
2. Replace file paths under `@lyness/lyn-agent-preset/skills/` as follows:

   | Old path | New path |
   |---|---|
   | `cordis-plugin-development/SKILL.md` | `lyn-doc/references/plugin-development.md` |
   | `cordis-plugin-development/references/<file>` | `lyn-doc/references/<file>` |
   | `cordis-plugin-development/templates/<name>/` | `lyn-doc/templates/<name>/` |
   | `editing-cordis-compositions/SKILL.md` | `lyn-doc/references/compositions.md` |
   | `cordis-composition-reference/SKILL.md` | `lyn-doc/references/composition-reference.md` |
   | `cordis-composition-reference/references/packages.md` | `lyn-doc/references/packages.md` |
   | `agent-experience/SKILL.md` | `lyn-doc/references/tool-design.md` |

3. A composition that sets `customSkillDirs` to the package's `skills` directory needs no change.
4. Rename or remove a skill named `lyn-doc` in a project's `.lyn/skills/` or `.agents/skills/`: project skills take precedence and would hide the packaged one. In a LYN source checkout, update the checkout to a revision that contains this change, which renames the repository skill.
5. Start a new Creator mode session with an installation or revision that contains this change, and confirm that the skill catalog lists `lyn-doc` and none of the four skills this package shipped before.
