---
name: CI Doctor
on:
  check_run:
    types:
      - completed
  workflow_run:
    workflows:
      - CI
      - Security
      - CodeQL
    types:
      - completed
    branches:
      - main
permissions:
  issues: read
  pull-requests: read
  actions: read
engine: copilot
safe-outputs:
  add-comment:
    target: "*"
    allowed-repos:
      - oaslananka-lab/*
    max: 3
    footer: false
  dispatch-workflow:
    workflows:
      - pr-fix
    max: 1
---

# CI Doctor Agent

When a CI workflow fails, diagnose the root cause and post a structured report.

## On Failure

1. Fetch the failed run logs.
2. Identify the failing step and error message.
3. Classify the failure:
   - `format/lint`: deterministic fix exists; trigger the PR Fix workflow.
   - `flaky-test`: retry evidence is inconsistent.
   - `build-error`: dependency or compile issue.
   - `security-scan`: new alert from CodeQL, Gitleaks, or zizmor.
   - `pre-merge-metadata`: title, description, or docstring coverage pre-merge gate.
   - `infrastructure`: runner OOM, service outage, network timeout.
   - `unknown`: provide a raw log excerpt.

4. If a PR is associated:
   - Use the `add_comment` safe-output tool to post a structured comment with classification and suggested fix.
   - If classification is `format/lint`, `pre-merge-metadata`, or another deterministic patchable class, use the `dispatch_workflow` safe-output tool to trigger `pr-fix`.

5. Never close PRs or issues automatically.
6. Never dismiss security alerts automatically.

## Report Format

```text
## CI Doctor Report

Run: <link>
Classification: <class>
Failing step: <step name>
Error: <brief excerpt>
Suggested fix: <1-2 sentences>
Auto-patch: <triggered|not triggered|manual required>
```

If no action is needed, you must call the `noop` tool with:

```json
{"noop":{"message":"No action needed: CI did not fail or no PR was associated."}}
```
