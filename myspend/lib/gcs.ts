import { Storage } from "@google-cloud/storage";

let _storage: Storage | null = null;

export function getStorage(): Storage {
  if (_storage) return _storage;

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credsJson) {
    _storage = new Storage({ credentials: JSON.parse(credsJson) });
  } else {
    // Application Default Credentials (Cloud Run / local gcloud auth)
    _storage = new Storage();
  }
  return _storage;
}

export const GCS_BUCKET = process.env.GCS_BUCKET_NAME ?? "myspend-documents";

export async function uploadToGCS(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const bucket = getStorage().bucket(GCS_BUCKET);
  const file = bucket.file(storagePath);
  await file.save(buffer, { contentType: mimeType, resumable: false });
}

export async function downloadFromGCS(storagePath: string): Promise<Buffer> {
  const bucket = getStorage().bucket(GCS_BUCKET);
  const [contents] = await bucket.file(storagePath).download();
  return contents as Buffer;
}

export async function deleteFromGCS(storagePath: string): Promise<void> {
  const bucket = getStorage().bucket(GCS_BUCKET);
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
}
