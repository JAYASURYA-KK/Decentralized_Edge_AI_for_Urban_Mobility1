import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Truck, Shield, Ambulance, Cone, AlertTriangle, Database } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTrafficStore } from '@/store/trafficStore'

const UNIT_COSTS = {
  Police: 500,
  Ambulance: 1200,
  Barricades: 50,
  'Tow Trucks': 800
}

const severityLevels = [
  { label: 'Low Traffic', multiplier: 0.5 },
  { label: 'Moderate Traffic', multiplier: 1.0 },
  { label: 'Heavy Traffic', multiplier: 1.5 },
  { label: 'Critical', multiplier: 2.0 },
]

// Logic to dynamically estimate resource needs based on predicted level and cause
export function getSuggestedResources(input: { eventCause: string; priority: string }, level: 'Low' | 'Medium' | 'High', score: number) {
  let police = 2
  let ambulance = 0
  let barricades = 4
  let towTrucks = 1

  if (level === 'Medium') {
    police = 5
    ambulance = 1
    barricades = 10
    towTrucks = 2
  } else if (level === 'High') {
    if (score > 75) { // Critical
      police = 12
      ambulance = 3
      barricades = 30
      towTrucks = 5
    } else {
      police = 8
      ambulance = 2
      barricades = 20
      towTrucks = 3
    }
  }

  // Adjustments based on event cause
  if (input.eventCause === 'accident') {
    ambulance += 1
    towTrucks += 1
    police += 1
  } else if (input.eventCause === 'road_construction') {
    barricades += 15
    police += 1
  } else if (input.eventCause === 'vehicle_breakdown') {
    towTrucks += 1
  }

  // Priority adjustment
  if (input.priority === 'High') {
    police += 1
  }

  return { Police: police, Ambulance: ambulance, Barricades: barricades, 'Tow Trucks': towTrucks }
}

export function ResourceOptimization() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()

  // Slider state for manual override / demo mode
  const [selectedSeverity, setSelectedSeverity] = useState(1)

  // Track user edits for current allocation in single/demo mode
  const [editedUnits, setEditedUnits] = useState<Record<string, number>>({
    Police: 12,
    Ambulance: 6,
    Barricades: 20,
    'Tow Trucks': 8
  })

  // Sync manual slider if single prediction is run
  useEffect(() => {
    if (predictionResult && !isBulkMode) {
      const score = predictionResult.congestionValue
      const level = predictionResult.congestionLevel
      // eslint-disable-next-line
      setSelectedSeverity(level === 'High' ? (score > 75 ? 3 : 2) : level === 'Medium' ? 1 : 0)

      // Initialize edited units with a wasteful default baseline relative to suggested
      const sug = getSuggestedResources(predictionInput, level, score)
      setEditedUnits({
        Police: Math.round(sug.Police * 1.3),
        Ambulance: Math.round(sug.Ambulance * 1.3) || 1,
        Barricades: Math.round(sug.Barricades * 1.3),
        'Tow Trucks': Math.round(sug['Tow Trucks'] * 1.3)
      })
    }
  }, [predictionResult, predictionInput, isBulkMode])

  // Aggregate resource data calculations
  const resourceData = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      // Aggregate across all batch records
      let policeSug = 0, ambulanceSug = 0, barricadesSug = 0, towTrucksSug = 0

      bulkPredictions.forEach(p => {
        const sug = getSuggestedResources(p.input, p.result.congestionLevel, p.result.congestionValue)
        policeSug += sug.Police
        ambulanceSug += sug.Ambulance
        barricadesSug += sug.Barricades
        towTrucksSug += sug['Tow Trucks']
      })

      // Wasteful baseline without model optimization is 30% higher
      const policeCur = Math.round(policeSug * 1.35)
      const ambulanceCur = Math.round(ambulanceSug * 1.35)
      const barricadesCur = Math.round(barricadesSug * 1.35)
      const towTrucksCur = Math.round(towTrucksSug * 1.35)

      return {
        isBatch: true,
        banner: `Aggregate Resource Allocations — Compiled suggested resources for ${bulkPredictions.length} incidents.`,
        resources: [
          { type: 'Police', units: policeCur, suggested: policeSug, costPerUnit: UNIT_COSTS.Police, color: '#3b82f6', icon: Shield },
          { type: 'Ambulance', units: ambulanceCur, suggested: ambulanceSug, costPerUnit: UNIT_COSTS.Ambulance, color: '#22c55e', icon: Ambulance },
          { type: 'Barricades', units: barricadesCur, suggested: barricadesSug, costPerUnit: UNIT_COSTS.Barricades, color: '#eab308', icon: Cone },
          { type: 'Tow Trucks', units: towTrucksCur, suggested: towTrucksSug, costPerUnit: UNIT_COSTS['Tow Trucks'], color: '#f97316', icon: Truck },
        ],
        severityMult: 1.0
      }
    } else {
      // Single prediction or Demo Mode
      const sug = predictionResult
        ? getSuggestedResources(predictionInput, predictionResult.congestionLevel, predictionResult.congestionValue)
        : { Police: 8, Ambulance: 3, Barricades: 12, 'Tow Trucks': 5 }

      const mult = 1 + selectedSeverity * 0.25

      return {
        isBatch: false,
        banner: predictionResult 
          ? 'Single Prediction Mode — Adjust current allocation to see cost savings vs model suggestions.' 
          : 'Demo Mode — Showing baseline values. Drag severity to override or run prediction.',
        resources: [
          { type: 'Police', units: editedUnits.Police, suggested: sug.Police, costPerUnit: UNIT_COSTS.Police, color: '#3b82f6', icon: Shield },
          { type: 'Ambulance', units: editedUnits.Ambulance, suggested: sug.Ambulance, costPerUnit: UNIT_COSTS.Ambulance, color: '#22c55e', icon: Ambulance },
          { type: 'Barricades', units: editedUnits.Barricades, suggested: sug.Barricades, costPerUnit: UNIT_COSTS.Barricades, color: '#eab308', icon: Cone },
          { type: 'Tow Trucks', units: editedUnits['Tow Trucks'], suggested: sug['Tow Trucks'], costPerUnit: UNIT_COSTS['Tow Trucks'], color: '#f97316', icon: Truck },
        ],
        severityMult: mult
      }
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput, selectedSeverity, editedUnits])

  // Calculation of summary numbers
  const totals = useMemo(() => {
    const mult = resourceData.severityMult
    const currentCost = resourceData.resources.reduce((sum, r) => sum + r.units * r.costPerUnit, 0) * mult
    const suggestedCost = resourceData.resources.reduce((sum, r) => sum + r.suggested * r.costPerUnit, 0) * mult
    const savings = currentCost - suggestedCost
    const efficiency = currentCost > 0 ? (savings / currentCost) * 100 : 0

    const pieData = resourceData.resources.map(r => ({
      name: r.type,
      value: r.suggested * r.costPerUnit * mult,
      color: r.color
    }))

    return { currentCost, suggestedCost, savings, efficiency, pieData }
  }, [resourceData])

  const decUnit = (type: string) => {
    if (resourceData.isBatch) return
    setEditedUnits(prev => ({ ...prev, [type]: Math.max(0, prev[type]! - 1) }))
  }

  const incUnit = (type: string) => {
    if (resourceData.isBatch) return
    setEditedUnits(prev => ({ ...prev, [type]: prev[type]! + 1 }))
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Header Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-lg bg-gray-900/40 border border-gray-800 text-sm">
        {resourceData.isBatch ? <Database className="w-5 h-5 text-blue-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
        <span className="text-gray-300 flex-1">{resourceData.banner}</span>
        {resourceData.isBatch && <Badge variant="danger">Batch Aggregated</Badge>}
      </div>

      {/* Severity Slider (Visible only in Single/Demo Mode) */}
      {!resourceData.isBatch && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider shrink-0">Inferred Severity:</span>
              <div className="flex-1">
                <input type="range" min="0" max="3" value={selectedSeverity}
                  onChange={e => setSelectedSeverity(parseInt(e.target.value))}
                  className="w-full accent-blue-500 bg-gray-800" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  {severityLevels.map(s => <span key={s.label}>{s.label}</span>)}
                </div>
              </div>
              <Badge variant={selectedSeverity >= 2 ? 'danger' : selectedSeverity >= 1 ? 'warning' : 'success'} className="ml-auto">
                {severityLevels[selectedSeverity]?.label ?? 'Normal'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Resource Cards */}
        <div className="space-y-3">
          {resourceData.resources.map((res) => {
            const Icon = res.icon
            return (
              <motion.div
                key={res.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-600 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${res.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: res.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-200">{res.type}</div>
                      <div className="text-xs text-gray-500">${res.costPerUnit}/unit</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!resourceData.isBatch && (
                        <button onClick={() => decUnit(res.type)}
                          className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-base font-bold transition-all active:scale-90 select-none">
                          -
                        </button>
                      )}
                      <div className="text-center w-12 shrink-0">
                        <span className="text-base font-bold text-white block tabular-nums">
                          {res.units}
                        </span>
                        <span className="text-[10px] text-gray-500 block">Current</span>
                      </div>
                      {!resourceData.isBatch && (
                        <button onClick={() => incUnit(res.type)}
                          className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-base font-bold transition-all active:scale-90 select-none">
                          +
                        </button>
                      )}
                    </div>

                    <div className="text-right shrink-0 min-w-[100px]">
                      <div className="text-sm text-gray-300 font-bold tabular-nums">
                        ${(res.units * res.costPerUnit * resourceData.severityMult).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-green-400 mt-0.5">
                        Suggested: <span className="font-semibold">{res.suggested}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Charts & Summaries */}
        <div className="space-y-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="py-3.5 border-b border-gray-800">
              <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Suggested Cost Allocation</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-44 w-full min-w-0">
                <ResponsiveContainer width="100%" height={176}>
                  <PieChart>
                    <Pie data={totals.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={3} dataKey="value" isAnimationActive={true}>
                      {totals.pieData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Cost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cost Summary */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="py-3.5 border-b border-gray-800">
              <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Optimizer Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Baseline Cost', value: totals.currentCost, color: 'text-gray-400', prefix: '$', suffix: '' },
                  { label: 'Optimized Cost', value: totals.suggestedCost, color: 'text-green-400 font-bold', prefix: '$', suffix: '' },
                  { label: 'Model Savings', value: totals.savings, color: 'text-emerald-400 font-bold', prefix: '$', suffix: '' },
                  { label: 'Efficiency Gain', value: totals.efficiency, color: 'text-blue-400 font-bold', prefix: '', suffix: '%' },
                ].map((item) => (
                  <div key={item.label}
                    className="p-3 rounded-lg bg-gray-800/40 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</div>
                    <div className={`text-lg ${item.color} tabular-nums`}>
                      {item.prefix}
                      {formatNumber(item.value, item.suffix === '%' ? 1 : 0)}
                      {item.suffix}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
