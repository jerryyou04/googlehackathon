import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { downloadFromGCS } from "@/lib/gcs";
import { CATEGORIES } from "@/lib/categories";

const VALID_CATEGORIES = new Set(CATEGORIES);

const PROMPT = `You are a financial data extraction expert. Analyze this document and extract ALL transactions.

The document may be any of:
- Bank statement (checking or savings account)
- Credit card statement
- Store or restaurant receipt
- Grocery or retail receipt
- CSV/spreadsheet export of transactions
- Screenshot of a transaction list or banking app

Extraction rules:
- Extract EVERY transaction, charge, payment, or line item visible
- For receipts: each line item is a transaction; use the store name as merchant for all items
- For bank/credit card statements: extract every debit, credit, purchase, and payment
- Amounts: negative numbers for expenses/debits/purchases, positive for income/credits/refunds/payments
- Dates: use YYYY-MM-DD format; if no year visible, infer from context (statement period, receipt header, etc.)
- Merchant: clean up the name (e.g. "TIM HORTONS #1234 TORONTO ON" → "Tim Hortons")
- Category must be exactly one of: Dining, Groceries, Transport, Shopping, Entertainment, Fitness, Bills, Income, Other

Category guidance:
- Dining: restaurants, cafes, fast food, bars, food delivery (Uber Eats, DoorDash, Skip)
- Groceries: supermarkets, grocery stores (Loblaws, Walmart Grocery, Costco, Metro, No Frills, FreshCo)
- Transport: gas stations, parking, transit, Uber/Lyft rides, car rental, tolls, airlines
- Shopping: retail stores, Amazon, clothing, electronics, home goods, online shopping
- Entertainment: movies, concerts, streaming (Netflix, Spotify), gaming, sports events
- Fitness: gyms, sports stores, yoga studios, wellness apps
- Bills: utilities, phone, internet, insurance, rent, mortgage, subscriptions (not streaming)
- Income: salary, payroll, e-transfer received, tax refund, interest earned, cashback
- Other: anything that doesn't clearly fit above

Return ONLY a valid JSON array. No markdown fences, no explanation, no extra text.

Each object must have exactly these fields:
{
  "date": "YYYY-MM-DD",
  "merchant": "Cleaned Merchant Name",
  "amount": -12.50,
  "category": "Dining"
}

Example output:
[{"date":"2024-03-15","merchant":"Tim Hortons","amount":-4.50,"category":"Dining"},{"date":"2024-03-14","merchant":"TTC","amount":-3.30,"category":"Transport"},{"date":"2024-03-13","merchant":"Payroll","amount":2500.00,"category":"Income"}]`;

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

  const ai = new GoogleGenAI({ apiKey });

  let responseText: string;
  try {
    const base64Data = buffer.toString("base64");
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: PROMPT },
          ],
        },
      ],
    });
    responseText = result.text ?? "";
  } catch (err: unknown) {
    console.error("Gemini error:", err);
    const msg =
      err instanceof Error && err.message.includes("timeout")
        ? "AI processing timed out"
        : "AI processing failed";
    return NextResponse.json({ success: false, error: msg }, { status: 504 });
  }

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
      typeof t.category === "string" &&
      VALID_CATEGORIES.has(t.category as (typeof CATEGORIES)[number])
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
