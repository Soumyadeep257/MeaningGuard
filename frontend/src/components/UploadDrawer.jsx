import { useState, useMemo } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  Eraser,
  AlertCircle,
  Loader2,
  ChevronUp,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";

const PRESETS = {
  financial: {
    primary_key: "order_id",
    rules: [
      {
        name: "total_amount = quantity * unit_price",
        expression: "abs(total_amount - (quantity * unit_price)) < 0.05",
      },
    ],
    kpis: [
      { name: "Total Revenue", column: "total_amount", agg: "sum" },
      { name: "Average Order Value", column: "total_amount", agg: "mean" },
      { name: "Unique Customers", column: "customer_id", agg: "nunique" },
    ],
  },
  academic: {
    primary_key: "student_id",
    rules: [
      {
        name: "total_credits = core_credits + elective_credits",
        expression: "abs(total_credits - (core_credits + elective_credits)) < 0.01",
      },
    ],
    kpis: [
      { name: "Total Credits Awarded", column: "total_credits", agg: "sum" },
      { name: "Mean GPA", column: "gpa", agg: "mean" },
      { name: "Enrolled Students", column: "student_id", agg: "nunique" },
    ],
  },
};

const AGG_OPTIONS = ["sum", "mean", "median", "nunique", "min", "max"];
const DEFAULT_COLUMNS = [
  "total_amount",
  "unit_price",
  "quantity",
  "customer_id",
  "order_id",
];

async function parseCsvSummary(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { columns: [], rowCount: 0 };
  const columns = lines[0]
    .split(",")
    .map((c) => c.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  return { columns, rowCount: Math.max(0, lines.length - 1) };
}

function CsvSlot({ label, file, meta, onSelectFile, onClear, id }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelectFile(dropped);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[4px] border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileSpreadsheet className="h-4 w-4 text-[#059669] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#059669]">
                {label}
              </span>
              <span className="font-mono text-xs font-semibold text-[#0F172A] truncate">
                {file.name}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#475569] tabular-nums">
              {meta ? `${meta.rowCount.toLocaleString()} rows • ${meta.columns.length} cols` : "Parsing..."} •{" "}
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={id}
            className="rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-[#F8F9FA] cursor-pointer"
          >
            Replace
            <input
              id={id}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            className="rounded-[4px] border border-[#E2E8F0] bg-white p-1 text-[#64748B] hover:text-[#DC2626] cursor-pointer"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex items-center justify-center gap-3 rounded-[4px] border border-dashed px-4 py-3 text-left transition cursor-pointer ${
        isDragging
          ? "border-[#0F172A] bg-[#F1F5F9]"
          : "border-[#CBD5E1] bg-[#F8F9FA] hover:border-[#64748B]"
      }`}
    >
      <input
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
      />
      <UploadCloud className="h-5 w-5 text-[#64748B] shrink-0" />
      <div>
        <p className="text-xs font-semibold text-[#0F172A]">{label}</p>
        <p className="text-[11px] text-[#64748B]">
          Drag &amp; drop CSV or click to browse
        </p>
      </div>
    </label>
  );
}

export default function UploadDrawer({
  baselineFile,
  setBaselineFile,
  candidateFile,
  setCandidateFile,
  metadataJson,
  setMetadataJson,
  onAnalyze,
  onClose,
  loading,
  error,
}) {
  const [baseMeta, setBaseMeta] = useState(null);
  const [candMeta, setCandMeta] = useState(null);
  const [selectedAgg, setSelectedAgg] = useState("sum");
  const [selectedCol, setSelectedCol] = useState("total_amount");

  const handleSelectBaseline = async (file) => {
    setBaselineFile(file);
    if (file) {
      const parsed = await parseCsvSummary(file);
      setBaseMeta(parsed);
      if (parsed.columns.length > 0 && !parsed.columns.includes(selectedCol)) {
        setSelectedCol(parsed.columns[0]);
      }
    } else {
      setBaseMeta(null);
    }
  };

  const handleSelectCandidate = async (file) => {
    setCandidateFile(file);
    if (file) {
      const parsed = await parseCsvSummary(file);
      setCandMeta(parsed);
    } else {
      setCandMeta(null);
    }
  };

  // Live JSON syntax validation
  const jsonValidation = useMemo(() => {
    if (!metadataJson.trim()) {
      return { valid: true, parsed: {}, error: null };
    }
    try {
      const parsed = JSON.parse(metadataJson);
      return { valid: true, parsed, error: null };
    } catch (err) {
      return { valid: false, parsed: null, error: err.message };
    }
  }, [metadataJson]);

  const activeKpis = useMemo(() => {
    if (jsonValidation.valid && Array.isArray(jsonValidation.parsed?.kpis)) {
      return jsonValidation.parsed.kpis;
    }
    return [];
  }, [jsonValidation]);

  const availableColumns = useMemo(() => {
    if (baseMeta?.columns?.length) return baseMeta.columns;
    return DEFAULT_COLUMNS;
  }, [baseMeta]);

  const updateKpisInJson = (nextKpis) => {
    const baseObj =
      jsonValidation.valid && jsonValidation.parsed && typeof jsonValidation.parsed === "object"
        ? { ...jsonValidation.parsed }
        : {};
    if (nextKpis.length === 0) {
      delete baseObj.kpis;
    } else {
      baseObj.kpis = nextKpis;
    }
    setMetadataJson(
      Object.keys(baseObj).length === 0 ? "" : JSON.stringify(baseObj, null, 2)
    );
  };

  const handleAddKpiPill = () => {
    if (!selectedCol) return;
    const exists = activeKpis.some(
      (k) => k.column === selectedCol && k.agg === selectedAgg
    );
    if (exists) return;
    const label = `${selectedAgg.toUpperCase()}(${selectedCol})`;
    updateKpisInJson([
      ...activeKpis,
      { name: label, column: selectedCol, agg: selectedAgg },
    ]);
  };

  const handleRemoveKpiPill = (idx) => {
    updateKpisInJson(activeKpis.filter((_, i) => i !== idx));
  };

  // Live column alignment preview when both CSVs are loaded
  const columnAlignment = useMemo(() => {
    if (!baseMeta || !candMeta) return null;
    const baseSet = new Set(baseMeta.columns);
    const candSet = new Set(candMeta.columns);
    const matched = baseMeta.columns.filter((c) => candSet.has(c));
    const missingInCand = baseMeta.columns.filter((c) => !candSet.has(c));
    const addedInCand = candMeta.columns.filter((c) => !baseSet.has(c));
    return { matched, missingInCand, addedInCand };
  }, [baseMeta, candMeta]);

  const applyPreset = (key) => {
    setMetadataJson(JSON.stringify(PRESETS[key], null, 2));
  };

  return (
    <section className="border-b border-[#E2E8F0] bg-white">
      <form
        onSubmit={onAnalyze}
        className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 space-y-3.5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Dataset &amp; Rule Configuration
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Upload CSV versions, select target downstream metrics, and configure optional rules.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-medium text-[#475569] hover:text-[#0F172A] cursor-pointer"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse
            </button>
          )}
        </div>

        {/* Compact File Chips / Dropzones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CsvSlot
            id="baseline-csv"
            label="Baseline (v1)"
            file={baselineFile}
            meta={baseMeta}
            onSelectFile={handleSelectBaseline}
            onClear={() => handleSelectBaseline(null)}
          />
          <CsvSlot
            id="candidate-csv"
            label="Candidate (v2)"
            file={candidateFile}
            meta={candMeta}
            onSelectFile={handleSelectCandidate}
            onClear={() => handleSelectCandidate(null)}
          />
        </div>

        {/* Interactive Target Downstream Metrics Pill Selector */}
        <div className="rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
              Target Downstream Metrics
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Aggregation"
                value={selectedAgg}
                onChange={(e) => setSelectedAgg(e.target.value)}
                className="rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 font-mono text-[11px] text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              >
                {AGG_OPTIONS.map((agg) => (
                  <option key={agg} value={agg}>
                    {agg}
                  </option>
                ))}
              </select>
              <select
                aria-label="Target Column"
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-1 font-mono text-[11px] text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              >
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddKpiPill}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#0F172A] bg-[#0F172A] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1E293B] cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add Metric
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeKpis.length === 0 ? (
              <span className="text-[11px] text-[#64748B]">
                Using default KPIs (Total Revenue, Average Order Value, Unique Customers). Add pills above to customize.
              </span>
            ) : (
              activeKpis.map((kpi, idx) => (
                <span
                  key={`${kpi.column}-${kpi.agg}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-white px-2 py-0.5 font-mono text-[11px] text-[#0F172A]"
                >
                  <span className="text-[#475569] uppercase">{kpi.agg}</span>
                  <span>({kpi.column})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKpiPill(idx)}
                    className="text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                    aria-label={`Remove ${kpi.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* SCHEMA_RULES.JSON Editor with Live Syntax Validation */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <label
                htmlFor="metadata-json"
                className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#475569]"
              >
                SCHEMA_RULES.JSON
              </label>
              {metadataJson.trim() && (
                <span
                  className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    jsonValidation.valid
                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]"
                      : "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
                  }`}
                >
                  {jsonValidation.valid ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Valid JSON
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Syntax Error: {jsonValidation.error}
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset("financial")}
                className="rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
              >
                Load Financial Rules JSON
              </button>
              <button
                type="button"
                onClick={() => applyPreset("academic")}
                className="rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
              >
                Load Academic Credits Metadata
              </button>
              <button
                type="button"
                onClick={() => setMetadataJson("")}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <Eraser className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>

          <textarea
            id="metadata-json"
            rows={4}
            value={metadataJson}
            onChange={(e) => setMetadataJson(e.target.value)}
            placeholder='{"primary_key": "order_id", "rules": [...], "kpis": [...]}'
            className={`w-full rounded-[4px] border p-2.5 font-mono text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none ${
              jsonValidation.valid
                ? "border-[#E2E8F0] bg-[#F8F9FA] focus:border-[#0F172A]"
                : "border-[#FECACA] bg-[#FEF2F2]"
            }`}
          />
        </div>

        {/* Live Column-Alignment Preview + Run Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1">
            {columnAlignment && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-[4px] border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1.5">
                <span className="font-mono text-[10px] font-semibold uppercase text-[#64748B] mr-1">
                  Column Alignment ({columnAlignment.matched.length}/{baseMeta.columns.length}):
                </span>
                {columnAlignment.matched.map((col) => (
                  <span
                    key={`m-${col}`}
                    className="rounded-[4px] border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 font-mono text-[10px] text-[#059669]"
                  >
                    ✓ {col}
                  </span>
                ))}
                {columnAlignment.missingInCand.map((col) => (
                  <span
                    key={`miss-${col}`}
                    className="rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 font-mono text-[10px] text-[#DC2626]"
                  >
                    − {col}
                  </span>
                ))}
                {columnAlignment.addedInCand.map((col) => (
                  <span
                    key={`add-${col}`}
                    className="rounded-[4px] border border-[#FDE68A] bg-[#FFFBEB] px-1.5 py-0.5 font-mono text-[10px] text-[#D97706]"
                  >
                    + {col}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !baselineFile || !candidateFile || !jsonValidation.valid}
            className="inline-flex items-center gap-2 rounded-[4px] border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {loading ? "Running Audit..." : "Run Semantic Audit"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </section>
  );
}
