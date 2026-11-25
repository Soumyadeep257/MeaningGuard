import io
import json
from typing import Optional
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from engine.meaning_guard import MeaningGuardEngine

app = FastAPI(
    title="MeaningGuard — Semantic Data Regression Detector",
    description="Evidence-based detection of schema-preserving semantic regressions in tabular data.",
    version="1.0.0",
)


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
    return report