# Ops API Worker

Generated: 2026-05-11

## Runtime

`oaslananka-ops-api` is a Cloudflare Worker bound to:

```text
https://ops-api.oaslananka.dev
```

The Worker is the future API layer for a ChatGPT App and natural-language ops console.

```text
ChatGPT App / ops console
-> ops-api.oaslananka.dev
-> GitHub OAuth identity check
-> _ops workflow_dispatch
-> GitHub App installation token
-> source/mirror policy
-> GitHub repositories
```

## Authentication Model

GitHub OAuth is identity-only.

Allowed OAuth scopes:

```text
read:user user:email
```

Forbidden OAuth scopes:

```text
repo workflow admin:repo_hook write:packages delete_repo
```

The OAuth token is not used for repository mutation.

Repository mutation authority remains in the `oaslananka-repo-ops` GitHub App and `_ops` workflows.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Worker health. |
| `GET` | `/oauth/github/start` | none | Start GitHub OAuth identity flow. |
| `GET` | `/oauth/github/callback` | GitHub callback | Validate state, exchange code, create session. |
| `POST` | `/oauth/logout` | session optional | Delete session and expire cookie. |
| `GET` | `/v1/me` | session optional | Current authenticated login. |
| `GET` | `/v1/status` | none | Control-plane status summary. |
| `GET` | `/v1/repos` | none | Known source/mirror repositories. |
| `GET` | `/v1/repos/:owner/:repo/policy` | none for read; GitHub App backend required | Effective policy from `_ops`. |
| `GET` | `/v1/repos/:owner/:repo/topology` | none for read; GitHub App backend required | Source/mirror topology summary. |
| `POST` | `/v1/workflows/dispatch` | session | Allowlisted raw workflow dispatch. |
| `POST` | `/v1/repos/:repo/sync-source-to-mirror` | session | Typed dispatch to `repo-mirror-sync.yml`. |
| `POST` | `/v1/repos/:repo/topology-audit` | session | Typed dispatch to `repo-topology-audit.yml`. |
| `POST` | `/v1/repos/:repo/promote-back` | session | Typed dispatch to `repo-promote-back.yml`; defaults to `dry_run` and accepts `dry_run`, `pull_request`, or `update_existing_pr`. |
| `POST` | `/v1/pr/:owner/:repo/:number/diagnose` | session | Typed dispatch to `agent-pr-diagnostics.yml`. |
| `POST` | `/v1/pr/:owner/:repo/:number/fix` | session | Typed dispatch to `agent-fix-loop.yml`. |
| `POST` | `/v1/pr/:owner/:repo/:number/finalize` | session | Typed dispatch to `ops-pr-finalize.yml`. |
| `POST` | `/v1/repos/:owner/:repo/release` | session | Typed dispatch to `ops-release-orchestrator.yml`. |

## Workflow Allowlist

`/v1/workflows/dispatch` accepts only:

```text
agent-pr-diagnostics.yml
agent-fix-loop.yml
ops-pr-finalize.yml
ops-release-orchestrator.yml
repo-audit.yml
repo-release-plan.yml
repo-ruleset-autonomy-audit.yml
repo-topology-audit.yml
repo-promote-back.yml
repo-source-mirror-release-gate.yml
repo-mirror-sync.yml
```

## Secrets

Cloudflare Worker secrets:

```text
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
SESSION_SECRET
REPO_OPS_APP_ID
REPO_OPS_APP_CLIENT_ID
REPO_OPS_APP_PRIVATE_KEY
```

`REPO_OPS_APP_PRIVATE_KEY` must be provided through Doppler and Cloudflare Worker secrets before workflow dispatch endpoints can mutate repositories.

No endpoint returns secret values. Logs must contain metadata only.

Current secret state:

```text
GitHub Actions _ops secret REPO_OPS_APP_PRIVATE_KEY exists.
Doppler all/main REPO_OPS_APP_PRIVATE_KEY exists.
Cloudflare Worker REPO_OPS_APP_PRIVATE_KEY is configured.
GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET are configured as Worker secrets.
No secret values are recorded in this repository.
```

OAuth identity note:

```text
OAuth App: oaslananka-ops-chatgpt-login
OAuth Client ID prefix: Ov231...
The first character is capital O, not zero.
The OAuth App Client ID is distinct from the oaslananka-repo-ops GitHub App Client ID.
The OAuth Client Secret was rotated after accidental URL exposure; only secret names and storage locations are documented.
```

## Promote-Back Endpoint

`POST /v1/repos/:repo/promote-back` accepts an optional JSON body:

```json
{
  "mode": "dry_run",
  "merge_source_pr": "false",
  "mirror_ref": "main",
  "source_owner": "oaslananka",
  "source_repo": "boardguard"
}
```

Supported modes:

```text
dry_run
pull_request
update_existing_pr
```

An empty body dispatches a safe dry-run. Invalid modes return HTTP 400 with `INVALID_PROMOTE_MODE` and do not dispatch any workflow.

## CORS

Allowed browser origins are intentionally narrow:

```text
https://ops.oaslananka.dev
https://chatgpt.com
```

The ChatGPT origin may need refinement after final Apps SDK submission guidance is locked.
