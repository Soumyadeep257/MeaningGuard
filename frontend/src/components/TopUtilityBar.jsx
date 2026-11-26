import { Upload, Download, FileCode2, GitCompare, ChevronDown } from "lucide-react";

const DEMO_OPTIONS = [
  { id: "", label: "Load Demo Benchmark..." },
  { id: "scale", label: "100x Scale Shift (Rupees → Paise)" },
  { id: "grain", label: "Order-to-Item Grain Change" },
  { id: "relation", label: "Broken Financial Rule (total ≠ qty × price)" },
  { id: "clean", label: "Clean Seasonal Control (+10% Organic)" },
  { id: "ambiguous", label: "Unmapped Category Shift (0 ↔ 1)" },
];

export default function TopUtilityBar({
  datasetNames,
  hasMetadata,
  report,
  loading,
  selectedDemo,
  onSelectDemo,
  onToggleUpload,
  showUpload,
}) {
  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meaningguard_report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Brand + Active Comparison Diff */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#0F172A] bg-[#0F172A] font-mono text-xs font-semibold text-white">
              MG
            </span>
            <div className="leading-tight">
              <span className="text-sm font-bold tracking-tight text-[#0F172A]">
                MeaningGuard
              </span>
              <span className="hidden md:inline ml-2 text-xs text-[#64748B]">
                Data Auditing Workbench
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-[#E2E8F0] hidden sm:block" />

          {/* Active Dataset Diff Pill */}
          <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 font-mono text-xs text-[#0F172A]">
            <GitCompare className="h-3.5 w-3.5 text-[#64748B]" />
            <span>{datasetNames?.baseline || "baseline.csv"}</span>
            <span className="text-[#94A3B8]">→</span>
            <span className="font-semibold">
              {datasetNames?.candidate || "select candidate"}
            </span>
          </div>

          {/* Optional schema_rules.json Badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-1 font-mono text-[11px] font-medium ${
              hasMetadata
                ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]"
                : "border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B]"
            }`}
          >
            <FileCode2 className="h-3 w-3" />
            {hasMetadata ? "schema_rules.json: active" : "auto-rules"}
          </span>
        </div>

        {/* Right: Demo Benchmark Selector, Upload Trigger, Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              aria-label="Load Demo Benchmark"
              value={selectedDemo}
              disabled={loading}
              onChange={(e) => {
                if (e.target.value) onSelectDemo(e.target.value);
              }}
              className="appearance-none rounded-[4px] border border-[#E2E8F0] bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-[#0F172A] hover:border-[#94A3B8] focus:border-[#0F172A] focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              {DEMO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
          </div>

          <button
            type="button"
            onClick={onToggleUpload}
            className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              showUpload
                ? "border-[#0F172A] bg-[#0F172A] text-white"
                : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8F9FA]"
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Datasets
          </button>

          {report && (
            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8F9FA] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#475569]" />
              Export JSON
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
