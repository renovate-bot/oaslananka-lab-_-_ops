import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ops-release-orchestrator.yml", import.meta.url), "utf8");

test("release orchestrator parses explicit publish-report artifacts", () => {
  assert.match(workflow, /publish-report-\*/);
  assert.match(workflow, /classify_publish_report/);
  assert.match(workflow, /already_published/);
  assert.match(workflow, /idempotent_noop/);
});

test("workflow success without publish report is unknown, not published", () => {
  assert.match(workflow, /publish_state_unknown/);
  assert.match(workflow, /workflow success is not treated as fresh publish/);
});
