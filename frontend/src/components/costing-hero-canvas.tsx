"use client"

import { useEffect, useRef } from "react"

const SPHERE_COLORS = [0x1a1a1a, 0x3b6d11, 0x185fa5, 0x854f0b]
const SPHERE_X = [-3.6, -1.2, 1.2, 3.6]
const OSCILLATIONS = [
  { speed: 0.72, phase: 0 },
  { speed: 0.55, phase: 1.3 },
  { speed: 0.93, phase: 2.5 },
  { speed: 0.65, phase: 0.75 },
]
const RING_TILT = [Math.PI / 2.8, Math.PI / 3.2, Math.PI / 2.5, Math.PI / 3.0]
const RING_Z_ROT = [0, 0.45, 0.2, 0.65]

interface Props {
  totalSpend: string
  invoicesThisMonth: string
  activeIngredients: string
  activeRecipes: string
  loading?: boolean
}

export default function CostingHeroCanvas({
  totalSpend,
  invoicesThisMonth,
  activeIngredients,
  activeRecipes,
  loading,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrapEl = wrapRef.current
    const canvasEl = canvasRef.current
    if (!wrapEl || !canvasEl) return

    let disposed = false
    let rafId = 0
    let cleanupFn: (() => void) | undefined

    async function init() {
      const THREE = await import("three")
      if (disposed) return
      const wrap = wrapEl as HTMLDivElement
      const canvas = canvasEl as HTMLCanvasElement
      if (!wrap || !canvas) return

      // ── Scene ────────────────────────────────────────────────────────────
      const scene = new THREE.Scene()

      const w = wrap.offsetWidth
      const h = wrap.offsetHeight
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
      camera.position.z = 9

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      renderer.setClearColor(0x000000, 0)

      // ── Lights ───────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55))

      const pl1 = new THREE.PointLight(0xffffff, 3.5, 22)
      pl1.position.set(5, 5, 6)
      scene.add(pl1)

      const pl2 = new THREE.PointLight(0x6699ff, 1.2, 16)
      pl2.position.set(-5, -3, 4)
      scene.add(pl2)

      // ── Spheres + rings ──────────────────────────────────────────────────
      const spheres: InstanceType<typeof THREE.Mesh>[] = []
      const rings: InstanceType<typeof THREE.Mesh>[] = []

      SPHERE_COLORS.forEach((color, i) => {
        const sg = new THREE.SphereGeometry(0.52, 40, 40)
        const sm = new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: 0.12 })
        const sphere = new THREE.Mesh(sg, sm)
        sphere.position.x = SPHERE_X[i]
        scene.add(sphere)
        spheres.push(sphere)

        const tg = new THREE.TorusGeometry(0.8, 0.022, 10, 80)
        const tm = new THREE.MeshStandardMaterial({
          color,
          metalness: 0.95,
          roughness: 0.08,
          transparent: true,
          opacity: 0.85,
        })
        const ring = new THREE.Mesh(tg, tm)
        ring.rotation.x = RING_TILT[i]
        ring.rotation.z = RING_Z_ROT[i]
        ring.position.x = SPHERE_X[i]
        scene.add(ring)
        rings.push(ring)
      })

      // ── Connector lines ──────────────────────────────────────────────────
      // We rebuild this geometry each frame so keep a Float32Array reference
      const lineArr = new Float32Array(spheres.length * 3)
      spheres.forEach((s, i) => {
        lineArr[i * 3] = s.position.x
        lineArr[i * 3 + 1] = 0
        lineArr[i * 3 + 2] = 0
      })
      const lineGeo = new THREE.BufferGeometry()
      const lineAttr = new THREE.BufferAttribute(lineArr, 3)
      lineGeo.setAttribute("position", lineAttr)
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
      scene.add(new THREE.Line(lineGeo, lineMat))

      // ── Particles ────────────────────────────────────────────────────────
      const isMobile = window.innerWidth < 768
      const pCount = isMobile ? 80 : 260
      const pPos = new Float32Array(pCount * 3)
      const pSpeed = new Float32Array(pCount)
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 12
        pPos[i * 3 + 1] = (Math.random() - 0.5) * 5
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 5
        pSpeed[i] = 0.003 + Math.random() * 0.007
      }
      const ptGeo = new THREE.BufferGeometry()
      const ptAttr = new THREE.BufferAttribute(pPos, 3)
      ptGeo.setAttribute("position", ptAttr)
      const ptMat = new THREE.PointsMaterial({
        color: 0xb0b0b0,
        size: 0.025,
        transparent: true,
        opacity: 0.45,
        sizeAttenuation: true,
      })
      scene.add(new THREE.Points(ptGeo, ptMat))

      // ── Mouse parallax ───────────────────────────────────────────────────
      let mx = 0
      let my = 0
      let cx = 0
      let cy = 0

      function onMouseMove(e: MouseEvent) {
        const r = wrap.getBoundingClientRect()
        mx = ((e.clientX - r.left) / r.width - 0.5) * 2
        my = ((e.clientY - r.top) / r.height - 0.5) * 2
      }
      wrap.addEventListener("mousemove", onMouseMove)

      // ── Resize ──────────────────────────────────────────────────────────
      function onResize() {
        const nw = wrap.offsetWidth
        const nh = wrap.offsetHeight
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh)
      }
      window.addEventListener("resize", onResize)

      // ── Animation ───────────────────────────────────────────────────────
      const clock = new THREE.Clock()
      let isVisible = false
      let isAnimating = false

      function animate() {
        if (!isVisible || disposed) {
          isAnimating = false
          return
        }
        isAnimating = true
        rafId = requestAnimationFrame(animate)

        const t = clock.getElapsedTime()

        // Sphere + ring oscillation
        spheres.forEach((s, i) => {
          const { speed, phase } = OSCILLATIONS[i]
          const y = Math.sin(t * speed + phase) * 0.28
          s.position.y = y
          rings[i].position.y = y
          rings[i].rotation.z += 0.0018 * (i % 2 === 0 ? 1 : -1)
        })

        // Update line positions to follow spheres
        spheres.forEach((s, i) => {
          lineArr[i * 3 + 1] = s.position.y
        })
        lineAttr.needsUpdate = true

        // Particle rise
        for (let i = 0; i < pCount; i++) {
          ptAttr.array[i * 3 + 1] += pSpeed[i]
          if ((ptAttr.array as Float32Array)[i * 3 + 1] > 3) {
            ;(ptAttr.array as Float32Array)[i * 3 + 1] = -3
          }
        }
        ptAttr.needsUpdate = true

        // Camera parallax lerp
        cx += (mx * 0.4 - cx) * 0.04
        cy += (-my * 0.2 - cy) * 0.04
        camera.position.x = cx
        camera.position.y = cy
        camera.lookAt(0, 0, 0)

        renderer.render(scene, camera)
      }

      // ── IntersectionObserver ─────────────────────────────────────────────
      const observer = new IntersectionObserver(
        (entries) => {
          isVisible = entries[0].isIntersecting
          if (isVisible && !isAnimating && !disposed) animate()
        },
        { threshold: 0 }
      )
      observer.observe(wrap)

      // ── Cleanup ──────────────────────────────────────────────────────────
      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        observer.disconnect()
        wrap.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("resize", onResize)
        spheres.forEach((s) => {
          s.geometry.dispose()
          ;(s.material as InstanceType<typeof THREE.Material>).dispose()
        })
        rings.forEach((r) => {
          r.geometry.dispose()
          ;(r.material as InstanceType<typeof THREE.Material>).dispose()
        })
        lineGeo.dispose()
        lineMat.dispose()
        ptGeo.dispose()
        ptMat.dispose()
        renderer.dispose()
      }
    }

    init().then((fn) => {
      if (disposed) {
        fn?.()
      } else {
        cleanupFn = fn
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      cleanupFn?.()
    }
  }, [])

  const kpis = [
    { label: "Total spend ex VAT", value: totalSpend },
    { label: "Invoices this month", value: invoicesThisMonth },
    { label: "Active ingredients", value: activeIngredients },
    { label: "Active recipes", value: activeRecipes },
  ]

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-[28px] border border-zinc-200 h-[180px] md:h-[280px]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HTML overlay — pointer-events: none so mouse parallax still works */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between px-7 pb-6 md:px-8 md:pb-8">
        {/* Left: title + subtitle */}
        <div>
          <p className="text-[28px] font-[500] leading-tight tracking-tight text-zinc-950">
            Costing
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Supplier purchases, ingredient price memory, and recipe margin control.
          </p>
        </div>

        {/* Right: KPI values */}
        <div className="hidden items-end gap-7 sm:flex">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                {kpi.label}
              </p>
              <p className="mt-1 text-[20px] font-semibold leading-tight tracking-tight text-zinc-950">
                {loading ? "—" : kpi.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
