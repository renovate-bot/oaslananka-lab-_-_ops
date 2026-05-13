import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-fix-loop.yml", import.meta.url), "utf8");

const requiredClassifications = [
  "actionlint failure",
  "publish workflow discovery missing",
  "required check expected but not reported",
  "ruleset required check mismatch",
  "config-only pr blocked by ruleset",
  "publish already published idempotent noop",
  "environment required missing",
  "npm publish auth missing",
  "npm token secret missing",
  "npm trusted publishing missing",
  "npm package name unavailable",
  "npm registry permission denied",
  "vscode marketplace secret missing",
  "open vsx secret missing",
  "mcp registry config missing",
  "mcp registry secret missing",
  "ruleset codeowner review required",
  "ruleset bypass not configurable by api",
  "codeowner approval not automatable by app",
  "github api rate limit",
  "direct write blocked by ruleset",
  "mirror sync conflict",
  "osv vulnerability detected",
  "codecov token required",
];

test("agent fix-loop classifier names known rollout failure classes", () => {
  for (const classification of requiredClassifications) {
    assert.match(workflow, new RegExp(classification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("agent fix-loop recognizes image-observed publish workflow annotations", () => {
  assert.match(workflow, /Unexpected input\\\(s\\\)|Unexpected input/);
  assert.match(workflow, /package-manager-cache|Unexpected input/);
  assert.match(workflow, /Node\.js 20 actions are deprecated/);
});

test("agent fix-loop maps external publish blockers to exact suggestions", () => {
  assert.match(workflow, /exact registry\/trusted-publishing\/secret blocker/);
  assert.match(workflow, /exact marketplace secret name/);
  assert.match(workflow, /missing config or credential name exactly/);
});
