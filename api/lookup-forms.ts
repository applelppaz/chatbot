import netlifyHandler from "../netlify/functions/lookup-forms.js";

export default function handler(request: Request): Promise<Response> {
  return netlifyHandler(request, {} as never);
}
