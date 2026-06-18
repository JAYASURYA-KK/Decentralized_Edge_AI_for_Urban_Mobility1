import { useEffect, useState } from 'react'
import { Layout } from '@/components/Layout'
import { LandingPage } from '@/components/LandingPage'
import { ExecutiveOverview } from '@/components/ExecutiveOverview'
import { LivePrediction } from '@/components/LivePrediction'
import { RiskIntelligence } from '@/components/RiskIntelligence'
import { ResourceOptimization } from '@/components/ResourceOptimization'
import { DiversionPlanner } from '@/components/DiversionPlanner'
import { TrafficHeatmap } from '@/components/TrafficHeatmap'
import { DigitalTwin } from '@/components/DigitalTwin'
import { CostOptimization } from '@/components/CostOptimization'
import { ExplainableAI } from '@/components/ExplainableAI'
import { HistoricalAnalytics } from '@/components/HistoricalAnalytics'
import { IncidentTimeline } from '@/components/IncidentTimeline'
import { AlertsPanel } from '@/components/AlertsPanel'
import { OverallReport } from '@/components/OverallReport'
import { useTrafficStore } from '@/store/trafficStore'
import { initModels } from '@/services/onnxService'
import { AlertCircle } from 'lucide-react'

function LoadingScreen({ error }: { error?: string }) {
  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div className="text-lg font-semibold text-red-400">Failed to Load Models</div>
            <p className="text-sm text-gray-500 max-w-md">{error}</p>
            <p className="text-xs text-gray-600">The app will still work with demo data. ONNX models need to be placed in public/models/</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-lg font-semibold text-gray-300">Traffic Command Center</div>
            <p className="text-sm text-gray-500">Loading ONNX models...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PageContent() {
  const { currentPage } = useTrafficStore()

  switch (currentPage) {
    case 'landing': return <LandingPage />
    case 'executive-overview': return <ExecutiveOverview />
    case 'live-prediction': return <LivePrediction />
    case 'risk-intelligence': return <RiskIntelligence />
    case 'resource-optimization': return <ResourceOptimization />
    case 'diversion-planner': return <DiversionPlanner />
    case 'traffic-heatmap': return <TrafficHeatmap />
    case 'digital-twin': return <DigitalTwin />
    case 'cost-optimization': return <CostOptimization />
    case 'explainable-ai': return <ExplainableAI />
    case 'historical-analytics': return <HistoricalAnalytics />
    case 'incident-timeline': return <IncidentTimeline />
    case 'alerts-panel': return <AlertsPanel />
    case 'overall-report': return <OverallReport />
    default: return <LandingPage />
  }
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currentPage, setModelsLoaded, theme } = useTrafficStore()

  // Sync theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(savedTheme)
    if (savedTheme !== theme) {
      useTrafficStore.setState({ theme: savedTheme as 'light' | 'dark' })
    }
  }, [theme])

  useEffect(() => {
    async function loadModels() {
      try {
        await initModels()
        setModelsLoaded(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        console.warn('ONNX models not loaded:', msg)
      } finally {
        setLoading(false)
      }
    }
    loadModels()
  }, [setModelsLoaded])

  if (loading) {
    return <LoadingScreen />
  }

  if (error) {
    // Models failed to load, but dashboard still renders with demo data
    console.warn('Running with demo data - ONNX models not available')
  }

  if (currentPage === 'landing') {
    return <PageContent />
  }

  return (
    <Layout>
      <PageContent />
    </Layout>
  )
}
