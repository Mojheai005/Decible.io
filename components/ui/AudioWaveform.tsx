import React, { useRef, useEffect, useState } from 'react';

interface AudioWaveformProps {
  isPlaying: boolean;
  progress: number; // 0-100
  audioUrl?: string;
  height?: number;
  barCount?: number;
  className?: string;
  activeColor?: string;
  inactiveColor?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isPlaying,
  progress,
  height = 32,
  barCount = 40,
  className = '',
  activeColor = '#111827',
  inactiveColor = '#E5E7EB',
}) => {
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number | null>(null);

  // Generate random bar heights on mount
  useEffect(() => {
    const newBars = Array.from({ length: barCount }, () =>
      0.3 + Math.random() * 0.7
    );
    setBars(newBars);
  }, [barCount]);

  // Animate bars when playing
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setBars(prev => prev.map((bar, i) => {
          const variation = Math.sin(Date.now() / 200 + i * 0.5) * 0.3;
          return Math.max(0.2, Math.min(1, bar + variation * 0.1));
        }));
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  const progressIndex = Math.floor((progress / 100) * barCount);

  return (
    <div
      className={`flex items-center justify-center gap-[2px] ${className}`}
      style={{ height }}
    >
      {bars.map((barHeight, index) => {
        const isActive = index <= progressIndex;
        const actualHeight = isPlaying
          ? barHeight * height
          : (isActive ? barHeight * height * 0.8 : barHeight * height * 0.4);

        return (
          <div
            key={index}
            className="rounded-full transition-all duration-150"
            style={{
              width: 3,
              height: actualHeight,
              backgroundColor: isActive ? activeColor : inactiveColor,
              opacity: isActive ? 1 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
};

// Mini waveform for compact displays
export const MiniWaveform: React.FC<{
  isPlaying: boolean;
  className?: string;
}> = ({ isPlaying, className = '' }) => {
  const [heights, setHeights] = useState([0.4, 0.7, 1, 0.7, 0.4]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => 0.3 + Math.random() * 0.7));
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className={`flex items-center gap-[2px] h-4 ${className}`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] bg-current rounded-full transition-all duration-150"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;
