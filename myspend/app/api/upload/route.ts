import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GCS_BUCKET, uploadToGCS } from "@/lib/gcs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "No file provided" },
      { status: 400 }
    );
  }

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToGCS(safeName, buffer, file.type || "application/octet-stream");
  } catch (err) {
    console.error("GCS upload error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to upload file to storage" },
      { status: 502 }
    );
  }

  const doc = await prisma.document.create({
    data: {
      fileName: file.name,
      storageBucket: GCS_BUCKET,
      storagePath: safeName,
      mimeType: file.type || null,
      uploadStatus: "uploaded",
      extractionStatus: "pending",
    },
  });

  return NextResponse.json({ success: true, id: doc.id, fileName: doc.fileName });
}
