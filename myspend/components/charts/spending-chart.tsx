"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface MonthlyDataPoint {
  month: string;
  amount: number;
}

export default function SpendingChart({ data }: { data: MonthlyDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00A651" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E4" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v}`}
        />
        <Tooltip
          formatter={(value) => {
            const v = typeof value === "number" ? value : Number(value);
            return [`$${v.toFixed(2)}`, "Spending"] as [string, string];
          }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E2E8E4",
            background: "#fff",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#00A651"
          strokeWidth={2}
          fill="url(#spendGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
