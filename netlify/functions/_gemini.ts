// Shared helpers for talking to the Gemini REST API from Netlify Functions.
// The API key is read from the GEMINI_API_KEY environment variable, which is
// configured in Netlify's site settings (Build & deploy → Environment).

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiRequestBody {
  contents: Array<{ role?: "user" | "model"; parts: GeminiPart[] }>;
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new HttpError(
      500,
      "GEMINI_API_KEY is not configured on the Netlify site.",
    );
  }
  return key;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function callGemini(body: GeminiRequestBody): Promise<string> {
  const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(getApiKey())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(
      res.status === 429 ? 429 : 502,
      `Gemini API error ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  const json = (await res.json()) as GeminiResponse;
  const blocked = json.promptFeedback?.blockReason;
  if (blocked) {
    throw new HttpError(422, `Gemini blocked the request: ${blocked}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpError(502, "Gemini returned an empty response.");
  }
  return text;
}

export function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return jsonResponse(err.status, { error: err.message });
  }
  console.error(err);
  return jsonResponse(500, { error: "Unexpected server error." });
}
