---
name: git-add-commit-push-all
description: Use when the user wants to stage every pending change in this repo, commit it with a descriptive message, and push to origin in one go (e.g. "지금까지 변경사항 다 git push 해줘", "commit and push everything"). Screens for secrets before staging, matches this repo's commit style, and never force-pushes.
---

# git add / commit / push — all in one pass

Stage all pending changes (tracked + untracked), commit with a message that
reflects what actually changed, and push to the remote tracking branch —
without stopping to ask, unless something looks unsafe.

## Procedure

1. **Survey the repo state** (run in parallel):
   ```
   git status --porcelain=v1
   git diff
   git diff --staged
   git log --oneline -10
   ```
   `git log` establishes this repo's commit-message style (imperative, short
   Korean/English mixed subject lines — match what's already there).

2. **Screen before staging.** Scan the changed/untracked file list for:
   - Secrets: `.env`, `credentials.json`, `*.pem`, `*.key`, API keys/tokens
     pasted into a diff.
   - Anything that looks like another concurrent session's in-progress work
     you don't recognize — this repo is edited by multiple sessions; don't
     silently sweep up unrelated changes without flagging them.
   If anything suspicious turns up, exclude it from staging and tell the user
   why instead of committing or silently dropping it.

3. **Stage everything else.**
   ```
   git add -A
   ```
   (Acceptable here since the user explicitly asked for "all" — but only
   after step 2's screening.)

4. **Draft the commit message from the actual staged diff**, not guesswork:
   - 1-3 sentences, focused on *why*, matching this repo's existing style.
   - Pass it via a heredoc (bash) / here-string (PowerShell), never inline
     `-m "..."` with embedded newlines.
   - End with:
     ```
     Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
     ```

5. **Commit.** No `--amend`, `--no-verify`, `--no-gpg-sign` unless the user
   explicitly says so. If a pre-commit hook fails, fix the root cause,
   re-stage, and create a **new** commit — don't bypass the hook.

6. **Push.**
   - Branch already tracks a remote → `git push`.
   - No upstream yet → `git push -u origin <current-branch>`.
   - Never force-push (`--force` / `--force-with-lease`) unless explicitly
     asked, and warn if that target is `main`.

7. **Confirm.**
   ```
   git status
   git log --oneline -1
   ```
   Report back concisely: files committed, one-line summary of the message,
   and confirmation the push landed on the remote.

## When to stop and ask instead of proceeding

- Clean working tree, nothing to commit — say so, don't create an empty commit.
- A staged file's contents actually look like a real secret.
- The push would need a force-push, especially to `main`.
- Repo is mid-rebase, mid-conflict, or in detached HEAD — surface it, don't
  work around it.

## Notes

- This is a git-sync operation. Per this repo's `CLAUDE.md`, a
  `docs/changelog/YYYY-MM-DD.md` entry is only needed for the persistent
  content/code changes being committed — not for the act of committing/pushing
  itself. If the changes being pushed haven't been logged yet, add that entry
  as part of this same pass, before committing.
