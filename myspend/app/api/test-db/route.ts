import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [documentCount, transactionCount] = await Promise.all([
    prisma.document.count(),
    prisma.transaction.count(),
  ]);
  return NextResponse.json({ ok: true, documentCount, transactionCount });
}
