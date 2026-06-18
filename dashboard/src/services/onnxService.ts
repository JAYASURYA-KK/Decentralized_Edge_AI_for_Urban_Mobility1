import * as ort from 'onnxruntime-web'
import { buildFeatureVector } from './featureEngineering'
import type { PredictionInput, PredictionResult } from '@/types'

let regSession: ort.InferenceSession | null = null
let clsSession: ort.InferenceSession | null = null

const REG_MODEL_PATH = '/models/traffic_reg_model.onnx'
const CLS_MODEL_PATH = '/models/traffic_cls_model.onnx'

async function loadSession(path: string): Promise<ort.InferenceSession> {
  const response = await fetch(path)
  const buffer = await response.arrayBuffer()
  return await ort.InferenceSession.create(buffer)
}

export async function initModels(): Promise<void> {
  try {
    ;[regSession, clsSession] = await Promise.all([
      loadSession(REG_MODEL_PATH),
      loadSession(CLS_MODEL_PATH),
    ])
    console.log('ONNX models loaded successfully')
  } catch (err) {
    console.error('Failed to load ONNX models:', err)
    throw err
  }
}

/**
 * Extract a single scalar from a 1D tensor.
 */
function getRegScalar(output: Record<string, ort.Tensor>, name: string): number {
  return Number((output[name] as ort.Tensor).data[0])
}

/**
 * Extract class probabilities from a flat [batch, 3] probabilities tensor.
 * The model was re-exported with zipmap=False to avoid seq(map(...)) issues.
 */
function getClsProbabilities(output: Record<string, ort.Tensor>, name: string): number[] {
  const tensor = output[name] as ort.Tensor
  if (!tensor || !tensor.data) return [0.33, 0.34, 0.33]
  const data = Array.from(tensor.data as Iterable<number>)
  if (data.length === 3) {
    const total = data.reduce((a, b) => a + b, 0)
    if (total > 0 && Math.abs(total - 1) > 0.01) {
      return data.map(p => p / total)
    }
    return data
  }
  return [0.33, 0.34, 0.33]
}

export async function predict(input: PredictionInput): Promise<PredictionResult> {
  if (!regSession || !clsSession) {
    throw new Error('Models not initialized. Call initModels() first.')
  }

  const features = buildFeatureVector(input)
  const inputTensor = new ort.Tensor('float32', features, [1, 21])

  // --- Regression (CatBoost) — output shape is [1] after Reshape fix ---
  const regOut = await regSession.run({ [regSession.inputNames[0]!]: inputTensor })
  const congestionValue = getRegScalar(regOut, regSession.outputNames[0]!)

  // --- Classification (RandomForest) — outputs: [label], [probabilities] ---
  // Output 0 = label (int64), Output 1 = probabilities (float32, shape [1,3])
  const clsOut = await clsSession.run({ [clsSession.inputNames[0]!]: inputTensor })
  const classProbabilities = getClsProbabilities(clsOut, clsSession.outputNames[1]!)

  const maxProbIdx = classProbabilities.indexOf(Math.max(...classProbabilities))
  const confidence = classProbabilities[maxProbIdx] ?? 0.5

  // ── Ensemble: both models vote on the final level ──────────────
  // Regression (CatBoost) provides continuous signal for Low/High.
  // Classifier (RandomForest) provides probabilistic signal for High/Medium.
  // Either model can elevate to High; regression alone handles Low.
  let congestionLevel: 'Low' | 'Medium' | 'High'
  if (congestionValue < 40) {
    // Regression says low congestion → Safe
    congestionLevel = 'Low'
  } else if (
    congestionValue >= 55 ||
    classProbabilities[0]! > classProbabilities[2]!
  ) {
    // Regression OR classifier says High → High Risk
    congestionLevel = 'High'
  } else {
    congestionLevel = 'Medium'
  }

  return { congestionValue, congestionLevel, confidence, classProbabilities }
}

export function isModelsLoaded(): boolean {
  return regSession !== null && clsSession !== null
}

/**
 * Post-process batch predictions using percentile-based normalization.
 * Guarantees all three congestion levels (Low/Medium/High) appear in any
 * batch, regardless of the absolute regression output range.
 *
 * Classification:
 *  - Bottom ~30% of regression values → Low (Safe)
 *  - Top ~30% of regression values → High (Risk)
 *  - Middle ~40% → Medium
 */
export function normalizeBatchLevels(
  results: { result: { congestionValue: number; congestionLevel: 'Low' | 'Medium' | 'High' } }[]
): void {
  if (results.length < 3) return

  // Sort by regression value ascending
  const sorted = [...results].sort((a, b) => a.result.congestionValue - b.result.congestionValue)
  const n = sorted.length
  const lowCutoff = Math.ceil(n * 0.30)   // bottom 30% → Low
  const highStart = Math.floor(n * 0.70)  // top 30% → High

  for (let i = 0; i < n; i++) {
    const item = sorted[i]!
    if (i < lowCutoff) {
      item.result.congestionLevel = 'Low'
    } else if (i >= highStart) {
      item.result.congestionLevel = 'High'
    } else {
      item.result.congestionLevel = 'Medium'
    }
  }
}
