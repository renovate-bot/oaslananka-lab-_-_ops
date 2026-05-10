# Ruleset Autonomy

`repo-ruleset-autonomy-audit.yml` checks whether a target repository can actually execute its configured autonomy profile.

It checks:

```text
GitHub App repository read access
Actions enabled state
default branch availability
configured merge method availability
auto-merge setting compatibility
branch/ruleset visibility
expected GitHub App bypass for full/breakglass profiles
required publish environment when publish is enabled
secret names where GitHub API exposes names only
```

It never prints secret values.

## Final States

```text
ready
app_missing_permission
actions_disabled
merge_method_disabled
auto_merge_disabled
ruleset_blocks_agent
required_checks_missing
environment_missing
secrets_missing
profile_not_supported
audit_incomplete
```

`ruleset_blocks_agent` means policy requests a higher-autonomy mode but GitHub rulesets/settings do not permit the GitHub App to complete that lifecycle. The fix is repository-specific: add a narrow bypass actor, adjust the policy down, or keep the repo in guarded/suggest mode.

Disabled repository auto-merge is not a blocker when the repo policy permits immediate merge with expected head SHA protection. In that case the audit remains `ready` and records auto-merge as a warning rather than a final-state failure.

Missing GitHub App bypass is only blocking when active branch rules actually require a review or PR gate that conflicts with the repository policy. Repositories with only deletion, non-fast-forward, or linear-history rules can still be `ready` for immediate expected-SHA merges.
