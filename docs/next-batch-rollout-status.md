# Next Batch Rollout Status

Generated: 2026-05-11

This report covers the resumed onboarding batch after the initial source/mirror rollout.

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

## Policy Commit

`0562088e3b868ed526770a41c99f66410b527696` added source and mirror policy files for every repository in this batch.

`4b0066027ac32e06f3bedd5ff0ffa1866772ecbf` fixed publish workflow discovery so the orchestrator skips workflows without `workflow_dispatch`, recognizes `mcp-registry.yml`, and dispatches MCP registry workflows with `publish=true`.

## Evidence

| Repo | Topology audit | Ruleset audit | Repo audit | Release plan | Release gate | Release orchestrator | Publish/deploy state | Remaining |
|---|---|---|---|---|---|---|---|---|
| `kicad-mcp-pro` | https://github.com/oaslananka-lab/_ops/actions/runs/25684378929 | https://github.com/oaslananka-lab/_ops/actions/runs/25684382014 | https://github.com/oaslananka-lab/_ops/actions/runs/25684385513 | https://github.com/oaslananka-lab/_ops/actions/runs/25684388414 | https://github.com/oaslananka-lab/_ops/actions/runs/25685246099 | https://github.com/oaslananka-lab/_ops/actions/runs/25685232435 | awaiting environment approval on MCP Registry run https://github.com/oaslananka-lab/kicad-mcp-pro/actions/runs/25685286341 | `AWAITING_PRODUCTION_ENVIRONMENT_APPROVAL`; `MCP_REGISTRY_TOKEN` missing for production |
| `mcp-ssh-tool` | https://github.com/oaslananka-lab/_ops/actions/runs/25684391576 | https://github.com/oaslananka-lab/_ops/actions/runs/25684394684 | https://github.com/oaslananka-lab/_ops/actions/runs/25684397857 | https://github.com/oaslananka-lab/_ops/actions/runs/25684401028 | https://github.com/oaslananka-lab/_ops/actions/runs/25685253400 | https://github.com/oaslananka-lab/_ops/actions/runs/25685245036 | release workflow clean; Docker workflow smoke clean at https://github.com/oaslananka-lab/mcp-ssh-tool/actions/runs/25685436692 | npm/MCP publish still requires production workflow/registry configuration and `NPM_TOKEN` or trusted publishing plus `MCP_REGISTRY_TOKEN` |
| `fovux` | https://github.com/oaslananka-lab/_ops/actions/runs/25684404004 | https://github.com/oaslananka-lab/_ops/actions/runs/25684407091 | https://github.com/oaslananka-lab/_ops/actions/runs/25684410194 | https://github.com/oaslananka-lab/_ops/actions/runs/25684413281 | https://github.com/oaslananka-lab/_ops/actions/runs/25684604125 | https://github.com/oaslananka-lab/_ops/actions/runs/25684606799 | `NO_PUBLISH_TARGET_DETECTED` | open Dependabot PRs remain outside rollout scope: mirror #31, source #26 |
| `a2a-mesh` | https://github.com/oaslananka-lab/_ops/actions/runs/25684416349 | https://github.com/oaslananka-lab/_ops/actions/runs/25684419813 | https://github.com/oaslananka-lab/_ops/actions/runs/25684422826 | https://github.com/oaslananka-lab/_ops/actions/runs/25684426329 | https://github.com/oaslananka-lab/_ops/actions/runs/25684610804 | https://github.com/oaslananka-lab/_ops/actions/runs/25684615185 | `published` | source Dependabot PRs #11, #12, #13 remain outside rollout scope |
| `codex-app-server-web` | https://github.com/oaslananka-lab/_ops/actions/runs/25684429537 | https://github.com/oaslananka-lab/_ops/actions/runs/25684432859 | https://github.com/oaslananka-lab/_ops/actions/runs/25684435891 | https://github.com/oaslananka-lab/_ops/actions/runs/25684439270 | https://github.com/oaslananka-lab/_ops/actions/runs/25684619941 | https://github.com/oaslananka-lab/_ops/actions/runs/25684623913 | `NO_PUBLISH_TARGET_DETECTED` | none |
| `cifence` | https://github.com/oaslananka-lab/_ops/actions/runs/25684442810 | https://github.com/oaslananka-lab/_ops/actions/runs/25684445795 | https://github.com/oaslananka-lab/_ops/actions/runs/25684448959 | https://github.com/oaslananka-lab/_ops/actions/runs/25684451896 | https://github.com/oaslananka-lab/_ops/actions/runs/25684627982 | https://github.com/oaslananka-lab/_ops/actions/runs/25684631878 | `NO_PUBLISH_TARGET_DETECTED` | none |
| `oaslananka.github.io` | https://github.com/oaslananka-lab/_ops/actions/runs/25684455019 | https://github.com/oaslananka-lab/_ops/actions/runs/25684458106 | https://github.com/oaslananka-lab/_ops/actions/runs/25684461553 | https://github.com/oaslananka-lab/_ops/actions/runs/25684464810 | https://github.com/oaslananka-lab/_ops/actions/runs/25684637699 | https://github.com/oaslananka-lab/_ops/actions/runs/25684640860 | `published` | open Dependabot PRs remain outside rollout scope: mirror #8-#12, source #8-#11 |

## Production Environment Audit

Production environments were created through `_ops` using GitHub App tokens:

| Repo | Run | State | Missing secret names |
|---|---|---|---|
| `kicad-mcp-pro` | https://github.com/oaslananka-lab/_ops/actions/runs/25685165883 | `production_environment_created` | `MCP_REGISTRY_TOKEN` |
| `mcp-ssh-tool` | https://github.com/oaslananka-lab/_ops/actions/runs/25685169238 | `production_environment_created` | `MCP_REGISTRY_TOKEN`, `NODE_AUTH_TOKEN`, `NPM_TOKEN` |
| `a2a-mesh` | https://github.com/oaslananka-lab/_ops/actions/runs/25685172692 | `production_environment_created` | `NODE_AUTH_TOKEN`, `NPM_TOKEN` |
| `oaslananka.github.io` | https://github.com/oaslananka-lab/_ops/actions/runs/25685176236 | `production_environment_created` | none |

Secret names are recorded only as names. No values are present in this report.

