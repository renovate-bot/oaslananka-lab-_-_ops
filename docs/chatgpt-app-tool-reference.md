# ChatGPT App Tool Reference

Generated: 2026-05-11

The ChatGPT App should expose typed tools only. It must not expose arbitrary workflow dispatch.

| Tool | Endpoint | Workflow | Class | Auth | Policy gate |
|---|---|---|---|---|---|
| `get_system_status` | `GET /v1/status` | none | read-only | optional | none |
| `list_repositories` | `GET /v1/repos` | none | read-only | optional | none |
| `get_repo_topology` | `GET /v1/repos/:owner/:repo/topology` | none | read-only | optional | GitHub App read |
| `get_repo_policy` | `GET /v1/repos/:owner/:repo/policy` | none | read-only | optional | GitHub App read |
| `run_topology_audit` | `POST /v1/repos/:repo/topology-audit` | `repo-topology-audit.yml` | non-destructive | required | workflow allowlist |
| `sync_source_to_mirror` | `POST /v1/repos/:repo/sync-source-to-mirror` | `repo-mirror-sync.yml` | destructive if non-dry-run | required | source/mirror policy |
| `run_pr_diagnostics` | `POST /v1/pr/:owner/:repo/:number/diagnose` | `agent-pr-diagnostics.yml` | non-destructive | required | workflow allowlist |
| `run_agent_fix_loop` | `POST /v1/pr/:owner/:repo/:number/fix` | `agent-fix-loop.yml` | mutating | required | autonomy policy |
| `finalize_pr` | `POST /v1/pr/:owner/:repo/:number/finalize` | `ops-pr-finalize.yml` | mutating | required | expected head SHA and PR policy |
| `promote_back_to_source` | `POST /v1/repos/:repo/promote-back` | `repo-promote-back.yml` | mutating when not dry-run | required | mirror.promote_back |
| `run_release_orchestrator` | `POST /v1/repos/:owner/:repo/release` | `ops-release-orchestrator.yml` | release orchestration | required | release and source/mirror gate |
| `pause_repo` | not exposed yet | `inbox-handler.yml` label command | mutating | required | ops pause label |
| `resume_repo` | not exposed yet | `inbox-handler.yml` label command | mutating | required | ops pause label |
| `explain_failure` | not exposed yet | diagnostics artifact read | read-only | required | artifact read |

All destructive tools must return:

```text
correlation_id
workflow
run_url
accepted
```

No tool may return tokens, private keys, OAuth secrets, session secrets, Doppler values, or registry secrets.

## Promote-Back Tool Body

The `promote_back_to_source` tool maps to `POST /v1/repos/:repo/promote-back`.

Accepted body:

```json
{
  "mode": "dry_run",
  "merge_source_pr": "false",
  "mirror_ref": "main",
  "source_owner": "oaslananka",
  "source_repo": "boardguard"
}
```

`mode` must be one of:

```text
dry_run
pull_request
update_existing_pr
```

`merge_source_pr` is explicit. The API never merges a canonical source PR unless the request supplies `true` or `"true"` and policy permits the merge. Invalid modes return `INVALID_PROMOTE_MODE` and do not dispatch `_ops`.

## Rollout Validation Notes

The tool mapping was exercised indirectly through the deployed ops API and `_ops` workflows:

```text
run_topology_audit:
  repo-topology-audit.yml succeeded for all six target mirrors.

promote_back_to_source:
  repo-promote-back.yml opened and merged canonical source PRs for boardguard, mcp-health-monitor, mcp-debug-recorder, and mcp-infra-lens.

sync_source_to_mirror:
  repo-mirror-sync.yml returned tree_equal for promoted repositories.

finalize_pr:
  ops-pr-finalize.yml merged mcp-health-monitor release PR #1.
  ops-pr-finalize.yml refused kicad-studio PRs #41-#45 because GitHub requires code-owner review.

run_release_orchestrator:
  ops-release-orchestrator.yml ran for all product mirrors and reported exact publish blockers.
```

Current app-facing blocker states should be exposed as structured failure explanations:

```text
ruleset_code_owner_review_required
production_environment_missing
publish_workflow_not_found
npm_publish_e404
notebooklm_local_profile_access_denied
```
