// Vercel Function. The handler lives under netlify/functions/ so the two
// deployments share the same logic — Netlify and Vercel both speak the Web
// Standard Request/Response API, but Netlify passes a second Context arg the
// handler never reads.
import netlifyHandler from "../netlify/functions/generate-metadata.js";

export default function handler(request: Request): Promise<Response> {
  return netlifyHandler(request, {} as never);
}
