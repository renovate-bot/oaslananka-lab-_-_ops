import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { renderPublishWorkflows } from "../scripts/render-publish-workflows.mjs";

test("renders npm/MCP publish workflows and standardizes MCP registry namespace to mirror owner", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-workflows-"));
  try {
    writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "mcp-infra-lens", version: "1.0.2" }, null, 2)}\n`);
    writeFileSync(
      join(dir, "server.json"),
      `${JSON.stringify(
        {
          name: "io.github.oaslananka/mcp-infra-lens",
          repository: { url: "https://github.com/oaslananka/mcp-infra-lens", source: "github" },
          version: "1.0.1",
          packages: [{ registryType: "npm", identifier: "old-name", version: "1.0.1" }],
        },
        null,
        2,
      )}\n`,
    );

    const result = renderPublishWorkflows({
      policyOwner: "oaslananka-lab",
      policyRepo: "mcp-infra-lens",
      targetDir: dir,
      targetRepository: "oaslananka-lab/mcp-infra-lens",
      standardizeMcpMetadata: true,
    });

    assert.deepEqual(result.changes.sort(), [".github/workflows/mcp-registry.yml", ".github/workflows/publish-production.yml", "server.json"].sort());
    assert.match(readFileSync(join(dir, ".github/workflows/publish-production.yml"), "utf8"), /oaslananka-lab\/mcp-infra-lens/);
    const server = JSON.parse(readFileSync(join(dir, "server.json"), "utf8"));
    assert.equal(server.name, "io.github.oaslananka-lab/mcp-infra-lens");
    assert.equal(server.repository.url, "https://github.com/oaslananka-lab/mcp-infra-lens");
    assert.equal(server.version, "1.0.2");
    assert.equal(server.packages[0].identifier, "mcp-infra-lens");
    assert.equal(server.packages[0].version, "1.0.2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renders VSCE publish workflow for kicad-studio", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-workflows-vsce-"));
  try {
    const result = renderPublishWorkflows({
      policyOwner: "oaslananka-lab",
      policyRepo: "kicad-studio",
      targetDir: dir,
      targetRepository: "oaslananka-lab/kicad-studio",
      standardizeMcpMetadata: true,
    });
    assert.deepEqual(result.changes, [".github/workflows/publish-production.yml"]);
    assert.match(readFileSync(join(dir, ".github/workflows/publish-production.yml"), "utf8"), /vscode-marketplace/);
    assert.match(readFileSync(join(dir, ".github/workflows/publish-production.yml"), "utf8"), /open-vsx/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
