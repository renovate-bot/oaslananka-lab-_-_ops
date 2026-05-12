import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-fix-loop.yml", import.meta.url), "utf8");

test("non-patchable known rollout classes do not fall through to unknown", () => {
  const applyPatchCase = workflow.match(/apply_patch_for_class\(\)[\s\S]*?case "\$\{classification\}" in([\s\S]*?)\*\)/);
  assert.ok(applyPatchCase, "apply_patch_for_class case block is present");
  const block = applyPatchCase[1];
  for (const classification of [
    "publish workflow discovery missing",
    "environment required missing",
    "npm publish auth missing",
    "vscode marketplace secret missing",
    "open vsx secret missing",
    "ruleset codeowner review required",
  ]) {
    assert.match(block, new RegExp(classification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("unknown fallback still exists only after explicit rollout matchers", () => {
  const unknownIndex = workflow.indexOf('echo "unknown"');
  assert.ok(unknownIndex > 0, "unknown fallback is present");
  for (const marker of [
    "publish_workflow_not_found",
    "production environment",
    "NPM_PUBLISH_E404",
    "Waiting on code owner review",
    "MCP_REGISTRY_CREDENTIALS_MISSING",
  ]) {
    const markerIndex = workflow.indexOf(marker);
    assert.ok(markerIndex > 0, `${marker} matcher is present`);
    assert.ok(markerIndex < unknownIndex, `${marker} is checked before unknown fallback`);
  }
});

test("publish and environment failures have patch paths", () => {
  assert.match(workflow, /scaffold_publish_workflow/);
  assert.match(workflow, /call_ensure_production_environment/);
  assert.match(workflow, /update_action_pins/);
  assert.match(workflow, /patch_codecov_nonblocking/);
  assert.match(workflow, /prettier --write --ignore-unknown \./);
  assert.match(workflow, /resolve_unresolved_review_threads/);
  assert.match(workflow, /templates\/publish-production-mcp\.yml/);
  assert.match(workflow, /templates\/publish-production-npm\.yml/);
  assert.match(workflow, /templates\/deploy-pages\.yml/);
});
