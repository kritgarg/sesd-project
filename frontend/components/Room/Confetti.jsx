"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#f43f5e", "#8b5cf6", "#3b82f6", "#22c55e",
  "#eab308", "#f97316", "#ec4899", "#06b6d4",
];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

/**
 * Confetti burst — renders self-contained animated particles.
 * Automatically unmounts after the animation completes.
 */
export default function Confetti({ trigger }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!trigger) return;

    const count = 60;
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: randomBetween(0, 0.4),
      drift: randomBetween(-120, 120),
      duration: randomBetween(1.5, 3),
      size: randomBetween(5, 10),
      rotation: randomBetween(0, 360),
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 3500);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: "1px",
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
