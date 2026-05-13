# Full Repository Rollout Status

Generated: 2026-05-13

This file records the current source/mirror and publish-status truth for the original rollout set. Older blocker snapshots were removed so this page does not contradict the active fleet state.

## Scope

| Source | Mirror | Role |
|---|---|---|
| `oaslananka/boardguard` | `oaslananka-lab/boardguard` | canonical source + CI/CD mirror |
| `oaslananka/kicad-studio` | `oaslananka-lab/kicad-studio` | canonical source + CI/CD mirror |
| `oaslananka/mcp-health-monitor` | `oaslananka-lab/mcp-health-monitor` | canonical source + CI/CD mirror |
| `oaslananka/mcp-debug-recorder` | `oaslananka-lab/mcp-debug-recorder` | canonical source + CI/CD mirror |
| `oaslananka/mcp-infra-lens` | `oaslananka-lab/mcp-infra-lens` | canonical source + CI/CD mirror |
| `oaslananka/test` | `oaslananka-lab/test` | smoke-only source + mirror |

## Current Fleet Evidence

| Check | Run |
|---|---|
| Fleet parity audit | https://github.com/oaslananka-lab/_ops/actions/runs/25769426735 |
| Fleet security-state audit | https://github.com/oaslananka-lab/_ops/actions/runs/25769431276 |
| Fleet health | https://github.com/oaslananka-lab/_ops/actions/runs/25769435016 |
| Mirror drift check | https://github.com/oaslananka-lab/_ops/actions/runs/25769438579 |

## Current Source/Mirror State

| Repo | Tree relation | Dependabot config relation | Current action |
|---|---|---|---|
| `boardguard` | `tree_equal` | `match` | none |
| `kicad-studio` | `tree_equal` | `match` | none |
| `mcp-health-monitor` | `tree_equal` | `match` | none |
| `mcp-debug-recorder` | `tree_equal` | `match` | none |
| `mcp-infra-lens` | `tree_equal` | `match` | none |
| `test` | `equal` | `not_managed` | none |

`tree_equal` is accepted because source and mirror contents are byte-equivalent even when commit SHAs differ after squash merges.

## Publish Truth

Publish workflow discovery and production environment creation gaps are closed. Current remaining publish outcomes are registry-side or package-channel states, not missing workflow or missing environment states.

| Repo | Publish/deploy state |
|---|---|
| `boardguard` | npm publish path exists; current registry-side state requires npm trusted publishing or protected `NPM_TOKEN` / `NODE_AUTH_TOKEN` if token fallback is allowed. |
| `kicad-studio` | VS Code Marketplace and Open VSX publish path exists and the prior marketplace publish evidence completed. Duplicate versions are treated as idempotent no-op, not fresh publish. |
| `mcp-health-monitor` | npm/MCP publish path exists; npm publishing requires npm trusted publishing or protected `NPM_TOKEN` / `NODE_AUTH_TOKEN`. |
| `mcp-debug-recorder` | npm/MCP publish path exists; npm publishing requires npm trusted publishing or protected `NPM_TOKEN` / `NODE_AUTH_TOKEN`. |
| `mcp-infra-lens` | npm is aligned; MCP registry publishing requires valid MCP registry metadata/config. |
| `test` | publish disabled by smoke-only policy. |

## Agent And Dependabot Closeout

Agent Fix Loop v2 was hardened after failed runs on `a2a-mesh#34` exposed two automation bugs:

- Bot commit/push now disables local hooks with `HUSKY=0`, preventing repository pre-push hooks from blocking automation pushes.
- Rollback is ancestry-safe and skips local-only or absent commits instead of failing with `fatal: bad object`.
- TypeScript 6 `TS5101` / `baseUrl` deprecation is classified as `typescript baseUrl deprecation` and patched by adding `"ignoreDeprecations": "6.0"` to affected `tsconfig*.json` files.
- Dependabot major updates are labeled `dependabot-major-review-required` and are not finalized unless policy explicitly permits major auto-merge.
- Conflicting Dependabot PRs are labeled `needs-human-conflict-resolution` and receive an `@dependabot rebase` request before any fix-loop retry.

Evidence:

| Event | Evidence |
|---|---|
| Agent Fix Loop rerun for `a2a-mesh#34` | https://github.com/oaslananka-lab/_ops/actions/runs/25767720900 |
| Finalize `a2a-mesh#34` | https://github.com/oaslananka-lab/_ops/actions/runs/25767948251 |
| Promote-back/source merge for `a2a-mesh` | https://github.com/oaslananka-lab/_ops/actions/runs/25768068423 |
| Mirror sync for `a2a-mesh` | https://github.com/oaslananka-lab/_ops/actions/runs/25768078296 |
| Dependabot automation latest run | https://github.com/oaslananka-lab/_ops/actions/runs/25768974763 |
| `mcp-ssh-tool` repair sync | https://github.com/oaslananka-lab/_ops/actions/runs/25769208774 |
| `mcp-ssh-tool#76` finalize | https://github.com/oaslananka-lab/_ops/actions/runs/25769308037 |

## Final Notes

Production environments exist for product mirrors, required reviewers are zero in the current fleet-health artifact, and current open Dependabot PRs are classified as either major-review backlog or conflict backlog. Source-side Dependabot PRs are closed by policy because source dependency automation is disabled and mirror-side automation is managed through `_ops`.
