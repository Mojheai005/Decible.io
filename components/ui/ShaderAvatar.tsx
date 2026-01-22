import React, { useRef, useEffect } from 'react';

export type ShaderType = 'pearl' | 'midnight' | 'sunset' | 'emerald' | 'royal' | 'fluid' | 'chrome' | 'orb' | 'waves' | 'neon';

interface ShaderAvatarProps {
  type: ShaderType;
  className?: string;
}

export const ShaderAvatar: React.FC<ShaderAvatarProps> = ({ type, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(Math.random() * 1000);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const size = 160; // Internal resolution
    canvas.width = size;
    canvas.height = size;

    // Premium Marble Configuration
    // Each type defines a core palette and 'material' properties
    const config: Record<ShaderType, {
        bg: string[],
        vein: string,
        rim: string,
        glow: string
    }> = {
        pearl: {
            bg: ['#F9FAFB', '#E5E7EB'], // White/Grey
            vein: 'rgba(209, 213, 219, 0.5)',
            rim: 'rgba(255, 255, 255, 0.9)',
            glow: 'rgba(255, 255, 255, 0.8)'
        },
        midnight: {
            bg: ['#0f172a', '#1e293b'], // Dark Slate
            vein: 'rgba(56, 189, 248, 0.3)', // Light Blue
            rim: 'rgba(56, 189, 248, 0.6)',
            glow: 'rgba(14, 165, 233, 0.2)'
        },
        sunset: {
            bg: ['#fff7ed', '#ffedd5'], // Orange-ish white
            vein: 'rgba(251, 146, 60, 0.4)', // Orange
            rim: 'rgba(255, 255, 255, 0.8)',
            glow: 'rgba(253, 186, 116, 0.3)'
        },
        emerald: {
            bg: ['#f0fdf4', '#dcfce7'], // Light Green
            vein: 'rgba(74, 222, 128, 0.4)',
            rim: 'rgba(255, 255, 255, 0.8)',
            glow: 'rgba(134, 239, 172, 0.3)'
        },
        royal: {
            bg: ['#faf5ff', '#f3e8ff'], // Light Purple
            vein: 'rgba(168, 85, 247, 0.3)',
            rim: 'rgba(255, 255, 255, 0.8)',
            glow: 'rgba(216, 180, 254, 0.3)'
        },
        fluid: {
            bg: ['#eff6ff', '#dbeafe'], // Blue
            vein: 'rgba(96, 165, 250, 0.4)',
            rim: 'rgba(255, 255, 255, 0.9)',
            glow: 'rgba(147, 197, 253, 0.3)'
        },
        chrome: {
            bg: ['#f8fafc', '#e2e8f0'], // Metallic
            vein: 'rgba(148, 163, 184, 0.5)',
            rim: 'rgba(255, 255, 255, 1)',
            glow: 'rgba(255, 255, 255, 0.5)'
        },
        orb: {
            bg: ['#fff1f2', '#ffe4e6'], // Pink
            vein: 'rgba(251, 113, 133, 0.3)',
            rim: 'rgba(255, 255, 255, 0.9)',
            glow: 'rgba(253, 164, 175, 0.3)'
        },
        waves: {
            bg: ['#ecfeff', '#cffafe'], // Cyan
            vein: 'rgba(34, 211, 238, 0.4)',
            rim: 'rgba(255, 255, 255, 0.9)',
            glow: 'rgba(103, 232, 249, 0.3)'
        },
        neon: {
            bg: ['#18181b', '#27272a'], // Black
            vein: 'rgba(163, 230, 53, 0.4)', // Lime
            rim: 'rgba(190, 242, 100, 0.8)',
            glow: 'rgba(132, 204, 22, 0.2)'
        }
    };

    const style = config[type] || config.pearl;

    const render = () => {
      timeRef.current += 0.005; // Very slow rotation
      const t = timeRef.current;

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2;

      // 1. Base Gradient (Sphere Body)
      const bgGrad = ctx.createRadialGradient(cx - size*0.2, cy - size*0.2, 0, cx, cy, r);
      bgGrad.addColorStop(0, style.bg[0]);
      bgGrad.addColorStop(1, style.bg[1]);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 2. Internal "Veins" / Noise (Simulated 3D rotation)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // We simulate a rotating texture by drawing curved paths that shift
      ctx.strokeStyle = style.vein;
      ctx.lineWidth = size * 0.4;
      ctx.lineCap = 'round';
      ctx.filter = 'blur(20px)'; // Heavy blur for soft internal look

      for(let i=0; i<3; i++) {
        ctx.beginPath();
        // Parametric movement
        const offsetX = Math.sin(t + i) * size * 0.3;
        const offsetY = Math.cos(t * 0.8 + i) * size * 0.3;

        ctx.moveTo(cx - size + offsetX, cy + offsetY);
        ctx.bezierCurveTo(
            cx - size*0.5 + offsetX, cy - size*0.5 + offsetY,
            cx + size*0.5 + offsetX, cy + size*0.5 + offsetY,
            cx + size + offsetX, cy - offsetY
        );
        ctx.stroke();
      }
      ctx.restore();

      // 3. Inner Glow (Sub-surface scattering approximation)
      const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
      glowGrad.addColorStop(0, 'transparent');
      glowGrad.addColorStop(1, style.glow); // Edge darker/colored

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 4. Rim Light (Fresnel effect - top left)
      const rimGrad = ctx.createLinearGradient(0, 0, size, size);
      rimGrad.addColorStop(0, style.rim);
      rimGrad.addColorStop(0.3, 'transparent');
      rimGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 5. Specular Highlight (The glossy reflection)
      ctx.save();
      ctx.translate(cx, cy);
      // Slight movement of reflection based on time to simulate subtle wobble
      ctx.translate(-size*0.2 + Math.sin(t)*2, -size*0.2 + Math.cos(t)*2);
      ctx.rotate(-Math.PI / 4);

      const highlightGrad = ctx.createLinearGradient(0, 0, 0, size*0.3);
      highlightGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
      highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, size*0.15, size*0.08, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [type]);

  return (
    <canvas
        ref={canvasRef}
        className={`w-full h-full rounded-full bg-gray-100 ${className}`}
    />
  );
};
