import { createClient } from "@supabase/supabase-js";

export const GCS_BUCKET = process.env.GCS_BUCKET_NAME ?? "documents";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function uploadToGCS(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(GCS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (error) throw error;
}

export async function downloadFromGCS(storagePath: string): Promise<Buffer> {
  const { data, error } = await getSupabase()
    .storage.from(GCS_BUCKET)
    .download(storagePath);
  if (error || !data) throw error ?? new Error("No data returned");
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromGCS(storagePath: string): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(GCS_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}
