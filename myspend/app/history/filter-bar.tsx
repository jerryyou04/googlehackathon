"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { Search, X, ArrowUpDown } from "lucide-react";

export default function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [search, setSearch] = useState(sp.get("search") ?? "");

  const category = sp.get("category") ?? "";
  const sort = sp.get("sort") ?? "desc";
  const hasFilters = !!(sp.get("search") || category || sp.get("range") || sp.get("from") || sp.get("to"));

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push("/history?" + params.toString());
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    push({ search: search || null });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <form onSubmit={submitSearch} className="flex items-center gap-1 bg-white border border-[#DDE8E1] rounded-xl px-3 h-9 flex-1 min-w-[160px]">
          <Search size={14} className="text-[#9CA3AF] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-[#1a3a2a] placeholder:text-[#9CA3AF]"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); push({ search: null }); }}
              className="text-[#9CA3AF] hover:text-[#1a3a2a]"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => push({ category: e.target.value || null })}
          className="bg-white border border-[#DDE8E1] rounded-xl px-3 h-9 text-sm text-[#1a3a2a] focus:outline-none focus:ring-1 focus:ring-[#00A651]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Sort toggle */}
        <button
          onClick={() => push({ sort: sort === "desc" ? "asc" : "desc" })}
          className="flex items-center gap-1.5 bg-white border border-[#DDE8E1] rounded-xl px-3 h-9 text-sm text-[#1a3a2a] hover:border-[#00A651] transition-colors"
        >
          <ArrowUpDown size={14} className="text-[#9CA3AF]" />
          {sort === "desc" ? "Newest" : "Oldest"}
        </button>

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); router.push("/history"); }}
            className="flex items-center gap-1 text-sm text-[#DC2626] hover:underline"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
