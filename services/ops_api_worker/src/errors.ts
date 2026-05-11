export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, correlationId: string): Response {
  if (error instanceof HttpError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        correlation_id: correlationId
      },
      error.status
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message
      },
      correlation_id: correlationId
    },
    500
  );
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
