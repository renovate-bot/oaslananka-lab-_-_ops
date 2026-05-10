# Agent Fix Loop v2 Design

## Scope

`agent-fix-loop.yml` v2 turns the existing diagnostics/comment loop into a bounded autonomous patch loop for a single pull request.

The workflow runs from `oaslananka-lab/_ops`, mints a GitHub App installation token for one target repository, diagnoses the current PR head, and either posts suggestions or pushes deterministic patches to the same PR branch.

It is not a bulk rollout tool and it is not a general refactoring engine.

## Inputs

```text
target_owner    target repository owner
target_repo     target repository name
pr_number       pull request number
max_iterations  maximum loop iterations, default 5
patch_mode      patch or suggest
```

## Outputs

Artifacts are retained for 14 days:

```text
agent-fix-loop-<owner>-<repo>-<pr>.ndjson
agent-fix-loop-<owner>-<repo>-<pr>.json
iterations/<n>/diagnostics artifact contents
workspace snapshots for patched iterations when available
```

The NDJSON log records one object per iteration. The final JSON report includes:

```text
target
pr_number
patch_mode
max_iterations
final_state
iterations[]
```

## Patchable MVP Classes

The v2 loop may patch only deterministic, low-risk failure classes:

```text
format/lint
workflow syntax
simple permission
action pin update
review-thread patch
missing lockfile
trailing whitespace
```

### format/lint

Supported when the repository exposes standard Node/pnpm commands. The patcher may run:

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm run format
corepack pnpm run lint
```

Only resulting working tree changes are committed.

### workflow syntax

Supported for narrowly identifiable YAML/workflow mistakes such as invalid indentation, duplicate keys, or missing required scalar fields. The patcher may run `actionlint` for evidence and apply a targeted edit.

No broad workflow rewrite is allowed.

### simple permission

Supported when logs identify a missing workflow permission that can be fixed by adding a minimal `permissions` entry to the affected workflow or job.

### action pin update

Supported for known deprecated action tags or unpinned action references when a deterministic pinned replacement is already available in the repository pattern or control-plane policy.

### review-thread patch

Supported only for one-line suggested patches from review comments. Multi-file review requests are treated as non-patchable.

### missing lockfile

Supported when package manager metadata exists and the lockfile update can be generated deterministically.

### trailing whitespace

Supported for whitespace-only cleanup and CRLF to LF normalization.

## Non-Patchable Classes

The loop must report and stop for:

```text
large refactor
semantic bug
release publish
secret rotation
security architecture redesign
multi-repo rollout
untrusted code execution change
test failure with unknown root cause
```

Unknown failures are non-patchable unless a later iteration produces clearer diagnostics.

## Safety Boundaries

The patch loop must:

```text
never push to main or a protected base branch
never create a new branch
never force-push
never merge or approve a PR
never publish packages or releases
never rotate secrets
never patch more than the current PR branch
never continue after a push failure
never commit if there is no diff
```

Git operations run with:

```powershell
GIT_TERMINAL_PROMPT=0
GCM_INTERACTIVE=Never
git -c commit.gpgsign=false commit --no-gpg-sign
```

## Branch Behavior

The loop reads the PR head branch from diagnostics and checks out that exact branch.

Allowed:

```text
headRepositoryOwner == target_owner
headRepository name == target_repo
headRefName is not main/master
baseRefName differs from headRefName
```

Blocked:

```text
fork PRs
main/master head branch
missing head branch
branch owner mismatch
```

## Commit Behavior

Each patch commit uses:

```powershell
git -c commit.gpgsign=false `
  -c user.email="oaslananka-repo-ops[bot]@users.noreply.github.com" `
  -c user.name="oaslananka-repo-ops[bot]" `
  commit --no-gpg-sign -m "fix: auto-patch <classification> in <pr_branch>"
```

The workflow pushes the same PR head branch with a normal `git push`. It never force-pushes.

## Iteration Limit

`max_iterations` is configurable and defaults to `5`.

Invalid or out-of-range values fall back to `5`.

## Stop Condition

The loop stops successfully when diagnostics show:

```text
check_summary.failing == 0
check_summary.pending == 0
run_summary.failures == 0
unresolved_review_threads length == 0
```

The loop also stops when:

```text
classification is non-patchable
patch produces no diff
git push fails
diagnostics cannot be collected
max_iterations is reached
rollback is required
```

## Rollback

If a pushed patch makes the current-head state worse in the next diagnostics run, the loop reverts the last auto-patch commit, pushes the revert to the same PR branch, posts a report comment, and stops.

Worse means either:

```text
failing checks increased
failed workflow runs increased
unresolved review threads increased
```

Rollback uses a normal revert commit. No force-push is allowed.

## Test Plan

Test only on `oaslananka-lab/test` before any boardguard or Group B work.

1. Create a controlled PR with a deterministic format/lint failure.
2. Run v2 in `suggest` mode.
3. Confirm it posts a suggestion comment and does not push.
4. Run v2 in `patch` mode.
5. Confirm it checks out the PR branch, applies a deterministic patch, commits without signing, and pushes the same branch.
6. Watch PR checks.
7. Run `agent-pr-diagnostics.yml`.
8. Confirm zero failing checks, zero pending checks, zero current-head failures, and zero unresolved review threads.

## Audit Artifacts

Every run uploads:

```text
iteration log NDJSON
final report JSON
downloaded diagnostics artifacts per iteration
combined failed logs when present
```

The final report is the source of truth for later control-plane auditing.
