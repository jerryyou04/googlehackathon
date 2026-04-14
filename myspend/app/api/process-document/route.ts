import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { downloadFromGCS } from "@/lib/gcs";
import { CATEGORIES } from "@/lib/categories";

const VALID_CATEGORIES = new Set(CATEGORIES);

const PROMPT = `You are a financial data extraction assistant.
Analyze this bank statement or financial document and extract ALL transactions.
Return ONLY a valid JSON array of transaction objects with NO markdown fences.

Each transaction must have:
- date: string in YYYY-MM-DD format
- merchant: string (the store/payee name, cleaned up)
- amount: number (negative for expenses/debits, positive for income/credits)
- category: one of: Dining, Groceries, Transport, Shopping, Entertainment, Fitness, Bills, Income, Other

Example output:
[{"date":"2024-01-15","merchant":"Tim Hortons","amount":-4.50,"category":"Dining"},{"date":"2024-01-14","merchant":"Payroll","amount":2500.00,"category":"Income"}]

Return ONLY the JSON array, nothing else.`;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export async function POST(req: NextRequest) {
  let body: { documentId?: string; reprocess?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { documentId, reprocess = false } = body;
  if (!documentId) {
    return NextResponse.json(
      { success: false, error: "documentId is required" },
      { status: 400 }
    );
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 }
    );
  }

  if (reprocess) {
    await prisma.transaction.deleteMany({ where: { documentId } });
    await prisma.document.update({
      where: { id: documentId },
      data: { extractionStatus: "pending" },
    });
  }

  // Download from GCS
  let buffer: Buffer;
  try {
    buffer = await downloadFromGCS(doc.storagePath);
  } catch (err) {
    console.error("GCS download error:", err);
    return NextResponse.json(
      { success: false, error: "File not found in storage" },
      { status: 500 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const ext = doc.fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage =
    IMAGE_MIME_TYPES.has(doc.mimeType ?? "") || IMAGE_EXTENSIONS.has(ext);
  const mimeType = doc.mimeType || (isImage ? "image/jpeg" : "application/pdf");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let responseText: string;
  try {
    const base64Data = buffer.toString("base64");
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      { text: PROMPT },
    ]);
    responseText = result.response.text();
  } catch (err: unknown) {
    console.error("Gemini error:", err);
    const msg =
      err instanceof Error && err.message.includes("timeout")
        ? "AI processing timed out"
        : "AI processing failed";
    return NextResponse.json({ success: false, error: msg }, { status: 504 });
  }

  // Strip markdown fences if present
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { success: false, error: "AI returned invalid JSON" },
      { status: 422 }
    );
  }

  // Accept { transactions: [...] } or bare array
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>).transactions)
    ? (parsed as { transactions: unknown[] }).transactions
    : null;

  if (!rawList) {
    return NextResponse.json(
      { success: false, error: "AI response was not a valid transaction list" },
      { status: 422 }
    );
  }

  const validTransactions = rawList.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const t = item as Record<string, unknown>;
    if (
      typeof t.date !== "string" ||
      typeof t.merchant !== "string" ||
      typeof t.amount !== "number"
    )
      return [];
    const dateObj = new Date(t.date);
    if (isNaN(dateObj.getTime())) return [];
    const category =
      typeof t.category === "string" && VALID_CATEGORIES.has(t.category as (typeof CATEGORIES)[number])
        ? t.category
        : "Other";
    return [
      {
        documentId,
        date: dateObj,
        merchant: t.merchant,
        description: t.merchant,
        amount: t.amount as number,
        category,
      },
    ];
  });

  await prisma.transaction.createMany({ data: validTransactions });
  await prisma.document.update({
    where: { id: documentId },
    data: { extractionStatus: "completed" },
  });

  return NextResponse.json({ success: true, count: validTransactions.length });
}
