import { create } from 'zustand'
import type { DashboardPage, PredictionInput, PredictionResult, Incident, Alert, ResourceAllocation, CostBreakdown, BulkPrediction } from '@/types'
import { getDefaultInput } from '@/services/featureEngineering'

interface TrafficState {
  // Navigation
  currentPage: DashboardPage
  setCurrentPage: (page: DashboardPage) => void

  // Prediction
  predictionInput: PredictionInput
  predictionResult: PredictionResult | null
  isPredicting: boolean
  setPredictionInput: (input: Partial<PredictionInput>) => void
  setPredictionResult: (result: PredictionResult | null) => void
  setIsPredicting: (v: boolean) => void
  resetPredictionInput: () => void

  // Bulk Predictions
  bulkPredictions: BulkPrediction[] | null
  isBulkMode: boolean
  setBulkPredictions: (predictions: BulkPrediction[] | null) => void
  setIsBulkMode: (active: boolean) => void

  // Incidents
  incidents: Incident[]
  addIncident: (incident: Incident) => void

  // Alerts
  alerts: Alert[]
  addAlert: (alert: Alert) => void
  dismissAlert: (id: string) => void

  // Resource Optimization
  resourceAllocation: ResourceAllocation | null
  setResourceAllocation: (r: ResourceAllocation) => void

  // Cost
  costBreakdown: CostBreakdown | null
  setCostBreakdown: (c: CostBreakdown) => void

  // Models loaded
  modelsLoaded: boolean
  setModelsLoaded: (v: boolean) => void

  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

export const useTrafficStore = create<TrafficState>((set) => ({
  currentPage: 'landing',
  setCurrentPage: (page) => set({ currentPage: page }),

  theme: 'dark',
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(nextTheme)
      localStorage.setItem('theme', nextTheme)
    }
    return { theme: nextTheme }
  }),

  predictionInput: getDefaultInput(),
  predictionResult: null,
  isPredicting: false,
  setPredictionInput: (input) => set((state) => ({
    predictionInput: { ...state.predictionInput, ...input },
  })),
  setPredictionResult: (result) => set({ predictionResult: result }),
  setIsPredicting: (v) => set({ isPredicting: v }),
  resetPredictionInput: () => set({ predictionInput: getDefaultInput() }),

  bulkPredictions: null,
  isBulkMode: false,
  setBulkPredictions: (predictions) => set({
    bulkPredictions: predictions,
    isBulkMode: predictions !== null && predictions.length > 0
  }),
  setIsBulkMode: (active) => set({ isBulkMode: active }),

  incidents: [
    { id: '1', time: '8:30 AM', description: 'Accident at Silk Board Junction', severity: 'critical', location: [12.9344, 77.6101] },
    { id: '2', time: '9:00 AM', description: 'Heavy congestion on Outer Ring Road', severity: 'critical', location: [12.9719, 77.6412] },
    { id: '3', time: '9:20 AM', description: 'Diversion activated at Hebbal Flyover', severity: 'moderate', location: [13.0358, 77.5970] },
    { id: '4', time: '10:00 AM', description: 'Vehicle breakdown on NICE Road', severity: 'moderate', location: [12.8748, 77.4848] },
    { id: '5', time: '10:30 AM', description: 'Road maintenance work near KR Puram', severity: 'normal', location: [12.9985, 77.7020] },
  ],
  addIncident: (incident) => set((state) => ({
    incidents: [incident, ...state.incidents],
  })),

  alerts: [
    { id: 'a1', message: 'Critical congestion detected at Silk Board', severity: 'critical', timestamp: new Date() },
    { id: 'a2', message: 'Moderate traffic buildup on Outer Ring Road', severity: 'moderate', timestamp: new Date() },
    { id: 'a3', message: 'Weather alert: Heavy rain expected in South Bengaluru', severity: 'moderate', timestamp: new Date() },
  ],
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts],
  })),
  dismissAlert: (id) => set((state) => ({
    alerts: state.alerts.filter((a) => a.id !== id),
  })),

  resourceAllocation: null,
  setResourceAllocation: (r) => set({ resourceAllocation: r }),

  costBreakdown: null,
  setCostBreakdown: (c) => set({ costBreakdown: c }),

  modelsLoaded: false,
  setModelsLoaded: (v) => set({ modelsLoaded: v }),
}))

