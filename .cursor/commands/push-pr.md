---
description: Commit the current changes, push them to GitHub, and open a pull request.
---

Commit the current work, push it to GitHub, and open a pull request.

## Safety

- Do not update git config.
- Do not skip hooks.
- Do not force-push, and do not rewrite history that has already been pushed.
- Do not commit secrets. Leave `.env` and credential files unstaged, and warn if they were requested.
- Commit only when this command is run. Do not push an empty commit.

## Commit

1. In parallel, inspect `git status`, `git diff` (staged and unstaged), and recent `git log` so the message matches this repository.
2. Stage the relevant files, including untracked files that belong to the change.
3. Write a 1–2 sentence message that states why the change exists.
4. If a hook modifies files, fix the problem and create a new commit. Do not amend a failed or rejected commit.

## Pull request

1. In parallel, inspect status, the full diff, tracking state, and `git log` plus the diff from the base branch.
2. If the current branch is `main` or `master`, create a descriptive branch first.
3. Push with `git push -u origin HEAD`.
4. Create the pull request with `gh pr create`. The body must use this shape:

```markdown
## Summary
- <1–3 bullets explaining why the change exists>

## Test plan
- [ ] <how to verify the change>
```

5. Return the pull request URL.
