import netlifyHandler from "../netlify/functions/extract-words.js";

export default function handler(request: Request): Promise<Response> {
  return netlifyHandler(request, {} as never);
}
