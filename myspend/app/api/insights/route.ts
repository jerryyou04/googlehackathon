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
- If the question is about subscriptions, recurring charges, or repeating payments: look at the recentTransactions list for the same merchant appearing multiple times with the same amount. Call them out by name (e.g. "You have a Spotify subscription at $13.99/month"). Do not generalize — name every one you find.

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
