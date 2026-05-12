import assert from "node:assert/strict";
import { test } from "node:test";
import { fileRelation, treeRelation } from "../scripts/fleet-parity-audit.mjs";

test("tree relation accepts equal and tree_equal", () => {
  assert.equal(treeRelation({ ok: true, data: { sha: "a", commit: { tree: { sha: "t" } } } }, { ok: true, data: { sha: "a", commit: { tree: { sha: "t" } } } }), "equal");
  assert.equal(treeRelation({ ok: true, data: { sha: "a", commit: { tree: { sha: "t" } } } }, { ok: true, data: { sha: "b", commit: { tree: { sha: "t" } } } }), "tree_equal");
});

test("dependabot relation distinguishes match, divergent, and not managed", () => {
  assert.equal(fileRelation({ ok: true, data: { sha: "x" } }, { ok: true, data: { sha: "x" } }), "match");
  assert.equal(fileRelation({ ok: true, data: { sha: "x" } }, { ok: true, data: { sha: "y" } }), "divergent");
  assert.equal(fileRelation({ ok: false, error: "not found" }, { ok: false, error: "not found" }, false), "not_managed");
});
