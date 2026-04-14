import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { success: false, error: "question is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const [recentTxs, categoryBreakdown, topMerchants] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 300,
      select: { date: true, merchant: true, amount: true, category: true },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.transaction.groupBy({
      by: ["merchant"],
      where: { amount: { lt: 0 }, merchant: { not: null } },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "asc" } },
      take: 20,
    }),
  ]);

  if (recentTxs.length === 0) {
    return NextResponse.json({
      success: true,
      answer:
        "You haven't uploaded any transactions yet. Upload a bank statement to get started!",
    });
  }

  const totalExpenses = recentTxs
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIncome = recentTxs
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const dates = recentTxs
    .map((t) => t.date)
    .filter(Boolean)
    .sort() as Date[];
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const context = JSON.stringify({
    dateRange: {
      from: minDate?.toISOString().slice(0, 10),
      to: maxDate?.toISOString().slice(0, 10),
    },
    totalExpenses: totalExpenses.toFixed(2),
    totalIncome: totalIncome.toFixed(2),
    net: (totalIncome - totalExpenses).toFixed(2),
    transactionCount: recentTxs.length,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      total: c._sum.amount?.toFixed(2),
      count: c._count.id,
    })),
    topMerchants: topMerchants.slice(0, 10).map((m) => ({
      merchant: m.merchant,
      total: m._sum.amount?.toFixed(2),
      visits: m._count.id,
    })),
    recentTransactions: recentTxs.slice(0, 50).map((t) => ({
      date: t.date?.toISOString().slice(0, 10),
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
    })),
  });

  const systemPrompt = `You are a sharp, practical personal finance advisor with access to the user's real transaction data. Be direct, specific, and helpful — not generic.

Rules:
- Always reference actual numbers from their data (specific dollar amounts, merchant names, dates)
- Keep responses concise: 2–5 sentences for simple questions, short bullet points for breakdowns
- If asked for advice, give concrete actionable steps, not vague platitudes
- Use dollar signs and format amounts clearly (e.g. $42.50)
- If the data doesn't cover what they're asking, say so briefly
- Never make up transactions or numbers not in the data
- For trend questions, compare periods if the data spans multiple months
- For "where am I spending most" type questions, cite the top categories/merchants by name

Spending data (last ${recentTxs.length} transactions, ${minDate?.toISOString().slice(0, 10)} to ${maxDate?.toISOString().slice(0, 10)}):
${context}

User question: ${question}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
    });
    const answer = result.text ?? "";
    return NextResponse.json({ success: true, answer });
  } catch (err) {
    console.error("Gemini insights error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate insight" },
      { status: 502 }
    );
  }
}
