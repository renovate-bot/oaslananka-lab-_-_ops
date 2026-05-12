# Publish State Contract

`ops-release-orchestrator.yml` no longer treats a green publish workflow as a fresh publish by itself. Publish workflows must upload a `publish-report-<repo>-<channel>` artifact containing a `publish-report*.json` file.

Required fields:

```json
{
  "channel": "npm",
  "state": "published",
  "result": "fresh_publish_success",
  "blocker": "",
  "package": "name",
  "version": "1.2.3",
  "run_url": "",
  "evidence": []
}
```

State mapping:

| Marker | State | Result |
|---|---|---|
| `MARKETPLACE_VERSION_ALREADY_PUBLISHED` | `already_published` | `idempotent_noop` |
| `OPEN_VSX_VERSION_ALREADY_PUBLISHED` | `already_published` | `idempotent_noop` |
| `NPM_PACKAGE_VERSION_ALREADY_PUBLISHED` | `already_published` | `idempotent_noop` |
| `NPM_TRUSTED_PUBLISHING_NOT_CONFIGURED` | `failed` | `external_blocker` |
| `NPM_TOKEN_SECRET_MISSING` | `failed` | `external_blocker` |
| `NPM_REGISTRY_PERMISSION_DENIED` | `failed` | `external_blocker` |
| `MCP_REGISTRY_CONFIG_MISSING` | `failed` | `external_blocker` |

If no report artifact exists, the orchestrator reports `publish_state_unknown`. This is deliberate: workflow success is execution evidence, not publication evidence.
