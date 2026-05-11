# Full Repository Rollout Status

Generated: 2026-05-11

## Scope

Canonical source repositories:

```text
oaslananka/boardguard
oaslananka/kicad-studio
oaslananka/mcp-health-monitor
oaslananka/mcp-debug-recorder
oaslananka/mcp-infra-lens
oaslananka/test
```

CI/CD mirror repositories:

```text
oaslananka-lab/boardguard
oaslananka-lab/kicad-studio
oaslananka-lab/mcp-health-monitor
oaslananka-lab/mcp-debug-recorder
oaslananka-lab/mcp-infra-lens
oaslananka-lab/test
```

Policy rollout commit:

```text
e53ae5a2e673f126f900d5ea74a3ea3db84ac7c8
```

## Summary

Current closeout supersedes the earlier blocker table below. The active final state as of 2026-05-11 is:

| Repo | Topology | Release gate | Release orchestrator | Publish/deploy state | Remaining blocker |
|---|---|---|---|---|---|
| `boardguard` | ready/tree_equal | https://github.com/oaslananka-lab/_ops/actions/runs/25682135136 | https://github.com/oaslananka-lab/_ops/actions/runs/25682139216 | npm publish workflow exists; final run https://github.com/oaslananka-lab/boardguard/actions/runs/25682257627 failed with exact npm auth/trusted-publishing blocker | `NPM_TRUSTED_PUBLISHING_NOT_CONFIGURED`; `NPM_TOKEN_SECRET_MISSING` |
| `kicad-studio` | ready/tree_equal | https://github.com/oaslananka-lab/_ops/actions/runs/25682147980 | https://github.com/oaslananka-lab/_ops/actions/runs/25682152731 | VS Code Marketplace and Open VSX publish succeeded at https://github.com/oaslananka-lab/kicad-studio/actions/runs/25682226343 | none |
| `mcp-health-monitor` | ready/tree_equal | https://github.com/oaslananka-lab/_ops/actions/runs/25682161010 | https://github.com/oaslananka-lab/_ops/actions/runs/25682164994 | latest protected run waiting at https://github.com/oaslananka-lab/mcp-health-monitor/actions/runs/25684043850; prior run https://github.com/oaslananka-lab/mcp-health-monitor/actions/runs/25683106571 failed with exact npm auth blocker | `AWAITING_PRODUCTION_ENVIRONMENT_APPROVAL`; then `NPM_TRUSTED_PUBLISHING_NOT_CONFIGURED` or `NPM_TOKEN_SECRET_MISSING` unless npm trusted publishing/secret is configured |
| `mcp-debug-recorder` | ready/tree_equal | https://github.com/oaslananka-lab/_ops/actions/runs/25682173258 | https://github.com/oaslananka-lab/_ops/actions/runs/25682177577 | latest protected run waiting at https://github.com/oaslananka-lab/mcp-debug-recorder/actions/runs/25684067281; prior run https://github.com/oaslananka-lab/mcp-debug-recorder/actions/runs/25683116353 failed with exact npm auth blocker | `AWAITING_PRODUCTION_ENVIRONMENT_APPROVAL`; then `NPM_TRUSTED_PUBLISHING_NOT_CONFIGURED` or `NPM_TOKEN_SECRET_MISSING` unless npm trusted publishing/secret is configured |
| `mcp-infra-lens` | ready/tree_equal | https://github.com/oaslananka-lab/_ops/actions/runs/25682185881 | https://github.com/oaslananka-lab/_ops/actions/runs/25682190070 | npm publish succeeded; MCP registry job failed at https://github.com/oaslananka-lab/mcp-infra-lens/actions/runs/25682261512 with registry publish command/config missing | `MCP_REGISTRY_CONFIG_MISSING`; exact emitted detail: `MCP_REGISTRY_PUBLISH_COMMAND_NOT_CONFIGURED` |
| `test` | ready/tree_equal | release disabled | not required | smoke-only; publish disabled by policy | none |

Production environments exist for every product mirror and were created/verified through `_ops` with GitHub App tokens. No target repository has a remaining `PUBLISH_WORKFLOW_NOT_FOUND` or `PRODUCTION_ENVIRONMENT_MISSING` blocker.

Image-observed annotations were also addressed: the final boardguard and MCP publish workflow logs no longer show `Node.js 20 actions are deprecated` or `Unexpected input(s) 'package-manager-cache'`; action pins and setup-node inputs were updated before final publish reruns.

| Repo | Topology | Release gate | Release orchestrator | Publish state | Remaining blocker |
|---|---|---|---|---|---|
| `boardguard` | `ready`, `tree_equal` | ready | `publish_workflow_not_found` | blocked | `publish_workflow_not_found` |
| `kicad-studio` | `ready`, `equal` | ready | `publish_workflow_not_found` | blocked | `ruleset_code_owner_review_required`; `production_environment_missing`; `publish_workflow_not_found` |
| `mcp-health-monitor` | `ready`, `tree_equal` | ready | `release_workflow_failed` | blocked | `npm_publish_e404` |
| `mcp-debug-recorder` | `ready`, `tree_equal` | ready | `publish_workflow_not_found` | blocked | `publish_workflow_not_found` |
| `mcp-infra-lens` | `ready`, `tree_equal` | ready | `publish_workflow_not_found` | blocked | `publish_workflow_not_found` |
| `test` | `ready`, `equal` | release disabled | not run | disabled by policy | none |

## Per-Repository Evidence

### boardguard

```text
source:              oaslananka/boardguard
mirror:              oaslananka-lab/boardguard
topology audit:       https://github.com/oaslananka-lab/_ops/actions/runs/25648430322
ruleset audit:        https://github.com/oaslananka-lab/_ops/actions/runs/25648151714
promote-back:         source PR #2 merged
source merge commit:  84a376e23a00042f91dd90cc8e972978834dac86
mirror sync:          https://github.com/oaslananka-lab/_ops/actions/runs/25648383199
release gate:         https://github.com/oaslananka-lab/_ops/actions/runs/25648505030
release orchestrator: https://github.com/oaslananka-lab/_ops/actions/runs/25648564700
release PR:           https://github.com/oaslananka-lab/boardguard/pull/18
release merge commit: c0afc53c4bc025ad3fbb928ec3121218cec92fd8
publish state:        publish_workflow_not_found
remaining blocker:    publish_workflow_not_found
```

### kicad-studio

```text
source:              oaslananka/kicad-studio
mirror:              oaslananka-lab/kicad-studio
topology audit:       https://github.com/oaslananka-lab/_ops/actions/runs/25648438697
ruleset audit:        https://github.com/oaslananka-lab/_ops/actions/runs/25648156854
release gate:         https://github.com/oaslananka-lab/_ops/actions/runs/25648513755
release orchestrator: https://github.com/oaslananka-lab/_ops/actions/runs/25648590951
publish state:        publish_workflow_not_found
ruleset issue:        production environment is missing
```

Open mirror PRs were patched and remote checks are green:

```text
PR #41: https://github.com/oaslananka-lab/kicad-studio/pull/41
  patch commit: d3b2da057675c5db14c70f8c9a5231fe1b427498
  finalize run: https://github.com/oaslananka-lab/_ops/actions/runs/25649214889
  final state: merge_failed
  blocker: gh: Waiting on code owner review from oaslananka. (HTTP 405)

PR #42: https://github.com/oaslananka-lab/kicad-studio/pull/42
  patch commit: 948529383286a184123b6ad10f07ba5efac708ad
  finalize run: https://github.com/oaslananka-lab/_ops/actions/runs/25649228425
  final state: merge_failed
  blocker: gh: Waiting on code owner review from oaslananka. (HTTP 405)

PR #43: https://github.com/oaslananka-lab/kicad-studio/pull/43
  patch commit: 99d7bbb62a76e47630df35a3c8a0320e70f9f003
  finalize run: https://github.com/oaslananka-lab/_ops/actions/runs/25649249486
  final state: merge_failed
  blocker: gh: Waiting on code owner review from oaslananka. (HTTP 405)

PR #44: https://github.com/oaslananka-lab/kicad-studio/pull/44
  patch commit: 8ace26768efb1a60e7f835b2a1f96febc62b0d10
  finalize run: https://github.com/oaslananka-lab/_ops/actions/runs/25649265759
  final state: merge_failed
  blocker: gh: Waiting on code owner review from oaslananka. (HTTP 405)

PR #45: https://github.com/oaslananka-lab/kicad-studio/pull/45
  patch commit: 19578a328d4e5f8673639a873d89921f04799846
  finalize run: https://github.com/oaslananka-lab/_ops/actions/runs/25649284003
  final state: merge_failed
  blocker: gh: Waiting on code owner review from oaslananka. (HTTP 405)
```

The kicad PR patch was restricted to `pnpm-lock.yaml` formatting. The local pre-commit path ran format, lint, typecheck, unit tests, and build before each branch push. GitHub-side checks are green on the patched heads.

### mcp-health-monitor

```text
source:                     oaslananka/mcp-health-monitor
mirror:                     oaslananka-lab/mcp-health-monitor
initial promote-back:        https://github.com/oaslananka-lab/_ops/actions/runs/25648306980
initial source PR:           https://github.com/oaslananka/mcp-health-monitor/pull/4
initial source merge commit: c6977a9e2f071b5c364613f0ef2d6f0a3da3ccb6
release PR finalize:         https://github.com/oaslananka-lab/_ops/actions/runs/25648716155
release PR:                  https://github.com/oaslananka-lab/mcp-health-monitor/pull/1
release merge commit:        0480a925910b69ddc4f53557855a154de9e2370b
release promote-back:        https://github.com/oaslananka-lab/_ops/actions/runs/25648816429
release source PR:           https://github.com/oaslananka/mcp-health-monitor/pull/5
release source merge commit: b0a90eb9ec272b40c11c0ef3dc9da6212ddf8262
mirror sync:                 https://github.com/oaslananka-lab/_ops/actions/runs/25648823702
final topology audit:        https://github.com/oaslananka-lab/_ops/actions/runs/25648842281
release gate:                https://github.com/oaslananka-lab/_ops/actions/runs/25648853036
release orchestrator:        https://github.com/oaslananka-lab/_ops/actions/runs/25648861038
release workflow:            https://github.com/oaslananka-lab/mcp-health-monitor/actions/runs/25648732393
publish state:               npm_publish_e404
```

Release workflow blocker:

```text
job:      release-assets
step:     Publish to npm
package:  mcp-health-monitor@1.0.4
error:    npm error code E404
details:  PUT https://registry.npmjs.org/mcp-health-monitor returned Not found
note:     NODE_AUTH_TOKEN was empty in the publish step; publish requires npm trusted publishing setup or an approved publish credential path.
```

### mcp-debug-recorder

```text
source:              oaslananka/mcp-debug-recorder
mirror:              oaslananka-lab/mcp-debug-recorder
promote-back:         https://github.com/oaslananka-lab/_ops/actions/runs/25648333244
source PR:            https://github.com/oaslananka/mcp-debug-recorder/pull/4
source merge commit:  9b937121ba2eb9213aef973fd5bcbdf0a0923847
mirror sync:          https://github.com/oaslananka-lab/_ops/actions/runs/25648403555
topology audit:       https://github.com/oaslananka-lab/_ops/actions/runs/25648460556
ruleset audit:        https://github.com/oaslananka-lab/_ops/actions/runs/25648166609
release gate:         https://github.com/oaslananka-lab/_ops/actions/runs/25648534365
release orchestrator: https://github.com/oaslananka-lab/_ops/actions/runs/25648655235
publish state:        publish_workflow_not_found
remaining blocker:    publish_workflow_not_found
```

### mcp-infra-lens

```text
source:              oaslananka/mcp-infra-lens
mirror:              oaslananka-lab/mcp-infra-lens
promote-back:         https://github.com/oaslananka-lab/_ops/actions/runs/25648359287
source PR:            https://github.com/oaslananka/mcp-infra-lens/pull/6
source merge commit:  397752ed64069e68d34459dc98afb8bd8d12df71
mirror sync:          https://github.com/oaslananka-lab/_ops/actions/runs/25648415983
topology audit:       https://github.com/oaslananka-lab/_ops/actions/runs/25648472903
ruleset audit:        https://github.com/oaslananka-lab/_ops/actions/runs/25648171291
release gate:         https://github.com/oaslananka-lab/_ops/actions/runs/25648544653
release orchestrator: https://github.com/oaslananka-lab/_ops/actions/runs/25648679014
publish state:        publish_workflow_not_found
remaining blocker:    publish_workflow_not_found
```

### test

```text
source:        oaslananka/test
mirror:        oaslananka-lab/test
topology audit: https://github.com/oaslananka-lab/_ops/actions/runs/25648483593
ruleset audit:  https://github.com/oaslananka-lab/_ops/actions/runs/25648175776
publish state:  disabled_by_policy
remaining:      none
```

## NotebookLM Handoff

NotebookLM import was attempted after the rollout request. Current local NotebookLM access is blocked before notebook operations can run:

```text
tool:      NotebookLM MCP / nlm CLI
path:      C:\Users\Admin\.notebooklm-mcp-cli\profiles
error:     [WinError 5] Erişim engellendi
commands:  notebook_list, refresh_auth, nlm notebook list, nlm doctor
takeown:   ERROR: Erişim engellendi
```

No source documents were imported in this pass because the NotebookLM profile directory is inaccessible to the current Windows process. The current package reports version `0.6.7`, latest `0.6.8`, and suggests:

```text
uv tool upgrade notebooklm-mcp-cli
```

The previous isolated local profile path used by earlier runs is not active in the current MCP server, and switching NotebookLM auth storage would require reauthentication.
