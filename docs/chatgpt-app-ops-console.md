# ChatGPT App Ops Console

Generated: 2026-05-11

## Official Documentation Checked

OpenAI / ChatGPT Apps:

- [Apps SDK MCP server concept](https://developers.openai.com/apps-sdk/concepts/mcp-server)
- [Apps SDK reference](https://developers.openai.com/apps-sdk/reference)
- [Apps SDK authentication](https://developers.openai.com/apps-sdk/build/auth)
- [Build your MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [Build your ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui)
- [Build with the Apps SDK help article](https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk)

Cloudflare:

- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [KV bindings](https://developers.cloudflare.com/kv/concepts/kv-bindings/)
- [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

GitHub:

- [OAuth App authorization flow](https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub App JWT](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app)
- [GitHub App installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Pull request merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)
- [Repository rules API](https://docs.github.com/en/rest/repos/rules)
- [Actions permissions API](https://docs.github.com/en/rest/actions/permissions)

## Findings

OpenAI Apps SDK is MCP-based. Apps SDK supports Server-Sent Events and Streamable HTTP, with Streamable HTTP recommended for hosted servers.

Tool descriptors need per-tool auth metadata such as `securitySchemes` and Apps SDK `_meta` fields for UI templates, invocation status, file params, and widget behavior.

Tool results can return `structuredContent`, `content`, and `_meta`; `_meta` is delivered to the component and should not be used to expose secrets.

OAuth-enabled Apps SDK servers need protected resource metadata such as:

```text
/.well-known/oauth-protected-resource
```

The current ops-api implements GitHub OAuth for the ops console, but a full MCP Apps SDK server and OpenAI app submission manifest are not enabled yet.

## Architecture

```text
ChatGPT App / natural-language ops console
-> ops-api.oaslananka.dev on Cloudflare Workers
-> GitHub OAuth identity check
-> _ops workflow_dispatch
-> GitHub App installation token
-> source/mirror policy
-> GitHub repositories
```

OAuth identity:

```text
OAuth App: oaslananka-ops-chatgpt-login
Client ID prefix: Ov231...
Callback: https://ops-api.oaslananka.dev/oauth/github/callback
Scopes: read:user user:email
Allowed login: oaslananka
```

The OAuth Client ID starts with capital `O`, not zero. It is distinct from the `oaslananka-repo-ops` GitHub App Client ID.

The OAuth Client Secret was rotated after accidental URL exposure. Only secret names and storage locations are documented; secret values are not recorded.

Mutation authority:

```text
GitHub App: oaslananka-repo-ops
App ID: 3649470
Public link: https://github.com/apps/oaslananka-repo-ops
```

OAuth tokens are not used for repository mutation.

## Domains

```text
ops-api.oaslananka.dev  Cloudflare Worker API
ops.oaslananka.dev      future dashboard
mcp.oaslananka.dev      optional future MCP alias if Apps SDK requires separation
webhook.oaslananka.dev  existing Render webhook receiver
```

## App Manifest Status

No production ChatGPT App manifest is committed in this phase.

Reason: the current stable implementation is an authenticated API layer. The OpenAI Apps SDK/MCP submission layer needs a dedicated MCP endpoint or manifest aligned with final Apps SDK submission requirements.

Prepared integration points:

- typed endpoint allowlist
- OAuth session model
- tool reference
- source/mirror policy enforcement
- no OAuth repo mutation
- Cloudflare custom domain

## Known Limitations

`REPO_OPS_APP_PRIVATE_KEY` must be present as a Cloudflare Worker secret before authenticated workflow dispatch endpoints can mutate repositories.

Full browser OAuth callback validation requires an interactive GitHub login session. Non-interactive validation currently confirms the authorize redirect and requested scopes.

## 2026-05-11 Rollout Notes

The ops API remained healthy during the repository rollout:

```text
GET https://ops-api.oaslananka.dev/health
status: ok
service: oaslananka-ops-api
runtime: cloudflare-workers
```

The deployed control path used for repository mutation is still:

```text
ops-api session
-> _ops workflow_dispatch
-> GitHub App installation token
-> repository policy
-> target repository
```

The OAuth token is not used for repository mutation.

The tool layer should surface these current exact rollout blockers:

```text
ruleset_code_owner_review_required
production_environment_missing
publish_workflow_not_found
npm_publish_e404
notebooklm_local_profile_access_denied
```

NotebookLM export/import is currently blocked by local profile access:

```text
path:  C:\Users\Admin\.notebooklm-mcp-cli\profiles
error: [WinError 5] Erişim engellendi
```
