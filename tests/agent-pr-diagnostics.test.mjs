import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-pr-diagnostics.yml", import.meta.url), "utf8");

test("diagnostics separates optional external review quota status from blocking failures", () => {
  assert.match(workflow, /ignored_optional_external_check/);
  assert.match(workflow, /\.name == "CodeRabbit"/);
  assert.match(workflow, /ignored_optional_external_checks/);
  assert.match(workflow, /Ignored optional external checks/);
});

