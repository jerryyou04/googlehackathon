import { prisma } from "@/lib/prisma";
import DocumentList from "./document-list";
import type { SerializedDocument } from "./document-list";
import Link from "next/link";
import { Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  }).catch(() => []);

  const processed = docs.filter((d) => d.extractionStatus === "completed").length;
  const pending = docs.filter((d) => d.extractionStatus === "pending").length;

  const serialized: SerializedDocument[] = docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    extractionStatus: d.extractionStatus,
    createdAt: d.createdAt.toISOString(),
    _count: d._count,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a2a]">Files</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {processed} processed · {pending} pending
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-[#00A651] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#007A3E] transition-colors"
        >
          <Upload size={14} /> Upload
        </Link>
      </div>

      <DocumentList documents={serialized} />
    </main>
  );
}
