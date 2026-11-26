import { useState } from "react";
import axios from "axios";
import TopUtilityBar from "./components/TopUtilityBar";
import UploadDrawer from "./components/UploadDrawer";
import ConsistencyStrip from "./components/ConsistencyStrip";
import EvidenceFeed from "./components/EvidenceFeed";
import EvidenceInspector from "./components/EvidenceInspector";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function App() {
  const [baselineFile, setBaselineFile] = useState(null);
  const [candidateFile, setCandidateFile] = useState(null);
  const [metadataJson, setMetadataJson] = useState("");
  const [showUpload, setShowUpload] = useState(true);
  const [selectedDemo, setSelectedDemo] = useState("");
  const [datasetNames, setDatasetNames] = useState({
    baseline: "baseline.csv",
    candidate: "select candidate",
  });
  const [report, setReport] = useState(null);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateMetadata = () => {
    if (!metadataJson.trim()) return true;
    try {
      JSON.parse(metadataJson);
      return true;
    } catch (err) {
      setError(`Invalid schema_rules.json: ${err.message}`);
      return false;
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!baselineFile || !candidateFile) {
      setError("Select both a baseline CSV and a candidate CSV.");
      return;
    }
    if (!validateMetadata()) return;

    setLoading(true);
    setError("");
    setSelectedDemo("");

    try {
      const formData = new FormData();
      formData.append("baseline_file", baselineFile);
      formData.append("candidate_file", candidateFile);
      if (metadataJson.trim()) {
        formData.append("metadata_json", metadataJson);
      }

      const res = await axios.post(`${API_URL}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setReport(res.data);
      setDatasetNames({
        baseline: baselineFile.name,
        candidate: candidateFile.name,
      });
      setSelectedAlertIndex(0);
      setShowUpload(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        detail ||
          err.message ||
          `Cannot reach MeaningGuard API at ${API_URL}. Ensure uvicorn is running.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async (caseId) => {
    if (!validateMetadata()) return;

    setSelectedDemo(caseId);
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      if (metadataJson.trim()) {
        formData.append("metadata_json", metadataJson);
      }

      const res = await axios.post(`${API_URL}/analyze-demo/${caseId}`, formData);
      setReport(res.data);
      setDatasetNames(
        res.data.dataset_names || {
          baseline: "baseline.csv",
          candidate: `candidate_${caseId}.csv`,
        }
      );
      setSelectedAlertIndex(0);
      setShowUpload(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        detail ||
          err.message ||
          `Cannot reach MeaningGuard API at ${API_URL}. Ensure uvicorn is running.`
      );
      setShowUpload(true);
    } finally {
      setLoading(false);
    }
  };

  const alerts = report?.alerts || [];
  const selectedAlert = alerts[selectedAlertIndex] || null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A]">
      <TopUtilityBar
        datasetNames={datasetNames}
        hasMetadata={Boolean(metadataJson.trim())}
        report={report}
        loading={loading}
        selectedDemo={selectedDemo}
        onSelectDemo={handleLoadDemo}
        onToggleUpload={() => setShowUpload((prev) => !prev)}
        showUpload={showUpload}
      />

      {showUpload ? (
        <UploadDrawer
          baselineFile={baselineFile}
          setBaselineFile={setBaselineFile}
          candidateFile={candidateFile}
          setCandidateFile={setCandidateFile}
          metadataJson={metadataJson}
          setMetadataJson={setMetadataJson}
          onAnalyze={handleAnalyze}
          onClose={report ? () => setShowUpload(false) : null}
          loading={loading}
          error={error}
        />
      ) : (
        <div className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-1.5 sm:px-6">
            <span className="font-mono text-[11px] text-[#64748B]">
              Configuration collapsed • {datasetNames.baseline} → {datasetNames.candidate}
            </span>
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="font-mono text-[11px] font-semibold text-[#0F172A] hover:underline cursor-pointer"
            >
              Expand Dataset &amp; Rule Config
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 space-y-4">
        {!report ? (
          <div className="rounded-[4px] border border-[#E2E8F0] bg-white p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-[#64748B]">
              Workbench Ready
            </p>
            <h1 className="mt-1 text-base font-bold text-[#0F172A]">
              Upload a CSV pair above or select a Demo Benchmark from the utility bar
            </h1>
            <p className="mt-1 text-xs text-[#64748B]">
              MeaningGuard audits structural parity, statistical drift, unit scaling,
              entity granularity, and cross-column formulas.
            </p>
          </div>
        ) : (
          <>
            <ConsistencyStrip report={report} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-5">
                <EvidenceFeed
                  alerts={alerts}
                  impacts={report.downstream_impact || []}
                  selectedIndex={selectedAlertIndex}
                  onSelectIndex={setSelectedAlertIndex}
                />
              </div>
              <div className="lg:col-span-7">
                <EvidenceInspector
                  report={report}
                  selectedAlert={selectedAlert}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
