---
name: prompts
description: Manage the user-editable STYLE blocks for the LLM-driven scripts (ingest-raw, draft-post, concept naming). List which prompts are overridden vs default, view the resolved STYLE + CONTRACT, validate override files. Triggers — "manage prompts", "edit the post-synth prompt", "show me the ingest prompt", "list prompt overrides".
---

# /prompts

Each LLM-driven script has its system prompt split into two halves:

- **STYLE** — voice, tone, banned phrases, length budget. *User-editable* via `prompts/<use>.md`.
- **CONTRACT** — JSON output schema + hard rules (citation enforcement, etc.). *TS-locked* in `src/lib/llm/prompts/<use>.ts`. Always appended at runtime.

This split (Opus outer voice review 2026-05-07) means user edits can't break the JSON contract. Zod validation against the LLM output stays sound regardless of how the user tunes voice.

## Three uses

| Use | Default STYLE in | Override file |
|---|---|---|
| `post-synth` | `src/lib/llm/prompts/post-synth.ts` | `prompts/post-synth.md` |
| `ingest-enrich` | `src/lib/llm/prompts/ingest-enrich.ts` | `prompts/ingest-enrich.md` |
| `concept-naming` | `src/lib/llm/prompts/concept-naming.ts` | `prompts/concept-naming.md` |

## Subcommands

```bash
# 1. list overrides
bun run prompts list

# 2. show resolved STYLE + CONTRACT for one use
bun run prompts show post-synth

# 3. validate all override files
bun run prompts validate
```

## How to override

Create `prompts/<use>.md`:

```markdown
You are an academic synthesizer with strict citation conventions.

Style rules:
- Use formal voice. No first-person.
- Each section ≥ 200 words.
- Cite via [[<slug>|surface]] every claim.
```

Save the file, run `bun run prompts validate` to confirm it parses, then `bun run draft-post ...` (or `ingest-raw`) — it picks up the override automatically. No flag, no flag-parsing, no preset name.

## What overrides cannot do

- Change the JSON output shape (CONTRACT block always wins)
- Skip citation enforcement (CONTRACT-locked)
- Reorder fields (Zod schema enforces)

If you need any of those, edit the TS file directly (and bump the prompt version constant).

## Why no `--preset <name>` flag

Single override per use, no presets in v1. Per Opus outer voice: defer multi-preset support until you actually have two alternatives written and feel the pain. `git diff prompts/` covers history; `git stash`/branches cover A/B experiments.

## Why no `prompts new` scaffolder

Create `prompts/<use>.md` manually. The TS default is already discoverable via `bun run prompts show <use>`.
