import { useEffect, useRef, useState } from 'react'
import { useTrafficStore } from '@/store/trafficStore'
import { motion } from 'framer-motion'
import {
  Activity, Shield, Truck, Map, Cpu, DollarSign, Brain, BarChart3,
  ChevronRight, Play, Upload, Code2, Heart, Award, Sun, Moon
} from 'lucide-react'

// ─── Feature definitions ────────────────────────────────────────────────────
const landingFeatures = [
  { title: 'Live Prediction', desc: 'Real-time in-browser ONNX model inference for congestion value estimation.', icon: Activity, color: '#3B82F6' },
  { title: 'Risk Intelligence', desc: 'Predictive risk engine combining incident cause, weather, and traffic density.', icon: Shield, color: '#06B6D4' },
  { title: 'Resource Optimization', desc: 'Dynamically allocate emergency and police resources to minimize delays.', icon: Truck, color: '#10B981' },
  { title: 'Diversion Planner', desc: 'Alternative route calculation and time savings simulator for key corridors.', icon: Map, color: '#f97316' },
  { title: 'Digital Twin Sim', desc: 'Simulate micro-scenarios (monsoon, concerts, festivals) and vehicle surges.', icon: Cpu, color: '#8b5cf6' },
  { title: 'Cost Analysis', desc: 'Quantify resource utilization and financial savings from optimized dispatch.', icon: DollarSign, color: '#ec4899' },
  { title: 'Explainable AI', desc: 'SHAP value interpretations that explain model features contributing to delays.', icon: Brain, color: '#14b8a6' },
  { title: 'Temporal Trends', desc: 'Analyze hourly, weekly, and monthly historical congestion profiles.', icon: BarChart3, color: '#a855f7' },
]

// ─── Cycling live-stat values for the preview card ──────────────────────────
const CONGESTION_VALS = [58, 65, 72, 78, 81, 69]
const DELAY_VALS = [15, 19, 23, 27, 31, 24]

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrafficLight {
  x: number
  y: number
  state: 'green' | 'red'
  timer: number
}

interface Vehicle {
  x: number
  y: number
  speed: number
  axis: 'h' | 'v'
  roadIdx: number
  dir: 1 | -1
  color: string
  size: number
  trail: { x: number; y: number }[]
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LandingPage() {
  const { setCurrentPage, setIsBulkMode, theme, toggleTheme } = useTrafficStore()

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [activeTab, setActiveTab] = useState('home')
  const [statIndex, setStatIndex] = useState(0)

  // ── Navigation helpers ───────────────────────────────────────────────────
  const scrollToSection = (id: string) => {
    setActiveTab(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const launchToPrediction = () => { setIsBulkMode(false); setCurrentPage('live-prediction') }
  const launchToBulkUpload = () => { setIsBulkMode(true); setCurrentPage('live-prediction') }

  // ── Cycle live preview stats ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setStatIndex(i => (i + 1) % CONGESTION_VALS.length), 2800)
    return () => clearInterval(id)
  }, [])

  // ── Minimap sparkline ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = minimapCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    // Primary trend line
    const pts1 = Array.from({ length: 24 }, (_, i) => ({
      x: (i / 23) * W,
      y: H * 0.2 + Math.sin(i * 0.7) * H * 0.2 + Math.random() * H * 0.1,
    }))
    ctx.strokeStyle = 'rgba(96,165,250,.7)'; ctx.lineWidth = 2
    ctx.beginPath(); pts1.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke()
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(96,165,250,.18)'); grad.addColorStop(1, 'rgba(96,165,250,0)')
    ctx.fillStyle = grad; ctx.fill()

    // Secondary trend line
    const pts2 = Array.from({ length: 24 }, (_, i) => ({
      x: (i / 23) * W,
      y: H * 0.55 + Math.cos(i * 0.5) * H * 0.15 + Math.random() * H * 0.08,
    }))
    ctx.strokeStyle = 'rgba(34,211,238,.5)'; ctx.lineWidth = 1.5
    ctx.beginPath(); pts2.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke()

    // Data points
    ctx.fillStyle = 'rgba(96,165,250,.9)'
    pts1.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill() })
  }, [])

  // ── Background traffic-grid canvas ──────────────────────────────────────
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let W = (canvas.width = window.innerWidth)
    let H = (canvas.height = window.innerHeight)

    const onResize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const gridSpacing = 110
    const hRoads: number[] = []
    const vRoads: number[] = []
    for (let y = 80; y < 3000; y += gridSpacing) hRoads.push(y)
    for (let x = 80; x < 3000; x += gridSpacing) vRoads.push(x)

    // Traffic lights at every intersection
    const lights: TrafficLight[] = []
    hRoads.slice(0, 25).forEach(y =>
      vRoads.slice(0, 25).forEach(x =>
        lights.push({ x, y, state: Math.random() > 0.5 ? 'green' : 'red', timer: Math.random() * 200 })
      )
    )

    // Vehicles
    const VEH_COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#ef4444', '#a855f7', '#f97316']
    const vehicles: Vehicle[] = []
    for (let i = 0; i < 75; i++) {
      const axis = Math.random() > 0.5 ? 'h' : ('v' as const)
      const isH = axis === 'h'
      const roads = isH ? hRoads : vRoads
      const roadIdx = Math.floor(Math.random() * roads.length)
      const roadPos = roads[roadIdx] ?? 100
      vehicles.push({
        x: isH ? Math.random() * W : roadPos,
        y: isH ? roadPos : Math.random() * H,
        speed: 0.8 + Math.random() * 1.4,
        axis,
        roadIdx,
        dir: Math.random() > 0.5 ? 1 : -1,
        color: VEH_COLORS[Math.floor(Math.random() * VEH_COLORS.length)]!,
        size: 1.5 + Math.random() * 1.5,
        trail: [],
      })
    }

    // Background drift particles
    const particles: Particle[] = Array.from({ length: 35 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 0.8 + Math.random() * 1.2,
    }))

    const hexToRgb = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    })

    const animate = () => {
      const activeTheme = useTrafficStore.getState().theme
      ctx.fillStyle = activeTheme === 'dark' ? '#020617' : '#f8fafc'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = activeTheme === 'dark' ? 'rgba(37,99,235,.04)' : 'rgba(37,99,235,.08)'
      ctx.lineWidth = 1
      hRoads.forEach(y => { if (y > H + 50) return; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() })
      vRoads.forEach(x => { if (x > W + 50) return; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() })

      // Particle network
      ctx.fillStyle = activeTheme === 'dark' ? 'rgba(6,182,212,.12)' : 'rgba(6,182,212,.22)'
      ctx.strokeStyle = activeTheme === 'dark' ? 'rgba(6,182,212,.04)' : 'rgba(6,182,212,.08)'
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < 160) { ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke() }
        }
      })

      // Traffic lights
      lights.forEach(light => {
        light.timer--
        if (light.timer <= 0) {
          light.state = light.state === 'green' ? 'red' : 'green'
          light.timer = 100 + Math.random() * 180
        }
        if (light.x > W + 20 || light.y > H + 20) return
        ctx.shadowBlur = 6
        ctx.shadowColor = light.state === 'green' ? '#10B981' : '#EF4444'
        ctx.fillStyle = light.state === 'green' ? 'rgba(16,185,129,.65)' : 'rgba(239,68,68,.65)'
        ctx.beginPath(); ctx.arc(light.x, light.y, 3, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      })

      // Vehicles with trails
      vehicles.forEach(veh => {
        const isH = veh.axis === 'h'
        const roads = isH ? hRoads : vRoads
        const roadPos = roads[veh.roadIdx] ?? 100
        const cur = isH ? veh.x : veh.y
        const nxt = cur + veh.speed * veh.dir
        let shouldStop = false

        if (veh.dir === 1) {
          const cross = isH ? vRoads : hRoads
          cross.forEach(ip => {
            if (cur < ip && nxt >= ip) {
              const lx = isH ? ip : roadPos
              const ly = isH ? roadPos : ip
              const l = lights.find(l => Math.abs(l.x - lx) < 5 && Math.abs(l.y - ly) < 5)
              if (l && l.state === 'red') shouldStop = true
            }
          })
        }

        if (!shouldStop) {
          if (isH) { veh.x += veh.speed * veh.dir; if (veh.x < -20) veh.x = W + 20; if (veh.x > W + 20) veh.x = -20 }
          else { veh.y += veh.speed * veh.dir; if (veh.y < -20) veh.y = H + 20; if (veh.y > H + 20) veh.y = -20 }
        }

        // Record trail
        veh.trail.push({ x: veh.x, y: veh.y })
        if (veh.trail.length > 9) veh.trail.shift()

        if (veh.x > W + 50 || veh.y > H + 50 || veh.x < -50 || veh.y < -50) return

        const { r, g, b } = hexToRgb(veh.color)

        // Draw trail
        veh.trail.forEach((pt, ti) => {
          const alpha = (ti / veh.trail.length) * 0.3
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
          ctx.beginPath(); ctx.arc(pt.x, pt.y, veh.size * 0.6, 0, Math.PI * 2); ctx.fill()
        })

        // Draw vehicle dot
        ctx.shadowBlur = 8
        ctx.shadowColor = veh.color
        ctx.fillStyle = `rgba(${r},${g},${b},.9)`
        ctx.beginPath(); ctx.arc(veh.x, veh.y, veh.size, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      })

      raf = requestAnimationFrame(animate)
    }

    animate()
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])

  // ── Live stat values ─────────────────────────────────────────────────────
  const liveCongestion = CONGESTION_VALS[statIndex]!
  const liveDelay = DELAY_VALS[statIndex]!

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#020617] text-[#F8FAFC] font-sans overflow-x-hidden selection:bg-blue-500/30">

      {/* ── Animated background canvas ── */}
      <canvas
        ref={bgCanvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none opacity-50 z-0"
      />

      {/* ══════════════════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[.06] bg-[#020617]/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-8 h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => scrollToSection('home')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-base">🐉</span>
            </div>
            <div>
              <p className="font-bold text-sm tracking-wide bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                DRACO 2.0
              </p>
              <p className="text-[9px] text-gray-600 tracking-widest uppercase hidden sm:block">AI Traffic Intelligence</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {(['home', 'features', 'architecture', 'team'] as const).map(id => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-blue-400 cursor-pointer ${activeTab === id ? 'text-blue-400' : 'text-gray-500'
                  }`}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </nav>

          {/* CTA with Theme Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl border border-white/[.06] bg-white/[.03] hover:bg-white/[.08] text-gray-400 hover:text-white transition-all active:scale-90 cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-yellow-400" /> : <Moon className="w-4.5 h-4.5 text-cyan-400" />}
            </button>
            <button
              onClick={launchToPrediction}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-2.5 sm:px-4 py-2 text-[11px] font-semibold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:scale-95 border border-blue-500/30"
            >
              <Play className="w-3 h-3 fill-current shrink-0" />
              <span className="hidden sm:inline">Launch Dashboard</span>
              <span className="sm:hidden">Launch</span>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="home"
        className="relative max-w-5xl mx-auto px-6 lg:px-8 pt-20 sm:pt-28 pb-12 z-10 flex flex-col items-center text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-2xl sm:rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] sm:text-[11px] text-blue-400 mb-8 font-semibold max-w-full text-center"
        >
          {/* Pulsing dot */}
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_theme(colors.blue.400)] shrink-0" />
          <Award className="w-3.5 h-3.5 shrink-0" />
          <span>Flipkart × Bengaluru Traffic Police</span>
          <span className="hidden sm:inline">·</span>
          <span>Gridlock Hackathon 2.0</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[clamp(28px,5vw,56px)] font-extrabold tracking-tight text-white leading-[1.08] max-w-3xl"
        >
          Transforming Urban Mobility{' '}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Through Explainable AI
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[13px] text-gray-500 max-w-[560px] mt-5 leading-relaxed"
        >
          Predict congestion, optimize dispatch, simulate micro-scenarios, and support smarter
          decisions using ONNX in-browser inference and digital twin technology.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap items-center justify-center gap-3 mt-9"
        >
          <button
            onClick={launchToPrediction}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 text-[12px] font-semibold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 border border-blue-500/30"
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            Launch Dashboard
          </button>
          <button
            onClick={launchToBulkUpload}
            className="flex items-center gap-2 bg-[#0d1527] hover:bg-[#131e36] text-gray-300 rounded-xl px-6 py-3 text-[12px] font-semibold border border-gray-800 transition-all hover:-translate-y-0.5"
          >
            <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
            Upload Excel Dataset
          </button>
          <button
            onClick={() => scrollToSection('architecture')}
            className="flex items-center gap-2 bg-white/[.03] hover:bg-white/[.06] text-gray-500 hover:text-gray-300 rounded-xl px-5 py-3 text-[12px] font-semibold transition-all"
          >
            <Code2 className="w-4 h-4 shrink-0" />
            View Architecture
          </button>
        </motion.div>

        {/* ── Dashboard preview card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="w-full max-w-4xl mt-16 group"
        >
          {/* Outer glow ring */}
          <div className="relative">
            <div className="absolute -inset-px rounded-[20px] bg-gradient-to-r from-blue-600/40 to-cyan-500/30 blur-xl opacity-60 group-hover:opacity-90 transition-opacity duration-700" />

            {/* Browser chrome */}
            <div className="relative border border-white/[.06] rounded-[18px] bg-[#080e24]/90 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[.05] bg-white/[.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <span className="flex-1 text-center text-[10px] text-gray-700 tracking-wide">
                  draco-traffic-intelligence.ai — Control Center
                </span>
              </div>

              {/* Inner content */}
              <div className="relative flex flex-col items-center justify-center gap-5 p-4 sm:p-8 aspect-auto md:aspect-[16/7] w-full">
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-100"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(37,99,235,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.04) 1px,transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />

                {/* Minimap sparkline */}
                <canvas
                  ref={minimapCanvasRef}
                  width={580}
                  height={110}
                  className="z-10 rounded-lg opacity-85 w-full max-w-[580px]"
                />

                {/* Live stat cards */}
                <div className="grid grid-cols-2 md:flex md:flex-row gap-3 md:gap-4 z-10 w-full justify-center max-w-sm md:max-w-none">
                  {[
                    { label: 'Congestion', value: `${liveCongestion}%`, gradient: 'from-blue-400 to-cyan-400' },
                    { label: 'Risk Level', value: 'HIGH', gradient: 'from-orange-400 to-red-500' },
                    { label: 'Units Active', value: '14', gradient: 'from-emerald-400 to-cyan-400' },
                    { label: 'Avg Delay', value: `+${liveDelay}m`, gradient: 'from-blue-400 to-cyan-400' },
                  ].map(s => (
                    <div
                      key={s.label}
                      className="bg-[#0a0f27]/80 border border-white/[.06] rounded-xl px-3 sm:px-5 py-2 sm:py-3 text-center min-w-[80px]"
                    >
                      <p className={`text-[18px] sm:text-[22px] font-bold bg-gradient-to-br ${s.gradient} bg-clip-text text-transparent transition-all duration-500`}>
                        {s.value}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Explore CTA */}
                <button
                  onClick={launchToPrediction}
                  className="z-10 flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors bg-none border-none cursor-pointer"
                >
                  Explore Control Center <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 z-10 border-t border-white/[.05] bg-[#020617]/80"
      >
        <div className="text-center mb-12">
          <p className="text-[10px] uppercase tracking-[.18em] text-cyan-400 font-semibold mb-2">
            Integrated Platform
          </p>
          <h2 className="text-[clamp(22px,3vw,36px)] font-extrabold text-white tracking-tight">
            Full-Suite Intelligence Modules
          </h2>
          <p className="text-[12px] text-gray-500 max-w-sm mx-auto mt-2 leading-relaxed">
            8 core subsystems operating in sync to evaluate and resolve urban bottlenecks.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {landingFeatures.map((feat, idx) => {
            const Icon = feat.icon
            return (
              <div
                key={idx}
                className="group relative rounded-xl border border-white/[.05] bg-gray-950/40 p-5 backdrop-blur-sm
                           hover:border-blue-500/20 hover:bg-gray-950/60 hover:-translate-y-1 transition-all duration-200 overflow-hidden"
              >
                {/* Hover radial glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 20% 20%, ${feat.color}12, transparent 65%)` }}
                />

                <span className="absolute top-3.5 right-3.5 text-[10px] text-white/[.06] font-mono font-bold">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: `${feat.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: feat.color }} />
                </div>

                <h3 className="text-[12px] font-bold text-white mb-1.5 group-hover:text-blue-400 transition-colors">
                  {feat.title}
                </h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          ARCHITECTURE
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="architecture"
        className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 z-10 border-t border-white/[.05]"
      >
        <div className="text-center mb-12">
          <p className="text-[10px] uppercase tracking-[.18em] text-blue-400 font-semibold mb-2">
            Data Processing Flow
          </p>
          <h2 className="text-[clamp(22px,3vw,36px)] font-extrabold text-white tracking-tight">
            System Architecture
          </h2>
          <p className="text-[12px] text-gray-500 max-w-sm mx-auto mt-2 leading-relaxed">
            Inputs flow through feature engineering to the ONNX engine and downstream dashboard views.
          </p>
        </div>

        <div className="max-w-2xl mx-auto border border-white/[.05] rounded-2xl bg-gray-950/50 backdrop-blur-sm p-7 space-y-4">
          {/* Input row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🎛️', title: 'Single Input', desc: 'Manual interactive parameters' },
              { icon: '📂', title: 'Excel / CSV Upload', desc: 'Bulk spreadsheet evaluation' },
            ].map(n => (
              <div
                key={n.title}
                className="p-4 rounded-xl border border-white/[.05] bg-gray-950 text-center hover:border-blue-500/20 hover:bg-gray-900/60 transition-all group"
              >
                <span className="text-xl">{n.icon}</span>
                <p className="text-[11px] font-bold text-white mt-2 group-hover:text-blue-400 transition-colors">{n.title}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{n.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center text-blue-500">⬇</div>

          {/* Pipeline stage */}
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/[.06] text-center">
            <p className="text-[12px] font-bold text-blue-400">Feature Engineering Pipeline</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Normalization · label encodings · one-hot conversions</p>
          </div>

          <div className="text-center text-cyan-500">⬇</div>

          {/* ONNX stage */}
          <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[.06] text-center">
            <p className="text-[12px] font-bold text-cyan-400">ONNX Models Engine — In-Browser Inference</p>
            <p className="text-[10px] text-gray-500 mt-0.5">CatBoost Regression &amp; RandomForest Classifiers</p>
          </div>

          <div className="text-center text-indigo-500">⬇</div>

          {/* Output grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Congestion Prediction', 'Risk Score Engine', 'Resource Optimizer', 'Diversion Planner', 'Digital Twin', 'Cost Analysis'].map(name => (
              <div
                key={name}
                className="p-2.5 rounded-lg border border-white/[.05] bg-gray-900/50 text-[10px] font-semibold text-gray-400 text-center hover:bg-gray-800/60 hover:text-gray-200 transition-all"
              >
                {name}
              </div>
            ))}
          </div>

          <div className="text-center text-emerald-500">⬇</div>

          {/* Dashboard CTA */}
          <button
            onClick={launchToPrediction}
            className="w-full p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] text-center
                       hover:bg-emerald-500/[.12] hover:border-emerald-500/30 transition-all cursor-pointer"
          >
            <p className="text-[12px] font-bold text-emerald-400">Dashboard UI &amp; Charts 🚀</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Explore results across all temporal and spatial chart views</p>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TEAM
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="team"
        className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 z-10 border-t border-white/[.05] bg-[#020617]/80"
      >
        <div className="max-w-sm mx-auto border border-white/[.05] rounded-2xl bg-gray-950/50 backdrop-blur-sm p-8 text-center">
          <span className="inline-block bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-[10px] text-blue-400 font-semibold uppercase tracking-widest mb-4">
            Developed By
          </span>
          <h3 className="text-xl font-extrabold text-white tracking-tight">🐉 DRACO 2.0</h3>
          <p className="text-[11px] text-gray-500 mt-1">Built for Flipkart × Bengaluru Traffic Police</p>
          <p className="text-[10px] text-gray-700 font-semibold uppercase tracking-widest mt-0.5">Gridlock Hackathon 2.0</p>

          <a
            href="https://github.com/JAYASURYA-KK"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700
                       rounded-xl px-4 py-2.5 text-[11px] text-gray-300 font-semibold transition-all hover:-translate-y-0.5 select-none"
          >
            <svg className="w-4 h-4 fill-current text-white shrink-0" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            🐙 GitHub · JAYASURYA-KK
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer className="relative border-t border-white/[.05] bg-gray-950 py-10 z-10 text-center text-[11px] text-gray-500">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p>
            <span className="font-bold text-gray-300">DRACO 2.0</span>
            <span className="text-gray-700 mx-2">|</span>
            AI Traffic Intelligence Platform
          </p>
          <p className="text-[10px] text-gray-700">
            Built for Flipkart × Bengaluru Traffic Police Gridlock Hackathon 2.0
          </p>
          <p className="text-[10px] text-gray-800">
            Powered by React · TypeScript · ONNX Runtime · Recharts · Leaflet
          </p>
          <p className="text-[10px] text-gray-800 flex items-center justify-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-current" /> in Bengaluru
          </p>
        </div>
      </footer>
    </div>
  )
}