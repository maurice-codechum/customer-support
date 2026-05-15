const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type GeminiJsonSchema = Record<string, unknown>;

export type GeminiCallOptions = {
  prompt: string;
  schema?: GeminiJsonSchema;
  temperature?: number;
};

type GenerationConfig = {
  temperature: number;
  responseMimeType?: string;
  responseJsonSchema?: GeminiJsonSchema;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export type GeminiFailureReason =
  | "missing_key"
  | "network_error"
  | "http_error"
  | "empty_response"
  | "parse_error";

export type GeminiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: GeminiFailureReason; detail?: string };

export async function callGemini<T = string>(
  opts: GeminiCallOptions,
): Promise<GeminiResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("gemini: GEMINI_API_KEY missing");
    return { ok: false, reason: "missing_key" };
  }

  const generationConfig: GenerationConfig = {
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = opts.schema;
  }

  const payload = {
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("gemini: network error:", err);
    return {
      ok: false,
      reason: "network_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`gemini: HTTP ${res.status}: ${body.slice(0, 500)}`);
    return {
      ok: false,
      reason: "http_error",
      detail: `${res.status} ${body.slice(0, 200)}`,
    };
  }

  let json: GeminiResponse;
  try {
    json = (await res.json()) as GeminiResponse;
  } catch (err) {
    console.warn("gemini: response not JSON:", err);
    return { ok: false, reason: "parse_error" };
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, reason: "empty_response" };

  if (opts.schema) {
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch (err) {
      console.warn("gemini: JSON parse failed:", err);
      return { ok: false, reason: "parse_error" };
    }
  }
  return { ok: true, data: text.trim() as unknown as T };
}
