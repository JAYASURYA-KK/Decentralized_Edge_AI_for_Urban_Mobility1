import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSeverityColor } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useTrafficStore } from '@/store/trafficStore'
import { calculateRiskScore } from './ExecutiveOverview'
import { useMemo } from 'react'

function Gauge({ value }: { value: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const arcLength = circumference * 0.75 // 270 degrees
  const offset = circumference * 0.125
  const color = getSeverityColor(value)

  return (
    <svg width="200" height="160" viewBox="0 0 200 160">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path d="M 30 140 A 70 70 0 1 1 170 140"
        fill="none" stroke="#374151" strokeWidth="14" strokeLinecap="round" />
      {/* Progress arc */}
      <path d="M 30 140 A 70 70 0 1 1 170 140"
        fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * arcLength} ${circumference}`}
        strokeDashoffset={-offset}
        className="transition-all duration-1000" />
      {/* Center text */}
      <text x="100" y="110" textAnchor="middle" fill="white" fontSize="36" fontWeight="bold">
        {value}
      </text>
      <text x="100" y="132" textAnchor="middle" fill="#6b7280" fontSize="11">
        Risk Score
      </text>
    </svg>
  )
}

export function RiskIntelligence() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()

  const riskStats = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const len = bulkPredictions.length
      const avgCongestion = bulkPredictions.reduce((acc, curr) => acc + curr.result.congestionValue, 0) / len
      const riskSum = bulkPredictions.reduce((acc, curr) => {
        return acc + calculateRiskScore(curr.result.congestionValue, curr.input.priority, curr.input.eventType)
      }, 0)
      const riskScore = Math.round(riskSum / len)
      const heatLevel = riskScore > 70 ? 'High' : riskScore > 40 ? 'Moderate' : 'Low'
      const severityLabel = riskScore > 80 ? 'Critical' : riskScore > 60 ? 'Elevated' : riskScore > 40 ? 'Moderate' : 'Low'

      // Dynamic risk factors
      const weatherUnfavorable = bulkPredictions.filter(p => p.input.weatherCondition !== 'Clear').length
      const weatherPct = Math.round((weatherUnfavorable / len) * 100)
      const incidentCountVal = Math.min(100, len * 6)
      const capacityDef = Math.round(100 - (bulkPredictions.reduce((acc, curr) => acc + curr.input.road_capacity, 0) / len / 4000) * 100)
      const emergencyPct = Math.round(avgCongestion * 0.9)

      const riskFactors = [
        { name: 'Vehicle Density', value: Math.min(100, Math.round(avgCongestion * 1.1)), impact: avgCongestion > 70 ? 'High' as const : avgCongestion > 40 ? 'Moderate' as const : 'Low' as const },
        { name: 'Weather Severity', value: weatherPct, impact: weatherPct > 60 ? 'High' as const : weatherPct > 30 ? 'Moderate' as const : 'Low' as const },
        { name: 'Incident Frequency', value: incidentCountVal, impact: incidentCountVal > 70 ? 'High' as const : incidentCountVal > 40 ? 'Moderate' as const : 'Low' as const },
        { name: 'Road Capacity Deficiency', value: Math.max(0, capacityDef), impact: capacityDef > 50 ? 'High' as const : capacityDef > 25 ? 'Moderate' as const : 'Low' as const },
        { name: 'Emergency Needs Ratio', value: emergencyPct, impact: emergencyPct > 70 ? 'High' as const : emergencyPct > 40 ? 'Moderate' as const : 'Low' as const },
      ]

      // Zone risk
      const zoneRisks = ['Central Zone 1', 'Central Zone 2', 'Outer Zone'].map((z) => {
        const matches = bulkPredictions.filter(p => p.input.zone === z)
        const zRisk = matches.length > 0
          ? Math.round(matches.reduce((acc, curr) => acc + calculateRiskScore(curr.result.congestionValue, curr.input.priority, curr.input.eventType), 0) / matches.length)
          : 30
        return { name: z, score: zRisk }
      })

      // Add extra mock zones to pad list beautifully if needed
      const allZones = [
        ...zoneRisks,
        { name: 'Outer Zone North', score: Math.round(riskScore * 0.8) },
        { name: 'East Corridor', score: Math.round(riskScore * 0.95) },
        { name: 'West Corridor', score: Math.round(riskScore * 0.7) },
      ]

      return { riskScore, heatLevel, severityLabel, riskFactors, zones: allZones }
    } else if (predictionResult) {
      // Single prediction active
      const val = predictionResult.congestionValue
      const riskScore = calculateRiskScore(val, predictionInput.priority, predictionInput.eventType)
      const heatLevel = riskScore > 70 ? 'High' : riskScore > 40 ? 'Moderate' : 'Low'
      const severityLabel = riskScore > 80 ? 'Critical' : riskScore > 60 ? 'Elevated' : riskScore > 40 ? 'Moderate' : 'Low'

      const weatherPct = predictionInput.weatherCondition === 'Heavy Rain' ? 100 : predictionInput.weatherCondition === 'Rainy' ? 60 : predictionInput.weatherCondition === 'Cloudy' ? 30 : 0
      const capacityDef = Math.round(Math.max(0, 100 - (predictionInput.road_capacity / 4000) * 100))

      const riskFactors = [
        { name: 'Vehicle Density', value: Math.min(100, Math.round(val * 1.1)), impact: val > 70 ? 'High' as const : val > 40 ? 'Moderate' as const : 'Low' as const },
        { name: 'Weather Severity', value: weatherPct, impact: weatherPct > 60 ? 'High' as const : weatherPct > 30 ? 'Moderate' as const : 'Low' as const },
        { name: 'Incident Frequency', value: 30, impact: 'Low' as const },
        { name: 'Road Capacity Deficiency', value: capacityDef, impact: capacityDef > 50 ? 'High' as const : 'Low' as const },
        { name: 'Emergency Needs Ratio', value: Math.round(val * 0.9), impact: val > 60 ? 'High' as const : 'Moderate' as const },
      ]

      const zones = [
        { name: 'Central Zone 1', score: predictionInput.zone === 'Central Zone 1' ? riskScore : 35 },
        { name: 'Central Zone 2', score: predictionInput.zone === 'Central Zone 2' ? riskScore : 40 },
        { name: 'Outer Zone', score: predictionInput.zone === 'Outer Zone' ? riskScore : 45 },
        { name: 'Outer Zone North', score: 38 },
        { name: 'East Corridor', score: 48 },
        { name: 'West Corridor', score: 32 },
      ]

      return { riskScore, heatLevel, severityLabel, riskFactors, zones }
    } else {
      // Fallback baseline/mock
      const riskScore = 62
      const heatLevel = 'Moderate'
      const severityLabel = 'Elevated'
      const riskFactors = [
        { name: 'Vehicle Density', value: 78, impact: 'High' as const },
        { name: 'Weather Severity', value: 45, impact: 'Moderate' as const },
        { name: 'Incident Frequency', value: 65, impact: 'High' as const },
        { name: 'Road Capacity', value: 35, impact: 'Low' as const },
        { name: 'Emergency Response', value: 55, impact: 'Moderate' as const },
      ]
      const zones = [
        { name: 'Central Zone 1', score: 68 },
        { name: 'Central Zone 2', score: 55 },
        { name: 'Outer Zone North', score: 42 },
        { name: 'Outer Zone South', score: 45 },
        { name: 'East Corridor', score: 58 },
        { name: 'West Corridor', score: 35 },
      ]

      return { riskScore, heatLevel, severityLabel, riskFactors, zones }
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Risk Gauge */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300">Overall Risk Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Gauge value={riskStats.riskScore} />
          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4" style={{ color: getSeverityColor(riskStats.riskScore) }} />
            <span className="text-lg font-bold" style={{ color: getSeverityColor(riskStats.riskScore) }}>{riskStats.severityLabel}</span>
          </div>
          <Badge variant={riskStats.heatLevel === 'High' ? 'danger' : riskStats.heatLevel === 'Moderate' ? 'warning' : 'success'} className="mt-2">
            {riskStats.heatLevel} Heat Level
          </Badge>
        </CardContent>
      </Card>

      {/* Risk Factors */}
      <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300">Risk Factor Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskStats.riskFactors.map((factor, idx) => (
              <motion.div key={factor.name}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{factor.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{factor.value}%</span>
                    <Badge variant={factor.impact === 'High' ? 'danger' : factor.impact === 'Moderate' ? 'warning' : 'success'} className="text-[10px]">
                      {factor.impact}
                    </Badge>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${factor.value}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${getSeverityColor(factor.value)}, ${getSeverityColor(Math.min(factor.value + 20, 100))})` }} />
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Zone Risk Distribution */}
      <Card className="lg:col-span-3 bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm text-gray-300">Zone-wise Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {riskStats.zones.map((z) => (
              <div key={z.name} className="p-3 rounded-lg border text-center transition-colors"
                style={{ borderColor: `${getSeverityColor(z.score)}40`, background: `${getSeverityColor(z.score)}10` }}>
                <div className="text-lg font-bold" style={{ color: getSeverityColor(z.score) }}>{z.score.toFixed(0)}</div>
                <div className="text-xs text-gray-400 mt-1 truncate" title={z.name}>{z.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
