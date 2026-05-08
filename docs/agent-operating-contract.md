# Agent Operating Contract

This document defines the mandatory operating loop for repository agents controlled from `oaslananka-lab/_ops`.

## Core principle

The agent must not stop after making a partial change. The required loop is:

```text
diagnose -> patch -> local verify -> push -> watch checks -> fix review threads -> repeat -> final re-audit
```

A task is not complete until the target PR has:

```text
- zero failing checks
- zero pending required checks
- zero unresolved review threads
- no deterministic failed workflow logs for the current PR head SHA
- a clean final diagnostics artifact
```

## Repository control-plane

All cross-repository automation must be launched from:

```text
oaslananka-lab/_ops
```

Target repositories must not store the GitHub App private key unless explicitly required for a repo-local smoke test.

## Required diagnostics step

Before patching a PR, run:

```powershell
gh workflow run .github/workflows/agent-pr-diagnostics.yml `
  --repo oaslananka-lab/_ops `
  --ref main `
  -f target_owner=<owner> `
  -f target_repo=<repo> `
  -f pr_number=<number>
```

Then download and inspect:

```text
diagnostics.json
agent-next-step.md
unresolved-review-threads.json
failed-run-logs/
runs-current-head.json
```

The agent must use `diagnostics.json` as the source of truth.

## Current-head rule

Only workflow runs matching the PR `headRefOid` are actionable.

Branch-history failures are informational only and must not be treated as current blockers.

## Patch discipline

The agent must:

```text
- use the existing PR branch
- avoid extra branches unless explicitly instructed
- avoid extra PRs unless explicitly instructed
- avoid unrelated refactors
- patch the smallest deterministic failure first
- apply actionable review-thread suggestions before inventing alternative fixes
- preserve existing release/publish behavior unless the task is specifically release-related
```

## Local verification

Before pushing, the agent must run the repository’s local verification commands.

For Node/pnpm repositories, preferred order:

```powershell
corepack enable
corepack prepare pnpm@11.0.8 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm run format:check
corepack pnpm run lint
corepack pnpm test
```

If a script does not exist, record that fact in the PR comment or task summary and continue with the available scripts.

## Check watching

After pushing, the agent must watch checks:

```powershell
gh pr checks <pr_number> `
  --repo <owner>/<repo> `
  --watch `
  --interval 30
```

If checks fail, the agent must fetch the failed logs and patch again.

## Review threads

If unresolved review threads exist, the agent must either:

```text
- implement the requested change, then resolve the thread
- or explain why the thread is not actionable, then resolve only when policy allows
```

No merge is allowed while actionable review threads remain unresolved.

## Merge rule

Default merge method:

```text
squash
```

Merge is allowed only after:

```text
- diagnostics clean
- required checks green
- review threads resolved
- no current-head failed workflow runs
```

## Ruleset profiles

Default repository ruleset profile:

```text
operational
```

Operational profile keeps agent flow usable:

```text
- block branch deletion
- block force push
- require linear history
```

Strict Scorecard profile is deferred unless a separate reviewer identity exists:

```text
- require PR
- require required checks
- require review-thread resolution
- require one approval
```

## Completion report

Every completed task must end with:

```text
- PR URL
- final diagnostics run URL
- final check summary
- files changed
- unresolved review thread count
- current-head failed run count
- re-audit result if the task touched security, workflow, release, or repository policy
```
