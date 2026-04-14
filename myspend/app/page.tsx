import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDateRange, buildPrismaDateFilter } from "@/lib/date-utils";
import {
  CATEGORY_COLORS,
  formatAmount,
  formatDate,
  formatNum,
} from "@/lib/categories";
import SpendingGauge from "@/components/spending-gauge";
import DateRangeBar from "@/components/date-range-bar";
import { History, BarChart3, FolderOpen, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/history", label: "History", icon: History },
  { href: "/categories", label: "Categories", icon: BarChart3 },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

export default async function DashboardPage({
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

  const [expAgg, incAgg, categoryGroups, recentTxs, totalTxCount] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { ...dateWhere, amount: { lt: 0 } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.aggregate({
        where: { ...dateWhere, amount: { gt: 0 } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { ...dateWhere, amount: { lt: 0 } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "asc" } },
        take: 5,
      }),
      prisma.transaction.findMany({
        where: dateWhere,
        orderBy: { date: "desc" },
        take: 6,
      }),
      prisma.transaction.count({ where: dateWhere }),
    ]).catch(() => [
      { _sum: { amount: null }, _count: { id: 0 } },
      { _sum: { amount: null }, _count: { id: 0 } },
      [],
      [],
      0,
    ] as const);

  const totalExpenses = Math.abs(expAgg._sum.amount ?? 0);
  const totalIncome = incAgg._sum.amount ?? 0;
  const net = totalIncome - totalExpenses;

  // Budget
  let periodBudget: number | null = null;
  let budgetLabel: string | null = null;
  if (dr.start && dr.end) {
    const days = Math.round(
      (dr.end.getTime() - dr.start.getTime()) / 86_400_000
    );
    periodBudget = Math.round((5000 * days) / 30);

    if (from || to) {
      budgetLabel = `${days}-day budget`;
    } else {
      switch (range) {
        case "7d":
          budgetLabel = "7-day budget";
          break;
        case "30d":
          budgetLabel = "30-day budget";
          break;
        case "90d":
          budgetLabel = "90-day budget";
          break;
        case "ytd":
          budgetLabel = "year-to-date budget";
          break;
        case "1y":
          budgetLabel = "annual budget";
          break;
      }
    }
  }
  const budgetPct = periodBudget
    ? Math.min((totalExpenses / periodBudget) * 100, 100)
    : 0;

  const rangeLabel = range === "all" ? "All time" : range.toUpperCase();

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-[#004d26] to-[#007A3E] rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm mb-1">Net Balance</p>
            <p className="text-4xl font-bold">
              {net >= 0 ? "+" : ""}
              {net.toLocaleString("en-CA", {
                style: "currency",
                currency: "CAD",
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {rangeLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-2xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Income</p>
            <p className="font-semibold text-lg">+${formatNum(totalIncome)}</p>
            <p className="text-white/50 text-xs">
              {incAgg._count.id} transactions
            </p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3">
            <p className="text-white/60 text-xs mb-0.5">Expenses</p>
            <p className="font-semibold text-lg">-${formatNum(totalExpenses)}</p>
            <p className="text-white/50 text-xs">
              {expAgg._count.id} transactions
            </p>
          </div>
        </div>
      </div>

      {/* Date range bar */}
      <Suspense>
        <DateRangeBar />
      </Suspense>

      {/* Budget gauge */}
      {periodBudget !== null && (
        <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1a3a2a] text-sm">
              Budget Health
            </h2>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                budgetPct >= 90
                  ? "bg-red-100 text-red-700"
                  : budgetPct >= 70
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {budgetPct >= 90
                ? "Over budget"
                : budgetPct >= 70
                ? "Caution"
                : "On track"}
            </span>
          </div>
          <SpendingGauge used={totalExpenses} budget={periodBudget} />
          <p className="text-xs text-center text-[#9CA3AF] mt-1">
            ${formatNum(totalExpenses)} of ${formatNum(periodBudget)}{" "}
            {budgetLabel}
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 bg-white border border-[#E2E8E4] rounded-2xl py-3 hover:border-[#00A651] hover:bg-[#F0FFF4] transition-colors"
          >
            <Icon size={18} className="text-[#00A651]" />
            <span className="text-xs font-medium text-[#1a3a2a]">{label}</span>
          </Link>
        ))}
      </div>

      {/* Spending by category */}
      {categoryGroups.length > 0 && (
        <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
          <h2 className="font-semibold text-[#1a3a2a] text-sm mb-3">
            Spending by Category
          </h2>
          <div className="space-y-3">
            {categoryGroups.map((g) => {
              const cat = g.category ?? "Other";
              const total = Math.abs(g._sum.amount ?? 0);
              const pct =
                totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
              const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: color }}
                      >
                        {cat}
                      </span>
                      <span className="text-xs text-[#9CA3AF]">
                        {g._count.id} transactions
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-[#1a3a2a]">
                      {formatAmount(total)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F0F5F2] rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#1a3a2a] text-sm">
            Recent Transactions
          </h2>
          {totalTxCount > 6 && (
            <Link
              href="/history"
              className="text-xs text-[#00A651] hover:underline"
            >
              View all {totalTxCount} →
            </Link>
          )}
        </div>

        {recentTxs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#6B7280] text-sm mb-2">No transactions yet.</p>
            <Link
              href="/upload"
              className="text-[#00A651] font-medium hover:underline text-sm"
            >
              Upload a statement →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTxs.map((tx) => {
              const color =
                CATEGORY_COLORS[tx.category ?? "Other"] ??
                CATEGORY_COLORS.Other;
              return (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {(tx.merchant ?? tx.description).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a3a2a] truncate">
                      {tx.merchant ?? tx.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: color }}
                      >
                        {tx.category ?? "Other"}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {formatDate(tx.date)}
                      </span>
                    </div>
                  </div>
                  <p
                    className={`font-semibold text-sm shrink-0 ${
                      tx.amount >= 0 ? "text-[#00A651]" : "text-[#DC2626]"
                    }`}
                  >
                    {formatAmount(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
