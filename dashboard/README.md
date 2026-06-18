# DRACO 2.0 - AI Traffic Command Center

DRACO 2.0 is a next-generation AI-powered Traffic Management Platform. Designed for urban mobility centers and traffic police forces, it leverages cutting-edge **ONNX Runtime Web** capabilities to run localized machine learning models directly in the browser, providing real-time, privacy-preserving congestion predictions, risk assessments, and resource optimization.

## 🚀 Key Features

The platform is split into 13 comprehensive command-center modules:

1. **Live Prediction**: Run single-parameter predictions or bulk upload `.csv` spreadsheets (up to 1,000 events) for instant, client-side batch inference.
2. **Executive Overview**: High-level dynamic KPIs, 24-hour congestion patterns, and incident distributions.
3. **Risk Intelligence**: Real-time risk scoring matrix for critical zones based on weather, priority, and congestion.
4. **Resource Optimization**: AI-driven allocation algorithms to optimally deploy police, ambulances, and tow trucks based on event severity.
5. **Diversion Planner**: Interactive, map-based route calculations for dynamically rerouting traffic around hotspots.
6. **Traffic Heatmap**: Geospatial visualization of real-time predicted congestion levels.
7. **Digital Twin**: Simulated 3D-style telemetry representations of city nodes.
8. **Cost Optimization**: Deep-dive analytics on the financial impact and savings of proactive resource deployment.
9. **Explainable AI**: Transparent insights into the ML model's decision boundaries (feature importance).
10. **Historical Analytics**: Temporal analysis of past traffic patterns.
11. **Incident Timeline**: Chronological tracking of unplanned vs. planned disruptions.
12. **Alerts Panel**: Real-time contextual notification center for high-priority congestion risks.
13. **Overall Report**: A unified data aggregation engine that generates comprehensive, styled **PDFs** and **Excel/CSV** reports of the current system state.

## 🛠 Tech Stack

* **Frontend Framework**: React 19 + Vite
* **Styling**: Tailwind CSS v4 + Framer Motion (micro-animations)
* **State Management**: Zustand
* **Machine Learning**: `onnxruntime-web` (In-browser ML inference)
* **Data Visualization**: Recharts
* **Mapping**: Leaflet + React-Leaflet
* **Document Generation**: `jspdf` + `jspdf-autotable` (PDFs) & Native CSV blobs.

## 🧠 AI Integration Details

The system uses an ONNX-compiled machine learning model to predict urban traffic congestion. 
* **Input Features**: The system parses 22 distinct features including environmental data (rainfall, temperature), temporal data (hour, weekend), spatial data (zone encoding), and event metadata (cause, priority).
* **Outputs**: Congestion Values (0-100), Categorical Classification (Low, Medium, High), and Confidence Scores.
* **Batch Processing**: The platform supports high-speed batch predictions capable of inferring 1,000 spreadsheet rows natively in the browser without server communication.

## ⚙️ Setup & Installation

**Prerequisites:** Node.js 18+

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```

3. **Build for Production:**
   ```bash
   npm run build
   ```

## 📂 Project Structure

```
dashboard/
├── public/
│   ├── models/           # Contains the ONNX ML models
│   └── Astram_event...   # Demo CSV spreadsheets
├── src/
│   ├── components/       # All 13 module pages and UI components
│   ├── services/         # ONNX inference and Feature Engineering logic
│   ├── store/            # Zustand global state management
│   ├── lib/              # Utility functions and class mergers
│   └── types/            # TypeScript interfaces for ML I/O and UI props
├── package.json
└── vite.config.ts
```

## 📝 Reporting Capabilities

The platform features built-in, native reporting:
* **Excel Generation**: Downloads fully typed, formatted `.csv` reports of active predictions and alerts.
* **PDF Generation**: Utilizes `jsPDF` and `AutoTable` to programmatically build multi-page, color-coded, professional PDF documents without relying on fragile browser screenshots.
