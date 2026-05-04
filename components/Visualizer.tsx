'use client';

import React, { useEffect, useRef, useMemo } from 'react';

interface VisualizerProps {
  mode: 'classic' | 'mystic' | 'warrior';
  isPlaying: boolean;
}

const palettes = {
  classic: { primary: '#D4AF37', secondary: '#1A1A1C', glow: 'rgba(212, 175, 55, 0.2)' },
  mystic: { primary: '#C0C0C0', secondary: '#0D0D0F', glow: 'rgba(192, 192, 192, 0.2)' },
  warrior: { primary: '#B22222', secondary: '#1A0505', glow: 'rgba(178, 34, 34, 0.2)' }
};

export default function Visualizer({ mode, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const animateRef = useRef<() => void>(() => {});
  const barsRef = useRef<number[]>(new Array(13).fill(20));

  const activePalette = palettes[mode];

  useEffect(() => {
    animateRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 6;
      const gap = 12;
      const totalWidth = barsRef.current.length * (barWidth + gap) - gap;
      const startX = (canvas.width - totalWidth) / 2;
      const centerY = canvas.height / 2;

      barsRef.current.forEach((h, i) => {
        const targetH = isPlaying 
          ? 20 + Math.random() * 80 + Math.sin(Date.now() / 200 + i) * 30
          : 5 + Math.sin(Date.now() / 1000 + i) * 5;
        
        barsRef.current[i] += (targetH - h) * 0.2;
        const currentH = barsRef.current[i];

        const gradient = ctx.createLinearGradient(0, centerY - currentH / 2, 0, centerY + currentH / 2);
        if (i % 3 === 0) {
          gradient.addColorStop(0, activePalette.primary);
          gradient.addColorStop(1, '#FFD700');
        } else {
          gradient.addColorStop(0, activePalette.secondary);
          gradient.addColorStop(1, activePalette.primary);
        }

        ctx.fillStyle = gradient;
        
        if (isPlaying) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = activePalette.primary;
        } else {
          ctx.shadowBlur = 0;
        }

        const x = startX + i * (barWidth + gap);
        const y = centerY - currentH / 2;
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, currentH, [3]);
        ctx.fill();
      });

      requestRef.current = requestAnimationFrame(animateRef.current);
    };
  }, [activePalette, isPlaying]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(() => animateRef.current());
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={300} 
      className="w-full h-full object-contain mix-blend-screen"
      style={{ filter: 'drop-shadow(0 0 10px rgba(255, 78, 0, 0.2))' }}
    />
  );
}
