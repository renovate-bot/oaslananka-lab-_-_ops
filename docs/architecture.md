# System Architecture

This document defines the repository authority model for the `oaslananka` personal account, the `oaslananka-lab` organization, and the `_ops` control-plane.

## Personal repositories

`oaslananka` is the source of truth for code.

GitHub Actions are disabled in personal repositories. This is intentional and permanent.

Agents may write code commits in personal repositories when a task requires source changes.

Agents must never trigger GitHub Actions in personal repositories.

Release tags are cut in personal repositories. Original commits live there.

## Organization repositories

`oaslananka-lab` is the CI/CD mirror and execution workspace.

Organization repositories carry downstream mirrors of personal repositories.

GitHub Actions are enabled in organization repositories.

Organization repositories run validation and release orchestration, but canonical lifecycle closeout still belongs to the personal source repository unless policy explicitly permits mirror-only closeout.

Agents must never push code changes directly to organization mirrors. Code changes must originate from the personal source repository.

Agents may apply workflow, policy, diagnostics, and release automation changes from the `_ops` control-plane.

## Sync and promote-back direction

The normal sync direction is one way:

```text
oaslananka -> oaslananka-lab
```

Validated mirror changes may be promoted back through a canonical source pull request:

```text
oaslananka-lab/<repo> -> oaslananka/<repo> via repo-promote-back.yml
```

This promote-back path is policy-gated. It must not force-push canonical source branches.

## Release flow

The release flow is:

```text
tag in personal repository
-> mirror sync to organization repository
-> organization CI runs
-> source/mirror release gate verifies topology
-> release artifact is published from organization CI/CD
```

Release artifacts are produced by the organization CI/CD plane, not by personal repository workflows.

Publish remains disabled unless repository policy explicitly enables it and protected environment rules are satisfied.

## Ops API flow

The future ChatGPT App and ops console use Cloudflare Workers:

```text
ChatGPT App / natural-language ops console
-> https://ops-api.oaslananka.dev
-> GitHub OAuth identity check
-> _ops workflow_dispatch
-> GitHub App installation token
-> source/mirror policy
-> GitHub repositories
```

GitHub OAuth is identity-only and limited to:

```text
read:user user:email
```

The OAuth token is not used for repository mutation.

## Webhook flow

The webhook flow is:

```text
personal or routed organization repository event
-> https://webhook.oaslananka.dev
-> oaslananka-lab/_ops workflow dispatch
-> _ops workflow handles diagnostics, mirroring, inbox triage, or release operations
```

The webhook receives events from personal repositories and selected organization repositories, then routes them to the `_ops` control-plane.

Push mirror synchronization remains personal-only:

```text
push on oaslananka/<repo> default branch -> repo-mirror-sync.yml
push on oaslananka-lab/<repo> default branch -> ignored by mirror routing
```

Pull request, issue, issue comment, and failed check-run routing can operate for both routed owners:

```text
pull_request opened/synchronize/reopened/closed -> agent-pr-diagnostics.yml
issues opened -> inbox-handler.yml
issue_comment with @oaslananka-repo-ops or /ops -> inbox-handler.yml
check_run completed failure/timed_out -> agent-fix-loop.yml in suggest mode
```

Current routing status:

```text
Cloudflare DNS record:
  webhook.oaslananka.dev CNAME -> ops-webhook-wi0r.onrender.com
  proxied: true

Render direct health:
  https://ops-webhook-wi0r.onrender.com/health -> 200 OK

Custom domain health:
  https://webhook.oaslananka.dev/health -> 200 OK
```

GitHub webhook delivery can use either the custom domain or the direct Render URL:

```text
https://webhook.oaslananka.dev/webhook?github=1
https://ops-webhook-wi0r.onrender.com/webhook?github=1
```

Repository/App webhook delivery has been verified for issue routing. Org repository routing was validated with a signed synthetic `issue_comment` event against `oaslananka-lab/test`.

## Current pilot scope

The current controlled production-grade pilot set is:

```text
oaslananka-lab/test
oaslananka-lab/boardguard
oaslananka-lab/mcp-health-monitor
oaslananka-lab/mcp-debug-recorder
oaslananka-lab/mcp-infra-lens
```

The Group B MCP repositories are organization CI/CD and release authorities for their packages. Their personal counterparts remain upstream/source-side repositories in the one-way mirror model.

The maintenance stack for these pilot repositories is:

```text
Renovate        dependency update PR authority
Mergify         conditional Renovate patch/minor squash merge when checks are green
Codecov         non-blocking coverage signal
SonarQube Cloud non-blocking quality signal
CodeQL          security/static analysis
Scorecard       repository posture signal
Gitleaks        local/workflow secret exposure scan
zizmor          workflow security linting
actionlint      workflow syntax linting
```

## Agent fix loop v2

`agent-fix-loop.yml` v2 is the bounded autonomous patcher for one pull request.

The workflow:

```text
diagnose current PR head
classify deterministic failures
checkout the same PR branch
apply a low-risk patch when patch_mode=patch
commit with no GPG signing
push the same PR branch without force
repeat diagnostics until clean or max_iterations is reached
```

The first validated patch class is trailing whitespace normalization on `oaslananka-lab/test`.

The workflow does not create new branches, does not push to main, does not force-push, does not merge, and does not perform broad refactors.

Comment rendering is normalized before posting to GitHub. Literal escaped sequences such as `\n` and `\t` are converted to real Markdown newlines/tabs so PR comments remain readable.

## GitHub Agentic Workflows

The control-plane also includes gh-aw compiled workflows:

```text
pr-fix        deterministic PR repair through safe outputs
issue-triage  issue classification and concise responses
ci-doctor     failed CI diagnosis and optional PR fix dispatch
```

These workflows are compiled and dry-run validated, but the Copilot engine requires a `_ops` repository secret named `COPILOT_GITHUB_TOKEN`.

Until that secret exists, the gh-aw lock workflows are dispatch-only and production webhook routing uses `agent-fix-loop.yml` for failed `check_run` events. The webhook service can opt into gh-aw later by setting:

```text
CHECK_RUN_WORKFLOW=ci-doctor.lock.yml
```

This keeps automatic check-run handling green while preserving gh-aw as the next engine-backed automation layer.

The webhook ignores `_ops` repository events by default through `IGNORED_ORG_REPOS=_ops`. This prevents failed control-plane automation checks from recursively dispatching more control-plane repair workflows.

For failed `check_run` events, the webhook checks the associated pull request before dispatch. Closed PRs are ignored so temporary smoke-test PRs do not create stale auto-fix runs after cleanup.

## Policy-Controlled Lifecycle

The deterministic lifecycle path does not depend on Copilot or gh-aw.

```text
event or /ops command
-> policy resolution
-> diagnose
-> patch when policy permits
-> finalize when policy permits
-> merge when policy permits and gates pass
-> post-merge audit and release plan
-> release orchestration when release policy permits
-> publish orchestration only when publish.enabled=true
```

Policy files live in:

```text
config/repo-autonomy.default.yml
config/repos/<owner>/<repo>.yml
```

`ops-pr-finalize.yml` is the merge authority. It uses the target repository GitHub App token and merges with an expected head SHA. `ops-release-orchestrator.yml` handles release and publish policy after merge. `repo-ruleset-autonomy-audit.yml` checks whether GitHub rulesets/settings match the configured autonomy profile.

## Control-plane

`oaslananka-lab/_ops` is the sole cross-repository automation authority.

The GitHub App token is minted from `_ops`.

All cross-repository operations must be launched from `_ops`.

Target repositories must not store the GitHub App private key unless a repo-local smoke test explicitly requires it.
