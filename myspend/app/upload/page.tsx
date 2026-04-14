"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; fileName: string; id: string }
  | { status: "error"; message: string };

type ProcessState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "done"; count: number }
  | { status: "error"; message: string };

export default function UploadPage() {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [processState, setProcessState] = useState<ProcessState>({ status: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadState({ status: "uploading" });
    setProcessState({ status: "idle" });

    const fd = new FormData();
    fd.append("file", selectedFile);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUploadState({ status: "success", fileName: data.fileName, id: data.id });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  async function handleProcess(documentId: string) {
    setProcessState({ status: "processing" });
    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setProcessState({ status: "done", count: data.count });
    } catch (err) {
      setProcessState({
        status: "error",
        message: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1a3a2a] mb-2">Upload Statement</h1>
      <p className="text-[#6B7280] text-sm mb-6">
        Upload a bank statement PDF, image, or CSV. Gemini AI will extract your
        transactions automatically.
      </p>

      {/* Drop zone */}
      <label
        htmlFor="file-input"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) setSelectedFile(f);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          isDragging
            ? "border-[#00A651] bg-[#F0FFF4]"
            : selectedFile
            ? "border-[#00A651] bg-[#F0F5F2]"
            : "border-[#DDE8E1] bg-white hover:border-[#00A651] hover:bg-[#F0F5F2]"
        }`}
      >
        {selectedFile ? (
          <>
            <FileText className="text-[#00A651]" size={40} />
            <p className="font-semibold text-[#1a3a2a]">{selectedFile.name}</p>
            <p className="text-xs text-[#6B7280]">
              {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || "unknown type"}
            </p>
            <p className="text-xs text-[#00A651]">Click to change file</p>
          </>
        ) : (
          <>
            <Upload className="text-[#00A651]" size={40} />
            <p className="font-semibold text-[#1a3a2a]">Click or drag a file here</p>
            <p className="text-xs text-[#6B7280]">PDF, CSV, JPG, PNG, WEBP</p>
          </>
        )}
        <input
          id="file-input"
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setSelectedFile(f);
          }}
        />
      </label>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploadState.status === "uploading"}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-[#00A651] text-white font-semibold py-3 rounded-xl hover:bg-[#007A3E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploadState.status === "uploading" ? (
          <><Loader2 size={18} className="animate-spin" /> Uploading…</>
        ) : (
          <><Upload size={18} /> Upload File</>
        )}
      </button>

      {/* Error banner */}
      {uploadState.status === "error" && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          {uploadState.message}
        </div>
      )}

      {/* Success + process section */}
      {uploadState.status === "success" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{uploadState.fileName}</strong> uploaded successfully
            </span>
          </div>

          {processState.status === "idle" || processState.status === "error" ? (
            <>
              <button
                onClick={() => handleProcess(uploadState.id)}
                className="w-full flex items-center justify-center gap-2 bg-[#1a3a2a] text-white font-semibold py-3 rounded-xl hover:bg-[#004d26] transition-colors"
              >
                Extract Transactions with AI
              </button>
              {processState.status === "error" && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  {processState.message}
                </div>
              )}
            </>
          ) : processState.status === "processing" ? (
            <div className="flex items-center justify-center gap-2 text-[#6B7280] text-sm py-3">
              <Loader2 size={18} className="animate-spin text-[#00A651]" />
              Analysing with Gemini AI…
            </div>
          ) : processState.status === "done" ? (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{processState.count} transactions</strong> extracted successfully
              </span>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
