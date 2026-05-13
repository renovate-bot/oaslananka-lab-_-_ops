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
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-standardize-mcp-metadata") {
      args.standardizeMcpMetadata = false;
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

function readTemplate(name, targetRepository) {
  return fs
    .readFileSync(path.join(ROOT, "templates", name), "utf8")
    .replaceAll("__TARGET_REPOSITORY__", targetRepository);
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
  const serverJson = path.join(targetDir, "server.json");
  if (!fs.existsSync(serverJson)) return false;
  const metadata = JSON.parse(fs.readFileSync(serverJson, "utf8"));
  const pkg = packageMetadata(targetDir);
  const mirrorOwner = policy.mirror?.mirror_owner;
  const mirrorRepo = policy.mirror?.mirror_repo;
  if (!mirrorOwner || !mirrorRepo) return false;

  metadata.name = `io.github.${mirrorOwner}/${mirrorRepo}`;
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
  } else if (policy.publish?.pypi) {
    publishTemplate = "publish-production-pypi.yml";
  } else if (policy.publish?.vscode_marketplace || policy.publish?.open_vsx) {
    publishTemplate = "publish-production-vsce.yml";
  } else if (policy.publish?.github_pages) {
    publishTemplate = "deploy-pages.yml";
  }

  if (publishTemplate) {
    const file = path.join(workflowDir, publishTemplate === "deploy-pages.yml" ? "deploy-pages.yml" : "publish-production.yml");
    if (writeIfChanged(file, readTemplate(publishTemplate, targetRepository))) {
      changes.push(path.relative(targetDir, file).replaceAll(path.sep, "/"));
    }
  }

  if (policy.publish?.mcp_registry) {
    const file = path.join(workflowDir, "mcp-registry.yml");
    if (writeIfChanged(file, readTemplate("mcp-registry.yml", targetRepository))) {
      changes.push(path.relative(targetDir, file).replaceAll(path.sep, "/"));
    }
    if (args.standardizeMcpMetadata && standardizeMcpMetadata(targetDir, policy)) {
      changes.push("server.json");
    }
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
