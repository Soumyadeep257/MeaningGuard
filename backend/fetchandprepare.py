import os
import json
import numpy as np
import pandas as pd

os.makedirs("data", exist_ok=True)
np.random.seed(42)

# 1. Create clean Baseline Dataset (1,000 rows, < 100 KB)
n_rows = 1000
order_ids = [f"ORD-{10000 + i}" for i in range(n_rows)]
customer_ids = [f"CUST-{np.random.randint(100, 350)}" for _ in range(n_rows)]
quantities = np.random.randint(1, 6, size=n_rows)
unit_prices = np.round(np.random.uniform(200, 1500, size=n_rows), 2)
total_amounts = np.round(quantities * unit_prices, 2)
is_member = np.random.choice([0, 1], size=n_rows, p=[0.25, 0.75])

baseline = pd.DataFrame({
    "order_id": order_ids,
    "customer_id": customer_ids,
    "quantity": quantities,
    "unit_price": unit_prices,
    "total_amount": total_amounts,
    "is_member": is_member
})
baseline.to_csv("data/baseline.csv", index=False)

# 2. Scale Regression (100x jump: Rupees -> Paise)
scale_df = baseline.copy()
scale_df["unit_price"] *= 100
scale_df["total_amount"] *= 100
scale_df.to_csv("data/candidate_scale.csv", index=False)

# 3. Granularity Regression (1 row per order -> multiple rows per order)
grain_df = pd.concat([baseline, baseline.sample(400, random_state=1)], ignore_index=True)
grain_df.to_csv("data/candidate_grain.csv", index=False)

# 4. Broken Relationship (total_amount != quantity * unit_price on 20% rows)
rel_df = baseline.copy()
idx = rel_df.sample(frac=0.2, random_state=2).index
rel_df.loc[idx, "total_amount"] = np.round(rel_df.loc[idx, "total_amount"] * 0.5, 2)
rel_df.to_csv("data/candidate_relation.csv", index=False)

# 5. Negative Control: Legitimate Growth (10% organic price rise, valid math)
clean_df = baseline.copy()
clean_df["unit_price"] = np.round(clean_df["unit_price"] * 1.10, 2)
clean_df["total_amount"] = np.round(clean_df["unit_price"] * clean_df["quantity"], 2)
clean_df.to_csv("data/candidate_clean_growth.csv", index=False)

# 6. Ambiguous Category Shift (0 <-> 1 flipped without metadata)
amb_df = baseline.copy()
amb_df["is_member"] = 1 - amb_df["is_member"]
amb_df.to_csv("data/candidate_ambiguous.csv", index=False)

print("SUCCESS! Created files in data/:", os.listdir("data"))