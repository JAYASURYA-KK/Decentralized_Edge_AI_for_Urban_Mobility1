import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapContainer, TileLayer, Polyline, Circle, Popup } from 'react-leaflet'
import { Navigation, Clock, Route, Loader2, Database, Shield } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useTrafficStore } from '@/store/trafficStore'
import { getCongestionColor } from '@/lib/utils'

const bangaloreCenter: [number, number] = [12.9716, 77.5946]

// Default routes mapping across Bangalore
const mainRouteCoords: [number, number][] = [
  [12.9344, 77.6101], [12.9516, 77.5946], [12.9716, 77.5946],
  [12.9855, 77.5724], [12.9955, 77.5524],
]

const altRoutesData = [
  {
    name: 'Route via Hosur Road',
    color: '#22c55e',
    coords: [[12.9344, 77.6101], [12.9244, 77.6251], [12.9516, 77.6146], [12.9716, 77.5946]] as [number, number][],
  },
  {
    name: 'Route via Old Madras Road',
    color: '#eab308',
    coords: [[12.9344, 77.6101], [12.9516, 77.6346], [12.9716, 77.6146], [12.9855, 77.5724]] as [number, number][],
  }
]

const fetchRoutePath = async (waypoints: [number, number][]): Promise<[number, number][]> => {
  try {
    const coordsStr = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
    const res = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    }
  } catch (error) {
    console.error('Failed to fetch route:', error);
  }
  return waypoints; // fallback to straight lines
}

export function DiversionPlanner() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mainRoutePath, setMainRoutePath] = useState<[number, number][]>(mainRouteCoords)
  const [altRoutesPaths, setAltRoutesPaths] = useState<Record<string, [number, number][]>>({})
  const [activeRoute, setActiveRoute] = useState<string | null>(null)
  
  const [activeHotspotData, setActiveHotspotData] = useState<{
    mainPath: [number, number][];
    altRoutes: { name: string, color: string, path: [number, number][] }[];
  } | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Dynamic values computation based on current prediction state
  const plannerData = useMemo(() => {
    let avgScore = 48
    let level: 'Low' | 'Medium' | 'High' = 'Medium'
    let numHotspots = 10
    let mapPins: { id: string; pos: [number, number]; label: string; congestion: 'Low' | 'Medium' | 'High'; score: number }[] = []
    let numZones = 3

    let mainRouteWp = mainRouteCoords;
    let computedAltRoutes = altRoutesData;
    let mainRouteLabel = 'Silk Board to Vidhana Soudha';

    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      const len = bulkPredictions.length
      const scoreSum = bulkPredictions.reduce((acc, curr) => acc + (curr.result?.congestionValue || 0), 0)
      avgScore = len > 0 ? scoreSum / len : 48
      if (isNaN(avgScore)) avgScore = 48
      level = avgScore > 70 ? 'High' : avgScore > 40 ? 'Medium' : 'Low'
      numZones = new Set(bulkPredictions.map(p => p.input.zone)).size

      // Map Pins
      const mapPins: { id: string, pos: [number, number]; label: string; congestion: 'Low' | 'Medium' | 'High'; score: number }[] = []
      bulkPredictions.forEach((p, idx) => {
        if (p.latitude && p.longitude) {
          mapPins.push({
            id: p.id || `bulk-${idx}`,
            pos: [p.latitude, p.longitude],
            label: p.address || p.description || `Location ${idx + 1}`,
            congestion: p.result.congestionLevel,
            score: p.result.congestionValue
          })
        }
      })

      // Sort pins so highest risk is at top
      mapPins.sort((a, b) => b.score - a.score);
      numHotspots = mapPins.length

      return {
        isBulk: true,
        level,
        avgScore,
        numHotspots,
        mapPins,
        numZones,
        highRiskCount: mapPins.filter(p => p.congestion === 'High').length,
        medRiskCount: mapPins.filter(p => p.congestion === 'Medium').length,
        lowRiskCount: mapPins.filter(p => p.congestion === 'Low').length,
      }
    } else if (predictionResult) {
      avgScore = predictionResult.congestionValue
      level = predictionResult.congestionLevel
      numZones = 1
      // Use user-supplied lat/lng from single input (same field as CSV batch lat/longitude)
      const lat = predictionInput.latitude ?? 12.9344
      const lng = predictionInput.longitude ?? 77.6101
      mapPins = [{
        id: 'manual-1',
        pos: [lat, lng],
        label: `${predictionInput.zone} (Single Prediction)`,
        congestion: level,
        score: avgScore
      }]
      numHotspots = 1

      // Build dynamic routes originating from user's lat/lng
      const cityCenter: [number, number] = [12.9716, 77.5946]
      mainRouteWp = [
        [lat, lng],
        [lat + (cityCenter[0] - lat) * 0.5, lng + (cityCenter[1] - lng) * 0.5],
        cityCenter
      ]
      mainRouteLabel = `${predictionInput.zone} → City Center`

      // Alt routes: slight east/west offsets from the incident point
      const off = 0.018
      computedAltRoutes = [
        {
          name: 'Eastern Bypass',
          color: '#22c55e',
          coords: [
            [lat, lng],
            [lat - off * 0.5, lng + off],
            cityCenter
          ] as [number, number][],
        },
        {
          name: 'Western Bypass',
          color: '#eab308',
          coords: [
            [lat, lng],
            [lat + off * 0.5, lng - off],
            cityCenter
          ] as [number, number][],
        }
      ]
    } else {
      // Baseline/Demo mode
      mapPins = [
        { id: 'demo-1', pos: [12.9344, 77.6101], label: 'Silk Board Junction', congestion: 'High', score: 85 },
        { id: 'demo-2', pos: [12.9719, 77.6412], label: 'MG Road', congestion: 'Medium', score: 62 },
        { id: 'demo-3', pos: [12.9855, 77.5724], label: 'Vidhana Soudha', congestion: 'Low', score: 35 },
      ]
      numHotspots = 3
    }

    // Adjust routes details based on congestion level
    let mainEta = 25
    let mainDelay = 5
    let route1Eta = 15
    let route1Delay = 2
    let route2Eta = 18
    let route2Delay = 4

    if (level === 'High') {
      mainEta = 35 + Math.round(avgScore * 0.1)
      mainDelay = 15 + Math.round(avgScore * 0.2)
      route1Eta = 18 + Math.round(avgScore * 0.05)
      route1Delay = 5
      route2Eta = 22 + Math.round(avgScore * 0.08)
      route2Delay = 9
    } else if (level === 'Medium') {
      mainEta = 25
      mainDelay = 8
      route1Eta = 15
      route1Delay = 3
      route2Eta = 19
      route2Delay = 5
    } else {
      mainEta = 15
      mainDelay = 2
      route1Eta = 12
      route1Delay = 1
      route2Eta = 14
      route2Delay = 2
    }

    // Safety checks for NaN
    if (isNaN(mainEta)) mainEta = 25
    if (isNaN(mainDelay)) mainDelay = 5
    if (isNaN(route1Eta)) route1Eta = 15
    if (isNaN(route1Delay)) route1Delay = 2
    if (isNaN(route2Eta)) route2Eta = 18
    if (isNaN(route2Delay)) route2Delay = 4

    const timeSaved = Math.max(0, (mainEta + mainDelay) - (route1Eta + route1Delay))

    return {
      isBulk: false,
      level,
      avgScore,
      numHotspots,
      mapPins,
      numZones,
      mainEta,
      mainDelay,
      mainRouteWp,
      computedAltRoutes,
      mainRouteLabel,
      routes: [
        { ...computedAltRoutes[0]!, eta: `${route1Eta} min`, delay: `+${route1Delay} min` },
        { ...computedAltRoutes[1]!, eta: `${route2Eta} min`, delay: `+${route2Delay} min` },
      ],
      timeSaved
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput])

  const routeDeps = useMemo(() => {
    if (plannerData.isBulk) return '';
    return JSON.stringify(plannerData.mainRouteWp) + JSON.stringify(plannerData.computedAltRoutes);
  }, [plannerData]);

  useEffect(() => {
    if (plannerData.isBulk || !plannerData.mainRouteWp || !plannerData.computedAltRoutes) return;
    let mounted = true;

    const loadRoutes = async () => {
      const mainPath = await fetchRoutePath(plannerData.mainRouteWp!);
      if (mounted) setMainRoutePath(mainPath);

      const altPaths: Record<string, [number, number][]> = {};
      for (const route of plannerData.computedAltRoutes) {
        const path = await fetchRoutePath(route.coords);
        altPaths[route.name] = path;
      }
      if (mounted) setAltRoutesPaths(altPaths);
    }

    loadRoutes();

    return () => { mounted = false };
  }, [routeDeps]);

  useEffect(() => {
    if (!plannerData.isBulk || !activeRoute) {
      setActiveHotspotData(null);
      return;
    }

    const pin = plannerData.mapPins.find(p => p.id === activeRoute);
    if (!pin) return;

    // Safe zones: no diversion routes needed
    if (pin.congestion === 'Low') {
      setActiveHotspotData(null);
      setLoadingRoutes(false);
      return;
    }

    let mounted = true;
    setLoadingRoutes(true);

    const generate = async () => {
      const lat = pin.pos[0];
      const lng = pin.pos[1];
      const offset = 0.015; // ~1.5km
      const south: [number, number] = [lat - offset, lng];
      const north: [number, number] = [lat + offset, lng];
      const west: [number, number] = [lat, lng - offset];
      const east: [number, number] = [lat, lng + offset];

      const mainPath = await fetchRoutePath([south, north]);
      const wPath = await fetchRoutePath([south, west, north]);
      const ePath = await fetchRoutePath([south, east, north]);

      if (mounted) {
        setActiveHotspotData({
          mainPath,
          altRoutes: [
            { name: 'Western Diversion', color: '#22c55e', path: wPath },
            { name: 'Eastern Diversion', color: '#eab308', path: ePath }
          ]
        });
        setLoadingRoutes(false);
      }
    };

    generate();
    return () => { mounted = false };
  }, [activeRoute, plannerData.isBulk, plannerData.mapPins]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Map */}
      <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
        <CardHeader className="flex-row items-center justify-between py-3.5 border-b border-gray-800">
          <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Traffic Route Map</CardTitle>
          <div className="flex items-center gap-2">
            {isBulkMode && <Badge variant="outline" className="text-[10px] text-blue-400"><Database className="w-3 h-3 mr-1 inline" />Batch Plot</Badge>}
            <Badge variant={plannerData.level === 'High' ? 'danger' : plannerData.level === 'Medium' ? 'warning' : 'success'}>
              {plannerData.numHotspots} Hotspots
            </Badge>
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
          <div className="h-[400px] rounded-b-xl overflow-hidden">
            <MapContainer center={bangaloreCenter} zoom={12} className="h-full w-full"
              whenReady={() => setMapLoaded(true)}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
              
              {/* Main route (Only show in non-bulk mode) */}
              {!plannerData.isBulk && plannerData.mainRouteWp && (
                <Polyline 
                  positions={mainRoutePath} 
                  pathOptions={{ 
                    color: '#ef4444', 
                    weight: activeRoute === 'main' ? 8 : 5, 
                    opacity: activeRoute === null || activeRoute === 'main' ? 0.9 : 0.2 
                  }} 
                />
              )}
              
              {/* Alternative routes (Only show in non-bulk mode) */}
              {!plannerData.isBulk && plannerData.routes?.map((route) => (
                <Polyline 
                  key={route.name} 
                  positions={altRoutesPaths[route.name] || route.coords}
                  pathOptions={{ 
                    color: route.color, 
                    weight: activeRoute === route.name ? 8 : 4, 
                    opacity: activeRoute === null || activeRoute === route.name ? 0.9 : 0.2 
                  }} 
                />
              ))}

              {/* Local Bulk Routes (Show local diversions for clicked hotspot) */}
              {plannerData.isBulk && activeHotspotData && (
                <>
                  <Polyline positions={activeHotspotData.mainPath} pathOptions={{ color: '#ef4444', weight: 8, opacity: 0.9 }} />
                  {activeHotspotData.altRoutes.map((route, idx) => (
                    <Polyline key={idx} positions={route.path} pathOptions={{ color: route.color, weight: 6, opacity: 0.8 }} />
                  ))}
                </>
              )}
              
              {/* Hotspots */}
              {plannerData.mapPins.map((spot, i) => {
                const isActive = activeRoute === spot.id;
                const opacity = activeRoute === null ? 0.35 : isActive ? 0.8 : 0.1;
                const radius = isActive ? 400 + spot.score * 5 : 250 + spot.score * 5;
                
                return (
                  <Circle key={spot.id} center={spot.pos} radius={radius}
                    pathOptions={{
                      color: spot.congestion === 'High' ? '#ef4444' : spot.congestion === 'Medium' ? '#eab308' : '#22c55e',
                      fillColor: spot.congestion === 'High' ? '#ef4444' : spot.congestion === 'Medium' ? '#eab308' : '#22c55e',
                      fillOpacity: opacity,
                      weight: isActive ? 3 : 1
                    }}>
                  <Popup>
                    <div className="text-xs text-gray-900 font-sans">
                      <span className="font-bold block text-[13px] text-gray-800">{spot.label}</span>
                      <span className="block mt-1">Congestion Value: <strong>{spot.score.toFixed(1)}</strong></span>
                      <span className="block">Risk Category: <strong>{spot.congestion}</strong></span>
                    </div>
                  </Popup>
                </Circle>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Route Info */}
      <div className="space-y-4 flex flex-col h-full max-h-[500px]">
        {plannerData.isBulk ? (
          <>
            <Card className="bg-gray-900/50 border-gray-800 shrink-0">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Batch Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                    <div className="text-base font-bold text-red-400">{plannerData.highRiskCount}</div>
                    <div className="text-[9px] text-gray-500 uppercase">High Risk</div>
                  </div>
                  <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <div className="text-base font-bold text-yellow-400">{plannerData.medRiskCount}</div>
                    <div className="text-[9px] text-gray-500 uppercase">Medium</div>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <div className="text-base font-bold text-green-400">{plannerData.lowRiskCount}</div>
                    <div className="text-[9px] text-gray-500 uppercase">Safe</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
              {plannerData.mapPins.map((pin) => (
                <Card 
                  key={pin.id} 
                  className={`bg-gray-900/50 border-gray-800 cursor-pointer transition-all hover:bg-gray-800/80 ${activeRoute === pin.id ? 'ring-2' : ''}`}
                  style={{
                    '--tw-ring-color': pin.congestion === 'High' ? '#ef4444' : pin.congestion === 'Medium' ? '#eab308' : '#22c55e',
                    borderLeftWidth: '4px',
                    borderLeftColor: pin.congestion === 'High' ? '#ef4444' : pin.congestion === 'Medium' ? '#eab308' : '#22c55e'
                  } as React.CSSProperties}
                  onClick={() => setActiveRoute(activeRoute === pin.id ? null : pin.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-200 truncate">{pin.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Risk Score: {pin.score.toFixed(1)}</div>
                      </div>
                      <Badge variant={pin.congestion === 'High' ? 'danger' : pin.congestion === 'Medium' ? 'warning' : 'success'} className="text-[10px] shrink-0">
                        {pin.congestion}
                      </Badge>
                    </div>

                    {/* Expand Details */}
                    {activeRoute === pin.id && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        {pin.congestion === 'Low' ? (
                          /* Safe zone: no diversion needed */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2.5 rounded bg-green-500/10 border border-green-500/20">
                              <Shield className="w-4 h-4 text-green-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-gray-400 font-medium truncate">Zone Status</div>
                                <div className="text-xs font-bold text-green-400 mt-0.5">Zone is Safe — No Diversion Needed</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-700/50">
                              <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Risk Level</div>
                                <div className="text-sm font-bold text-green-400 mt-0.5">Low / Safe</div>
                              </div>
                              <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Score</div>
                                <div className="text-sm font-bold text-green-400 mt-0.5">{pin.score.toFixed(1)}</div>
                              </div>
                            </div>
                          </div>
                        ) : loadingRoutes ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 text-gray-500 animate-spin mr-2" />
                            <span className="text-xs text-gray-500">Finding local diversions...</span>
                          </div>
                        ) : activeHotspotData && (
                          <div className="space-y-3">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Local Diversions Found</div>
                            
                            <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                              <Route className="w-4 h-4 text-red-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-gray-400 font-medium truncate">Congested Segment</div>
                                <div className="text-xs font-bold text-red-400 mt-0.5">
                                  {pin.congestion} Risk (Avoid)
                                </div>
                              </div>
                            </div>

                            {activeHotspotData.altRoutes.map((alt, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 rounded bg-gray-800/40 border border-gray-700/50">
                                <div className="w-1 h-6 rounded-full" style={{ background: alt.color }} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] text-gray-400 font-medium truncate">{alt.name}</div>
                                  <div className="text-xs font-bold mt-0.5" style={{ color: alt.color }}>Safe Route</div>
                                </div>
                              </div>
                            ))}

                            {(() => {
                              const mainE = pin.congestion === 'High' ? 25 + Math.round(pin.score * 0.1) : 15;
                              const mainD = pin.congestion === 'High' ? 10 + Math.round(pin.score * 0.2) : 2;
                              const r1E = pin.congestion === 'High' ? 15 + Math.round(pin.score * 0.05) : 12;
                              const r1D = pin.congestion === 'High' ? 3 : 1;
                              const saved = Math.max(0, (mainE + mainD) - (r1E + r1D));

                              return (
                                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-700/50">
                                  <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Alt Routes</div>
                                    <div className="text-sm font-bold text-white mt-0.5">2</div>
                                  </div>
                                  <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Best ETA</div>
                                    <div className="text-sm font-bold text-green-400 mt-0.5">{r1E} min</div>
                                  </div>
                                  <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Time Saved</div>
                                    <div className="text-sm font-bold text-blue-400 mt-0.5">{saved} min</div>
                                  </div>
                                  <div className="p-2 rounded bg-gray-800/40 border border-gray-800">
                                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Zones Affected</div>
                                    <div className="text-sm font-bold text-white mt-0.5">1</div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <Card 
              className={`bg-gray-900/50 border-gray-800 cursor-pointer transition-all hover:bg-gray-800/50 ${activeRoute === 'main' ? 'ring-2 ring-red-500/50' : ''}`}
              onClick={() => setActiveRoute(activeRoute === 'main' ? null : 'main')}
            >
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Congested Corridor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <Route className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 font-medium truncate">{plannerData.mainRouteLabel}</div>
                    <div className="text-sm font-bold text-gray-200 mt-0.5">
                      {plannerData.level} Traffic • {(plannerData.mainEta ?? 0) + (plannerData.mainDelay ?? 0)} min ETA
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {plannerData.routes?.map((route) => (
              <Card 
                key={route.name} 
                className={`bg-gray-900/50 border-gray-800 cursor-pointer transition-all hover:bg-gray-800/50 ${activeRoute === route.name ? 'ring-2 ring-opacity-50' : ''}`}
                style={{ '--tw-ring-color': route.color } as React.CSSProperties}
                onClick={() => setActiveRoute(activeRoute === route.name ? null : route.name)}
              >
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-gray-300 truncate max-w-[170px]">{route.name}</CardTitle>
                    <Badge variant="warning" className="text-[9px] px-1.5 py-0">{route.delay} delay</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ background: route.color }} />
                    <div>
                      <div className="text-xs text-gray-400">Optimized ETA</div>
                      <div className="text-sm font-bold text-gray-200 mt-0.5">{route.eta}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-gray-900/50 border-gray-800 mt-auto">
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Alt Routes</div>
                    <div className="text-base font-bold text-white mt-0.5">{plannerData.routes?.length || 0}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Best ETA</div>
                    <div className="text-base font-bold text-green-400 mt-0.5">
                      {plannerData.routes?.[0]?.eta || '-'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Time Saved</div>
                    <div className="text-base font-bold text-blue-400 mt-0.5">{plannerData.timeSaved} min</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Zones Affected</div>
                    <div className="text-base font-bold text-white mt-0.5">{plannerData.numZones}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
