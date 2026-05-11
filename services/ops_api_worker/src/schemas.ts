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

export async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim() === "") return {};
  try {
    return parseJsonObject(JSON.parse(text));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object.");
  }
}

export function asString(value: unknown, name: string, required = true): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (!required) return "";
  throw new HttpError(400, "INVALID_INPUT", `${name} is required.`);
}

export function optionalString(value: unknown, name: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() !== "") return value;
  throw new HttpError(400, "INVALID_INPUT", `${name} must be a non-empty string when provided.`);
}

export function enumString(
  value: unknown,
  name: string,
  allowed: readonly string[],
  defaultValue: string
): string {
  const candidate = value == null ? defaultValue : optionalString(value, name);
  if (candidate && allowed.includes(candidate)) return candidate;
  const code = `INVALID_${name.toUpperCase()}`;
  throw new HttpError(400, code, `${name} must be one of: ${allowed.join(", ")}.`);
}

export function booleanString(
  value: unknown,
  name: string,
  defaultValue: "true" | "false"
): "true" | "false" {
  if (value == null) return defaultValue;
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  throw new HttpError(400, "INVALID_INPUT", `${name} must be true or false.`);
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
