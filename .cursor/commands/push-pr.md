---
description: Commit changes, push to GitHub, and create a pull request.
---

Commit the current changes, push the branch, and create a pull request.

## Rules

- Never change git config, skip hooks, force-push, or rewrite pushed history.
- Never stage or commit secrets (`.env`, credentials, and similar). Warn if committing them was requested.
- Commit only when this command is run. Never create an empty commit.
- Do not amend commits. If a hook rejects a commit, fix the problem and create a new commit.
- Stage only files that belong to the change. Leave unrelated work unstaged.
- If any step fails, stop and report the issue. Do not claim success.

## Workflow

1. Inspect `git status`, staged and unstaged diffs, recent commits, and branch tracking. Match the commit message to this repository's style.
2. If the current branch is `main` or `master`, create a descriptive feature branch before committing.
3. Stage the relevant changed and untracked files.
4. Commit with a 1–2 sentence message that states why the change exists.
5. Review the full diff against the base branch and verify the working tree. Confirm no secrets are included.
6. Push with `git push -u origin HEAD`.
7. Create the pull request with `gh pr create`. Use this body:

```markdown
## Summary
- <1–3 bullets explaining why the change exists>

## Test plan
- [ ] <how to verify the change>
```

8. Return the pull request URL.
