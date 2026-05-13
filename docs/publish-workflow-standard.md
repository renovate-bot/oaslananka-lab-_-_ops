# Publish Workflow Standard

Managed publish workflows use one canonical entry point per repository:

```text
.github/workflows/publish-production.yml
```

MCP registry publishing may also expose:

```text
.github/workflows/mcp-registry.yml
```

All publish jobs run from the protected `production` environment and publish only immutable refs that are reachable from `main`. Source repositories may contain the same workflow files for source/mirror parity, but workflow guards target the mirror repository because Actions are expected to run on `oaslananka-lab/*`.

## npm

The npm standard uses:

- Node.js `24.15.0`
- npm `11.6.2`
- `permissions.id-token: write`
- `npm publish --provenance --access public`
- package artifact handoff from a non-environment build job to the protected publish job

npm Trusted Publishing requires the npm package settings to trust:

```text
Repository: oaslananka-lab/<repo>
Workflow: .github/workflows/publish-production.yml
Environment: production
```

If Trusted Publishing is not configured, fallback tokens are recognized only by protected secret name:

```text
NPM_TOKEN
NODE_AUTH_TOKEN
```

No token value is written to repository files or logs.

## PyPI

The PyPI standard uses PyPI Trusted Publishing with GitHub OIDC and the PyPA publish action:

```text
pypa/gh-action-pypi-publish@release/v1
```

The publish job has:

```text
environment: production
permissions:
  id-token: write
```

PyPI Trusted Publishing must trust:

```text
Owner/repository: oaslananka-lab/<repo>
Workflow: .github/workflows/publish-production.yml
Environment: production
```

When policy explicitly disables trusted-publishing-only mode, a protected fallback secret may be used:

```text
PYPI_API_TOKEN
```

## VS Code Marketplace and Open VSX

The extension standard packages a `.vsix` once and publishes the same artifact to both channels. This avoids treating `npm list --production` transitive dependency warnings as publish failures.

Required protected secret names:

```text
VSCE_PAT
VS_MARKETPLACE_TOKEN
OVSX_PAT
OPEN_VSX_TOKEN
```

Only one VS Code Marketplace token and one Open VSX token are required.

## MCP Registry

MCP registry publishing uses GitHub OIDC via `mcp-publisher login github-oidc`.

The standard server identity stays tied to the canonical source owner:

```text
io.github.oaslananka/<repo>
```

The `server.json` repository URL points at the execution mirror:

```text
https://github.com/oaslananka-lab/<repo>
```

This matches the repository metadata validators in the MCP repos while keeping the registry name stable on the canonical namespace. If MCP Registry OIDC later requires a different namespace binding, that is an external registry configuration change, not a source/mirror file divergence.
