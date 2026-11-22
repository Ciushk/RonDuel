/**
 * Translates server API errors based on standard error codes.
 * Falls back to the provided fallback key if the error code is missing or unmapped.
 */
export function apiErrorMessage(
  t: (key: string, values?: Record<string, any>) => string,
  body: any,
  fallbackKey: string,
): string {
  if (body && typeof body === 'object' && body.code) {
    try {
      const msg = t(`errors.${body.code}`);
      if (msg && !msg.startsWith('errors.')) {
        return msg;
      }
    } catch {
      // ignore
    }
  }
  try {
    return t(fallbackKey);
  } catch {
    return fallbackKey;
  }
}
