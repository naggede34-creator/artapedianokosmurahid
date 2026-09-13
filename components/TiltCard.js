"use client";

import { useRef } from "react";

// Bungkus elemen apa pun supaya miring mengikuti posisi kursor (efek kartu 3D).
// Murni CSS transform + mousemove, tanpa library tambahan.
export default function TiltCard({ children, className = "", strength = 10, glare = true, style }) {
  const ref = useRef(null);
  const glareRef = useRef(null);

  function onMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * strength * 2;
    const rotateX = (0.5 - y) * strength * 2;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
    if (glare && glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.35), transparent 55%)`;
    }
  }

  function onMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateZ(0)";
    if (glare && glareRef.current) {
      glareRef.current.style.background = "transparent";
    }
  }

  return (
    <div className={`perspective-1000 ${className}`} style={style} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <div ref={ref} className="tilt-inner relative h-full w-full">
        {children}
        {glare && (
          <div
            ref={glareRef}
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-[background] duration-150"
          />
        )}
      </div>
    </div>
  );
}
