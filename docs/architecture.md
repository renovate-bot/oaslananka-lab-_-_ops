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
personal repository event
-> https://webhook.oaslananka.dev
-> oaslananka-lab/_ops workflow dispatch
-> _ops workflow handles diagnostics, mirroring, inbox triage, or release operations
```

The webhook receives events from personal repositories and routes them to the `_ops` control-plane.

## Control-plane

`oaslananka-lab/_ops` is the sole cross-repository automation authority.

The GitHub App token is minted from `_ops`.

All cross-repository operations must be launched from `_ops`.

Target repositories must not store the GitHub App private key unless a repo-local smoke test explicitly requires it.
