import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyMergeFailure, classifyUpdate, summarizeAlerts } from "../scripts/dependabot-auto.mjs";

test("classifies semver major update", () => {
  assert.equal(classifyUpdate("chore(deps): bump eslint from 9.39.4 to 10.3.0"), "major");
});

test("classifies semver minor or patch update", () => {
  assert.equal(classifyUpdate("chore(deps): bump urllib3 from 2.6.3 to 2.7.0"), "minor_or_patch");
});

test("summarizes Dependabot alert severity", () => {
  assert.deepEqual(
    summarizeAlerts([
      { security_advisory: { severity: "high" } },
      { security_advisory: { severity: "medium" } },
      { security_advisory: { severity: "high" } },
    ]),
    { critical: 0, high: 2, medium: 1, low: 0, unknown: 0 },
  );
});

test("classifies merge conflicts as rebase-requestable", () => {
  assert.equal(classifyMergeFailure("Pull Request has merge conflicts"), "merge_conflict_rebase_requested");
});

test("classifies required checks merge blockers", () => {
  assert.equal(
    classifyMergeFailure("11 of 11 required status checks have not succeeded: 1 expected."),
    "merge_blocked_required_checks",
  );
});
