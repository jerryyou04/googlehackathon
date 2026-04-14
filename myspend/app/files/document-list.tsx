"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useState } from "react";
import { Pencil, Trash2, Check, X, RefreshCw, FileText, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/categories";

export interface SerializedDocument {
  id: string;
  fileName: string;
  mimeType: string | null;
  extractionStatus: string;
  createdAt: string;
  _count: { transactions: number };
}

export default function DocumentList({
  documents,
}: {
  documents: SerializedDocument[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reprocessResults, setReprocessResults] = useState<
    Record<string, string>
  >({});

  function startRename(doc: SerializedDocument) {
    setRenamingId(doc.id);
    setRenameValue(doc.fileName);
  }

  async function saveRename(id: string) {
    if (!renameValue.trim()) return;
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: renameValue.trim() }),
    });
    setRenamingId(null);
    startTransition(() => router.refresh());
  }

  async function deleteDocument(id: string) {
    if (
      !confirm(
        "Delete this document and all its transactions? This cannot be undone."
      )
    )
      return;
    setDeletingId(id);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  async function reprocess(id: string) {
    setReprocessingId(id);
    setReprocessResults((r) => ({ ...r, [id]: "" }));
    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id, reprocess: true }),
      });
      const data = await res.json();
      if (data.success) {
        setReprocessResults((r) => ({
          ...r,
          [id]: `${data.count} transactions extracted`,
        }));
      } else {
        setReprocessResults((r) => ({ ...r, [id]: data.error }));
      }
      startTransition(() => router.refresh());
    } catch {
      setReprocessResults((r) => ({ ...r, [id]: "Processing failed" }));
    } finally {
      setReprocessingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {documents.length === 0 && (
        <p className="text-center text-[#6B7280] text-sm py-12">
          No files uploaded yet.
        </p>
      )}
      {documents.map((doc) => {
        const isDeleting = deletingId === doc.id;
        const isReprocessing = reprocessingId === doc.id;
        const result = reprocessResults[doc.id];
        const isPending = doc.extractionStatus === "pending";

        return (
          <div
            key={doc.id}
            className={`bg-white border border-[#E2E8E4] rounded-2xl p-4 transition-opacity ${
              isDeleting ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 bg-[#F0FFF4] rounded-xl flex items-center justify-center shrink-0">
                <FileText size={18} className="text-[#00A651]" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                {renamingId === doc.id ? (
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(doc.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 border border-[#00A651] rounded-lg px-2 py-0.5 text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => saveRename(doc.id)}
                      className="p-1 text-[#00A651] hover:bg-[#F0F5F2] rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="p-1 text-[#9CA3AF] hover:bg-[#F0F5F2] rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="font-medium text-[#1a3a2a] text-sm truncate mb-0.5">
                    {doc.fileName}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9CA3AF]">
                  {doc.mimeType && <span>{doc.mimeType}</span>}
                  <span>{formatDate(doc.createdAt)}</span>
                  <span
                    className={`font-semibold px-1.5 py-0.5 rounded-full text-white ${
                      isPending ? "bg-amber-500" : "bg-[#00A651]"
                    }`}
                  >
                    {isPending ? "Pending" : "Processed"}
                  </span>
                  <span className="text-[#6B7280]">
                    {doc._count.transactions} transactions
                  </span>
                </div>

                {result && (
                  <p className="text-xs mt-1 text-[#00A651]">{result}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startRename(doc)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#1a3a2a] hover:bg-[#F0F5F2]"
                  title="Rename"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Reprocess footer */}
            <div className="mt-3 pt-3 border-t border-[#F0F5F2] flex items-center justify-between">
              <p className="text-xs text-[#9CA3AF]">
                {isPending ? "Not yet processed" : "Reprocess to re-extract"}
              </p>
              <button
                onClick={() => reprocess(doc.id)}
                disabled={isReprocessing}
                className="flex items-center gap-1 text-xs font-medium text-[#00A651] border border-[#DDE8E1] rounded-lg px-3 py-1 hover:bg-[#F0F5F2] disabled:opacity-50 transition-colors"
              >
                {isReprocessing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {isPending ? "Process now" : "Reprocess"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
