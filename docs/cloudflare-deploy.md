# Cloudflare Deploy

Generated: 2026-05-11

## Worker

```text
name:  oaslananka-ops-api
route: https://ops-api.oaslananka.dev
```

The service lives under:

```text
services/ops_api_worker
```

## KV Namespaces

| Binding | Namespace ID |
|---|---|
| `OAUTH_STATE` | `968d8f0f7bee4f29bde39c77965070af` |
| `OPS_SESSIONS` | `bc4a4c811cb34ccdb5dd97dd6a1e8efc` |

## Local Commands

```powershell
Set-Location "$env:USERPROFILE\Desktop\_ops\services\ops_api_worker"

pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run lint
wrangler deploy --dry-run
wrangler deploy
```

## Secret Delivery

Doppler project/config:

```text
all/main
```

Secrets are delivered to Cloudflare with:

```powershell
doppler secrets get <NAME> --plain --project all --config main |
  wrangler secret put <NAME>
```

Do not print values.

## GitHub Actions Deployment

Workflow:

```text
.github/workflows/deploy-ops-api-worker.yml
```

Required `_ops` repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

If these are absent, manual `wrangler deploy` remains the validated deployment path.
