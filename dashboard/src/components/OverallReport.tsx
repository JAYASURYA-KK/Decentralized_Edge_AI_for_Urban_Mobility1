import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTrafficStore } from '@/store/trafficStore'
import { getCongestionColor } from '@/lib/utils'
import { FileSpreadsheet, FileText, Activity, Shield, Car, Database, Clock, Brain } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { calculateRiskScore } from './ExecutiveOverview'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function OverallReport() {
  const { bulkPredictions, isBulkMode, predictionResult, predictionInput, alerts } = useTrafficStore()

  // Generate dynamic stats from all stores
  const reportData = useMemo(() => {
    let totalEvents = 0
    let avgScore = 0
    let highRiskCount = 0
    let activeAlerts = alerts.length
    let totalVehicles = 0
    let averageDelay = 0
    let predictionsList: any[] = []
    let mode = 'Baseline / Demo'

    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      mode = 'Batch Processing'
      totalEvents = bulkPredictions.length
      const scoreSum = bulkPredictions.reduce((acc, curr) => acc + curr.result.congestionValue, 0)
      avgScore = scoreSum / totalEvents
      highRiskCount = bulkPredictions.filter(p => p.result.congestionLevel === 'High').length
      totalVehicles = Math.round(avgScore * 150)
      averageDelay = avgScore * 0.4
      
      predictionsList = bulkPredictions.map(p => ({
        id: p.id,
        zone: p.input.zone,
        cause: p.input.eventCause,
        level: p.result.congestionLevel,
        score: p.result.congestionValue,
        confidence: p.result.confidence
      }))
      activeAlerts = highRiskCount + bulkPredictions.filter(p => p.result.congestionLevel === 'Medium').length
    } else if (predictionResult) {
      mode = 'Single Prediction'
      totalEvents = 1
      avgScore = predictionResult.congestionValue
      highRiskCount = predictionResult.congestionLevel === 'High' ? 1 : 0
      totalVehicles = Math.round(avgScore * 150)
      averageDelay = avgScore * 0.4

      predictionsList = [{
        id: 'manual-1',
        zone: predictionInput.zone,
        cause: predictionInput.eventCause,
        level: predictionResult.congestionLevel,
        score: predictionResult.congestionValue,
        confidence: predictionResult.confidence
      }]
      activeAlerts = predictionResult.congestionLevel === 'Low' ? 0 : 1
    } else {
      // Demo Data
      totalEvents = 15
      avgScore = 48
      highRiskCount = 3
      totalVehicles = 12453
      averageDelay = 18
      predictionsList = [
        { id: 'DEMO-1', zone: 'Central Zone 1', cause: 'accident', level: 'High', score: 85, confidence: 0.92 },
        { id: 'DEMO-2', zone: 'Outer Zone', cause: 'road_construction', level: 'Medium', score: 62, confidence: 0.88 },
        { id: 'DEMO-3', zone: 'Central Zone 2', cause: 'special_event', level: 'Low', score: 35, confidence: 0.95 },
      ]
    }

    return {
      mode,
      totalEvents,
      avgScore,
      highRiskCount,
      activeAlerts,
      totalVehicles,
      averageDelay,
      predictionsList
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput, alerts])

  const downloadCSV = () => {
    if (reportData.predictionsList.length === 0) {
      toast.error('No data to export.')
      return
    }

    let csvContent = "data:text/csv;charset=utf-8,"
    
    // Add Summary
    csvContent += "OVERALL SYSTEM REPORT\n"
    csvContent += `Mode,${reportData.mode}\n`
    csvContent += `Total Events Analyzed,${reportData.totalEvents}\n`
    csvContent += `Average Congestion Score,${reportData.avgScore.toFixed(1)}\n`
    csvContent += `High Risk Zones,${reportData.highRiskCount}\n`
    csvContent += `Total Flow Rate,${reportData.totalVehicles}\n`
    csvContent += `Average Delay (min),${reportData.averageDelay.toFixed(1)}\n`
    csvContent += `Active Alerts,${reportData.activeAlerts}\n\n`

    // Add Details Table
    const headers = ["ID", "Zone", "Cause", "Congestion Level", "Congestion Score", "Confidence"]
    csvContent += headers.join(",") + "\n"

    reportData.predictionsList.forEach(p => {
      const row = [
        p.id,
        p.zone,
        p.cause,
        p.level,
        p.score.toFixed(2),
        (p.confidence * 100).toFixed(1) + "%"
      ]
      csvContent += row.join(",") + "\n"
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `overall_traffic_report_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadPDF = () => {
    if (reportData.predictionsList.length === 0) {
      toast.error('No data to export.')
      return
    }

    const doc = new jsPDF()
    
    // Add title
    doc.setFontSize(18)
    doc.text('System Overall Report', 14, 22)
    
    // Add Summary Details
    doc.setFontSize(11)
    doc.text(`Mode: ${reportData.mode}`, 14, 32)
    doc.text(`Total Events Analyzed: ${reportData.totalEvents}`, 14, 38)
    doc.text(`Average Congestion Score: ${reportData.avgScore.toFixed(1)}`, 14, 44)
    doc.text(`High Risk Zones: ${reportData.highRiskCount}`, 14, 50)
    doc.text(`Total Flow Rate: ${reportData.totalVehicles.toLocaleString()}`, 14, 56)
    doc.text(`Average Delay (min): ${reportData.averageDelay.toFixed(1)}`, 14, 62)
    doc.text(`Active Alerts: ${reportData.activeAlerts}`, 14, 68)

    const tableColumn = ["Event ID", "Location Zone", "Root Cause", "Predicted Level", "Score", "Confidence"]
    const tableRows: any[] = []

    reportData.predictionsList.forEach(p => {
      const rowData = [
        p.id,
        p.zone,
        String(p.cause).replace(/_/g, ' '),
        p.level,
        p.score.toFixed(1),
        (p.confidence * 100).toFixed(1) + "%"
      ]
      tableRows.push(rowData)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 76,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] }, // Blue header
      didParseCell: function(data) {
        // Color code the 'Predicted Level' column
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'High') {
            data.cell.styles.textColor = [239, 68, 68] // Red
            data.cell.styles.fontStyle = 'bold'
          } else if (data.cell.raw === 'Medium') {
            data.cell.styles.textColor = [234, 179, 8] // Yellow
            data.cell.styles.fontStyle = 'bold'
          } else if (data.cell.raw === 'Low') {
            data.cell.styles.textColor = [34, 197, 94] // Green
            data.cell.styles.fontStyle = 'bold'
          }
        }
      }
    })

    doc.save(`overall_traffic_report_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header and Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-gray-200">System Overall Report</h2>
          <p className="text-xs text-gray-500 mt-1">Unified aggregation of all AI predictions, risks, and events.</p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <Badge variant={isBulkMode ? 'danger' : predictionResult ? 'warning' : 'success'} className="px-3 py-1 text-xs">
            {reportData.mode}
          </Badge>
          <button onClick={downloadCSV} className="flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/40 hover:text-emerald-300 px-4 py-2 rounded-lg text-xs font-semibold transition-all">
            <FileSpreadsheet className="w-4 h-4" /> Export to Excel
          </button>
          <button onClick={downloadPDF} className="flex items-center gap-2 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/40 hover:text-red-300 px-4 py-2 rounded-lg text-xs font-semibold transition-all">
            <FileText className="w-4 h-4" /> Save as PDF
          </button>
        </div>
      </div>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Analyzed Events</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-gray-100">{reportData.totalEvents}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Avg Congestion</span>
              <Activity className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold" style={{ color: getCongestionColor(reportData.avgScore > 70 ? 'High' : reportData.avgScore > 40 ? 'Medium' : 'Low') }}>
              {reportData.avgScore.toFixed(1)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">High Risk Hotspots</span>
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{reportData.highRiskCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active Alerts</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">{reportData.activeAlerts}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Traffic Volume Flow</span>
              <Car className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-400">{reportData.totalVehicles.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Avg Delay Penalty</span>
              <Clock className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400">{reportData.averageDelay.toFixed(0)} min</div>
          </CardContent>
        </Card>
      </div>

      {/* Report Data Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="py-4 border-b border-gray-800">
          <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-500" /> Model Predictions Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-gray-900 shadow-sm z-10">
                <tr className="border-b border-gray-800 text-gray-500 font-medium">
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Location Zone</th>
                  <th className="px-4 py-3">Root Cause</th>
                  <th className="px-4 py-3">Predicted Level</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {reportData.predictionsList.length > 0 ? (
                  reportData.predictionsList.map((p, idx) => (
                    <tr key={idx} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="px-4 py-3 font-mono text-gray-400">{p.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-200">{p.zone}</td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{String(p.cause).replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.level === 'High' ? 'danger' : p.level === 'Medium' ? 'warning' : 'success'} className="text-[10px]">
                          {p.level}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: getCongestionColor(p.level) }}>{p.score.toFixed(1)}</td>
                      <td className="px-4 py-3 text-blue-400 font-medium">{(p.confidence * 100).toFixed(1)}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">No events logged in current context.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
