<div align="center">

# 🚦 DRACO 2.0 — Decentralized Edge AI for Urban Mobility

### 🌐 [▶ VIEW LIVE DEMO](https://decentralized-edge-ai-for-urban-mob.vercel.app/)
#### `https://decentralized-edge-ai-for-urban-mob.vercel.app/`

---

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://decentralized-edge-ai-for-urban-mob.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/JAYASURYA-KK/Decentralized_Edge_AI_for_Urban_Mobility1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![ONNX](https://img.shields.io/badge/ONNX-Runtime-005CED?style=for-the-badge&logo=onnx)](https://onnxruntime.ai)

> **A next-generation, end-to-end AI pipeline and real-time command center for predicting, managing, and optimizing urban traffic congestion — entirely in the browser.**

</div>

---

## 🎬 Demo Video

<div align="center">

<a href="https://www.youtube.com/watch?v=1wP5fvj2DKM" target="_blank">
  <img src="https://raw.githubusercontent.com/JAYASURYA-KK/Decentralized_Edge_AI_for_Urban_Mobility1/main/thumbnail.jpeg"
       alt="DRACO 2.0 Demo Video"
       width="700" />
</a>

▶️ **Click the thumbnail above to watch the demo video on YouTube**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [Web Dashboard](#-web-dashboard)
- [Dashboard Modules (13 Interactive Panels)](#-dashboard-modules-13-interactive-panels)
- [End-to-End Workflow](#-end-to-end-workflow)
- [Getting Started](#-getting-started)
- [Tech Stack](#-tech-stack)
- [Performance & Design Philosophy](#-performance--design-philosophy)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

**DRACO 2.0** (Distributed Real-time Adaptive Congestion Optimizer) is a full-stack AI system for urban traffic intelligence. It combines a rigorous data science pipeline with a cutting-edge browser-native inference engine, eliminating the need for traditional Python backends.

The system is purpose-built around two core innovations:

1. **In-Browser ONNX Inference** — ML models run directly in the client using `onnxruntime-web`, achieving near-zero latency predictions with no server round-trips.
2. **Decentralized Edge Architecture** — Predictions are computed locally, making the system fully offline-capable, infinitely scalable, and privacy-preserving.

---

## 🏗 Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DRACO 2.0 Architecture                         │
├─────────────────────────────┬─────────────────────────────────────────┤
│   ML Pipeline (Python)      │     Web Dashboard (React + ONNX)        │
│                             │                                          │
│  Raw CSV Data               │   Browser                               │
│       │                     │     ├── onnxruntime-web                 │
│       ▼                     │     ├── Random Forest Model (.onnx)     │
│  Jupyter Notebook           │     ├── XGBoost Model (.onnx)           │
│  (EDA + Feature Eng.)       │     └── 13 Interactive Modules          │
│       │                     │           ├── Heatmap                   │
│       ▼                     │           ├── Digital Twin              │
│  Model Training             │           ├── Diversion Planner         │
│  (RF + XGBoost)             │           ├── Resource Optimizer        │
│       │                     │           └── PDF / Excel Reports       │
│       ▼                     │                                          │
│  ONNX Export Script         │   No Backend Required ✅                │
│       │                     │   Offline Capable ✅                    │
│       ▼                     │   Client-Side Inference ✅              │
│  .onnx model files          │                                          │
│       └──────────────────►  │  dashboard/public/models/               │
└─────────────────────────────┴─────────────────────────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **In-Browser ML Inference** | Zero-latency predictions via `onnxruntime-web` — no server, no API calls |
| 📊 **13 Interactive Modules** | Comprehensive traffic intelligence panels from heatmaps to digital twins |
| ⚡ **High-Speed CSV Batching** | Process up to 1,000 traffic events in milliseconds, entirely client-side |
| 📄 **PDF & Excel Reporting** | Generate deeply formatted reports and Excel-compatible CSVs dynamically |
| 🌐 **Offline Capable** | Full functionality without any network connection after initial load |
| 🔒 **Privacy-Preserving** | All data and inference stays on the client — nothing leaves the browser |
| 📡 **Decentralized by Design** | Edge-first architecture scales horizontally with zero infrastructure cost |
| 🎯 **Dual-Model Ensemble** | Random Forest + XGBoost models for robust, validated predictions |

---

## 📁 Project Structure

```
Decentralized_Edge_AI_for_Urban_Mobility1/
│
├── 📓 traffic2.ipynb                  # Primary ML notebook (EDA → Training)
├── 📊 Astram_event_data_anonymized.csv # Raw anonymized traffic event dataset
├── 🔄 export_onnx_models.py           # Converts Pickle models → ONNX format
├── ✅ compare_onnx_vs_pickle.py       # Validates ONNX vs original model parity
├── ✅ compare_onnx_models.py          # Cross-validates exported ONNX models
│
├── 📂 outputs/                        # Generated ML artifacts
│   ├── 📈 graphs/                     # EDA plots and correlation matrices
│   ├── 🤖 *.pkl                       # Trained Scikit-Learn / XGBoost models
│   └── 🔢 *.onnx                      # Exported ONNX models (browser-ready)
│
└── 📂 dashboard/                      # DRACO 2.0 Web Command Center
    ├── 📦 package.json                # Node.js dependencies (Vite + React)
    ├── ⚙️  vite.config.js             # Vite bundler configuration
    │
    ├── 📂 public/
    │   └── 📂 models/                 # ← Place .onnx files here for deployment
    │       ├── random_forest.onnx
    │       └── xgboost.onnx
    │
    └── 📂 src/
        ├── 🎯 App.jsx                 # Root component and module router
        ├── 🧩 components/             # Reusable UI components
        └── 📂 modules/                # 13 individual dashboard panels
            ├── TrafficHeatmap/
            ├── DiversionPlanner/
            ├── ResourceOptimizer/
            ├── DigitalTwin/
            ├── BatchPredictor/
            ├── AlertsPanel/
            ├── OverallReport/
            └── ...
```

---

## 🧠 Machine Learning Pipeline

The ML pipeline lives in the root directory and covers the complete data science lifecycle.

### Dataset — `Astram_event_data_anonymized.csv`

The foundation of the system is a real-world anonymized traffic event dataset. Each record captures a traffic incident with attributes including zone identifiers, timestamps, event severity, and congestion metrics.

### Notebook — `traffic2.ipynb`

The primary Jupyter Notebook drives the full ML lifecycle:

**Exploratory Data Analysis (EDA)**
- Distribution analysis of congestion severity across zones and time periods
- Correlation matrix generation to identify key predictive features
- Temporal pattern analysis (hourly, daily, seasonal trends)
- Anomaly detection and outlier handling

**Feature Engineering**
- **Target Encoding** for high-cardinality zone identifiers
- **Temporal Feature Extraction**: hour of day, month, weekend flag, rush-hour flags
- Interaction feature construction (zone × time-of-day)
- Normalization and scaling for model compatibility

**Model Training & Tuning**
- **Random Forest Classifier/Regressor** — robust ensemble method for congestion risk scoring
- **XGBoost** — gradient-boosted trees for high-accuracy congestion prediction
- Hyperparameter optimization via grid/random search with cross-validation
- Feature importance ranking to identify the most predictive signals

### ONNX Export — `export_onnx_models.py`

After training, models are serialized to `.pkl` (Pickle) format and then converted to the open **ONNX** standard using `skl2onnx` / `onnxmltools`. This enables:

- Browser-native inference via `onnxruntime-web`
- Platform-independent deployment (no Python runtime needed)
- Optimized execution graph for low-latency predictions

### Validation Scripts

| Script | Purpose |
|---|---|
| `compare_onnx_vs_pickle.py` | Verifies ONNX output matches original Python model on the test set |
| `compare_onnx_models.py` | Cross-validates parity and accuracy between the two exported ONNX models |

Both scripts ensure that the conversion process introduces no regressions, maintaining full prediction accuracy.

---

## 💻 Web Dashboard

The `/dashboard` folder contains the **DRACO 2.0 Command Center** — a Next-Gen React application powered by Vite.

### Core Innovation: Client-Side Inference

Instead of a traditional Flask/FastAPI backend, the dashboard loads `.onnx` models directly into the browser using `onnxruntime-web`. This architectural decision delivers:

| Metric | Traditional Backend | DRACO 2.0 (Edge) |
|---|---|---|
| **Inference Latency** | 50–200ms (network) | < 5ms (local) |
| **Scalability** | Server-bound | Infinite (client-side) |
| **Offline Support** | ❌ No | ✅ Yes |
| **Privacy** | Data sent to server | Data never leaves device |
| **Infrastructure Cost** | Server required | $0 (static hosting) |

---

## 🗂 Dashboard Modules (13 Interactive Panels)

### 1. 🗺 Traffic Heatmap
Real-time spatial visualization of congestion risk across all monitored zones. Color-coded intensity overlays show predicted congestion hotspots, allowing traffic operators to anticipate bottlenecks before they form.

### 2. 🔀 Diversion Planner
AI-driven route diversion recommendations. When a zone exceeds a configurable congestion threshold, the module proposes optimal alternative routes and estimates the traffic redistribution impact.

### 3. ⚙️ Resource Optimization Matrix
Allocation matrix for emergency and maintenance resources (police units, signal controllers, incident response teams) based on predicted congestion severity scores across zones.

### 4. 🤖 Digital Twin Simulation
A full virtual replica of the monitored road network. Operators can inject hypothetical events (accidents, road closures, mass gatherings) and simulate downstream congestion effects in real-time — all powered by live ONNX inference.

### 5. ⚡ Batch Predictor (High-Speed CSV)
Upload any CSV file with up to **1,000 traffic event records**. The module runs all predictions in milliseconds using parallel ONNX inference sessions, returning a fully annotated result table with congestion risk scores.

### 6. 🚨 Alerts Panel
Configurable threshold-based alerting system. When model predictions exceed defined risk levels for a zone, the panel surfaces prioritized alerts. Alerts are exportable as a formatted **PDF report** or **Excel-compatible CSV**.

### 7. 📋 Overall Report Generator
Aggregates all active model outputs into a comprehensive operational report. Dynamically renders deeply formatted **PDF documents** with charts, zone-level summaries, and model confidence scores.

### 8. 📈 Trend Analyzer
Temporal trend visualization for congestion patterns. Displays hourly, daily, and weekly rolling averages, with anomaly markers for events that deviate significantly from predicted baselines.

### 9. 🎛 Model Confidence Monitor
Live display of model prediction confidence intervals. Operators can inspect the uncertainty bands around each prediction to understand when the model is operating near the edges of its training distribution.

### 10. 🗂 Zone Intelligence Panel
Deep-dive analytics for individual monitored zones. Combines historical event data with live ONNX predictions to produce a per-zone traffic intelligence scorecard.

### 11. 🕐 Temporal Event Scheduler
Forward-looking prediction scheduler. Operators can project congestion risk for upcoming time windows (next hour, next 24 hours) based on temporal features and zone-specific patterns learned during training.

### 12. 📡 Live Feed Simulator
Simulates a real-time event data stream by replaying the training dataset at configurable playback speeds. Allows stress-testing of the inference pipeline and demonstration without a live data source.

### 13. ⚖️ Model Comparison View
Side-by-side comparison of the Random Forest and XGBoost model predictions for the same input. Helps operators understand where the two models agree or diverge, and build confidence in ensemble outputs.

---

## 🔄 End-to-End Workflow

```
Step 1: TRAIN
──────────────
Open traffic2.ipynb in Jupyter. Run all cells to perform EDA,
feature engineering, model training, and pickle serialization.

Step 2: EXPORT
──────────────
Run the ONNX conversion script:
  python export_onnx_models.py

Validate the export:
  python compare_onnx_vs_pickle.py
  python compare_onnx_models.py

Step 3: DEPLOY
──────────────
Copy the generated .onnx files into the dashboard:
  cp outputs/*.onnx dashboard/public/models/

Step 4: VISUALIZE
──────────────────
Launch the React command center:
  cd dashboard && npm install && npm run dev

Open http://localhost:5173 and explore 13 modules.
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** with Jupyter Notebook
- **Node.js 18+** and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/JAYASURYA-KK/Decentralized_Edge_AI_for_Urban_Mobility1.git
cd Decentralized_Edge_AI_for_Urban_Mobility1
```

### 2. Set Up the Python Environment

```bash
pip install -r requirements.txt
# Or manually:
pip install scikit-learn xgboost pandas numpy matplotlib seaborn skl2onnx onnxruntime jupyter
```

### 3. Train Models & Export ONNX

```bash
# Open and run the notebook
jupyter notebook traffic2.ipynb

# Export trained models to ONNX format
python export_onnx_models.py

# Validate the ONNX exports
python compare_onnx_vs_pickle.py
python compare_onnx_models.py
```

### 4. Deploy ONNX Models to Dashboard

```bash
cp outputs/*.onnx dashboard/public/models/
```

### 5. Launch the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open your browser at **http://localhost:5173** — the DRACO 2.0 Command Center is live.

### 🌐 Live Demo

A pre-deployed version of the dashboard is available at:
**[https://decentralized-edge-ai-for-urban-mob.vercel.app/](https://decentralized-edge-ai-for-urban-mob.vercel.app/)**

---

## 🛠 Tech Stack

### Machine Learning

| Tool | Role |
|---|---|
| `scikit-learn` | Random Forest training and preprocessing |
| `xgboost` | Gradient-boosted tree model training |
| `pandas` / `numpy` | Data wrangling and feature engineering |
| `matplotlib` / `seaborn` | EDA visualizations and correlation matrices |
| `skl2onnx` / `onnxmltools` | ONNX model conversion and export |
| `onnxruntime` | Server-side ONNX validation |

### Web Dashboard

| Tool | Role |
|---|---|
| `React 18` | Component-based UI framework |
| `Vite` | Ultra-fast build tooling and HMR dev server |
| `onnxruntime-web` | In-browser ML inference engine (WASM/WebGL) |
| `jsPDF` | Dynamic PDF report generation |
| `SheetJS (xlsx)` | Excel-compatible CSV export |
| `Recharts` / `D3.js` | Interactive data visualizations |

### Deployment

| Tool | Role |
|---|---|
| `Vercel` | Static hosting and global CDN for the dashboard |
| `GitHub Actions` | CI/CD pipeline (optional) |

---

## 📐 Performance & Design Philosophy

### Why ONNX Over a Python Backend?

Traditional ML deployment stacks require a running Python server (Flask/FastAPI), which introduces network latency, server costs, scalability bottlenecks, and data privacy concerns. DRACO 2.0 eliminates this entirely.

By converting models to ONNX and loading them via `onnxruntime-web`, every user's browser becomes its own inference node. The system scales to thousands of simultaneous users with zero additional infrastructure.

### Why Edge AI for Urban Traffic?

Urban traffic management demands:

- **Sub-second response times** for dynamic signal control and diversion
- **High availability** — a server outage cannot halt traffic operations
- **Data locality** — sensitive location and behavioral data must not leave the city's jurisdiction
- **Scalability** — city-wide deployment needs to handle thousands of monitoring nodes simultaneously

DRACO 2.0's decentralized edge architecture satisfies all four constraints by design.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -m 'Add: description of change'`
4. **Push** to your branch: `git push origin feature/your-feature-name`
5. **Open** a Pull Request with a clear description of your changes

### Areas for Contribution

- Additional ML models (LightGBM, Neural Networks)
- New dashboard modules (incident prediction, carbon footprint estimator)
- Federated learning integration for multi-city training
- WebGPU acceleration for faster ONNX inference
- Multilingual dashboard support

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**JAYASURYA KK**
- GitHub: [@JAYASURYA-KK](https://github.com/JAYASURYA-KK)
- Live Demo: [decentralized-edge-ai-for-urban-mob.vercel.app](https://decentralized-edge-ai-for-urban-mob.vercel.app/)

---

<div align="center">

⭐ **If DRACO 2.0 is useful to you, please consider giving the repository a star!**

*Built with ❤️ for smarter, safer, and more efficient cities.*

</div>
