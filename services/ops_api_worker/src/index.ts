import type { Env } from "./env";
import { errorResponse, json } from "./errors";
import { corsHeaders, escapePathSegment, preflight, randomId } from "./security";
import { health } from "./routes/health";
import { oauthCallback, oauthStart, logout } from "./routes/oauth";
import { me } from "./routes/me";
import { status } from "./routes/status";
import { repos } from "./routes/repos";
import { policyRoute } from "./routes/policies";
import { topologyRoute } from "./routes/topology";
import { workflowDispatchRoute, dispatchTyped } from "./routes/workflows";
import { promoteBack, syncSourceToMirror, topologyAudit } from "./routes/promote";

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function route(request: Request, env: Env, correlationId: string): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "OPTIONS") return preflight(request, env);
  if (request.method === "GET" && url.pathname === "/health") return health();
  if (request.method === "GET" && url.pathname === "/oauth/github/start") return oauthStart(env);
  if (request.method === "GET" && url.pathname === "/oauth/github/callback") return oauthCallback(env, request);
  if (request.method === "POST" && url.pathname === "/oauth/logout") return logout(env, request);
  if (request.method === "GET" && url.pathname === "/v1/me") return me(env, request);
  if (request.method === "GET" && url.pathname === "/v1/status") return status(env);
  if (request.method === "GET" && url.pathname === "/v1/repos") return repos();
  if (request.method === "POST" && url.pathname === "/v1/workflows/dispatch") {
    return workflowDispatchRoute(env, request, correlationId);
  }

  if (parts[0] === "v1" && parts[1] === "repos" && parts.length === 5 && request.method === "GET") {
    const owner = escapePathSegment(parts[2]!);
    const repo = escapePathSegment(parts[3]!);
    if (parts[4] === "policy") return policyRoute(env, owner, repo);
    if (parts[4] === "topology") return topologyRoute(env, owner, repo);
  }

  if (parts[0] === "v1" && parts[1] === "repos" && parts.length === 4 && request.method === "POST") {
    const repo = escapePathSegment(parts[2]!);
    if (parts[3] === "sync-source-to-mirror") return syncSourceToMirror(env, request, correlationId, repo);
    if (parts[3] === "topology-audit") return topologyAudit(env, request, correlationId, repo);
    if (parts[3] === "promote-back") return promoteBack(env, request, correlationId, repo);
  }

  if (parts[0] === "v1" && parts[1] === "pr" && parts.length === 6 && request.method === "POST") {
    const owner = escapePathSegment(parts[2]!);
    const repo = escapePathSegment(parts[3]!);
    const prNumber = escapePathSegment(parts[4]!);
    const action = parts[5];
    if (action === "diagnose") {
      return dispatchTyped(env, request, correlationId, "agent-pr-diagnostics.yml", {
        target_owner: owner,
        target_repo: repo,
        pr_number: prNumber
      });
    }
    if (action === "fix") {
      return dispatchTyped(env, request, correlationId, "agent-fix-loop.yml", {
        target_owner: owner,
        target_repo: repo,
        pr_number: prNumber,
        max_iterations: "5",
        patch_mode: "patch"
      });
    }
    if (action === "finalize") {
      return dispatchTyped(env, request, correlationId, "ops-pr-finalize.yml", {
        target_owner: owner,
        target_repo: repo,
        pr_number: prNumber,
        requested_action: "finalize",
        dry_run: "false"
      });
    }
  }

  if (parts[0] === "v1" && parts[1] === "repos" && parts.length === 5 && request.method === "POST") {
    const owner = escapePathSegment(parts[2]!);
    const repo = escapePathSegment(parts[3]!);
    if (parts[4] === "release") {
      return dispatchTyped(env, request, correlationId, "ops-release-orchestrator.yml", {
        target_owner: owner,
        target_repo: repo,
        requested_action: "release",
        dry_run: "false"
      });
    }
  }

  return json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found."
      },
      correlation_id: correlationId
    },
    404
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const correlationId = request.headers.get("x-correlation-id") || randomId("corr");
    try {
      return withCors(await route(request, env, correlationId), request, env);
    } catch (error) {
      return withCors(errorResponse(error, correlationId), request, env);
    }
  }
};
