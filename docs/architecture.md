# System Architecture

This document defines the repository authority model for the `oaslananka` personal account, the `oaslananka-lab` organization, and the `_ops` control-plane.

## Personal repositories

`oaslananka` is the source of truth for code.

GitHub Actions are disabled in personal repositories. This is intentional and permanent.

Agents may write code commits in personal repositories when a task requires source changes.

Agents must never trigger GitHub Actions in personal repositories.

Release tags are cut in personal repositories. Original commits live there.

## Organization repositories

`oaslananka-lab` is the CI/CD plane.

Organization repositories carry downstream mirrors of personal repositories.

GitHub Actions are enabled in organization repositories.

Organization repositories produce release artifacts.

Agents must never push code changes directly to organization mirrors. Code changes must originate from the personal source repository.

Agents may apply workflow, policy, diagnostics, and release automation changes from the `_ops` control-plane.

## Sync direction

The sync direction is one way:

```text
oaslananka -> oaslananka-lab
```

The organization mirror must never be synced back to the personal source repository.

## Release flow

The release flow is:

```text
tag in personal repository
-> mirror sync to organization repository
-> organization CI runs
-> release artifact is published from organization CI/CD
```

Release artifacts are produced by the organization CI/CD plane, not by personal repository workflows.

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

## Control-plane

`oaslananka-lab/_ops` is the sole cross-repository automation authority.

The GitHub App token is minted from `_ops`.

All cross-repository operations must be launched from `_ops`.

Target repositories must not store the GitHub App private key unless a repo-local smoke test explicitly requires it.
