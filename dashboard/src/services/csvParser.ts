import type { PredictionInput } from '@/types'

// Helper to parse dates like "2024-03-07 17:01:48.111+00"
function parseDateTime(dtStr: string): Date {
  if (!dtStr || dtStr === 'NULL') return new Date()
  try {
    const d = new Date(dtStr.replace(' ', 'T'))
    if (isNaN(d.getTime())) return new Date()
    return d
  } catch {
    return new Date()
  }
}

// Maps a raw row from CSV/Excel to PredictionInput and returns original metadata
export interface ParsedCSVRow {
  input: PredictionInput
  latitude?: number
  longitude?: number
  description: string
  address: string
  id: string
}

export function parseCSV(csvText: string): ParsedCSVRow[] {
  const lines = csvText.split(/\r?\n/)
  if (lines.length < 2) return []

  // Split headers and trim
  const headers = parseCSVLine(lines[0] || '').map(h => h.trim().toLowerCase())
  const results: ParsedCSVRow[] = []

  for (let idx = 1; idx < lines.length; idx++) {
    const line = lines[idx]
    if (!line || line.trim() === '') continue

    const values = parseCSVLine(line)
    if (values.length < headers.length) continue

    // Construct raw object
    const raw: Record<string, string> = {}
    headers.forEach((header, i) => {
      raw[header] = (values[i] ?? '').trim()
    })

    const id = raw['id'] || `FKID${100000 + idx}`
    const dt = parseDateTime(raw['start_datetime'] || '')
    const eventType = raw['event_type'] === 'planned' ? 'planned' : 'unplanned'

    // Normalize event cause
    const causeRaw = (raw['event_cause'] || '').toLowerCase()
    let eventCause = 'others'
    if (causeRaw.includes('breakdown')) {
      eventCause = 'vehicle_breakdown'
    } else if (causeRaw.includes('accident')) {
      eventCause = 'accident'
    } else if (causeRaw.includes('construction')) {
      eventCause = 'road_construction'
    } else if (causeRaw.includes('event')) {
      eventCause = 'special_event'
    } else if (causeRaw.includes('tree')) {
      eventCause = 'others' // Will fall into 'others' map
    }

    // Normalize vehicle type
    const vehRaw = (raw['veh_type'] || '').toLowerCase()
    let vehicleType = 'car'
    if (vehRaw.includes('truck') || vehRaw.includes('lcv') || vehRaw.includes('heavy') || vehRaw.includes('goods')) {
      vehicleType = 'truck'
    } else if (vehRaw.includes('bus')) {
      vehicleType = 'bus'
    }

    // Normalize zone
    const zoneRaw = raw['zone'] || ''
    let zone = 'Outer Zone'
    if (zoneRaw.includes('Central Zone 1')) {
      zone = 'Central Zone 1'
    } else if (zoneRaw.includes('Central Zone 2')) {
      zone = 'Central Zone 2'
    } else if (zoneRaw.includes('Central')) {
      zone = 'Central Zone 1'
    }

    // Normalize priority & status
    const priority = raw['priority'] === 'Low' ? 'Low' : raw['priority'] === 'Medium' ? 'Medium' : raw['priority'] === 'High' ? 'High' : 'Unknown'
    const status = raw['status'] === 'closed' ? 'closed' : raw['status'] === 'resolved' ? 'resolved' : 'active'

    // Weather condition mappings
    const weatherRaw = (raw['weather'] || raw['weather_condition'] || '').toLowerCase()
    let weatherCondition = 'Clear'
    if (weatherRaw.includes('cloud')) {
      weatherCondition = 'Cloudy'
    } else if (weatherRaw.includes('heavy rain')) {
      weatherCondition = 'Heavy Rain'
    } else if (weatherRaw.includes('rain')) {
      weatherCondition = 'Rainy'
    } else if (causeRaw.includes('water_logging')) {
      weatherCondition = 'Rainy'
    }

    // Numbers & environment fallbacks
    const hour = dt.getHours()
    const dayOfWeek = dt.getDay()
    const month = dt.getMonth() + 1
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Compute duration from start/end datetime (strong severity signal)
    const endDt = parseDateTime(raw['end_datetime'] || '')
    const durationMin = (!isNaN(endDt.getTime()) && !isNaN(dt.getTime()) && endDt > dt)
      ? Math.max(0, (endDt.getTime() - dt.getTime()) / 60000)
      : 0

    // Check if road closure required (from CSV column)
    const requiresClosure = (raw['requires_road_closure'] || '').toLowerCase() === 'true'

    // Parse description for severity keywords
    const desc = (raw['description'] || '').toLowerCase()
    const hasMultiVehicle = desc.includes('multi') || desc.includes('pile') || desc.includes('chain')
    const hasBlockage = desc.includes('block') || desc.includes('closure') || desc.includes('stuck')
    const hasFire = desc.includes('fire') || desc.includes('explos')
    const hasSevere = hasMultiVehicle || hasBlockage || hasFire || requiresClosure

    // Severity score fallback: used only when numeric columns are absent
    // Combines priority, event type, description, closure, duration
    const isHighPriority = priority === 'High'
    const isLowPriority = priority === 'Low'
    const isResolved = status === 'resolved' || status === 'closed'
    const isUnplanned = eventType === 'unplanned'
    const isPeakHour = (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 20)
    const isLongDuration = durationMin > 60

    let severity = 0.5 // default Medium
    if (isHighPriority) severity += 0.25
    if (isLowPriority) severity -= 0.25
    if (isUnplanned) severity += 0.1
    if (hasSevere) severity += 0.15
    if (isPeakHour) severity += 0.05
    if (isLongDuration) severity += 0.1
    if (isResolved) severity -= 0.2
    severity = Math.max(0, Math.min(1, severity))

    // --- Same parameters as Single Input mode ---
    // Read directly from CSV column if present; otherwise derive from severity fallback.

    const rawNum = (col: string): number | undefined => {
      const v = parseFloat(raw[col] || '')
      return isNaN(v) ? undefined : v
    }

    // attendance: direct column 'attendance' or derived
    const attendance = rawNum('attendance') ??
      (eventCause === 'special_event' && severity > 0.6
        ? Math.round(15000 + severity * 15000)
        : Math.round(200 + severity * 12000))

    // rainfall (mm): direct column 'rainfall' or derived from weather
    const rainfall = rawNum('rainfall') ??
      (weatherCondition === 'Heavy Rain' ? 25 : weatherCondition === 'Rainy' ? 8 : 0)

    // temperature (°C): direct column 'temperature' or derived from weather
    const temperature = rawNum('temperature') ??
      (weatherCondition === 'Clear' ? 30 : 25)

    // road_capacity: direct column 'road_capacity' or derived (lower = more congested)
    const roadCapacity = rawNum('road_capacity') ?? Math.round(4500 - severity * 2500)

    // nearby_parking: direct column 'nearby_parking' or derived
    const nearbyParking = rawNum('nearby_parking') ?? Math.round(350 - severity * 300)

    // historical_congestion: direct column 'historical_congestion' or derived
    // Scaler: mean=337.80, std=1.03 — keep in training range (~335-340) when deriving
    const historicalCongestion = rawNum('historical_congestion') ?? Math.round(335 + severity * 5)

    const input: PredictionInput = {
      hour,
      day_of_week: dayOfWeek,
      month,
      is_weekend: isWeekend,
      attendance,
      rainfall,
      temperature,
      road_capacity: roadCapacity,
      nearby_parking: nearbyParking,
      historical_congestion: historicalCongestion,
      eventCause,
      zone,
      vehicleType,
      eventType,
      priority,
      status,
      weatherCondition,
    }

    const latitude = raw['latitude'] ? parseFloat(raw['latitude']) : undefined
    const longitude = raw['longitude'] ? parseFloat(raw['longitude']) : undefined

    results.push({
      id,
      input,
      latitude: isNaN(latitude ?? NaN) ? undefined : latitude,
      longitude: isNaN(longitude ?? NaN) ? undefined : longitude,
      description: raw['description'] || 'No description provided',
      address: raw['address'] || 'Unknown location address',
    })
  }

  return results
}

// Custom CSV line splitter that handles quotes properly
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
