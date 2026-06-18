"""
ONNX vs Pickle Model Comparison Script
Compares predictions from ONNX model with Python pickle models
Generates a comprehensive comparison image
"""
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.table import Table
import json
import joblib
import warnings
warnings.filterwarnings('ignore')
import sys

# Force UTF-8 for output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 70)
print("ONNX vs PICKLE Model Comparison")
print("=" * 70)

# --- 1. Load models and artifacts ------------------------------------------
print("\n[1/6] Loading models and artifacts...")

cls_model = joblib.load('outputs/traffic_cls_model.pkl')
reg_model = joblib.load('outputs/traffic_reg_model.pkl')
scaler = joblib.load('outputs/scaler.pkl')
label_encoder = joblib.load('outputs/label_encoder.pkl')
ohe = joblib.load('outputs/ohe.pkl')

with open('outputs/feature_cols.json') as f:
    feature_cols = json.load(f)

import onnxruntime as ort
ort_session = ort.InferenceSession('outputs/traffic_model.onnx')

print("  [+] Classification Model: %s (%d classes)" % (type(cls_model).__name__, len(cls_model.classes_)))
print("  [+] Regression Model: %s" % type(reg_model).__name__)
print("  [+] Scaler: %s (%d features)" % (type(scaler).__name__, scaler.n_features_in_))
print("  [+] Label Encoder: %s" % label_encoder.classes_.tolist())
print("  [+] OHE: %d features" % len(ohe.get_feature_names_out()))
print("  [+] ONNX Model: %s -> %s" % (ort_session.get_inputs()[0].name, ort_session.get_outputs()[0].name))
print("  [+] Feature Columns: %d features" % len(feature_cols))

# --- 2. Create Test Scenarios ----------------------------------------------
print("\n[2/6] Creating test scenarios...")

# event_cause mappings (approximate)
event_cause_map = {
    "vehicle_breakdown": 0, "accident": 1, "breakdown": 2,
    "special_event": 3, "road_construction": 4, "others": 5
}
zone_map = {"Central Zone 1": 0, "Central Zone 2": 1, "Outer Zone": 2}
veh_type_map = {"car": 0, "bus": 1, "truck": 2}

scenarios = [
    {
        "name": "Early Morning - Low Traffic",
        "desc": "6 AM, weekday, low attendance, clear weather, planned event",
        "numerical": [6, 2, 6, 0, 500, 0, 22, 0.8, 200, 30],
        "categorical": {
            "event_cause": "vehicle_breakdown", "zone": "Central Zone 2",
            "veh_type": "car", "event_type": "planned",
            "priority": "High", "status": "active", "weather_condition": "Clear"
        }
    },
    {
        "name": "Morning Rush Hour",
        "desc": "9 AM, weekday, high attendance, clear weather, accident",
        "numerical": [9, 3, 6, 0, 5000, 0, 28, 0.6, 50, 80],
        "categorical": {
            "event_cause": "accident", "zone": "Central Zone 1",
            "veh_type": "bus", "event_type": "unplanned",
            "priority": "High", "status": "active", "weather_condition": "Clear"
        }
    },
    {
        "name": "Rainy Evening - Heavy Congestion",
        "desc": "6 PM, weekday, medium, heavy rain, unplanned event",
        "numerical": [18, 4, 6, 0, 8000, 15, 24, 0.5, 30, 120],
        "categorical": {
            "event_cause": "breakdown", "zone": "Outer Zone",
            "veh_type": "truck", "event_type": "unplanned",
            "priority": "High", "status": "active", "weather_condition": "Heavy Rain"
        }
    },
    {
        "name": "Concert Night - Special Event",
        "desc": "8 PM, weekend, very high, cloudy, planned event",
        "numerical": [20, 6, 12, 1, 15000, 0, 26, 0.7, 100, 60],
        "categorical": {
            "event_cause": "special_event", "zone": "Central Zone 2",
            "veh_type": "car", "event_type": "planned",
            "priority": "High", "status": "active", "weather_condition": "Cloudy"
        }
    },
    {
        "name": "Late Night - Resolved Incident",
        "desc": "11 PM, weekday, low, clear, resolved status",
        "numerical": [23, 1, 6, 0, 100, 0, 20, 0.9, 300, 10],
        "categorical": {
            "event_cause": "vehicle_breakdown", "zone": "Central Zone 1",
            "veh_type": "car", "event_type": "unplanned",
            "priority": "Low", "status": "resolved", "weather_condition": "Clear"
        }
    },
    {
        "name": "Road Construction - Closed",
        "desc": "2 PM, weekday, medium, rainy, construction",
        "numerical": [14, 5, 6, 0, 3000, 5, 18, 0.3, 20, 90],
        "categorical": {
            "event_cause": "road_construction", "zone": "Outer Zone",
            "veh_type": "truck", "event_type": "planned",
            "priority": "Unknown", "status": "closed", "weather_condition": "Rainy"
        }
    },
]

def build_features(scenario):
    """Build 21-feature vector from scenario data"""
    num = scenario["numerical"]
    cat = scenario["categorical"]

    # Numerical features (10)
    hour, day_of_week, month, is_weekend = num[0], num[1], num[2], num[3]
    attendance, rainfall, temperature = num[4], num[5], num[6]
    road_capacity, nearby_parking = num[7], num[8]
    historical_congestion = num[9]

    # Label-encoded features (3)
    event_cause_enc = event_cause_map.get(cat["event_cause"], 0)
    zone_enc = zone_map.get(cat["zone"], 0)
    veh_type_enc = veh_type_map.get(cat["veh_type"], 0)

    # OHE features (8)
    event_type_unplanned = 1.0 if cat["event_type"] == "unplanned" else 0.0
    priority_Low = 1.0 if cat["priority"] == "Low" else 0.0
    priority_Unknown = 1.0 if cat["priority"] == "Unknown" else 0.0
    status_closed = 1.0 if cat["status"] == "closed" else 0.0
    status_resolved = 1.0 if cat["status"] == "resolved" else 0.0
    weather_Cloudy = 1.0 if cat["weather_condition"] == "Cloudy" else 0.0
    weather_HeavyRain = 1.0 if cat["weather_condition"] == "Heavy Rain" else 0.0
    weather_Rainy = 1.0 if cat["weather_condition"] == "Rainy" else 0.0

    # Scale numerical features
    num_array = np.array([[hour, day_of_week, month, is_weekend, attendance,
                           rainfall, temperature, road_capacity, nearby_parking,
                           historical_congestion]])
    num_scaled = scaler.transform(num_array)[0]

    # Assemble full feature vector (21 features)
    features = [
        num_scaled[0], num_scaled[1], num_scaled[2], num_scaled[3],
        num_scaled[4], num_scaled[5], num_scaled[6], num_scaled[7],
        num_scaled[8], num_scaled[9],
        event_cause_enc, zone_enc, veh_type_enc,
        event_type_unplanned, priority_Low, priority_Unknown,
        status_closed, status_resolved,
        weather_Cloudy, weather_HeavyRain, weather_Rainy
    ]

    return np.array(features, dtype=np.float32)

feature_matrix = np.array([build_features(s) for s in scenarios])

# --- 3. Run predictions ---------------------------------------------------
print("\n[3/6] Running predictions...")

# ONNX predictions
onnx_outputs = ort_session.run(None, {"float_input": feature_matrix})
onnx_preds = onnx_outputs[0].flatten()

# Pickle Classification predictions
cls_preds = cls_model.predict(feature_matrix)
cls_probs = cls_model.predict_proba(feature_matrix)

# Pickle Regression predictions
reg_preds = reg_model.predict(feature_matrix)

# Decode labels
label_names = label_encoder.inverse_transform(cls_preds)

print("  [+] ONNX predictions: %s" % onnx_preds)
print("  [+] CLS predictions (raw): %s -> labels: %s" % (cls_preds, label_names))
print("  [+] REG predictions: %s" % reg_preds)

# --- 4. Create comparison image -------------------------------------------
print("\n[4/6] Generating comparison chart...")

fig = plt.figure(figsize=(22, 20))
fig.suptitle("ONNX vs Pickle Model Comparison - Traffic Congestion Prediction",
             fontsize=18, fontweight='bold', y=0.98)

gs = fig.add_gridspec(4, 2, hspace=0.35, wspace=0.3)

# -- Panel 1: ONNX vs REG Scatter --
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(range(len(onnx_preds)), onnx_preds, s=120, c='#2196F3', marker='o',
            label='ONNX Prediction', edgecolors='white', linewidth=1.5, zorder=5)
ax1.scatter(range(len(reg_preds)), reg_preds, s=120, c='#FF9800', marker='s',
            label='CatBoost (Pickle)', edgecolors='white', linewidth=1.5, zorder=5)
ax1.set_xticks(range(len(scenarios)))
ax1.set_xticklabels([s["name"] for s in scenarios], rotation=30, ha='right', fontsize=8)
ax1.set_ylabel('Predicted Congestion / Delay Value', fontsize=10)
ax1.set_title('ONNX vs Regression Model (Numerical Output)', fontsize=12, fontweight='bold')
ax1.legend(fontsize=9, loc='upper right')
ax1.grid(True, alpha=0.3)
ax1.set_axisbelow(True)

for i in range(len(onnx_preds)):
    diff = abs(onnx_preds[i] - reg_preds[i])
    ax1.annotate('d=%.4f' % diff, (i, (onnx_preds[i] + reg_preds[i])/2),
                fontsize=7, ha='center', va='bottom', color='#666',
                fontweight='bold')

# -- Panel 2: Classification Probabilities --
ax2 = fig.add_subplot(gs[0, 1])
x = np.arange(len(scenarios))
width = 0.25
colors = ['#4CAF50', '#FFC107', '#F44336']
class_names = label_encoder.classes_

for i in range(len(class_names)):
    bars = ax2.bar(x + i * width, cls_probs[:, i], width,
                   label='P(%s)' % class_names[i], color=colors[i], alpha=0.85,
                   edgecolor='white', linewidth=0.5)

ax2.set_xticks(x + width)
ax2.set_xticklabels([s["name"] for s in scenarios], rotation=30, ha='right', fontsize=8)
ax2.set_ylabel('Probability', fontsize=10)
ax2.set_title('Classification: Congestion Level Probabilities', fontsize=12, fontweight='bold')
ax2.legend(fontsize=9, loc='upper right')
ax2.set_ylim(0, 1.15)
ax2.grid(True, alpha=0.3, axis='y')
ax2.set_axisbelow(True)

# -- Panel 3: Detailed Table --
ax3 = fig.add_subplot(gs[1, :])
ax3.axis('off')

table_data = []
table_data.append(['Scenario', 'ONNX Output', 'CatBoost (REG)', 'REG Diff',
                   'CLS Class', 'CLS Label', 'CLS Confidence'])

for i, s in enumerate(scenarios):
    cls_conf = np.max(cls_probs[i])
    cls_label_idx = cls_preds[i]
    cls_label = label_encoder.inverse_transform([cls_label_idx])[0]
    reg_diff = abs(onnx_preds[i] - reg_preds[i])
    table_data.append([
        s["name"][:28],
        '%.4f' % onnx_preds[i],
        '%.4f' % reg_preds[i],
        '%.4f' % reg_diff,
        '%d' % cls_label_idx,
        cls_label,
        '%.1f%%' % (cls_conf * 100)
    ])

table = ax3.table(cellText=table_data[1:], colLabels=table_data[0],
                  cellLoc='center', loc='center',
                  colWidths=[0.25, 0.12, 0.12, 0.10, 0.10, 0.10, 0.12])

table.auto_set_font_size(False)
table.set_fontsize(8)

for j in range(len(table_data[0])):
    cell = table[0, j]
    cell.set_facecolor('#1a237e')
    cell.set_text_props(weight='bold', color='white')

for i in range(1, len(table_data)):
    for j in range(len(table_data[0])):
        cell = table[i, j]
        if i % 2 == 0:
            cell.set_facecolor('#f5f5f5')
        else:
            cell.set_facecolor('white')

ax3.set_title('Detailed Prediction Comparison Table', fontsize=12, fontweight='bold', pad=20)

# -- Panel 4: Summary Statistics --
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')

reg_max_diff = np.max(np.abs(onnx_preds - reg_preds))
reg_mean_diff = np.mean(np.abs(onnx_preds - reg_preds))
reg_rmse = np.sqrt(np.mean((onnx_preds - reg_preds)**2))

summary_lines = []
summary_lines.append(("=" * 60, "", ""))
summary_lines.append(("COMPARISON SUMMARY", "", ""))
summary_lines.append(("=" * 60, "", ""))
summary_lines.append(("", "", ""))
summary_lines.append(("ONNX vs CatBoost Regression:", "", ""))
summary_lines.append(("  . Max Absolute Difference:  %.6f" % reg_max_diff, "", ""))
summary_lines.append(("  . Mean Absolute Difference: %.6f" % reg_mean_diff, "", ""))
summary_lines.append(("  . RMSE:                    %.6f" % reg_rmse, "", ""))
summary_lines.append(("", "", ""))
summary_lines.append(("Classification Results (from Pickle RandomForest):", "", ""))

for i, s in enumerate(scenarios):
    cls_conf = np.max(cls_probs[i])
    cls_label = label_encoder.inverse_transform([cls_preds[i]])[0]
    summary_lines.append(("  . %s:  %s  (conf: %.1f%%)" % (s['name'], cls_label, cls_conf * 100), "", ""))

summary_lines.append(("", "", ""))
summary_lines.append(("ANALYSIS:", "", ""))

if reg_max_diff < 0.01:
    match_text = "EXCELLENT MATCH - ONNX and Pickle predictions are nearly identical!"
elif reg_max_diff < 0.1:
    match_text = "GOOD MATCH - Small differences (likely float precision)"
else:
    match_text = "SIGNIFICANT DIFFERENCES - Check model export process"
summary_lines.append(("  %s" % match_text, "", ""))

summary_lines.append(("", "", ""))
summary_lines.append(("NOTE: ONNX model output: single float -> appears to be the regression model exported", "", ""))
summary_lines.append(("NOTE: Pickle has TWO models: RandomForestClassifier (3 classes) + CatBoostRegressor", "", ""))
summary_lines.append(("NOTE: For complete comparison, consider exporting BOTH models to ONNX", "", ""))

y_pos = 0.95
line_height = 0.030
for line, _, _ in summary_lines:
    if line.startswith("="):
        ax4.text(0.5, y_pos, line, fontsize=10, ha='center', color='#333',
                fontfamily='monospace', transform=ax4.transAxes)
    elif line in ["COMPARISON SUMMARY", "ANALYSIS:"]:
        ax4.text(0.5, y_pos, line, fontsize=12, ha='center', fontweight='bold',
                transform=ax4.transAxes)
    elif line.startswith("EXCELLENT") or line.startswith("GOOD") or line.startswith("SIGNIFICANT"):
        ax4.text(0.5, y_pos, line, fontsize=10, ha='center', fontweight='bold',
                transform=ax4.transAxes)
    else:
        ax4.text(0.1, y_pos, line, fontsize=9, transform=ax4.transAxes,
                fontfamily='monospace')
    y_pos -= line_height

# -- Panel 5: Difference Bar Chart --
ax5 = fig.add_subplot(gs[3, :])
diff_reg = np.abs(onnx_preds - reg_preds)
bar_colors = ['#4CAF50' if d < 0.001 else '#FF9800' if d < 0.01 else '#F44336' for d in diff_reg]
bars = ax5.bar(range(len(diff_reg)), diff_reg, color=bar_colors, edgecolor='white', linewidth=0.5)
ax5.set_xticks(range(len(scenarios)))
ax5.set_xticklabels([s["name"] for s in scenarios], rotation=25, ha='right', fontsize=8)
ax5.set_ylabel('Absolute Difference', fontsize=10)
ax5.set_title('ONNX vs Pickle - Prediction Differences (Mean: %.6f)' % reg_mean_diff,
              fontsize=12, fontweight='bold')
ax5.grid(True, alpha=0.3, axis='y')
ax5.set_axisbelow(True)

for i, (bar, diff) in enumerate(zip(bars, diff_reg)):
    ax5.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(diff_reg)*0.02,
             '%.6f' % diff, ha='center', va='bottom', fontsize=7, rotation=45)

legend_elements = [
    mpatches.Patch(color='#4CAF50', label='Near Identical (< 0.001)'),
    mpatches.Patch(color='#FF9800', label='Minor Diff (0.001-0.01)'),
    mpatches.Patch(color='#F44336', label='Significant Diff (> 0.01)')
]
ax5.legend(handles=legend_elements, fontsize=8, loc='upper right')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig('outputs/onnx_vs_pickle_comparison.png', dpi=200, bbox_inches='tight')
print("\n[+] Comparison image saved to: outputs/onnx_vs_pickle_comparison.png")
plt.close()

# --- 5. Print Summary to Console ------------------------------------------
print("\n" + "=" * 70)
print("COMPARISON RESULTS")
print("=" * 70)
print("\n  ONNX vs CatBoost Regression:")
print("    Max Diff:  %.6f" % reg_max_diff)
print("    Mean Diff: %.6f" % reg_mean_diff)
print("    RMSE:      %.6f" % reg_rmse)
print("\n  Classification Predictions:")
for i, s in enumerate(scenarios):
    cls_label = label_encoder.inverse_transform([cls_preds[i]])[0]
    cls_conf = np.max(cls_probs[i])
    print("    %s: %s (%.1f%%)" % (s['name'], cls_label, cls_conf * 100))

print("\n  %s" % match_text)
print("\n  Total scenarios tested: %d" % len(scenarios))
print("  Image saved to: outputs/onnx_vs_pickle_comparison.png")
print("\n" + "=" * 70)
