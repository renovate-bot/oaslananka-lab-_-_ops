import type { Env } from "../env";
import { json } from "../errors";
import { effectivePolicy } from "./policies";

export async function topologyRoute(env: Env, owner: string, repo: string): Promise<Response> {
  const policy = await effectivePolicy(env, owner, repo);
  const role = String((policy.repository_role as Record<string, unknown> | undefined)?.role || "unknown");
  if (role === "ci_cd_mirror") {
    const mirror = policy.mirror as Record<string, unknown>;
    return json({
      role,
      source: `${mirror.source_owner}/${mirror.source_repo}`,
      mirror: `${mirror.mirror_owner}/${mirror.mirror_repo}`,
      promote_back: mirror.promote_back === true
    });
  }
  if (role === "canonical_source") {
    const source = policy.source as Record<string, unknown>;
    return json({
      role,
      source: `${owner}/${repo}`,
      ci_delegated_to: source.ci_delegated_to || "oaslananka-lab"
    });
  }
  return json({
    role,
    repository: `${owner}/${repo}`
  });
}
