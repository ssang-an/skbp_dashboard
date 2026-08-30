---
name: safe-pull
description: Use when the user wants to git pull / sync with origin but has local uncommitted edits and worries about conflicts (e.g. "git pull 하고 싶은데 로컬 수정사항이랑 충돌 안 나게", "원격 변경사항 가져오고 싶어"). Checks whether the remote's new commits touch the same files as the local uncommitted changes before pulling, and only pulls once it's confirmed safe.
---

# Safe git pull with local uncommitted changes

This repo has no build/test gate on `git pull`, and `json/pipeline-records.json` /
`json/candidate-queue.json` are large, frequently-changing data files (assets, Step 0
큐, 상세페이지 탭2 메모 등) that get edited both through the running app and by hand.
A blind `git pull` while local edits are uncommitted risks a merge conflict or a
silent bad merge. Always verify file-level overlap first.

## Procedure

1. **Snapshot local state.**
   ```
   git status --porcelain=v1
   ```
   Collect every path shown (staged, unstaged, and untracked) — this is the set of
   files the pull must not clobber.

2. **Fetch without merging.**
   ```
   git fetch origin
   ```

3. **Check divergence.**
   ```
   git rev-list --left-right --count HEAD...origin/main
   ```
   Output is `<local-ahead>\t<remote-ahead>`.
   - If remote-ahead is 0: nothing to pull, stop and tell the user.
   - If local-ahead is 0: local is a strict ancestor of origin/main → a pull will
     fast-forward (simplest, safest case).
   - If both are non-zero: local has its own commits too → a pull will actually
     merge two histories, not just fast-forward. Still do the file-overlap check
     below, but tell the user explicitly that a real merge (not a fast-forward)
     will happen, since that's a materially different, less reversible operation.

4. **List what the remote actually changed.**
   ```
   git diff --stat HEAD..origin/main --name-only
   ```
   (Use `HEAD` here, not a manually-found merge-base — `HEAD..origin/main` already
   restricts to origin's new commits relative to the current branch tip.)

5. **Compare the two file lists.**
   Intersect the remote-changed paths (step 4) with the local-touched paths (step 1).
   - **No overlap** → safe. Proceed to step 6.
   - **Overlap exists** → do NOT pull automatically. Report exactly which file(s)
     overlap and what changed on each side (`git diff <file>` locally,
     `git diff HEAD..origin/main -- <file>` for remote). Ask the user how they want
     to proceed (e.g. stash local changes first, commit locally first, or manually
     reconcile that one file) rather than guessing.

6. **Pull.**
   ```
   git pull origin main
   ```
   Prefer a plain `git pull` (merge, not rebase) unless the user has asked for
   rebase workflow elsewhere — this repo's history so far uses merge commits.

7. **Confirm and report.**
   ```
   git status
   ```
   Report to the user: which remote commit(s) were pulled in, which files they
   touched (call out data files like `json/pipeline-records.json` /
   `json/candidate-queue.json` by name since that's usually "assets"/메모 data the
   user cares about), and confirm the local uncommitted files listed in step 1 are
   still present and untouched.

## Notes

- This is a git-sync operation, not a code/content edit — it does not need a
  `docs/changelog/YYYY-MM-DD.md` entry per the repo's post-edit-log convention,
  unless the pull is bundled with other edits in the same turn.
- If step 3 shows local-ahead > 0 (real merge, not fast-forward) even with no file
  overlap, git can usually still auto-merge cleanly, but call this out before
  running step 6 since a merge commit is harder to undo than a fast-forward.
- Never resolve an overlap by discarding the local uncommitted changes
  (`git checkout --`, `git restore`, `git reset --hard`) without the user's
  explicit go-ahead — those changes may be in-progress work.
