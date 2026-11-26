export default function ConsistencyStrip({ report }) {
  const schema = report.schema_summary || {};
  const rowCounts = report.row_counts || {};
  const alerts = report.alerts || [];
  const stats = report.summary_stats || [];
  const impacts = report.downstream_impact || [];

  const schemaPassed = schema.schema_preserved ?? true;

  // Statistical layer: count columns whose median shifted by > 5%
  const shiftedCols = stats.filter((s) => {
    if (!s.baseline_median || s.candidate_median == null) return false;
    return Math.abs(s.candidate_median - s.baseline_median) / Math.abs(s.baseline_median) > 0.05;
  });
  const statsShifted = shiftedCols.length > 0;

  // Semantic & Relational layer
  const confirmedCount = alerts.filter((a) =>
    (a.confidence || "").toLowerCase().includes("confirmed")
  ).length;
  const suspectedCount = alerts.filter((a) =>
    (a.confidence || "").toLowerCase().includes("suspected")
  ).length;
  const uncertainCount = alerts.length - confirmedCount - suspectedCount;

  // Decision Impact layer
  const maxImpact = impacts.reduce(
    (max, item) => Math.max(max, Math.abs(item.pct_change ?? 0)),
    0
  );
  const impactLevel =
    maxImpact >= 50
      ? "Critical"
      : maxImpact >= 15
      ? "High"
      : maxImpact >= 5
      ? "Moderate"
      : "Low";

  const impactTone =
    maxImpact >= 50
      ? "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
      : maxImpact >= 15
      ? "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]"
      : "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]";

  return (
    <section className="rounded-[4px] border border-[#E2E8F0] bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8F0]">
        {/* Layer 1: Structural */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              1. Structural
            </span>
            <span
              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                schemaPassed
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]"
                  : "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
              }`}
            >
              {schemaPassed ? "Passed" : "Failed"}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-[#0F172A] tabular-nums">
            {schema.baseline_columns ?? "—"} cols •{" "}
            {rowCounts.baseline?.toLocaleString() ?? "—"} →{" "}
            {rowCounts.candidate?.toLocaleString() ?? "—"} rows
          </p>
        </div>

        {/* Layer 2: Statistical */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              2. Statistical
            </span>
            <span
              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                statsShifted
                  ? "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]"
                  : "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]"
              }`}
            >
              {statsShifted ? "Shifted" : "Stable"}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-[#0F172A] tabular-nums">
            {shiftedCols.length} / {stats.length} numeric cols &gt;5% median Δ
          </p>
        </div>

        {/* Layer 3: Semantic & Relational */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              3. Semantic &amp; Relational
            </span>
            <span
              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                confirmedCount > 0
                  ? "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
                  : alerts.length > 0
                  ? "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]"
                  : "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]"
              }`}
            >
              {alerts.length} {alerts.length === 1 ? "Alert" : "Alerts"}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-[#0F172A] tabular-nums">
            {alerts.length === 0
              ? "All checks verified"
              : `${confirmedCount} confirmed • ${suspectedCount} suspected • ${uncertainCount} uncertain`}
          </p>
        </div>

        {/* Layer 4: Decision Impact */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              4. Decision Impact
            </span>
            <span
              className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${impactTone}`}
            >
              {impactLevel}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-[#0F172A] tabular-nums">
            Max KPI delta: {maxImpact.toFixed(1)}% ({impacts.length} tracked)
          </p>
        </div>
      </div>
    </section>
  );
}
