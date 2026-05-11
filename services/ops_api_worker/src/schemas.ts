import { HttpError } from "./errors";
import { escapePathSegment } from "./security";

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_JSON", "Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  return parseJsonObject(await request.json());
}

export function asString(value: unknown, name: string, required = true): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (!required) return "";
  throw new HttpError(400, "INVALID_INPUT", `${name} is required.`);
}

export function asInputs(value: unknown): Record<string, string> {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", "inputs must be an object.");
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    result[escapePathSegment(key)] = String(item);
  }
  return result;
}
