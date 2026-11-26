import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { getAlertStatusMeta } from "../utils/alertStatus";

export default function EvidenceInspector({ report, selectedAlert }) {
  const [chartMetric, setChartMetric] = useState("median");

  const schema = report.schema_summary || {};
  const rowCounts = report.row_counts || {};
  const stats = report.summary_stats || [];

  const meta = selectedAlert ? getAlertStatusMeta(selectedAlert) : null;
  const affectedCols = new Set(selectedAlert?.columns || []);

  // Filter stats to affected columns when available, otherwise show all numeric columns
  const relevantStats =
    affectedCols.size > 0 && stats.some((s) => affectedCols.has(s.column))
      ? stats.filter((s) => affectedCols.has(s.column))
      : stats;

  const baseKey = chartMetric === "median" ? "baseline_median" : "baseline_mean";
  const candKey = chartMetric === "median" ? "candidate_median" : "candidate_mean";
  const candidateBarColor = meta?.accentColor || "#059669";

  return (
    <div className="space-y-4">
      {/* Forensic Explanation & Caveat Panel */}
      <div className="rounded-[4px] border border-[#E2E8F0] bg-white p-5">
        {selectedAlert ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-[4px] border px-2 py-0.5 font-mono text-[11px] font-semibold ${meta.badgeClass}`}
                >
                  {meta.pill}
                </span>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {selectedAlert.type}
                </h2>
              </div>
              <span className="font-mono text-xs text-[#475569]">
                Severity:{" "}
                <strong className="text-[#0F172A]">{selectedAlert.severity}</strong>
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Supporting Evidence
                </p>
                <p className="mt-1 text-sm text-[#0F172A] leading-relaxed">
                  {selectedAlert.evidence || "No supporting evidence recorded."}
                </p>
              </div>

              <div className="flex items-start gap-2.5 rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] p-3">
                <Info className="h-4 w-4 text-[#475569] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                    Limitations &amp; Caveats
                  </p>
                  <p className="mt-0.5 text-xs text-[#475569] leading-relaxed">
                    {selectedAlert.limitation ||
                      "No specific limitation recorded for this check."}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#059669] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Audit Passed — Clean Dataset Transition
              </h2>
              <p className="mt-1 text-xs text-[#475569] leading-relaxed">
                No structural, scale, granularity, relational, or ambiguous
                semantic regressions were detected between baseline and candidate.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Baseline vs. Candidate Diff Table */}
      <div className="rounded-[4px] border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            Baseline vs. Candidate Diff Table
          </h3>
          <span className="font-mono text-[11px] text-[#64748B]">
            tabular-nums
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] font-mono text-[10px] uppercase text-[#64748B]">
                <th className="py-2 px-4 font-semibold">Metric / Column</th>
                <th className="py-2 px-4 font-semibold text-right">Baseline</th>
                <th className="py-2 px-4 font-semibold text-right">Candidate</th>
                <th className="py-2 px-4 font-semibold text-right">Diff / Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-xs tabular-nums">
              <tr>
                <td className="py-2 px-4 text-[#475569]">row_count</td>
                <td className="py-2 px-4 text-right text-[#0F172A]">
                  {rowCounts.baseline?.toLocaleString() ?? "—"}
                </td>
                <td className="py-2 px-4 text-right text-[#0F172A]">
                  {rowCounts.candidate?.toLocaleString() ?? "—"}
                </td>
                <td className="py-2 px-4 text-right text-[#475569]">
                  {rowCounts.baseline && rowCounts.candidate != null
                    ? `${(rowCounts.candidate - rowCounts.baseline >= 0 ? "+" : "")}${(
                        rowCounts.candidate - rowCounts.baseline
                      ).toLocaleString()}`
                    : "—"}
                </td>
              </tr>

              {schema.primary_key && (
                <tr>
                  <td className="py-2 px-4 text-[#475569]">
                    rows_per_key ({schema.primary_key})
                  </td>
                  <td className="py-2 px-4 text-right text-[#0F172A]">
                    {schema.baseline_rows_per_key ?? "—"}
                  </td>
                  <td className="py-2 px-4 text-right text-[#0F172A]">
                    {schema.candidate_rows_per_key ?? "—"}
                  </td>
                  <td className="py-2 px-4 text-right text-[#475569]">
                    {schema.baseline_key_uniqueness_pct != null
                      ? `${schema.baseline_key_uniqueness_pct}% base uniq`
                      : "—"}
                  </td>
                </tr>
              )}

              {relevantStats.map((s) => {
                const ratio =
                  s.baseline_median && s.candidate_median != null
                    ? `${(s.candidate_median / s.baseline_median).toFixed(2)}x`
                    : "—";
                return (
                  <tr key={`${s.column}-med`}>
                    <td className="py-2 px-4 text-[#0F172A] font-medium">
                      {s.column} <span className="text-[#64748B]">(med / p95)</span>
                    </td>
                    <td className="py-2 px-4 text-right text-[#475569]">
                      {s.baseline_median?.toLocaleString() ?? "—"} /{" "}
                      {s.baseline_p95?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-[#0F172A]">
                      {s.candidate_median?.toLocaleString() ?? "—"} /{" "}
                      {s.candidate_p95?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-[#0F172A]">
                      {ratio}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Comparison Chart */}
      <div className="rounded-[4px] border border-[#E2E8F0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Numeric Distribution Comparison
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Baseline (#0F172A) vs. Candidate ({chartMetric})
            </p>
          </div>

          <div className="inline-flex rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] p-0.5">
            <button
              type="button"
              onClick={() => setChartMetric("median")}
              className={`rounded-[3px] px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                chartMetric === "median"
                  ? "bg-[#0F172A] text-white"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Median
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("mean")}
              className={`rounded-[3px] px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                chartMetric === "mean"
                  ? "bg-[#0F172A] text-white"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Mean
            </button>
          </div>
        </div>

        {stats.length === 0 ? (
          <div className="flex h-52 items-center justify-center gap-2 text-xs text-[#64748B]">
            <AlertTriangle className="h-4 w-4" />
            No numeric columns available to chart.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="column"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "4px",
                    color: "#0F172A",
                    fontSize: "12px",
                    fontFamily: "JetBrains Mono, monospace",
                    boxShadow: "none",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar
                  dataKey={baseKey}
                  name={chartMetric === "median" ? "Baseline Median" : "Baseline Mean"}
                  fill="#0F172A"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey={candKey}
                  name={chartMetric === "median" ? "Candidate Median" : "Candidate Mean"}
                  fill={candidateBarColor}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
