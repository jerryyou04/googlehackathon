import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GCS_BUCKET, uploadToGCS } from "@/lib/gcs";

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const testFileName = `test-${Date.now()}.txt`;
  const testContent = Buffer.from(`storage test at ${new Date().toISOString()}`);

  try {
    await uploadToGCS(testFileName, testContent, "text/plain");
  } catch (err) {
    return NextResponse.json(
      { success: false, stage: "upload", error: String(err) },
      { status: 502 }
    );
  }

  const { data: files, error: listError } = await supabase.storage
    .from(GCS_BUCKET)
    .list("", { limit: 20 });

  if (listError) {
    return NextResponse.json(
      { success: false, stage: "list", error: String(listError) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    bucket: GCS_BUCKET,
    uploaded: testFileName,
    files: files?.map((f) => f.name) ?? [],
  });
}
