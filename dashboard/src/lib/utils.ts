import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

export function formatPercent(n: number, decimals = 1): string {
  return (n * 100).toFixed(decimals) + '%'
}

export function getCongestionColor(level: string): string {
  switch (level) {
    case 'Low': return '#22c55e'
    case 'Medium': return '#eab308'
    case 'High': return '#ef4444'
    default: return '#6b7280'
  }
}

export function getCongestionLabel(level: string): string {
  switch (level) {
    case 'Low': return 'Low'
    case 'Medium': return 'Moderate'
    case 'High': return 'High'
    default: return 'Unknown'
  }
}

export function getSeverityColor(score: number): string {
  if (score < 30) return '#22c55e'
  if (score < 60) return '#eab308'
  if (score < 80) return '#f97316'
  return '#ef4444'
}
