import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ops-pr-finalize.yml", import.meta.url), "utf8");

test("ops-pr-finalize waits for child workflows with a bounded poll loop", () => {
  assert.doesNotMatch(workflow, /gh run watch/);
  assert.match(workflow, /OPS_WAIT_TIMEOUT_SECONDS:-1800/);
  assert.match(workflow, /OPS_WAIT_INTERVAL_SECONDS:-20/);
  assert.match(workflow, /gh "\$@" 2> "\$\{err\}"/);
  assert.match(workflow, /run view "\$\{run_id\}" --repo "\$\{OPS_REPO\}" --json status,conclusion,url/);
  assert.match(workflow, /did not complete within \$\{timeout_seconds\}s/);
  assert.match(workflow, /return 124/);
});
