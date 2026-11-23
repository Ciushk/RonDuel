import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Turns anything thrown inside a route handler into a JSON response that keeps the
 * HTTP status and the stable `code` of an ApiError, so the client can show a translated
 * message (see apiErrorMessage) instead of treating the error body as a normal result.
 */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid input', code: 'BAD_REQUEST' }, { status: 400 });
  }
  if (err instanceof Error && err.name === 'ApiError') {
    const apiErr = err as Error & { code?: string; status?: number };
    return NextResponse.json(
      { error: apiErr.message, code: apiErr.code ?? 'BAD_REQUEST' },
      { status: apiErr.status ?? 400 },
    );
  }
  return NextResponse.json(
    { error: err instanceof Error ? err.message : 'Bad request', code: 'BAD_REQUEST' },
    { status: 400 },
  );
}
