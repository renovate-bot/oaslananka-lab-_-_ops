import assert from "node:assert/strict";
import { test } from "node:test";
import { desiredSecurityState } from "../scripts/fleet-security-state.mjs";

test("source repositories are desired inactive even when parity files exist", () => {
  assert.equal(desiredSecurityState("oaslananka").actions, "disabled_or_unavailable");
  assert.equal(desiredSecurityState("oaslananka").vulnerability_alerts, "disabled");
});

test("mirror repositories are desired active", () => {
  assert.equal(desiredSecurityState("oaslananka-lab").actions, "enabled");
  assert.equal(desiredSecurityState("oaslananka-lab").secret_scanning, "enabled");
});
