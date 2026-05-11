import assert from "node:assert/strict";
import { test } from "node:test";
import { relationFor } from "../scripts/mirror-drift-check.mjs";

test("detects equal source mirror commits", () => {
  assert.equal(relationFor({ sha: "a", commit: { tree: { sha: "t1" } } }, { sha: "a", commit: { tree: { sha: "t1" } } }), "equal");
});

test("detects tree_equal source mirror commits", () => {
  assert.equal(relationFor({ sha: "a", commit: { tree: { sha: "t1" } } }, { sha: "b", commit: { tree: { sha: "t1" } } }), "tree_equal");
});

test("detects drift", () => {
  assert.equal(relationFor({ sha: "a", commit: { tree: { sha: "t1" } } }, { sha: "b", commit: { tree: { sha: "t2" } } }), "drift");
});
