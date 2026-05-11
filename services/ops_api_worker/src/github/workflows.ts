import type { Env } from "../env";
import { opsRepo } from "../env";
import { HttpError } from "../errors";
import { getOpsInstallationToken } from "./app-token";
import { githubRequest } from "./rest";

export const WORKFLOW_ALLOWLIST = new Set([
  "agent-pr-diagnostics.yml",
  "agent-fix-loop.yml",
  "ops-pr-finalize.yml",
  "ops-release-orchestrator.yml",
  "repo-audit.yml",
  "repo-release-plan.yml",
  "repo-ruleset-autonomy-audit.yml",
  "repo-topology-audit.yml",
  "repo-promote-back.yml",
  "repo-source-mirror-release-gate.yml",
  "repo-mirror-sync.yml"
]);

export interface DispatchRequest {
  workflow: string;
  ref?: string;
  inputs?: Record<string, string>;
}

export async function dispatchOpsWorkflow(
  env: Env,
  request: DispatchRequest,
  correlationId: string
): Promise<{ accepted: true; workflow: string; run_url: string | null; correlation_id: string }> {
  if (!WORKFLOW_ALLOWLIST.has(request.workflow)) {
    throw new HttpError(400, "WORKFLOW_NOT_ALLOWED", "Workflow is not on the ops-api allowlist.", {
      workflow: request.workflow
    });
  }
  const { owner, repo, full } = opsRepo(env);
  const token = await getOpsInstallationToken(env);
  await githubRequest<void>(token, `/repos/${owner}/${repo}/actions/workflows/${request.workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: request.ref || "main",
      inputs: request.inputs || {}
    })
  });
  return {
    accepted: true,
    workflow: request.workflow,
    run_url: `https://github.com/${full}/actions/workflows/${request.workflow}`,
    correlation_id: correlationId
  };
}
