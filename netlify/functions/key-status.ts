import type { Context } from "@netlify/functions";
import { getConfiguredSlots, jsonResponse } from "./_gemini.js";

// Returns which Gemini key slots are populated as Netlify env vars.
// Does NOT return the keys themselves.
export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const slots = getConfiguredSlots();
  return jsonResponse(200, { slots });
};

export const config = { path: "/api/key-status" };
