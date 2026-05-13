# Mirror Drift Incidents

Generated: 2026-05-13

Mirror drift is detected by:

```text
.github/workflows/repo-mirror-drift-check.yml
scripts/mirror-drift-check.mjs
```

## 2026-05-13 - mcp-ssh-tool stale mirror restore

`oaslananka-lab/mcp-ssh-tool` briefly drifted after a stale sync PR merged a mirror state whose tree was effectively empty. The bad mirror state also opened source promote-back PR `oaslananka/mcp-ssh-tool#37`, which would have deleted canonical source contents.

Resolution:

| Step | Evidence |
|---|---|
| Source-to-mirror repair sync opened `mcp-ssh-tool#76` | https://github.com/oaslananka-lab/_ops/actions/runs/25769208774 |
| `mcp-ssh-tool#76` finalized through `_ops` | https://github.com/oaslananka-lab/_ops/actions/runs/25769308037 |
| Promote-back after restore reported `no_diff` | https://github.com/oaslananka-lab/_ops/actions/runs/25769354533 |
| Stale source promote PR `#37` closed | https://github.com/oaslananka/mcp-ssh-tool/pull/37 |

Final state:

```text
source:  oaslananka/mcp-ssh-tool@46c0f7a494746bb9807e19dd82ecd07decd07569
mirror:  oaslananka-lab/mcp-ssh-tool@7818a0169cbfdb6545ddb33947fcb58561fb2723
tree:    tree_equal
```

Latest fleet drift check:

```text
https://github.com/oaslananka-lab/_ops/actions/runs/25769438579
```
