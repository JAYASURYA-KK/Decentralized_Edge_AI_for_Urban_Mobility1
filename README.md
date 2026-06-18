# AI Traffic Management System (DRACO 2.0)

Welcome to the **DRACO 2.0** repository. This project is a complete end-to-end AI pipeline and visualization command center designed to predict, manage, and optimize urban traffic congestion in real-time.

This repository is split into two primary domains:
1. **Machine Learning Pipeline (`/` root folder)**: Data processing, model training, and ONNX exporting.
2. **Web Dashboard (`/dashboard`)**: A Next-Gen React command center running local ONNX inference.

---

## 🧠 1. Machine Learning Pipeline (Data Science)

The root folder contains the core data science workflows used to process the anonymized event data, train machine learning algorithms (Random Forest / XGBoost), and convert them into browser-compatible ONNX formats.

### Key Files:
* **`traffic2.ipynb`**: The primary Jupyter Notebook containing the full ML lifecycle:
  * Exploratory Data Analysis (EDA) on the dataset.
  * Feature Engineering (Target encoding for zones, temporal extraction for hour/month/weekend, etc.).
  * Model Training and Hyperparameter tuning.
* **`Astram_event_data_anonymized.csv`**: The raw traffic event dataset used to train the models.
* **`export_onnx_models.py`**: Script used to convert the trained Scikit-Learn/XGBoost models (Pickle format) into the `.onnx` standard for lightweight, cross-platform inference.
* **`compare_onnx_vs_pickle.py` & `compare_onnx_models.py`**: Validation scripts ensuring that the ONNX conversions maintain parity and high accuracy compared to the original Python models.
* **`outputs/`**: Directory containing generated artifacts like graphs, correlation matrices, and the exported models themselves.

---

## 💻 2. Interactive Web Dashboard (Frontend)

The `/dashboard` folder houses the **DRACO 2.0 Command Center**. Instead of relying on a Python backend (like Flask/FastAPI) to run predictions, the dashboard uses `onnxruntime-web` to load the machine learning models directly into the client's browser. This guarantees ultra-fast, offline-capable, and highly scalable predictions.

### Key Features of the Dashboard:
* **Live In-Browser Inference**: Instantly predict congestion risks by modifying parameters without any network latency.
* **High-Speed Spreadsheet Batching**: Upload an entire CSV (up to 1,000 events) and evaluate the whole dataset in milliseconds entirely on the client side.
* **13 Interactive Modules**: Including a *Traffic Heatmap*, *Diversion Planner*, *Resource Optimization* matrices, and a *Digital Twin* simulation.
* **PDF & Excel Reporting**: The *Overall Report* and *Alerts Panel* can dynamically generate deeply formatted PDF reports and Excel-compatible CSVs containing the active model outputs.

### Running the Dashboard Locally
1. Navigate into the dashboard folder:
   ```bash
   cd dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the command center at `http://localhost:5173`.

---

## 🔄 End-to-End Workflow

1. **Train** models in `traffic2.ipynb`.
2. **Export** the models using `export_onnx_models.py`.
3. **Deploy** by moving the generated `.onnx` files into the `dashboard/public/models/` directory.
4. **Visualize** and simulate events on the React dashboard.
