// Vercel Function. The handler lives under netlify/functions/ so the two
// deployments share the same logic — Netlify and Vercel both speak the Web
// Standard Request/Response API, but Netlify passes a second Context arg the
// handler never reads. The Edge runtime is what makes Vercel hand us a
// Web standard Request; under the default Node runtime Vercel would call
// us with (req, res) Node-style objects and `req.json()` would not exist.
import netlifyHandler from "../netlify/functions/generate-metadata.js";

export const config = { runtime: "edge" };

export default function handler(request: Request): Promise<Response> {
  return netlifyHandler(request, {} as never);
}
