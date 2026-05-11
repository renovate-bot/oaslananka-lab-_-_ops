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

## 2026-05-11 Rollout Observations

The resumed closeout added stricter publish workflow routing:

```text
commit: 4b0066027ac32e06f3bedd5ff0ffa1866772ecbf
change: ops-release-orchestrator.yml now skips non-dispatchable publish workflow candidates, records skipped_no_workflow_dispatch, recognizes mcp-registry.yml, and dispatches MCP registry workflows with publish=true and target=official.
```

This fixed the next-batch `publish_workflow_dispatch_failed` state where `kicad-mcp-pro` exposed a stale/non-dispatchable `release.yml` workflow through the Actions API. The final orchestrator evidence is:

```text
kicad-mcp-pro: https://github.com/oaslananka-lab/_ops/actions/runs/25685232435
  publish workflow: .github/workflows/mcp-registry.yml
  publish run: https://github.com/oaslananka-lab/kicad-mcp-pro/actions/runs/25685286341
  final state: awaiting_environment_approval

mcp-ssh-tool: https://github.com/oaslananka-lab/_ops/actions/runs/25685245036
  release workflow: .github/workflows/release.yml
  docker workflow: .github/workflows/docker.yml
  docker run: https://github.com/oaslananka-lab/mcp-ssh-tool/actions/runs/25685436692
  final state: release_publish_complete for the dispatchable Docker smoke path
```

The orchestrator still refuses to publish from PR heads. When no merge commit SHA is supplied it resolves the immutable `main` commit SHA before dispatching `publish-production.yml`.

The full rollout exercised the release and publish paths after enabling product publish policy.

Observed states:

```text
boardguard:
  release orchestrator run 25648564700
  final_state publish_workflow_not_found

kicad-studio:
  release orchestrator run 25648590951
  final_state publish_workflow_not_found
  ruleset audit also reported production environment missing

mcp-health-monitor:
  release orchestrator run 25648861038
  final_state release_workflow_failed
  release workflow run 25648732393 failed in release-assets / Publish to npm
  npm returned E404 for mcp-health-monitor@1.0.4 while NODE_AUTH_TOKEN was empty

mcp-debug-recorder:
  release orchestrator run 25648655235
  final_state publish_workflow_not_found

mcp-infra-lens:
  release orchestrator run 25648679014
  final_state publish_workflow_not_found
```

`publish_workflow_not_found` is a blocker for this rollout because publish policy is enabled for the product repositories. It is not reported as `publish_disabled`.
