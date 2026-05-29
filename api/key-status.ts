import netlifyHandler from "../netlify/functions/key-status.js";

export const config = { runtime: "edge" };

export default function handler(request: Request): Promise<Response> {
  return netlifyHandler(request, {} as never);
}
