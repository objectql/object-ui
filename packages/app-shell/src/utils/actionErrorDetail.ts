/**
 * Resolve a human-readable message out of an ObjectStack error payload.
 *
 * Always returns a STRING. The envelope nests the message as
 * `{ error: { code, message } }`, and passing that object through as
 * `ActionResult.error` reaches `toast.error()` as a React child and crashes the
 * page (React #31). That shape used to be rare on the `/actions` route —
 * failures came back as HTTP 200 with a plain-string `error` — but since
 * objectstack#3913 a failed action answers with a real status and the nested
 * object, so every `/actions` caller has to go through this.
 *
 * Handles, in order: `{error: 'msg'}`, `{error: {message: 'msg'}}`,
 * `{message: 'msg'}`, else the caller's fallback.
 */
export function actionErrorDetail(body: unknown, fallback: string): string {
  const b = body as { error?: unknown; message?: unknown } | null;
  const err = b?.error;
  if (typeof err === 'string' && err.length > 0) return err;
  const nested = (err as { message?: unknown } | null)?.message;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  if (typeof b?.message === 'string' && b.message.length > 0) return b.message;
  return fallback;
}
