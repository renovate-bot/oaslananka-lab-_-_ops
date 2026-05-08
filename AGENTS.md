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
