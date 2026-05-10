---
name: Issue Triage
on:
  workflow_dispatch:
    inputs:
      target_owner:
        required: true
        type: string
      target_repo:
        required: true
        type: string
      issue_number:
        required: true
        type: string
permissions:
  issues: read
engine: copilot
safe-outputs:
  add-labels:
    allowed:
      - bug
      - enhancement
      - question
      - security
      - docs
      - ops
      - duplicate
    max: 3
  add-comment:
    max: 1
    footer: false
  close-issue:
    required-labels:
      - duplicate
    max: 1
---

# Issue Triage Agent

Classify the new issue and take the appropriate action.

## Dispatch Inputs

- Target repository: `{{inputs.target_owner}}/{{inputs.target_repo}}`
- Issue number: `{{inputs.issue_number}}`

This workflow is dispatch-only until the `_ops` repository has a valid `COPILOT_GITHUB_TOKEN` secret for gh-aw runtime execution. Production issue webhooks continue to use `inbox-handler.yml`.

## Classification Rules

- `bug`: error message, unexpected behavior, regression.
- `feature`: request for new functionality.
- `question`: asks how something works.
- `security`: vulnerability, credential leak, data exposure.
- `docs`: documentation error or missing docs.
- `ops`: CI failure, workflow error, release issue.
- `duplicate`: same as an existing open issue.

## Actions Per Class

- `bug`: label `bug`, then comment with a reproduction checklist template.
- `feature`: label `enhancement`, then comment with an implementation proposal template.
- `question`: label `question`, then answer if the answer is clear from README or docs.
- `security`: label `security` and `ops`, then comment only: `Thank you. A maintainer will follow up privately.`
- `docs`: label `docs`, then comment with a suggested fix if the change is small.
- `ops`: label `ops`, then comment with diagnostic steps.
- `duplicate`: label `duplicate`, then close with a link to the original issue.

## Rules

- Apply one primary label per issue, plus `ops` only when security or operations scope requires it.
- Do not speculate on root cause for security issues.
- Do not expose internal paths, tokens, or infrastructure details in comments.
- Always be concise and helpful.
- Use only the available safe-output tools: `add_labels`, `add_comment`, `close_issue`, or `noop`.
