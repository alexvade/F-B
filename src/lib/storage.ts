import { createClient } from "./supabase/client";

/** Uploads a file to the shared "attachments" bucket and returns its public URL. */
export async function uploadAttachment(file: File, folder: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}
