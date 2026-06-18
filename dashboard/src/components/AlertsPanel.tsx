import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTrafficStore } from '@/store/trafficStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, AlertTriangle, Info, AlertCircle, CheckCircle2, Database, FileSpreadsheet, FileText } from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { isModelsLoaded } from '@/services/onnxService'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const alertTypes = [
  { severity: 'critical' as const, icon: AlertCircle, label: 'Critical', color: '#ef4444', bg: '#ef444410' },
  { severity: 'moderate' as const, icon: AlertTriangle, label: 'Moderate', color: '#eab308', bg: '#eab30810' },
  { severity: 'normal' as const, icon: Info, label: 'Info', color: '#22c55e', bg: '#22c55e10' },
]

export function AlertsPanel() {
  const { alerts, dismissAlert, bulkPredictions, isBulkMode, predictionResult, predictionInput } = useTrafficStore()
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const modelsReady = isModelsLoaded()

  // Generate dynamic alerts based on active prediction context
  const activeAlerts = useMemo(() => {
    if (isBulkMode && bulkPredictions && bulkPredictions.length > 0) {
      // Create alerts for High/Medium congestion events in batch
      const generated = bulkPredictions
        .map(p => ({
          id: p.id,
          message: `${p.result.congestionLevel} Congestion predicted at ${p.address || p.description} (Value: ${p.result.congestionValue.toFixed(1)}, Zone: ${p.input.zone})`,
          severity: p.result.congestionLevel === 'High' ? 'critical' as const : p.result.congestionLevel === 'Medium' ? 'moderate' as const : 'normal' as const,
          timestamp: new Date()
        }))

      return generated.filter(a => !dismissedIds.includes(a.id))
    } else if (predictionResult) {
      // Create alerts for single prediction
      const level = predictionResult.congestionLevel
      if (level === 'High' || level === 'Medium') {
        const generated = [{
          id: 'single_prediction_alert',
          message: `${level} Congestion predicted for parameter parameters (Score: ${predictionResult.congestionValue.toFixed(1)}, Zone: ${predictionInput.zone})`,
          severity: level === 'High' ? 'critical' as const : 'moderate' as const,
          timestamp: new Date()
        }]
        return generated.filter(a => !dismissedIds.includes(a.id))
      }
      return []
    } else {
      // Return store default alerts
      return alerts
    }
  }, [bulkPredictions, isBulkMode, predictionResult, predictionInput, alerts, dismissedIds])

  const handleDismiss = (id: string) => {
    if (isBulkMode || predictionResult) {
      setDismissedIds(prev => [...prev, id])
    } else {
      dismissAlert(id)
    }
    toast.success('Alert dismissed')
  }

  const downloadCSV = () => {
    if (activeAlerts.length === 0) {
      toast.error('No alerts to download.')
      return
    }

    let csvContent = "data:text/csv;charset=utf-8,"
    const headers = ["ID", "Severity", "Message", "Timestamp"]
    csvContent += headers.join(",") + "\n"

    activeAlerts.forEach(a => {
      const msg = a.message.replace(/"/g, '""') // Escape quotes for CSV
      const row = [
        a.id,
        a.severity,
        `"${msg}"`,
        a.timestamp.toLocaleString()
      ]
      csvContent += row.join(",") + "\n"
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `alerts_report_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadPDF = () => {
    if (activeAlerts.length === 0) {
      toast.error('No alerts to export.')
      return
    }

    const doc = new jsPDF()
    
    // Add title
    doc.setFontSize(18)
    doc.text('System Active Alerts Report', 14, 22)
    doc.setFontSize(11)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)
    doc.text(`Total Active Alerts: ${activeAlerts.length}`, 14, 38)

    const tableColumn = ["Alert ID", "Severity", "Message", "Timestamp"]
    const tableRows: any[] = []

    activeAlerts.forEach(a => {
      const rowData = [
        a.id,
        a.severity.toUpperCase(),
        a.message,
        a.timestamp.toLocaleTimeString()
      ]
      tableRows.push(rowData)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        2: { cellWidth: 100 } // Give message column more space
      },
      headStyles: { fillColor: [30, 58, 138] }, // Blue header
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 1) {
          if (data.cell.raw === 'CRITICAL') {
            data.cell.styles.textColor = [239, 68, 68]
            data.cell.styles.fontStyle = 'bold'
          } else if (data.cell.raw === 'MODERATE') {
            data.cell.styles.textColor = [234, 179, 8]
            data.cell.styles.fontStyle = 'bold'
          } else if (data.cell.raw === 'NORMAL') {
            data.cell.styles.textColor = [34, 197, 94]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      }
    })

    doc.save(`alerts_report_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Alert List */}
      <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
        <CardHeader className="flex-row items-center justify-between py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {isBulkMode ? <Database className="w-4 h-4 text-blue-400" /> : <Bell className="w-4 h-4 text-gray-500" />}
            <CardTitle className="text-sm text-gray-300">
              {isBulkMode ? 'Parsed Batch Active Alerts' : 'System Alerts'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={activeAlerts.length > 0 ? 'danger' : 'success'}>
              {activeAlerts.length} active
            </Badge>
            <div className="flex gap-1 ml-2 print:hidden">
              <button onClick={downloadCSV} className="flex items-center gap-1.5 text-[10px] bg-green-900/20 text-green-400 hover:bg-green-900/40 border border-green-500/30 px-2 py-1 rounded transition-colors" title="Download Excel (CSV)">
                <FileSpreadsheet className="w-3 h-3" /> Excel
              </button>
              <button onClick={downloadPDF} className="flex items-center gap-1.5 text-[10px] bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-500/30 px-2 py-1 rounded transition-colors" title="Download PDF">
                <FileText className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <AnimatePresence mode="popLayout">
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-650">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 animate-bounce" />
                <p className="text-sm text-gray-300 font-medium">All Systems Normal</p>
                <p className="text-xs text-gray-500 mt-1">No active congestion alerts</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {activeAlerts.map((alert) => {
                  const alertType = alertTypes.find(t => t.severity === alert.severity) ?? alertTypes[2]
                  const Icon = alertType.icon
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 50, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-3 p-4 rounded-xl border transition-colors"
                      style={{ borderColor: `${alertType.color}25`, background: alertType.bg }}
                    >
                      <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: alertType.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'moderate' ? 'warning' : 'success'} className="text-[9px] py-0 px-1.5 font-semibold uppercase">
                            {alertType.label}
                          </Badge>
                          <span className="text-[10px] text-gray-500">
                            {alert.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">{alert.message}</p>
                      </div>
                      <button onClick={() => handleDismiss(alert.id)}
                        className="shrink-0 w-6 h-6 rounded-full hover:bg-gray-805 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Alert Stats */}
      <div className="space-y-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="py-3 border-b border-gray-800">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alert Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {alertTypes.map((type) => {
                const count = activeAlerts.filter(a => a.severity === type.severity).length
                const Icon = type.icon
                return (
                  <div key={type.severity} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: type.bg }}>
                      <Icon className="w-4 h-4" style={{ color: type.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-300 font-medium">{type.label}</div>
                      <div className="h-1.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / Math.max(activeAlerts.length, 1)) * 100}%`, background: type.color }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold font-mono" style={{ color: type.color }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="py-3 border-b border-gray-800">
            <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telemetry Feeds Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">ONNX Models</span>
                <Badge variant={modelsReady ? 'success' : 'warning'}>{modelsReady ? 'Loaded' : 'Demo Mode'}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Context Mode</span>
                <Badge variant={isBulkMode ? 'danger' : 'success'}>{isBulkMode ? 'CSV Batch' : 'Single Form'}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Telemetry Refresh</span>
                <span className="text-gray-500 font-mono text-[11px]">Dynamic</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Simulations Stream</span>
                <span className="text-green-500 font-semibold text-[11px]">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
