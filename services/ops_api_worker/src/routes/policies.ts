import type { Env } from "../env";
import { opsRepo } from "../env";
import { json } from "../errors";
import { getOpsInstallationToken } from "../github/app-token";
import { githubContents } from "../github/rest";

type PolicyValue = string | number | boolean | null | PolicyObject;
interface PolicyObject {
  [key: string]: PolicyValue;
}

function parseScalar(raw: string): PolicyValue {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseYamlMap(text: string): PolicyObject {
  const root: PolicyObject = {};
  const stack: Array<{ indent: number; value: PolicyObject }> = [{ indent: -1, value: root }];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  lines.forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const indent = rawLine.match(/^ */)?.[0].length || 0;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) throw new Error(`Invalid YAML mapping at line ${lineIndex + 1}`);
    const key = trimmed.slice(0, separator).trim();
    const rest = trimmed.slice(separator + 1).split(/\s+#/)[0] || "";
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
    const parent = stack[stack.length - 1]!.value;
    if (rest.trim() === "") {
      const child: PolicyObject = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key] = parseScalar(rest);
    }
  });
  return root;
}

function mergePolicy(base: PolicyObject, override: PolicyObject): PolicyObject {
  const result: PolicyObject = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (key === "extends") continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergePolicy(result[key] as PolicyObject, value as PolicyObject);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

export async function effectivePolicy(env: Env, owner: string, repo: string): Promise<PolicyObject> {
  const token = await getOpsInstallationToken(env);
  const ops = opsRepo(env);
  const defaultText = await githubContents(token, ops.owner, ops.repo, "config/repo-autonomy.default.yml");
  if (!defaultText) throw new Error("Default autonomy policy is missing from _ops.");
  const overrideText = await githubContents(token, ops.owner, ops.repo, `config/repos/${owner}/${repo}.yml`);
  return mergePolicy(parseYamlMap(defaultText), overrideText ? parseYamlMap(overrideText) : {});
}

export async function policyRoute(env: Env, owner: string, repo: string): Promise<Response> {
  const policy = await effectivePolicy(env, owner, repo);
  return json({ policy });
}
