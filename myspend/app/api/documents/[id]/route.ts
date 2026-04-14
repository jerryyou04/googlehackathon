import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromGCS } from "@/lib/gcs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  if (!body.fileName?.trim()) {
    return NextResponse.json(
      { success: false, error: "fileName is required" },
      { status: 400 }
    );
  }

  try {
    const doc = await prisma.document.update({
      where: { id },
      data: { fileName: body.fileName.trim() },
    });
    return NextResponse.json({ success: true, document: doc });
  } catch {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 }
    );
  }

  // Delete from GCS (non-fatal)
  try {
    await deleteFromGCS(doc.storagePath);
  } catch (err) {
    console.error("GCS delete error:", err);
  }

  await prisma.transaction.deleteMany({ where: { documentId: id } });
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
