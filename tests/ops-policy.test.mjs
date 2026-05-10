import assert from "node:assert/strict";
import test from "node:test";
import { deepMerge, getField, parseYaml, patchMode, resolvePolicy, validatePolicy } from "../scripts/ops-policy.mjs";

test("default policy loads", () => {
  const policy = resolvePolicy("missing-owner", "missing-repo");
  assert.equal(policy.autonomy.profile, "guarded");
  assert.equal(policy.pr.merge, false);
});

test("boardguard override sets pr.merge true", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(policy.autonomy.profile, "full");
  assert.equal(policy.pr.merge, true);
});

test("personal repo policy disables merge release publish", () => {
  const policy = resolvePolicy("oaslananka", "boardguard");
  assert.equal(policy.autonomy.profile, "suggest");
  assert.equal(policy.pr.merge, false);
  assert.equal(policy.release.enabled, false);
  assert.equal(policy.publish.enabled, false);
});

test("invalid profile fails", () => {
  const policy = resolvePolicy("missing-owner", "missing-repo");
  policy.autonomy.profile = "root";
  assert.throws(() => validatePolicy(policy), /autonomy\.profile/);
});

test("invalid boolean fails", () => {
  const policy = resolvePolicy("missing-owner", "missing-repo");
  policy.pr.merge = "yes";
  assert.throws(() => validatePolicy(policy), /pr\.merge/);
});

test("field selector works", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(getField(policy, "pr.merge"), true);
});

test("patch-mode returns patch for full policy", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(patchMode(policy), "patch");
});

test("missing repo override falls back to default", () => {
  const policy = resolvePolicy("oaslananka-lab", "unknown-repo");
  assert.equal(policy.autonomy.profile, "guarded");
  assert.equal(policy.pr.merge, false);
});

test("minimal parser and deep merge preserve nested overrides", () => {
  const parsed = parseYaml("version: 1\nautonomy:\n  enabled: true\n  profile: full\n");
  const merged = deepMerge({ autonomy: { enabled: false, profile: "suggest" }, pr: { merge: false } }, parsed);
  assert.equal(merged.autonomy.enabled, true);
  assert.equal(merged.autonomy.profile, "full");
  assert.equal(merged.pr.merge, false);
});
