import type {
  ExtractedItem,
  FormsLookup,
  Language,
  WordMetadata,
} from "./types";

interface ApiError {
  error: string;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as ApiError;
      if (json.error) detail = json.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function generateMetadata(
  term: string,
  language: Language,
): Promise<WordMetadata> {
  return postJSON<WordMetadata>("/api/generate-metadata", { term, language });
}

export async function extractItemsFromImage(
  file: File,
  language: Language,
  include: "words" | "phrases" | "both" = "both",
): Promise<ExtractedItem[]> {
  const { dataUrl, mimeType } = await readAndResizeImage(file, 1280);
  const base64 = dataUrl.split(",")[1] ?? "";
  const result = await postJSON<{ items: ExtractedItem[] }>(
    "/api/extract-words",
    {
      imageBase64: base64,
      mimeType,
      language,
      include,
    },
  );
  return result.items;
}

export async function lookupForms(
  term: string,
  language: Language,
): Promise<FormsLookup> {
  return postJSON<FormsLookup>("/api/lookup-forms", { term, language });
}

async function readAndResizeImage(
  file: File,
  maxEdge: number,
): Promise<{ dataUrl: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image"));
    el.src = dataUrl;
  });

  const longEdge = Math.max(img.width, img.height);
  if (longEdge <= maxEdge) {
    return { dataUrl, mimeType: file.type || "image/jpeg" };
  }
  const scale = maxEdge / longEdge;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl, mimeType: file.type || "image/jpeg" };
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const resized = canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl: resized, mimeType: "image/jpeg" };
}
