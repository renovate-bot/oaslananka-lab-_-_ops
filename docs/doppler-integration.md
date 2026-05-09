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
