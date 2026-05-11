import type { Env } from "../env";
import { json } from "../errors";

export function status(env: Env): Response {
  return json({
    ops_repo: env.OPS_REPO,
    source_of_truth_owner: "oaslananka",
    execution_owner: "oaslananka-lab",
    webhook: "external-render",
    automation: "github-app",
    copilot_required: false
  });
}
