"""
Export CatBoost and RandomForestClassifier to separate ONNX files
Verified against original pickle models
"""
import numpy as np
import json
import joblib
import warnings
warnings.filterwarnings('ignore')
import os

print("=" * 70)
print("Exporting CatBoost + RandomForestClassifier to ONNX")
print("=" * 70)

# --- 1. Load models and artifacts ----------------------------------------
print("\n[1/5] Loading models and artifacts...")

cls_model = joblib.load('outputs/traffic_cls_model.pkl')  # RandomForestClassifier
reg_model = joblib.load('outputs/traffic_reg_model.pkl')  # CatBoostRegressor
scaler = joblib.load('outputs/scaler.pkl')                # StandardScaler
label_encoder = joblib.load('outputs/label_encoder.pkl')  # ['High', 'Low', 'Medium']
ohe = joblib.load('outputs/ohe.pkl')                      # OneHotEncoder

with open('outputs/feature_cols.json') as f:
    feature_cols = json.load(f)

N_FEATURES = len(feature_cols)
print("  [+] Classification Model: RandomForestClassifier (%d classes: %s)" % (len(cls_model.classes_), label_encoder.classes_.tolist()))
print("  [+] Regression Model: CatBoostRegressor")
print("  [+] Feature count: %d" % N_FEATURES)
print("  [+] Scaler features: %d" % scaler.n_features_in_)

# --- 2. Export CatBoost Regressor to ONNX ---------------------------------
print("\n[2/5] Exporting CatBoost Regressor to ONNX...")

try:
    reg_model.save_model(
        'outputs/traffic_reg_model.onnx',
        format="onnx",
        export_parameters={
            'onnx_domain': 'ai.catboost',
            'onnx_model_version': 1,
            'onnx_doc_string': 'CatBoost traffic congestion regression model'
        }
    )
    print("  [+] Saved: outputs/traffic_reg_model.onnx")
except Exception as e:
    print("  [!] CatBoost native ONNX export failed: %s" % e)
    print("  [!] Trying onnxmltools fallback...")
    try:
        import onnxmltools
        initial_type = [('float_input', onnxmltools.convert.common.data_types.FloatTensorType([None, N_FEATURES]))]
        onnx_model = onnxmltools.convert_catboost(reg_model, initial_types=initial_type)
        with open('outputs/traffic_reg_model.onnx', 'wb') as f:
            f.write(onnx_model.SerializeToString())
        print("  [+] Saved (onnxmltools): outputs/traffic_reg_model.onnx")
    except Exception as e2:
        print("  [!] onnxmltools also failed: %s" % e2)

# --- 3. Export RandomForestClassifier to ONNX -----------------------------
print("\n[3/5] Exporting RandomForestClassifier to ONNX...")

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_type = [('float_input', FloatTensorType([None, N_FEATURES]))]
    onnx_cls = convert_sklearn(cls_model, initial_types=initial_type)

    with open('outputs/traffic_cls_model.onnx', 'wb') as f:
        f.write(onnx_cls.SerializeToString())
    print("  [+] Saved: outputs/traffic_cls_model.onnx")
except Exception as e:
    print("  [!] Failed to export classifier to ONNX: %s" % e)

# --- 4. Verify exports ----------------------------------------------------
print("\n[4/5] Verifying ONNX exports against pickle models...")

import onnxruntime as ort

# Create test data (same as previous comparison)
event_cause_map = {
    "vehicle_breakdown": 0, "accident": 1, "breakdown": 2,
    "special_event": 3, "road_construction": 4, "others": 5
}
zone_map = {"Central Zone 1": 0, "Central Zone 2": 1, "Outer Zone": 2}
veh_type_map = {"car": 0, "bus": 1, "truck": 2}

def build_features(num, cat):
    h, d, m, w = num[0], num[1], num[2], num[3]
    a, r, t = num[4], num[5], num[6]
    rc, np_ = num[7], num[8]
    hc = num[9]
    
    ec_enc = event_cause_map.get(cat["event_cause"], 0)
    z_enc = zone_map.get(cat["zone"], 0)
    vt_enc = veh_type_map.get(cat["veh_type"], 0)
    
    eu = 1.0 if cat["event_type"] == "unplanned" else 0.0
    pl = 1.0 if cat["priority"] == "Low" else 0.0
    pu = 1.0 if cat["priority"] == "Unknown" else 0.0
    sc = 1.0 if cat["status"] == "closed" else 0.0
    sr = 1.0 if cat["status"] == "resolved" else 0.0
    wc = 1.0 if cat["weather_condition"] == "Cloudy" else 0.0
    wh = 1.0 if cat["weather_condition"] == "Heavy Rain" else 0.0
    wr = 1.0 if cat["weather_condition"] == "Rainy" else 0.0
    
    num_arr = np.array([[h, d, m, w, a, r, t, rc, np_, hc]])
    num_scaled = scaler.transform(num_arr)[0]
    
    return np.array([
        num_scaled[0], num_scaled[1], num_scaled[2], num_scaled[3],
        num_scaled[4], num_scaled[5], num_scaled[6], num_scaled[7],
        num_scaled[8], num_scaled[9],
        ec_enc, z_enc, vt_enc,
        eu, pl, pu, sc, sr, wc, wh, wr
    ], dtype=np.float32)

test_cases = [
    ([6, 2, 6, 0, 500, 0, 22, 0.8, 200, 30],
     {"event_cause": "vehicle_breakdown", "zone": "Central Zone 2", "veh_type": "car",
      "event_type": "planned", "priority": "High", "status": "active", "weather_condition": "Clear"}),
    ([9, 3, 6, 0, 5000, 0, 28, 0.6, 50, 80],
     {"event_cause": "accident", "zone": "Central Zone 1", "veh_type": "bus",
      "event_type": "unplanned", "priority": "High", "status": "active", "weather_condition": "Clear"}),
    ([18, 4, 6, 0, 8000, 15, 24, 0.5, 30, 120],
     {"event_cause": "breakdown", "zone": "Outer Zone", "veh_type": "truck",
      "event_type": "unplanned", "priority": "High", "status": "active", "weather_condition": "Heavy Rain"}),
    ([20, 6, 12, 1, 15000, 0, 26, 0.7, 100, 60],
     {"event_cause": "special_event", "zone": "Central Zone 2", "veh_type": "car",
      "event_type": "planned", "priority": "High", "status": "active", "weather_condition": "Cloudy"}),
    ([23, 1, 6, 0, 100, 0, 20, 0.9, 300, 10],
     {"event_cause": "vehicle_breakdown", "zone": "Central Zone 1", "veh_type": "car",
      "event_type": "unplanned", "priority": "Low", "status": "resolved", "weather_condition": "Clear"}),
    ([14, 5, 6, 0, 3000, 5, 18, 0.3, 20, 90],
     {"event_cause": "road_construction", "zone": "Outer Zone", "veh_type": "truck",
      "event_type": "planned", "priority": "Unknown", "status": "closed", "weather_condition": "Rainy"}),
]

feature_matrix = np.array([build_features(n, c) for n, c in test_cases])

# --- Verify Regression Model (CatBoost) ---
print("\n  --- Regression Model (CatBoost) ---")
reg_onnx_path = 'outputs/traffic_reg_model.onnx'
if os.path.exists(reg_onnx_path):
    reg_sess = ort.InferenceSession(reg_onnx_path)
    inp_name = reg_sess.get_inputs()[0].name
    print("  [+] ONNX input name: '%s'" % inp_name)
    onnx_reg_preds = reg_sess.run(None, {inp_name: feature_matrix})[0].flatten()
    
    pickle_reg_preds = reg_model.predict(feature_matrix)
    
    reg_diffs = np.abs(onnx_reg_preds - pickle_reg_preds)
    print("  [+] ONNX predictions: %s" % onnx_reg_preds)
    print("  [+] Pickle predictions: %s" % pickle_reg_preds)
    print("  [+] Max diff: %.8f" % np.max(reg_diffs))
    print("  [+] Mean diff: %.8f" % np.mean(reg_diffs))
    
    if np.max(reg_diffs) < 0.01:
        print("  [OK] CatBoost ONNX export VERIFIED - predictions match!")
    else:
        print("  [WARN] Differences detected - may need investigation")
else:
    print("  [!] Regression ONNX not found")

# --- Verify Classification Model (RandomForest) ---
print("\n  --- Classification Model (RandomForest) ---")
cls_onnx_path = 'outputs/traffic_cls_model.onnx'
if os.path.exists(cls_onnx_path):
    cls_sess = ort.InferenceSession(cls_onnx_path)
    inp_name = cls_sess.get_inputs()[0].name
    onnx_cls_outputs = cls_sess.run(None, {inp_name: feature_matrix})
    
    print("  [+] ONNX has %d outputs" % len(onnx_cls_outputs))
    for i, o in enumerate(onnx_cls_outputs):
        arr = np.array(o)
        print("  [+]   Output %d: shape=%s, values=%s" % (i, arr.shape, arr.flatten()[:6]))
    
    pickle_cls_preds = cls_model.predict(feature_matrix)
    pickle_cls_probs = cls_model.predict_proba(feature_matrix)
    
    # ONNX typically outputs: [label, probabilities]
    if len(onnx_cls_outputs) >= 2:
        onnx_labels = np.array(onnx_cls_outputs[0]).flatten().astype(int)
        onnx_probs_raw = onnx_cls_outputs[1]
        
        # skl2onnx sometimes outputs probabilities as a list of dicts (ZipMap)
        if isinstance(onnx_probs_raw, list) and len(onnx_probs_raw) > 0 and isinstance(onnx_probs_raw[0], dict):
            # Convert list of dicts to numpy array
            onnx_probs = np.array([list(d.values()) for d in onnx_probs_raw], dtype=np.float32)
        else:
            onnx_probs = np.array(onnx_probs_raw)
        
        label_match = np.all(onnx_labels == pickle_cls_preds)
        prob_diffs = np.abs(onnx_probs - pickle_cls_probs)
        
        print("  [+] ONNX predicted labels: %s" % onnx_labels)
        print("  [+] Pickle predicted labels: %s" % pickle_cls_preds)
        print("  [+] Labels match: %s" % label_match)
        print("  [+] Max prob diff: %.8f" % np.max(prob_diffs))
        print("  [+] ONNX probs:\n%s" % onnx_probs)
        print("  [+] Pickle probs:\n%s" % pickle_cls_probs)
        
        if label_match and np.max(prob_diffs) < 0.01:
            print("  [OK] Classifier ONNX export VERIFIED - predictions match!")
        else:
            print("  [WARN] Differences in classifier predictions")
else:
    print("  [!] Classifier ONNX not found")

# --- 5. Summary -----------------------------------------------------------
print("\n[5/5] Summary")
print("=" * 60)
print("Output files:")
for f in ['traffic_model.onnx', 'traffic_reg_model.onnx', 'traffic_cls_model.onnx']:
    path = 'outputs/' + f
    if os.path.exists(path):
        size = os.path.getsize(path)
        print("  [+] outputs/%s (%.1f KB)" % (f, size/1024))
    else:
        print("  [!] outputs/%s - NOT FOUND" % f)
print("=" * 60)
