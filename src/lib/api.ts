import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message === "FORBIDDEN" ? "Forbidden" : "Unauthorized", err.status);
  }
  if (err instanceof ZodError) {
    return jsonError("Invalid input", 422, { issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  console.error("[api]", err);
  return jsonError("Internal server error", 500);
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  return schema.parse(raw);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function guardRateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const result = rateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (!result.allowed) {
    throw new ApiError(`Too many requests. Retry in ${result.retryAfterSec}s`, 429);
  }
}
