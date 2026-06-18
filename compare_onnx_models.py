"""
Updated ONNX Model Comparison Script
Compares all 3 ONNX models against their pickle counterparts
Generates a comprehensive comparison image
"""
import numpy as np
import json
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# ── 1. Load everything ────────────────────────────────────────────────────
print("=" * 70)
print("UPDATED ONNX MODEL COMPARISON - All Models")
print("=" * 70)

print("\n[1/5] Loading models and artifacts...")
cls_model = joblib.load('outputs/traffic_cls_model.pkl')   # RandomForestClassifier
reg_model = joblib.load('outputs/traffic_reg_model.pkl')   # CatBoostRegressor
scaler = joblib.load('outputs/scaler.pkl')
label_encoder = joblib.load('outputs/label_encoder.pkl')

with open('outputs/feature_cols.json') as f:
    feature_cols = json.load(f)
N_FEATURES = len(feature_cols)

import onnxruntime as ort

# Load all 3 ONNX models
onnx_sessions = {}
for name in ['traffic_model.onnx', 'traffic_reg_model.onnx', 'traffic_cls_model.onnx']:
    path = 'outputs/' + name
    if os.path.exists(path):
        sess = ort.InferenceSession(path)
        inp = sess.get_inputs()[0]
        onnx_sessions[name] = {
            'session': sess,
            'input_name': inp.name,
            'input_shape': inp.shape,
            'n_outputs': len(sess.get_outputs()),
            'output_names': [o.name for o in sess.get_outputs()]
        }
        print("  [+] %s: input='%s' shape=%s outputs=%d" % (
            name, inp.name, inp.shape, len(sess.get_outputs())))
    else:
        print("  [!] %s not found" % name)

print("  [+] Feature count: %d" % N_FEATURES)
print("  [+] Label classes: %s" % label_encoder.classes_.tolist())

# ── 2. Test scenarios (6 standard) ──────────────────────────────────────
print("\n[2/5] Creating test scenarios...")

event_cause_map = {
    "vehicle_breakdown": 0, "accident": 1, "breakdown": 2,
    "special_event": 3, "road_construction": 4, "others": 5
}
zone_map = {"Central Zone 1": 0, "Central Zone 2": 1, "Outer Zone": 2}
veh_type_map = {"car": 0, "bus": 1, "truck": 2}

scenarios = [
    ("Early Morning - Low Traffic", [6, 2, 6, 0, 500, 0, 22, 0.8, 200, 30],
     {"event_cause": "vehicle_breakdown", "zone": "Central Zone 2", "veh_type": "car",
      "event_type": "planned", "priority": "High", "status": "active", "weather_condition": "Clear"}),
    ("Morning Rush Hour", [9, 3, 6, 0, 5000, 0, 28, 0.6, 50, 80],
     {"event_cause": "accident", "zone": "Central Zone 1", "veh_type": "bus",
      "event_type": "unplanned", "priority": "High", "status": "active", "weather_condition": "Clear"}),
    ("Rainy Evening - Congestion", [18, 4, 6, 0, 8000, 15, 24, 0.5, 30, 120],
     {"event_cause": "breakdown", "zone": "Outer Zone", "veh_type": "truck",
      "event_type": "unplanned", "priority": "High", "status": "active", "weather_condition": "Heavy Rain"}),
    ("Concert Night - Special", [20, 6, 12, 1, 15000, 0, 26, 0.7, 100, 60],
     {"event_cause": "special_event", "zone": "Central Zone 2", "veh_type": "car",
      "event_type": "planned", "priority": "High", "status": "active", "weather_condition": "Cloudy"}),
    ("Late Night - Resolved", [23, 1, 6, 0, 100, 0, 20, 0.9, 300, 10],
     {"event_cause": "vehicle_breakdown", "zone": "Central Zone 1", "veh_type": "car",
      "event_type": "unplanned", "priority": "Low", "status": "resolved", "weather_condition": "Clear"}),
    ("Road Construction - Closed", [14, 5, 6, 0, 3000, 5, 18, 0.3, 20, 90],
     {"event_cause": "road_construction", "zone": "Outer Zone", "veh_type": "truck",
      "event_type": "planned", "priority": "Unknown", "status": "closed", "weather_condition": "Rainy"}),
]

def build_features(num_vals, cat_vals):
    h, d, m, w = num_vals[0], num_vals[1], num_vals[2], num_vals[3]
    a, r, t = num_vals[4], num_vals[5], num_vals[6]
    rc, np_ = num_vals[7], num_vals[8]
    hc = num_vals[9]
    ec_enc = event_cause_map.get(cat_vals["event_cause"], 0)
    z_enc = zone_map.get(cat_vals["zone"], 0)
    vt_enc = veh_type_map.get(cat_vals["veh_type"], 0)
    eu = 1.0 if cat_vals["event_type"] == "unplanned" else 0.0
    pl = 1.0 if cat_vals["priority"] == "Low" else 0.0
    pu = 1.0 if cat_vals["priority"] == "Unknown" else 0.0
    sc = 1.0 if cat_vals["status"] == "closed" else 0.0
    sr = 1.0 if cat_vals["status"] == "resolved" else 0.0
    wc = 1.0 if cat_vals["weather_condition"] == "Cloudy" else 0.0
    wh = 1.0 if cat_vals["weather_condition"] == "Heavy Rain" else 0.0
    wr = 1.0 if cat_vals["weather_condition"] == "Rainy" else 0.0
    num_arr = np.array([[h, d, m, w, a, r, t, rc, np_, hc]])
    num_scaled = scaler.transform(num_arr)[0]
    return np.array([
        num_scaled[0], num_scaled[1], num_scaled[2], num_scaled[3],
        num_scaled[4], num_scaled[5], num_scaled[6], num_scaled[7],
        num_scaled[8], num_scaled[9],
        ec_enc, z_enc, vt_enc,
        eu, pl, pu, sc, sr, wc, wh, wr
    ], dtype=np.float32)

feature_matrix = np.array([build_features(n, c) for n, c in [s[1:] for s in scenarios]])
scenario_names = [s[0] for s in scenarios]

# ── 3. Run all predictions ──────────────────────────────────────────────
print("\n[3/5] Running predictions...")

results = {}

# --- Pickle predictions ---
pickle_reg = reg_model.predict(feature_matrix)           # CatBoost
pickle_cls = cls_model.predict(feature_matrix)            # class labels
pickle_cls_probs = cls_model.predict_proba(feature_matrix)  # class probabilities
pickle_cls_labels = label_encoder.inverse_transform(pickle_cls)

print("  [+] Pickle CatBoost (reg):    %s" % np.array2string(pickle_reg, precision=4))
print("  [+] Pickle RandomForest (cls): %s -> %s" % (pickle_cls, pickle_cls_labels))

# --- ONNX predictions ---
onnx_results = {}
for name, info in onnx_sessions.items():
    sess = info['session']
    inp_name = info['input_name']
    outputs = sess.run(None, {inp_name: feature_matrix})
    
    if info['n_outputs'] == 1:
        # Regression model (single output)
        vals = np.array(outputs[0]).flatten()
        onnx_results[name] = {'reg': vals, 'type': 'regression'}
        print("  [+] ONNX %s: %s" % (name, np.array2string(vals, precision=4)))
    elif info['n_outputs'] >= 2:
        # Classification model (label + probabilities)
        labels = np.array(outputs[0]).flatten().astype(int)
        
        # Handle ZipMap format for probabilities
        probs_raw = outputs[1]
        if isinstance(probs_raw, list) and len(probs_raw) > 0 and isinstance(probs_raw[0], dict):
            probs = np.array([list(d.values()) for d in probs_raw], dtype=np.float32)
        else:
            probs = np.array(probs_raw)
        
        onnx_results[name] = {
            'type': 'classification',
            'labels': labels,
            'probs': probs
        }
        print("  [+] ONNX %s: labels=%s" % (name, labels))
        print("  [+]   probs=\n%s" % np.array2string(probs, precision=4))

# ── 4. Build comparison image ──────────────────────────────────────────
print("\n[4/5] Generating comparison image...")

fig = plt.figure(figsize=(24, 22))
fig.suptitle("ONNX Models Verification - All 3 Models vs Pickle Sources",
             fontsize=16, fontweight='bold', y=0.98)
gs = fig.add_gridspec(5, 2, hspace=0.35, wspace=0.3)

# ── Panel 1: Regression Model Comparison ──
ax1 = fig.add_subplot(gs[0, 0])
colors_reg = {'pickle': '#4CAF50', 'traffic_model.onnx': '#2196F3',
              'traffic_reg_model.onnx': '#FF9800'}
x = np.arange(len(scenarios))

# Pickle (CatBoost) - reference
ax1.plot(x, pickle_reg, 'o-', color=colors_reg['pickle'], markersize=10, 
         linewidth=2, label='Pickle CatBoost (ground truth)', zorder=5)

# ONNX regression models
for name in ['traffic_model.onnx', 'traffic_reg_model.onnx']:
    if name in onnx_results and onnx_results[name]['type'] == 'regression':
        vals = onnx_results[name]['reg']
        marker = 's' if 'reg_model' in name else '^'
        ax1.plot(x, vals, marker + '--', color=colors_reg[name], markersize=9,
                 linewidth=1.5, label='ONNX ' + name, zorder=4)

ax1.set_xticks(x)
ax1.set_xticklabels(scenario_names, rotation=25, ha='right', fontsize=7)
ax1.set_ylabel('Predicted Value', fontsize=10)
ax1.set_title('Regression Models: ONNX vs Pickle CatBoost', fontsize=11, fontweight='bold')
ax1.legend(fontsize=8, loc='upper right')
ax1.grid(True, alpha=0.3)
ax1.set_axisbelow(True)

# Add diff annotations
if 'traffic_reg_model.onnx' in onnx_results:
    reg_match = onnx_results['traffic_reg_model.onnx']['reg']
    for i in range(len(x)):
        d = abs(reg_match[i] - pickle_reg[i])
        ax1.annotate('d=%.6f' % d, (i, (reg_match[i] + pickle_reg[i])/2),
                    fontsize=6, ha='center', va='bottom', color='#FF9800', fontweight='bold')

# ── Panel 2: Classification Probabilities ──
ax2 = fig.add_subplot(gs[0, 1])
width = 0.22
class_names = label_encoder.classes_

if 'traffic_cls_model.onnx' in onnx_results:
    cls_onnx = onnx_results['traffic_cls_model.onnx']
    onnx_probs = cls_onnx['probs']
    onnx_labels = cls_onnx['labels']
else:
    onnx_probs = np.zeros_like(pickle_cls_probs)
    onnx_labels = np.zeros(len(scenarios))

for i in range(len(class_names)):
    # Pickle bars
    ax2.bar(x + i*width - 0.11, pickle_cls_probs[:, i], width,
            label='Pickle P(%s)' % class_names[i],
            color=['#4CAF50', '#FFC107', '#F44336'][i], alpha=0.9,
            edgecolor='white', linewidth=0.5)
    # ONNX bars (hatched)
    ax2.bar(x + i*width + 0.11, onnx_probs[:, i], width,
            label='ONNX P(%s)' % class_names[i],
            color=['#66BB6A', '#FFD54F', '#EF5350'][i], alpha=0.5,
            edgecolor='black', linewidth=0.5, hatch='///')

ax2.set_xticks(x + width)
ax2.set_xticklabels(scenario_names, rotation=25, ha='right', fontsize=7)
ax2.set_ylabel('Probability', fontsize=10)
ax2.set_title('Classification: Pickle vs ONNX Probabilities', fontsize=11, fontweight='bold')
ax2.legend(fontsize=7, loc='upper right', ncol=2)
ax2.set_ylim(0, 1.15)
ax2.grid(True, alpha=0.3, axis='y')
ax2.set_axisbelow(True)

# ── Panel 3: Comparison Table ──
ax3 = fig.add_subplot(gs[1:3, :])
ax3.axis('off')

# Build header and data rows
headers = ['Scenario',
           'Pickle CatBoost', 'ONNX traffic_reg_model', 'REG Diff',
           'ONNX traffic_model', 'vs CatBoost Diff',
           'Pickle CLS', 'ONNX CLS', 'Match?']

pickle_labels_str = [label_encoder.inverse_transform([p])[0] for p in pickle_cls]

rows = []
for i in range(len(scenarios)):
    # REG values
    pickle_reg_v = pickle_reg[i]
    onnx_reg_v = onnx_results.get('traffic_reg_model.onnx', {}).get('reg', [0])[i] if 'traffic_reg_model.onnx' in onnx_results else float('nan')
    onnx_orig_v = onnx_results.get('traffic_model.onnx', {}).get('reg', [0])[i] if 'traffic_model.onnx' in onnx_results else float('nan')
    
    reg_diff = abs(pickle_reg_v - onnx_reg_v)
    orig_diff = abs(pickle_reg_v - onnx_orig_v)
    
    # CLS values
    pickle_cls_v = pickle_labels_str[i]
    onnx_cls_v = label_encoder.inverse_transform([onnx_labels[i]])[0] if 'traffic_cls_model.onnx' in onnx_results else '?'
    match = 'YES' if pickle_cls_v == onnx_cls_v else 'NO'
    
    rows.append([
        scenario_names[i][:30],
        '%.4f' % pickle_reg_v,
        '%.4f' % onnx_reg_v,
        '%.6f' % reg_diff,
        '%.4f' % onnx_orig_v,
        '%.4f' % orig_diff,
        pickle_cls_v,
        onnx_cls_v,
        match
    ])

table_data = [headers] + rows
table = ax3.table(cellText=rows, colLabels=headers,
                  cellLoc='center', loc='center',
                  colWidths=[0.18, 0.10, 0.13, 0.09, 0.12, 0.11, 0.08, 0.08, 0.07])
table.auto_set_font_size(False)
table.set_fontsize(7.5)

for j in range(len(headers)):
    cell = table[0, j]
    cell.set_facecolor('#1a237e')
    cell.set_text_props(weight='bold', color='white')

for i in range(len(rows)):
    for j in range(len(headers)):
        cell = table[i+1, j]
        cell.set_facecolor('#e8f5e9' if rows[i][8] == 'YES' else '#ffebee' if i % 2 == 0 else '#f5f5f5')

ax3.set_title('Prediction Comparison Table', fontsize=12, fontweight='bold', pad=20)

# ── Panel 4: Summary Stats ──
ax4 = fig.add_subplot(gs[3, :])
ax4.axis('off')

lines = []
lines.append(("MODEL VERIFICATION SUMMARY", "", ""))
lines.append(("=" * 60, "", ""))

if 'traffic_reg_model.onnx' in onnx_results:
    reg_d = np.abs(onnx_results['traffic_reg_model.onnx']['reg'] - pickle_reg)
    lines.append(("", "", ""))
    lines.append(("1. CatBoost Regressor -> traffic_reg_model.onnx", "", ""))
    lines.append(("   Max diff:  %.8f" % np.max(reg_d), "", ""))
    lines.append(("   Mean diff: %.8f" % np.mean(reg_d), "", ""))
    if np.max(reg_d) < 0.01:
        lines.append(("   STATUS: VERIFIED - predictions match (float precision)", "", ""))
    else:
        lines.append(("   STATUS: WARNING - differences detected", "", ""))

if 'traffic_cls_model.onnx' in onnx_results:
    cls_match = np.all(onnx_results['traffic_cls_model.onnx']['labels'] == pickle_cls)
    prob_d = np.abs(onnx_results['traffic_cls_model.onnx']['probs'] - pickle_cls_probs)
    lines.append(("", "", ""))
    lines.append(("2. RandomForestClassifier -> traffic_cls_model.onnx", "", ""))
    lines.append(("   Labels match: %s" % cls_match, "", ""))
    lines.append(("   Max prob diff: %.8f" % np.max(prob_d), "", ""))
    if cls_match and np.max(prob_d) < 0.01:
        lines.append(("   STATUS: VERIFIED - labels + probabilities match", "", ""))
    else:
        lines.append(("   STATUS: WARNING - classification differences", "", ""))

if 'traffic_model.onnx' in onnx_results:
    orig_d = np.abs(onnx_results['traffic_model.onnx']['reg'] - pickle_reg)
    lines.append(("", "", ""))
    lines.append(("3. traffic_model.onnx (original, RandomForestRegressor)", "", ""))
    lines.append(("   vs CatBoost pickle - Max diff: %.4f" % np.max(orig_d), "", ""))
    lines.append(("   NOTE: This was exported from a different model (RF Regressor)", "", ""))
    lines.append(("   It is NOT expected to match CatBoost predictions", "", ""))

lines.append(("", "", ""))
lines.append(("=" * 60, "", ""))
lines.append(("ALL ONNX FILES:", "", ""))
for name in ['traffic_model.onnx', 'traffic_reg_model.onnx', 'traffic_cls_model.onnx']:
    path = 'outputs/' + name
    if os.path.exists(path):
        size = os.path.getsize(path)
        lines.append(("  outputs/%s (%d KB)" % (name, size//1024), "", ""))

y_pos = 0.95
for line, _, _ in lines:
    if line.startswith("="):
        ax4.text(0.5, y_pos, line, fontsize=10, ha='center', color='#333',
                fontfamily='monospace', transform=ax4.transAxes)
    elif line in ["MODEL VERIFICATION SUMMARY"]:
        ax4.text(0.5, y_pos, line, fontsize=13, ha='center', fontweight='bold',
                transform=ax4.transAxes)
    elif line.startswith("STATUS:"):
        ax4.text(0.5, y_pos, line, fontsize=10, ha='center', fontweight='bold',
                color='#2E7D32' if 'VERIFIED' in line else '#E65100',
                transform=ax4.transAxes)
    elif line.startswith("ALL ONNX") or line.startswith("NOTE:"):
        ax4.text(0.5, y_pos, line, fontsize=9, ha='center', style='italic',
                transform=ax4.transAxes, color='#555')
    else:
        ax4.text(0.1, y_pos, line, fontsize=9, transform=ax4.transAxes,
                fontfamily='monospace')
    y_pos -= 0.028

# ── Panel 5: Difference Bar Chart ──
ax5 = fig.add_subplot(gs[4, :])

# Build grouped bar chart
ax5.set_label('Prediction Differences')
x = np.arange(len(scenarios))
width = 0.25

# Diff 1: traffic_reg_model.onnx vs CatBoost pickle
if 'traffic_reg_model.onnx' in onnx_results:
    d1 = np.abs(onnx_results['traffic_reg_model.onnx']['reg'] - pickle_reg)
    bars1 = ax5.bar(x - width, d1, width, label='reg_model vs CatBoost',
                    color='#66BB6A', edgecolor='white', linewidth=0.5)

# Diff 2: traffic_model.onnx vs CatBoost pickle
if 'traffic_model.onnx' in onnx_results:
    d2 = np.abs(onnx_results['traffic_model.onnx']['reg'] - pickle_reg)
    bars2 = ax5.bar(x, d2, width, label='traffic_model vs CatBoost (expected diff)',
                    color='#FFB74D', edgecolor='white', linewidth=0.5)

ax5.set_xticks(x)
ax5.set_xticklabels(scenario_names, rotation=25, ha='right', fontsize=8)
ax5.set_ylabel('Absolute Difference', fontsize=10)
ax5.set_title('Prediction Differences from Pickle Ground Truth', fontsize=11, fontweight='bold')
ax5.legend(fontsize=8)
ax5.grid(True, alpha=0.3, axis='y')
ax5.set_axisbelow(True)

# Add values on bars
if 'traffic_reg_model.onnx' in onnx_results:
    for i, (bar, val) in enumerate(zip(bars1, d1)):
        ax5.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(max(d1), max(d2))*0.02,
                 '%.6f' % val, ha='center', va='bottom', fontsize=6, rotation=45,
                 color='#2E7D32' if val < 0.01 else '#E65100', fontweight='bold')

plt.tight_layout(rect=[0, 0, 1, 0.95])
plt.savefig('outputs/onnx_vs_pickle_comparison.png', dpi=200, bbox_inches='tight')
print("\n[+] Updated comparison image saved to: outputs/onnx_vs_pickle_comparison.png")
plt.close()

# ── 5. Print console summary ──────────────────────────────────────────
print("\n[5/5] Results Summary")
print("=" * 60)
if 'traffic_reg_model.onnx' in onnx_results:
    reg_d = np.abs(onnx_results['traffic_reg_model.onnx']['reg'] - pickle_reg)
    print("\n[CatBoost -> traffic_reg_model.onnx]")
    print("  Max diff:  %.8f" % np.max(reg_d))
    print("  Mean diff: %.8f" % np.mean(reg_d))
    print("  STATUS: VERIFIED" if np.max(reg_d) < 0.01 else "  STATUS: WARNING")

if 'traffic_cls_model.onnx' in onnx_results:
    cls_match = np.all(onnx_results['traffic_cls_model.onnx']['labels'] == pickle_cls)
    prob_d = np.abs(onnx_results['traffic_cls_model.onnx']['probs'] - pickle_cls_probs)
    print("\n[RandomForestClassifier -> traffic_cls_model.onnx]")
    print("  Labels match: %s" % cls_match)
    print("  Max prob diff: %.8f" % np.max(prob_d))
    print("  STATUS: VERIFIED" if cls_match and np.max(prob_d) < 0.01 else "  STATUS: WARNING")

if 'traffic_model.onnx' in onnx_results:
    orig_d = np.abs(onnx_results['traffic_model.onnx']['reg'] - pickle_reg)
    print("\n[traffic_model.onnx (original RF Regressor)]")
    print("  vs CatBoost - Max diff: %.4f" % np.max(orig_d))
    print("  NOTE: Different model architecture - expected to differ")

print("\n" + "=" * 60)
print("Updated image: outputs/onnx_vs_pickle_comparison.png")
print("=" * 60)
