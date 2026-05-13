# Agent Fix Loop

Generated: 2026-05-13

Agent Fix Loop v2 is the `_ops` workflow that patches failing PRs when repository policy permits automation.

## Current Hardening

The workflow was hardened after failed runs on `oaslananka-lab/a2a-mesh#34` showed that a local commit could be created but not pushed because repository hooks rejected the push. The old rollback path then tried to revert a commit that did not exist on the remote PR branch and failed with `fatal: bad object`.

Current behavior:

- Bot commit and push paths set `HUSKY=0`.
- Bot commits use `commit.gpgsign=false` and `--no-gpg-sign`.
- `last_auto_commit` is set only after a successful remote push.
- Push failure returns `push_failed_with_no_rollback` and uploads a report instead of attempting rollback.
- Rollback skips empty, absent, or non-ancestor commits and must not turn a cleanup path into a workflow failure.

## TypeScript 6 Classifier

The classifier now recognizes TypeScript 6 `TS5101` `baseUrl` deprecation failures:

```text
typescript baseUrl deprecation
```

Patch behavior is intentionally minimal for dependency PR triage:

- scan `tsconfig*.json`
- if `compilerOptions.baseUrl` exists and `compilerOptions.ignoreDeprecations` is missing, add `"ignoreDeprecations": "6.0"`
- avoid lockfile churn for tsconfig-only fixes

Evidence:

| Event | Evidence |
|---|---|
| Agent Fix Loop rerun for `a2a-mesh#34` | https://github.com/oaslananka-lab/_ops/actions/runs/25767720900 |
| Finalize `a2a-mesh#34` | https://github.com/oaslananka-lab/_ops/actions/runs/25767948251 |

## Dependabot Guard

Dependabot major updates are never finalized by default. They are labeled:

```text
dependabot-major-review-required
```

Conflicting PRs are labeled:

```text
needs-human-conflict-resolution
```

and receive:

```text
@dependabot rebase
```

The loop guard prevents repeated fix-loop dispatches for the same PR/head/classification without new evidence.
