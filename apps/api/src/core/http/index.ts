import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ApiErrorPayload, ApiSuccess } from '@toantrung/contracts';

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count += 1;
  return true;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export function jsonSuccess<T, M = Record<string, unknown>>(
  data: T,
  status = 200,
  meta?: M,
  headers?: HeadersInit,
): NextResponse<ApiSuccess<T, M>> {
  return NextResponse.json(
    {
      ok: true as const,
      data,
      ...(meta !== undefined ? { meta } : {}),
    },
    {
      status,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        ...headers,
      },
    },
  );
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiErrorPayload> {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details !== undefined ? { details } : {}),
      },
    },
    {
      status,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    },
  );
}

