import assert from "node:assert/strict";
import { test } from "node:test";
import { jobNamesFromWorkflow, requiredCheckNamesFromRulesets } from "../scripts/ruleset-required-check-audit.mjs";

test("extracts required status check contexts from rulesets", () => {
  assert.deepEqual(
    requiredCheckNamesFromRulesets([
      {
        rules: [
          {
            type: "required_status_checks",
            parameters: { required_status_checks: [{ context: "Full CI Pipeline (ubuntu-24.04)" }] },
          },
        ],
      },
    ]),
    ["Full CI Pipeline (ubuntu-24.04)"],
  );
});

test("extracts explicit job names from workflow yaml", () => {
  assert.deepEqual(
    jobNamesFromWorkflow("name: CI\non: [pull_request]\njobs:\n  ci:\n    name: Full CI Pipeline (ubuntu-24.04)\n    runs-on: ubuntu-24.04\n"),
    ["Full CI Pipeline (ubuntu-24.04)", "ci"],
  );
});
