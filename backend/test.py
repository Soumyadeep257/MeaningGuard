import json
import pandas as pd
from engine.meaning_guard import MeaningGuardEngine

baseline = pd.read_csv("data/baseline.csv")
test_files = [
    "candidate_scale.csv",
    "candidate_grain.csv",
    "candidate_relation.csv",
    "candidate_clean_growth.csv",
    "candidate_ambiguous.csv"
]

for file in test_files:
    print("=" * 60)
    print(f"TESTING: {file}")
    cand = pd.read_csv(f"data/{file}")
    report = MeaningGuardEngine(baseline, cand).run_all()
    print(json.dumps(report, indent=2))