import { createClient } from "./supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Uploads a file to the shared "attachments" bucket and returns its storage path (the bucket is private — this is not a usable URL on its own, see getAttachmentUrl). */
export async function uploadAttachment(file: File, folder: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file);
  if (error) throw error;
  return path;
}

// Older rows stored a full public URL rather than a bare path (from when
// the bucket was public) — pull the path back out so both still resolve.
function toStoragePath(stored: string): string {
  const marker = "/attachments/";
  const i = stored.indexOf(marker);
  return i === -1 ? stored : stored.slice(i + marker.length);
}

/** Resolves a stored path (or legacy public URL) to a short-lived signed URL for display. Returns null if the object is missing or unreadable. */
export async function getAttachmentUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(toStoragePath(stored), SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

/** Removes a stored attachment (path or legacy public URL) from the bucket — best-effort, silently ignores errors (e.g. already gone). */
export async function deleteAttachment(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  const supabase = createClient();
  await supabase.storage.from("attachments").remove([toStoragePath(stored)]);
}
