"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Line, PerspectiveCamera } from "@react-three/drei"
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

function GlassBar({
  position,
  size,
  color,
  opacity,
}: {
  position: Point3
  size: Point3
  color: string
  opacity: number
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.055]} scale={[1.1, 1.02, 1.08]}>
        <boxGeometry args={size} />
        <meshBasicMaterial
          color="#1d4ed8"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={[1.08, 1.04, 1.08]}>
        <boxGeometry args={size} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[size[0] * 0.16, 0, size[2] * 0.12]} scale={[0.12, 0.94, 1]}>
        <boxGeometry args={size} />
        <meshBasicMaterial
          color="#dbeafe"
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <boxGeometry args={size} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
          transparent
          opacity={opacity}
          roughness={0.12}
          metalness={0.08}
          transmission={0.5}
          thickness={1.1}
          clearcoat={0.35}
          reflectivity={0.18}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function GuideArc({
  radius,
  y,
  opacity,
}: {
  radius: number
  y: number
  opacity: number
}) {
  const points = useMemo<Point3[]>(() => {
    const out: Point3[] = []
    const segments = 64
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI * 0.85 + Math.PI * 0.08
      out.push([Math.cos(t) * radius, y, Math.sin(t) * radius * 0.42])
    }
    return out
  }, [radius, y])

  return <Line points={points} color="#4da3ff" lineWidth={1} transparent opacity={opacity} />
}

function OrbitRibbon({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  const ribbonRef = useRef<THREE.Group>(null)

  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-0.52, -0.18, 0.04),
      new THREE.Vector3(-0.08, 0.12, 0.06),
      new THREE.Vector3(0.44, 0.44, 0.02),
      new THREE.Vector3(0.98, 0.26, -0.06),
      new THREE.Vector3(1.5, -0.08, -0.04),
      new THREE.Vector3(2.0, -0.02, 0.03),
      new THREE.Vector3(2.42, 0.18, 0.06),
      new THREE.Vector3(2.84, 0.42, 0.02),
    ]
    return new THREE.CatmullRomCurve3(points)
  }, [])

  useFrame((state) => {
    if (!ribbonRef.current || reducedMotion) return

    const t = state.clock.elapsedTime
    ribbonRef.current.rotation.z = Math.sin(t * 0.22) * 0.07
    ribbonRef.current.rotation.y = Math.sin(t * 0.16) * 0.05
    ribbonRef.current.rotation.x = Math.sin(t * 0.12) * 0.03
    ribbonRef.current.position.x = 0.18 + Math.sin(t * 0.18) * 0.09
    ribbonRef.current.position.y = -0.04 + Math.cos(t * 0.16) * 0.04
    ribbonRef.current.position.z = 0.12 + Math.sin(t * 0.14) * 0.02
  })

  return (
    <group ref={ribbonRef}>
      <mesh>
        <tubeGeometry args={[curve, 144, 0.18, 20, false]} />
        <meshBasicMaterial
          color="#1d4ed8"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 144, 0.086, 20, false]} />
        <meshPhysicalMaterial
          color="#2563eb"
          emissive="#60a5fa"
          emissiveIntensity={1.28}
          transparent
          opacity={0.92}
          roughness={0.16}
          metalness={0.1}
          transmission={0.12}
          thickness={0.32}
          clearcoat={0.42}
          reflectivity={0.2}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 144, 0.022, 14, false]} />
        <meshBasicMaterial
          color="#dbeafe"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const sceneRef = useRef<THREE.Group>(null)
  const particles = useMemo<Point3[]>(
    () => [
      [-0.1, 1.52, 0.08],
      [0.72, 1.88, -0.02],
      [1.48, 1.34, 0.05],
      [2.28, 1.62, -0.01],
    ],
    []
  )

  useFrame((state) => {
    if (!sceneRef.current || reducedMotion) return

    const t = state.clock.elapsedTime
    sceneRef.current.rotation.y = Math.sin(t * 0.12) * 0.06
    sceneRef.current.rotation.x = Math.sin(t * 0.1) * 0.03
    sceneRef.current.position.x = Math.sin(t * 0.14) * 0.05
    sceneRef.current.position.y = Math.cos(t * 0.16) * 0.035
  })

  return (
    <group ref={sceneRef}>
      <GuideArc radius={1.9} y={0.94} opacity={0.14} />
      <GuideArc radius={2.28} y={0.5} opacity={0.1} />

      <group position={[-0.88, -0.06, -0.04]}>
        <GlassBar position={[0.0, -0.3, 0]} size={[0.34, 2.02, 0.34]} color="#1d4ed8" opacity={0.34} />
        <GlassBar position={[0.92, -0.02, 0.01]} size={[0.34, 2.82, 0.34]} color="#2563eb" opacity={0.39} />
        <GlassBar position={[1.88, 0.2, -0.01]} size={[0.34, 3.62, 0.34]} color="#3b82f6" opacity={0.42} />
        <GlassBar position={[2.82, 0.42, 0]} size={[0.34, 3.14, 0.34]} color="#60a5fa" opacity={0.38} />
      </group>

      <group position={[-0.08, -0.02, 0.2]}>
        <OrbitRibbon reducedMotion={reducedMotion} />
      </group>

      <group position={[-0.44, 0.44, 0.18]}>
        {particles.map((position, index) => (
          <mesh key={index} position={position}>
            <sphereGeometry args={[0.013 + (index % 2) * 0.003, 14, 14]} />
            <meshStandardMaterial
              color="#dbeafe"
              emissive="#7dd3fc"
              emissiveIntensity={0.92}
              transparent
              opacity={0.22}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function LoginAtmosphere3D() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(37,99,235,0.24),transparent_28%),radial-gradient(circle_at_70%_72%,rgba(59,130,246,0.14),transparent_18%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(8,17,31,0.98))]" />
      <div className="absolute inset-0 opacity-[0.015] [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-0 hidden xl:block">
        <Canvas
          dpr={[1, 1.35]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 6.6], fov: 38 }}
          frameloop={reducedMotion ? "demand" : "always"}
        >
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 6.6]} fov={38} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[4.5, 5.2, 4.2]} intensity={0.85} color="#dbeafe" />
            <pointLight position={[1.8, 1.4, 3.2]} intensity={0.7} color="#38bdf8" />
            <pointLight position={[4.2, -0.8, 2.4]} intensity={0.45} color="#2563eb" />
            <Scene reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.35),rgba(2,6,23,0.08)_58%,transparent)]" />
    </div>
  )
}
