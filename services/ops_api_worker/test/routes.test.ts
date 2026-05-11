import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";
import { HttpError } from "../src/errors";
import { buildPromoteBackInputs } from "../src/routes/promote";

class MemoryKv {
  async get(): Promise<string | null> {
    return null;
  }
  async put(): Promise<void> {
    return undefined;
  }
  async delete(): Promise<void> {
    return undefined;
  }
}

function env(): Env {
  const kv = new MemoryKv() as unknown as KVNamespace;
  return {
    OAUTH_STATE: kv,
    OPS_SESSIONS: kv,
    OPS_REPO: "oaslananka-lab/_ops",
    OPS_API_PUBLIC_BASE_URL: "https://ops-api.oaslananka.dev",
    OPS_APP_PUBLIC_BASE_URL: "https://ops.oaslananka.dev",
    ALLOWED_GITHUB_LOGINS: "oaslananka",
    GITHUB_OAUTH_CALLBACK_URL: "https://ops-api.oaslananka.dev/oauth/github/callback"
  };
}

describe("worker routes", () => {
  it("serves health", async () => {
    const response = await worker.fetch(new Request("https://ops-api.oaslananka.dev/health"), env());
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "oaslananka-ops-api",
      runtime: "cloudflare-workers"
    });
  });

  it("serves status without requiring OAuth", async () => {
    const response = await worker.fetch(new Request("https://ops-api.oaslananka.dev/v1/status"), env());
    await expect(response.json()).resolves.toMatchObject({
      ops_repo: "oaslananka-lab/_ops",
      source_of_truth_owner: "oaslananka",
      execution_owner: "oaslananka-lab",
      copilot_required: false
    });
  });

  it("requires authentication for mutating workflow dispatches", async () => {
    const response = await worker.fetch(
      new Request("https://ops-api.oaslananka.dev/v1/repos/boardguard/topology-audit", {
        method: "POST"
      }),
      env()
    );
    expect(response.status).toBe(401);
  });

  it("unauthenticated promote-back returns 401", async () => {
    const response = await worker.fetch(
      new Request("https://ops-api.oaslananka.dev/v1/repos/boardguard/promote-back", {
        method: "POST",
        body: "{}"
      }),
      env()
    );
    expect(response.status).toBe(401);
  });

  it("empty promote-back body dispatches dry_run defaults", () => {
    expect(buildPromoteBackInputs("boardguard", {})).toMatchObject({
      mirror_owner: "oaslananka-lab",
      mirror_repo: "boardguard",
      mirror_ref: "main",
      mode: "dry_run",
      merge_source_pr: "false"
    });
  });

  it("mode=pull_request dispatches pull_request", () => {
    expect(buildPromoteBackInputs("boardguard", { mode: "pull_request" })).toMatchObject({
      mode: "pull_request",
      merge_source_pr: "false"
    });
  });

  it("mode=update_existing_pr dispatches update_existing_pr", () => {
    expect(buildPromoteBackInputs("boardguard", { mode: "update_existing_pr" })).toMatchObject({
      mode: "update_existing_pr"
    });
  });

  it("merge_source_pr=true dispatches true", () => {
    expect(buildPromoteBackInputs("boardguard", { merge_source_pr: true })).toMatchObject({
      merge_source_pr: "true"
    });
    expect(buildPromoteBackInputs("boardguard", { merge_source_pr: "true" })).toMatchObject({
      merge_source_pr: "true"
    });
  });

  it("invalid mode returns INVALID_PROMOTE_MODE before dispatch", () => {
    expect(() => buildPromoteBackInputs("boardguard", { mode: "merge_everything" })).toThrow(HttpError);
    try {
      buildPromoteBackInputs("boardguard", { mode: "merge_everything" });
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).code).toBe("INVALID_PROMOTE_MODE");
    }
  });

  it("invalid mode route returns HTTP 400 without dispatch", async () => {
    const response = await worker.fetch(
      new Request("https://ops-api.oaslananka.dev/v1/repos/boardguard/promote-back", {
        method: "POST",
        body: JSON.stringify({ mode: "merge_everything" })
      }),
      env()
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_PROMOTE_MODE"
      }
    });
  });

  it("topology-audit still requires auth", async () => {
    const response = await worker.fetch(
      new Request("https://ops-api.oaslananka.dev/v1/repos/boardguard/topology-audit", {
        method: "POST",
        body: "{}"
      }),
      env()
    );
    expect(response.status).toBe(401);
  });
});
