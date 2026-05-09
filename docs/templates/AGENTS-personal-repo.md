# AGENTS.md

## This repo is source of truth

GitHub Actions: DISABLED on this account.
Do not attempt to trigger workflows here.

## Control-plane
oaslananka-lab/_ops

## CI/CD mirror
oaslananka-lab/{REPO_NAME}

## To run CI
Push changes here -> mirror-sync triggers automatically ->
CI runs in oaslananka-lab/{REPO_NAME}

## To fix a failing PR check
1. Run diagnostics from _ops:
   gh workflow run agent-pr-diagnostics.yml \
     --repo oaslananka-lab/_ops \
     -f target_owner=oaslananka-lab \
     -f target_repo={REPO_NAME} \
     -f pr_number={PR_NUMBER}
2. Fix the failure in this repo (personal)
3. Push -> sync runs -> CI re-runs in org

## Operating contract
https://github.com/oaslananka-lab/_ops/blob/main/docs/agent-operating-contract.md
https://github.com/oaslananka-lab/_ops/blob/main/docs/architecture.md
