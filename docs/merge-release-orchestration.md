# Merge and Release Orchestration

`ops-pr-finalize.yml` is the policy-controlled merge authority.

It performs:

```text
load policy
fetch PR
verify expected head SHA
run agent-pr-diagnostics.yml
enforce clean checks, pending checks, and review-thread gates
merge with REST sha protection when policy permits
delete safe same-repo head branch when policy permits
run post-merge repo-audit.yml
run post-merge repo-release-plan.yml
dispatch ops-release-orchestrator.yml when release policy enables it
upload JSON report
```

Merge calls use the pull request merge REST endpoint with the current PR head SHA in the `sha` body field. If the PR head changes during finalization, GitHub rejects the merge and `_ops` reports `head_sha_mismatch` or `merge_failed`.

`ops-release-orchestrator.yml` handles release and publish policy.

It performs:

```text
load policy
run repo-release-plan.yml
discover target release/publish workflows
dispatch release workflow on main when release is enabled
observe push-triggered release workflow runs when workflow_dispatch is unavailable or unnecessary
detect release-please PRs
avoid merging release PRs unless policy enables it
report publish_disabled unless publish.enabled=true
stop at protected publish gates when publish is disabled
never publish from a PR head
upload JSON report
```

## Final States

PR finalization emits deterministic states such as:

```text
dry_run_clean
checks_not_clean
pending_checks
unresolved_review_threads
review_required
not_mergeable
head_sha_mismatch
clean_merge_disabled
auto_merge_enabled
merge_failed
merged
merged_release_disabled
merged_release_dispatched
```

Release orchestration emits deterministic states such as:

```text
release_disabled
release_plan_failed
release_workflow_not_found
release_workflow_dispatched
release_pr_open_merge_disabled
publish_disabled
publish_workflow_not_found
awaiting_environment_approval
release_complete
```

`publish_disabled` is a clean final state when repository policy disables publish.

When a target release workflow contains both release artifact jobs and protected publish jobs, `_ops` treats the protected environment gate as a publish boundary. If `publish.enabled=false`, the orchestrator records the release workflow observation and reports `publish_disabled` instead of waiting for or approving the protected publish job.
