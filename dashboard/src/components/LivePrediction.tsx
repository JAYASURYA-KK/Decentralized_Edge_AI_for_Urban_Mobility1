import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTrafficStore } from '@/store/trafficStore'
import { predict, isModelsLoaded, normalizeBatchLevels } from '@/services/onnxService'
import { getCongestionColor } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Play, RotateCcw, Loader2, AlertCircle, Cpu, Upload,
  FileSpreadsheet, CheckCircle2, Trash2, ArrowRight, ShieldAlert, MapPin, LocateFixed, Download
} from 'lucide-react'
import { useEffect, useRef, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { parseCSV, ParsedCSVRow } from '@/services/csvParser'
import type { BulkPrediction } from '@/types'

const EVENT_CAUSES = ['vehicle_breakdown', 'accident', 'breakdown', 'special_event', 'road_construction', 'others']
const ZONES = ['Central Zone 1', 'Central Zone 2', 'Outer Zone']
const VEHICLE_TYPES = ['car', 'bus', 'truck']
const WEATHER = ['Clear', 'Cloudy', 'Rainy', 'Heavy Rain']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['active', 'closed', 'resolved']

const BAR_COLORS = ['#22c55e', '#eab308', '#ef4444']

// Default datetime matching getDefaultInput() — 2024-06-13 is a Thursday (day_of_week=4)
const DEFAULT_DATETIME = '2024-06-13T09:00'

// Demo CSV now includes the same 6 numeric columns as Single Parameter Input
// so both modes feed identical parameters to the model with no hidden derivation
const DEMO_CSV_TEXT = `id,event_type,latitude,longitude,event_cause,start_datetime,status,veh_type,zone,priority,description,address,weather,attendance,rainfall,temperature,road_capacity,nearby_parking,historical_congestion
FKID100001,unplanned,12.9344,77.6101,accident,2024-06-10 08:30:00.000+00,active,heavy_vehicle,Central Zone 1,High,Multi-vehicle accident blocking 3 lanes,Silk Board Junction,Clear,8000,0,30,2000,50,340
FKID100002,unplanned,12.9719,77.6412,vehicle_breakdown,2024-06-10 09:15:00.000+00,active,bmtc_bus,Central Zone 2,High,BMTC bus engine failure during peak hour,Outer Ring Road,Clear,7000,0,30,2200,60,339
FKID100003,planned,13.0358,77.5970,construction,2024-06-10 10:00:00.000+00,active,private_car,Central Zone 2,Low,Scheduled flyover maintenance,Hebbal Flyover,Cloudy,1000,0,25,3500,200,337
FKID100004,unplanned,12.8748,77.4848,accident,2024-06-11 17:30:00.000+00,active,lcv,Outer Zone,High,Rear-end collision on expressway,NICE Road Toll,Heavy Rain,9000,25,25,1800,30,340
FKID100005,planned,12.9985,77.7020,public_event,2024-06-11 18:00:00.000+00,active,private_car,Central Zone 1,High,IPL match at Chinnaswamy stadium,MG Road,Clear,25000,0,30,2200,40,339
FKID100006,unplanned,12.9516,77.5946,vehicle_breakdown,2024-06-10 17:45:00.000+00,active,private_car,Central Zone 1,Medium,Car tyre puncture blocking lane,Shivaji Nagar,Clear,4000,0,30,2800,120,338
FKID100007,unplanned,13.0217,77.6058,accident,2024-06-10 07:10:00.000+00,resolved,heavy_vehicle,Outer Zone,High,Truck overturn partially blocking lane,Yeshwanthpur,Clear,5000,0,30,2500,100,338
FKID100008,unplanned,12.9767,77.5713,vehicle_breakdown,2024-06-10 18:45:00.000+00,active,private_car,Central Zone 1,High,Car stalled on flyover during evening peak,Navrang Circle,Heavy Rain,8500,25,25,1800,30,340
FKID100009,planned,12.9352,77.6245,public_event,2024-06-12 19:00:00.000+00,active,private_car,Central Zone 2,High,Tech conference at convention centre,Koramangala,Clear,22000,0,30,2200,50,339
FKID100010,unplanned,12.9112,77.6001,accident,2024-06-11 08:15:00.000+00,active,heavy_vehicle,Central Zone 1,High,Truck-auto collision at busy junction,Marathahalli Bridge,Rainy,7500,8,25,2000,45,340
FKID100011,planned,13.0523,77.5814,construction,2024-06-13 11:00:00.000+00,active,private_car,Outer Zone,Low,Stormwater drain repair work,Bellary Road,Clear,500,0,30,3800,220,336
FKID100012,unplanned,12.8990,77.5800,vehicle_breakdown,2024-06-10 14:30:00.000+00,resolved,bmtc_bus,Central Zone 2,Medium,Bus breakdown during midday service,JP Nagar,Cloudy,1200,0,25,3500,200,337
FKID100013,unplanned,12.9614,77.7025,accident,2024-06-11 17:00:00.000+00,active,private_car,Outer Zone,High,Side-swipe accident causing lane closure,Whitefield Main Road,Heavy Rain,9000,25,25,1800,30,340
FKID100014,planned,12.9830,77.6070,public_event,2024-06-14 20:00:00.000+00,active,private_car,Central Zone 1,High,Diwali procession through MG Road,Brigade Road,Clear,20000,0,28,2300,50,339
FKID100015,unplanned,12.9247,77.5013,vehicle_breakdown,2024-06-10 06:45:00.000+00,resolved,lcv,Outer Zone,Low,LCV breakdown on service road at dawn,Tumkur Road,Clear,200,0,28,4200,300,335
FKID100016,planned,12.9855,77.5724,construction,2024-06-12 10:30:00.000+00,resolved,private_car,Outer Zone,Low,Minor road resurfacing completed on schedule,Vidhana Soudha,Clear,300,0,30,4000,280,336
FKID100017,planned,12.9600,77.5800,public_event,2024-06-12 09:00:00.000+00,resolved,private_car,Central Zone 2,Low,Neighbourhood yoga event with no road closures,Malleshwaram,Clear,500,0,30,4000,270,336
FKID100018,planned,13.0100,77.6200,construction,2024-06-13 07:00:00.000+00,resolved,private_car,Outer Zone,Low,Sidewalk beautification work completed overnight,Hebbal,Clear,200,0,28,4000,280,335
FKID100019,planned,12.9050,77.6400,public_event,2024-06-13 06:30:00.000+00,resolved,private_car,Outer Zone,Low,Early morning community run on service lane,Jayanagar 4th Block,Clear,300,0,26,4300,320,335
FKID100020,unplanned,12.9450,77.6300,vehicle_breakdown,2024-06-10 22:00:00.000+00,resolved,private_car,Central Zone 1,Low,Auto-rickshaw breakdown cleared from main road,Domlur,Clear,800,0,26,3800,250,336
FKID100021,planned,12.9700,77.5600,construction,2024-06-14 08:00:00.000+00,resolved,lcv,Outer Zone,Low,Street light pole replacement finished ahead of schedule,Rajajinagar,Clear,400,0,28,3900,260,336
FKID100022,unplanned,12.8800,77.5500,vehicle_breakdown,2024-06-11 23:30:00.000+00,resolved,private_car,Outer Zone,Low,Two-wheeler puncture resolved without lane blockage,Kengeri,Clear,200,0,24,4100,300,335`

export function LivePrediction() {
  const {
    predictionInput, setPredictionInput, predictionResult, setPredictionResult,
    isPredicting, setIsPredicting, resetPredictionInput,
    bulkPredictions, isBulkMode, setBulkPredictions, setIsBulkMode
  } = useTrafficStore()

  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single')
  const [dragActive, setDragActive] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingTotal, setProcessingTotal] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentPageNum, setCurrentPageNum] = useState(1)

  // Datetime picker state — same concept as CSV start_datetime
  // Derives: hour, day_of_week, month, is_weekend (exactly like the CSV parser)
  const [eventDatetime, setEventDatetime] = useState<string>(DEFAULT_DATETIME)

  const handleDatetimeChange = (dt: string) => {
    setEventDatetime(dt)
    if (!dt) return
    const d = new Date(dt)
    if (isNaN(d.getTime())) return
    const dow = d.getDay()
    setPredictionInput({
      hour: d.getHours(),
      day_of_week: dow,
      month: d.getMonth() + 1,
      is_weekend: dow === 0 || dow === 6,
    })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modelsReady = isModelsLoaded()

  // Sync activeTab with isBulkMode state
  useEffect(() => {
    if (isBulkMode) {
      setActiveTab('batch')
    }
  }, [isBulkMode])

  // Auto-predict for Single Input mode when parameters change
  useEffect(() => {
    if (!modelsReady || activeTab !== 'single') return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsPredicting(true)
      try {
        const result = await predict(predictionInput)
        setPredictionResult(result)
      } catch (err) {
        console.warn('Auto-predict failed:', err)
      } finally {
        setIsPredicting(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [predictionInput, modelsReady, activeTab, setIsPredicting, setPredictionResult])

  const handlePredict = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setIsPredicting(true)
    try {
      const result = await predict(predictionInput)
      setPredictionResult(result)
      toast.success('Prediction completed', { description: `Congestion level: ${result.congestionLevel}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prediction failed'
      toast.error('Prediction failed', { description: msg })
    } finally {
      setIsPredicting(false)
    }
  }

  // Batch CSV evaluation logic
  const runBatchPredictions = async (parsedRows: ParsedCSVRow[]) => {
    if (!modelsReady) {
      toast.error('ONNX models not loaded. Cannot run batch predictions.')
      return
    }

    // Limit to 1000 rows to ensure smooth, immediate client-side inference
    const maxRows = 1000
    const limitedRows = parsedRows.slice(0, maxRows)
    if (parsedRows.length > maxRows) {
      toast.info(`Limiting parsing to the first ${maxRows} records for fast in-browser evaluation.`)
    }

    setIsProcessing(true)
    setProcessingTotal(limitedRows.length)
    setProcessingProgress(0)

    const predictions: BulkPrediction[] = []

    try {
      for (let i = 0; i < limitedRows.length; i++) {
        const row = limitedRows[i]!
        const result = await predict(row.input)
        predictions.push({
          id: row.id,
          input: row.input,
          result,
          latitude: row.latitude,
          longitude: row.longitude,
          description: row.description,
          address: row.address,
          priority: row.input.priority,
          status: row.input.status,
          eventCause: row.input.eventCause,
          zone: row.input.zone,
          vehType: row.input.vehicleType
        })
        setProcessingProgress(i + 1)
        // Briefly release CPU thread so UI can update progress bar smoothly
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      // Normalize batch levels using percentile-based classification
      // This guarantees Low/Medium/High all appear in any batch
      normalizeBatchLevels(predictions)

      setBulkPredictions(predictions)
      setIsBulkMode(true)
      setActiveTab('batch')
      setCurrentPageNum(1)
      toast.success('Batch processing complete', { description: `Analyzed ${predictions.length} records.` })
    } catch (err) {
      console.error(err)
      toast.error('Failed running batch model predictions.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Invalid file type. Please upload a .csv spreadsheet.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      if (!text) {
        toast.error('Could not read file contents.')
        return
      }
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        toast.error('Failed to parse CSV. Ensure correct column headers.')
        return
      }
      await runBatchPredictions(parsed)
    }
    reader.readAsText(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const loadDemoBatch = async () => {
    const parsed = parseCSV(DEMO_CSV_TEXT)
    await runBatchPredictions(parsed)
  }

  const clearBatch = () => {
    setBulkPredictions(null)
    setIsBulkMode(false)
    toast.info('Cleared spreadsheet batch analysis')
  }

  const downloadReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    const headers = ["ID", "Zone", "Vehicle Type", "Event Cause", "Priority", "Status", "Congestion Level", "Congestion Value", "Confidence"]
    csvContent += headers.join(",") + "\n"

    if (activeTab === 'batch' && bulkPredictions) {
      bulkPredictions.forEach(p => {
        const row = [
          p.id || 'N/A',
          p.zone,
          p.vehType,
          p.eventCause,
          p.priority,
          p.status,
          p.result.congestionLevel,
          p.result.congestionValue.toFixed(2),
          (p.result.confidence * 100).toFixed(1) + "%"
        ]
        csvContent += row.join(",") + "\n"
      })
    } else if (activeTab === 'single' && predictionResult) {
      const row = [
        "1",
        predictionInput.zone,
        predictionInput.vehicleType,
        predictionInput.eventCause,
        predictionInput.priority,
        predictionInput.status,
        predictionResult.congestionLevel,
        predictionResult.congestionValue.toFixed(2),
        (predictionResult.confidence * 100).toFixed(1) + "%"
      ]
      csvContent += row.join(",") + "\n"
    } else {
      toast.error('No predictions to download.')
      return
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `prediction_report_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Metrics calculations for Batch predictions
  const batchStats = useMemo(() => {
    if (!bulkPredictions || bulkPredictions.length === 0) return null
    const len = bulkPredictions.length
    const avgCongestion = bulkPredictions.reduce((acc, curr) => acc + curr.result.congestionValue, 0) / len
    const avgConfidence = bulkPredictions.reduce((acc, curr) => acc + curr.result.confidence, 0) / len
    const highLevelCount = bulkPredictions.filter(p => p.result.congestionLevel === 'High').length
    const highLevelPct = (highLevelCount / len) * 100

    const lowCount = bulkPredictions.filter(p => p.result.congestionLevel === 'Low').length
    const medCount = bulkPredictions.filter(p => p.result.congestionLevel === 'Medium').length
    const highCount = bulkPredictions.filter(p => p.result.congestionLevel === 'High').length

    return {
      averageCongestion: avgCongestion,
      averageConfidence: avgConfidence,
      highPercentage: highLevelPct,
      distribution: [
        { name: 'Low', count: lowCount },
        { name: 'Medium', count: medCount },
        { name: 'High', count: highCount }
      ]
    }
  }, [bulkPredictions])

  // Table pagination helper
  const itemsPerPage = 6
  const paginatedPredictions = useMemo(() => {
    if (!bulkPredictions) return []
    const start = (currentPageNum - 1) * itemsPerPage
    return bulkPredictions.slice(start, start + itemsPerPage)
  }, [bulkPredictions, currentPageNum])

  const totalPages = Math.ceil((bulkPredictions?.length ?? 0) / itemsPerPage)

  const RangeInput = ({ field, label, min, max, step = 1 }: {
    field: keyof typeof predictionInput
    label: string
    min: number
    max: number
    step?: number
  }) => (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="text-gray-400 font-semibold">{typeof predictionInput[field] === 'number' ? Number(predictionInput[field]).toFixed(step < 1 ? 1 : 0) : predictionInput[field]}</span>
      </div>
      <input type="range" min={min} max={max} step={step}
        value={Number(predictionInput[field])}
        onChange={e => setPredictionInput({ [field]: parseFloat(e.target.value) })}
        className="w-full accent-blue-500 bg-gray-800" />
    </div>
  )

  const NumberField = ({ field, label }: { field: keyof typeof predictionInput; label: string }) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type="number" value={Number(predictionInput[field])}
        onChange={e => setPredictionInput({ [field]: parseFloat(e.target.value) || 0 })}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
    </div>
  )

  const SelectField = ({ field, label, options }: {
    field: keyof typeof predictionInput
    label: string
    options: string[]
  }) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <select value={String(predictionInput[field])}
        onChange={e => setPredictionInput({ [field]: e.target.value })}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500">
        {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex bg-gray-900/40 p-1 rounded-xl border border-gray-800/80 max-w-md">
        <button
          onClick={() => {
            setActiveTab('single')
            setIsBulkMode(false)
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'single' && !isBulkMode
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Single Parameter Input
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'batch' || isBulkMode
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Spreadsheet Batch Upload
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Side: Parameters / Upload */}
        <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm text-gray-300">
              {activeTab === 'single' ? 'Prediction Parameters' : 'Upload Spreadsheet'}
            </CardTitle>
            {!modelsReady && <Badge variant="warning" className="text-[10px]">Demo Mode</Badge>}
          </CardHeader>
          <CardContent>
            {activeTab === 'single' ? (
              <div className="space-y-4">
                {/* Time & Date — identical to CSV start_datetime column */}
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Time &amp; Date</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Event Date &amp; Time <span className="text-gray-700 ml-1">= start_datetime in CSV</span></label>
                  <input
                    type="datetime-local"
                    value={eventDatetime}
                    onChange={e => handleDatetimeChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                  {/* Show derived values so user sees exact model inputs */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-gray-600">
                    <span>Hour: <span className="text-gray-400">{predictionInput.hour}</span></span>
                    <span>Day: <span className="text-gray-400">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][predictionInput.day_of_week]}</span></span>
                    <span>Month: <span className="text-gray-400">{predictionInput.month}</span></span>
                    <span>Weekend: <span className="text-gray-400">{predictionInput.is_weekend ? 'Yes' : 'No'}</span></span>
                  </div>
                </div>

                {/* Environmental */}
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wider pt-2">Environmental</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <NumberField field="attendance" label="Attendance" />
                  <NumberField field="rainfall" label="Rainfall (mm)" />
                  <NumberField field="temperature" label="Temperature (°C)" />
                  <NumberField field="road_capacity" label="Road Capacity" />
                  <NumberField field="nearby_parking" label="Nearby Parking" />
                  <NumberField field="historical_congestion" label="Historical Congestion" />
                </div>

                {/* Event Details */}
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wider pt-2">Event Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField field="eventCause" label="Event Cause" options={EVENT_CAUSES} />
                  <SelectField field="zone" label="Zone" options={ZONES} />
                  <SelectField field="vehicleType" label="Vehicle Type" options={VEHICLE_TYPES} />

                  {/* Weather — auto-fills Temperature & Rainfall to match real-world values */}
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Weather Condition
                      <span className="text-gray-700 ml-1">(auto-fills temp &amp; rainfall below)</span>
                    </label>
                    <select
                      value={predictionInput.weatherCondition}
                      onChange={e => {
                        const w = e.target.value
                        const weatherDefaults: Record<string, { temperature: number; rainfall: number }> = {
                          'Clear':      { temperature: 30, rainfall: 0  },
                          'Cloudy':     { temperature: 25, rainfall: 0  },
                          'Rainy':      { temperature: 22, rainfall: 8  },
                          'Heavy Rain': { temperature: 20, rainfall: 25 },
                        }
                        const def = weatherDefaults[w] ?? { temperature: 28, rainfall: 0 }
                        setPredictionInput({ weatherCondition: w, temperature: def.temperature, rainfall: def.rainfall })
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                      {WEATHER.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {/* Show auto-filled values as hints */}
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
                      <span>Temp: <span className="text-gray-400">{predictionInput.temperature}°C</span></span>
                      <span>Rainfall: <span className="text-gray-400">{predictionInput.rainfall} mm</span></span>
                      <span className="text-gray-700 italic">editable below</span>
                    </div>
                  </div>

                  <SelectField field="eventType" label="Event Type" options={['planned', 'unplanned']} />
                  <SelectField field="priority" label="Priority" options={PRIORITIES} />
                  <SelectField field="status" label="Status" options={STATUSES} />
                </div>

                {/* Location — same as latitude/longitude in CSV batch, used for map display */}
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wider pt-2">Location <span className="text-gray-700 normal-case">(= lat/lng in CSV — for map display)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                    <input type="number" step="0.0001"
                      value={predictionInput.latitude ?? ''}
                      placeholder="e.g. 12.9344"
                      onChange={e => setPredictionInput({ latitude: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                    <input type="number" step="0.0001"
                      value={predictionInput.longitude ?? ''}
                      placeholder="e.g. 77.6101"
                      onChange={e => setPredictionInput({ longitude: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                {/* Auto Detect current location */}
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error('Geolocation not supported by your browser')
                      return
                    }
                    navigator.geolocation.getCurrentPosition(
                      pos => {
                        const lat = parseFloat(pos.coords.latitude.toFixed(4))
                        const lng = parseFloat(pos.coords.longitude.toFixed(4))
                        setPredictionInput({ latitude: lat, longitude: lng })
                        toast.success('Location detected', {
                          description: `Lat: ${lat}, Lng: ${lng}`
                        })
                      },
                      () => toast.error('Could not get location — check browser permissions')
                    )
                  }}
                  className="flex items-center gap-2 w-full justify-center py-1.5 rounded-lg bg-gray-800/60 border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800 text-xs text-gray-400 hover:text-blue-400 transition-all"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  Auto Detect Current Location
                </button>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button onClick={handlePredict} disabled={isPredicting}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                    {isPredicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isPredicting ? 'Predicting...' : 'Run Prediction'}
                  </button>
                  <button onClick={() => { resetPredictionInput(); setEventDatetime(DEFAULT_DATETIME) }}
                    className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {!modelsReady && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                    <Cpu className="w-3 h-3 shrink-0" />
                    ONNX models not loaded — running with demo predictions
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept=".csv"
                  className="hidden"
                />

                {/* File Dropzone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                    dragActive
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:bg-gray-900/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center mb-3 text-blue-400">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200">Upload Traffic Spreadsheet</h3>
                  <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                    Drag and drop your spreadsheet here or click to browse.
                  </p>
                  <Badge variant="outline" className="text-[10px] text-gray-400 mt-3">
                    Supports .CSV files
                  </Badge>
                </div>

                {/* Batch Progress Bar */}
                {isProcessing && (
                  <div className="space-y-2 p-3 bg-gray-800/40 border border-gray-800 rounded-lg">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                        Running ONNX inference...
                      </span>
                      <span>
                        {processingProgress} / {processingTotal}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                        style={{ width: `${(processingProgress / processingTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={loadDemoBatch}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 text-gray-300 rounded-lg px-4 py-2 text-xs font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Load Demo Event Batch
                  </button>
                  {bulkPredictions && (
                    <button
                      onClick={clearBatch}
                      className="flex items-center justify-center bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 rounded-lg px-3 py-2 text-xs transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-3.5 bg-blue-950/10 border border-blue-900/20 rounded-lg text-xs leading-relaxed text-gray-400 space-y-1">
                  <span className="text-gray-300 font-semibold block mb-1">Compatible Dataset Format:</span>
                  <p>Upload a file structured like <code className="text-blue-400">Astram_event_data_anonymized.csv</code>.</p>
                  <p>The parser dynamically parses latitude, longitude, and maps date/times and causes to model variables.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Results */}
        <div className="lg:col-span-3">
          {isBulkMode && bulkPredictions && batchStats ? (
            /* Batch Predictions View */
            <div className="space-y-6">
              {/* Batch KPI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {batchStats.averageCongestion.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Avg Congestion Value</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {batchStats.highPercentage.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">High Congestion Risk</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {(batchStats.averageConfidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Avg Model Confidence</div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart & Table */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Distribution Chart */}
                <Card className="bg-gray-900/50 border-gray-800 flex flex-col justify-between">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-gray-400">Congestion Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3 flex-1 flex flex-col justify-center min-w-0 min-h-0">
                    <div className="h-44 w-full min-w-0 min-h-0">
                      <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                        <BarChart data={batchStats.distribution} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: '11px' }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {batchStats.distribution.map((_entry, idx) => (
                              <Cell key={idx} fill={BAR_COLORS[idx] ?? '#6b7280'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Batch File Info */}
                <Card className="bg-gray-900/50 border-gray-800 flex flex-col justify-between">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-gray-400">Spreadsheet Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-gray-400 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <div>
                        <span className="font-semibold block text-[13px]">{bulkPredictions.length} Records Evaluated</span>
                        Model outputs are routed to all downstream modules.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-800/50 border border-gray-700">
                      <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="font-semibold block text-gray-200">Real-Time Synchronization</span>
                        View the map, costs, and risk dashboards to explore aggregate predictions.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Records List Table */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="py-3 border-b border-gray-800 flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-xs text-gray-300">Predictions Data Table</CardTitle>
                    <button onClick={downloadReport} className="flex items-center gap-1.5 text-[10px] bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/40 hover:text-white px-2 py-1 rounded transition-all">
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-500">Showing page {currentPageNum} of {totalPages}</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-gray-800 bg-gray-900/20 text-gray-500 font-medium">
                          <th className="px-4 py-2.5">ID</th>
                          <th className="px-4 py-2.5">Details</th>
                          <th className="px-4 py-2.5">Predicted Congestion</th>
                          <th className="px-4 py-2.5">Level</th>
                          <th className="px-4 py-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPredictions.map(p => (
                          <tr key={p.id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                            <td className="px-4 py-2.5 font-mono text-gray-300">{p.id}</td>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-gray-200 block truncate max-w-[150px]">{p.address || p.description}</span>
                              <span className="text-[10px] text-gray-500 block truncate max-w-[150px] capitalize">{(p.eventCause || '').replace(/_/g, ' ')} • {p.zone || ''}</span>
                            </td>
                            <td className="px-4 py-2.5 font-bold" style={{ color: getCongestionColor(p.result.congestionLevel) }}>
                              {p.result.congestionValue.toFixed(1)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={p.result.congestionLevel === 'High' ? 'danger' : p.result.congestionLevel === 'Medium' ? 'warning' : 'success'} className="text-[9px] px-1.5 py-0">
                                {p.result.congestionLevel}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() => {
                                  setPredictionInput(p.input)
                                  setPredictionResult(p.result)
                                  setActiveTab('single')
                                  setIsBulkMode(false)
                                  toast.success('Parameters loaded', { description: `Loaded incident ${p.id} parameters for single prediction.` })
                                }}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                              >
                                Load Input
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-gray-800">
                      <button
                        onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
                        disabled={currentPageNum === 1}
                        className="px-2.5 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        Prev
                      </button>
                      <span className="text-[10px] text-gray-500">Page {currentPageNum} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPageNum(p => Math.min(totalPages, p + 1))}
                        disabled={currentPageNum === totalPages}
                        className="px-2.5 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Single Prediction Result View */
            <Card className="bg-gray-900/50 border-gray-800 h-full flex flex-col justify-between">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm text-gray-300">Prediction Results</CardTitle>
                {predictionResult && (
                  <button onClick={downloadReport} className="flex items-center gap-1.5 text-xs bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/40 hover:text-white px-2.5 py-1.5 rounded-lg transition-all">
                    <Download className="w-3.5 h-3.5" /> Export Report
                  </button>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                {predictionResult ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
                        <div className="text-3xl font-bold" style={{ color: getCongestionColor(predictionResult.congestionLevel) }}>
                          {predictionResult.congestionValue.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Predicted Congestion</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-center flex flex-col items-center justify-center">
                        <Badge variant={predictionResult.congestionLevel === 'High' ? 'danger' : predictionResult.congestionLevel === 'Medium' ? 'warning' : 'success'}
                          className="text-lg px-4 py-1">
                          {predictionResult.congestionLevel}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">Traffic Category</div>
                      </div>
                      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
                        <div className="text-3xl font-bold text-blue-400">{(predictionResult.confidence * 100).toFixed(0)}%</div>
                        <div className="text-xs text-gray-500 mt-1">Confidence Score</div>
                      </div>
                    </div>

                    <div className="h-56 w-full min-w-0 min-h-0">
                      <ResponsiveContainer width="99%" height={224} minWidth={0}>
                        <BarChart data={[
                          { name: 'Low', probability: predictionResult.classProbabilities[0] ?? 0 },
                          { name: 'Medium', probability: predictionResult.classProbabilities[1] ?? 0 },
                          { name: 'High', probability: predictionResult.classProbabilities[2] ?? 0 },
                        ]} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 13 }} />
                          <YAxis domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                          <Tooltip
                            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '13px' }}
                            formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, 'Probability']}
                          />
                          <Bar dataKey="probability" radius={[8, 8, 0, 0]} maxBarSize={80}>
                            <Cell fill={BAR_COLORS[0]} />
                            <Cell fill={BAR_COLORS[1]} />
                            <Cell fill={BAR_COLORS[2]} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 text-gray-600">
                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                      <Play className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-sm">Configure parameters and run a prediction</p>
                    <p className="text-xs mt-1">Uses ONNX Runtime Web for in-browser inference</p>
                    <p className="text-xs mt-3 text-gray-700">Auto-predicts as you change inputs</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
