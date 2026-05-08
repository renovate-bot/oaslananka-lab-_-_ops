# Boardguard Scorecard Accepted Deferred Findings

Repository: `oaslananka-lab/boardguard`

Latest triage result:

```text
total_open_alerts              7
actionable_patch_count         0
process_policy_deferred_count  6
ruleset_or_review_model_count  1
manual_review_count            0
```

## Current classification

| Alert | Rule | Classification | Decision |
|---:|---|---|---|
| #14 | CI-Tests | process_policy_deferred | Track as coverage/history/process work. |
| #13 | SAST | process_policy_deferred | SAST workflow exists; Scorecard history may lag. Track, do not patch blindly. |
| #12 | Fuzzing | process_policy_deferred | Requires explicit fuzzing harness/project decision. |
| #11 | CII-Best-Practices | process_policy_deferred | Requires project-level CII badge/process work. |
| #9 | Maintained | process_policy_deferred | Depends on repository activity/history. |
| #8 | Code-Review | process_policy_deferred | Depends on review model/history. |
| #2 | Branch-Protection | ruleset_or_review_model | Operational ruleset is active; strict profile deferred until second reviewer/bot approval identity exists. |

## Operational baseline status

The repository is considered automation-ready under the operational profile:

```text
- GitHub App access works
- repo onboarding works
- diagnostics works
- secret scanning enabled
- dependency graph/SBOM enabled
- repo-local secrets: 0
- repo-local variables: 0
- operational ruleset active
- open PRs: 0
```

## Deferred decision

These findings are not dismissed in GitHub code scanning at this stage.

Reason:

```text
- no remaining direct patch target exists
- current alerts are process/history/review-model based
- strict Branch-Protection can block solo agent workflows
- dismissing would hide signal before the automation model is complete
```

## Next required work

```text
1. Add release/workflow hardening.
2. Move release authority to controlled GitHub App / _ops model where practical.
3. Keep target repo workflows SHA-pinned and job-permission scoped.
4. Re-run Scorecard after release hardening.
5. Revisit strict-scorecard ruleset only after a reviewer/bot approval identity exists.
```

## Current decision

Accepted as deferred operational findings.

No source patch is required for `boardguard` at this stage.
