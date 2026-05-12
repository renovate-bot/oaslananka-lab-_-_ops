import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyMergeFailure, classifyUpdate, shouldCloseSourceDependabotPr, summarizeAlerts } from "../scripts/dependabot-auto.mjs";

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

test("labels conflict class with the human conflict resolution path in script", async () => {
  const text = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../scripts/dependabot-auto.mjs", import.meta.url), "utf8"));
  assert.match(text, /needs-human-conflict-resolution/);
  assert.match(text, /source_dependabot_closed/);
  assert.match(text, /ops-pr-finalize\.yml/);
  assert.match(text, /finalize_dispatched/);
  assert.match(text, /Managed by _ops dependency automation/);
});

test("classifies required checks merge blockers", () => {
  assert.equal(
    classifyMergeFailure("11 of 11 required status checks have not succeeded: 1 expected."),
    "merge_blocked_required_checks",
  );
});

test("source Dependabot PRs are closed only when source automation is disabled by policy", () => {
  assert.equal(
    shouldCloseSourceDependabotPr({
      owner: "oaslananka",
      policy: {
        repository_role: { role: "canonical_source" },
        dependabot: { managed: true, source_settings_disabled: true },
      },
    }),
    true,
  );
  assert.equal(
    shouldCloseSourceDependabotPr({
      owner: "oaslananka-lab",
      policy: {
        repository_role: { role: "ci_cd_mirror" },
        dependabot: { managed: true, source_settings_disabled: true },
      },
    }),
    false,
  );
});

test("source Dependabot close path uses an idempotent marker comment", async () => {
  const text = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../scripts/dependabot-auto.mjs", import.meta.url), "utf8"));
  assert.match(text, /repo-ops-source-dependabot-disabled/);
  assert.match(text, /hasSourceDependabotCloseMarker/);
  assert.match(text, /repos\/\$\{repoEntry\.full\}\/pulls\/\$\{pr\.number\}/);
  assert.match(text, /state: "closed"/);
});
