"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/* ── Priority contacts (demo) ── */
const PRIORITY = [
  { name: "Juan Ramirez", tag: "Sales Call", tagColor: "bg-rose-300 text-rose-900", detail: "12pm – Construction" },
  { name: "John Smith", tag: "Inquiry", tagColor: "bg-amber-300 text-amber-900", detail: "4/15 – 7:00pm" },
  { name: "Mary Crab", tag: "Follow up", tagColor: "bg-emerald-400 text-emerald-900", detail: "4/14 – Last Communication" },
];

/* ── Liquid Orb ── */
function LiquidOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false });
  const rafRef = useRef<number>(0);
  const smoothRef = useRef({ x: 0, y: 0 });

  const handleMove = useCallback((e: MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    setMouse({ x: dx, y: dy, active: dist < 2.5 });
  }, []);

  const handleLeave = useCallback(() => {
    setMouse({ x: 0, y: 0, active: false });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMove, handleLeave]);

  useEffect(() => {
    function tick() {
      smoothRef.current.x += (mouse.x - smoothRef.current.x) * 0.08;
      smoothRef.current.y += (mouse.y - smoothRef.current.y) * 0.08;
      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--mx", String(smoothRef.current.x));
        el.style.setProperty("--my", String(smoothRef.current.y));
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mouse]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto cursor-pointer"
      style={{ width: 220, height: 220, perspective: 600 }}
    >
      {/* Ambient glow */}
      <div
        className="absolute rounded-full transition-opacity duration-700"
        style={{
          inset: "-30%",
          filter: "blur(60px)",
          opacity: mouse.active ? 0.6 : 0.35,
          background: "radial-gradient(circle, rgba(168,130,255,0.6) 0%, rgba(120,200,255,0.3) 40%, transparent 70%)",
        }}
      />
      {/* Orb body */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          transform: `rotateY(calc(var(--mx,0) * 14deg)) rotateX(calc(var(--my,0) * -14deg)) scale(${mouse.active ? 1.06 : 1})`,
          transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
          animation: "orbFloat 6s ease-in-out infinite",
        }}
      >
        {/* Spinning gradient base */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, #c084fc, #818cf8, #67e8f9, #a78bfa, #f0abfc, #c084fc)",
            filter: "blur(18px)",
            animation: "orbSpin 8s linear infinite",
          }}
        />
        {/* Counter-rotating inner */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "8%",
            background: "conic-gradient(from 180deg, #e879f9, #6366f1, #22d3ee, #a855f7, #e879f9)",
            filter: "blur(14px)",
            opacity: 0.8,
            animation: "orbSpin 12s linear infinite reverse",
          }}
        />
        {/* Specular highlight that follows mouse */}
        <div
          className="absolute rounded-full"
          style={{
            width: "55%",
            height: "35%",
            top: "10%",
            left: "18%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, transparent 70%)",
            filter: "blur(8px)",
            transform: "translate(calc(var(--mx,0) * 12px), calc(var(--my,0) * 6px))",
            transition: "transform 0.3s ease-out",
          }}
        />
        {/* Glass refraction */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.3) 0%, transparent 50%)" }}
        />
        {/* Pulsing inner glow */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "15%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 60%)",
            animation: "orbPulse 3s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

export function TodayFeed() {
  return (
    <div className="flex flex-col items-center justify-center gap-10" style={{ minHeight: "calc(100vh - 80px)" }}>
      {/* Animated Orb */}
      <LiquidOrb />

      {/* Search / Ask input */}
      <div style={{ width: "100%", maxWidth: 600 }}>
        <input
          type="text"
          placeholder="How can we get started today?"
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50 transition-all"
          style={{ padding: "16px 24px", fontSize: 16 }}
        />
      </div>

      {/* Priority contacts */}
      <div style={{ width: "100%", maxWidth: 700 }}>
        <h2 className="text-[15px] font-medium text-[var(--color-text-secondary)]" style={{ marginBottom: 16 }}>Priority</h2>
        <div className="grid grid-cols-3 gap-4">
          {PRIORITY.map((c) => (
            <button
              key={c.name}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-all duration-200 hover:shadow-md hover:border-[var(--color-accent)]/20 cursor-pointer"
              style={{ padding: 20, transform: "translateY(0)" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{c.name}</p>
              <span className={`inline-block rounded-full text-[11px] font-semibold ${c.tagColor}`} style={{ padding: "2px 12px" }}>
                {c.tag}
              </span>
              <p className="text-[13px] text-[var(--color-text-tertiary)]">{c.detail}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}