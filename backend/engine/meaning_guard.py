import numpy as np
import pandas as pd


class MeaningGuardEngine:
    def __init__(self, baseline_df: pd.DataFrame, candidate_df: pd.DataFrame, metadata: dict = None):
        self.base = baseline_df.copy()
        self.cand = candidate_df.copy()
        self.meta = metadata or {}
        self.alerts = []

    def run_all(self):
        self.alerts = []
        structural_ok = self._check_structure()
        if not structural_ok:
            return self._build_report()

        self._detect_scale_changes()
        self._detect_granularity_change()
        self._detect_relationship_breaks()
        self._detect_ambiguous_shifts()
        impact_summary = self._analyze_downstream_impact()
        self._link_kpis_to_alerts(impact_summary)
        return self._build_report(impact_summary)

    def _get_kpi_definitions(self):
        return self.meta.get("kpis", [
            {"name": "Total Revenue", "column": "total_amount", "agg": "sum"},
            {"name": "Average Order Value", "column": "total_amount", "agg": "mean"},
            {"name": "Unique Customers", "column": "customer_id", "agg": "nunique"},
        ])

    # 1. Structural Check (Baseline Schema Validation)
    def _check_structure(self):
        base_cols = set(self.base.columns)
        cand_cols = set(self.cand.columns)
        if base_cols != cand_cols:
            self.alerts.append({
                "type": "Structural Violation",
                "confidence": "Confirmed",
                "severity": "High",
                "columns": sorted(list(base_cols ^ cand_cols)),
                "linked_kpis": [],
                "evidence": f"Column mismatch. Missing: {base_cols - cand_cols}, Added: {cand_cols - base_cols}",
                "limitation": "Downstream semantic checks skipped due to schema mismatch."
            })
            return False

        for col in self.base.columns:
            if self.base[col].dtype != self.cand[col].dtype:
                self.alerts.append({
                    "type": "Structural Violation",
                    "confidence": "Confirmed",
                    "severity": "High",
                    "columns": [col],
                    "linked_kpis": [],
                    "evidence": f"Data type changed from {self.base[col].dtype} to {self.cand[col].dtype}.",
                    "limitation": "Type mismatch detected by standard schema validation."
                })
                return False
        return True

    # 2. Mechanism A: Unit & Scale Change Detector
    def _detect_scale_changes(self):
        scale_factors = [10, 100, 1000, 0.1, 0.01, 0.001, 12, 1 / 12]
        num_cols = self.base.select_dtypes(include=[np.number]).columns

        for col in num_cols:
            med_old = self.base[col].median()
            med_new = self.cand[col].median()
            if med_old == 0 or pd.isna(med_old) or pd.isna(med_new):
                continue

            ratio = med_new / med_old
            for factor in scale_factors:
                if abs(ratio - factor) / factor <= 0.05:  # within 5% tolerance
                    self.alerts.append({
                        "type": "Unit / Scale Shift",
                        "confidence": "Suspected",
                        "severity": "High",
                        "columns": [col],
                        "linked_kpis": [],
                        "evidence": f"Median shifted from {med_old:.2f} to {med_new:.2f} (ratio {ratio:.2f}x ≈ {factor}x).",
                        "limitation": "Flagged as suspected rather than confirmed because legitimate bulk pricing changes can mimic unit scaling."
                    })
                    break

    # 3. Mechanism C: Granularity Change Detector
    def _detect_granularity_change(self):
        pk = self.meta.get("primary_key")
        if not pk and len(self.base) > 0:
            # Auto-detect column with >= 99% uniqueness in baseline
            for col in self.base.columns:
                if self.base[col].nunique() / len(self.base) >= 0.99:
                    pk = col
                    break

        if pk and pk in self.base.columns:
            base_rows_per_key = len(self.base) / max(self.base[pk].nunique(), 1)
            cand_rows_per_key = len(self.cand) / max(self.cand[pk].nunique(), 1)

            if base_rows_per_key <= 1.05 and cand_rows_per_key > 1.20:
                self.alerts.append({
                    "type": "Granularity Change",
                    "confidence": "Suspected",
                    "severity": "High",
                    "columns": [pk],
                    "linked_kpis": [],
                    "evidence": f"Rows per '{pk}' increased from {base_rows_per_key:.2f} to {cand_rows_per_key:.2f} ({len(self.base)} -> {len(self.cand)} total rows).",
                    "limitation": f"Assumes '{pk}' was an entity-level key in baseline; may cause sum aggregations to double-count."
                })

    # 4. Mechanism B: Cross-Column Relationship Detector
    def _detect_relationship_breaks(self):
        rules = self.meta.get("rules", [])
        # Auto-mine multiplication rule if no explicit rules are given
        if not rules and {"quantity", "unit_price", "total_amount"}.issubset(self.base.columns):
            rules = [{"name": "total_amount = quantity * unit_price",
                      "expression": "abs(total_amount - (quantity * unit_price)) < 0.05",
                      "columns": ["total_amount", "quantity", "unit_price"]}]

        for rule in rules:
            expr = rule["expression"]
            try:
                base_pass = self.base.eval(expr).mean() * 100
                cand_pass = self.cand.eval(expr).mean() * 100
            except Exception:
                continue

            if base_pass >= 95.0 and (base_pass - cand_pass) >= 5.0:
                rule_cols = rule.get("columns") or [
                    c for c in self.base.columns if c in expr
                ]
                self.alerts.append({
                    "type": "Broken Cross-Column Relationship",
                    "confidence": "Confirmed",
                    "severity": "Critical",
                    "columns": rule_cols,
                    "linked_kpis": [],
                    "evidence": f"Rule '{rule['name']}' pass rate dropped from {base_pass:.1f}% to {cand_pass:.1f}%.",
                    "limitation": "Detects mathematical inconsistency but cannot identify which specific column is the root source of error."
                })

    # 5. Known Limitation: Ambiguous Binary/Category Reversal
    def _detect_ambiguous_shifts(self):
        for col in self.base.columns:
            if self.base[col].nunique() <= 5:
                base_dist = self.base[col].value_counts(normalize=True)
                cand_dist = self.cand[col].value_counts(normalize=True)
                all_cats = base_dist.index.union(cand_dist.index)
                max_diff = (
                    base_dist.reindex(all_cats, fill_value=0)
                    - cand_dist.reindex(all_cats, fill_value=0)
                ).abs().max()
                if max_diff > 0.35 and len(self.alerts) == 0:
                    self.alerts.append({
                        "type": "Ambiguous Semantic Shift",
                        "confidence": "Uncertain — Metadata Required",
                        "severity": "Medium",
                        "columns": [col],
                        "linked_kpis": [],
                        "evidence": f"Category proportions in '{col}' shifted by {max_diff*100:.1f}% without structural, scale, or formula changes.",
                        "limitation": "MeaningGuard cannot infer label reversals (e.g., 0/1 swap) from values alone; please provide a data dictionary."
                    })

    # 6. Mechanism D: Downstream KPI Impact Analysis
    def _analyze_downstream_impact(self):
        kpis = self._get_kpi_definitions()
        impacts = []
        for kpi in kpis:
            col, agg = kpi["column"], kpi["agg"]
            if col not in self.base.columns:
                continue
            old_val = getattr(self.base[col], agg)()
            new_val = getattr(self.cand[col], agg)()
            pct_change = ((new_val - old_val) / old_val * 100) if old_val != 0 else 0.0
            impacts.append({
                "kpi": kpi["name"],
                "column": col,
                "agg": agg,
                "baseline_value": round(float(old_val), 2),
                "candidate_value": round(float(new_val), 2),
                "pct_change": round(float(pct_change), 2),
            })
        return impacts

    def _link_kpis_to_alerts(self, impacts):
        """Link each alert to the downstream KPIs whose source column or aggregation it distorts."""
        for alert in self.alerts:
            alert_cols = set(alert.get("columns") or [])
            linked = []
            for imp in impacts:
                if imp["column"] in alert_cols or (
                    alert["type"] == "Granularity Change" and imp["agg"] == "sum"
                ):
                    linked.append(f"{imp['kpi']} ({imp['pct_change']:+.1f}%)")
            alert["linked_kpis"] = linked

    def _build_report(self, impact_summary=None):
        severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        confidence_order = {"Confirmed": 0, "Suspected": 1, "Uncertain — Metadata Required": 2}
        ranked_alerts = sorted(
            self.alerts,
            key=lambda x: (
                severity_order.get(x.get("severity"), 99),
                confidence_order.get(x.get("confidence"), 99),
                -len(x.get("linked_kpis") or []),
            ),
        )
        return {
            "status": "Clean (No Semantic Regressions Detected)" if not ranked_alerts else "Regressions Detected",
            "alert_count": len(ranked_alerts),
            "alerts": ranked_alerts,
            "downstream_impact": impact_summary or [],
        }
