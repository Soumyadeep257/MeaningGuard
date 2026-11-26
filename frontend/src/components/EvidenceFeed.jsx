import { useState } from "react";
import { getAlertStatusMeta } from "../utils/alertStatus";

export default function EvidenceFeed({
  alerts = [],
  impacts = [],
  selectedIndex,
  onSelectIndex,
}) {
  const [filter, setFilter] = useState("all");

  const filtered = alerts
    .map((alert, idx) => ({ alert, idx, meta: getAlertStatusMeta(alert) }))
    .filter((entry) => filter === "all" || entry.meta.category === filter);

  return (
    <div className="space-y-4">
      {/* Ranked Evidence Feed */}
      <div className="rounded-[4px] border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Ranked Evidence Feed
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Select a finding to inspect forensic evidence &amp; diffs
            </p>
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: "all", label: "All" },
              { id: "confirmed", label: "Confirmed" },
              { id: "suspected", label: "Suspected" },
              { id: "uncertain", label: "Uncertain" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-[4px] border px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                  filter === tab.id
                    ? "border-[#0F172A] bg-[#0F172A] text-white"
                    : "border-[#E2E8F0] bg-[#F8F9FA] text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="p-5">
            <span className="inline-block rounded-[4px] border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#059669]">
              VERIFIED — NO REGRESSIONS
            </span>
            <p className="mt-2 text-xs text-[#475569] leading-relaxed">
              Structural schema, unit scale, entity granularity, and deterministic
              rules passed without semantic regressions.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5 text-xs text-[#64748B]">
            No alerts match the &ldquo;{filter}&rdquo; filter.
          </div>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {filtered.map(({ alert, idx, meta }) => {
              const isSelected = idx === selectedIndex;
              const cols = (alert.columns || []).join(", ") || "N/A";
              const linked = alert.linked_kpis || [];

              return (
                <li key={`${alert.type}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => onSelectIndex(idx)}
                    className={`w-full text-left px-4 py-3.5 transition cursor-pointer border-l-[3px] ${
                      isSelected
                        ? "border-l-[#0F172A] bg-[#F8F9FA]"
                        : "border-l-transparent bg-white hover:bg-[#F8F9FA]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-block rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${meta.badgeClass}`}
                      >
                        {meta.pill}
                      </span>
                      <span className="font-mono text-[11px] font-semibold uppercase text-[#64748B]">
                        {alert.severity || "Info"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                      {alert.type}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-[#64748B]">
                        Cols:{" "}
                        <code className="font-mono text-[#0F172A]">{cols}</code>
                      </span>
                    </div>

                    {linked.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {linked.map((kpiStr, kIdx) => (
                          <span
                            key={kIdx}
                            className="rounded-[4px] border border-[#E2E8F0] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#0F172A] tabular-nums"
                          >
                            {kpiStr}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Compact Downstream KPI Ledger */}
      <div className="rounded-[4px] border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            Downstream KPI Ledger
          </h3>
        </div>
        {impacts.length === 0 ? (
          <p className="p-4 text-xs text-[#64748B]">
            No matching KPI columns found.
          </p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] font-mono text-[10px] uppercase text-[#64748B]">
                <th className="py-2 px-3 font-semibold">Metric</th>
                <th className="py-2 px-3 font-semibold text-right">Baseline</th>
                <th className="py-2 px-3 font-semibold text-right">Candidate</th>
                <th className="py-2 px-3 font-semibold text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs tabular-nums">
              {impacts.map((item, i) => {
                const pct = item.pct_change ?? 0;
                const absPct = Math.abs(pct);
                const deltaClass =
                  absPct >= 50
                    ? "text-[#DC2626] font-semibold"
                    : absPct >= 15
                    ? "text-[#D97706] font-semibold"
                    : "text-[#059669]";

                return (
                  <tr key={`${item.kpi}-${i}`}>
                    <td className="py-2 px-3 font-sans text-xs font-medium text-[#0F172A]">
                      {item.kpi}
                    </td>
                    <td className="py-2 px-3 text-right text-[#475569]">
                      {item.baseline_value?.toLocaleString() ?? "N/A"}
                    </td>
                    <td className="py-2 px-3 text-right text-[#0F172A] font-medium">
                      {item.candidate_value?.toLocaleString() ?? "N/A"}
                    </td>
                    <td className={`py-2 px-3 text-right ${deltaClass}`}>
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
