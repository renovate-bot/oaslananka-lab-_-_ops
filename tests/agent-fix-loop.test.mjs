import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/agent-fix-loop.yml", import.meta.url), "utf8");

test("non-patchable known rollout classes do not fall through to unknown", () => {
  const applyPatchCase = workflow.match(/apply_patch_for_class\(\)[\s\S]*?case "\$\{classification\}" in([\s\S]*?)\*\)/);
  assert.ok(applyPatchCase, "apply_patch_for_class case block is present");
  const block = applyPatchCase[1];
  for (const classification of [
    "publish workflow discovery missing",
    "environment required missing",
    "npm publish auth missing",
    "vscode marketplace secret missing",
    "open vsx secret missing",
    "ruleset codeowner review required",
  ]) {
    assert.match(block, new RegExp(classification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("unknown fallback still exists only after explicit rollout matchers", () => {
  const unknownIndex = workflow.indexOf('echo "unknown"');
  assert.ok(unknownIndex > 0, "unknown fallback is present");
  for (const marker of [
    "publish_workflow_not_found",
    "production environment",
    "NPM_PUBLISH_E404",
    "Waiting on code owner review",
    "MCP_REGISTRY_CREDENTIALS_MISSING",
    "OSV lockfile scan",
  ]) {
    const markerIndex = workflow.indexOf(marker);
    assert.ok(markerIndex > 0, `${marker} matcher is present`);
    assert.ok(markerIndex < unknownIndex, `${marker} is checked before unknown fallback`);
  }
});

test("publish and environment failures have patch paths", () => {
  assert.match(workflow, /Setup Node for target repository tooling/);
  assert.match(workflow, /node-version: "24\.15\.0"/);
  assert.match(workflow, /scaffold_publish_workflow/);
  assert.match(workflow, /call_ensure_production_environment/);
  assert.match(workflow, /update_action_pins/);
  assert.match(workflow, /patch_codecov_nonblocking/);
  assert.match(workflow, /prettier --write --ignore-unknown \./);
  assert.match(workflow, /resolve_unresolved_review_threads/);
  assert.match(workflow, /templates\/publish-production-mcp\.yml/);
  assert.match(workflow, /templates\/publish-production-npm\.yml/);
  assert.match(workflow, /templates\/publish-production-pypi\.yml/);
  assert.match(workflow, /templates\/deploy-pages\.yml/);
});

test("push and rollback paths are safe for local-only bot commits", () => {
  assert.match(workflow, /HUSKY=0 git -C "\$\{repo_dir\}".*commit --no-gpg-sign/s);
  assert.match(workflow, /HUSKY=0 git -C "\$\{repo_dir\}" push origin "HEAD:\$\{head_ref\}"/);
  assert.match(workflow, /PUSH_FAILED:\%s/);
  assert.match(workflow, /push_failed_with_no_rollback/);
  assert.match(workflow, /last_auto_commit=""/);
  assert.match(workflow, /cat-file -e "\$\{commit_sha\}\^\{commit\}"/);
  assert.match(workflow, /merge-base --is-ancestor "\$\{commit_sha\}" HEAD/);
  assert.match(workflow, /rollback skipped: commit \$\{commit_sha\} is not present in remote branch clone/);
  assert.match(workflow, /rollback skipped: commit \$\{commit_sha\} is not ancestor of remote HEAD/);
});

test("dependabot major updates are not auto-finalized by fix-loop", () => {
  assert.match(workflow, /is_dependabot_major_update\(\)/);
  assert.match(workflow, /dependabot-major-review-required/);
  assert.match(workflow, /dependabot\.allow_major_auto_merge \/\/ false/);
  assert.match(workflow, /dependabot_major_review_required/);
  const majorPolicyIndex = workflow.indexOf("is_dependabot_major_update");
  const finalizeIndex = workflow.indexOf("ops-pr-finalize.yml");
  assert.ok(majorPolicyIndex > 0, "Dependabot major guard exists");
  assert.ok(finalizeIndex > 0, "finalize dispatch exists");
  assert.ok(majorPolicyIndex < finalizeIndex, "major guard is checked before finalize dispatch");
});

test("typescript baseUrl deprecation is classified before generic format lint", () => {
  const tsIndex = workflow.indexOf('echo "typescript baseUrl deprecation"');
  const formatIndex = workflow.indexOf('echo "format/lint"');
  assert.ok(tsIndex > 0, "TypeScript baseUrl classifier exists");
  assert.ok(formatIndex > 0, "format/lint classifier exists");
  assert.ok(tsIndex < formatIndex, "TS5101 is classified before generic lint/format");
  assert.match(workflow, /TS5101\|Option \.baseUrl\. is deprecated\|ignoreDeprecations\.\*6\\\.0\|TypeScript 7\\\.0/);
  assert.match(workflow, /"typescript baseUrl deprecation"\)/);
  assert.match(workflow, /patch_typescript_baseurl_deprecation/);
});

test("OSV lockfile vulnerabilities are classified before generic lockfile failures", () => {
  const osvIndex = workflow.indexOf('echo "osv vulnerability detected"');
  const lockfileIndex = workflow.indexOf('echo "missing lockfile"');
  assert.ok(osvIndex > 0, "OSV vulnerability classifier exists");
  assert.ok(lockfileIndex > 0, "generic lockfile classifier exists");
  assert.ok(osvIndex < lockfileIndex, "OSV vulnerability is classified before generic lockfile matching");
  assert.match(workflow, /OSV lockfile scan\|osv-scanner\|known vulnerabilit/);
  assert.match(workflow, /"osv vulnerability detected"\)/);
});

test("typescript baseUrl patch adds ignoreDeprecations only where needed and is idempotent", async () => {
  const match = workflow.match(/patch_typescript_baseurl_deprecation\(\) \{[\s\S]*?python - "\$\{repo_dir\}" <<'PY'\n([\s\S]*?)\n\s*PY\n\s*\}/);
  assert.ok(match, "embedded TypeScript patch script is present");
  const script = match[1].replace(/^ {10}/gm, "");

  const dir = mkdtempSync(join(tmpdir(), "agent-fix-loop-ts5101-"));
  try {
    writeFileSync(
      join(dir, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { baseUrl: "." } }, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "tsconfig.lib.json"),
      `${JSON.stringify({ compilerOptions: { strict: true } }, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, "tsconfig.done.json"),
      `${JSON.stringify({ compilerOptions: { baseUrl: ".", ignoreDeprecations: "6.0" } }, null, 2)}\n`,
    );

    const first = spawnSync("python", ["-", dir], { input: script, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const patched = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8"));
    const untouched = JSON.parse(readFileSync(join(dir, "tsconfig.lib.json"), "utf8"));
    const alreadyDone = JSON.parse(readFileSync(join(dir, "tsconfig.done.json"), "utf8"));
    assert.equal(patched.compilerOptions.ignoreDeprecations, "6.0");
    assert.equal(untouched.compilerOptions.ignoreDeprecations, undefined);
    assert.equal(alreadyDone.compilerOptions.ignoreDeprecations, "6.0");

    const snapshot = readFileSync(join(dir, "tsconfig.json"), "utf8");
    const second = spawnSync("python", ["-", dir], { input: script, encoding: "utf8" });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(join(dir, "tsconfig.json"), "utf8"), snapshot);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
