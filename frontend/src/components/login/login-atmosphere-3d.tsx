"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Grid, Line, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"

type Point3 = [number, number, number]

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(media.matches)

    onChange()
    media.addEventListener?.("change", onChange)

    return () => media.removeEventListener?.("change", onChange)
  }, [])

  return reduced
}

function SoftPlane({
  position,
  rotation,
  scale,
  opacity,
  color,
  speed = 0.5,
}: {
  position: Point3
  rotation: Point3
  scale: [number, number, number]
  opacity: number
  color: string
  speed?: number
}) {
  return (
    <Float speed={speed} rotationIntensity={0.05} floatIntensity={0.12}>
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[scale[0], scale[1]]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.28}
          metalness={0.04}
          transmission={0.26}
          thickness={0.45}
          ior={1.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  )
}

function SoftOrb({
  position,
  size,
  color,
  opacity,
}: {
  position: Point3
  size: number
  color: string
  opacity: number
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.55}
        transparent
        opacity={opacity}
        roughness={0.24}
        metalness={0.05}
      />
    </mesh>
  )
}

function FinancialCurve() {
  const points = useMemo<Point3[]>(
    () => [
      [-3.25, -0.28, 0],
      [-2.55, -0.08, 0],
      [-1.85, 0.06, 0],
      [-1.1, 0.26, 0],
      [-0.4, 0.18, 0],
      [0.35, 0.42, 0],
      [1.2, 0.28, 0],
      [2.05, 0.58, 0],
      [2.85, 0.42, 0],
    ],
    []
  )

  return (
    <Line
      points={points}
      color="#7dd3fc"
      lineWidth={0.95}
      transparent
      opacity={0.22}
    />
  )
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const target = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === "undefined" || reducedMotion) return

    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      target.current.x = x * 0.08
      target.current.y = y * 0.05
    }

    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [reducedMotion])

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return

    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      target.current.x,
      4,
      delta
    )
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      -target.current.y,
      4,
      delta
    )
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      Math.sin(state.clock.elapsedTime * 0.42) * 0.06,
      2.2,
      delta
    )
  })

  return (
    <group ref={groupRef}>
      <Grid
        position={[0, -1.84, -0.62]}
        rotation={[0, 0.1, 0]}
        cellSize={1}
        sectionSize={4.4}
        cellThickness={0.28}
        sectionThickness={0.72}
        cellColor="#11284a"
        sectionColor="#4da3ff"
        fadeDistance={7}
        fadeStrength={7}
        infiniteGrid={false}
      />

      <mesh position={[0, -1.92, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.14} />
      </mesh>

      <SoftPlane position={[-2.7, 1.02, -0.3]} rotation={[0.03, -0.16, -0.01]} scale={[2.9, 1.25, 0.05]} opacity={0.08} color="#0f172a" speed={0.42} />
      <SoftPlane position={[-0.4, 0.32, 0.1]} rotation={[-0.03, 0.1, 0.01]} scale={[3.4, 1.8, 0.05]} opacity={0.075} color="#111827" speed={0.36} />
      <SoftPlane position={[2.15, -0.56, -0.04]} rotation={[0.04, -0.18, 0.02]} scale={[1.85, 1.05, 0.05]} opacity={0.09} color="#0f172a" speed={0.46} />
      <SoftPlane position={[0.55, -0.18, -0.18]} rotation={[0.02, 0.34, 0.01]} scale={[2.35, 0.78, 0.05]} opacity={0.06} color="#0c1424" speed={0.34} />

      <SoftOrb position={[1.55, 0.02, 0.42]} size={0.72} color="#38bdf8" opacity={0.12} />
      <SoftOrb position={[-2.05, 0.58, 0.1]} size={0.38} color="#60a5fa" opacity={0.09} />
      <SoftOrb position={[0.2, -0.9, 0.25]} size={0.55} color="#2563eb" opacity={0.06} />

      <FinancialCurve />
    </group>
  )
}

export default function LoginAtmosphere3D() {
  const reducedMotion = useReducedMotion()
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const animated = !(reducedMotion || isSmallScreen)

  useEffect(() => {
    if (typeof window === "undefined") return

    const check = () => setIsSmallScreen(window.innerWidth < 1280)
    check()
    window.addEventListener("resize", check)

    return () => window.removeEventListener("resize", check)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_50%_102%,rgba(255,255,255,0.03),transparent_32%),linear-gradient(135deg,rgba(2,6,23,0.66),rgba(2,6,23,0.94))]" />
      <div className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.016),transparent_22%,rgba(255,255,255,0.01))] ${animated ? "login-haze-animate" : ""}`} />
      <div className="absolute inset-0 opacity-[0.014] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_42%,rgba(2,6,23,0.28)_100%)]" />

      <div
        className={`absolute left-[4%] top-[16%] h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl ${animated ? "login-orb-animate" : ""}`}
        style={
          animated
            ? {
                transform:
                  "translate3d(calc(var(--login-orb-x, 0px) * 0.32), calc(var(--login-orb-y, 0px) * 0.26), 0)",
              }
            : undefined
        }
      />
      <div
        className={`absolute right-[8%] top-[12%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl ${animated ? "login-orb-animate-reverse" : ""}`}
        style={
          animated
            ? {
                transform:
                  "translate3d(calc(var(--login-orb-x, 0px) * -0.22), calc(var(--login-orb-y, 0px) * 0.2), 0)",
              }
            : undefined
        }
      />
      <div
        className={`absolute bottom-[8%] left-[40%] h-80 w-80 rounded-full bg-sky-500/8 blur-3xl ${animated ? "login-orb-animate" : ""}`}
        style={
          animated
            ? {
                transform:
                  "translate3d(calc(var(--login-orb-x, 0px) * 0.16), calc(var(--login-orb-y, 0px) * -0.12), 0)",
              }
            : undefined
        }
      />
      <div
        className={`absolute left-[22%] top-[34%] h-44 w-[34rem] rotate-[-16deg] rounded-full bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.15),transparent)] blur-2xl ${animated ? "login-sweep-animate" : ""}`}
        style={
          animated
            ? {
                transform:
                  "translate3d(calc(var(--login-orb-x, 0px) * 0.18), calc(var(--login-orb-y, 0px) * 0.1), 0) rotate(-16deg)",
              }
            : undefined
        }
      />
      <div
        className={`absolute bottom-[15%] right-[18%] h-24 w-80 rotate-[10deg] rounded-full bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.1),transparent)] blur-2xl ${animated ? "login-sweep-animate" : ""}`}
        style={
          animated
            ? {
                transform:
                  "translate3d(calc(var(--login-orb-x, 0px) * -0.14), calc(var(--login-orb-y, 0px) * -0.1), 0) rotate(10deg)",
              }
            : undefined
        }
      />

      <div className="absolute inset-0 hidden xl:block">
        <Canvas
          dpr={[1, 1.35]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 6.7], fov: 38 }}
          frameloop={reducedMotion ? "demand" : "always"}
        >
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 6.7]} fov={38} />
            <ambientLight intensity={0.72} />
            <directionalLight position={[4.5, 5.2, 4.2]} intensity={0.92} color="#dbeafe" />
            <pointLight position={[-4.2, 1.2, 4]} intensity={0.52} color="#38bdf8" />
            <pointLight position={[2.5, -1.4, 3]} intensity={0.34} color="#60a5fa" />
            <Scene reducedMotion={reducedMotion || isSmallScreen} />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.58),rgba(2,6,23,0.2)_58%,transparent)]" />
    </div>
  )
}
