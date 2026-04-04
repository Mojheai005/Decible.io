'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Upload, FileText, Play, Pause, Download, X, Loader2,
    ChevronRight, AlertCircle, CheckCircle2, Clock, Sparkles,
    Lock, ArrowRight, RotateCcw, Square, Volume2,
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useBatchGenerate, BatchStatus } from '@/hooks/useBatchGenerate';
import { useVoices } from '@/hooks/useVoices';
import { VoiceDropdown } from '@/components/ui/VoiceDropdown';
import { chunkText } from '@/lib/text-chunker';
import { CREDITS_CONFIG } from '@/lib/constants';
import { getTierPermissions } from '@/lib/pricing';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ScriptToVoiceProps {
    onNavigate?: (view: string) => void;
}

export const ScriptToVoice: React.FC<ScriptToVoiceProps> = ({ onNavigate }) => {
    const isMobile = useIsMobile();
    const { profile } = useUserProfile();
    const { voices: apiVoices } = useVoices();
    const { progress, generateBatch, getChunkPlan, cancel, resetProgress } = useBatchGenerate();

    // Script input
    const [scriptText, setScriptText] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Voice & settings
    const [currentVoice, setCurrentVoice] = useState<{
        id: string; name: string; category: string; tags: string[];
    } | null>(null);
    const [speed, setSpeed] = useState(1.0);
    const [stability, setStability] = useState(50);
    const [similarity, setSimilarity] = useState(75);

    // Audio player
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioProgress, setAudioProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Set first voice as default
    useEffect(() => {
        if (apiVoices && apiVoices.length > 0 && !currentVoice) {
            const first = apiVoices[0];
            setCurrentVoice({
                id: first.id,
                name: first.name,
                category: first.category || 'General',
                tags: first.tags || [],
            });
        }
    }, [apiVoices, currentVoice]);

    // Audio element setup
    useEffect(() => {
        const audio = new Audio();
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
            if (audio.duration) setAudioProgress((audio.currentTime / audio.duration) * 100);
        });
        audio.addEventListener('loadedmetadata', () => setAudioDuration(audio.duration));
        audio.addEventListener('ended', () => { setIsPlaying(false); setAudioProgress(0); });

        return () => { audio.pause(); audio.src = ''; };
    }, []);

    // Load audio when generation completes
    useEffect(() => {
        if (progress.finalAudioUrl && audioRef.current) {
            audioRef.current.src = progress.finalAudioUrl;
            audioRef.current.load();
        }
    }, [progress.finalAudioUrl]);

    // Paid-only gate
    const tier = profile?.plan || 'free';
    const permissions = getTierPermissions(tier);
    const isLocked = !permissions.canBulkGenerate;

    if (isLocked) {
        return (
            <div className={`h-full flex items-center justify-center bg-[#FAFAFA] ${isMobile ? 'p-6' : 'p-12'}`}>
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Script to Voice</h2>
                    <p className="text-gray-500 mb-6">
                        Convert entire scripts into professional voiceovers. Upload your script and get a single, ready-to-use audio file.
                    </p>
                    <button
                        onClick={() => onNavigate?.('subscription')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                    >
                        Upgrade to Creator Plan
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-gray-400 mt-3">Available on Creator, Pro, and Advanced plans</p>
                </div>
            </div>
        );
    }

    // Chunk preview
    const plan = scriptText.trim() ? getChunkPlan(scriptText) : null;
    const totalCredits = plan ? plan.totalCredits * CREDITS_CONFIG.COST_PER_CHARACTER : 0;
    const hasEnoughCredits = (profile?.remainingCredits || 0) >= totalCredits;
    const isGenerating = ['chunking', 'generating', 'stitching'].includes(progress.status);

    // File upload handler
    const handleFileUpload = async (file: File) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];

        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
            alert('Please upload a .docx, .pdf, or .txt file');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Maximum size is 10MB.');
            return;
        }

        // For .txt files, read directly
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const text = await file.text();
            setScriptText(text);
            setFileName(file.name);
            return;
        }

        // For .docx and .pdf, use server-side parsing
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/script-to-voice/parse', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to parse file');
                return;
            }

            const data = await res.json();
            setScriptText(data.text);
            setFileName(data.fileName || file.name);
        } catch {
            alert('Failed to parse file. Please try again.');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

    const handleGenerate = async () => {
        if (!scriptText.trim() || !currentVoice || isGenerating) return;

        await generateBatch(
            scriptText,
            currentVoice.id,
            currentVoice.name,
            {
                stability: stability / 100,
                similarity: similarity / 100,
                style: 0,
                speed,
                useSpeakerBoost: true,
            }
        );
    };

    const handlePlayPause = () => {
        if (!audioRef.current || !progress.finalAudioUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    };

    const handleDownload = async () => {
        if (!progress.finalAudioUrl) return;
        try {
            const res = await fetch(progress.finalAudioUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentVoice?.name || 'script'}-voiceover.mp3`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Download failed');
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (status: BatchStatus) => {
        switch (status) {
            case 'generating': return 'text-blue-600';
            case 'stitching': return 'text-purple-600';
            case 'complete': return 'text-green-600';
            case 'error': return 'text-red-600';
            case 'cancelled': return 'text-amber-600';
            default: return 'text-gray-500';
        }
    };

    const getStatusLabel = (status: BatchStatus) => {
        switch (status) {
            case 'chunking': return 'Preparing chunks...';
            case 'generating': return `Generating chunk ${progress.currentChunk + 1} of ${progress.totalChunks}`;
            case 'stitching': return 'Stitching audio...';
            case 'complete': return 'Voiceover ready!';
            case 'error': return 'Generation failed';
            case 'cancelled': return 'Cancelled';
            default: return '';
        }
    };

    return (
        <div className={`h-full bg-[#FAFAFA] ${isMobile ? 'overflow-y-auto' : 'flex flex-col'}`}>
            {/* Header */}
            <div className={`bg-white border-b border-gray-200 ${isMobile ? 'px-4 py-4' : 'px-6 py-4'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 text-lg">Script to Voice</h1>
                            <p className="text-xs text-gray-500">Convert full scripts into professional voiceovers</p>
                        </div>
                    </div>
                    {plan && !isGenerating && progress.status !== 'complete' && (
                        <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">{plan.chunks.length} chunks</div>
                            <div className={`text-xs ${hasEnoughCredits ? 'text-gray-500' : 'text-red-500'}`}>
                                {totalCredits.toLocaleString()} credits needed
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex-1 ${isMobile ? 'p-4 pb-32' : 'overflow-y-auto p-6'}`}>
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* File Upload Zone */}
                    {!isGenerating && progress.status !== 'complete' && (
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-gray-400 transition-colors bg-white"
                        >
                            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-700 font-medium">Drop your script here</p>
                            <p className="text-sm text-gray-500 mt-1">Supports .docx, .pdf, .txt (max 10MB)</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-4 px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                            >
                                Browse Files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".docx,.pdf,.txt"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                    e.target.value = '';
                                }}
                            />
                            {fileName && (
                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-700">{fileName}</span>
                                    <button onClick={() => { setFileName(null); setScriptText(''); }} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Text Editor */}
                    {!isGenerating && progress.status !== 'complete' && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-700">Script</span>
                                <span className="text-xs text-gray-400">
                                    {scriptText.length.toLocaleString()} chars / ~{scriptText.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words
                                </span>
                            </div>
                            <textarea
                                value={scriptText}
                                onChange={(e) => setScriptText(e.target.value)}
                                placeholder="Paste your full script here, or upload a file above..."
                                className="w-full p-4 text-sm text-gray-800 resize-none focus:outline-none min-h-[200px] max-h-[400px]"
                                rows={10}
                            />
                        </div>
                    )}

                    {/* Voice & Settings */}
                    {!isGenerating && progress.status !== 'complete' && scriptText.trim() && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                            <h3 className="font-semibold text-gray-900 text-sm">Voice & Settings</h3>

                            <VoiceDropdown
                                currentVoiceId={currentVoice?.id || ''}
                                currentVoice={currentVoice}
                                onSelect={setCurrentVoice}
                                onNavigateToLibrary={() => onNavigate?.('library')}
                            />

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Speed</label>
                                    <input
                                        type="range"
                                        min={70} max={120} value={speed * 100}
                                        onChange={(e) => setSpeed(Number(e.target.value) / 100)}
                                        className="w-full accent-gray-900"
                                    />
                                    <span className="text-xs text-gray-500">{speed.toFixed(1)}x</span>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Stability</label>
                                    <input
                                        type="range"
                                        min={0} max={100} value={stability}
                                        onChange={(e) => setStability(Number(e.target.value))}
                                        className="w-full accent-gray-900"
                                    />
                                    <span className="text-xs text-gray-500">{stability}%</span>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Clarity</label>
                                    <input
                                        type="range"
                                        min={0} max={100} value={similarity}
                                        onChange={(e) => setSimilarity(Number(e.target.value))}
                                        className="w-full accent-gray-900"
                                    />
                                    <span className="text-xs text-gray-500">{similarity}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chunk Preview */}
                    {!isGenerating && progress.status !== 'complete' && plan && plan.chunks.length > 1 && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-5">
                            <h3 className="font-semibold text-gray-900 text-sm mb-3">
                                Script will be split into {plan.chunks.length} chunks
                            </h3>
                            <div className="space-y-2">
                                {plan.chunks.slice(0, 5).map((chunk) => (
                                    <div key={chunk.index} className="flex items-center gap-3 text-sm">
                                        <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                            {chunk.index + 1}
                                        </span>
                                        <span className="text-gray-500 flex-1 truncate">
                                            {chunk.text.substring(0, 80)}...
                                        </span>
                                        <span className="text-xs text-gray-400 shrink-0">{chunk.wordCount} words</span>
                                    </div>
                                ))}
                                {plan.chunks.length > 5 && (
                                    <p className="text-xs text-gray-400 pl-9">
                                        + {plan.chunks.length - 5} more chunks
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    {!isGenerating && progress.status !== 'complete' && scriptText.trim() && (
                        <button
                            onClick={handleGenerate}
                            disabled={!currentVoice || !hasEnoughCredits || scriptText.trim().length < 10}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold text-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate Voiceover ({totalCredits.toLocaleString()} credits)
                        </button>
                    )}

                    {!hasEnoughCredits && plan && !isGenerating && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                                Not enough credits. You need {totalCredits.toLocaleString()} but have {(profile?.remainingCredits || 0).toLocaleString()}.
                            </span>
                            <button
                                onClick={() => onNavigate?.('subscription')}
                                className="ml-auto text-red-700 font-semibold underline shrink-0"
                            >
                                Upgrade
                            </button>
                        </div>
                    )}

                    {/* Progress Section */}
                    {isGenerating && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {progress.status === 'generating' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                                    {progress.status === 'stitching' && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
                                    <span className={`font-semibold ${getStatusColor(progress.status)}`}>
                                        {getStatusLabel(progress.status)}
                                    </span>
                                </div>
                                <button
                                    onClick={cancel}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <Square className="w-3.5 h-3.5" />
                                    Cancel
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-gray-500">
                                        {progress.completedChunks} of {progress.totalChunks} chunks
                                    </span>
                                    <span className="font-medium text-gray-900">{progress.percentage}%</span>
                                </div>
                                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progress.percentage}%` }}
                                    />
                                </div>
                            </div>

                            {/* ETA */}
                            {progress.estimatedTimeRemaining != null && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Clock className="w-4 h-4" />
                                    ~{Math.ceil(progress.estimatedTimeRemaining / 60)} min remaining
                                </div>
                            )}

                            {/* Chunk List */}
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                {progress.chunkResults.map((chunk) => (
                                    <div key={chunk.index} className="flex items-center gap-3 text-sm py-1.5">
                                        {chunk.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                                        {chunk.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />}
                                        {chunk.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
                                        {chunk.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                                        {chunk.status === 'skipped' && <X className="w-4 h-4 text-gray-400 shrink-0" />}
                                        <span className={`${chunk.status === 'complete' ? 'text-gray-700' : chunk.status === 'generating' ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                                            Chunk {chunk.index + 1}
                                        </span>
                                        {chunk.status === 'failed' && (
                                            <span className="text-xs text-red-500 truncate">{chunk.error}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Credits used so far */}
                            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                                {progress.totalCreditsUsed.toLocaleString()} credits used so far
                            </div>
                        </div>
                    )}

                    {/* Completion / Error / Cancelled States */}
                    {progress.status === 'complete' && progress.finalAudioUrl && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Voiceover Ready!</h3>
                                    <p className="text-sm text-gray-500">
                                        {progress.totalChunks} chunks stitched into one audio file
                                    </p>
                                </div>
                            </div>

                            {/* Audio Player */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handlePlayPause}
                                        className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0"
                                    >
                                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                                    </button>
                                    <div className="flex-1">
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                                            onClick={(e) => {
                                                if (!audioRef.current || !audioDuration) return;
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const pct = (e.clientX - rect.left) / rect.width;
                                                audioRef.current.currentTime = pct * audioDuration;
                                            }}
                                        >
                                            <div
                                                className="h-full bg-gray-900 rounded-full transition-all"
                                                style={{ width: `${audioProgress}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-xs text-gray-500">
                                                {formatTime(audioRef.current?.currentTime || 0)}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {formatTime(audioDuration)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Download MP3
                                </button>
                                <button
                                    onClick={() => {
                                        resetProgress();
                                        setScriptText('');
                                        setFileName(null);
                                        setIsPlaying(false);
                                        setAudioProgress(0);
                                        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
                                    }}
                                    className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    New Script
                                </button>
                            </div>

                            <div className="text-xs text-gray-400">
                                Total credits used: {progress.totalCreditsUsed.toLocaleString()}
                            </div>
                        </div>
                    )}

                    {(progress.status === 'error' || progress.status === 'cancelled') && (
                        <div className={`rounded-2xl border p-5 ${progress.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-start gap-3">
                                <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${progress.status === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                                <div>
                                    <h3 className={`font-semibold ${progress.status === 'error' ? 'text-red-900' : 'text-amber-900'}`}>
                                        {progress.status === 'error' ? 'Generation Failed' : 'Generation Cancelled'}
                                    </h3>
                                    {progress.error && (
                                        <p className="text-sm text-red-700 mt-1">{progress.error}</p>
                                    )}
                                    <p className="text-sm text-gray-600 mt-2">
                                        {progress.completedChunks} of {progress.totalChunks} chunks completed.
                                        {progress.totalCreditsUsed > 0 && ` ${progress.totalCreditsUsed.toLocaleString()} credits were used for completed chunks.`}
                                        {progress.status === 'error' && ' Failed chunk credits were automatically refunded.'}
                                    </p>
                                    <button
                                        onClick={resetProgress}
                                        className="mt-3 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
