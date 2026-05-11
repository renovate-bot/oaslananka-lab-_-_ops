import type { Env } from "../env";
import { escapePathSegment } from "../security";
import { dispatchTyped } from "./workflows";

export function syncSourceToMirror(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  return dispatchTyped(env, request, correlationId, "repo-mirror-sync.yml", {
    source_owner: "oaslananka",
    source_repo: safeRepo,
    target_owner: "oaslananka-lab",
    target_repo: safeRepo,
    mode: "dry_run"
  });
}

export function topologyAudit(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  return dispatchTyped(env, request, correlationId, "repo-topology-audit.yml", {
    target_owner: "oaslananka-lab",
    target_repo: safeRepo
  });
}

export function promoteBack(env: Env, request: Request, correlationId: string, repo: string): Promise<Response> {
  const safeRepo = escapePathSegment(repo);
  return dispatchTyped(env, request, correlationId, "repo-promote-back.yml", {
    mirror_owner: "oaslananka-lab",
    mirror_repo: safeRepo,
    mirror_ref: "main",
    mode: "dry_run",
    merge_source_pr: "false"
  });
}
