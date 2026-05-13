#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolvePolicy } from "./ops-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {
    policyOwner: "oaslananka-lab",
    targetDir: "",
    targetRepository: "",
    standardizeMcpMetadata: true,
    selfHosted: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-standardize-mcp-metadata") {
      args.standardizeMcpMetadata = false;
      continue;
    }
    if (arg === "--self-hosted") {
      args.selfHosted = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }
  if (!args.policyRepo) throw new Error("--policy-repo is required");
  if (!args.targetDir) throw new Error("--target-dir is required");
  return args;
}

function readTemplate(name, targetRepository, extraReplacements = {}) {
  let content = fs
    .readFileSync(path.join(ROOT, "templates", name), "utf8")
    .replaceAll("__TARGET_REPOSITORY__", targetRepository);
  for (const [key, value] of Object.entries(extraReplacements)) {
    content = content.replaceAll(key, value);
  }
  return content;
}

function pnpmOnlyWorkflow(content) {
  return content
    .replace(
      /          if \[\[ -f pnpm-lock\.yaml \]\]; then\n            corepack enable\n            corepack install\n            corepack pnpm install --frozen-lockfile\n            corepack pnpm run --if-present build\n            corepack pnpm run --if-present prepublishOnly\n            corepack pnpm pack --pack-destination publish-artifact\n          else\n            if \[\[ -f package-lock\.json \|\| -f npm-shrinkwrap\.json \]\]; then npm ci; else npm install; fi\n            npm rebuild better-sqlite3 --if-present\n            npm run --if-present build\n            npm run --if-present prepublishOnly\n            npm pack --pack-destination publish-artifact\n          fi/g,
      [
        "          corepack enable",
        "          corepack install",
        "          corepack pnpm install --frozen-lockfile",
        "          corepack pnpm run --if-present build",
        "          corepack pnpm run --if-present prepublishOnly",
        "          corepack pnpm pack --pack-destination publish-artifact",
      ].join("\n"),
    )
    .replace(
      /          if \[\[ -f pnpm-lock\.yaml \]\]; then\n            corepack enable\n            corepack install\n            corepack pnpm install --frozen-lockfile\n          else\n            if \[\[ -f package-lock\.json \|\| -f npm-shrinkwrap\.json \]\]; then npm ci; else npm install; fi\n          fi/g,
      ["          corepack enable", "          corepack install", "          corepack pnpm install --frozen-lockfile"].join("\n"),
    )
    .replace(
      /          if \[\[ -f pnpm-lock\.yaml \]\]; then corepack pnpm run --if-present build; else npm run --if-present build; fi/g,
      "          corepack pnpm run --if-present build",
    );
}

function selfHostedWorkflow(content) {
  return content
    .replace(/runs-on: ubuntu-24\.04/g, "runs-on: [self-hosted, Linux, X64]");
}

function writeIfChanged(file, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === normalized) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, normalized);
  return true;
}

function packageMetadata(targetDir) {
  const packageJson = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJson)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(packageJson, "utf8"));
    return { name: data.name || "", version: data.version || "" };
  } catch {
    return {};
  }
}

function standardizeMcpMetadata(targetDir, policy) {
  const mcpSubdir = policy.publish?.mcp_directory || "";
  const mcpDir = mcpSubdir ? path.join(targetDir, mcpSubdir) : targetDir;
  const serverJson = path.join(mcpDir, "server.json");
  if (!fs.existsSync(serverJson)) return false;
  const metadata = JSON.parse(fs.readFileSync(serverJson, "utf8"));
  const pkg = packageMetadata(mcpDir);
  const sourceOwner = policy.mirror?.source_owner || policy.repository_role?.source_of_truth_owner;
  const sourceRepo = policy.mirror?.source_repo || policy.mirror?.mirror_repo;
  const mirrorOwner = policy.mirror?.mirror_owner || policy.repository_role?.execution_owner;
  const mirrorRepo = policy.mirror?.mirror_repo || sourceRepo;
  if (!sourceOwner || !sourceRepo || !mirrorOwner || !mirrorRepo) return false;

  const registryName = mcpSubdir ? `io.github.${sourceOwner}/${mcpSubdir}` : `io.github.${sourceOwner}/${sourceRepo}`;
  metadata.name = registryName;
  metadata.repository = {
    url: `https://github.com/${mirrorOwner}/${mirrorRepo}`,
    source: "github",
  };
  if (pkg.version) metadata.version = pkg.version;
  if (Array.isArray(metadata.packages)) {
    for (const item of metadata.packages) {
      if (pkg.version && item && typeof item === "object") item.version = pkg.version;
      if (pkg.name && item?.registryType === "npm") item.identifier = pkg.name;
    }
  }
  return writeIfChanged(serverJson, `${JSON.stringify(metadata, null, 2)}\n`);
}

export function renderPublishWorkflows(args) {
  const policy = resolvePolicy(args.policyOwner, args.policyRepo);
  const targetDir = path.resolve(args.targetDir);
  const targetRepository =
    args.targetRepository || `${policy.mirror?.mirror_owner || args.policyOwner}/${policy.mirror?.mirror_repo || args.policyRepo}`;
  const workflowDir = path.join(targetDir, ".github", "workflows");
  const changes = [];

  if (!policy.publish?.enabled) {
    return { changes, policy, targetRepository };
  }

  let publishTemplate = "";
  if (policy.publish?.npm && policy.publish?.mcp_registry) {
    publishTemplate = "publish-production-mcp.yml";
  } else if (policy.publish?.npm) {
    publishTemplate = "publish-production-npm.yml";
  } else if (policy.publish?.pypi && (policy.publish?.vscode_marketplace || policy.publish?.open_vsx)) {
    publishTemplate = "publish-production-pypi-vsce.yml";
  } else if (policy.publish?.pypi) {
    publishTemplate = "publish-production-pypi.yml";
  } else if (policy.publish?.vscode_marketplace || policy.publish?.open_vsx) {
    publishTemplate = "publish-production-vsce.yml";
  } else if (policy.publish?.github_pages) {
    publishTemplate = "deploy-pages.yml";
  }

  const applyTransforms = (content) => {
    let out = fs.existsSync(path.join(targetDir, "pnpm-lock.yaml")) ? pnpmOnlyWorkflow(content) : content;
    if (args.selfHosted) out = selfHostedWorkflow(out);
    return out;
  };

  if (publishTemplate) {
    const file = path.join(workflowDir, publishTemplate === "deploy-pages.yml" ? "deploy-pages.yml" : "publish-production.yml");
    const pypiDir = policy.publish?.pypi_directory || "";
    const vsceDir = policy.publish?.vscode_directory || "";
    const extraReplacements = {};
    if (pypiDir) extraReplacements["__PYPI_DIRECTORY__"] = pypiDir;
    if (vsceDir) extraReplacements["__VSCODE_DIRECTORY__"] = vsceDir;
    const rendered = applyTransforms(readTemplate(publishTemplate, targetRepository, extraReplacements));
    if (writeIfChanged(file, rendered)) {
      changes.push(path.relative(targetDir, file).replaceAll(path.sep, "/"));
    }
  }

  const mcpInPublishTemplate = publishTemplate === "publish-production-pypi-vsce.yml";
  if (policy.publish?.mcp_registry && !mcpInPublishTemplate) {
    const file = path.join(workflowDir, "mcp-registry.yml");
    const rendered = applyTransforms(readTemplate("mcp-registry.yml", targetRepository));
    if (writeIfChanged(file, rendered)) {
      changes.push(path.relative(targetDir, file).replaceAll(path.sep, "/"));
    }
  }
  if (policy.publish?.mcp_registry && args.standardizeMcpMetadata && standardizeMcpMetadata(targetDir, policy)) {
    const mcpSubdir = policy.publish?.mcp_directory || "";
    changes.push(mcpSubdir ? `${mcpSubdir}/server.json` : "server.json");
  }

  return { changes, policy, targetRepository };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = renderPublishWorkflows(args);
  process.stdout.write(`${JSON.stringify({ changes: result.changes, target_repository: result.targetRepository }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
