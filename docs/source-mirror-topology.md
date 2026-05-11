# Source Mirror Topology

Generated: 2026-05-11

## Authority Model

`oaslananka/*` repositories are the canonical source of truth.

`oaslananka-lab/*` repositories are CI/CD mirrors and execution workspaces because GitHub Actions are disabled on the personal account.

`oaslananka-lab/_ops` is the control-plane that dispatches workflows and mints GitHub App installation tokens.

## Lifecycle Rule

A merge in `oaslananka-lab/*` is not a canonical closeout by itself.

Validated mirror changes must be promoted back to the canonical `oaslananka/*` repository unless the repository policy explicitly allows mirror-only closeout.

The default mirror policy sets:

```text
mirror.promote_back = true
mirror.allow_mirror_only_closeout = false
mirror.require_source_mirror_sha_match_before_release = true
mirror.require_source_mirror_sha_match_before_publish = true
```

## Direction

Normal sync direction:

```text
oaslananka/<repo> -> oaslananka-lab/<repo>
```

Promote-back direction after mirror validation:

```text
oaslananka-lab/<repo> -> oaslananka/<repo> via source PR
```

No workflow may force-push canonical source branches.

## Roles

| Role | Meaning |
|---|---|
| `canonical_source` | Personal source repository. Actions are expected to be disabled. CI is delegated to `oaslananka-lab`. |
| `ci_cd_mirror` | Organization mirror repository. Actions run here. Release and publish gates must account for source/mirror state. |
| `control_plane` | `_ops` itself. |
| `org_native` | Organization repository without a personal counterpart. |

## New Workflows

| Workflow | Purpose |
|---|---|
| `repo-topology-audit.yml` | Audits source/mirror existence, Actions state, App access, and SHA relationship. |
| `repo-promote-back.yml` | Opens or updates a canonical source PR from validated mirror changes. |
| `repo-source-mirror-release-gate.yml` | Blocks release/publish if source/mirror relationship is invalid or promote-back is required. |

## Release And Publish Gate

Release/publish is allowed only when the policy permits it and the source/mirror relationship is valid.

For mirrored repositories, a mirror commit must contain the canonical source commit, have the same repository tree as the canonical source commit, or the validated mirror change must be promoted back according to policy.

For source repositories, release is delegated to the mirror and must be backed by mirror validation.

## Tree-Equivalent Closeout

Promote-back source PRs are normally squash-merged into `oaslananka/*`.

That means the canonical source commit SHA and CI/CD mirror commit SHA may differ even when their repository trees are identical. The lifecycle workflows treat this as:

```text
relation = tree_equal
final_state = ready
```

`tree_equal` is valid for release gates because it proves the promoted source content and the mirror execution content are equivalent without requiring force-pushes or ruleset bypasses.

Default-branch force-push is still refused. If source and mirror diverge and are not tree-equal, sync reports the exact unsafe state instead of rewriting protected history.

## Rollout Verification Snapshot

Generated: 2026-05-11

The latest full rollout verified that source/mirror release gates accept either exact SHA equality or `tree_equal` content equivalence:

| Repo | Relation | Evidence |
|---|---|---|
| `boardguard` | `tree_equal` | `repo-topology-audit.yml` run `25648430322` |
| `kicad-studio` | `equal` | `repo-topology-audit.yml` run `25648438697` |
| `mcp-health-monitor` | `tree_equal` | `repo-topology-audit.yml` run `25648842281` |
| `mcp-debug-recorder` | `tree_equal` | `repo-topology-audit.yml` run `25648460556` |
| `mcp-infra-lens` | `tree_equal` | `repo-topology-audit.yml` run `25648472903` |
| `test` | `equal` | `repo-topology-audit.yml` run `25648483593` |

Open product blockers are not topology blockers. They are publish workflow/environment gaps or repository ruleset review gates, and are tracked in `docs/full-rollout-status.md`.
