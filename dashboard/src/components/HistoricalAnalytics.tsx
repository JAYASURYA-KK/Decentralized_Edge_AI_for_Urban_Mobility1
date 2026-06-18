import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Calendar, Clock, TrendingUp, BarChart3, Database } from 'lucide-react'
import { useTrafficStore } from '@/store/trafficStore'
import { useMemo } from 'react'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function HistoricalAnalytics() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()

  const dataPatterns = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const len = bulkPredictions.length

      // 1. Group by Hour (24h pattern)
      const hourly = Array.from({ length: 24 }, (_, h) => {
        const matches = bulkPredictions.filter(p => p.input.hour === h)
        const avgCong = matches.length > 0
          ? matches.reduce((sum, curr) => sum + curr.result.congestionValue, 0) / matches.length
          : 0
        const avgDelay = avgCong * 0.4
        return {
          hour: `${h}:00`,
          congestion: Math.round(avgCong * 10) / 10,
          delay: Math.round(avgDelay * 10) / 10,
        }
      })

      // 2. Group by Day of Week (Weekly pattern)
      const weekly = DAYS_SHORT.map((dayName, idx) => {
        const matches = bulkPredictions.filter(p => p.input.day_of_week === idx)
        const avgCong = matches.length > 0
          ? matches.reduce((sum, curr) => sum + curr.result.congestionValue, 0) / matches.length
          : 0
        return {
          day: dayName,
          congestion: Math.round(avgCong * 10) / 10,
          incidents: matches.length
        }
      })

      // 3. Group by Month (Monthly Trend)
      const monthly = MONTHS_SHORT.map((monName, idx) => {
        const matches = bulkPredictions.filter(p => p.input.month === (idx + 1))
        const avgCong = matches.length > 0
          ? matches.reduce((sum, curr) => sum + curr.result.congestionValue, 0) / matches.length
          : 0
        const avgDelay = avgCong * 0.4
        return {
          month: monName,
          congestion: Math.round(avgCong * 10) / 10,
          delay: Math.round(avgDelay * 10) / 10
        }
      })

      return {
        hourly,
        weekly,
        monthly,
        banner: `Batch Historical Analysis — Displaying aggregated temporal trends across ${len} events.`
      }
    } else if (predictionResult) {
      // Single prediction active: adjust base profiles based on prediction parameters
      const score = predictionResult.congestionValue
      const delay = score * 0.4
      const p = predictionInput

      // Perturb baseline profiles based on input parameters
      const weatherOffset = p.weatherCondition === 'Heavy Rain' ? 18 : p.weatherCondition === 'Rainy' ? 10 : 0
      const priorityOffset = p.priority === 'High' ? 8 : 0

      const hourly = Array.from({ length: 24 }, (_, h) => {
        const timeFactor = Math.sin(h / 24 * Math.PI * 2) * 15
        const currentHourBias = h === p.hour ? 25 : 0
        const baseCong = Math.min(100, Math.max(10, 40 + timeFactor + weatherOffset + priorityOffset + currentHourBias))
        return {
          hour: `${h}:00`,
          congestion: Math.round(baseCong),
          delay: Math.round(baseCong * 0.35)
        }
      })

      const weekly = DAYS_SHORT.map((dayName, idx) => {
        const isSelectedDay = idx === p.day_of_week
        const baseCong = Math.min(100, Math.max(15, 42 + (idx < 5 ? 12 : -8) + weatherOffset + (isSelectedDay ? 20 : 0)))
        return {
          day: dayName,
          congestion: Math.round(baseCong),
          incidents: idx === p.day_of_week ? 3 : (idx < 5 ? 1 : 0)
        }
      })

      const monthly = MONTHS_SHORT.map((monName, idx) => {
        const isSelectedMonth = (idx + 1) === p.month
        const baseCong = Math.min(100, Math.max(20, 45 + Math.sin(idx / 12 * Math.PI) * 8 + weatherOffset + (isSelectedMonth ? 15 : 0)))
        return {
          month: monName,
          congestion: Math.round(baseCong),
          delay: Math.round(baseCong * 0.35)
        }
      })

      return {
        hourly,
        weekly,
        monthly,
        banner: `Single Historical Profile — Perturbed baseline curves aligned to active parameters (Hour ${p.hour}, Day ${DAYS_SHORT[p.day_of_week]}, Month ${p.month}).`
      }
    } else {
      // Default baseline patterns
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        congestion: Math.round(30 + Math.sin(h / 24 * Math.PI * 2) * 20 + 8),
        delay: Math.round(5 + Math.sin(h / 24 * Math.PI * 2) * 12 + 2),
      }))

      const weekly = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
        day: d,
        congestion: Math.round(45 + (i < 5 ? 15 : -10) + 4),
        incidents: Math.round(8 + (i < 5 ? 6 : -4) + 1),
      }))

      const monthly = MONTHS_SHORT.map((m, i) => ({
        month: m,
        congestion: Math.round(45 + Math.sin((i + 6) / 12 * Math.PI) * 10 + 2),
        delay: Math.round(15 + Math.sin((i + 6) / 12 * Math.PI) * 8 + 1),
      }))

      return {
        hourly,
        weekly,
        monthly,
        banner: 'Demo Mode — Showing historical baseline averages. Run predictions to synchronize temporal charts.'
      }
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  return (
    <div className="space-y-6">
      {/* Dynamic Header Banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800 text-sm">
        {isBulkMode ? <Database className="w-5 h-5 text-blue-400" /> : <Calendar className="w-5 h-5 text-blue-400" />}
        <span className="text-gray-300 flex-1">{dataPatterns.banner}</span>
        {isBulkMode && <Badge variant="danger">Batch Trends</Badge>}
      </div>

      {/* Hourly Pattern */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="flex-row items-center justify-between py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hourly Congestion Pattern</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px]">24-hour view</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={dataPatterns.hourly}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                <Area type="monotone" dataKey="congestion" stroke="#3b82f6" fill="url(#hourlyGrad)" strokeWidth={2} name="Congestion" />
                <Area type="monotone" dataKey="delay" stroke="#eab308" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Delay (min)" />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekday Pattern */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex-row items-center justify-between py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Weekly Congestion Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={dataPatterns.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="congestion" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Congestion" />
                  <Bar dataKey="incidents" fill="#ef4444" radius={[4, 4, 0, 0]} name="Incident Count" />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex-row items-center justify-between py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Annual Monthly Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={dataPatterns.monthly}>
                  <defs>
                    <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="congestion" stroke="#22c55e" fill="url(#monthlyGrad)" strokeWidth={2} name="Congestion" />
                  <Area type="monotone" dataKey="delay" stroke="#3b82f6" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Delay (min)" />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
