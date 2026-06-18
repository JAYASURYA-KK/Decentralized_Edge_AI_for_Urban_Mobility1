import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, CheckCircle, Database } from 'lucide-react'
import { useTrafficStore } from '@/store/trafficStore'
import { useMemo } from 'react'

export function IncidentTimeline() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()

  // Generate dynamic event log lists
  const timelineEvents = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      return bulkPredictions.slice(0, 15).map(p => {
        const isResolved = p.input.status === 'resolved' || p.input.status === 'closed'
        const duration = isResolved ? `${Math.round(p.result.congestionValue * 1.2)} min` : 'Ongoing'
        return {
          time: `${p.input.hour}:00`,
          description: p.description || `${p.input.eventCause.replace(/_/g, ' ')} incident in ${p.input.zone}`,
          severity: p.result.congestionLevel === 'High' ? 'critical' as const : p.result.congestionLevel === 'Medium' ? 'moderate' as const : 'normal' as const,
          status: p.input.status === 'resolved' ? 'Resolved' : p.input.status === 'closed' ? 'Closed' : 'Active',
          duration,
          id: p.id
        }
      })
    } else if (predictionResult) {
      // Single prediction timeline
      const p = predictionInput
      const res = predictionResult
      const isResolved = p.status === 'resolved' || p.status === 'closed'
      const duration = isResolved ? `${Math.round(res.congestionValue * 1.2)} min` : 'Ongoing'
      return [
        {
          time: `${p.hour}:00`,
          description: `Single Prediction Event: ${p.eventCause.replace(/_/g, ' ')} at ${p.zone} corridor`,
          severity: res.congestionLevel === 'High' ? 'critical' as const : res.congestionLevel === 'Medium' ? 'moderate' as const : 'normal' as const,
          status: p.status === 'resolved' ? 'Resolved' : p.status === 'closed' ? 'Closed' : 'Active',
          duration,
          id: 'FKID_ACTIVE'
        }
      ]
    } else {
      // Fallback baseline
      return [
        { time: '8:30 AM', description: 'Accident reported at Silk Board Junction', severity: 'critical' as const, status: 'Resolved', duration: '45 min', id: '1' },
        { time: '9:00 AM', description: 'Heavy congestion on Outer Ring Road', severity: 'critical' as const, status: 'Active', duration: 'Ongoing', id: '2' },
        { time: '9:15 AM', description: 'Emergency services dispatched to Silk Board', severity: 'moderate' as const, status: 'Resolved', duration: '30 min', id: '3' },
        { time: '9:20 AM', description: 'Diversion activated at Hebbal Flyover', severity: 'moderate' as const, status: 'Active', duration: 'Ongoing', id: '4' },
        { time: '9:35 AM', description: 'Traffic cleared at Silk Board Junction', severity: 'normal' as const, status: 'Resolved', duration: '65 min', id: '5' },
        { time: '10:00 AM', description: 'Vehicle breakdown on NICE Road', severity: 'moderate' as const, status: 'Active', duration: 'Ongoing', id: '6' },
        { time: '10:15 AM', description: 'Tow truck dispatched to NICE Road', severity: 'normal' as const, status: 'Dispatched', duration: '10 min ago', id: '7' },
        { time: '10:30 AM', description: 'Road maintenance work near KR Puram', severity: 'normal' as const, status: 'Scheduled', duration: 'From 2 PM', id: '8' },
      ]
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="flex-row items-center justify-between py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          {isBulkMode ? <Database className="w-4 h-4 text-blue-400" /> : <Clock className="w-4 h-4 text-gray-500" />}
          <CardTitle className="text-sm text-gray-300">
            {isBulkMode ? 'Parsed Batch Incident Log' : 'Incident Timeline'}
          </CardTitle>
        </div>
        <Badge variant="outline">{timelineEvents.length} events</Badge>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-800" />

          <div className="space-y-0 max-h-[480px] overflow-y-auto pr-1">
            {timelineEvents.map((event, idx) => (
              <motion.div key={`${event.id}-${idx}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(1.0, idx * 0.05) }}
                className="relative flex gap-4 pb-6 last:pb-0">
                
                {/* Timeline dot */}
                <div className="relative z-10 mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                    event.severity === 'critical' ? 'border-red-500 bg-red-500/30' :
                    event.severity === 'moderate' ? 'border-yellow-500 bg-yellow-500/30' :
                    'border-green-500 bg-green-500/30'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-400">{event.time}</span>
                    <span className="text-[10px] text-gray-600">•</span>
                    <span className="text-[10px] text-gray-500">{event.duration}</span>
                    <Badge variant={
                      event.status === 'Resolved' || event.status === 'Closed' ? 'success' :
                      event.status === 'Active' ? 'danger' :
                      event.status === 'Dispatched' ? 'warning' :
                      'outline'
                    } className="ml-auto text-[10px] py-0 px-1.5 font-medium">
                      {event.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-300 leading-normal">{event.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
