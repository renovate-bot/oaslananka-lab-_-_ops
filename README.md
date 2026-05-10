# _ops
Repository operations control plane for CI/CD, automation, release orchestration, audit, and mirror management.

## Architecture Overview

`oaslananka` personal repositories are the source of truth for code. GitHub Actions stay disabled there. Release tags are created there, and original commits live there.

`oaslananka-lab` organization repositories are the CI/CD and release plane. They carry downstream mirrors of the personal repositories, run Actions, and publish artifacts.

Synchronization is one way:

```text
oaslananka -> oaslananka-lab
```

`oaslananka-lab/_ops` is the control-plane. It mints the GitHub App token and launches cross-repository diagnostics, onboarding, baseline, release, mirror, and inbox workflows.

See:

```text
docs/architecture.md
docs/agent-operating-contract.md
```

## Workflows

| Workflow | Purpose |
|---|---|
| `repo-ops-cross-repo-smoke.yml` | Verifies the GitHub App can read, write, create temporary branches, open/close PRs, and clean up in a target repo. |
| `repo-audit.yml` | Captures repository security, ruleset, Actions, environment, release, tag, hook, and collaborator state into an audit artifact. |
| `repo-baseline-plan.yml` | Produces a dry baseline report for branch protection, security features, dependency graph, Actions policy, and alerts. |
| `repo-baseline-apply.yml` | Applies the non-disruptive operational baseline when `apply=true` and `approval=APPLY_BASELINE`. |
| `repo-ruleset-profile.yml` | Creates or updates the operational or strict-scorecard default-branch ruleset profile. |
| `agent-pr-diagnostics.yml` | Collects current-head PR checks, failed workflow logs, unresolved review threads, and next-step guidance. |
| `repo-onboarding.yml` | Audits a repo during onboarding and writes the correct `AGENTS.md` template for the selected repo role. |
| `repo-code-scanning-triage.yml` | Classifies open code scanning alerts into actionable, ruleset/review, process-policy, or manual-review buckets. |
| `repo-mirror-sync.yml` | Syncs a personal source repo to its organization mirror and emits a mirror-sync JSON artifact. |
| `inbox-handler.yml` | Handles webhook-routed issue/comment events, acknowledges issues, classifies them, labels ops/security issues, and dispatches `/ops` commands. |
| `agent-fix-loop.yml` | Runs the bounded autonomous fix loop for one PR in `suggest` or `patch` mode. Patch mode checks out the same PR branch, applies deterministic low-risk fixes, commits without GPG signing, pushes without force, and repeats diagnostics. |
| `repo-multi-onboarding.yml` | Dispatches `repo-onboarding.yml` for the Group B pilot repositories in parallel. |
| `repo-release-plan.yml` | Assesses release readiness: environments, release-please files, release workflow permissions, attestations, immutable releases, tags, and latest release. |
| `repo-release-apply.yml` | Applies release configuration such as the production environment and optional immutable releases. |

## Onboard a Repository

Run onboarding from `_ops`:

```powershell
gh workflow run .github/workflows/repo-onboarding.yml `
  --repo oaslananka-lab/_ops `
  --ref main `
  -f target_owner=oaslananka-lab `
  -f target_repo=<repo> `
  -f desired_ruleset_profile=operational `
  -f repo_role=org_mirror
```

Use `repo_role=personal_source` when writing the personal-repo template into a source repository.

After onboarding, run a baseline plan, apply the approved baseline, then run a repo audit.

## Handle a PR From a Personal Repository

Personal repositories do not run Actions. Code changes land in the personal source repository, then mirror sync copies the branch/default branch state into the organization CI/CD mirror.

For PR work, run diagnostics from `_ops` against the repository that owns the PR:

```powershell
gh workflow run .github/workflows/agent-pr-diagnostics.yml `
  --repo oaslananka-lab/_ops `
  --ref main `
  -f target_owner=<owner> `
  -f target_repo=<repo> `
  -f pr_number=<number>
```

Fix code in the personal source repository. Do not push code changes directly to organization mirrors. Use the organization mirror for CI/CD, release artifacts, repo policy, and diagnostics.

## Webhook Receiver

Intended public webhook URL:

```text
https://webhook.oaslananka.dev/webhook
```

Current deployed Render receiver:

```text
https://ops-webhook-wi0r.onrender.com/webhook?github=1
```

The receiver accepts GitHub webhook POST requests, validates `x-hub-signature-256`, and dispatches `_ops` workflows:

| Event | Action |
|---|---|
| `pull_request` opened, synchronize, reopened, closed | Dispatch `agent-pr-diagnostics.yml`. |
| `issues` opened | Dispatch `inbox-handler.yml` with `event_type=issue`. |
| `push` to the default branch from `oaslananka/*` | Dispatch `repo-mirror-sync.yml`. |
| `issue_comment` created with `@oaslananka-repo-ops` | Dispatch `inbox-handler.yml` with `event_type=comment`. |
| `issue_comment` containing `/ops fix` on a PR thread | Dispatch `agent-fix-loop.yml` in patch mode through `inbox-handler.yml`. |
| `check_run` completed with `failure` or `timed_out` | Dispatch `agent-fix-loop.yml` in suggest mode. |

Cloudflare DNS routes `webhook.oaslananka.dev` to the Render service. Both the direct Render health endpoint and the custom domain health endpoint have returned 200 OK in validation.

## Current Pilot Scope

The current controlled scope is `_ops`, `oaslananka-lab/test`, `oaslananka-lab/boardguard`, and the Group B pilot repositories:

```text
oaslananka-lab/mcp-health-monitor
oaslananka-lab/mcp-debug-recorder
oaslananka-lab/mcp-infra-lens
```

Group B repositories have been onboarded as organization CI/CD and release authorities. Production release workflows remain guarded by release-please and the `production` environment; no production publish is triggered by onboarding, audit, baseline, or release-plan runs.
