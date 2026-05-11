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
source      canonical personal source; CI delegated to mirror; no direct Actions expected
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
oaslananka-lab/mcp-infra-lens      guarded, ci_cd_mirror, merge disabled, release enabled, publish disabled
oaslananka/*                       source, canonical_source, CI delegated to oaslananka-lab, release/publish delegated
```

## Source/Mirror Semantics

`oaslananka/*` is canonical source-of-truth.

`oaslananka-lab/*` is a CI/CD mirror and execution workspace.

Mirror merges are not canonical closeout unless promote-back completes or policy explicitly enables mirror-only closeout.

Use:

```powershell
node scripts/ops-policy.mjs topology --owner oaslananka-lab --repo boardguard
node scripts/ops-policy.mjs topology --owner oaslananka --repo boardguard
node scripts/ops-policy.mjs is-mirror --owner oaslananka-lab --repo boardguard
node scripts/ops-policy.mjs source-target --owner oaslananka-lab --repo boardguard
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
source/mirror release gate
```

Publish is disabled unless `publish.enabled=true`. When enabled, publish still must run from `main` or a tag through the configured protected environment.
