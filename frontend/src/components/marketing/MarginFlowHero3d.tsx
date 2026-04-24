"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, Line, PerspectiveCamera, Sparkles } from "@react-three/drei";
import * as THREE from "three";

type Point3 = [number, number, number];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);

    onChange();
    media.addEventListener?.("change", onChange);

    return () => {
      media.removeEventListener?.("change", onChange);
    };
  }, []);

  return reduced;
}

function GlassCard({
  position,
  title,
  value,
  subtitle,
  accentClass,
  reducedMotion,
}: {
  position: Point3;
  title: string;
  value: string;
  subtitle: string;
  accentClass: string;
  reducedMotion: boolean;
}) {
  return (
    <Float
      position={position}
      speed={reducedMotion ? 0 : 1.2}
      rotationIntensity={reducedMotion ? 0 : 0.08}
      floatIntensity={reducedMotion ? 0 : 0.28}
    >
      <mesh>
        <planeGeometry args={[2.45, 1.45]} />
        <meshBasicMaterial transparent opacity={0} />
        <Html transform center distanceFactor={1.2}>
          <div className="w-[240px] rounded-[28px] border border-white/12 bg-white/[0.06] p-4 text-white shadow-[0_10px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.28em] text-white/55">
                {title}
              </span>
              <span className={`h-2.5 w-2.5 rounded-full ${accentClass}`} />
            </div>

            <div className="text-3xl font-semibold tracking-[-0.04em]">{value}</div>

            <div className="mt-2 text-sm text-white/60">{subtitle}</div>

            <div className="mt-5 h-px w-full bg-white/10" />

            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full bg-cyan-400/60" />
              <div className="h-1.5 w-10 rounded-full bg-blue-400/40" />
              <div className="h-1.5 w-6 rounded-full bg-white/15" />
            </div>
          </div>
        </Html>
      </mesh>
    </Float>
  );
}

function FinanceLines({ reducedMotion }: { reducedMotion: boolean }) {
  const paths = useMemo(
    () => [
      {
        points: [
          [-1.65, 0.95, 0],
          [-0.8, 0.7, 0],
          [0.1, 0.95, 0],
        ] as Point3[],
        color: "#60a5fa",
      },
      {
        points: [
          [0.15, 0.95, 0],
          [0.9, 0.55, 0],
          [1.45, -0.05, 0],
        ] as Point3[],
        color: "#22d3ee",
      },
      {
        points: [
          [-1.2, -0.35, 0],
          [-0.25, -0.1, 0],
          [1.2, -0.7, 0],
        ] as Point3[],
        color: "#93c5fd",
      },
    ],
    []
  );

  return (
    <group>
      {paths.map((path, index) => (
        <Line
          key={index}
          points={path.points}
          color={path.color}
          lineWidth={1.2}
          transparent
          opacity={reducedMotion ? 0.45 : 0.7}
        />
      ))}
    </group>
  );
}

function FinanceCore({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      target.current.x = x * 0.12;
      target.current.y = y * 0.08;
    };

    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return;

    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      target.current.x,
      4,
      delta
    );

    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      -target.current.y,
      4,
      delta
    );

    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      Math.sin(state.clock.elapsedTime * 0.7) * 0.08,
      3,
      delta
    );
  });

  return (
    <group ref={groupRef}>
      <FinanceLines reducedMotion={reducedMotion} />

      <GlassCard
        position={[-1.65, 0.95, 0]}
        title="Revenue"
        value="€148.2k"
        subtitle="+12.4% vs last month"
        accentClass="bg-cyan-400"
        reducedMotion={reducedMotion}
      />

      <GlassCard
        position={[0.15, 0.95, 0]}
        title="Margin"
        value="24.8%"
        subtitle="Live operational margin"
        accentClass="bg-blue-400"
        reducedMotion={reducedMotion}
      />

      <GlassCard
        position={[-1.15, -0.35, 0]}
        title="Cost Trend"
        value="-3.1%"
        subtitle="Lower cost pressure this week"
        accentClass="bg-emerald-400"
        reducedMotion={reducedMotion}
      />

      <GlassCard
        position={[1.45, -0.05, 0]}
        title="Forecast"
        value="€31.9k"
        subtitle="Projected weekly profit"
        accentClass="bg-sky-400"
        reducedMotion={reducedMotion}
      />

      <Sparkles
        count={reducedMotion ? 18 : 34}
        scale={[7.5, 4.5, 2]}
        size={2}
        speed={0.25}
        color="#7dd3fc"
      />
    </group>
  );
}

export default function MarginFlowHero3D() {
  const reducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.18),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.96))] shadow-[0_20px_100px_rgba(0,0,0,0.35)] lg:h-[540px]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_35%,rgba(255,255,255,0.02)_65%,transparent)]" />
      <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute bottom-6 right-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <Canvas dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 0, isMobile ? 6.8 : 5.8]} fov={40} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[4, 4, 4]} intensity={1.5} color="#dbeafe" />
          <pointLight position={[-3, 2, 2]} intensity={1.2} color="#67e8f9" />
          <pointLight position={[3, -1, 3]} intensity={1} color="#60a5fa" />
          <FinanceCore reducedMotion={reducedMotion || isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}