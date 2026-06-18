import { cn } from '@/lib/utils'
import { useTrafficStore } from '@/store/trafficStore'
import type { DashboardPage } from '@/types'
import {
  LayoutDashboard, Activity, Shield, Truck, Map, MapPin,
  Cpu, DollarSign, Brain, BarChart3, Timeline, Bell,
  Menu, X, ChevronRight, Database, Sun, Moon, FileText
} from 'lucide-react'
import { useState } from 'react'
import { Toaster } from 'sonner'

const navItems: { icon: typeof LayoutDashboard; label: string; page: DashboardPage; badge?: string }[] = [
  { icon: Activity, label: 'Live Prediction', page: 'live-prediction' },
  { icon: LayoutDashboard, label: 'Executive Overview', page: 'executive-overview' },
  { icon: Shield, label: 'Risk Intelligence', page: 'risk-intelligence' },
  { icon: Truck, label: 'Resource Optimization', page: 'resource-optimization' },
  { icon: Map, label: 'Diversion Planner', page: 'diversion-planner' },
  { icon: MapPin, label: 'Traffic Heatmap', page: 'traffic-heatmap' },
  { icon: Cpu, label: 'Digital Twin', page: 'digital-twin' },
  { icon: DollarSign, label: 'Cost Optimization', page: 'cost-optimization' },
  { icon: Brain, label: 'Explainable AI', page: 'explainable-ai' },
  { icon: BarChart3, label: 'Historical Analytics', page: 'historical-analytics' },
  { icon: Timeline, label: 'Incident Timeline', page: 'incident-timeline' },
  { icon: Bell, label: 'Alerts Panel', page: 'alerts-panel' },
  { icon: FileText, label: 'Overall Report', page: 'overall-report' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentPage, setCurrentPage, isBulkMode, bulkPredictions, setBulkPredictions, theme, toggleTheme } = useTrafficStore()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/95 border-r border-gray-800 transform transition-transform duration-200 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center gap-2 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/20 transition-colors" onClick={() => setCurrentPage('landing')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-sm">🐉</span>
          </div>
          <div>
            <h1 className="font-bold text-sm bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">DRACO 2.0</h1>
            <p className="text-[10px] text-gray-500 font-medium">AI Traffic Platform</p>
          </div>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.page
            return (
              <button
                key={item.page}
                onClick={() => { setCurrentPage(item.page); setSidebarOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border border-transparent',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600/20 text-blue-400">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-450 min-w-0">
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Dashboard</span>
            <ChevronRight className="w-3 h-3 hidden sm:inline" />
            <span className="text-gray-200 font-medium capitalize truncate max-w-[100px] sm:max-w-none">
              {navItems.find(n => n.page === currentPage)?.label ?? currentPage}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            {isBulkMode && bulkPredictions && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/10 border border-blue-500/25 text-xs text-blue-400">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Batch Mode ({bulkPredictions.length} events)</span>
                <span className="md:hidden">Batch ({bulkPredictions.length})</span>
                <button
                  onClick={() => {
                    setBulkPredictions(null)
                    setCurrentPage('live-prediction')
                  }}
                  className="hover:text-blue-200 transition-colors ml-1 font-bold cursor-pointer"
                  title="Clear Batch Mode"
                >
                  ✕
                </button>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-1 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-gray-450 hover:text-white transition-all active:scale-90 cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
