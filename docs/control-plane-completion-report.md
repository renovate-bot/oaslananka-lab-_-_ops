# Control-Plane Completion Report

Generated: 2026-05-09

## 1. Changed files

Repository build files already present and verified:

- `AGENTS.md`
- `README.md`
- `docs/agent-operating-contract.md`
- `docs/agent-progress.md`
- `docs/architecture.md`
- `docs/doppler-integration.md`
- `docs/mirror-map.md`
- `docs/accepted-findings/boardguard-scorecard.md`
- `docs/templates/AGENTS-org-repo.md`
- `docs/templates/AGENTS-personal-repo.md`
- `.github/workflows/agent-fix-loop.yml`
- `.github/workflows/agent-pr-diagnostics.yml`
- `.github/workflows/inbox-handler.yml`
- `.github/workflows/repo-audit.yml`
- `.github/workflows/repo-baseline-apply.yml`
- `.github/workflows/repo-baseline-plan.yml`
- `.github/workflows/repo-code-scanning-triage.yml`
- `.github/workflows/repo-mirror-sync.yml`
- `.github/workflows/repo-onboarding.yml`
- `.github/workflows/repo-ops-cross-repo-smoke.yml`
- `.github/workflows/repo-release-apply.yml`
- `.github/workflows/repo-release-plan.yml`
- `.github/workflows/repo-ruleset-profile.yml`
- `services/ops_webhook/__init__.py`
- `services/ops_webhook/app.py`
- `services/ops_webhook/requirements.txt`

This completion pass added:

- `docs/control-plane-completion-report.md`
- `.gitignore` entries for `release-artifacts/` and `plan-artifacts/`

## 2. Workflow run URLs

- Cross-repo smoke on `oaslananka-lab/test`: https://github.com/oaslananka-lab/_ops/actions/runs/25596187654
- Boardguard audit: https://github.com/oaslananka-lab/_ops/actions/runs/25596202222
- Boardguard onboarding: https://github.com/oaslananka-lab/_ops/actions/runs/25596214874
- Boardguard Scorecard triage: https://github.com/oaslananka-lab/_ops/actions/runs/25596230060
- Boardguard release plan: https://github.com/oaslananka-lab/_ops/actions/runs/25596242502

Verification results:

- `_ops` workflow YAML parse: clean for every `.github/workflows/*.yml` file.
- `_ops` App config: `REPO_OPS_APP_CLIENT_ID` variable exists and `REPO_OPS_APP_PRIVATE_KEY` secret exists.
- Cross-repo smoke: success.
- Boardguard audit: success.
- Boardguard onboarding: success.
- Boardguard code-scanning triage: success.
- Boardguard release plan: success.
- Webhook health: `https://ops-webhook-wi0r.onrender.com/health` returned `200 OK` with `{"status":"ok"}`.

Boardguard audit summary:

- Target: `oaslananka-lab/boardguard`
- Default branch: `main`
- Active branch rules: `3`
- Secret scanning alerts endpoint: OK
- Dependency graph SBOM endpoint: OK
- Open code scanning alerts: `7`
- Selected Actions policy: OK

Boardguard onboarding summary:

- Baseline issue count requiring action: `1`
- Only issue: `code-scanning-open-alerts`

Boardguard code-scanning triage summary:

- Total open alerts: `7`
- Tool: `Scorecard`
- `actionable_patch_count`: `0`
- `process_policy_deferred_count`: `6`
- `ruleset_or_review_model_count`: `1`
- `manual_review_count`: `0`

Boardguard release-plan summary:

- `release-please-config.json`: present
- `.release-please-manifest.json`: present
- release workflow: present
- release workflow has `contents: write`: yes
- release workflow has `attestations: write`: yes
- release workflow uses `actions/attest`: yes
- release readiness issue: `production environment is missing`

## 3. Artifact paths

- `C:\Users\Admin\Desktop\_ops\audit-artifacts\boardguard-current\repo-audit.json`
- `C:\Users\Admin\Desktop\_ops\onboarding-artifacts\boardguard-current\onboarding-report.json`
- `C:\Users\Admin\Desktop\_ops\triage-artifacts\boardguard-current\code-scanning-triage.json`
- `C:\Users\Admin\Desktop\_ops\release-artifacts\boardguard-current\release-plan-oaslananka-lab-boardguard.json`

## 4. PR URLs

- PR #7: https://github.com/oaslananka-lab/boardguard/pull/7
  - State: merged.
  - Merge commit: `83318ef3ea8b75da3f8ee1001456c888283b3fe9`.
  - Checks at merge: green.

Open PRs observed but not modified:

- PR #13: https://github.com/oaslananka-lab/boardguard/pull/13
- PR #14: https://github.com/oaslananka-lab/boardguard/pull/14
  - Current checks include failing CI.
  - Not patched in this pass because the requested completion flow only named PR #7 and forbids unrelated/random branch or PR work.

## 5. Remaining deferred findings

- Scorecard process/policy deferred findings: `CI-Tests`, `SAST`, `CII-Best-Practices`, `Code-Review`, `Fuzzing`, `Maintained`.
- Scorecard ruleset/review-model finding: `Branch-Protection`.
- Boardguard release readiness issue: `production environment is missing`.
- `CODEOWNERS` currently contains `* @oaslananka`; path-specific owner lines are not present, and required code-owner review remains off.

## 6. Explicitly not done

- No bulk rollout to all repositories.
- No source-code patch to `oaslananka-lab/boardguard`.
- No patch to open PR #13 or PR #14.
- No release publishing or release behavior change.
- No strict branch protection, required approval, or required code-owner review gate was enabled.
- No code scanning alert was dismissed.
- No GitHub App private key was copied into any target repository.
- No repo-local App secret exists in `oaslananka-lab/boardguard`; repo secrets count is `0`.
- No GPG signing flow was used; local git config has `commit.gpgsign=false` and `tag.gpgSign=false`.
- GitHub App-level webhook was not updated by API because the App hook config endpoint returned 404 with a valid App JWT; repository-level webhook e2e was verified on `oaslananka/test`.

## 7. Next required step

Complete the remaining external webhook routing:

1. In Render, add `webhook.oaslananka.dev` as a custom domain for the `ops-webhook` service or keep the GitHub App webhook on the direct Render URL.
2. Sync the current Doppler `WEBHOOK_SECRET` value to the Render `WEBHOOK_SECRET` env var and the GitHub App webhook secret at the same time.
3. In the GitHub App settings for `oaslananka-repo-ops`, set:
   - URL: `https://ops-webhook-wi0r.onrender.com/webhook?github=1`
   - Secret: the current `WEBHOOK_SECRET` stored in Doppler `all/main`
   - Events: `pull_request`, `push`, `issues`, `issue_comment`
4. After that, create a personal test issue on `oaslananka/test` and verify `_ops` receives an `inbox-handler.yml` run through the App-level webhook.

---

## 8. Update — boardguard release readiness completed

Generated: 2026-05-09

Release apply:

- Dry-run: https://github.com/oaslananka-lab/_ops/actions/runs/25608730806
- Apply: https://github.com/oaslananka-lab/_ops/actions/runs/25608739096
- Release plan refresh: https://github.com/oaslananka-lab/_ops/actions/runs/25608740482

Result:

```text
production_environment_present          true
release_workflow_has_contents_write     true
release_workflow_has_attestations_write true
release_workflow_uses_actions_attest    true
release_ready                           true
release_plan_issues                     0
```

Post-release-readiness validation:

- Audit: https://github.com/oaslananka-lab/_ops/actions/runs/25608781481
- Onboarding: https://github.com/oaslananka-lab/_ops/actions/runs/25608782078
- Scorecard triage: https://github.com/oaslananka-lab/_ops/actions/runs/25608782627

Final boardguard validation summary:

```text
Target                  oaslananka-lab/boardguard
DefaultBranch           main
ActiveBranchRules       3
SecretScanningOK        True
DependencyGraphSBOMOK   True
OnboardingIssues        1
ScorecardOpenAlerts     7
ActionablePatchCount    0
ProcessDeferredCount    6
RulesetReviewModelCount 1
ReleaseReady            True
ReleaseIssues           0
ProductionEnvironment   True
```

Boardguard status after this update:

```text
baseline security        OK
operational ruleset      OK
release readiness        OK
production environment   OK
release workflow attest  OK
onboarding               OK
audit                    OK
triage                   OK
```

Remaining items are deferred policy/model findings, not direct patch targets:

```text
Scorecard process/policy:
- CI-Tests
- SAST
- CII-Best-Practices
- Code-Review
- Fuzzing
- Maintained

Ruleset/review-model:
- Branch-Protection
```

Next engineering task:

```text
agent-fix-loop v2:
  real branch checkout
  deterministic patch
  no-GPG commit
  push same PR branch
  watch checks
  repeat diagnostics
```

---

## 9. Update — Doppler and webhook DNS routing

Generated: 2026-05-10

Doppler local project/config:

```text
project all
config  main
```

Doppler secret-name verification:

```text
CLOUDFLARE_GLOBAL_API_KEY present
CLOUDFLARE_GLABAL_MAIL    present and mapped as Cloudflare email alias
WEBHOOK_SECRET            present
```

Cloudflare DNS automation:

- Script: `scripts/configure-cloudflare-webhook.ps1`
- Command path: `doppler run --project all --config main -- powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-cloudflare-webhook.ps1`
- Local-scope command path verified after `doppler setup --project all --config main --no-interactive`: `doppler run -- powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-cloudflare-webhook.ps1`
- Record: `webhook.oaslananka.dev`
- Type: `CNAME`
- Target: `ops-webhook-wi0r.onrender.com`
- Proxied: `true`
- Last script action: `unchanged` after a successful `updated` run

DNS and health status:

```text
webhook.oaslananka.dev resolves through Cloudflare proxied A/AAAA records
https://ops-webhook-wi0r.onrender.com/health returns 200 OK
https://webhook.oaslananka.dev/health returns 403 until Render accepts the custom host
```

GitHub App webhook status:

```text
GitHub App slug             oaslananka-repo-ops
GitHub App ID               3649470
GET /app/hook/config        404
App-level webhook automated update unavailable through current API path
```

Webhook E2E validation:

- Mode: repository-level webhook, not App-level webhook
- Issue: https://github.com/oaslananka/test/issues/2
- `_ops` run: https://github.com/oaslananka-lab/_ops/actions/runs/25612956358
- Result: `inbox-handler.yml` completed successfully and `oaslananka-repo-ops` commented on the issue.

Explicit remaining manual items:

```text
1. Add webhook.oaslananka.dev as a Render custom domain, or keep App webhook URL on the direct Render URL.
2. Sync the current Doppler WEBHOOK_SECRET to Render WEBHOOK_SECRET.
3. Set the GitHub App webhook secret to the same current Doppler WEBHOOK_SECRET.
4. Configure GitHub App webhook events: pull_request, push, issues, issue_comment.
5. Run one App-level webhook E2E issue test on oaslananka/test.
```


