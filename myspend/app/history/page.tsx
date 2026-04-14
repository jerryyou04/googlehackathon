import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getDateRange, buildPrismaDateFilter } from "@/lib/date-utils";
import DateRangeBar from "@/components/date-range-bar";
import FilterBar from "./filter-bar";
import TransactionList from "./transaction-list";
import type { SerializedTransaction } from "./transaction-list";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = typeof sp.range === "string" ? sp.range : "all";
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const search = typeof sp.search === "string" ? sp.search : undefined;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const sort = sp.sort === "asc" ? "asc" : "desc";

  const dr = getDateRange(range, from, to);
  const dateFilter = buildPrismaDateFilter(dr);
  const dateWhere = dateFilter ? { date: dateFilter } : {};

  const where = {
    ...dateWhere,
    ...(search
      ? {
          OR: [
            { merchant: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: sort },
      include: { document: { select: { fileName: true } } },
    }),
    prisma.transaction.count({ where }),
  ]).catch(() => [[], 0] as const);

  const serialized: SerializedTransaction[] = transactions.map((tx) => ({
    id: tx.id,
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    category: tx.category,
    date: tx.date?.toISOString() ?? null,
    documentId: tx.documentId,
    document: tx.document,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1a3a2a] mb-4">Transaction History</h1>

      <div className="sticky top-14 z-30 bg-[#F0F5F2] pb-3 space-y-2">
        <Suspense>
          <DateRangeBar />
          <FilterBar />
        </Suspense>
      </div>

      <TransactionList transactions={serialized} total={total} />
    </main>
  );
}
