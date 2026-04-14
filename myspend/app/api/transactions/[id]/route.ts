import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

const VALID_CATEGORIES = new Set<string>(CATEGORIES);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const data: Record<string, unknown> = {};
  if (body.merchant !== undefined) {
    data.merchant = body.merchant.trim();
    data.description = body.merchant.trim();
  }
  if (body.amount !== undefined) data.amount = Number(body.amount);
  if (body.category !== undefined) {
    data.category = VALID_CATEGORIES.has(body.category) ? body.category : "Other";
  }
  if (body.date !== undefined) data.date = new Date(body.date);

  try {
    const tx = await prisma.transaction.update({ where: { id }, data });
    return NextResponse.json({ success: true, transaction: tx });
  } catch {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 }
    );
  }
}
