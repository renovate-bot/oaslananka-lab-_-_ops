import type { Env } from "../env";
import { json } from "../errors";
import { requireSession } from "../auth/session";
import { dispatchOpsWorkflow } from "../github/workflows";
import { asInputs, asString, readJsonObject } from "../schemas";

export async function workflowDispatchRoute(
  env: Env,
  request: Request,
  correlationId: string
): Promise<Response> {
  await requireSession(env, request);
  const body = await readJsonObject(request);
  const workflow = asString(body.workflow, "workflow");
  const ref = asString(body.ref, "ref", false) || "main";
  const inputs = asInputs(body.inputs);
  return json(await dispatchOpsWorkflow(env, { workflow, ref, inputs }, correlationId));
}

export async function dispatchTyped(
  env: Env,
  request: Request,
  correlationId: string,
  workflow: string,
  inputs: Record<string, string>
): Promise<Response> {
  await requireSession(env, request);
  return json(await dispatchOpsWorkflow(env, { workflow, ref: "main", inputs }, correlationId));
}
