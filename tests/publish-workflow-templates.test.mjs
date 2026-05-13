import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function template(name) {
  return readFileSync(new URL(`../templates/${name}`, import.meta.url), "utf8");
}

test("Node publish templates use supported setup-node inputs and current trusted-publish baseline", () => {
  for (const name of ["publish-production-npm.yml", "publish-production-mcp.yml", "publish-production-vsce.yml"]) {
    const text = template(name);
    assert.doesNotMatch(text, /package-manager-cache/);
    assert.match(text, /NODE_VERSION: "24\.15\.0"/);
  }
  assert.match(template("publish-production-npm.yml"), /NPM_VERSION: "11\.6\.2"/);
  assert.match(template("publish-production-mcp.yml"), /NPM_VERSION: "11\.6\.2"/);
});

test("npm and MCP publish templates support pnpm repositories before packing", () => {
  for (const name of ["publish-production-npm.yml", "publish-production-mcp.yml"]) {
    const text = template(name);
    assert.match(text, /pnpm-lock\.yaml/);
    assert.match(text, /corepack pnpm install --frozen-lockfile/);
    assert.match(text, /corepack pnpm pack --pack-destination publish-artifact/);
  }
});

test("VSCE template packages once and publishes the VSIX artifact to both channels", () => {
  const text = template("publish-production-vsce.yml");
  assert.match(text, /@vscode\/vsce package --no-dependencies/);
  assert.match(text, /@vscode\/vsce publish --packagePath/);
  assert.match(text, /ovsx publish "\$\{vsix\}"/);
  assert.doesNotMatch(text, /npm list/);
});

test("PyPI template uses OIDC trusted publishing through the PyPA action", () => {
  const text = template("publish-production-pypi.yml");
  assert.match(text, /id-token: write/);
  assert.match(text, /pypa\/gh-action-pypi-publish@release\/v1/);
  assert.match(text, /PYPI_TRUSTED_PUBLISHING_NOT_CONFIGURED/);
});
