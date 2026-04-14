import { prisma } from "@/lib/prisma";
import {
  CATEGORY_COLORS,
  formatAmount,
  formatDate,
  formatNum,
} from "@/lib/categories";
import InsightsChat from "./insights-chat";
import SpendingChartSection from "./spending-chart-section";
import SpendingGauge from "@/components/spending-gauge";
import type { MonthlyDataPoint } from "@/components/charts/spending-chart";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#00A651]">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold text-[#1a3a2a]">{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function InsightsPage() {
  const [allTxs, categoryBreakdown, topMerchants] = await Promise.all([
    prisma.transaction.findMany({ orderBy: { date: "asc" } }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "asc" } },
    }),
    prisma.transaction.groupBy({
      by: ["merchant"],
      where: { amount: { lt: 0 }, merchant: { not: null } },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]).catch(() => [[], [], []] as const);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthTxs = allTxs.filter(
    (t) => t.date && t.date >= thisMonthStart && t.amount < 0
  );
  const thisMonthTotal = thisMonthTxs.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  const expenses = allTxs.filter((t) => t.amount < 0);
  const avgExpense =
    expenses.length > 0
      ? expenses.reduce((s, t) => s + Math.abs(t.amount), 0) / expenses.length
      : 0;
  const largestExpense = expenses.reduce(
    (max, t) => (Math.abs(t.amount) > max ? Math.abs(t.amount) : max),
    0
  );
  const totalIncome = allTxs
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const recurringMerchants = topMerchants.filter(
    (m) => (m._count?.id ?? 0) >= 2
  ).length;
  const topCategory =
    categoryBreakdown[0]?.category ?? "—";

  // Monthly chart data
  const monthlyMap: Record<string, number> = {};
  for (const tx of allTxs.filter((t) => t.amount < 0 && t.date)) {
    const key = tx.date!.toLocaleDateString("en-CA", {
      month: "short",
      year: "2-digit",
    });
    monthlyMap[key] = (monthlyMap[key] ?? 0) + Math.abs(tx.amount);
  }
  const spendingData: MonthlyDataPoint[] = Object.entries(monthlyMap).map(
    ([month, amount]) => ({ month, amount: parseFloat(amount.toFixed(2)) })
  );

  const totalExpenses = categoryBreakdown.reduce(
    (s, c) => s + Math.abs(c._sum.amount ?? 0),
    0
  );

  const recentExpenses = [...allTxs]
    .filter((t) => t.amount < 0)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, 5);

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a2a]">Insights</h1>
        <p className="text-sm text-[#6B7280]">AI-powered spending analysis</p>
      </div>

      {/* AI Chat */}
      <InsightsChat />

      {allTxs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#6B7280] text-sm mb-3">
            Upload transactions to see your spending insights.
          </p>
          <Link href="/upload" className="text-[#00A651] font-medium hover:underline text-sm">
            Upload a statement →
          </Link>
        </div>
      )}

      {allTxs.length > 0 && (
        <>
          {/* Budget gauge — this month vs $5,000 */}
          <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-[#1a3a2a] text-sm">
                This Month&apos;s Budget
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  thisMonthTotal >= 4500
                    ? "bg-red-100 text-red-700"
                    : thisMonthTotal >= 3500
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {thisMonthTotal >= 4500
                  ? "Over budget"
                  : thisMonthTotal >= 3500
                  ? "Caution"
                  : "On track"}
              </span>
            </div>
            <SpendingGauge used={thisMonthTotal} budget={5000} />
            <p className="text-xs text-center text-[#9CA3AF] mt-1">
              ${formatNum(thisMonthTotal)} of $5,000 monthly budget
            </p>
          </div>

          {/* Spending over time */}
          {spendingData.length > 1 && (
            <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
              <h2 className="font-semibold text-[#1a3a2a] text-sm mb-3">
                Spending Over Time
              </h2>
              <SpendingChartSection data={spendingData} />
            </div>
          )}

          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="📅"
              label="This Month"
              value={`$${formatNum(thisMonthTotal)}`}
              sub={`${thisMonthTxs.length} transactions`}
            />
            <StatCard
              icon="📊"
              label="Avg Expense"
              value={`$${formatNum(avgExpense)}`}
              sub="per transaction"
            />
            <StatCard
              icon="💸"
              label="Largest Expense"
              value={`$${formatNum(largestExpense)}`}
            />
            <StatCard
              icon="💰"
              label="Total Income"
              value={`+$${formatNum(totalIncome)}`}
            />
            <StatCard
              icon="🔁"
              label="Recurring"
              value={`${recurringMerchants}`}
              sub="merchants"
            />
            <StatCard
              icon="🏆"
              label="Top Category"
              value={topCategory}
            />
          </div>

          {/* Top merchants */}
          <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
            <h2 className="font-semibold text-[#1a3a2a] text-sm mb-3">
              Most Visited Merchants
            </h2>
            <div className="space-y-2">
              {topMerchants.map((m, i) => (
                <div key={m.merchant} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#9CA3AF] w-4">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1a3a2a] truncate">
                      {m.merchant}
                    </p>
                  </div>
                  <span className="text-xs text-[#6B7280]">
                    {m._count?.id ?? 0}×
                  </span>
                  <span className="text-sm font-medium text-[#DC2626] shrink-0">
                    {formatAmount(Math.abs(m._sum.amount ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
            <h2 className="font-semibold text-[#1a3a2a] text-sm mb-3">
              Category Breakdown
            </h2>
            <div className="space-y-3">
              {categoryBreakdown.map((c) => {
                const cat = c.category ?? "Other";
                const total = Math.abs(c._sum.amount ?? 0);
                const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
                const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#1a3a2a]">{cat}</span>
                      <span className="text-sm font-medium text-[#1a3a2a]">
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

          {/* Recent expenses */}
          <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
            <h2 className="font-semibold text-[#1a3a2a] text-sm mb-3">
              Recent Expenses
            </h2>
            <div className="space-y-2">
              {recentExpenses.map((tx) => {
                const color =
                  CATEGORY_COLORS[tx.category ?? "Other"] ??
                  CATEGORY_COLORS.Other;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {(tx.merchant ?? tx.description)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1a3a2a] truncate">
                        {tx.merchant ?? tx.description}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {formatDate(tx.date)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-[#DC2626] shrink-0">
                      {formatAmount(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
