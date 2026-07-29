---
name: post-edit-log
description: Use right after finishing any code/content edit in this repo (dashboard HTML/JS/CSS, main.py, scripts, obsidian exporters). Adds a short end-of-turn comment on what changed and appends a dated entry to docs/CHANGELOG.md so every agent session leaves a durable trail.
---

# Post-edit change log

Applies to every coding session in this repo, run by any agent. After finishing a set of edits (a single fix, a small feature, a polish pass — whatever the user asked for), before ending the turn:

1. **Comment on what changed.** In the final reply to the user, state plainly what was modified and where (file names, and line numbers or function/selector names when useful). Keep it to 1-3 sentences — this is the existing "what changed / what's next" closing style used in this repo, not a new format.
2. **Log it.** Append one entry to `docs/CHANGELOG.md` in the repo root. If the file doesn't exist yet, create it with the header shown below.

Do this for real code/content changes. Skip it for pure read-only investigation, answering questions, or throwaway scratch/experiment work that isn't being kept.

## Entry format

One `##` section per calendar date (reuse the same date section if it already exists from earlier that day), then one bullet per distinct change:

```markdown
# Changelog

## 2026-07-29
- `src/app.js`, `index.html`: reworded the TAB1/2/3 selector labels and redesigned the tab bar (numbered step badges + eyebrow/label groups).
- `src/app.js`, `src/styles.css`, `detail.html`, `src/detail.js`: replaced the "TAB3 추가" text button with an icon-only star (☆/★) favorite toggle.
- `index.html`, `src/styles.css`: moved the tab selector out of a centered floating position into its own row flush under the panel title.
```

Guidelines:
- Terse, factual, past tense. No design rationale essays — this is a log, not a doc.
- Group by files touched, not by every micro-edit; one bullet per user-visible or structurally meaningful change is enough.
- Use the current date from context (convert "today"/relative dates to `YYYY-MM-DD`).
- Always append — never delete or rewrite prior entries, never start a second changelog file.
