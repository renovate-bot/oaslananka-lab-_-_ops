# Doppler Integration

This document records how Doppler-sourced secrets are exposed to the `oaslananka-lab` CI/CD plane.

## Doppler-sourced organization secrets

These organization-level Actions secrets are sourced from Doppler:

```text
DOPPLER_TOKEN
DOPPLER_CONFIG
DOPPLER_PROJECT
```

They currently have `all` organization visibility. All current `oaslananka-lab` repositories can access them:

```text
oaslananka-lab/_ops
oaslananka-lab/CH224A-breakout-for-testing
oaslananka-lab/a2a-mesh
oaslananka-lab/boardguard
oaslananka-lab/cifence
oaslananka-lab/codex-app-server-web
oaslananka-lab/fovux
oaslananka-lab/homebrew-tap
oaslananka-lab/kicad-mcp-pro
oaslananka-lab/kicad-studio
oaslananka-lab/mcp-ssh-tool
oaslananka-lab/oaslananka.github.io
oaslananka-lab/scoop-bucket
oaslananka-lab/test
```

## Rotation procedure

Rotate Doppler-backed credentials in this order:

```text
1. Update the source value in Doppler.
2. Re-sync the matching GitHub organization secret.
3. Run the target repository workflow or smoke test that consumes the secret.
4. Confirm no repository-local secret shadows the organization secret.
```

When using the GitHub CLI, pass the new value through standard input:

```powershell
Get-Content .\secret-value.txt -Raw | gh secret set DOPPLER_TOKEN --org oaslananka-lab
```

## GitHub-native secrets

These secrets are GitHub-native and are not sourced from Doppler:

```text
STEWARD_LAB_TOKEN
STEWARD_USER_TOKEN
REPO_OPS_APP_PRIVATE_KEY
```

`STEWARD_LAB_TOKEN` and `STEWARD_USER_TOKEN` are organization-level Actions secrets with `all` visibility.

`REPO_OPS_APP_PRIVATE_KEY` is stored in `oaslananka-lab/_ops` as a repository-level Actions secret.

`REPO_OPS_APP_CLIENT_ID` is stored in `oaslananka-lab/_ops` as a repository-level Actions variable.

## Local project configuration

The `_ops` checkout includes `doppler.yaml` with this setup:

```yaml
setup:
  - project: all
    config: main
```

When running non-interactive automation, pass the project and config explicitly:

```powershell
doppler run --project all --config main -- <command>
```

The local checkout scope has also been configured non-interactively with:

```powershell
doppler setup --project all --config main --no-interactive
```

After that setup, the shorter form also works from the `_ops` root:

```powershell
doppler run -- <command>
```

## Cloudflare and webhook routing secrets

The Doppler `all/main` config currently exposes these relevant secret names:

```text
CLOUDFLARE_GLOBAL_API_KEY
CLOUDFLARE_GLABAL_MAIL
WEBHOOK_SECRET
```

`CLOUDFLARE_GLABAL_MAIL` is intentionally treated as a Cloudflare email alias by `_ops` automation because that is the name currently present in Doppler.

`WEBHOOK_SECRET` exists in Doppler and is the value that should be synchronized to:

```text
Render service env: WEBHOOK_SECRET
GitHub App webhook secret
```

Do not print the value during rotation or verification. Use standard input and suppress command output when setting the value.

Current caveat:

```text
Render MCP did not have a workspace selected in this session, so Render WEBHOOK_SECRET was not updated automatically.
Before switching to App-level webhook delivery, sync Render WEBHOOK_SECRET and the GitHub App webhook secret to the same current Doppler WEBHOOK_SECRET value.
```
