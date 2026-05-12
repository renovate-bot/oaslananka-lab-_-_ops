import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/repo-fleet-health.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../scripts/fleet-health.mjs", import.meta.url), "utf8");

test("fleet health uploads a JSON artifact and updates issue", () => {
  assert.match(workflow, /out\/fleet-health\.json/);
  assert.match(script, /\[fleet-health\]/);
  assert.match(script, /production_environment_required_reviewers_count/);
  assert.match(script, /dependabot_prs_major_review_required_count/);
});
