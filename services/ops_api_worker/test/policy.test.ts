import { describe, expect, it } from "vitest";
import { parseYamlMap } from "../src/routes/policies";

describe("policy YAML parsing", () => {
  it("parses nested source mirror policy fields", () => {
    const policy = parseYamlMap(`
version: 1
repository_role:
  role: ci_cd_mirror
mirror:
  enabled: true
  source_owner: oaslananka
  source_repo: boardguard
`);
    expect(policy.repository_role).toMatchObject({ role: "ci_cd_mirror" });
    expect(policy.mirror).toMatchObject({
      enabled: true,
      source_owner: "oaslananka",
      source_repo: "boardguard"
    });
  });
});
