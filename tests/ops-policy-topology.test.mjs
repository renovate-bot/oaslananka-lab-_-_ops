import assert from "node:assert/strict";
import test from "node:test";
import { isMirror, patchMode, resolvePolicy, sourceTarget, topology, validatePolicy } from "../scripts/ops-policy.mjs";

test("lab boardguard resolves source oaslananka/boardguard", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.deepEqual(topology(policy, "oaslananka-lab", "boardguard"), {
    role: "ci_cd_mirror",
    source: "oaslananka/boardguard",
    mirror: "oaslananka-lab/boardguard",
    promote_back: true
  });
});

test("personal boardguard is canonical_source", () => {
  const policy = resolvePolicy("oaslananka", "boardguard");
  assert.deepEqual(topology(policy, "oaslananka", "boardguard"), {
    role: "canonical_source",
    source: "oaslananka/boardguard",
    ci_delegated_to: "oaslananka-lab"
  });
});

test("mirror promote_back true", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(isMirror(policy), true);
  assert.equal(policy.mirror.promote_back, true);
});

test("source profile accepted", () => {
  const policy = resolvePolicy("oaslananka", "boardguard");
  assert.equal(policy.autonomy.profile, "source");
  assert.equal(patchMode(policy), "suggest");
});

test("release and publish require source/mirror SHA gate by default", () => {
  const policy = resolvePolicy("oaslananka-lab", "boardguard");
  assert.equal(policy.mirror.require_source_mirror_sha_match_before_release, true);
  assert.equal(policy.mirror.require_source_mirror_sha_match_before_publish, true);
});

test("source-target returns canonical repository for lab mirror", () => {
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
