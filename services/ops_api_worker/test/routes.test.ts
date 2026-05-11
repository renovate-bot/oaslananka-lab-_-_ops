import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

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
});
