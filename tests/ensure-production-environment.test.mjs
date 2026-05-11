import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs, requiredSecretNames } from "../scripts/ensure-production-environment.mjs";

test("production environment defaults do not add a reviewer", () => {
  const args = parseArgs(["--owner", "oaslananka-lab", "--repo", "boardguard"]);
  assert.equal(args.reviewerLogin, "");
  assert.equal(args.environment, "production");
  assert.equal(args.apply, false);
});

test("reset reviewers mode is accepted without reviewer login", () => {
  const args = parseArgs(["--owner", "oaslananka-lab", "--repo", "boardguard", "--mode", "reset_reviewers", "--apply"]);
  assert.equal(args.mode, "reset_reviewers");
  assert.equal(args.reviewerLogin, "");
  assert.equal(args.apply, true);
});

test("required secrets includes dockerhub but not ghcr or pages", () => {
  const names = requiredSecretNames({
    publish: {
      npm: true,
      ghcr: true,
      dockerhub: true,
      github_pages: true,
      mcp_registry: true,
    },
  });
  assert.deepEqual(names, ["DOCKERHUB_TOKEN", "DOCKERHUB_USERNAME", "MCP_REGISTRY_TOKEN", "NODE_AUTH_TOKEN", "NPM_TOKEN"]);
});
