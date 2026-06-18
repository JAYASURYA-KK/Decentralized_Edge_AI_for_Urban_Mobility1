import type { PredictionInput } from '@/types'

// Encoding maps matching the Python notebook
const eventCauseMap: Record<string, number> = {
  vehicle_breakdown: 0, accident: 1, breakdown: 2,
  special_event: 3, road_construction: 4, others: 5,
}

const zoneMap: Record<string, number> = {
  'Central Zone 1': 0, 'Central Zone 2': 1, 'Outer Zone': 2,
}

const vehTypeMap: Record<string, number> = {
  car: 0, bus: 1, truck: 2,
}

// Scaler parameters extracted from outputs/scaler.pkl (StandardScaler)
// Python scaler fit on: ['hour','day_of_week','month','attendance','rainfall',
//   'temperature','road_capacity','nearby_parking','historical_congestion','duration_minutes']
// NOTE: is_weekend is NOT scaled — it's used as raw 0/1 in the model
// We use indices 0-8 (exclude duration_minutes at index 9)
const SCALER_MEAN = [11.024618, 2.89531, 2.742679, 1467.148225, 7.320564, 27.858673, 3502.708733, 246.824566, 337.795549]
const SCALER_STD = [8.097531, 1.823354, 1.233492, 6272.19534, 15.795172, 5.748619, 1429.970436, 146.681955, 1.030531]

function scale(value: number, mean: number, std: number): number {
  return (value - mean) / std
}

export function buildFeatureVector(input: PredictionInput): Float32Array {
  const vec = new Float32Array(21)
  let i = 0

  // 10 numerical features (9 scaled + is_weekend raw)
  vec[i++] = scale(input.hour, SCALER_MEAN[0], SCALER_STD[0])
  vec[i++] = scale(input.day_of_week, SCALER_MEAN[1], SCALER_STD[1])
  vec[i++] = scale(input.month, SCALER_MEAN[2], SCALER_STD[2])
  // is_weekend: raw 0/1 (NOT scaled in the Python notebook)
  vec[i++] = input.is_weekend ? 1 : 0
  vec[i++] = scale(input.attendance, SCALER_MEAN[3], SCALER_STD[3])
  vec[i++] = scale(input.rainfall, SCALER_MEAN[4], SCALER_STD[4])
  vec[i++] = scale(input.temperature, SCALER_MEAN[5], SCALER_STD[5])
  vec[i++] = scale(input.road_capacity, SCALER_MEAN[6], SCALER_STD[6])
  vec[i++] = scale(input.nearby_parking, SCALER_MEAN[7], SCALER_STD[7])
  vec[i++] = scale(input.historical_congestion, SCALER_MEAN[8], SCALER_STD[8])

  // 3 label-encoded features
  vec[i++] = eventCauseMap[input.eventCause] ?? 0
  vec[i++] = zoneMap[input.zone] ?? 0
  vec[i++] = vehTypeMap[input.vehicleType] ?? 0

  // 8 one-hot encoded features (OHE with drop='first')
  vec[i++] = input.eventType === 'unplanned' ? 1 : 0
  vec[i++] = input.priority === 'Low' ? 1 : 0
  vec[i++] = input.priority === 'Unknown' ? 1 : 0
  vec[i++] = input.status === 'closed' ? 1 : 0
  vec[i++] = input.status === 'resolved' ? 1 : 0
  vec[i++] = input.weatherCondition === 'Cloudy' ? 1 : 0
  vec[i++] = input.weatherCondition === 'Heavy Rain' ? 1 : 0
  vec[i] = input.weatherCondition === 'Rainy' ? 1 : 0

  return vec
}

export function getDefaultInput(): PredictionInput {
  // Fixed morning-peak scenario for a meaningful demo prediction
  // (Hour 9 = AM rush, weekday, Central Zone 1, unplanned accident)
  return {
    hour: 9,
    day_of_week: 4,
    month: 6,
    is_weekend: false,
    attendance: 5000,
    rainfall: 0,
    temperature: 28,
    road_capacity: 3000,
    nearby_parking: 100,
    historical_congestion: 50,
    eventCause: 'vehicle_breakdown',
    zone: 'Central Zone 1',
    vehicleType: 'car',
    eventType: 'unplanned',
    priority: 'High',
    status: 'active',
    weatherCondition: 'Clear',
    // Default location: Silk Board Junction, Bengaluru
    // Same field as lat/lng in CSV batch — used for map display only
    latitude: 12.9344,
    longitude: 77.6101,
  }
}
