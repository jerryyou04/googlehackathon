import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatAmount, formatDate } from "@/lib/categories";
import { AlertTriangle, Phone, Globe, ArrowLeft, ShieldAlert, Clock, MapPin, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FraudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || !tx.flagged) notFound();

  const avgSpend = await prisma.transaction.aggregate({
    where: {
      category: tx.category ?? "Shopping",
      amount: { lt: 0 },
      id: { not: id },
    },
    _avg: { amount: true },
  });

  const typicalAvg = Math.abs(avgSpend._avg.amount ?? 0);
  const thisAmount = Math.abs(tx.amount);
  const multiple = typicalAvg > 0 ? (thisAmount / typicalAvg).toFixed(1) : null;

  const reasons = [
    {
      icon: ShieldAlert,
      title: "Unusually large amount",
      detail: `This transaction of ${formatAmount(tx.amount)} is${multiple ? ` ${multiple}x` : " significantly"} larger than your typical ${tx.category} spend of ${formatAmount(-typicalAvg)}.`,
    },
    {
      icon: Clock,
      title: "Outside your spending pattern",
      detail: "This charge occurred outside your normal purchasing hours and does not match the frequency of your previous transactions at this merchant.",
    },
    {
      icon: MapPin,
      title: "Location anomaly",
      detail: "The transaction origin could not be verified against your recent geographic activity. Large in-store purchases at unexpected locations are a common fraud indicator.",
    },
    {
      icon: CreditCard,
      title: "No prior history at this amount",
      detail: "You have no previous transactions at or near this amount with this merchant. Fraudsters often make one large purchase before the card is blocked.",
    },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/history"
        className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1a3a2a] transition-colors"
      >
        <ArrowLeft size={14} /> Back to History
      </Link>

      {/* Header */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-amber-800">Possible Fraudulent Transaction</h1>
            <p className="text-sm text-amber-700 mt-0.5">
              This transaction has been flagged by TD SmartSpend for review. If you do not recognize this charge, act immediately.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center border border-amber-200">
            <p className="text-xs text-[#6B7280]">Merchant</p>
            <p className="font-bold text-[#1a3a2a] text-sm mt-0.5">{tx.merchant ?? tx.description}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center border border-amber-200">
            <p className="text-xs text-[#6B7280]">Amount</p>
            <p className="font-bold text-red-600 text-sm mt-0.5">{formatAmount(tx.amount)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center border border-amber-200">
            <p className="text-xs text-[#6B7280]">Date</p>
            <p className="font-bold text-[#1a3a2a] text-sm mt-0.5">{formatDate(tx.date?.toISOString() ?? null)}</p>
          </div>
        </div>
      </div>

      {/* Why flagged */}
      <div>
        <h2 className="text-base font-bold text-[#1a3a2a] mb-3">Why was this flagged?</h2>
        <div className="space-y-3">
          {reasons.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="bg-white border border-[#E2E8E4] rounded-2xl p-4 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F0F5F2] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-[#00A651]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a3a2a]">{title}</p>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-[#004d26] rounded-2xl p-5 text-white">
        <h2 className="text-base font-bold mb-1">Next Steps</h2>
        <p className="text-sm text-white/70 mb-4">
          If you do not recognize this transaction, contact TD immediately to dispute the charge and protect your account.
        </p>

        <div className="space-y-3">
          <a
            href="tel:18009838472"
            className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3"
          >
            <Phone size={18} className="text-[#86efac] shrink-0" />
            <div>
              <p className="text-sm font-semibold">TD Fraud Hotline</p>
              <p className="text-xs text-white/60">1-800-983-8472 · Available 24/7</p>
            </div>
          </a>

          <a
            href="tel:18662223456"
            className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3"
          >
            <CreditCard size={18} className="text-[#86efac] shrink-0" />
            <div>
              <p className="text-sm font-semibold">TD Credit Card Support</p>
              <p className="text-xs text-white/60">1-866-222-3456 · To freeze or cancel your card</p>
            </div>
          </a>

          <a
            href="https://www.td.com/ca/en/personal-banking/how-to/fraud-and-security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3"
          >
            <Globe size={18} className="text-[#86efac] shrink-0" />
            <div>
              <p className="text-sm font-semibold">TD Fraud &amp; Security Centre</p>
              <p className="text-xs text-white/60">td.com · Report fraud online and learn how to stay protected</p>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
