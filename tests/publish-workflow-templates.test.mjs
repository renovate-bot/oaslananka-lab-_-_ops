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
    assert.doesNotMatch(text, /corepack install \|\| true/);
    assert.doesNotMatch(text, /^NODE$/m);
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
  assert.match(text, /VSCE_VERSION: "3\.9\.1"/);
  assert.match(text, /OVSX_VERSION: "0\.10\.12"/);
  assert.match(text, /vscode-marketplace:[\s\S]*actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/);
  assert.match(text, /open-vsx:[\s\S]*actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/);
  assert.match(text, /@vscode\/vsce@\$\{VSCE_VERSION\}" package --no-dependencies/);
  assert.match(text, /@vscode\/vsce@\$\{VSCE_VERSION\}" publish --packagePath/);
  assert.match(text, /ovsx@\$\{OVSX_VERSION\}" publish "\$\{vsix\}"/);
  assert.doesNotMatch(text, /npm list/);
});

test("MCP registry templates pin mcp-publisher and do not download latest", () => {
  for (const name of ["mcp-registry.yml", "publish-production-mcp.yml"]) {
    const text = template(name);
    assert.match(text, /MCP_PUBLISHER_VERSION: "1\.7\.9"/);
    assert.match(text, /releases\/download\/v\$\{MCP_PUBLISHER_VERSION\}/);
    assert.match(text, /registry_\$\{MCP_PUBLISHER_VERSION\}_checksums\.txt/);
    assert.match(text, /sha256sum -c checksums\.filtered/);
    assert.doesNotMatch(text, /releases\/latest\/download/);
  }
});

test("PyPI template uses OIDC trusted publishing through the PyPA action", () => {
  const text = template("publish-production-pypi.yml");
  assert.match(text, /id-token: write/);
  assert.match(text, /pypa\/gh-action-pypi-publish@release\/v1/);
  assert.match(text, /PYPI_TRUSTED_PUBLISHING_NOT_CONFIGURED/);
});
