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

  const [recentTxs, categoryBreakdown, topMerchants, recurringRaw] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 500,
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
    // Find merchant+amount combos that appear 2+ times — likely subscriptions
    prisma.transaction.groupBy({
      by: ["merchant", "amount"],
      where: { amount: { lt: 0 }, merchant: { not: null } },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
      having: { amount: { _count: { gte: 2 } } },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  if (recentTxs.length === 0) {
    return NextResponse.json({
      success: true,
      answer: "You haven't uploaded any transactions yet. Upload a bank statement to get started!",
    });
  }

  const totalExpenses = recentTxs
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIncome = recentTxs
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  // Fix: sort by timestamp, not string
  const dates = recentTxs
    .map((t) => t.date)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const recurringPayments = recurringRaw
    .filter((r) => {
      const first = r._min.date?.getTime() ?? 0;
      const last = r._max.date?.getTime() ?? 0;
      return last - first >= 25 * MS_PER_DAY;
    })
    .map((r) => ({
      merchant: r.merchant,
      amount: r.amount?.toFixed(2),
      occurrences: r._count.id,
      firstSeen: r._min.date?.toISOString().slice(0, 10),
      lastSeen: r._max.date?.toISOString().slice(0, 10),
    }));

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
    recurringPayments,
    recentTransactions: recentTxs.slice(0, 100).map((t) => ({
      date: t.date?.toISOString().slice(0, 10),
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
    })),
  });

  const systemPrompt = `You are a personal finance assistant. Answer the user's question using only their real transaction data below.

Formatting rules — follow these exactly:
- Plain text only. No markdown. No bold, no asterisks, no bullet points, no headers, no dashes.
- Write in short natural sentences, like you are texting a friend.
- 3 to 6 sentences max unless the question genuinely needs more.
- Never use lists. Weave numbers into sentences naturally.
- Always mention the time range the data covers when it is relevant (e.g. "Between January and March").
- Always name specific merchants and dollar amounts from the data, not vague summaries.
- Always format amounts with a dollar sign and commas (e.g. $1,234.56 not 1234.56).
- If the question is about a specific category or time period, filter your answer to that scope.
- Never invent numbers or transactions not in the data.
- If the question is about subscriptions, recurring charges, or repeating payments: use the recurringPayments list — it is pre-computed and authoritative. Only mention entries that are clearly subscription services (streaming, gym, software, insurance, phone plans). Skip merchants that are stores, restaurants, transit, or groceries even if they appear in the list. Name each one with the amount and how many months it has appeared.

Spending data covers ${recentTxs.length} transactions from ${minDate?.toISOString().slice(0, 10)} to ${maxDate?.toISOString().slice(0, 10)}:
${context}

User question: ${question}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
