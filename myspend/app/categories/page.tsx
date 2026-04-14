import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDateRange, buildPrismaDateFilter } from "@/lib/date-utils";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  formatAmount,
  formatDate,
} from "@/lib/categories";
import DateRangeBar from "@/components/date-range-bar";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const range = typeof sp.range === "string" ? sp.range : "all";
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;

  const dr = getDateRange(range, from, to);
  const dateFilter = buildPrismaDateFilter(dr);
  const dateWhere = dateFilter ? { date: dateFilter } : {};

  const [categoryGroups, allTotals] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: dateWhere,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: { ...dateWhere, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ]).catch(() => [[], { _sum: { amount: null } }] as const);

  const totalExpenses = Math.abs(allTotals._sum.amount ?? 0);

  // Fetch 3 recent per category
  const recentByCategory = await Promise.all(
    categoryGroups.map(async (g) => {
      const txs = await prisma.transaction.findMany({
        where: { category: g.category, ...dateWhere },
        orderBy: { date: "desc" },
        take: 3,
      }).catch(() => []);
      return { category: g.category, txs };
    })
  );
  const recentMap = Object.fromEntries(
    recentByCategory.map(({ category, txs }) => [category ?? "Other", txs])
  );

  const expenseCategories = categoryGroups
    .filter((g) => (g._sum.amount ?? 0) < 0)
    .sort((a, b) => (a._sum.amount ?? 0) - (b._sum.amount ?? 0));

  const incomeCategories = categoryGroups.filter(
    (g) => (g._sum.amount ?? 0) >= 0
  );

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1a3a2a] mb-4">Categories</h1>

      <div className="mb-4">
        <Suspense>
          <DateRangeBar />
        </Suspense>
      </div>

      {/* Expenses */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">
          Expenses
        </h2>
        {expenseCategories.length === 0 && (
          <p className="text-[#6B7280] text-sm">No expense transactions in this period.</p>
        )}
        <div className="space-y-4">
          {expenseCategories.map((g) => {
            const cat = g.category ?? "Other";
            const total = Math.abs(g._sum.amount ?? 0);
            const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
            const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
            const recent = recentMap[cat] ?? [];

            return (
              <div
                key={cat}
                className="bg-white border border-[#E2E8E4] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: color }}
                    >
                      {cat}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                      {g._count.id} transactions
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-[#1a3a2a]">
                      {formatAmount(total)}
                    </p>
                    <Link
                      href={`/history?category=${cat}`}
                      className="text-xs text-[#00A651] hover:underline"
                    >
                      See all →
                    </Link>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-[#F0F5F2] rounded-full mb-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>

                {/* Recent transactions */}
                <div className="space-y-1.5">
                  {recent.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {(tx.merchant ?? tx.description).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[#1a3a2a] truncate">
                          {tx.merchant ?? tx.description}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF] shrink-0">
                          {formatDate(tx.date)}
                        </span>
                      </div>
                      <span
                        className={`font-medium shrink-0 ${
                          tx.amount >= 0 ? "text-[#00A651]" : "text-[#DC2626]"
                        }`}
                      >
                        {formatAmount(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Income */}
      {incomeCategories.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">
            Income
          </h2>
          <div className="space-y-4">
            {incomeCategories.map((g) => {
              const cat = g.category ?? "Other";
              const total = g._sum.amount ?? 0;
              const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
              const recent = recentMap[cat] ?? [];

              return (
                <div
                  key={cat}
                  className="bg-white border border-[#E2E8E4] rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold text-white px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: color }}
                      >
                        {cat}
                      </span>
                      <span className="text-xs text-[#9CA3AF]">
                        {g._count.id} transactions
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-[#00A651]">
                        +{formatAmount(total)}
                      </p>
                      <Link
                        href={`/history?category=${cat}`}
                        className="text-xs text-[#00A651] hover:underline"
                      >
                        See all →
                      </Link>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {recent.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-[#1a3a2a] truncate">
                          {tx.merchant ?? tx.description}
                        </span>
                        <span className="text-[#00A651] font-medium shrink-0">
                          +{formatAmount(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {categoryGroups.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#6B7280] text-sm mb-3">No transactions yet.</p>
          <Link
            href="/upload"
            className="text-[#00A651] font-medium hover:underline text-sm"
          >
            Upload a statement →
          </Link>
        </div>
      )}
    </main>
  );
}
