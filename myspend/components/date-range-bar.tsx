"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "YTD", value: "ytd" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

export default function DateRangeBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const currentRange = sp.get("range") ?? "all";
  const hasCustom = !sp.get("range") && (sp.get("from") || sp.get("to"));

  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function selectRange(value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("range", value);
    params.delete("from");
    params.delete("to");
    router.push("?" + params.toString());
    setShowCustom(false);
  }

  function applyCustom() {
    const params = new URLSearchParams(sp.toString());
    params.delete("range");
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    router.push("?" + params.toString());
    setShowCustom(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => selectRange(p.value)}
            className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              currentRange === p.value && !hasCustom
                ? "bg-[#00A651] text-white"
                : "bg-white text-[#4a6a5a] border border-[#DDE8E1] hover:border-[#00A651]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            hasCustom
              ? "bg-[#00A651] text-white"
              : "bg-white text-[#4a6a5a] border border-[#DDE8E1] hover:border-[#00A651]"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-[#DDE8E1] rounded-xl p-3">
          <div className="flex items-center gap-1">
            <label className="text-xs text-[#6B7280]">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-[#DDE8E1] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-[#6B7280]">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-[#DDE8E1] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            />
          </div>
          <button
            onClick={applyCustom}
            className="px-3 py-1 rounded-full text-sm font-medium bg-[#00A651] text-white hover:bg-[#007A3E]"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
