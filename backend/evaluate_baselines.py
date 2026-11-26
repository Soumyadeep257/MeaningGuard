import numpy as np
import pandas as pd
from scipy.stats import ks_2samp
from engine.meaning_guard import MeaningGuardEngine


def schema_only_detector(base_df: pd.DataFrame, cand_df: pd.DataFrame) -> tuple[bool, set[str]]:
    """Baseline 1: Flags only column-set or dtype mismatches."""
    if set(base_df.columns) != set(cand_df.columns):
        return True, set(base_df.columns) ^ set(cand_df.columns)
    mismatched = {c for c in base_df.columns if base_df[c].dtype != cand_df[c].dtype}
    return len(mismatched) > 0, mismatched


def ks_drift_detector(base_df: pd.DataFrame, cand_df: pd.DataFrame, alpha: float = 0.01) -> tuple[bool, set[str]]:
    """Baseline 2: Single-column two-sample KS test across numeric columns."""
    if set(base_df.columns) != set(cand_df.columns):
        return True, set()
    flagged = set()
    for col in base_df.select_dtypes(include=[np.number]).columns:
        if pd.api.types.is_numeric_dtype(cand_df[col]):
            _, p_val = ks_2samp(base_df[col].dropna(), cand_df[col].dropna())
            if p_val < alpha:
                flagged.add(col)
    return len(flagged) > 0, flagged


def relationship_only_detector(base_df: pd.DataFrame, cand_df: pd.DataFrame) -> tuple[bool, set[str]]:
    """Baseline 3: Checks only deterministic cross-column arithmetic rules."""
    if not {"quantity", "unit_price", "total_amount"}.issubset(cand_df.columns):
        return False, set()
    try:
        expr = "abs(total_amount - (quantity * unit_price)) < 0.05"
        base_pass = base_df.eval(expr).mean() * 100
        cand_pass = cand_df.eval(expr).mean() * 100
        if base_pass >= 95.0 and (base_pass - cand_pass) >= 5.0:
            return True, {"total_amount", "quantity", "unit_price"}
    except Exception:
        return False, set()
    return False, set()


def meaning_guard_detector(base_df: pd.DataFrame, cand_df: pd.DataFrame) -> tuple[bool, set[str]]:
    """Proposed System: MeaningGuardEngine."""
    report = MeaningGuardEngine(base_df, cand_df).run_all()
    flagged_cols = set()
    for alert in report["alerts"]:
        flagged_cols.update(alert.get("columns") or [])
    return report["alert_count"] > 0, flagged_cols


def build_benchmark_cases(baseline: pd.DataFrame):
    dtype_df = baseline.copy()
    dtype_df["unit_price"] = dtype_df["unit_price"].astype(str)

    return [
        {
            "name": "1. Dtype Change (unit_price -> str)",
            "df": dtype_df,
            "is_regression": True,
            "expected_cols": {"unit_price"},
        },
        {
            "name": "2. Scale Shift (100x Rupees -> Paise)",
            "df": pd.read_csv("data/candidate_scale.csv"),
            "is_regression": True,
            "expected_cols": {"unit_price", "total_amount"},
        },
        {
            "name": "3. Granularity Shift (1 -> multi rows/order)",
            "df": pd.read_csv("data/candidate_grain.csv"),
            "is_regression": True,
            "expected_cols": {"order_id"},
        },
        {
            "name": "4. Broken Financial Rule (total != qty*price)",
            "df": pd.read_csv("data/candidate_relation.csv"),
            "is_regression": True,
            "expected_cols": {"total_amount", "quantity", "unit_price"},
        },
        {
            "name": "5. Legitimate 10% Price Growth (Neg Control)",
            "df": pd.read_csv("data/candidate_clean_growth.csv"),
            "is_regression": False,
            "expected_cols": set(),
        },
        {
            "name": "6. Unmapped Category Shift (is_member 0<->1)",
            "df": pd.read_csv("data/candidate_ambiguous.csv"),
            "is_regression": True,
            "expected_cols": {"is_member"},
        },
    ]


def evaluate_detector(name: str, detector_fn, baseline: pd.DataFrame, cases: list[dict]) -> dict:
    tp = fp = fn = tn = 0
    col_hits = 0
    pos_cases = sum(1 for c in cases if c["is_regression"])

    for case in cases:
        pred, cols = detector_fn(baseline, case["df"])
        actual = case["is_regression"]

        if pred and actual:
            tp += 1
            if case["expected_cols"] & cols:
                col_hits += 1
        elif pred and not actual:
            fp += 1
        elif not pred and actual:
            fn += 1
        else:
            tn += 1

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    col_acc = col_hits / pos_cases if pos_cases else 0.0

    return {
        "Detector": name,
        "Precision": round(precision, 2),
        "Recall": round(recall, 2),
        "F1-Score": round(f1, 2),
        "FPR": round(fpr, 2),
        "Affected-Col Acc": round(col_acc, 2),
    }


def main():
    baseline = pd.read_csv("data/baseline.csv")
    cases = build_benchmark_cases(baseline)

    detectors = [
        ("Schema-Only Validation", schema_only_detector),
        ("Single-Column KS-Test", ks_drift_detector),
        ("Relationship-Only Check", relationship_only_detector),
        ("MeaningGuard (Proposed)", meaning_guard_detector),
    ]

    results = [evaluate_detector(name, fn, baseline, cases) for name, fn in detectors]
    df_results = pd.DataFrame(results)
    print("\n=== Controlled Benchmark Evaluation (6 Test Cases) ===")
    print(df_results.to_string(index=False))


if __name__ == "__main__":
    main()
