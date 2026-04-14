import { NextResponse } from "next/server";
import { getStorage, GCS_BUCKET } from "@/lib/gcs";

export async function GET() {
  const storage = getStorage();
  const bucket = storage.bucket(GCS_BUCKET);

  // Upload a small test file
  const testFileName = `test-${Date.now()}.txt`;
  const testContent = Buffer.from(`gcs test at ${new Date().toISOString()}`);
  try {
    await bucket.file(testFileName).save(testContent, {
      contentType: "text/plain",
      resumable: false,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, stage: "upload", error: String(err) },
      { status: 502 }
    );
  }

  // List files in bucket
  let files: string[] = [];
  try {
    const [fileList] = await bucket.getFiles({ maxResults: 20 });
    files = fileList.map((f) => f.name);
  } catch (err) {
    return NextResponse.json(
      { success: false, stage: "list", error: String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    bucket: GCS_BUCKET,
    uploaded: testFileName,
    files,
  });
}
