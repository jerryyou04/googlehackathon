"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { CATEGORIES, CATEGORY_COLORS, formatAmount, formatDate } from "@/lib/categories";

export interface SerializedTransaction {
  id: string;
  merchant: string | null;
  description: string;
  amount: number;
  category: string | null;
  date: string | null;
  documentId: string | null;
  document: { fileName: string } | null;
}

interface EditForm {
  merchant: string;
  amount: string;
  category: string;
  date: string;
}

interface CreateForm {
  merchant: string;
  amount: string;
  category: string;
  date: string;
}

export default function TransactionList({
  transactions,
  total,
}: {
  transactions: SerializedTransaction[];
  total: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    merchant: "",
    amount: "",
    category: "",
    date: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    merchant: "",
    amount: "",
    category: "Other",
    date: new Date().toISOString().slice(0, 10),
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(tx: SerializedTransaction) {
    setEditingId(tx.id);
    setEditForm({
      merchant: tx.merchant ?? tx.description,
      amount: String(tx.amount),
      category: tx.category ?? "Other",
      date: tx.date ? tx.date.slice(0, 10) : "",
    });
  }

  async function saveEdit(id: string) {
    const amount = parseFloat(editForm.amount);
    if (!editForm.merchant.trim() || isNaN(amount)) return;
    setSaving(true);
    try {
      await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: editForm.merchant,
          amount,
          category: editForm.category,
          date: editForm.date || undefined,
        }),
      });
      setEditingId(null);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  async function createTransaction() {
    const amount = parseFloat(createForm.amount);
    if (!createForm.merchant.trim() || isNaN(amount)) return;
    setSaving(true);
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: createForm.merchant,
          amount,
          category: createForm.category,
          date: createForm.date,
        }),
      });
      setShowCreate(false);
      setCreateForm({
        merchant: "",
        amount: "",
        category: "Other",
        date: new Date().toISOString().slice(0, 10),
      });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#6B7280]">{total} transactions</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#00A651] text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#007A3E] transition-colors"
        >
          <Plus size={14} /> Add Transaction
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-3 bg-white border border-[#00A651] rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-[#1a3a2a]">New Transaction</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Merchant"
              value={createForm.merchant}
              onChange={(e) => setCreateForm((f) => ({ ...f, merchant: e.target.value }))}
              className="col-span-2 border border-[#DDE8E1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount (- for expense)"
              value={createForm.amount}
              onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
              className="border border-[#DDE8E1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            />
            <input
              type="date"
              value={createForm.date}
              onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))}
              className="border border-[#DDE8E1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            />
            <select
              value={createForm.category}
              onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
              className="col-span-2 border border-[#DDE8E1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createTransaction}
              disabled={saving}
              className="flex items-center gap-1 bg-[#00A651] text-white text-sm px-4 py-1.5 rounded-lg hover:bg-[#007A3E] disabled:opacity-50"
            >
              <Check size={14} /> Save
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="flex items-center gap-1 text-sm text-[#6B7280] border border-[#DDE8E1] px-3 py-1.5 rounded-lg hover:bg-[#F0F5F2]"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-2">
        {transactions.length === 0 && (
          <p className="text-center text-[#6B7280] text-sm py-12">No transactions found.</p>
        )}
        {transactions.map((tx) => {
          const isEditing = editingId === tx.id;
          const isDeleting = deletingId === tx.id;
          const color = CATEGORY_COLORS[tx.category ?? "Other"] ?? CATEGORY_COLORS.Other;
          const displayName = tx.merchant ?? tx.description;

          if (isEditing) {
            return (
              <div
                key={tx.id}
                className="bg-white border border-[#00A651] rounded-2xl p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editForm.merchant}
                    onChange={(e) => setEditForm((f) => ({ ...f, merchant: e.target.value }))}
                    className="col-span-2 border border-[#DDE8E1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className="border border-[#DDE8E1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
                  />
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="border border-[#DDE8E1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
                  />
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="col-span-2 border border-[#DDE8E1] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(tx.id)}
                    disabled={saving}
                    className="flex items-center gap-1 bg-[#00A651] text-white text-xs px-3 py-1.5 rounded-lg hover:bg-[#007A3E] disabled:opacity-50"
                  >
                    <Check size={12} /> Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 text-xs text-[#6B7280] border border-[#DDE8E1] px-3 py-1.5 rounded-lg hover:bg-[#F0F5F2]"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={tx.id}
              className={`bg-white border border-[#E2E8E4] rounded-2xl px-4 py-3 flex items-center gap-3 transition-opacity ${
                isDeleting ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: color }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1a3a2a] text-sm truncate">{displayName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: color }}
                  >
                    {tx.category ?? "Other"}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF]">
                    {formatDate(tx.date)}
                  </span>
                  {tx.document && (
                    <span className="text-[11px] text-[#9CA3AF] truncate">
                      · {tx.document.fileName}
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <p
                className={`font-semibold text-sm shrink-0 ${
                  tx.amount >= 0 ? "text-[#00A651]" : "text-[#DC2626]"
                }`}
              >
                {formatAmount(tx.amount)}
              </p>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(tx)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#1a3a2a] hover:bg-[#F0F5F2] transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteTransaction(tx.id)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
