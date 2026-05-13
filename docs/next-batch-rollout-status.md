# Next Batch Rollout Status

Generated: 2026-05-13

This report covers the expanded repository batch. It reflects the post-closeout state after Dependabot automation and source/mirror parity repairs.

## Scope

| Repo | Source | Mirror | Classification | Publish target |
|---|---|---|---|---|
| `kicad-mcp-pro` | `oaslananka/kicad-mcp-pro` | `oaslananka-lab/kicad-mcp-pro` | Python/Node MCP server with PyPI/GHCR/MCP registry metadata | GHCR and MCP Registry |
| `mcp-ssh-tool` | `oaslananka/mcp-ssh-tool` | `oaslananka-lab/mcp-ssh-tool` | Node MCP server with npm, GHCR, and registry metadata | npm, GHCR, MCP Registry |
| `fovux` | `oaslananka/fovux` | `oaslananka-lab/fovux` | multi-package app/research workspace | no production publish target detected |
| `a2a-mesh` | `oaslananka/a2a-mesh` | `oaslananka-lab/a2a-mesh` | Node workspace/package | npm release path |
| `codex-app-server-web` | `oaslananka/codex-app-server-web` | `oaslananka-lab/codex-app-server-web` | Next.js web app | no production publish target detected |
| `cifence` | `oaslananka/cifence` | `oaslananka-lab/cifence` | packaged GitHub Action/tool | GitHub release only; no separate package publish target detected |
| `oaslananka.github.io` | `oaslananka/oaslananka.github.io` | `oaslananka-lab/oaslananka.github.io` | site repo | GitHub Pages/deploy workflow |

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
| `kicad-mcp-pro` | `tree_equal` | `match` | none |
| `mcp-ssh-tool` | `tree_equal` | `match` | repaired by `mcp-ssh-tool#76` and finalize run https://github.com/oaslananka-lab/_ops/actions/runs/25769308037 |
| `fovux` | `tree_equal` | `match` | none |
| `a2a-mesh` | `tree_equal` | `match` | `a2a-mesh#34` merged and promoted; stale source PRs closed |
| `codex-app-server-web` | `tree_equal` | `match` | none |
| `cifence` | `equal` | `match` | none |
| `oaslananka.github.io` | `tree_equal` | `match` | none |

## Dependabot Policy

Dependabot is policy-managed by `_ops`.

- `.github/dependabot.yml` is generated from policy and kept byte-identical on source and mirror.
- Source-side security automation remains disabled by repository settings, so source files are inert.
- Mirror-side security automation remains enabled by repository settings, so the same file is active in the CI/CD mirror.
- Source-side Dependabot PRs are closed with an explanatory marker comment.
- Mirror patch/minor PRs with clean checks are finalized through `_ops` `ops-pr-finalize.yml`.
- Mirror major PRs are labeled `dependabot-major-review-required`.
- Conflicting PRs are labeled `needs-human-conflict-resolution` and receive `@dependabot rebase`.

Latest automation evidence:

| Event | Evidence |
|---|---|
| Dependabot automation run | https://github.com/oaslananka-lab/_ops/actions/runs/25768974763 |
| `a2a-mesh#34` TypeScript 6 fix-loop | https://github.com/oaslananka-lab/_ops/actions/runs/25767720900 |
| `mcp-ssh-tool#74` fix-loop/finalize | https://github.com/oaslananka-lab/_ops/actions/runs/25768308383 and https://github.com/oaslananka-lab/_ops/actions/runs/25768447098 |
| `mcp-ssh-tool#76` sync/finalize | https://github.com/oaslananka-lab/_ops/actions/runs/25769208774 and https://github.com/oaslananka-lab/_ops/actions/runs/25769308037 |

## Publish And Deploy Notes

This closeout did not reclassify registry ownership or secret availability. Current publish/deploy truth remains:

- npm packages require npm trusted publishing configuration or protected `NPM_TOKEN` / `NODE_AUTH_TOKEN` where policy allows fallback.
- MCP Registry publishing requires valid server metadata and registry setup.
- `fovux`, `codex-app-server-web`, and `cifence` do not currently have a separate production package publish target detected.
- `oaslananka.github.io` remains the GitHub Pages/deploy target.

Secret values are never recorded here; only secret names are referenced.
