import assert from "node:assert/strict";
import test from "node:test";
import {
  deepMerge,
  getField,
  isMirror,
  parseYaml,
  patchMode,
  resolvePolicy,
  sourceTarget,
  topology,
  validatePolicy
} from "../scripts/ops-policy.mjs";

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
  assert.equal(policy.autonomy.profile, "source");
  assert.equal(policy.repository_role.role, "canonical_source");
  assert.equal(policy.pr.merge, true);
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
  assert.equal(policy.repository_role.role, "unknown");
});

test("minimal parser and deep merge preserve nested overrides", () => {
  const parsed = parseYaml("version: 1\nautonomy:\n  enabled: true\n  profile: full\n");
  const merged = deepMerge({ autonomy: { enabled: false, profile: "suggest" }, pr: { merge: false } }, parsed);
  assert.equal(merged.autonomy.enabled, true);
  assert.equal(merged.autonomy.profile, "full");
  assert.equal(merged.pr.merge, false);
});

test("lab boardguard topology resolves canonical source", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.deepEqual(topology(policy, "oaslananka-lab", "boardguard"), {
    role: "ci_cd_mirror",
    source: "oaslananka/boardguard",
    mirror: "oaslananka-lab/boardguard",
    promote_back: true
  });
});

test("personal boardguard topology is canonical source", () => {
  const policy = resolvePolicy("oaslananka", "boardguard");
  assert.deepEqual(topology(policy, "oaslananka", "boardguard"), {
    role: "canonical_source",
    source: "oaslananka/boardguard",
    ci_delegated_to: "oaslananka-lab"
  });
});

test("mirror promote-back and release gates are enabled by default", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(isMirror(policy), true);
  assert.equal(policy.mirror.promote_back, true);
  assert.equal(policy.mirror.require_source_mirror_sha_match_before_release, true);
  assert.equal(policy.mirror.require_source_mirror_sha_match_before_publish, true);
});

test("source profile is accepted and remains suggest patch mode", () => {
  const policy = resolvePolicy("oaslananka", "boardguard");
  assert.equal(policy.autonomy.profile, "source");
  assert.equal(patchMode(policy), "suggest");
});

test("source-target returns canonical owner for lab mirror", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.deepEqual(sourceTarget(policy, "oaslananka-lab", "boardguard"), {
    owner: "oaslananka",
    repo: "boardguard",
    full_name: "oaslananka/boardguard",
    branch: "main"
  });
});

test("missing source_repo in mirror policy fails", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  policy.mirror.source_repo = "";
  assert.throws(() => validatePolicy(policy), /mirror\.source_repo/);
});
