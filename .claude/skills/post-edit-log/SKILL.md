---
name: post-edit-log
description: Use right after finishing any persistent code, content, configuration, or documentation edit in this repo. Adds a required final change summary and appends a concise entry to the date-based work log so every agent session leaves a durable trail.
---

# Post-edit change log

Applies to every editing session in this repo, run by any agent. After finishing a set of persistent edits and before ending the turn:

1. **Summarize what changed.** End the final reply with a `변경 요약` section. State plainly what was modified and where (file names, and line numbers or function/selector names when useful), plus verification performed when applicable.
2. **Log it by date.** Append one entry to `docs/changelog/YYYY/YYYY-MM-DD.md`, using the current local date. Reuse the existing daily file and append under `## Changes`. If it does not exist, create it from the template below.
3. **Keep the index current.** Ensure the year/date link exists in `docs/CHANGELOG.md`. That file is navigation only; detailed entries never go there.

Do this for real code, content, configuration, and documentation changes. Skip it for pure read-only investigation, answers, or throwaway experiments that are not kept.

## Daily file format

```markdown
# Work Log — 2026-08-01

## Changes

- `src/app.js`, `index.html`: reworded the selector labels and redesigned the tab bar.
- `src/app.js`, `src/styles.css`: replaced the text action with an icon-only favorite toggle.
```

Guidelines:

- Terse, factual, past tense. This is a log, not a design rationale document.
- Group by files touched, not by every micro-edit; one bullet per user-visible or structurally meaningful change is enough.
- Use the current local date from context and format it as `YYYY-MM-DD`.
- Always append to that date's file; never delete or rewrite prior entries and never start a second file for the same date.
- Keep each daily file focused on work performed that day. Do not mix multiple dates in one file.
