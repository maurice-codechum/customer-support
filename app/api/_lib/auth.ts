import { unauthorized } from "./errors";

const HEADER = "x-app-token";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function checkAuth(req: Request): Response | null {
  const expected = process.env.APP_API_TOKEN;
  if (!expected) {
    // No token configured: gate is disabled (e.g. dev without secret).
    return null;
  }
  const provided = req.headers.get(HEADER) ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return unauthorized();
  }
  return null;
}
