import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTrafficStore } from '@/store/trafficStore'
import { getCongestionColor, formatNumber } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Activity, Shield, Clock, Car, AlertTriangle, TrendingUp, Database } from 'lucide-react'
import { useMemo } from 'react'

// Simple formula to estimate risk score based on model prediction and metadata
export function calculateRiskScore(congestionValue: number, priority?: string, eventType?: string): number {
  let score = congestionValue * 0.7
  if (priority === 'High') score += 20
  else if (priority === 'Medium') score += 10
  if (eventType === 'unplanned') score += 10
  return Math.min(100, Math.max(0, Math.round(score)))
}

export function ExecutiveOverview() {
  const { incidents, bulkPredictions, isBulkMode, predictionResult, predictionInput, setBulkPredictions, setCurrentPage } = useTrafficStore()

  // Dynamic KPI Metrics computation
  const metrics = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const len = bulkPredictions.length
      const avgCongestion = bulkPredictions.reduce((acc, curr) => acc + curr.result.congestionValue, 0) / len

      const riskSum = bulkPredictions.reduce((acc, curr) => {
        return acc + calculateRiskScore(curr.result.congestionValue, curr.input.priority, curr.input.eventType)
      }, 0)
      const avgRisk = Math.round(riskSum / len)
      const avgDelay = avgCongestion * 0.4
      const avgVehicles = Math.round(avgCongestion * 150)

      // Determine emergency level
      const hasHighCritical = bulkPredictions.some(p => p.result.congestionLevel === 'High' && p.input.priority === 'High')
      const hasHigh = bulkPredictions.some(p => p.result.congestionLevel === 'High')
      const emergencyLevel = hasHighCritical ? 'Critical Alert' : hasHigh ? 'Active Watch' : 'Standby'
      const emergencyColor = hasHighCritical ? '#ef4444' : hasHigh ? '#f97316' : '#22c55e'

      const activeCount = bulkPredictions.filter(p => p.input.status === 'active').length

      return {
        congestionText: avgCongestion > 70 ? 'High' : avgCongestion > 40 ? 'Moderate' : 'Low',
        congestionVal: avgCongestion,
        congestionColor: avgCongestion > 70 ? '#ef4444' : avgCongestion > 40 ? '#eab308' : '#22c55e',
        congestionSub: `Avg score: ${avgCongestion.toFixed(1)}`,

        riskValue: avgRisk.toString(),
        riskSub: avgRisk > 70 ? 'High Risk' : avgRisk > 40 ? 'Medium Risk' : 'Low Risk',
        riskColor: avgRisk > 70 ? '#ef4444' : avgRisk > 40 ? '#f97316' : '#22c55e',

        delayText: `${avgDelay.toFixed(0)} min`,
        delaySub: 'Avg predicted delay',

        vehiclesText: formatNumber(avgVehicles),
        vehiclesSub: 'Estimated flow rate',

        emergencyText: emergencyLevel,
        emergencySub: hasHighCritical ? 'Critical events active' : 'All clear standby',
        emergencyColor,

        incidentsText: len.toString(),
        incidentsSub: `${activeCount} active in batch`,

        bannerText: `Batch Analysis Mode — Currently displaying metrics for ${len} spreadsheet events.`
      }
    } else if (predictionResult) {
      // Single Prediction Mode
      const val = predictionResult.congestionValue
      const risk = calculateRiskScore(val, predictionInput.priority, predictionInput.eventType)
      const delay = val * 0.4
      const vehicles = Math.round(val * 150)
      const emergencyLevel = predictionResult.congestionLevel === 'High' ? 'Active Watch' : 'Standby'
      const emergencyColor = predictionResult.congestionLevel === 'High' ? '#f97316' : '#22c55e'

      return {
        congestionText: predictionResult.congestionLevel,
        congestionVal: val,
        congestionColor: getCongestionColor(predictionResult.congestionLevel),
        congestionSub: `Score: ${val.toFixed(1)}`,

        riskValue: risk.toString(),
        riskSub: risk > 70 ? 'High Risk' : risk > 40 ? 'Medium Risk' : 'Low Risk',
        riskColor: risk > 70 ? '#ef4444' : risk > 40 ? '#f97316' : '#22c55e',

        delayText: `${delay.toFixed(0)} min`,
        delaySub: 'Predicted incident delay',

        vehiclesText: formatNumber(vehicles),
        vehiclesSub: 'Affected vehicle flow',

        emergencyText: emergencyLevel,
        emergencySub: predictionResult.congestionLevel === 'High' ? 'Elevated congestion' : 'Normal parameters',
        emergencyColor,

        incidentsText: '1',
        incidentsSub: 'Single active prediction',

        bannerText: 'Single Prediction Mode — Displaying metrics for current parameters.'
      }
    } else {
      // Default/Demo Mode
      return {
        congestionText: 'Moderate',
        congestionVal: 48,
        congestionColor: '#eab308',
        congestionSub: 'Level 2 of 5',

        riskValue: '62',
        riskSub: 'Medium Risk',
        riskColor: '#f97316',

        delayText: '18 min',
        delaySub: 'Avg across zones',

        vehiclesText: formatNumber(12453),
        vehiclesSub: '+5% from yesterday',

        emergencyText: 'Standby',
        emergencySub: 'No active emergencies',
        emergencyColor: '#22c55e',

        incidentsText: '15',
        incidentsSub: '3 unresolved',

        bannerText: 'Demo Mode — Showing static system baseline parameters. Adjust inputs or upload a spreadsheet.'
      }
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  // Hourly congestion pattern computation
  const hourlyData = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      return Array.from({ length: 24 }, (_, h) => {
        const matches = bulkPredictions.filter(p => p.input.hour === h)
        const avgCong = matches.length > 0
          ? matches.reduce((acc, curr) => acc + curr.result.congestionValue, 0) / matches.length
          : 0
        const volume = matches.length > 0 ? matches.length * 1500 : 0
        return {
          hour: `${h}:00`,
          congestion: Math.round(avgCong * 10) / 10,
          volume,
        }
      })
    } else {
      // Default/Baseline hourly pattern
      return Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        congestion: 30 + Math.sin(h / 24 * Math.PI * 2) * 25 + (h % 3 === 0 ? 12 : 5),
        volume: 200 + Math.sin(h / 24 * Math.PI * 2) * 150 + (h % 3 === 0 ? 50 : 20),
      }))
    }
  }, [bulkPredictions, isBulkMode])

  // Incident cause distribution
  const eventDistribution = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const causes = {
        'Accidents': bulkPredictions.filter(p => p.input.eventCause === 'accident').length,
        'Breakdowns': bulkPredictions.filter(p => p.input.eventCause === 'vehicle_breakdown').length,
        'Construction': bulkPredictions.filter(p => p.input.eventCause === 'road_construction').length,
        'Special Events': bulkPredictions.filter(p => p.input.eventCause === 'special_event').length,
        'Others': bulkPredictions.filter(p => p.input.eventCause === 'others').length,
      }
      return [
        { name: 'Accidents', value: causes['Accidents'], color: '#ef4444' },
        { name: 'Breakdowns', value: causes['Breakdowns'], color: '#f97316' },
        { name: 'Construction', value: causes['Construction'], color: '#eab308' },
        { name: 'Special Events', value: causes['Special Events'], color: '#22c55e' },
        { name: 'Others', value: causes['Others'], color: '#6b7280' },
      ].filter(item => item.value > 0)
    } else {
      // Static baseline
      return [
        { name: 'Accidents', value: 35, color: '#ef4444' },
        { name: 'Breakdowns', value: 25, color: '#f97316' },
        { name: 'Construction', value: 20, color: '#eab308' },
        { name: 'Special Events', value: 12, color: '#22c55e' },
        { name: 'Others', value: 8, color: '#6b7280' },
      ]
    }
  }, [bulkPredictions, isBulkMode])

  // Incidents list view source (either parsed spreadsheet records or original incident log)
  const displayIncidents = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      return bulkPredictions.map(p => ({
        id: p.id,
        time: `${p.input.hour}:00`,
        description: p.description || `Incident in ${p.zone}`,
        severity: p.result.congestionLevel === 'High' ? 'critical' : p.result.congestionLevel === 'Medium' ? 'moderate' : 'normal' as const
      }))
    } else {
      return incidents.map(inc => ({
        id: inc.id,
        time: inc.time,
        description: inc.description,
        severity: inc.severity
      }))
    }
  }, [bulkPredictions, isBulkMode, incidents])

  const criticalCount = displayIncidents.filter(i => i.severity === 'critical').length

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-gray-300 flex-1 truncate">{metrics.bannerText}</span>
        {isBulkMode && (
          <button
            onClick={() => setBulkPredictions(null)}
            className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer shrink-0 border border-red-500/20 px-2 py-0.5 rounded bg-red-950/10"
          >
            Clear Batch
          </button>
        )}
        <Badge variant={isBulkMode ? 'danger' : 'success'} className="shrink-0">
          {isBulkMode ? 'Batch' : 'Live'}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Current Congestion', value: metrics.congestionText, icon: Activity, color: metrics.congestionColor, sub: metrics.congestionSub },
          { label: 'Risk Score', value: metrics.riskValue, icon: Shield, color: metrics.riskColor, sub: metrics.riskSub },
          { label: 'Predicted Delay', value: metrics.delayText, icon: Clock, color: '#3b82f6', sub: metrics.delaySub },
          { label: 'Flow Volume', value: metrics.vehiclesText, icon: Car, color: '#22c55e', sub: metrics.vehiclesSub },
          { label: 'Emergency Level', value: metrics.emergencyText, icon: AlertTriangle, color: metrics.emergencyColor, sub: metrics.emergencySub },
          { label: 'Total Events', value: metrics.incidentsText, icon: TrendingUp, color: '#8b5cf6', sub: metrics.incidentsSub },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{kpi.label}</span>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <div className="text-lg font-bold text-white">{kpi.value}</div>
                <div className="text-[10px] text-gray-500 mt-1">{kpi.sub}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-300">
              {isBulkMode ? 'Batch 24-Hour Congestion Pattern' : 'Baseline 24-Hour Congestion Pattern'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="congestion" fill="url(#colorGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-sm text-gray-300">
              {isBulkMode ? 'Batch Incident Distribution' : 'Baseline Incident Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0">
              {eventDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={256}>
                  <PieChart>
                    <Pie data={eventDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {eventDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#e5e7eb' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
                      formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  No incident distribution data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents / Batch Event Log */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm text-gray-300">
            {isBulkMode ? 'Parsed Spreadsheet Event Log' : 'Recent Incidents Log'}
          </CardTitle>
          <Badge variant="outline">{displayIncidents.length} total</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {displayIncidents.length > 0 ? (
              displayIncidents.slice(0, 15).map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                      inc.severity === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                  <span className="text-xs text-gray-500 w-16 shrink-0">{inc.time}</span>
                  <span className="text-sm text-gray-300 flex-1 truncate">{inc.description}</span>
                  <Badge variant={inc.severity === 'critical' ? 'danger' : inc.severity === 'moderate' ? 'warning' : 'success'} className="shrink-0 text-[10px]">
                    {inc.severity}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-gray-500">No events to display.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
