# Fleet Health

Generated: 2026-05-13

Fleet health is the single dashboard workflow for repository state across managed source/mirror pairs.

Workflow:

```text
.github/workflows/repo-fleet-health.yml
scripts/fleet-health.mjs
```

It reports:

- source/mirror drift relation
- Dependabot PR counts and major-review backlog
- Dependabot alert counts
- code scanning and secret scanning alert counts
- production environment reviewer count
- latest publish/deploy run state
- trusted publishing verification state where applicable

Latest run:

```text
https://github.com/oaslananka-lab/_ops/actions/runs/25769435016
```

Current interpretation:

- All managed source/mirror pairs are `equal` or `tree_equal`.
- Production environment required reviewer counts are zero.
- Remaining Dependabot PRs are classified backlog: major-review or conflict-resolution.
- Publish-side registry/secret states are reported separately and are not treated as source/mirror drift.
