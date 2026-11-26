import io
import json
from typing import Optional
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from engine.meaning_guard import MeaningGuardEngine

app = FastAPI(
    title="MeaningGuard — Semantic Data Regression Detector",
    description="Evidence-based detection of schema-preserving semantic regressions in tabular data.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def compute_schema_summary(base_df: pd.DataFrame, cand_df: pd.DataFrame, metadata: dict) -> dict:
    """Summarize column, dtype, and primary-key granularity alignment."""
    base_cols = set(base_df.columns)
    cand_cols = set(cand_df.columns)
    shared_cols = base_cols & cand_cols
    union_cols = base_cols | cand_cols
    col_match_pct = round((len(shared_cols) / len(union_cols) * 100), 1) if union_cols else 100.0

    dtype_match = base_cols == cand_cols and all(
        base_df[col].dtype == cand_df[col].dtype for col in base_df.columns
    )

    pk = metadata.get("primary_key")
    if not pk and len(base_df) > 0:
        for col in base_df.columns:
            if base_df[col].nunique() / len(base_df) >= 0.99:
                pk = col
                break

    base_rpk = None
    cand_rpk = None
    base_uniq_pct = None
    if pk and pk in base_df.columns and pk in cand_df.columns and len(base_df) > 0:
        base_nunique = max(base_df[pk].nunique(), 1)
        cand_nunique = max(cand_df[pk].nunique(), 1)
        base_rpk = round(len(base_df) / base_nunique, 2)
        cand_rpk = round(len(cand_df) / cand_nunique, 2)
        base_uniq_pct = round((base_df[pk].nunique() / len(base_df)) * 100, 1)

    base_missing = int(base_df.isna().sum().sum())
    cand_missing = int(cand_df.isna().sum().sum())

    return {
        "baseline_columns": len(base_df.columns),
        "candidate_columns": len(cand_df.columns),
        "column_match_pct": col_match_pct,
        "dtype_match": dtype_match,
        "schema_preserved": (base_cols == cand_cols) and dtype_match,
        "baseline_missing_values": base_missing,
        "candidate_missing_values": cand_missing,
        "primary_key": pk,
        "baseline_rows_per_key": base_rpk,
        "candidate_rows_per_key": cand_rpk,
        "baseline_key_uniqueness_pct": base_uniq_pct,
    }


def compute_summary_stats(base_df: pd.DataFrame, cand_df: pd.DataFrame) -> list[dict]:
    """Compute baseline vs. candidate median, mean, and quartiles for shared numeric columns."""
    stats = []
    num_cols = base_df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        if col not in cand_df.columns or not pd.api.types.is_numeric_dtype(cand_df[col]):
            continue
        b_med = base_df[col].median()
        c_med = cand_df[col].median()
        b_mean = base_df[col].mean()
        c_mean = cand_df[col].mean()
        b_q25 = base_df[col].quantile(0.25)
        b_q75 = base_df[col].quantile(0.75)
        b_p95 = base_df[col].quantile(0.95)
        c_q25 = cand_df[col].quantile(0.25)
        c_q75 = cand_df[col].quantile(0.75)
        c_p95 = cand_df[col].quantile(0.95)
        stats.append({
            "column": col,
            "baseline_median": round(float(b_med), 2) if pd.notna(b_med) else None,
            "candidate_median": round(float(c_med), 2) if pd.notna(c_med) else None,
            "baseline_mean": round(float(b_mean), 2) if pd.notna(b_mean) else None,
            "candidate_mean": round(float(c_mean), 2) if pd.notna(c_mean) else None,
            "baseline_q25": round(float(b_q25), 2) if pd.notna(b_q25) else None,
            "baseline_q75": round(float(b_q75), 2) if pd.notna(b_q75) else None,
            "baseline_p95": round(float(b_p95), 2) if pd.notna(b_p95) else None,
            "candidate_q25": round(float(c_q25), 2) if pd.notna(c_q25) else None,
            "candidate_q75": round(float(c_q75), 2) if pd.notna(c_q75) else None,
            "candidate_p95": round(float(c_p95), 2) if pd.notna(c_p95) else None,
        })
    return stats


@app.get("/", tags=["Health"])
def root():
    return {
        "project": "MeaningGuard",
        "status": "Active",
        "interactive_docs": "Open /docs in your browser to upload CSVs and run analysis",
    }


@app.post("/analyze", tags=["Semantic Analysis"])
async def analyze_datasets(
    baseline_file: UploadFile = File(..., description="Upload baseline.csv"),
    candidate_file: UploadFile = File(..., description="Upload candidate_*.csv"),
    metadata_json: Optional[str] = Form(
        None,
        description='Optional JSON rules/KPIs, e.g. {"primary_key": "order_id"}',
    ),
):
    try:
        base_df = pd.read_csv(io.BytesIO(await baseline_file.read()))
        cand_df = pd.read_csv(io.BytesIO(await candidate_file.read()))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")

    metadata = {}
    if metadata_json and metadata_json.strip():
        try:
            metadata = json.loads(metadata_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON metadata: {str(e)}")

    engine = MeaningGuardEngine(base_df, cand_df, metadata=metadata)
    report = engine.run_all()
    report["row_counts"] = {"baseline": len(base_df), "candidate": len(cand_df)}
    report["schema_summary"] = compute_schema_summary(base_df, cand_df, metadata)
    report["summary_stats"] = compute_summary_stats(base_df, cand_df)
    return report


DEMO_CASES = {
    "scale": ("data/baseline.csv", "data/candidate_scale.csv", "candidate_scale.csv"),
    "grain": ("data/baseline.csv", "data/candidate_grain.csv", "candidate_grain.csv"),
    "relation": ("data/baseline.csv", "data/candidate_relation.csv", "candidate_relation.csv"),
    "clean": ("data/baseline.csv", "data/candidate_clean_growth.csv", "candidate_clean_growth.csv"),
    "ambiguous": ("data/baseline.csv", "data/candidate_ambiguous.csv", "candidate_ambiguous.csv"),
}


@app.post("/analyze-demo/{case_id}", tags=["Semantic Analysis"])
async def analyze_demo_case(case_id: str, metadata_json: Optional[str] = Form(None)):
    if case_id not in DEMO_CASES:
        raise HTTPException(status_code=404, detail=f"Unknown demo case '{case_id}'.")

    base_path, cand_path, cand_label = DEMO_CASES[case_id]
    try:
        base_df = pd.read_csv(base_path)
        cand_df = pd.read_csv(cand_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load demo files: {str(e)}")

    metadata = {}
    if metadata_json and metadata_json.strip():
        try:
            metadata = json.loads(metadata_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON metadata: {str(e)}")

    engine = MeaningGuardEngine(base_df, cand_df, metadata=metadata)
    report = engine.run_all()
    report["dataset_names"] = {"baseline": "baseline.csv", "candidate": cand_label}
    report["row_counts"] = {"baseline": len(base_df), "candidate": len(cand_df)}
    report["schema_summary"] = compute_schema_summary(base_df, cand_df, metadata)
    report["summary_stats"] = compute_summary_stats(base_df, cand_df)
    return report
