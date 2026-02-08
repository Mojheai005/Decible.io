import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Volume1, Download, ChevronDown, X, Share2 } from 'lucide-react';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { ShaderAvatar } from './ui/ShaderAvatar';
import { MiniWaveform } from './ui/AudioWaveform';
import { ShareSheet } from './ui/ShareSheet';
import { motion, AnimatePresence } from 'framer-motion';

// Map voice name to shader type
const getShaderType = (name: string, category: string): 'neon' | 'fluid' | 'chrome' | 'orb' | 'waves' | 'midnight' => {
    const shaders: ('neon' | 'fluid' | 'chrome' | 'orb' | 'waves' | 'midnight')[] = ['neon', 'fluid', 'chrome', 'orb', 'waves', 'midnight'];
    const hash = (name + (category || '')).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return shaders[hash % shaders.length];
};

interface GlobalPlayerProps {
    isMobile?: boolean;
}

export const GlobalPlayer: React.FC<GlobalPlayerProps> = ({ isMobile = false }) => {
    const {
        currentVoice,
        isPlaying,
        togglePlay,
        clearVoice,
        duration,
        currentTime,
        seek,
        isMuted,
        toggleMute,
        volume,
        setVolume
    } = useGlobalAudio();

    const [isHoveringProgress, setIsHoveringProgress] = useState(false);
    const [isHoveringVolume, setIsHoveringVolume] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const volumeRef = useRef<HTMLDivElement>(null);

    if (!currentVoice) return null;

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !duration) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(percent * duration);
    };

    const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !progressRef.current || !duration) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(percent * duration);
    };

    const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!volumeRef.current) return;
        const rect = volumeRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setVolume(percent);
    };

    const handleDownload = async () => {
        if (!currentVoice.previewUrl) return;

        try {
            const response = await fetch(currentVoice.previewUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentVoice.name.replace(/\s+/g, '-').toLowerCase()}-preview.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            window.open(currentVoice.previewUrl, '_blank');
        }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = (volume || 1) * 100;

    const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    // Mobile Layout - compact with waveform and share
    if (isMobile) {
        return (
            <>
                <AnimatePresence>
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-[76px] left-0 right-0 bg-white/98 backdrop-blur-xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-40 px-4 pt-3 pb-4"
                    >
                        {/* Progress bar at top - full width, larger touch target */}
                        <div
                            ref={progressRef}
                            className="w-full h-8 flex items-center cursor-pointer mb-3 -mt-1"
                            onTouchStart={() => setIsDragging(true)}
                            onTouchEnd={() => setIsDragging(false)}
                            onTouchMove={(e) => {
                                if (!progressRef.current || !duration) return;
                                const rect = progressRef.current.getBoundingClientRect();
                                const touch = e.touches[0];
                                const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                                seek(percent * duration);
                            }}
                            onClick={handleProgressClick}
                        >
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative">
                                <motion.div
                                    className="h-full bg-gray-900 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                                {/* Thumb - always visible on mobile for touch */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-900 rounded-full shadow-lg border-2 border-white"
                                    style={{ left: `calc(${progressPercent}% - 10px)` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Voice Info - compact with waveform */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-gray-100 shadow-sm">
                                        <ShaderAvatar type={getShaderType(currentVoice.name, currentVoice.category || '')} />
                                    </div>
                                    {isPlaying && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-hidden flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900 truncate text-sm">{currentVoice.name}</h4>
                                        {isPlaying && (
                                            <MiniWaveform isPlaying={isPlaying} className="text-green-500" />
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="font-medium">{formatTime(currentTime)}</span>
                                        <span className="text-gray-300">/</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Controls - larger touch targets (48px) */}
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={togglePlay}
                                    className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-transform shadow-lg"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-5 h-5 fill-current" />
                                    ) : (
                                        <Play className="w-5 h-5 fill-current ml-0.5" />
                                    )}
                                </button>

                                <button
                                    onClick={() => setShowShareSheet(true)}
                                    className="w-11 h-11 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-xl transition-all"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>

                                <button
                                    onClick={clearVoice}
                                    className="w-11 h-11 flex items-center justify-center text-gray-400 active:bg-red-50 active:text-red-600 rounded-xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Share Sheet */}
                <ShareSheet
                    isOpen={showShareSheet}
                    onClose={() => setShowShareSheet(false)}
                    audioUrl={currentVoice.previewUrl}
                    title="Share Voice"
                    onDownload={handleDownload}
                    onCopyLink={() => {
                        if (currentVoice.previewUrl) {
                            navigator.clipboard.writeText(currentVoice.previewUrl);
                        }
                    }}
                />
            </>
        );
    }

    // Desktop Layout - original
    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-full bg-white/95 backdrop-blur-xl border-t border-gray-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-40 px-6 py-3 shrink-0"
            >
                <div className="max-w-[1800px] mx-auto flex items-center gap-6">
                    {/* 1. Left: Voice Info */}
                    <div className="flex items-center gap-4 w-[280px] min-w-[200px]">
                        <div className="relative group">
                            <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-gray-100 shadow-md group-hover:ring-gray-200 transition-all">
                                <ShaderAvatar type={getShaderType(currentVoice.name, currentVoice.category || '')} />
                            </div>
                            {isPlaying && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <h4 className="font-bold text-gray-900 truncate text-sm leading-tight">{currentVoice.name}</h4>
                            <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                                <span className="text-sm">{currentVoice.language === 'English' ? '🇺🇸' : '🌍'}</span>
                                <span className="font-medium">{currentVoice.category || 'Voice Preview'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Center: Controls & Progress */}
                    <div className="flex-1 flex flex-col items-center max-w-3xl">
                        {/* Controls */}
                        <div className="flex items-center gap-4 mb-2">
                            <button
                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                                title="Replay 10s"
                                onClick={() => seek(Math.max(0, currentTime - 10))}
                            >
                                <div className="relative">
                                    <RotateCcw className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2} />
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 group-hover:text-gray-700">10</span>
                                </div>
                            </button>

                            <button
                                onClick={togglePlay}
                                className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-900/20"
                            >
                                {isPlaying ? (
                                    <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                    <Play className="w-5 h-5 fill-current ml-0.5" />
                                )}
                            </button>

                            <button
                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                                title="Forward 10s"
                                onClick={() => seek(Math.min(duration, currentTime + 10))}
                            >
                                <div className="relative">
                                    <RotateCw className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2} />
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 group-hover:text-gray-700">10</span>
                                </div>
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-gray-500 w-10 text-right tabular-nums">
                                {formatTime(currentTime)}
                            </span>

                            <div
                                ref={progressRef}
                                className="flex-1 h-6 flex items-center cursor-pointer group"
                                onMouseEnter={() => setIsHoveringProgress(true)}
                                onMouseLeave={() => { setIsHoveringProgress(false); setIsDragging(false); }}
                                onMouseDown={() => setIsDragging(true)}
                                onMouseUp={() => setIsDragging(false)}
                                onMouseMove={handleProgressDrag}
                                onClick={handleProgressClick}
                            >
                                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden relative group-hover:h-2 transition-all">
                                    {/* Progress fill */}
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-gray-800 to-gray-900 rounded-full relative"
                                        style={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.1 }}
                                    >
                                        {/* Glow effect */}
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-full bg-gradient-to-l from-gray-700/50 to-transparent" />
                                    </motion.div>

                                    {/* Thumb */}
                                    <motion.div
                                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-900 rounded-full shadow-lg border-2 border-white transition-opacity ${isHoveringProgress || isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                                        style={{ left: `calc(${progressPercent}% - 8px)` }}
                                    />
                                </div>
                            </div>

                            <span className="text-[11px] font-semibold text-gray-400 w-10 tabular-nums">
                                {formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* 3. Right: Volume & Actions */}
                    <div className="flex items-center gap-2 w-[280px] justify-end">
                        {/* Volume Control */}
                        <div
                            className="flex items-center gap-2 group"
                            onMouseEnter={() => setIsHoveringVolume(true)}
                            onMouseLeave={() => setIsHoveringVolume(false)}
                        >
                            <button
                                onClick={toggleMute}
                                className={`p-2 rounded-lg transition-all ${isMuted ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                <VolumeIcon className="w-5 h-5" />
                            </button>

                            <div
                                ref={volumeRef}
                                className={`w-20 h-6 flex items-center cursor-pointer transition-all ${isHoveringVolume ? 'opacity-100' : 'opacity-60'}`}
                                onClick={handleVolumeClick}
                            >
                                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden hover:h-1.5 transition-all">
                                    <div
                                        className="h-full bg-gray-400 hover:bg-gray-600 rounded-full transition-colors"
                                        style={{ width: `${isMuted ? 0 : volumePercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        <button
                            onClick={handleDownload}
                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                            title="Download preview"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <button
                            onClick={clearVoice}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Close player"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
