import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSeverityColor } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Cpu, Zap, Music, Trophy, Cloud, Users, Database } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { useTrafficStore } from '@/store/trafficStore'
import { calculateRiskScore } from './ExecutiveOverview'
import { getSuggestedResources } from './ResourceOptimization'

const presetScenarios = [
  { id: 'concert', name: 'Concert Impact', icon: Music, desc: '50,000 attendance', color: '#8b5cf6' },
  { id: 'cricket', name: 'Cricket Match', icon: Trophy, desc: '30,000 fans', color: '#3b82f6' },
  { id: 'festival', name: 'Festival Event', icon: Users, desc: '100,000 crowd', color: '#22c55e' },
  { id: 'rain', name: 'Monsoon Rainfall', icon: Cloud, desc: 'Heavy monsoon', color: '#06b6d4' },
]

const multipliers = {
  concert: { congestion: 2.0, delay: 1.8, riskScore: 1.6, resources: 2.5 },
  cricket: { congestion: 1.6, delay: 1.4, riskScore: 1.3, resources: 2.0 },
  festival: { congestion: 2.4, delay: 2.2, riskScore: 2.0, resources: 3.0 },
  rain: { congestion: 1.3, delay: 1.5, riskScore: 1.4, resources: 1.5 },
}

export function DigitalTwin() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [surge, setSurge] = useState(0)

  // Dynamically compute baseline parameters from current store predictions
  const dynamicBase = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const len = bulkPredictions.length
      const scoreSum = bulkPredictions.reduce((acc, curr) => acc + curr.result.congestionValue, 0)
      const congestion = scoreSum / len
      const delay = congestion * 0.4
      
      const riskSum = bulkPredictions.reduce((acc, curr) => {
        return acc + calculateRiskScore(curr.result.congestionValue, curr.input.priority, curr.input.eventType)
      }, 0)
      const riskScore = Math.round(riskSum / len)

      // Suggested resources sum average
      let resSum = 0
      bulkPredictions.forEach(p => {
        const sug = getSuggestedResources(p.input, p.result.congestionLevel, p.result.congestionValue)
        resSum += sug.Police + sug.Ambulance + sug.Barricades + sug['Tow Trucks']
      })
      const resources = Math.round(resSum / len)

      return { congestion, delay, riskScore, resources, label: `Spreadsheet Batch (${len} items)` }
    } else if (predictionResult) {
      const congestion = predictionResult.congestionValue
      const delay = congestion * 0.4
      const riskScore = calculateRiskScore(congestion, predictionInput.priority, predictionInput.eventType)
      const sug = getSuggestedResources(predictionInput, predictionResult.congestionLevel, congestion)
      const resources = sug.Police + sug.Ambulance + sug.Barricades + sug['Tow Trucks']

      return { congestion, delay, riskScore, resources, label: 'Single Active Prediction' }
    } else {
      // Static baseline
      return { congestion: 45, delay: 12, riskScore: 35, resources: 8, label: 'Default System Baseline' }
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  const activeMultiplier = selectedScenario
    ? multipliers[selectedScenario as keyof typeof multipliers] ?? { congestion: 1.0, delay: 1.0, riskScore: 1.0, resources: 1.0 }
    : { congestion: 1.0, delay: 1.0, riskScore: 1.0, resources: 1.0 }
  
  const surgeMult = 1 + surge / 100

  // Simulation calculations
  const simulated = useMemo(() => {
    return {
      congestion: Math.min(100, Math.round((dynamicBase.congestion * activeMultiplier.congestion + 15 * (surgeMult - 1)) * 10) / 10),
      delay: Math.round((dynamicBase.delay * activeMultiplier.delay + 5 * (surgeMult - 1)) * 10) / 10,
      riskScore: Math.min(100, Math.round(dynamicBase.riskScore * activeMultiplier.riskScore + 10 * (surgeMult - 1))),
      resources: Math.round(dynamicBase.resources * activeMultiplier.resources * surgeMult),
    }
  }, [dynamicBase, activeMultiplier, surgeMult])

  const chartData = [
    { name: 'Congestion', value: simulated.congestion, max: 100 },
    { name: 'Delay (min)', value: simulated.delay, max: 50 },
    { name: 'Risk Score', value: simulated.riskScore, max: 100 },
    { name: 'Resources', value: simulated.resources, max: 30 },
  ]

  return (
    <div className="space-y-6">
      {/* Dynamic Header Banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800 text-sm">
        {isBulkMode ? <Database className="w-5 h-5 text-blue-400" /> : <Cpu className="w-5 h-5 text-blue-400" />}
        <span className="text-gray-300 flex-1">
          Digital Twin Engine: Anchored to <strong>{dynamicBase.label}</strong>. Modify surge or select scenarios to simulate deviations.
        </span>
        {isBulkMode && <Badge variant="danger">Batch Simulator</Badge>}
      </div>

      {/* Scenario Presets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {presetScenarios.map((scenario) => {
          const Icon = scenario.icon
          const isSelected = selectedScenario === scenario.id
          return (
            <button key={scenario.id}
              onClick={() => setSelectedScenario(isSelected ? null : scenario.id)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}>
              <Icon className="w-5 h-5 mb-2" style={{ color: scenario.color }} />
              <div className="text-sm font-semibold text-gray-200">{scenario.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{scenario.desc}</div>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Simulation Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Simulated Vehicle Surge:</span>
                  <span className="text-blue-400 font-bold">+{surge}%</span>
                </div>
                <input type="range" min="0" max="100" value={surge}
                  onChange={e => setSurge(parseInt(e.target.value))}
                  className="w-full accent-blue-500 bg-gray-800" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <motion.div key={`congestion-${selectedScenario}`} initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3 }}
                  className="p-3 rounded-lg bg-gray-800/40 border border-gray-850 text-center">
                  <div className="text-xl font-bold" style={{ color: getSeverityColor(simulated.congestion) }}>{simulated.congestion.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Congestion</div>
                </motion.div>
                <motion.div key={`delay-${selectedScenario}`} initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3, delay: 0.05 }}
                  className="p-3 rounded-lg bg-gray-800/40 border border-gray-850 text-center">
                  <div className="text-xl font-bold text-blue-400">{simulated.delay.toFixed(0)} min</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Delay</div>
                </motion.div>
                <motion.div key={`risk-${selectedScenario}`} initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3, delay: 0.1 }}
                  className="p-3 rounded-lg bg-gray-800/40 border border-gray-850 text-center">
                  <div className="text-xl font-bold" style={{ color: getSeverityColor(simulated.riskScore) }}>{simulated.riskScore}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Risk Score</div>
                </motion.div>
                <motion.div key={`res-${selectedScenario}`} initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3, delay: 0.15 }}
                  className="p-3 rounded-lg bg-gray-800/40 border border-gray-850 text-center">
                  <div className="text-xl font-bold text-green-400">{simulated.resources}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Resources</div>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Simulation Impact Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={entry.name} fill={getSeverityColor((entry.value / entry.max) * 100)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
