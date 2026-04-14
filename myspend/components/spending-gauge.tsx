const TOTAL_LEN = Math.PI * 88; // semicircle arc length ≈ 276.46

function gaugeColor(pct: number): string {
  if (pct >= 0.9) return "#DC2626";
  if (pct >= 0.7) return "#D97706";
  return "#00A651";
}

export default function SpendingGauge({
  used,
  budget,
}: {
  used: number;
  budget: number;
}) {
  const pct = budget > 0 ? Math.min(used / budget, 1) : 0;
  const fill = pct * TOTAL_LEN;
  const color = gaugeColor(pct);

  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-xs mx-auto">
      {/* Shadow */}
      <path
        d="M 22 108 A 88 88 0 0 1 198 108"
        fill="none"
        stroke="#E9F0EC"
        strokeWidth={18}
        strokeLinecap="round"
      />
      {/* Track */}
      <path
        d="M 22 108 A 88 88 0 0 1 198 108"
        fill="none"
        stroke="#DDE8E1"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d="M 22 108 A 88 88 0 0 1 198 108"
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${TOTAL_LEN}`}
      />
      {/* Center text */}
      <text
        x="110"
        y="88"
        textAnchor="middle"
        fontSize="34"
        fontWeight="bold"
        fill={color}
      >
        {Math.round(pct * 100)}%
      </text>
      <text
        x="110"
        y="104"
        textAnchor="middle"
        fontSize="11"
        fill="#6B7280"
      >
        of budget used
      </text>
      {/* Labels */}
      <text x="22" y="118" textAnchor="middle" fontSize="10" fill="#9CA3AF">
        $0
      </text>
      <text x="198" y="118" textAnchor="end" fontSize="10" fill="#9CA3AF">
        ${budget.toLocaleString()}
      </text>
    </svg>
  );
}
