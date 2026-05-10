# AGENTS.md

All agents working in this repository must follow:

```text
docs/agent-operating-contract.md
```

Non-negotiable rules:

```text
1. Do not stop after a partial patch.
2. Always diagnose before patching.
3. Use the existing PR branch.
4. Do not create unnecessary PRs or branches.
5. Fix current-head failures only.
6. Resolve actionable review threads.
7. Re-run checks until clean.
8. Do not merge unless diagnostics are clean.
9. Prefer squash merge.
10. Use _ops as the control-plane.
```

For repository operations, run workflows from:

```text
oaslananka-lab/_ops
```

## Architecture

See docs/architecture.md for the full system model.

Current controlled scope:
  control-plane: oaslananka-lab/_ops
  test repo: oaslananka-lab/test
  pilot repo: oaslananka-lab/boardguard
  Group B pilots:
    - oaslananka-lab/mcp-health-monitor
    - oaslananka-lab/mcp-debug-recorder
    - oaslananka-lab/mcp-infra-lens

Personal repos (oaslananka):
  role: source of truth
  actions: DISABLED — never attempt to trigger workflows here
  agent writes: code commits only

Org repos (oaslananka-lab):
  role: CI/CD and release plane
  actions: ENABLED
  agent writes: workflow fixes only, never code changes

Sync: personal → org (one-way). Never reverse.

## Webhook events

All GitHub events from personal repos are routed through:
  https://webhook.oaslananka.dev
  → oaslananka-lab/_ops workflow dispatch

When working from a webhook-triggered context:
  inputs.event_type tells you what happened
  inputs.source_owner will be oaslananka (personal)
  Always run diagnostics before patching

## MCP tools available in Codex

GitHub MCP    : full repo read/write, PR, issue, workflow dispatch
Cloudflare MCP: DNS record management for oaslananka.dev
Render MCP    : web service deploy/manage for webhook receiver
gh CLI        : fallback for any GitHub operation
