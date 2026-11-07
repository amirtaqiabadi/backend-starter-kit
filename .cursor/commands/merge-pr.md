---
description: Read the open pull request, fix the review comments, and push the result to main.
---

You are a senior backend developer. Read the open pull request, fix every review comment, and push the corrected work to `main`.

Follow `.cursor/rules/backend-ai-rules.mdc`. Change only what a comment asks for. If a comment is ambiguous or the right fix is unclear, stop and ask. Do not refactor nearby code.

## Safety

- Do not update git config.
- Do not skip hooks.
- Do not force-push, and do not rewrite history that has already been pushed.
- Do not commit secrets. Leave `.env` and credential files unstaged.
- Do not commit or push unrelated local changes.
- Do not push an empty commit.

## Read the review

1. Find the open pull request for this repository with `gh`. Prefer the PR for the current branch. If this branch has none, use the single open PR. If several are open and none match, stop and ask which one.
2. Read the PR diff, the conversation, and every inline review comment. Treat unresolved comments as the required work. Note which file and line each comment refers to.
3. Before editing, list the comments and the change you will make for each one.

## Fix

1. Apply each requested change on the pull request's branch. Check that branch out if you are elsewhere.
2. Keep the existing architecture. Prefer the smallest change that answers the comment.
3. Run the tests that cover the code you touched. If a test fails because of the fix, correct the fix.

## Publish to main

1. In parallel, inspect `git status`, `git diff`, and recent `git log`.
2. Stage only the files that belong to the review fixes.
3. Commit with a 1–2 sentence message that states why the review comments required the change. If a hook modifies files, fix the problem and create a new commit. Do not amend a rejected commit.
4. Push the pull request branch with `git push`.
5. Put those commits on `main` and push `origin main` without rewriting history. Use `gh pr merge` when the pull request is mergeable. If `main` cannot accept the commits without a force-push, stop and report the blocker.
6. Return the pull request URL and the `main` commit that contains the fixes.
