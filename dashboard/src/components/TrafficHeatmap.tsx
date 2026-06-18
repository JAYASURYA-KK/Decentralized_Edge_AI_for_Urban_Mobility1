import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet'
import { getSeverityColor } from '@/lib/utils'
import { Thermometer, MapPin, Loader2, Database } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTrafficStore } from '@/store/trafficStore'

interface Hotspot {
  pos: [number, number]
  intensity: number
  label: string
  vehicles: number
}

export function TrafficHeatmap() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()
  const [mapLoaded, setMapLoaded] = useState(false)

  // Dynamic hotspots and zone statistics computation
  const heatmapData = useMemo(() => {
    let spots: Hotspot[] = []
    let zoneAverages: { zone: string; level: string; avg: number; color: string }[] = []
    let numActive = 0

    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      // Gather coordinates from batch predictions
      bulkPredictions.forEach(p => {
        if (p.latitude && p.longitude) {
          spots.push({
            pos: [p.latitude, p.longitude],
            intensity: p.result.congestionValue,
            label: p.address || p.description || `Incident ${p.id}`,
            vehicles: Math.round(p.result.congestionValue * 60)
          })
        }
      })
      numActive = spots.length

      // Group and calculate averages by zone
      const zones = ['Central Zone 1', 'Central Zone 2', 'Outer Zone']
      zoneAverages = zones.map(z => {
        const matches = bulkPredictions.filter(p => p.input.zone === z)
        const avg = matches.length > 0 
          ? Math.round(matches.reduce((acc, curr) => acc + curr.result.congestionValue, 0) / matches.length)
          : 0
        const color = getSeverityColor(avg)
        return {
          zone: z,
          level: avg > 70 ? 'High' : avg > 40 ? 'Moderate' : 'Low',
          avg,
          color
        }
      })
    } else if (predictionResult) {
      // Single prediction active — use user-supplied lat/lng (same field as CSV batch)
      const lat = predictionInput.latitude ?? 12.9344
      const lng = predictionInput.longitude ?? 77.6101
      spots = [{
        pos: [lat, lng],
        intensity: predictionResult.congestionValue,
        label: `${predictionInput.zone} Prediction`,
        vehicles: Math.round(predictionResult.congestionValue * 60)
      }]
      numActive = 1

      zoneAverages = [
        {
          zone: predictionInput.zone,
          level: predictionResult.congestionLevel,
          avg: Math.round(predictionResult.congestionValue),
          color: getSeverityColor(predictionResult.congestionValue)
        },
        {
          zone: predictionInput.zone === 'Central Zone 1' ? 'Central Zone 2' : 'Central Zone 1',
          level: 'Low',
          avg: 30,
          color: getSeverityColor(30)
        },
        {
          zone: predictionInput.zone === 'Outer Zone' ? 'Central Zone 2' : 'Outer Zone',
          level: 'Low',
          avg: 25,
          color: getSeverityColor(25)
        }
      ]
    } else {
      // Fallback baseline hotspots
      spots = [
        { pos: [12.9344, 77.6101], intensity: 85, label: 'Silk Board Junction', vehicles: 4500 },
        { pos: [12.9719, 77.6412], intensity: 75, label: 'Outer Ring Road', vehicles: 3800 },
        { pos: [13.0358, 77.5970], intensity: 60, label: 'Hebbal Flyover', vehicles: 2800 },
        { pos: [12.9985, 77.7020], intensity: 55, label: 'KR Puram', vehicles: 2200 },
        { pos: [12.8748, 77.4848], intensity: 70, label: 'NICE Road Junction', vehicles: 3100 },
        { pos: [12.9815, 77.5524], intensity: 45, label: 'Basavanagudi', vehicles: 1800 },
        { pos: [12.9516, 77.5946], intensity: 65, label: 'Shivaji Nagar', vehicles: 2600 },
        { pos: [12.9156, 77.6214], intensity: 50, label: 'Jayanagar', vehicles: 2100 },
        { pos: [13.0217, 77.6058], intensity: 80, label: 'Yeshwanthpur', vehicles: 4200 },
        { pos: [12.9059, 77.6325], intensity: 40, label: 'BTM Layout', vehicles: 1500 },
      ]
      numActive = spots.length

      zoneAverages = [
        { zone: 'Central Zone 1', level: 'High', avg: 75, color: '#ef4444' },
        { zone: 'Central Zone 2', level: 'Moderate', avg: 55, color: '#f97316' },
        { zone: 'Outer Zone', level: 'Low', avg: 35, color: '#22c55e' },
      ]
    }

    return { spots, zoneAverages, numActive }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Map */}
      <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
        <CardHeader className="flex-row items-center justify-between py-3.5 border-b border-gray-800">
          <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Traffic Congestion Heatmap</CardTitle>
          <div className="flex items-center gap-2">
            {isBulkMode && <Badge variant="outline" className="text-[10px] text-blue-400"><Database className="w-3 h-3 mr-1 inline" />Batch Upload</Badge>}
            <Badge variant="warning">{heatmapData.numActive} active hotspots</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">
          {!mapLoaded && (
            <div className="absolute inset-0 z-[999] flex items-center justify-center bg-gray-900/80 rounded-b-xl">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading map tiles...</p>
              </div>
            </div>
          )}
          <div className="h-[450px] rounded-b-xl overflow-hidden">
            <MapContainer center={[12.9716, 77.5946]} zoom={12} className="h-full w-full"
              whenReady={() => setMapLoaded(true)}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OSM' />
              {heatmapData.spots.map((spot, i) => (
                <Circle key={i}
                  center={spot.pos}
                  radius={200 + spot.intensity * 8}
                  pathOptions={{
                    color: getSeverityColor(spot.intensity),
                    fillColor: getSeverityColor(spot.intensity),
                    fillOpacity: 0.15 + (spot.intensity / 100) * 0.35,
                    weight: 1,
                  }}>
                  <Popup>
                    <div className="text-xs text-gray-900 font-sans">
                      <strong className="text-gray-800 block text-sm mb-1">{spot.label}</strong>
                      Intensity: <span className="font-bold">{spot.intensity.toFixed(1)}%</span><br />
                      Estimated Volume: <span className="font-bold">{spot.vehicles.toLocaleString()} veh</span>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Side panel */}
      <div className="space-y-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Zone Congestion Averages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3.5">
              {heatmapData.zoneAverages.map((z) => (
                <div key={z.zone} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300 font-medium text-xs truncate max-w-[130px]">{z.zone}</span>
                      <span className="text-[10px] text-gray-500">{z.level}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${z.avg}%`, background: z.color }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-mono w-8 text-right">{z.avg}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Hotspots Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {heatmapData.spots.length > 0 ? (
                heatmapData.spots.sort((a, b) => b.intensity - a.intensity).slice(0, 10).map((spot, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/40 border border-transparent hover:border-gray-800">
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: getSeverityColor(spot.intensity) }} />
                      <span className="text-xs text-gray-300 truncate" title={spot.label}>{spot.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Thermometer className="w-3.5 h-3.5" style={{ color: getSeverityColor(spot.intensity) }} />
                      <span className="text-xs font-semibold font-mono" style={{ color: getSeverityColor(spot.intensity) }}>{spot.intensity.toFixed(0)}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-gray-500">No hotspot coordinates found.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
