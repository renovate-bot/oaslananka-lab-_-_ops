import type { Env } from "../env";
import { escapePathSegment } from "../security";
import { booleanString, enumString, optionalString, readOptionalJsonObject } from "../schemas";
import { dispatchTyped } from "./workflows";

const PROMOTE_MODES = ["dry_run", "pull_request", "update_existing_pr"] as const;

export function syncSourceToMirror(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  return dispatchTyped(env, request, correlationId, "repo-mirror-sync.yml", {
    source_owner: "oaslananka",
    source_repo: safeRepo,
    target_owner: "oaslananka-lab",
    target_repo: safeRepo
  });
}

export function topologyAudit(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  return dispatchTyped(env, request, correlationId, "repo-topology-audit.yml", {
    target_owner: "oaslananka-lab",
    target_repo: safeRepo
  });
}

export async function promoteBack(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  const body = await readOptionalJsonObject(request);
  return dispatchTyped(env, request, correlationId, "repo-promote-back.yml", buildPromoteBackInputs(safeRepo, body));
}

export function buildPromoteBackInputs(repo: string, body: Record<string, unknown>): Record<string, string> {
  const mode = enumString(body.mode, "promote_mode", PROMOTE_MODES, "dry_run");
  const mergeSourcePr = booleanString(body.merge_source_pr, "merge_source_pr", "false");
  const mirrorRef = optionalString(body.mirror_ref, "mirror_ref") || "main";
  const inputs: Record<string, string> = {
    mirror_owner: "oaslananka-lab",
    mirror_repo: repo,
    mirror_ref: mirrorRef,
    mode,
    merge_source_pr: mergeSourcePr
  };
  const sourceOwner = optionalString(body.source_owner, "source_owner");
  const sourceRepo = optionalString(body.source_repo, "source_repo");
  if (sourceOwner) inputs.source_owner = escapePathSegment(sourceOwner);
  if (sourceRepo) inputs.source_repo = escapePathSegment(sourceRepo);
  return inputs;
}
