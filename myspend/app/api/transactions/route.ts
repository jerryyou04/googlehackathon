import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

const VALID_CATEGORIES = new Set<string>(CATEGORIES);

export async function POST(req: NextRequest) {
  let body: {
    merchant?: string;
    amount?: number;
    category?: string;
    date?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const merchant = body.merchant?.trim();
  if (!merchant) {
    return NextResponse.json(
      { success: false, error: "merchant is required" },
      { status: 400 }
    );
  }

  if (body.amount === undefined || isNaN(Number(body.amount))) {
    return NextResponse.json(
      { success: false, error: "amount is required and must be a number" },
      { status: 400 }
    );
  }

  const category =
    body.category && VALID_CATEGORIES.has(body.category)
      ? body.category
      : "Other";

  const date = body.date ? new Date(body.date) : new Date();

  const tx = await prisma.transaction.create({
    data: {
      merchant,
      description: merchant,
      amount: Number(body.amount),
      category,
      date,
    },
  });

  return NextResponse.json({ success: true, transaction: tx });
}
