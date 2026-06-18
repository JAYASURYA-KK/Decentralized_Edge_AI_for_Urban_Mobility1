export interface TrafficFeatures {
  hour: number
  day_of_week: number
  month: number
  is_weekend: number
  attendance: number
  rainfall: number
  temperature: number
  road_capacity: number
  nearby_parking: number
  historical_congestion: number
  event_cause_enc: number
  zone_enc: number
  veh_type_enc: number
  event_type_unplanned: number
  priority_Low: number
  priority_Unknown: number
  status_closed: number
  status_resolved: number
  weather_condition_Cloudy: number
  weather_condition_Heavy_Rain: number
  weather_condition_Rainy: number
}

export interface PredictionInput {
  hour: number
  day_of_week: number
  month: number
  is_weekend: boolean
  attendance: number
  rainfall: number
  temperature: number
  road_capacity: number
  nearby_parking: number
  historical_congestion: number
  eventCause: string
  zone: string
  vehicleType: string
  eventType: string
  priority: string
  status: string
  weatherCondition: string
  // Optional location — used for map display (same as lat/lng in CSV batch)
  latitude?: number
  longitude?: number
}

export interface PredictionResult {
  congestionValue: number
  congestionLevel: 'Low' | 'Medium' | 'High'
  confidence: number
  classProbabilities: number[]
}

export interface ResourceAllocation {
  police: number
  ambulance: number
  barricades: number
  towTrucks: number
  totalCost: number
}

export interface Incident {
  id: string
  time: string
  description: string
  severity: 'critical' | 'moderate' | 'normal'
  location: [number, number]
}

export interface Alert {
  id: string
  message: string
  severity: 'critical' | 'moderate' | 'normal'
  timestamp: Date
}

export interface CostBreakdown {
  policeCost: number
  ambulanceCost: number
  barricadeCost: number
  totalCost: number
  savings: number
}

export interface HistoricalDataPoint {
  hour: number
  congestion: number
  delay: number
}

export type DashboardPage = 
  | 'landing'
  | 'executive-overview'
  | 'live-prediction'
  | 'risk-intelligence'
  | 'resource-optimization'
  | 'diversion-planner'
  | 'traffic-heatmap'
  | 'digital-twin'
  | 'cost-optimization'
  | 'explainable-ai'
  | 'historical-analytics'
  | 'incident-timeline'
  | 'alerts-panel'
  | 'overall-report'

export interface BulkPrediction {
  id: string
  input: PredictionInput
  result: PredictionResult
  latitude?: number
  longitude?: number
  description?: string
  address?: string
  timeStr?: string
  priority?: string
  status?: string
  eventCause?: string
  zone?: string
  vehType?: string
}

