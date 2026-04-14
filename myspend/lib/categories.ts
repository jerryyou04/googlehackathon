export const CATEGORIES = [
  "Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Entertainment",
  "Fitness",
  "Bills",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  Dining: "#F97316",
  Groceries: "#22C55E",
  Transport: "#3B82F6",
  Shopping: "#A855F7",
  Entertainment: "#EC4899",
  Fitness: "#14B8A6",
  Bills: "#EAB308",
  Income: "#00A651",
  Other: "#6B7280",
};

export function getCategoryColors(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
}

export function formatNum(n: number): string {
  return Math.abs(n).toLocaleString("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatAmount(n: number): string {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
