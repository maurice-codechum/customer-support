import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callGemini } from "../gemini";

describe("callGemini", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns missing_key when key absent", async () => {
    delete process.env.GEMINI_API_KEY;
    const r = await callGemini({ prompt: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_key");
  });

  it("returns http_error on non-2xx", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("nope", { status: 404 }),
    ) as unknown as typeof fetch;
    const r = await callGemini({ prompt: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("http_error");
  });

  it("returns network_error on fetch throw", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const r = await callGemini({ prompt: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("network_error");
  });

  it("returns text on success", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "hello world" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const r = await callGemini<string>({ prompt: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBe("hello world");
  });

  it("parses JSON when schema given", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const r = await callGemini<{ x: number }>({
      prompt: "hi",
      schema: { type: "object" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.x).toBe(1);
  });

  it("returns parse_error on bad JSON when schema given", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "not json" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const r = await callGemini({ prompt: "hi", schema: { type: "object" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("parse_error");
  });

  it("returns empty_response when no text", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;
    const r = await callGemini({ prompt: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_response");
  });
});
