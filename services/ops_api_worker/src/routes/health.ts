import { json } from "../errors";

export function health(): Response {
  return json({
    status: "ok",
    service: "oaslananka-ops-api",
    runtime: "cloudflare-workers"
  });
}
