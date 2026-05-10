# Autonomy Policy

`_ops` resolves repository autonomy from checked-in policy files.

```text
config/repo-autonomy.default.yml
config/repos/<owner>/<repo>.yml
scripts/ops-policy.mjs
```

The default policy is safe: diagnostics, patching, and finalization are allowed, but merge, release, and publish stay disabled unless a repository override enables them.

## Profiles

```text
off         diagnostics only
suggest     comments and suggestions only
patch       patch the same PR branch, no merge
guarded     patch, validate, finalize; merge disabled unless policy enables it
full        patch, validate, finalize, merge, and release orchestration
breakglass  full plus explicit bypass/admin paths when configured
```

## Current Repository Policies

```text
oaslananka-lab/kicad-studio        full, merge enabled, release enabled, publish disabled
oaslananka-lab/boardguard          full, merge enabled, release enabled, publish disabled
oaslananka-lab/test                full, merge enabled, release disabled, publish disabled
oaslananka-lab/mcp-health-monitor  guarded, merge disabled, release enabled, publish disabled
oaslananka-lab/mcp-debug-recorder  guarded, merge disabled, release enabled, publish disabled
oaslananka-lab/mcp-infra-lens      guarded, merge disabled, release enabled, publish disabled
oaslananka/*                       suggest, no patch, no merge, no release, no publish
```

## Resolver

Use:

```powershell
node scripts/ops-policy.mjs get --owner oaslananka-lab --repo boardguard
node scripts/ops-policy.mjs get --owner oaslananka-lab --repo boardguard --field pr.merge
node scripts/ops-policy.mjs patch-mode --owner oaslananka-lab --repo boardguard
node scripts/ops-policy.mjs check --owner oaslananka-lab --repo boardguard
```

The resolver makes no network calls. Invalid policy fails closed by exiting non-zero.

## Required Gates

PR finalization enforces:

```text
expected head SHA
same-repo head branch unless allow_fork_head=true
clean checks when require_clean_checks=true
zero pending checks when require_zero_pending_checks=true
zero unresolved review threads when require_zero_unresolved_threads=true
review policy
merge method policy
release policy
publish policy
```

Publish is disabled unless `publish.enabled=true`. When enabled, publish still must run from `main` or a tag through the configured protected environment.
