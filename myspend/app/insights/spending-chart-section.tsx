"use client";

import dynamic from "next/dynamic";
import type { MonthlyDataPoint } from "@/components/charts/spending-chart";

const SpendingChart = dynamic(
  () => import("@/components/charts/spending-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[150px] animate-pulse bg-[#F0F5F2] rounded-xl" />
    ),
  }
);

export default function SpendingChartSection({
  data,
}: {
  data: MonthlyDataPoint[];
}) {
  return <SpendingChart data={data} />;
}
