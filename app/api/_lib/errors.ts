import { NextResponse } from "next/server";

function randomId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toErrorResponse(err: unknown, status = 500): NextResponse {
  const id = randomId();
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[${id}] route error:`, message);
  return NextResponse.json(
    { error: "internal_error", id },
    { status },
  );
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status: 400 },
  );
}

export function notFound(message = "not_found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
