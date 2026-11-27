'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from './fly-to-cart';

const DURATION_MS = 2_600;
const COLORS = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac', '#ffa94d', '#ffffff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Spec 046, R7 : feux d'artifice au déblocage d'un cadeau, joués une fois, avec une vibration.
 * Canvas plein écran, sans bibliothèque ; si l'appareil réduit les animations, une image fixe les remplace.
 */
export function Fireworks({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    haptic([20, 60, 20, 60, 40]);
    if (reduced) {
      const timer = window.setTimeout(() => done.current(), 1_400);
      return () => window.clearTimeout(timer);
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      done.current();
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const burst = (x: number, y: number) => {
      const count = 46;
      const hue = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
        const speed = 2.2 + Math.random() * 3.4;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: Math.random() < 0.7 ? hue : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 1.6 + Math.random() * 2,
        });
      }
    };
    const width = () => window.innerWidth;
    const height = () => window.innerHeight;
    const launches = [0, 260, 520, 900, 1_250].map((delay) =>
      window.setTimeout(() => burst(width() * (0.2 + Math.random() * 0.6), height() * (0.18 + Math.random() * 0.3)), delay),
    );

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      context.clearRect(0, 0, width(), height());
      for (const particle of particles) {
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 + 0.06;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.012;
        if (particle.life <= 0) continue;
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (now - started < DURATION_MS) frame = window.requestAnimationFrame(tick);
      else done.current();
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      launches.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  if (reduced) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center" aria-hidden>
        <svg viewBox="0 0 120 120" className="size-56">
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index / 12) * Math.PI * 2;
            return (
              <line
                key={index}
                x1={60 + Math.cos(angle) * 18}
                y1={60 + Math.sin(angle) * 18}
                x2={60 + Math.cos(angle) * 50}
                y2={60 + Math.sin(angle) * 50}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>
    );
  }
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60] size-full" aria-hidden />;
}
