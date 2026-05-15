const TOKEN_HEADER = "x-app-token";

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = process.env.NEXT_PUBLIC_APP_API_TOKEN;
  if (!token) return extra ?? {};
  const base = new Headers(extra);
  base.set(TOKEN_HEADER, token);
  return base;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, headers: authHeaders(init?.headers) });
}
