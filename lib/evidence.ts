export const EVIDENCE_BUCKET = "incident-evidence";
export const MAX_EVIDENCE_FILES = 3;
export const MAX_EVIDENCE_FILE_SIZE = 40 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
] as const;

export type EvidenceMediaType = "image" | "video";

const mimeByExtension: Record<string, (typeof EVIDENCE_MIME_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
};

export function evidenceMimeType(file: File) {
  if ((EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) return file.type;
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  return extension ? mimeByExtension[extension] ?? null : null;
}

export function evidenceMediaType(mimeType: string): EvidenceMediaType | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export function evidenceExtension(file: File) {
  const nameExtension = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (nameExtension) return nameExtension;
  const subtype = file.type.split("/")[1]?.split(";")[0]?.replace(/[^a-z0-9]/g, "");
  return subtype || "bin";
}

export function formatEvidenceSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  return `${Math.max(1, Math.round(size / 1024)).toLocaleString("fr-FR")} Ko`;
}
