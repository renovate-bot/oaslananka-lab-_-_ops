# Dependabot Automation

Generated: 2026-05-13

Dependabot is policy-managed by `_ops`.

## File Parity Rule

`.github/dependabot.yml` is generated from policy and must remain byte-identical between canonical source and CI/CD mirror repositories.

Source repositories keep the file for parity, but source-side Dependabot/security automation is disabled by repository settings. Mirror repositories use the same file actively because mirror-side automation is enabled by settings.

Direct `gh api PUT contents` writes to protected default branches are forbidden for managed Dependabot config. Use policy changes and approved `_ops` baseline/sync workflows.

## Processing Rules

`repo-dependabot-auto.yml` runs `scripts/dependabot-auto.mjs`.

Mirror PR handling:

| Case | Action |
|---|---|
| patch/minor with clean checks | approve and dispatch `ops-pr-finalize.yml` with expected head SHA |
| patch/minor with failed checks | dispatch Agent Fix Loop once per PR/head/classification |
| major update | label `dependabot-major-review-required`; do not auto-merge |
| conflict / dirty merge state | comment `@dependabot rebase`, label `needs-human-conflict-resolution`, do not retry blindly |
| pending checks | wait for the next scheduled run |

Source PR handling:

Source-side Dependabot PRs are closed when source automation is disabled by policy. The close comment includes an idempotent marker:

```text
<!-- repo-ops-source-dependabot-disabled -->
```

## Evidence

| Event | Evidence |
|---|---|
| Latest Dependabot automation run | https://github.com/oaslananka-lab/_ops/actions/runs/25768974763 |
| `mcp-ssh-tool#76` mirror restore after stale sync | https://github.com/oaslananka-lab/_ops/actions/runs/25769308037 |
| Fleet parity audit | https://github.com/oaslananka-lab/_ops/actions/runs/25769426735 |
